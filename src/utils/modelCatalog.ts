import { storage } from './storage';
import { warn } from './debug';

export type ModelProvider = 'openai' | 'gemini' | 'grok' | 'anthropic';

export interface ModelOption {
    value: string;
    text: string;
}

export const MODEL_PROVIDERS: ModelProvider[] = ['openai', 'gemini', 'grok', 'anthropic'];

export const DEFAULT_MODELS: Record<ModelProvider, string> = {
    openai: 'gpt-4o-mini',
    gemini: 'gemini-3.1-flash-lite',
    grok: 'grok-4.5',
    anthropic: 'claude-haiku-4-5'
};

export const FALLBACK_MODEL_OPTIONS: Record<ModelProvider, ModelOption[]> = {
    openai: [
        { value: 'gpt-5.5', text: 'GPT-5.5 Speed' },
        { value: 'gpt-4o-mini', text: 'GPT-4o mini' }
    ],
    gemini: [
        { value: 'gemini-3.1-flash-lite', text: '3.1 Flash-Lite' },
        { value: 'gemini-3.5-flash', text: '3.5 Flash' },
        { value: 'gemini-3.1-pro-preview', text: '3.1 Pro' }
    ],
    grok: [
        { value: 'grok-4.5', text: 'Grok 4.5' },
        { value: 'grok-4.3', text: 'Grok 4.3' }
    ],
    anthropic: [
        { value: 'claude-haiku-4-5', text: 'Haiku 4.5' },
        { value: 'claude-sonnet-5', text: 'Sonnet 5' },
        { value: 'claude-opus-4-8', text: 'Opus 4.8' }
    ]
};

const CATALOG_TTL_MS = 24 * 60 * 60 * 1000;
const CATALOG_REQUEST_TIMEOUT_MS = 10000;
const CORS_PROXY_BASE = 'https://cors-proxy.spicetify.app/';
const MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;

const RETIRED_OPENAI_MODELS = new Set(['gpt-4o', 'gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo']);
const RETIRED_GEMINI_MODELS = new Set(['gemini-3.1-flash-lite-preview', 'gemini-3-pro-preview']);

const GEMINI_EXCLUDED = /(image|tts|live|transcribe|embedding|audio|robotics|computer-use|aqa)/;
const OPENAI_INCLUDED = /^(gpt-|o\d|chatgpt-)/;
const OPENAI_EXCLUDED = /(audio|realtime|tts|transcribe|image|search|embedding|instruct|codex|cyber|computer-use|moderation|daybreak|rosalind|-\d{4}-\d{2}-\d{2}$)/;
const GROK_EXCLUDED = /(image|imagine|video|build|multi-agent)/;

interface CachedCatalog {
    keyHash: string;
    fetchedAt: number;
    models: ModelOption[];
}

class ModelCatalogHttpError extends Error {
    constructor(readonly status: number) {
        super(`Model list request failed: ${status}`);
        this.name = 'ModelCatalogHttpError';
    }
}

function mapRetiredGeminiModel(id: string): string | null {
    if (!RETIRED_GEMINI_MODELS.has(id) && !/^gemini-[12][.-]/.test(id)) return null;
    if (id.includes('flash-lite')) return 'gemini-3.1-flash-lite';
    if (id.includes('pro')) return 'gemini-3.1-pro-preview';
    if (id.includes('flash')) return 'gemini-3.5-flash';
    return DEFAULT_MODELS.gemini;
}

export function resolveModelId(provider: ModelProvider, model: string | null | undefined): string {
    const trimmed = (model || '').trim().replace(/^models\//, '');
    if (!MODEL_ID_PATTERN.test(trimmed)) return DEFAULT_MODELS[provider];
    if (provider === 'openai' && RETIRED_OPENAI_MODELS.has(trimmed)) return DEFAULT_MODELS.openai;
    if (provider === 'gemini') return mapRetiredGeminiModel(trimmed) ?? trimmed;
    return trimmed;
}

export function hashApiKey(apiKey: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < apiKey.length; i++) {
        hash ^= apiKey.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
}

function cacheKey(provider: ModelProvider): string {
    return `model-catalog-${provider}`;
}

function readCache(provider: ModelProvider): CachedCatalog | null {
    try {
        const parsed = JSON.parse(storage.get(cacheKey(provider)) || 'null');
        if (!parsed || !Array.isArray(parsed.models) || parsed.models.length === 0) return null;
        return parsed as CachedCatalog;
    } catch {
        return null;
    }
}

function fallbackLabel(provider: ModelProvider, id: string): string {
    return FALLBACK_MODEL_OPTIONS[provider].find(option => option.value === id)?.text || id;
}

export function getModelOptions(provider: ModelProvider, selected?: string | null): ModelOption[] {
    const options = [...(readCache(provider)?.models ?? FALLBACK_MODEL_OPTIONS[provider])];
    const required = [selected ? resolveModelId(provider, selected) : '', DEFAULT_MODELS[provider]];
    for (const id of required) {
        if (id && !options.some(option => option.value === id)) {
            options.push({ value: id, text: fallbackLabel(provider, id) });
        }
    }
    return options;
}

export function isModelCatalogFresh(provider: ModelProvider, apiKey: string, now: number = Date.now()): boolean {
    const cached = readCache(provider);
    return Boolean(cached && cached.keyHash === hashApiKey(apiKey.trim()) && now - cached.fetchedAt < CATALOG_TTL_MS);
}

async function getJson(url: string, headers: Record<string, string>): Promise<any> {
    const attempt = async (target: string): Promise<any> => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), CATALOG_REQUEST_TIMEOUT_MS);
        try {
            const response = await fetch(target, { method: 'GET', headers, signal: controller.signal });
            if (!response.ok) throw new ModelCatalogHttpError(response.status);
            return await response.json();
        } finally {
            clearTimeout(timer);
        }
    };

    try {
        return await attempt(url);
    } catch (err) {
        if (err instanceof ModelCatalogHttpError) throw err;
        return attempt(`${CORS_PROXY_BASE}${url}`);
    }
}

