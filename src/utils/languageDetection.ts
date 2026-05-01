import { warn } from './debug';

const detectionCache: Map<string, { language: string; confidence: number; timestamp: number }> = new Map();
const DETECTION_CACHE_TTL = 30 * 60 * 1000;

const HAN_REGEX = /[\u4E00-\u9FFF\u3400-\u4DBF]/;
const KANA_REGEX = /[\u3040-\u30FF]/;
const HANGUL_REGEX = /[\uAC00-\uD7AF\u1100-\u11FF]/;

const LANGUAGE_PATTERNS: { code: string; scripts: RegExp }[] = [
    { code: 'zh', scripts: /[\u4E00-\u9FFF\u3400-\u4DBF]/ },
    { code: 'ja', scripts: /[\u3040-\u30FF]/ },
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
    { code: 'hi', words: ['hai', 'hain', 'hoon', 'tha', 'thi', 'nahi', 'nahin', 'kya', 'kaise', 'kaisa', 'kaisi', 'kahan', 'kyun', 'kab', 'mera', 'meri', 'tera', 'teri', 'tere', 'tumhara', 'hamara', 'apna', 'apni', 'apne', 'tujhe', 'mujhe', 'mujhko', 'tujhko', 'tumhe', 'hume', 'unhe', 'isko', 'usko', 'uski', 'iski', 'iske', 'uske', 'dil', 'pyar', 'ishq', 'mohabbat', 'zindagi', 'duniya', 'sapna', 'sapne', 'raat', 'din', 'aankh', 'aankhein', 'ankhiyo', 'nazar', 'waqt', 'gham', 'khushi', 'dard', 'rang', 'dhoop', 'chand', 'sitara', 'dekho', 'dekh', 'dekhna', 'suno', 'sun', 'sunna', 'bolo', 'bol', 'bolna', 'chalo', 'chal', 'chalna', 'jao', 'jana', 'aao', 'aaja', 'aana', 'karo', 'karna', 'milna', 'mila', 'milo', 'ruk', 'ruko', 'rukna', 'jeena', 'jee', 'nach', 'nachle', 'gaana', 'gana', 'bajao', 'baja', 'dikha', 'dikhao', 'dikhaa', 'parda', 'nakhre', 'mein', 'pe', 'par', 'wala', 'wali', 'wale', 'bhi', 'aur', 'lekin', 'magar', 'phir', 'abhi', 'kabhi', 'hamesha', 'humesha', 'sirf', 'bas', 'bahut', 'bohot', 'zyada', 'kuch', 'sab', 'koi', 'kaun', 'yahan', 'wahan', 'udhar', 'idhar', 'accha', 'acha', 'theek', 'bilkul', 'zaroor', 'sach', 'jhooth', 'alag', 'saath', 'mann', 'mehboob', 'dilbar', 'sanam', 'jannat', 'husn', 'jaane', 'jaana', 'toh', 'se', 'ke', 'ka', 'ki', 'ko', 'ne', 'tu', 'hum', 'tum', 'main', 'yeh', 'woh', 'ab', 'jab', 'tab', 'agar', 'mat', 'ya'] },
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

const NON_LATIN_SCRIPT_DETECTION_REGEX = /[぀-ヿ一-鿿가-힯؀-ۿ֐-׿Ѐ-ӿ฀-๿ऀ-ॿͰ-Ͽ]/;

const JA_ROMAJI_SPECIFIC_TOKENS = new Set([
    'desu', 'masu', 'mashita', 'deshita', 'darou', 'daro', 'desho', 'deshou',
    'kimi', 'boku', 'watashi', 'anata', 'kokoro', 'sayonara', 'sayounara',
    'arigatou', 'arigato', 'konnichiwa', 'ohayou', 'yoru', 'asa', 'tsuki',
    'sora', 'hoshi', 'namida', 'yume', 'koi', 'aishiteru', 'suki',
    'tsuzuku', 'tsuyoi', 'tsumetai', 'shiawase', 'chigau', 'chiisai',
    'hajimete', 'mou', 'demo', 'sou', 'nai', 'naku',
    'wa', 'wo', 'no', 'ni', 'ga', 'to', 'de', 'mo', 'ya', 'ka', 'ne', 'yo',
    'da', 'datta', 'janai', 'iru', 'aru', 'naru', 'suru', 'shita', 'shite',
    'iku', 'itta', 'kuru', 'kita', 'omou', 'omotta',
]);

const ROMAJI_SYLLABLE_REGEX = /^(?:[kgsztdnhbpmrw]?y?[aeiou]{1,2}|tsu|shi|chi|n)+n?$/i;

function countRomajiTokens(words: string[]): { romaji: number; specific: number } {
    let romaji = 0;
    let specific = 0;
    for (const word of words) {
        if (JA_ROMAJI_SPECIFIC_TOKENS.has(word)) {
            specific++;
            romaji++;
            continue;
        }
        if (word.length >= 2 && ROMAJI_SYLLABLE_REGEX.test(word)) {
            romaji++;
        }
    }
    return { romaji, specific };
}

export function detectRomanizedJapanese(text: string): { confidence: number; ratio: number; specificHits: number } | null {
    if (!text) return null;
    if (NON_LATIN_SCRIPT_DETECTION_REGEX.test(text)) return null;
    const words = tokenizeWords(text);
    if (words.length < 4) return null;
    const { romaji, specific } = countRomajiTokens(words);
    const ratio = romaji / words.length;
    if (specific < 1) return null;
    if (ratio < 0.4) return null;
    return {
        confidence: Math.min(0.9, 0.5 + ratio * 0.4 + Math.min(specific, 4) * 0.05),
        ratio,
        specificHits: specific,
    };
}

export function scanCorpusForCjk(
    lines: string[]
): { code: 'ja' | 'zh' | 'ko'; confidence: number; kana: number; kanji: number; hangul: number } | null {
    let kana = 0;
    let kanji = 0;
    let hangul = 0;
    for (const line of lines) {
        if (!line) continue;
        const k = line.match(/[\u3040-\u30FF]/g);
        if (k) kana += k.length;
        const h = line.match(/[\u4E00-\u9FFF\u3400-\u4DBF]/g);
        if (h) kanji += h.length;
        const ha = line.match(/[\uAC00-\uD7AF\u1100-\u11FF]/g);
        if (ha) hangul += ha.length;
    }
    if (kana >= 4 || (kana >= 1 && kanji >= 6)) {
        return { code: 'ja', confidence: 0.92, kana, kanji, hangul };
    }
    if (hangul >= 4) {
        return { code: 'ko', confidence: 0.92, kana, kanji, hangul };
    }
    if (kanji >= 8 && kana === 0) {
        return { code: 'zh', confidence: 0.9, kana, kanji, hangul };
    }
    return null;
}

export function detectLanguageHeuristic(text: string): { code: string; confidence: number } | null {
    if (!text) return null;

    const hasNonLatinScript = NON_LATIN_SCRIPT_DETECTION_REGEX.test(text);
    const minLength = hasNonLatinScript ? 1 : 10;
    if (text.length < minLength) {
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

    const hanCount = (normalizedText.match(/[\u4E00-\u9FFF\u3400-\u4DBF]/g) || []).length;
    const kanaCount = (normalizedText.match(/[\u3040-\u30FF]/g) || []).length;
    const hangulCount = (normalizedText.match(/[\uAC00-\uD7AF\u1100-\u11FF]/g) || []).length;

    if (kanaCount > 0 && (hanCount + kanaCount) / totalChars > 0.2) {
        return { code: 'ja', confidence: Math.min(0.95, 0.7 + (hanCount + kanaCount) / totalChars * 0.25) };
    }

    if (hangulCount > 0 && hangulCount / totalChars > 0.2) {
        return { code: 'ko', confidence: Math.min(0.95, 0.65 + hangulCount / totalChars * 0.3) };
    }

    if (hanCount > 0 && hanCount / totalChars > 0.2) {
        return { code: 'zh', confidence: Math.min(0.95, 0.65 + hanCount / totalChars * 0.3) };
    }

    const dominantScript = Object.entries(scriptCounts)
        .filter(([code]) => code !== 'zh' && code !== 'ja' && code !== 'ko')
        .map(([code, count]) => ({ code, count, ratio: count / totalChars }))
        .sort((a, b) => b.count - a.count)[0];

    if (dominantScript && dominantScript.ratio > 0.2) {
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
            return { code: cached.language, confidence: cached.confidence };
        }
    }

    const corpusScan = scanCorpusForCjk(lyrics);
    if (corpusScan) {
        if (trackUri) {
            detectionCache.set(trackUri, {
                language: corpusScan.code,
                confidence: corpusScan.confidence,
                timestamp: Date.now()
            });
        }
        return { code: corpusScan.code, confidence: corpusScan.confidence };
    }

    const sampleText = buildSampleText(lyrics);

    if (sampleText.length < 20) {
        return { code: 'unknown', confidence: 0 };
    }

    const heuristic = detectLanguageHeuristic(sampleText);

    if (heuristic && heuristic.code === 'en') {
        const romaji = detectRomanizedJapanese(sampleText);
        if (romaji) {
            const result = { code: 'ja', confidence: romaji.confidence };
            if (trackUri) {
                detectionCache.set(trackUri, {
                    language: result.code,
                    confidence: result.confidence,
                    timestamp: Date.now()
                });
            }
            return result;
        }
    }

    if (heuristic && heuristic.confidence >= 0.7) {
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
    const targetIsLatin = !['ja', 'zh', 'ko', 'ar', 'he', 'ru', 'th', 'el'].includes(targetBase);
    
    for (const line of lines) {
        const trimmed = (line || '').trim();
        if (!trimmed || /^[•♪♫\s\-–—]+$/.test(trimmed)) continue;

        const hasNonLatin = NON_LATIN_SCRIPT_DETECTION_REGEX.test(trimmed);

        if (!hasNonLatin && trimmed.length < 3) continue;

        if (targetIsLatin && hasNonLatin) {
            nonTargetCount++;
            continue;
        }

        if (targetIsLatin && !hasNonLatin && targetBase !== 'ja') {
            const romaji = detectRomanizedJapanese(trimmed);
            if (romaji && !isSameLanguage('ja', targetLanguage)) {
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
        } else if (detected.confidence >= 0.6) {
            nonTargetCount++;
        } else {
            uncertainCount++;
        }
    }

    const totalChecked = targetCount + nonTargetCount + uncertainCount;
    if (totalChecked === 0) return { hasMixedContent: false, nonTargetCount: 0, uncertainCount: 0 };

    const hasMixedContent = nonTargetCount >= 1 ||
        (uncertainCount > 0 && uncertainCount / totalChecked > 0.3);

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

    const corpusScan = scanCorpusForCjk(nonEmptyLyrics);
    if (corpusScan) {
        if (isSameLanguage(corpusScan.code, targetLanguage)) {
            const mixedCheck = assessMixedLanguageContent(nonEmptyLyrics, targetLanguage);
            if (mixedCheck.hasMixedContent) {
                return { skip: false, detectedLanguage: corpusScan.code };
            }
            return {
                skip: true,
                reason: `Lyrics already in ${corpusScan.code.toUpperCase()}`,
                detectedLanguage: corpusScan.code
            };
        }
        return { skip: false, detectedLanguage: corpusScan.code };
    }

    const sampleText = buildSampleText(nonEmptyLyrics);
    let quickHeuristic = detectLanguageHeuristic(sampleText);

    if (quickHeuristic && quickHeuristic.code === 'en') {
        const romaji = detectRomanizedJapanese(sampleText);
        if (romaji) {
            quickHeuristic = { code: 'ja', confidence: romaji.confidence };
        }
    }

    if (quickHeuristic && quickHeuristic.confidence >= 0.8) {
        if (isSameLanguage(quickHeuristic.code, targetLanguage)) {
            const mixedCheck = assessMixedLanguageContent(nonEmptyLyrics, targetLanguage);
            if (mixedCheck.hasMixedContent) {
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
    detectRomanizedJapanese,
    scanCorpusForCjk,
    isSameLanguage,
    assessMixedLanguageContent,
    shouldSkipTranslation,
    clearDetectionCache,
    getLanguageName
};
