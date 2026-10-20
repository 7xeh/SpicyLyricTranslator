import { buildFuriganaSegments, countKana, hasKanji, parseDictionaryFeatures, rankReadingCandidates, resolveFuriganaSegments } from './furigana';
import type { DictionaryEntry, FuriganaSegment, FuriganaToken, ResolvedFuriganaSegment } from './furigana';
import { getFuriganaCorrections, furiganaCorrectionsRevision } from './furiganaCorrections';
import { openFuriganaEditor } from './furiganaEditor';
import { getSourceLanguageOverride } from './state';
import { getCurrentTrackUri } from './trackCache';
import { notify, dismissNotification } from './notify';
import { debug, warn } from './debug';

const KUROMOJI_VERSION = '0.1.2';
const KUROMOJI_SCRIPT_URL = `https://cdn.jsdelivr.net/npm/kuromoji@${KUROMOJI_VERSION}/build/kuromoji.js`;
const KUROMOJI_DICT_URL = `https://cdn.jsdelivr.net/npm/kuromoji@${KUROMOJI_VERSION}/dict`;
const LOAD_RETRY_DELAY_MS = 60000;

const STYLE_ID = 'slt-furigana-styles';
const READING_CLASS = 'slt-furigana';
const LINE_CLASS = 'slt-furigana-line';
const TEXT_LINE_CLASS = 'slt-furigana-text-line';
const EDITING_CLASS = 'slt-furigana-editing';
const EDIT_TOAST_KEY = 'slt-furigana-edit-mode';
const EDIT_EVENTS = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick'];
const MAX_CANDIDATES = 12;
const LINE_SELECTOR = '#SpicyLyricsPage .line:not(.musical-line)';
const HOST_SELECTOR = '.letter, .word, .line';
const MIN_KANA_FOR_JAPANESE = 3;
const MAX_CACHED_LINES = 600;
const PASS_DELAY_MS = 60;

const FURIGANA_STYLES = `
#SpicyLyricsPage .line.${LINE_CLASS} {
    padding-top: 0.5em !important;
    row-gap: 0.65em !important;
}
#SpicyLyricsPage .line.${LINE_CLASS}.${TEXT_LINE_CLASS} {
    padding-top: 0.2em !important;
    --lyrics-line-height: 1.85 !important;
}
#SpicyLyricsPage .line .${READING_CLASS} {
    position: absolute;
    height: 0;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    pointer-events: none;
    user-select: none;
    background: none !important;
    --gradient-degrees: 90deg;
}
#SpicyLyricsPage .line .${READING_CLASS}::before {
    content: attr(data-slt-reading);
    display: block;
    font-size: 0.45em;
    font-weight: 600;
    line-height: 1.15;
    letter-spacing: 0.04em;
    white-space: nowrap;
    padding-bottom: 0.1em;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    -webkit-background-clip: text;
}
.${EDITING_CLASS} #SpicyLyricsPage .line .${READING_CLASS} {
    pointer-events: auto;
    cursor: pointer;
}
.${EDITING_CLASS} #SpicyLyricsPage .line .${READING_CLASS}::after {
    content: '';
    position: absolute;
    left: -0.06em;
    right: -0.06em;
    top: -0.62em;
    height: 1.72em;
    border-radius: 0.18em;
    outline: 0.04em dashed rgba(255, 255, 255, 0.4);
    transition: background 0.15s ease, outline-color 0.15s ease;
}
.${EDITING_CLASS} #SpicyLyricsPage .line .${READING_CLASS}:hover::after {
    background: rgba(255, 255, 255, 0.1);
    outline-color: rgba(255, 255, 255, 0.85);
}
.${EDITING_CLASS} #SpicyLyricsPage .line .${READING_CLASS}[data-slt-source="line"]::after,
.${EDITING_CLASS} #SpicyLyricsPage .line .${READING_CLASS}[data-slt-source="song"]::after {
    outline-style: solid;
    outline-color: rgba(255, 196, 120, 0.75);
}
.${EDITING_CLASS} #SpicyLyricsPage .line .${READING_CLASS}[data-slt-reading=""]::before {
    content: '?';
}
#SpicyLyricsPage .line.Active .${READING_CLASS}::before,
#SpicyLyricsPage .line.static .${READING_CLASS}::before {
    background-image: linear-gradient(
        var(--gradient-degrees),
        rgba(255, 255, 255, var(--gradient-alpha, 0.85)) var(--gradient-position, 100%),
        rgba(255, 255, 255, var(--gradient-alpha-end, 0.5)) calc(var(--gradient-position, 100%) + 20% + var(--gradient-offset, 0%))
    );
}
`;

