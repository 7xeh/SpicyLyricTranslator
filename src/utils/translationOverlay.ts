import { warn } from './debug';
import type { LyricLineData, WordTimingData } from './lyricsFetcher';
import type { TranslationQualityMeta } from './state';
import { storage } from './storage';
import { buildHeuristicBreakdown, BreakdownToken } from './wordBreakdown';

export const CINEMA_CONTAINER_SELECTOR = '.Cinema--Container, .spicy-lyrics-cinema, .Root__cinema-view';
export const CINEMA_LYRICS_CONTENT_SELECTOR = '.Cinema--Container .LyricsContent, .spicy-lyrics-cinema .LyricsContent, .Root__cinema-view .LyricsContent';

export function isSidebarLyricsActive(doc: Document = document): boolean {
    if (doc.body?.classList?.contains('SpicySidebarLyrics__Active')) return true;
    return Boolean(doc.querySelector('#SpicyLyricsNPVCard #SpicyLyricsPage, #SpicyLyricsPage.CardMode'));
}

export function findSidebarLyricsPage(doc: Document = document): HTMLElement | null {
    return doc.querySelector('#SpicyLyricsNPVCard #SpicyLyricsPage') ||
           doc.querySelector('#SpicyLyricsPage.CardMode') ||
           doc.querySelector('.Root__right-sidebar #SpicyLyricsPage');
}

export type OverlayMode = 'replace' | 'interleaved' | 'none';

export interface OverlayConfig {
    mode: OverlayMode;
    opacity: number;
    fontSize: number;
    syncWordHighlight: boolean;
    showRomanization: boolean;
    learningMode: boolean;
}

let currentConfig: OverlayConfig = {
    mode: 'replace',
    opacity: 0.85,
    fontSize: 0.9,
    syncWordHighlight: true,
    showRomanization: false,
    learningMode: false
};

let isOverlayEnabled = false;
let translationMap: Map<number, string> = new Map();
let romanizationMap: Map<number, string> = new Map();
let originalTextMap: Map<number, string> = new Map();
let lineTimingData: LyricLineData[] = [];
let qualityMap: Map<number, TranslationQualityMeta> = new Map();

let translationByContent: Map<string, string> = new Map();
let romanizationByContent: Map<string, string> = new Map();
let originalByContent: Map<string, string> = new Map();
let qualityByContent: Map<string, TranslationQualityMeta> = new Map();
let timingByContent: Map<string, LyricLineData> = new Map();

function normalizeCompare(text: string | undefined | null): string {
    return (text || '').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '').trim();
}

interface ContentLookupKeys {
    norm: string;
    nonLatinNorm: string;
    latinNorm: string;
}

