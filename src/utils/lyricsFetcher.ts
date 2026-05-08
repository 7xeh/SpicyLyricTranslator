import { warn } from './debug';
import { normalizeLanguageCode } from './languageDetection';

const SPICY_API_HOST = 'api.spicylyrics.org';
const SPICY_QUERY_PATH = '/query';

interface SyllableData {
    Text: string;
    StartTime: number;
    EndTime: number;
    IsPartOfWord: boolean;
    RomanizedText?: string;
}


interface VocalGroup {
    Type: 'Vocal' | 'Instrumental';
    OppositeAligned?: boolean;
    Text?: string;
    StartTime?: number;
    EndTime?: number;
    Lead?: {
        Syllables: SyllableData[];
        StartTime: number;
        EndTime: number;
    };
    Background?: Array<{
        Syllables: SyllableData[];
        StartTime: number;
        EndTime: number;
    }>;
}

interface StaticLine {
    Text: string;
}

interface LyricsData {
    Type: 'Static' | 'Line' | 'Syllable';
    Content?: VocalGroup[];
    Lines?: StaticLine[];
    Language?: string;
    LanguageISO2?: string;
    id?: string;
    alternative_api?: boolean;
}

export interface WordTimingData {
    text: string;
    startTime: number;
    endTime: number;
    isPartOfWord: boolean;
}

export interface LyricLineData {
    text: string;
    startTime: number;
    endTime: number;
    isInstrumental: boolean;
    romanizedText?: string;

    words?: WordTimingData[];
}

interface QueryResult {
    data: any;
    httpStatus: number;
    format: 'text' | 'json';
}

interface QueryResponse {
    queries: Array<{
        operationId: string;
        result: QueryResult;
    }>;
}

const captureCache = new Map<string, LyricsData>();
let interceptorInstalled = false;

function isLyricsData(obj: any): obj is LyricsData {
    if (!obj || typeof obj !== 'object') return false;
    if (typeof obj.Type === 'string' && (obj.Type === 'Static' || obj.Type === 'Line' || obj.Type === 'Syllable')) {
        return true;
    }
    if (Array.isArray(obj.Content) || Array.isArray(obj.Lines)) return true;
    return false;
}

function extractTrackIdFromBody(bodyText: string | null | undefined): string | null {
    if (!bodyText) return null;
    try {
        const parsed = JSON.parse(bodyText);
        const queries = parsed?.queries;
        if (!Array.isArray(queries)) return null;
        for (const q of queries) {
            const id = q?.variables?.id;
            if (typeof id === 'string' && id.length > 0) return id;
        }
    } catch {}
    return null;
}

function processCapturedResponse(trackId: string, payload: QueryResponse): void {
    const queries = Array.isArray(payload?.queries) ? payload.queries : [];
    for (const q of queries) {
        const result = q?.result;
        if (!result || result.httpStatus !== 200) continue;

        let lyricsData: LyricsData | null = null;
        if (result.format === 'json' && isLyricsData(result.data)) {
            lyricsData = result.data as LyricsData;
        } else if (result.format === 'text' && typeof result.data === 'string') {
            try {
                const parsed = JSON.parse(result.data);
                if (isLyricsData(parsed)) lyricsData = parsed;
            } catch {}
        }

        if (lyricsData) {
            captureCache.set(trackId, lyricsData);
            return;
        }
    }
}

