import test from 'node:test';
import assert from 'node:assert/strict';

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

const {
    getModelOptions,
    refreshModelCatalog,
    resolveModelId,
    parseGeminiModels,
    parseOpenAIModels,
    parseAnthropicModels,
    parseGrokModels
} = require('../src/utils/modelCatalog') as typeof import('../src/utils/modelCatalog');

type FetchCall = { url: string; headers: Record<string, string> };

function mockFetch(payload: unknown, calls: FetchCall[], status = 200): void {
    (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
        calls.push({ url, headers: (init?.headers || {}) as Record<string, string> });
        return { ok: status >= 200 && status < 300, status, json: async () => payload } as Response;
    };
}

const geminiListing = {
    models: [
        { name: 'models/gemini-3.8-flash', displayName: 'Gemini 3.8 Flash', supportedGenerationMethods: ['generateContent', 'countTokens'] },
        { name: 'models/gemini-3.7-flash', displayName: 'Gemini 3.7 Flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-3.5-flash-lite', displayName: 'Gemini 3.5 Flash-Lite', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-3.1-flash-lite', displayName: 'Gemini 3.1 Flash-Lite', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-3.1-flash-image', displayName: 'Image', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-3.1-flash-tts-preview', displayName: 'TTS', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-3.8-live', displayName: 'Live', supportedGenerationMethods: ['bidiGenerateContent'] },
        { name: 'models/gemini-embedding-2', displayName: 'Embedding', supportedGenerationMethods: ['embedContent'] },
        { name: 'models/gemma-4-27b-it', displayName: 'Gemma', supportedGenerationMethods: ['generateContent'] }
    ]
};

test('Gemini listing keeps text generation models, newest first, and drops image/tts/live/embedding models', () => {
    assert.deepEqual(parseGeminiModels(geminiListing).map(option => option.value), [
        'gemini-3.8-flash',
        'gemini-3.7-flash',
        'gemini-3.5-flash-lite',
        'gemini-3.1-flash-lite'
    ]);
    assert.equal(parseGeminiModels(geminiListing)[0].text, 'Gemini 3.8 Flash');
});

test('OpenAI listing keeps chat models and drops audio, image, embedding and dated snapshots', () => {
    const options = parseOpenAIModels({
        data: [
            { id: 'gpt-6-luna' },
            { id: 'gpt-6-sol' },
            { id: 'gpt-4o-mini' },
            { id: 'gpt-4o-mini-2024-07-18' },
            { id: 'gpt-4o-realtime-preview' },
            { id: 'gpt-image-2' },
            { id: 'text-embedding-3-large' },
            { id: 'whisper-1' },
            { id: 'o4-mini' }
        ]
    });
    assert.deepEqual(options.map(option => option.value), ['o4-mini', 'gpt-6-sol', 'gpt-6-luna', 'gpt-4o-mini']);
});

test('Claude listing keeps the API order and display names', () => {
    const options = parseAnthropicModels({
        data: [
            { id: 'claude-opus-5-5', display_name: 'Claude Opus 5.5' },
            { id: 'claude-haiku-4-5-20251001', display_name: 'Claude Haiku 4.5' }
        ]
    });
    assert.deepEqual(options, [
        { value: 'claude-opus-5-5', text: 'Claude Opus 5.5' },
        { value: 'claude-haiku-4-5-20251001', text: 'Claude Haiku 4.5' }
    ]);
});

test('Grok listing drops image and multi-agent models', () => {
    const options = parseGrokModels({
        data: [{ id: 'grok-4.7' }, { id: 'grok-4.5' }, { id: 'grok-imagine-image' }, { id: 'grok-4.20-multi-agent-0309' }]
    });
    assert.deepEqual(options.map(option => option.value), ['grok-4.7', 'grok-4.5']);
});

test('without a fetched list the dropdown falls back to the built-in models', () => {
    storageMap.clear();
    assert.deepEqual(getModelOptions('gemini').map(option => option.value), [
        'gemini-3.1-flash-lite',
        'gemini-3.5-flash',
        'gemini-3.1-pro-preview'
    ]);
});

test('refreshing with a key fetches the live list, sends the key as a header, and caches it', async () => {
    storageMap.clear();
    const calls: FetchCall[] = [];
    mockFetch(geminiListing, calls);

    const refreshed = await refreshModelCatalog('gemini', 'AIza-live');

    assert.equal(refreshed?.[0].value, 'gemini-3.8-flash');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url.includes('AIza-live'), false);
    assert.equal(calls[0].headers['x-goog-api-key'], 'AIza-live');
    assert.equal(getModelOptions('gemini')[0].value, 'gemini-3.8-flash');
    assert.equal([...storageMap.values()].some(value => value.includes('AIza-live')), false);
});

test('a fresh cache is reused, but a new key or a forced refresh fetches again', async () => {
    storageMap.clear();
    const calls: FetchCall[] = [];
    mockFetch(geminiListing, calls);

    await refreshModelCatalog('gemini', 'AIza-one');
    assert.equal(await refreshModelCatalog('gemini', 'AIza-one'), null);
    assert.equal(calls.length, 1);

    await refreshModelCatalog('gemini', 'AIza-two');
    assert.equal(calls.length, 2);

    await refreshModelCatalog('gemini', 'AIza-two', { force: true });
    assert.equal(calls.length, 3);
});

test('a rejected key keeps the previous list instead of emptying the dropdown', async () => {
    storageMap.clear();
    const okCalls: FetchCall[] = [];
    mockFetch(geminiListing, okCalls);
    await refreshModelCatalog('gemini', 'AIza-good');

    const badCalls: FetchCall[] = [];
    mockFetch({ error: { code: 400, message: 'API key not valid' } }, badCalls, 400);
    const refreshed = await refreshModelCatalog('gemini', 'AIza-bad', { force: true });

    assert.equal(refreshed, null);
    assert.equal(badCalls.length, 1);
    assert.equal(getModelOptions('gemini')[0].value, 'gemini-3.8-flash');
});

test('the saved model and the default always stay selectable', () => {
    storageMap.clear();
    const values = getModelOptions('grok', 'grok-5-preview').map(option => option.value);
    assert.equal(values.includes('grok-5-preview'), true);
    assert.equal(values.includes('grok-4.5'), true);
});

test('new model ids pass through while retired ones map to a working model', () => {
    assert.equal(resolveModelId('gemini', 'models/gemini-3.8-flash'), 'gemini-3.8-flash');
    assert.equal(resolveModelId('gemini', 'gemini-2.5-flash'), 'gemini-3.5-flash');
    assert.equal(resolveModelId('gemini', 'gemini-3.1-flash-lite-preview'), 'gemini-3.1-flash-lite');
    assert.equal(resolveModelId('openai', 'gpt-6-luna'), 'gpt-6-luna');
    assert.equal(resolveModelId('openai', 'gpt-4o'), 'gpt-4o-mini');
    assert.equal(resolveModelId('anthropic', 'claude-opus-5-5'), 'claude-opus-5-5');
    assert.equal(resolveModelId('anthropic', ''), 'claude-haiku-4-5');
    assert.equal(resolveModelId('grok', 'grok 4.7; drop'), 'grok-4.5');
});
