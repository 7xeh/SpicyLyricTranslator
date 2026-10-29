import { storage } from './storage';
import { normalizeLyricMatchKey } from './text';

const USER_TRANSLATIONS_KEY = 'user-translations';
const UNLINKED_SEPARATOR = '#';

export interface UserTranslationMeta {
    trackName?: string;
    artistName?: string;
}

interface UserTranslationEntry extends UserTranslationMeta {
    lines: Record<string, string>;
    updatedAt: number;
}

type UserTranslationStore = Record<string, UserTranslationEntry>;

interface TranslatableResult {
    originalText: string;
    translatedText: string;
    wasTranslated?: boolean;
    source?: 'cache' | 'api' | 'user' | 'file';
    apiProvider?: string;
}

function entryKey(trackUri: string, targetLang: string): string {
    return `${trackUri}|${targetLang.toLowerCase()}`;
}

function readStore(): UserTranslationStore {
    const store = storage.getJSON<UserTranslationStore>(USER_TRANSLATIONS_KEY, {});
    return store && typeof store === 'object' && !Array.isArray(store) ? store : {};
}

export function userTranslationKey(sourceLine: string | null | undefined): string {
    return normalizeLyricMatchKey(sourceLine);
}

export function cleanUserTranslation(value: string | null | undefined): string {
    return (value || '').replace(/\s+/g, ' ').trim();
}

export function getUserTranslations(trackUri: string | null | undefined, targetLang: string): Map<string, string> {
    if (!trackUri || !targetLang) return new Map();
    const entry = readStore()[entryKey(trackUri, targetLang)];
    if (!entry || !entry.lines || typeof entry.lines !== 'object') return new Map();
    return new Map(Object.entries(entry.lines).filter(([key, value]) => key && typeof value === 'string' && value.trim()));
}

export function hasUserTranslations(trackUri: string | null | undefined, targetLang: string): boolean {
    return getUserTranslations(trackUri, targetLang).size > 0;
}

export function saveUserTranslations(
    trackUri: string,
    targetLang: string,
    lines: Map<string, string>,
    meta: UserTranslationMeta = {}
): boolean {
    const store = readStore();
    const key = entryKey(trackUri, targetLang);
    const cleaned: Record<string, string> = {};
    for (const [lineKey, value] of lines) {
        const translation = cleanUserTranslation(value);
        if (lineKey && translation) cleaned[lineKey] = translation;
    }

    if (Object.keys(cleaned).length === 0) {
        delete store[key];
    } else {
        store[key] = {
            lines: cleaned,
            updatedAt: Date.now(),
            trackName: meta.trackName || store[key]?.trackName,
            artistName: meta.artistName || store[key]?.artistName
        };
    }
    return storage.setJSON(USER_TRANSLATIONS_KEY, store);
}

export function isKeepOriginal(sourceLine: string, translation: string): boolean {
    const sourceKey = userTranslationKey(sourceLine);
    return Boolean(sourceKey) && sourceKey === userTranslationKey(translation);
}

export function unlinkedTranslationKey(key: string, occurrence: number): string {
    return `${key}${UNLINKED_SEPARATOR}${occurrence}`;
}

export function isUnlinkedTranslationKey(key: string): boolean {
    return key.includes(UNLINKED_SEPARATOR);
}

export function lineOccurrences(sourceLines: string[]): number[] {
    const seen = new Map<string, number>();
    return sourceLines.map(line => {
        const key = userTranslationKey(line);
        if (!key) return 0;
        const occurrence = (seen.get(key) || 0) + 1;
        seen.set(key, occurrence);
        return occurrence;
    });
}

function hasUnlinkedTranslations(userLines: Map<string, string>): boolean {
    for (const key of userLines.keys()) {
        if (isUnlinkedTranslationKey(key)) return true;
    }
    return false;
}

function unlinkedTranslation(userLines: Map<string, string>, sourceLine: string, occurrence: number): string | undefined {
    const key = userTranslationKey(sourceLine);
    return key && occurrence > 0 ? userLines.get(unlinkedTranslationKey(key, occurrence)) : undefined;
}

export function findUnlinkedLines(sourceLines: string[], userLines: Map<string, string>): Set<number> {
    const unlinked = new Set<number>();
    if (!hasUnlinkedTranslations(userLines)) return unlinked;
    lineOccurrences(sourceLines).forEach((occurrence, index) => {
        if (unlinkedTranslation(userLines, sourceLines[index], occurrence)) unlinked.add(index);
    });
    return unlinked;
}

export function applyUserTranslations<T extends TranslatableResult>(
    results: T[],
    sourceLines: string[],
    userLines: Map<string, string>,
    source: 'user' | 'file' = 'user',
    byOccurrence = false
): T[] {
    if (userLines.size === 0) return results;
    const lines = results.map((result, index) => sourceLines[index] ?? result.originalText);
    const occurrences = byOccurrence && hasUnlinkedTranslations(userLines) ? lineOccurrences(lines) : null;
    return results.map((result, index) => {
        const sourceLine = lines[index];
        const translation = (occurrences && unlinkedTranslation(userLines, sourceLine, occurrences[index]))
            || userLines.get(userTranslationKey(sourceLine));
        if (!translation) return result;
        const keepOriginal = isKeepOriginal(sourceLine, translation);
        return {
            ...result,
            translatedText: keepOriginal ? sourceLine : translation,
            wasTranslated: !keepOriginal,
            source,
            apiProvider: undefined
        };
    });
}

export function coversAllLines(sourceLines: string[], userLines: Map<string, string>): boolean {
    if (userLines.size === 0) return false;
    const occurrences = lineOccurrences(sourceLines);
    return sourceLines.every((line, index) => {
        const key = userTranslationKey(line);
        return !key || userLines.has(key) || userLines.has(unlinkedTranslationKey(key, occurrences[index]));
    });
}

export default {
    userTranslationKey,
    cleanUserTranslation,
    getUserTranslations,
    hasUserTranslations,
    saveUserTranslations,
    applyUserTranslations,
    coversAllLines,
    isKeepOriginal,
    unlinkedTranslationKey,
    isUnlinkedTranslationKey,
    lineOccurrences,
    findUnlinkedLines
};
