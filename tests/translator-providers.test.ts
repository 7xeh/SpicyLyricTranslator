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
    setPreferredApi('google', '', {
        customApiKey: '',
        customApiFormat: 'generic',
        customApiModel: '',
        libreTranslateApiUrl: 'http://localhost:5000/translate',
        libreTranslateApiKey: '',
        deeplApiKey: '',
        openaiApiKey: '',
        openaiModel: 'gpt-4o-mini',
        geminiApiKey: '',
        geminiModel: 'gemini-3.1-flash-lite',
        geminiTemperature: '0.3'
    } as any);
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
    setPreferredApi('libretranslate', undefined, {
        libreTranslateApiUrl: 'http://localhost:5000/translate'
    } as any);

    const calls: FetchCall[] = [];
    (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        return jsonResponse({ translatedText: 'Xin chao' });
    };

    const result = await translateText('\u3053\u3093\u306b\u3061\u306f', 'vi', 'ja');

    assert.equal(result.translatedText, 'Xin chao');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'http://localhost:5000/translate');
    assert.equal(calls[0].init?.method, 'POST');
    assert.ok(calls[0].init?.body instanceof URLSearchParams);
    assert.equal((calls[0].init?.body as URLSearchParams).get('q'), '\u3053\u3093\u306b\u3061\u306f');
    assert.equal((calls[0].init?.body as URLSearchParams).get('target'), 'vi');
    assert.deepEqual(calls[0].init?.headers, undefined);
});

test('LibreTranslate sends configured API key for hosted endpoints', async () => {
    resetState();
    setPreferredApi('libretranslate', undefined, {
        libreTranslateApiUrl: 'https://libretranslate.com/translate',
        libreTranslateApiKey: 'lt-key'
    } as any);

    const calls: FetchCall[] = [];
    (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        return jsonResponse({ translatedText: 'Xin chao' });
    };

    const result = await translateText('\u3053\u3093\u306b\u3061\u306f', 'vi', 'ja');

    assert.equal(result.translatedText, 'Xin chao');
    assert.equal(calls[0].url, 'https://libretranslate.com/translate');
    assert.equal((calls[0].init?.body as URLSearchParams).get('api_key'), 'lt-key');
});

test('Hosted LibreTranslate without an API key fails before loading an HTML page', async () => {
    resetState();
    setPreferredApi('libretranslate', undefined, {
        libreTranslateApiUrl: 'https://libretranslate.com/translate',
        libreTranslateApiKey: ''
    } as any);

    let fetchCalled = false;
    (globalThis as any).fetch = async () => {
        fetchCalled = true;
        return jsonResponse({ translatedText: 'unexpected' });
    };

    await assert.rejects(
        () => translateText('\u3053\u3093\u306b\u3061\u306f', 'vi', 'ja'),
        /LibreTranslate API key required/
    );
    assert.equal(fetchCalled, false);
});

test('LibreTranslate reports HTML responses as endpoint errors instead of JSON syntax errors', async () => {
    resetState();
    setPreferredApi('libretranslate', undefined, {
        libreTranslateApiUrl: 'http://localhost:5000/translate'
    } as any);

    (globalThis as any).fetch = async () => ({
        ok: true,
        status: 200,
        text: async () => '<!DOCTYPE html><html></html>'
    } as Response);

    await assert.rejects(
        () => translateText('\u3053\u3093\u306b\u3061\u306f', 'vi', 'ja'),
        /LibreTranslate API returned HTML instead of JSON/
    );
});

test('LibreTranslate batch uses one Cosmos request with newline text and does not fall back when lines parse', async () => {
    resetState();
    setPreferredApi('libretranslate', undefined, {
        libreTranslateApiUrl: 'http://localhost:5000/translate'
    } as any);

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
    assert.equal(cosmosCalls[0].url, 'http://localhost:5000/translate');
    assert.equal(cosmosCalls[0].body.q, sourceLines.join('\n'));
    assert.equal(cosmosCalls[0].body.target, 'vi');
    assert.deepEqual(cosmosCalls[0].headers, { 'Content-Type': 'application/json' });
    assert.deepEqual(result.map(item => item.translatedText), translatedLines);
});

