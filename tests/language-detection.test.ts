import test from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizeLanguageCode,
    isSameLanguage,
    shouldSkipTranslation,
    detectLanguageHeuristic,
    detectByDistinctiveLatinMarkers
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

test('distinctive Latin markers detect Slavic/Baltic languages locally with high confidence', () => {
    const polish = detectByDistinctiveLatinMarkers('Zostałem sam w ciemności, a ty odeszłaś już');
    assert.equal(polish?.code, 'pl');
    assert.ok((polish?.confidence ?? 0) >= 0.75);

    const lithuanian = detectByDistinctiveLatinMarkers('Mano širdis vis dar tavo, naktį sapnuoju tik tave');
    assert.equal(lithuanian?.code, 'lt');

    const czech = detectByDistinctiveLatinMarkers('Nikdy tě nezapomenu, srdce mé krvácí, zůstal jsem sám');
    assert.equal(czech?.code, 'cs');
});

test('distinctive marker detection does not fire on English/Romance text', () => {
    assert.equal(detectByDistinctiveLatinMarkers('The quick brown fox jumps over the lazy dog'), null);
    assert.equal(detectByDistinctiveLatinMarkers('El corazon que llora bajo la luna sin ti'), null);
    assert.equal(detectLanguageHeuristic('the way you look at me when i am not around')?.code, 'en');
});

test('distinctive marker detection ignores Vietnamese diacritics', () => {
    assert.equal(detectByDistinctiveLatinMarkers('Đường về nhà em qua bao nhiêu con phố đông người'), null);
});

test('heavily elided French lines are detected as French, not skipped as unknown', () => {
    assert.equal(detectLanguageHeuristic("J'suis mort à l'intérieur")?.code, 'fr');
    assert.equal(detectLanguageHeuristic("J'connais plus qu'la douleur")?.code, 'fr');
    assert.equal(detectLanguageHeuristic("J'me cache d'tout l'monde j'suis sociophobe")?.code, 'fr');
    assert.equal(detectLanguageHeuristic("J’suis mort à l’intérieur")?.code, 'fr');
});

test('English contractions are not misread as French after elision handling', () => {
    assert.equal(detectLanguageHeuristic("I'm all alone in the club and you're gone")?.code, 'en');
    assert.notEqual(detectLanguageHeuristic("Don't tell me it's over, we're not done")?.code, 'fr');
});

test('Polish lyrics are not skipped when translating to English', async () => {
    const originalFetch = (globalThis as any).fetch;
    (globalThis as any).fetch = async () => { throw new Error('no network'); };
    try {
        const lyrics = [
            'Nigdy więcej nie chcę cię zobaczyć',
            'Bo serce moje pęka na pół',
            'Zostałem sam w ciemności nocy'
        ];
        const result = await shouldSkipTranslation(lyrics, 'en');
        assert.equal(result.skip, false);
        assert.equal(result.detectedLanguage, 'pl');
    } finally {
        (globalThis as any).fetch = originalFetch;
    }
});

test('shouldSkipTranslation skips English lyrics that Google\'s API reports as pcm', async () => {
    const originalFetch = (globalThis as any).fetch;
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
