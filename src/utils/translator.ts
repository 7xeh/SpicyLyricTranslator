import storage from './storage';
import { warn, error as logError } from './debug';
import { 
    getTrackCache, 
    setTrackCache, 
    clearAllTrackCache, 
    getTrackCacheStats, 
    getAllCachedTracks, 
    deleteTrackCache,
    getCurrentTrackUri 
} from './trackCache';
import { detectLanguageHeuristic, isSameLanguage } from './languageDetection';

export interface TranslationResult {
    originalText: string;
    translatedText: string;
    detectedLanguage?: string;
    targetLanguage: string;
    wasTranslated?: boolean;
    source?: 'cache' | 'api';
    apiProvider?: string;
}

export interface TranslationCache {
    [key: string]: {
        translation: string;
        timestamp: number;
        api?: string;
    };
}

export type ApiPreference = 'google' | 'libretranslate' | 'deepl' | 'openai' | 'gemini' | 'custom';

let preferredApi: ApiPreference = 'google';
let customApiUrl: string = '';
let customApiKey: string = '';
let deeplApiKey: string = '';
let openaiApiKey: string = '';
let openaiModel: string = 'gpt-4o-mini';
let geminiApiKey: string = '';

const RATE_LIMIT = {
    minDelayMs: 100,
    maxDelayMs: 2000,
    maxRetries: 3,
    backoffMultiplier: 2
};

let lastApiCallTime = 0;

const BATCH_SEPARATOR = ' ||| ';
const BATCH_SEPARATOR_REGEX = /\s*\|\|\|\s*/g;
const BATCH_MARKER_PREFIX = '[[SLT_BATCH_';
const BATCH_CHUNK_SIZE = 6;
const NON_LATIN_SEGMENT_REGEX = /([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}\p{Script=Cyrillic}\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Devanagari}\p{Script=Greek}]+)/gu;

function normalizeSourceLineForFingerprint(line: string): string {
    return (line || '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function computeSourceLyricsFingerprint(lines: string[]): string {
    let hash = 2166136261;

    for (const rawLine of lines) {
        const line = normalizeSourceLineForFingerprint(rawLine);
        const value = `${line}\u241E`;

        for (let i = 0; i < value.length; i++) {
            hash ^= value.charCodeAt(i);
            hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
        }
    }

    return `${lines.length}:${(hash >>> 0).toString(36)}`;
}

function hasMixedLatinAndNonLatin(text: string): boolean {
    if (!text) return false;
    const hasLatin = /[A-Za-z]/.test(text);
    const hasNonLatin = NON_LATIN_SEGMENT_REGEX.test(text);
    NON_LATIN_SEGMENT_REGEX.lastIndex = 0;
    return hasLatin && hasNonLatin;
}

function normalizeComparisonText(value: string): string {
    return (value || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function getLatinSkeleton(text: string): string {
    return normalizeComparisonText(
        (text || '')
            .replace(NON_LATIN_SEGMENT_REGEX, ' ')
            .replace(/\s+/g, ' ')
            .trim()
    );
}

function isSuspiciousMixedLineTranslation(source: string, translated: string): boolean {
    if (!hasMixedLatinAndNonLatin(source)) return false;

    const translatedNorm = normalizeComparisonText(translated);
    const latinSkeleton = getLatinSkeleton(source);

    if (!translatedNorm || !latinSkeleton) return false;

    return translatedNorm === latinSkeleton;
}

async function repairMixedLineTranslation(source: string, translated: string, targetLang: string): Promise<string> {
    if (!isSuspiciousMixedLineTranslation(source, translated)) {
        return translated;
    }

    const segments = Array.from((source || '').matchAll(NON_LATIN_SEGMENT_REGEX)).map(match => match[0]);
    if (segments.length === 0) {
        return translated;
    }

    let repaired = source;
    for (const segment of segments) {
        if (!segment || segment.trim().length === 0) continue;
        try {
            const segmentResult = await translateText(segment, targetLang);
            const replacement = normalizeTranslatedLine(segmentResult.translatedText || '').trim();
            if (replacement) {
                repaired = repaired.replace(segment, ` ${replacement} `);
            }
        } catch {
        }
    }

    const normalizedRepaired = normalizeTranslatedLine(repaired || '').trim();
    if (!normalizedRepaired || normalizedRepaired === source.trim()) {
        return translated;
    }

    return normalizedRepaired;
}

function shouldInvalidateTrackCacheForMixedContent(
    sourceLines: string[],
    cachedTranslatedLines: string[],
    targetLang: string
): boolean {
    if (sourceLines.length === 0 || cachedTranslatedLines.length !== sourceLines.length) {
        return true;
    }

    let suspiciousUnchanged = 0;

    for (let i = 0; i < sourceLines.length; i++) {
        const sourceLine = normalizeSourceLineForFingerprint(sourceLines[i]);
        const translatedLine = normalizeSourceLineForFingerprint(cachedTranslatedLines[i] || '');

        if (!sourceLine || sourceLine.length < 3) {
            continue;
        }

        if (sourceLine !== translatedLine) {
            continue;
        }

        const detected = detectLanguageHeuristic(sourceLines[i]);
        if (detected && detected.confidence >= 0.8 && !isSameLanguage(detected.code, targetLang)) {
            suspiciousUnchanged++;
        }
    }

    return suspiciousUnchanged >= 2;
}

async function rateLimitedDelay(): Promise<void> {
    const now = Date.now();
    const timeSinceLastCall = now - lastApiCallTime;
    if (timeSinceLastCall < RATE_LIMIT.minDelayMs) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT.minDelayMs - timeSinceLastCall));
    }
    lastApiCallTime = Date.now();
}

