import { el, text, openDialog, openSurfaces, prefersReducedMotion, paintTone, CLOSE_SVG, SurfaceHandle, Tone } from './surface';
import { toast, getInbox, markInboxRead, clearInbox, onInboxChange, unreadCount, runInboxAction, InboxEntry } from './toast';
import { state, parseLanguageList } from './state';
import { storage } from './storage';
import { Icons } from './icons';
import { SUPPORTED_LANGUAGES } from './translator';
import {
    SETTINGS_SCHEMA,
    SETTINGS_CATEGORIES,
    API_OPTIONS,
    SettingsField,
    SettingsCategory,
    getCategoryForSection,
    getCurrentApiPreference,
    getSectionsForCategory,
    getSettingField,
    isSettingAtDefault,
    isSettingFieldVisible,
    matchesSettingQuery,
    readSettingValue
} from './settingsModel';
import { VERSION, REPO_URL, getDisplayHash, runManualUpdateCheck, showCurrentChangelog, hasWaitingUpdate, openWaitingUpdate } from './updater';
import { getConnectionState } from './connectivity';
import { getTrackCacheStats } from './trackCache';
import { handleTranslateToggle, forceRetranslate } from './core';
import {
    applySettingsBatch,
    syncModelLists,
    clearAllCachedTranslations,
    clearSpicyLyricsCachedLyrics,
    openCacheViewer,
    openSpicyLyricsCacheViewer
} from './settings';

export type TabId = 'settings' | 'cache' | 'about';

const TAB_META: Record<TabId, { label: string; description: string }> = {
    settings: { label: 'Settings', description: 'How and when your lyrics get translated.' },
    cache: { label: 'Cache', description: 'Translations and lyrics saved on this device.' },
    about: { label: 'About', description: 'Version, updates, connection and shortcuts.' },
};

const SEARCH_SVG = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
const EYE_SVG = '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" fill="currentColor"/></svg>';
const BELL_SVG = '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M4 11V7a4 4 0 118 0v4l1.2 1.5H2.8zM6.5 13.5a1.6 1.6 0 003 0" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></svg>';
const DIFF_SVG = '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M5 2.5v7M1.5 6h7M9 11.5h5.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
const RESET_SVG = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 8a5.5 5.5 0 1 0 1.7-4"></path><path d="M2 2.5V6h3.5"></path></svg>';
const REVEAL_SVG = EYE_SVG;

interface FieldHandle {
    field: SettingsField;
    row: HTMLElement;
    sync: () => void;
}

let liveContainer: HTMLElement | null = null;
let activeTabId: TabId = 'settings';
let activeCategoryId = SETTINGS_CATEGORIES[0].id;
let goToLive: ((tab: TabId, category?: string) => void) | null = null;
let rerenderLive: (() => void) | null = null;
let syncChrome: (() => void)[] = [];
let fieldHandles: FieldHandle[] = [];
let teardownLive: (() => void) | null = null;

function refreshChrome(): void {
    syncChrome.forEach(fn => fn());
}

function languageName(code: string): string {
    return SUPPORTED_LANGUAGES.find(l => l.code === code)?.name || code.toUpperCase();
}

function providerName(api: string): string {
    return API_OPTIONS.find(o => o.value === api)?.text || api;
}

function whereLabel(field: SettingsField): string {
    const category = getCategoryForSection(field.section);
    if (!category || category.label === field.section) return field.section;
    return `${category.label} · ${field.section}`;
}

function describeValue(field: SettingsField, value: string | boolean): string {
    if (field.type === 'toggle') return value ? 'On' : 'Off';
    if (field.type === 'select') {
        const option = (field.options || []).find(o => o.value === String(value));
        return option ? option.text : String(value || '—');
    }
    if (field.type === 'languages') {
        const names = parseLanguageList(String(value)).map(languageName);
        return names.length ? names.join(', ') : 'None';
    }
    if (field.secret) return value ? '••••••••' : 'Not set';
    const str = String(value ?? '');
    return str ? (str.length > 32 ? `${str.slice(0, 31)}…` : str) : '—';
}

function snapshotSettings(fields: SettingsField[] = SETTINGS_SCHEMA): () => void {
    const saved = fields.map(field => ({ field, value: readSettingValue(field) }));
    return () => {
        const changes = saved.filter(({ field, value }) => readSettingValue(field) !== value);
        if (changes.length) applySettingsBatch(changes);
        refreshAll();
    };
}

function offerUndo(title: string, description: string | undefined, restore: () => void): void {
    toast({
        kind: 'success',
        key: 'slt-undo',
        title,
        description,
        duration: 8000,
        undo: () => {
            restore();
            toast({ kind: 'info', key: 'slt-undo', title: 'Undone', description: 'Everything is back the way it was.' });
        },
    });
}

function changeWithUndo(field: SettingsField, value: string | boolean, title: string, description?: string): void {
    const restore = snapshotSettings([field]);
    applySettingsBatch([{ field, value }]);
    refreshAll();
    offerUndo(title, description, restore);
}

function refreshAll(): void {
    if (!liveContainer) return;
    fieldHandles.forEach(handle => handle.sync());
    applyFilter();
    refreshChrome();
}

function buildField(field: SettingsField): FieldHandle {
    const id = `slt-${field.id}`;
    const row = el('div', { class: `slt-m-field slt-m-field-${field.type}`, 'data-slt-setting-field': field.id });

    const label = el('label', { class: 'slt-m-field-label', for: id, text: field.label });
    if (field.effects?.includes('retranslate')) {
        label.append(el('span', { class: 'slt-m-badge', text: 'Retranslates', title: 'Changing this translates the current song again' }));
    }
    const labelBox = el('div', { class: 'slt-m-field-labelbox' }, label,
        field.description ? el('div', { class: 'slt-m-field-hint', text: field.description }) : null,
    );

    const control = el('div', { class: 'slt-m-field-control' });
    let input: HTMLInputElement | HTMLSelectElement;
    let syncLanguages: ((value: string) => void) | null = null;

    if (field.type === 'toggle') {
        input = el('input', { type: 'checkbox', id });
        control.append(el('label', { class: 'slt-m-toggle' }, input, el('span', { class: 'slt-m-toggle-slider' })));
    } else if (field.type === 'select') {
        const select = el('select', { class: 'slt-m-select', id });
        (field.options || []).forEach(option => select.append(el('option', { value: option.value, text: option.text })));
        input = select;
        control.append(select);
    } else if (field.type === 'languages') {
        const chips = el('div', { class: 'slt-m-langs' });
        const add = el('select', { class: 'slt-m-select', id });
        input = add;
        syncLanguages = (value: string) => {
            const selected = parseLanguageList(value);
            chips.replaceChildren(...selected.map(code => {
                const remove = el('button', { type: 'button', class: 'slt-m-lang-remove', title: 'Remove', 'aria-label': `Remove ${languageName(code)}`, html: CLOSE_SVG });
                remove.addEventListener('click', () => {
                    applySettingsBatch([{ field, value: selected.filter(c => c !== code).join(',') }]);
                    refreshAll();
                });
                return el('span', { class: 'slt-m-lang' }, languageName(code), remove);
            }));
            add.replaceChildren(
                el('option', { value: '', text: field.placeholder || 'Add…' }),
                ...(field.options || []).filter(option => !selected.includes(option.value)).map(option => el('option', { value: option.value, text: option.text }))
            );
            add.value = '';
        };
        control.append(el('div', { class: 'slt-m-langs-box' }, chips, add));
    } else {
        input = el('input', {
            class: 'slt-m-text',
            id,
            type: field.type === 'password' ? 'password' : 'text',
            placeholder: field.placeholder || '',
            autocomplete: 'off',
            spellcheck: 'false',
            'data-form-type': 'other',
        });
        control.append(input);
        if (field.type === 'password') {
            const reveal = el('button', { class: 'slt-m-reveal', type: 'button', title: 'Show or hide', 'aria-label': `Show ${field.label}`, html: REVEAL_SVG });
            reveal.addEventListener('click', () => {
                const text = input as HTMLInputElement;
                text.type = text.type === 'password' ? 'text' : 'password';
                reveal.classList.toggle('on', text.type === 'text');
            });
            control.append(reveal);
        }
    }

    const reset = el('button', { class: 'slt-m-field-reset', type: 'button', title: 'Reset to default', 'aria-label': `Reset ${field.label} to default`, html: RESET_SVG });
    control.append(reset);
    row.append(labelBox, control);

    const sync = () => {
        const value = readSettingValue(field);
        if (syncLanguages) {
            syncLanguages(String(value));
        } else if (field.type === 'toggle') {
            (input as HTMLInputElement).checked = value === true;
        } else if (document.activeElement !== input || field.type === 'select') {
            input.value = String(value);
        }
        reset.classList.toggle('slt-m-field-reset-on', !isSettingAtDefault(field));
    };

    input.addEventListener('change', () => {
        if (field.type === 'languages' && !input.value) return;
        const value = field.type === 'toggle'
            ? (input as HTMLInputElement).checked
            : field.type === 'languages'
                ? [...parseLanguageList(String(readSettingValue(field))), input.value].join(',')
                : input.value;
        applySettingsBatch([{ field, value }]);
        refreshAll();
    });

    reset.addEventListener('click', () => {
        changeWithUndo(field, field.defaultValue, `Reset “${field.label}”`, `Back to ${describeValue(field, field.defaultValue)}.`);
    });

    sync();
    return { field, row, sync };
}

