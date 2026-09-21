const INVISIBLE_SEPARATOR_REGEX = /[\u200B\u2060\uFEFF]/g;
const DIRECTION_MARK_REGEX = /[\u200E\u200F]/g;
const ZERO_WIDTH_REGEX = /[\u200B\u200E\u200F\u2060\uFEFF]/g;

export function cleanLyricText(text: string | undefined | null): string {
    return (text || '').replace(DIRECTION_MARK_REGEX, '').replace(INVISIBLE_SEPARATOR_REGEX, ' ').replace(/\s+/g, ' ').trim();
}

export function normalizeLyricMatchKey(text: string | undefined | null): string {
    return (text || '').toLowerCase().replace(/[\s\p{P}\p{S}\u200B-\u200F\u2060\uFEFF]+/gu, '').trim();
}

export function hasLyricText(text: unknown): text is string {
    return typeof text === 'string' && text.replace(ZERO_WIDTH_REGEX, '').trim() !== '';
}

export function pickLyricDisplayText(text: string | undefined | null, romanizedText: string | undefined | null): string {
    if (hasLyricText(text)) return text;
    return hasLyricText(romanizedText) ? romanizedText : (text ?? '');
}
