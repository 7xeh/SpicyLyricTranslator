import { state } from './state';
import { storage } from './storage';
import { OverlayMode } from './translationOverlay';
import { SUPPORTED_LANGUAGES, setPreferredApi, getLanguageVariantForBase, resolveTargetLanguage } from './translator';
import type { ApiPreference, CustomApiFormat } from './translator';

export type SettingsFieldType = 'select' | 'toggle' | 'text' | 'password';
export type SettingsEffect = 'reapplyTranslations' | 'retranslate' | 'providerVisibility' | 'fieldVisibility' | 'qualityIndicatorClass' | 'connectionIndicatorClass' | 'romanizationDisplay';

export interface SettingsOption {
    value: string;
    text: string;
}

export interface SettingsField {
    id: string;
    label: string;
    type: SettingsFieldType;
    section: string;
    storageKey: string;
    defaultValue: string | boolean;
    options?: SettingsOption[];
    placeholder?: string;
    description?: string;
    keywords?: string;
    secret?: boolean;
    visibleForApis?: ApiPreference[];
    visibleWhen?: () => boolean;
    effects?: SettingsEffect[];
}

export interface SettingsCategory {
    id: string;
    label: string;
    sections: string[];
}

export const SETTINGS_CATEGORIES: SettingsCategory[] = [
    { id: 'slt-cat-translation', label: 'Translation', sections: ['Translation', 'Behaviour'] },
    {
        id: 'slt-cat-providers',
        label: 'Providers',
        sections: ['Provider', 'Custom API', 'LibreTranslate', 'DeepL', 'OpenAI', 'Gemini', 'Grok', 'Claude']
    },
    { id: 'slt-cat-interface', label: 'Interface', sections: ['Interface'] }
];

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
        section: 'Translation',
        keywords: 'language locale translate to output',
        label: 'Target Language',
        type: 'select',
        storageKey: 'target-language',
        defaultValue: 'en',
        options: SUPPORTED_LANGUAGES.map(language => ({ value: language.code, text: language.name })),
        effects: ['retranslate', 'fieldVisibility']
    },
    {
        id: 'language-variant',
        section: 'Translation',
        keywords: 'variant regional dialect valencian valencia catalan local',
        label: 'Use Regional Variant',
        type: 'toggle',
        storageKey: 'language-variant',
        defaultValue: false,
        description: 'Ask the model for the regional variant of the target language. Only available on AI providers that accept written instructions.',
        visibleForApis: ['openai', 'gemini', 'grok', 'anthropic', 'custom'],
        visibleWhen: () => Boolean(getLanguageVariantForBase(storage.get('target-language') || 'en')),
        effects: ['retranslate']
    },
    {
        id: 'overlay-mode',
        section: 'Translation',
        keywords: 'display overlay replace interleaved below line',
        label: 'Translation Display',
        type: 'select',
        storageKey: 'overlay-mode',
        defaultValue: 'replace',
        options: OVERLAY_MODE_OPTIONS,
        description: 'How translated lyrics are displayed',
        effects: ['reapplyTranslations']
    },
    {
        id: 'show-romanization',
        section: 'Translation',
        keywords: 'romanization romaji pinyin transliteration pronunciation reading sing along',
        label: 'Show Romanization',
        type: 'toggle',
        storageKey: 'show-romanization',
        defaultValue: false,
        description: 'Show the pronunciation line (pinyin, romaji, ...) alongside the translation, when the lyrics provider supplies one',
        effects: ['romanizationDisplay']
    },
    {
        id: 'preferred-api',
        section: 'Provider',
        keywords: 'api provider service engine backend',
        label: 'Translation API',
        type: 'select',
        storageKey: 'preferred-api',
        defaultValue: 'google',
        options: API_OPTIONS,
        effects: ['providerVisibility']
    },
    {
        id: 'custom-api-url',
        section: 'Custom API',
        keywords: 'custom endpoint url self hosted',
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
        section: 'Custom API',
        keywords: 'custom format schema payload compatible',
        label: 'Custom API Format',
        type: 'select',
        storageKey: 'custom-api-format',
        defaultValue: 'generic',
        options: CUSTOM_API_FORMAT_OPTIONS,
        visibleForApis: ['custom']
    },
    {
        id: 'custom-api-key',
        section: 'Custom API',
        keywords: 'custom key token auth secret',
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
        section: 'Custom API',
        keywords: 'custom model name llm',
        label: 'Custom API Model (optional)',
        type: 'text',
        storageKey: 'custom-api-model',
        defaultValue: '',
        placeholder: 'gpt-4o-mini, llama3.1, gemini-3.1-flash-lite',
        visibleForApis: ['custom']
    },
    {
        id: 'libretranslate-api-url',
        section: 'LibreTranslate',
        keywords: 'libretranslate url endpoint self hosted',
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
        section: 'LibreTranslate',
        keywords: 'libretranslate key token auth secret',
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
        section: 'DeepL',
        keywords: 'deepl key token auth secret pro free',
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
        section: 'OpenAI',
        keywords: 'openai key token auth secret gpt',
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
        section: 'OpenAI',
        keywords: 'openai model gpt version',
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
        section: 'Gemini',
        keywords: 'gemini google key token auth secret',
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
        section: 'Gemini',
        keywords: 'gemini model flash pro version',
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
        section: 'Gemini',
        keywords: 'gemini temperature randomness creativity',
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
        section: 'Grok',
        keywords: 'grok xai key token auth secret',
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
        section: 'Grok',
        keywords: 'grok xai model version',
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
        section: 'Claude',
        keywords: 'claude anthropic key token auth secret',
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
        section: 'Claude',
        keywords: 'claude anthropic model haiku sonnet opus',
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
        section: 'Provider',
        keywords: 'parallel concurrent requests speed rate limit cost',
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
        section: 'Behaviour',
        keywords: 'auto automatic song change start',
        label: 'Auto-Translate on Song Change',
        type: 'toggle',
        storageKey: 'auto-translate',
        defaultValue: false
    },
    {
        id: 'show-notifications',
        section: 'Interface',
        keywords: 'notifications toasts messages popup',
        label: 'Show Notifications',
        type: 'toggle',
        storageKey: 'show-notifications',
        defaultValue: true
    },
    {
        id: 'show-quality-indicator',
        section: 'Interface',
        keywords: 'quality indicator badge confidence',
        label: 'Show Translation Quality Indicator',
        type: 'toggle',
        storageKey: 'show-quality-indicator',
        defaultValue: true,
        effects: ['qualityIndicatorClass']
    },
    {
        id: 'hide-connection-indicator',
        section: 'Interface',
        keywords: 'connection status indicator hide ping',
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

export function getCategoryForSection(section: string): SettingsCategory | undefined {
    return SETTINGS_CATEGORIES.find(category => category.sections.includes(section));
}

export function getSectionsForCategory(category: SettingsCategory): string[] {
    return category.sections.filter(section => SETTINGS_SCHEMA.some(field => field.section === section));
}

export function matchesSettingQuery(field: SettingsField, query: string): boolean {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;

    return [field.label, field.section, field.description, field.keywords]
        .some(value => (value || '').toLowerCase().includes(needle));
}

export function getCurrentApiPreference(): ApiPreference {
    return (storage.get('preferred-api') as ApiPreference) || state.preferredApi || 'google';
}

export function getResolvedTargetLanguage(): string {
    return resolveTargetLanguage(
        storage.get('target-language') || 'en',
        storage.get('language-variant') === 'true',
        getCurrentApiPreference()
    );
}

export function isSettingFieldVisible(field: SettingsField, api: ApiPreference = getCurrentApiPreference()): boolean {
    if (field.visibleForApis && !field.visibleForApis.includes(api)) return false;
    return !field.visibleWhen || field.visibleWhen();
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

export function isSettingAtDefault(field: SettingsField): boolean {
    const value = readSettingValue(field);
    if (field.type === 'toggle') return Boolean(value) === Boolean(field.defaultValue);
    return String(value) === String(field.defaultValue);
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
            state.targetLanguage = getResolvedTargetLanguage();
            break;
        case 'language-variant':
            state.targetLanguage = getResolvedTargetLanguage();
            break;
        case 'overlay-mode':
            state.overlayMode = String(value) as OverlayMode;
            break;
        case 'show-romanization':
            state.showRomanization = Boolean(value);
            break;
        case 'preferred-api':
            state.preferredApi = String(value) as ApiPreference;
            state.targetLanguage = getResolvedTargetLanguage();
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
        case 'hide-connection-indicator':
            state.hideConnectionIndicator = Boolean(value);
            break;
    }

    return field.effects || [];
}
