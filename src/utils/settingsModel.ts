import { state, parseLanguageList } from './state';
import type { NotificationLevel } from './state';
import { storage } from './storage';
import { notify } from './notify';
import { OverlayMode } from './translationOverlay';
import { SUPPORTED_LANGUAGES, setPreferredApi, getLanguageVariantForBase, resolveTargetLanguage } from './translator';
import type { ApiPreference, CustomApiFormat } from './translator';
import { getModelOptions, refreshModelCatalog, resolveModelId, MODEL_PROVIDERS } from './modelCatalog';
import type { ModelProvider } from './modelCatalog';

export type SettingsFieldType = 'select' | 'toggle' | 'text' | 'password' | 'languages';
export type SettingsEffect = 'reapplyTranslations' | 'retranslate' | 'providerVisibility' | 'fieldVisibility' | 'qualityIndicatorClass' | 'connectionIndicatorClass' | 'romanizationDisplay' | 'learningModeClass';

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
    icon: string;
    description: string;
    sections: string[];
}

export const SETTINGS_CATEGORIES: SettingsCategory[] = [
    {
        id: 'slt-cat-translation',
        label: 'Translation',
        icon: '文',
        description: 'The language you read in, how translations sit on the lyrics, and when they run.',
        sections: ['Translation', 'Behaviour']
    },
    {
        id: 'slt-cat-providers',
        label: 'Providers',
        icon: '⇄',
        description: 'Which service does the translating, plus its key and model.',
        sections: ['Provider', 'Custom API', 'LibreTranslate', 'DeepL', 'OpenAI', 'Gemini', 'Grok', 'Claude']
    },
    {
        id: 'slt-cat-interface',
        label: 'Interface',
        icon: '◐',
        description: 'Notifications and the badges shown around the lyrics.',
        sections: ['Interface']
    }
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
    { value: 'replace', text: 'Replace' },
    { value: 'interleaved', text: 'Below each line (default)' },
    { value: 'none', text: 'None (original lyrics only)' }
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
        keywords: 'display overlay replace interleaved below line none hide off original only',
        label: 'Translation Display',
        type: 'select',
        storageKey: 'overlay-mode',
        defaultValue: 'interleaved',
        options: OVERLAY_MODE_OPTIONS,
        description: 'How translated lyrics are displayed. None still translates and caches, but leaves the lyrics untouched - pairs with Learning Mode, which shows the translation itself.',
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
        id: 'skip-languages',
        section: 'Translation',
        keywords: 'skip exclude ignore never do not translate languages i read understand multilingual bilingual',
        label: "Don't Translate",
        type: 'languages',
        storageKey: 'skip-languages',
        defaultValue: '',
        options: SUPPORTED_LANGUAGES.map(language => ({ value: language.code, text: language.name })),
        placeholder: 'Add a language…',
        description: 'Songs in these languages are left as they are. Add the languages you already read.',
        effects: ['retranslate']
    },
    {
        id: 'replace-script-conversions',
        section: 'Translation',
        keywords: 'chinese simplified traditional script convert conversion replace in place hanzi',
        label: 'Replace Lyrics When Only the Script Changes',
        type: 'toggle',
        storageKey: 'replace-script-conversions',
        defaultValue: false,
        description: 'Between Simplified and Traditional Chinese, show the converted lyrics in place of the original instead of below it.',
        visibleWhen: () => (storage.get('target-language') || 'en').startsWith('zh'),
        effects: ['reapplyTranslations']
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
        get options() {
            return getModelOptions('openai', storage.get('openai-model'));
        },
        description: 'Models available to your API key, refreshed automatically. Mini/nano models are fastest and cheapest',
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
        placeholder: 'AIza... or AQ...',
        description: 'Get a key at aistudio.google.com/apikey (AIza... and AQ... keys both work)',
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
        get options() {
            return getModelOptions('gemini', storage.get('gemini-model'));
        },
        description: 'Models available to your API key, refreshed automatically. Flash-Lite is fastest; Flash is balanced; Pro is best for harder lyrics',
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
        get options() {
            return getModelOptions('grok', storage.get('grok-model'));
        },
        description: 'Models available to your API key, refreshed automatically',
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
        get options() {
            return getModelOptions('anthropic', storage.get('anthropic-model'));
        },
        description: 'Models available to your API key, refreshed automatically. Haiku is fastest and cheapest; Sonnet balances cost and quality; Opus is best for nuanced lyrics',
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
        id: 'notification-level',
        section: 'Interface',
        keywords: 'notifications toasts messages popup alerts errors quiet silent',
        label: 'Notifications',
        type: 'select',
        storageKey: 'notification-level',
        defaultValue: 'all',
        effects: ['fieldVisibility'],
        options: [
            { value: 'all', text: 'All' },
            { value: 'errors', text: 'Errors and warnings only' },
            { value: 'off', text: 'Off' }
        ],
        description: 'Which pop-up messages to show. Update prompts always appear, and warnings and errors are kept in the notification inbox either way.'
    },
    {
        id: 'show-skip-notice',
        section: 'Interface',
        keywords: 'notifications toasts popup already in language same target skip skipped notice',
        label: 'Notify When Lyrics Are Already in Target Language',
        type: 'toggle',
        storageKey: 'show-skip-notice',
        defaultValue: true,
        description: 'Show the "Lyrics already in ..." pop-up when a song is skipped because it is already in the language you translate to.',
        visibleWhen: () => (storage.get('notification-level') || 'all') === 'all'
    },
    {
        id: 'show-translated-notice',
        section: 'Interface',
        keywords: 'notifications toasts popup translated success complete done notice',
        label: 'Notify When a Song Is Translated',
        type: 'toggle',
        storageKey: 'show-translated-notice',
        defaultValue: true,
        description: 'Show the pop-up confirming a song was translated.',
        visibleWhen: () => (storage.get('notification-level') || 'all') === 'all'
    },
    {
        id: 'learning-mode',
        section: 'Behaviour',
        keywords: 'learning vocabulary study word by word breakdown gloss lemma',
        label: 'Learning Mode (word-by-word breakdown)',
        type: 'toggle',
        storageKey: 'learning-mode',
        defaultValue: false,
        effects: ['learningModeClass', 'reapplyTranslations']
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

export function getModelFieldId(provider: ModelProvider): string {
    return `${provider}-model`;
}

function getModelProviderForField(fieldId: string): ModelProvider | null {
    return MODEL_PROVIDERS.find(provider => fieldId === getModelFieldId(provider) || fieldId === `${provider}-api-key`) || null;
}

function getProviderApiKey(provider: ModelProvider): string {
    switch (provider) {
        case 'openai': return state.openaiApiKey;
        case 'gemini': return state.geminiApiKey;
        case 'grok': return state.grokApiKey;
        case 'anthropic': return state.anthropicApiKey;
    }
}

export async function refreshProviderModelLists(options: { fieldId?: string; force?: boolean } = {}): Promise<string[]> {
    const onlyProvider = options.fieldId ? getModelProviderForField(options.fieldId) : null;
    if (options.fieldId && !onlyProvider) return [];

    const providers = onlyProvider ? [onlyProvider] : MODEL_PROVIDERS;
    const results = await Promise.all(providers.map(async provider => {
        const refreshed = await refreshModelCatalog(provider, getProviderApiKey(provider), { force: options.force });
        return refreshed ? getModelFieldId(provider) : null;
    }));
    return results.filter((id): id is string => Boolean(id));
}

function normalizeLegacySelectValue(fieldId: string, value: string | null): string | null {
    const stored = (value || '').trim();
    if (!stored) return value;
    const provider = MODEL_PROVIDERS.find(candidate => fieldId === getModelFieldId(candidate));
    return provider ? resolveModelId(provider, stored) : value;
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

function notifySettingCorrection(message: string): void {
    notify({ kind: 'info', title: message, key: 'slt-setting-correction' });
}

function showLearningCards(): void {
    state.learningVisible = true;
    storage.set('learning-visible', 'true');
}

function enforceLearningCoupling(fieldId: string, value: string | boolean): SettingsEffect[] {
    if (fieldId === 'overlay-mode' && String(value) === 'none' && !state.learningMode) {
        storage.set('learning-mode', 'true');
        state.learningMode = true;
        showLearningCards();
        notifySettingCorrection('Learning Mode turned on - display None hides translations, so the cards show them instead');
        return ['learningModeClass'];
    }

    if (fieldId === 'learning-mode' && !Boolean(value) && state.overlayMode === 'none') {
        storage.set('overlay-mode', 'replace');
        state.overlayMode = 'replace';
        notifySettingCorrection('Translation Display switched back to Replace - display None only makes sense with Learning Mode');
        return ['reapplyTranslations'];
    }

    return [];
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
        case 'skip-languages':
            state.skipLanguages = parseLanguageList(String(value));
            break;
        case 'replace-script-conversions':
            state.replaceScriptConversions = Boolean(value);
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
        case 'notification-level':
            state.notificationLevel = String(value) as NotificationLevel;
            break;
        case 'show-skip-notice':
            state.showSkipNotice = Boolean(value);
            break;
        case 'show-translated-notice':
            state.showTranslatedNotice = Boolean(value);
            break;
        case 'show-quality-indicator':
            state.showQualityIndicator = Boolean(value);
            break;
        case 'learning-mode':
            state.learningMode = Boolean(value);
            if (state.learningMode) showLearningCards();
            break;
        case 'hide-connection-indicator':
            state.hideConnectionIndicator = Boolean(value);
            break;
    }

    const coupled = enforceLearningCoupling(field.id, value);
    if (coupled.length === 0) return field.effects || [];

    return Array.from(new Set([...(field.effects || []), ...coupled]));
}