function applyFilter(): void {
    if (!liveContainer) return;
    const searchEl = liveContainer.querySelector<HTMLInputElement>('.slt-m-cz-search');
    const q = (searchEl?.value || '').trim().toLowerCase();
    const searching = q.length > 0;
    const api = getCurrentApiPreference();

    let hits = 0;
    fieldHandles.forEach(({ field, row }) => {
        const show = isSettingFieldVisible(field, api) && matchesSettingQuery(field, q);
        row.style.display = show ? '' : 'none';
        if (show && searching) hits++;
    });

    liveContainer.querySelectorAll<HTMLElement>('.slt-m-cz-sections .slt-m-section').forEach(section => {
        const any = Array.from(section.querySelectorAll<HTMLElement>('.slt-m-field')).some(f => f.style.display !== 'none');
        section.style.display = any ? '' : 'none';
    });

    liveContainer.querySelectorAll<HTMLElement>('.slt-m-cz-category').forEach(category => {
        const any = Array.from(category.querySelectorAll<HTMLElement>('.slt-m-section')).some(s => s.style.display !== 'none');
        category.style.display = (searching ? any : category.id === activeCategoryId && any) ? '' : 'none';
    });

    liveContainer.classList.toggle('slt-m-searching', searching);

    const status = liveContainer.querySelector<HTMLElement>('.slt-m-cz-status');
    if (status) {
        status.style.display = searching ? '' : 'none';
        status.textContent = hits === 0 ? `No settings match “${q}”.` : `${hits} setting${hits === 1 ? '' : 's'} match “${q}”.`;
        status.classList.toggle('slt-m-cz-status-empty', hits === 0);
    }

    const clear = liveContainer.querySelector<HTMLElement>('.slt-m-cz-clear');
    if (clear) clear.style.display = searching ? '' : 'none';
}

