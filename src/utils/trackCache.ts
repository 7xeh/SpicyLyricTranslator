import { warn } from './debug';

const CACHE_KEY_PREFIX = 'slt-track-cache:';
const CACHE_INDEX_KEY = 'slt-track-cache-index';
const CACHE_MAX_TRACKS = 100;
const CACHE_EXPIRY_DAYS = 14;
const CACHE_EXPIRY_MS = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

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
    sourceLines?: string[]
): void {
    const storage = getStorage();
    if (!storage || !trackUri || !lines.length) return;

    pruneTrackCache();
    
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
        artistName: meta.artistName
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
        const cacheKey = getCacheKey(trackUri, targetLang);
        storage.removeItem(cacheKey);
        
        const fullKey = `${trackUri}:${targetLang}`;
        index.trackUris = index.trackUris.filter(k => k !== fullKey);
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

export function getAllCachedTracks(): Array<{
    trackUri: string;
    targetLang: string;
    sourceLang: string;
    lineCount: number;
    timestamp: number;
    api?: string;
    trackName?: string;
    artistName?: string;
}> {
    const storage = getStorage();
    if (!storage) return [];
    pruneTrackCache();
    
    const tracks: Array<{
        trackUri: string;
        targetLang: string;
        sourceLang: string;
        lineCount: number;
        timestamp: number;
        api?: string;
        trackName?: string;
        artistName?: string;
    }> = [];
    
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
                                    artistName: entry.artistName
                                });
                            }
                        }
                    } catch (e) {

                    }
                }
            }
            
            if (tracks.length > 0) {
                return tracks.sort((a, b) => b.timestamp - a.timestamp);
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
                    artistName: entry.artistName
                });
            }
        } catch (e) {

        }
    });
    
    return tracks.sort((a, b) => b.timestamp - a.timestamp);
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