function newestFirst(options: ModelOption[]): ModelOption[] {
    return options.sort((a, b) => b.value.localeCompare(a.value, undefined, { numeric: true }));
}

function dedupe(options: ModelOption[]): ModelOption[] {
    const seen = new Set<string>();
    return options.filter(option => {
        if (seen.has(option.value)) return false;
        seen.add(option.value);
        return true;
    });
}

export function parseGeminiModels(data: any): ModelOption[] {
    const models = Array.isArray(data?.models) ? data.models : [];
    return newestFirst(dedupe(models
        .filter((model: any) => Array.isArray(model?.supportedGenerationMethods) && model.supportedGenerationMethods.includes('generateContent'))
        .map((model: any) => {
            const value = String(model.name || '').replace(/^models\//, '');
            return { value, text: String(model.displayName || value) };
        })
        .filter((option: ModelOption) => option.value.startsWith('gemini-') && !GEMINI_EXCLUDED.test(option.value))));
}

export function parseOpenAIModels(data: any): ModelOption[] {
    const models = Array.isArray(data?.data) ? data.data : [];
    return newestFirst(dedupe(models
        .map((model: any) => String(model?.id || ''))
        .filter((id: string) => OPENAI_INCLUDED.test(id) && !OPENAI_EXCLUDED.test(id))
        .map((id: string) => ({ value: id, text: id }))));
}

export function parseAnthropicModels(data: any): ModelOption[] {
    const models = Array.isArray(data?.data) ? data.data : [];
    return dedupe(models
        .map((model: any) => ({ value: String(model?.id || ''), text: String(model?.display_name || model?.id || '') }))
        .filter((option: ModelOption) => option.value.startsWith('claude-')));
}

export function parseGrokModels(data: any): ModelOption[] {
    const models = Array.isArray(data?.data) ? data.data : [];
    return newestFirst(dedupe(models
        .map((model: any) => String(model?.id || ''))
        .filter((id: string) => id.startsWith('grok-') && !GROK_EXCLUDED.test(id))
        .map((id: string) => ({ value: id, text: id }))));
}

async function fetchModelList(provider: ModelProvider, apiKey: string): Promise<ModelOption[]> {
    switch (provider) {
        case 'gemini':
            return parseGeminiModels(await getJson(
                'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000',
                { 'x-goog-api-key': apiKey }
            ));
        case 'openai':
            return parseOpenAIModels(await getJson(
                'https://api.openai.com/v1/models',
                { 'Authorization': `Bearer ${apiKey}` }
            ));
        case 'anthropic':
            return parseAnthropicModels(await getJson(
                'https://api.anthropic.com/v1/models?limit=100',
                {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true'
                }
            ));
        case 'grok':
            return parseGrokModels(await getJson(
                'https://api.x.ai/v1/models',
                { 'Authorization': `Bearer ${apiKey}` }
            ));
    }
}

const inflight = new Map<ModelProvider, Promise<ModelOption[] | null>>();

export function refreshModelCatalog(
    provider: ModelProvider,
    apiKey: string,
    options: { force?: boolean } = {}
): Promise<ModelOption[] | null> {
    const key = (apiKey || '').trim();
    if (!key) return Promise.resolve(null);
    if (!options.force && isModelCatalogFresh(provider, key)) return Promise.resolve(null);

    const pending = inflight.get(provider);
    if (pending) return pending;

    const request = fetchModelList(provider, key)
        .then(models => {
            if (models.length === 0) return null;
            storage.set(cacheKey(provider), JSON.stringify({ keyHash: hashApiKey(key), fetchedAt: Date.now(), models }));
            return models;
        })
        .catch(err => {
            warn(`Could not refresh ${provider} model list:`, err);
            return null;
        })
        .finally(() => {
            inflight.delete(provider);
        });

    inflight.set(provider, request);
    return request;
}
