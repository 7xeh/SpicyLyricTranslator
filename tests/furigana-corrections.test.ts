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
    getFuriganaCorrections,
    hasFuriganaCorrections,
    saveFuriganaCorrection,
    clearFuriganaCorrection,
    clearTrackFuriganaCorrections,
    furiganaCorrectionsRevision
} = require('../src/utils/furiganaCorrections') as typeof import('../src/utils/furiganaCorrections');

const TRACK = 'spotify:track:furigana';
const OTHER = 'spotify:track:other';
const LINE = 'きっと知っていた運命の渦の中を';
const UNMEI = { lineText: LINE, start: 8, end: 10 };

test('a damaged store reads as empty', () => {
    storageMap.set('spicy-lyric-translator:furigana-corrections', '[1,2]');
    assert.equal(getFuriganaCorrections(TRACK, LINE), null);
    assert.equal(hasFuriganaCorrections(TRACK), false);
});

test('a line correction is kept per track and per line', () => {
    const before = furiganaCorrectionsRevision();
    assert.equal(saveFuriganaCorrection(TRACK, UNMEI, 'サダメ', 'line'), true);
    assert.ok(furiganaCorrectionsRevision() > before);
    assert.deepEqual(getFuriganaCorrections(TRACK, LINE), { lines: { '8-10': 'さだめ' }, words: {} });
    assert.equal(getFuriganaCorrections(TRACK, '先天の勘に沿って'), null);
    assert.equal(getFuriganaCorrections(OTHER, LINE), null);
    assert.equal(hasFuriganaCorrections(TRACK), true);
    assert.equal(hasFuriganaCorrections(OTHER), false);
});

test('a song-wide correction replaces the line one for that word', () => {
    saveFuriganaCorrection(TRACK, UNMEI, 'さだめ', 'song');
    assert.deepEqual(getFuriganaCorrections(TRACK, LINE), { lines: {}, words: { '運命': 'さだめ' } });
    assert.deepEqual(getFuriganaCorrections(TRACK, '運命に逆らう')?.words, { '運命': 'さだめ' });
});

test('an empty reading hides the furigana instead of clearing it', () => {
    saveFuriganaCorrection(TRACK, { lineText: LINE, start: 13, end: 14 }, '', 'line');
    assert.equal(getFuriganaCorrections(TRACK, LINE)?.lines['13-14'], '');
});

test('restoring the automatic reading drops both scopes for that spot', () => {
    clearFuriganaCorrection(TRACK, UNMEI);
    assert.deepEqual(getFuriganaCorrections(TRACK, LINE), { lines: { '13-14': '' }, words: {} });
    clearFuriganaCorrection(TRACK, { lineText: LINE, start: 13, end: 14 });
    assert.equal(getFuriganaCorrections(TRACK, LINE), null);
    assert.equal(hasFuriganaCorrections(TRACK), false);
});

test('corrections survive a fresh read from storage and can be wiped per track', () => {
    saveFuriganaCorrection(TRACK, UNMEI, 'うんめい', 'line', { trackName: 'Song', artistName: 'Artist' });
    saveFuriganaCorrection(OTHER, UNMEI, 'さだめ', 'song');
    const raw = JSON.parse(storageMap.get('spicy-lyric-translator:furigana-corrections') || '{}');
    assert.equal(raw[TRACK].trackName, 'Song');
    assert.deepEqual(raw[TRACK].lines[LINE], { '8-10': 'うんめい' });
    assert.equal(clearTrackFuriganaCorrections(TRACK), true);
    assert.equal(hasFuriganaCorrections(TRACK), false);
    assert.equal(hasFuriganaCorrections(OTHER), true);
});
