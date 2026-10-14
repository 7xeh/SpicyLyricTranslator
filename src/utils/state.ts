import { storage } from './storage';
import { OverlayMode } from './translationOverlay';
import { resolveTargetLanguage } from './translator';
import type { ApiPreference, CustomApiFormat } from './translator';
import { resolveModelId } from './modelCatalog';
import { parseLanguageRules, findLanguageRule, isNoTranslationRule } from './languageRules';
import { isExcludedSourceLanguage } from './languageDetection';
import type { LanguageRule } from './languageRules';
import { parseFileTranslationMode } from './fileTranslations';
import type { FileTranslationMode } from './fileTranslations';

const DEFAULT_LIBRETRANSLATE_URL = 'https://libretranslate.com/translate';

function resolveStoredTarget(code: string): string {
    return resolveTargetLanguage(
        code,
        storage.get('language-variant') === 'true',
        (storage.get('preferred-api') as ApiPreference) || 'google'
    );
}

function resolveStoredTargetLanguage(): string {
    return resolveStoredTarget(storage.get('target-language') || 'en');
}

export function parseLanguageList(value: string | null | undefined): string[] {
    return Array.from(new Set((value || '').split(',').map(code => code.trim()).filter(Boolean)));
}

export type NotificationLevel = 'all' | 'errors' | 'off';
export type LearningBreakdownMode = 'auto' | 'on-demand';

function resolveStoredNotificationLevel(): NotificationLevel {
    const stored = storage.get('notification-level');
    if (stored === 'all' || stored === 'errors' || stored === 'off') return stored;
    return storage.get('show-notifications') === 'false' ? 'off' : 'all';
}

export interface TranslationQualityMeta {
    source: 'cache' | 'api' | 'user' | 'file';
    api?: string;
    detectedLanguage?: string;
    detectionMethod?: 'heuristic' | 'api';
    confidence?: number;
}

export interface ExtensionState {
    isEnabled: boolean;
    isTranslating: boolean;
    targetLanguage: string;
    defaultTargetLanguage: string;
    languageRules: LanguageRule[];
    autoTranslate: boolean;
    showNotifications: boolean;
    notificationLevel: NotificationLevel;
    showSkipNotice: boolean;
    showTranslatedNotice: boolean;
    preferredApi: 'google' | 'libretranslate' | 'deepl' | 'openai' | 'gemini' | 'grok' | 'anthropic' | 'custom';
    customApiUrl: string;
    customApiKey: string;
    customApiFormat: CustomApiFormat;
    customApiModel: string;
    libreTranslateApiUrl: string;
    libreTranslateApiKey: string;
    deeplApiKey: string;
    openaiApiKey: string;
    openaiModel: string;
    geminiApiKey: string;
    geminiModel: string;
    geminiTemperature: string;
    grokApiKey: string;
    grokModel: string;
    anthropicApiKey: string;
    anthropicModel: string;
    maxParallelChunks: string;
    lastTranslatedSongUri: string | null;
    translatedLyrics: Map<string, string>;
    lastViewMode: string | null;
    translationAbortController: AbortController | null;
    overlayMode: OverlayMode;
    skipLanguages: string[];
    sourceLanguage: string;
    replaceScriptConversions: boolean;
    lyricsFileTranslations: FileTranslationMode;
    detectedLanguage: string | null;
    syncWordHighlight: boolean;
    showQualityIndicator: boolean;
    hideConnectionIndicator: boolean;
    showRomanization: boolean;
    showFurigana: boolean;
    learningMode: boolean;
    learningVisible: boolean;
    learningBreakdownMode: LearningBreakdownMode;
    translateHotkey: string;
    learningHotkey: string;
    breakdownHotkey: string;
    _translationsByIndex?: Map<number, string>;
    _qualityByIndex?: Map<number, TranslationQualityMeta>;
}

