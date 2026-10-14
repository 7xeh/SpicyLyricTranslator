import { buildFuriganaSegments, countKana, hasKanji } from './furigana';
import type { FuriganaSegment, FuriganaToken } from './furigana';
import { getSourceLanguageOverride } from './state';
import { getCurrentTrackUri } from './trackCache';
import { notify } from './notify';
import { debug, warn } from './debug';

const KUROMOJI_VERSION = '0.1.2';
const KUROMOJI_SCRIPT_URL = `https://cdn.jsdelivr.net/npm/kuromoji@${KUROMOJI_VERSION}/build/kuromoji.js`;
const KUROMOJI_DICT_URL = `https://cdn.jsdelivr.net/npm/kuromoji@${KUROMOJI_VERSION}/dict`;
const LOAD_RETRY_DELAY_MS = 60000;

const STYLE_ID = 'slt-furigana-styles';
const READING_CLASS = 'slt-furigana';
const LINE_CLASS = 'slt-furigana-line';
const TEXT_LINE_CLASS = 'slt-furigana-text-line';
const LINE_SELECTOR = '#SpicyLyricsPage .line:not(.musical-line)';
const HOST_SELECTOR = '.letter, .word, .line';
const MIN_KANA_FOR_JAPANESE = 3;
const MAX_CACHED_LINES = 600;
const PASS_DELAY_MS = 60;

const FURIGANA_STYLES = `
#SpicyLyricsPage .line.${LINE_CLASS} {
    padding-top: 0.5em !important;
    row-gap: 0.45em;
}
#SpicyLyricsPage .line.${LINE_CLASS}.${TEXT_LINE_CLASS} {
    padding-top: 0.25em !important;
    --lyrics-line-height: 1.75 !important;
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
}

interface LineText {
    text: string;
    nodes: Text[];
    starts: number[];
}

interface PlannedReading {
    host: HTMLElement;
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
const segmentCache = new Map<string, FuriganaSegment[]>();
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

function segmentsFor(text: string): FuriganaSegment[] {
    const cached = segmentCache.get(text);
    if (cached) return cached;
    let segments: FuriganaSegment[] = [];
    try {
        segments = tokenizer ? buildFuriganaSegments(tokenizer.tokenize(text)) : [];
    } catch (error) {
        warn('furigana: tokenize failed', error);
    }
    if (segmentCache.size >= MAX_CACHED_LINES) {
        const oldest = segmentCache.keys().next().value;
        if (oldest !== undefined) segmentCache.delete(oldest);
    }
    segmentCache.set(text, segments);
    return segments;
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
    return `${text}\u0000${line.offsetWidth}\u0000${fontSize}`;
}

function planReadings(line: HTMLElement, lineText: LineText, segments: FuriganaSegment[]): PlannedReading[] | null {
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
        const rect = Array.from(range.getClientRects()).find(r => r.width > 0 && r.height > 0);
        if (!rect) return null;

        const hostRect = host.getBoundingClientRect();
        const scale = host.offsetWidth > 0 ? hostRect.width / host.offsetWidth : 1;
        const fontSize = parseFloat(view?.getComputedStyle(host).fontSize || '') || 16;
        const unit = (scale || 1) * fontSize;

        planned.push({
            host,
            reading: segment.reading,
            left: (rect.left - hostRect.left) / unit,
            top: (rect.top - hostRect.top) / unit,
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

    const pending: { line: HTMLElement; text: LineText; segments: FuriganaSegment[] }[] = [];
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
