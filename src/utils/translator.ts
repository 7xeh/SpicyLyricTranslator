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
import { detectLanguageHeuristic, isSameLanguage, normalizeLanguageCode } from './languageDetection';

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
export type CustomApiFormat = 'generic' | 'libretranslate' | 'openai' | 'gemini' | 'deepl';

const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite';
const DEFAULT_LIBRETRANSLATE_URL = 'https://libretranslate.com/translate';

let preferredApi: ApiPreference = 'google';
let customApiUrl: string = '';
let customApiKey: string = '';
let customApiFormat: CustomApiFormat = 'generic';
let customApiModel: string = '';
let libreTranslateApiUrl: string = DEFAULT_LIBRETRANSLATE_URL;
let libreTranslateApiKey: string = '';
let deeplApiKey: string = '';
let openaiApiKey: string = '';
let openaiModel: string = DEFAULT_OPENAI_MODEL;
let geminiApiKey: string = '';
let geminiModel: string = DEFAULT_GEMINI_MODEL;
let geminiTemperature: number = 0.3;

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
const SPICETIFY_CORS_PROXY_BASE = 'https://cors-proxy.spicetify.app/';

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

function targetLangIsLatinScript(targetLang: string): boolean {
    const base = (targetLang || '').toLowerCase().split(/[-_]/)[0];
    return !['ja', 'zh', 'ko', 'ar', 'he', 'ru', 'th', 'hi', 'el', 'fa', 'ur', 'bn', 'ta', 'te', 'kn', 'ml', 'gu', 'pa', 'or', 'si', 'my', 'km', 'lo', 'ka', 'am', 'yi', 'ug'].includes(base);
}

function sourceHasNonLatinScript(text: string): boolean {
    if (!text) return false;
    const hit = NON_LATIN_SEGMENT_REGEX.test(text);
    NON_LATIN_SEGMENT_REGEX.lastIndex = 0;
    return hit;
}

function shouldInvalidateIdentityTranslation(source: string, targetLang: string): boolean {
    if (!source) return false;
    const detected = detectLanguageHeuristic(source);
    if (detected && detected.confidence >= 0.6 && !isSameLanguage(detected.code, targetLang)) {
        return true;
    }
    if (sourceHasNonLatinScript(source) && targetLangIsLatinScript(targetLang)) {
        return true;
    }
    return false;
}

function getConfidentLineLanguage(text: string): string | undefined {
    const detected = detectLanguageHeuristic(text);
    return detected && detected.confidence >= 0.6 ? detected.code : undefined;
}

function getConfidentLineLanguages(lines: string[]): Set<string> {
    const languages = new Set<string>();

    for (const line of lines) {
        const lang = getConfidentLineLanguage(line);
        if (lang) {
            languages.add(normalizeLanguageCode(lang));
        }
    }

    return languages;
}

function getLineSourceLangHint(text: string, targetLang: string, fallbackSourceLang?: string, mixedSourceTrack: boolean = false): string | undefined {
    const lineLang = getConfidentLineLanguage(text);
    if (lineLang) {
        return lineLang;
    }

    if (mixedSourceTrack) {
        return undefined;
    }

    if (fallbackSourceLang && fallbackSourceLang !== 'auto' && fallbackSourceLang !== 'unknown' && !isSameLanguage(fallbackSourceLang, targetLang)) {
        return fallbackSourceLang;
    }

    return undefined;
}

function looksLikeMarkerDebris(text: string): boolean {
    if (!text) return false;
    if (/\[\[\s*SLT/i.test(text)) return true;
    if (/\bSLT[_\s-]*BATCH\b/i.test(text)) return true;
    if (/\]\]/.test(text) && /\b\d+\b/.test(text) && text.length < 60) return true;
    if (/^\s*[A-Za-z]{2,}_\d+\s*\]?\]?/.test(text)) return true;
    return false;
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
    let suspiciousDebris = 0;

    for (let i = 0; i < sourceLines.length; i++) {
        const sourceLine = normalizeSourceLineForFingerprint(sourceLines[i]);
        const translatedLine = normalizeSourceLineForFingerprint(cachedTranslatedLines[i] || '');
        const rawTranslated = cachedTranslatedLines[i] || '';

        if (looksLikeMarkerDebris(rawTranslated)) {
            suspiciousDebris++;
        }

        if (!sourceLine || sourceLine.length < 3) {
            continue;
        }

        if (sourceLine !== translatedLine) {
            continue;
        }

        if (shouldInvalidateIdentityTranslation(sourceLines[i], targetLang)) {
            suspiciousUnchanged++;
        }
    }

    return suspiciousUnchanged >= 1 || suspiciousDebris >= 1;
}

function hasMeaningfulTranslationDifference(source: string, translated: string, targetLang: string): boolean {
    const sourceNorm = normalizeComparisonText(source);
    const translatedNorm = normalizeComparisonText(translated);

    if (!sourceNorm || !translatedNorm || sourceNorm === translatedNorm) {
        return false;
    }

    if (sourceHasNonLatinScript(source) && targetLangIsLatinScript(targetLang)) {
        return true;
    }

    const detected = detectLanguageHeuristic(source);
    return Boolean(detected && detected.confidence >= 0.6 && !isSameLanguage(detected.code, targetLang));
}

function shouldInvalidateSameLanguageTrackCache(
    sourceLang: string | undefined,
    targetLang: string,
    sourceLines: string[],
    cachedTranslatedLines: string[]
): boolean {
    if (!sourceLang || !isSameLanguage(sourceLang, targetLang)) {
        return false;
    }

    return !sourceLines.some((line, index) => hasMeaningfulTranslationDifference(line, cachedTranslatedLines[index] || '', targetLang));
}

