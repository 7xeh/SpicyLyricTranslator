import { state } from './state';
import { storage } from './storage';
import { OverlayMode } from './translationOverlay';
import { SUPPORTED_LANGUAGES, setPreferredApi } from './translator';
import type { ApiPreference, CustomApiFormat } from './translator';

export type SettingsFieldType = 'select' | 'toggle' | 'text' | 'password';
export type SettingsEffect = 'reapplyTranslations' | 'retranslate' | 'providerVisibility' | 'qualityIndicatorClass' | 'vocabularyModeClass' | 'connectionIndicatorClass';

export interface SettingsOption {
    value: string;
    text: string;
}

export interface SettingsField {
    id: string;
    label: string;
    type: SettingsFieldType;
    storageKey: string;
    defaultValue: string | boolean;
    options?: SettingsOption[];
    placeholder?: string;
    description?: string;
    secret?: boolean;
    visibleForApis?: ApiPreference[];
    effects?: SettingsEffect[];
}

export const API_OPTIONS: SettingsOption[] = [
    { value: 'google', text: 'Google Translate' },
    { value: 'libretranslate', text: 'LibreTranslate' },
    { value: 'deepl', text: 'DeepL' },
    { value: 'openai', text: 'OpenAI' },
    { value: 'gemini', text: 'Gemini' },
    { value: 'grok', text: 'Grok (xAI)' },
    { value: 'anthropic', text: 'Claude (Anthropic)' },
    { value: 'custom', text: 'Custom API' }
];

export const CUSTOM_API_FORMAT_OPTIONS: SettingsOption[] = [
    { value: 'generic', text: 'Generic JSON' },
    { value: 'libretranslate', text: 'LibreTranslate Compatible' },
    { value: 'openai', text: 'OpenAI Compatible' },
    { value: 'gemini', text: 'Gemini Compatible' },
    { value: 'deepl', text: 'DeepL Compatible' }
];

export const OVERLAY_MODE_OPTIONS: SettingsOption[] = [
    { value: 'replace', text: 'Replace (default)' },
    { value: 'interleaved', text: 'Below each line' }
];

