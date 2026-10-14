import test from 'node:test';
import assert from 'node:assert/strict';
import { fallbackToContinuousMultilineGradient } from '../src/utils/translationOverlay';

class FakeElement {
    children: FakeElement[] = [];
    dataset: Record<string, string> = {};
    ownText = '';

    constructor(public className: string, public offsetTop = 0) {}

    get textContent(): string {
        return this.ownText + this.children.map(child => child.textContent).join('');
    }

    set textContent(value: string) {
        this.children = [];
        this.ownText = value;
    }

    appendChild(child: FakeElement): FakeElement {
        this.children = this.children.filter(existing => existing !== child);
        this.children.push(child);
        return child;
    }

    private direct(className: string): FakeElement[] {
        return this.children.filter(child => child.className.split(' ').includes(className));
    }

    querySelector(selector: string): FakeElement | null {
        const direct = selector.match(/^:scope > \.([\w-]+)$/);
        if (direct) return this.direct(direct[1])[0] || null;
        return null;
    }

    querySelectorAll(selector: string): FakeElement[] {
        const direct = selector.match(/^:scope > \.([\w-]+)$/);
        return direct ? this.direct(direct[1]) : [];
    }
}

function buildTranslation(words: { text: string; top: number }[]): { el: FakeElement; badge: FakeElement } {
    const el = new FakeElement('slt-interleaved-translation slt-sync-translation');
    words.forEach(word => {
        const span = new FakeElement('slt-sync-word', word.top);
        span.ownText = word.text;
        el.appendChild(span);
    });
    const badge = new FakeElement('slt-quality-indicator');
    badge.ownText = 'Cached · Gemini';
    el.appendChild(badge);
    return { el, badge };
}

const lineSyncedLine = new FakeElement('line');
const TRANSLATION = 'A voice from some time ago is now making my heart feel cramped';

test('a wrapped line-synced translation keeps its quality badge when it falls back to one gradient', () => {
    const { el, badge } = buildTranslation([
        { text: 'A voice from some time ago is now ', top: 0 },
        { text: 'making my heart feel cramped', top: 48 }
    ]);

    fallbackToContinuousMultilineGradient(el as any, TRANSLATION, lineSyncedLine as any);

    assert.equal(el.dataset.sltGradientMode, 'continuous-multiline');
    assert.equal(el.querySelectorAll(':scope > .slt-sync-word').length, 0, 'word spans are replaced by plain text');
    assert.equal(el.ownText, TRANSLATION);
    assert.equal(el.querySelector(':scope > .slt-quality-indicator'), badge, 'the badge survives the rewrite');
    assert.equal(el.children.length, 1);
});

test('a translation that fits on one row is left alone, badge included', () => {
    const { el, badge } = buildTranslation([
        { text: 'Short ', top: 0 },
        { text: 'line', top: 0 }
    ]);

    fallbackToContinuousMultilineGradient(el as any, 'Short line', lineSyncedLine as any);

    assert.equal(el.dataset.sltGradientMode, undefined);
    assert.equal(el.querySelectorAll(':scope > .slt-sync-word').length, 2);
    assert.equal(el.querySelector(':scope > .slt-quality-indicator'), badge);
});

test('a wrapped translation without a badge still falls back cleanly', () => {
    const el = new FakeElement('slt-interleaved-translation');
    [['One ', 0], ['two', 40]].forEach(([text, top]) => {
        const span = new FakeElement('slt-sync-word', top as number);
        span.ownText = text as string;
        el.appendChild(span);
    });

    fallbackToContinuousMultilineGradient(el as any, 'One two', lineSyncedLine as any);

    assert.equal(el.textContent, 'One two');
    assert.equal(el.children.length, 0);
});