function buildSettingsTab(): HTMLElement {
    const tab = el('div', { class: 'slt-m-tab-content slt-m-cz' });

    const search = el('input', {
        type: 'text',
        class: 'slt-m-cz-search',
        placeholder: 'Filter settings…',
        spellcheck: 'false',
        'aria-label': 'Filter settings',
        'data-slt-esc-local': true,
    });
    const clear = el('button', { type: 'button', class: 'slt-m-cz-clear', text: 'Clear', 'aria-label': 'Clear filter' });
    clear.style.display = 'none';
    search.addEventListener('input', () => { applyFilter(); refreshChrome(); });
    search.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && search.value) {
            e.stopPropagation();
            search.value = '';
            applyFilter();
            refreshChrome();
        }
    });
    clear.addEventListener('click', () => {
        search.value = '';
        applyFilter();
        refreshChrome();
        search.focus();
    });

    const toolbar = el('div', { class: 'slt-m-cz-toolbar' },
        el('span', { class: 'slt-m-cz-search-icon', 'aria-hidden': 'true', html: SEARCH_SVG }),
        search,
        clear,
    );
    const status = el('div', { class: 'slt-m-cz-status', role: 'status' });
    status.style.display = 'none';
    const sections = el('div', { class: 'slt-m-cz-sections' });

    fieldHandles = [];
    SETTINGS_CATEGORIES.forEach(category => {
        const categoryEl = el('div', { class: 'slt-m-cz-category', id: category.id },
            el('div', { class: 'slt-m-cz-cat-head' },
                el('div', { class: 'slt-m-cz-cat-title', text: category.label }),
                el('div', { class: 'slt-m-cz-cat-desc', text: category.description }),
            ),
        );
        getSectionsForCategory(category).forEach(sectionName => {
            const section = el('div', { class: 'slt-m-section', 'data-section': sectionName },
                el('div', { class: 'slt-m-section-title', text: sectionName }),
            );
            SETTINGS_SCHEMA.filter(field => field.section === sectionName).forEach(field => {
                const handle = buildField(field);
                fieldHandles.push(handle);
                section.append(handle.row);
            });
            categoryEl.append(section);
        });
        sections.append(categoryEl);
    });

    tab.append(toolbar, status, sections);
    return tab;
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function relativeTime(at: number): string {
    const s = Math.max(0, Math.round((Date.now() - at) / 1000));
    if (s < 60) return 'just now';
    const m = Math.round(s / 60);
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} h ago`;
    const d = Math.round(h / 24);
    return `${d} day${d === 1 ? '' : 's'} ago`;
}

function armedButton(label: string, armedLabel: string, run: () => void | Promise<void>): HTMLButtonElement {
    const btn = el('button', { class: 'slt-m-btn slt-m-btn-danger', type: 'button', text: label });
    let timer: number | null = null;
    const disarm = () => {
        if (timer !== null) window.clearTimeout(timer);
        timer = null;
        btn.classList.remove('slt-m-btn-armed');
        btn.textContent = label;
    };
    btn.addEventListener('click', async () => {
        if (!btn.classList.contains('slt-m-btn-armed')) {
            btn.classList.add('slt-m-btn-armed');
            btn.textContent = armedLabel;
            timer = window.setTimeout(disarm, 3500);
            return;
        }
        disarm();
        btn.disabled = true;
        try {
            await run();
        } finally {
            btn.disabled = false;
        }
    });
    btn.addEventListener('blur', disarm);
    return btn;
}

function stat(label: string, value: string): HTMLElement {
    return el('div', { class: 'slt-m-stat' },
        el('div', { class: 'slt-m-stat-value', text: value }),
        el('div', { class: 'slt-m-stat-label', text: label }),
    );
}

function buildCacheTab(): HTMLElement {
    const tab = el('div', { class: 'slt-m-tab-content' });
    const stats = getTrackCacheStats();
    const usage = storage.getStats();

    const viewTranslations = el('button', { class: 'slt-m-btn', type: 'button', text: 'Browse translations' });
    viewTranslations.addEventListener('click', () => openCacheViewer());
    const translations = el('div', { class: 'slt-m-section' },
        el('div', { class: 'slt-m-section-title', text: 'Translations' }),
        el('div', { class: 'slt-m-about-text', text: 'Songs you’ve translated are saved here, so they load instantly and work offline.' }),
        el('div', { class: 'slt-m-stats' },
            stat('Songs', stats.trackCount.toLocaleString()),
            stat('Lines', stats.totalLines.toLocaleString()),
            stat('Size', formatBytes(stats.sizeBytes)),
            stat('Oldest', stats.oldestTimestamp ? relativeTime(stats.oldestTimestamp) : '—'),
        ),
        el('div', { class: 'slt-m-about-actions' },
            viewTranslations,
            armedButton('Delete all translations', 'Click again to delete', () => {
                clearAllCachedTranslations();
                rerenderLive?.();
            }),
        ),
    );

    const viewLyrics = el('button', { class: 'slt-m-btn', type: 'button', text: 'Browse lyrics' });
    viewLyrics.addEventListener('click', () => { openSpicyLyricsCacheViewer(); });
    const lyrics = el('div', { class: 'slt-m-section' },
        el('div', { class: 'slt-m-section-title', text: 'Spicy Lyrics lyrics' }),
        el('div', { class: 'slt-m-about-text', text: 'Lyrics Spicy Lyrics downloaded. Clearing makes it fetch fresh copies, which can fix out-of-sync or wrong lyrics.' }),
        el('div', { class: 'slt-m-about-actions' },
            viewLyrics,
            armedButton('Clear lyrics cache', 'Click again to clear', async () => {
                await clearSpicyLyricsCachedLyrics();
                rerenderLive?.();
            }),
        ),
    );

    const fill = el('i');
    fill.style.width = `${Math.min(100, Math.max(1, usage.percentUsed))}%`;
    const storageSection = el('div', { class: 'slt-m-section' },
        el('div', { class: 'slt-m-section-title', text: 'Storage' }),
        el('div', { class: 'slt-m-meter', role: 'meter', 'aria-valuenow': String(usage.percentUsed), 'aria-valuemin': '0', 'aria-valuemax': '100' }, fill),
        el('div', { class: 'slt-m-about-text', text: `${formatBytes(usage.usedBytes)} of ${formatBytes(usage.maxBytes)} used (${usage.percentUsed}%). The oldest translations are cleared automatically when it fills up.` }),
    );

    tab.append(translations, lyrics, storageSection);
    return tab;
}

function connectionLabel(value: string): string {
    switch (value) {
        case 'connected': return 'Connected';
        case 'connecting': return 'Connecting…';
        case 'reconnecting': return 'Reconnecting…';
        case 'error': return 'Connection error';
        default: return 'Disconnected';
    }
}

function latencyClass(latencyMs: number | null): string {
    if (latencyMs === null) return '';
    if (latencyMs <= 150) return 'great';
    if (latencyMs <= 300) return 'ok';
    if (latencyMs <= 500) return 'bad';
    return 'horrible';
}

function buildConnectionCard(): HTMLElement {
    const dot = el('span', { class: 'slt-m-conn-dot' });
    const stateEl = el('span', { class: 'slt-m-conn-state' });
    const ping = el('span', { class: 'slt-m-stat-value' });
    const users = el('span', { class: 'slt-m-stat-value' });
    const card = el('div', { class: 'slt-m-section' },
        el('div', { class: 'slt-m-conn-head' },
            el('div', { class: 'slt-m-section-title', text: 'Connection' }),
            el('span', { class: 'slt-m-conn-status' }, dot, stateEl),
        ),
        el('div', { class: 'slt-m-stats' },
            el('div', { class: 'slt-m-stat' }, ping, el('div', { class: 'slt-m-stat-label', text: 'Ping' })),
            el('div', { class: 'slt-m-stat' }, users, el('div', { class: 'slt-m-stat-label', text: 'Users installed' })),
        ),
    );
    const update = () => {
        const conn = getConnectionState();
        const latency = conn.state === 'connected' ? latencyClass(conn.latencyMs) : '';
        dot.className = `slt-m-conn-dot slt-m-conn-${conn.state}${latency ? ` slt-m-lat-${latency}` : ''}`;
        stateEl.textContent = connectionLabel(conn.state);
        ping.textContent = conn.latencyMs !== null ? `${conn.latencyMs} ms` : '—';
        ping.className = `slt-m-stat-value${latency ? ` slt-m-lat-${latency}` : ''}`;
        users.textContent = conn.totalUsers > 0 ? conn.totalUsers.toLocaleString() : '—';
    };
    update();
    const interval = window.setInterval(() => {
        if (!card.isConnected) {
            window.clearInterval(interval);
            return;
        }
        update();
    }, 2000);
    return card;
}

function buildAboutTab(): HTMLElement {
    const tab = el('div', { class: 'slt-m-tab-content' });
    const { hash, source } = getDisplayHash();
    const shortHash = hash ? hash.substring(0, 8) : '';
    const hashTitle = source === 'delivered'
        ? `SHA-256 of the loaded script — ${hash}`
        : `Build hash — ${hash}`;

    const hero = el('div', { class: 'slt-m-section' },
        el('div', { class: 'slt-m-about-hero' },
            el('div', { class: 'slt-m-about-title', text: 'Spicy Lyric Translator' }),
            el('div', { class: 'slt-m-about-version', text: `v${VERSION}` }),
            shortHash ? el('div', { class: 'slt-m-about-hash', text: shortHash, title: hashTitle }) : null,
        ),
        el('div', { class: 'slt-m-about-text', text: 'Translates Spicy Lyrics as the song plays, with romanization, a word-by-word learning mode, and caching so songs you’ve already heard load instantly.' }),
    );

    const check = el('button', { class: 'slt-m-btn slt-m-btn-primary', type: 'button', text: 'Check for updates' });
    check.addEventListener('click', () => { runManualUpdateCheck(check); });
    const changelog = el('button', { class: 'slt-m-btn', type: 'button', text: 'What’s new' });
    changelog.addEventListener('click', async () => {
        if (changelog.disabled) return;
        changelog.disabled = true;
        changelog.textContent = 'Loading…';
        try {
            await showCurrentChangelog({ expanded: true });
        } catch {
            toast({ kind: 'error', title: "Couldn't load the changelog" });
        } finally {
            changelog.disabled = false;
            changelog.textContent = 'What’s new';
        }
    });
    const updates = el('div', { class: 'slt-m-section' },
        el('div', { class: 'slt-m-section-title', text: 'Updates' }),
        el('div', { class: 'slt-m-about-actions' }, check, changelog),
    );

    const shortcut = (keys: string[], label: string) => el('div', { class: 'slt-m-shortcut' },
        el('span', { class: 'slt-m-shortcut-keys' }, ...keys.map(k => el('kbd', { text: k }))),
        el('span', { text: label }),
    );
    const shortcuts = el('div', { class: 'slt-m-section' },
        el('div', { class: 'slt-m-section-title', text: 'Shortcuts' }),
        shortcut(['Alt', 'T'], 'Turn translation on or off'),
        shortcut(['Ctrl', 'K'], 'Search settings, languages and actions'),
        shortcut(['Hold P'], 'Peek at the lyrics behind this window'),
        shortcut(['Esc'], 'Close the top window'),
    );

    const links = el('div', { class: 'slt-m-section' },
        el('div', { class: 'slt-m-about-links' },
            el('a', { href: REPO_URL.replace(/\/releases$/, ''), target: '_blank', rel: 'noopener noreferrer', text: 'GitHub' }),
            el('a', { href: REPO_URL, target: '_blank', rel: 'noopener noreferrer', text: 'Releases' }),
        ),
    );

    tab.append(hero, updates, buildConnectionCard(), shortcuts, links);
    return tab;
}

function summaryParts(): string[] {
    const parts = [`${providerName(getCurrentApiPreference())} → ${languageName(storage.get('target-language') || 'en')}`];
    if (state.showRomanization) parts.push('Romanization');
    if (state.learningMode) parts.push('Learning');
    if (state.autoTranslate) parts.push('Auto');
    return parts;
}

function buildMasterBar(): HTMLElement {
    const input = el('input', { type: 'checkbox', 'aria-label': 'Turn translation on or off' });
    const title = el('div', { class: 'slt-m-enabled-title' });
    const sub = el('div', { class: 'slt-m-enabled-sub' });
    const bar = el('div', { class: 'slt-m-enabled-bar' },
        el('div', { class: 'slt-m-enabled-text' }, title, sub),
        el('label', { class: 'slt-m-toggle', title: 'Alt+T' }, input, el('span', { class: 'slt-m-toggle-slider' })),
    );

    const sync = () => {
        input.checked = state.isEnabled;
        bar.classList.toggle('slt-m-enabled-off', !state.isEnabled);
        title.textContent = state.isEnabled ? 'Translation on' : 'Translation off';
        const parts = summaryParts();
        sub.textContent = state.isEnabled ? parts[0] : 'Lyrics stay in their original language';
        sub.title = parts.join(' · ');
    };

    input.addEventListener('change', async () => {
        if (input.checked !== state.isEnabled) await handleTranslateToggle();
        sync();
    });

    syncChrome.push(sync);
    sync();
    return bar;
}

function changedFields(): SettingsField[] {
    return SETTINGS_SCHEMA.filter(field => !field.secret && !isSettingAtDefault(field));
}

function openReviewChanges(): void {
    const list = el('div', { class: 'slt-m-rv-list' });
    const summary = el('p', { class: 'slt-ui-text' });
    let dialog: SurfaceHandle | null = null;

    const render = () => {
        const fields = changedFields();
        list.innerHTML = '';
        summary.textContent = fields.length
            ? `${fields.length} setting${fields.length === 1 ? ' differs' : 's differ'} from the defaults. API keys are left out.`
            : 'Everything is on its default. API keys are left out.';
        fields.forEach(field => {
            const row = el('div', { class: 'slt-m-rv-row' },
                el('div', { class: 'slt-m-rv-head' },
                    el('button', { class: 'slt-m-rv-label', type: 'button', text: field.label, title: 'Show this setting' }),
                    el('span', { class: 'slt-m-rv-where', text: whereLabel(field) }),
                ),
                el('div', { class: 'slt-m-rv-diff' },
                    el('span', { class: 'slt-m-rv-value', text: describeValue(field, field.defaultValue) }),
                    el('span', { class: 'slt-m-rv-arrow', 'aria-hidden': 'true' }),
                    el('span', { class: 'slt-m-rv-value', text: describeValue(field, readSettingValue(field)) }),
                ),
                el('button', { class: 'slt-m-rv-revert', type: 'button', text: 'Revert' }),
            );
            row.querySelector('.slt-m-rv-label')?.addEventListener('click', () => {
                dialog?.close();
                revealSetting(field.id);
            });
            row.querySelector('.slt-m-rv-revert')?.addEventListener('click', () => {
                changeWithUndo(field, field.defaultValue, `Reverted “${field.label}”`);
                render();
            });
            list.append(row);
        });
        list.hidden = fields.length === 0;
        const resetAll = dialog?.footer.querySelector('[data-action="reset-all"]') as HTMLButtonElement | null;
        if (resetAll) resetAll.disabled = fields.length === 0;
    };

    dialog = openDialog({
        eyebrow: 'Spicy Lyric Translator · Review',
        title: 'Your changes',
        size: 'lg',
        body: [summary, list],
        actions: [
            {
                id: 'reset-all',
                label: 'Reset all to defaults',
                kind: 'danger',
                keepOpen: true,
                onClick: () => {
                    const fields = changedFields();
                    const restore = snapshotSettings(fields);
                    applySettingsBatch(fields.map(field => ({ field, value: field.defaultValue })));
                    refreshAll();
                    offerUndo(`Reset ${fields.length} setting${fields.length === 1 ? '' : 's'}`, 'Your API keys were kept.', restore);
                    render();
                },
            },
            { label: 'Done', kind: 'primary' },
        ],
    });
    render();
}

interface PaletteItem {
    group: string;
    label: string;
    hint?: string;
    keywords?: string;
    run: () => void;
}

function paletteItems(close: () => void): PaletteItem[] {
    const items: PaletteItem[] = [];
    SETTINGS_CATEGORIES.forEach(category => {
        items.push({ group: 'Go to', label: `Settings › ${category.label}`, hint: category.description, run: () => { close(); goToLive?.('settings', category.id); } });
    });
    (['cache', 'about'] as TabId[]).forEach(tab => {
        items.push({ group: 'Go to', label: TAB_META[tab].label, hint: TAB_META[tab].description, run: () => { close(); goToLive?.(tab); } });
    });
    SETTINGS_SCHEMA.forEach(field => {
        items.push({
            group: 'Settings',
            label: field.label,
            hint: whereLabel(field),
            keywords: `${field.section} ${field.description || ''} ${field.keywords || ''}`,
            run: () => { close(); revealSetting(field.id); },
        });
    });
    const target = getSettingField('target-language');
    if (target) {
        SUPPORTED_LANGUAGES.forEach(language => {
            items.push({
                group: 'Languages',
                label: `Translate to ${language.name}`,
                hint: language.code.toUpperCase(),
                keywords: `language target ${language.code}`,
                run: () => { close(); changeWithUndo(target, language.code, `Translating to ${language.name}`); },
            });
        });
    }
    const provider = getSettingField('preferred-api');
    if (provider) {
        API_OPTIONS.forEach(option => {
            items.push({
                group: 'Providers',
                label: `Use ${option.text}`,
                keywords: `provider api service engine ${option.value}`,
                run: () => { close(); changeWithUndo(provider, option.value, `Switched to ${option.text}`, 'Add its key under Providers if it needs one.'); },
            });
        });
    }
    items.push(
        {
            group: 'Actions',
            label: state.isEnabled ? 'Turn translation off' : 'Turn translation on',
            keywords: 'enable disable toggle alt t',
            run: async () => { close(); await handleTranslateToggle(); refreshChrome(); },
        },
        { group: 'Actions', label: 'Translate this song again', keywords: 'retranslate refresh redo', run: () => { close(); forceRetranslate(); } },
        { group: 'Actions', label: 'Review changes', hint: 'Everything that differs from the defaults', run: () => { close(); openReviewChanges(); } },
        { group: 'Actions', label: 'Browse cached translations', keywords: 'cache history', run: () => { close(); openCacheViewer(); } },
        { group: 'Actions', label: 'Check for updates', keywords: 'version update', run: () => { close(); runManualUpdateCheck(null); } },
        { group: 'Actions', label: 'What’s new', keywords: 'changelog release notes', run: () => { close(); showCurrentChangelog({ expanded: true }).catch(() => toast({ kind: 'error', title: "Couldn't load the changelog" })); } },
        { group: 'Actions', label: 'Notifications', keywords: 'inbox bell history', run: () => { close(); openInbox(); } },
    );
    return items;
}

function scoreItem(item: PaletteItem, q: string): number {
    const label = item.label.toLowerCase();
    if (label.startsWith(q)) return 100 - label.length * 0.1;
    const words = label.split(/[\s›·“”()]+/);
    if (words.some(w => w.startsWith(q))) return 70 - label.length * 0.1;
    if (label.includes(q)) return 50;
    if (`${item.hint || ''} ${item.keywords || ''}`.toLowerCase().includes(q)) return 20;
    return -1;
}

const GROUP_LIMITS: Record<string, number> = { Settings: 7, Languages: 5, 'Go to': 4, Providers: 4, Actions: 4 };

function openPalette(): void {
    if (document.querySelector('.slt-m-pal')) return;
    let dialog: SurfaceHandle | null = null;
    const close = () => dialog?.close();
    const all = paletteItems(close);
    const input = el('input', {
        class: 'slt-m-pal-input',
        type: 'text',
        placeholder: 'Search settings, languages and actions…',
        spellcheck: 'false',
        'aria-label': 'Search Spicy Lyric Translator',
        'data-slt-autofocus': true,
        'data-slt-esc-local': true,
    });
    const results = el('div', { class: 'slt-m-pal-results', role: 'listbox' });
    const foot = el('div', { class: 'slt-m-pal-foot' },
        el('span', { html: '<kbd>↑</kbd><kbd>↓</kbd> move' }),
        el('span', { html: '<kbd>Enter</kbd> open' }),
        el('span', { html: '<kbd>Esc</kbd> close' }),
    );
    const box = el('div', { class: 'slt-m-pal' },
        el('div', { class: 'slt-m-pal-bar' }, el('span', { class: 'slt-m-pal-icon', html: SEARCH_SVG }), input),
        results,
        foot,
    );

    let shown: PaletteItem[] = [];
    let active = 0;

    const paint = () => {
        results.innerHTML = '';
        let lastGroup = '';
        shown.forEach((item, i) => {
            if (item.group !== lastGroup) {
                lastGroup = item.group;
                results.append(el('div', { class: 'slt-m-pal-group', text: item.group }));
            }
            const row = el('button', { class: `slt-m-pal-item${i === active ? ' active' : ''}`, type: 'button', role: 'option', 'aria-selected': String(i === active) },
                el('span', { class: 'slt-m-pal-label', text: item.label }),
                item.hint ? el('span', { class: 'slt-m-pal-hint', text: item.hint }) : null,
            );
            row.addEventListener('mousemove', () => {
                if (active === i) return;
                active = i;
                results.querySelectorAll('.slt-m-pal-item').forEach((n, j) => n.classList.toggle('active', j === i));
            });
            row.addEventListener('click', () => item.run());
            results.append(row);
        });
        if (!shown.length) results.append(el('div', { class: 'slt-m-pal-empty', text: input.value.trim() ? 'Nothing matches that.' : 'Start typing to search.' }));
        results.querySelector('.slt-m-pal-item.active')?.scrollIntoView({ block: 'nearest' });
    };

    const compute = () => {
        const q = input.value.trim().toLowerCase();
        if (!q) {
            shown = all.filter(i => i.group === 'Go to' || i.group === 'Actions').slice(0, 11);
        } else {
            const scored = all
                .map(item => ({ item, score: scoreItem(item, q) }))
                .filter(x => x.score >= 0)
                .sort((a, b) => b.score - a.score);
            const byGroup = new Map<string, PaletteItem[]>();
            scored.forEach(({ item }) => {
                const list = byGroup.get(item.group) || [];
                if (list.length < (GROUP_LIMITS[item.group] || 4)) list.push(item);
                byGroup.set(item.group, list);
            });
            shown = ['Settings', 'Languages', 'Go to', 'Providers', 'Actions'].flatMap(g => byGroup.get(g) || []);
        }
        active = Math.min(active, Math.max(0, shown.length - 1));
        paint();
    };

    input.addEventListener('input', () => {
        active = 0;
        compute();
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(shown.length - 1, active + 1); paint(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); paint(); }
        else if (e.key === 'Enter') { e.preventDefault(); shown[active]?.run(); }
        else if (e.key === 'Escape' && input.value) { e.preventDefault(); input.value = ''; compute(); }
    });

    dialog = openDialog({ title: 'Search', bare: true, size: 'md', placement: 'top', className: 'slt-m-pal-dialog', content: box });
    compute();
    input.focus();
}

const INBOX_TONE: Record<InboxEntry['kind'], Tone> = {
    info: 'accent',
    success: 'success',
    warning: 'hotfix',
    error: 'error',
    update: 'accent',
};

function openInbox(): void {
    const list = el('div', { class: 'slt-m-inbox' });
    let dialog: SurfaceHandle | null = null;
    const render = (items: InboxEntry[]) => {
        list.innerHTML = '';
        if (!items.length) {
            list.append(el('div', { class: 'slt-m-inbox-empty' },
                el('div', { class: 'slt-m-inbox-empty-title', text: 'All caught up' }),
                el('div', { class: 'slt-m-inbox-empty-sub', text: 'Updates, warnings and errors land here so you never miss one.' }),
            ));
            return;
        }
        items.forEach(entry => {
            const dot = el('span', { class: 'slt-m-inbox-dot', 'aria-hidden': 'true' });
            paintTone(dot, INBOX_TONE[entry.kind] || 'accent');
            const row = el('div', { class: `slt-m-inbox-row${entry.read ? '' : ' unread'}` },
                dot,
                el('div', { class: 'slt-m-inbox-text' },
                    el('div', { class: 'slt-m-inbox-title', text: entry.title }),
                    entry.description ? el('div', { class: 'slt-m-inbox-desc', text: entry.description }) : null,
                    el('div', { class: 'slt-m-inbox-time', text: relativeTime(entry.at) }),
                ),
            );
            if (entry.actionId) {
                const actionId = entry.actionId;
                const btn = el('button', { class: 'slt-m-inbox-btn', type: 'button', text: entry.actionLabel || 'Open' });
                btn.addEventListener('click', () => {
                    dialog?.close();
                    runInboxAction(actionId);
                });
                row.append(btn);
            }
            list.append(row);
        });
    };
    render(getInbox());
    dialog = openDialog({
        title: 'Notifications',
        size: 'md',
        className: 'slt-m-inbox-dialog',
        content: list,
        actions: [
            { label: 'Clear all', kind: 'quiet', keepOpen: true, onClick: () => { clearInbox(); render([]); } },
            { label: 'Done', kind: 'primary' },
        ],
    });
    markInboxRead();
}

function iconButton(className: string, label: string, svg: string): HTMLButtonElement {
    return el('button', { class: `slt-m-icon-btn ${className}`, type: 'button', 'aria-label': label, title: label, html: svg });
}

function bindShortcuts(peekButton: HTMLElement, overlayOf: () => HTMLElement | null): () => void {
    const on = () => overlayOf()?.classList.add('slt-ui-peek');
    const off = () => overlayOf()?.classList.remove('slt-ui-peek');
    peekButton.addEventListener('pointerdown', (e) => { e.preventDefault(); on(); });
    peekButton.addEventListener('pointerup', off);
    peekButton.addEventListener('pointerleave', off);
    peekButton.addEventListener('blur', off);
    peekButton.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); on(); } });
    peekButton.addEventListener('keyup', off);
    const editable = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    const settingsOnTop = () => {
        const surfaces = openSurfaces();
        const top = surfaces[surfaces.length - 1];
        return !!top && !!liveContainer && top.root.contains(liveContainer);
    };
    const onKeyDown = (e: KeyboardEvent) => {
        if (!liveContainer?.isConnected) return;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            if (!settingsOnTop()) return;
            e.preventDefault();
            e.stopPropagation();
            openPalette();
            return;
        }
        if (e.key.toLowerCase() === 'p' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat && !editable(e.target) && settingsOnTop()) {
            on();
        }
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.key.toLowerCase() === 'p') off(); };
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', off);
    return () => {
        document.removeEventListener('keydown', onKeyDown, true);
        document.removeEventListener('keyup', onKeyUp, true);
        window.removeEventListener('blur', off);
    };
}

export function settingById(id: string): { id: string; label: string } | null {
    const field = getSettingField(id);
    return field ? { id: field.id, label: field.label } : null;
}

export function matchSettingInText(input: string): { id: string; label: string } | null {
    const haystack = ` ${input.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ')} `;
    let best: SettingsField | null = null;
    SETTINGS_SCHEMA.forEach(field => {
        const label = field.label.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
        if (label.length < 7 || !label.includes(' ')) return;
        if (!haystack.includes(` ${label} `)) return;
        if (!best || label.length > best.label.length) best = field;
    });
    const found = best as SettingsField | null;
    return found ? { id: found.id, label: found.label } : null;
}

