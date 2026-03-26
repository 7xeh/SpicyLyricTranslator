import { state, TranslationQualityMeta } from './state';
import { Icons } from './icons';
import { storage } from './storage';
import { translateLyrics, isOffline, getCacheStats } from './translator';
import { getCurrentTrackUri } from './trackCache';
import { setViewingLyrics } from './connectivity';
import { 
    enableOverlay, 
    disableOverlay, 
    updateOverlayContent, 
    isOverlayActive,
    setLineTimingData,
    setQualityMetadata
} from './translationOverlay';
import { shouldSkipTranslation, detectLanguageHeuristic, isSameLanguage } from './languageDetection';
import { openSettingsModal } from './settings';
import { debug, warn, error } from './debug';
import { fetchLyricsFromAPI, clearLyricsCache, LyricLineData } from './lyricsFetcher';

let viewControlsObserver: MutationObserver | null = null;
let lyricsObserver: MutationObserver | null = null;
let translateDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let viewModeIntervalId: ReturnType<typeof setInterval> | null = null;
let romanizationToggleListener: (() => void) | null = null;

function getPIPWindow(): Window | null {
    try {
        const docPiP = (globalThis as any).documentPictureInPicture;
        if (docPiP && docPiP.window) return docPiP.window;
    } catch (e) {}
    return null;
}

export function isRomanizationActive(): boolean {
    const page = document.querySelector('#SpicyLyricsPage');
    if (!page?.classList.contains('Lyrics_RomanizationAvailable')) {
        return false;
    }

    const btn = document.querySelector('#RomanizationToggle');
    if (btn) {
        if (btn.classList.contains('active')) return true;
    }

    try {
        const spicetifyStorage = (globalThis as any).Spicetify?.LocalStorage;
        if (spicetifyStorage?.get) {
            const val = spicetifyStorage.get('SpicyLyrics:romanization');
            if (val === 'true') return true;
            if (val === 'false') return false;
        }
    } catch (e) {}

    try {
        for (const key of ['SpicyLyrics:romanization', 'romanization']) {
            const val = localStorage.getItem(key);
            if (val === 'true') return true;
            if (val === 'false') return false;
        }
    } catch (e) {}

    return false;
}

export function isSpicyLyricsOpen(): boolean {
    if (document.querySelector('#SpicyLyricsPage') || 
        document.querySelector('.spicy-pip-wrapper #SpicyLyricsPage') ||
        document.querySelector('.Cinema--Container') ||
        document.querySelector('.spicy-lyrics-cinema') ||
        document.body.classList.contains('SpicySidebarLyrics__Active')) {
        return true;
    }
    
    const pipWindow = getPIPWindow();
    if (pipWindow?.document.querySelector('#SpicyLyricsPage')) {
        return true;
    }
    
    return false;
}

export function getLyricsContent(): HTMLElement | null {
    const pipWindow = getPIPWindow();
    if (pipWindow) {
        const pipContent = pipWindow.document.querySelector('#SpicyLyricsPage .LyricsContainer .LyricsContent') ||
                          pipWindow.document.querySelector('#SpicyLyricsPage .LyricsContent') ||
                          pipWindow.document.querySelector('.LyricsContent');
        if (pipContent) return pipContent as HTMLElement;
    }
    
    if (document.body.classList.contains('SpicySidebarLyrics__Active')) {
        const sidebarContent = document.querySelector('.Root__right-sidebar #SpicyLyricsPage .LyricsContainer .LyricsContent') ||
                              document.querySelector('.Root__right-sidebar #SpicyLyricsPage .LyricsContent');
        if (sidebarContent) return sidebarContent as HTMLElement;
    }
    
    return document.querySelector('#SpicyLyricsPage .LyricsContainer .LyricsContent') ||
           document.querySelector('#SpicyLyricsPage .LyricsContent') ||
           document.querySelector('.spicy-pip-wrapper .LyricsContent') ||
           document.querySelector('.Cinema--Container .LyricsContent') ||
           document.querySelector('.LyricsContainer .LyricsContent');
}

