import test from 'node:test';
import assert from 'node:assert/strict';
import type {
    fetchLyricsForTrackUri as FetchLyricsForTrackUri,
    clearLyricsCache as ClearLyricsCache
} from '../src/utils/lyricsFetcher';

const trackId = 'spotify-track-cache-test';
const trackUri = `spotify:track:${trackId}`;

(globalThis as any).window = {
    fetch: async () => {
        throw new Error('Spicy Lyrics API should not be fetched when cache has lyrics');
    }
};

function installSpicyLyricsCache(content: any): void {
    (globalThis as any).caches = {
        has: async (name: string) => name === 'SpicyLyrics_LyricsStore_g1',
        open: async (name: string) => {
            assert.equal(name, 'SpicyLyrics_LyricsStore_g1');
            return {
                match: async (key: string) => {
                    assert.equal(key, `/${trackId}`);
                    return {
                        json: async () => ({
                            ExpiresAt: Date.now() + 60_000,
                            CacheVersion: 5,
                            Content: content
                        })
                    };
                }
            };
        }
    };
}

const {
    fetchLyricsForTrackUri,
    clearLyricsCache
} = require('../src/utils/lyricsFetcher') as {
    fetchLyricsForTrackUri: typeof FetchLyricsForTrackUri;
    clearLyricsCache: typeof ClearLyricsCache;
};

test('reads original lyrics from Spicy Lyrics Cache API when query capture is unavailable', async () => {
    clearLyricsCache();
    installSpicyLyricsCache({
        id: trackId,
        Type: 'Syllable',
        LanguageISO2: 'ja',
        Content: [
            {
                Type: 'Vocal',
                Lead: {
                    StartTime: 0,
                    EndTime: 1000,
                    Syllables: [
                        {
                            Text: '\u541b',
                            RomanizedText: 'kimi',
                            StartTime: 0,
                            EndTime: 300,
                            IsPartOfWord: false
                        },
                        {
                            Text: '\u306f',
                            RomanizedText: 'wa',
                            StartTime: 300,
                            EndTime: 500,
                            IsPartOfWord: false
                        },
                        {
                            Text: '\u4e16\u754c',
                            RomanizedText: 'sekai',
                            StartTime: 500,
                            EndTime: 1000,
                            IsPartOfWord: false
                        }
                    ]
                }
            }
        ]
    });

    const result = await fetchLyricsForTrackUri(trackUri);

    assert.deepEqual(result?.lines, ['\u541b \u306f \u4e16\u754c']);
    assert.equal(result?.lineData[0]?.romanizedText, 'kimi wa sekai');
    assert.equal(result?.language, 'ja');
});

test('skips blank lines and syllables the way Spicy Lyrics 6.3.20 renders them', async () => {
    clearLyricsCache();
    installSpicyLyricsCache({
        id: trackId,
        Type: 'Syllable',
        Content: [
            {
                Type: 'Vocal',
                Lead: {
                    StartTime: 0,
                    EndTime: 1000,
                    Syllables: [
                        { Text: '​', StartTime: 0, EndTime: 100, IsPartOfWord: false },
                        { Text: '   ', StartTime: 100, EndTime: 200, IsPartOfWord: false }
                    ]
                }
            },
            {
                Type: 'Vocal',
                Lead: {
                    StartTime: 1000,
                    EndTime: 2000,
                    Syllables: [
                        { Text: 'Hold', StartTime: 1000, EndTime: 1300, IsPartOfWord: false },
                        { Text: '', StartTime: 1300, EndTime: 1400, IsPartOfWord: false },
                        { Text: 'on', StartTime: 1400, EndTime: 2000, IsPartOfWord: false }
                    ]
                }
            },
            {
                Type: 'Vocal',
                Lead: {
                    StartTime: 2000,
                    EndTime: 3000,
                    Syllables: [
                        { Text: '', TransliteratedText: 'sayonara', StartTime: 2000, EndTime: 3000, IsPartOfWord: false }
                    ]
                }
            }
        ]
    });

    const result = await fetchLyricsForTrackUri(trackUri);

    assert.deepEqual(result?.lines, ['Hold on', 'sayonara']);
    assert.deepEqual(result?.lineData[0]?.words?.map(w => w.text), ['Hold', 'on']);
    assert.equal(result?.lineData[1]?.romanizedText, undefined);
});

test('drops blank Line and Static entries and falls back to romanized text', async () => {
    clearLyricsCache();
    installSpicyLyricsCache({
        id: trackId,
        Type: 'Line',
        Content: [
            { Type: 'Vocal', Text: '​', StartTime: 0, EndTime: 1000 },
            { Type: 'Vocal', Text: '', TransliteratedText: 'annyeong', StartTime: 1000, EndTime: 2000 },
            { Type: 'Vocal', Text: 'Stay‎ here', StartTime: 2000, EndTime: 3000 }
        ]
    });

    const lineResult = await fetchLyricsForTrackUri(trackUri);
    assert.deepEqual(lineResult?.lines, ['annyeong', 'Stay here']);

    clearLyricsCache();
    installSpicyLyricsCache({
        id: trackId,
        Type: 'Static',
        Lines: [
            { Text: '' },
            { Text: 'First' },
            { Text: '  ', TransliteratedText: 'daini' }
        ]
    });

    const staticResult = await fetchLyricsForTrackUri(trackUri);
    assert.deepEqual(staticResult?.lines, ['First', 'daini']);
});
