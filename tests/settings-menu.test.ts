import test from 'node:test';
import assert from 'node:assert/strict';

type RegisteredMenuItem = {
    label: string;
    callback: () => unknown | Promise<unknown>;
    icon?: string;
};

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

(globalThis as any).document = {
    body: {},
    querySelector: () => null,
    getElementById: () => null
};

(globalThis as any).window = {
    location: {
        pathname: '/',
        href: 'https://xpui.app.spotify.com/'
    }
};

(globalThis as any).MutationObserver = class {
    constructor(_callback: MutationCallback) {}
    observe(): void {}
    disconnect(): void {}
};

function installSpicetifyMock(registered: RegisteredMenuItem[], notifications: string[] = []): void {
    (globalThis as any).Spicetify = {
        Platform: {
            History: {
                location: { pathname: '/' },
                listen: () => {}
            }
        },
        Menu: {
            Item: class {
                constructor(
                    private readonly label: string,
                    _isEnabled: boolean,
                    private readonly callback: () => unknown | Promise<unknown>,
                    private readonly icon?: string
                ) {}

                register(): void {
                    registered.push({
                        label: this.label,
                        callback: this.callback,
                        icon: this.icon
                    });
                }
            }
        },
        showNotification: (message: string) => {
            notifications.push(message);
        }
    };
}

function getMenuItem(registered: RegisteredMenuItem[], label: string): RegisteredMenuItem {
    const item = registered.find(entry => entry.label === label);
    assert.ok(item, `Missing menu item: ${label}`);
    return item;
}

test('settings menu registers a single SLT Settings entry with an icon', async () => {
    storageMap.clear();
    const registered: RegisteredMenuItem[] = [];
    installSpicetifyMock(registered);

    const { registerSettings } = require('../src/utils/settings') as { registerSettings: () => Promise<void> };
    await registerSettings();

    assert.deepEqual(registered.map(item => item.label), ['SLT Settings']);

    const settingsItem = getMenuItem(registered, 'SLT Settings');
    assert.ok(settingsItem.icon, 'SLT Settings menu item should have an icon');
    assert.match(settingsItem.icon!, /^<svg/);
});

test('settings modal exposes cache repair actions for the translate button right-click flow', async () => {
    storageMap.clear();
    const notifications: string[] = [];
    installSpicetifyMock([], notifications);

    const deletedCacheNames: string[] = [];
    (globalThis as any).caches = {
        delete: async (cacheName: string) => {
            deletedCacheNames.push(cacheName);
            return true;
        }
    };

    const settings = require('../src/utils/settings') as {
        renderModalCacheActionsMarkup: () => string;
        bindModalCacheActions: (container: ParentNode) => void;
    };

    const markup = settings.renderModalCacheActionsMarkup();
    assert.match(markup, /id="slt-clear-spicy-lyrics-cache"/);
    assert.match(markup, /Clear Spicy Lyrics Cache/);
    assert.match(markup, /id="slt-clear-translation-cache"/);
    assert.match(markup, /Clear All Cached Translations/);

    const handlers = new Map<string, EventListenerOrEventListenerObject>();
    const fakeContainer = {
        querySelector: (selector: string) => {
            if (selector !== '#slt-clear-spicy-lyrics-cache' && selector !== '#slt-clear-translation-cache') {
                return null;
            }
            return {
                addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
                    handlers.set(selector, listener);
                }
            };
        }
    } as unknown as ParentNode;

    settings.bindModalCacheActions(fakeContainer);

    storageMap.set('spicy-lyric-translator:translation-cache', '{"vi:hello":{"translation":"xin chao","timestamp":1}}');
    storageMap.set('slt-track-cache:spotify:track:def:vi', '{"lines":["xin chao"],"timestamp":1}');
    storageMap.set('slt-track-cache-index', '{"trackUris":["spotify:track:def:vi"]}');

    const clearTranslations = handlers.get('#slt-clear-translation-cache') as EventListener;
    clearTranslations(new Event('click'));

    assert.equal(storageMap.has('spicy-lyric-translator:translation-cache'), false);
    assert.equal(storageMap.has('slt-track-cache:spotify:track:def:vi'), false);
    assert.equal(storageMap.has('slt-track-cache-index'), false);

    const clearSpicyLyrics = handlers.get('#slt-clear-spicy-lyrics-cache') as EventListener;
    await clearSpicyLyrics(new Event('click'));

    assert.deepEqual([...deletedCacheNames].sort(), ['SpicyLyrics_LyricsStore', 'SpicyLyrics_LyricsStore_g1']);
    assert.deepEqual(notifications, [
        'All cached translations deleted!',
        'Spicy Lyrics cached lyrics deleted!'
    ]);
});
