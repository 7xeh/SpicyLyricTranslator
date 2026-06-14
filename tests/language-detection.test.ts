import test from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizeLanguageCode,
    isSameLanguage,
    shouldSkipTranslation
} from '../src/utils/languageDetection';

test('normalizeLanguageCode folds English-based creoles/variants into "en"', () => {
    assert.equal(normalizeLanguageCode('pcm'), 'en');
    assert.equal(normalizeLanguageCode('sco'), 'en');
    assert.equal(normalizeLanguageCode('jam'), 'en');
    assert.equal(normalizeLanguageCode('PCM'), 'en');
    assert.equal(normalizeLanguageCode('en-US'), 'en');
    assert.equal(normalizeLanguageCode('es'), 'es');
    assert.equal(normalizeLanguageCode('ja'), 'ja');
});

test('isSameLanguage treats Google\'s "pcm" misdetection as English', () => {
    assert.equal(isSameLanguage('pcm', 'en'), true);
    assert.equal(isSameLanguage('sco', 'en'), true);
    assert.equal(isSameLanguage('pcm', 'es'), false);
    assert.equal(isSameLanguage('es', 'en'), false);
});

test('shouldSkipTranslation skips English lyrics that Google\'s API reports as pcm', async () => {
    const originalFetch = (globalThis as any).fetch;
    // Force the API detection path (the heuristic can't classify this chant)
    // and have Google report the English content as Nigerian Pidgin ("pcm").
    (globalThis as any).fetch = async () => ({
        ok: true,
        json: async () => [null, null, 'pcm']
    });

    try {
        const lyrics = [
            'Ayyoh ayyoh ayyoh wakawaka',
            'Zumba zumba lala eh eh',
            'Nana boomba ayyoh wakawaka',
            'Lala zumba eh eh boomba'
        ];

        const result = await shouldSkipTranslation(lyrics, 'en');

        assert.equal(result.skip, true);
        assert.equal(result.detectedLanguage, 'en');
    } finally {
        (globalThis as any).fetch = originalFetch;
    }
});
