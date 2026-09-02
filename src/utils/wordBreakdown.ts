export type BreakdownConfidence = 'high' | 'medium' | 'low';

export interface BreakdownToken {
    source: string;
    target: string;
    lemma?: string;
    pos?: string;
    note?: string;
    confidence: BreakdownConfidence;
}

export interface LineBreakdown {
    tokens: BreakdownToken[];
    origin: 'heuristic' | 'model';
}

const HAN_RANGE = /[一-鿿㐀-䶿]/;
const HIRAGANA_RANGE = /[぀-ゟ]/;
const KATAKANA_RANGE = /[゠-ヿㇰ-ㇿ]/;
const HANGUL_RANGE = /[가-힯ᄀ-ᇿ㄰-㆏]/;
const CJK_RANGE = /[一-鿿㐀-䶿぀-ゟ゠-ヿ가-힯ᄀ-ᇿ]/;

const TRIM_EDGE_PUNCT = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

type CharClass = 'han' | 'hiragana' | 'katakana' | 'hangul' | 'word' | 'space' | 'other';

function classifyChar(ch: string): CharClass {
    if (/\s/.test(ch)) return 'space';
    if (HAN_RANGE.test(ch)) return 'han';
    if (HIRAGANA_RANGE.test(ch)) return 'hiragana';
    if (KATAKANA_RANGE.test(ch)) return 'katakana';
    if (HANGUL_RANGE.test(ch)) return 'hangul';
    if (/[\p{L}\p{N}]/u.test(ch)) return 'word';
    return 'other';
}

export function hasCjk(text: string): boolean {
    return CJK_RANGE.test(text || '');
}

function splitHanRun(run: string): string[] {
    if (run.length <= 3) return [run];
    const parts: string[] = [];
    for (let i = 0; i < run.length; i += 2) {
        parts.push(run.slice(i, i + 2));
    }
    if (parts.length > 1 && parts[parts.length - 1].length === 1) {
        parts[parts.length - 2] += parts[parts.length - 1];
        parts.pop();
    }
    return parts;
}

export function segmentSourceText(text: string): string[] {
    const raw = (text || '').trim();
    if (!raw) return [];

    if (!hasCjk(raw)) {
        return raw
            .split(/\s+/)
            .map(token => token.replace(TRIM_EDGE_PUNCT, ''))
            .filter(Boolean);
    }

    const tokens: string[] = [];
    let current = '';
    let currentClass: CharClass | null = null;
    let sawHiragana = false;

    const flush = (): void => {
        const trimmed = current.replace(TRIM_EDGE_PUNCT, '');
        if (trimmed) {
            if (currentClass === 'han' && !sawHiragana) {
                tokens.push(...splitHanRun(trimmed));
            } else {
                tokens.push(trimmed);
            }
        }
        current = '';
        currentClass = null;
        sawHiragana = false;
    };

    for (const ch of raw) {
        const cls = classifyChar(ch);

        if (cls === 'space' || cls === 'other') {
            if (cls === 'other' && current) {
                current += ch;
                continue;
            }
            flush();
            continue;
        }

        if (cls === 'hiragana' && (currentClass === 'han' || currentClass === 'hiragana')) {
            current += ch;
            sawHiragana = true;
            continue;
        }

        if (cls === currentClass && !(cls === 'han' && sawHiragana)) {
            current += ch;
            continue;
        }

        flush();
        current = ch;
        currentClass = cls;
        sawHiragana = cls === 'hiragana';
    }

    flush();
    return tokens.filter(Boolean);
}

export function segmentTargetText(text: string): string[] {
    return (text || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
}

export function normalizeToken(text: string): string {
    return (text || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]/gu, '');
}

function bigrams(value: string): string[] {
    if (value.length < 2) return value ? [value] : [];
    const grams: string[] = [];
    for (let i = 0; i < value.length - 1; i++) {
        grams.push(value.slice(i, i + 2));
    }
    return grams;
}

export function similarity(a: string, b: string): number {
    const left = normalizeToken(a);
    const right = normalizeToken(b);
    if (!left || !right) return 0;
    if (left === right) return 1;
    if (left.length < 3 || right.length < 3) return 0;

    const leftGrams = bigrams(left);
    const rightPool = new Map<string, number>();
    for (const gram of bigrams(right)) {
        rightPool.set(gram, (rightPool.get(gram) || 0) + 1);
    }

    let hits = 0;
    for (const gram of leftGrams) {
        const available = rightPool.get(gram) || 0;
        if (available > 0) {
            hits++;
            rightPool.set(gram, available - 1);
        }
    }

    return (2 * hits) / (leftGrams.length + bigrams(right).length);
}

const ANCHOR_THRESHOLD = 0.62;

interface AnchorPair {
    sourceIndex: number;
    targetIndex: number;
    score: number;
}

