import test from 'node:test';
import assert from 'node:assert/strict';
import type { setPreferredApi as SetPreferredApi, translateText as TranslateText } from '../src/utils/translator';

type FetchCall = {
    url: string;
    init?: RequestInit;
};

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

const { setPreferredApi, translateText } = require('../src/utils/translator') as {
    setPreferredApi: typeof SetPreferredApi;
    translateText: typeof TranslateText;
};

function resetState(): void {
    storageMap.clear();
    delete (globalThis as any).Spicetify;
    setPreferredApi('google');
}

function jsonResponse(data: unknown, ok = true, status = 200): Response {
    return {
        ok,
        status,
        json: async () => data,
        text: async () => JSON.stringify(data)
    } as Response;
}

test('LibreTranslate sends a real POST request using form data to avoid JSON preflight', async () => {
    resetState();
    setPreferredApi('libretranslate');

    const calls: FetchCall[] = [];
    (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        return jsonResponse({ translatedText: 'Xin chao' });
    };

    const result = await translateText('\u3053\u3093\u306b\u3061\u306f', 'vi', 'ja');

    assert.equal(result.translatedText, 'Xin chao');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://libretranslate.de/translate');
    assert.equal(calls[0].init?.method, 'POST');
    assert.ok(calls[0].init?.body instanceof URLSearchParams);
    assert.equal((calls[0].init?.body as URLSearchParams).get('q'), '\u3053\u3093\u306b\u3061\u306f');
    assert.equal((calls[0].init?.body as URLSearchParams).get('target'), 'vi');
    assert.deepEqual(calls[0].init?.headers, undefined);
});

test('LibreTranslate batch uses one Cosmos request with newline text and does not fall back when lines parse', async () => {
    resetState();
    setPreferredApi('libretranslate');

    const sourceLines = [
        '\u4eca\u306f\u6614 \u8ab0\u3082\u304c\u77e5\u308b\u7269\u8a9e',
        '\u304b\u306e\u6709\u540d\u306a\u304b\u3050\u3084\u59eb\u306f\u3053\u3046\u8a00\u3063\u305f',
        '\u305d\u3093\u306a\u7d50\u672b\u3061\u3063\u3068\u3082\u671b\u3093\u3067\u306a\u3044\u3057'
    ];
    const translatedLines = [
        'Ngày xửa ngày xưa, câu chuyện ai cũng biết',
        'Nàng Kaguya nổi tiếng ấy đã nói thế này',
        'Em chẳng hề mong một kết cục như vậy'
    ];

    const fetchCalls: FetchCall[] = [];
    (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
        fetchCalls.push({ url, init });
        throw new Error('direct fetch should not be used when CosmosAsync is available');
    };

    const cosmosCalls: Array<{ url: string; body?: any; headers?: Record<string, string> }> = [];
    (globalThis as any).Spicetify = {
        CosmosAsync: {
            post: async (url: string, body?: any, headers?: Record<string, string>) => {
                cosmosCalls.push({ url, body, headers });
                return { translatedText: translatedLines.join('\n') };
            }
        }
    };

    const { translateLyrics } = require('../src/utils/translator') as { translateLyrics: (lines: string[], targetLang: string) => Promise<any[]> };
    const result = await translateLyrics(sourceLines, 'vi');

    assert.equal(fetchCalls.length, 0);
    assert.equal(cosmosCalls.length, 1);
    assert.equal(cosmosCalls[0].url, 'https://libretranslate.de/translate');
    assert.equal(cosmosCalls[0].body.q, sourceLines.join('\n'));
    assert.equal(cosmosCalls[0].body.target, 'vi');
    assert.deepEqual(cosmosCalls[0].headers, { 'Content-Type': 'application/json' });
    assert.deepEqual(result.map(item => item.translatedText), translatedLines);
});

test('LibreTranslate does not send internal batch markers to Google fallback', async () => {
    resetState();
    setPreferredApi('libretranslate');

    const calls: FetchCall[] = [];
    (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        return jsonResponse({ message: 'temporary failure' }, false, 500);
    };

    const { translateLyrics } = require('../src/utils/translator') as { translateLyrics: (lines: string[], targetLang: string) => Promise<any[]> };
    await translateLyrics([
        '\u4eca\u306f\u6614 \u8ab0\u3082\u304c\u77e5\u308b\u7269\u8a9e',
        '\u304b\u306e\u6709\u540d\u306a\u304b\u3050\u3084\u59eb\u306f\u3053\u3046\u8a00\u3063\u305f'
    ], 'vi');

    assert.equal(
        calls.some(call => call.url.includes('translate.googleapis.com') && call.url.includes('SLT_BATCH')),
        false
    );
});

test('DeepL sends header-based auth instead of deprecated auth_key request body auth', async () => {
    resetState();
    setPreferredApi('deepl', undefined, { deeplApiKey: 'test-key:fx' });

    const calls: FetchCall[] = [];
    (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        return jsonResponse({
            translations: [
                {
                    text: 'Xin chao',
                    detected_source_language: 'JA'
                }
            ]
        });
    };

    const result = await translateText('\u3053\u3093\u306b\u3061\u306f', 'vi', 'ja');

    assert.equal(result.translatedText, 'Xin chao');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://cors-proxy.spicetify.app/https://api-free.deepl.com/v2/translate');
    assert.equal(calls[0].init?.method, 'POST');
    assert.deepEqual(calls[0].init?.headers, {
        'Authorization': 'DeepL-Auth-Key test-key:fx',
        'Content-Type': 'application/json'
    });

    const body = JSON.parse(String(calls[0].init?.body));
    assert.deepEqual(body, {
        text: ['\u3053\u3093\u306b\u3061\u306f'],
        target_lang: 'VI'
    });
    assert.equal(Object.prototype.hasOwnProperty.call(body, 'auth_key'), false);
});