async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = RATE_LIMIT.maxRetries,
    baseDelay: number = RATE_LIMIT.minDelayMs
): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            await rateLimitedDelay();
            return await fn();
        } catch (error) {
            lastError = error as Error;
            
            if (error instanceof Error && error.message.includes('40')) {
                throw error;
            }
            
            if (attempt < maxRetries) {
                const delay = Math.min(
                    baseDelay * Math.pow(RATE_LIMIT.backoffMultiplier, attempt),
                    RATE_LIMIT.maxDelayMs
                );
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw lastError || new Error('All retry attempts failed');
}

export function setPreferredApi(api: ApiPreference, customUrl?: string, apiKeys?: { customApiKey?: string; deeplApiKey?: string; openaiApiKey?: string; openaiModel?: string; geminiApiKey?: string }): void {
    preferredApi = api;
    if (customUrl !== undefined) {
        customApiUrl = customUrl;
    }
    if (apiKeys) {
        if (apiKeys.customApiKey !== undefined) customApiKey = apiKeys.customApiKey;
        if (apiKeys.deeplApiKey !== undefined) deeplApiKey = apiKeys.deeplApiKey;
        if (apiKeys.openaiApiKey !== undefined) openaiApiKey = apiKeys.openaiApiKey;
        if (apiKeys.openaiModel !== undefined) openaiModel = apiKeys.openaiModel;
        if (apiKeys.geminiApiKey !== undefined) geminiApiKey = apiKeys.geminiApiKey;
    }
}

export function getPreferredApi(): { api: ApiPreference; customUrl: string } {
    return { api: preferredApi, customUrl: customApiUrl };
}

const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;

export const SUPPORTED_LANGUAGES: { code: string; name: string }[] = [
    { code: 'af', name: 'Afrikaans' },
    { code: 'sq', name: 'Albanian' },
    { code: 'am', name: 'Amharic' },
    { code: 'ar', name: 'Arabic' },
    { code: 'hy', name: 'Armenian' },
    { code: 'az', name: 'Azerbaijani' },
    { code: 'eu', name: 'Basque' },
    { code: 'be', name: 'Belarusian' },
    { code: 'bn', name: 'Bengali' },
    { code: 'bs', name: 'Bosnian' },
    { code: 'bg', name: 'Bulgarian' },
    { code: 'ca', name: 'Catalan' },
    { code: 'ceb', name: 'Cebuano' },
    { code: 'zh', name: 'Chinese (Simplified)' },
    { code: 'zh-TW', name: 'Chinese (Traditional)' },
    { code: 'hr', name: 'Croatian' },
    { code: 'cs', name: 'Czech' },
    { code: 'da', name: 'Danish' },
    { code: 'nl', name: 'Dutch' },
    { code: 'en', name: 'English' },
    { code: 'eo', name: 'Esperanto' },
    { code: 'et', name: 'Estonian' },
    { code: 'fi', name: 'Finnish' },
    { code: 'fr', name: 'French' },
    { code: 'gl', name: 'Galician' },
    { code: 'ka', name: 'Georgian' },
    { code: 'de', name: 'German' },
    { code: 'el', name: 'Greek' },
    { code: 'gu', name: 'Gujarati' },
    { code: 'ht', name: 'Haitian Creole' },
    { code: 'ha', name: 'Hausa' },
    { code: 'haw', name: 'Hawaiian' },
    { code: 'he', name: 'Hebrew' },
    { code: 'hi', name: 'Hindi' },
    { code: 'hmn', name: 'Hmong' },
    { code: 'hu', name: 'Hungarian' },
    { code: 'is', name: 'Icelandic' },
    { code: 'ig', name: 'Igbo' },
    { code: 'id', name: 'Indonesian' },
    { code: 'ga', name: 'Irish' },
    { code: 'it', name: 'Italian' },
    { code: 'ja', name: 'Japanese' },
    { code: 'jv', name: 'Javanese' },
    { code: 'kn', name: 'Kannada' },
    { code: 'kk', name: 'Kazakh' },
    { code: 'km', name: 'Khmer' },
    { code: 'rw', name: 'Kinyarwanda' },
    { code: 'ko', name: 'Korean' },
    { code: 'ku', name: 'Kurdish' },
    { code: 'ky', name: 'Kyrgyz' },
    { code: 'lo', name: 'Lao' },
    { code: 'la', name: 'Latin' },
    { code: 'lv', name: 'Latvian' },
    { code: 'lt', name: 'Lithuanian' },
    { code: 'lb', name: 'Luxembourgish' },
    { code: 'mk', name: 'Macedonian' },
    { code: 'mg', name: 'Malagasy' },
    { code: 'ms', name: 'Malay' },
    { code: 'ml', name: 'Malayalam' },
    { code: 'mt', name: 'Maltese' },
    { code: 'mi', name: 'Maori' },
    { code: 'mr', name: 'Marathi' },
    { code: 'mn', name: 'Mongolian' },
    { code: 'my', name: 'Myanmar (Burmese)' },
    { code: 'ne', name: 'Nepali' },
    { code: 'no', name: 'Norwegian' },
    { code: 'ny', name: 'Nyanja (Chichewa)' },
    { code: 'or', name: 'Odia (Oriya)' },
    { code: 'ps', name: 'Pashto' },
    { code: 'fa', name: 'Persian' },
    { code: 'pl', name: 'Polish' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'pa', name: 'Punjabi' },
    { code: 'ro', name: 'Romanian' },
    { code: 'ru', name: 'Russian' },
    { code: 'sm', name: 'Samoan' },
    { code: 'gd', name: 'Scots Gaelic' },
    { code: 'sr', name: 'Serbian' },
    { code: 'st', name: 'Sesotho' },
    { code: 'sn', name: 'Shona' },
    { code: 'sd', name: 'Sindhi' },
    { code: 'si', name: 'Sinhala' },
    { code: 'sk', name: 'Slovak' },
    { code: 'sl', name: 'Slovenian' },
    { code: 'so', name: 'Somali' },
    { code: 'es', name: 'Spanish' },
    { code: 'su', name: 'Sundanese' },
    { code: 'sw', name: 'Swahili' },
    { code: 'sv', name: 'Swedish' },
    { code: 'tl', name: 'Tagalog (Filipino)' },
    { code: 'tg', name: 'Tajik' },
    { code: 'ta', name: 'Tamil' },
    { code: 'tt', name: 'Tatar' },
    { code: 'te', name: 'Telugu' },
    { code: 'th', name: 'Thai' },
    { code: 'tr', name: 'Turkish' },
    { code: 'tk', name: 'Turkmen' },
    { code: 'uk', name: 'Ukrainian' },
    { code: 'ur', name: 'Urdu' },
    { code: 'ug', name: 'Uyghur' },
    { code: 'uz', name: 'Uzbek' },
    { code: 'vi', name: 'Vietnamese' },
    { code: 'cy', name: 'Welsh' },
    { code: 'xh', name: 'Xhosa' },
    { code: 'yi', name: 'Yiddish' },
    { code: 'yo', name: 'Yoruba' },
    { code: 'zu', name: 'Zulu' },
];

function getCachedTranslation(text: string, targetLang: string): string | null {
    const cache = storage.getJSON<TranslationCache>('translation-cache', {});
    const key = `${targetLang}:${text}`;
    const cached = cache[key];
    
    if (cached) {
        if (Date.now() - cached.timestamp < CACHE_EXPIRY) {
            const normalized = normalizeTranslatedLine(cached.translation || '');
            if (normalized !== cached.translation) {
                cache[key] = {
                    ...cached,
                    translation: normalized,
                    timestamp: Date.now()
                };
                storage.setJSON('translation-cache', cache);
            }

            if (isSuspiciousMixedLineTranslation(text, normalized)) {
                delete cache[key];
                storage.setJSON('translation-cache', cache);
                return null;
            }

            if (normalized === text) {
                const detected = detectLanguageHeuristic(text);
                if (detected && detected.confidence >= 0.8 && !isSameLanguage(detected.code, targetLang)) {
                    delete cache[key];
                    storage.setJSON('translation-cache', cache);
                    return null;
                }
            }

            return normalized;
        }
    }
    
    return null;
}

function cacheTranslation(text: string, targetLang: string, translation: string, api?: string): void {
    const cache = storage.getJSON<TranslationCache>('translation-cache', {});
    const key = `${targetLang}:${text}`;
    const normalizedTranslation = normalizeTranslatedLine(translation || '');
    
    cache[key] = {
        translation: normalizedTranslation,
        timestamp: Date.now(),
        api
    };
    
    const keys = Object.keys(cache);
    if (keys.length > MAX_CACHE_ENTRIES) {
        const now = Date.now();
        const sorted = keys
            .map(k => ({ key: k, entry: cache[k] }))
            .sort((a, b) => a.entry.timestamp - b.entry.timestamp);
        
        const toRemove = sorted.filter(item => 
            now - item.entry.timestamp > CACHE_EXPIRY
        ).map(item => item.key);
        
        const remaining = keys.length - toRemove.length;
        if (remaining > MAX_CACHE_ENTRIES) {
            const validSorted = sorted.filter(item => 
                now - item.entry.timestamp <= CACHE_EXPIRY
            );
            const additionalRemove = validSorted
                .slice(0, remaining - MAX_CACHE_ENTRIES)
                .map(item => item.key);
            toRemove.push(...additionalRemove);
        }
        
        toRemove.forEach(k => delete cache[k]);
    }
    
    storage.setJSON('translation-cache', cache);
}

async function translateWithGoogle(text: string, targetLang: string): Promise<{ translation: string; detectedLang: string }> {
    const encodedText = encodeURIComponent(text);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodedText}`;
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Google Translate API error: ${response.status}`);
    }
    
    const data = await response.json();
    const detectedLang = data[2] || 'unknown';
    
    if (data && data[0]) {
        let translation = '';
        for (const sentence of data[0]) {
            if (sentence && sentence[0]) {
                translation += sentence[0];
            }
        }
        if (translation) {
            return { translation, detectedLang };
        }
    }
    
    throw new Error('Invalid response from Google Translate');
}

