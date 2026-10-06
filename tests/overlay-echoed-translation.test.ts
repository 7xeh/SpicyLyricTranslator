import test from 'node:test';
import assert from 'node:assert/strict';
import { isEchoedTranslation } from '../src/utils/translationOverlay';

test('syllable-split echoes of the original line are not rendered as translations', () => {
    assert.equal(isEchoedTranslation('When e very night your loved one holds you tight', 'When every night your loved one holds you tight'), true);
    assert.equal(isEchoedTranslation('Oh- la- la- la', 'Oh-la-la-la'), true);
    assert.equal(isEchoedTranslation("C'est ma gni fi que", "C'est magnifique"), true);
    assert.equal(isEchoedTranslation('But when one day your loved one drifts a way', 'But when one day your loved one drifts away'), true);
});

test('real translations still render', () => {
    assert.equal(isEchoedTranslation("It's beautiful", "C'est magnifique"), false);
    assert.equal(isEchoedTranslation('Je t\u2019adore', 'I adore you'), false);
});

test('missing text is never treated as an echo', () => {
    assert.equal(isEchoedTranslation(undefined, 'Oh-la-la-la'), false);
    assert.equal(isEchoedTranslation('Oh-la-la-la', ''), false);
});
