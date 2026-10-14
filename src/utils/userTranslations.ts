import { storage } from './storage';
import { normalizeLyricMatchKey } from './text';

const USER_TRANSLATIONS_KEY = 'user-translations';

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

export function applyUserTranslations<T extends TranslatableResult>(
    results: T[],
    sourceLines: string[],
    userLines: Map<string, string>,
    source: 'user' | 'file' = 'user'
): T[] {
    if (userLines.size === 0) return results;
    return results.map((result, index) => {
        const sourceLine = sourceLines[index] ?? result.originalText;
        const translation = userLines.get(userTranslationKey(sourceLine));
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
    return sourceLines.every(line => {
        const key = userTranslationKey(line);
        return !key || userLines.has(key);
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
    isKeepOriginal
};