interface KuromojiTokenizer {
    tokenize(text: string): FuriganaToken[];
    viterbi_builder?: { trie?: { commonPrefixSearch?: (key: string) => { k: string; v: number }[] } };
    token_info_dictionary?: { target_map?: Record<string, (number | string)[]>; getFeatures?: (id: number | string) => string };
}

interface LineAnalysis {
    tokens: FuriganaToken[];
    segments: FuriganaSegment[];
}

interface LineText {
    text: string;
    nodes: Text[];
    starts: number[];
}

interface PlannedReading {
    host: HTMLElement;
    segment: ResolvedFuriganaSegment;
    reading: string;
    left: number;
    top: number;
    width: number;
}

let enabled = false;
let tokenizer: KuromojiTokenizer | null = null;
let tokenizerPromise: Promise<KuromojiTokenizer | null> | null = null;
let loadFailureNotified = false;
let lastLoadFailureAt = -Infinity;
let passTimer: ReturnType<typeof setTimeout> | null = null;
let passRunning = false;
const analysisCache = new Map<string, LineAnalysis>();
let editing = false;
const editListeners = new Map<Window, (event: Event) => void>();
const lineSignatures = new WeakMap<Element, string>();
const observers = new Map<Document, MutationObserver>();
let resizeObserver: ResizeObserver | null = null;
let resizeTargets = new WeakSet<Element>();

function loadKuromojiScript(): Promise<any> {
    const existing = (window as any).kuromoji;
    if (existing?.builder) return Promise.resolve(existing);

    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = KUROMOJI_SCRIPT_URL;
        script.async = true;
        script.dataset.slt = 'kuromoji';
        script.onload = () => {
            const loaded = (window as any).kuromoji;
            if (loaded?.builder) resolve(loaded);
            else reject(new Error('Kuromoji loaded without a builder'));
        };
        script.onerror = () => reject(new Error(`Could not load ${KUROMOJI_SCRIPT_URL}`));
        document.head.appendChild(script);
    });
}

function loadTokenizer(): Promise<KuromojiTokenizer | null> {
    if (tokenizer) return Promise.resolve(tokenizer);
    if (tokenizerPromise) return tokenizerPromise;
    if (Date.now() - lastLoadFailureAt < LOAD_RETRY_DELAY_MS) return Promise.resolve(null);

    const started = Date.now();
    tokenizerPromise = loadKuromojiScript()
        .then(kuromoji => new Promise<KuromojiTokenizer>((resolve, reject) => {
            kuromoji.builder({ dicPath: KUROMOJI_DICT_URL }).build((error: unknown, built: KuromojiTokenizer) => {
                if (error || !built) reject(error || new Error('Kuromoji returned no tokenizer'));
                else resolve(built);
            });
        }))
        .then(built => {
            tokenizer = built;
            debug(`furigana: dictionary ready in ${Date.now() - started}ms`);
            return built;
        })
        .catch(error => {
            warn('furigana: could not load the Japanese dictionary', error);
            tokenizerPromise = null;
            lastLoadFailureAt = Date.now();
            if (!loadFailureNotified && enabled) {
                loadFailureNotified = true;
                notify({
                    kind: 'warning',
                    key: 'slt-furigana-load',
                    title: "Furigana couldn't load",
                    description: 'The Japanese dictionary failed to download. It tries again in a minute, or when you turn furigana back on.',
                    inbox: false,
                });
            }
            return null;
        });

    return tokenizerPromise;
}

function getDocuments(): Document[] {
    const docs: Document[] = [document];
    try {
        const pip = (globalThis as any).documentPictureInPicture?.window as Window | undefined;
        if (pip?.document) docs.push(pip.document);
    } catch (e) {}
    return docs;
}