export function waitForElement(selector: string, timeout: number = 10000): Promise<Element | null> {
    return new Promise((resolve) => {
        const element = document.querySelector(selector);
        if (element) {
            resolve(element);
            return;
        }
        const observer = new MutationObserver((mutations, obs) => {
            const el = document.querySelector(selector);
            if (el) {
                obs.disconnect();
                resolve(el);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => {
            observer.disconnect();
            resolve(null);
        }, timeout);
    });
}

export function updateButtonState(): void {
    const buttons = [
        document.querySelector('#TranslateToggle'),
        getPIPWindow()?.document.querySelector('#TranslateToggle')
    ];
    
    buttons.forEach(button => {
        if (button) {
            button.innerHTML = state.isEnabled ? Icons.Translate : Icons.TranslateOff;
            button.classList.toggle('active', state.isEnabled);
            const btnWithTippy = button as any;
            if (btnWithTippy._tippy) {
                btnWithTippy._tippy.setContent(state.isEnabled ? 'Disable Translation' : 'Enable Translation');
            }
        }
    });
}

export function restoreButtonState(): void {
    const buttons = [
        document.querySelector('#TranslateToggle'),
        getPIPWindow()?.document.querySelector('#TranslateToggle')
    ];
    
    buttons.forEach(button => {
        if (button) {
            button.classList.remove('loading', 'error');
            button.innerHTML = state.isEnabled ? Icons.Translate : Icons.TranslateOff;
        }
    });
}

export function setButtonErrorState(hasError: boolean): void {
    const buttons = [
        document.querySelector('#TranslateToggle'),
        getPIPWindow()?.document.querySelector('#TranslateToggle')
    ];
    buttons.forEach(button => {
        if (button) button.classList.toggle('error', hasError);
    });
}

function createTranslateButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.id = 'TranslateToggle';
    button.className = 'ViewControl';
    button.innerHTML = state.isEnabled ? Icons.Translate : Icons.TranslateOff;
    
    if (state.isEnabled) button.classList.add('active');
    
    if (typeof Spicetify !== 'undefined' && Spicetify.Tippy) {
        try {
            Spicetify.Tippy(button, {
                ...Spicetify.TippyProps,
                content: state.isEnabled ? 'Disable Translation' : 'Enable Translation'
            });
        } catch (e) {
            warn('Failed to create tooltip:', e);
        }
    }
    
    button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleTranslateToggle();
    });
    
    button.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openSettingsModal();
        return false;
    });
    
    return button;
}

export function insertTranslateButton(): void {
    insertTranslateButtonIntoDocument(document);
    const pipWindow = getPIPWindow();
    if (pipWindow) {
        insertTranslateButtonIntoDocument(pipWindow.document);
    }
}

function insertTranslateButtonIntoDocument(doc: Document): void {
    let viewControls = doc.querySelector('#SpicyLyricsPage .ContentBox .ViewControls') ||
                       doc.querySelector('#SpicyLyricsPage .ViewControls');
    
    if (!viewControls && doc.body.classList.contains('SpicySidebarLyrics__Active')) {
        viewControls = doc.querySelector('.Root__right-sidebar #SpicyLyricsPage .ViewControls');
    }
    
    if (!viewControls) {
        viewControls = doc.querySelector('.ViewControls');
    }
    
    if (!viewControls) return;
    if (viewControls.querySelector('#TranslateToggle')) return;
    
    const romanizeButton = viewControls.querySelector('#RomanizationToggle');
    const translateButton = createTranslateButton();
    
    if (romanizeButton) {
        romanizeButton.insertAdjacentElement('afterend', translateButton);
    } else {
        const firstChild = viewControls.firstChild;
        if (firstChild) {
            viewControls.insertBefore(translateButton, firstChild);
        } else {
            viewControls.appendChild(translateButton);
        }
    }
}