export const SETTINGS_SCHEMA: SettingsField[] = [
    {
        id: 'target-language',
        label: 'Target Language',
        type: 'select',
        storageKey: 'target-language',
        defaultValue: 'en',
        options: SUPPORTED_LANGUAGES.map(language => ({ value: language.code, text: language.name })),
        effects: ['retranslate']
    },
    {
        id: 'overlay-mode',
        label: 'Translation Display',
        type: 'select',
        storageKey: 'overlay-mode',
        defaultValue: 'replace',
        options: OVERLAY_MODE_OPTIONS,
        description: 'How translated lyrics are displayed',
        effects: ['reapplyTranslations']
    },
    {
        id: 'preferred-api',
        label: 'Translation API',
        type: 'select',
        storageKey: 'preferred-api',
        defaultValue: 'google',
        options: API_OPTIONS,
        effects: ['providerVisibility']
    },
    {
        id: 'custom-api-url',
        label: 'Custom API URL',
        type: 'text',
        storageKey: 'custom-api-url',
        defaultValue: '',
        placeholder: 'https://your-api.com/translate',
        description: 'Translation endpoint or compatible API base URL',
        visibleForApis: ['custom']
    },
    {
        id: 'custom-api-format',
        label: 'Custom API Format',
        type: 'select',
        storageKey: 'custom-api-format',
        defaultValue: 'generic',
        options: CUSTOM_API_FORMAT_OPTIONS,
        visibleForApis: ['custom']
    },
    {
        id: 'custom-api-key',
        label: 'Custom API Key (optional)',
        type: 'password',
        storageKey: 'custom-api-key',
        defaultValue: '',
        placeholder: 'API key',
        secret: true,
        visibleForApis: ['custom']
    },
    {
        id: 'custom-api-model',
        label: 'Custom API Model (optional)',
        type: 'text',
        storageKey: 'custom-api-model',
        defaultValue: '',
        placeholder: 'gpt-4o-mini, llama3.1, gemini-3.1-flash-lite',
        visibleForApis: ['custom']
    },
    {
        id: 'libretranslate-api-url',
        label: 'LibreTranslate URL',
        type: 'text',
        storageKey: 'libretranslate-api-url',
        defaultValue: 'https://libretranslate.com/translate',
        placeholder: 'https://libretranslate.com/translate',
        description: 'Use the hosted endpoint with a key, or a self-hosted URL without one',
        visibleForApis: ['libretranslate']
    },
    {
        id: 'libretranslate-api-key',
        label: 'LibreTranslate API Key',
        type: 'password',
        storageKey: 'libretranslate-api-key',
        defaultValue: '',
        placeholder: 'API key',
        description: 'Required for hosted libretranslate.com',
        secret: true,
        visibleForApis: ['libretranslate']
    },
    {
        id: 'deepl-api-key',
        label: 'DeepL API Key',
        type: 'password',
        storageKey: 'deepl-api-key',
        defaultValue: '',
        placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx:fx',
        description: 'Get a free key at deepl.com/pro-api',
        secret: true,
        visibleForApis: ['deepl']
    },
    {
        id: 'openai-api-key',
        label: 'OpenAI API Key',
        type: 'password',
        storageKey: 'openai-api-key',
        defaultValue: '',
        placeholder: 'sk-...',
        secret: true,
        visibleForApis: ['openai']
    },
    {
        id: 'openai-model',
        label: 'OpenAI Model',
        type: 'select',
        storageKey: 'openai-model',
        defaultValue: 'gpt-4o-mini',
        options: [
            { value: 'gpt-5.5', text: 'GPT-5.5 Speed' },
            { value: 'gpt-4o-mini', text: 'GPT-4o mini' }
        ],
        description: 'GPT-5.5 uses speed mode; GPT-4o mini is the low-cost option',
        visibleForApis: ['openai']
    },
    {
        id: 'gemini-api-key',
        label: 'Gemini API Key',
        type: 'password',
        storageKey: 'gemini-api-key',
        defaultValue: '',
        placeholder: 'AIza...',
        description: 'Get a key at aistudio.google.com/apikey',
        secret: true,
        visibleForApis: ['gemini']
    },
    {
        id: 'gemini-model',
        label: 'Gemini Model',
        type: 'select',
        storageKey: 'gemini-model',
        defaultValue: 'gemini-3.1-flash-lite',
        options: [
            { value: 'gemini-3.1-flash-lite', text: '3.1 Flash-Lite' },
            { value: 'gemini-3.5-flash', text: '3.5 Flash' },
            { value: 'gemini-3.1-pro-preview', text: '3.1 Pro' }
        ],
        description: 'Flash-Lite is fastest; Flash is balanced; Pro is best for harder lyrics',
        visibleForApis: ['gemini']
    },
    {
        id: 'gemini-temperature',
        label: 'Gemini Temperature',
        type: 'text',
        storageKey: 'gemini-temperature',
        defaultValue: '0.3',
        placeholder: '0.0 - 2.0',
        description: 'Controls output randomness (0.0 = deterministic, 2.0 = highly creative)',
        visibleForApis: ['gemini']
    },
    {
        id: 'grok-api-key',
        label: 'Grok (xAI) API Key',
        type: 'password',
        storageKey: 'grok-api-key',
        defaultValue: '',
        placeholder: 'xai-...',
        description: 'Get a key at console.x.ai',
        secret: true,
        visibleForApis: ['grok']
    },
    {
        id: 'grok-model',
        label: 'Grok Model',
        type: 'select',
        storageKey: 'grok-model',
        defaultValue: 'grok-4.5',
        options: [
            { value: 'grok-4.5', text: 'Grok 4.5 (recommended)' },
            { value: 'grok-4.3', text: 'Grok 4.3' }
        ],
        description: 'Grok 4.5 is the fastest and most capable; 4.3 is the previous flagship',
        visibleForApis: ['grok']
    },
    {
        id: 'anthropic-api-key',
        label: 'Claude (Anthropic) API Key',
        type: 'password',
        storageKey: 'anthropic-api-key',
        defaultValue: '',
        placeholder: 'sk-ant-...',
        description: 'Get a key at console.anthropic.com',
        secret: true,
        visibleForApis: ['anthropic']
    },
    {
        id: 'anthropic-model',
        label: 'Claude Model',
        type: 'select',
        storageKey: 'anthropic-model',
        defaultValue: 'claude-haiku-4-5',
        options: [
            { value: 'claude-haiku-4-5', text: 'Haiku 4.5 (fast & cheap)' },
            { value: 'claude-sonnet-5', text: 'Sonnet 5 (balanced)' },
            { value: 'claude-opus-4-8', text: 'Opus 4.8 (best quality)' }
        ],
        description: 'Haiku is fastest and cheapest; Sonnet balances cost and quality; Opus is best for nuanced lyrics',
        visibleForApis: ['anthropic']
    },
    {
        id: 'max-parallel-chunks',
        label: 'Parallel Translation Requests',
        type: 'select',
        storageKey: 'max-parallel-chunks',
        defaultValue: '4',
        options: [
            { value: '1', text: 'Off (one request)' },
            { value: '2', text: '2 requests' },
            { value: '3', text: '3 requests' },
            { value: '4', text: '4 requests' },
            { value: '5', text: '5 requests' },
            { value: '6', text: '6 requests' }
        ],
        description: '⚠ Splits long songs across concurrent requests for faster translation. Higher values send more requests per song, which can increase API usage/cost and may hit rate limits on free tiers. Lower it (or set Off) if you see errors.',
        visibleForApis: ['openai', 'gemini', 'grok', 'anthropic', 'custom']
    },
    {
        id: 'auto-translate',
        label: 'Auto-Translate on Song Change',
        type: 'toggle',
        storageKey: 'auto-translate',
        defaultValue: false
    },
    {
        id: 'show-notifications',
        label: 'Show Notifications',
        type: 'toggle',
        storageKey: 'show-notifications',
        defaultValue: true
    },
    {
        id: 'show-quality-indicator',
        label: 'Show Translation Quality Indicator',
        type: 'toggle',
        storageKey: 'show-quality-indicator',
        defaultValue: true,
        effects: ['qualityIndicatorClass']
    },
    {
        id: 'vocabulary-mode',
        label: 'Vocabulary / Learning Mode',
        type: 'toggle',
        storageKey: 'vocabulary-mode',
        defaultValue: false,
        effects: ['vocabularyModeClass', 'reapplyTranslations']
    },
    {
        id: 'hide-connection-indicator',
        label: 'Hide Connection Status',
        type: 'toggle',
        storageKey: 'hide-connection-indicator',
        defaultValue: false,
        effects: ['connectionIndicatorClass']
    }
];