async function rateLimitedDelay(): Promise<void> {
    const now = Date.now();
    const timeSinceLastCall = now - lastApiCallTime;
    if (timeSinceLastCall < RATE_LIMIT.minDelayMs) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT.minDelayMs - timeSinceLastCall));
    }
    lastApiCallTime = Date.now();
}

type ApiKeyConfig = {
    customApiKey?: string;
    customApiFormat?: CustomApiFormat;
    customApiModel?: string;
    libreTranslateApiUrl?: string;
    libreTranslateApiKey?: string;
    deeplApiKey?: string;
    openaiApiKey?: string;
    openaiModel?: string;
    geminiApiKey?: string;
    geminiModel?: string;
    geminiTemperature?: string | number;
};

type CosmosAsyncClient = {
    post?: (url: string, body?: unknown, headers?: Record<string, string>) => Promise<unknown>;
};

function getCosmosAsync(): CosmosAsyncClient | null {
    try {
        return (globalThis as any).Spicetify?.CosmosAsync || null;
    } catch {
        return null;
    }
}

function isLikelyCorsOrNetworkError(err: unknown): boolean {
    if (err instanceof TypeError) return true;
    const message = err instanceof Error ? err.message : String(err || '');
    return /failed to fetch|networkerror|cors|load failed/i.test(message);
}

class NonRetryableProviderError extends Error {
    constructor(message: string, readonly status?: number) {
        super(message);
        this.name = 'NonRetryableProviderError';
    }
}

function isNonRetryableProviderError(err: unknown): boolean {
    if (err instanceof NonRetryableProviderError) return true;
    const message = err instanceof Error ? err.message : String(err || '');
    const statusMatch = message.match(/\b(4\d\d)\b/);
    if (!statusMatch) return false;
    const status = Number(statusMatch[1]);
    return status !== 408 && status !== 429;
}

function createProviderHttpError(providerName: string, status: number, errorText: string): Error {
    const message = `${providerName} API error: ${status}${errorText ? ` ${sanitizeProviderErrorText(errorText).slice(0, 240)}` : ''}`;
    if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
        return new NonRetryableProviderError(message, status);
    }
    return new Error(message);
}

function createProviderConfigError(message: string): Error {
    return new NonRetryableProviderError(message);
}

function sanitizeProviderErrorText(text: string): string {
    return (text || '')
        .replace(/sk-[A-Za-z0-9_-]+/g, 'sk-...')
        .replace(/AIza[A-Za-z0-9_-]+/g, 'AIza...');
}

function getSpicetifyCorsProxyUrl(url: string): string {
    return `${SPICETIFY_CORS_PROXY_BASE}${url}`;
}

function normalizeProviderJsonPayload(data: unknown, providerName: string): any {
    if (typeof data !== 'string') {
        return data;
    }

    const trimmed = data.trim();
    if (!trimmed) {
        throw new NonRetryableProviderError(`${providerName} API returned an empty response`);
    }
    if (trimmed.startsWith('<')) {
        throw new NonRetryableProviderError(`${providerName} API returned HTML instead of JSON. Check the endpoint URL or API key.`);
    }

    try {
        return JSON.parse(trimmed);
    } catch {
        throw new NonRetryableProviderError(`${providerName} API returned invalid JSON: ${trimmed.slice(0, 160)}`);
    }
}

async function readProviderJsonResponse(response: Response, providerName: string): Promise<any> {
    const responseText = await response.text().catch(() => '');
    if (!response.ok) {
        throw createProviderHttpError(providerName, response.status, responseText);
    }
    return normalizeProviderJsonPayload(responseText, providerName);
}

async function postJsonProvider(
    url: string,
    body: unknown,
    headers: Record<string, string>,
    providerName: string,
    options: { preferCosmos?: boolean } = {}
): Promise<any> {
    const cosmos = getCosmosAsync();

    if (options.preferCosmos && cosmos?.post) {
        return normalizeProviderJsonPayload(await cosmos.post(url, body, headers), providerName);
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        return await readProviderJsonResponse(response, providerName);
    } catch (err) {
        if (cosmos?.post && isLikelyCorsOrNetworkError(err)) {
            return normalizeProviderJsonPayload(await cosmos.post(url, body, headers), providerName);
        }
        throw err;
    }
}

function buildLibreTranslateForm(text: string | string[], targetLang: string): URLSearchParams {
    const params = new URLSearchParams();
    const values = Array.isArray(text) ? text : [text];
    values.forEach(value => params.append('q', value));
    params.set('source', 'auto');
    params.set('target', targetLang);
    params.set('format', 'text');
    if (libreTranslateApiKey) {
        params.set('api_key', libreTranslateApiKey);
    }
    return params;
}

function formToJsonObject(params: URLSearchParams): Record<string, string | string[]> {
    const result: Record<string, string | string[]> = {};

    params.forEach((value, key) => {
        const existing = result[key];
        if (existing === undefined) {
            result[key] = value;
        } else if (Array.isArray(existing)) {
            existing.push(value);
        } else {
            result[key] = [existing, value];
        }
    });

    return result;
}