export async function handleTranslateToggle(): Promise<void> {
    if (state.isTranslating) return;
    
    state.isEnabled = !state.isEnabled;
    storage.set('translation-enabled', state.isEnabled.toString());
    
    updateButtonState();
    
    if (state.isEnabled) {
        await translateCurrentLyrics();
    } else {
        removeTranslations();
    }
}

export function extractLineText(lineElement: Element): string {
    if (lineElement.classList.contains('musical-line')) return '';
    
    const words = lineElement.querySelectorAll('.word:not(.dot), .syllable, .letterGroup');
    if (words.length > 0) {
        return Array.from(words)
            .map(w => w.textContent?.trim() || '')
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    
    const letters = lineElement.querySelectorAll('.letter');
    if (letters.length > 0) {
        return Array.from(letters)
            .map(l => l.textContent || '')
            .join('')
            .trim();
    }
    
    return lineElement.textContent?.trim() || '';
}

function getConfidentNonTargetLineIndexes(lines: string[], targetLanguage: string): number[] {
    const indexes: number[] = [];
    const targetBase = targetLanguage.toLowerCase().split('-')[0].split('_')[0];
    const targetIsLatin = !['ja', 'zh', 'ko', 'ar', 'he', 'ru', 'th', 'hi', 'el'].includes(targetBase);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line || line.trim().length === 0) {
            continue;
        }

        if (targetIsLatin) {
            const hasNonLatin = /[\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF\u0600-\u06FF\u0590-\u05FF\u0400-\u04FF\u0E00-\u0E7F\u0900-\u097F\u0370-\u03FF]/.test(line);
            if (hasNonLatin) {
                indexes.push(i);
                continue;
            }
        }

        const detected = detectLanguageHeuristic(line);
        if (!detected) {
            continue;
        }

        if (!isSameLanguage(detected.code, targetLanguage) && detected.confidence >= 0.7) {
            indexes.push(i);
        }
    }

    return indexes;
}

function getLyricsLines(): NodeListOf<Element> {
    const docs: Document[] = [document];
    const pip = getPIPWindow();
    if (pip) docs.push(pip.document);

    const excludeSelector = ':not(.musical-line):not(.bg-line)';

    for (const doc of docs) {
        const scrollContainer = doc.querySelectorAll(`#SpicyLyricsPage .SpicyLyricsScrollContainer .line${excludeSelector}`);
        if (scrollContainer.length > 0) return scrollContainer;
        
        const lyricsContent = doc.querySelectorAll(`#SpicyLyricsPage .LyricsContent .line${excludeSelector}`);
        if (lyricsContent.length > 0) return lyricsContent;
        
        if (doc.body.classList.contains('SpicySidebarLyrics__Active')) {
            const sidebar = doc.querySelectorAll(`.Root__right-sidebar #SpicyLyricsPage .line${excludeSelector}`);
            if (sidebar.length > 0) return sidebar;
        }
        
        const generic = doc.querySelectorAll(`.LyricsContent .line${excludeSelector}, .LyricsContainer .line${excludeSelector}`);
        if (generic.length > 0) return generic;
    }
    
    return document.querySelectorAll('.non-existent-selector');
}

export async function waitForLyricsAndTranslate(retries: number = 10, delay: number = 500): Promise<void> {
    debug('Waiting for lyrics to load...');
    
    for (let i = 0; i < retries; i++) {
        if (!isSpicyLyricsOpen() || state.isTranslating) return;

        const lines = getLyricsLines();
        if (lines.length > 0) {
            const firstLineText = lines[0].textContent?.trim();
            if (firstLineText && firstLineText.length > 0) {
                 await new Promise(resolve => setTimeout(resolve, delay));
                 await translateCurrentLyrics();
                 return;
            }
        }
        await new Promise(resolve => setTimeout(resolve, delay));
    }
}

