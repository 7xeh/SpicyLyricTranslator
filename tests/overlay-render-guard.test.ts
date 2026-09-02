import test from 'node:test';
import assert from 'node:assert/strict';
import {
    renderSignatureUnchanged,
    markRenderComplete,
    forgetRenderState
} from '../src/utils/translationOverlay';

type FakeLine = { textContent: string; isConnected: boolean; querySelectorAll: () => never[] };
type FakeDoc = { renderedOutput: number; querySelectorAll: () => { length: number } };

function makeLines(texts: string[]): FakeLine[] {
    return texts.map(textContent => ({
        textContent,
        isConnected: true,
        querySelectorAll: () => []
    }));
}

function makeDoc(): FakeDoc {
    const doc: FakeDoc = {
        renderedOutput: 0,
        querySelectorAll: () => ({ length: doc.renderedOutput })
    };
    return doc;
}

const LYRICS = [
    'Kom igen nu, du vet vad',
    'Om du tvekar pa mig ar det en sak',
    'Vi gor vara misstag'
];

function render(doc: FakeDoc, lines: FakeLine[], output: number): boolean {
    const skipped = renderSignatureUnchanged(doc as any, lines as any, LYRICS);
    if (!skipped) {
        doc.renderedOutput = output;
        markRenderComplete(doc as any);
    }
    return skipped;
}

test('an unchanged, intact render is skipped', () => {
    const doc = makeDoc();
    const lines = makeLines(LYRICS);

    assert.equal(render(doc, lines, 3), false);
    assert.equal(renderSignatureUnchanged(doc as any, lines as any, LYRICS), true);

    forgetRenderState(doc as any);
});

test('rebuilt lyric nodes with identical text force a re-render', () => {
    const doc = makeDoc();
    const original = makeLines(LYRICS);

    render(doc, original, 3);
    assert.equal(renderSignatureUnchanged(doc as any, original as any, LYRICS), true);

    original.forEach(line => { line.isConnected = false; });
    const rebuilt = makeLines(LYRICS);
    doc.renderedOutput = 0;

    assert.equal(renderSignatureUnchanged(doc as any, rebuilt as any, LYRICS), false);

    forgetRenderState(doc as any);
});

test('losing injected translation rows forces a re-render on the same nodes', () => {
    const doc = makeDoc();
    const lines = makeLines(LYRICS);

    render(doc, lines, 3);
    assert.equal(renderSignatureUnchanged(doc as any, lines as any, LYRICS), true);

    doc.renderedOutput = 0;

    assert.equal(renderSignatureUnchanged(doc as any, lines as any, LYRICS), false);

    forgetRenderState(doc as any);
});

test('a recovered render settles back into being skipped', () => {
    const doc = makeDoc();
    const lines = makeLines(LYRICS);

    render(doc, lines, 3);
    doc.renderedOutput = 0;

    assert.equal(render(doc, lines, 3), false);
    assert.equal(renderSignatureUnchanged(doc as any, lines as any, LYRICS), true);

    forgetRenderState(doc as any);
});

test('forgetRenderState makes the next call render again', () => {
    const doc = makeDoc();
    const lines = makeLines(LYRICS);

    render(doc, lines, 3);
    assert.equal(renderSignatureUnchanged(doc as any, lines as any, LYRICS), true);

    forgetRenderState(doc as any);

    assert.equal(renderSignatureUnchanged(doc as any, lines as any, LYRICS), false);
});