function buildContentLookupKeys(text: string): ContentLookupKeys {
    const nonLatinOnly = text.replace(/[A-Za-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    const latinOnly = text.replace(/[^A-Za-z0-9\s'\-]/g, ' ').replace(/\s+/g, ' ').trim();

    return {
        norm: normalizeCompare(text),
        nonLatinNorm: nonLatinOnly && nonLatinOnly !== text ? normalizeCompare(nonLatinOnly) : '',
        latinNorm: latinOnly && latinOnly !== text ? normalizeCompare(latinOnly) : ''
    };
}

function lookupByKeys<V>(map: Map<string, V>, keys: ContentLookupKeys): V | undefined {
    if (map.size === 0) return undefined;

    const { norm, nonLatinNorm, latinNorm } = keys;

    if (norm) {
        const direct = map.get(norm);
        if (direct !== undefined) return direct;
    }

    if (nonLatinNorm) {
        const match = map.get(nonLatinNorm);
        if (match !== undefined) return match;
    }

    if (latinNorm) {
        const match = map.get(latinNorm);
        if (match !== undefined) return match;
    }

    if (norm && norm.length >= 4) {
        let best: { key: string; value: V } | null = null;
        for (const [key, value] of map) {
            if (key.length < 4) continue;
            if (norm.includes(key) || key.includes(norm)) {
                const ratio = Math.min(key.length, norm.length) / Math.max(key.length, norm.length);
                if (ratio < 0.8) continue;
                if (!best || key.length > best.key.length) {
                    best = { key, value };
                }
            }
        }
        if (best) return best.value;
    }

    return undefined;
}

export function lookupByContent<V>(map: Map<string, V>, text: string | undefined | null): V | undefined {
    if (!text || map.size === 0) return undefined;
    return lookupByKeys(map, buildContentLookupKeys(text));
}

function hasContentData(): boolean {
    return translationByContent.size > 0 || romanizationByContent.size > 0 || originalByContent.size > 0;
}

function rebuildPerLineMaps(lines: ArrayLike<Element>, lineTexts: string[]): void {
    if (!hasContentData()) return;

    const nextTranslation = new Map<number, string>();
    const nextRomanization = new Map<number, string>();
    const nextOriginal = new Map<number, string>();
    const nextQuality = new Map<number, TranslationQualityMeta>();
    const nextTiming: LyricLineData[] = [];

    let contentLines = 0;
    let matchedLines = 0;

    for (let index = 0; index < lines.length; index++) {
        const text = lineTexts[index];
        if (!text) continue;
        contentLines++;

        const keys = buildContentLookupKeys(text);

        const t = lookupByKeys(translationByContent, keys);
        if (t) {
            nextTranslation.set(index, t);
            matchedLines++;
        }

        const r = lookupByKeys(romanizationByContent, keys);
        if (r) nextRomanization.set(index, r);

        const o = lookupByKeys(originalByContent, keys);
        if (o) nextOriginal.set(index, o);

        const q = lookupByKeys(qualityByContent, keys);
        if (q) nextQuality.set(index, q);

        const tim = lookupByKeys(timingByContent, keys);
        if (tim) nextTiming[index] = tim;
    }

    const coverageCollapsed = contentLines > 0
        && matchedLines * 2 < contentLines
        && translationMap.size > matchedLines;
    if (coverageCollapsed) return;

    translationMap = nextTranslation;
    romanizationMap = nextRomanization;
    originalTextMap = nextOriginal;
    qualityMap = nextQuality;
    lineTimingData = nextTiming;
}

export function setTranslationContentData(data: Map<string, string>): void {
    translationByContent = new Map(data);
}

export function setRomanizationContentData(data: Map<string, string>): void {
    romanizationByContent = new Map(data);
}

export function setOriginalContentData(data: Map<string, string>): void {
    originalByContent = new Map(data);
}

export function setQualityContentData(data: Map<string, TranslationQualityMeta>): void {
    qualityByContent = new Map(data);
}

export function setTimingContentData(data: Map<string, LyricLineData>): void {
    timingByContent = new Map(data);
}

const lastRenderSigMap = new WeakMap<Document, string>();
const lastRenderedLinesMap = new WeakMap<Document, Element[]>();
const lastRenderedOutputMap = new WeakMap<Document, number>();

function extractLineTexts(lines: ArrayLike<Element>): string[] {
    const texts: string[] = [];
    for (let i = 0; i < lines.length; i++) {
        texts.push(extractLineText(lines[i]));
    }
    return texts;
}

function computeRenderSignature(lines: ArrayLike<Element>, lineTexts: string[]): string {
    const parts: string[] = [
        currentConfig.mode,
        currentConfig.syncWordHighlight ? '1' : '0',
        currentConfig.showRomanization ? '1' : '0'
    ];
    for (let i = 0; i < lines.length; i++) {
        const text = lineTexts[i];
        const tr = translationMap.get(i) || '';
        const rom = romanizationMap.get(i) || '';
        const orig = originalTextMap.get(i) || '';
        parts.push(`${text}${tr}${rom}${orig}`);
    }
    return parts.join('');
}

const RENDERED_OUTPUT_SELECTOR = '.slt-interleaved-translation, .slt-replace-line, .slt-romanization-line, .slt-original-line';

function countRenderedOutput(doc: Document): number {
    return doc.querySelectorAll(RENDERED_OUTPUT_SELECTOR).length;
}

function renderedTargetsIntact(doc: Document, lines: ArrayLike<Element>): boolean {
    const previous = lastRenderedLinesMap.get(doc);
    if (!previous || previous.length !== lines.length) return false;

    for (let i = 0; i < previous.length; i++) {
        const line = previous[i];
        if (line !== lines[i] || !line.isConnected) return false;
    }

    return lastRenderedOutputMap.get(doc) === countRenderedOutput(doc);
}

export function renderSignatureUnchanged(doc: Document, lines: ArrayLike<Element>, lineTexts: string[]): boolean {
    const sig = computeRenderSignature(lines, lineTexts);
    if (lastRenderSigMap.get(doc) === sig && renderedTargetsIntact(doc, lines)) return true;
    lastRenderSigMap.set(doc, sig);
    lastRenderedLinesMap.set(doc, Array.from(lines));
    return false;
}

export function markRenderComplete(doc: Document): void {
    lastRenderedOutputMap.set(doc, countRenderedOutput(doc));
}

export function forgetRenderState(doc: Document): void {
    lastRenderSigMap.delete(doc);
    lastRenderedLinesMap.delete(doc);
    lastRenderedOutputMap.delete(doc);
}

function buildRomanizationLine(
    doc: Document,
    index: number,
    timingInfo: LyricLineData | undefined,
    line: Element,
    text?: string
): HTMLElement | null {
    const romanized = text !== undefined ? text : romanizationMap.get(index);
    if (!romanized || !romanized.trim()) return null;
    if (timingInfo?.isInstrumental) return null;

    const romanEl = doc.createElement('div');
    romanEl.className = 'slt-romanization-line';
    romanEl.dataset.forLine = index.toString();
    romanEl.dataset.lineIndex = index.toString();
    romanEl.textContent = romanized;

    if (timingInfo) {
        romanEl.dataset.startTime = timingInfo.startTime.toString();
        romanEl.dataset.endTime = timingInfo.endTime.toString();
    }
    if (isLineActive(line)) romanEl.classList.add('active');
    return romanEl;
}

function siblingSkippingRomanization(el: Element, dir: 'next' | 'prev'): HTMLElement | null {
    let cur = (dir === 'next' ? el.nextElementSibling : el.previousElementSibling) as HTMLElement | null;
    while (cur && cur.classList.contains('slt-romanization-line')) {
        cur = (dir === 'next' ? cur.nextElementSibling : cur.previousElementSibling) as HTMLElement | null;
    }
    return cur;
}

function romanizationCompanionText(line: Element, index: number, mode: OverlayMode): string {
    if (!currentConfig.showRomanization) return '';

    const domText = extractLineText(line);
    const nDom = normalizeCompare(domText);

    const apiOriginal = (originalTextMap.get(index) || '').trim();
    const apiRomanized = (romanizationMap.get(index) || '').trim();

    if (mode === 'replace') {
        if (apiRomanized) return apiRomanized;
        if (isMostlyLatin(domText) && apiOriginal && normalizeCompare(apiOriginal) !== nDom) return domText;
        return '';
    }

    const screenShowsRomanization = apiRomanized !== '' && normalizeCompare(apiRomanized) === nDom;
    const candidates = screenShowsRomanization
        ? [apiOriginal, apiRomanized]
        : [apiRomanized, apiOriginal];

    for (const candidate of candidates) {
        if (!candidate) continue;
        if (normalizeCompare(candidate) === nDom) continue;
        return candidate;
    }

    return '';
}

function isMostlyLatin(text: string): boolean {
    const letters = (text || '').replace(/[^\p{L}]/gu, '');
    if (!letters) return false;
    const latin = letters.replace(/[^\p{Script=Latin}]/gu, '');
    return latin.length / letters.length >= 0.8;
}

function getPIPWindow(): Window | null {
    try {
        const docPiP = (globalThis as any).documentPictureInPicture;
        if (docPiP && docPiP.window) {
            return docPiP.window;
        }
    } catch (e) {}
    return null;
}

function getLyricLines(doc: Document): NodeListOf<Element> {
    const isPipDoc = !!doc.querySelector('.spicy-pip-wrapper');
    const excludeSelector = ':not(.musical-line):not(.bg-line)';

    if (isPipDoc) {
        const pipLines = doc.querySelectorAll(`.spicy-pip-wrapper #SpicyLyricsPage .SpicyLyricsScrollContainer .line${excludeSelector}`);
        if (pipLines.length > 0) return pipLines;

        const pipLinesAlt = doc.querySelectorAll(`.spicy-pip-wrapper .SpicyLyricsScrollContainer .line${excludeSelector}`);
        if (pipLinesAlt.length > 0) return pipLinesAlt;

        const pipLinesFallback = doc.querySelectorAll(`.spicy-pip-wrapper .line${excludeSelector}`);
        if (pipLinesFallback.length > 0) return pipLinesFallback;
    }

    const scrollContainerLines = doc.querySelectorAll(`#SpicyLyricsPage .SpicyLyricsScrollContainer .line${excludeSelector}`);
    if (scrollContainerLines.length > 0) return scrollContainerLines;

    if (isSidebarLyricsActive(doc)) {
        const sidebarPage = findSidebarLyricsPage(doc);
        const sidebarLines = sidebarPage?.querySelectorAll(`.line${excludeSelector}`);
        if (sidebarLines && sidebarLines.length > 0) return sidebarLines;
    }

    const compactLines = doc.querySelectorAll(`#SpicyLyricsPage.ForcedCompactMode .line${excludeSelector}`);
    if (compactLines.length > 0) return compactLines;

    const lyricsContentLines = doc.querySelectorAll(`#SpicyLyricsPage .LyricsContent .line${excludeSelector}`);
    if (lyricsContentLines.length > 0) return lyricsContentLines;

    return doc.querySelectorAll(`.SpicyLyricsScrollContainer .line${excludeSelector}, .LyricsContent .line${excludeSelector}, .LyricsContainer .line${excludeSelector}`);
}

function findLyricsContainer(doc: Document): Element | null {
    const pipWrapper = doc.querySelector('.spicy-pip-wrapper');
    if (pipWrapper) {
        const pipScrollContainer = pipWrapper.querySelector('#SpicyLyricsPage .SpicyLyricsScrollContainer');
        if (pipScrollContainer) return pipScrollContainer;

        const pipLyricsContent = pipWrapper.querySelector('#SpicyLyricsPage .LyricsContent');
        if (pipLyricsContent) return pipLyricsContent;

        const pipPage = pipWrapper.querySelector('#SpicyLyricsPage');
        if (pipPage) return pipPage;

        return pipWrapper;
    }

    const scrollContainer = doc.querySelector('#SpicyLyricsPage .SpicyLyricsScrollContainer');
    if (scrollContainer) return scrollContainer;

    if (isSidebarLyricsActive(doc)) {
        const sidebarPage = findSidebarLyricsPage(doc);
        const sidebarContainer = sidebarPage?.querySelector('.SpicyLyricsScrollContainer') ||
                                 sidebarPage?.querySelector('.LyricsContent');
        if (sidebarContainer) return sidebarContainer;
    }

    return doc.querySelector('#SpicyLyricsPage .LyricsContent') ||
           doc.querySelector('.LyricsContent') ||
           doc.querySelector('.LyricsContainer');
}

function extractLineText(line: Element): string {
    const wordGroups = line.querySelectorAll(':scope > .word-group');
    const directWords = line.querySelectorAll(':scope > .word:not(.dot), :scope > .letterGroup');

    if (wordGroups.length > 0 || directWords.length > 0) {
        const parts: string[] = [];
        const children = line.children;
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (child.classList.contains('word-group')) {
                const groupText = child.textContent?.trim() || '';
                if (groupText) parts.push(groupText);
            } else if (child.classList.contains('letterGroup')) {
                const groupText = child.textContent?.trim() || '';
                if (groupText) parts.push(groupText);
            } else if (child.classList.contains('word') && !child.classList.contains('dot')) {
                const wordText = child.textContent?.trim() || '';
                if (wordText) parts.push(wordText);
            } else if (child.classList.contains('dotGroup')) {
                continue;
            }
        }

        if (parts.length > 0) {
            return parts.join(' ').replace(/\s+/g, ' ').trim();
        }
    }

    const words = line.querySelectorAll('.word:not(.dot), .letterGroup');
    if (words.length > 0) {
        const wordUnits = Array.from(words).filter(w => {
            if (w.classList.contains('letterGroup')) return true;
            if (w.closest('.letterGroup')) return false;
            return true;
        });
        return wordUnits.map(w => w.textContent?.trim() || '').join(' ').replace(/\s+/g, ' ').trim();
    }

    return line.textContent?.trim() || '';
}

let wordUnitsCache = new WeakMap<Element, Element[]>();

export function invalidateWordUnitsCache(): void {
    wordUnitsCache = new WeakMap<Element, Element[]>();
}

export function getWordUnits(line: Element): Element[] {
    const cached = wordUnitsCache.get(line);
    if (cached) return cached;
    const units = computeWordUnits(line);
    wordUnitsCache.set(line, units);
    return units;
}

function computeWordUnits(line: Element): Element[] {
    const units: Element[] = [];
    const allElements = line.querySelectorAll('.word:not(.dot), .letterGroup, .syllable');

    for (const el of Array.from(allElements)) {
        if (el.closest('.letterGroup') && !el.classList.contains('letterGroup')) {
            continue;
        }
        let isNested = false;
        for (const unit of units) {
            if (unit.contains(el) && unit !== el) {
                isNested = true;
                break;
            }
        }
        if (!isNested) {
            units.push(el);
        }
    }

    return units;
}

function isLineActive(line: Element): boolean {

    const classList = line.classList;
    if (classList.contains('Active')) return true;
    if (classList.contains('active')) return true;
    if (classList.contains('current')) return true;
    if (classList.contains('is-active')) return true;

    if (!classList.contains('Sung') && !classList.contains('NotSung') && !classList.contains('musical-line')) {
        return true;
    }

    return line.classList.contains('Active') ||
           line.classList.contains('playing') ||
           line.getAttribute('data-active') === 'true' ||
           (line as HTMLElement).dataset.active === 'true';
}

function findOriginalLineForTranslation(transEl: Element): HTMLElement | null {
    let prev = transEl.previousElementSibling as HTMLElement | null;
    while (prev && !prev.classList.contains('line')) {
        prev = prev.previousElementSibling as HTMLElement | null;
    }
    return prev;
}

function adjacentOriginalLine(el: Element): HTMLElement | null {
    if (el.classList.contains('slt-original-line')) {
        let next = el.nextElementSibling as HTMLElement | null;
        while (next && !next.classList.contains('line')) {
            next = next.nextElementSibling as HTMLElement | null;
        }
        return next;
    }
    return findOriginalLineForTranslation(el);
}

function applyReplaceMode(doc: Document): void {
    invalidateWordUnitsCache();
    const lines = getLyricLines(doc);
    const lineTexts = extractLineTexts(lines);
    rebuildPerLineMaps(lines, lineTexts);

    if (renderSignatureUnchanged(doc, lines, lineTexts)) return;

    const lyricsContainer = doc.querySelector('.SpicyLyricsScrollContainer');
    const lyricsType = lyricsContainer?.getAttribute('data-lyrics-type') || 'Line';

    const claimed = new Set<Element>();

    lines.forEach((line, index) => {
        const lineEl = line as HTMLElement;
        const translation = translationMap.get(index);
        const originalText = lineTexts[index];

        let existing = siblingSkippingRomanization(line, 'next');
        if (existing && !existing.classList.contains('slt-replace-line')) existing = null;

        const wants = !!translation && translation !== originalText && !!line.parentNode;
        if (!wants) {
            if (existing) existing.remove();
            const staleRom = line.nextElementSibling as HTMLElement | null;
            if (staleRom && staleRom.classList.contains('slt-romanization-line')) staleRom.remove();
            lineEl.classList.remove('slt-replace-hidden');
            return;
        }

        const timingInfo = lineTimingData[index];
        const isBreak = !originalText.trim() || /^[♪♫•\-–—\s]+$/.test(originalText.trim());
        const hasRomanization = !!romanizationMap.get(index);
        const isInstrumental = timingInfo?.isInstrumental || isBreak;

        const romanizationText = isInstrumental ? '' : romanizationCompanionText(line, index, 'replace');

        const sig = [
            translation,
            isInstrumental ? 'I' : '',
            currentConfig.syncWordHighlight ? 'W' : '',
            romanizationText
        ].join('');

        lineEl.classList.add('slt-replace-hidden');
        lineEl.dataset.sltIndex = index.toString();

        const refreshRomanization = (anchor: HTMLElement): void => {
            let existingRom = anchor.nextElementSibling as HTMLElement | null;
            if (existingRom && !existingRom.classList.contains('slt-romanization-line')) existingRom = null;

            if (!romanizationText) {
                if (existingRom) existingRom.remove();
                return;
            }

            if (existingRom) {
                if (existingRom.textContent !== romanizationText) existingRom.textContent = romanizationText;
                existingRom.dataset.lineIndex = index.toString();
                existingRom.dataset.forLine = index.toString();
                if (timingInfo) {
                    existingRom.dataset.startTime = timingInfo.startTime.toString();
                    existingRom.dataset.endTime = timingInfo.endTime.toString();
                }
                existingRom.classList.toggle('active', isLineActive(line));
                claimed.add(existingRom);
                return;
            }

            const romEl = buildRomanizationLine(doc, index, timingInfo, line, romanizationText);
            if (romEl) {
                anchor.parentNode!.insertBefore(romEl, anchor.nextSibling);
                claimed.add(romEl);
            }
        };

        if (existing && existing.dataset.sltSig === sig) {
            existing.dataset.lineIndex = index.toString();
            existing.dataset.forLine = index.toString();
            if (timingInfo) {
                existing.dataset.startTime = timingInfo.startTime.toString();
                existing.dataset.endTime = timingInfo.endTime.toString();
            }
            claimed.add(existing);
            refreshRomanization(existing);
            return;
        }

        if (existing) existing.remove();

        const replaceEl = doc.createElement('div');
        replaceEl.className = 'slt-replace-line slt-sync-translation';
        replaceEl.dataset.lineIndex = index.toString();
        replaceEl.dataset.forLine = index.toString();
        replaceEl.dataset.lyricsType = lyricsType;
        replaceEl.dataset.sltSig = sig;

        if (isInstrumental) {
            replaceEl.textContent = '♪ ♪ ♪';
            replaceEl.classList.add('slt-replace-instrumental');
        } else {
            if (currentConfig.syncWordHighlight) {
                appendTranslationWordSpans(doc, replaceEl, translation, line, 'slt-replace-word');
            } else {
                replaceEl.textContent = translation;
            }
        }

        if (timingInfo) {
            replaceEl.dataset.startTime = timingInfo.startTime.toString();
            replaceEl.dataset.endTime = timingInfo.endTime.toString();
        }

        replaceEl.addEventListener('click', (e) => {
            e.preventDefault();

            const clickedWord = (e.target as HTMLElement)?.closest?.('.slt-replace-word');
            if (clickedWord) {
                const originalIndex = parseInt((clickedWord as HTMLElement).dataset.originalIndex || '-1', 10);
                const originalWords = getWordUnits(line);
                if (originalIndex >= 0 && originalIndex < originalWords.length) {
                    (originalWords[originalIndex] as HTMLElement).click();
                    return;
                }
            }

            const firstClickable = line.querySelector('.word:not(.dot)') || line.querySelector('.letterGroup');
            if (firstClickable) {
                (firstClickable as HTMLElement).click();
            } else {
                (line as HTMLElement).click();
            }
        });

        if (isLineActive(line)) {
            replaceEl.classList.add('active');
        }

        const qualityIndicator = createQualityIndicator(doc, index);
        if (qualityIndicator) {
            replaceEl.appendChild(qualityIndicator);
        }

        line.parentNode!.insertBefore(replaceEl, line.nextSibling);
        claimed.add(replaceEl);

        refreshRomanization(replaceEl);
    });

    doc.querySelectorAll('.slt-replace-line, .slt-original-line, .slt-romanization-line').forEach(el => {
        if (!claimed.has(el)) el.remove();
    });

    markRenderComplete(doc);
}

function appendTranslationWordSpans(
    doc: Document,
    container: HTMLElement,
    translation: string,
    originalLine: Element,
    wordClassName: 'slt-sync-word' | 'slt-replace-word'
): void {
    const translatedWords = translation.trim().split(/\s+/).filter(Boolean);
    if (translatedWords.length === 0) {
        container.textContent = translation || '';
        return;
    }

    const originalWords = getWordUnits(originalLine);
    const ratio = translatedWords.length / Math.max(originalWords.length, 1);
    const shouldAnimateLetters = false;

    translatedWords.forEach((word, wordIndex) => {
        const span = doc.createElement('span');
        span.className = wordClassName;

        if (wordClassName === 'slt-sync-word') {
            span.classList.add('slt-word-future');
        } else {
            span.classList.add('word-notsng');
        }

        const originalIndex = originalWords.length > 0
            ? Math.min(Math.floor(wordIndex / Math.max(ratio, 0.01)), originalWords.length - 1)
            : wordIndex;

        span.dataset.originalIndex = Math.max(0, originalIndex).toString();
        span.dataset.wordIndex = wordIndex.toString();
        if (shouldAnimateLetters) {
            appendSyncWordLetters(doc, span, word, wordIndex < translatedWords.length - 1);
        } else {
            span.textContent = wordIndex < translatedWords.length - 1 ? word + ' ' : word;
        }
        container.appendChild(span);
    });
}

function lineHasWordStructure(line: Element): boolean {
    return !!line.querySelector('.word:not(.dot), .letterGroup, .word-group, .syllable');
}

function lineHasLetterStructure(line: Element): boolean {
    return !!line.querySelector('.letterGroup .letter, .syllable .letter, .syllable');
}

function splitIntoGraphemes(text: string): string[] {
    const segmenterCtor = (globalThis as any).Intl?.Segmenter;
    if (typeof segmenterCtor === 'function') {
        const segmenter = new segmenterCtor(undefined, { granularity: 'grapheme' });
        return Array.from(segmenter.segment(text), (segment: any) => segment.segment);
    }
    return Array.from(text);
}

function appendSyncWordLetters(doc: Document, wordEl: HTMLElement, word: string, appendTrailingSpace: boolean): void {
    const graphemes = splitIntoGraphemes(word);
    wordEl.textContent = '';

    graphemes.forEach((grapheme, letterIndex) => {
        const letterSpan = doc.createElement('span');
        letterSpan.className = 'slt-sync-letter slt-letter-future';
        letterSpan.dataset.letterIndex = letterIndex.toString();
        letterSpan.textContent = grapheme;
        wordEl.appendChild(letterSpan);
    });

    if (appendTrailingSpace) {
        wordEl.appendChild(doc.createTextNode(' '));
    }
}

function getMappedOriginalLetterProgresses(originalLine: HTMLElement, mappedIndex: number): number[] | null {
    const originalWords = getWordUnits(originalLine);
    if (mappedIndex < 0 || mappedIndex >= originalWords.length) return null;

    const sourceWord = originalWords[mappedIndex] as HTMLElement;
    if (!sourceWord.classList.contains('letterGroup')) return null;

    const sourceLetters = Array.from(sourceWord.querySelectorAll('.letter')) as HTMLElement[];
    if (sourceLetters.length < 2) return null;

    const progressValues = sourceLetters
        .map((letterEl) => parseFloat(letterEl.style.getPropertyValue('--gradient-position')))
        .filter((value) => !isNaN(value))
        .map((value) => Math.max(0, Math.min(1, (value + 20) / 120)));

    if (progressValues.length < 2) return null;

    const hasSustainProgress = progressValues.some((value) => value > 0.05 && value < 0.95);
    if (!hasSustainProgress) return null;

    return progressValues;
}

function updateSyncWordLetterStates(
    wordEl: HTMLElement,
    gradientPosition: number,
    isWordActive: boolean,
    isWordSung: boolean,
    originalLine: HTMLElement,
    mappedOriginalIndex: number
): void {
    const letters = Array.from(wordEl.querySelectorAll(':scope > .slt-sync-letter')) as HTMLElement[];
    if (letters.length === 0) return;

    const sourceLetterProgresses = getMappedOriginalLetterProgresses(originalLine, mappedOriginalIndex);
    const hasSustainedSource = !!sourceLetterProgresses;

    const progress = Math.max(0, Math.min(1, (gradientPosition + 20) / 120));
    const travelingProgress = progress * letters.length;

    letters.forEach((letterEl, index) => {
        let localProgress = Math.max(0, Math.min(1, travelingProgress - index));
        let isLetterPast = travelingProgress >= index + 1;
        let isLetterActive = !isLetterPast && localProgress > 0;

        if (hasSustainedSource && sourceLetterProgresses) {
            const sourceIndex = Math.floor((index / Math.max(letters.length - 1, 1)) * (sourceLetterProgresses.length - 1));
            const sourceProgress = sourceLetterProgresses[sourceIndex];
            localProgress = sourceProgress;
            isLetterPast = sourceProgress >= 0.95;
            isLetterActive = sourceProgress > 0.05 && sourceProgress < 0.95;
        }

        letterEl.classList.toggle('slt-letter-past', isLetterPast);
        letterEl.classList.toggle('slt-letter-active', isLetterActive);
        letterEl.classList.toggle('slt-letter-future', !isLetterPast && !isLetterActive);

        let yShift = 0;
        if (isWordActive && hasSustainedSource) {
            yShift = -0.2 * Math.sin(localProgress * Math.PI);
        } else if (isWordSung) {
            yShift = -0.015;
        }

        setStyleProp(letterEl, '--slt-letter-shift', `${yShift.toFixed(3)}em`);
    });
}

function getClickableWordElements(line: Element): Element[] {
    const words = Array.from(line.querySelectorAll('.word:not(.dot)'));
    return words.length > 0 ? words : Array.from(line.querySelectorAll('.letterGroup'));
}

export function distributeTranslationText(translationText: string, wordElements: Element[]): void {
    const translationWords = translationText.split(/\s+/).filter(w => w.length > 0);
    const numElements = wordElements.length;
    const numTranslation = translationWords.length;

    if (numElements === 0) return;

    wordElements.forEach(el => {
        if ((el as HTMLElement).dataset.sltOriginalHtml === undefined) {
            (el as HTMLElement).dataset.sltOriginalHtml = el.innerHTML;
        }
    });

    if (numTranslation <= numElements) {
        for (let i = 0; i < numElements; i++) {
            if (i < numTranslation) {
                wordElements[i].textContent = translationWords[i];
            } else {
                wordElements[i].textContent = '';
            }
        }
    } else {
        const wordsPerElement = Math.floor(numTranslation / numElements);
        const extraWords = numTranslation % numElements;
        let wordIdx = 0;

        for (let i = 0; i < numElements; i++) {
            const count = wordsPerElement + (i < extraWords ? 1 : 0);
            const chunk = translationWords.slice(wordIdx, wordIdx + count);
            wordElements[i].textContent = chunk.join(' ');
            wordIdx += count;
        }
    }
}

export function restoreReplacedLine(line: Element): void {
    const modifiedElements = line.querySelectorAll('[data-slt-original-html]');
    modifiedElements.forEach(el => {
        const original = (el as HTMLElement).dataset.sltOriginalHtml;
        if (original !== undefined) {
            el.innerHTML = original;
            delete (el as HTMLElement).dataset.sltOriginalHtml;
        }
    });

    const originalText = (line as HTMLElement).dataset.sltOriginalText;
    if (originalText !== undefined) {
        line.textContent = originalText;
        delete (line as HTMLElement).dataset.sltOriginalText;
    }

    delete (line as HTMLElement).dataset.sltReplacedWith;
    line.classList.remove('spicy-translated');
}

function hasWrappedSyncWords(translationEl: HTMLElement): boolean {
    const words = Array.from(translationEl.querySelectorAll(':scope > .slt-sync-word')) as HTMLElement[];
    if (words.length < 2) return false;

    const firstTop = words[0].offsetTop;
    return words.some((wordEl, index) => index > 0 && Math.abs(wordEl.offsetTop - firstTop) > 2);
}

function fallbackToContinuousMultilineGradient(
    translationEl: HTMLElement,
    translationText: string,
    originalLine: Element
): void {
    if (lineHasWordStructure(originalLine)) return;
    if (!translationEl.querySelector(':scope > .slt-sync-word')) return;
    if (!hasWrappedSyncWords(translationEl)) return;

    translationEl.textContent = translationText;
    translationEl.dataset.sltGradientMode = 'continuous-multiline';
}

function applyInterleavedMode(doc: Document): void {
    try {
        invalidateWordUnitsCache();
        const lines = getLyricLines(doc);
        if (!lines || lines.length === 0) {
            return;
        }
        const lineTexts = extractLineTexts(lines);
        rebuildPerLineMaps(lines, lineTexts);

        if (renderSignatureUnchanged(doc, lines, lineTexts)) return;

        const claimed = new Set<Element>();

        lines.forEach((line, index) => {
            try {
                const lineEl = line as HTMLElement;
                const translation = translationMap.get(index);
                const originalText = lineTexts[index];
                const isBreak = !originalText.trim() || /^[♪♫•\-–—\s]+$/.test(originalText.trim());

                let existing = siblingSkippingRomanization(line, 'next');
                if (existing && !existing.classList.contains('slt-interleaved-translation')) existing = null;
                const wants = (!!translation || isBreak) && translation !== originalText && !!line.parentNode;
                if (!wants) {
                    if (existing) existing.remove();
                    const staleRom = line.nextElementSibling as HTMLElement | null;
                    if (staleRom && staleRom.classList.contains('slt-romanization-line')) staleRom.remove();
                    lineEl.classList.remove('slt-overlay-parent');
                    return;
                }

                const timingInfo = lineTimingData[index];

                const romanizationText = isBreak ? '' : romanizationCompanionText(line, index, 'interleaved');

                const sig = [
                    translation || '',
                    isBreak ? 'B' : '',
                    currentConfig.syncWordHighlight ? 'W' : '',
                    romanizationText
                ].join('');

                lineEl.classList.add('slt-overlay-parent');
                lineEl.dataset.sltIndex = index.toString();

                const refreshRomanization = (anchor: HTMLElement): void => {
                    let existingRom = anchor.nextElementSibling as HTMLElement | null;
                    if (existingRom && !existingRom.classList.contains('slt-romanization-line')) existingRom = null;

                    if (!romanizationText) {
                        if (existingRom) existingRom.remove();
                        return;
                    }

                    if (existingRom) {
                        if (existingRom.textContent !== romanizationText) existingRom.textContent = romanizationText;
                        existingRom.dataset.lineIndex = index.toString();
                        existingRom.dataset.forLine = index.toString();
                        if (timingInfo) {
                            existingRom.dataset.startTime = timingInfo.startTime.toString();
                            existingRom.dataset.endTime = timingInfo.endTime.toString();
                        }
                        existingRom.classList.toggle('active', isLineActive(line));
                        claimed.add(existingRom);
                        return;
                    }

                    const romEl = buildRomanizationLine(doc, index, timingInfo, line, romanizationText);
                    if (romEl) {
                        anchor.parentNode!.insertBefore(romEl, anchor.nextSibling);
                        claimed.add(romEl);
                    }
                };

                if (existing && existing.dataset.sltSig === sig) {
                    existing.dataset.lineIndex = index.toString();
                    existing.dataset.forLine = index.toString();
                    if (timingInfo) {
                        existing.dataset.startTime = timingInfo.startTime.toString();
                        existing.dataset.endTime = timingInfo.endTime.toString();
                    }
                    claimed.add(existing);
                            refreshRomanization(existing);
                    return;
                }

                if (existing) existing.remove();

                const translationEl = doc.createElement('div');
                translationEl.className = 'slt-interleaved-translation';
                translationEl.dataset.forLine = index.toString();
                translationEl.dataset.lineIndex = index.toString();
                translationEl.dataset.sltSig = sig;

                if (isBreak) {
                    translationEl.textContent = '• • •';
                    translationEl.classList.add('slt-music-break');
                } else {
                    translationEl.classList.add('slt-sync-translation');
                    if (currentConfig.syncWordHighlight && translation) {
                        appendTranslationWordSpans(doc, translationEl, translation, line, 'slt-sync-word');
                    } else {
                        translationEl.textContent = translation || '';
                    }
                }

                if (timingInfo) {
                    translationEl.dataset.startTime = timingInfo.startTime.toString();
                    translationEl.dataset.endTime = timingInfo.endTime.toString();
                }

                if (isLineActive(line)) translationEl.classList.add('active');

                const qualityIndicator = createQualityIndicator(doc, index);
                if (qualityIndicator) {
                    translationEl.appendChild(qualityIndicator);
                }

                line.parentNode!.insertBefore(translationEl, line.nextSibling);
                claimed.add(translationEl);

                    refreshRomanization(translationEl);

                if (!isBreak && currentConfig.syncWordHighlight && translation) {
                    fallbackToContinuousMultilineGradient(translationEl, translation, line);
                }
            } catch (lineErr) {
                warn('Failed to process line', index, ':', lineErr);
            }
        });

        doc.querySelectorAll('.slt-interleaved-translation, .slt-original-line, .slt-romanization-line').forEach(el => {
            if (!claimed.has(el)) el.remove();
        });

        markRenderComplete(doc);
    } catch (err) {
        warn('Failed to apply interleaved mode:', err);
    }
}

function initOverlayContainer(doc: Document): HTMLElement | null {
    let container = doc.getElementById('spicy-translate-overlay');

    if (!container) {
        container = doc.createElement('div');
        container.id = 'spicy-translate-overlay';
        container.className = 'spicy-translate-overlay';
    }

    container.className = `spicy-translate-overlay overlay-mode-${currentConfig.mode}`;
    container.style.setProperty('--slt-overlay-opacity', currentConfig.opacity.toString());
    container.style.setProperty('--slt-overlay-font-scale', currentConfig.fontSize.toString());

    return container;
}

export function setOverlayRomanization(show: boolean): void {
    currentConfig.showRomanization = show;
}

export function setOverlayLearningMode(enabled: boolean): void {
    currentConfig.learningMode = enabled;
    invalidateLearningRow();
    if (!enabled) {
        removeLearningRows(document);
        const pip = getPIPWindow();
        if (pip) removeLearningRows(pip.document);
    }
}

export function updateOverlayConfig(config: Partial<OverlayConfig>): void {
    currentConfig = { ...currentConfig, ...config };
}

export function setStyleProp(el: HTMLElement, prop: string, value: string): void {
    if (el.style.getPropertyValue(prop) !== value) {
        el.style.setProperty(prop, value);
    }
}

export function clearStyleProp(el: HTMLElement, prop: string): void {
    if (el.style.getPropertyValue(prop) !== '') {
        el.style.removeProperty(prop);
    }
}

export function setDataProp(el: HTMLElement, key: string, value: string): void {
    if (el.dataset[key] !== value) {
        el.dataset[key] = value;
    }
}

const MIRRORED_LINE_STYLE_PROPS = [
    '--gradient-position',
    '--gradient-alpha',
    '--gradient-alpha-end',
    '--gradient-degrees',
    '--gradient-offset',
    '--BlurAmount',
    '--text-shadow-blur-radius',
    '--text-shadow-opacity',
    '--active-line-distance'
];

function syncTranslationLineFromOriginal(
    originalLine: HTMLElement,
    translatedLine: HTMLElement,
    lyricsType: string
): void {
    const isActive = isLineActive(originalLine);
    const isSung = originalLine.classList.contains('Sung');
    const isNotSung = originalLine.classList.contains('NotSung');

    translatedLine.classList.toggle('active', isActive);
    translatedLine.classList.toggle('Active', isActive);
    translatedLine.classList.toggle('Sung', !isActive && isSung);
    translatedLine.classList.toggle('NotSung', !isActive && isNotSung);
    translatedLine.classList.toggle('OppositeAligned', originalLine.classList.contains('OppositeAligned'));
    translatedLine.classList.toggle('rtl', originalLine.classList.contains('rtl'));

    setStyleProp(translatedLine, '--gradient-degrees', '180deg');

    for (const prop of MIRRORED_LINE_STYLE_PROPS) {
        if (prop === '--gradient-degrees') continue;
        const value = originalLine.style.getPropertyValue(prop);
        if (value && value.trim() !== '') {
            setStyleProp(translatedLine, prop, value);
        } else {
            clearStyleProp(translatedLine, prop);
        }
    }

    if (!originalLine.style.getPropertyValue('--gradient-position')) {
        if (isSung) {
            setStyleProp(translatedLine, '--gradient-position', '100%');
        } else if (isNotSung) {
            setStyleProp(translatedLine, '--gradient-position', '-20%');
        }
    }
}

function getOverallWordGradientProgress(originalLine: HTMLElement): number | null {
    const originalWords = getWordUnits(originalLine);
    if (originalWords.length === 0) return null;

    let sungCount = 0;
    let activeWordIndex = -1;
    let activeWordGradient = 0;
    let hasAnyGradientData = false;

    for (let i = 0; i < originalWords.length; i++) {
        const wordEl = originalWords[i] as HTMLElement;
        let gradientValue: number = NaN;

        if (wordEl.classList.contains('letterGroup')) {
            const letters = wordEl.querySelectorAll('.letter');
            const letterGradients: number[] = [];
            for (const letter of Array.from(letters)) {
                const letterGradient = parseFloat(
                    (letter as HTMLElement).style.getPropertyValue('--gradient-position')
                );
                if (!isNaN(letterGradient)) {
                    letterGradients.push(letterGradient);
                }
            }
            if (letterGradients.length > 0) {
                gradientValue = letterGradients.reduce((sum, value) => sum + value, 0) / letterGradients.length;
            }
        } else {
            gradientValue = parseFloat(wordEl.style.getPropertyValue('--gradient-position'));
        }

        if (!isNaN(gradientValue)) {
            hasAnyGradientData = true;
            if (gradientValue >= 90) {
                sungCount = i + 1;
            } else if (gradientValue > -15) {
                activeWordIndex = i;
                activeWordGradient = Math.max(0, Math.min(1, (gradientValue + 20) / 120));
            }
        }
    }

    if (!hasAnyGradientData) {
        return null;
    }

    if (activeWordIndex >= 0) {
        return (activeWordIndex + activeWordGradient) / originalWords.length;
    }

    return sungCount / originalWords.length;
}

function getOriginalWordGradients(originalLine: HTMLElement): number[] {
    const originalWords = getWordUnits(originalLine);
    const gradients: number[] = [];

    for (let i = 0; i < originalWords.length; i++) {
        const wordEl = originalWords[i] as HTMLElement;
        let gradientValue: number = NaN;

        if (wordEl.classList.contains('letterGroup')) {
            const letters = wordEl.querySelectorAll('.letter');
            const letterGradients: number[] = [];
            for (const letter of Array.from(letters)) {
                const letterGradient = parseFloat(
                    (letter as HTMLElement).style.getPropertyValue('--gradient-position')
                );
                if (!isNaN(letterGradient)) {
                    letterGradients.push(letterGradient);
                }
            }
            if (letterGradients.length > 0) {
                gradientValue = letterGradients.reduce((sum, value) => sum + value, 0) / letterGradients.length;
            }
        } else {
            gradientValue = parseFloat(wordEl.style.getPropertyValue('--gradient-position'));
        }

        gradients.push(gradientValue);
    }

    return gradients;
}

function updateTranslatedWordGradients(translatedLine: HTMLElement, originalLine: HTMLElement): boolean {
    const translatedWords = Array.from(
        translatedLine.querySelectorAll('.slt-sync-word, .slt-replace-word')
    ) as HTMLElement[];

    if (translatedWords.length === 0) return false;

    const isActive = isLineActive(originalLine);
    const isSung = originalLine.classList.contains('Sung');
    const isNotSung = originalLine.classList.contains('NotSung');
    const originalWordGradients = getOriginalWordGradients(originalLine);
    const overallProgress = getOverallWordGradientProgress(originalLine);

    const originalText = originalLine.textContent || '';
    const originalHasNonLatin = /[぀-ヿ㐀-䶿一-鿿가-힯ᄀ-ᇿ؀-ۿ֐-׿Ѐ-ӿ฀-๿Ͱ-Ͽ]/.test(originalText);
    const wordRatio = translatedWords.length / Math.max(originalWordGradients.length, 1);
    const useSmoothFill = originalHasNonLatin || wordRatio < 0.7 || wordRatio > 1.45;

    const PROGRESSION_SMOOTHING = 0.68;
    const PROGRESSION_SNAP_DELTA = 8;
    const LATCH_WHITE_THRESHOLD = 96;

    const groupedTranslatedWordIndexes = new Map<number, number[]>();
    translatedWords.forEach((wordEl, index) => {
        const mappedIndex = parseInt(wordEl.dataset.originalIndex || '-1', 10);
        if (mappedIndex < 0) return;
        if (!groupedTranslatedWordIndexes.has(mappedIndex)) {
            groupedTranslatedWordIndexes.set(mappedIndex, []);
        }
        groupedTranslatedWordIndexes.get(mappedIndex)!.push(index);
    });

    const hasWordLevelGradient = originalWordGradients.some(value => !isNaN(value));
    const perWordGradientDegrees = hasWordLevelGradient ? '90deg' : '180deg';

    if (!hasWordLevelGradient && overallProgress === null) {
        const lineGradientRaw = originalLine.style.getPropertyValue('--gradient-position').trim();
        const lineGradient = lineGradientRaw ? parseFloat(lineGradientRaw) : NaN;
        const fallbackGradient = !isNaN(lineGradient)
            ? Math.max(-20, Math.min(100, lineGradient))
            : (isSung ? 100 : (isNotSung ? -20 : (isActive ? 40 : -20)));

        translatedWords.forEach(wordEl => {
            setStyleProp(wordEl, '--gradient-degrees', perWordGradientDegrees);
            setDataProp(wordEl, 'sltGradientPos', fallbackGradient.toString());
            setStyleProp(wordEl, '--gradient-position', `${fallbackGradient}%`);

            const isWordSung = fallbackGradient >= 90;
            const isWordActive = fallbackGradient > -15 && fallbackGradient < 90;

            wordEl.classList.toggle('slt-word-past', isWordSung);
            wordEl.classList.toggle('slt-word-active', isWordActive);
            wordEl.classList.toggle('slt-word-future', !isWordSung && !isWordActive);

            wordEl.classList.toggle('word-sung', isWordSung);
            wordEl.classList.toggle('word-active', isWordActive);
            wordEl.classList.toggle('word-notsng', !isWordSung && !isWordActive);

            const mappedIndex = parseInt(wordEl.dataset.originalIndex || '-1', 10);
            updateSyncWordLetterStates(wordEl, fallbackGradient, isWordActive, isWordSung, originalLine, mappedIndex);
        });

        return true;
    }

    translatedWords.forEach((wordEl, i) => {
        setStyleProp(wordEl, '--gradient-degrees', perWordGradientDegrees);
        let gradientPosition = -20;
        const previousGradient = parseFloat(wordEl.dataset.sltGradientPos || 'NaN');
        const wasLatchedWhite = wordEl.dataset.sltLatchedWhite === '1';

        if (!isActive) {
            gradientPosition = isSung ? 100 : -20;
            delete wordEl.dataset.sltLatchedWhite;
        } else {
            const mappedIndex = parseInt(wordEl.dataset.originalIndex || '-1', 10);
            const mappedGradient =
                !useSmoothFill && mappedIndex >= 0 && mappedIndex < originalWordGradients.length
                    ? originalWordGradients[mappedIndex]
                    : NaN;

            if (!isNaN(mappedGradient)) {
                const groupedIndexes = groupedTranslatedWordIndexes.get(mappedIndex) || [];
                const groupSize = groupedIndexes.length;
                const indexInGroup = groupedIndexes.indexOf(i);

                if (groupSize > 1 && indexInGroup >= 0) {
                    const sourceProgress = Math.max(0, Math.min(1, (mappedGradient + 20) / 120));
                    const segmentStart = indexInGroup / groupSize;
                    const segmentEnd = (indexInGroup + 1) / groupSize;

                    if (sourceProgress <= segmentStart) {
                        gradientPosition = -20;
                    } else if (sourceProgress >= segmentEnd) {
                        gradientPosition = 100;
                    } else {
                        const localProgress = (sourceProgress - segmentStart) / Math.max(segmentEnd - segmentStart, 0.0001);
                        gradientPosition = -20 + Math.max(0, Math.min(1, localProgress)) * 120;
                    }
                } else {
                    gradientPosition = mappedGradient;
                }
            } else if (overallProgress !== null) {
                const totalWords = Math.max(translatedWords.length, 1);
                const wordStart = i / totalWords;
                const wordEnd = (i + 1) / totalWords;

                if (overallProgress <= wordStart) {
                    gradientPosition = -20;
                } else if (overallProgress >= wordEnd) {
                    gradientPosition = 100;
                } else {
                    const localProgress = (overallProgress - wordStart) / Math.max(wordEnd - wordStart, 0.0001);
                    gradientPosition = -20 + Math.max(0, Math.min(1, localProgress)) * 120;
                }
            }

            if (!isNaN(previousGradient)) {
                gradientPosition = Math.max(gradientPosition, previousGradient);
            }

            if (wasLatchedWhite || gradientPosition >= LATCH_WHITE_THRESHOLD) {
                gradientPosition = 100;
                setDataProp(wordEl, 'sltLatchedWhite', '1');
            } else if (!isNaN(previousGradient)) {
                const delta = gradientPosition - previousGradient;
                if (delta > PROGRESSION_SNAP_DELTA) {
                    gradientPosition = gradientPosition;
                } else if (delta > 0) {
                    gradientPosition = previousGradient + delta * PROGRESSION_SMOOTHING;
                } else {
                    gradientPosition = previousGradient;
                }
            }
        }

        const clamped = Math.max(-20, Math.min(100, gradientPosition));
        setDataProp(wordEl, 'sltGradientPos', clamped.toString());
        setStyleProp(wordEl, '--gradient-position', `${clamped}%`);

        const isWordSung = clamped >= 90;
        const isWordActive = clamped > -15 && clamped < 90;

        wordEl.classList.toggle('slt-word-past', isWordSung);
        wordEl.classList.toggle('slt-word-active', isWordActive);
        wordEl.classList.toggle('slt-word-future', !isWordSung && !isWordActive);

        wordEl.classList.toggle('word-sung', isWordSung);
        wordEl.classList.toggle('word-active', isWordActive);
        wordEl.classList.toggle('word-notsng', !isWordSung && !isWordActive);

        if (!isActive && isNotSung) {
            wordEl.classList.remove('word-sung', 'word-active', 'slt-word-past', 'slt-word-active');
            wordEl.classList.add('word-notsng', 'slt-word-future');
        }

        const mappedIndex = parseInt(wordEl.dataset.originalIndex || '-1', 10);
        updateSyncWordLetterStates(
            wordEl,
            clamped,
            wordEl.classList.contains('slt-word-active'),
            wordEl.classList.contains('slt-word-past'),
            originalLine,
            mappedIndex
        );
    });

    return true;
}

function updateWordSyncStates(doc: Document): void {
    if (!isOverlayEnabled) return;

    const lyricsContainer = doc.querySelector('.SpicyLyricsScrollContainer');
    const lyricsType = lyricsContainer?.getAttribute('data-lyrics-type') || 'Line';
    const Spicetify = (globalThis as any).Spicetify;
    const currentTimeMs = Spicetify?.Player?.getProgress?.() || 0;
    const currentTime = currentTimeMs / 1000;

    doc.querySelectorAll('.slt-sync-translation').forEach((transLine) => {
        const transLineEl = transLine as HTMLElement;

        const originalLine = findOriginalLineForTranslation(transLineEl);
        if (!originalLine) return;

        const originalGradient = originalLine.style.getPropertyValue('--gradient-position').trim();
        const isActive = isLineActive(originalLine);
        const isSung = originalLine.classList.contains('Sung');
        const isNotSung = originalLine.classList.contains('NotSung');

        syncTranslationLineFromOriginal(originalLine, transLineEl, lyricsType);

        const updatedByWords = updateTranslatedWordGradients(transLineEl, originalLine);
        if (updatedByWords) {
            clearStyleProp(transLineEl, '--gradient-position');
            return;
        }

        if (originalGradient !== '') {
            return;
        }

        if (!isActive) {
            setStyleProp(transLineEl, '--gradient-position', isSung ? '100%' : (isNotSung ? '-20%' : '-20%'));
            return;
        }

        const wordProgress = getOverallWordGradientProgress(originalLine);
        if (wordProgress !== null) {
            setStyleProp(transLineEl, '--gradient-position', `${-20 + wordProgress * 120}%`);
            return;
        }

        const lineStartTime = parseFloat(transLineEl.dataset.startTime || '0');
        const lineEndTime = parseFloat(transLineEl.dataset.endTime || '0');
        if (lineEndTime > 0 && lineStartTime >= 0) {
            if (currentTime >= lineEndTime) {
                setStyleProp(transLineEl, '--gradient-position', '100%');
            } else if (currentTime < lineStartTime) {
                setStyleProp(transLineEl, '--gradient-position', '-20%');
            } else {
                const total = lineEndTime - lineStartTime;
                const pct = total <= 0 ? 1 : (currentTime - lineStartTime) / total;
                setStyleProp(transLineEl, '--gradient-position', `${-20 + Math.max(0, Math.min(1, pct)) * 120}%`);
            }
        }
    });
}

function syncBlurToTranslations(doc: Document): void {
    doc.querySelectorAll('.slt-interleaved-translation, .slt-replace-line, .slt-romanization-line, .slt-original-line').forEach((transEl) => {
        const transHtml = transEl as HTMLElement;
        const isOriginalLine = transHtml.classList.contains('slt-original-line');

        let lineEl: HTMLElement | null = null;
        if (isOriginalLine) {
            let next = transEl.nextElementSibling as HTMLElement | null;
            while (next && !next.classList.contains('line')) {
                next = next.nextElementSibling as HTMLElement | null;
            }
            lineEl = next;
        } else {
            let prev = transEl.previousElementSibling as HTMLElement | null;
            while (prev && !prev.classList.contains('line')) {
                prev = prev.previousElementSibling as HTMLElement | null;
            }
            lineEl = prev;
        }

        if (lineEl) {
            const blurAmount = lineEl.style.getPropertyValue('--BlurAmount');
            if (blurAmount) {
                setStyleProp(transHtml, '--BlurAmount', blurAmount);
            } else {
                clearStyleProp(transHtml, '--BlurAmount');
            }
        }
    });
}

type BreakdownLookup = (sourceText: string, translatedText: string) => BreakdownToken[] | null;

let breakdownLookup: BreakdownLookup | null = null;
let lastLearningKey = '';
let lastLearningLine: HTMLElement | null = null;
let currentTargetLanguage = '';
let lastLearningCheck = 0;
const LEARNING_THROTTLE_MS = 120;

export function setBreakdownLookup(lookup: BreakdownLookup | null): void {
    breakdownLookup = lookup;
    lastLearningKey = '';
}

export function setLearningTargetLanguage(lang: string): void {
    if (currentTargetLanguage === lang) return;
    currentTargetLanguage = lang;
    invalidateLearningRow();
}

export function invalidateLearningRow(): void {
    lastLearningKey = '';
    lastLearningLine = null;
    lastLearningCheck = 0;
}

function findActiveLine(doc: Document): HTMLElement | null {
    const lines = getLyricLines(doc);
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] as HTMLElement;
        if (line.classList.contains('Active') || line.classList.contains('active')) return line;
    }
    return null;
}

function removeLearningRows(doc: Document): void {
    doc.querySelectorAll('.slt-learning-row').forEach(el => el.remove());
}

function buildLearningRow(doc: Document, tokens: BreakdownToken[], origin: 'heuristic' | 'model'): HTMLElement {
    const row = doc.createElement('div');
    row.className = 'slt-learning-row';
    row.dataset.origin = origin;

    for (const token of tokens) {
        if (!token.source && !token.target) continue;

        const cell = doc.createElement('span');
        cell.className = 'slt-learning-token';
        cell.dataset.confidence = token.confidence;

        const source = doc.createElement('span');
        source.className = 'slt-learning-source';
        source.textContent = token.source || '—';
        cell.appendChild(source);

        const target = doc.createElement('span');
        target.className = 'slt-learning-target';
        target.textContent = token.target || '—';
        cell.appendChild(target);

        const showLemma = token.lemma && token.lemma !== token.source;
        if (showLemma || token.pos) {
            const meta = doc.createElement('span');
            meta.className = 'slt-learning-meta';

            if (showLemma) {
                const lemma = doc.createElement('span');
                lemma.className = 'slt-learning-lemma';
                lemma.textContent = token.lemma as string;
                meta.appendChild(lemma);
            }

            if (token.pos) {
                const pos = doc.createElement('span');
                pos.className = 'slt-learning-pos';
                pos.textContent = token.pos;
                meta.appendChild(pos);
            }

            cell.appendChild(meta);
        }

        const tip = [token.lemma ? `lemma: ${token.lemma}` : '', token.pos || '', token.note || '']
            .filter(Boolean)
            .join(' · ');
        if (tip) cell.title = tip;

        row.appendChild(cell);
    }

    return row;
}

function updateLearningRow(doc: Document): void {
    if (!currentConfig.learningMode) {
        if (lastLearningKey) {
            removeLearningRows(doc);
            invalidateLearningRow();
        }
        return;
    }

    const now = Date.now();
    if (now - lastLearningCheck < LEARNING_THROTTLE_MS) return;
    lastLearningCheck = now;

    if (lastLearningLine && lastLearningKey && lastLearningLine.isConnected
        && (lastLearningLine.classList.contains('Active') || lastLearningLine.classList.contains('active'))) {
        const existingRow = doc.querySelector('.slt-learning-row');
        if (existingRow && existingRow.isConnected) return;
    }

    const activeLine = findActiveLine(doc);
    if (!activeLine) return;

    const sourceText = extractLineText(activeLine);
    if (!sourceText) return;

    const index = parseInt(activeLine.dataset.sltIndex || '-1', 10);
    const translated = (index >= 0 ? translationMap.get(index) : undefined)
        || lookupByContent(translationByContent, sourceText)
        || '';
    if (!translated) return;

    const modelTokens = breakdownLookup ? breakdownLookup(sourceText, translated) : null;
    const origin: 'heuristic' | 'model' = modelTokens ? 'model' : 'heuristic';
    const tokens = modelTokens || buildHeuristicBreakdown(sourceText, translated, currentTargetLanguage).tokens;
    if (tokens.length === 0) return;

    const key = `${origin}:${sourceText}:${translated}:${tokens.length}`;
    const anchor = learningAnchorFor(activeLine);
    if (!anchor || !anchor.parentNode) return;

    const existing = doc.querySelector('.slt-learning-row') as HTMLElement | null;
    if (existing && existing.isConnected && lastLearningKey === key && existing.previousElementSibling === anchor) {
        lastLearningLine = activeLine;
        return;
    }

    removeLearningRows(doc);

    const row = buildLearningRow(doc, tokens, origin);
    anchor.parentNode.insertBefore(row, anchor.nextSibling);
    lastLearningKey = key;
    lastLearningLine = activeLine;
}

function learningAnchorFor(line: HTMLElement): HTMLElement | null {
    let node = line.nextElementSibling as HTMLElement | null;
    let anchor: HTMLElement = line;

    while (node) {
        if (node.classList.contains('slt-interleaved-translation')
            || node.classList.contains('slt-replace-line')
            || node.classList.contains('slt-romanization-line')
            || node.classList.contains('slt-original-line')) {
            anchor = node;
            node = node.nextElementSibling as HTMLElement | null;
            continue;
        }
        break;
    }

    return anchor;
}

function restoreOriginalLines(doc: Document): void {
    doc.querySelectorAll('.slt-interleaved-translation').forEach(el => el.remove());
    doc.querySelectorAll('.slt-sync-translation').forEach(el => el.remove());
    doc.querySelectorAll('.slt-romanization-line').forEach(el => el.remove());
    doc.querySelectorAll('.slt-original-line').forEach(el => el.remove());

    doc.querySelectorAll('.slt-replace-line').forEach(el => el.remove());
    doc.querySelectorAll('.slt-replace-hidden').forEach(el => el.classList.remove('slt-replace-hidden'));

    doc.querySelectorAll('[data-slt-original-html]').forEach(el => {
        const original = (el as HTMLElement).dataset.sltOriginalHtml;
        if (original !== undefined) {
            el.innerHTML = original;
            delete (el as HTMLElement).dataset.sltOriginalHtml;
        }
    });
    doc.querySelectorAll('[data-slt-original-text]').forEach(el => {
        const original = (el as HTMLElement).dataset.sltOriginalText;
        if (original !== undefined) {
            el.textContent = original;
            delete (el as HTMLElement).dataset.sltOriginalText;
        }
    });
    doc.querySelectorAll('[data-slt-replaced-with]').forEach(el => {
        delete (el as HTMLElement).dataset.sltReplacedWith;
    });

    doc.querySelectorAll('.spicy-translation-container').forEach(el => el.remove());
    doc.querySelectorAll('.spicy-hidden-original').forEach(el => {
        el.classList.remove('spicy-hidden-original');
    });
    doc.querySelectorAll('.spicy-original-wrapper').forEach(wrapper => {
        const parent = wrapper.parentElement;
        if (parent) {
            const originalContent = wrapper.innerHTML;
            wrapper.remove();
            if (parent.innerHTML.trim() === '' || !parent.querySelector('.word, .syllable, .letterGroup, .letter')) {
                parent.innerHTML = originalContent;
            }
        }
    });

    doc.querySelectorAll('.slt-overlay-parent, .spicy-translated').forEach(el => {
        el.classList.remove('slt-overlay-parent', 'spicy-translated');
    });

    doc.querySelectorAll('.slt-sync-word').forEach(el => {
        el.classList.remove('slt-word-past', 'slt-word-active', 'slt-word-future');
    });
}

function applyNoneMode(doc: Document): void {
    invalidateWordUnitsCache();

    const lines = getLyricLines(doc);
    if (!lines || lines.length === 0) {
        restoreOriginalLines(doc);
        return;
    }

    const lineTexts = extractLineTexts(lines);
    rebuildPerLineMaps(lines, lineTexts);

    if (renderSignatureUnchanged(doc, lines, lineTexts)) return;

    restoreOriginalLines(doc);

    if (currentConfig.showRomanization) {
        const claimed = new Set<Element>();

        lines.forEach((line, index) => {
            const lineEl = line as HTMLElement;
            lineEl.dataset.sltIndex = index.toString();

            const romanizationText = romanizationCompanionText(line, index, 'none');
            if (!romanizationText) return;

            const romanEl = buildRomanizationLine(doc, index, lineTimingData[index], line, romanizationText);
            if (!romanEl || !line.parentNode) return;

            line.parentNode.insertBefore(romanEl, line.nextSibling);
            claimed.add(romanEl);
        });

        doc.querySelectorAll('.slt-romanization-line').forEach(el => {
            if (!claimed.has(el)) el.remove();
        });
    } else {
        lines.forEach((line, index) => {
            (line as HTMLElement).dataset.sltIndex = index.toString();
        });
    }

    markRenderComplete(doc);
}

function renderTranslations(doc: Document): void {
    if (!isOverlayEnabled) return;

    if (currentConfig.mode === 'none') {
        applyNoneMode(doc);
        return;
    }

    if (translationMap.size === 0 && !hasContentData()) return;

    switch (currentConfig.mode) {
        case 'replace':
            applyReplaceMode(doc);
            break;
        case 'interleaved':
            applyInterleavedMode(doc);
            break;
    }
}

let lastActiveLineUpdate = 0;
const ACTIVE_LINE_THROTTLE_MS = 50;

function isDocumentValid(doc: Document): boolean {
    try {
        return doc && doc.body !== null && doc.defaultView !== null;
    } catch {
        return false;
    }
}

function onActiveLineChanged(doc: Document): void {
    if (!isOverlayEnabled) return;

    if (!isDocumentValid(doc)) {
        const observer = activeLineObservers.get(doc);
        if (observer) {
            try { observer.disconnect(); } catch {}
            activeLineObservers.delete(doc);
        }
        return;
    }

    const now = Date.now();
    if (now - lastActiveLineUpdate < ACTIVE_LINE_THROTTLE_MS) {
        return;
    }
    lastActiveLineUpdate = now;

    try {
        if (currentConfig.mode === 'interleaved' || currentConfig.mode === 'replace' || currentConfig.mode === 'none') {
            doc.querySelectorAll('.slt-replace-line, .slt-interleaved-translation, .slt-romanization-line, .slt-original-line').forEach(el => {
                const orig = adjacentOriginalLine(el);
                el.classList.toggle('active', !!orig && isLineActive(orig));
            });
        }
    } catch (err) { }
}

const activeLineObservers = new Map<Document, MutationObserver>();
let activeSyncIntervalId: ReturnType<typeof setInterval> | null = null;
let activeSyncRafId: number | null = null;

function syncLoop(): void {
    if (!isOverlayEnabled) {
        activeSyncRafId = null;
        return;
    }

    if (translationMap.size === 0 && !hasContentData()) {
        activeSyncRafId = requestAnimationFrame(syncLoop);
        return;
    }

    try {
        invalidateWordUnitsCache();
        onActiveLineChanged(document);
        updateLearningRow(document);
        updateWordSyncStates(document);
        syncBlurToTranslations(document);

        const pipWindow = getPIPWindow();
        if (pipWindow) {
            try {
                const pipDoc = pipWindow.document;
                if (pipDoc && pipDoc.body) {
                    ensurePIPStyles(pipDoc);

                    if (translationMap.size > 0 && currentConfig.mode !== 'none') {
                        const hasTranslations = pipDoc.querySelector('.slt-replace-line, .slt-interleaved-translation');
                        if (!hasTranslations) {
                            renderTranslations(pipDoc);
                        }
                    }

                    onActiveLineChanged(pipDoc);
                    updateWordSyncStates(pipDoc);
                    syncBlurToTranslations(pipDoc);

                    if (!activeLineObservers.has(pipDoc)) {
                        setupActiveLineObserver(pipDoc);
                    }
                }
            } catch (pipErr) {
            }
        } else if (activeLineObservers.size > 1) {
            for (const [observedDoc, observer] of activeLineObservers) {
                if (observedDoc === document) continue;
                try { observer.disconnect(); } catch {}
                activeLineObservers.delete(observedDoc);
            }
        }
    } catch (e) { }

    activeSyncRafId = requestAnimationFrame(syncLoop);
}

function startActiveSyncInterval(): void {
    if (activeSyncRafId) return;
    activeSyncRafId = requestAnimationFrame(syncLoop);
}

export function pauseActiveSync(): void {
    if (getPIPWindow()) return;
    stopActiveSyncInterval();
}

export function resumeActiveSync(): void {
    if (!isOverlayEnabled) return;
    startActiveSyncInterval();
}

function stopActiveSyncInterval(): void {
    if (activeSyncRafId) {
        cancelAnimationFrame(activeSyncRafId);
        activeSyncRafId = null;
    }
    if (activeSyncIntervalId) {
        clearInterval(activeSyncIntervalId);
        activeSyncIntervalId = null;
    }
}

function setupActiveLineObserver(doc: Document): void {
    try {
        if (!isDocumentValid(doc)) {
            return;
        }

        const existingObserver = activeLineObservers.get(doc);
        if (existingObserver) {
            existingObserver.disconnect();
            activeLineObservers.delete(doc);
        }

        let lyricsContainer = findLyricsContainer(doc);

        if (!lyricsContainer && isSidebarLyricsActive(doc)) {
            lyricsContainer = findSidebarLyricsPage(doc);
        }

        if (!lyricsContainer) {
            lyricsContainer = doc.querySelector('.spicy-pip-wrapper #SpicyLyricsPage');
        }

        if (!lyricsContainer) {
            lyricsContainer = doc.querySelector('#SpicyLyricsPage');
        }

        if (!lyricsContainer) {
            startActiveSyncInterval();
            return;
        }

        const observer = new MutationObserver((mutations) => {
            try {
                let activeChanged = false;

                for (const mutation of mutations) {
                    if (activeChanged) break;
                    if (mutation.type === 'childList') {
                        if (mutation.addedNodes.length > 0) activeChanged = true;
                    } else if (mutation.type === 'attributes') {
                        const target = mutation.target as HTMLElement;
                        if (target && (target.classList?.contains('line') || target.closest?.('.line'))) {
                            activeChanged = true;
                        }
                    }
                }

                if (activeChanged) {
                    onActiveLineChanged(doc);
                }
            } catch (e) { }
        });

        observer.observe(lyricsContainer, {
            attributes: true,
            attributeFilter: ['class', 'data-active', 'style'],
            subtree: true,
            childList: true
        });

        activeLineObservers.set(doc, observer);

        startActiveSyncInterval();

        setTimeout(() => onActiveLineChanged(doc), 50);

    } catch (err) {
        warn('Failed to setup active line observer:', err);
        startActiveSyncInterval();
    }
}

export function enableOverlay(config?: Partial<OverlayConfig>): void {
    if (config) {
        currentConfig = { ...currentConfig, ...config };
    }

    isOverlayEnabled = true;

    initOverlayContainer(document);
    setupActiveLineObserver(document);

    if (translationMap.size > 0) {
        renderTranslations(document);
    }

    document.body.classList.add('slt-overlay-active');

    try {
        const qiVal = localStorage.getItem('spicy-lyric-translator:show-quality-indicator');
        document.body.classList.toggle('slt-hide-quality-indicator', qiVal === 'false');
    } catch {}

    const pipWindow = getPIPWindow();
    if (pipWindow) {
        ensurePIPStyles(pipWindow.document);
        initOverlayContainer(pipWindow.document);
        setupActiveLineObserver(pipWindow.document);
        if (translationMap.size > 0) {
            renderTranslations(pipWindow.document);
        }
    }

}

export function disableOverlay(): void {
    isOverlayEnabled = false;

    stopActiveSyncInterval();

    activeLineObservers.forEach((observer, doc) => {
        observer.disconnect();
    });
    activeLineObservers.clear();

    const cleanup = (doc: Document) => {
        forgetRenderState(doc);

        const overlay = doc.getElementById('spicy-translate-overlay');
        if (overlay) overlay.remove();

        const interleavedOverlay = doc.getElementById('slt-interleaved-overlay');
        if (interleavedOverlay) interleavedOverlay.remove();

        restoreOriginalLines(doc);
        doc.querySelectorAll('.slt-learning-row').forEach(el => el.remove());
    };

    cleanup(document);

    const pipWindow = getPIPWindow();
    if (pipWindow) {
        cleanup(pipWindow.document);
    }

    translationMap.clear();
    romanizationMap.clear();
    originalTextMap.clear();
    translationByContent.clear();
    romanizationByContent.clear();
    originalByContent.clear();
    qualityByContent.clear();
    timingByContent.clear();
    document.body.classList.remove('slt-overlay-active');

}

export function updateOverlayContent(translations: Map<number, string>): void {
    translationMap = new Map(translations);

    if (isOverlayEnabled) {
        renderTranslations(document);

        const pipWindow = getPIPWindow();
        if (pipWindow) {
            renderTranslations(pipWindow.document);
        }
    }
}

export function clearOverlayContent(): void {
    translationMap.clear();
    romanizationMap.clear();
    originalTextMap.clear();
    translationByContent.clear();
    romanizationByContent.clear();
    originalByContent.clear();
    qualityByContent.clear();
    timingByContent.clear();
    lineTimingData = [];

    const clearDoc = (doc: Document) => {
        forgetRenderState(doc);

        const container = doc.getElementById('spicy-translate-overlay');
        if (container) container.innerHTML = '';

        doc.querySelectorAll('.slt-interleaved-translation').forEach(el => el.remove());
        doc.querySelectorAll('.slt-romanization-line').forEach(el => el.remove());
        doc.querySelectorAll('.slt-learning-row').forEach(el => el.remove());
        doc.querySelectorAll('.slt-original-line').forEach(el => el.remove());

        doc.querySelectorAll('.slt-replace-line').forEach(el => el.remove());
        doc.querySelectorAll('.slt-replace-hidden').forEach(el => el.classList.remove('slt-replace-hidden'));

        doc.querySelectorAll('[data-slt-original-html]').forEach(el => {
            const original = (el as HTMLElement).dataset.sltOriginalHtml;
            if (original !== undefined) {
                el.innerHTML = original;
                delete (el as HTMLElement).dataset.sltOriginalHtml;
            }
        });
        doc.querySelectorAll('[data-slt-original-text]').forEach(el => {
            const original = (el as HTMLElement).dataset.sltOriginalText;
            if (original !== undefined) {
                el.textContent = original;
                delete (el as HTMLElement).dataset.sltOriginalText;
            }
        });
        doc.querySelectorAll('[data-slt-replaced-with]').forEach(el => {
            delete (el as HTMLElement).dataset.sltReplacedWith;
        });

        doc.querySelectorAll('.spicy-translation-container').forEach(el => el.remove());
        doc.querySelectorAll('.spicy-hidden-original').forEach(el => {
            el.classList.remove('spicy-hidden-original');
        });
    };

    clearDoc(document);

    const pipWindow = getPIPWindow();
    if (pipWindow) {
        clearDoc(pipWindow.document);
    }
}

export function isOverlayActive(): boolean {
    return isOverlayEnabled;
}

export function getOverlayConfig(): OverlayConfig {
    return { ...currentConfig };
}

export function setOverlayConfig(config: Partial<OverlayConfig>): void {
    const wasEnabled = isOverlayEnabled;

    const savedTranslations = new Map(translationMap);

    if (wasEnabled) {
        disableOverlay();
    }

    currentConfig = { ...currentConfig, ...config };

    translationMap = savedTranslations;

    if (wasEnabled) {
        enableOverlay();
    }
}

export function setLineTimingData(data: LyricLineData[]): void {
    lineTimingData = data;
}

export function setRomanizationData(data: Map<number, string>): void {
    romanizationMap = new Map(data);
}

export function setOriginalTextData(data: Map<number, string>): void {
    originalTextMap = new Map(data);
}

export function setQualityMetadata(metadata: Map<number, TranslationQualityMeta>): void {
    qualityMap = new Map(metadata);
}

function createQualityIndicator(doc: Document, index: number): HTMLElement | null {
    const meta = qualityMap.get(index);
    if (!meta) return null;

    const indicator = doc.createElement('span');
    indicator.className = 'slt-quality-indicator';

    const isCached = meta.source === 'cache';
    const apiLabel = meta.api === 'google' ? 'Google'
        : meta.api === 'libretranslate' ? 'LibreTranslate'
        : meta.api === 'custom' ? 'Custom'
        : meta.api || 'Unknown';

    indicator.dataset.source = meta.source;
    indicator.dataset.api = meta.api || '';

    const dot = doc.createElement('span');
    dot.className = `slt-qi-dot ${isCached ? 'slt-qi-cached' : 'slt-qi-fresh'}`;
    indicator.appendChild(dot);

    const label = doc.createElement('span');
    label.className = 'slt-qi-label';
    label.textContent = isCached ? `Cached · ${apiLabel}` : `Fresh · ${apiLabel}`;
    indicator.appendChild(label);

    const tooltipParts: string[] = [];
    tooltipParts.push(`Source: ${isCached ? 'Cached' : 'Live API'}`);
    tooltipParts.push(`Provider: ${apiLabel}`);
    if (meta.detectedLanguage) {
        tooltipParts.push(`Detected: ${meta.detectedLanguage.toUpperCase()}`);
    }
    indicator.title = tooltipParts.join(' | ');

    return indicator;
}

function ensurePIPStyles(pipDoc: Document): void {
    if (pipDoc.getElementById('slt-pip-styles')) return;
    const mainStyle = document.getElementById('spicy-lyric-translator-styles');
    if (mainStyle) {
        const clone = mainStyle.cloneNode(true) as HTMLElement;
        clone.id = 'slt-pip-styles';
        pipDoc.head.appendChild(clone);
    }
}

export function initPIPOverlay(): void {
    if (!isOverlayEnabled) return;

    const pipWindow = getPIPWindow();
    if (!pipWindow) return;

    ensurePIPStyles(pipWindow.document);
    initOverlayContainer(pipWindow.document);
    setupActiveLineObserver(pipWindow.document);

    if (translationMap.size > 0) {
        renderTranslations(pipWindow.document);
    }
}

export function getOverlayStyles(): string {
    return `

body.slt-overlay-active .LyricsContent {}

.spicy-translate-overlay {
    pointer-events: none;
    user-select: none;
    z-index: 10;
}

.spicy-pip-wrapper .slt-interleaved-translation {
    font-size: calc(0.82em * var(--slt-overlay-font-scale, 1));
}

.Cinema--Container .slt-interleaved-translation,
.Root__cinema-view .slt-interleaved-translation,
#SpicyLyricsPage.ForcedCompactMode .slt-interleaved-translation {
    font-size: calc(0.88em * var(--slt-overlay-font-scale, 1));
}

#SpicyLyricsPage.SidebarMode .slt-interleaved-translation {
    font-size: calc(0.78em * var(--slt-overlay-font-scale, 1));
}

body.SpicySidebarLyrics__Active #SpicyLyricsPage .slt-interleaved-translation,
#SpicyLyricsPage.CardMode .slt-interleaved-translation {
    font-size: calc(0.65em * var(--slt-overlay-font-scale, 1));
}

.slt-interleaved-translation.slt-music-break {
    color: rgba(255, 255, 255, 0.35) !important;
    -webkit-text-fill-color: rgba(255, 255, 255, 0.35) !important;
    background: none !important;
    font-size: calc(0.35em * var(--slt-overlay-font-scale, 1));
    letter-spacing: 0.3em;
    padding: 8px 0 16px 0;
}

.slt-romanization-line {
    display: block;
    width: 100%;
    flex: 0 0 100%;
    font-size: calc(0.55em * var(--slt-overlay-font-scale, 1));
    font-weight: 600;
    font-style: italic;
    line-height: 1.2;
    padding: 2px 0 2px 0;
    letter-spacing: 0.02em;
    color: rgba(255, 215, 120, 0.78);
    text-align: left;
    white-space: normal;
    word-wrap: break-word;
    overflow-wrap: anywhere;
    word-break: break-word;
    pointer-events: none;
    opacity: 0.7;
    filter: blur(var(--BlurAmount, 0px));
    transition: opacity 0.25s ease, filter 0.25s ease, color 0.25s ease;
}

.slt-romanization-line.OppositeAligned,
.slt-romanization-line.rtl {
    text-align: end;
}

.line.Active + .slt-romanization-line,
.slt-romanization-line.active,
.slt-romanization-line.Active {
    opacity: 1 !important;
    filter: none !important;
    color: rgba(255, 224, 150, 0.95);
}

.line.Sung + .slt-romanization-line,
.slt-romanization-line.Sung {
    opacity: 0.45;
}

.line.NotSung + .slt-romanization-line,
.slt-romanization-line.NotSung {
    opacity: 0.55;
}

.slt-interleaved-translation.Sung,
.slt-replace-line.Sung {
    opacity: var(--Vocal-Sung-opacity, 0.497);
}

.slt-interleaved-translation.NotSung,
.slt-replace-line.NotSung {
    opacity: var(--Vocal-NotSung-opacity, 0.51);
}

.spicy-pip-wrapper .slt-romanization-line {
    font-size: calc(0.7em * var(--slt-overlay-font-scale, 1));
}

.Cinema--Container .slt-romanization-line,
.Root__cinema-view .slt-romanization-line,
#SpicyLyricsPage.ForcedCompactMode .slt-romanization-line {
    font-size: calc(0.75em * var(--slt-overlay-font-scale, 1));
    padding: 3px 0;
}

#SpicyLyricsPage.SidebarMode .slt-romanization-line {
    font-size: calc(0.65em * var(--slt-overlay-font-scale, 1));
    padding: 1px 0;
}

body.SpicySidebarLyrics__Active #SpicyLyricsPage .slt-romanization-line,
#SpicyLyricsPage.CardMode .slt-romanization-line {
    font-size: calc(0.55em * var(--slt-overlay-font-scale, 1));
    padding: 1px 0;
    margin: 0;
}
.slt-learning-row {
    display: flex;
    flex-wrap: wrap;
    align-items: stretch;
    gap: 6px 10px;
    padding: 6px 0 14px 0;
    pointer-events: auto;
    user-select: text;
    text-align: left;
    letter-spacing: 0;
    scale: 1;
    filter: none;
    animation: slt-learning-in 180ms ease-out;
}

@keyframes slt-learning-in {
    from { opacity: 0; transform: translateY(-2px); }
    to { opacity: 1; transform: none; }
}

.slt-learning-token {
    display: inline-flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
    padding: 3px 7px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.07);
    border-left: 2px solid rgba(255, 255, 255, 0.28);
    font-size: calc(0.3em * var(--slt-overlay-font-scale, 1));
    line-height: 1.25;
    font-weight: 600;
    white-space: normal;
    max-width: 16em;
}

.slt-learning-token[data-confidence="high"] { border-left-color: rgba(126, 231, 135, 0.85); }
.slt-learning-token[data-confidence="medium"] { border-left-color: rgba(255, 209, 102, 0.8); }
.slt-learning-token[data-confidence="low"] { border-left-color: rgba(255, 255, 255, 0.22); }

.slt-learning-row[data-origin="heuristic"] .slt-learning-token {
    border-left-style: dashed;
}

.slt-learning-source {
    color: rgba(255, 255, 255, 0.96);
    font-weight: 800;
}

.slt-learning-target {
    color: rgba(255, 255, 255, 0.74);
    font-weight: 600;
}

.slt-learning-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0 0.5em;
    margin-top: auto;
    padding-top: 1px;
}

.slt-learning-lemma {
    color: rgba(255, 255, 255, 0.5);
    font-weight: 500;
    font-style: italic;
}

.slt-learning-pos {
    color: rgba(255, 255, 255, 0.42);
    font-weight: 500;
    text-transform: lowercase;
    letter-spacing: 0.04em;
}

#SpicyLyricsPage.SidebarMode .slt-learning-token,
body.SpicySidebarLyrics__Active #SpicyLyricsPage .slt-learning-token,
#SpicyLyricsPage.CardMode .slt-learning-token {
    font-size: calc(0.42em * var(--slt-overlay-font-scale, 1));
    padding: 2px 5px;
    max-width: 12em;
}
`;
}

export default {
    enableOverlay,
    disableOverlay,
    updateOverlayContent,
    clearOverlayContent,
    isOverlayActive,
    getOverlayConfig,
    setOverlayConfig,
    setOverlayRomanization,
    updateOverlayConfig,
    setLineTimingData,
    setRomanizationData,
    setOriginalTextData,
    setQualityMetadata,
    initPIPOverlay,
    getOverlayStyles
};
