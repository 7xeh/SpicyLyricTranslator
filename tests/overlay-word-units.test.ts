import test from 'node:test';
import assert from 'node:assert/strict';
import { getWordUnits, invalidateWordUnitsCache } from '../src/utils/translationOverlay';

type FakeWord = {
    name: string;
    closest: () => null;
    classList: { contains: (n: string) => boolean };
    contains: (other: unknown) => boolean;
};

function makeWord(name: string): FakeWord {
    const word: FakeWord = {
        name,
        closest: () => null,
        classList: { contains: () => false },
        contains: (other: unknown) => other === word
    };
    return word;
}

function makeLine(wordCount: number): { queries: number; querySelectorAll: () => FakeWord[] } {
    const words = Array.from({ length: wordCount }, (_, i) => makeWord(`w${i}`));
    const line = {
        queries: 0,
        querySelectorAll: () => {
            line.queries++;
            return words;
        }
    };
    return line;
}

test('getWordUnits returns every non-nested word unit', () => {
    invalidateWordUnitsCache();
    const line = makeLine(4);

    const units = getWordUnits(line as any);

    assert.equal(units.length, 4);
    assert.equal(line.queries, 1);
});

test('repeat calls within a frame reuse the cached word units', () => {
    invalidateWordUnitsCache();
    const line = makeLine(8);

    const first = getWordUnits(line as any);
    for (let i = 0; i < 9; i++) {
        assert.equal(getWordUnits(line as any), first);
    }

    assert.equal(line.queries, 1);
});

test('invalidating the cache forces a recompute', () => {
    invalidateWordUnitsCache();
    const line = makeLine(3);

    getWordUnits(line as any);
    assert.equal(line.queries, 1);

    invalidateWordUnitsCache();
    getWordUnits(line as any);

    assert.equal(line.queries, 2);
});

test('separate lines are cached independently', () => {
    invalidateWordUnitsCache();
    const a = makeLine(2);
    const b = makeLine(5);

    getWordUnits(a as any);
    getWordUnits(b as any);
    getWordUnits(a as any);
    getWordUnits(b as any);

    assert.equal(a.queries, 1);
    assert.equal(b.queries, 1);
    assert.equal(getWordUnits(a as any).length, 2);
    assert.equal(getWordUnits(b as any).length, 5);
});
