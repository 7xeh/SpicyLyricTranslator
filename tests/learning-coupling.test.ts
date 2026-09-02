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

const notifications: string[] = [];
(globalThis as any).Spicetify = {
    showNotification: (message: string) => {
        notifications.push(message);
    }
};

const { writeSettingValue, getSettingField } = require('../src/utils/settingsModel') as typeof import('../src/utils/settingsModel');
const { state } = require('../src/utils/state') as typeof import('../src/utils/state');

function reset(mode: 'replace' | 'interleaved' | 'none', learning: boolean): void {
    notifications.length = 0;
    state.showNotifications = true;
    state.overlayMode = mode;
    state.learningMode = learning;
    storageMap.set('spicy-lyric-translator:overlay-mode', mode);
    storageMap.set('spicy-lyric-translator:learning-mode', String(learning));
}

function apply(id: string, value: string | boolean): string[] {
    const field = getSettingField(id);
    assert.ok(field, `missing setting ${id}`);
    return writeSettingValue(field!, value);
}

test('choosing display None turns Learning Mode on', () => {
    reset('replace', false);

    const effects = apply('overlay-mode', 'none');

    assert.equal(state.overlayMode, 'none');
    assert.equal(state.learningMode, true);
    assert.ok(effects.includes('learningModeClass'));
    assert.equal(notifications.length, 1);
});

test('choosing display None leaves Learning Mode alone when already on', () => {
    reset('replace', true);

    apply('overlay-mode', 'none');

    assert.equal(state.overlayMode, 'none');
    assert.equal(state.learningMode, true);
    assert.equal(notifications.length, 0);
});

test('turning Learning Mode off while display is None reverts the display', () => {
    reset('none', true);

    const effects = apply('learning-mode', false);

    assert.equal(state.learningMode, false);
    assert.equal(state.overlayMode, 'replace');
    assert.ok(effects.includes('reapplyTranslations'));
    assert.equal(notifications.length, 1);
});

test('turning Learning Mode off leaves other display modes untouched', () => {
    reset('interleaved', true);

    apply('learning-mode', false);

    assert.equal(state.learningMode, false);
    assert.equal(state.overlayMode, 'interleaved');
    assert.equal(notifications.length, 0);
});

test('turning Learning Mode on never changes the display mode', () => {
    for (const mode of ['replace', 'interleaved'] as const) {
        reset(mode, false);
        apply('learning-mode', true);
        assert.equal(state.overlayMode, mode);
        assert.equal(state.learningMode, true);
    }
});

test('the blank combination of display None with Learning off is unreachable', () => {
    reset('replace', false);
    apply('overlay-mode', 'none');
    assert.equal(state.overlayMode === 'none' && !state.learningMode, false);

    reset('none', true);
    apply('learning-mode', false);
    assert.equal(state.overlayMode === 'none' && !state.learningMode, false);
});

test('switching away from None does not disturb Learning Mode', () => {
    reset('none', true);

    apply('overlay-mode', 'interleaved');

    assert.equal(state.overlayMode, 'interleaved');
    assert.equal(state.learningMode, true);
});
