import { debug, warn } from './debug';
import type { LyricLineData, WordTimingData } from './lyricsFetcher';
import type { TranslationQualityMeta } from './state';
import { storage } from './storage';

export type OverlayMode = 'replace' | 'interleaved';

export interface OverlayConfig {
    mode: OverlayMode;
    opacity: number;
    fontSize: number;
    syncWordHighlight: boolean;
}

let currentConfig: OverlayConfig = {
    mode: 'replace',
    opacity: 0.85,
    fontSize: 0.9,
    syncWordHighlight: true
};

let isOverlayEnabled = false;
let translationMap: Map<number, string> = new Map();
let lineTimingData: LyricLineData[] = [];
let qualityMap: Map<number, TranslationQualityMeta> = new Map();

interface DocCache {
    lines: NodeListOf<Element> | null;
    translationMap: Map<number, HTMLElement> | null;
    lastActiveIndex: number;
}

const docCacheMap = new WeakMap<Document, DocCache>();

function getDocCache(doc: Document): DocCache {
    let cache = docCacheMap.get(doc);
    if (!cache) {
        cache = { lines: null, translationMap: null, lastActiveIndex: -1 };
        docCacheMap.set(doc, cache);
    }
    return cache;
}

function resetDocCache(doc: Document): void {
    docCacheMap.set(doc, { lines: null, translationMap: null, lastActiveIndex: -1 });
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
    
    if (doc.body?.classList?.contains('SpicySidebarLyrics__Active')) {
        const sidebarLines = doc.querySelectorAll(`.Root__right-sidebar #SpicyLyricsPage .line${excludeSelector}`);
        if (sidebarLines.length > 0) return sidebarLines;
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
    
    if (doc.body?.classList?.contains('SpicySidebarLyrics__Active')) {
        const sidebarContainer = doc.querySelector('.Root__right-sidebar #SpicyLyricsPage .SpicyLyricsScrollContainer') ||
                                 doc.querySelector('.Root__right-sidebar #SpicyLyricsPage .LyricsContent');
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

function getWordUnits(line: Element): Element[] {
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

function applyReplaceMode(doc: Document): void {
    resetDocCache(doc);

    const lines = getLyricLines(doc);
    
    doc.querySelectorAll('.slt-replace-line').forEach(el => el.remove());
    doc.querySelectorAll('.slt-replace-hidden').forEach(el => el.classList.remove('slt-replace-hidden'));
    
    const lyricsContainer = doc.querySelector('.SpicyLyricsScrollContainer');
    const lyricsType = lyricsContainer?.getAttribute('data-lyrics-type') || 'Line';
    
    lines.forEach((line, index) => {
        const translation = translationMap.get(index);
        if (!translation) return;
        
        const originalText = extractLineText(line);
        if (translation === originalText) return;
        
        if (!line.parentNode) return;
        
        line.classList.add('slt-replace-hidden');
        (line as HTMLElement).dataset.sltIndex = index.toString();
        
        const replaceEl = doc.createElement('div');
        replaceEl.className = 'slt-replace-line slt-sync-translation';
        replaceEl.dataset.lineIndex = index.toString();
        replaceEl.dataset.forLine = index.toString();
        replaceEl.dataset.lyricsType = lyricsType;
        
        const isBreak = !originalText.trim() || /^[♪♫•\-–—\s]+$/.test(originalText.trim());
        const timingInfo = lineTimingData[index];
        const isInstrumental = timingInfo?.isInstrumental || isBreak;
        
        if (isInstrumental) {
            replaceEl.textContent = '♪ ♪ ♪';
            replaceEl.classList.add('slt-replace-instrumental');
        } else {
            const vocabEnabled = storage.get('vocabulary-mode') === 'true';
            if (vocabEnabled) {
                replaceEl.classList.add('slt-vocab-line');
                appendVocabularyPairs(doc, replaceEl, originalText, translation, line, 'slt-replace-word');
            } else if (currentConfig.syncWordHighlight) {
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
            
            const clickedWord = (e.target as HTMLElement)?.closest?.('.slt-replace-word, .slt-vocab-pair');
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
        
        line.parentNode.insertBefore(replaceEl, line.nextSibling);
    });
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
    const shouldAnimateLetters = wordClassName === 'slt-sync-word' && lineHasSyllableStructure(originalLine);

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

function appendVocabularyPairs(
    doc: Document,
    container: HTMLElement,
    originalText: string,
    translatedText: string,
    originalLine: Element,
    wordClassName: 'slt-sync-word' | 'slt-replace-word'
): void {
    const origWords = originalText.trim().split(/\s+/).filter(Boolean);
    const transWords = translatedText.trim().split(/\s+/).filter(Boolean);

    if (origWords.length === 0 || transWords.length === 0) {
        container.textContent = translatedText;
        return;
    }

    const originalWordUnits = getWordUnits(originalLine);

    // Use the shorter list to determine pair count, distribute longer list across pairs
    const pairCount = Math.min(origWords.length, transWords.length);
    const origChunks = distributeWords(origWords, pairCount);
    const transChunks = distributeWords(transWords, pairCount);

    const transRatio = transWords.length / Math.max(originalWordUnits.length, 1);

    let globalWordIndex = 0;

    for (let i = 0; i < pairCount; i++) {
        const pair = doc.createElement('span');
        pair.className = 'slt-vocab-pair';

        // Translated word(s) — gradient-synced span
        const chunkWords = transChunks[i].split(/\s+/).filter(Boolean);
        const transSpan = doc.createElement('span');
        transSpan.className = `slt-vocab-translated ${wordClassName}`;

        if (wordClassName === 'slt-sync-word') {
            transSpan.classList.add('slt-word-future');
        } else {
            transSpan.classList.add('word-notsng');
        }

        const mappedOriginalIndex = originalWordUnits.length > 0
            ? Math.min(Math.floor(globalWordIndex / Math.max(transRatio, 0.01)), originalWordUnits.length - 1)
            : globalWordIndex;
        transSpan.dataset.originalIndex = Math.max(0, mappedOriginalIndex).toString();
        transSpan.dataset.wordIndex = globalWordIndex.toString();
        transSpan.textContent = transChunks[i];
        pair.appendChild(transSpan);

        globalWordIndex += chunkWords.length;

        // Original annotation — blurred below
        const origSpan = doc.createElement('span');
        origSpan.className = 'slt-vocab-original';
        origSpan.textContent = origChunks[i];
        pair.appendChild(origSpan);

        pair.title = `${origChunks[i]}  →  ${transChunks[i]}`;
        container.appendChild(pair);
    }
}

function distributeWords(words: string[], buckets: number): string[] {
    if (buckets >= words.length) {
        // More buckets than words: pad with empty at the end (shouldn't happen with our logic)
        const result = words.map(w => w);
        while (result.length < buckets) result.push('');
        return result;
    }
    // Fewer buckets than words: distribute extras across the first N buckets
    const base = Math.floor(words.length / buckets);
    const extra = words.length % buckets;
    const result: string[] = [];
    let idx = 0;
    for (let b = 0; b < buckets; b++) {
        const count = base + (b < extra ? 1 : 0);
        result.push(words.slice(idx, idx + count).join(' '));
        idx += count;
    }
    return result;
}

function lineHasSyllableStructure(line: Element): boolean {
    return !!line.querySelector('.syllable, .letterGroup .letter, .word-group .syllable');
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

        letterEl.style.setProperty('--slt-letter-shift', `${yShift.toFixed(3)}em`);
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

let interleavedScrollHandler: (() => void) | null = null;
let interleavedResizeObserver: ResizeObserver | null = null;
let interleavedAnimationFrame: number | null = null;

function setupInterleavedTracking(doc: Document): void {
    cleanupInterleavedTracking();
}

function cleanupInterleavedTracking(): void {
    if (interleavedAnimationFrame) {
        cancelAnimationFrame(interleavedAnimationFrame);
        interleavedAnimationFrame = null;
    }
    
    if (interleavedScrollHandler) {
        const docs = [document];
        const pipWin = getPIPWindow();
        if (pipWin) docs.push(pipWin.document);
        
        docs.forEach(doc => {
            const container = findLyricsContainer(doc);
            if (container) {
                container.removeEventListener('scroll', interleavedScrollHandler!);
            }
        });
        window.removeEventListener('resize', interleavedScrollHandler);
        interleavedScrollHandler = null;
    }
    
    if (interleavedResizeObserver) {
        interleavedResizeObserver.disconnect();
        interleavedResizeObserver = null;
    }
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
    if (lineHasSyllableStructure(originalLine)) return;
    if (!translationEl.querySelector(':scope > .slt-sync-word')) return;
    if (!hasWrappedSyncWords(translationEl)) return;

    translationEl.textContent = translationText;
    translationEl.dataset.sltGradientMode = 'continuous-multiline';
}

function applyInterleavedMode(doc: Document): void {
    resetDocCache(doc);

    try {
        const lines = getLyricLines(doc);
        if (!lines || lines.length === 0) {
            debug('No lyrics lines found for interleaved mode');
            return;
        }
        
        doc.querySelectorAll('.slt-interleaved-translation').forEach(el => el.remove());
        doc.querySelectorAll('.slt-sync-translation').forEach(el => el.remove());
        
        lines.forEach((line, index) => {
            try {
                const translation = translationMap.get(index);
                const originalText = extractLineText(line);
                
                const isBreak = !originalText.trim() || /^[♪♫•\-–—\s]+$/.test(originalText.trim());
                
                if (!translation && !isBreak) return;
                if (translation === originalText) return;
                
                if (!line.parentNode) {
                    return;
                }
                
                line.classList.add('slt-overlay-parent');
                (line as HTMLElement).dataset.sltIndex = index.toString();
                
                const translationEl = doc.createElement('div');
                translationEl.className = 'slt-interleaved-translation';
                translationEl.dataset.forLine = index.toString();
                translationEl.dataset.lineIndex = index.toString();
                
                const isVocabMode = storage.get('vocabulary-mode') === 'true';
                
                if (isBreak) {
                    translationEl.textContent = '• • •';
                    translationEl.classList.add('slt-music-break');
                } else if (isVocabMode && translation) {
                    translationEl.classList.add('slt-vocab-line');
                    translationEl.classList.add('slt-sync-translation');
                    appendVocabularyPairs(doc, translationEl, originalText, translation, line, 'slt-sync-word');
                } else {
                    translationEl.classList.add('slt-sync-translation');
                    if (currentConfig.syncWordHighlight && translation) {
                        appendTranslationWordSpans(doc, translationEl, translation, line, 'slt-sync-word');
                    } else {
                        translationEl.textContent = translation || '';
                    }
                }
                
                const timingInfo = lineTimingData[index];
                if (timingInfo) {
                    translationEl.dataset.startTime = timingInfo.startTime.toString();
                    translationEl.dataset.endTime = timingInfo.endTime.toString();
                }
                
                if (isLineActive(line)) translationEl.classList.add('active');
                
                const qualityIndicator = createQualityIndicator(doc, index);
                if (qualityIndicator) {
                    translationEl.appendChild(qualityIndicator);
                }
                
                line.parentNode.insertBefore(translationEl, line.nextSibling);

                if (!isBreak && currentConfig.syncWordHighlight && translation) {
                    fallbackToContinuousMultilineGradient(translationEl, translation, line);
                }
            } catch (lineErr) {
                warn('Failed to process line', index, ':', lineErr);
            }
        });
        
        setupInterleavedTracking(doc);
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

    translatedLine.style.setProperty('--gradient-degrees', '180deg');

    for (const prop of MIRRORED_LINE_STYLE_PROPS) {
        if (prop === '--gradient-degrees') continue;
        const value = originalLine.style.getPropertyValue(prop);
        if (value && value.trim() !== '') {
            translatedLine.style.setProperty(prop, value);
        } else {
            translatedLine.style.removeProperty(prop);
        }
    }

    if (!originalLine.style.getPropertyValue('--gradient-position')) {
        if (isSung) {
            translatedLine.style.setProperty('--gradient-position', '100%');
        } else if (isNotSung) {
            translatedLine.style.setProperty('--gradient-position', '-20%');
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
            wordEl.style.setProperty('--gradient-degrees', perWordGradientDegrees);
            wordEl.dataset.sltGradientPos = fallbackGradient.toString();
            wordEl.style.setProperty('--gradient-position', `${fallbackGradient}%`);

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
        wordEl.style.setProperty('--gradient-degrees', perWordGradientDegrees);
        let gradientPosition = -20;
        const previousGradient = parseFloat(wordEl.dataset.sltGradientPos || 'NaN');
        const wasLatchedWhite = wordEl.dataset.sltLatchedWhite === '1';

        if (!isActive) {
            gradientPosition = isSung ? 100 : -20;
            delete wordEl.dataset.sltLatchedWhite;
        } else {
            const mappedIndex = parseInt(wordEl.dataset.originalIndex || '-1', 10);
            const mappedGradient =
                mappedIndex >= 0 && mappedIndex < originalWordGradients.length
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
                wordEl.dataset.sltLatchedWhite = '1';
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
        wordEl.dataset.sltGradientPos = clamped.toString();
        wordEl.style.setProperty('--gradient-position', `${clamped}%`);

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

    const lines = getLyricLines(doc);

    doc.querySelectorAll('.slt-sync-translation').forEach((transLine) => {
        const transLineEl = transLine as HTMLElement;
        const lineIndex = parseInt(transLineEl.dataset.lineIndex || '-1');
        if (lineIndex < 0 || lineIndex >= lines.length) return;

        const originalLine = lines[lineIndex] as HTMLElement;
        if (!originalLine) return;

        const originalGradient = originalLine.style.getPropertyValue('--gradient-position').trim();
        const isActive = isLineActive(originalLine);
        const isSung = originalLine.classList.contains('Sung');
        const isNotSung = originalLine.classList.contains('NotSung');

        syncTranslationLineFromOriginal(originalLine, transLineEl, lyricsType);

        const updatedByWords = updateTranslatedWordGradients(transLineEl, originalLine);
        if (updatedByWords) {
            transLineEl.style.removeProperty('--gradient-position');
            return;
        }

        if (originalGradient !== '') {
            return;
        }

        if (!isActive) {
            transLineEl.style.setProperty('--gradient-position', isSung ? '100%' : (isNotSung ? '-20%' : '-20%'));
            return;
        }

        const wordProgress = getOverallWordGradientProgress(originalLine);
        if (wordProgress !== null) {
            transLineEl.style.setProperty('--gradient-position', `${-20 + wordProgress * 120}%`);
            return;
        }

        const lineStartTime = parseFloat(transLineEl.dataset.startTime || '0');
        const lineEndTime = parseFloat(transLineEl.dataset.endTime || '0');
        if (lineEndTime > 0 && lineStartTime >= 0) {
            if (currentTime >= lineEndTime) {
                transLineEl.style.setProperty('--gradient-position', '100%');
            } else if (currentTime < lineStartTime) {
                transLineEl.style.setProperty('--gradient-position', '-20%');
            } else {
                const total = lineEndTime - lineStartTime;
                const pct = total <= 0 ? 1 : (currentTime - lineStartTime) / total;
                transLineEl.style.setProperty('--gradient-position', `${-20 + Math.max(0, Math.min(1, pct)) * 120}%`);
            }
        }
    });
}

function syncBlurToTranslations(doc: Document): void {
    doc.querySelectorAll('.slt-interleaved-translation, .slt-replace-line').forEach((transEl) => {
        const transHtml = transEl as HTMLElement;
        let lineEl = transEl.previousElementSibling as HTMLElement | null;
        while (lineEl && !lineEl.classList.contains('line')) {
            lineEl = lineEl.previousElementSibling as HTMLElement | null;
        }
        if (lineEl) {
            const blurAmount = lineEl.style.getPropertyValue('--BlurAmount');
            if (blurAmount) {
                transHtml.style.setProperty('--BlurAmount', blurAmount);
            } else {
                transHtml.style.removeProperty('--BlurAmount');
            }
        }
    });
}

function renderTranslations(doc: Document): void {
    if (!isOverlayEnabled || translationMap.size === 0) return;
    
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
        if (currentConfig.mode === 'interleaved' || currentConfig.mode === 'replace') {
            const cache = getDocCache(doc);

            if (!cache.lines) {
                cache.lines = getLyricLines(doc);
            }
            
            if (!cache.lines || cache.lines.length === 0) return;

            if (!cache.translationMap) {
                cache.translationMap = new Map();
                const selector = currentConfig.mode === 'replace' ? '.slt-replace-line' : '.slt-interleaved-translation';
                const translationEls = doc.querySelectorAll(selector);
                translationEls.forEach(el => {
                    const idx = parseInt((el as HTMLElement).dataset.forLine || (el as HTMLElement).dataset.lineIndex || '-1', 10);
                    if (idx >= 0) cache.translationMap!.set(idx, el as HTMLElement);
                });
            }

            let currentActiveIndex = -1;
            for (let i = 0; i < cache.lines.length; i++) {
                if (isLineActive(cache.lines[i])) {
                    currentActiveIndex = i;
                    break;
                }
            }

            if (currentActiveIndex !== cache.lastActiveIndex) {
                if (cache.lastActiveIndex !== -1) {
                    const oldEl = cache.translationMap.get(cache.lastActiveIndex);
                    if (oldEl) oldEl.classList.remove('active');
                }

                if (currentActiveIndex !== -1) {
                    const newEl = cache.translationMap.get(currentActiveIndex);
                    if (newEl) {
                        newEl.classList.add('active');
                        if (currentConfig.mode === 'replace') {
                            try {
                                newEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            } catch (scrollErr) { }
                        }
                    }
                }

                cache.lastActiveIndex = currentActiveIndex;
            }
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
    
    try {
        onActiveLineChanged(document);
        updateWordSyncStates(document);
        syncBlurToTranslations(document);
        
        const pipWindow = getPIPWindow();
        if (pipWindow) {
            try {
                const pipDoc = pipWindow.document;
                if (pipDoc && pipDoc.body) {
                    ensurePIPStyles(pipDoc);

                    if (translationMap.size > 0) {
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
        }
    } catch (e) { }
    
    activeSyncRafId = requestAnimationFrame(syncLoop);
}

function startActiveSyncInterval(): void {
    if (activeSyncRafId) return;
    activeSyncRafId = requestAnimationFrame(syncLoop);
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
            debug('Document not valid for observer setup');
            return;
        }
        
        const existingObserver = activeLineObservers.get(doc);
        if (existingObserver) {
            existingObserver.disconnect();
            activeLineObservers.delete(doc);
        }
        
        let lyricsContainer = findLyricsContainer(doc);
        
        if (!lyricsContainer && doc.body.classList.contains('SpicySidebarLyrics__Active')) {
            lyricsContainer = doc.querySelector('.Root__right-sidebar #SpicyLyricsPage');
        }
        
        if (!lyricsContainer) {
            lyricsContainer = doc.querySelector('.spicy-pip-wrapper #SpicyLyricsPage');
        }
        
        if (!lyricsContainer) {
            lyricsContainer = doc.querySelector('#SpicyLyricsPage');
        }
        
        if (!lyricsContainer) {
            debug('No lyrics container found for observer setup');
            startActiveSyncInterval();
            return;
        }
        
        const observer = new MutationObserver((mutations) => {
            try {
                let activeChanged = false;
                let structureChanged = false;
                
                for (const mutation of mutations) {
                    if (mutation.type === 'childList') {
                        structureChanged = true;
                        if (mutation.addedNodes.length > 0) activeChanged = true;
                    } else if (mutation.type === 'attributes') {
                        const target = mutation.target as HTMLElement;
                        if (target && (target.classList?.contains('line') || target.closest?.('.line'))) {
                            activeChanged = true;
                        }
                    }
                }

                if (structureChanged) {
                    resetDocCache(doc);
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
    
    debug('Overlay enabled:', currentConfig.mode);
}

export function disableOverlay(): void {
    isOverlayEnabled = false;
    
    cleanupInterleavedTracking();
    stopActiveSyncInterval();
    
    activeLineObservers.forEach((observer, doc) => {
        observer.disconnect();
    });
    activeLineObservers.clear();
    
    const cleanup = (doc: Document) => {
        const overlay = doc.getElementById('spicy-translate-overlay');
        if (overlay) overlay.remove();
        
        const interleavedOverlay = doc.getElementById('slt-interleaved-overlay');
        if (interleavedOverlay) interleavedOverlay.remove();
        
        doc.querySelectorAll('.slt-interleaved-translation').forEach(el => el.remove());
        doc.querySelectorAll('.slt-sync-translation').forEach(el => el.remove());
        
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
    };
    
    cleanup(document);
    
    const pipWindow = getPIPWindow();
    if (pipWindow) {
        cleanup(pipWindow.document);
    }
    
    translationMap.clear();
    document.body.classList.remove('slt-overlay-active');
    
    debug('Overlay disabled');
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
    lineTimingData = [];
    
    const clearDoc = (doc: Document) => {
        const container = doc.getElementById('spicy-translate-overlay');
        if (container) container.innerHTML = '';
        
        doc.querySelectorAll('.slt-interleaved-translation').forEach(el => el.remove());
        
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
#SpicyLyricsPage.ForcedCompactMode .slt-interleaved-translation {
    font-size: calc(0.88em * var(--slt-overlay-font-scale, 1));
}

#SpicyLyricsPage.SidebarMode .slt-interleaved-translation {
    font-size: calc(0.78em * var(--slt-overlay-font-scale, 1));
}

body.SpicySidebarLyrics__Active #SpicyLyricsPage .slt-interleaved-translation {
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
    setLineTimingData,
    setQualityMetadata,
    initPIPOverlay,
    getOverlayStyles
};