function ensureStyles(doc: Document): void {
    if (doc.getElementById(STYLE_ID)) return;
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = FURIGANA_STYLES;
    (doc.head || doc.documentElement).appendChild(style);
}

function readLineText(line: Element): LineText {
    const doc = line.ownerDocument;
    const walker = doc.createTreeWalker(line, NodeFilter.SHOW_TEXT, {
        acceptNode: node => {
            const owner = node.parentElement?.closest('[class*="slt-"]');
            return owner && owner !== line && line.contains(owner) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
        }
    });
    const nodes: Text[] = [];
    const starts: number[] = [];
    let text = '';
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const value = node.nodeValue || '';
        if (!value) continue;
        nodes.push(node as Text);
        starts.push(text.length);
        text += value;
    }
    return { text, nodes, starts };
}

function locate(lineText: LineText, index: number): { node: Text; offset: number } | null {
    for (let i = lineText.nodes.length - 1; i >= 0; i--) {
        if (lineText.starts[i] <= index) return { node: lineText.nodes[i], offset: index - lineText.starts[i] };
    }
    return null;
}

function analyze(text: string): LineAnalysis {
    const cached = analysisCache.get(text);
    if (cached) return cached;
    let analysis: LineAnalysis = { tokens: [], segments: [] };
    try {
        const tokens = tokenizer ? tokenizer.tokenize(text) : [];
        analysis = { tokens, segments: buildFuriganaSegments(tokens) };
    } catch (error) {
        warn('furigana: tokenize failed', error);
    }
    if (analysisCache.size >= MAX_CACHED_LINES) {
        const oldest = analysisCache.keys().next().value;
        if (oldest !== undefined) analysisCache.delete(oldest);
    }
    analysisCache.set(text, analysis);
    return analysis;
}

function segmentsFor(text: string): ResolvedFuriganaSegment[] {
    const corrections = getFuriganaCorrections(getCurrentTrackUri(), text);
    return resolveFuriganaSegments(text, analyze(text).segments, corrections, editing);
}

function lookupDictionary(word: string): DictionaryEntry[] {
    const trie = tokenizer?.viterbi_builder?.trie;
    const dictionary = tokenizer?.token_info_dictionary;
    if (!word || !trie?.commonPrefixSearch || !dictionary?.target_map || !dictionary.getFeatures) return [];
    const entries: DictionaryEntry[] = [];
    try {
        for (const hit of trie.commonPrefixSearch(word)) {
            if (hit.k !== word) continue;
            for (const id of dictionary.target_map[hit.v] || []) {
                const entry = parseDictionaryFeatures(String(dictionary.getFeatures(id)));
                if (entry) entries.push(entry);
            }
        }
    } catch (error) {
        warn('furigana: dictionary lookup failed', error);
        return [];
    }
    return entries;
}

function readingCandidates(text: string, segment: ResolvedFuriganaSegment): string[] {
    const spanText = text.slice(segment.start, segment.end);
    let tokenSurface = spanText;
    let tokenOffset = 0;
    let cursor = 0;
    for (const token of analyze(text).tokens) {
        const surface = token.surface_form || '';
        const start = typeof token.word_position === 'number' && token.word_position > 0 ? token.word_position - 1 : cursor;
        cursor = start + surface.length;
        if (start <= segment.start && segment.end <= start + surface.length) {
            tokenSurface = surface;
            tokenOffset = segment.start - start;
            break;
        }
    }
    const ranked = rankReadingCandidates(segment.auto, spanText, tokenSurface, tokenOffset, lookupDictionary);
    if (segment.reading && !ranked.includes(segment.reading)) ranked.unshift(segment.reading);
    return ranked.slice(0, MAX_CANDIDATES);
}

function isJapaneseSong(lineTexts: string[]): boolean {
    const override = getSourceLanguageOverride(getCurrentTrackUri());
    if (override) return override.toLowerCase().startsWith('ja');
    let kana = 0;
    for (const text of lineTexts) {
        kana += countKana(text);
        if (kana >= MIN_KANA_FOR_JAPANESE) return true;
    }
    return false;
}