export function getSettingField(id: string): SettingsField | undefined {
    return SETTINGS_SCHEMA.find(field => field.id === id);
}

export function getCurrentApiPreference(): ApiPreference {
    return (storage.get('preferred-api') as ApiPreference) || state.preferredApi || 'google';
}

export function isSettingFieldVisible(field: SettingsField, api: ApiPreference = getCurrentApiPreference()): boolean {
    return !field.visibleForApis || field.visibleForApis.includes(api);
}

function normalizeLegacySelectValue(fieldId: string, value: string | null): string | null {
    const stored = (value || '').trim().replace(/^models\//, '');
    if (!stored) return value;
    if (fieldId === 'openai-model') {
        return stored === 'gpt-5.5' || stored === 'gpt-4o-mini' ? stored : 'gpt-4o-mini';
    }
    if (fieldId === 'gemini-model') {
        if (stored === 'gemini-3.1-flash-lite' || stored === 'gemini-3.5-flash' || stored === 'gemini-3.1-pro-preview') return stored;
        if (stored.includes('flash-lite')) return 'gemini-3.1-flash-lite';
        if (stored.includes('pro')) return 'gemini-3.1-pro-preview';
        if (stored.includes('flash')) return 'gemini-3.5-flash';
        return 'gemini-3.1-flash-lite';
    }
    return value;
}

export function readSettingValue(field: SettingsField): string | boolean {
    if (field.type === 'toggle') {
        const stored = storage.get(field.storageKey);
        if (typeof field.defaultValue === 'boolean' && field.defaultValue) {
            return stored !== 'false';
        }
        return stored === 'true';
    }

    const stored = field.secret ? storage.getSecret(field.storageKey) : storage.get(field.storageKey);
    const normalizedStored = field.type === 'select' ? normalizeLegacySelectValue(field.id, stored) : stored;
    if (field.type === 'select' && field.options && normalizedStored && field.options.every(option => option.value !== normalizedStored)) {
        return String(field.defaultValue);
    }
    return normalizedStored ?? String(field.defaultValue);
}

function configureTranslationApi(): void {
    setPreferredApi(state.preferredApi, state.customApiUrl, {
        customApiKey: state.customApiKey,
        customApiFormat: state.customApiFormat,
        customApiModel: state.customApiModel,
        libreTranslateApiUrl: state.libreTranslateApiUrl,
        libreTranslateApiKey: state.libreTranslateApiKey,
        deeplApiKey: state.deeplApiKey,
        openaiApiKey: state.openaiApiKey,
        openaiModel: state.openaiModel,
        geminiApiKey: state.geminiApiKey,
        geminiModel: state.geminiModel,
        geminiTemperature: state.geminiTemperature,
        grokApiKey: state.grokApiKey,
        grokModel: state.grokModel,
        anthropicApiKey: state.anthropicApiKey,
        anthropicModel: state.anthropicModel,
        maxParallelChunks: state.maxParallelChunks
    });
}

export function writeSettingValue(field: SettingsField, value: string | boolean): SettingsEffect[] {
    if (field.type === 'toggle') {
        storage.set(field.storageKey, String(Boolean(value)));
    } else if (field.secret) {
        storage.setSecret(field.storageKey, String(value));
    } else {
        storage.set(field.storageKey, String(value));
    }

    switch (field.id) {
        case 'target-language':
            state.targetLanguage = String(value);
            break;
        case 'overlay-mode':
            state.overlayMode = String(value) as OverlayMode;
            break;
        case 'preferred-api':
            state.preferredApi = String(value) as ApiPreference;
            configureTranslationApi();
            break;
        case 'custom-api-url':
            state.customApiUrl = String(value);
            configureTranslationApi();
            break;
        case 'custom-api-format':
            state.customApiFormat = String(value) as CustomApiFormat;
            configureTranslationApi();
            break;
        case 'custom-api-key':
            state.customApiKey = String(value);
            configureTranslationApi();
            break;
        case 'custom-api-model':
            state.customApiModel = String(value);
            configureTranslationApi();
            break;
        case 'libretranslate-api-url':
            state.libreTranslateApiUrl = String(value);
            configureTranslationApi();
            break;
        case 'libretranslate-api-key':
            state.libreTranslateApiKey = String(value);
            configureTranslationApi();
            break;
        case 'deepl-api-key':
            state.deeplApiKey = String(value);
            configureTranslationApi();
            break;
        case 'openai-api-key':
            state.openaiApiKey = String(value);
            configureTranslationApi();
            break;
        case 'openai-model':
            state.openaiModel = String(value);
            configureTranslationApi();
            break;
        case 'gemini-api-key':
            state.geminiApiKey = String(value);
            configureTranslationApi();
            break;
        case 'gemini-model':
            state.geminiModel = String(value);
            configureTranslationApi();
            break;
        case 'gemini-temperature':
            state.geminiTemperature = String(value);
            configureTranslationApi();
            break;
        case 'grok-api-key':
            state.grokApiKey = String(value);
            configureTranslationApi();
            break;
        case 'grok-model':
            state.grokModel = String(value);
            configureTranslationApi();
            break;
        case 'anthropic-api-key':
            state.anthropicApiKey = String(value);
            configureTranslationApi();
            break;
        case 'anthropic-model':
            state.anthropicModel = String(value);
            configureTranslationApi();
            break;
        case 'max-parallel-chunks':
            state.maxParallelChunks = String(value);
            configureTranslationApi();
            break;
        case 'auto-translate':
            state.autoTranslate = Boolean(value);
            break;
        case 'show-notifications':
            state.showNotifications = Boolean(value);
            break;
        case 'show-quality-indicator':
            state.showQualityIndicator = Boolean(value);
            break;
        case 'vocabulary-mode':
            state.vocabularyMode = Boolean(value);
            break;
        case 'hide-connection-indicator':
            state.hideConnectionIndicator = Boolean(value);
            break;
    }

    return field.effects || [];
}
