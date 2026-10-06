import test from 'node:test';
import assert from 'node:assert/strict';
import type {
    setPreferredApi as SetPreferredApi,
    translateLyrics as TranslateLyrics,
    resolveGoogleSourceLang as ResolveGoogleSourceLang
} from '../src/utils/translator';

const storageMap = new Map<string, string>();

(globalThis as any).localStorage = {
    getItem: (key: string) => storageMap.get(key) ?? null,
    setItem: (key: string, value: string) => {
        storageMap.set(key, String(value));
    },
    removeItem: (key: string) => {
        storageMap.delete(key);
    },
    key: (index: number) => Array.from(storageMap.keys())[index] ?? null,
    get length() {
        return storageMap.size;
    }
};

Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { onLine: true }
});

const { setPreferredApi, translateLyrics, resolveGoogleSourceLang } = require('../src/utils/translator') as {
    setPreferredApi: typeof SetPreferredApi;
    translateLyrics: typeof TranslateLyrics;
    resolveGoogleSourceLang: typeof ResolveGoogleSourceLang;
};

const romanizedPunjabi = ['Tu lagge haan labhdi', 'Pehlan paundi morni', 'Jaan jaan rahan vich aaven'];
const gurmukhi = ['ਤੂੰ ਮੇਰੇ ਵੱਲ ਤਕਦੀ ਰਵੇ', 'ਨਾ ਮੇਰੀ ਤੇਰੇ ਤੋਂ ਨਜ਼ਰ ਹਟਦੀ', 'ਮੈਂ ਤੇਰਾ ਯਾ ਬਲੱਡ ਗੋਰੀਏ'];

function resetState(): void {
    storageMap.clear();
    delete (globalThis as any).Spicetify;
    setPreferredApi('google');
}

function installGoogleMock(detected: string): string[] {
    const urls: string[] = [];
    (globalThis as any).fetch = async (url: string) => {
        urls.push(url);
        const q = new URL(url).searchParams.get('q') || '';
        const translated = q
            .split('\n')
            .map((segment, index) => {
                const markerEnd = segment.indexOf(']]');
                const marker = markerEnd >= 0 ? segment.slice(0, markerEnd + 2) : '';
                return `${marker}Translated english sentence ${index}`;
            })
            .join('\n');
        return {
            ok: true,
            status: 200,
            json: async () => [[[translated, q]], null, detected]
        } as Response;
    };
    return urls;
}

function sourceLangsOf(urls: string[]): string[] {
    return urls
        .filter(url => url.includes('translate.googleapis.com'))
        .map(url => new URL(url).searchParams.get('sl') || '');
}

test('a non-Latin source hint is dropped for romanized text', () => {
    assert.equal(resolveGoogleSourceLang('Tu lagge haan labhdi', 'pa'), 'auto');
    assert.equal(resolveGoogleSourceLang('Dasso ki chone o, dasso ki chone o', 'ml'), 'auto');
    assert.equal(resolveGoogleSourceLang('Kimi no na wa', 'ja'), 'auto');
});

test('source hints are kept when the text is in the hinted script or the hint is Latin', () => {
    assert.equal(resolveGoogleSourceLang('ਤੂੰ ਮੇਰੇ ਵੱਲ ਤਕਦੀ ਰਵੇ', 'pa'), 'pa');
    assert.equal(resolveGoogleSourceLang('Te quiero', 'es'), 'es');
    assert.equal(resolveGoogleSourceLang('Tu lagge haan labhdi', undefined), 'auto');
    assert.equal(resolveGoogleSourceLang('123 ...', 'pa'), 'pa');
});

test('romanized Punjabi lyrics tagged as Punjabi are sent to Google with auto detection', async () => {
    resetState();
    const urls = installGoogleMock('pa');
    const results = await translateLyrics(romanizedPunjabi, 'en', 'spotify:track:romanized', 'pa');

    const sourceLangs = sourceLangsOf(urls);
    assert.ok(sourceLangs.length > 0);
    assert.ok(sourceLangs.every(sl => sl === 'auto'), `expected only sl=auto, got ${sourceLangs.join(',')}`);
    assert.ok(results.every(result => result.wasTranslated));
});

test('romanized lyrics mislabelled as Malayalam are not sent with sl=ml', async () => {
    resetState();
    const urls = installGoogleMock('pa');
    await translateLyrics(romanizedPunjabi, 'en', 'spotify:track:mislabelled', 'ml');

    assert.ok(sourceLangsOf(urls).every(sl => sl === 'auto'));
});

test('original-script Punjabi keeps its source hint', async () => {
    resetState();
    const urls = installGoogleMock('pa');
    await translateLyrics(gurmukhi, 'en', 'spotify:track:gurmukhi', 'pa');

    const sourceLangs = sourceLangsOf(urls);
    assert.ok(sourceLangs.length > 0);
    assert.ok(sourceLangs.every(sl => sl === 'pa'));
});

test('a romanized track translation is served from cache on replay instead of being refetched', async () => {
    resetState();
    const firstUrls = installGoogleMock('pa');
    await translateLyrics(romanizedPunjabi, 'en', 'spotify:track:replay', 'pa');
    assert.ok(firstUrls.length > 0);

    const replayUrls = installGoogleMock('pa');
    const replay = await translateLyrics(romanizedPunjabi, 'en', 'spotify:track:replay', 'pa');
    assert.equal(replayUrls.length, 0);
    assert.ok(replay.every(result => result.wasTranslated));
});

test('a stale track cache saved under a non-Latin language for romanized lines is retranslated', async () => {
    resetState();
    storageMap.set('spicy-lyric-translator:translation-cache', JSON.stringify(Object.fromEntries(
        romanizedPunjabi.map(line => [`en:${line}`, { translation: `(${line})`, timestamp: Date.now(), api: 'google' }])
    )));
    const seedUrls = installGoogleMock('ml');
    await translateLyrics(romanizedPunjabi, 'en', 'spotify:track:stale', undefined);
    assert.equal(seedUrls.length, 0);

    const trackKeys = Array.from(storageMap.keys()).filter(key => key.includes('track'));
    for (const key of trackKeys) {
        storageMap.set(key, storageMap.get(key)!.replace(/"lang":"[^"]*"/g, '"lang":"ml"'));
    }

    const urls = installGoogleMock('pa');
    const results = await translateLyrics(romanizedPunjabi, 'en', 'spotify:track:stale', 'ml');
    assert.ok(urls.length > 0);
    assert.ok(sourceLangsOf(urls).every(sl => sl === 'auto'));
    assert.ok(results.every(result => result.translatedText.startsWith('Translated english sentence')));
});