export const state: ExtensionState = {
    isEnabled: storage.get('translation-enabled') === 'true',
    isTranslating: false,
    targetLanguage: resolveStoredTargetLanguage(),
    defaultTargetLanguage: resolveStoredTargetLanguage(),
    languageRules: parseLanguageRules(storage.get('language-rules')),
    autoTranslate: storage.get('auto-translate') === 'true',
    notificationLevel: resolveStoredNotificationLevel(),
    showSkipNotice: storage.get('show-skip-notice') !== 'false',
    showTranslatedNotice: storage.get('show-translated-notice') !== 'false',
    get showNotifications(): boolean {
        return this.notificationLevel !== 'off';
    },
    set showNotifications(value: boolean) {
        this.notificationLevel = value ? 'all' : 'off';
    },
    preferredApi: (storage.get('preferred-api') as 'google' | 'libretranslate' | 'deepl' | 'openai' | 'gemini' | 'grok' | 'anthropic' | 'custom') || 'google',
    customApiUrl: storage.get('custom-api-url') || '',
    customApiKey: storage.getSecret('custom-api-key') || '',
    customApiFormat: (storage.get('custom-api-format') as CustomApiFormat) || 'generic',
    customApiModel: storage.get('custom-api-model') || '',
    libreTranslateApiUrl: storage.get('libretranslate-api-url') || DEFAULT_LIBRETRANSLATE_URL,
    libreTranslateApiKey: storage.getSecret('libretranslate-api-key') || '',
    deeplApiKey: storage.getSecret('deepl-api-key') || '',
    openaiApiKey: storage.getSecret('openai-api-key') || '',
    openaiModel: resolveModelId('openai', storage.get('openai-model')),
    geminiApiKey: storage.getSecret('gemini-api-key') || '',
    geminiModel: resolveModelId('gemini', storage.get('gemini-model')),
    geminiTemperature: storage.get('gemini-temperature') || '0.3',
    grokApiKey: storage.getSecret('grok-api-key') || '',
    grokModel: resolveModelId('grok', storage.get('grok-model')),
    anthropicApiKey: storage.getSecret('anthropic-api-key') || '',
    anthropicModel: resolveModelId('anthropic', storage.get('anthropic-model')),
    maxParallelChunks: storage.get('max-parallel-chunks') || '4',
    lastTranslatedSongUri: null,
    translatedLyrics: new Map(),
    lastViewMode: null,
    translationAbortController: null,
    overlayMode: (storage.get('overlay-mode') as OverlayMode) || 'interleaved',
    skipLanguages: parseLanguageList(storage.get('skip-languages')),
    sourceLanguage: storage.get('source-language') || 'auto',
    replaceScriptConversions: storage.get('replace-script-conversions') === 'true',
    lyricsFileTranslations: parseFileTranslationMode(storage.get('lyrics-file-translations')),
    detectedLanguage: null,
    syncWordHighlight: storage.get('sync-word-highlight') !== 'false',
    showQualityIndicator: storage.get('show-quality-indicator') !== 'false',
    hideConnectionIndicator: storage.get('hide-connection-indicator') === 'true',
    showRomanization: storage.get('show-romanization') === 'true',
    showFurigana: storage.get('show-furigana') === 'true',
    learningMode: storage.get('learning-mode') === 'true',
    learningVisible: storage.get('learning-visible') !== 'false',
    learningBreakdownMode: storage.get('learning-breakdown-mode') === 'on-demand' ? 'on-demand' : 'auto',
    translateHotkey: storage.get('translate-hotkey') ?? 'Alt+T',
    learningHotkey: storage.get('learning-hotkey') ?? 'Alt+L',
    breakdownHotkey: storage.get('breakdown-hotkey') ?? 'Alt+B',
    _qualityByIndex: undefined
};

const TRACK_SOURCE_LANGUAGES_KEY = 'track-source-languages';
const MAX_TRACK_SOURCE_LANGUAGES = 500;

export function getTrackSourceLanguage(trackUri: string | null | undefined): string | null {
    if (!trackUri) return null;
    return storage.getJSON<Record<string, string>>(TRACK_SOURCE_LANGUAGES_KEY, {})[trackUri] || null;
}

export function setTrackSourceLanguage(trackUri: string, code: string | null): void {
    const overrides = storage.getJSON<Record<string, string>>(TRACK_SOURCE_LANGUAGES_KEY, {});
    delete overrides[trackUri];
    if (code && code !== 'auto') overrides[trackUri] = code;

    const uris = Object.keys(overrides);
    uris.slice(0, Math.max(0, uris.length - MAX_TRACK_SOURCE_LANGUAGES)).forEach(uri => delete overrides[uri]);
    storage.setJSON(TRACK_SOURCE_LANGUAGES_KEY, overrides);
}

export function getSourceLanguageOverride(trackUri: string | null | undefined): string | null {
    const perTrack = getTrackSourceLanguage(trackUri);
    if (perTrack) return perTrack;
    return state.sourceLanguage && state.sourceLanguage !== 'auto' ? state.sourceLanguage : null;
}

export function resolveTargetForSource(sourceLanguage: string | null | undefined): { target: string; rule: LanguageRule | null } {
    const rule = findLanguageRule(state.languageRules, sourceLanguage);
    if (!rule || isNoTranslationRule(rule)) return { target: state.defaultTargetLanguage, rule };
    return { target: resolveStoredTarget(rule.target), rule };
}

export function refreshTargetLanguage(sourceLanguage: string | null | undefined = state.detectedLanguage): LanguageRule | null {
    state.defaultTargetLanguage = resolveStoredTargetLanguage();
    const { target, rule } = resolveTargetForSource(sourceLanguage);
    state.targetLanguage = target;
    return rule;
}

export function isUntranslatedLanguage(code: string | null | undefined): boolean {
    if (!code) return false;
    return isExcludedSourceLanguage(code, state.skipLanguages) || isNoTranslationRule(findLanguageRule(state.languageRules, code));
}

export function isLearningActive(): boolean {
    return state.learningMode && state.learningVisible;
}