export async function translateCurrentLyrics(): Promise<void> {
    if (state.isTranslating) return;
    
    const currentTrackUri = getCurrentTrackUri();
    if (currentTrackUri && currentTrackUri === state.lastTranslatedSongUri && state.translatedLyrics.size > 0) {
        debug('Already translated this track, skipping');
        return;
    }
    
    if (isOffline()) {
        const cacheStats = getCacheStats();
        if (cacheStats.entries === 0) {
            if (state.showNotifications && Spicetify.showNotification) {
                Spicetify.showNotification('Offline - translations unavailable', true);
            }
            return;
        }
    }
    
    let lines = getLyricsLines();
    if (lines.length === 0) return;
    
    state.isTranslating = true;
    
    const buttons = [
        document.querySelector('#TranslateToggle'),
        getPIPWindow()?.document.querySelector('#TranslateToggle')
    ];
    buttons.forEach(b => {
        if(b) {
            b.classList.add('loading');
            b.innerHTML = Icons.Loading;
        }
    });
    
    try {
        let domLineTexts: string[] = [];
        lines.forEach(line => domLineTexts.push(extractLineText(line)));

        const nonEmptyDomTexts = domLineTexts.filter(t => t.trim().length > 0);
        if (nonEmptyDomTexts.length === 0) {
            state.isTranslating = false;
            restoreButtonState();
            return;
        }

        const currentTrackUri = getCurrentTrackUri();
        const romanizationOn = isRomanizationActive();

        if (romanizationOn) {
            debug('Romanization is active — skipping pre-API language detection on DOM text');
        } else {
            const preApiSkipCheck = await shouldSkipTranslation(nonEmptyDomTexts, state.targetLanguage, currentTrackUri || undefined);
            if (preApiSkipCheck.detectedLanguage) {
                state.detectedLanguage = preApiSkipCheck.detectedLanguage;
            }
        }

        let apiLineTexts: string[] | null = null;
        let apiLanguage: string | undefined;
        let apiLineData: LyricLineData[] | null = null;
        try {
            const apiResult = await fetchLyricsFromAPI();
            if (apiResult && apiResult.lines.length > 0) {
                apiLineTexts = apiResult.lines;
                apiLanguage = apiResult.language;
                apiLineData = apiResult.lineData;
                debug(`Got ${apiLineTexts.length} lines from SpicyLyrics API (DOM has ${lines.length} lines)`);
            }
        } catch (apiErr) {
            warn('SpicyLyrics API fetch failed, falling back to DOM:', apiErr);
        }
        
        let apiVocalTexts: string[] | null = null;
        let apiVocalLineData: LyricLineData[] | null = null;
        if (apiLineTexts && apiLineData) {
            apiVocalTexts = [];
            apiVocalLineData = [];
            for (let i = 0; i < apiLineData.length; i++) {
                if (!apiLineData[i].isInstrumental && apiLineTexts[i].trim().length > 0) {
                    apiVocalTexts.push(apiLineTexts[i]);
                    apiVocalLineData.push(apiLineData[i]);
                }
            }
            debug(`API: ${apiLineTexts.length} total, ${apiVocalTexts.length} vocal (DOM: ${lines.length})`);
        }
        
        let useApiLines = apiVocalTexts && apiVocalTexts.length === lines.length;
        
        if (!useApiLines && romanizationOn && apiVocalTexts && apiVocalTexts.length > 0) {
            for (let retryAttempt = 0; retryAttempt < 4; retryAttempt++) {
                await new Promise(resolve => setTimeout(resolve, 400));
                lines = getLyricsLines();
                if (lines.length === 0) break;
                
                domLineTexts = [];
                lines.forEach(line => domLineTexts.push(extractLineText(line)));
                
                if (apiVocalTexts.length === lines.length) {
                    useApiLines = true;
                    debug(`Romanization: DOM count matches API vocal count (${lines.length}) on retry ${retryAttempt + 1}`);
                    break;
                }
            }
            
            if (!useApiLines && apiVocalTexts.length > 0 && lines.length > 0) {
                debug(`Romanization: API vocal (${apiVocalTexts.length}) vs DOM (${lines.length}) — using API text mapped to DOM count`);
                useApiLines = true;
                const domCount = lines.length;
                if (apiVocalTexts.length > domCount) {
                    apiVocalTexts = apiVocalTexts.slice(0, domCount);
                    if (apiVocalLineData) apiVocalLineData = apiVocalLineData.slice(0, domCount);
                }
            }
        }

        if (!useApiLines && apiVocalTexts && apiVocalTexts.length > 0) {
            for (let retryAttempt = 0; retryAttempt < 8; retryAttempt++) {
                await new Promise(resolve => setTimeout(resolve, 600));
                lines = getLyricsLines();
                if (lines.length === 0) break;
                
                domLineTexts = [];
                lines.forEach(line => domLineTexts.push(extractLineText(line)));
                
                if (apiVocalTexts.length === lines.length) {
                    useApiLines = true;
                    debug(`DOM refreshed on retry ${retryAttempt + 1}: count now matches (${lines.length})`);
                    break;
                }
                
                const apiTextSet = new Set(apiVocalTexts.map(t => t.trim().toLowerCase()));
                const domMatchCount = domLineTexts.filter(t => apiTextSet.has(t.trim().toLowerCase())).length;
                if (domMatchCount > domLineTexts.length * 0.3) {
                    debug(`DOM refreshed on retry ${retryAttempt + 1}: ${domMatchCount}/${domLineTexts.length} text matches`);
                    break;
                }
            }
        }
        
        let matchedTimingData: LyricLineData[] | null = null;
        if (!useApiLines && apiVocalTexts && apiVocalLineData && apiVocalTexts.length > 0) {
            const apiTextMap = new Map<string, LyricLineData>();
            for (let i = 0; i < apiVocalTexts.length; i++) {
                const norm = apiVocalTexts[i].trim().toLowerCase();
                if (norm && !apiTextMap.has(norm)) {
                    apiTextMap.set(norm, apiVocalLineData[i]);
                }
            }
            
            matchedTimingData = [];
            let matchCount = 0;
            for (let i = 0; i < domLineTexts.length; i++) {
                const domNorm = domLineTexts[i].trim().toLowerCase();
                const matched = apiTextMap.get(domNorm);
                if (matched) {
                    matchedTimingData.push(matched);
                    matchCount++;
                } else {
                    matchedTimingData.push({
                        text: domLineTexts[i],
                        startTime: 0,
                        endTime: 0,
                        isInstrumental: false,
                    });
                }
            }
            debug(`Text-based matching: ${matchCount}/${domLineTexts.length} DOM lines matched to API timing data`);
        }
        
        const lineTexts = useApiLines ? apiVocalTexts! : domLineTexts;
        
        if (useApiLines) {
            debug('Using SpicyLyrics API vocal lines for translation');
        } else if (apiVocalTexts) {
            debug(`API vocal count (${apiVocalTexts.length}) != DOM count (${lines.length}), using DOM with text-matched timing`);
        }
        
        const nonEmptyTexts = lineTexts.filter(t => t.trim().length > 0);
        if (nonEmptyTexts.length === 0) {
            state.isTranslating = false;
            restoreButtonState();
            return;
        }
        
        const detectedLang = apiLanguage || state.detectedLanguage || undefined;

        let skipCheck: { skip: boolean; reason?: string; detectedLanguage?: string };
        if (romanizationOn && apiLanguage) {
            const apiLangSame = isSameLanguage(apiLanguage, state.targetLanguage);
            skipCheck = apiLangSame
                ? { skip: true, reason: `Lyrics already in ${apiLanguage.toUpperCase()}`, detectedLanguage: apiLanguage }
                : { skip: false, detectedLanguage: apiLanguage };
            debug('Romanization active: using API language (' + apiLanguage + ') for skip check instead of text analysis');
        } else {
            skipCheck = await shouldSkipTranslation(nonEmptyTexts, state.targetLanguage, currentTrackUri || undefined);
        }
        
        if (skipCheck.detectedLanguage) state.detectedLanguage = skipCheck.detectedLanguage;
        
        let translations;

        if (skipCheck.skip) {
            const nonTargetIndexes = getConfidentNonTargetLineIndexes(lineTexts, state.targetLanguage);

            if (nonTargetIndexes.length === 0) {
                state.isTranslating = false;
                state.lastTranslatedSongUri = currentTrackUri;
                restoreButtonState();
                if (state.showNotifications && Spicetify.showNotification) {
                    Spicetify.showNotification(skipCheck.reason || 'Lyrics already in target language');
                }
                return;
            }

            const partialLines = nonTargetIndexes.map(index => lineTexts[index]);
            const partialTranslations = await translateLyrics(
                partialLines,
                state.targetLanguage,
                undefined,
                state.detectedLanguage || undefined
            );

            const translatedByIndex = new Map<number, { translatedText: string; source?: 'cache' | 'api'; apiProvider?: string }>();
            partialTranslations.forEach((result, idx) => {
                translatedByIndex.set(nonTargetIndexes[idx], {
                    translatedText: result.translatedText,
                    source: result.source,
                    apiProvider: result.apiProvider
                });
            });

            translations = lineTexts.map((line, index) => {
                const partial = translatedByIndex.get(index);
                const translatedText = partial?.translatedText || line;
                const wasTranslated = translatedByIndex.has(index) && translatedText !== line;
                return {
                    originalText: line,
                    translatedText,
                    targetLanguage: state.targetLanguage,
                    wasTranslated,
                    source: partial?.source,
                    apiProvider: partial?.apiProvider,
                    detectedLanguage: state.detectedLanguage || undefined
                };
            });
        } else {
            translations = await translateLyrics(lineTexts, state.targetLanguage, currentTrackUri || undefined, state.detectedLanguage || undefined);
        }
        
        state.translatedLyrics.clear();
        
        translations.forEach((result, index) => {
            const domText = domLineTexts[index];
            if (domText) {
                state.translatedLyrics.set(domText, result.translatedText);
            }
            if (useApiLines && lineTexts[index] !== domText) {
                state.translatedLyrics.set(lineTexts[index], result.translatedText);
            }
        });
        
        state._translationsByIndex = new Map();
        translations.forEach((result, index) => {
            state._translationsByIndex!.set(index, result.translatedText);
        });
        
        state._qualityByIndex = new Map();
        translations.forEach((result, index) => {
            if (result.wasTranslated) {
                const meta: TranslationQualityMeta = {
                    source: result.source || 'api',
                    api: result.apiProvider || state.preferredApi,
                    detectedLanguage: state.detectedLanguage || result.detectedLanguage || undefined
                };
                state._qualityByIndex!.set(index, meta);
            }
        });
        
        state.lastTranslatedSongUri = currentTrackUri;
        
        if (useApiLines && apiVocalLineData) {
            setLineTimingData(apiVocalLineData);
        } else if (matchedTimingData) {
            setLineTimingData(matchedTimingData);
        } else if (apiLineData) {
            setLineTimingData(apiLineData);
        }
        
        applyTranslations(lines);
        
        if (state.showNotifications && Spicetify.showNotification) {
            const wasActuallyTranslated = translations.some(t => t.wasTranslated === true);
            if (wasActuallyTranslated) {
                const translatedFromApi = translations.some(t => t.wasTranslated === true && t.source === 'api');
                Spicetify.showNotification(translatedFromApi ? 'Translated from Api' : 'Translated from Cache');
            }
        }
    } catch (err) {
        error('Translation failed:', err);
        if (state.showNotifications && Spicetify.showNotification) {
            Spicetify.showNotification('Translation failed. Please try again.', true);
        }
        setButtonErrorState(true);
        setTimeout(() => setButtonErrorState(false), 3000);
    } finally {
        state.isTranslating = false;
        restoreButtonState();
    }
}

