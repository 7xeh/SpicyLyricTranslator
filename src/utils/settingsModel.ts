import { state } from './state';
import { storage } from './storage';
import { OverlayMode } from './translationOverlay';
import { SUPPORTED_LANGUAGES, setPreferredApi } from './translator';
import type { ApiPreference, CustomApiFormat } from './translator';

export type SettingsFieldType = 'select' | 'toggle' | 'text' | 'password';
export type SettingsEffect = 'reapplyTranslations' | 'providerVisibility' | 'qualityIndicatorClass' | 'vocabularyModeClass' | 'connectionIndicatorClass';

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
        options: SUPPORTED_LANGUAGES.map(language => ({ value: language.code, text: language.name }))
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
        placeholder: 'gpt-4o-mini, llama3.1, gemini-2.0-flash',
        visibleForApis: ['custom']
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
        type: 'text',
        storageKey: 'openai-model',
        defaultValue: 'gpt-4o-mini',
        placeholder: 'gpt-4o-mini',
        description: 'e.g. gpt-4o-mini, gpt-4o, gpt-4-turbo',
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

export function readSettingValue(field: SettingsField): string | boolean {
    if (field.type === 'toggle') {
        const stored = storage.get(field.storageKey);
        if (typeof field.defaultValue === 'boolean' && field.defaultValue) {
            return stored !== 'false';
        }
        return stored === 'true';
    }

    const stored = field.secret ? storage.getSecret(field.storageKey) : storage.get(field.storageKey);
    return stored ?? String(field.defaultValue);
}

function configureTranslationApi(): void {
    setPreferredApi(state.preferredApi, state.customApiUrl, {
        customApiKey: state.customApiKey,
        customApiFormat: state.customApiFormat,
        customApiModel: state.customApiModel,
        deeplApiKey: state.deeplApiKey,
        openaiApiKey: state.openaiApiKey,
        openaiModel: state.openaiModel,
        geminiApiKey: state.geminiApiKey
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