async function translateWithLibreTranslate(text: string, targetLang: string): Promise<string> {
    const url = 'https://libretranslate.de/translate';
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            q: text,
            source: 'auto',
            target: targetLang,
            format: 'text'
        })
    });
    
    if (!response.ok) {
        throw new Error(`LibreTranslate API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.translatedText;
}

async function translateWithDeepL(text: string, targetLang: string): Promise<{ translation: string; detectedLang?: string }> {
    if (!deeplApiKey) {
        throw new Error('DeepL API key not configured. Set it in Settings.');
    }
    
    const isFreePlan = deeplApiKey.endsWith(':fx');
    const baseUrl = isFreePlan ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
    const url = `${baseUrl}/v2/translate`;
    
    const deeplLangMap: Record<string, string> = {
        'en': 'EN-US', 'pt': 'PT-BR', 'zh': 'ZH-HANS', 'zh-TW': 'ZH-HANT'
    };
    const deeplTarget = deeplLangMap[targetLang] || targetLang.toUpperCase();
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `DeepL-Auth-Key ${deeplApiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            text: [text],
            target_lang: deeplTarget
        })
    });
    
    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`DeepL API error: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    
    if (data.translations && data.translations.length > 0) {
        return {
            translation: data.translations[0].text,
            detectedLang: data.translations[0].detected_source_language?.toLowerCase()
        };
    }
    
    throw new Error('Invalid response from DeepL API');
}

async function translateWithOpenAI(text: string, targetLang: string): Promise<{ translation: string; detectedLang?: string }> {
    if (!openaiApiKey) {
        throw new Error('OpenAI API key not configured. Set it in Settings.');
    }
    
    const langName = SUPPORTED_LANGUAGES.find(l => l.code === targetLang)?.name || targetLang;
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: openaiModel || 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: `You are a song lyrics translator. Translate the given lyrics to ${langName}. Output ONLY the translated text, nothing else. Preserve line breaks. Keep the poetic feel and rhythm where possible.`
                },
                {
                    role: 'user',
                    content: text
                }
            ],
            temperature: 0.3,
            max_tokens: Math.max(text.length * 3, 500)
        })
    });
    
    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    
    if (data.choices && data.choices.length > 0) {
        const translation = data.choices[0].message?.content?.trim();
        if (translation) {
            return { translation };
        }
    }
    
    throw new Error('Invalid response from OpenAI API');
}

async function translateWithGemini(text: string, targetLang: string): Promise<{ translation: string; detectedLang?: string }> {
    if (!geminiApiKey) {
        throw new Error('Gemini API key not configured. Set it in Settings.');
    }

    const langName = SUPPORTED_LANGUAGES.find(l => l.code === targetLang)?.name || targetLang;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [
                {
                    parts: [
                        {
                            text: `You are a song lyrics translator. Translate the following lyrics to ${langName}. Output ONLY the translated text, nothing else. Preserve line breaks. Keep the poetic feel and rhythm where possible.\n\n${text}`
                        }
                    ]
                }
            ],
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: Math.max(text.length * 3, 500)
            }
        })
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Gemini API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    if (data.candidates && data.candidates.length > 0) {
        const translation = data.candidates[0]?.content?.parts?.[0]?.text?.trim();
        if (translation) {
            return { translation };
        }
    }

    throw new Error('Invalid response from Gemini API');
}

async function translateWithCustomApi(text: string, targetLang: string): Promise<{ translation: string; detectedLang?: string }> {
    if (!customApiUrl) {
        throw new Error('Custom API URL not configured');
    }
    
    try {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };
        if (customApiKey) {
            headers['Authorization'] = `Bearer ${customApiKey}`;
            headers['X-API-Key'] = customApiKey;
        }
        
        const response = await fetch(customApiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                text: text,
                q: text,
                source: 'auto',
                target: targetLang,
                target_lang: targetLang,
                format: 'text'
            })
        });
        
        if (!response.ok) {
            const errorBody = await response.text().catch(() => '');
            throw new Error(`Custom API error: ${response.status} ${errorBody}`);
        }
        
        const data = await response.json();
        
        const translation = data.translatedText || 
                          data.translated_text || 
                          data.translation || 
                          data.result || 
                          data.text ||
                          (data.translations && data.translations[0]?.text) ||
                          (data.data && data.data.translatedText) ||
                          (data.choices && data.choices[0]?.message?.content) ||
                          (Array.isArray(data) && data[0]?.translatedText);
        
        if (translation) {
            return { 
                translation: typeof translation === 'string' ? translation : String(translation),
                detectedLang: data.detectedLanguage || data.detected_language || data.sourceLang || data.src || data.detected_source_language
            };
        }
        
        throw new Error(`Could not parse translation from API response: ${JSON.stringify(data).slice(0, 200)}`);
    } catch (error) {
        logError('Custom API error:', error);
        throw error;
    }
}

function extractDetectedLanguage(data: any): string | undefined {
    return data?.detectedLanguage || data?.detected_language || data?.sourceLang || data?.src;
}

function normalizeBatchTranslations(data: any): { translations: string[]; detectedLang?: string } | null {
    const candidates: unknown[] = [
        data?.translatedText,
        data?.translated_text,
        data?.translation,
        data?.result,
        data?.text,
        data?.data?.translatedText,
        data?.translations,
        data
    ];

    for (const candidate of candidates) {
        if (!Array.isArray(candidate)) continue;

        if (candidate.every(item => typeof item === 'string')) {
            return {
                translations: (candidate as string[]).map(item => item ?? ''),
                detectedLang: extractDetectedLanguage(data)
            };
        }

        if (candidate.every(item => typeof item === 'object' && item !== null && ('text' in item || 'translatedText' in item))) {
            const translations = candidate.map(item => {
                const value = (item as any).translatedText ?? (item as any).text ?? '';
                return String(value);
            });
            return {
                translations,
                detectedLang: extractDetectedLanguage(data)
            };
        }
    }

    return null;
}

async function translateBatchArray(texts: string[], targetLang: string): Promise<{ translations: string[]; detectedLang?: string }> {
    if (texts.length === 0) {
        return { translations: [], detectedLang: undefined };
    }

    // DeepL has native batch support
    if (preferredApi === 'deepl' && deeplApiKey) {
        const isFreePlan = deeplApiKey.endsWith(':fx');
        const baseUrl = isFreePlan ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
        const deeplLangMap: Record<string, string> = {
            'en': 'EN-US', 'pt': 'PT-BR', 'zh': 'ZH-HANS', 'zh-TW': 'ZH-HANT'
        };
        const deeplTarget = deeplLangMap[targetLang] || targetLang.toUpperCase();
        
        const response = await fetch(`${baseUrl}/v2/translate`, {
            method: 'POST',
            headers: {
                'Authorization': `DeepL-Auth-Key ${deeplApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: texts,
                target_lang: deeplTarget
            })
        });

        if (!response.ok) {
            throw new Error(`DeepL batch API error: ${response.status}`);
        }

        const data = await response.json();
        if (data.translations && Array.isArray(data.translations)) {
            return {
                translations: data.translations.map((t: any) => t.text || ''),
                detectedLang: data.translations[0]?.detected_source_language?.toLowerCase()
            };
        }
        throw new Error('DeepL batch returned unexpected format');
    }

    const url = preferredApi === 'libretranslate'
        ? 'https://libretranslate.de/translate'
        : customApiUrl;

    if (!url) {
        throw new Error('Custom API URL not configured');
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };
    if (preferredApi === 'custom' && customApiKey) {
        headers['Authorization'] = `Bearer ${customApiKey}`;
        headers['X-API-Key'] = customApiKey;
    }

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            q: texts,
            text: texts,
            source: 'auto',
            target: targetLang,
            target_lang: targetLang,
            format: 'text'
        })
    });

    if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`Batch API error: ${response.status} ${errorBody}`);
    }

    const data = await response.json();
    const normalized = normalizeBatchTranslations(data);
    if (!normalized) {
        throw new Error('Batch API returned non-array payload');
    }

    return normalized;
}

