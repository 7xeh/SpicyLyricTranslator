import test from 'node:test';
import assert from 'node:assert/strict';
import type { buildVocabularyPairs as BuildVocabularyPairs } from '../src/utils/translationOverlay';

(globalThis as any).localStorage = {
    length: 0,
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    key: () => null
};

const { buildVocabularyPairs } = require('../src/utils/translationOverlay') as {
    buildVocabularyPairs: typeof BuildVocabularyPairs;
};

test('vocabulary mode aligns common Japanese phrase chunks to Vietnamese translation order', () => {
    const pairs = buildVocabularyPairs(
        '\u3053\u306e\u307e\u307e\u63fa\u3055\u3076\u3089\u308c\u3066\u3044\u305f\u3044 \u306a',
        'Mu\u1ed1n m\u00e3i \u0111ung \u0111\u01b0a th\u1ebf n\u00e0y th\u00f4i'
    );

    assert.deepEqual(
        pairs.map(pair => [pair.translated, pair.original]),
        [
            ['Mu\u1ed1n m\u00e3i \u0111ung \u0111\u01b0a', '\u63fa\u3055\u3076\u3089\u308c\u3066\u3044\u305f\u3044'],
            ['th\u1ebf n\u00e0y', '\u3053\u306e\u307e\u307e'],
            ['th\u00f4i', '\u306a']
        ]
    );
    assert.ok(pairs.every(pair => pair.confidence !== 'low'));
});

test('vocabulary mode falls back to one phrase pair when Japanese alignment is uncertain', () => {
    const pairs = buildVocabularyPairs(
        '\u661f\u306e\u964d\u308b\u97f3\u304c\u805e\u3053\u3048\u308b\u3067\u3057\u3087\u3046',
        'Em c\u00f3 nghe th\u1ea5y \u00e2m thanh nh\u1eefng v\u00ec sao r\u01a1i kh\u00f4ng'
    );

    assert.deepEqual(pairs, [
        {
            original: '\u661f\u306e\u964d\u308b\u97f3\u304c\u805e\u3053\u3048\u308b\u3067\u3057\u3087\u3046',
            translated: 'Em c\u00f3 nghe th\u1ea5y \u00e2m thanh nh\u1eefng v\u00ec sao r\u01a1i kh\u00f4ng',
            confidence: 'low',
            sourceIndex: 0,
            translatedStart: 0
        }
    ]);
});