function normalizeForComparison(text: string): string {
    return (text || '').toLowerCase().replace(/[\s\p{P}]+/gu, '').trim();
}

function applyTranslations(lines: NodeListOf<Element>): void {
    const translationMapByIndex = new Map<number, string>();
    lines.forEach((line, index) => {
        let translatedText = state._translationsByIndex?.get(index);
        if (!translatedText) {
            const originalText = extractLineText(line);
            translatedText = state.translatedLyrics.get(originalText);
        }
        const originalText = extractLineText(line);
        if (translatedText && translatedText !== originalText && normalizeForComparison(translatedText) !== normalizeForComparison(originalText)) {
            translationMapByIndex.set(index, translatedText);
        }
    });
    
    if (!isOverlayActive()) {
        enableOverlay({ 
            mode: state.overlayMode,
            syncWordHighlight: state.syncWordHighlight
        });
    }
    if (state._qualityByIndex) {
        setQualityMetadata(state._qualityByIndex);
    }
    updateOverlayContent(translationMapByIndex);
}

export function reapplyTranslations(): void {
    if (state.translatedLyrics.size === 0) return;
    
    const savedTranslations = new Map(state.translatedLyrics);
    const savedIndexMap = state._translationsByIndex ? new Map(state._translationsByIndex) : undefined;
    const savedQualityMap = state._qualityByIndex ? new Map(state._qualityByIndex) : undefined;
    const savedUri = state.lastTranslatedSongUri;
    
    removeTranslations();
    
    state.translatedLyrics = savedTranslations;
    state._translationsByIndex = savedIndexMap;
    state._qualityByIndex = savedQualityMap;
    state.lastTranslatedSongUri = savedUri;
    
    const lines = getLyricsLines();
    if (lines.length > 0) {
        applyTranslations(lines);
    }
}