function clearLine(line: Element): void {
    line.querySelectorAll(`.${READING_CLASS}`).forEach(el => el.remove());
    line.classList.remove(LINE_CLASS, TEXT_LINE_CLASS);
    lineSignatures.delete(line);
}

function lineSignature(line: HTMLElement, text: string): string {
    const fontSize = line.ownerDocument.defaultView?.getComputedStyle(line).fontSize || '';
    return `${text}\u0000${line.offsetWidth}\u0000${fontSize}\u0000${furiganaCorrectionsRevision()}\u0000${editing ? 'edit' : ''}`;
}

function widestRow(rects: DOMRect[]): DOMRect | null {
    const rows: DOMRect[][] = [];
    for (const rect of rects) {
        const row = rows.find(items => Math.abs(items[0].top + items[0].height / 2 - (rect.top + rect.height / 2)) < rect.height / 2);
        if (row) row.push(rect);
        else rows.push([rect]);
    }
    let best: DOMRect | null = null;
    for (const row of rows) {
        const left = Math.min(...row.map(r => r.left));
        const right = Math.max(...row.map(r => r.right));
        const top = Math.min(...row.map(r => r.top));
        const bottom = Math.max(...row.map(r => r.bottom));
        if (!best || right - left > best.width) best = new DOMRect(left, top, right - left, bottom - top);
    }
    return best;
}

function planReadings(line: HTMLElement, lineText: LineText, segments: ResolvedFuriganaSegment[]): PlannedReading[] | null {
    const doc = line.ownerDocument;
    const view = doc.defaultView;
    const planned: PlannedReading[] = [];

    for (const segment of segments) {
        const start = locate(lineText, segment.start);
        const end = locate(lineText, segment.end - 1);
        if (!start || !end) continue;

        const host = (start.node.parentElement?.closest(HOST_SELECTOR) as HTMLElement | null) || line;
        if (!line.contains(host)) continue;

        const range = doc.createRange();
        range.setStart(start.node, start.offset);
        range.setEnd(end.node, Math.min(end.offset + 1, end.node.length));
        const rect = widestRow(Array.from(range.getClientRects()).filter(r => r.width > 0 && r.height > 0));
        if (!rect) return null;

        const hostRect = host.getBoundingClientRect();
        const scale = host.offsetWidth > 0 ? hostRect.width / host.offsetWidth : 1;
        const fontSize = parseFloat(view?.getComputedStyle(host).fontSize || '') || 16;
        const unit = (scale || 1) * fontSize;
        const glyphTop = rect.top + (rect.height - unit) / 2;

        planned.push({
            host,
            segment,
            reading: segment.reading,
            left: (rect.left - hostRect.left) / unit,
            top: (glyphTop - hostRect.top) / unit,
            width: rect.width / unit,
        });
    }

    return planned;
}

function placeReadings(planned: PlannedReading[]): void {
    for (const item of planned) {
        const doc = item.host.ownerDocument;
        const span = doc.createElement('span');
        span.className = READING_CLASS;
        span.setAttribute('aria-hidden', 'true');
        span.dataset.sltReading = item.reading;
        span.dataset.sltStart = String(item.segment.start);
        span.dataset.sltEnd = String(item.segment.end);
        span.dataset.sltSource = item.segment.source;
        span.style.left = `${item.left.toFixed(3)}em`;
        span.style.top = `${item.top.toFixed(3)}em`;
        span.style.width = `${item.width.toFixed(3)}em`;
        item.host.appendChild(span);
    }
}

interface DocumentLines {
    doc: Document;
    lines: HTMLElement[];
    texts: LineText[];
    japanese: boolean;
}

function collectLines(doc: Document): DocumentLines {
    const lines = Array.from(doc.querySelectorAll<HTMLElement>(LINE_SELECTOR));
    const texts = lines.map(readLineText);
    return { doc, lines, texts, japanese: lines.length > 0 && isJapaneseSong(texts.map(t => t.text)) };
}

function needsReadings(collected: DocumentLines): boolean {
    return collected.japanese && collected.texts.some(t => hasKanji(t.text));
}

