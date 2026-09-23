import { storage } from './storage';
import { OverlayMode } from './translationOverlay';
import { resolveTargetLanguage } from './translator';
import type { ApiPreference, CustomApiFormat } from './translator';
import { resolveModelId } from './modelCatalog';

const DEFAULT_LIBRETRANSLATE_URL = 'https://libretranslate.com/translate';

function resolveStoredTargetLanguage(): string {
    return resolveTargetLanguage(
        storage.get('target-language') || 'en',
        storage.get('language-variant') === 'true',
        (storage.get('preferred-api') as ApiPreference) || 'google'
    );
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
    detectedLanguage: string | null;
    syncWordHighlight: boolean;
    showQualityIndicator: boolean;
    hideConnectionIndicator: boolean;
    showRomanization: boolean;
    learningMode: boolean;
    _translationsByIndex?: Map<number, string>;
    _qualityByIndex?: Map<number, TranslationQualityMeta>;
}

export const state: ExtensionState = {
    isEnabled: storage.get('translation-enabled') === 'true',
    isTranslating: false,
    targetLanguage: resolveStoredTargetLanguage(),
    autoTranslate: storage.get('auto-translate') === 'true',
    showNotifications: storage.get('show-notifications') !== 'false',
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
    detectedLanguage: null,
    syncWordHighlight: storage.get('sync-word-highlight') !== 'false',
    showQualityIndicator: storage.get('show-quality-indicator') !== 'false',
    hideConnectionIndicator: storage.get('hide-connection-indicator') === 'true',
    showRomanization: storage.get('show-romanization') === 'true',
    learningMode: storage.get('learning-mode') === 'true',
    _qualityByIndex: undefined
};