export function removeTranslations(): void {
    if (isOverlayActive()) disableOverlay();
    
    const docs = [document];
    const pip = getPIPWindow();
    if (pip) docs.push(pip.document);
    
    docs.forEach(doc => {
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
        
        doc.querySelectorAll('.slt-replace-line').forEach(el => el.remove());
        doc.querySelectorAll('.slt-replace-hidden').forEach(el => el.classList.remove('slt-replace-hidden'));
        
        doc.querySelectorAll('.spicy-translation-container').forEach(el => el.remove());
        doc.querySelectorAll('.slt-interleaved-translation').forEach(el => el.remove());
        doc.querySelectorAll('.spicy-hidden-original').forEach(el => el.classList.remove('spicy-hidden-original'));
        doc.querySelectorAll('.spicy-translated').forEach(el => el.classList.remove('spicy-translated'));
        
        doc.querySelectorAll('.spicy-original-wrapper').forEach(wrapper => {
            const parent = wrapper.parentElement;
            if (parent) {
                const originalContent = wrapper.innerHTML;
                wrapper.remove();
                if (parent.innerHTML.trim() === '') parent.innerHTML = originalContent;
            }
        });
    });
    
    state.translatedLyrics.clear();
    state._translationsByIndex = undefined;
    state._qualityByIndex = undefined;
}