test('LibreTranslate does not send internal batch markers to Google fallback', async () => {
    resetState();
    setPreferredApi('libretranslate', undefined, {
        libreTranslateApiUrl: 'http://localhost:5000/translate'
    } as any);

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

test('DeepL without a key does not fall into the custom batch path', async () => {
    resetState();
    setPreferredApi('deepl');

    const calls: FetchCall[] = [];
    (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        return jsonResponse({ translatedText: 'unexpected' });
    };

    const { translateLyrics } = require('../src/utils/translator') as { translateLyrics: (lines: string[], targetLang: string) => Promise<any[]> };
    const sourceLines = ['\u3053\u3093\u306b\u3061\u306f', '\u3055\u3088\u3046\u306a\u3089'];
    const result = await translateLyrics(sourceLines, 'vi');

    assert.equal(calls.length, 0);
    assert.deepEqual(result.map(item => item.translatedText), sourceLines);
});

test('Custom API without a URL does not call fallback providers for marked batches', async () => {
    resetState();
    setPreferredApi('custom', '');

    const calls: FetchCall[] = [];
    (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        return jsonResponse({ translatedText: 'unexpected' });
    };

    const { translateLyrics } = require('../src/utils/translator') as { translateLyrics: (lines: string[], targetLang: string) => Promise<any[]> };
    const sourceLines = ['\u3053\u3093\u306b\u3061\u306f', '\u3055\u3088\u3046\u306a\u3089'];
    const result = await translateLyrics(sourceLines, 'vi');

    assert.equal(calls.length, 0);
    assert.deepEqual(result.map(item => item.translatedText), sourceLines);
});

test('OpenAI uses CosmosAsync when available instead of raw browser fetch', async () => {
    resetState();
    setPreferredApi('openai', undefined, {
        openaiApiKey: 'sk-proj-test',
        openaiModel: 'gpt-4o-mini'
    } as any);

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
                return {
                    choices: [
                        {
                            message: {
                                content: 'Xin chao'
                            }
                        }
                    ]
                };
            }
        }
    };

    const result = await translateText('\u3053\u3093\u306b\u3061\u306f', 'vi', 'ja');

    assert.equal(result.translatedText, 'Xin chao');
    assert.equal(fetchCalls.length, 0);
    assert.equal(cosmosCalls.length, 1);
    assert.equal(cosmosCalls[0].url, 'https://api.openai.com/v1/chat/completions');
    assert.deepEqual(cosmosCalls[0].headers, {
        'Authorization': 'Bearer sk-proj-test',
        'Content-Type': 'application/json'
    });
    assert.equal(cosmosCalls[0].body.model, 'gpt-4o-mini');
    assert.equal(cosmosCalls[0].body.messages[1].content, '\u3053\u3093\u306b\u3061\u306f');
    assert.equal(cosmosCalls[0].body.temperature, 0.3);
    assert.equal(cosmosCalls[0].body.max_completion_tokens, 500);
    assert.equal(Object.prototype.hasOwnProperty.call(cosmosCalls[0].body, 'max_tokens'), false);
});

test('OpenAI auth errors keep provider details without leaking the key', async () => {
    resetState();
    setPreferredApi('openai', undefined, {
        openaiApiKey: 'sk-proj-secretvalue',
        openaiModel: 'gpt-4o-mini'
    } as any);

    const calls: FetchCall[] = [];
    (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        return jsonResponse({
            error: {
                message: 'Incorrect API key provided: sk-proj-secretvalue',
                type: 'invalid_request_error'
            }
        }, false, 401);
    };

    await assert.rejects(
        () => translateText('\u3053\u3093\u306b\u3061\u306f', 'vi', 'ja'),
        /OpenAI API error: 401.*Incorrect API key provided: sk-\.\.\./
    );
    assert.equal(calls.length, 1);
});