function buildMarkedBatchPayload(lines: string[]): { combinedText: string; markerNonce: string } {
    const markerNonce = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const combinedText = lines
        .map((line, index) => `${BATCH_MARKER_PREFIX}${markerNonce}_${index}]]${line}`)
        .join('\n');
    return { combinedText, markerNonce };
}

function parseMarkedBatchResponse(translatedText: string, expectedCount: number, markerNonce: string): string[] | null {
    const markerRegex = new RegExp(`\\[\\[SLT_BATCH_${markerNonce}_(\\d+)\\]\\]`, 'g');
    const matches: Array<{ index: number; start: number; markerEnd: number }> = [];

    let match: RegExpExecArray | null;
    while ((match = markerRegex.exec(translatedText)) !== null) {
        matches.push({
            index: Number.parseInt(match[1], 10),
            start: match.index,
            markerEnd: markerRegex.lastIndex
        });
    }

    if (matches.length !== expectedCount) {
        return null;
    }

    const seen = new Set<number>();
    const byIndex = new Array<string>(expectedCount).fill('');

    for (let i = 0; i < matches.length; i++) {
        const current = matches[i];
        const next = matches[i + 1];

        if (current.index < 0 || current.index >= expectedCount || seen.has(current.index)) {
            return null;
        }
        seen.add(current.index);

        const segment = translatedText.slice(current.markerEnd, next ? next.start : translatedText.length);
        byIndex[current.index] = segment.replace(/^\s+/, '').trimEnd();
    }

    if (seen.size !== expectedCount) {
        return null;
    }

    return byIndex;
}

