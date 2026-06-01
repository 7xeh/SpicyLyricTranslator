import test from 'node:test';
import assert from 'node:assert/strict';
import type { LyricLineData } from '../src/utils/lyricsFetcher';
import type {
    isRomanizationActive as IsRomanizationActive,
    resolveTranslationSourceLines as ResolveTranslationSourceLines,
    translateCurrentLyrics as TranslateCurrentLyrics
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

const { isRomanizationActive, resolveTranslationSourceLines, translateCurrentLyrics } = require('../src/utils/core') as {
    isRomanizationActive: typeof IsRomanizationActive;
    resolveTranslationSourceLines: typeof ResolveTranslationSourceLines;
    translateCurrentLyrics: typeof TranslateCurrentLyrics;
};
const { state } = require('../src/utils/state') as { state: typeof import('../src/utils/state').state };

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

test('romanization mode uses the full API original list without padding to the visible DOM line count', () => {
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
    assert.deepEqual(result.lineTexts, originalLines);
    assert.deepEqual(result.lineTexts.filter(line => romanizedLines.includes(line)), []);
    assert.equal(result.apiVocalLineData?.length, 1);
});

test('same-language skip notification only fires once for repeated lyric refreshes', async () => {
    const notifications: string[] = [];
    const lines = [
        fakeLine('I keep dancing in the moonlight'),
        fakeLine('Every word is already English'),
        fakeLine('Nothing here needs translation')
    ];

    (globalThis as any).Spicetify = {
        LocalStorage: {
            get: () => null
        },
        Player: {
            data: {
                item: {
                    uri: 'spotify:track:english-only'
                }
            }
        },
        showNotification: (message: string) => {
            notifications.push(message);
        }
    };

    (globalThis as any).localStorage = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
        key: () => null,
        length: 0
    };
    Object.defineProperty(globalThis, 'navigator', {
        value: { onLine: true },
        configurable: true
    });

    (globalThis as any).document = {
        body: {
            classList: {
                contains: () => false
            }
        },
        querySelector: () => null,
        querySelectorAll: (selector: string) => selector.includes('.line') ? lines : []
    };

    state.isEnabled = true;
    state.isTranslating = false;
    state.targetLanguage = 'en';
    state.showNotifications = true;
    state.translatedLyrics.clear();
    state.lastTranslatedSongUri = null;
    state.detectedLanguage = null;

    await translateCurrentLyrics();
    await translateCurrentLyrics();

    assert.deepEqual(notifications, ['Lyrics already in EN']);
});

function fakeLine(text: string): Element {
    return {
        textContent: text,
        classList: {
            contains: (className: string) => className === 'line'
        },
        querySelectorAll: () => []
    } as unknown as Element;
}
