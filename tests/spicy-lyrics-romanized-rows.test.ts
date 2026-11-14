import test from 'node:test';
import assert from 'node:assert/strict';
import { formatRomanization, lineOwnText } from '../src/utils/text';
import {
    areRomanizedRowsShown,
    isSpicyRomanizationToggledOn,
    lineShowsRomanizedRow,
    spicyRomanizationDisplay,
    supportsRomanizedRows
} from '../src/utils/spicyLyrics';
import { buildRomanizedWords, joinBackgroundSyllables } from '../src/utils/lyricsFetcher';

type FakeNode = { nodeType: number; textContent: string; classList?: { contains: (name: string) => boolean } };

function textNode(text: string): FakeNode {
    return { nodeType: 3, textContent: text };
}

function element(text: string, ...classes: string[]): FakeNode {
    return { nodeType: 1, textContent: text, classList: { contains: name => classes.includes(name) } };
}

function fakeLine(children: FakeNode[]): any {
    const rows = children.filter(child => child.classList?.contains('RomanizedRow'));
    return {
        textContent: children.map(child => child.textContent).join(''),
        childNodes: children,
        children: children.filter(child => child.nodeType === 1),
        querySelectorAll: () => rows,
        ownerDocument: undefined
    };
}

function fakePage(classes: string[], scale = ''): any {
    return {
        classList: { contains: (name: string) => classes.includes(name) },
        style: { getPropertyValue: (name: string) => name === '--SL-LyricsScale' ? scale : '' },
        querySelector: () => null
    };
}

function withGlobals(globals: Record<string, unknown>, run: () => void): void {
    const scope = globalThis as any;
    const keys = ['Spicetify', 'localStorage', '_spicy_lyrics_metadata', 'document', ...Object.keys(globals)];
    const previous = new Map(keys.map(key => [key, scope[key]]));
    for (const key of keys) delete scope[key];
    Object.assign(scope, globals);
    try {
        run();
    } finally {
        for (const [key, value] of previous) {
            if (value === undefined) delete scope[key];
            else scope[key] = value;
        }
    }
}

function storageWith(entries: Record<string, string>): { getItem: (key: string) => string | null } {
    return { getItem: key => entries[key] ?? null };
}

test('line text leaves out the romanized row Spicy Lyrics nests in the line', () => {
    const line = fakeLine([textNode('你好世界'), element('nǐ hǎo shì jiè', 'RomanizedRow')]);
    assert.equal(line.textContent, '你好世界nǐ hǎo shì jiè');
    assert.equal(lineOwnText(line), '你好世界');
});

test('line text is the whole text when no romanized row is present', () => {
    assert.equal(lineOwnText(fakeLine([textNode('Hello there')])), 'Hello there');
    assert.equal(lineOwnText({ textContent: 'Plain', querySelectorAll: () => [] } as any), 'Plain');
    assert.equal(lineOwnText(null), '');
});

test('pinyin syllable hyphens become spaces', () => {
    assert.equal(formatRomanization('nǐ-hǎo shì-jiè', '你好世界'), 'nǐ hǎo shì jiè');
    assert.equal(formatRomanization('wǒ-ài-nǐ', '我爱你'), 'wǒ ài nǐ');
});

test('hyphens stay in romanizations that are not pinyin', () => {
    assert.equal(formatRomanization('ra-men tabetai', 'ラーメン食べたい'), 'ra-men tabetai');
    assert.equal(formatRomanization('uh-oh', 'uh-oh'), 'uh-oh');
    assert.equal(formatRomanization('  kimi   wa  ', '君は'), 'kimi wa');
});

test('romanization only replaces the line when Spicy Lyrics is set to replace', () => {
    const uiState = JSON.stringify({ romanization: true });

    withGlobals({ localStorage: storageWith({ 'SL:uiState': uiState, 'SL:settings': JSON.stringify({ romanizationDisplay: 'underLine' }) }) }, () => {
        assert.equal(isSpicyRomanizationToggledOn(), true);
        assert.equal(spicyRomanizationDisplay(), 'underLine');
    });

    withGlobals({ localStorage: storageWith({ 'SL:uiState': uiState, 'SL:settings': JSON.stringify({ romanizationDisplay: 'replace' }) }) }, () => {
        assert.equal(spicyRomanizationDisplay(), 'replace');
    });
});

