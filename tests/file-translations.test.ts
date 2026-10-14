import test from 'node:test';
import assert from 'node:assert/strict';
import type {
    fetchLyricsForTrackUri as FetchLyricsForTrackUri,
    clearLyricsCache as ClearLyricsCache
} from '../src/utils/lyricsFetcher';
import {
    collectLineTranslations,
    resolveFileTranslations,
    mergeTranslationLines,
    parseFileTranslationMode,
    parseTtmlTranslations
} from '../src/utils/fileTranslations';
import { applyUserTranslations, coversAllLines, userTranslationKey } from '../src/utils/userTranslations';

const trackId = 'file-translation-track';
const trackUri = `spotify:track:${trackId}`;

(globalThis as any).window = {
    fetch: async () => {
        throw new Error('the Spicy Lyrics API should not be queried');
    }
};

const { fetchLyricsForTrackUri, clearLyricsCache } = require('../src/utils/lyricsFetcher') as {
    fetchLyricsForTrackUri: typeof FetchLyricsForTrackUri;
    clearLyricsCache: typeof ClearLyricsCache;
};

const ENGLISH = [
    'Next to me you are sleeping peacefully tonight',
    'Your mouth opens and then you smile at me',
    'What kind of dream are you having, I wonder'
];

function englishSet(language?: string) {
    const lines = new Map<string, string>();
    ['隣で眠ってるあなたの', '口が開く そして笑った', 'どんな夢見てるの？'].forEach((source, i) => lines.set(userTranslationKey(source), ENGLISH[i]));
    return { language, lines };
}

test('line translations are keyed by the source line and drop echoes and blanks', () => {
    const set = collectLineTranslations([
        { text: '隣で眠ってるあなたの', translatedText: ' Next to me  you are sleeping ' },
        { text: 'Oh yeah', translatedText: 'Oh, yeah!' },
        { text: '口が開く', translatedText: '' },
        { text: '口が開く', translatedText: undefined },
        { text: '', translatedText: 'orphan' }
    ]);
    assert.ok(set);
    assert.deepEqual(Array.from(set!.lines.entries()), [[userTranslationKey('隣で眠ってるあなたの'), 'Next to me you are sleeping']]);
    assert.equal(set!.language, undefined);
    assert.equal(collectLineTranslations([{ text: 'a', translatedText: 'a' }]), null);
    assert.equal(collectLineTranslations(null), null);
});

test('the default mode only uses a translation in the target language', () => {
    assert.equal(resolveFileTranslations([englishSet('en')], 'match', 'en').size, 3);
    assert.equal(resolveFileTranslations([englishSet('en-US')], 'match', 'en').size, 3);
    assert.equal(resolveFileTranslations([englishSet('en')], 'match', 'es').size, 0);
    assert.equal(resolveFileTranslations([englishSet()], 'match', 'en').size, 3, 'undeclared English is detected');
    assert.equal(resolveFileTranslations([englishSet()], 'match', 'de').size, 0, 'detected English is not German');
});

test('always mode shows the file translation even in another language, preferring the target when there is one', () => {
    assert.equal(resolveFileTranslations([englishSet('en')], 'always', 'es').size, 3);

    const spanish = { language: 'es', lines: new Map([[userTranslationKey('隣で眠ってるあなたの'), 'A mi lado duermes']]) };
    const picked = resolveFileTranslations([englishSet('en'), spanish], 'always', 'es');
    assert.deepEqual(Array.from(picked.values()), ['A mi lado duermes']);
    assert.equal(resolveFileTranslations([englishSet('en'), spanish], 'match', 'es').size, 1);
});

test('off mode and empty input give nothing', () => {
    assert.equal(resolveFileTranslations([englishSet('en')], 'off', 'en').size, 0);
    assert.equal(resolveFileTranslations([], 'always', 'en').size, 0);
    assert.equal(resolveFileTranslations(undefined, 'match', 'en').size, 0);
    assert.equal(parseFileTranslationMode('always'), 'always');
    assert.equal(parseFileTranslationMode('off'), 'off');
    assert.equal(parseFileTranslationMode(null), 'match');
    assert.equal(parseFileTranslationMode('bogus'), 'match');
});

