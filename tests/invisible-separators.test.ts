import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanLyricText, normalizeLyricMatchKey } from '../src/utils/text';
import { lookupByContent } from '../src/utils/translationOverlay';

const ZWSP = '\u200B';
const DOM_LINE = `J'ai${ZWSP} fait${ZWSP} le${ZWSP} tour${ZWSP} de${ZWSP} ma${ZWSP} vie`;
const API_LINE = "J'ai fait le tour de ma vie";

test('zero-width spaces between rendered words are removed from lyric text', () => {
    assert.equal(cleanLyricText(DOM_LINE), API_LINE);
    assert.equal(cleanLyricText(`Tout${ZWSP}le${ZWSP}monde`), 'Tout le monde');
    assert.equal(cleanLyricText(`\uFEFF  Que du\u2060 cinéma  `), 'Que du cinéma');
});

test('rendered and API copies of a line share a match key', () => {
    assert.equal(normalizeLyricMatchKey(DOM_LINE), normalizeLyricMatchKey(API_LINE));
});

test('a translation keyed by API text is found for the rendered line', () => {
    const map = new Map([[normalizeLyricMatchKey(API_LINE), "I've been around my life"]]);
    assert.equal(lookupByContent(map, DOM_LINE), "I've been around my life");
});

test('direction marks stripped by Spicy Lyrics do not break matching', () => {
    const apiLine = 'Tu me‏ manques‎';
    const domLine = 'Tu me manques';
    assert.equal(cleanLyricText(apiLine), domLine);
    assert.equal(normalizeLyricMatchKey(apiLine), normalizeLyricMatchKey(domLine));
});

test('zero-width spaces removed by Spicy Lyrics still match the API copy', () => {
    const apiLine = `Tout${ZWSP}le${ZWSP}monde`;
    const domLine = 'Toutlemonde';
    assert.equal(normalizeLyricMatchKey(apiLine), normalizeLyricMatchKey(domLine));
});
