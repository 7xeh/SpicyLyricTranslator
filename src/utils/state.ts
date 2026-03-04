import { storage } from './storage';
import { OverlayMode } from './translationOverlay';

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
    deeplApiKey: string;
    openaiApiKey: string;
    openaiModel: string;
    geminiApiKey: string;
    lastTranslatedSongUri: string | null;
    translatedLyrics: Map<string, string>;
    lastViewMode: string | null;
    translationAbortController: AbortController | null;
    overlayMode: OverlayMode;
    detectedLanguage: string | null;
    syncWordHighlight: boolean;
    showQualityIndicator: boolean;
    vocabularyMode: boolean;
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
    customApiKey: storage.get('custom-api-key') || '',
    deeplApiKey: storage.get('deepl-api-key') || '',
    openaiApiKey: storage.get('openai-api-key') || '',
    openaiModel: storage.get('openai-model') || 'gpt-4o-mini',
    geminiApiKey: storage.get('gemini-api-key') || '',
    lastTranslatedSongUri: null,
    translatedLyrics: new Map(),
    lastViewMode: null,
    translationAbortController: null,
    overlayMode: (storage.get('overlay-mode') as OverlayMode) || 'interleaved',
    detectedLanguage: null,
    syncWordHighlight: storage.get('sync-word-highlight') !== 'false',
    showQualityIndicator: storage.get('show-quality-indicator') !== 'false',
    vocabularyMode: storage.get('vocabulary-mode') === 'true',
    _qualityByIndex: undefined
};