async function postFormProvider(
    url: string,
    params: URLSearchParams,
    providerName: string,
    options: { preferCosmos?: boolean } = {}
): Promise<any> {
    const cosmos = getCosmosAsync();

    if (options.preferCosmos && cosmos?.post) {
        return normalizeProviderJsonPayload(
            await cosmos.post(url, formToJsonObject(params), { 'Content-Type': 'application/json' }),
            providerName
        );
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: params
        });

        return await readProviderJsonResponse(response, providerName);
    } catch (err) {
        if (cosmos?.post && isLikelyCorsOrNetworkError(err)) {
            return normalizeProviderJsonPayload(
                await cosmos.post(url, formToJsonObject(params), { 'Content-Type': 'application/json' }),
                providerName
            );
        }
        throw err;
    }
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
            
            if (isNonRetryableProviderError(error)) {
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

export function setPreferredApi(api: ApiPreference, customUrl?: string, apiKeys?: ApiKeyConfig): void {
    preferredApi = api;
    if (customUrl !== undefined) {
        customApiUrl = customUrl;
    }
    if (apiKeys) {
        if (apiKeys.customApiKey !== undefined) customApiKey = apiKeys.customApiKey;
        if (apiKeys.customApiFormat !== undefined) customApiFormat = apiKeys.customApiFormat;
        if (apiKeys.customApiModel !== undefined) customApiModel = apiKeys.customApiModel;
        if (apiKeys.libreTranslateApiUrl !== undefined) libreTranslateApiUrl = normalizeLibreTranslateUrl(apiKeys.libreTranslateApiUrl);
        if (apiKeys.libreTranslateApiKey !== undefined) libreTranslateApiKey = apiKeys.libreTranslateApiKey;
        if (apiKeys.deeplApiKey !== undefined) deeplApiKey = apiKeys.deeplApiKey;
        if (apiKeys.openaiApiKey !== undefined) openaiApiKey = apiKeys.openaiApiKey;
        if (apiKeys.openaiModel !== undefined) openaiModel = normalizeOpenAIModelName(apiKeys.openaiModel);
        if (apiKeys.geminiApiKey !== undefined) geminiApiKey = apiKeys.geminiApiKey;
        if (apiKeys.geminiModel !== undefined) geminiModel = normalizeGeminiModelName(apiKeys.geminiModel);
        if (apiKeys.geminiTemperature !== undefined) geminiTemperature = normalizeGeminiTemperature(apiKeys.geminiTemperature);
    }
}

export function getPreferredApi(): { api: ApiPreference; customUrl: string } {
    return { api: preferredApi, customUrl: customApiUrl };
}

const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;

function pruneTranslationCache(cache: TranslationCache, now = Date.now()): boolean {
    let changed = false;

    Object.keys(cache).forEach(key => {
        const entry = cache[key];
        if (!entry || typeof entry.timestamp !== 'number' || now - entry.timestamp > CACHE_EXPIRY) {
            delete cache[key];
            changed = true;
        }
    });

    const keys = Object.keys(cache);
    if (keys.length > MAX_CACHE_ENTRIES) {
        keys
            .map(key => ({ key, timestamp: cache[key].timestamp }))
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(0, keys.length - MAX_CACHE_ENTRIES)
            .forEach(item => {
                delete cache[item.key];
                changed = true;
            });
    }

    return changed;
}

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
        if (typeof cached.timestamp === 'number' && Date.now() - cached.timestamp < CACHE_EXPIRY) {
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

            if (looksLikeMarkerDebris(normalized)) {
                delete cache[key];
                storage.setJSON('translation-cache', cache);
                return null;
            }

            if (normalized === text) {
                if (shouldInvalidateIdentityTranslation(text, targetLang)) {
                    delete cache[key];
                    storage.setJSON('translation-cache', cache);
                    return null;
                }
            }

            return normalized;
        }

        delete cache[key];
        pruneTranslationCache(cache);
        storage.setJSON('translation-cache', cache);
    }
    
    return null;
}

function cacheTranslation(text: string, targetLang: string, translation: string, api?: string): void {
    const cache = storage.getJSON<TranslationCache>('translation-cache', {});
    const key = `${targetLang}:${text}`;
    const normalizedTranslation = normalizeTranslatedLine(translation || '');
    if (normalizedTranslation === text && shouldInvalidateIdentityTranslation(text, targetLang)) {
        delete cache[key];
        storage.setJSON('translation-cache', cache);
        return;
    }
    
    cache[key] = {
        translation: normalizedTranslation,
        timestamp: Date.now(),
        api
    };

    pruneTranslationCache(cache);
    storage.setJSON('translation-cache', cache);
}

function normalizeSourceLangHint(raw?: string): string {
    if (!raw) return 'auto';
    const value = normalizeLanguageCode(raw);
    if (!value || value === 'unknown' || value === 'auto') return 'auto';
    return value || 'auto';
}