function installFetchInterceptor(): void {
    if (interceptorInstalled) return;
    if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
    interceptorInstalled = true;

    const origFetch = window.fetch.bind(window);

    window.fetch = async function patchedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        let url: string;
        try {
            if (typeof input === 'string') url = input;
            else if (input instanceof URL) url = input.href;
            else url = (input as Request).url;
        } catch {
            return origFetch(input as any, init);
        }

        if (!url.includes(SPICY_API_HOST) || !url.includes(SPICY_QUERY_PATH)) {
            return origFetch(input as any, init);
        }

        let trackId: string | null = null;
        try {
            if (typeof init?.body === 'string') {
                trackId = extractTrackIdFromBody(init.body);
            } else if (input instanceof Request) {
                const cloned = input.clone();
                const bodyText = await cloned.text();
                trackId = extractTrackIdFromBody(bodyText);
            }
        } catch {}

        const response = await origFetch(input as any, init);

        if (trackId) {
            const capturedTrackId = trackId;
            response.clone().json().then((data: QueryResponse) => {
                processCapturedResponse(capturedTrackId, data);
            }).catch(() => {});
        }

        return response;
    };
}

installFetchInterceptor();

async function waitForCapture(trackId: string, timeoutMs: number = 8000, pollMs: number = 100): Promise<LyricsData | null> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const cached = captureCache.get(trackId);
        if (cached) return cached;
        await new Promise(resolve => setTimeout(resolve, pollMs));
    }
    return captureCache.get(trackId) ?? null;
}


function getCurrentTrackId(): string | null {
    try {
        const uri = (globalThis as any).Spicetify?.Player?.data?.item?.uri;
        if (uri && typeof uri === 'string') {
            const parts = uri.split(':');
            return parts[parts.length - 1] || null;
        }
    } catch (e) {}
    return null;
}

function getTrackIdFromUri(trackUri: string): string | null {
    if (!trackUri || typeof trackUri !== 'string') {
        return null;
    }

    const parts = trackUri.split(':');
    return parts[parts.length - 1] || null;
}


function extractContentLinesData(lyrics: LyricsData): LyricLineData[] {
    const lineData: LyricLineData[] = [];
    if (!lyrics.Content) return lineData;

    for (const group of lyrics.Content) {
        if (group.Type === 'Instrumental') {
            const st = group.Lead?.StartTime ?? group.StartTime ?? 0;
            const et = group.Lead?.EndTime ?? group.EndTime ?? 0;
            lineData.push({
                text: '',
                startTime: st,
                endTime: et,
                isInstrumental: true
            });
            continue;
        }

        if (group.Lead?.Syllables && group.Lead.Syllables.length > 0) {
            const wordTimings: WordTimingData[] = [];
            let lineText = '';
            let romanizedText = '';
            let anyRomanized = false;
            for (const syllable of group.Lead.Syllables) {
                wordTimings.push({
                    text: syllable.Text,
                    startTime: syllable.StartTime,
                    endTime: syllable.EndTime,
                    isPartOfWord: syllable.IsPartOfWord,
                });
                const romanSyl = syllable.RomanizedText ?? syllable.Text;
                if (syllable.RomanizedText && syllable.RomanizedText !== syllable.Text) {
                    anyRomanized = true;
                }
                if (syllable.IsPartOfWord) {
                    lineText += syllable.Text;
                    romanizedText += romanSyl;
                } else {
                    if (lineText.length > 0) lineText += ' ';
                    lineText += syllable.Text;
                    if (romanizedText.length > 0) romanizedText += ' ';
                    romanizedText += romanSyl;
                }
            }
            lineData.push({
                text: lineText.trim(),
                startTime: group.Lead.StartTime,
                endTime: group.Lead.EndTime,
                isInstrumental: false,
                romanizedText: anyRomanized ? romanizedText.replace(/\s+/g, ' ').trim() : undefined,
                words: wordTimings,
            });
            continue;
        }

        if (group.Text !== undefined && group.StartTime !== undefined && group.EndTime !== undefined) {
            lineData.push({
                text: String(group.Text).trim(),
                startTime: group.StartTime,
                endTime: group.EndTime,
                isInstrumental: false,
            });
            continue;
        }

        if (group.Lead) {
            const leadText = (group.Lead as any).Text;
            if (leadText !== undefined) {
                lineData.push({
                    text: String(leadText).trim(),
                    startTime: group.Lead.StartTime,
                    endTime: group.Lead.EndTime,
                    isInstrumental: false,
                });
                continue;
            }
        }

    }

    return lineData;
}