test('DeepL 403 stops after one batch request instead of retrying marker and per-line fallbacks', async () => {
    resetState();
    setPreferredApi('deepl', undefined, { deeplApiKey: 'bad-key:fx' });

    const calls: FetchCall[] = [];
    (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        return jsonResponse({ message: 'Forbidden' }, false, 403);
    };

    const { translateLyrics } = require('../src/utils/translator') as { translateLyrics: (lines: string[], targetLang: string) => Promise<any[]> };
    const result = await translateLyrics(['\u5e7e\u5343\u306e\u6642\u3092\u5de1\u3063\u3066 \u4eca', '\u50d5\u3089\u51fa\u4f1a\u3048\u305f \u306e'], 'vi');

    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].init?.headers, {
        'Authorization': 'DeepL-Auth-Key bad-key:fx',
        'Content-Type': 'application/json'
    });
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
        text: ['\u5e7e\u5343\u306e\u6642\u3092\u5de1\u3063\u3066 \u4eca', '\u50d5\u3089\u51fa\u4f1a\u3048\u305f \u306e'],
        target_lang: 'VI'
    });
    assert.deepEqual(result.map(item => item.translatedText), ['\u5e7e\u5343\u306e\u6642\u3092\u5de1\u3063\u3066 \u4eca', '\u50d5\u3089\u51fa\u4f1a\u3048\u305f \u306e']);
});

test('Gemini uses the configured model in the generateContent endpoint', async () => {
    resetState();
    setPreferredApi('gemini', undefined, {
        geminiApiKey: 'gemini-key',
        geminiModel: 'gemini-2.5-flash'
    } as any);

    const calls: FetchCall[] = [];
    (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        return jsonResponse({
            candidates: [
                {
                    content: {
                        parts: [{ text: 'Xin chao' }]
                    }
                }
            ]
        });
    };

    const result = await translateText('\u3053\u3093\u306b\u3061\u306f', 'vi', 'ja');

    assert.equal(result.translatedText, 'Xin chao');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
});

test('Gemini uses the configured temperature in generationConfig', async () => {
    resetState();
    setPreferredApi('gemini', undefined, {
        geminiApiKey: 'gemini-key',
        geminiTemperature: '0.8'
    } as any);

    const calls: FetchCall[] = [];
    (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        return jsonResponse({
            candidates: [
                {
                    content: {
                        parts: [{ text: 'Xin chao' }]
                    }
                }
            ]
        });
    };

    await translateText('\u3053\u3093\u306b\u3061\u306f', 'vi', 'ja');

    const body = JSON.parse(String(calls[0].init?.body));
    assert.equal(body.generationConfig.temperature, 0.8);
});

test('Gemini accepts a complete code-fenced batch response without sending chunked follow-up requests', async () => {
    resetState();
    setPreferredApi('gemini', undefined, {
        geminiApiKey: 'gemini-key',
        geminiModel: 'gemini-3.1-flash-lite',
        geminiTemperature: '0.6'
    } as any);

    const sourceLines = [
        '\u4eca\u306f\u6614 \u8ab0\u3082\u304c\u77e5\u308b\u7269\u8a9e',
        '\u304b\u306e\u6709\u540d\u306a\u304b\u3050\u3084\u59eb\u306f\u3053\u3046\u8a00\u3063\u305f',
        '\u305d\u3093\u306a\u7d50\u672b\u3061\u3063\u3068\u3082\u671b\u3093\u3067\u306a\u3044\u3057',
        '\u904b\u547d\u3060\u304b\u3089\u3063\u3066\u30ad\u30df\u305d\u308c\u3067\u9817\u304f\u306e\uff1f',
        '\u8ab0\u304b\u306e\u66f8\u3044\u305f\u304a\u8a71\u3058\u3083\u306a\u3044',
        '\u3053\u3053\u306b\u3044\u308b\u30ad\u30df\u3068\u79c1',
        '\u61d0\u304b\u3057\u3044\u3088\u3046\u306a',
        '\u521d\u3081\u3066\u306e\u3088\u3046\u306a'
    ];
    const translatedLines = [
        'Ngày xửa ngày xưa, câu chuyện ai cũng biết',
        'Nàng Kaguya nổi tiếng ấy đã nói thế này',
        'Em chẳng hề mong một kết cục như vậy',
        'Chỉ vì là số phận, anh sẽ gật đầu sao?',
        'Đây không phải câu chuyện do ai đó viết',
        'Mà là anh và em đang ở nơi này',
        'Như thể thật thân quen',
        'Như thể lần đầu gặp gỡ'
    ];

    const calls: FetchCall[] = [];
    (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        return jsonResponse({
            candidates: [
                {
                    content: {
                        parts: [{ text: ['```text', ...translatedLines, '```'].join('\n') }]
                    }
                }
            ]
        });
    };

    const { translateLyrics } = require('../src/utils/translator') as { translateLyrics: (lines: string[], targetLang: string) => Promise<any[]> };
    const result = await translateLyrics(sourceLines, 'vi');

    assert.equal(calls.length, 1);
    assert.deepEqual(result.map(item => item.translatedText), translatedLines);
});