function findAnchorCandidates(sourceTokens: string[], targetTokens: string[]): AnchorPair[] {
    const candidates: AnchorPair[] = [];

    for (let s = 0; s < sourceTokens.length; s++) {
        const sourceNorm = normalizeToken(sourceTokens[s]);
        if (!sourceNorm) continue;

        let best: AnchorPair | null = null;
        for (let t = 0; t < targetTokens.length; t++) {
            const score = similarity(sourceTokens[s], targetTokens[t]);
            if (score < ANCHOR_THRESHOLD) continue;
            if (!best || score > best.score) {
                best = { sourceIndex: s, targetIndex: t, score };
            }
        }

        if (best) candidates.push(best);
    }

    return candidates;
}

export function monotonicAnchors(candidates: AnchorPair[]): AnchorPair[] {
    if (candidates.length === 0) return [];

    const ordered = [...candidates].sort((a, b) => a.sourceIndex - b.sourceIndex);
    const best: number[] = new Array(ordered.length).fill(1);
    const previous: number[] = new Array(ordered.length).fill(-1);
    let bestEnd = 0;

    for (let i = 0; i < ordered.length; i++) {
        for (let j = 0; j < i; j++) {
            if (ordered[j].targetIndex < ordered[i].targetIndex && best[j] + 1 > best[i]) {
                best[i] = best[j] + 1;
                previous[i] = j;
            }
        }
        if (best[i] > best[bestEnd]) bestEnd = i;
    }

    const chain: AnchorPair[] = [];
    for (let i = bestEnd; i >= 0; i = previous[i]) {
        chain.push(ordered[i]);
        if (previous[i] === -1) break;
    }

    return chain.reverse();
}

