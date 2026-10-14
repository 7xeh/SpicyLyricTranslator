export interface FuriganaToken {
    surface_form: string;
    reading?: string;
    word_position?: number;
}

export interface FuriganaSegment {
    start: number;
    end: number;
    reading: string;
}

const KANJI_REGEX = /[㐀-䶿一-鿿豈-﫿々〆〇ヵヶ]/;
const KANA_REGEX = /[ぁ-ゖァ-ヺ]/g;

export function isKanji(char: string): boolean {
    return KANJI_REGEX.test(char);
}

export function hasKanji(text: string | null | undefined): boolean {
    return Boolean(text) && Array.from(text!).some(isKanji);
}

export function countKana(text: string | null | undefined): number {
    return (text || '').match(KANA_REGEX)?.length || 0;
}

export function toHiragana(text: string): string {
    return text.replace(/[ァ-ヶ]/g, char => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

function escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitRuns(surface: string): { text: string; kanji: boolean; offset: number }[] {
    const runs: { text: string; kanji: boolean; offset: number }[] = [];
    let offset = 0;
    for (const char of Array.from(surface)) {
        const kanji = isKanji(char);
        const last = runs[runs.length - 1];
        if (last && last.kanji === kanji) last.text += char;
        else runs.push({ text: char, kanji, offset });
        offset += char.length;
    }
    return runs;
}

export function splitOkurigana(surface: string, reading: string): FuriganaSegment[] {
    if (!surface || !reading || !hasKanji(surface)) return [];
    const hiraganaReading = toHiragana(reading);
    if (toHiragana(surface) === hiraganaReading) return [];

    const runs = splitRuns(surface);
    const pattern = new RegExp(`^${runs.map(run => (run.kanji ? '(.+?)' : escapeRegex(toHiragana(run.text)))).join('')}$`);
    const match = hiraganaReading.match(pattern);
    if (match) {
        let group = 1;
        return runs.flatMap(run => {
            if (!run.kanji) return [];
            const value = match[group++];
            return value ? [{ start: run.offset, end: run.offset + run.text.length, reading: value }] : [];
        });
    }

    const kanjiRuns = runs.filter(run => run.kanji);
    const first = kanjiRuns[0];
    const last = kanjiRuns[kanjiRuns.length - 1];
    const prefix = toHiragana(surface.slice(0, first.offset));
    const suffix = toHiragana(surface.slice(last.offset + last.text.length));
    const trimmed = hiraganaReading.startsWith(prefix) && hiraganaReading.endsWith(suffix) && hiraganaReading.length > prefix.length + suffix.length
        ? hiraganaReading.slice(prefix.length, hiraganaReading.length - suffix.length)
        : hiraganaReading;
    return [{ start: first.offset, end: last.offset + last.text.length, reading: trimmed }];
}

export function buildFuriganaSegments(tokens: FuriganaToken[]): FuriganaSegment[] {
    const segments: FuriganaSegment[] = [];
    let cursor = 0;
    for (const token of tokens) {
        const surface = token.surface_form || '';
        const start = typeof token.word_position === 'number' && token.word_position > 0 ? token.word_position - 1 : cursor;
        cursor = start + surface.length;
        const reading = token.reading && token.reading !== '*' ? token.reading : '';
        if (!reading) continue;
        splitOkurigana(surface, reading).forEach(segment => segments.push({
            start: start + segment.start,
            end: start + segment.end,
            reading: segment.reading
        }));
    }
    return segments;
}
