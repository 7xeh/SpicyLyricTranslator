import test from 'node:test';
import assert from 'node:assert/strict';
import { backgroundTranslationKey } from '../src/utils/translationOverlay';

test('a background line read from the page matches its lyrics text', () => {
    const fromLyrics = backgroundTranslationKey('(My insecurities are)');
    assert.equal(backgroundTranslationKey('(My in se curities are)'), fromLyrics);
    assert.equal(backgroundTranslationKey('My insecurities are'), fromLyrics);
    assert.equal(backgroundTranslationKey('ai shiteru'), backgroundTranslationKey('ai  shi teru'));
});

test('different background lines keep different keys', () => {
    assert.notEqual(backgroundTranslationKey('I promise you'), backgroundTranslationKey('I promise'));
    assert.equal(backgroundTranslationKey(''), '');
    assert.equal(backgroundTranslationKey(null), '');
});
