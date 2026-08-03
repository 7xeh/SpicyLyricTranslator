import test from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizeLanguageCode,
    isSameLanguage,
    shouldSkipTranslation,
    detectLanguageHeuristic,
    detectByDistinctiveLatinMarkers,
    detectChineseScript,
    isLikelyNonTargetLine,
    assessMixedLanguageContent,
    detectRomanizedJapanese
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

test('normalizeLanguageCode keeps Simplified and Traditional Chinese apart', () => {
    assert.equal(normalizeLanguageCode('zh-TW'), 'zh-hant');
    assert.equal(normalizeLanguageCode('zh_HK'), 'zh-hant');
    assert.equal(normalizeLanguageCode('zh-Hant'), 'zh-hant');
    assert.equal(normalizeLanguageCode('Chinese (Traditional)'), 'zh-hant');
    assert.equal(normalizeLanguageCode('zh-CN'), 'zh-hans');
    assert.equal(normalizeLanguageCode('zh-Hans'), 'zh-hans');
    assert.equal(normalizeLanguageCode('Chinese (Simplified)'), 'zh-hans');
    assert.equal(normalizeLanguageCode('zh'), 'zh-hani');
});

test('detectChineseScript classifies orthography by variant-specific characters', () => {
    assert.equal(detectChineseScript('愛你但說不出口，繼續走下去'), 'zh-Hant');
    assert.equal(detectChineseScript('爱你但说不出口，继续走下去'), 'zh-Hans');
    assert.equal(detectChineseScript('我不知道你在哪里'), 'zh-Hani');
});

test('isSameLanguage does not treat Traditional Chinese as the Simplified target', () => {
    assert.equal(isSameLanguage('zh-Hant', 'zh'), false);
    assert.equal(isSameLanguage('zh-Hans', 'zh-TW'), false);
    assert.equal(isSameLanguage('zh-Hans', 'zh'), true);
    assert.equal(isSameLanguage('zh-Hant', 'zh-TW'), true);
    assert.equal(isSameLanguage('zh-Hani', 'zh'), true);
    assert.equal(isSameLanguage('zh-Hani', 'zh-TW'), true);
});

test('shouldSkipTranslation translates between Chinese orthographies', async () => {
    const originalFetch = (globalThis as any).fetch;
    (globalThis as any).fetch = async () => { throw new Error('no network'); };
    try {
        const traditional = ['愛你但說不出口', '繼續走下去的時候', '這樣的國家與學校'];
        const toSimplified = await shouldSkipTranslation(traditional, 'zh');
        assert.equal(toSimplified.skip, false);
        assert.equal(toSimplified.detectedLanguage, 'zh-Hant');

        const toTraditional = await shouldSkipTranslation(traditional, 'zh-TW');
        assert.equal(toTraditional.skip, true);
        assert.equal(toTraditional.detectedLanguage, 'zh-Hant');

        const simplified = ['爱你但说不出口', '继续走下去的时候', '这样的国家与学校'];
        const simplifiedToTraditional = await shouldSkipTranslation(simplified, 'zh-TW');
        assert.equal(simplifiedToTraditional.skip, false);
        assert.equal(simplifiedToTraditional.detectedLanguage, 'zh-Hans');

        const simplifiedToSimplified = await shouldSkipTranslation(simplified, 'zh');
        assert.equal(simplifiedToSimplified.skip, true);
        assert.equal(simplifiedToSimplified.detectedLanguage, 'zh-Hans');
    } finally {
        (globalThis as any).fetch = originalFetch;
    }
});

test('shouldSkipTranslation skips Han text that reads the same in both orthographies', async () => {
    const originalFetch = (globalThis as any).fetch;
    (globalThis as any).fetch = async () => { throw new Error('no network'); };
    try {
        const neutral = ['我不知道你在哪里', '今天的月亮很美', '一人走在路上的我'];
        assert.equal((await shouldSkipTranslation(neutral, 'zh')).skip, true);
        assert.equal((await shouldSkipTranslation(neutral, 'zh-TW')).skip, true);
    } finally {
        (globalThis as any).fetch = originalFetch;
    }
});

test('isLikelyNonTargetLine flags foreign lines the word-count heuristic cannot classify', () => {
    const line = 'noche de verano bailando contigo bajo la lluvia';
    assert.equal(detectLanguageHeuristic(line), null);
    assert.equal(isLikelyNonTargetLine(line, 'en'), true);
    assert.equal(isLikelyNonTargetLine(line, 'es'), false);
});

test('isLikelyNonTargetLine ignores target-language lines, interjections and short lines', () => {
    assert.equal(isLikelyNonTargetLine('Dancing in the summer rain with you tonight', 'en'), false);
    assert.equal(isLikelyNonTargetLine('na na na na na', 'en'), false);
    assert.equal(isLikelyNonTargetLine('oh yeah baby', 'en'), false);
    assert.equal(isLikelyNonTargetLine('woah oh', 'en'), false);
    assert.equal(isLikelyNonTargetLine('', 'en'), false);
});

test('assessMixedLanguageContent reports a single foreign line as mixed content', () => {
    const lines = [
        'Dancing in the summer rain with you tonight',
        'I never wanted this to end so soon',
        'noche de verano bailando contigo bajo la lluvia'
    ];
    const mixed = assessMixedLanguageContent(lines, 'en');
    assert.equal(mixed.hasMixedContent, true);
    assert.ok(mixed.nonTargetCount >= 1);
});

test('assessMixedLanguageContent leaves a fully English track alone', () => {
    const lines = [
        'Dancing in the summer rain with you tonight',
        'I never wanted this to end so soon',
        'You know that I would wait for you again'
    ];
    assert.equal(assessMixedLanguageContent(lines, 'en').hasMixedContent, false);
});

test('shouldSkipTranslation does not skip a mostly-English track holding one foreign line', async () => {
    const originalFetch = (globalThis as any).fetch;
    (globalThis as any).fetch = async () => { throw new Error('no network'); };
    try {
        const lines = [
            'Dancing in the summer rain with you tonight',
            'I never wanted this to end so soon',
            'noche de verano bailando contigo bajo la lluvia',
            'You know that I would wait for you again'
        ];
        assert.equal((await shouldSkipTranslation(lines, 'en')).skip, false);
    } finally {
        (globalThis as any).fetch = originalFetch;
    }
});

test('shouldSkipTranslation still skips a fully English track targeting English', async () => {
    const originalFetch = (globalThis as any).fetch;
    (globalThis as any).fetch = async () => { throw new Error('no network'); };
    try {
        const lines = [
            'Dancing in the summer rain with you tonight',
            'I never wanted this to end so soon',
            'You know that I would wait for you again'
        ];
        const result = await shouldSkipTranslation(lines, 'en');
        assert.equal(result.skip, true);
        assert.equal(result.detectedLanguage, 'en');
    } finally {
        (globalThis as any).fetch = originalFetch;
    }
});

test('romanized Japanese detection requires a distinctly Japanese token, not bare particles', () => {
    assert.equal(detectRomanizedJapanese('I never wanted this to end so soon'), null);
    assert.equal(detectRomanizedJapanese('so soon to go and so to stay'), null);
    assert.ok(detectRomanizedJapanese('kimi no koe wa yume no naka de kikoeru'));
    assert.ok(detectRomanizedJapanese('kokoro ga itai kara namida wo mita'));
});
