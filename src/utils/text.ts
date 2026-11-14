const INVISIBLE_SEPARATOR_REGEX = /[​⁠﻿]/g;
const DIRECTION_MARK_REGEX = /[‎‏]/g;
const ZERO_WIDTH_REGEX = /[​‎‏⁠﻿]/g;
const HAN_REGEX = /\p{Script=Han}/u;
const KANA_OR_HANGUL_REGEX = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const SYLLABLE_HYPHEN_REGEX = /(?<=\p{L})[-‐‑](?=\p{L})/gu;

export const SPICY_ROMANIZED_ROW_CLASS = 'RomanizedRow';

export function cleanLyricText(text: string | undefined | null): string {
    return (text || '').replace(DIRECTION_MARK_REGEX, '').replace(INVISIBLE_SEPARATOR_REGEX, ' ').replace(/\s+/g, ' ').trim();
}

export function normalizeLyricMatchKey(text: string | undefined | null): string {
    return (text || '').toLowerCase().replace(/[\s\p{P}\p{S}​-‏⁠﻿]+/gu, '').trim();
}

export function hasLyricText(text: unknown): text is string {
    return typeof text === 'string' && text.replace(ZERO_WIDTH_REGEX, '').trim() !== '';
}

export function pickLyricDisplayText(text: string | undefined | null, romanizedText: string | undefined | null): string {
    if (hasLyricText(text)) return text;
    return hasLyricText(romanizedText) ? romanizedText : (text ?? '');
}

export function isSpicyRomanizedRow(node: Node | null | undefined): boolean {
    if (!node || node.nodeType !== 1) return false;
    return Boolean((node as Element).classList?.contains(SPICY_ROMANIZED_ROW_CLASS));
}

export function lineOwnText(line: Element | null | undefined): string {
    if (!line) return '';
    const rows = typeof line.querySelectorAll === 'function' ? line.querySelectorAll(`.${SPICY_ROMANIZED_ROW_CLASS}`) : null;
    if (!rows || rows.length === 0 || !line.childNodes) return line.textContent || '';

    let text = '';
    line.childNodes.forEach(node => {
        if (isSpicyRomanizedRow(node)) return;
        text += node.textContent || '';
    });
    return text;
}

export function usesSyllableHyphens(originalText: string | undefined | null): boolean {
    const original = originalText || '';
    return HAN_REGEX.test(original) && !KANA_OR_HANGUL_REGEX.test(original);
}

export function formatRomanization(romanizedText: string | undefined | null, originalText: string | undefined | null): string {
    const romanized = (romanizedText || '').replace(ZERO_WIDTH_REGEX, '');
    const spaced = usesSyllableHyphens(originalText) ? romanized.replace(SYLLABLE_HYPHEN_REGEX, ' ') : romanized;
    return spaced.replace(/\s+/g, ' ').trim();
}