function annotateDocument({ doc, lines, texts, japanese }: DocumentLines): void {
    if (lines.length === 0) return;
    ensureStyles(doc);
    watchResize(doc);

    const pending: { line: HTMLElement; text: LineText; segments: ResolvedFuriganaSegment[] }[] = [];
    lines.forEach((line, index) => {
        const lineText = texts[index];
        const segments = japanese && tokenizer && hasKanji(lineText.text) ? segmentsFor(lineText.text) : [];
        if (segments.length === 0) {
            if (line.classList.contains(LINE_CLASS) || lineSignatures.has(line)) clearLine(line);
            return;
        }
        line.classList.add(LINE_CLASS);
        line.classList.toggle(TEXT_LINE_CLASS, !line.querySelector('.word, .letter'));
        pending.push({ line, text: lineText, segments });
    });

    const stale = pending
        .map(item => ({ ...item, signature: lineSignature(item.line, item.text.text) }))
        .filter(item => lineSignatures.get(item.line) !== item.signature || !item.line.querySelector(`.${READING_CLASS}`));
    stale.forEach(item => item.line.querySelectorAll(`.${READING_CLASS}`).forEach(el => el.remove()));

    const toPlace: { line: HTMLElement; signature: string; planned: PlannedReading[] }[] = [];
    for (const item of stale) {
        const planned = planReadings(item.line, item.text, item.segments);
        if (planned) toPlace.push({ line: item.line, signature: item.signature, planned });
    }

    for (const item of toPlace) {
        placeReadings(item.planned);
        lineSignatures.set(item.line, item.signature);
    }
}

async function runPass(): Promise<void> {
    passTimer = null;
    if (!enabled) return;
    if (passRunning) {
        scheduleFuriganaPass(200);
        return;
    }
    passRunning = true;
    try {
        const docs = getDocuments();
        docs.forEach(observeDocument);
        docs.forEach(syncEditing);
        if (!tokenizer && docs.map(collectLines).some(needsReadings)) await loadTokenizer();
        if (!enabled) return;
        docs.map(collectLines).forEach(annotateDocument);
    } catch (error) {
        warn('furigana: pass failed', error);
    } finally {
        passRunning = false;
    }
}

export function scheduleFuriganaPass(delay: number = PASS_DELAY_MS): void {
    if (!enabled) return;
    if (passTimer) clearTimeout(passTimer);
    passTimer = setTimeout(() => { void runPass(); }, delay);
}

function isOwnNode(node: Node): boolean {
    return node.nodeType === Node.ELEMENT_NODE && (node as Element).classList.contains(READING_CLASS);
}

function observeDocument(doc: Document): void {
    if (observers.has(doc) || !doc.body) return;
    const observer = new MutationObserver(mutations => {
        const relevant = mutations.some(mutation => {
            const target = mutation.target as Element;
            if (!target.closest?.('#SpicyLyricsPage') && !Array.from(mutation.addedNodes).some(node => (node as Element).querySelector?.('#SpicyLyricsPage .line'))) return false;
            const changed = [...Array.from(mutation.addedNodes), ...Array.from(mutation.removedNodes)];
            return changed.length === 0 || !changed.every(isOwnNode);
        });
        if (relevant) scheduleFuriganaPass();
    });
    observer.observe(doc.body, { childList: true, subtree: true });
    observers.set(doc, observer);
}

function watchResize(doc: Document): void {
    const target = doc.querySelector('#SpicyLyricsPage .LyricsContent') || doc.querySelector('#SpicyLyricsPage');
    if (!target || resizeTargets.has(target)) return;
    const View = doc.defaultView as (Window & typeof globalThis) | null;
    if (!View?.ResizeObserver) return;
    if (!resizeObserver) resizeObserver = new ResizeObserver(() => scheduleFuriganaPass(150));
    resizeObserver.observe(target);
    resizeTargets.add(target);
}

function readingSpanFrom(event: Event): HTMLElement | null {
    const target = event.target as Element | null;
    const span = target?.closest?.(`.${READING_CLASS}`) as HTMLElement | null;
    return span && span.closest(LINE_SELECTOR) ? span : null;
}

