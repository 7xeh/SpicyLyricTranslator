import { storage } from './storage';
import { correctionRangeKey, normalizeReading } from './furigana';
import type { FuriganaCorrectionSet } from './furigana';

const FURIGANA_CORRECTIONS_KEY = 'furigana-corrections';

export type FuriganaCorrectionScope = 'line' | 'song';

export interface FuriganaCorrectionTarget {
    lineText: string;
    start: number;
    end: number;
}

interface TrackFuriganaCorrections {
    lines: Record<string, Record<string, string>>;
    words: Record<string, string>;
    updatedAt: number;
    trackName?: string;
    artistName?: string;
}

type FuriganaCorrectionStore = Record<string, TrackFuriganaCorrections>;

let revision = 0;
let cachedStore: FuriganaCorrectionStore | null = null;

function isRecord(value: unknown): value is Record<string, any> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readStore(): FuriganaCorrectionStore {
    if (cachedStore) return cachedStore;
    const store = storage.getJSON<FuriganaCorrectionStore>(FURIGANA_CORRECTIONS_KEY, {});
    cachedStore = isRecord(store) ? store : {};
    return cachedStore;
}

function writeStore(store: FuriganaCorrectionStore): boolean {
    cachedStore = null;
    const saved = storage.setJSON(FURIGANA_CORRECTIONS_KEY, store);
    if (saved) revision++;
    return saved;
}

function readEntry(store: FuriganaCorrectionStore, trackUri: string): TrackFuriganaCorrections {
    const entry = store[trackUri];
    return {
        lines: isRecord(entry?.lines) ? entry!.lines : {},
        words: isRecord(entry?.words) ? entry!.words : {},
        updatedAt: entry?.updatedAt || 0,
        trackName: entry?.trackName,
        artistName: entry?.artistName
    };
}

function onlyStrings(record: Record<string, unknown>): Record<string, string> {
    const clean: Record<string, string> = {};
    Object.entries(record).forEach(([key, value]) => {
        if (key && typeof value === 'string') clean[key] = value;
    });
    return clean;
}

export function furiganaCorrectionsRevision(): number {
    return revision;
}

export function getFuriganaCorrections(trackUri: string | null | undefined, lineText: string): FuriganaCorrectionSet | null {
    if (!trackUri) return null;
    const entry = readEntry(readStore(), trackUri);
    const lines = isRecord(entry.lines[lineText]) ? onlyStrings(entry.lines[lineText]) : {};
    const words = onlyStrings(entry.words);
    if (Object.keys(lines).length === 0 && Object.keys(words).length === 0) return null;
    return { lines, words };
}

export function hasFuriganaCorrections(trackUri: string | null | undefined): boolean {
    if (!trackUri) return false;
    const entry = readEntry(readStore(), trackUri);
    return Object.keys(entry.words).length > 0 || Object.values(entry.lines).some(line => isRecord(line) && Object.keys(line).length > 0);
}

function persist(store: FuriganaCorrectionStore, trackUri: string, entry: TrackFuriganaCorrections): boolean {
    Object.keys(entry.lines).forEach(lineText => {
        if (!isRecord(entry.lines[lineText]) || Object.keys(entry.lines[lineText]).length === 0) delete entry.lines[lineText];
    });
    if (Object.keys(entry.lines).length === 0 && Object.keys(entry.words).length === 0) delete store[trackUri];
    else store[trackUri] = { ...entry, updatedAt: Date.now() };
    return writeStore(store);
}

export function saveFuriganaCorrection(
    trackUri: string,
    target: FuriganaCorrectionTarget,
    reading: string,
    scope: FuriganaCorrectionScope,
    meta: { trackName?: string; artistName?: string } = {}
): boolean {
    if (!trackUri || !target.lineText || target.end <= target.start) return false;
    const store = readStore();
    const entry = readEntry(store, trackUri);
    const rangeKey = correctionRangeKey(target.start, target.end);
    const surface = target.lineText.slice(target.start, target.end);
    const value = normalizeReading(reading);
    const line = isRecord(entry.lines[target.lineText]) ? { ...entry.lines[target.lineText] } : {};

    if (scope === 'song') {
        entry.words = { ...entry.words, [surface]: value };
        delete line[rangeKey];
    } else {
        line[rangeKey] = value;
    }
    entry.lines = { ...entry.lines, [target.lineText]: line };
    entry.trackName = meta.trackName || entry.trackName;
    entry.artistName = meta.artistName || entry.artistName;
    return persist(store, trackUri, entry);
}

export function clearFuriganaCorrection(trackUri: string, target: FuriganaCorrectionTarget): boolean {
    if (!trackUri || !target.lineText) return false;
    const store = readStore();
    const entry = readEntry(store, trackUri);
    const surface = target.lineText.slice(target.start, target.end);
    const line = isRecord(entry.lines[target.lineText]) ? { ...entry.lines[target.lineText] } : {};
    delete line[correctionRangeKey(target.start, target.end)];
    const words = { ...entry.words };
    delete words[surface];
    entry.lines = { ...entry.lines, [target.lineText]: line };
    entry.words = words;
    return persist(store, trackUri, entry);
}

export function clearTrackFuriganaCorrections(trackUri: string): boolean {
    const store = { ...readStore() };
    if (!store[trackUri]) return true;
    delete store[trackUri];
    return writeStore(store);
}
