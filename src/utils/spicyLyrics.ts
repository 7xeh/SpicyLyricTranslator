import { SPICY_ROMANIZED_ROW_CLASS } from './text';

const SETTINGS_KEY = 'SL:settings';
const UI_STATE_KEY = 'SL:uiState';
const ROMANIZED_ROWS_SINCE = [6, 5, 0];
const ROMANIZED_ROWS_SHOWN_CLASS = 'RomanizedRowsShown';
const GROUPED_CONTROLS_CLASS = 'Exp_GroupedViewControls';
const LEGACY_ROMANIZATION_KEYS = ['SpicyLyrics-romanization', 'SpicyLyrics:romanization', 'romanization'];

export type SpicyRomanizationDisplay = 'replace' | 'underLine';

function storageReaders(): Array<(key: string) => unknown> {
    return [
        key => (globalThis as any).Spicetify?.LocalStorage?.get?.(key),
        key => (globalThis as any).localStorage?.getItem?.(key)
    ];
}

function readBlob(key: string): Record<string, any> | null {
    for (const read of storageReaders()) {
        try {
            const raw = read(key);
            if (typeof raw !== 'string' || !raw) continue;
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') return parsed;
        } catch (e) {}
    }
    return null;
}

export function readSpicySettings(): Record<string, any> | null {
    return readBlob(SETTINGS_KEY);
}

function parseVersion(raw: unknown): number[] | null {
    const match = /^(\d+)\.(\d+)\.(\d+)/.exec(typeof raw === 'string' ? raw.trim() : '');
    return match ? match.slice(1).map(Number) : null;
}

export function spicyLyricsVersion(): number[] | null {
    return parseVersion((globalThis as any)._spicy_lyrics_metadata?.LoadedVersion)
        || parseVersion(readBlob(UI_STATE_KEY)?.fromVersion);
}

function versionAtLeast(version: number[], minimum: number[]): boolean {
    for (let i = 0; i < minimum.length; i++) {
        const part = version[i] || 0;
        if (part !== minimum[i]) return part > minimum[i];
    }
    return true;
}

function findSpicyPage(doc: Document | undefined): HTMLElement | null {
    try {
        return (doc?.querySelector?.('#SpicyLyricsPage') as HTMLElement | null) || null;
    } catch (e) {
        return null;
    }
}

function currentDocument(): Document | undefined {
    return typeof document === 'undefined' ? undefined : document;
}

export function supportsRomanizedRows(doc: Document | undefined = currentDocument()): boolean {
    const version = spicyLyricsVersion();
    if (version && versionAtLeast(version, ROMANIZED_ROWS_SINCE)) return true;
    const page = findSpicyPage(doc);
    if (!page) return false;
    if (page.style?.getPropertyValue?.('--SL-LyricsScale')) return true;
    return Boolean(page.querySelector?.(`.${SPICY_ROMANIZED_ROW_CLASS}`));
}

export function spicyRomanizationDisplay(doc: Document | undefined = currentDocument()): SpicyRomanizationDisplay {
    const saved = readSpicySettings()?.romanizationDisplay;
    if (saved === 'replace' || saved === 'underLine') return saved;
    return supportsRomanizedRows(doc) ? 'underLine' : 'replace';
}

export function isSpicyRomanizationToggledOn(doc: Document | undefined = currentDocument()): boolean {
    for (const read of storageReaders()) {
        try {
            const raw = read(UI_STATE_KEY);
            if (typeof raw !== 'string' || !raw) continue;
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed.romanization === 'boolean') return parsed.romanization;
        } catch (e) {}
    }

    try {
        const button = doc?.querySelector?.('#RomanizationToggle');
        if (button?.classList?.contains('active') || button?.getAttribute?.('aria-pressed') === 'true') return true;
    } catch (e) {}

    for (const read of storageReaders()) {
        for (const key of LEGACY_ROMANIZATION_KEYS) {
            try {
                const value = read(key);
                if (value === 'true') return true;
                if (value === 'false') return false;
            } catch (e) {}
        }
    }

    return false;
}

export function areRomanizedRowsShown(doc: Document | undefined = currentDocument()): boolean {
    return Boolean(findSpicyPage(doc)?.classList?.contains(ROMANIZED_ROWS_SHOWN_CLASS));
}

export function lineShowsRomanizedRow(line: Element): boolean {
    if (!areRomanizedRowsShown(line.ownerDocument)) return false;
    const children = line.children;
    if (!children) return false;
    for (let i = 0; i < children.length; i++) {
        if (children[i].classList.contains(SPICY_ROMANIZED_ROW_CLASS)) return true;
    }
    return false;
}

export function usesGroupedViewControls(scope: Element | null | undefined): boolean {
    return Boolean(scope?.closest?.(`#SpicyLyricsPage.${GROUPED_CONTROLS_CLASS}`));
}

export function spicyLyricsClockMs(): number | null {
    try {
        const fromSpicy = (globalThis as any).SpicyLyrics?.testing?.getProgress?.();
        if (typeof fromSpicy === 'number' && Number.isFinite(fromSpicy)) return fromSpicy;
    } catch (e) {}
    try {
        const fromPlayer = (globalThis as any).Spicetify?.Player?.getProgress?.();
        if (typeof fromPlayer === 'number' && Number.isFinite(fromPlayer)) return fromPlayer;
    } catch (e) {}
    return null;
}
