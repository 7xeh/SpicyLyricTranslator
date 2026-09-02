import test from 'node:test';
import assert from 'node:assert/strict';
import {
    lookupByContent,
    setStyleProp,
    clearStyleProp,
    setDataProp
} from '../src/utils/translationOverlay';

function makeMap(entries: Array<[string, string]>): Map<string, string> {
    return new Map(entries);
}

test('lookupByContent matches on the normalized key', () => {
    const map = makeMap([['komigennuduvetvad', 'Come on now, you know what']]);

    assert.equal(lookupByContent(map, 'Kom igen nu, du vet vad'), 'Come on now, you know what');
    assert.equal(lookupByContent(map, '  KOM IGEN NU — DU VET VAD!  '), 'Come on now, you know what');
});

test('lookupByContent falls back to the Latin-only form of a mixed line', () => {
    const map = makeMap([['hellodarkness', 'translated']]);

    assert.equal(lookupByContent(map, 'hello 안녕 darkness'), 'translated');
});

test('lookupByContent falls back to the non-Latin-only form of a mixed line', () => {
    const map = makeMap([['안녕하세요', 'hello there']]);

    assert.equal(lookupByContent(map, '안녕하세요 remix 2024'), 'hello there');
});

test('lookupByContent accepts a close fuzzy match', () => {
    const map = makeMap([['vigorvaramisstag', 'We make our mistakes']]);

    assert.equal(lookupByContent(map, 'Vi gor vara misstag!'), 'We make our mistakes');
    assert.equal(lookupByContent(map, 'Vi gor vara misstag nu'), 'We make our mistakes');
});

test('lookupByContent rejects a fuzzy match that is too dissimilar', () => {
    const map = makeMap([['jag', 'I']]);

    assert.equal(lookupByContent(map, 'Jag saknar dig varje dag som gar'), undefined);
});

test('lookupByContent short-circuits on empty input', () => {
    assert.equal(lookupByContent(makeMap([['a', 'b']]), ''), undefined);
    assert.equal(lookupByContent(makeMap([['a', 'b']]), null), undefined);
    assert.equal(lookupByContent(new Map<string, string>(), 'anything'), undefined);
});

type FakeEl = {
    writes: number;
    style: {
        getPropertyValue: (p: string) => string;
        setProperty: (p: string, v: string) => void;
        removeProperty: (p: string) => void;
    };
    dataset: Record<string, string | undefined>;
};

function makeEl(): FakeEl {
    const props = new Map<string, string>();
    const el: FakeEl = {
        writes: 0,
        style: {
            getPropertyValue: (p) => props.get(p) ?? '',
            setProperty: (p, v) => { el.writes++; props.set(p, v); },
            removeProperty: (p) => { el.writes++; props.delete(p); }
        },
        dataset: new Proxy({} as Record<string, string | undefined>, {
            set: (target, key: string, value: string) => {
                el.writes++;
                target[key] = value;
                return true;
            }
        })
    };
    return el;
}

test('setStyleProp writes once and then skips redundant writes', () => {
    const el = makeEl();

    setStyleProp(el as any, '--gradient-position', '40%');
    assert.equal(el.writes, 1);

    for (let i = 0; i < 10; i++) {
        setStyleProp(el as any, '--gradient-position', '40%');
    }
    assert.equal(el.writes, 1);

    setStyleProp(el as any, '--gradient-position', '55%');
    assert.equal(el.writes, 2);
    assert.equal(el.style.getPropertyValue('--gradient-position'), '55%');
});

test('clearStyleProp only removes a property that is set', () => {
    const el = makeEl();

    clearStyleProp(el as any, '--BlurAmount');
    assert.equal(el.writes, 0);

    setStyleProp(el as any, '--BlurAmount', '4px');
    clearStyleProp(el as any, '--BlurAmount');
    assert.equal(el.writes, 2);

    clearStyleProp(el as any, '--BlurAmount');
    assert.equal(el.writes, 2);
});

test('setDataProp skips redundant dataset writes', () => {
    const el = makeEl();

    setDataProp(el as any, 'sltGradientPos', '100');
    assert.equal(el.writes, 1);

    for (let i = 0; i < 5; i++) {
        setDataProp(el as any, 'sltGradientPos', '100');
    }
    assert.equal(el.writes, 1);

    setDataProp(el as any, 'sltGradientPos', '20');
    assert.equal(el.writes, 2);
    assert.equal(el.dataset.sltGradientPos, '20');
});
