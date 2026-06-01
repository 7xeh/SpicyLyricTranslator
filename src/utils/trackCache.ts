import { warn } from './debug';

const CACHE_KEY_PREFIX = 'slt-track-cache:';
const CACHE_INDEX_KEY = 'slt-track-cache-index';
const CACHE_SCHEMA_KEY = 'slt-track-cache-schema';
const CACHE_SCHEMA_VERSION = 2;
const CACHE_MAX_TRACKS = 100;
const CACHE_EXPIRY_DAYS = 14;
const CACHE_EXPIRY_MS = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

export interface TrackCacheMetrics {
    model?: string;
    durationMs?: number;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    apiCalls?: number;
}

interface TrackCacheEntry {
    lang: string;
    targetLang: string;
    lines: string[];
    sourceLines?: string[];
    timestamp: number;
    api?: string;
    sourceFingerprint?: string;
    trackName?: string;
    artistName?: string;
    metrics?: TrackCacheMetrics;
}

interface CacheIndex {
    trackUris: string[];
}

function getStorage(): typeof localStorage | null {
    if (typeof localStorage !== 'undefined') {
        return localStorage;
    }
    return null;
}

let schemaMigrationRun = false;
function runCacheSchemaMigration(): void {
    if (schemaMigrationRun) return;
    const storage = getStorage();
    if (!storage) {
        schemaMigrationRun = true;
        return;
    }

    try {
        const stored = storage.getItem(CACHE_SCHEMA_KEY);
        const storedVersion = stored ? parseInt(stored, 10) : 0;
        if (storedVersion >= CACHE_SCHEMA_VERSION) {
            schemaMigrationRun = true;
            return;
        }

        for (let i = storage.length - 1; i >= 0; i--) {
            const key = storage.key(i);
            if (key && key.startsWith(CACHE_KEY_PREFIX)) {
                storage.removeItem(key);
            }
        }
        storage.removeItem(CACHE_INDEX_KEY);
        storage.setItem(CACHE_SCHEMA_KEY, String(CACHE_SCHEMA_VERSION));
    } catch (e) {
        warn('Track cache schema migration failed:', e);
    } finally {
        schemaMigrationRun = true;
    }
}

function getCacheIndex(): CacheIndex {
    const storage = getStorage();
    if (!storage) return { trackUris: [] };
    
    try {
        const indexStr = storage.getItem(CACHE_INDEX_KEY);
        if (indexStr) {
            return JSON.parse(indexStr);
        }
    } catch (e) {
        warn('Failed to parse cache index:', e);
    }
    return { trackUris: [] };
}

function saveCacheIndex(index: CacheIndex): void {
    const storage = getStorage();
    if (!storage) return;
    
    try {
        storage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));
    } catch (e) {
        warn('Failed to save cache index:', e);
    }
}

function normalizeTrackUri(uri: string): string {
    return uri.replace(/[^a-zA-Z0-9:]/g, '_');
}

function getCacheKey(trackUri: string, targetLang: string): string {
    return `${CACHE_KEY_PREFIX}${normalizeTrackUri(trackUri)}:${targetLang}`;
}

function parseFullKey(fullKey: string): { trackUri: string; targetLang: string } | null {
    const lastColonIdx = fullKey.lastIndexOf(':');
    if (lastColonIdx <= 0 || lastColonIdx === fullKey.length - 1) return null;
    return {
        trackUri: fullKey.substring(0, lastColonIdx),
        targetLang: fullKey.substring(lastColonIdx + 1)
    };
}

function parseCacheKey(cacheKey: string): { trackUri: string; targetLang: string } | null {
    if (!cacheKey.startsWith(CACHE_KEY_PREFIX)) return null;
    return parseFullKey(cacheKey.substring(CACHE_KEY_PREFIX.length));
}

function removeFullKey(storage: typeof localStorage, fullKey: string): boolean {
    const parsed = parseFullKey(fullKey);
    if (!parsed) return false;
    storage.removeItem(getCacheKey(parsed.trackUri, parsed.targetLang));
    return true;
}