test('your own lines win over the file, and the file counts towards full coverage', () => {
    const source = ['隣で眠ってるあなたの', '口が開く そして笑った'];
    const file = resolveFileTranslations([englishSet('en')], 'match', 'en');
    const mine = new Map([[userTranslationKey(source[1]), 'My own line']]);

    assert.equal(coversAllLines(source, mergeTranslationLines(file, mine)), true);
    assert.equal(coversAllLines([...source, 'まだ'], mergeTranslationLines(file, mine)), false);

    const base = source.map(line => ({ originalText: line, translatedText: line, wasTranslated: false, source: 'api' as const }));
    const result = applyUserTranslations(applyUserTranslations(base, source, file, 'file'), source, mine);
    assert.deepEqual(result.map(r => [r.translatedText, r.source, r.wasTranslated]), [
        [ENGLISH[0], 'file', true],
        ['My own line', 'user', true]
    ]);
});

test('raw TTML parsing needs a DOM parser and degrades to nothing without one', () => {
    assert.deepEqual(parseTtmlTranslations('<tt/>'), []);
    assert.deepEqual(parseTtmlTranslations(null), []);
});

test('lyrics uploaded to Spicy Lyrics locally are read first, with their translations and romanization', async () => {
    clearLyricsCache();
    (globalThis as any).caches = undefined;
    const requested: string[] = [];
    (globalThis as any).SpicyLyrics = {
        db: {
            objectStores: {
                lyricsStore: {
                    manager: {
                        get: async (uri: string) => {
                            requested.push(uri);
                            return {
                                Type: 'Line',
                                source: 'ldb',
                                Content: [
                                    { Type: 'Vocal', Text: '隣で眠ってるあなたの', StartTime: 1, EndTime: 3, TransliteratedText: 'tonari de nemutteru anata no', TranslatedText: ENGLISH[0] },
                                    { Type: 'Vocal', Text: '口が開く そして笑った', StartTime: 3, EndTime: 5, TranslatedText: ENGLISH[1] }
                                ]
                            };
                        },
                        getRaw: async () => null
                    }
                }
            }
        }
    };

    const result = await fetchLyricsForTrackUri(trackUri);
    assert.deepEqual(requested, [trackUri]);
    assert.ok(result);
    assert.equal(result!.lineData[0].romanizedText, 'tonari de nemutteru anata no');
    assert.equal(result!.lineData[1].translatedText, ENGLISH[1]);
    assert.equal(result!.fileTranslations?.length, 1);
    assert.equal(resolveFileTranslations(result!.fileTranslations, 'match', 'en').size, 2);
    delete (globalThis as any).SpicyLyrics;
});

test('translations inside cached Spicy Lyrics API lyrics are picked up per line', async () => {
    clearLyricsCache();
    (globalThis as any).caches = {
        has: async (name: string) => name === 'SpicyLyrics_LyricsStore_g1',
        open: async () => ({
            match: async () => ({
                json: async () => ({
                    ExpiresAt: Date.now() + 60_000,
                    Content: {
                        Type: 'Syllable',
                        Content: [
                            {
                                Type: 'Vocal',
                                Lead: {
                                    StartTime: 0,
                                    EndTime: 1,
                                    TranslatedText: ENGLISH[2],
                                    Syllables: [{ Text: 'どんな夢見てるの？', StartTime: 0, EndTime: 1, IsPartOfWord: false }]
                                }
                            }
                        ],
                        Lines: undefined
                    }
                })
            })
        })
    };

    const result = await fetchLyricsForTrackUri(trackUri);
    assert.equal(result?.lineData[0].translatedText, ENGLISH[2]);
    assert.deepEqual(Array.from(resolveFileTranslations(result!.fileTranslations, 'match', 'en').values()), [ENGLISH[2]]);
});