export function setupLyricsObserver(): void {
    if (lyricsObserver) {
        lyricsObserver.disconnect();
        lyricsObserver = null;
    }
    
    const lyricsContent = getLyricsContent();
    if (!lyricsContent) return;
    
    try {
        lyricsObserver = new MutationObserver((mutations) => {
            if (!state.isEnabled || state.isTranslating) return;
            
            const hasNewContent = mutations.some(m => 
                m.type === 'childList' && 
                m.addedNodes.length > 0 &&
                Array.from(m.addedNodes).some(n => 
                    n.nodeType === Node.ELEMENT_NODE && 
                    (n as Element).classList?.contains('line')
                )
            );
            
            if (hasNewContent && state.autoTranslate && !state.isTranslating) {
                if (translateDebounceTimer) clearTimeout(translateDebounceTimer);
                translateDebounceTimer = setTimeout(() => {
                    translateDebounceTimer = null;
                    if (!state.isTranslating) {
                         if (!state.isEnabled) {
                            state.isEnabled = true;
                            storage.set('translation-enabled', 'true');
                            updateButtonState();
                         }
                         translateCurrentLyrics();
                    }
                }, 500);
            }
        });
        
        lyricsObserver.observe(lyricsContent, {
            childList: true,
            subtree: true
        });
    } catch (e) {
        warn('Failed to setup Lyrics observer:', e);
    }
}