function collectNativeCacheKeys(storage: typeof localStorage): string[] {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && key.startsWith(CACHE_KEY_PREFIX)) {
            keys.push(key);
        }
    }
    return keys;
}

function parseTrackCacheEntry(entryStr: string): TrackCacheEntry | null {
    const entry: TrackCacheEntry = JSON.parse(entryStr);
    if (!entry || typeof entry.timestamp !== 'number' || !Array.isArray(entry.lines)) {
        return null;
    }
    return entry;
}

function normalizeLanguageBase(lang?: string): string {
    return (lang || '').trim().toLowerCase().replace(/_/g, '-').split('-')[0];
}

function isSameCacheLanguage(sourceLang: string | undefined, targetLang: string): boolean {
    const source = normalizeLanguageBase(sourceLang);
    const target = normalizeLanguageBase(targetLang);
    return Boolean(source && target && source === target);
}

function hasNonLatinScript(text: string): boolean {
    return /[\u3040-\u30FF\u4E00-\u9FFF\u3400-\u4DBF\uAC00-\uD7AF\u1100-\u11FF\u0600-\u06FF\u0590-\u05FF\u0400-\u04FF\u0E00-\u0E7F\u0900-\u097F\u0370-\u03FF]/.test(text || '');
}

function isSameLanguageNoopCache(entry: TrackCacheEntry, targetLang: string): boolean {
    if (!isSameCacheLanguage(entry.lang, targetLang)) return false;
    if (!entry.sourceLines || entry.sourceLines.length !== entry.lines.length) return false;
    return !entry.sourceLines.some((line, index) => hasNonLatinScript(line) && (entry.lines[index] || '').trim() !== line.trim());
}

function pruneTrackCache(maxTracks = CACHE_MAX_TRACKS): void {
    const storage = getStorage();
    if (!storage) return;

    const now = Date.now();
    const seen = new Set<string>();
    const entries: Array<{ fullKey: string; cacheKey: string; timestamp: number }> = [];
    const index = getCacheIndex();

    const addEntry = (fullKey: string, cacheKey: string): void => {
        if (seen.has(fullKey)) return;

        try {
            const entryStr = storage.getItem(cacheKey);
            if (!entryStr) return;

            const entry = parseTrackCacheEntry(entryStr);
            if (!entry || now - entry.timestamp > CACHE_EXPIRY_MS) {
                storage.removeItem(cacheKey);
                return;
            }

            const parsed = parseFullKey(fullKey);
            if (!parsed || isSameLanguageNoopCache(entry, parsed.targetLang)) {
                storage.removeItem(cacheKey);
                return;
            }

            seen.add(fullKey);
            entries.push({ fullKey, cacheKey, timestamp: entry.timestamp });
        } catch (e) {
            storage.removeItem(cacheKey);
        }
    };

    index.trackUris.forEach(fullKey => {
        const parsed = parseFullKey(fullKey);
        if (!parsed) return;
        addEntry(fullKey, getCacheKey(parsed.trackUri, parsed.targetLang));
    });

    collectNativeCacheKeys(storage).forEach(cacheKey => {
        const parsed = parseCacheKey(cacheKey);
        if (!parsed) {
            storage.removeItem(cacheKey);
            return;
        }
        addEntry(`${parsed.trackUri}:${parsed.targetLang}`, cacheKey);
    });

    entries.sort((a, b) => a.timestamp - b.timestamp);

    const removeCount = Math.max(0, entries.length - maxTracks);
    if (removeCount > 0) {
        entries.slice(0, removeCount).forEach(entry => {
            storage.removeItem(entry.cacheKey);
        });
    }

    saveCacheIndex({
        trackUris: entries.slice(removeCount).map(entry => entry.fullKey)
    });
}

