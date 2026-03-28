import { warn } from './debug';

const SPICY_LYRICS_API = 'https://api.spicylyrics.org';

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


async function getSpotifyAccessToken(): Promise<string> {
    try {
        if ((globalThis as any).Spicetify?.CosmosAsync) {
            const result = await (globalThis as any).Spicetify.CosmosAsync.get('sp://oauth/v2/token');
            if (result?.accessToken) {
                return result.accessToken;
            }
        }
    } catch (e) {
    }
    
    try {
        const session = (globalThis as any).Spicetify?.Platform?.Session;
        if (session?.accessToken) {
            return session.accessToken;
        }
    } catch (e) {
    }
    
    throw new Error('Could not obtain Spotify access token');
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


function getSpicyLyricsVersion(): string {
    try {
        const metadata = (globalThis as any)._spicy_lyrics_metadata;
        if (metadata?.LoadedVersion && typeof metadata.LoadedVersion === 'string') {
            return metadata.LoadedVersion;
        }
    } catch (e) {}
    
    try {
        const session = (globalThis as any)._spicy_lyrics_session;
        const ver = session?.SpicyLyrics?.GetCurrentVersion?.();
        if (ver?.Text) {
            return ver.Text;
        }
    } catch (e) {}
    
    try {
        const stored = (globalThis as any).Spicetify?.LocalStorage?.get('SpicyLyrics-previous-version');
        if (stored && /^\d+\.\d+\.\d+/.test(stored)) {
            return stored;
        }
    } catch (e) {}
    
    return '5.19.11';
}


async function querySpicyLyricsAPI(trackId: string): Promise<LyricsData | null> {
    const token = await getSpotifyAccessToken();
    const spicyVersion = getSpicyLyricsVersion();
    
    const body = {
        queries: [
            {
                operation: 'lyrics',
                variables: {
                    id: trackId,
                    auth: 'SpicyLyrics-WebAuth',
                },
            },
        ],
        client: {
            version: spicyVersion,
        },
    };
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    try {
        const res = await fetch(`${SPICY_LYRICS_API}/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'SpicyLyrics-Version': spicyVersion,
                'SpicyLyrics-WebAuth': `Bearer ${token}`,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (!res.ok) {
            throw new Error(`SpicyLyrics API request failed with status ${res.status}`);
        }
        
        const data: QueryResponse = await res.json();
        
        const lyricsResult = data.queries?.[0]?.result;
        if (!lyricsResult) {
            warn('No lyrics query result found in API response');
            return null;
        }
        
        if (lyricsResult.httpStatus !== 200) {
            return null;
        }
        
        let lyricsData: LyricsData;
        if (lyricsResult.format === 'json') {
            lyricsData = lyricsResult.data as LyricsData;
        } else if (lyricsResult.format === 'text' && typeof lyricsResult.data === 'string') {
            try {
                lyricsData = JSON.parse(lyricsResult.data) as LyricsData;
            } catch {
                return null;
            }
        } else {
            return null;
        }
        
        return lyricsData;
    } catch (err) {
        clearTimeout(timeoutId);
        if ((err as Error).name === 'AbortError') {
        }
        throw err;
    }
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
            for (const syllable of group.Lead.Syllables) {
                wordTimings.push({
                    text: syllable.Text,
                    startTime: syllable.StartTime,
                    endTime: syllable.EndTime,
                    isPartOfWord: syllable.IsPartOfWord,
                });
                if (syllable.IsPartOfWord) {
                    lineText += syllable.Text;
                } else {
                    if (lineText.length > 0) lineText += ' ';
                    lineText += syllable.Text;
                }
            }
            lineData.push({
                text: lineText.trim(),
                startTime: group.Lead.StartTime,
                endTime: group.Lead.EndTime,
                isInstrumental: false,
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
        const lyrics = await querySpicyLyricsAPI(trackId);
        if (!lyrics) {
            return null;
        }
        
        const lineData = extractLinesData(lyrics);
        if (lineData.length === 0) {
            return null;
        }
        
        cachedTrackId = trackId;
        cachedLineData = lineData;
        cachedLanguage = lyrics.Language || null;
        
        const lines = lineData.map(l => l.text);
        return { lines, lineData, language: lyrics.Language || undefined };
    } catch (err) {
        warn('Failed to fetch lyrics from SpicyLyrics API:', err);
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
        const lyrics = await querySpicyLyricsAPI(trackId);
        if (!lyrics) {
            return null;
        }

        const lineData = extractLinesData(lyrics);
        if (lineData.length === 0) {
            return null;
        }

        cachedTrackId = trackId;
        cachedLineData = lineData;
        cachedLanguage = lyrics.Language || null;

        return {
            lines: lineData.map(l => l.text),
            lineData,
            language: lyrics.Language || undefined
        };
    } catch (err) {
        warn('Failed to fetch lyrics for track URI:', trackUri, err);
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
