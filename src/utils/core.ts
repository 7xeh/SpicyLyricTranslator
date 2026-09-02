import { state, TranslationQualityMeta } from './state';
import { Icons } from './icons';
import { storage } from './storage';
import { translateLyrics, isOffline, getCacheStats, fetchWordBreakdown, getCachedWordBreakdown, providerSupportsWordBreakdown } from './translator';
import { getCurrentTrackUri, getTrackCache } from './trackCache';
import {
    enableOverlay,
    disableOverlay,
    updateOverlayContent,
    isOverlayActive,
    setLineTimingData,
    setRomanizationData,
    setOriginalTextData,
    setQualityMetadata,
    setTranslationContentData,
    setRomanizationContentData,
    setOriginalContentData,
    setQualityContentData,
    setTimingContentData,
    updateOverlayConfig,
    isSidebarLyricsActive,
    findSidebarLyricsPage,
    pauseActiveSync,
    resumeActiveSync,
    setBreakdownLookup,
    invalidateLearningRow,
    setLearningTargetLanguage,
    CINEMA_CONTAINER_SELECTOR,
    CINEMA_LYRICS_CONTENT_SELECTOR
} from './translationOverlay';
import { shouldSkipTranslation, detectLanguageHeuristic, detectRomanizedJapanese, isSameLanguage, refineChineseLanguageCode, isLikelyNonTargetLine } from './languageDetection';
import { openSettingsModal } from './settings';
import { openQuickMenu } from './quickMenu';
import { warn, error, debug } from './debug';
import { fetchLyricsFromAPI, clearLyricsCache, LyricLineData } from './lyricsFetcher';

let viewControlsObserver: MutationObserver | null = null;
let lyricsObserver: MutationObserver | null = null;
let translateDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let rerenderDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let reapplyTimers: ReturnType<typeof setTimeout>[] = [];
let viewModeIntervalId: ReturnType<typeof setInterval> | null = null;
let romanizationToggleListener: (() => void) | null = null;
let romanizationToggleButton: Element | null = null;
let observedLyricsContent: Element | null = null;
let lastKnownRomanizationState: boolean | null = null;
let lastTranslatedRomanizationState: boolean | null = null;

let contentTranslation = new Map<string, string>();
let contentQuality = new Map<string, TranslationQualityMeta>();
let coveredKeys = new Set<string>();
let fillGapsInFlight = false;

interface SkippedTranslationState {
    trackUri: string | null;
    targetLanguage: string;
    romanizationOn: boolean;
    lyricsKey: string;
    domLyricsKey?: string;
    detectedLanguage?: string;
}

let lastSkippedTranslation: SkippedTranslationState | null = null;

function normalizeMatchKey(text: string | undefined | null): string {
    return (text || '').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '').trim();
}