export function isSettingsOpen(): boolean {
    return !!liveContainer && liveContainer.isConnected;
}

export function goToSettings(tab: TabId, category?: string): void {
    goToLive?.(tab, category);
}

export function revealSetting(id: string): void {
    if (!liveContainer || !goToLive) return;
    const field = getSettingField(id);
    if (!field) return;
    goToLive('settings', getCategoryForSection(field.section)?.id);
    const row = liveContainer.querySelector<HTMLElement>(`.slt-m-field[data-slt-setting-field="${id}"]`);
    if (!row) return;
    if (row.style.display === 'none') {
        toast({ kind: 'info', key: 'slt-reveal', title: `“${field.label}” is hidden right now`, description: 'It only applies to a different provider or language.' });
        return;
    }
    row.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    row.classList.remove('slt-m-spot');
    void row.offsetWidth;
    row.classList.add('slt-m-spot');
    window.setTimeout(() => row.classList.remove('slt-m-spot'), 2400);
    row.querySelector<HTMLElement>('input, select')?.focus({ preventScroll: true });
}

export function destroySettingsShell(): void {
    teardownLive?.();
    teardownLive = null;
    liveContainer = null;
    goToLive = null;
    rerenderLive = null;
    fieldHandles = [];
    syncChrome = [];
}