function extractStaticLinesData(lyrics: LyricsData): LyricLineData[] {
    if (!lyrics.Lines) return [];
    return lyrics.Lines.map(line => ({
        text: line.Text?.trim() || '',
        startTime: 0,
        endTime: 0,
        isInstrumental: false
    }));
}


function extractLinesData(lyrics: LyricsData): LyricLineData[] {
    switch (lyrics.Type) {
        case 'Syllable':
        case 'Line':
            return extractContentLinesData(lyrics);
        case 'Static':
            return extractStaticLinesData(lyrics);
        default:
            if (lyrics.Content && lyrics.Content.length > 0) {
                return extractContentLinesData(lyrics);
            }
            warn('Unknown lyrics type and no Content:', lyrics.Type, JSON.stringify(Object.keys(lyrics)));
            return [];
    }
}

let cachedTrackId: string | null = null;
let cachedLineData: LyricLineData[] | null = null;
let cachedLanguage: string | null = null;


function getLyricsLanguage(lyrics: LyricsData): string | undefined {
    const iso = normalizeLanguageCode(lyrics.LanguageISO2);
    if (iso !== 'unknown' && iso !== 'auto') return iso;

    const language = normalizeLanguageCode(lyrics.Language);
    if (language !== 'unknown' && language !== 'auto') return language;

    return undefined;
}

export function getCachedLineData(): LyricLineData[] | null {
    return cachedLineData;
}


export async function fetchLyricsFromAPI(): Promise<{ lines: string[]; lineData: LyricLineData[]; language?: string } | null> {
    const trackId = getCurrentTrackId();
    if (!trackId) {
        return null;
    }

    if (trackId === cachedTrackId && cachedLineData) {
        return {
            lines: cachedLineData.map(l => l.text),
            lineData: cachedLineData,
            language: cachedLanguage || undefined
        };
    }

    try {
        const lyrics = await waitForCapture(trackId);
        if (!lyrics) {
            return null;
        }

        const lineData = extractLinesData(lyrics);
        if (lineData.length === 0) {
            return null;
        }

        cachedTrackId = trackId;
        cachedLineData = lineData;
        cachedLanguage = getLyricsLanguage(lyrics) || null;

        const lines = lineData.map(l => l.text);
        return { lines, lineData, language: cachedLanguage || undefined };
    } catch (err) {
        warn('Failed to capture lyrics from Spicy Lyrics fetch:', err);
        return null;
    }
}

export async function fetchLyricsForTrackUri(trackUri: string): Promise<{ lines: string[]; lineData: LyricLineData[]; language?: string } | null> {
    const trackId = getTrackIdFromUri(trackUri);
    if (!trackId) {
        return null;
    }

    if (trackId === cachedTrackId && cachedLineData) {
        return {
            lines: cachedLineData.map(l => l.text),
            lineData: cachedLineData,
            language: cachedLanguage || undefined
        };
    }

    try {
        const lyrics = await waitForCapture(trackId);
        if (!lyrics) {
            return null;
        }

        const lineData = extractLinesData(lyrics);
        if (lineData.length === 0) {
            return null;
        }

        cachedTrackId = trackId;
        cachedLineData = lineData;
        cachedLanguage = getLyricsLanguage(lyrics) || null;

        return {
            lines: lineData.map(l => l.text),
            lineData,
            language: cachedLanguage || undefined
        };
    } catch (err) {
        warn('Failed to capture lyrics for track URI:', trackUri, err);
        return null;
    }
}


export function clearLyricsCache(): void {
    cachedTrackId = null;
    cachedLineData = null;
    cachedLanguage = null;
}

export default {
    fetchLyricsFromAPI,
    fetchLyricsForTrackUri,
    clearLyricsCache,
    getCachedLineData,
};
