const INVISIBLE_SEPARATOR_REGEX = /[\u200B\u2060\uFEFF]/g;

export function cleanLyricText(text: string | undefined | null): string {
    return (text || '').replace(INVISIBLE_SEPARATOR_REGEX, ' ').replace(/\s+/g, ' ').trim();
}

export function normalizeLyricMatchKey(text: string | undefined | null): string {
    return (text || '').toLowerCase().replace(/[\s\p{P}\p{S}\u200B-\u200D\u2060\uFEFF]+/gu, '').trim();
}
