import test from 'node:test';
import assert from 'node:assert/strict';
import { hotkeyFromEvent, normalizeHotkey, matchesHotkey, describeHotkey } from '../src/utils/hotkeys';

function keyEvent(code: string, modifiers: Partial<Record<'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey', boolean>> = {}): KeyboardEvent {
    return { code, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...modifiers } as KeyboardEvent;
}

test('hotkeyFromEvent orders modifiers and uses the physical key', () => {
    assert.equal(hotkeyFromEvent(keyEvent('KeyL', { altKey: true, ctrlKey: true })), 'Ctrl+Alt+L');
    assert.equal(hotkeyFromEvent(keyEvent('Digit3', { shiftKey: true, altKey: true })), 'Alt+Shift+3');
    assert.equal(hotkeyFromEvent(keyEvent('F7')), 'F7');
});

test('hotkeyFromEvent rejects bare keys, shift-only letters and lone modifiers', () => {
    assert.equal(hotkeyFromEvent(keyEvent('KeyT')), null);
    assert.equal(hotkeyFromEvent(keyEvent('KeyT', { shiftKey: true })), null);
    assert.equal(hotkeyFromEvent(keyEvent('AltLeft', { altKey: true })), null);
});

test('normalizeHotkey canonicalises aliases and casing', () => {
    assert.equal(normalizeHotkey('shift+alt+t'), 'Alt+Shift+T');
    assert.equal(normalizeHotkey('Cmd+Option+b'), 'Alt+Meta+B');
    assert.equal(normalizeHotkey(''), '');
});

test('matchesHotkey compares the pressed combo against the stored one', () => {
    assert.equal(matchesHotkey(keyEvent('KeyT', { altKey: true }), 'Alt+T'), true);
    assert.equal(matchesHotkey(keyEvent('KeyT', { altKey: true, shiftKey: true }), 'Alt+T'), false);
    assert.equal(matchesHotkey(keyEvent('KeyT', { altKey: true }), ''), false);
});

test('describeHotkey shows Off for a cleared shortcut', () => {
    assert.equal(describeHotkey(''), 'Off');
    assert.equal(describeHotkey('alt+l'), 'Alt+L');
});