export function getTrackCache(trackUri: string, targetLang: string): TrackCacheEntry | null {
    runCacheSchemaMigration();
    const storage = getStorage();
    if (!storage || !trackUri) return null;

    const cacheKey = getCacheKey(trackUri, targetLang);
    
    try {
        const entryStr = storage.getItem(cacheKey);
        if (!entryStr) return null;
        
        const entry = parseTrackCacheEntry(entryStr);
        if (!entry) {
            storage.removeItem(cacheKey);
            pruneTrackCache();
            return null;
        }
        
        if (Date.now() - entry.timestamp > CACHE_EXPIRY_MS) {
            storage.removeItem(cacheKey);
            pruneTrackCache();
            return null;
        }

        if (isSameLanguageNoopCache(entry, targetLang)) {
            storage.removeItem(cacheKey);
            pruneTrackCache();
            return null;
        }
        
        return entry;
    } catch (e) {
        warn('Failed to read track cache:', e);
        return null;
    }
}

export function setTrackCache(
    trackUri: string,
    targetLang: string,
    sourceLang: string,
    lines: string[],
    api?: string,
    sourceFingerprint?: string,
    trackName?: string,
    artistName?: string,
    sourceLines?: string[],
    metrics?: TrackCacheMetrics
): void {
    runCacheSchemaMigration();
    const storage = getStorage();
    if (!storage || !trackUri || !lines.length) return;

    const cacheKey = getCacheKey(trackUri, targetLang);

    const meta = trackName ? { trackName, artistName } : getCurrentTrackMeta();

    const entry: TrackCacheEntry = {
        lang: sourceLang,
        targetLang: targetLang,
        lines: lines,
        sourceLines: sourceLines,
        timestamp: Date.now(),
        api: api,
        sourceFingerprint,
        trackName: meta.trackName,
        artistName: meta.artistName,
        metrics: metrics && (metrics.model || metrics.durationMs || metrics.totalTokens || metrics.apiCalls) ? metrics : undefined
    };
    
    try {
        storage.setItem(cacheKey, JSON.stringify(entry));
        const index = getCacheIndex();
        const fullKey = `${trackUri}:${targetLang}`;
        index.trackUris = index.trackUris.filter(k => k !== fullKey);
        index.trackUris.push(fullKey);
        saveCacheIndex(index);
        pruneTrackCache();
    } catch (e) {
        warn('Failed to set track cache:', e);
        
        if (e instanceof Error && e.name === 'QuotaExceededError') {
            pruneOldestEntries(10);
            try {
                storage.setItem(cacheKey, JSON.stringify(entry));
                const index = getCacheIndex();
                const fullKey = `${trackUri}:${targetLang}`;
                index.trackUris = index.trackUris.filter(k => k !== fullKey);
                index.trackUris.push(fullKey);
                saveCacheIndex(index);
                pruneTrackCache();
            } catch (retryError) {
                warn('Still failed after pruning:', retryError);
            }
        }
    }
}

export function hasTrackCache(trackUri: string, targetLang: string): boolean {
    return getTrackCache(trackUri, targetLang) !== null;
}

export function deleteTrackCache(trackUri: string, targetLang?: string): void {
    const storage = getStorage();
    if (!storage || !trackUri) return;
    
    const index = getCacheIndex();
    
    if (targetLang) {
        const normWanted = normalizeTrackUri(trackUri);
        storage.removeItem(getCacheKey(trackUri, targetLang));

        collectNativeCacheKeys(storage).forEach(key => {
            const parsed = parseCacheKey(key);
            if (parsed && parsed.targetLang === targetLang && normalizeTrackUri(parsed.trackUri) === normWanted) {
                storage.removeItem(key);
            }
        });

        index.trackUris = index.trackUris.filter(fullKey => {
            const p = parseFullKey(fullKey);
            return !(p && p.targetLang === targetLang && normalizeTrackUri(p.trackUri) === normWanted);
        });
    } else {
        const keysToRemove = index.trackUris.filter(k => k.startsWith(trackUri + ':'));
        keysToRemove.forEach(k => {
            removeFullKey(storage, k);
        });
        const nativePrefix = `${CACHE_KEY_PREFIX}${normalizeTrackUri(trackUri)}:`;
        collectNativeCacheKeys(storage).forEach(key => {
            if (key.startsWith(nativePrefix)) {
                storage.removeItem(key);
            }
        });
        index.trackUris = index.trackUris.filter(k => !k.startsWith(trackUri + ':'));
    }
    
    saveCacheIndex(index);
}

