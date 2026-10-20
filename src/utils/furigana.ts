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

export type FuriganaSource = 'auto' | 'line' | 'song';

export interface ResolvedFuriganaSegment extends FuriganaSegment {
    auto: string;
    source: FuriganaSource;
}

export interface FuriganaCorrectionSet {
    lines: Record<string, string>;
    words: Record<string, string>;
}

export interface DictionaryEntry {
    surface: string;
    pos: string;
    posDetail: string;
    base: string;
    reading: string;
}

const MAX_READING_LENGTH = 32;

export function normalizeReading(input: string | null | undefined): string {
    const compact = (input || '').normalize('NFKC').replace(/\s+/g, '');
    return toHiragana(compact).slice(0, MAX_READING_LENGTH);
}

export function correctionRangeKey(start: number, end: number): string {
    return `${start}-${end}`;
}

export function uncoveredKanjiRuns(text: string, segments: FuriganaSegment[]): FuriganaSegment[] {
    const covered = new Array<boolean>(text.length).fill(false);
    segments.forEach(segment => {
        for (let i = segment.start; i < segment.end && i < text.length; i++) covered[i] = true;
    });
    const runs: FuriganaSegment[] = [];
    let offset = 0;
    for (const char of Array.from(text)) {
        const free = isKanji(char) && !covered[offset];
        const last = runs[runs.length - 1];
        if (free && last && last.end === offset) last.end += char.length;
        else if (free) runs.push({ start: offset, end: offset + char.length, reading: '' });
        offset += char.length;
    }
    return runs;
}

export function resolveFuriganaSegments(
    text: string,
    segments: FuriganaSegment[],
    corrections: FuriganaCorrectionSet | null,
    includeUncovered: boolean = false
): ResolvedFuriganaSegment[] {
    const candidates = includeUncovered || corrections
        ? [...segments, ...uncoveredKanjiRuns(text, segments)].sort((a, b) => a.start - b.start)
        : segments;
    const resolved: ResolvedFuriganaSegment[] = [];
    for (const segment of candidates) {
        const lineReading = corrections?.lines[correctionRangeKey(segment.start, segment.end)];
        const songReading = corrections?.words[text.slice(segment.start, segment.end)];
        const source: FuriganaSource = typeof lineReading === 'string' ? 'line' : typeof songReading === 'string' ? 'song' : 'auto';
        const reading = source === 'line' ? lineReading! : source === 'song' ? songReading! : segment.reading;
        if (!reading && !includeUncovered) continue;
        resolved.push({ start: segment.start, end: segment.end, reading, auto: segment.reading, source });
    }
    return resolved;
}

export function parseDictionaryFeatures(features: string): DictionaryEntry | null {
    const fields = (features || '').split(',');
    if (fields.length < 9 || !fields[0]) return null;
    const reading = fields[8] && fields[8] !== '*' ? fields[8] : '';
    if (!reading) return null;
    return {
        surface: fields[0],
        pos: fields[1] || '',
        posDetail: fields[2] || '',
        base: fields[7] && fields[7] !== '*' ? fields[7] : fields[0],
        reading
    };
}

export function readingForSpan(surface: string, start: number, end: number, reading: string): string {
    if (!surface || !reading || start < 0 || end > surface.length || start >= end) return '';
    const spanText = surface.slice(start, end);
    if (!hasKanji(spanText)) return '';
    if (start === 0 && end === surface.length) {
        const whole = splitOkurigana(surface, reading);
        if (whole.length === 1 && whole[0].start === 0 && whole[0].end === surface.length) return whole[0].reading;
        if (whole.length === 0) return '';
    }
    const match = splitOkurigana(surface, reading).find(segment => segment.start === start && segment.end === end);
    return match ? match.reading : '';
}

export function rankReadingCandidates(
    autoReading: string,
    spanText: string,
    tokenSurface: string,
    tokenOffset: number,
    lookup: (word: string) => DictionaryEntry[]
): string[] {
    const primary: string[] = [];
    const secondary: string[] = [];
    const push = (list: string[], reading: string) => {
        const normalized = normalizeReading(reading);
        if (normalized && !primary.includes(normalized) && !secondary.includes(normalized)) list.push(normalized);
    };
    const isName = (entry: DictionaryEntry) => entry.posDetail === '固有名詞';
    const spanStart = tokenOffset;
    const spanEnd = tokenOffset + spanText.length;

    push(primary, autoReading);
    if (tokenSurface) {
        const tokenEntries = lookup(tokenSurface);
        tokenEntries.forEach(entry => {
            const reading = readingForSpan(tokenSurface, spanStart, spanEnd, entry.reading);
            if (reading) push(isName(entry) ? secondary : primary, reading);
        });
        const bases = Array.from(new Set(tokenEntries.map(entry => entry.base).filter(base => base !== tokenSurface)));
        bases.forEach(base => {
            if (base.slice(spanStart, spanEnd) !== spanText) return;
            lookup(base).forEach(entry => {
                const reading = readingForSpan(base, spanStart, spanEnd, entry.reading);
                if (reading) push(isName(entry) ? secondary : primary, reading);
            });
        });
    }
    if (spanText !== tokenSurface) {
        lookup(spanText).forEach(entry => push(isName(entry) ? secondary : primary, entry.reading));
    }
    return [...primary, ...secondary];
}