function buildLyricsKey(lines: string[]): string {
    let hash = 2166136261;
    let count = 0;

    for (const rawLine of lines) {
        const line = (rawLine || '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (!line) continue;
        count++;
        const value = `${line}\u241E`;

        for (let i = 0; i < value.length; i++) {
            hash ^= value.charCodeAt(i);
            hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
        }
    }

    return `${count}:${(hash >>> 0).toString(36)}`;
}

function matchesSkippedTranslation(
    trackUri: string | null,
    targetLanguage: string,
    romanizationOn: boolean,
    lyricsKey: string
): boolean {
    if (!lastSkippedTranslation) return false;
    if (lastSkippedTranslation.trackUri !== trackUri) return false;
    if (lastSkippedTranslation.targetLanguage !== targetLanguage) return false;
    if (lastSkippedTranslation.romanizationOn !== romanizationOn) return false;
    return lastSkippedTranslation.lyricsKey === lyricsKey || lastSkippedTranslation.domLyricsKey === lyricsKey;
}

let lastSkipNotifyKey: string | null = null;

function shouldNotifySkip(trackUri: string | null, targetLanguage: string, romanizationOn: boolean): boolean {
    const key = `${trackUri ?? ''}${targetLanguage}${romanizationOn ? '1' : '0'}`;
    if (lastSkipNotifyKey === key) return false;
    lastSkipNotifyKey = key;
    return true;
}

function rememberSkippedTranslation(
    trackUri: string | null,
    targetLanguage: string,
    romanizationOn: boolean,
    lyricsKey: string,
    domLyricsKey?: string,
    detectedLanguage?: string
): void {
    lastSkippedTranslation = {
        trackUri,
        targetLanguage,
        romanizationOn,
        lyricsKey,
        domLyricsKey,
        detectedLanguage
    };
    state.lastTranslatedSongUri = trackUri;
    lastTranslatedRomanizationState = romanizationOn;
    if (detectedLanguage) state.detectedLanguage = detectedLanguage;
}

interface MatchKeys {
    norm: string;
    nonLatinNorm: string;
    latinNorm: string;
}

function buildMatchKeys(text: string): MatchKeys {
    const nonLatinOnly = text.replace(/[A-Za-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    const latinOnly = text.replace(/[^A-Za-z0-9\s'\-]/g, ' ').replace(/\s+/g, ' ').trim();

    return {
        norm: normalizeMatchKey(text),
        nonLatinNorm: nonLatinOnly && nonLatinOnly !== text ? normalizeMatchKey(nonLatinOnly) : '',
        latinNorm: latinOnly && latinOnly !== text ? normalizeMatchKey(latinOnly) : ''
    };
}

function lookupWithKeys<V>(map: Map<string, V>, keys: MatchKeys): V | undefined {
    const { norm, nonLatinNorm, latinNorm } = keys;

    if (norm) {
        const direct = map.get(norm);
        if (direct) return direct;
    }

    if (nonLatinNorm) {
        const match = map.get(nonLatinNorm);
        if (match) return match;
    }

    if (latinNorm) {
        const match = map.get(latinNorm);
        if (match) return match;
    }

    if (norm && norm.length >= 4) {
        let best: { key: string; value: V } | null = null;
        for (const [key, value] of map) {
            if (key.length < 4) continue;
            if (norm.includes(key) || key.includes(norm)) {
                if (!best || key.length > best.key.length) {
                    best = { key, value };
                }
            }
        }
        if (best) return best.value;
    }

    return undefined;
}

function lookupWithFallback<V>(map: Map<string, V>, text: string | undefined | null): V | undefined {
    if (!text) return undefined;
    return lookupWithKeys(map, buildMatchKeys(text));
}

function getPIPWindow(): Window | null {
    try {
        const docPiP = (globalThis as any).documentPictureInPicture;
        if (docPiP && docPiP.window) return docPiP.window;
    } catch (e) {}
    return null;
}

export function isRomanizationActive(): boolean {
    const readUiState = (raw: string | null | undefined): boolean | null => {
        if (!raw) return null;
        try {
            const obj = JSON.parse(raw);
            if (obj && typeof obj.romanization === 'boolean') return obj.romanization;
        } catch (e) {}
        return null;
    };

    try {
        const spicetifyStorage = (globalThis as any).Spicetify?.LocalStorage;
        const fromSpicetify = readUiState(spicetifyStorage?.get?.('SL:uiState'));
        if (fromSpicetify !== null) return fromSpicetify;
    } catch (e) {}

    try {
        const fromLocal = readUiState(localStorage.getItem('SL:uiState'));
        if (fromLocal !== null) return fromLocal;
    } catch (e) {}

    const btn = document.querySelector('#RomanizationToggle');
    if (btn && btn.classList.contains('active')) return true;

    const keys = [
        'SpicyLyrics-romanization',
        'SpicyLyrics:romanization',
        'romanization'
    ];

    try {
        const spicetifyStorage = (globalThis as any).Spicetify?.LocalStorage;
        if (spicetifyStorage?.get) {
            for (const key of keys) {
                const val = spicetifyStorage.get(key);
                if (val === 'true') return true;
                if (val === 'false') return false;
            }
        }
    } catch (e) {}

    try {
        for (const key of keys) {
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
        document.querySelector(CINEMA_CONTAINER_SELECTOR) ||
        isSidebarLyricsActive()) {
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

    if (isSidebarLyricsActive()) {
        const sidebarPage = findSidebarLyricsPage();
        const sidebarContent = sidebarPage?.querySelector('.LyricsContainer .LyricsContent') ||
                              sidebarPage?.querySelector('.LyricsContent');
        if (sidebarContent) return sidebarContent as HTMLElement;
    }

    return document.querySelector('#SpicyLyricsPage .LyricsContainer .LyricsContent') ||
           document.querySelector('#SpicyLyricsPage .LyricsContent') ||
           document.querySelector('.spicy-pip-wrapper .LyricsContent') ||
           document.querySelector(CINEMA_LYRICS_CONTENT_SELECTOR) ||
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

function setTranslateButtonsLoading(isLoading: boolean): void {
    const buttons = [
        document.querySelector('#TranslateToggle'),
        getPIPWindow()?.document.querySelector('#TranslateToggle')
    ];

    buttons.forEach(button => {
        if (!button) return;
        button.classList.toggle('loading', isLoading);
        button.innerHTML = isLoading ? Icons.Loading : (state.isEnabled ? Icons.Translate : Icons.TranslateOff);
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
        const rect = button.getBoundingClientRect();
        const x = e.clientX || rect.left;
        const y = e.clientY || rect.bottom;
        openQuickMenu(x, y);
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

function insertTranslateButtonIntoCardControls(doc: Document): boolean {
    const cardControls = doc.querySelector('#SpicyLyricsNPVCard .CardControls');
    if (!cardControls) return false;
    if (cardControls.querySelector('#TranslateToggle')) return true;

    const button = createTranslateButton();
    button.classList.add('CardControl');

    const expandButton = cardControls.querySelector('#NPVCardExpand');
    if (expandButton) {
        expandButton.insertAdjacentElement('beforebegin', button);
    } else {
        cardControls.insertBefore(button, cardControls.firstChild);
    }

    return true;
}

function insertTranslateButtonIntoDocument(doc: Document): void {
    if (insertTranslateButtonIntoCardControls(doc)) return;

    let viewControls = doc.querySelector('#SpicyLyricsPage .ContentBox .ViewControls') ||
                       doc.querySelector('#SpicyLyricsPage .ViewControls');

    if (!viewControls && isSidebarLyricsActive(doc)) {
        viewControls = findSidebarLyricsPage(doc)?.querySelector('.ViewControls') || null;
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

        const trimmed = line.trim();
        const hasNonLatin = /[\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF\u0600-\u06FF\u0590-\u05FF\u0400-\u04FF\u0E00-\u0E7F\u0900-\u097F\u0370-\u03FF]/.test(trimmed);

        if (targetIsLatin && hasNonLatin) {
            indexes.push(i);
            continue;
        }

        if (hasNonLatin && trimmed.length < 10) {
            indexes.push(i);
            continue;
        }

        if (targetIsLatin && !hasNonLatin && targetBase !== 'ja') {
            const romaji = detectRomanizedJapanese(trimmed);
            if (romaji) {
                indexes.push(i);
                continue;
            }
        }

        const detected = detectLanguageHeuristic(trimmed);
        if (!detected) {
            if (isLikelyNonTargetLine(trimmed, targetLanguage)) {
                indexes.push(i);
            }
            continue;
        }

        if (!isSameLanguage(detected.code, targetLanguage) && detected.confidence >= 0.6) {
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

        if (isSidebarLyricsActive(doc)) {
            const sidebar = findSidebarLyricsPage(doc)?.querySelectorAll(`.line${excludeSelector}`);
            if (sidebar && sidebar.length > 0) return sidebar;
        }

        const generic = doc.querySelectorAll(`.LyricsContent .line${excludeSelector}, .LyricsContainer .line${excludeSelector}`);
        if (generic.length > 0) return generic;
    }

    return document.querySelectorAll('.non-existent-selector');
}

type MissingOriginalReason = 'missing-original-lyrics';

interface TranslationSourceSelectionInput {
    domLineTexts: string[];
    romanizationOn: boolean;
    apiVocalTexts: string[] | null;
    apiVocalLineData: LyricLineData[] | null;
    cachedSourceLines?: string[] | null;
}

interface TranslationSourceSelection {
    canTranslate: boolean;
    reason?: MissingOriginalReason;
    lineTexts: string[];
    useApiLines: boolean;
    apiVocalTexts: string[] | null;
    apiVocalLineData: LyricLineData[] | null;
}

function emptyLineData(): LyricLineData {
    return {
        text: '',
        startTime: 0,
        endTime: 0,
        isInstrumental: false,
    };
}

function hasOriginalScript(lines: string[] | null | undefined): boolean {
    return Boolean(lines?.some(line => /[\u3040-\u30FF\u4E00-\u9FFF\u3400-\u4DBF\uAC00-\uD7AF\u1100-\u11FF\u0600-\u06FF\u0590-\u05FF\u0400-\u04FF\u0E00-\u0E7F\u0900-\u097F\u0370-\u03FF]/.test(line || '')));
}

export function resolveTranslationSourceLines(input: TranslationSourceSelectionInput): TranslationSourceSelection {
    const domLineTexts = [...input.domLineTexts];
    const cachedOriginalLines = hasOriginalScript(input.cachedSourceLines) ? [...input.cachedSourceLines!] : null;
    let apiVocalTexts = input.apiVocalTexts ? [...input.apiVocalTexts] : cachedOriginalLines;
    let apiVocalLineData = input.apiVocalLineData
        ? [...input.apiVocalLineData]
        : cachedOriginalLines?.map(line => ({ ...emptyLineData(), text: line })) || null;

    if (input.romanizationOn) {
        if (!apiVocalTexts || apiVocalTexts.length === 0) {
            return {
                canTranslate: false,
                reason: 'missing-original-lyrics',
                lineTexts: [],
                useApiLines: false,
                apiVocalTexts,
                apiVocalLineData
            };
        }

        const hasOriginalText = apiVocalTexts.some(text => text.trim().length > 0);
        return {
            canTranslate: hasOriginalText,
            reason: hasOriginalText ? undefined : 'missing-original-lyrics',
            lineTexts: hasOriginalText ? apiVocalTexts : [],
            useApiLines: hasOriginalText,
            apiVocalTexts,
            apiVocalLineData
        };
    }

    const useApiLines = Boolean(apiVocalTexts && apiVocalTexts.length > 0);
    const lineTexts = useApiLines ? apiVocalTexts! : domLineTexts;
    return {
        canTranslate: lineTexts.some(text => text.trim().length > 0),
        lineTexts,
        useApiLines,
        apiVocalTexts,
        apiVocalLineData
    };
}

export function getLyricsFirstLineText(): string | null {
    const lines = getLyricsLines();
    if (lines.length > 0) {
        return lines[0].textContent?.trim() || null;
    }
    return null;
}

const LYRICS_SETTLE_DELAY_MS = 150;

export async function waitForLyricsAndTranslate(retries: number = 10, delay: number = 500, previousFirstLine?: string | null, _previousTrackUri?: string | null): Promise<void> {
    const staleLineRetryLimit = Math.max(3, Math.floor(retries / 3));

    for (let i = 0; i < retries; i++) {
        if (!isSpicyLyricsOpen() || state.isTranslating) return;

        const lines = getLyricsLines();
        if (lines.length > 0) {
            const firstLineText = lines[0].textContent?.trim();
            if (firstLineText && firstLineText.length > 0) {
                if (previousFirstLine && firstLineText === previousFirstLine && i < staleLineRetryLimit) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                setupLyricsObserver();
                await new Promise(resolve => setTimeout(resolve, LYRICS_SETTLE_DELAY_MS));
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
    const currentRomanization = isRomanizationActive();
    const romanizationChanged = lastTranslatedRomanizationState !== null && currentRomanization !== lastTranslatedRomanizationState;

    if (currentTrackUri && currentTrackUri === state.lastTranslatedSongUri && state.translatedLyrics.size > 0 && !romanizationChanged) {
        let hasRealTranslation = false;
        for (const [src, dst] of state.translatedLyrics) {
            if (src && dst && src !== dst) {
                hasRealTranslation = true;
                break;
            }
        }
        if (hasRealTranslation) {
            const lines = getLyricsLines();
            if (lines.length > 0) {
                applyTranslations(lines);
            }
            void fillVisibleGaps();
            return;
        }
        state.lastTranslatedSongUri = null;
        state.translatedLyrics.clear();
    }

    if (romanizationChanged) {
        removeTranslations();
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
    let buttonsLoading = false;
    const phaseStart = Date.now();
    const sincePhaseStart = (): string => `${Date.now() - phaseStart}ms`;

    try {
        let domLineTexts: string[] = [];
        lines.forEach(line => domLineTexts.push(extractLineText(line)));

        const nonEmptyDomTexts = domLineTexts.filter(t => t.trim().length > 0);
        if (nonEmptyDomTexts.length === 0) {
            return;
        }

        const currentTrackUri = getCurrentTrackUri();
        const romanizationOn = isRomanizationActive();
        const domLyricsKey = buildLyricsKey(nonEmptyDomTexts);
        if (matchesSkippedTranslation(currentTrackUri, state.targetLanguage, romanizationOn, domLyricsKey)) {
            removeTranslations();
            state.lastTranslatedSongUri = currentTrackUri;
            lastTranslatedRomanizationState = romanizationOn;
            return;
        }
        let preApiSkipCheck: { skip: boolean; reason?: string; detectedLanguage?: string } | null = null;

        if (!romanizationOn) {
            preApiSkipCheck = await shouldSkipTranslation(nonEmptyDomTexts, state.targetLanguage, currentTrackUri || undefined);
            if (preApiSkipCheck.detectedLanguage) {
                state.detectedLanguage = preApiSkipCheck.detectedLanguage;
            }

            if (preApiSkipCheck.skip && getConfidentNonTargetLineIndexes(domLineTexts, state.targetLanguage).length === 0) {
                removeTranslations();
                rememberSkippedTranslation(
                    currentTrackUri,
                    state.targetLanguage,
                    romanizationOn,
                    domLyricsKey,
                    domLyricsKey,
                    preApiSkipCheck.detectedLanguage
                );
                if (state.showNotifications && Spicetify.showNotification && shouldNotifySkip(currentTrackUri, state.targetLanguage, romanizationOn)) {
                    Spicetify.showNotification(preApiSkipCheck.reason || 'Lyrics already in target language');
                }
                return;
            }
        }

        debug(`translate: skip-check done at ${sincePhaseStart()} (detected=${state.detectedLanguage ?? 'none'})`);

        setTranslateButtonsLoading(true);
        buttonsLoading = true;

        let apiLineTexts: string[] | null = null;
        let apiLanguage: string | undefined;
        let apiLineData: LyricLineData[] | null = null;
        let cachedSourceLines: string[] | null = null;
        let cachedSourceLanguage: string | undefined;
        try {
            const apiResult = await fetchLyricsFromAPI();
            if (apiResult && apiResult.lines.length > 0) {
                apiLineTexts = apiResult.lines;
                apiLanguage = apiResult.language;
                apiLineData = apiResult.lineData;
            }
        } catch (apiErr) {
            warn('SpicyLyrics API fetch failed, falling back to DOM:', apiErr);
        }

        debug(`translate: lyrics API fetch done at ${sincePhaseStart()}`);

        if (romanizationOn && currentTrackUri) {
            const trackCache = getTrackCache(currentTrackUri, state.targetLanguage);
            if (trackCache?.sourceLines && hasOriginalScript(trackCache.sourceLines)) {
                cachedSourceLines = trackCache.sourceLines;
                cachedSourceLanguage = trackCache.lang;
            }
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
        }

        let useApiLines = Boolean(apiVocalTexts && apiVocalTexts.length > 0);

        let sourceSelection = resolveTranslationSourceLines({
            domLineTexts,
            romanizationOn,
            apiVocalTexts,
            apiVocalLineData,
            cachedSourceLines
        });

        if (!sourceSelection.canTranslate) {
            removeTranslations();
            if (romanizationOn && state.showNotifications && Spicetify.showNotification) {
                Spicetify.showNotification('Original lyrics unavailable while romanization is enabled', true);
            }
            return;
        }

        apiVocalTexts = sourceSelection.apiVocalTexts;
        apiVocalLineData = sourceSelection.apiVocalLineData;
        useApiLines = sourceSelection.useApiLines;

        const lineTexts = sourceSelection.lineTexts;

        const nonEmptyTexts = lineTexts.filter(t => t.trim().length > 0);
        if (nonEmptyTexts.length === 0) {
            return;
        }
        const sourceLyricsKey = buildLyricsKey(nonEmptyTexts);

        if (apiLanguage) {
            apiLanguage = refineChineseLanguageCode(apiLanguage, nonEmptyTexts);
        }

        const detectedLang = apiLanguage || cachedSourceLanguage || state.detectedLanguage || undefined;

        let skipCheck: { skip: boolean; reason?: string; detectedLanguage?: string };
        if (romanizationOn && apiLanguage) {
            const apiLangSame = isSameLanguage(apiLanguage, state.targetLanguage);
            skipCheck = apiLangSame
                ? { skip: true, reason: `Lyrics already in ${apiLanguage.toUpperCase()}`, detectedLanguage: apiLanguage }
                : { skip: false, detectedLanguage: apiLanguage };
        } else if (romanizationOn) {
            skipCheck = { skip: false, detectedLanguage: 'unknown' };
        } else if (apiLanguage && apiLanguage !== 'unknown') {
            const apiLangSame = isSameLanguage(apiLanguage, state.targetLanguage);
            if (apiLangSame) {
                skipCheck = { skip: true, reason: `Lyrics already in ${apiLanguage.toUpperCase()}`, detectedLanguage: apiLanguage };
            } else {
                skipCheck = { skip: false, detectedLanguage: apiLanguage };
            }
        } else {
            skipCheck = preApiSkipCheck || await shouldSkipTranslation(nonEmptyTexts, state.targetLanguage, currentTrackUri || undefined);
        }

        if (skipCheck.detectedLanguage) state.detectedLanguage = skipCheck.detectedLanguage;

        let translations;

        if (skipCheck.skip) {
            if (matchesSkippedTranslation(currentTrackUri, state.targetLanguage, romanizationOn, sourceLyricsKey)) {
                removeTranslations();
                state.lastTranslatedSongUri = currentTrackUri;
                lastTranslatedRomanizationState = romanizationOn;
                return;
            }

            const nonTargetIndexes = getConfidentNonTargetLineIndexes(lineTexts, state.targetLanguage);

            const classifiableLineCount = lineTexts.filter(line => {
                const trimmed = (line || '').trim();
                return trimmed.length > 0 && !/^[♪♫•\-–—\s]+$/.test(trimmed);
            }).length;

            const nonTargetDominates = classifiableLineCount > 0 &&
                nonTargetIndexes.length >= Math.max(2, Math.ceil(classifiableLineCount * 0.35));

            if (nonTargetDominates) {
                translations = await translateLyrics(
                    lineTexts,
                    state.targetLanguage,
                    currentTrackUri || undefined,
                    undefined
                );
            } else if (nonTargetIndexes.length === 0) {
                removeTranslations();
                state.isTranslating = false;
                rememberSkippedTranslation(
                    currentTrackUri,
                    state.targetLanguage,
                    romanizationOn,
                    sourceLyricsKey,
                    domLyricsKey,
                    skipCheck.detectedLanguage
                );
                restoreButtonState();
                if (state.showNotifications && Spicetify.showNotification && shouldNotifySkip(currentTrackUri, state.targetLanguage, romanizationOn)) {
                    Spicetify.showNotification(skipCheck.reason || 'Lyrics already in target language');
                }
                return;
            } else {
                const partialLines = nonTargetIndexes.map(index => lineTexts[index]);
                const partialTranslations = await translateLyrics(
                    partialLines,
                    state.targetLanguage,
                    undefined,
                    undefined
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
            }
        } else {
            translations = await translateLyrics(lineTexts, state.targetLanguage, currentTrackUri || undefined, state.detectedLanguage || undefined);
        }

        if (currentTrackUri && getCurrentTrackUri() !== currentTrackUri) {
            return;
        }

        debug(`translate: provider done at ${sincePhaseStart()}`);

        const hasMeaningfulTranslation = translations.some(result =>
            result.wasTranslated &&
            normalizeForComparison(result.originalText) !== normalizeForComparison(result.translatedText)
        );
        const sameLanguagePassthrough = !hasMeaningfulTranslation && translations.some(result =>
            result.detectedLanguage && isSameLanguage(result.detectedLanguage, state.targetLanguage)
        );

        if (sameLanguagePassthrough) {
            removeTranslations();
            rememberSkippedTranslation(
                currentTrackUri,
                state.targetLanguage,
                romanizationOn,
                sourceLyricsKey,
                domLyricsKey,
                translations.find(result => result.detectedLanguage)?.detectedLanguage
            );
            return;
        }

        lastSkippedTranslation = null;
        lastSkipNotifyKey = null;

        state.translatedLyrics.clear();

        const translationByContent = new Map<string, string>();
        const qualityByContent = new Map<string, TranslationQualityMeta>();
        const romanizationByContent = new Map<string, string>();
        const originalByContent = new Map<string, string>();

        translations.forEach((result, index) => {
            const source = lineTexts[index];
            const lineData = useApiLines && apiVocalLineData ? apiVocalLineData[index] : undefined;
            const translated = result.translatedText;

            const sourceNorm = normalizeMatchKey(source);
            const romNorm = normalizeMatchKey(lineData?.romanizedText);

            if (source && source.trim()) {
                state.translatedLyrics.set(source, translated);
                if (sourceNorm) translationByContent.set(sourceNorm, translated);
            }

            if (lineData?.romanizedText && lineData.romanizedText.trim()) {
                state.translatedLyrics.set(lineData.romanizedText, translated);
                if (romNorm) translationByContent.set(romNorm, translated);
            }

            if (result.wasTranslated) {
                const meta: TranslationQualityMeta = {
                    source: result.source || 'api',
                    api: result.apiProvider || state.preferredApi,
                    detectedLanguage: state.detectedLanguage || result.detectedLanguage || undefined
                };
                for (const norm of [sourceNorm, romNorm]) {
                    if (norm) qualityByContent.set(norm, meta);
                }
            }

            if (lineData) {
                const romanized = lineData.romanizedText || '';
                const original = lineData.text || '';
                for (const norm of [sourceNorm, romNorm, normalizeMatchKey(lineData.text)]) {
                    if (!norm) continue;
                    if (romanized.trim()) romanizationByContent.set(norm, romanized);
                    if (original.trim()) originalByContent.set(norm, original);
                }
            }
        });

        state.lastTranslatedSongUri = currentTrackUri;
        lastTranslatedRomanizationState = romanizationOn;

        let timingDataForOverlay: LyricLineData[] | null = null;
        if (useApiLines && apiVocalLineData) {
            timingDataForOverlay = apiVocalLineData;
        } else if (apiLineData) {
            timingDataForOverlay = apiLineData;
        }
        if (timingDataForOverlay) {
            setLineTimingData(timingDataForOverlay);
        }

        if (apiVocalLineData) {
            for (const lineData of apiVocalLineData) {
                if (!lineData) continue;
                const romanized = lineData.romanizedText || '';
                const original = lineData.text || '';
                for (const key of [lineData.text, lineData.romanizedText]) {
                    const norm = normalizeMatchKey(key);
                    if (!norm) continue;
                    if (romanized.trim()) romanizationByContent.set(norm, romanized);
                    if (original.trim()) originalByContent.set(norm, original);
                }
            }
        }
        if (apiLineData) {
            for (const lineData of apiLineData) {
                if (!lineData) continue;
                const romanized = lineData.romanizedText || '';
                const original = lineData.text || '';
                for (const key of [lineData.text, lineData.romanizedText]) {
                    const norm = normalizeMatchKey(key);
                    if (!norm) continue;
                    if (romanized.trim() && !romanizationByContent.has(norm)) romanizationByContent.set(norm, romanized);
                    if (original.trim() && !originalByContent.has(norm)) originalByContent.set(norm, original);
                }
            }
        }

        const timingByContent = new Map<string, LyricLineData>();
        const addTimingByContent = (data: LyricLineData[] | null): void => {
            if (!data) return;
            for (const ld of data) {
                if (!ld) continue;
                for (const key of [ld.text, ld.romanizedText]) {
                    const norm = normalizeMatchKey(key);
                    if (norm && !timingByContent.has(norm)) timingByContent.set(norm, ld);
                }
            }
        };
        addTimingByContent(apiVocalLineData);
        addTimingByContent(apiLineData);

        setTranslationContentData(translationByContent);
        setRomanizationContentData(romanizationByContent);
        setOriginalContentData(originalByContent);
        setQualityContentData(qualityByContent);
        setTimingContentData(timingByContent);

        contentTranslation = translationByContent;
        contentQuality = qualityByContent;
        coveredKeys = new Set(translationByContent.keys());

        const buildIndexMapsForLines = (targetLines: NodeListOf<Element> | Element[]): void => {
            const translationsByIdx = new Map<number, string>();
            const qualityByIdx = new Map<number, TranslationQualityMeta>();
            const romanizationByIdx = new Map<number, string>();
            const originalByIdx = new Map<number, string>();

            const targetArr = Array.from(targetLines);
            const allowIndexFallback = targetArr.length === translations.length;

            targetArr.forEach((line, domIdx) => {
                const domText = extractLineText(line);
                if (!domText) return;

                const matchKeys = buildMatchKeys(domText);

                let translation = lookupWithKeys(translationByContent, matchKeys);
                if (!translation && allowIndexFallback && translations[domIdx]) {
                    translation = translations[domIdx].translatedText;
                }
                if (translation) translationsByIdx.set(domIdx, translation);

                let meta = lookupWithKeys(qualityByContent, matchKeys);
                if (!meta && allowIndexFallback) {
                    const result = translations[domIdx];
                    if (result?.wasTranslated) {
                        meta = {
                            source: result.source || 'api',
                            api: result.apiProvider || state.preferredApi,
                            detectedLanguage: state.detectedLanguage || result.detectedLanguage || undefined
                        };
                    }
                }
                if (meta) qualityByIdx.set(domIdx, meta);

                let rom = lookupWithKeys(romanizationByContent, matchKeys);
                if (!rom && allowIndexFallback && apiVocalLineData && apiVocalLineData[domIdx]?.romanizedText) {
                    rom = apiVocalLineData[domIdx].romanizedText;
                }
                if (rom) romanizationByIdx.set(domIdx, rom);

                let orig = lookupWithKeys(originalByContent, matchKeys);
                if (!orig && allowIndexFallback && apiVocalLineData && apiVocalLineData[domIdx]?.text) {
                    orig = apiVocalLineData[domIdx].text;
                }
                if (orig) originalByIdx.set(domIdx, orig);
            });

            state._translationsByIndex = translationsByIdx;
            state._qualityByIndex = qualityByIdx;
            setRomanizationData(romanizationByIdx);
            setOriginalTextData(originalByIdx);
        };

        buildIndexMapsForLines(lines);

        const freshLines = getLyricsLines();
        if (currentTrackUri && getCurrentTrackUri() !== currentTrackUri) {
            return;
        }
        const useFresh = freshLines.length > 0;
        if (useFresh && freshLines !== lines) {
            buildIndexMapsForLines(freshLines);
        }
        if (useFresh) {
            applyTranslations(freshLines);
        } else {
            applyTranslations(lines);
        }

        debug(`translate: first render at ${sincePhaseStart()}`);

        scheduleTranslationReapply(currentTrackUri);

        void fillVisibleGaps();

        if (state.showNotifications && Spicetify.showNotification) {
            const notif = buildTranslationNotification(translations, currentTrackUri, state.targetLanguage);
            if (notif) Spicetify.showNotification(notif);
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
        if (buttonsLoading) {
            restoreButtonState();
        }
    }
}

function normalizeForComparison(text: string): string {
    return (text || '').toLowerCase().replace(/[\s\p{P}]+/gu, '').trim();
}

function formatNotificationDuration(ms: number | undefined): string {
    if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return '';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    const s = ms / 1000;
    if (s < 60) return `${s.toFixed(s < 10 ? 2 : 1)}s`;
    const m = Math.floor(s / 60);
    return `${m}m ${Math.round(s - m * 60)}s`;
}

function formatNotificationTokens(n: number | undefined): string {
    if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return '';
    if (n < 1000) return `${n} tok`;
    if (n < 1000000) return `${(n / 1000).toFixed(n < 10000 ? 1 : 0)}k tok`;
    return `${(n / 1000000).toFixed(2)}M tok`;
}

function formatProviderName(api: string | undefined): string {
    if (!api) return '';
    switch (api) {
        case 'google': return 'Google';
        case 'libretranslate': return 'LibreTranslate';
        case 'deepl': return 'DeepL';
        case 'openai': return 'OpenAI';
        case 'gemini': return 'Gemini';
        case 'custom': return 'Custom';
        default: return api;
    }
}

function buildTranslationNotification(
    translations: Array<{ wasTranslated?: boolean; source?: 'cache' | 'api'; apiProvider?: string }>,
    trackUri: string | null,
    targetLang: string
): string | null {
    const someTranslated = translations.some(t => t.wasTranslated === true);
    if (!someTranslated) return null;

    const fromApi = translations.some(t => t.wasTranslated === true && t.source === 'api');
    const apiProvider = translations.find(t => t.apiProvider)?.apiProvider;
    const providerLabel = formatProviderName(apiProvider);

    if (!fromApi) {
        return providerLabel ? `Translated from cache · ${providerLabel}` : 'Translated from cache';
    }

    const metrics = trackUri ? getTrackCache(trackUri, targetLang)?.metrics : undefined;
    const parts: string[] = ['Translated'];
    if (providerLabel) {
        parts.push(metrics?.model ? `${providerLabel} · ${metrics.model}` : providerLabel);
    }
    const dur = formatNotificationDuration(metrics?.durationMs);
    if (dur) parts.push(dur);
    const tok = formatNotificationTokens(metrics?.totalTokens);
    if (tok) parts.push(tok);
    return parts.join(' · ');
}

function looseLatinSkeleton(text: string): string {
    return (text || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function applyTranslations(lines: NodeListOf<Element>): number {
    const translationMapByIndex = new Map<number, string>();
    lines.forEach((line, index) => {
        const originalText = extractLineText(line);
        let translatedText = state._translationsByIndex?.get(index);
        if (!translatedText) {
            translatedText = state.translatedLyrics.get(originalText);
        }
        if (!translatedText) return;
        if (translatedText === originalText) return;
        if (normalizeForComparison(translatedText) === normalizeForComparison(originalText)) return;
        const bothLatin = /^[\p{Script=Latin}\p{N}\s\p{P}]+$/u.test(originalText)
                       && /^[\p{Script=Latin}\p{N}\s\p{P}]+$/u.test(translatedText);
        if (bothLatin && looseLatinSkeleton(translatedText) === looseLatinSkeleton(originalText)) {
            return;
        }
        translationMapByIndex.set(index, translatedText);
    });

    const overlaySettings = {
        mode: state.overlayMode,
        syncWordHighlight: state.syncWordHighlight,
        showRomanization: state.showRomanization,
        learningMode: state.learningMode
    };

    if (!isOverlayActive()) {
        enableOverlay(overlaySettings);
    } else {
        updateOverlayConfig(overlaySettings);
    }
    if (state._qualityByIndex) {
        setQualityMetadata(state._qualityByIndex);
    }
    updateOverlayContent(translationMapByIndex);
    debug(`applyTranslations: matched ${translationMapByIndex.size}/${lines.length} DOM lines`);
    return translationMapByIndex.size;
}

function clearReapplyTimers(): void {
    for (const timer of reapplyTimers) {
        clearTimeout(timer);
    }
    reapplyTimers = [];
}

function reapplyTranslationsToCurrentLines(trackUri?: string | null): void {
    if (!state.isEnabled || state.isTranslating) return;
    if (trackUri && getCurrentTrackUri() !== trackUri) return;
    if (state.translatedLyrics.size === 0 && contentTranslation.size === 0) return;

    const lines = getLyricsLines();
    if (lines.length === 0) return;
    applyTranslations(lines);
}

const REAPPLY_DELAYS_MS = [60, 200, 500, 1000, 1800, 3000, 5000];

function scheduleTranslationReapply(trackUri: string | null): void {
    clearReapplyTimers();

    for (const delay of REAPPLY_DELAYS_MS) {
        reapplyTimers.push(setTimeout(() => reapplyTranslationsToCurrentLines(trackUri), delay));
    }
}

async function fillVisibleGaps(): Promise<void> {
    if (!state.isEnabled || state.isTranslating || fillGapsInFlight) return;
    if (isRomanizationActive()) return;
    if (coveredKeys.size === 0 && contentTranslation.size === 0) return;

    const lines = getLyricsLines();
    if (lines.length === 0) return;

    const missing: string[] = [];
    const missingKeys = new Set<string>();
    lines.forEach(line => {
        const text = extractLineText(line);
        if (!text || !text.trim()) return;
        if (/^[♪♫•\-–—\s]+$/.test(text.trim())) return;
        const key = normalizeMatchKey(text);
        if (!key || coveredKeys.has(key) || missingKeys.has(key)) return;
        missingKeys.add(key);
        missing.push(text);
    });

    if (missing.length === 0) return;

    debug(`fillVisibleGaps: ${missing.length} uncovered DOM lines, requesting translation`);
    const gapsStart = Date.now();

    fillGapsInFlight = true;
    try {
        const currentTrackUri = getCurrentTrackUri();
        const results = await translateLyrics(missing, state.targetLanguage, currentTrackUri || undefined, state.detectedLanguage || undefined, true);
        if (currentTrackUri && getCurrentTrackUri() !== currentTrackUri) return;

        let added = false;
        results.forEach((result, i) => {
            const source = missing[i];
            const key = normalizeMatchKey(source);
            if (!key) return;
            coveredKeys.add(key);
            const translated = result.translatedText;
            if (source.trim()) state.translatedLyrics.set(source, translated);
            contentTranslation.set(key, translated);
            if (result.wasTranslated) {
                contentQuality.set(key, {
                    source: result.source || 'api',
                    api: result.apiProvider || state.preferredApi,
                    detectedLanguage: state.detectedLanguage || result.detectedLanguage || undefined
                });
            }
            added = true;
        });

        if (added) {
            setTranslationContentData(contentTranslation);
            setQualityContentData(contentQuality);
            const fresh = getLyricsLines();
            if (fresh.length > 0) applyTranslations(fresh);
        }
        debug(`fillVisibleGaps: completed in ${Date.now() - gapsStart}ms`);
    } catch (err) {
        warn('Failed to fill visible translation gaps:', err);
    } finally {
        fillGapsInFlight = false;
    }
}

export function forceRetranslate(): void {
    lastSkippedTranslation = null;
    lastSkipNotifyKey = null;
    lastTranslatedRomanizationState = null;
    state.lastTranslatedSongUri = null;
    state.translatedLyrics.clear();
    state._translationsByIndex = undefined;
    state._qualityByIndex = undefined;

    removeTranslations();

    if (state.isEnabled) {
        translateCurrentLyrics();
    }
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
    clearReapplyTimers();
    if (isOverlayActive()) disableOverlay();

    contentTranslation = new Map();
    contentQuality = new Map();
    coveredKeys = new Set();

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

    observedLyricsContent = lyricsContent;

    try {
        const hasLyricLineNode = (node: Node): boolean => {
            if (node.nodeType !== Node.ELEMENT_NODE) return false;
            const el = node as Element;
            return el.classList?.contains('line') || Boolean(el.querySelector?.('.line'));
        };

        lyricsObserver = new MutationObserver((mutations) => {
            if (!state.isEnabled || state.isTranslating) return;

            const hasNewContent = mutations.some(m =>
                m.type === 'childList' &&
                m.addedNodes.length > 0 &&
                Array.from(m.addedNodes).some(hasLyricLineNode)
            );

            if (!hasNewContent || state.isTranslating) return;

            const alreadyTranslated = state.translatedLyrics.size > 0 && state.lastTranslatedSongUri === getCurrentTrackUri();

            if (alreadyTranslated) {
                if (rerenderDebounceTimer) clearTimeout(rerenderDebounceTimer);
                rerenderDebounceTimer = setTimeout(() => {
                    rerenderDebounceTimer = null;
                    if (state.isTranslating) return;
                    const lines = getLyricsLines();
                    if (lines.length > 0) applyTranslations(lines);
                    void fillVisibleGaps();
                }, 200);
            } else if (state.autoTranslate) {
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
    let viewControls = await waitForElement('#SpicyLyricsPage .ViewControls', 3000);
    if (!viewControls && isSidebarLyricsActive()) {
        viewControls = await waitForElement('#SpicyLyricsNPVCard #SpicyLyricsPage .ViewControls, .Root__right-sidebar #SpicyLyricsPage .ViewControls', 2000);
    }
    if (!viewControls) viewControls = await waitForElement('.ViewControls', 2000);

    if (viewControls) insertTranslateButton();
    resumeActiveSync();
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
        waitForLyricsAndTranslate(50, 250);
    } else if (state.autoTranslate) {
        state.isEnabled = true;
        storage.set('translation-enabled', 'true');
        updateButtonState();
        waitForLyricsAndTranslate(50, 250);
    }
}

export function onSpicyLyricsClose(): void {
    if (translateDebounceTimer) {
        clearTimeout(translateDebounceTimer);
        translateDebounceTimer = null;
    }
    if (rerenderDebounceTimer) {
        clearTimeout(rerenderDebounceTimer);
        rerenderDebounceTimer = null;
    }
    clearReapplyTimers();
    pauseActiveSync();
    state.isTranslating = false;
    if (lyricsObserver) {
        lyricsObserver.disconnect();
        lyricsObserver = null;
    }
    observedLyricsContent = null;
    lastKnownRomanizationState = null;
    lastTranslatedRomanizationState = null;
    cleanupRomanizationWatcher();
}

function setupRomanizationWatcher(): void {
    cleanupRomanizationWatcher();

    const handler = () => {
        setTimeout(async () => {
            if (state.isEnabled) {
                for (let i = 0; i < 20 && state.isTranslating; i++) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                }

                removeTranslations();
                setupLyricsObserver();
                state.lastTranslatedSongUri = null;
                await waitForLyricsAndTranslate(40, 250);
            }
        }, 1200);
    };

    const btn = document.querySelector('#RomanizationToggle');
    if (btn) {
        btn.addEventListener('click', handler);
        romanizationToggleListener = handler;
        romanizationToggleButton = btn;
    }
}

function cleanupRomanizationWatcher(): void {
    if (romanizationToggleListener) {
        if (romanizationToggleButton) {
            romanizationToggleButton.removeEventListener('click', romanizationToggleListener);
        }
        romanizationToggleListener = null;
        romanizationToggleButton = null;
    }
}

const requestedBreakdowns = new Set<string>();

function registerBreakdownLookup(): void {
    setBreakdownLookup((sourceText: string) => {
        if (!state.learningMode) return null;
        setLearningTargetLanguage(state.targetLanguage);

        const cached = getCachedWordBreakdown(sourceText, state.targetLanguage);
        if (cached) return cached;

        if (!providerSupportsWordBreakdown()) return null;

        const key = `${state.targetLanguage}:${sourceText}`;
        if (requestedBreakdowns.has(key)) return null;
        requestedBreakdowns.add(key);

        void fetchWordBreakdown(sourceText, state.detectedLanguage || undefined, state.targetLanguage)
            .then(tokens => {
                if (tokens) invalidateLearningRow();
            })
            .catch(() => {})
            .finally(() => {
                requestedBreakdowns.delete(key);
            });

        return null;
    });
}

export function setupViewModeObserver(): void {
    registerBreakdownLookup();
    if (viewModeIntervalId) clearInterval(viewModeIntervalId);

    viewModeIntervalId = setInterval(() => {
        const isOpen = isSpicyLyricsOpen();
        if (isOpen) {
            if (!document.querySelector('#TranslateToggle')) {
                insertTranslateButton();
            }

            if (romanizationToggleButton && !romanizationToggleButton.isConnected) {
                romanizationToggleListener = null;
                romanizationToggleButton = null;
            }

            if (!romanizationToggleListener && document.querySelector('#RomanizationToggle')) {
                setupRomanizationWatcher();
            }

            const observedContentReplaced = Boolean(observedLyricsContent && !observedLyricsContent.isConnected);
            if (observedContentReplaced) {
                if (lyricsObserver) {
                    lyricsObserver.disconnect();
                    lyricsObserver = null;
                }
                observedLyricsContent = null;
            }
            if (!lyricsObserver && state.isEnabled) {
                setupLyricsObserver();
                if (observedContentReplaced) reapplyTranslationsToCurrentLines();
            }

            const currentRomanization = isRomanizationActive();
            if (lastKnownRomanizationState !== null && currentRomanization !== lastKnownRomanizationState) {
                if (state.isEnabled) {
                    if (!state.isTranslating) {
                        removeTranslations();
                        setupLyricsObserver();
                        state.lastTranslatedSongUri = null;
                        waitForLyricsAndTranslate(40, 250);
                    }
                }
            }
            lastKnownRomanizationState = currentRomanization;

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