export function createSettingsShell(options: { tab?: TabId; category?: string } = {}): HTMLElement {
    ensureShellStyles();
    teardownLive?.();
    const container = el('div', { class: 'slt-modal-root' });
    liveContainer = container;
    syncChrome = [];

    if (options.tab) activeTabId = options.tab;
    if (options.category) activeCategoryId = options.category;

    const renderers: Record<TabId, () => HTMLElement> = {
        settings: buildSettingsTab,
        cache: buildCacheTab,
        about: buildAboutTab,
    };

    const tabContent = el('div', { class: 'slt-m-tab-host' });
    const crumbTitle = el('div', { class: 'slt-m-crumb-title' });
    const crumbSub = el('div', { class: 'slt-m-crumb-sub' });

    function rerender(): void {
        if (activeTabId !== 'settings') fieldHandles = [];
        tabContent.innerHTML = '';
        tabContent.appendChild(renderers[activeTabId]());
        applyFilter();
        refreshChrome();
    }
    rerenderLive = rerender;

    function goTo(tab: TabId, category?: string): void {
        const sameTab = tab === activeTabId;
        activeTabId = tab;
        if (category) activeCategoryId = category;
        if (!sameTab || tab !== 'settings') {
            rerender();
        } else {
            const search = container.querySelector<HTMLInputElement>('.slt-m-cz-search');
            if (search) search.value = '';
            applyFilter();
            refreshChrome();
        }
        tabContent.scrollTop = 0;
        if (!prefersReducedMotion()) {
            tabContent.firstElementChild?.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(0.2, 0.9, 0.1, 1)' });
        }
    }
    goToLive = goTo;

    const side = el('aside', { class: 'slt-m-side' });
    side.append(
        el('div', { class: 'slt-m-brand' },
            el('span', { class: 'slt-m-brand-mark', html: Icons.Translate }),
            el('div', { class: 'slt-m-brand-text' },
                el('div', { class: 'slt-m-brand-name', text: 'Spicy Lyric Translator' }),
                el('div', { class: 'slt-m-brand-ver', text: `v${VERSION}` }),
            ),
        ),
        buildMasterBar(),
    );

    const nav = el('nav', { class: 'slt-m-side-nav', 'aria-label': 'Settings sections' });
    nav.append(el('div', { class: 'slt-m-side-label', text: 'Settings' }));
    const catNav = el('div', { class: 'slt-m-cz-nav', role: 'tablist' });
    SETTINGS_CATEGORIES.forEach((category: SettingsCategory) => {
        const btn = el('button', { class: 'slt-m-side-item', type: 'button', role: 'tab', 'data-target': category.id },
            el('span', { class: 'slt-m-cz-nav-icon', 'aria-hidden': 'true', text: category.icon }),
            el('span', { class: 'slt-m-side-item-label', text: category.label }),
        );
        btn.addEventListener('click', () => goTo('settings', category.id));
        catNav.append(btn);
    });
    nav.append(catNav, el('div', { class: 'slt-m-side-label', text: 'Library' }));
    const tabButtons = new Map<TabId, HTMLButtonElement>();
    ([['cache', '▤'], ['about', 'i']] as [TabId, string][]).forEach(([tab, icon]) => {
        const btn = el('button', { class: 'slt-m-side-item', type: 'button', 'data-tab': tab },
            el('span', { class: 'slt-m-cz-nav-icon', 'aria-hidden': 'true', text: icon }),
            el('span', { class: 'slt-m-side-item-label', text: TAB_META[tab].label }),
        );
        btn.addEventListener('click', () => goTo(tab));
        tabButtons.set(tab, btn);
        nav.append(btn);
    });
    side.append(nav);

    const searchHint = el('button', { class: 'slt-m-side-search', type: 'button' },
        el('span', { class: 'slt-m-side-search-icon', html: SEARCH_SVG }),
        el('span', { class: 'slt-m-side-search-label', text: 'Search everything' }),
        el('kbd', { text: 'Ctrl K' }),
    );
    searchHint.addEventListener('click', openPalette);
    side.append(searchHint);

    const updateChip = el('button', { class: 'slt-m-update-chip', type: 'button' });
    updateChip.addEventListener('click', () => openWaitingUpdate(updateChip.getBoundingClientRect()));

    const reviewBtn = el('button', { class: 'slt-m-review-btn', type: 'button', title: 'Review everything you changed' },
        el('span', { class: 'slt-m-review-icon', html: DIFF_SVG }),
        el('span', { class: 'slt-m-review-label' }),
    );
    reviewBtn.addEventListener('click', openReviewChanges);

    const peekBtn = iconButton('slt-m-peek', 'Hold to peek at the lyrics (or hold P)', EYE_SVG);
    const bellBtn = iconButton('slt-m-bell', 'Notifications', BELL_SVG);
    const closeBtn = iconButton('slt-m-close', 'Close', CLOSE_SVG);
    closeBtn.addEventListener('click', () => {
        openSurfaces().find(s => s.root.contains(container))?.close();
    });

    const main = el('div', { class: 'slt-m-main' },
        el('header', { class: 'slt-m-topbar' },
            el('div', { class: 'slt-m-crumb' }, crumbTitle, crumbSub),
            el('div', { class: 'slt-m-tools' }, updateChip, reviewBtn, peekBtn, bellBtn, closeBtn),
        ),
        tabContent,
    );
    container.append(side, main);

    const syncBell = () => {
        const unread = unreadCount();
        bellBtn.classList.toggle('slt-m-has-unread', unread > 0);
        bellBtn.title = unread ? `Notifications (${unread} new)` : 'Notifications';
    };
    bellBtn.addEventListener('click', () => {
        openInbox();
        syncBell();
    });

    const syncShell = () => {
        const searching = !!container.querySelector<HTMLInputElement>('.slt-m-cz-search')?.value.trim();
        catNav.querySelectorAll<HTMLElement>('.slt-m-side-item').forEach(btn => {
            const on = activeTabId === 'settings' && !searching && btn.dataset.target === activeCategoryId;
            btn.classList.toggle('active', on);
            btn.setAttribute('aria-selected', String(on));
        });
        catNav.classList.toggle('slt-m-cz-nav-muted', activeTabId === 'settings' && searching);
        tabButtons.forEach((btn, tab) => btn.classList.toggle('active', tab === activeTabId));
        const category = SETTINGS_CATEGORIES.find(c => c.id === activeCategoryId);
        const onSettings = activeTabId === 'settings' && !!category;
        crumbTitle.textContent = onSettings ? category!.label : TAB_META[activeTabId].label;
        crumbSub.textContent = onSettings ? category!.description : TAB_META[activeTabId].description;
        container.dataset.tab = activeTabId;
        const changed = changedFields().length;
        reviewBtn.classList.toggle('slt-m-has-changes', changed > 0);
        (reviewBtn.querySelector('.slt-m-review-label') as HTMLElement).textContent = changed ? `${changed} change${changed === 1 ? '' : 's'}` : 'No changes';
        const waiting = hasWaitingUpdate();
        updateChip.hidden = !waiting;
        if (waiting) updateChip.textContent = waiting.kind === 'hotfix' ? 'Patch ready' : `v${waiting.version} ready`;
        syncBell();
    };
    syncChrome.push(syncShell);

    rerender();
    syncModelLists();

    const stopShortcuts = bindShortcuts(peekBtn, () => container.closest<HTMLElement>('.slt-ui-overlay'));
    const stopInbox = onInboxChange(syncBell);
    const waitObserver = new MutationObserver(syncShell);
    waitObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    const onFocus = () => refreshChrome();
    window.addEventListener('focus', onFocus);
    teardownLive = () => {
        stopShortcuts();
        stopInbox();
        waitObserver.disconnect();
        window.removeEventListener('focus', onFocus);
    };

    return container;
}

function ensureShellStyles(): void {
    if (document.getElementById('slt-shell-styles')) return;
    const style = document.createElement('style');
    style.id = 'slt-shell-styles';
    style.textContent = SHELL_STYLES;
    document.head.appendChild(style);
}

