import { debug, warn } from './debug';

const detectionCache: Map<string, { language: string; confidence: number; timestamp: number }> = new Map();
const DETECTION_CACHE_TTL = 30 * 60 * 1000;

const LANGUAGE_PATTERNS: { code: string; scripts: RegExp }[] = [
    { code: 'ja', scripts: /[\u3040-\u30FF\u4E00-\u9FAF]/ },
    { code: 'zh', scripts: /[\u4E00-\u9FFF]/ },
    { code: 'ko', scripts: /[\uAC00-\uD7AF\u1100-\u11FF]/ },
    { code: 'ar', scripts: /[\u0600-\u06FF]/ },
    { code: 'he', scripts: /[\u0590-\u05FF]/ },
    { code: 'ru', scripts: /[\u0400-\u04FF]/ },
    { code: 'th', scripts: /[\u0E00-\u0E7F]/ },
    { code: 'hi', scripts: /[\u0900-\u097F]/ },
    { code: 'el', scripts: /[\u0370-\u03FF]/ },
];

const LATIN_LANGUAGE_WORDS: { code: string; words: string[] }[] = [
    { code: 'es', words: ['el', 'la', 'los', 'las', 'que', 'de', 'en', 'un', 'una', 'es', 'no', 'por', 'con', 'para', 'como', 'pero', 'más', 'yo', 'tu', 'mi', 'muy', 'hay', 'donde', 'cuando', 'siempre', 'nunca', 'todo', 'nada', 'sin', 'sobre', 'soy', 'estoy', 'tengo', 'aquí', 'porque', 'te', 'se', 'le', 'nos', 'ya', 'del', 'al'] },
    { code: 'fr', words: ['le', 'la', 'les', 'de', 'et', 'en', 'un', 'une', 'est', 'que', 'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ne', 'pas', 'pour', 'avec', 'mais', 'aussi', 'très', 'mon', 'ton', 'son', 'mes', 'ses', 'sur', 'dans', 'qui', 'au', 'du', 'des', 'ce', 'cette', 'ça'] },
    { code: 'de', words: ['der', 'die', 'das', 'und', 'ist', 'ich', 'du', 'er', 'sie', 'wir', 'ihr', 'nicht', 'ein', 'eine', 'mit', 'auf', 'für', 'von', 'auch', 'noch', 'nur', 'sehr', 'wie', 'doch', 'dann', 'nein', 'ja', 'wenn', 'mein', 'dein', 'sein', 'kein'] },
    { code: 'pt', words: ['o', 'a', 'os', 'as', 'de', 'que', 'e', 'em', 'um', 'uma', 'é', 'não', 'eu', 'tu', 'ele', 'ela', 'nós', 'você', 'com', 'para', 'meu', 'seu', 'muito', 'bem', 'sim', 'aqui', 'agora', 'onde', 'quando', 'sempre', 'também', 'porque', 'mais', 'nunca', 'tudo', 'nada', 'sem'] },
    { code: 'it', words: ['il', 'la', 'lo', 'gli', 'le', 'di', 'che', 'e', 'un', 'una', 'è', 'non', 'io', 'tu', 'lui', 'lei', 'noi', 'voi', 'con', 'per', 'anche', 'ancora', 'molto', 'bene', 'quando', 'dove', 'sempre', 'mai', 'tutto', 'mio', 'mia', 'tuo', 'suo'] },
    { code: 'nl', words: ['de', 'het', 'een', 'en', 'van', 'is', 'dat', 'op', 'te', 'in', 'voor', 'niet', 'met', 'zijn', 'maar', 'ook', 'als', 'dit'] },
    { code: 'pl', words: ['i', 'w', 'na', 'nie', 'do', 'to', 'że', 'co', 'jest', 'się', 'ja', 'ty', 'on', 'my', 'wy', 'ale', 'jak', 'tak'] },
    { code: 'en', words: ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'my', 'your', 'his', 'her', 'our', 'their', 'do', 'did', 'not', 'no', 'have', 'has', 'had', 'be', 'been', 'will', 'would', 'can', 'could', 'just', 'like', 'so', 'this', 'that', 'what', 'when', 'how', 'all', 'if', 'there', 'them', 'from', 'about', 'up', 'out', 'know', 'only', 'into', 'than', 'then', 'its', 'who', 'which', 'more', 'some', 'these', 'those', 'here'] },
];