export async function onSpicyLyricsOpen(): Promise<void> {
    setViewingLyrics(true);
    
    let viewControls = await waitForElement('#SpicyLyricsPage .ViewControls', 3000);
    if (!viewControls && document.body.classList.contains('SpicySidebarLyrics__Active')) {
        viewControls = await waitForElement('.Root__right-sidebar #SpicyLyricsPage .ViewControls', 2000);
    }
    if (!viewControls) viewControls = await waitForElement('.ViewControls', 2000);
    
    if (viewControls) insertTranslateButton();
    setupLyricsObserver();
    setupRomanizationWatcher();
    
    const pipWindow = getPIPWindow();
    if (pipWindow) {
        setTimeout(() => {
            insertTranslateButtonIntoDocument(pipWindow.document);
        }, 500);
    }
    
    if (state.isEnabled) {
        updateButtonState();
        state.lastTranslatedSongUri = null;
        waitForLyricsAndTranslate(20, 600);
    } else if (state.autoTranslate) {
        state.isEnabled = true;
        storage.set('translation-enabled', 'true');
        updateButtonState();
        waitForLyricsAndTranslate(20, 600);
    }
}

export function onSpicyLyricsClose(): void {
    setViewingLyrics(false);
    if (translateDebounceTimer) {
        clearTimeout(translateDebounceTimer);
        translateDebounceTimer = null;
    }
    state.isTranslating = false;
    if (lyricsObserver) {
        lyricsObserver.disconnect();
        lyricsObserver = null;
    }
    cleanupRomanizationWatcher();
}

function setupRomanizationWatcher(): void {
    cleanupRomanizationWatcher();

    const handler = () => {
        setTimeout(() => {
            debug('Romanization toggle clicked — refreshing translations');

            if (state.isEnabled && !state.isTranslating) {
                state.lastTranslatedSongUri = null;
                state.translatedLyrics.clear();
                state._translationsByIndex = undefined;
                clearLyricsCache();
                removeTranslations();
                waitForLyricsAndTranslate(15, 500);
            }
        }, 600);
    };

    const btn = document.querySelector('#RomanizationToggle');
    if (btn) {
        btn.addEventListener('click', handler);
        romanizationToggleListener = handler;
    }
}

function cleanupRomanizationWatcher(): void {
    if (romanizationToggleListener) {
        const btn = document.querySelector('#RomanizationToggle');
        if (btn) {
            btn.removeEventListener('click', romanizationToggleListener);
        }
        romanizationToggleListener = null;
    }
}

export function setupViewModeObserver(): void {
    if (viewModeIntervalId) clearInterval(viewModeIntervalId);
    
    viewModeIntervalId = setInterval(() => {
        const isOpen = isSpicyLyricsOpen();
        if (isOpen) {
            if (!document.querySelector('#TranslateToggle')) {
                insertTranslateButton();
            }
            
            if (!romanizationToggleListener && document.querySelector('#RomanizationToggle')) {
                setupRomanizationWatcher();
            }
            
            const pipWindow = getPIPWindow();
            if (pipWindow && !pipWindow.document.querySelector('#TranslateToggle')) {
                insertTranslateButtonIntoDocument(pipWindow.document);
            }
        }
    }, 2000);
}

export function setupKeyboardShortcut(): void {
    document.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.altKey && !e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 't') {
            e.preventDefault();
            e.stopPropagation();
            if (isSpicyLyricsOpen()) handleTranslateToggle();
        }
    });
}