async function translateWithGoogle(text: string, targetLang: string, sourceLang?: string): Promise<{ translation: string; detectedLang: string }> {
    const encodedText = encodeURIComponent(text);
    const sl = normalizeSourceLangHint(sourceLang);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${targetLang}&dt=t&q=${encodedText}`;
    
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

function normalizeLibreTranslateUrl(url: string | undefined): string {
    const trimmed = (url || '').trim();
    return trimmed || DEFAULT_LIBRETRANSLATE_URL;
}

function getLibreTranslateUrl(): string {
    const url = normalizeLibreTranslateUrl(libreTranslateApiUrl);
    try {
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
            throw createProviderConfigError('LibreTranslate URL must use http or https.');
        }
        const normalizedPath = parsedUrl.pathname.replace(/\/+$/, '');
        if (!normalizedPath || normalizedPath === '') {
            parsedUrl.pathname = '/translate';
        } else if (!normalizedPath.endsWith('/translate')) {
            parsedUrl.pathname = `${normalizedPath}/translate`;
        }
        return parsedUrl.toString();
    } catch (error) {
        if (error instanceof NonRetryableProviderError) {
            throw error;
        }
        throw createProviderConfigError('Invalid LibreTranslate URL format. Set it in Settings.');
    }
}

function libreTranslateHostedRequiresKey(url: string): boolean {
    try {
        const host = new URL(url).hostname.toLowerCase();
        return host === 'libretranslate.com' || host.endsWith('.libretranslate.com');
    } catch {
        return false;
    }
}

function validateLibreTranslateConfig(): string {
    const url = getLibreTranslateUrl();
    if (libreTranslateHostedRequiresKey(url) && !libreTranslateApiKey) {
        throw createProviderConfigError('LibreTranslate API key required for hosted LibreTranslate. Set a key or use a self-hosted URL.');
    }
    return url;
}

async function translateWithLibreTranslate(text: string, targetLang: string): Promise<string> {
    const url = validateLibreTranslateConfig();

    const data = await postFormProvider(
        url,
        buildLibreTranslateForm(text, targetLang),
        'LibreTranslate',
        { preferCosmos: true }
    );
    if (typeof data?.translatedText === 'string') {
        return data.translatedText;
    }
    throw new Error('Invalid response from LibreTranslate API');
}

async function translateWithDeepL(text: string, targetLang: string): Promise<{ translation: string; detectedLang?: string }> {
    if (!deeplApiKey) {
        throw createProviderConfigError('DeepL API key not configured. Set it in Settings.');
    }
    
    const isFreePlan = deeplApiKey.endsWith(':fx');
    const baseUrl = isFreePlan ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
    const url = `${baseUrl}/v2/translate`;
    
    const data = await postJsonProvider(
        getSpicetifyCorsProxyUrl(url),
        buildDeepLBody([text], targetLang),
        getDeepLHeaders(deeplApiKey),
        'DeepL'
    );
    
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
        throw createProviderConfigError('OpenAI API key not configured. Set it in Settings.');
    }
    
    const langName = SUPPORTED_LANGUAGES.find(l => l.code === targetLang)?.name || targetLang;

    const data = await postJsonProvider(
        'https://api.openai.com/v1/chat/completions',
        buildOpenAIChatBody(text, langName),
        {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json'
        },
        'OpenAI',
        { preferCosmos: true }
    );
    
    if (data.choices && data.choices.length > 0) {
        const translation = data.choices[0].message?.content?.trim();
        if (translation) {
            return { translation };
        }
    }
    
    throw new Error('Invalid response from OpenAI API');
}

function normalizeOpenAIModelName(model: string | undefined): string {
    const trimmed = (model || '').trim();
    if (!trimmed) return DEFAULT_OPENAI_MODEL;
    if (trimmed === 'gpt-5.5' || trimmed === 'gpt-4o-mini') return trimmed;
    return DEFAULT_OPENAI_MODEL;
}

function isOpenAISpeedModeModel(model: string): boolean {
    return model === 'gpt-5.5';
}

function buildOpenAIChatBody(text: string, langName: string): Record<string, unknown> {
    const model = normalizeOpenAIModelName(openaiModel);
    const useSpeedMode = isOpenAISpeedModeModel(model);
    const instruction = `You are a song lyrics translator. Translate the given lyrics to ${langName}. Output ONLY the translated text, nothing else. Preserve line breaks. Keep the poetic feel and rhythm where possible.`;
    const body: Record<string, unknown> = {
        model,
        messages: [
            {
                role: useSpeedMode ? 'developer' : 'system',
                content: instruction
            },
            {
                role: 'user',
                content: text
            }
        ],
        max_completion_tokens: Math.max(text.length * 3, 500)
    };

    if (useSpeedMode) {
        body.reasoning_effort = 'none';
    } else {
        body.temperature = 0.3;
    }

    return body;
}

function normalizeGeminiModelName(model: string | undefined): string {
    const trimmed = (model || '').trim().replace(/^models\//, '');
    if (!trimmed) return DEFAULT_GEMINI_MODEL;
    if (trimmed === 'gemini-3.1-flash-lite' || trimmed === 'gemini-3.5-flash' || trimmed === 'gemini-3.1-pro-preview') {
        return trimmed;
    }
    if (trimmed.includes('flash-lite')) return 'gemini-3.1-flash-lite';
    if (trimmed.includes('pro')) return 'gemini-3.1-pro-preview';
    if (trimmed.includes('flash')) return 'gemini-3.5-flash';
    return DEFAULT_GEMINI_MODEL;
}

function normalizeGeminiTemperature(value: string | number | undefined): number {
    const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
    if (!Number.isFinite(parsed)) {
        return 0.3;
    }
    return Math.min(2, Math.max(0, parsed));
}

function getGeminiGenerateContentUrl(model: string | undefined): string {
    const normalizedModel = normalizeGeminiModelName(model);
    return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(normalizedModel)}:generateContent`;
}

async function translateWithGemini(text: string, targetLang: string): Promise<{ translation: string; detectedLang?: string }> {
    if (!geminiApiKey) {
        throw createProviderConfigError('Gemini API key not configured. Set it in Settings.');
    }

    const langName = SUPPORTED_LANGUAGES.find(l => l.code === targetLang)?.name || targetLang;

    const data = await postJsonProvider(
        getGeminiGenerateContentUrl(geminiModel),
        {
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
                temperature: geminiTemperature,
                maxOutputTokens: Math.max(text.length * 3, 2048),
                thinkingConfig: { thinkingBudget: 0 }
            }
        },
        {
            'Content-Type': 'application/json',
            'x-goog-api-key': geminiApiKey
        },
        'Gemini',
        { preferCosmos: true }
    );

    if (data.candidates && data.candidates.length > 0) {
        const translation = data.candidates[0]?.content?.parts?.[0]?.text?.trim();
        if (translation) {
            return { translation };
        }
    }

    throw new Error('Invalid response from Gemini API');
}

function validateCustomApiUrl(): string {
    if (!customApiUrl) {
        throw createProviderConfigError('Custom API URL not configured. Set it in Settings.');
    }

    try {
        const parsedUrl = new URL(customApiUrl);
        if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
            throw new Error('Custom API URL must use http or https protocol');
        }
    } catch (e) {
        if (e instanceof TypeError) {
            throw new Error('Invalid Custom API URL format');
        }
        throw e;
    }

    return customApiUrl.trim();
}

function getDeepLTargetLanguage(targetLang: string): string {
    const deeplLangMap: Record<string, string> = {
        'en': 'EN-US', 'pt': 'PT-BR', 'zh': 'ZH-HANS', 'zh-TW': 'ZH-HANT'
    };
    return deeplLangMap[targetLang] || targetLang.toUpperCase();
}