const LATIN_LANGUAGE_WORD_SETS: { code: string; words: Set<string> }[] = LATIN_LANGUAGE_WORDS.map(lang => ({
    code: lang.code,
    words: new Set(lang.words)
}));

function getSampleIndices(length: number): number[] {
    if (length <= 0) return [];

    const indices = new Set<number>();

    for (let i = 0; i < Math.min(5, length); i++) {
        indices.add(i);
    }

    const middle = Math.floor(length / 2);
    for (let i = middle - 2; i <= middle + 2; i++) {
        if (i >= 0 && i < length) {
            indices.add(i);
        }
    }

    for (let i = Math.max(0, length - 5); i < length; i++) {
        indices.add(i);
    }

    return [...indices].sort((a, b) => a - b);
}

function buildSampleText(lines: string[]): string {
    const indices = getSampleIndices(lines.length);
    return indices
        .map(i => lines[i])
        .filter(line => line && line.trim().length > 0 && !/^[•♪♫\s\-–—]+$/.test(line.trim()))
        .join(' ');
}

function tokenizeWords(text: string): string[] {
    const matches = text.toLowerCase().match(/[\p{L}']+/gu);
    if (!matches) return [];
    return matches.filter(word => word.length > 1);
}

export function detectLanguageHeuristic(text: string): { code: string; confidence: number } | null {
    if (!text || text.length < 10) {
        return null;
    }
    
    const normalizedText = text.trim();
    
    let totalChars = 0;
    const scriptCounts: { [code: string]: number } = {};
    
    for (const char of normalizedText) {
        if (/\s/.test(char)) continue;
        totalChars++;
        
        for (const lang of LANGUAGE_PATTERNS) {
            if (lang.scripts.test(char)) {
                scriptCounts[lang.code] = (scriptCounts[lang.code] || 0) + 1;
            }
        }
    }
    
    if (totalChars === 0) return null;
    
    const dominantScript = Object.entries(scriptCounts)
        .map(([code, count]) => ({ code, count, ratio: count / totalChars }))
        .sort((a, b) => b.count - a.count)[0];

    if (dominantScript && dominantScript.ratio > 0.2) {
        if (dominantScript.code === 'zh') {
            const japaneseKana = (normalizedText.match(/[\u3040-\u30FF]/g) || []).length;
            if (japaneseKana > 0) {
                return { code: 'ja', confidence: 0.9 };
            }
        }

        return {
            code: dominantScript.code,
            confidence: Math.min(0.95, 0.6 + dominantScript.ratio * 0.3)
        };
    }
    
    const words = tokenizeWords(normalizedText);
    if (words.length < 3) {
        return null;
    }
    
    const wordCounts: { [code: string]: number } = {};
    let maxCount = 0;
    let maxLang = 'en';
    
    for (const lang of LATIN_LANGUAGE_WORD_SETS) {
        let count = 0;
        for (const word of words) {
            if (lang.words.has(word)) {
                count++;
            }
        }
        wordCounts[lang.code] = count;
        
        if (count > maxCount) {
            maxCount = count;
            maxLang = lang.code;
        }
    }
    
    const matchRatio = maxCount / words.length;
    
    const minMatchCount = words.length <= 6 ? 2 : 3;
    if (matchRatio > 0.12 && maxCount >= minMatchCount) {
        const sortedCounts = Object.entries(wordCounts)
            .sort((a, b) => b[1] - a[1]);
        
        if (sortedCounts.length < 2 || sortedCounts[1][1] === 0) {
            return { code: maxLang, confidence: Math.min(0.75, 0.35 + matchRatio) };
        }
        
        const disambiguationRatio = words.length <= 6 ? 1.3 : 1.5;
        if (sortedCounts[0][1] >= sortedCounts[1][1] * disambiguationRatio) {
            return { code: maxLang, confidence: Math.min(0.8, 0.4 + matchRatio) };
        }
    }
    
    return null;
}

async function detectLanguageViaAPI(text: string): Promise<{ code: string; confidence: number }> {
    const sample = text.slice(0, 500);
    const params = new URLSearchParams({
        client: 'gtx',
        sl: 'auto',
        tl: 'en',
        dt: 't',
        q: sample
    });

    const url = `https://translate.googleapis.com/translate_a/single?${params.toString()}`;
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Language detection API error: ${response.status}`);
    }
    
    const data = await response.json();
    const detectedLang = typeof data?.[2] === 'string' ? data[2] : 'unknown';
    const confidence = detectedLang !== 'unknown' ? 0.9 : 0.5;
    
    return { code: detectedLang, confidence };
}

export async function detectLyricsLanguage(
    lyrics: string[],
    trackUri?: string
): Promise<{ code: string; confidence: number }> {
    if (trackUri) {
        const cached = detectionCache.get(trackUri);
        if (cached && Date.now() - cached.timestamp < DETECTION_CACHE_TTL) {
            debug(`Language detection cache hit: ${cached.language}`);
            return { code: cached.language, confidence: cached.confidence };
        }
    }

    const sampleText = buildSampleText(lyrics);

    if (sampleText.length < 20) {
        return { code: 'unknown', confidence: 0 };
    }

    const heuristic = detectLanguageHeuristic(sampleText);
    if (heuristic && heuristic.confidence >= 0.7) {
        debug(`Heuristic language detection: ${heuristic.code} (${(heuristic.confidence * 100).toFixed(0)}%)`);

        if (trackUri) {
            detectionCache.set(trackUri, { 
                language: heuristic.code, 
                confidence: heuristic.confidence,
                timestamp: Date.now() 
            });
        }
        
        return heuristic;
    }

    try {
        const apiResult = await detectLanguageViaAPI(sampleText);
        debug(`API language detection: ${apiResult.code} (${(apiResult.confidence * 100).toFixed(0)}%)`);

        if (trackUri) {
            detectionCache.set(trackUri, { 
                language: apiResult.code, 
                confidence: apiResult.confidence,
                timestamp: Date.now() 
            });
        }
        
        return apiResult;
    } catch (error) {
        warn('API language detection failed:', error);
        return heuristic || { code: 'unknown', confidence: 0 };
    }
}

export function isSameLanguage(source: string, target: string): boolean {
    if (!source || source === 'unknown') return false;
    
    const normalizeCode = (code: string): string => {
        return code.toLowerCase().split('-')[0].split('_')[0];
    };
    
    return normalizeCode(source) === normalizeCode(target);
}

export function assessMixedLanguageContent(
    lines: string[],
    targetLanguage: string
): { hasMixedContent: boolean; nonTargetCount: number; uncertainCount: number } {
    let nonTargetCount = 0;
    let uncertainCount = 0;
    let targetCount = 0;
    const targetBase = targetLanguage.toLowerCase().split('-')[0].split('_')[0];
    const targetIsLatin = !['ja', 'zh', 'ko', 'ar', 'he', 'ru', 'th', 'hi', 'el'].includes(targetBase);
    
    for (const line of lines) {
        const trimmed = (line || '').trim();
        if (trimmed.length < 3 || /^[•♪♫\s\-–—]+$/.test(trimmed)) continue;

        if (targetIsLatin) {
            const hasNonLatin = /[\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF\u0600-\u06FF\u0590-\u05FF\u0400-\u04FF\u0E00-\u0E7F\u0900-\u097F\u0370-\u03FF]/.test(trimmed);
            if (hasNonLatin) {
                nonTargetCount++;
                continue;
            }
        }
        
        const detected = detectLanguageHeuristic(trimmed);

        if (!detected) {
            if (trimmed.length >= 10) {
                uncertainCount++;
            }
            continue;
        }
        
        if (isSameLanguage(detected.code, targetLanguage)) {
            targetCount++;
        } else if (detected.confidence >= 0.65) {
            nonTargetCount++;
        } else {
            uncertainCount++;
        }
    }
    
    const totalChecked = targetCount + nonTargetCount + uncertainCount;
    if (totalChecked === 0) return { hasMixedContent: false, nonTargetCount: 0, uncertainCount: 0 };

    const hasMixedContent = nonTargetCount >= 2 ||
        (nonTargetCount > 0 && uncertainCount > 0 && (nonTargetCount + uncertainCount) / totalChecked > 0.3);
    
    return { hasMixedContent, nonTargetCount, uncertainCount };
}

export async function shouldSkipTranslation(
    lyrics: string[],
    targetLanguage: string,
    trackUri?: string
): Promise<{ skip: boolean; reason?: string; detectedLanguage?: string }> {
    const nonEmptyLyrics = lyrics.filter(l => l && l.trim().length > 0 && !/^[•♪♫\s\-–—]+$/.test(l.trim()));
    if (nonEmptyLyrics.length === 0) {
        return { skip: false };
    }
    
    const sampleText = buildSampleText(nonEmptyLyrics);
    const quickHeuristic = detectLanguageHeuristic(sampleText);
    
    if (quickHeuristic && quickHeuristic.confidence >= 0.8) {
        if (isSameLanguage(quickHeuristic.code, targetLanguage)) {
            const mixedCheck = assessMixedLanguageContent(nonEmptyLyrics, targetLanguage);
            if (mixedCheck.hasMixedContent) {
                debug(`Mixed content detected (${mixedCheck.nonTargetCount} non-target, ${mixedCheck.uncertainCount} uncertain) — will not skip`);
                return { skip: false, detectedLanguage: quickHeuristic.code };
            }
            return {
                skip: true,
                reason: `Lyrics already in ${quickHeuristic.code.toUpperCase()}`,
                detectedLanguage: quickHeuristic.code
            };
        }
        return { skip: false, detectedLanguage: quickHeuristic.code };
    }
    
    const detection = await detectLyricsLanguage(lyrics, trackUri);
    
    if (detection.code === 'unknown' || detection.confidence < 0.6) {
        return { skip: false };
    }
    
    if (isSameLanguage(detection.code, targetLanguage)) {
        const mixedCheck = assessMixedLanguageContent(nonEmptyLyrics, targetLanguage);
        if (mixedCheck.hasMixedContent) {
            debug(`Mixed content detected via API path (${mixedCheck.nonTargetCount} non-target, ${mixedCheck.uncertainCount} uncertain) — will not skip`);
            return { skip: false, detectedLanguage: detection.code };
        }
        return {
            skip: true,
            reason: `Lyrics already in ${detection.code.toUpperCase()}`,
            detectedLanguage: detection.code
        };
    }
    
    return { 
        skip: false, 
        detectedLanguage: detection.code 
    };
}

export function clearDetectionCache(): void {
    detectionCache.clear();
}

export function getLanguageName(code: string): string {
    const languageNames: { [key: string]: string } = {
        'en': 'English',
        'es': 'Spanish',
        'fr': 'French',
        'de': 'German',
        'it': 'Italian',
        'pt': 'Portuguese',
        'nl': 'Dutch',
        'pl': 'Polish',
        'ru': 'Russian',
        'ja': 'Japanese',
        'zh': 'Chinese',
        'ko': 'Korean',
        'ar': 'Arabic',
        'he': 'Hebrew',
        'hi': 'Hindi',
        'th': 'Thai',
        'el': 'Greek',
        'tr': 'Turkish',
        'vi': 'Vietnamese',
        'id': 'Indonesian',
        'ms': 'Malay',
        'tl': 'Tagalog',
        'sv': 'Swedish',
        'no': 'Norwegian',
        'da': 'Danish',
        'fi': 'Finnish',
        'uk': 'Ukrainian',
        'cs': 'Czech',
        'ro': 'Romanian',
        'hu': 'Hungarian',
        'unknown': 'Unknown'
    };
    
    const baseCode = code.toLowerCase().split('-')[0];
    return languageNames[baseCode] || code.toUpperCase();
}

export default {
    detectLanguageHeuristic,
    detectLyricsLanguage,
    isSameLanguage,
    assessMixedLanguageContent,
    shouldSkipTranslation,
    clearDetectionCache,
    getLanguageName
};