test('the romanization display default follows the Spicy Lyrics version', () => {
    withGlobals({ _spicy_lyrics_metadata: { LoadedVersion: '6.5.10' } }, () => {
        assert.equal(supportsRomanizedRows(), true);
        assert.equal(spicyRomanizationDisplay(), 'underLine');
    });

    withGlobals({ _spicy_lyrics_metadata: { LoadedVersion: '6.4.70' } }, () => {
        assert.equal(supportsRomanizedRows(), false);
        assert.equal(spicyRomanizationDisplay(), 'replace');
    });

    withGlobals({}, () => {
        assert.equal(spicyRomanizationDisplay(), 'replace');
    });
});

test('the version Spicy Lyrics stores in its UI state counts once its global is cleared', () => {
    withGlobals({ _spicy_lyrics_metadata: {}, localStorage: storageWith({ 'SL:uiState': JSON.stringify({ romanization: false, fromVersion: '6.5.10' }) }) }, () => {
        assert.equal(supportsRomanizedRows(), true);
        assert.equal(spicyRomanizationDisplay(), 'underLine');
    });
});

test('an unknown version falls back to what the page shows', () => {
    const modern = { querySelector: (selector: string) => selector === '#SpicyLyricsPage' ? fakePage([], '1') : null };
    const legacy = { querySelector: (selector: string) => selector === '#SpicyLyricsPage' ? fakePage([]) : null };

    withGlobals({}, () => {
        assert.equal(supportsRomanizedRows(modern as any), true);
        assert.equal(supportsRomanizedRows(legacy as any), false);
    });
});

test('a line only counts as romanized by Spicy Lyrics while the rows are open', () => {
    const open = { querySelector: () => fakePage(['RomanizedRowsShown']) };
    const closed = { querySelector: () => fakePage([]) };
    const withRow = fakeLine([textNode('君は'), element('kimi wa', 'RomanizedRow')]);
    const withoutRow = fakeLine([textNode('Hello')]);

    assert.equal(areRomanizedRowsShown(open as any), true);
    assert.equal(areRomanizedRowsShown(closed as any), false);

    withRow.ownerDocument = open;
    withoutRow.ownerDocument = open;
    assert.equal(lineShowsRomanizedRow(withRow), true);
    assert.equal(lineShowsRomanizedRow(withoutRow), false);

    withRow.ownerDocument = closed;
    assert.equal(lineShowsRomanizedRow(withRow), false);
});

test('romanized words follow the romanization word breaks and keep syllable timing', () => {
    const syllables = [
        { Text: '君', TransliteratedText: 'kimi', StartTime: 1, EndTime: 2, IsPartOfWord: true, TransliteratedIsPartOfWord: false },
        { Text: 'は', TransliteratedText: 'wa', StartTime: 2, EndTime: 2.5, IsPartOfWord: false },
        { Text: '世', TransliteratedText: 'se', StartTime: 3, EndTime: 3.5, IsPartOfWord: true },
        { Text: '界', TransliteratedText: 'kai', StartTime: 3.5, EndTime: 4, IsPartOfWord: false }
    ];

    assert.deepEqual(buildRomanizedWords(syllables as any, '君は 世界'), [
        { text: 'kimi', startTime: 1, endTime: 2, startsWord: true },
        { text: 'wa', startTime: 2, endTime: 2.5, startsWord: true },
        { text: 'se', startTime: 3, endTime: 3.5, startsWord: true },
        { text: 'kai', startTime: 3.5, endTime: 4, startsWord: false }
    ]);
});

test('a hyphenated pinyin syllable group splits into separately timed words', () => {
    const syllables = [
        { Text: '你好', TransliteratedText: 'nǐ-hǎo', StartTime: 1, EndTime: 2, IsPartOfWord: false },
        { Text: '吗', TransliteratedText: 'ma', StartTime: 2, EndTime: 3, IsPartOfWord: false }
    ];

    assert.deepEqual(buildRomanizedWords(syllables as any, '你好 吗'), [
        { text: 'nǐ', startTime: 1, endTime: 1.4, startsWord: true },
        { text: 'hǎo', startTime: 1.4, endTime: 2, startsWord: true },
        { text: 'ma', startTime: 2, endTime: 3, startsWord: true }
    ]);
});

test('background vocals use the romanization word breaks too', () => {
    const vocal = joinBackgroundSyllables([
        { Text: '愛', TransliteratedText: 'ai', StartTime: 0, EndTime: 1, IsPartOfWord: true, TransliteratedIsPartOfWord: false },
        { Text: 'してる', TransliteratedText: 'shiteru', StartTime: 1, EndTime: 2, IsPartOfWord: false }
    ] as any);

    assert.equal(vocal?.text, '愛してる');
    assert.equal(vocal?.romanizedText, 'ai shiteru');
});