function buildDeepLBody(texts: string[], targetLang: string): { text: string[]; target_lang: string } {
    return {
        text: texts,
        target_lang: getDeepLTargetLanguage(targetLang)
    };
}

function getDeepLHeaders(apiKey: string): Record<string, string> {
    return {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json'
    };
}

function getTranslationLanguageName(targetLang: string): string {
    return SUPPORTED_LANGUAGES.find(l => l.code === targetLang)?.name || targetLang;
}

function getCustomApiHeaders(format: CustomApiFormat): Record<string, string> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };

    if (!customApiKey) {
        return headers;
    }

    if (format === 'gemini') {
        headers['x-goog-api-key'] = customApiKey;
    } else if (format === 'deepl') {
        headers['Authorization'] = `DeepL-Auth-Key ${customApiKey}`;
    } else {
        headers['Authorization'] = `Bearer ${customApiKey}`;
        headers['X-API-Key'] = customApiKey;
    }

    return headers;
}

function getOpenAiCompatibleUrl(url: string): string {
    const parsedUrl = new URL(url);
    const normalizedPath = parsedUrl.pathname.replace(/\/+$/, '');
    if (normalizedPath.endsWith('/v1')) {
        parsedUrl.pathname = `${normalizedPath}/chat/completions`;
        return parsedUrl.toString();
    }
    return url;
}

function buildCustomSingleBody(text: string, targetLang: string, format: CustomApiFormat): unknown {
    const langName = getTranslationLanguageName(targetLang);

    if (format === 'openai') {
        return {
            model: customApiModel || openaiModel || 'gpt-4o-mini',
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
        };
    }

    if (format === 'gemini') {
        return {
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
                temperature: geminiTemperature,
                maxOutputTokens: Math.max(text.length * 3, 500)
            }
        };
    }

    if (format === 'deepl') {
        return {
            text: [text],
            target_lang: getDeepLTargetLanguage(targetLang)
        };
    }

    return {
        text: text,
        q: text,
        source: 'auto',
        target: targetLang,
        target_lang: targetLang,
        format: 'text'
    };
}

function stringifyTranslation(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return null;
}

function extractTranslation(data: any): string | null {
    const candidates: unknown[] = [
        data?.translatedText,
        data?.translated_text,
        data?.translation,
        data?.result,
        data?.text,
        data?.data?.translatedText,
        data?.data?.translated_text,
        data?.data?.translation,
        data?.data?.result,
        data?.data?.text,
        data?.translations?.[0]?.text,
        data?.translations?.[0]?.translatedText,
        data?.translations?.[0]?.translated_text,
        data?.choices?.[0]?.message?.content,
        data?.choices?.[0]?.text,
        data?.output_text,
        data?.output?.[0]?.content?.[0]?.text,
        data?.content?.[0]?.text,
        data?.candidates?.[0]?.content?.parts?.[0]?.text,
        Array.isArray(data) ? data[0]?.translatedText : undefined,
        Array.isArray(data) ? data[0]?.translated_text : undefined,
        Array.isArray(data) ? data[0]?.translation : undefined,
        Array.isArray(data) ? data[0]?.text : undefined
    ];

    for (const candidate of candidates) {
        const translation = stringifyTranslation(candidate);
        if (translation) {
            return translation;
        }
    }

    return null;
}

async function translateWithCustomApi(text: string, targetLang: string): Promise<{ translation: string; detectedLang?: string }> {
    const format = customApiFormat || 'generic';
    const url = format === 'openai'
        ? getOpenAiCompatibleUrl(validateCustomApiUrl())
        : validateCustomApiUrl();

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: getCustomApiHeaders(format),
            body: JSON.stringify(buildCustomSingleBody(text, targetLang, format))
        });

        if (!response.ok) {
            const errorBody = await response.text().catch(() => '');
            throw new Error(`Custom API error: ${response.status}`);
        }

        const data = await response.json();
        const translation = extractTranslation(data);

        if (translation) {
            return {
                translation,
                detectedLang: extractDetectedLanguage(data)
            };
        }

        throw new Error(`Could not parse translation from API response: ${JSON.stringify(data).slice(0, 200)}`);
    } catch (error) {
        logError('Custom API error:', error);
        throw error;
    }
}

function extractDetectedLanguage(data: any): string | undefined {
    return data?.detectedLanguage ||
        data?.detected_language ||
        data?.sourceLang ||
        data?.src ||
        data?.detected_source_language ||
        data?.translations?.[0]?.detected_source_language?.toLowerCase();
}