function normalizeTranslatedLine(text: string): string {
    return text
    .replace(/\[\[\s*SLT[\s_-]*BATCH[^\]]*\]\]/gi, '')
        .replace(/\r?\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function parseBatchTextFallbacks(translatedText: string, expectedCount: number): string[] | null {
    const separatorSplit = translatedText
        .split(BATCH_SEPARATOR_REGEX)
        .map(s => normalizeTranslatedLine(s));
    if (separatorSplit.length === expectedCount) {
        return separatorSplit;
    }

    const newlineSplit = translatedText
        .split(/\r?\n+/)
        .map(s => normalizeTranslatedLine(s))
        .filter(Boolean);
    if (newlineSplit.length === expectedCount) {
        return newlineSplit;
    }

    return null;
}

async function translateChunkedBatch(
    lines: string[],
    targetLang: string,
    chunkSize: number = BATCH_CHUNK_SIZE
): Promise<{ translations: string[]; detectedLang?: string }> {
    const translations: string[] = [];
    let detectedLang: string | undefined;

    for (let start = 0; start < lines.length; start += chunkSize) {
        const chunk = lines.slice(start, start + chunkSize);
        const { combinedText, markerNonce } = buildMarkedBatchPayload(chunk);
        const result = await retryWithBackoff(() => translateText(combinedText, targetLang));

        const parsed =
            parseMarkedBatchResponse(result.translatedText, chunk.length, markerNonce) ||
            parseBatchTextFallbacks(result.translatedText, chunk.length);

        if (!parsed || parsed.length !== chunk.length) {
            throw new Error(`Chunked batch mismatch: Sent ${chunk.length}, got ${parsed?.length ?? 0}`);
        }

        if (!detectedLang && result.detectedLanguage) {
            detectedLang = result.detectedLanguage;
        }

        translations.push(...parsed);
    }

    return { translations, detectedLang };
}

export async function translateText(text: string, targetLang: string): Promise<TranslationResult> {
    const cached = getCachedTranslation(text, targetLang);
    if (cached) {
        return {
            originalText: text,
            translatedText: cached,
            targetLanguage: targetLang
        };
    }
    
    const tryGoogle = async () => {
        const result = await translateWithGoogle(text, targetLang);
        return { translation: result.translation, detectedLang: result.detectedLang };
    };
    
    const tryLibreTranslate = async () => {
        const translation = await translateWithLibreTranslate(text, targetLang);
        return { translation, detectedLang: undefined };
    };
    
    const tryCustom = async () => {
        const result = await translateWithCustomApi(text, targetLang);
        return { translation: result.translation, detectedLang: result.detectedLang };
    };
    
    const tryDeepL = async () => {
        const result = await translateWithDeepL(text, targetLang);
        return { translation: result.translation, detectedLang: result.detectedLang };
    };
    
    const tryOpenAI = async () => {
        const result = await translateWithOpenAI(text, targetLang);
        return { translation: result.translation, detectedLang: result.detectedLang };
    };
    
    const tryGemini = async () => {
        const result = await translateWithGemini(text, targetLang);
        return { translation: result.translation, detectedLang: result.detectedLang };
    };
    
    let primaryApi: () => Promise<{ translation: string; detectedLang?: string }>;
    let fallbackApis: { name: string, fn: () => Promise<{ translation: string; detectedLang?: string }> }[] = [];
    
    switch (preferredApi) {
        case 'libretranslate':
            primaryApi = tryLibreTranslate;
            fallbackApis = [{ name: 'google', fn: tryGoogle }];
            break;
        case 'deepl':
            primaryApi = tryDeepL;
            fallbackApis = [{ name: 'google', fn: tryGoogle }];
            break;
        case 'openai':
            primaryApi = tryOpenAI;
            fallbackApis = [{ name: 'google', fn: tryGoogle }];
            break;
        case 'gemini':
            primaryApi = tryGemini;
            fallbackApis = [{ name: 'google', fn: tryGoogle }];
            break;
        case 'custom':
            primaryApi = tryCustom;
            fallbackApis = [{ name: 'google', fn: tryGoogle }, { name: 'libretranslate', fn: tryLibreTranslate }];
            break;
        case 'google':
        default:
            primaryApi = tryGoogle;
            fallbackApis = [{ name: 'libretranslate', fn: tryLibreTranslate }];
            break;
    }
    
    try {
        const result = await primaryApi();
        
        cacheTranslation(text, targetLang, result.translation, preferredApi);
        return {
            originalText: text,
            translatedText: result.translation,
            detectedLanguage: result.detectedLang,
            targetLanguage: targetLang,
            wasTranslated: true
        };
    } catch (primaryError) {
        warn(`Primary API (${preferredApi}) failed, trying fallbacks:`, primaryError);
        
        for (const fallbackApi of fallbackApis) {
            try {
                const result = await fallbackApi.fn();
                
                cacheTranslation(text, targetLang, result.translation, fallbackApi.name);
                return {
                    originalText: text,
                    translatedText: result.translation,
                    detectedLanguage: result.detectedLang,
                    targetLanguage: targetLang,
                    wasTranslated: true
                };
            } catch (fallbackError) {
                warn(`Fallback API (${fallbackApi.name}) failed:`, fallbackError);
                continue;
            }
        }
        
        logError('All translation services failed');
        throw new Error('Translation failed. Please try again later.');
    }
}

export async function translateLyrics(
    lines: string[], 
    targetLang: string, 
    trackUri?: string,
    detectedSourceLang?: string
): Promise<TranslationResult[]> {
    const currentTrackUri = trackUri || getCurrentTrackUri();
    const sourceFingerprint = computeSourceLyricsFingerprint(lines);
    
    if (currentTrackUri) {
        const trackCache = getTrackCache(currentTrackUri, targetLang);
        if (trackCache && trackCache.lines.length === lines.length) {
            if (trackCache.sourceFingerprint && trackCache.sourceFingerprint === sourceFingerprint) {
                if (!shouldInvalidateTrackCacheForMixedContent(lines, trackCache.lines, targetLang)) {
                    return lines.map((line, index) => ({
                        originalText: line,
                        translatedText: trackCache.lines[index] || line,
                        targetLanguage: targetLang,
                        wasTranslated: trackCache.lines[index] !== line,
                        source: 'cache' as const,
                        apiProvider: trackCache.api
                    }));
                }

                deleteTrackCache(currentTrackUri, targetLang);
            } else {
                deleteTrackCache(currentTrackUri, targetLang);
            }
        }
    }
    
    const results: TranslationResult[] = [];
    const cachedResults: Map<number, TranslationResult> = new Map();
    const uncachedLines: { index: number; text: string }[] = [];
    
    lines.forEach((line, index) => {
        if (!line.trim()) {
            cachedResults.set(index, {
                originalText: line,
                translatedText: line,
                targetLanguage: targetLang,
                wasTranslated: false,
                source: 'cache'
            });
        } else {
            const cached = getCachedTranslation(line, targetLang);
            if (cached) {
                const lineCache = storage.getJSON<TranslationCache>('translation-cache', {});
                const lineKey = `${targetLang}:${line}`;
                const lineCacheEntry = lineCache[lineKey];
                cachedResults.set(index, {
                    originalText: line,
                    translatedText: cached,
                    targetLanguage: targetLang,
                    wasTranslated: cached !== line,
                    source: 'cache',
                    apiProvider: lineCacheEntry?.api
                });
            } else {
                uncachedLines.push({ index, text: line });
            }
        }
    });
    
    if (uncachedLines.length === 0) {
        const finalResults = lines.map((_, index) => cachedResults.get(index)!);
        
        if (currentTrackUri) {
            const translatedLines = finalResults.map(r => r.translatedText);
            setTrackCache(currentTrackUri, targetLang, detectedSourceLang || 'auto', translatedLines, preferredApi, sourceFingerprint);
        }
        
        return finalResults;
    }
    
    let detectedLang = detectedSourceLang || 'auto';
    
    try {
        let translatedLines: string[] | null = null;

        if ((preferredApi === 'custom' || preferredApi === 'libretranslate' || preferredApi === 'deepl') && uncachedLines.length > 1) {
            try {
                const batchResult = await retryWithBackoff(() => translateBatchArray(uncachedLines.map(l => l.text), targetLang));
                translatedLines = batchResult.translations;
                if (batchResult.detectedLang) {
                    detectedLang = batchResult.detectedLang;
                }
            } catch (batchArrayError) {
                warn('Batch-array translation unavailable, falling back to marker batching:', batchArrayError);
            }
        }

        if (!translatedLines) {
            const { combinedText, markerNonce } = buildMarkedBatchPayload(uncachedLines.map(l => l.text));
            const result = await retryWithBackoff(() => translateText(combinedText, targetLang));
            translatedLines =
                parseMarkedBatchResponse(result.translatedText, uncachedLines.length, markerNonce) ||
                parseBatchTextFallbacks(result.translatedText, uncachedLines.length);

            if (result.detectedLanguage) {
                detectedLang = result.detectedLanguage;
            }
        }

        if ((!translatedLines || translatedLines.length !== uncachedLines.length) && uncachedLines.length > 1) {
            warn(`Primary batch parse failed for ${uncachedLines.length} lines, trying chunked batch mode (${BATCH_CHUNK_SIZE}/request)`);
            const chunked = await translateChunkedBatch(uncachedLines.map(l => l.text), targetLang);
            translatedLines = chunked.translations;
            if (chunked.detectedLang) {
                detectedLang = chunked.detectedLang;
            }
        }

        if (!translatedLines || translatedLines.length !== uncachedLines.length) {
            throw new Error(`Batch translation mismatch: Sent ${uncachedLines.length} lines, got ${translatedLines?.length ?? 0}. API might have stripped delimiters.`);
        }
        
        uncachedLines.forEach((item, i) => {
            cachedResults.set(item.index, {
                originalText: item.text,
                translatedText: normalizeTranslatedLine(translatedLines[i] || '') || item.text,
                targetLanguage: targetLang,
                wasTranslated: (normalizeTranslatedLine(translatedLines[i] || '') || item.text) !== item.text,
                source: 'api',
                apiProvider: preferredApi
            });
        });

        for (const item of uncachedLines) {
            const existing = cachedResults.get(item.index);
            const initialTranslation = existing?.translatedText || item.text;
            const repairedTranslation = await repairMixedLineTranslation(item.text, initialTranslation, targetLang);
            const finalTranslation = normalizeTranslatedLine(repairedTranslation || '') || item.text;

            cacheTranslation(item.text, targetLang, finalTranslation, preferredApi);
            cachedResults.set(item.index, {
                originalText: item.text,
                translatedText: finalTranslation,
                targetLanguage: targetLang,
                wasTranslated: finalTranslation !== item.text,
                source: 'api',
                apiProvider: preferredApi
            });
        }
    } catch (error) {
        logError('Batch translation failed (fallback disabled to prevent rate limits):', error);
        
        for (const item of uncachedLines) {
            cachedResults.set(item.index, {
                originalText: item.text,
                translatedText: item.text,
                targetLanguage: targetLang,
                wasTranslated: false,
                source: 'api'
            });
        }
    }
    
    for (let i = 0; i < lines.length; i++) {
        results.push(cachedResults.get(i)!);
    }
    
    const someTranslated = results.some(r => r.wasTranslated);
    if (currentTrackUri && results.length > 0 && someTranslated) {
        const translatedLines = results.map(r => r.translatedText);
        setTrackCache(currentTrackUri, targetLang, detectedLang, translatedLines, preferredApi, sourceFingerprint);
    }
    
    return results;
}

export function clearTranslationCache(): void {
    storage.remove('translation-cache');
    clearAllTrackCache();
}

export function getCacheStats(): { 
    entries: number; 
    oldestTimestamp: number | null; 
    sizeBytes: number;
    trackCount?: number;
    totalLines?: number;
} {
    const lineCache = storage.getJSON<TranslationCache>('translation-cache', {});
    const lineKeys = Object.keys(lineCache);
    
    const trackStats = getTrackCacheStats();
    
    let lineSizeBytes = 0;
    let lineOldestTimestamp: number | null = null;
    
    if (lineKeys.length > 0) {
        const timestamps = lineKeys.map(k => lineCache[k].timestamp);
        lineSizeBytes = JSON.stringify(lineCache).length * 2;
        lineOldestTimestamp = Math.min(...timestamps);
    }
    
    const oldestTimestamp = lineOldestTimestamp !== null && trackStats.oldestTimestamp !== null
        ? Math.min(lineOldestTimestamp, trackStats.oldestTimestamp)
        : lineOldestTimestamp || trackStats.oldestTimestamp;
    
    return {
        entries: lineKeys.length + trackStats.trackCount,
        oldestTimestamp,
        sizeBytes: lineSizeBytes + trackStats.sizeBytes,
        trackCount: trackStats.trackCount,
        totalLines: trackStats.totalLines
    };
}

export function getCachedTranslations(): Array<{ original: string; translated: string; language: string; date: Date; api?: string }> {
    const cache = storage.getJSON<TranslationCache>('translation-cache', {});
    const entries: Array<{ original: string; translated: string; language: string; date: Date; api?: string }> = [];
    
    for (const key of Object.keys(cache)) {
        const [lang, ...textParts] = key.split(':');
        const original = textParts.join(':');
        entries.push({
            original,
            translated: cache[key].translation,
            language: lang,
            date: new Date(cache[key].timestamp),
            api: cache[key].api
        });
    }
    
    entries.sort((a, b) => b.date.getTime() - a.date.getTime());
    
    return entries;
}

export function deleteCachedTranslation(original: string, language: string): boolean {
    const cache = storage.getJSON<TranslationCache>('translation-cache', {});
    const key = `${language}:${original}`;
    
    if (cache[key]) {
        delete cache[key];
        storage.setJSON('translation-cache', cache);
        return true;
    }
    return false;
}

export function deleteTrackCacheEntry(trackUri: string, targetLang?: string): void {
    deleteTrackCache(trackUri, targetLang);
}

export function isOffline(): boolean {
    return typeof navigator !== 'undefined' && !navigator.onLine;
}

export { getAllCachedTracks, getTrackCacheStats };

export default {
    translateText,
    translateLyrics,
    clearTranslationCache,
    getCacheStats,
    getCachedTranslations,
    deleteCachedTranslation,
    deleteTrackCacheEntry,
    getAllCachedTracks,
    getTrackCacheStats,
    isOffline,
    setPreferredApi,
    getPreferredApi,
    SUPPORTED_LANGUAGES
};