import test from 'node:test';
import assert from 'node:assert/strict';
import type { LyricLineData } from '../src/utils/lyricsFetcher';
import type {
    isRomanizationActive as IsRomanizationActive,
    resolveTranslationSourceLines as ResolveTranslationSourceLines
} from '../src/utils/core';

(globalThis as any).window = {
    setTimeout,
    clearTimeout,
    location: { pathname: '', href: '', reload: () => {} },
    addEventListener: () => {},
    removeEventListener: () => {}
};
(globalThis as any).document = {
    querySelector: () => null
};

const { isRomanizationActive, resolveTranslationSourceLines } = require('../src/utils/core') as {
    isRomanizationActive: typeof IsRomanizationActive;
    resolveTranslationSourceLines: typeof ResolveTranslationSourceLines;
};

function vocalLine(text: string, romanizedText?: string): LyricLineData {
    return {
        text,
        romanizedText,
        startTime: 0,
        endTime: 1000,
        isInstrumental: false
    };
}

test('romanization mode translates API original lyrics instead of DOM romanized lyrics', () => {
    const originalLines = ['\u541b\u306f\u4e16\u754c', '\u611b\u3057\u3066\u308b'];
    const romanizedLines = ['kimi wa sekai', 'ai shiteru'];
    const apiLineData = originalLines.map((line, index) => vocalLine(line, romanizedLines[index]));

    const result = resolveTranslationSourceLines({
        domLineTexts: romanizedLines,
        romanizationOn: true,
        apiVocalTexts: originalLines,
        apiVocalLineData: apiLineData
    });

    assert.equal(result.canTranslate, true);
    assert.equal(result.useApiLines, true);
    assert.deepEqual(result.lineTexts, originalLines);
    assert.deepEqual(result.lineTexts.filter(line => romanizedLines.includes(line)), []);
});

test('detects Spicy Lyrics romanization storage key', () => {
    (globalThis as any).Spicetify = {
        LocalStorage: {
            get: (key: string) => key === 'SpicyLyrics-romanization' ? 'true' : null
        }
    };
    (globalThis as any).localStorage = {
        getItem: () => null
    };

    assert.equal(isRomanizationActive(), true);
});

test('romanization mode does not fall back to DOM romanized lyrics when API originals are missing', () => {
    const romanizedLines = ['kimi wa sekai', 'ai shiteru'];

    const result = resolveTranslationSourceLines({
        domLineTexts: romanizedLines,
        romanizationOn: true,
        apiVocalTexts: null,
        apiVocalLineData: null,
        cachedSourceLines: null
    });

    assert.equal(result.canTranslate, false);
    assert.equal(result.reason, 'missing-original-lyrics');
    assert.deepEqual(result.lineTexts, []);
});

test('romanization mode reuses cached original source lines when API capture is unavailable', () => {
    const cachedOriginalLines = ['\u541b\u306f\u4e16\u754c', '\u611b\u3057\u3066\u308b'];
    const romanizedLines = ['kimi wa sekai', 'ai shiteru'];

    const result = resolveTranslationSourceLines({
        domLineTexts: romanizedLines,
        romanizationOn: true,
        apiVocalTexts: null,
        apiVocalLineData: null,
        cachedSourceLines: cachedOriginalLines
    });

    assert.equal(result.canTranslate, true);
    assert.equal(result.useApiLines, true);
    assert.deepEqual(result.lineTexts, cachedOriginalLines);
    assert.deepEqual(result.lineTexts.filter(line => romanizedLines.includes(line)), []);
});

test('romanization mode rejects cached source lines that are already romanized', () => {
    const romanizedLines = ['kimi wa sekai', 'ai shiteru'];

    const result = resolveTranslationSourceLines({
        domLineTexts: romanizedLines,
        romanizationOn: true,
        apiVocalTexts: null,
        apiVocalLineData: null,
        cachedSourceLines: romanizedLines
    });

    assert.equal(result.canTranslate, false);
    assert.equal(result.reason, 'missing-original-lyrics');
    assert.deepEqual(result.lineTexts, []);
});

test('romanization mode pads missing API lines with empty text instead of DOM romanized text', () => {
    const originalLines = ['\u541b\u306f\u4e16\u754c'];
    const romanizedLines = ['kimi wa sekai', 'ai shiteru'];
    const apiLineData = [vocalLine(originalLines[0], romanizedLines[0])];

    const result = resolveTranslationSourceLines({
        domLineTexts: romanizedLines,
        romanizationOn: true,
        apiVocalTexts: originalLines,
        apiVocalLineData: apiLineData,
        cachedSourceLines: null
    });

    assert.equal(result.canTranslate, true);
    assert.deepEqual(result.lineTexts, [originalLines[0], '']);
    assert.deepEqual(result.lineTexts.filter(line => romanizedLines.includes(line)), []);
    assert.equal(result.apiVocalLineData?.[1]?.text, '');
});
