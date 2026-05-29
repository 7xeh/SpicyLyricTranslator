import { storage } from './storage';
import { OverlayMode } from './translationOverlay';
import type { CustomApiFormat } from './translator';

const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite';
const DEFAULT_LIBRETRANSLATE_URL = 'https://libretranslate.com/translate';

function normalizeStoredOpenAIModel(model: string | null): string {
    const value = (model || '').trim();
    return value === 'gpt-5.5' || value === 'gpt-4o-mini' ? value : DEFAULT_OPENAI_MODEL;
}

function normalizeStoredGeminiModel(model: string | null): string {
    const value = (model || '').trim().replace(/^models\//, '');
    if (value === 'gemini-3.1-flash-lite' || value === 'gemini-3.5-flash' || value === 'gemini-3.1-pro-preview') return value;
    if (value.includes('flash-lite')) return 'gemini-3.1-flash-lite';
    if (value.includes('pro')) return 'gemini-3.1-pro-preview';
    if (value.includes('flash')) return 'gemini-3.5-flash';
    return DEFAULT_GEMINI_MODEL;
}

export interface TranslationQualityMeta {
    source: 'cache' | 'api';
    api?: string;
    detectedLanguage?: string;
    detectionMethod?: 'heuristic' | 'api';
    confidence?: number;
}

export interface ExtensionState {
    isEnabled: boolean;
    isTranslating: boolean;
    targetLanguage: string;
    autoTranslate: boolean;
    showNotifications: boolean;
    preferredApi: 'google' | 'libretranslate' | 'deepl' | 'openai' | 'gemini' | 'custom';
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
    maxParallelChunks: string;
    lastTranslatedSongUri: string | null;
    translatedLyrics: Map<string, string>;
    lastViewMode: string | null;
    translationAbortController: AbortController | null;
    overlayMode: OverlayMode;
    detectedLanguage: string | null;
    syncWordHighlight: boolean;
    showQualityIndicator: boolean;
    vocabularyMode: boolean;
    hideConnectionIndicator: boolean;
    _translationsByIndex?: Map<number, string>;
    _qualityByIndex?: Map<number, TranslationQualityMeta>;
}

export const state: ExtensionState = {
    isEnabled: storage.get('translation-enabled') === 'true',
    isTranslating: false,
    targetLanguage: storage.get('target-language') || 'en',
    autoTranslate: storage.get('auto-translate') === 'true',
    showNotifications: storage.get('show-notifications') !== 'false',
    preferredApi: (storage.get('preferred-api') as 'google' | 'libretranslate' | 'deepl' | 'openai' | 'gemini' | 'custom') || 'google',
    customApiUrl: storage.get('custom-api-url') || '',
    customApiKey: storage.getSecret('custom-api-key') || '',
    customApiFormat: (storage.get('custom-api-format') as CustomApiFormat) || 'generic',
    customApiModel: storage.get('custom-api-model') || '',
    libreTranslateApiUrl: storage.get('libretranslate-api-url') || DEFAULT_LIBRETRANSLATE_URL,
    libreTranslateApiKey: storage.getSecret('libretranslate-api-key') || '',
    deeplApiKey: storage.getSecret('deepl-api-key') || '',
    openaiApiKey: storage.getSecret('openai-api-key') || '',
    openaiModel: normalizeStoredOpenAIModel(storage.get('openai-model')),
    geminiApiKey: storage.getSecret('gemini-api-key') || '',
    geminiModel: normalizeStoredGeminiModel(storage.get('gemini-model')),
    geminiTemperature: storage.get('gemini-temperature') || '0.3',
    maxParallelChunks: storage.get('max-parallel-chunks') || '4',
    lastTranslatedSongUri: null,
    translatedLyrics: new Map(),
    lastViewMode: null,
    translationAbortController: null,
    overlayMode: (storage.get('overlay-mode') as OverlayMode) || 'interleaved',
    detectedLanguage: null,
    syncWordHighlight: storage.get('sync-word-highlight') !== 'false',
    showQualityIndicator: storage.get('show-quality-indicator') !== 'false',
    vocabularyMode: storage.get('vocabulary-mode') === 'true',
    hideConnectionIndicator: storage.get('hide-connection-indicator') === 'true',
    _qualityByIndex: undefined
};