function pruneOldestEntries(count: number): void {
    const storage = getStorage();
    if (!storage) return;
    
    const index = getCacheIndex();
    const toRemove = index.trackUris.splice(0, count);
    
    toRemove.forEach(fullKey => {
        removeFullKey(storage, fullKey);
    });
    
    saveCacheIndex(index);
}

export function clearAllTrackCache(): void {
    const storage = getStorage();
    if (!storage) return;
    
    const index = getCacheIndex();
    
    index.trackUris.forEach(fullKey => {
        removeFullKey(storage, fullKey);
    });
    collectNativeCacheKeys(storage).forEach(key => storage.removeItem(key));
    
    storage.removeItem(CACHE_INDEX_KEY);
}

export function getTrackCacheStats(): { 
    trackCount: number; 
    totalLines: number; 
    oldestTimestamp: number | null;
    sizeBytes: number;
} {
    const storage = getStorage();
    if (!storage) return { trackCount: 0, totalLines: 0, oldestTimestamp: null, sizeBytes: 0 };
    pruneTrackCache();
    
    let trackCount = 0;
    let totalLines = 0;
    let oldestTimestamp: number | null = null;
    let sizeBytes = 0;
    
    const nativeStorage = typeof localStorage !== 'undefined' ? localStorage : null;
    
    if (nativeStorage) {
        try {
            const keys: string[] = [];
            for (let i = 0; i < nativeStorage.length; i++) {
                const key = nativeStorage.key(i);
                if (key && key.startsWith(CACHE_KEY_PREFIX)) {
                    keys.push(key);
                }
            }
            
            trackCount = keys.length;
            
            keys.forEach(key => {
                try {
                    const entryStr = nativeStorage.getItem(key);
                    if (entryStr) {
                        sizeBytes += entryStr.length * 2;
                        const entry = parseTrackCacheEntry(entryStr);
                        if (!entry) return;
                        totalLines += entry.lines.length;
                        
                        if (oldestTimestamp === null || entry.timestamp < oldestTimestamp) {
                            oldestTimestamp = entry.timestamp;
                        }
                    }
                } catch (e) {

                }
            });
            
            if (trackCount > 0) {
                return { trackCount, totalLines, oldestTimestamp, sizeBytes };
            }
        } catch (e) {
            warn('Failed to iterate native localStorage:', e);
        }
    }
    
    const index = getCacheIndex();
    index.trackUris.forEach(fullKey => {
        const lastColonIdx = fullKey.lastIndexOf(':');
        const uri = fullKey.substring(0, lastColonIdx);
        const lang = fullKey.substring(lastColonIdx + 1);
        const cacheKey = getCacheKey(uri, lang);
        
        try {
            const entryStr = storage.getItem(cacheKey);
            if (entryStr) {
                trackCount++;
                sizeBytes += entryStr.length * 2;
                const entry = parseTrackCacheEntry(entryStr);
                if (!entry) return;
                totalLines += entry.lines.length;
                
                if (oldestTimestamp === null || entry.timestamp < oldestTimestamp) {
                    oldestTimestamp = entry.timestamp;
                }
            }
        } catch (e) {

        }
    });
    
    return {
        trackCount,
        totalLines,
        oldestTimestamp,
        sizeBytes
    };
}

export interface CachedTrackSummary {
    trackUri: string;
    targetLang: string;
    sourceLang: string;
    lineCount: number;
    timestamp: number;
    api?: string;
    trackName?: string;
    artistName?: string;
    metrics?: TrackCacheMetrics;
}