const TARGET_FUNCTION_WORDS: Record<string, string[]> = {
    en: ['the', 'a', 'an', 'of', 'to', 'will', 'would', 'shall', 'should', 'is', 'are', 'am', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did'],
    es: ['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al'],
    fr: ['le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'au', 'aux'],
    de: ['der', 'die', 'das', 'den', 'dem', 'ein', 'eine', 'einen', 'einem', 'zu'],
    pt: ['o', 'a', 'os', 'as', 'um', 'uma', 'de', 'do', 'da', 'dos', 'das', 'ao'],
    it: ['il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'una', 'di', 'del', 'della', 'al'],
    nl: ['de', 'het', 'een', 'van', 'te'],
    sv: ['en', 'ett', 'att', 'av']
};

function targetFunctionWords(targetLang?: string): Set<string> {
    const base = (targetLang || '').toLowerCase().split(/[-_]/)[0];
    return new Set(TARGET_FUNCTION_WORDS[base] || []);
}

export function chunkTargetSpan(words: string[], targetLang?: string): string[] {
    const functionWords = targetFunctionWords(targetLang);
    if (functionWords.size === 0 || words.length < 2) return words.slice();

    const chunks: string[] = [];
    let pending: string[] = [];

    for (const word of words) {
        pending.push(word);
        if (!functionWords.has(normalizeToken(word))) {
            chunks.push(pending.join(' '));
            pending = [];
        }
    }

    if (pending.length > 0) {
        if (chunks.length > 0) {
            chunks[chunks.length - 1] += ` ${pending.join(' ')}`;
        } else {
            chunks.push(pending.join(' '));
        }
    }

    return chunks;
}

function distributeProportional(
    sourceSpan: string[],
    targetSpan: string[],
    targetLang?: string
): DistributedPair[] {
    if (sourceSpan.length === 0 && targetSpan.length === 0) return [];
    if (sourceSpan.length === 0) return [{ source: '', target: targetSpan.join(' '), exact: false }];
    if (targetSpan.length === 0) return sourceSpan.map(source => ({ source, target: '', exact: false }));

    if (sourceSpan.length === targetSpan.length) {
        return sourceSpan.map((source, index) => ({ source, target: targetSpan[index], exact: true }));
    }

    const chunks = chunkTargetSpan(targetSpan, targetLang);

    if (sourceSpan.length === chunks.length) {
        return sourceSpan.map((source, index) => ({ source, target: chunks[index], exact: true }));
    }

    const weights = sourceSpan.map(token => Math.max(normalizeToken(token).length, 1));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

    const pairs: DistributedPair[] = [];
    let consumed = 0;

    sourceSpan.forEach((source, index) => {
        const isLast = index === sourceSpan.length - 1;
        const share = isLast
            ? chunks.length - consumed
            : Math.max(0, Math.round((weights[index] / totalWeight) * chunks.length));
        const take = isLast ? Math.max(share, 0) : Math.min(share, chunks.length - consumed);
        pairs.push({ source, target: chunks.slice(consumed, consumed + take).join(' '), exact: false });
        consumed += take;
    });

    if (consumed < chunks.length && pairs.length > 0) {
        const tail = chunks.slice(consumed).join(' ');
        const last = pairs[pairs.length - 1];
        last.target = last.target ? `${last.target} ${tail}` : tail;
    }

    const merged = mergeEmptyTargets(pairs);
    if (merged.length === chunks.length && merged.every(pair => pair.target)) {
        return merged.map(pair => ({ ...pair, exact: true }));
    }
    return merged;
}

interface DistributedPair {
    source: string;
    target: string;
    exact: boolean;
}

function mergeEmptyTargets(pairs: DistributedPair[]): DistributedPair[] {
    const merged: DistributedPair[] = [];

    for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        if (pair.target || !pair.source) {
            merged.push({ ...pair });
            continue;
        }

        const next = pairs[i + 1];
        if (next) {
            next.source = `${pair.source} ${next.source}`.trim();
            continue;
        }

        if (merged.length > 0) {
            const previous = merged[merged.length - 1];
            previous.source = `${previous.source} ${pair.source}`.trim();
            continue;
        }

        merged.push({ ...pair });
    }

    return merged;
}

export function buildHeuristicBreakdown(sourceText: string, targetText: string, targetLang?: string): LineBreakdown {
    const sourceTokens = segmentSourceText(sourceText);
    const targetTokens = segmentTargetText(targetText);

    if (sourceTokens.length === 0 || targetTokens.length === 0) {
        return { tokens: [], origin: 'heuristic' };
    }

    const anchors = monotonicAnchors(findAnchorCandidates(sourceTokens, targetTokens));
    const tokens: BreakdownToken[] = [];

    let sourceCursor = 0;
    let targetCursor = 0;

    const pushSpan = (sourceEnd: number, targetEnd: number): void => {
        const sourceSpan = sourceTokens.slice(sourceCursor, sourceEnd);
        const targetSpan = targetTokens.slice(targetCursor, targetEnd);
        if (sourceSpan.length === 0 && targetSpan.length === 0) return;

        for (const pair of distributeProportional(sourceSpan, targetSpan, targetLang)) {
            if (!pair.source && !pair.target) continue;
            tokens.push({ source: pair.source, target: pair.target, confidence: pair.exact ? 'medium' : 'low' });
        }
    };

    for (const anchor of anchors) {
        pushSpan(anchor.sourceIndex, anchor.targetIndex);
        tokens.push({
            source: sourceTokens[anchor.sourceIndex],
            target: targetTokens[anchor.targetIndex],
            confidence: 'high'
        });
        sourceCursor = anchor.sourceIndex + 1;
        targetCursor = anchor.targetIndex + 1;
    }

    pushSpan(sourceTokens.length, targetTokens.length);

    return { tokens: tokens.filter(token => token.source || token.target), origin: 'heuristic' };
}

function coerceConfidence(value: unknown): BreakdownConfidence {
    return value === 'high' || value === 'medium' || value === 'low' ? value : 'high';
}

function coerceString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function optionalString(value: unknown): string | undefined {
    const text = coerceString(value);
    return text ? text : undefined;
}

export function parseModelBreakdown(raw: string): BreakdownToken[] | null {
    const text = (raw || '').trim();
    if (!text) return null;

    const withoutFences = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const start = withoutFences.indexOf('[');
    const end = withoutFences.lastIndexOf(']');
    if (start === -1 || end === -1 || end <= start) return null;

    let parsed: unknown;
    try {
        parsed = JSON.parse(withoutFences.slice(start, end + 1));
    } catch {
        return null;
    }

    if (!Array.isArray(parsed)) return null;

    const tokens: BreakdownToken[] = [];
    for (const entry of parsed) {
        if (!entry || typeof entry !== 'object') continue;
        const record = entry as Record<string, unknown>;
        const source = coerceString(record.source ?? record.s);
        const target = coerceString(record.target ?? record.t);
        if (!source && !target) continue;
        tokens.push({
            source,
            target,
            lemma: optionalString(record.lemma ?? record.l),
            pos: optionalString(record.pos ?? record.p),
            note: optionalString(record.note ?? record.n),
            confidence: coerceConfidence(record.confidence)
        });
    }

    return tokens.length > 0 ? tokens : null;
}

export function buildBreakdownPrompt(sourceText: string, sourceLangName: string, targetLangName: string): string {
    return [
        `Break this ${sourceLangName} song lyric down word by word for a learner whose target language is ${targetLangName}.`,
        'Return ONLY a JSON array, no prose and no code fences.',
        'Each element must be an object with these keys:',
        '"source" (the token exactly as it appears in the lyric, in order),',
        `"target" (its meaning in ${targetLangName} in this context),`,
        '"lemma" (the dictionary form of the source token),',
        '"pos" (a short part-of-speech tag such as noun, verb, adj, adv, pron, prep, conj, part, num),',
        '"note" (a short note only when the token is idiomatic, slang, or grammatically notable; otherwise omit).',
        'Cover every meaningful token in order. Merge tokens only when they form one fixed expression.',
        '',
        sourceText
    ].join('\n');
}

export function breakdownCacheKey(sourceText: string, targetLang: string): string {
    return `${targetLang}:${(sourceText || '').replace(/\s+/g, ' ').trim().toLowerCase()}`;
}