function spanOrigin(span: HTMLElement): DOMRect | null {
    if (span.ownerDocument !== document) return null;
    const rect = span.getBoundingClientRect();
    const fontSize = parseFloat(getComputedStyle(span).fontSize) || 16;
    const scale = span.offsetWidth > 0 ? rect.width / span.offsetWidth : 1;
    const height = fontSize * (scale || 1);
    return new DOMRect(rect.left, rect.top - height * 0.6, rect.width, height * 1.6);
}

function openEditorFor(span: HTMLElement): void {
    const line = span.closest<HTMLElement>(LINE_SELECTOR);
    const trackUri = getCurrentTrackUri();
    const start = Number(span.dataset.sltStart);
    const end = Number(span.dataset.sltEnd);
    if (!line || !trackUri || !Number.isFinite(start) || !Number.isFinite(end)) return;
    const text = readLineText(line).text;
    const segment = segmentsFor(text).find(item => item.start === start && item.end === end);
    if (!segment) return;
    openFuriganaEditor({
        trackUri,
        lineText: text,
        start,
        end,
        reading: segment.reading,
        autoReading: segment.auto,
        source: segment.source,
        candidates: readingCandidates(text, segment),
        origin: spanOrigin(span),
        onChange: () => scheduleFuriganaPass(0)
    });
}

function onEditEvent(event: Event): void {
    if (!editing) return;
    const span = readingSpanFrom(event);
    if (!span) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.type === 'click') openEditorFor(span);
}

function syncEditing(doc: Document): void {
    doc.body?.classList.toggle(EDITING_CLASS, editing);
    const view = doc.defaultView;
    if (!view) return;
    const bound = editListeners.get(view);
    if (editing && !bound) {
        EDIT_EVENTS.forEach(type => view.addEventListener(type, onEditEvent, true));
        editListeners.set(view, onEditEvent);
    } else if (!editing && bound) {
        EDIT_EVENTS.forEach(type => view.removeEventListener(type, bound, true));
        editListeners.delete(view);
    }
}

export function setFuriganaEditing(on: boolean): void {
    const next = on && enabled;
    if (next === editing) return;
    editing = next;
    getDocuments().forEach(syncEditing);
    editListeners.forEach((handler, view) => {
        if (editing) return;
        EDIT_EVENTS.forEach(type => view.removeEventListener(type, handler, true));
        editListeners.delete(view);
    });
    if (editing) {
        notify({
            kind: 'info',
            key: EDIT_TOAST_KEY,
            title: 'Fixing furigana',
            description: 'Click a reading to change it. Kanji without a reading show a ?. Clicks on readings will not seek while this is on.',
            duration: Infinity,
            inbox: false,
            force: true,
            actions: [{ label: 'Done', primary: true, onClick: () => setFuriganaEditing(false) }],
            onDismiss: () => setFuriganaEditing(false)
        });
    } else {
        dismissNotification(EDIT_TOAST_KEY);
    }
    if (enabled) scheduleFuriganaPass(0);
}

export function isFuriganaEditing(): boolean {
    return editing;
}

function removeAllReadings(): void {
    for (const doc of getDocuments()) {
        doc.querySelectorAll(`.${READING_CLASS}`).forEach(el => el.remove());
        doc.querySelectorAll(`.${LINE_CLASS}`).forEach(el => el.classList.remove(LINE_CLASS, TEXT_LINE_CLASS));
        doc.getElementById(STYLE_ID)?.remove();
    }
}

export function setFuriganaEnabled(on: boolean): void {
    if (on === enabled) {
        if (on) scheduleFuriganaPass(0);
        return;
    }
    if (!on) setFuriganaEditing(false);
    enabled = on;
    if (on) {
        loadFailureNotified = false;
        lastLoadFailureAt = -Infinity;
        scheduleFuriganaPass(0);
        return;
    }
    if (passTimer) clearTimeout(passTimer);
    passTimer = null;
    observers.forEach(observer => observer.disconnect());
    observers.clear();
    resizeObserver?.disconnect();
    resizeObserver = null;
    resizeTargets = new WeakSet<Element>();
    removeAllReadings();
}

export function isFuriganaEnabled(): boolean {
    return enabled;
}