function normalizeBatchTranslations(data: any): { translations: string[]; detectedLang?: string } | null {
    const candidates: unknown[] = [
        data?.translatedText,
        data?.translated_text,
        data?.translation,
        data?.result,
        data?.text,
        data?.data?.translatedText,
        data?.data?.translated_text,
        data?.data?.translations,
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

function customApiSupportsBatchArray(): boolean {
    return customApiFormat === 'generic' || customApiFormat === 'libretranslate' || customApiFormat === 'deepl';
}

function canUseBatchArrayProvider(): boolean {
    if (preferredApi === 'libretranslate') return true;
    if (preferredApi === 'deepl') return Boolean(deeplApiKey);
    if (preferredApi === 'custom') return Boolean(customApiUrl && customApiSupportsBatchArray());
    return false;
}

async function translateBatchArray(texts: string[], targetLang: string): Promise<{ translations: string[]; detectedLang?: string }> {
    if (texts.length === 0) {
        return { translations: [], detectedLang: undefined };
    }

    if (preferredApi === 'deepl' && !deeplApiKey) {
        throw createProviderConfigError('DeepL API key not configured. Set it in Settings.');
    }

    if (preferredApi === 'custom' && !customApiUrl) {
        throw createProviderConfigError('Custom API URL not configured. Set it in Settings.');
    }

    if ((preferredApi === 'deepl' && deeplApiKey) || (preferredApi === 'custom' && customApiFormat === 'deepl')) {
        const selectedDeepLKey = preferredApi === 'custom' ? customApiKey : deeplApiKey;
        const isFreePlan = selectedDeepLKey.endsWith(':fx');
        const baseUrl = isFreePlan ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
        const url = preferredApi === 'custom' ? validateCustomApiUrl() : `${baseUrl}/v2/translate`;
        const data = preferredApi === 'deepl'
            ? await postJsonProvider(
                getSpicetifyCorsProxyUrl(url),
                buildDeepLBody(texts, targetLang),
                getDeepLHeaders(selectedDeepLKey),
                'DeepL batch'
            )
            : await postJsonProvider(
                url,
                buildDeepLBody(texts, targetLang),
                getCustomApiHeaders('deepl'),
                'DeepL batch'
            );
        if (data.translations && Array.isArray(data.translations)) {
            return {
                translations: data.translations.map((t: any) => t.text || ''),
                detectedLang: data.translations[0]?.detected_source_language?.toLowerCase()
            };
        }
        throw new Error('DeepL batch returned unexpected format');
    }

    if (preferredApi === 'custom' && !customApiSupportsBatchArray()) {
        throw new Error('Custom API format does not support array batch payloads');
    }

    const url = preferredApi === 'libretranslate'
        ? validateLibreTranslateConfig()
        : validateCustomApiUrl();

    if (!url) {
        throw new Error('Custom API URL not configured');
    }

    const data = preferredApi === 'libretranslate'
        ? await postFormProvider(
            url,
            buildLibreTranslateForm(texts.join('\n'), targetLang),
            'LibreTranslate batch',
            { preferCosmos: true }
        )
        : await postJsonProvider(
            url,
            {
                q: texts,
                text: texts,
                source: 'auto',
                target: targetLang,
                target_lang: targetLang,
                format: 'text'
            },
            getCustomApiHeaders(customApiFormat || 'generic'),
            'Batch API'
        );
    const normalized = normalizeBatchTranslations(data);
    if (normalized) {
        return normalized;
    }

    const singleTranslation = extractTranslation(data);
    const parsed = singleTranslation ? parseBatchTextFallbacks(singleTranslation, texts.length) : null;
    if (!parsed) {
        throw new Error('Batch API returned non-array payload');
    }

    return {
        translations: parsed,
        detectedLang: extractDetectedLanguage(data)
    };
}

function buildMarkedBatchPayload(lines: string[]): { combinedText: string; markerNonce: string } {
    const markerNonce = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const combinedText = lines
        .map((line, index) => `${BATCH_MARKER_PREFIX}${markerNonce}_${index}]]${line}`)
        .join('\n');
    return { combinedText, markerNonce };
}

function hasInternalBatchMarkers(text: string): boolean {
    return (text || '').includes(BATCH_MARKER_PREFIX) || /\[\[\s*SLT[\s_-]*BATCH/i.test(text || '');
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
        .replace(/```[a-z0-9_-]*/gi, '')
        .replace(/\[\[\s*SLT[\s_-]*BATCH[^\]]*\]\]/gi, '')
        .replace(/\[\[\s*[A-Za-z0-9]+[_\s-]*BATCH[_\s-]*[A-Za-z0-9]*[_\s-]*\d+\s*\]\]/gi, '')
        .replace(/\[\[\s*[A-Za-z0-9_\s-]*\d+\s*\]\]/g, '')
        .replace(/\bSLT[\s_-]*BATCH[\s_-]*[A-Za-z0-9_-]*\b/gi, '')
        .replace(/^\s*[A-Za-z]{2,12}[_\s-]+\d+\s*\]?\]?\s*/g, '')
        .replace(/\r?\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function foldWrapperLineForComparison(text: string): string {
    return (text || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function isBatchWrapperLine(line: string): boolean {
    const folded = foldWrapperLineForComparison(line);
    if (!folded) return true;
    if (/^```/.test(folded)) return true;
    return /^(here('|')?s|here is|here are|sure[,!. ]|translation:?|translated lyrics:?|ban dich:?|duoi day|day la)/.test(folded);
}

function removeBatchWrapperLines(text: string): string {
    return (text || '')
        .split(/\r?\n/)
        .filter(line => !isBatchWrapperLine(line))
        .join('\n');
}

function parseBatchTextFallbacks(translatedText: string, expectedCount: number): string[] | null {
    const batchText = removeBatchWrapperLines(translatedText);

    const separatorSplit = batchText
        .split(BATCH_SEPARATOR_REGEX)
        .map(s => normalizeTranslatedLine(s));
    if (separatorSplit.length === expectedCount) {
        return separatorSplit;
    }

    const newlineSplit = batchText
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
    chunkSize: number = BATCH_CHUNK_SIZE,
    sourceLang?: string
): Promise<{ translations: string[]; detectedLang?: string }> {
    const translations: string[] = [];
    let detectedLang: string | undefined;

    for (let start = 0; start < lines.length; start += chunkSize) {
        const chunk = lines.slice(start, start + chunkSize);
        const { combinedText, markerNonce } = buildMarkedBatchPayload(chunk);
        const result = await retryWithBackoff(() => translateText(combinedText, targetLang, sourceLang));

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

async function translateSourceAlignedBatch(lines: string[], targetLang: string, sourceLang?: string): Promise<{ translations: string[]; detectedLang?: string }> {
    if (lines.length === 0) {
        return { translations: [] };
    }

    if (sourceLang && sourceLang !== 'auto' && isSameLanguage(sourceLang, targetLang)) {
        return { translations: [...lines], detectedLang: sourceLang };
    }

    if (lines.length === 1) {
        const result = await retryWithBackoff(() => translateText(lines[0], targetLang, sourceLang));
        return { translations: [result.translatedText], detectedLang: result.detectedLanguage };
    }

    if (canUseBatchArrayProvider()) {
        try {
            const batchResult = await retryWithBackoff(() => translateBatchArray(lines, targetLang));
            if (batchResult.translations.length === lines.length) {
                return batchResult;
            }
        } catch (batchArrayError) {
            if (isNonRetryableProviderError(batchArrayError)) {
                throw batchArrayError;
            }
            warn('Source-aligned batch-array translation unavailable, falling back to marker batching:', batchArrayError);
        }
    }

    try {
        const { combinedText, markerNonce } = buildMarkedBatchPayload(lines);
        const result = await retryWithBackoff(() => translateText(combinedText, targetLang, sourceLang));
        const parsed =
            parseMarkedBatchResponse(result.translatedText, lines.length, markerNonce) ||
            parseBatchTextFallbacks(result.translatedText, lines.length);

        if (parsed && parsed.length === lines.length) {
            return { translations: parsed, detectedLang: result.detectedLanguage };
        }
    } catch (markerBatchError) {
        warn('Source-aligned marker batch failed, falling back to chunked batch:', markerBatchError);
    }

    try {
        return await translateChunkedBatch(lines, targetLang, BATCH_CHUNK_SIZE, sourceLang);
    } catch (chunkedError) {
        warn('Source-aligned chunked batch failed, falling back to per-line translation:', chunkedError);
    }

    const translations: string[] = [];
    let detectedLang: string | undefined;
    for (const line of lines) {
        const result = await retryWithBackoff(() => translateText(line, targetLang, sourceLang));
        translations.push(result.translatedText);
        if (!detectedLang && result.detectedLanguage) {
            detectedLang = result.detectedLanguage;
        }
    }

    return { translations, detectedLang };
}

async function translateMixedSourceChunks(
    items: { index: number; text: string }[],
    targetLang: string,
    fallbackSourceLang?: string
): Promise<{ translations: string[]; detectedLang?: string }> {
    const translations = new Array<string>(items.length);
    const groups = new Map<string, { localIndex: number; text: string }[]>();
    let detectedLang: string | undefined;

    items.forEach((item, localIndex) => {
        const sourceLang = getLineSourceLangHint(item.text, targetLang, fallbackSourceLang, true) || 'auto';
        const normalizedSourceLang = normalizeSourceLangHint(sourceLang);

        if (normalizedSourceLang !== 'auto' && isSameLanguage(normalizedSourceLang, targetLang)) {
            translations[localIndex] = item.text;
            return;
        }

        const groupKey = normalizedSourceLang || 'auto';
        const group = groups.get(groupKey) || [];
        group.push({ localIndex, text: item.text });
        groups.set(groupKey, group);
    });

    for (const [sourceLang, group] of groups) {
        const hint = sourceLang === 'auto' ? undefined : sourceLang;
        const result = await translateSourceAlignedBatch(group.map(item => item.text), targetLang, hint);

        result.translations.forEach((translated, groupIndex) => {
            translations[group[groupIndex].localIndex] = translated;
        });

        if (!detectedLang && result.detectedLang) {
            detectedLang = result.detectedLang;
        }
    }

    return {
        translations: items.map((item, index) => translations[index] || item.text),
        detectedLang
    };
}

export async function translateText(text: string, targetLang: string, sourceLang?: string): Promise<TranslationResult> {
    const cached = getCachedTranslation(text, targetLang);
    if (cached) {
        return {
            originalText: text,
            translatedText: cached,
            targetLanguage: targetLang
        };
    }

    const tryGoogle = async () => {
        const result = await translateWithGoogle(text, targetLang, sourceLang);
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
        if (isNonRetryableProviderError(primaryError)) {
            throw primaryError;
        }
        if (hasInternalBatchMarkers(text)) {
            const message = primaryError instanceof Error ? primaryError.message : String(primaryError || 'Provider failed');
            throw new NonRetryableProviderError(message);
        }
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

function inferDominantSourceLangFromLines(lines: string[]): string | undefined {
    let zh = 0, ja = 0, ko = 0;
    for (const line of lines) {
        if (!line) continue;
        if (/[぀-ヿ]/.test(line)) { ja++; continue; }
        if (/[가-힯ᄀ-ᇿ]/.test(line)) { ko++; continue; }
        if (/[一-鿿㐀-䶿]/.test(line)) { zh++; continue; }
    }
    if (ja > 0 && ja >= zh && ja >= ko) return 'ja';
    if (ko > 0 && ko >= zh && ko >= ja) return 'ko';
    if (zh > 0) return 'zh';
    return undefined;
}

export async function translateLyrics(
    lines: string[],
    targetLang: string,
    trackUri?: string,
    detectedSourceLang?: string
): Promise<TranslationResult[]> {
    const currentTrackUri = trackUri || getCurrentTrackUri();
    const sourceFingerprint = computeSourceLyricsFingerprint(lines);
    const lineLanguages = getConfidentLineLanguages(lines);
    const hasMixedSourceLanguages = lineLanguages.size > 1;

    if (!detectedSourceLang || detectedSourceLang === 'auto' || detectedSourceLang === 'unknown') {
        const inferred = inferDominantSourceLangFromLines(lines);
        if (inferred) {
            detectedSourceLang = inferred;
        }
    }
    
    if (currentTrackUri) {
        const trackCache = getTrackCache(currentTrackUri, targetLang);
        if (trackCache && trackCache.lines.length === lines.length) {
            if (shouldInvalidateSameLanguageTrackCache(trackCache.lang, targetLang, lines, trackCache.lines)) {
                deleteTrackCache(currentTrackUri, targetLang);
            } else if (trackCache.sourceFingerprint && trackCache.sourceFingerprint === sourceFingerprint) {
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
        const someTranslated = finalResults.some(r => r.wasTranslated);
        
        if (currentTrackUri && someTranslated) {
            const translatedLines = finalResults.map(r => r.translatedText);
            setTrackCache(currentTrackUri, targetLang, detectedSourceLang || 'auto', translatedLines, preferredApi, sourceFingerprint, undefined, undefined, lines);
        }
        
        return finalResults;
    }
    
    let detectedLang = detectedSourceLang || 'auto';
    
    try {
        let translatedLines: string[] | null = null;

        if (!hasMixedSourceLanguages && canUseBatchArrayProvider() && uncachedLines.length > 1) {
            try {
                const batchResult = await retryWithBackoff(() => translateBatchArray(uncachedLines.map(l => l.text), targetLang));
                translatedLines = batchResult.translations;
                if (batchResult.detectedLang) {
                    detectedLang = batchResult.detectedLang;
                }
            } catch (batchArrayError) {
                if (isNonRetryableProviderError(batchArrayError)) {
                    throw batchArrayError;
                }
                warn('Batch-array translation unavailable, falling back to marker batching:', batchArrayError);
            }
        }

        if (!translatedLines && !hasMixedSourceLanguages) {
            const { combinedText, markerNonce } = buildMarkedBatchPayload(uncachedLines.map(l => l.text));
            const result = await retryWithBackoff(() => translateText(combinedText, targetLang, detectedSourceLang));
            translatedLines =
                parseMarkedBatchResponse(result.translatedText, uncachedLines.length, markerNonce) ||
                parseBatchTextFallbacks(result.translatedText, uncachedLines.length);

            if (result.detectedLanguage) {
                detectedLang = result.detectedLanguage;
            }
        }

        if (!hasMixedSourceLanguages && (!translatedLines || translatedLines.length !== uncachedLines.length) && uncachedLines.length > 1) {
            warn(`Primary batch parse failed for ${uncachedLines.length} lines, trying chunked batch mode (${BATCH_CHUNK_SIZE}/request)`);
            try {
                const chunked = await translateChunkedBatch(uncachedLines.map(l => l.text), targetLang, BATCH_CHUNK_SIZE, detectedSourceLang);
                translatedLines = chunked.translations;
                if (chunked.detectedLang) {
                    detectedLang = chunked.detectedLang;
                }
            } catch (chunkedError) {
                warn('Chunked batch failed, falling back to per-line translation:', chunkedError);
                translatedLines = null;
            }
        }

        if (hasMixedSourceLanguages && (!translatedLines || translatedLines.length !== uncachedLines.length)) {
            const mixedResult = await translateMixedSourceChunks(uncachedLines, targetLang, detectedSourceLang);
            translatedLines = mixedResult.translations;
            detectedLang = mixedResult.detectedLang || 'mixed';
        }

        if (!translatedLines || translatedLines.length !== uncachedLines.length) {
            warn(`Batch parsing unreliable for target ${targetLang}, translating line-by-line (${uncachedLines.length} lines)`);
            const perLineResults: string[] = [];
            for (const item of uncachedLines) {
                try {
                    const lineSourceLang = getLineSourceLangHint(item.text, targetLang, detectedSourceLang, hasMixedSourceLanguages);
                    const single = await retryWithBackoff(() => translateText(item.text, targetLang, lineSourceLang));
                    perLineResults.push(single.translatedText);
                    if (single.detectedLanguage && !hasMixedSourceLanguages && detectedLang === (detectedSourceLang || 'auto')) {
                        detectedLang = single.detectedLanguage;
                    }
                } catch (singleError) {
                    warn('Per-line translation failed for line:', item.index, singleError);
                    perLineResults.push(item.text);
                }
            }
            translatedLines = perLineResults;
        }

        if (!translatedLines || translatedLines.length !== uncachedLines.length) {
            throw new Error(`Translation mismatch: Sent ${uncachedLines.length} lines, got ${translatedLines?.length ?? 0}.`);
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
            let repairedTranslation = await repairMixedLineTranslation(item.text, initialTranslation, targetLang);
            let finalTranslation = normalizeTranslatedLine(repairedTranslation || '') || item.text;
            const sourceAndTargetMatch = isSameLanguage(detectedLang, targetLang);

            const sourceIsNonLatin = sourceHasNonLatinScript(item.text);
            const targetWantsLatin = targetLangIsLatinScript(targetLang);
            const suspiciousOutput =
                looksLikeMarkerDebris(finalTranslation) ||
                (sourceIsNonLatin && targetWantsLatin && finalTranslation === item.text);

            if (suspiciousOutput) {
                try {
                    const lineSourceLang = getLineSourceLangHint(item.text, targetLang, detectedSourceLang, hasMixedSourceLanguages);
                    const direct = await retryWithBackoff(() => translateText(item.text, targetLang, lineSourceLang));
                    const directNormalized = normalizeTranslatedLine(direct.translatedText || '');
                    if (directNormalized && !looksLikeMarkerDebris(directNormalized) && directNormalized !== item.text) {
                        finalTranslation = directNormalized;
                    } else if (directNormalized && !looksLikeMarkerDebris(directNormalized)) {
                        finalTranslation = directNormalized;
                    }
                } catch (directError) {
                    warn('Direct re-translation failed for suspicious line:', item.index, directError);
                }
            }

            if (sourceAndTargetMatch && !hasMeaningfulTranslationDifference(item.text, finalTranslation, targetLang)) {
                finalTranslation = item.text;
            }

            if (finalTranslation !== item.text) {
                cacheTranslation(item.text, targetLang, finalTranslation, preferredApi);
            }

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
        setTrackCache(currentTrackUri, targetLang, detectedLang, translatedLines, preferredApi, sourceFingerprint, undefined, undefined, lines);
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
    if (pruneTranslationCache(lineCache)) {
        storage.setJSON('translation-cache', lineCache);
    }
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
    if (pruneTranslationCache(cache)) {
        storage.setJSON('translation-cache', cache);
    }
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