function dedupeCachedTracks(tracks: CachedTrackSummary[]): CachedTrackSummary[] {
    const byKey = new Map<string, CachedTrackSummary>();
    for (const t of tracks) {
        const key = `${normalizeTrackUri(t.trackUri)}:${t.targetLang}`;
        const existing = byKey.get(key);
        if (!existing || t.timestamp > existing.timestamp) {
            byKey.set(key, t);
        }
    }
    return Array.from(byKey.values()).sort((a, b) => b.timestamp - a.timestamp);
}

export function getAllCachedTracks(): CachedTrackSummary[] {
    runCacheSchemaMigration();
    const storage = getStorage();
    if (!storage) return [];
    pruneTrackCache();

    const tracks: CachedTrackSummary[] = [];
    
    const nativeStorage = typeof localStorage !== 'undefined' ? localStorage : null;
    
    if (nativeStorage) {
        try {
            for (let i = 0; i < nativeStorage.length; i++) {
                const key = nativeStorage.key(i);
                if (key && key.startsWith(CACHE_KEY_PREFIX)) {
                    try {
                        const entryStr = nativeStorage.getItem(key);
                        if (entryStr) {
                            const entry = parseTrackCacheEntry(entryStr);
                            const parsed = parseCacheKey(key);
                            if (entry && parsed) {
                                tracks.push({
                                    trackUri: parsed.trackUri,
                                    targetLang: parsed.targetLang,
                                    sourceLang: entry.lang,
                                    lineCount: entry.lines.length,
                                    timestamp: entry.timestamp,
                                    api: entry.api,
                                    trackName: entry.trackName,
                                    artistName: entry.artistName,
                                    metrics: entry.metrics
                                });
                            }
                        }
                    } catch (e) {

                    }
                }
            }
            
            if (tracks.length > 0) {
                return dedupeCachedTracks(tracks);
            }
        } catch (e) {
            warn('Failed to iterate native localStorage:', e);
        }
    }
    
    const index = getCacheIndex();
    index.trackUris.forEach(fullKey => {
        const lastColonIdx = fullKey.lastIndexOf(':');
        const uri = fullKey.substring(0, lastColonIdx);
        const lang = fullKey.substring(lastColonIdx + 1);
        const cacheKey = getCacheKey(uri, lang);
        
        try {
            const entryStr = storage.getItem(cacheKey);
            if (entryStr) {
                const entry = parseTrackCacheEntry(entryStr);
                if (!entry) return;
                tracks.push({
                    trackUri: uri,
                    targetLang: lang,
                    sourceLang: entry.lang,
                    lineCount: entry.lines.length,
                    timestamp: entry.timestamp,
                    api: entry.api,
                    trackName: entry.trackName,
                    artistName: entry.artistName,
                    metrics: entry.metrics
                });
            }
        } catch (e) {

        }
    });

    return dedupeCachedTracks(tracks);
}

export function getCurrentTrackUri(): string | null {
    try {
        if (typeof Spicetify !== 'undefined' && 
            Spicetify.Player && 
            Spicetify.Player.data && 
            Spicetify.Player.data.item &&
            Spicetify.Player.data.item.uri) {
            return Spicetify.Player.data.item.uri;
        }
    } catch (e) {
        warn('Failed to get current track URI:', e);
    }
    return null;
}

export function getCurrentTrackMeta(): { trackName?: string; artistName?: string } {
    try {
        if (typeof Spicetify !== 'undefined' &&
            Spicetify.Player &&
            Spicetify.Player.data &&
            Spicetify.Player.data.item) {
            const item = Spicetify.Player.data.item;
            return {
                trackName: item.name || undefined,
                artistName: item.artists?.map((a: { name: string }) => a.name).join(', ') || undefined
            };
        }
    } catch (e) {
        warn('Failed to get current track metadata:', e);
    }
    return {};
}

export default {
    getTrackCache,
    setTrackCache,
    hasTrackCache,
    deleteTrackCache,
    clearAllTrackCache,
    getTrackCacheStats,
    getAllCachedTracks,
    getCurrentTrackUri,
    getCurrentTrackMeta
};