test('OpenAI uses GPT-5.5 speed mode with no reasoning effort', async () => {
    resetState();
    setPreferredApi('openai', undefined, {
        openaiApiKey: 'sk-proj-test',
        openaiModel: 'gpt-5.5'
    } as any);

    const calls: FetchCall[] = [];
    (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        return jsonResponse({
            choices: [
                {
                    message: {
                        content: 'Xin chao'
                    }
                }
            ]
        });
    };

    const result = await translateText('\u3053\u3093\u306b\u3061\u306f', 'vi', 'ja');

    assert.equal(result.translatedText, 'Xin chao');
    assert.equal(calls.length, 1);
    const body = JSON.parse(String(calls[0].init?.body));
    assert.equal(body.model, 'gpt-5.5');
    assert.equal(body.messages[0].role, 'developer');
    assert.equal(body.reasoning_effort, 'none');
    assert.equal(body.max_completion_tokens, 500);
    assert.equal(Object.prototype.hasOwnProperty.call(body, 'temperature'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(body, 'max_tokens'), false);
});

test('OpenAI maps retired dropdown values to GPT-4o mini', async () => {
    resetState();
    setPreferredApi('openai', undefined, {
        openaiApiKey: 'sk-proj-test',
        openaiModel: 'gpt-4o'
    } as any);

    const calls: FetchCall[] = [];
    (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        return jsonResponse({
            choices: [
                {
                    message: {
                        content: 'Xin chao'
                    }
                }
            ]
        });
    };

    await translateText('\u3053\u3093\u306b\u3061\u306f', 'vi', 'ja');

    const body = JSON.parse(String(calls[0].init?.body));
    assert.equal(body.model, 'gpt-4o-mini');
});

test('Gemini uses the configured model in the generateContent endpoint and sends the key as a query param', async () => {
    resetState();
    setPreferredApi('gemini', undefined, {
        geminiApiKey: 'gemini-key',
        geminiModel: 'gemini-3.5-flash'
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
    assert.equal(calls[0].url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=gemini-key');
    assert.deepEqual(calls[0].init?.headers, { 'Content-Type': 'application/json' });
});

test('Gemini maps old Flash model settings to the new 3.5 Flash endpoint', async () => {
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

    await translateText('\u3053\u3093\u306b\u3061\u306f', 'vi', 'ja');

    assert.equal(calls[0].url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=gemini-key');
});

test('Gemini omits thinkingConfig so generic models do not 400 on unknown options', async () => {
    resetState();
    setPreferredApi('gemini', undefined, {
        geminiApiKey: 'gemini-key',
        geminiModel: 'gemini-3.1-flash-lite'
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
    assert.equal(Object.prototype.hasOwnProperty.call(body.generationConfig, 'thinkingConfig'), false);
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

test('Gemini skips API entirely when corpus is confidently same language as target', async () => {
    resetState();
    setPreferredApi('gemini', undefined, {
        geminiApiKey: 'gemini-key',
        geminiModel: 'gemini-3.5-flash'
    } as any);

    let fetchCalls = 0;
    (globalThis as any).fetch = async () => {
        fetchCalls++;
        return jsonResponse({
            candidates: [
                { content: { parts: [{ text: 'should-not-be-used' }] } }
            ]
        });
    };

    (globalThis as any).Spicetify = {
        Player: {
            data: {
                item: {
                    uri: 'spotify:track:SAMELANGENGENGENGENG12',
                    name: 'Bones',
                    artists: [{ name: 'SleepMode' }]
                }
            }
        }
    };

    const sourceLines = [
        'I have been walking down this empty street',
        'Looking for a sign that everything will be alright',
        'The bones in my body know exactly where to go'
    ];

    const { translateLyrics } = require('../src/utils/translator') as { translateLyrics: (lines: string[], targetLang: string, trackUri?: string) => Promise<any[]> };
    const results = await translateLyrics(sourceLines, 'en', 'spotify:track:SAMELANGENGENGENGENG12');

    assert.equal(fetchCalls, 0, 'expected no API call when source corpus is already in target language');
    assert.equal(results.every(r => r.wasTranslated === false), true);
    assert.deepEqual(results.map(r => r.translatedText), sourceLines);

    const { getAllCachedTracks } = require('../src/utils/trackCache') as { getAllCachedTracks: () => any[] };
    assert.equal(getAllCachedTracks().length, 0);
});

test('Gemini does not cache English-to-English no-op translations', async () => {
    resetState();
    setPreferredApi('gemini', undefined, {
        geminiApiKey: 'gemini-key',
        geminiModel: 'gemini-3.5-flash'
    } as any);

    const sourceLines = ['Bones in the wind', 'Walking through the dark'];

    (globalThis as any).fetch = async () => jsonResponse({
        candidates: [
            { content: { parts: [{ text: sourceLines.join('\n') }] } }
        ],
        usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 50, totalTokenCount: 100 }
    });

    (globalThis as any).Spicetify = {
        Player: {
            data: {
                item: {
                    uri: 'spotify:track:ENGENGENGENGENGENGENG12',
                    name: 'Bones',
                    artists: [{ name: 'SleepMode' }]
                }
            }
        }
    };

    const { translateLyrics } = require('../src/utils/translator') as { translateLyrics: (lines: string[], targetLang: string, trackUri?: string) => Promise<any[]> };
    const results = await translateLyrics(sourceLines, 'en', 'spotify:track:ENGENGENGENGENGENGENG12');

    assert.equal(results.length, sourceLines.length);
    assert.equal(results.every(r => r.wasTranslated === false), true, 'expected all lines to be marked as not translated when result equals source');

    const { getAllCachedTracks } = require('../src/utils/trackCache') as { getAllCachedTracks: () => any[] };
    const cached = getAllCachedTracks();
    assert.equal(cached.length, 0, 'expected no track cache entry for no-op translation');
});

test('Gemini batch translation persists model/duration/token metrics in the track cache', async () => {
    resetState();
    setPreferredApi('gemini', undefined, {
        geminiApiKey: 'gemini-key',
        geminiModel: 'gemini-3.1-flash-lite'
    } as any);

    const sourceLines = ['こんにちは', 'さようなら'];
    const translatedLines = ['Xin chào', 'Tạm biệt'];

    (globalThis as any).fetch = async () => jsonResponse({
        candidates: [
            { content: { parts: [{ text: translatedLines.join('\n') }] } }
        ],
        usageMetadata: {
            promptTokenCount: 123,
            candidatesTokenCount: 45,
            totalTokenCount: 168
        }
    });

    (globalThis as any).Spicetify = {
        Player: {
            data: {
                item: {
                    uri: 'spotify:track:1234567890abcdef123456',
                    name: 'Test Song',
                    artists: [{ name: 'Test Artist' }]
                }
            }
        }
    };

    const { translateLyrics } = require('../src/utils/translator') as { translateLyrics: (lines: string[], targetLang: string, trackUri?: string) => Promise<any[]> };
    await translateLyrics(sourceLines, 'vi', 'spotify:track:1234567890abcdef123456');

    const { getAllCachedTracks } = require('../src/utils/trackCache') as { getAllCachedTracks: () => any[] };
    const cached = getAllCachedTracks();
    assert.equal(cached.length, 1);
    assert.equal(cached[0].api, 'gemini');
    assert.ok(cached[0].metrics, 'metrics should be present');
    assert.equal(cached[0].metrics.model, 'gemini-3.1-flash-lite');
    assert.equal(cached[0].metrics.inputTokens, 123);
    assert.equal(cached[0].metrics.outputTokens, 45);
    assert.equal(cached[0].metrics.totalTokens, 168);
    assert.equal(cached[0].metrics.apiCalls >= 1, true);
    assert.equal(typeof cached[0].metrics.durationMs, 'number');
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

test('Gemini splits large songs into parallel chunks instead of one slow batch', async () => {
    resetState();
    setPreferredApi('gemini', undefined, {
        geminiApiKey: 'gemini-key',
        geminiModel: 'gemini-3.1-flash-lite',
        geminiTemperature: '0.3'
    } as any);

    const sourceLines = Array.from({ length: 16 }, (_, i) => `строка${'я'.repeat(i + 1)}`);
    const translationMap = new Map(sourceLines.map((line, i) => [line, `Translated line ${i}`]));
    const expected = sourceLines.map((_, i) => `Translated line ${i}`);

    const calls: FetchCall[] = [];
    const seenSources: string[] = [];
    (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        const body = JSON.parse(String(init?.body ?? '{}'));
        const promptText: string = body.contents[0].parts[0].text;
        const markedLines = promptText.split('\n').filter(line => line.includes('[[SLT_BATCH_'));
        const translated = markedLines.map(line => {
            const source = line.replace(/\[\[SLT_BATCH_[^\]]*\]\]/, '');
            seenSources.push(source);
            return translationMap.get(source) ?? source;
        });
        return jsonResponse({
            candidates: [{ content: { parts: [{ text: translated.join('\n') }] } }]
        });
    };

    const { translateLyrics } = require('../src/utils/translator') as { translateLyrics: (lines: string[], targetLang: string) => Promise<any[]> };
    const result = await translateLyrics(sourceLines, 'en');

    assert.equal(calls.length, 2);
    assert.deepEqual(result.map(item => item.translatedText), expected);
    assert.deepEqual([...seenSources].sort(), [...sourceLines].sort());
});

test('maxParallelChunks=1 keeps Gemini on a single sequential batch', async () => {
    resetState();
    setPreferredApi('gemini', undefined, {
        geminiApiKey: 'gemini-key',
        geminiModel: 'gemini-3.1-flash-lite',
        geminiTemperature: '0.3',
        maxParallelChunks: '1'
    } as any);

    const sourceLines = Array.from({ length: 16 }, (_, i) => `строка${'я'.repeat(i + 1)}`);
    const translationMap = new Map(sourceLines.map((line, i) => [line, `Translated line ${i}`]));
    const expected = sourceLines.map((_, i) => `Translated line ${i}`);

    const calls: FetchCall[] = [];
    (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        const body = JSON.parse(String(init?.body ?? '{}'));
        const promptText: string = body.contents[0].parts[0].text;
        const translated = promptText.split('\n')
            .filter(line => line.includes('[[SLT_BATCH_'))
            .map(line => translationMap.get(line.replace(/\[\[SLT_BATCH_[^\]]*\]\]/, '')) ?? line);
        return jsonResponse({ candidates: [{ content: { parts: [{ text: translated.join('\n') }] } }] });
    };

    const { translateLyrics } = require('../src/utils/translator') as { translateLyrics: (lines: string[], targetLang: string) => Promise<any[]> };
    const result = await translateLyrics(sourceLines, 'en');

    assert.equal(calls.length, 1);
    assert.deepEqual(result.map(item => item.translatedText), expected);
});

test('maxParallelChunks caps the number of concurrent Gemini requests', async () => {
    resetState();
    setPreferredApi('gemini', undefined, {
        geminiApiKey: 'gemini-key',
        geminiModel: 'gemini-3.1-flash-lite',
        geminiTemperature: '0.3',
        maxParallelChunks: '2'
    } as any);

    const sourceLines = Array.from({ length: 32 }, (_, i) => `строка${'я'.repeat(i + 1)}`);
    const translationMap = new Map(sourceLines.map((line, i) => [line, `Translated line ${i}`]));
    const expected = sourceLines.map((_, i) => `Translated line ${i}`);

    const calls: FetchCall[] = [];
    (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        const body = JSON.parse(String(init?.body ?? '{}'));
        const promptText: string = body.contents[0].parts[0].text;
        const translated = promptText.split('\n')
            .filter(line => line.includes('[[SLT_BATCH_'))
            .map(line => translationMap.get(line.replace(/\[\[SLT_BATCH_[^\]]*\]\]/, '')) ?? line);
        return jsonResponse({ candidates: [{ content: { parts: [{ text: translated.join('\n') }] } }] });
    };

    const { translateLyrics } = require('../src/utils/translator') as { translateLyrics: (lines: string[], targetLang: string) => Promise<any[]> };
    const result = await translateLyrics(sourceLines, 'en');

    assert.equal(calls.length, 2);
    assert.deepEqual(result.map(item => item.translatedText), expected);
});

test('maxParallelChunks allows up to 6 concurrent Gemini requests', async () => {
    resetState();
    setPreferredApi('gemini', undefined, {
        geminiApiKey: 'gemini-key',
        geminiModel: 'gemini-3.1-flash-lite',
        geminiTemperature: '0.3',
        maxParallelChunks: '6'
    } as any);

    const sourceLines = Array.from({ length: 48 }, (_, i) => `строка${'я'.repeat(i + 1)}`);
    const translationMap = new Map(sourceLines.map((line, i) => [line, `Translated line ${i}`]));
    const expected = sourceLines.map((_, i) => `Translated line ${i}`);

    const calls: FetchCall[] = [];
    (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        const body = JSON.parse(String(init?.body ?? '{}'));
        const promptText: string = body.contents[0].parts[0].text;
        const translated = promptText.split('\n')
            .filter(line => line.includes('[[SLT_BATCH_'))
            .map(line => translationMap.get(line.replace(/\[\[SLT_BATCH_[^\]]*\]\]/, '')) ?? line);
        return jsonResponse({ candidates: [{ content: { parts: [{ text: translated.join('\n') }] } }] });
    };

    const { translateLyrics } = require('../src/utils/translator') as { translateLyrics: (lines: string[], targetLang: string) => Promise<any[]> };
    const result = await translateLyrics(sourceLines, 'en');

    assert.equal(calls.length, 6);
    assert.deepEqual(result.map(item => item.translatedText), expected);
});

test('mixed-language songs translate each language group with parallel chunks', async () => {
    resetState();
    setPreferredApi('gemini', undefined, {
        geminiApiKey: 'gemini-key',
        geminiModel: 'gemini-3.1-flash-lite',
        geminiTemperature: '0.3',
        maxParallelChunks: '4'
    } as any);

    const japaneseLines = Array.from({ length: 12 }, (_, i) => `ことば${'の'.repeat(i + 1)}`);
    const cyrillicLines = Array.from({ length: 4 }, (_, i) => `слово${'а'.repeat(i + 1)}`);
    const sourceLines = [...japaneseLines, ...cyrillicLines];
    const translationMap = new Map(sourceLines.map((line, i) => [line, `Translated line ${i}`]));
    const expected = sourceLines.map((_, i) => `Translated line ${i}`);

    const calls: FetchCall[] = [];
    (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        const body = JSON.parse(String(init?.body ?? '{}'));
        const promptText: string = body.contents[0].parts[0].text;
        const translated = promptText.split('\n')
            .filter(line => line.includes('[[SLT_BATCH_'))
            .map(line => translationMap.get(line.replace(/\[\[SLT_BATCH_[^\]]*\]\]/, '')) ?? line);
        return jsonResponse({ candidates: [{ content: { parts: [{ text: translated.join('\n') }] } }] });
    };

    const { translateLyrics } = require('../src/utils/translator') as { translateLyrics: (lines: string[], targetLang: string) => Promise<any[]> };
    const result = await translateLyrics(sourceLines, 'en');

    assert.equal(calls.length, 3);
    assert.deepEqual(result.map(item => item.translatedText), expected);
});

test('Gemini uses CosmosAsync when available instead of raw browser fetch', async () => {
    resetState();
    setPreferredApi('gemini', undefined, {
        geminiApiKey: 'AIza-test',
        geminiModel: 'gemini-3.1-flash-lite'
    } as any);

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
                return {
                    candidates: [
                        {
                            content: {
                                parts: [{ text: 'Xin chao' }]
                            }
                        }
                    ]
                };
            }
        }
    };

    const result = await translateText('\u3053\u3093\u306b\u3061\u306f', 'vi', 'ja');

    assert.equal(result.translatedText, 'Xin chao');
    assert.equal(fetchCalls.length, 0);
    assert.equal(cosmosCalls.length, 1);
    assert.equal(cosmosCalls[0].url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=AIza-test');
    assert.deepEqual(cosmosCalls[0].headers, {
        'Content-Type': 'application/json'
    });
    assert.equal(cosmosCalls[0].body.contents[0].parts[0].text.includes('\u3053\u3093\u306b\u3061\u306f'), true);
});