const SHELL_STYLES = `
.slt-modal-root {
    --slt-m-accent: var(--slt-ui-accent, #1db954);
    --slt-m-accent-soft: var(--slt-ui-accent-soft, rgba(29, 185, 84, 0.12));
    --slt-m-accent-ink: var(--slt-ui-accent-ink, #000);
    --slt-m-bg-elev: color-mix(in oklab, var(--slt-ui-ink, #fff) 4%, transparent);
    --slt-m-border: var(--slt-ui-line, rgba(255, 255, 255, 0.08));
    --slt-m-text: var(--slt-ui-ink, #fff);
    --slt-m-text-dim: var(--slt-ui-ink-muted, #b3b3b3);
    --slt-m-text-faint: var(--slt-ui-ink-faint, #8a8a8a);
    --slt-m-radius: 12px;
    --slt-m-radius-sm: 9px;
    display: grid;
    grid-template-columns: 232px minmax(0, 1fr);
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    box-sizing: border-box;
    color: var(--slt-m-text);
    font-size: 13px;
    line-height: 1.4;
}
.slt-modal-root *, .slt-modal-root *::before, .slt-modal-root *::after { box-sizing: border-box; }
.slt-ui-panel.slt-settings-dialog { height: min(86vh, 820px); }
.slt-settings-dialog .slt-ui-body { overflow: hidden; height: 100%; }

.slt-modal-root .slt-m-side {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-height: 0;
    padding: 22px 14px 14px;
    border-right: 1px solid var(--slt-m-border);
    background: rgba(0, 0, 0, 0.12);
    overflow-y: auto;
}
.slt-modal-root .slt-m-brand { display: flex; align-items: center; gap: 10px; padding: 0 6px; }
.slt-modal-root .slt-m-brand-mark { display: inline-flex; color: var(--slt-m-text); }
.slt-modal-root .slt-m-brand-mark svg { width: 20px; height: 20px; }
.slt-modal-root .slt-m-brand-name { font-weight: 700; font-size: 13.5px; line-height: 1.2; }
.slt-modal-root .slt-m-brand-ver { font-size: 11px; color: var(--slt-m-text-dim); }
.slt-modal-root .slt-m-side-nav { display: flex; flex-direction: column; gap: 2px; flex: 1 1 auto; }
.slt-modal-root .slt-m-side-label {
    padding: 12px 10px 6px;
    font-size: 10.5px;
    font-weight: 750;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: var(--slt-m-text-faint);
}
.slt-modal-root .slt-m-cz-nav { display: flex; flex-direction: column; gap: 2px; transition: opacity 0.2s ease; }
.slt-modal-root .slt-m-cz-nav.slt-m-cz-nav-muted { opacity: 0.4; }
.slt-modal-root .slt-m-side-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    text-align: left;
    background: transparent;
    border: none;
    color: var(--slt-m-text-dim);
    padding: 8px 10px;
    border-radius: 10px;
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.18s cubic-bezier(0.16, 1, 0.3, 1), color 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}
.slt-modal-root .slt-m-side-item:hover { background: var(--slt-m-bg-elev); color: var(--slt-m-text); }
.slt-modal-root .slt-m-side-item.active { background: var(--slt-m-accent-soft); color: var(--slt-m-text); }
.slt-modal-root .slt-m-side-item.active::before {
    content: '';
    position: absolute;
    left: -14px;
    top: 8px;
    bottom: 8px;
    width: 3px;
    border-radius: 0 3px 3px 0;
    background: var(--slt-m-accent);
}
.slt-modal-root .slt-m-cz-nav-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    border-radius: 7px;
    background: var(--slt-m-bg-elev);
    font-size: 11px;
    line-height: 1;
    transition: background 0.18s ease, color 0.18s ease;
}
.slt-modal-root .slt-m-side-item.active .slt-m-cz-nav-icon { background: var(--slt-m-accent); color: var(--slt-m-accent-ink); }
.slt-modal-root .slt-m-side-search {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 9px 10px;
    border-radius: 11px;
    border: 1px solid var(--slt-m-border);
    background: var(--slt-m-bg-elev);
    color: var(--slt-m-text-dim);
    font: inherit;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 0.18s ease, color 0.18s ease;
}
.slt-modal-root .slt-m-side-search:hover { border-color: var(--slt-ui-accent-line, var(--slt-m-accent)); color: var(--slt-m-text); }
.slt-modal-root .slt-m-side-search-icon { display: inline-flex; }
.slt-modal-root .slt-m-side-search-label { flex: 1; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.slt-modal-root:not(.slt-m-searching) .slt-m-cz-cat-head { display: none; }
.slt-modal-root kbd, .slt-m-pal kbd {
    display: inline-flex;
    align-items: center;
    padding: 1px 6px;
    border-radius: 6px;
    border: 1px solid var(--slt-ui-line, rgba(255,255,255,0.12));
    background: color-mix(in oklab, var(--slt-ui-ink, #fff) 6%, transparent);
    font-family: inherit;
    font-size: 10.5px;
    font-weight: 700;
    color: var(--slt-ui-ink-muted, #b3b3b3);
}

.slt-modal-root .slt-m-main { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.slt-modal-root .slt-m-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 20px 18px 14px 26px;
    border-bottom: 1px solid var(--slt-m-border);
}
.slt-modal-root .slt-m-crumb { min-width: 0; }
.slt-modal-root .slt-m-crumb-title { font-size: 20px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.2; }
.slt-modal-root .slt-m-crumb-sub {
    margin-top: 2px;
    font-size: 12.5px;
    color: var(--slt-m-text-dim);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.slt-modal-root .slt-m-tools { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.slt-modal-root .slt-m-icon-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 10px;
    background: transparent;
    color: var(--slt-m-text-dim);
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
.slt-modal-root .slt-m-icon-btn:hover { background: var(--slt-m-bg-elev); color: var(--slt-m-text); }
.slt-modal-root .slt-m-peek:active { background: var(--slt-m-accent-soft); color: var(--slt-m-text); border-color: var(--slt-ui-accent-line, var(--slt-m-accent)); }
.slt-modal-root .slt-m-bell.slt-m-has-unread::after {
    content: '';
    position: absolute;
    top: 7px;
    right: 7px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--slt-m-accent);
    box-shadow: 0 0 0 2px var(--slt-ui-field, #111);
}
.slt-modal-root .slt-m-review-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 34px;
    padding: 0 12px;
    border-radius: 10px;
    border: 1px solid var(--slt-m-border);
    background: transparent;
    color: var(--slt-m-text-dim);
    font: inherit;
    font-size: 12.5px;
    font-weight: 650;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
}
.slt-modal-root .slt-m-review-btn:hover { background: var(--slt-m-bg-elev); color: var(--slt-m-text); }
.slt-modal-root .slt-m-review-btn.slt-m-has-changes { color: var(--slt-m-text); }
.slt-modal-root .slt-m-review-icon { display: inline-flex; }
.slt-modal-root .slt-m-update-chip {
    height: 34px;
    padding: 0 12px;
    border: 0;
    border-radius: 10px;
    background: var(--slt-m-accent);
    color: var(--slt-m-accent-ink);
    font: inherit;
    font-size: 12.5px;
    font-weight: 750;
    cursor: pointer;
}
.slt-modal-root .slt-m-update-chip[hidden] { display: none; }
.slt-modal-root .slt-m-icon-btn:focus-visible,
.slt-modal-root .slt-m-review-btn:focus-visible,
.slt-modal-root .slt-m-update-chip:focus-visible,
.slt-modal-root .slt-m-side-item:focus-visible,
.slt-modal-root .slt-m-side-search:focus-visible,
.slt-modal-root .slt-m-btn:focus-visible,
.slt-modal-root .slt-m-field-reset:focus-visible,
.slt-modal-root .slt-m-reveal:focus-visible {
    outline: 2px solid var(--slt-m-accent);
    outline-offset: 2px;
}

.slt-modal-root .slt-m-enabled-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: var(--slt-m-bg-elev);
    border: 1px solid var(--slt-m-border);
    border-radius: var(--slt-m-radius);
}
.slt-modal-root .slt-m-enabled-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.slt-modal-root .slt-m-enabled-title { font-weight: 750; font-size: 12.5px; }
.slt-modal-root .slt-m-enabled-sub {
    font-size: 11px;
    color: var(--slt-m-text-dim);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.slt-modal-root .slt-m-toggle { position: relative; width: 38px; height: 22px; flex-shrink: 0; display: inline-block; }
.slt-modal-root .slt-m-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
.slt-modal-root .slt-m-toggle-slider {
    position: absolute;
    inset: 0;
    background: rgba(255, 255, 255, 0.18);
    border-radius: 22px;
    cursor: pointer;
    transition: background 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}
.slt-modal-root .slt-m-toggle-slider::before {
    content: '';
    position: absolute;
    width: 16px;
    height: 16px;
    left: 3px;
    top: 3px;
    background: #fff;
    border-radius: 50%;
    transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), background 0.22s ease;
}
.slt-modal-root .slt-m-toggle input:checked + .slt-m-toggle-slider { background: var(--slt-m-accent); }
.slt-modal-root .slt-m-toggle input:checked + .slt-m-toggle-slider::before { transform: translateX(16px); background: var(--slt-ui-knob, #fff); }
.slt-modal-root .slt-m-toggle input:focus-visible + .slt-m-toggle-slider { outline: 2px solid var(--slt-m-accent); outline-offset: 2px; }

.slt-modal-root .slt-m-tab-host {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-gutter: stable;
    padding: 18px 20px 26px 26px;
}
.slt-modal-root .slt-m-tab-host::-webkit-scrollbar { width: 8px; }
.slt-modal-root .slt-m-tab-host::-webkit-scrollbar-thumb { background: var(--slt-m-border); border-radius: 8px; border: 2px solid transparent; background-clip: padding-box; }
.slt-modal-root .slt-m-tab-content { display: flex; flex-direction: column; gap: 12px; animation: slt-m-tab-in 0.28s cubic-bezier(0.16, 1, 0.3, 1); }
.slt-modal-root .slt-m-cz { gap: 0; }
.slt-modal-root .slt-m-cz-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 12px;
    margin-bottom: 14px;
    border: 1px solid var(--slt-m-border);
    border-radius: var(--slt-m-radius);
    background: rgba(255, 255, 255, 0.03);
    transition: border-color 0.2s ease;
}
.slt-modal-root .slt-m-cz-toolbar:focus-within { border-color: var(--slt-m-accent); }
.slt-modal-root .slt-m-cz-search-icon { display: flex; align-items: center; color: var(--slt-m-text-dim); flex-shrink: 0; line-height: 0; }
.slt-modal-root .slt-m-cz-search {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    padding: 2px 0;
    color: var(--slt-m-text);
    font: inherit;
    font-size: 13px;
    outline: none;
}
.slt-modal-root .slt-m-cz-search::placeholder { color: var(--slt-m-text-faint); }
.slt-modal-root .slt-m-cz-clear {
    background: transparent;
    border: none;
    color: var(--slt-m-text-dim);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 3px 6px;
    border-radius: 4px;
    cursor: pointer;
    flex-shrink: 0;
}
.slt-modal-root .slt-m-cz-clear:hover { color: var(--slt-m-text); background: rgba(255, 255, 255, 0.08); }
.slt-modal-root .slt-m-cz-status { font-size: 12px; color: var(--slt-m-text-dim); padding: 0 2px 10px; }
.slt-modal-root .slt-m-cz-status-empty { color: var(--slt-m-text); }
.slt-modal-root .slt-m-cz-sections { display: flex; flex-direction: column; gap: 22px; min-width: 0; }
.slt-modal-root .slt-m-cz-category { display: flex; flex-direction: column; gap: 10px; animation: slt-m-tab-in 0.22s cubic-bezier(0.16, 1, 0.3, 1); }
.slt-modal-root .slt-m-cz-cat-head { padding-bottom: 9px; border-bottom: 1px solid var(--slt-m-border); }
.slt-modal-root .slt-m-cz-cat-title { font-size: 15px; font-weight: 800; color: var(--slt-m-text); }
.slt-modal-root .slt-m-cz-cat-desc { font-size: 12px; line-height: 1.45; color: var(--slt-m-text-dim); margin-top: 3px; }

.slt-modal-root .slt-m-section {
    background: var(--slt-m-bg-elev);
    border: 1px solid var(--slt-m-border);
    border-radius: var(--slt-m-radius);
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
    transition: border-color 0.24s cubic-bezier(0.16, 1, 0.3, 1);
}
.slt-modal-root .slt-m-section:hover { border-color: rgba(255, 255, 255, 0.16); }
.slt-modal-root .slt-m-section-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--slt-m-text-dim);
    margin-bottom: 2px;
}
.slt-modal-root .slt-m-field {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(190px, 300px);
    align-items: center;
    gap: 14px;
    min-height: 40px;
    padding: 7px 0;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
}
.slt-modal-root .slt-m-section-title + .slt-m-field { border-top: none; padding-top: 2px; }
.slt-modal-root .slt-m-field-toggle { grid-template-columns: minmax(0, 1fr) max-content; }
.slt-modal-root .slt-m-field-labelbox { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.slt-modal-root .slt-m-field-label { min-width: 0; font-size: 13px; color: var(--slt-m-text); line-height: 1.3; display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.slt-modal-root .slt-m-field-hint { font-size: 11.5px; line-height: 1.45; color: var(--slt-m-text-dim); max-width: 52ch; }
.slt-modal-root .slt-m-badge {
    padding: 1px 7px;
    border-radius: 999px;
    background: var(--slt-m-accent-soft);
    color: var(--slt-m-text);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.02em;
    white-space: nowrap;
}
.slt-modal-root .slt-m-field-control { display: flex; align-items: center; gap: 8px; justify-content: flex-end; min-width: 0; width: 100%; }
.slt-modal-root .slt-m-field-reset,
.slt-modal-root .slt-m-reveal {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    flex: 0 0 24px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--slt-m-text-dim);
    cursor: pointer;
    transition: opacity 0.18s ease, background 0.18s ease, color 0.18s ease;
}
.slt-modal-root .slt-m-field-reset { visibility: hidden; opacity: 0; }
.slt-modal-root .slt-m-field-reset-on { visibility: visible; opacity: 0.45; }
.slt-modal-root .slt-m-field-reset-on:hover,
.slt-modal-root .slt-m-field-reset-on:focus-visible,
.slt-modal-root .slt-m-reveal:hover,
.slt-modal-root .slt-m-reveal.on { opacity: 1; color: var(--slt-m-text); background: rgba(255, 255, 255, 0.1); }
.slt-modal-root .slt-m-reveal svg { width: 14px; height: 14px; }
.slt-modal-root .slt-m-select,
.slt-modal-root .slt-m-text {
    background-color: rgba(0, 0, 0, 0.3);
    border: 1px solid var(--slt-m-border);
    color: var(--slt-m-text);
    padding: 7px 10px;
    border-radius: var(--slt-m-radius-sm);
    font: inherit;
    font-size: 13px;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    min-height: 34px;
    outline: none;
    text-overflow: ellipsis;
    transition: border-color 0.2s ease, background-color 0.2s ease;
}
.slt-modal-root .slt-m-select {
    appearance: none;
    -webkit-appearance: none;
    padding-right: 30px;
    cursor: pointer;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.55)' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><path d='M6 9l6 6 6-6'/></svg>");
    background-repeat: no-repeat;
    background-position: right 10px center;
}
.slt-modal-root .slt-m-select option { background-color: #1c1c1f; color: #fff; }
.slt-modal-root .slt-m-field-languages { align-items: start; }
.slt-modal-root .slt-m-langs-box { display: flex; flex-direction: column; gap: 6px; flex: 1 1 auto; min-width: 0; }
.slt-modal-root .slt-m-langs { display: flex; flex-wrap: wrap; gap: 5px; }
.slt-modal-root .slt-m-langs:empty { display: none; }
.slt-modal-root .slt-m-lang {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 3px 2px 9px;
    border-radius: 999px;
    background: var(--slt-m-accent-soft);
    color: var(--slt-m-text);
    font-size: 12px;
    line-height: 18px;
}
.slt-modal-root .slt-m-lang-remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--slt-m-text-dim);
    cursor: pointer;
}
.slt-modal-root .slt-m-lang-remove:hover,
.slt-modal-root .slt-m-lang-remove:focus-visible { color: var(--slt-m-text); background: rgba(255, 255, 255, 0.12); }
.slt-modal-root .slt-m-lang-remove svg { width: 10px; height: 10px; }
.slt-modal-root .slt-m-select:focus,
.slt-modal-root .slt-m-text:focus { border-color: var(--slt-m-accent); background-color: rgba(0, 0, 0, 0.45); }
.slt-modal-root .slt-m-text::placeholder { color: var(--slt-m-text-faint); }
.slt-modal-root .slt-m-field.slt-m-spot { border-radius: 10px; animation: slt-m-spot 2.2s cubic-bezier(0.2, 0.9, 0.1, 1); }
@keyframes slt-m-spot {
    0% { box-shadow: 0 0 0 0 var(--slt-m-accent); background: var(--slt-m-accent-soft); }
    20% { box-shadow: 0 0 0 3px var(--slt-ui-accent-line, var(--slt-m-accent)); background: var(--slt-m-accent-soft); }
    100% { box-shadow: 0 0 0 0 transparent; background: transparent; }
}

.slt-modal-root .slt-m-btn {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--slt-m-border);
    color: var(--slt-m-text);
    padding: 7px 12px;
    border-radius: var(--slt-m-radius-sm);
    font: inherit;
    font-size: 12.5px;
    font-weight: 650;
    cursor: pointer;
    min-height: 34px;
    transition: background 0.2s ease, transform 0.16s ease, opacity 0.2s ease, border-color 0.2s ease;
}
.slt-modal-root .slt-m-btn:hover:not(:disabled) { background: rgba(255, 255, 255, 0.12); }
.slt-modal-root .slt-m-btn:active:not(:disabled) { transform: scale(0.98); }
.slt-modal-root .slt-m-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.slt-modal-root .slt-m-btn-primary { background: var(--slt-m-accent); color: var(--slt-m-accent-ink); border-color: var(--slt-m-accent); }
.slt-modal-root .slt-m-btn-primary:hover:not(:disabled) { background: var(--slt-ui-accent-hover, var(--slt-m-accent)); }
.slt-modal-root .slt-m-btn-danger { background: rgba(231, 76, 60, 0.12); border-color: rgba(231, 76, 60, 0.4); color: #f08272; }
.slt-modal-root .slt-m-btn-danger:hover:not(:disabled) { background: rgba(231, 76, 60, 0.22); }
.slt-modal-root .slt-m-btn-armed { background: rgba(231, 76, 60, 0.85); border-color: transparent; color: #fff; }
.slt-modal-root .slt-m-btn-armed:hover:not(:disabled) { background: rgba(231, 76, 60, 0.95); }

.slt-modal-root .slt-m-about-hero { display: flex; align-items: baseline; flex-wrap: wrap; gap: 10px; }
.slt-modal-root .slt-m-about-title { font-size: 18px; font-weight: 800; }
.slt-modal-root .slt-m-about-version {
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    font-size: 12px;
    color: var(--slt-m-text);
    background: var(--slt-m-accent-soft);
    padding: 2px 8px;
    border-radius: 6px;
}
.slt-modal-root .slt-m-about-hash {
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    font-size: 11px;
    color: var(--slt-m-text-dim);
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--slt-m-border);
    padding: 2px 7px;
    border-radius: 6px;
    user-select: all;
}
.slt-modal-root .slt-m-about-text { font-size: 12.5px; color: var(--slt-m-text-dim); line-height: 1.5; }
.slt-modal-root .slt-m-about-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 4px; }
.slt-modal-root .slt-m-about-links { display: flex; gap: 14px; flex-wrap: wrap; }
.slt-modal-root .slt-m-about-links a { color: var(--slt-m-text); text-decoration: underline; text-decoration-color: var(--slt-ui-accent-line, var(--slt-m-border)); text-underline-offset: 3px; font-size: 13px; font-weight: 600; }
.slt-modal-root .slt-m-about-links a:hover { text-decoration-color: var(--slt-m-accent); }
.slt-modal-root .slt-m-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; margin-top: 4px; }
.slt-modal-root .slt-m-stat { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: var(--slt-m-radius-sm); background: rgba(0, 0, 0, 0.2); }
.slt-modal-root .slt-m-stat-value { font-size: 16px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--slt-m-text); }
.slt-modal-root .slt-m-stat-label { font-size: 11px; color: var(--slt-m-text-faint); }
.slt-modal-root .slt-m-meter { height: 6px; border-radius: 6px; background: rgba(255, 255, 255, 0.08); overflow: hidden; margin: 4px 0 2px; }
.slt-modal-root .slt-m-meter i { display: block; height: 100%; border-radius: 6px; background: var(--slt-m-accent); }
.slt-modal-root .slt-m-conn-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.slt-modal-root .slt-m-conn-status { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; color: var(--slt-m-text-dim); }
.slt-modal-root .slt-m-conn-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--slt-m-text-faint); }
.slt-modal-root .slt-m-conn-connecting, .slt-modal-root .slt-m-conn-reconnecting { background: #ffd35c; }
.slt-modal-root .slt-m-conn-error { background: #f1556c; }
.slt-modal-root .slt-m-conn-connected, .slt-modal-root .slt-m-conn-dot.slt-m-lat-great { background: #1ed760; }
.slt-modal-root .slt-m-conn-dot.slt-m-lat-ok { background: #ffd35c; }
.slt-modal-root .slt-m-conn-dot.slt-m-lat-bad { background: #ff9f45; }
.slt-modal-root .slt-m-conn-dot.slt-m-lat-horrible { background: #f1556c; }
.slt-modal-root .slt-m-stat-value.slt-m-lat-great { color: #1ed760; }
.slt-modal-root .slt-m-stat-value.slt-m-lat-ok { color: #ffd35c; }
.slt-modal-root .slt-m-stat-value.slt-m-lat-bad { color: #ff9f45; }
.slt-modal-root .slt-m-stat-value.slt-m-lat-horrible { color: #f1556c; }
.slt-modal-root .slt-m-shortcut { display: flex; align-items: center; gap: 12px; padding: 6px 0; font-size: 12.5px; color: var(--slt-m-text-dim); }
.slt-modal-root .slt-m-shortcut + .slt-m-shortcut { border-top: 1px solid rgba(255, 255, 255, 0.04); }
.slt-modal-root .slt-m-shortcut-keys { display: inline-flex; gap: 4px; min-width: 92px; }

.slt-m-rv-list { display: flex; flex-direction: column; gap: 6px; }
.slt-m-rv-list[hidden] { display: none; }
.slt-m-rv-row {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1.4fr) auto;
    align-items: center;
    gap: 14px;
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid var(--slt-ui-line);
    background: color-mix(in oklab, var(--slt-ui-ink) 3%, transparent);
}
.slt-m-rv-head { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.slt-m-rv-label { padding: 0; border: 0; background: none; color: var(--slt-ui-ink); font: inherit; font-size: 13.5px; font-weight: 650; text-align: left; cursor: pointer; }
.slt-m-rv-label:hover { text-decoration: underline; text-decoration-color: var(--slt-ui-accent-line); text-underline-offset: 3px; }
.slt-m-rv-where { font-size: 11.5px; color: var(--slt-ui-ink-faint); }
.slt-m-rv-diff { display: flex; align-items: center; gap: 10px; min-width: 0; flex-wrap: wrap; }
.slt-m-rv-value { min-width: 0; font-family: 'JetBrains Mono', ui-monospace, Consolas, monospace; font-size: 12px; color: var(--slt-ui-ink-muted); overflow-wrap: anywhere; }
.slt-m-rv-value:last-child { color: var(--slt-ui-ink); }
.slt-m-rv-arrow { width: 14px; height: 1px; background: var(--slt-ui-ink-faint); flex: 0 0 auto; }
.slt-m-rv-revert,
.slt-m-inbox-btn {
    padding: 6px 12px;
    border-radius: 9px;
    border: 1px solid var(--slt-ui-line);
    background: transparent;
    color: var(--slt-ui-ink);
    font: inherit;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
}
.slt-m-rv-revert:hover, .slt-m-inbox-btn:hover { background: var(--slt-ui-line); }

.slt-m-pal-dialog { --slt-ui-w: 38rem; }
.slt-m-pal { display: flex; flex-direction: column; max-height: min(68vh, 560px); }
.slt-m-pal-bar { display: flex; align-items: center; gap: 12px; padding: 18px 20px 14px; border-bottom: 1px solid var(--slt-ui-line); color: var(--slt-ui-ink-muted); }
.slt-m-pal-icon { display: inline-flex; }
.slt-m-pal-input { flex: 1; min-width: 0; border: 0; outline: none; background: transparent; color: var(--slt-ui-ink); font: inherit; font-size: 17px; font-weight: 550; }
.slt-m-pal-input::placeholder { color: var(--slt-ui-ink-faint); }
.slt-m-pal-results { overflow-y: auto; padding: 8px; min-height: 120px; }
.slt-m-pal-results::-webkit-scrollbar { width: 6px; }
.slt-m-pal-results::-webkit-scrollbar-thumb { background: var(--slt-ui-line); border-radius: 6px; }
.slt-m-pal-group { padding: 10px 12px 4px; font-size: 10.5px; font-weight: 750; text-transform: uppercase; letter-spacing: 0.09em; color: var(--slt-ui-ink-faint); }
.slt-m-pal-item {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 14px;
    width: 100%;
    padding: 9px 12px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: var(--slt-ui-ink);
    font: inherit;
    font-size: 13.5px;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
}
.slt-m-pal-item.active { background: var(--slt-ui-accent-soft); box-shadow: inset 2px 0 0 var(--slt-ui-accent); }
.slt-m-pal-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.slt-m-pal-hint { flex: 0 1 auto; min-width: 0; max-width: 55%; font-size: 12px; font-weight: 500; color: var(--slt-ui-ink-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.slt-m-pal-empty { padding: 28px 12px; text-align: center; color: var(--slt-ui-ink-faint); font-size: 13px; }
.slt-m-pal-foot { display: flex; gap: 16px; padding: 10px 20px; border-top: 1px solid var(--slt-ui-line); font-size: 11.5px; color: var(--slt-ui-ink-faint); }
.slt-m-pal-foot kbd { margin-right: 3px; }

.slt-m-inbox { display: flex; flex-direction: column; gap: 6px; }
.slt-m-inbox-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: start;
    gap: 12px;
    padding: 12px;
    border-radius: 12px;
    border: 1px solid var(--slt-ui-line);
    background: color-mix(in oklab, var(--slt-ui-ink) 3%, transparent);
}
.slt-m-inbox-row.unread { border-color: var(--slt-ui-accent-line); }
.slt-m-inbox-dot { width: 9px; height: 9px; margin-top: 5px; border-radius: 50%; background: var(--slt-ui-accent); }
.slt-m-inbox-title { font-weight: 650; font-size: 13.5px; }
.slt-m-inbox-desc { font-size: 12.5px; color: var(--slt-ui-ink-muted); margin-top: 2px; overflow-wrap: anywhere; }
.slt-m-inbox-time { font-size: 11.5px; color: var(--slt-ui-ink-faint); margin-top: 4px; }
.slt-m-inbox-empty { padding: 26px 8px; text-align: center; }
.slt-m-inbox-empty-title { font-weight: 750; font-size: 15px; color: var(--slt-ui-ink); }
.slt-m-inbox-empty-sub { font-size: 13px; color: var(--slt-ui-ink-faint); margin-top: 4px; }

@keyframes slt-m-tab-in {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 760px) {
    .slt-modal-root { grid-template-columns: 1fr; grid-template-rows: auto minmax(0, 1fr); }
    .slt-modal-root .slt-m-side { flex-direction: row; flex-wrap: wrap; align-items: center; padding: 12px; border-right: 0; border-bottom: 1px solid var(--slt-m-border); overflow: visible; }
    .slt-modal-root .slt-m-side-nav { flex-direction: row; flex-wrap: wrap; flex-basis: 100%; }
    .slt-modal-root .slt-m-side-label,
    .slt-modal-root .slt-m-side-item-label,
    .slt-modal-root .slt-m-side-search-label,
    .slt-modal-root .slt-m-side-search kbd,
    .slt-modal-root .slt-m-enabled-sub { display: none; }
    .slt-modal-root .slt-m-cz-nav { flex-direction: row; flex-wrap: wrap; }
    .slt-modal-root .slt-m-side-item { width: auto; }
    .slt-modal-root .slt-m-side-item.active::before { display: none; }
    .slt-modal-root .slt-m-side-search { width: auto; }
    .slt-modal-root .slt-m-topbar { padding: 14px 12px; flex-wrap: wrap; }
    .slt-modal-root .slt-m-review-label { display: none; }
    .slt-modal-root .slt-m-tab-host { padding: 14px 12px 20px; }
    .slt-modal-root .slt-m-field { grid-template-columns: 1fr; align-items: start; gap: 6px; }
    .slt-modal-root .slt-m-field-toggle { grid-template-columns: minmax(0, 1fr) max-content; align-items: center; }
    .slt-modal-root .slt-m-field-reset { visibility: visible; opacity: 0; }
    .slt-modal-root .slt-m-field-reset-on { opacity: 0.6; }
    .slt-m-rv-row { grid-template-columns: 1fr; }
}

@media (prefers-reduced-motion: reduce) {
    .slt-modal-root .slt-m-tab-content, .slt-modal-root .slt-m-cz-category { animation: none; }
    .slt-modal-root *, .slt-modal-root *::before, .slt-modal-root *::after {
        transition-duration: 0.01ms !important;
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
    }
}
`;
