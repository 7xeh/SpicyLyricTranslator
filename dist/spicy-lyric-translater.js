"use strict";
var SpicyLyricTranslater = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/app.ts
  var app_exports = {};
  __export(app_exports, {
    default: () => app_default
  });

  // src/utils/storage.ts
  var STORAGE_PREFIX = "spicy-lyric-translator:";
  var SECRET_ENCODING_PREFIX = "b64:";
  var LEGACY_PLAINTEXT_SECRET_PREFIXES = ["AIza", "AQ.", "sk-"];
  var MAX_STORAGE_SIZE_BYTES = 4 * 1024 * 1024;
  function isLocalStorageAvailable() {
    try {
      const test = "__storage_test__";
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }
  function getStorageSize() {
    let total = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(STORAGE_PREFIX)) {
          const value = localStorage.getItem(key);
          if (value) {
            total += key.length + value.length;
          }
        }
      }
    } catch (e) {
    }
    return total * 2;
  }
  var storage = {
    get(key) {
      try {
        if (!isLocalStorageAvailable())
          return null;
        return localStorage.getItem(STORAGE_PREFIX + key);
      } catch (e) {
        console.error("[SpicyLyricTranslator] Storage get error:", e);
        return null;
      }
    },
    set(key, value) {
      try {
        if (!isLocalStorageAvailable())
          return false;
        if (value.length > 1e4) {
          const currentSize = getStorageSize();
          if (currentSize + value.length * 2 > MAX_STORAGE_SIZE_BYTES) {
            console.warn("[SpicyLyricTranslator] Storage limit approaching, clearing old cache");
            this.remove("translation-cache");
          }
        }
        localStorage.setItem(STORAGE_PREFIX + key, value);
        return true;
      } catch (e) {
        if (e instanceof DOMException && e.name === "QuotaExceededError") {
          console.warn("[SpicyLyricTranslator] Storage quota exceeded, clearing cache");
          this.remove("translation-cache");
          try {
            localStorage.setItem(STORAGE_PREFIX + key, value);
            return true;
          } catch {
            return false;
          }
        }
        console.error("[SpicyLyricTranslator] Storage set error:", e);
        return false;
      }
    },
    remove(key) {
      try {
        if (!isLocalStorageAvailable())
          return;
        localStorage.removeItem(STORAGE_PREFIX + key);
      } catch (e) {
        console.error("[SpicyLyricTranslator] Storage remove error:", e);
      }
    },
    getJSON(key, defaultValue) {
      try {
        const value = this.get(key);
        if (value === null)
          return defaultValue;
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          delete parsed.__proto__;
          delete parsed.constructor;
          delete parsed.prototype;
        }
        return parsed;
      } catch (e) {
        console.error("[SpicyLyricTranslator] Storage getJSON error:", e);
        return defaultValue;
      }
    },
    setJSON(key, value) {
      try {
        return this.set(key, JSON.stringify(value));
      } catch (e) {
        console.error("[SpicyLyricTranslator] Storage setJSON error:", e);
        return false;
      }
    },
    getStats() {
      const used = getStorageSize();
      return {
        usedBytes: used,
        maxBytes: MAX_STORAGE_SIZE_BYTES,
        percentUsed: Math.round(used / MAX_STORAGE_SIZE_BYTES * 100)
      };
    },
    clearAll() {
      try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith(STORAGE_PREFIX)) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));
      } catch (e) {
        console.error("[SpicyLyricTranslator] Storage clearAll error:", e);
      }
    },
    setSecret(key, value) {
      try {
        const encoded = btoa(unescape(encodeURIComponent(value)));
        return this.set(key, SECRET_ENCODING_PREFIX + encoded);
      } catch (e) {
        return this.set(key, value);
      }
    },
    getSecret(key) {
      try {
        const stored = this.get(key);
        if (stored === null)
          return null;
        if (stored.startsWith(SECRET_ENCODING_PREFIX)) {
          const rest = stored.slice(SECRET_ENCODING_PREFIX.length);
          try {
            return decodeURIComponent(escape(atob(rest)));
          } catch {
            return rest;
          }
        }
        if (LEGACY_PLAINTEXT_SECRET_PREFIXES.some((prefix) => stored.startsWith(prefix))) {
          return stored;
        }
        try {
          const decoded = decodeURIComponent(escape(atob(stored)));
          const reencoded = btoa(unescape(encodeURIComponent(decoded)));
          if (reencoded === stored) {
            return decoded;
          }
          return stored;
        } catch {
          return stored;
        }
      } catch (e) {
        return null;
      }
    }
  };
  var storage_default = storage;

  // src/utils/debug.ts
  var debugMode = storage.get("debug-mode") === "true";
  var TAG = "%c[SpicyLyricTranslator]";
  var TAG_STYLE = "color: #FF69B4; font-weight: bold;";
  function isDebugEnabled() {
    return debugMode;
  }
  function setDebugMode(enabled) {
    debugMode = enabled;
    storage.set("debug-mode", enabled.toString());
    if (enabled) {
      console.log(TAG, TAG_STYLE, "Debug mode enabled");
    }
  }
  function debug(...args) {
    if (debugMode) {
      console.log(TAG, TAG_STYLE, ...args);
    }
  }
  function warn(...args) {
    console.warn(TAG, TAG_STYLE, ...args);
  }
  function error(...args) {
    console.error(TAG, TAG_STYLE, ...args);
  }

  // src/utils/trackCache.ts
  var CACHE_KEY_PREFIX = "slt-track-cache:";
  var CACHE_INDEX_KEY = "slt-track-cache-index";
  var CACHE_SCHEMA_KEY = "slt-track-cache-schema";
  var CACHE_SCHEMA_VERSION = 2;
  var CACHE_MAX_TRACKS = 100;
  var CACHE_EXPIRY_DAYS = 14;
  var CACHE_EXPIRY_MS = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1e3;
  function getStorage() {
    if (typeof localStorage !== "undefined") {
      return localStorage;
    }
    return null;
  }
  var schemaMigrationRun = false;
  function runCacheSchemaMigration() {
    if (schemaMigrationRun)
      return;
    const storage2 = getStorage();
    if (!storage2) {
      schemaMigrationRun = true;
      return;
    }
    try {
      const stored = storage2.getItem(CACHE_SCHEMA_KEY);
      const storedVersion = stored ? parseInt(stored, 10) : 0;
      if (storedVersion >= CACHE_SCHEMA_VERSION) {
        schemaMigrationRun = true;
        return;
      }
      for (let i = storage2.length - 1; i >= 0; i--) {
        const key = storage2.key(i);
        if (key && key.startsWith(CACHE_KEY_PREFIX)) {
          storage2.removeItem(key);
        }
      }
      storage2.removeItem(CACHE_INDEX_KEY);
      storage2.setItem(CACHE_SCHEMA_KEY, String(CACHE_SCHEMA_VERSION));
    } catch (e) {
      warn("Track cache schema migration failed:", e);
    } finally {
      schemaMigrationRun = true;
    }
  }
  function getCacheIndex() {
    const storage2 = getStorage();
    if (!storage2)
      return { trackUris: [] };
    try {
      const indexStr = storage2.getItem(CACHE_INDEX_KEY);
      if (indexStr) {
        return JSON.parse(indexStr);
      }
    } catch (e) {
      warn("Failed to parse cache index:", e);
    }
    return { trackUris: [] };
  }
  function saveCacheIndex(index) {
    const storage2 = getStorage();
    if (!storage2)
      return;
    try {
      storage2.setItem(CACHE_INDEX_KEY, JSON.stringify(index));
    } catch (e) {
      warn("Failed to save cache index:", e);
    }
  }
  function normalizeTrackUri(uri) {
    return uri.replace(/[^a-zA-Z0-9:]/g, "_");
  }
  function getCacheKey(trackUri, targetLang) {
    return `${CACHE_KEY_PREFIX}${normalizeTrackUri(trackUri)}:${targetLang}`;
  }
  function parseFullKey(fullKey) {
    const lastColonIdx = fullKey.lastIndexOf(":");
    if (lastColonIdx <= 0 || lastColonIdx === fullKey.length - 1)
      return null;
    return {
      trackUri: fullKey.substring(0, lastColonIdx),
      targetLang: fullKey.substring(lastColonIdx + 1)
    };
  }
  function parseCacheKey(cacheKey2) {
    if (!cacheKey2.startsWith(CACHE_KEY_PREFIX))
      return null;
    return parseFullKey(cacheKey2.substring(CACHE_KEY_PREFIX.length));
  }
  function removeFullKey(storage2, fullKey) {
    const parsed = parseFullKey(fullKey);
    if (!parsed)
      return false;
    storage2.removeItem(getCacheKey(parsed.trackUri, parsed.targetLang));
    return true;
  }
  function collectNativeCacheKeys(storage2) {
    const keys = [];
    for (let i = 0; i < storage2.length; i++) {
      const key = storage2.key(i);
      if (key && key.startsWith(CACHE_KEY_PREFIX)) {
        keys.push(key);
      }
    }
    return keys;
  }
  function parseTrackCacheEntry(entryStr) {
    const entry = JSON.parse(entryStr);
    if (!entry || typeof entry.timestamp !== "number" || !Array.isArray(entry.lines)) {
      return null;
    }
    return entry;
  }
  function normalizeLanguageBase(lang) {
    return (lang || "").trim().toLowerCase().replace(/_/g, "-").split("-")[0];
  }
  function isSameCacheLanguage(sourceLang, targetLang) {
    const source = normalizeLanguageBase(sourceLang);
    const target = normalizeLanguageBase(targetLang);
    return Boolean(source && target && source === target);
  }
  function hasNonLatinScript(text3) {
    return /[\u3040-\u30FF\u4E00-\u9FFF\u3400-\u4DBF\uAC00-\uD7AF\u1100-\u11FF\u0600-\u06FF\u0590-\u05FF\u0400-\u04FF\u0E00-\u0E7F\u0900-\u097F\u0370-\u03FF]/.test(text3 || "");
  }
  function isSameLanguageNoopCache(entry, targetLang) {
    if (!isSameCacheLanguage(entry.lang, targetLang))
      return false;
    if (!entry.sourceLines || entry.sourceLines.length !== entry.lines.length)
      return false;
    return !entry.sourceLines.some((line, index) => hasNonLatinScript(line) && (entry.lines[index] || "").trim() !== line.trim());
  }
  function pruneTrackCache(maxTracks = CACHE_MAX_TRACKS) {
    const storage2 = getStorage();
    if (!storage2)
      return;
    const now = Date.now();
    const seen = /* @__PURE__ */ new Set();
    const entries = [];
    const index = getCacheIndex();
    const addEntry = (fullKey, cacheKey2) => {
      if (seen.has(fullKey))
        return;
      try {
        const entryStr = storage2.getItem(cacheKey2);
        if (!entryStr)
          return;
        const entry = parseTrackCacheEntry(entryStr);
        if (!entry || now - entry.timestamp > CACHE_EXPIRY_MS) {
          storage2.removeItem(cacheKey2);
          return;
        }
        const parsed = parseFullKey(fullKey);
        if (!parsed || isSameLanguageNoopCache(entry, parsed.targetLang)) {
          storage2.removeItem(cacheKey2);
          return;
        }
        seen.add(fullKey);
        entries.push({ fullKey, cacheKey: cacheKey2, timestamp: entry.timestamp });
      } catch (e) {
        storage2.removeItem(cacheKey2);
      }
    };
    index.trackUris.forEach((fullKey) => {
      const parsed = parseFullKey(fullKey);
      if (!parsed)
        return;
      addEntry(fullKey, getCacheKey(parsed.trackUri, parsed.targetLang));
    });
    collectNativeCacheKeys(storage2).forEach((cacheKey2) => {
      const parsed = parseCacheKey(cacheKey2);
      if (!parsed) {
        storage2.removeItem(cacheKey2);
        return;
      }
      addEntry(`${parsed.trackUri}:${parsed.targetLang}`, cacheKey2);
    });
    entries.sort((a, b) => a.timestamp - b.timestamp);
    const removeCount = Math.max(0, entries.length - maxTracks);
    if (removeCount > 0) {
      entries.slice(0, removeCount).forEach((entry) => {
        storage2.removeItem(entry.cacheKey);
      });
    }
    saveCacheIndex({
      trackUris: entries.slice(removeCount).map((entry) => entry.fullKey)
    });
  }
  function getTrackCache(trackUri, targetLang) {
    runCacheSchemaMigration();
    const storage2 = getStorage();
    if (!storage2 || !trackUri)
      return null;
    const cacheKey2 = getCacheKey(trackUri, targetLang);
    try {
      const entryStr = storage2.getItem(cacheKey2);
      if (!entryStr)
        return null;
      const entry = parseTrackCacheEntry(entryStr);
      if (!entry) {
        storage2.removeItem(cacheKey2);
        pruneTrackCache();
        return null;
      }
      if (Date.now() - entry.timestamp > CACHE_EXPIRY_MS) {
        storage2.removeItem(cacheKey2);
        pruneTrackCache();
        return null;
      }
      if (isSameLanguageNoopCache(entry, targetLang)) {
        storage2.removeItem(cacheKey2);
        pruneTrackCache();
        return null;
      }
      return entry;
    } catch (e) {
      warn("Failed to read track cache:", e);
      return null;
    }
  }
  function setTrackCache(trackUri, targetLang, sourceLang, lines, api, sourceFingerprint, trackName, artistName, sourceLines, metrics) {
    runCacheSchemaMigration();
    const storage2 = getStorage();
    if (!storage2 || !trackUri || !lines.length)
      return;
    const cacheKey2 = getCacheKey(trackUri, targetLang);
    const meta = trackName ? { trackName, artistName } : getCurrentTrackMeta();
    const entry = {
      lang: sourceLang,
      targetLang,
      lines,
      sourceLines,
      timestamp: Date.now(),
      api,
      sourceFingerprint,
      trackName: meta.trackName,
      artistName: meta.artistName,
      metrics: metrics && (metrics.model || metrics.durationMs || metrics.totalTokens || metrics.apiCalls) ? metrics : void 0
    };
    try {
      storage2.setItem(cacheKey2, JSON.stringify(entry));
      const index = getCacheIndex();
      const fullKey = `${trackUri}:${targetLang}`;
      index.trackUris = index.trackUris.filter((k) => k !== fullKey);
      index.trackUris.push(fullKey);
      saveCacheIndex(index);
      pruneTrackCache();
    } catch (e) {
      warn("Failed to set track cache:", e);
      if (e instanceof Error && e.name === "QuotaExceededError") {
        pruneOldestEntries(10);
        try {
          storage2.setItem(cacheKey2, JSON.stringify(entry));
          const index = getCacheIndex();
          const fullKey = `${trackUri}:${targetLang}`;
          index.trackUris = index.trackUris.filter((k) => k !== fullKey);
          index.trackUris.push(fullKey);
          saveCacheIndex(index);
          pruneTrackCache();
        } catch (retryError) {
          warn("Still failed after pruning:", retryError);
        }
      }
    }
  }
  function updateTrackCacheLines(trackUri, targetLang, lines) {
    runCacheSchemaMigration();
    const storage2 = getStorage();
    if (!storage2 || !trackUri || !lines.length)
      return false;
    const existing = getTrackCache(trackUri, targetLang);
    if (!existing)
      return false;
    const entry = { ...existing, lines, edited: true };
    try {
      storage2.setItem(getCacheKey(trackUri, targetLang), JSON.stringify(entry));
      return true;
    } catch (e) {
      warn("Failed to update track cache lines:", e);
      return false;
    }
  }
  function deleteTrackCache(trackUri, targetLang) {
    const storage2 = getStorage();
    if (!storage2 || !trackUri)
      return;
    const index = getCacheIndex();
    if (targetLang) {
      const normWanted = normalizeTrackUri(trackUri);
      storage2.removeItem(getCacheKey(trackUri, targetLang));
      collectNativeCacheKeys(storage2).forEach((key) => {
        const parsed = parseCacheKey(key);
        if (parsed && parsed.targetLang === targetLang && normalizeTrackUri(parsed.trackUri) === normWanted) {
          storage2.removeItem(key);
        }
      });
      index.trackUris = index.trackUris.filter((fullKey) => {
        const p = parseFullKey(fullKey);
        return !(p && p.targetLang === targetLang && normalizeTrackUri(p.trackUri) === normWanted);
      });
    } else {
      const keysToRemove = index.trackUris.filter((k) => k.startsWith(trackUri + ":"));
      keysToRemove.forEach((k) => {
        removeFullKey(storage2, k);
      });
      const nativePrefix = `${CACHE_KEY_PREFIX}${normalizeTrackUri(trackUri)}:`;
      collectNativeCacheKeys(storage2).forEach((key) => {
        if (key.startsWith(nativePrefix)) {
          storage2.removeItem(key);
        }
      });
      index.trackUris = index.trackUris.filter((k) => !k.startsWith(trackUri + ":"));
    }
    saveCacheIndex(index);
  }
  function pruneOldestEntries(count) {
    const storage2 = getStorage();
    if (!storage2)
      return;
    const index = getCacheIndex();
    const toRemove = index.trackUris.splice(0, count);
    toRemove.forEach((fullKey) => {
      removeFullKey(storage2, fullKey);
    });
    saveCacheIndex(index);
  }
  function clearAllTrackCache() {
    const storage2 = getStorage();
    if (!storage2)
      return;
    const index = getCacheIndex();
    index.trackUris.forEach((fullKey) => {
      removeFullKey(storage2, fullKey);
    });
    collectNativeCacheKeys(storage2).forEach((key) => storage2.removeItem(key));
    storage2.removeItem(CACHE_INDEX_KEY);
  }
  function getTrackCacheStats() {
    const storage2 = getStorage();
    if (!storage2)
      return { trackCount: 0, totalLines: 0, oldestTimestamp: null, sizeBytes: 0 };
    pruneTrackCache();
    let trackCount = 0;
    let totalLines = 0;
    let oldestTimestamp = null;
    let sizeBytes = 0;
    const nativeStorage = typeof localStorage !== "undefined" ? localStorage : null;
    if (nativeStorage) {
      try {
        const keys = [];
        for (let i = 0; i < nativeStorage.length; i++) {
          const key = nativeStorage.key(i);
          if (key && key.startsWith(CACHE_KEY_PREFIX)) {
            keys.push(key);
          }
        }
        trackCount = keys.length;
        keys.forEach((key) => {
          try {
            const entryStr = nativeStorage.getItem(key);
            if (entryStr) {
              sizeBytes += entryStr.length * 2;
              const entry = parseTrackCacheEntry(entryStr);
              if (!entry)
                return;
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
        warn("Failed to iterate native localStorage:", e);
      }
    }
    const index = getCacheIndex();
    index.trackUris.forEach((fullKey) => {
      const lastColonIdx = fullKey.lastIndexOf(":");
      const uri = fullKey.substring(0, lastColonIdx);
      const lang = fullKey.substring(lastColonIdx + 1);
      const cacheKey2 = getCacheKey(uri, lang);
      try {
        const entryStr = storage2.getItem(cacheKey2);
        if (entryStr) {
          trackCount++;
          sizeBytes += entryStr.length * 2;
          const entry = parseTrackCacheEntry(entryStr);
          if (!entry)
            return;
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
  function dedupeCachedTracks(tracks) {
    const byKey = /* @__PURE__ */ new Map();
    for (const t of tracks) {
      const key = `${normalizeTrackUri(t.trackUri)}:${t.targetLang}`;
      const existing = byKey.get(key);
      if (!existing || t.timestamp > existing.timestamp) {
        byKey.set(key, t);
      }
    }
    return Array.from(byKey.values()).sort((a, b) => b.timestamp - a.timestamp);
  }
  function getAllCachedTracks() {
    runCacheSchemaMigration();
    const storage2 = getStorage();
    if (!storage2)
      return [];
    pruneTrackCache();
    const tracks = [];
    const nativeStorage = typeof localStorage !== "undefined" ? localStorage : null;
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
        warn("Failed to iterate native localStorage:", e);
      }
    }
    const index = getCacheIndex();
    index.trackUris.forEach((fullKey) => {
      const lastColonIdx = fullKey.lastIndexOf(":");
      const uri = fullKey.substring(0, lastColonIdx);
      const lang = fullKey.substring(lastColonIdx + 1);
      const cacheKey2 = getCacheKey(uri, lang);
      try {
        const entryStr = storage2.getItem(cacheKey2);
        if (entryStr) {
          const entry = parseTrackCacheEntry(entryStr);
          if (!entry)
            return;
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
  function getCurrentTrackUri() {
    try {
      if (typeof Spicetify !== "undefined" && Spicetify.Player && Spicetify.Player.data && Spicetify.Player.data.item && Spicetify.Player.data.item.uri) {
        return Spicetify.Player.data.item.uri;
      }
    } catch (e) {
      warn("Failed to get current track URI:", e);
    }
    return null;
  }
  function getCurrentTrackMeta() {
    try {
      if (typeof Spicetify !== "undefined" && Spicetify.Player && Spicetify.Player.data && Spicetify.Player.data.item) {
        const item = Spicetify.Player.data.item;
        return {
          trackName: item.name || void 0,
          artistName: item.artists?.map((a) => a.name).join(", ") || void 0
        };
      }
    } catch (e) {
      warn("Failed to get current track metadata:", e);
    }
    return {};
  }

  // src/utils/languageDetection.ts
  var detectionCache = /* @__PURE__ */ new Map();
  var DETECTION_CACHE_TTL = 30 * 60 * 1e3;
  var LANGUAGE_PATTERNS = [
    { code: "zh", scripts: /[\u4E00-\u9FFF\u3400-\u4DBF]/ },
    { code: "ja", scripts: /[\u3040-\u30FF]/ },
    { code: "ko", scripts: /[\uAC00-\uD7AF\u1100-\u11FF]/ },
    { code: "ar", scripts: /[\u0600-\u06FF]/ },
    { code: "he", scripts: /[\u0590-\u05FF]/ },
    { code: "ru", scripts: /[\u0400-\u04FF]/ },
    { code: "th", scripts: /[\u0E00-\u0E7F]/ },
    { code: "hi", scripts: /[\u0900-\u097F]/ },
    { code: "el", scripts: /[\u0370-\u03FF]/ }
  ];
  var LATIN_LANGUAGE_WORDS = [
    { code: "es", words: ["el", "la", "los", "las", "que", "de", "en", "un", "una", "es", "no", "por", "con", "para", "como", "pero", "m\xE1s", "yo", "tu", "mi", "muy", "hay", "donde", "cuando", "siempre", "nunca", "todo", "nada", "sin", "sobre", "soy", "estoy", "tengo", "aqu\xED", "porque", "te", "se", "le", "nos", "ya", "del", "al"] },
    { code: "fr", words: ["le", "la", "les", "de", "et", "en", "un", "une", "est", "que", "je", "tu", "il", "elle", "nous", "vous", "ne", "pas", "pour", "avec", "mais", "aussi", "tr\xE8s", "mon", "ton", "son", "mes", "ses", "sur", "dans", "qui", "au", "du", "des", "ce", "cette", "\xE7a"] },
    { code: "de", words: ["der", "die", "das", "und", "ist", "ich", "du", "er", "sie", "wir", "ihr", "nicht", "ein", "eine", "mit", "auf", "f\xFCr", "von", "auch", "noch", "nur", "sehr", "wie", "doch", "dann", "nein", "ja", "wenn", "mein", "dein", "sein", "kein"] },
    { code: "pt", words: ["o", "a", "os", "as", "de", "que", "e", "em", "um", "uma", "\xE9", "n\xE3o", "eu", "tu", "ele", "ela", "n\xF3s", "voc\xEA", "com", "para", "meu", "seu", "muito", "bem", "sim", "aqui", "agora", "onde", "quando", "sempre", "tamb\xE9m", "porque", "mais", "nunca", "tudo", "nada", "sem"] },
    { code: "it", words: ["il", "la", "lo", "gli", "le", "di", "che", "e", "un", "una", "\xE8", "non", "io", "tu", "lui", "lei", "noi", "voi", "con", "per", "anche", "ancora", "molto", "bene", "quando", "dove", "sempre", "mai", "tutto", "mio", "mia", "tuo", "suo"] },
    { code: "nl", words: ["de", "het", "een", "en", "van", "is", "dat", "op", "te", "in", "voor", "niet", "met", "zijn", "maar", "ook", "als", "dit"] },
    { code: "pl", words: ["i", "w", "na", "nie", "do", "to", "\u017Ce", "co", "jest", "si\u0119", "ja", "ty", "on", "my", "wy", "ale", "jak", "tak", "dalej", "sk\u0105d", "niby", "z\u0142o", "b\xF3l", "n\xF3\u017C", "da\u0107", "gar\u015B\u0107", "nigdy", "we", "nikt", "kolejny", "raz", "boli", "mnie", "wiesz", "dosi\u0119gnie", "moja", "psychika", "zabija", "ostry", "wezm\u0119", "lek\xF3w", "chcia\u0142abym", "nic", "czu\u0107", "b\u0119d\u0119", "pod", "go\u0142ym", "niebem", "gwiazd", "mie\u0107", "ju\u017C", "\u017Cadnych", "ran", "przy", "sko\u0144czysz", "ca\u0142a", "\u0142zach"] },
    { code: "lt", words: ["\u012F", "n\u0117ra", "\u010Dia", "ta\u010Diau", "kod\u0117l", "tod\u0117l", "ka\u017Ekas", "sutrikimas", "\u017Emogus", "\u0161irdis", "meil\u0117", "\u017Emon\u0117s", "gyvenimas", "akys", "rankos", "namuose", "namas", "namai", "namie", "i\u0161", "rytoj", "ryt", "\u0161iandien", "niekada", "visada", "atrodo", "kalb\u0117ti", "nebegaliu", "li\u016Bdna", "li\u016Bdnas", "skausmas", "neb\u0117ra", "kai", "kaip", "bybis", "byb\u012F", "dabar", "\u017Eodis", "\u017Eod\u017Eiai", "noriu"] },
    { code: "lv", words: ["un", "ir", "nav", "ja", "kas", "k\u0101", "t\u0101", "tas", "\u0161is", "\u0161\u012B", "pa", "uz", "ar", "par", "bet", "vai", "n\u0113", "j\u0101", "man", "mans", "mana", "man\u0101", "tev", "tevs", "tavs", "tava", "tevi", "mani", "mums", "jums", "vi\u0146\u0161", "vi\u0146a", "vi\u0146i", "m\u0113s", "j\u016Bs", "tikai", "ar\u012B", "v\u0113l", "jau", "tagad", "kur", "kad", "k\u0101p\u0113c", "viss", "visi", "labi", "labie", "labs", "esi", "esmu", "b\u016Bt", "b\u016Bs", "biju", "sirds", "m\u012Blu", "dz\u012Bve", "nees", "\u010Doms", "pus\u0113"] },
    { code: "sv", words: ["och", "att", "det", "som", "den", "\xE4r", "av", "f\xF6r", "med", "till", "har", "inte", "om", "ett", "men", "jag", "du", "ni", "vi", "han", "hon", "var", "sig", "fr\xE5n", "n\xE4r", "efter", "kan", "ska", "skulle", "\xE4n", "h\xE4r", "d\xE4r", "nu", "s\xE5", "vad", "vem", "hur", "varf\xF6r", "mig", "dig", "din", "ditt", "min", "mitt", "oss", "dem", "aldrig", "alltid", "bara", "hela", "igen", "ingen", "inget", "inga", "ingenting", "n\xE5got", "n\xE5gon", "alla", "allt", "vill", "ville", "kommer", "kom", "gick", "blir", "blev", "s\xE4ger", "vet", "tror", "k\xE4nner", "saknar", "hem", "\xF6ver", "under", "mot", "utan", "genom", "eller", "ocks\xE5", "\xE4nd\xE5", "kanske", "hj\xE4rta", "hj\xE4rtat", "k\xE4rlek", "natt", "natten", "dag", "dagen", "liv", "livet", "v\xE4rld", "v\xE4rlden", "tid", "tiden", "\xF6gon", "\xF6gonen", "ser", "g\xE5r", "f\xE5r", "g\xF6r", "st\xE5r", "h\xE5ller", "sedan", "bort", "borta", "tillbaka", "tyst"] },
    { code: "da", words: ["og", "det", "til", "som", "p\xE5", "de", "med", "af", "ikke", "der", "var", "mig", "men", "har", "om", "vi", "min", "mit", "havde", "ham", "hun", "nu", "da", "fra", "du", "ud", "sig", "n\xE5r", "v\xE6ret", "hvor", "hvad", "hvem", "hvorfor", "jeg", "dig", "kan", "skal", "ved", "hjerte", "hjertet", "k\xE6rlighed", "aldrig", "altid", "bare", "noget", "nogen", "ingen", "igen", "\xF8jne", "nat", "natten", "liv", "livet", "verden", "tid", "tiden", "alt", "alle", "meget", "s\xE5dan", "tilbage", "hjem", "selv", "dem", "jer", "deres", "denne", "dette", "sammen", "kun", "ogs\xE5", "eller", "uden", "gennem", "over", "under", "mod", "siger", "kommer", "blev", "bliver"] },
    { code: "no", words: ["og", "det", "den", "til", "som", "p\xE5", "de", "med", "av", "ikke", "ikkje", "der", "s\xE5", "var", "meg", "seg", "men", "har", "om", "vi", "min", "mitt", "hadde", "hun", "n\xE5", "over", "da", "ved", "fra", "du", "ut", "dem", "oss", "opp", "n\xE5r", "hvor", "hvem", "hva", "hvorfor", "jeg", "deg", "skal", "kan", "vil", "ville", "kommer", "kom", "gikk", "blir", "ble", "sier", "vet", "tror", "hjerte", "hjertet", "kj\xE6rlighet", "aldri", "alltid", "bare", "noe", "noen", "ingen", "ingenting", "igjen", "\xF8yne", "natt", "natten", "liv", "livet", "verden", "tid", "tiden", "alt", "alle", "mye", "slik", "tilbake", "hjem", "selv", "deres", "denne", "dette", "sammen", "ogs\xE5", "eller", "uten", "gjennom", "under", "mot", "borte", "stille"] },
    { code: "fi", words: ["ett\xE4", "mutta", "kun", "niin", "vain", "my\xF6s", "viel\xE4", "nyt", "sitten", "t\xE4ss\xE4", "siell\xE4", "t\xE4\xE4ll\xE4", "miss\xE4", "mit\xE4", "miksi", "kuinka", "kuka", "min\xE4", "sin\xE4", "h\xE4n", "me", "te", "he", "olen", "olet", "olemme", "ovat", "oli", "ollut", "olla", "syd\xE4n", "syd\xE4men", "rakkaus", "rakastan", "y\xF6", "y\xF6n", "y\xF6ss\xE4", "p\xE4iv\xE4", "p\xE4iv\xE4n", "el\xE4m\xE4", "el\xE4m\xE4n", "maailma", "maailman", "aika", "ajan", "silm\xE4t", "silmien", "kaikki", "kaiken", "mit\xE4\xE4n", "kukaan", "ilman", "kanssa", "kautta", "takaisin", "koti", "kotiin", "tule", "tulee", "menee", "sanoi", "tied\xE4n", "uskon", "muista", "muistan", "en\xE4\xE4", "aina", "koskaan", "j\xE4lkeen", "yksin", "pois"] },
    { code: "hi", words: ["hai", "hain", "hoon", "tha", "thi", "nahi", "nahin", "kya", "kaise", "kaisa", "kaisi", "kahan", "kyun", "kab", "mera", "meri", "tera", "teri", "tere", "tumhara", "hamara", "apna", "apni", "apne", "tujhe", "mujhe", "mujhko", "tujhko", "tumhe", "hume", "unhe", "isko", "usko", "uski", "iski", "iske", "uske", "dil", "pyar", "ishq", "mohabbat", "zindagi", "duniya", "sapna", "sapne", "raat", "din", "aankh", "aankhein", "ankhiyo", "nazar", "waqt", "gham", "khushi", "dard", "rang", "dhoop", "chand", "sitara", "dekho", "dekh", "dekhna", "suno", "sun", "sunna", "bolo", "bol", "bolna", "chalo", "chal", "chalna", "jao", "jana", "aao", "aaja", "aana", "karo", "karna", "milna", "mila", "milo", "ruk", "ruko", "rukna", "jeena", "jee", "nach", "nachle", "gaana", "gana", "bajao", "baja", "dikha", "dikhao", "dikhaa", "parda", "nakhre", "mein", "pe", "par", "wala", "wali", "wale", "bhi", "aur", "lekin", "magar", "phir", "abhi", "kabhi", "hamesha", "humesha", "sirf", "bas", "bahut", "bohot", "zyada", "kuch", "sab", "koi", "kaun", "yahan", "wahan", "udhar", "idhar", "accha", "acha", "theek", "bilkul", "zaroor", "sach", "jhooth", "alag", "saath", "mann", "mehboob", "dilbar", "sanam", "jannat", "husn", "jaane", "jaana", "toh", "se", "ke", "ka", "ki", "ko", "ne", "tu", "hum", "tum", "main", "yeh", "woh", "ab", "jab", "tab", "agar", "mat", "ya"] },
    { code: "en", words: ["the", "a", "an", "is", "are", "was", "were", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "i", "you", "he", "she", "it", "we", "they", "me", "my", "your", "his", "her", "our", "their", "do", "did", "not", "no", "have", "has", "had", "be", "been", "will", "would", "can", "could", "just", "like", "so", "this", "that", "what", "when", "how", "all", "if", "there", "them", "from", "about", "up", "out", "know", "only", "into", "than", "then", "its", "who", "which", "more", "some", "these", "those", "here"] }
  ];
  var LATIN_LANGUAGE_WORD_SETS = LATIN_LANGUAGE_WORDS.map((lang) => ({
    code: lang.code,
    words: new Set(lang.words)
  }));
  var HAN_VARIANT_PAIRS = [
    "\u7231\u611B",
    "\u8BF4\u8AAA",
    "\u7EE7\u7E7C",
    "\u7EED\u7E8C",
    "\u4EEC\u5011",
    "\u8FD9\u9019",
    "\u65F6\u6642",
    "\u56FD\u570B",
    "\u5B66\u5B78",
    "\u4F1A\u6703",
    "\u6765\u4F86",
    "\u5BF9\u5C0D",
    "\u4E2A\u500B",
    "\u73B0\u73FE",
    "\u957F\u9577",
    "\u95EE\u554F",
    "\u89C1\u898B",
    "\u5F00\u958B",
    "\u5173\u95DC",
    "\u95E8\u9580",
    "\u65E0\u7121",
    "\u4E3A\u70BA",
    "\u8FD8\u9084",
    "\u8FC7\u904E",
    "\u4ECE\u5F9E",
    "\u8BA9\u8B93",
    "\u8BF7\u8ACB",
    "\u8C01\u8AB0",
    "\u8BDD\u8A71",
    "\u8BED\u8A9E",
    "\u8C22\u8B1D",
    "\u8BE5\u8A72",
    "\u8BB0\u8A18",
    "\u8BA4\u8A8D",
    "\u8BC6\u8B58",
    "\u8BB2\u8B1B",
    "\u8BBA\u8AD6",
    "\u8BD5\u8A66",
    "\u8BC9\u8A34",
    "\u8BCD\u8A5E",
    "\u8BFB\u8B80",
    "\u8BFE\u8AB2",
    "\u8C08\u8AC7",
    "\u8BB8\u8A31",
    "\u8BAE\u8B70",
    "\u53D8\u8B8A",
    "\u7535\u96FB",
    "\u8F66\u8ECA",
    "\u4E1C\u6771",
    "\u9A6C\u99AC",
    "\u9E1F\u9CE5",
    "\u9C7C\u9B5A",
    "\u9F99\u9F8D",
    "\u5934\u982D",
    "\u4E70\u8CB7",
    "\u5356\u8CE3",
    "\u4E07\u842C",
    "\u4E0E\u8207",
    "\u4E1A\u696D",
    "\u4E3D\u9E97",
    "\u4E3E\u8209",
    "\u4E49\u7FA9",
    "\u4E50\u6A02",
    "\u4E60\u7FD2",
    "\u4E66\u66F8",
    "\u4EB2\u89AA",
    "\u4EA7\u7522",
    "\u4F17\u773E",
    "\u4F18\u512A",
    "\u4F20\u50B3",
    "\u4F24\u50B7",
    "\u4F53\u9AD4",
    "\u4EF7\u50F9",
    "\u513F\u5152",
    "\u515A\u9EE8",
    "\u5185\u5167",
    "\u519B\u8ECD",
    "\u519C\u8FB2",
    "\u51B3\u6C7A",
    "\u51C0\u6DE8",
    "\u51CF\u6E1B",
    "\u51E4\u9CF3",
    "\u5904\u8655",
    "\u5907\u5099",
    "\u591F\u5920",
    "\u590D\u5FA9",
    "\u5B9E\u5BE6",
    "\u5B81\u5BE7",
    "\u5B9D\u5BF6",
    "\u5BFB\u5C0B",
    "\u5BFC\u5C0E",
    "\u5C81\u6B72",
    "\u5F52\u6B78",
    "\u5F53\u7576",
    "\u5C3D\u76E1",
    "\u5C42\u5C64",
    "\u5C5E\u5C6C",
    "\u5C9B\u5CF6",
    "\u5E08\u5E2B",
    "\u5E26\u5E36",
    "\u5E2E\u5E6B",
    "\u5E7F\u5EE3",
    "\u5E94\u61C9",
    "\u5E86\u6176",
    "\u5F20\u5F35",
    "\u5F55\u9304",
    "\u5F7B\u5FB9",
    "\u5F84\u5F91",
    "\u5FC6\u61B6",
    "\u5FE7\u6182",
    "\u6000\u61F7",
    "\u6001\u614B",
    "\u603B\u7E3D",
    "\u604B\u6200",
    "\u60CA\u9A5A",
    "\u60E7\u61FC",
    "\u60EF\u6163",
    "\u6218\u6230",
    "\u6237\u6236",
    "\u626B\u6383",
    "\u6267\u57F7",
    "\u6269\u64F4",
    "\u626C\u63DA",
    "\u62E9\u64C7",
    "\u62A5\u5831",
    "\u62C5\u64D4",
    "\u62DF\u64EC",
    "\u6302\u639B",
    "\u6325\u63EE",
    "\u6362\u63DB",
    "\u636E\u64DA",
    "\u635F\u640D",
    "\u6446\u64FA",
    "\u6444\u651D",
    "\u6743\u6B0A",
    "\u6740\u6BBA",
    "\u6761\u689D",
    "\u6781\u6975",
    "\u6784\u69CB",
    "\u67AA\u69CD",
    "\u6807\u6A19",
    "\u6811\u6A39",
    "\u6837\u6A23",
    "\u68C0\u6AA2",
    "\u697C\u6A13",
    "\u6B22\u6B61",
    "\u6B27\u6B50",
    "\u6C14\u6C23",
    "\u6C49\u6F22",
    "\u6C64\u6E6F",
    "\u6C9F\u6E9D",
    "\u6CA1\u6C92",
    "\u6CEA\u6DDA",
    "\u6D01\u6F54",
    "\u6D4B\u6E2C",
    "\u6D4E\u6FDF",
    "\u6D4F\u700F",
    "\u6D8C\u6E67",
    "\u6DA6\u6F64",
    "\u6DA8\u6F32",
    "\u6E10\u6F38",
    "\u6E29\u6EAB",
    "\u6E7E\u7063",
    "\u6EE1\u6EFF",
    "\u6EE8\u6FF1",
    "\u6EE4\u6FFE",
    "\u6EDA\u6EFE",
    "\u706D\u6EC5",
    "\u706F\u71C8",
    "\u7075\u9748",
    "\u707E\u707D",
    "\u70E6\u7169",
    "\u70ED\u71B1",
    "\u7237\u723A",
    "\u7275\u727D",
    "\u72B9\u7336",
    "\u72EC\u7368",
    "\u72EE\u7345",
    "\u732A\u8C6C",
    "\u732E\u737B",
    "\u739B\u746A",
    "\u73AF\u74B0",
    "\u743C\u74CA",
    "\u7597\u7642",
    "\u75AF\u760B",
    "\u76B1\u76BA",
    "\u76D8\u76E4",
    "\u7741\u775C",
    "\u7792\u779E",
    "\u7801\u78BC",
    "\u786E\u78BA",
    "\u7840\u790E",
    "\u793C\u79AE",
    "\u7978\u798D",
    "\u79BB\u96E2",
    "\u79CD\u7A2E",
    "\u79EF\u7A4D",
    "\u79F0\u7A31",
    "\u7A33\u7A69",
    "\u7A77\u7AAE",
    "\u7ADE\u7AF6",
    "\u7B14\u7B46",
    "\u7B80\u7C21",
    "\u7C7B\u985E",
    "\u7CAE\u7CE7",
    "\u7D27\u7DCA",
    "\u7EAA\u7D00",
    "\u7EAF\u7D14",
    "\u7EB2\u7DB1",
    "\u7EB3\u7D0D",
    "\u7EB8\u7D19",
    "\u7EA7\u7D1A",
    "\u7EB7\u7D1B",
    "\u7EBF\u7DDA",
    "\u7EC4\u7D44",
    "\u7EC6\u7D30",
    "\u7EC7\u7E54",
    "\u7EC8\u7D42",
    "\u7ECF\u7D93",
    "\u7ED3\u7D50",
    "\u7ED5\u7E5E",
    "\u7ED9\u7D66",
    "\u7EDC\u7D61",
    "\u7EDD\u7D55",
    "\u7EDF\u7D71",
    "\u7EE9\u7E3E",
    "\u7EEA\u7DD2",
    "\u7EFF\u7DA0",
    "\u7F13\u7DE9",
    "\u7F16\u7DE8",
    "\u7F18\u7DE3",
    "\u7F29\u7E2E",
    "\u7F51\u7DB2",
    "\u7F57\u7F85",
    "\u7F5A\u7F70",
    "\u806A\u8070",
    "\u8054\u806F",
    "\u58F0\u8072",
    "\u80A0\u8178",
    "\u80A4\u819A",
    "\u80DC\u52DD",
    "\u8111\u8166",
    "\u8138\u81C9",
    "\u814A\u81D8",
    "\u8230\u8266",
    "\u8270\u8271",
    "\u8282\u7BC0",
    "\u82A6\u8606",
    "\u82CF\u8607",
    "\u836F\u85E5",
    "\u8363\u69AE",
    "\u83B1\u840A",
    "\u83B7\u7372",
    "\u8425\u71DF",
    "\u8427\u856D",
    "\u84DD\u85CD",
    "\u8651\u616E",
    "\u867D\u96D6",
    "\u8680\u8755",
    "\u8721\u881F",
    "\u8865\u88DC",
    "\u88C5\u88DD",
    "\u89C2\u89C0",
    "\u89C9\u89BA",
    "\u89E6\u89F8",
    "\u8BA1\u8A08",
    "\u8BA2\u8A02",
    "\u8BA8\u8A0E",
    "\u8BAD\u8A13",
    "\u8BAF\u8A0A",
    "\u8BBE\u8A2D",
    "\u8BBF\u8A2A",
    "\u8BC1\u8B49",
    "\u8BC4\u8A55",
    "\u8BD1\u8B6F",
    "\u8BD7\u8A69",
    "\u8BDA\u8AA0",
    "\u8BE2\u8A62",
    "\u8BE6\u8A73",
    "\u8BEF\u8AA4",
    "\u8BF8\u8AF8",
    "\u8C03\u8ABF",
    "\u8C0A\u8ABC",
    "\u8C0B\u8B00",
    "\u8C0E\u8B0A",
    "\u8C23\u8B20",
    "\u8C31\u8B5C",
    "\u8D1D\u8C9D",
    "\u8D1F\u8CA0",
    "\u8D1E\u8C9E",
    "\u8D22\u8CA1",
    "\u8D23\u8CAC",
    "\u8D24\u8CE2",
    "\u8D25\u6557",
    "\u8D27\u8CA8",
    "\u8D28\u8CEA",
    "\u8D29\u8CA9",
    "\u8D2A\u8CAA",
    "\u8D2B\u8CA7",
    "\u8D2D\u8CFC",
    "\u8D2F\u8CAB",
    "\u8D31\u8CE4",
    "\u8D34\u8CBC",
    "\u8D35\u8CB4",
    "\u8D38\u8CBF",
    "\u8D39\u8CBB",
    "\u8D3A\u8CC0",
    "\u8D4B\u8CE6",
    "\u8D4C\u8CED",
    "\u8D4F\u8CDE",
    "\u8D50\u8CDC",
    "\u8D54\u8CE0",
    "\u8D5B\u8CFD",
    "\u8D60\u8D08",
    "\u8D62\u8D0F",
    "\u8D75\u8D99",
    "\u8D8B\u8DA8",
    "\u8DC3\u8E8D",
    "\u8DF5\u8E10",
    "\u8F68\u8ECC",
    "\u8F6C\u8F49",
    "\u8F6E\u8F2A",
    "\u8F6F\u8EDF",
    "\u8F7B\u8F15",
    "\u8F7D\u8F09",
    "\u8F83\u8F03",
    "\u8F85\u8F14",
    "\u8F86\u8F1B",
    "\u8F88\u8F29",
    "\u8F89\u8F1D",
    "\u8F93\u8F38",
    "\u8F9E\u8FAD",
    "\u8FB9\u908A",
    "\u8FBE\u9054",
    "\u8FC1\u9077",
    "\u8FD0\u904B",
    "\u8FDB\u9032",
    "\u8FDC\u9060",
    "\u8FDD\u9055",
    "\u8FDE\u9023",
    "\u8FDF\u9072",
    "\u9002\u9069",
    "\u9009\u9078",
    "\u900A\u905C",
    "\u9012\u905E",
    "\u903B\u908F",
    "\u9057\u907A",
    "\u9093\u9127",
    "\u90D1\u912D",
    "\u90AE\u90F5",
    "\u9171\u91AC",
    "\u91CA\u91CB",
    "\u949F\u9418",
    "\u94A2\u92FC",
    "\u94B1\u9322",
    "\u94C1\u9435",
    "\u94C3\u9234",
    "\u94F6\u9280",
    "\u9501\u9396",
    "\u9505\u934B",
    "\u9519\u932F",
    "\u9526\u9326",
    "\u952E\u9375",
    "\u955C\u93E1",
    "\u95EA\u9583",
    "\u95ED\u9589",
    "\u95EF\u95D6",
    "\u95F4\u9593",
    "\u95F7\u60B6",
    "\u95F9\u9B27",
    "\u95FB\u805E",
    "\u9605\u95B1",
    "\u9614\u95CA",
    "\u961F\u968A",
    "\u9636\u968E",
    "\u9633\u967D",
    "\u9634\u9670",
    "\u9646\u9678",
    "\u9648\u9673",
    "\u9669\u96AA",
    "\u968F\u96A8",
    "\u9690\u96B1",
    "\u96BE\u96E3",
    "\u96FE\u9727",
    "\u9759\u975C",
    "\u97E9\u97D3",
    "\u9875\u9801",
    "\u9876\u9802",
    "\u9879\u9805",
    "\u987A\u9806",
    "\u987B\u9808",
    "\u987E\u9867",
    "\u987F\u9813",
    "\u9884\u9810",
    "\u9886\u9818",
    "\u989C\u984F",
    "\u9897\u9846",
    "\u9898\u984C",
    "\u98A4\u986B",
    "\u98CE\u98A8",
    "\u98D8\u98C4",
    "\u98DE\u98DB",
    "\u996D\u98EF",
    "\u996E\u98F2",
    "\u9970\u98FE",
    "\u9971\u98FD",
    "\u997F\u9913",
    "\u9986\u9928",
    "\u9A71\u9A45",
    "\u9A76\u99DB",
    "\u9A7E\u99D5",
    "\u9A8C\u9A57",
    "\u9A97\u9A19",
    "\u9A84\u9A55",
    "\u9AC5\u9ACF",
    "\u9C9C\u9BAE",
    "\u9E21\u96DE",
    "\u9E23\u9CF4",
    "\u9E3F\u9D3B",
    "\u9E45\u9D5D",
    "\u9E70\u9DF9",
    "\u9EA6\u9EA5",
    "\u9EC4\u9EC3",
    "\u9F50\u9F4A",
    "\u9F7F\u9F52",
    "\u9F84\u9F61",
    "\u9F9F\u9F9C",
    "\u53D1\u767C"
  ];
  var SIMPLIFIED_ONLY_CHARS = new Set(HAN_VARIANT_PAIRS.map((pair) => pair[0]));
  var TRADITIONAL_ONLY_CHARS = new Set(HAN_VARIANT_PAIRS.map((pair) => pair[1]));
  var CHINESE_SIMPLIFIED = "zh-Hans";
  var CHINESE_TRADITIONAL = "zh-Hant";
  var CHINESE_UNDETERMINED = "zh-Hani";
  var LANGUAGE_NAME_TO_CODE = {
    "chinese (simplified)": "zh-hans",
    "chinese (traditional)": "zh-hant",
    "chinese simplified": "zh-hans",
    "chinese traditional": "zh-hant",
    "simplified chinese": "zh-hans",
    "traditional chinese": "zh-hant",
    english: "en",
    spanish: "es",
    french: "fr",
    german: "de",
    italian: "it",
    portuguese: "pt",
    dutch: "nl",
    polish: "pl",
    lithuanian: "lt",
    latvian: "lv",
    swedish: "sv",
    danish: "da",
    norwegian: "no",
    "norwegian bokmal": "no",
    "norwegian nynorsk": "no",
    finnish: "fi",
    turkish: "tr",
    japanese: "ja",
    chinese: "zh",
    korean: "ko",
    arabic: "ar",
    hebrew: "he",
    russian: "ru",
    thai: "th",
    hindi: "hi",
    greek: "el"
  };
  var ENGLISH_EQUIVALENT_CODES = /* @__PURE__ */ new Set(["pcm", "sco", "jam", "cpe"]);
  var NORWEGIAN_EQUIVALENT_CODES = /* @__PURE__ */ new Set(["nb", "nn", "nob", "nno"]);
  var CHINESE_SUBTAG_TO_VARIANT = {
    hans: "zh-hans",
    chs: "zh-hans",
    cn: "zh-hans",
    sg: "zh-hans",
    hant: "zh-hant",
    cht: "zh-hant",
    tw: "zh-hant",
    hk: "zh-hant",
    mo: "zh-hant",
    hani: "zh-hani"
  };
  function normalizeChineseCode(subtags) {
    for (const subtag of subtags) {
      const variant = CHINESE_SUBTAG_TO_VARIANT[subtag];
      if (variant)
        return variant;
    }
    return "zh-hani";
  }
  function normalizeLanguageCode(code) {
    if (!code)
      return "unknown";
    const value = code.trim().toLowerCase();
    if (!value || value === "unknown" || value === "auto")
      return value || "unknown";
    const nameKey = value.replace(/\([^)]*\)/g, " ").replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
    if (LANGUAGE_NAME_TO_CODE[value])
      return LANGUAGE_NAME_TO_CODE[value];
    if (LANGUAGE_NAME_TO_CODE[nameKey])
      return LANGUAGE_NAME_TO_CODE[nameKey];
    const subtags = value.replace(/_/g, "-").split("-");
    const base = subtags[0];
    if (base === "zh" || base === "cmn" || base === "yue")
      return normalizeChineseCode(subtags.slice(1));
    if (ENGLISH_EQUIVALENT_CODES.has(base))
      return "en";
    if (NORWEGIAN_EQUIVALENT_CODES.has(base))
      return "no";
    return base;
  }
  function normalizeTargetLanguageCode(code) {
    const normalized = normalizeLanguageCode(code);
    return normalized === "zh-hani" ? "zh-hans" : normalized;
  }
  function detectChineseScript(text3) {
    let simplified = 0;
    let traditional = 0;
    for (const char of text3 || "") {
      if (SIMPLIFIED_ONLY_CHARS.has(char))
        simplified++;
      else if (TRADITIONAL_ONLY_CHARS.has(char))
        traditional++;
    }
    if (simplified === 0 && traditional === 0)
      return CHINESE_UNDETERMINED;
    return traditional >= simplified ? CHINESE_TRADITIONAL : CHINESE_SIMPLIFIED;
  }
  function refineChineseLanguageCode(code, lines) {
    if (!code || normalizeLanguageCode(code) !== "zh-hani")
      return code;
    return detectChineseScript(lines.join("\n"));
  }
  function getSampleIndices(length) {
    if (length <= 0)
      return [];
    const indices = /* @__PURE__ */ new Set();
    for (let i = 0; i < Math.min(5, length); i++) {
      indices.add(i);
    }
    const middle = Math.floor(length / 2);
    for (let i = middle - 2; i <= middle + 2; i++) {
      if (i >= 0 && i < length) {
        indices.add(i);
      }
    }
    for (let i = Math.max(0, length - 5); i < length; i++) {
      indices.add(i);
    }
    return [...indices].sort((a, b) => a - b);
  }
  function buildSampleText(lines) {
    const indices = getSampleIndices(lines.length);
    return indices.map((i) => lines[i]).filter((line) => line && line.trim().length > 0 && !/^[•♪♫\s\-–—]+$/.test(line.trim())).join(" ");
  }
  function tokenizeWords(text3) {
    const normalized = text3.replace(/[’ʼ‘`´]/g, "'");
    const matches = normalized.toLowerCase().match(/[\p{L}']+/gu);
    if (!matches)
      return [];
    return matches.filter((word) => word.length > 1);
  }
  var ELISION_PREFIX_TO_WORD = {
    j: "je",
    l: "le",
    d: "de",
    m: "me",
    t: "te",
    s: "se",
    n: "ne",
    c: "ce",
    qu: "que",
    jusqu: "jusque",
    puisqu: "puisque",
    lorsqu: "lorsque",
    quoiqu: "quoique"
  };
  function expandElidedWords(words) {
    const expanded = [];
    for (const word of words) {
      expanded.push(word);
      const apostropheIndex = word.indexOf("'");
      if (apostropheIndex <= 0)
        continue;
      const prefix = word.slice(0, apostropheIndex);
      const rest = word.slice(apostropheIndex + 1);
      const mapped = ELISION_PREFIX_TO_WORD[prefix];
      if (mapped)
        expanded.push(mapped);
      if (rest.length > 1)
        expanded.push(rest);
    }
    return expanded;
  }
  var NON_LATIN_SCRIPT_DETECTION_REGEX = /[぀-ヿ一-鿿가-힯؀-ۿ֐-׿Ѐ-ӿ฀-๿ऀ-ॿͰ-Ͽ]/;
  var JA_ROMAJI_STRONG_TOKENS = /* @__PURE__ */ new Set([
    "desu",
    "masu",
    "mashita",
    "deshita",
    "darou",
    "daro",
    "desho",
    "deshou",
    "kimi",
    "boku",
    "watashi",
    "anata",
    "kokoro",
    "sayonara",
    "sayounara",
    "arigatou",
    "arigato",
    "konnichiwa",
    "ohayou",
    "yoru",
    "asa",
    "tsuki",
    "sora",
    "hoshi",
    "namida",
    "yume",
    "koi",
    "aishiteru",
    "suki",
    "tsuzuku",
    "tsuyoi",
    "tsumetai",
    "shiawase",
    "chigau",
    "chiisai",
    "hajimete",
    "mou",
    "demo",
    "sou",
    "naku",
    "datta",
    "janai",
    "iru",
    "naru",
    "suru",
    "shita",
    "shite",
    "iku",
    "itta",
    "kuru",
    "kita",
    "omou",
    "omotta"
  ]);
  var JA_ROMAJI_PARTICLE_TOKENS = /* @__PURE__ */ new Set([
    "wa",
    "wo",
    "no",
    "ni",
    "ga",
    "to",
    "de",
    "mo",
    "ya",
    "ka",
    "ne",
    "yo",
    "da",
    "nai",
    "aru"
  ]);
  var ROMAJI_SYLLABLE_REGEX = /^(?:[kgsztdnhbpmrw]?y?[aeiou]{1,2}|tsu|shi|chi|n)+n?$/i;
  function countRomajiTokens(words) {
    let romaji = 0;
    let specific = 0;
    let strong = 0;
    for (const word of words) {
      if (JA_ROMAJI_STRONG_TOKENS.has(word)) {
        strong++;
        specific++;
        romaji++;
        continue;
      }
      if (JA_ROMAJI_PARTICLE_TOKENS.has(word)) {
        specific++;
        romaji++;
        continue;
      }
      if (word.length >= 2 && ROMAJI_SYLLABLE_REGEX.test(word)) {
        romaji++;
      }
    }
    return { romaji, specific, strong };
  }
  function detectRomanizedJapanese(text3) {
    if (!text3)
      return null;
    if (NON_LATIN_SCRIPT_DETECTION_REGEX.test(text3))
      return null;
    const words = tokenizeWords(text3);
    if (words.length < 4)
      return null;
    const { romaji, specific, strong } = countRomajiTokens(words);
    const ratio = romaji / words.length;
    if (strong < 1)
      return null;
    if (ratio < 0.4)
      return null;
    if (countLanguageWordHits(expandElidedWords(words), "en") >= 2)
      return null;
    return {
      confidence: Math.min(0.9, 0.5 + ratio * 0.4 + Math.min(specific, 4) * 0.05),
      ratio,
      specificHits: specific
    };
  }
  function scanCorpusForCjk(lines) {
    let kana = 0;
    let kanji = 0;
    let hangul = 0;
    for (const line of lines) {
      if (!line)
        continue;
      const k = line.match(/[\u3040-\u30FF]/g);
      if (k)
        kana += k.length;
      const h = line.match(/[\u4E00-\u9FFF\u3400-\u4DBF]/g);
      if (h)
        kanji += h.length;
      const ha = line.match(/[\uAC00-\uD7AF\u1100-\u11FF]/g);
      if (ha)
        hangul += ha.length;
    }
    if (kana >= 4 || kana >= 1 && kanji >= 6) {
      return { code: "ja", confidence: 0.92, kana, kanji, hangul };
    }
    if (hangul >= 4) {
      return { code: "ko", confidence: 0.92, kana, kanji, hangul };
    }
    if (kanji >= 8 && kana === 0) {
      return { code: detectChineseScript(lines.join("\n")), confidence: 0.9, kana, kanji, hangul };
    }
    return null;
  }
  var DISTINCTIVE_LATIN_MARKERS = [
    { code: "pl", chars: "\u0142\u017C\u017A\u015B\u0144" },
    { code: "cs", chars: "\u0159\u011B\u016F" },
    { code: "lt", chars: "\u0117\u012F\u0173" },
    { code: "lv", chars: "\u0101\u0113\u012B\u0123\u0137\u013C\u0146" },
    { code: "hr", chars: "\u0111" }
  ];
  var DISTINCTIVE_MARKER_SETS = DISTINCTIVE_LATIN_MARKERS.map((entry) => ({
    code: entry.code,
    chars: new Set(entry.chars.split(""))
  }));
  var VIETNAMESE_MARKER_REGEX = /[ơướờởỡợứừửữự]/i;
  function detectByDistinctiveLatinMarkers(text3) {
    if (!text3)
      return null;
    if (VIETNAMESE_MARKER_REGEX.test(text3))
      return null;
    const lower = text3.toLowerCase();
    const counts = {};
    for (const char of lower) {
      for (const marker of DISTINCTIVE_MARKER_SETS) {
        if (marker.chars.has(char)) {
          counts[marker.code] = (counts[marker.code] || 0) + 1;
        }
      }
    }
    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (ranked.length === 0)
      return null;
    const [topCode, topCount] = ranked[0];
    const runnerUp = ranked[1]?.[1] ?? 0;
    if (topCount < 2 && !(topCount === 1 && runnerUp === 0))
      return null;
    if (topCount <= runnerUp)
      return null;
    const confidence = Math.min(0.9, 0.78 + Math.min(topCount, 6) * 0.02);
    return { code: topCode, confidence };
  }
  function detectLanguageHeuristic(text3) {
    if (!text3)
      return null;
    const hasNonLatinScript2 = NON_LATIN_SCRIPT_DETECTION_REGEX.test(text3);
    const minLength = hasNonLatinScript2 ? 1 : 10;
    if (text3.length < minLength) {
      return null;
    }
    const distinctive = detectByDistinctiveLatinMarkers(text3);
    if (distinctive) {
      return distinctive;
    }
    const normalizedText = text3.trim();
    let totalChars = 0;
    const scriptCounts = {};
    for (const char of normalizedText) {
      if (/\s/.test(char))
        continue;
      totalChars++;
      for (const lang of LANGUAGE_PATTERNS) {
        if (lang.scripts.test(char)) {
          scriptCounts[lang.code] = (scriptCounts[lang.code] || 0) + 1;
        }
      }
    }
    if (totalChars === 0)
      return null;
    const hanCount = (normalizedText.match(/[\u4E00-\u9FFF\u3400-\u4DBF]/g) || []).length;
    const kanaCount = (normalizedText.match(/[\u3040-\u30FF]/g) || []).length;
    const hangulCount = (normalizedText.match(/[\uAC00-\uD7AF\u1100-\u11FF]/g) || []).length;
    if (kanaCount > 0 && (hanCount + kanaCount) / totalChars > 0.2) {
      return { code: "ja", confidence: Math.min(0.95, 0.7 + (hanCount + kanaCount) / totalChars * 0.25) };
    }
    if (hangulCount > 0 && hangulCount / totalChars > 0.2) {
      return { code: "ko", confidence: Math.min(0.95, 0.65 + hangulCount / totalChars * 0.3) };
    }
    if (hanCount > 0 && hanCount / totalChars > 0.2) {
      return { code: detectChineseScript(normalizedText), confidence: Math.min(0.95, 0.65 + hanCount / totalChars * 0.3) };
    }
    const dominantScript = Object.entries(scriptCounts).filter(([code]) => code !== "zh" && code !== "ja" && code !== "ko").map(([code, count]) => ({ code, count, ratio: count / totalChars })).sort((a, b) => b.count - a.count)[0];
    if (dominantScript && dominantScript.ratio > 0.2) {
      return {
        code: dominantScript.code,
        confidence: Math.min(0.95, 0.6 + dominantScript.ratio * 0.3)
      };
    }
    const words = tokenizeWords(normalizedText);
    if (words.length < 3) {
      return null;
    }
    const matchWords = expandElidedWords(words);
    const wordCounts = {};
    let maxCount = 0;
    let maxLang = "en";
    for (const lang of LATIN_LANGUAGE_WORD_SETS) {
      let count = 0;
      for (const word of matchWords) {
        if (lang.words.has(word)) {
          count++;
        }
      }
      wordCounts[lang.code] = count;
      if (count > maxCount) {
        maxCount = count;
        maxLang = lang.code;
      }
    }
    const matchRatio = maxCount / words.length;
    const minMatchCount = words.length <= 6 ? 2 : 3;
    if (matchRatio > 0.12 && maxCount >= minMatchCount) {
      const sortedCounts = Object.entries(wordCounts).sort((a, b) => b[1] - a[1]);
      if (sortedCounts.length < 2 || sortedCounts[1][1] === 0) {
        return { code: maxLang, confidence: Math.min(0.75, 0.35 + matchRatio) };
      }
      const disambiguationRatio = words.length <= 6 ? 1.3 : 1.5;
      if (sortedCounts[0][1] >= sortedCounts[1][1] * disambiguationRatio) {
        return { code: maxLang, confidence: Math.min(0.8, 0.4 + matchRatio) };
      }
    }
    return null;
  }
  async function detectLanguageViaAPI(text3) {
    const sample = text3.slice(0, 500);
    const params = new URLSearchParams({
      client: "gtx",
      sl: "auto",
      tl: "en",
      dt: "t",
      q: sample
    });
    const url = `https://translate.googleapis.com/translate_a/single?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Language detection API error: ${response.status}`);
    }
    const data = await response.json();
    const rawDetectedLang = typeof data?.[2] === "string" ? data[2] : "unknown";
    let detectedLang = rawDetectedLang === "unknown" ? "unknown" : normalizeLanguageCode(rawDetectedLang);
    if (detectedLang.startsWith("zh-")) {
      const scriptVariant = detectChineseScript(sample);
      if (scriptVariant !== CHINESE_UNDETERMINED) {
        detectedLang = scriptVariant;
      }
    }
    const confidence = detectedLang !== "unknown" ? 0.9 : 0.5;
    return { code: detectedLang, confidence };
  }
  async function detectLyricsLanguage(lyrics, trackUri) {
    if (trackUri) {
      const cached = detectionCache.get(trackUri);
      if (cached && Date.now() - cached.timestamp < DETECTION_CACHE_TTL) {
        return { code: cached.language, confidence: cached.confidence };
      }
    }
    const corpusScan = scanCorpusForCjk(lyrics);
    if (corpusScan) {
      if (trackUri) {
        detectionCache.set(trackUri, {
          language: corpusScan.code,
          confidence: corpusScan.confidence,
          timestamp: Date.now()
        });
      }
      return { code: corpusScan.code, confidence: corpusScan.confidence };
    }
    const sampleText = buildSampleText(lyrics);
    if (sampleText.length < 20) {
      return { code: "unknown", confidence: 0 };
    }
    const heuristic = detectLanguageHeuristic(sampleText);
    if (heuristic && heuristic.code === "en") {
      const romaji = detectRomanizedJapanese(sampleText);
      if (romaji) {
        const result = { code: "ja", confidence: romaji.confidence };
        if (trackUri) {
          detectionCache.set(trackUri, {
            language: result.code,
            confidence: result.confidence,
            timestamp: Date.now()
          });
        }
        return result;
      }
    }
    if (heuristic && heuristic.confidence >= 0.7) {
      if (trackUri) {
        detectionCache.set(trackUri, {
          language: heuristic.code,
          confidence: heuristic.confidence,
          timestamp: Date.now()
        });
      }
      return heuristic;
    }
    try {
      const apiResult = await detectLanguageViaAPI(sampleText);
      if (trackUri) {
        detectionCache.set(trackUri, {
          language: apiResult.code,
          confidence: apiResult.confidence,
          timestamp: Date.now()
        });
      }
      return apiResult;
    } catch (error2) {
      warn("API language detection failed:", error2);
      return heuristic || { code: "unknown", confidence: 0 };
    }
  }
  function countLanguageWordHits(words, code) {
    const entry = LATIN_LANGUAGE_WORD_SETS.find((lang) => lang.code === code);
    if (!entry)
      return 0;
    let count = 0;
    for (const word of new Set(words)) {
      if (entry.words.has(word))
        count++;
    }
    return count;
  }
  function isLikelyNonTargetLine(text3, targetLanguage) {
    const trimmed = (text3 || "").trim();
    if (!trimmed)
      return false;
    if (NON_LATIN_SCRIPT_DETECTION_REGEX.test(trimmed)) {
      return !["ja", "zh-hans", "zh-hant", "zh-hani", "ko", "ar", "he", "ru", "th", "hi", "el"].includes(normalizeTargetLanguageCode(targetLanguage));
    }
    const targetCode = normalizeTargetLanguageCode(targetLanguage);
    if (!LATIN_LANGUAGE_WORD_SETS.some((lang) => lang.code === targetCode))
      return false;
    const words = expandElidedWords(tokenizeWords(trimmed));
    if (words.length < 3)
      return false;
    if (new Set(words).size < 3)
      return false;
    if (!words.some((word) => word.length >= 4))
      return false;
    if (countLanguageWordHits(words, targetCode) > 0)
      return false;
    return LATIN_LANGUAGE_WORD_SETS.some((lang) => lang.code !== targetCode && countLanguageWordHits(words, lang.code) >= 2);
  }
  function isSameLanguage(source, target) {
    if (!source || source === "unknown")
      return false;
    const normalizedSource = normalizeLanguageCode(source);
    const normalizedTarget = normalizeTargetLanguageCode(target);
    if (normalizedSource === normalizedTarget)
      return true;
    return normalizedSource === "zh-hani" && normalizedTarget.startsWith("zh-");
  }
  function isExcludedSourceLanguage(source, excluded) {
    if (!source || excluded.length === 0)
      return false;
    return excluded.some((code) => isSameLanguage(source, code));
  }
  function isChineseScriptConversion(source, target) {
    if (!source)
      return false;
    return normalizeLanguageCode(source).startsWith("zh-") && normalizeTargetLanguageCode(target).startsWith("zh-");
  }
  function assessMixedLanguageContent(lines, targetLanguage) {
    let nonTargetCount = 0;
    let nonLatinNonTargetCount = 0;
    let uncertainCount = 0;
    let targetCount = 0;
    const targetBase = targetLanguage.toLowerCase().split("-")[0].split("_")[0];
    const targetIsLatin = !["ja", "zh", "ko", "ar", "he", "ru", "th", "hi", "el"].includes(targetBase);
    for (const line of lines) {
      const trimmed = (line || "").trim();
      if (!trimmed || /^[•♪♫\s\-–—]+$/.test(trimmed))
        continue;
      const hasNonLatin = NON_LATIN_SCRIPT_DETECTION_REGEX.test(trimmed);
      if (!hasNonLatin && trimmed.length < 3)
        continue;
      if (targetIsLatin && hasNonLatin) {
        nonTargetCount++;
        nonLatinNonTargetCount++;
        continue;
      }
      if (targetIsLatin && !hasNonLatin && targetBase !== "ja") {
        const romaji = detectRomanizedJapanese(trimmed);
        if (romaji && !isSameLanguage("ja", targetLanguage)) {
          nonTargetCount++;
          continue;
        }
      }
      const detected = detectLanguageHeuristic(trimmed);
      if (!detected) {
        if (isLikelyNonTargetLine(trimmed, targetLanguage)) {
          nonTargetCount++;
        } else if (trimmed.length >= 10) {
          uncertainCount++;
        }
        continue;
      }
      if (isSameLanguage(detected.code, targetLanguage)) {
        targetCount++;
      } else if (detected.confidence >= 0.6) {
        nonTargetCount++;
      } else {
        uncertainCount++;
      }
    }
    const totalChecked = targetCount + nonTargetCount + uncertainCount;
    if (totalChecked === 0)
      return { hasMixedContent: false, nonTargetCount: 0, uncertainCount: 0 };
    const uncertainRatio = uncertainCount / totalChecked;
    const hasMixedContent = nonLatinNonTargetCount > 0 || nonTargetCount >= 1 || uncertainCount > 0 && uncertainRatio > 0.35 && nonTargetCount > 0;
    return { hasMixedContent, nonTargetCount, uncertainCount };
  }
  async function shouldSkipTranslation(lyrics, targetLanguage, trackUri) {
    const nonEmptyLyrics = lyrics.filter((l) => l && l.trim().length > 0 && !/^[•♪♫\s\-–—]+$/.test(l.trim()));
    if (nonEmptyLyrics.length === 0) {
      return { skip: false };
    }
    const corpusScan = scanCorpusForCjk(nonEmptyLyrics);
    if (corpusScan) {
      if (isSameLanguage(corpusScan.code, targetLanguage)) {
        const mixedCheck = assessMixedLanguageContent(nonEmptyLyrics, targetLanguage);
        if (mixedCheck.hasMixedContent) {
          return { skip: false, detectedLanguage: corpusScan.code };
        }
        return {
          skip: true,
          reason: `Lyrics already in ${corpusScan.code.toUpperCase()}`,
          detectedLanguage: corpusScan.code
        };
      }
      return { skip: false, detectedLanguage: corpusScan.code };
    }
    const sampleText = buildSampleText(nonEmptyLyrics);
    let quickHeuristic = detectLanguageHeuristic(sampleText);
    if (quickHeuristic && quickHeuristic.code === "en") {
      const romaji = detectRomanizedJapanese(sampleText);
      if (romaji) {
        quickHeuristic = { code: "ja", confidence: romaji.confidence };
      }
    }
    if (quickHeuristic && quickHeuristic.confidence >= (isSameLanguage(quickHeuristic.code, targetLanguage) ? 0.65 : 0.8)) {
      if (isSameLanguage(quickHeuristic.code, targetLanguage)) {
        const mixedCheck = assessMixedLanguageContent(nonEmptyLyrics, targetLanguage);
        if (mixedCheck.hasMixedContent) {
          return { skip: false, detectedLanguage: quickHeuristic.code };
        }
        return {
          skip: true,
          reason: `Lyrics already in ${quickHeuristic.code.toUpperCase()}`,
          detectedLanguage: quickHeuristic.code
        };
      }
      return { skip: false, detectedLanguage: quickHeuristic.code };
    }
    const detection = await detectLyricsLanguage(lyrics, trackUri);
    if (detection.code === "unknown" || detection.confidence < 0.6) {
      return { skip: false };
    }
    if (isSameLanguage(detection.code, targetLanguage)) {
      const mixedCheck = assessMixedLanguageContent(nonEmptyLyrics, targetLanguage);
      if (mixedCheck.hasMixedContent) {
        return { skip: false, detectedLanguage: detection.code };
      }
      return {
        skip: true,
        reason: `Lyrics already in ${detection.code.toUpperCase()}`,
        detectedLanguage: detection.code
      };
    }
    return {
      skip: false,
      detectedLanguage: detection.code
    };
  }
  function getLanguageName(code) {
    const languageNames = {
      "en": "English",
      "es": "Spanish",
      "fr": "French",
      "de": "German",
      "it": "Italian",
      "pt": "Portuguese",
      "nl": "Dutch",
      "pl": "Polish",
      "lt": "Lithuanian",
      "ru": "Russian",
      "ja": "Japanese",
      "zh": "Chinese",
      "zh-hans": "Chinese (Simplified)",
      "zh-hant": "Chinese (Traditional)",
      "zh-hani": "Chinese",
      "ko": "Korean",
      "ar": "Arabic",
      "he": "Hebrew",
      "hi": "Hindi",
      "th": "Thai",
      "el": "Greek",
      "tr": "Turkish",
      "vi": "Vietnamese",
      "id": "Indonesian",
      "ms": "Malay",
      "tl": "Tagalog",
      "sv": "Swedish",
      "no": "Norwegian",
      "da": "Danish",
      "fi": "Finnish",
      "uk": "Ukrainian",
      "cs": "Czech",
      "ro": "Romanian",
      "hu": "Hungarian",
      "unknown": "Unknown"
    };
    const normalized = normalizeLanguageCode(code);
    if (languageNames[normalized])
      return languageNames[normalized];
    const baseCode = code.toLowerCase().split("-")[0];
    return languageNames[baseCode] || code.toUpperCase();
  }

  // src/utils/wordBreakdown.ts
  var HAN_RANGE = /[一-鿿㐀-䶿]/;
  var HIRAGANA_RANGE = /[぀-ゟ]/;
  var KATAKANA_RANGE = /[゠-ヿㇰ-ㇿ]/;
  var HANGUL_RANGE = /[가-힯ᄀ-ᇿ㄰-㆏]/;
  var CJK_RANGE = /[一-鿿㐀-䶿぀-ゟ゠-ヿ가-힯ᄀ-ᇿ]/;
  var TRIM_EDGE_PUNCT = /^[^\p{L}\p{N}]+|[^\p{L}\p{M}\p{N}]+$/gu;
  function classifyChar(ch) {
    if (/\s/.test(ch))
      return "space";
    if (HAN_RANGE.test(ch))
      return "han";
    if (HIRAGANA_RANGE.test(ch))
      return "hiragana";
    if (KATAKANA_RANGE.test(ch))
      return "katakana";
    if (HANGUL_RANGE.test(ch))
      return "hangul";
    if (/[\p{L}\p{M}\p{N}]/u.test(ch))
      return "word";
    return "other";
  }
  function hasCjk(text3) {
    return CJK_RANGE.test(text3 || "");
  }
  function splitHanRun(run) {
    if (run.length <= 3)
      return [run];
    const parts = [];
    for (let i = 0; i < run.length; i += 2) {
      parts.push(run.slice(i, i + 2));
    }
    if (parts.length > 1 && parts[parts.length - 1].length === 1) {
      parts[parts.length - 2] += parts[parts.length - 1];
      parts.pop();
    }
    return parts;
  }
  function segmentSourceText(text3) {
    const raw = (text3 || "").trim();
    if (!raw)
      return [];
    if (!hasCjk(raw)) {
      return raw.split(/\s+/).map((token) => token.replace(TRIM_EDGE_PUNCT, "")).filter(Boolean);
    }
    const tokens = [];
    let current = "";
    let currentClass = null;
    let sawHiragana = false;
    const flush = () => {
      const trimmed = current.replace(TRIM_EDGE_PUNCT, "");
      if (trimmed) {
        if (currentClass === "han" && !sawHiragana) {
          tokens.push(...splitHanRun(trimmed));
        } else {
          tokens.push(trimmed);
        }
      }
      current = "";
      currentClass = null;
      sawHiragana = false;
    };
    for (const ch of raw) {
      const cls = classifyChar(ch);
      if (cls === "space" || cls === "other") {
        if (cls === "other" && current) {
          current += ch;
          continue;
        }
        flush();
        continue;
      }
      if (cls === "hiragana" && (currentClass === "han" || currentClass === "hiragana")) {
        current += ch;
        sawHiragana = true;
        continue;
      }
      if (cls === currentClass && !(cls === "han" && sawHiragana)) {
        current += ch;
        continue;
      }
      flush();
      current = ch;
      currentClass = cls;
      sawHiragana = cls === "hiragana";
    }
    flush();
    return tokens.filter(Boolean);
  }
  function segmentTargetText(text3) {
    return (text3 || "").trim().split(/\s+/).filter(Boolean);
  }
  function normalizeToken(text3) {
    return (text3 || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^\p{L}\p{M}\p{N}]/gu, "");
  }
  function bigrams(value) {
    if (value.length < 2)
      return value ? [value] : [];
    const grams = [];
    for (let i = 0; i < value.length - 1; i++) {
      grams.push(value.slice(i, i + 2));
    }
    return grams;
  }
  function similarity(a, b) {
    const left = normalizeToken(a);
    const right = normalizeToken(b);
    if (!left || !right)
      return 0;
    if (left === right)
      return 1;
    if (left.length < 3 || right.length < 3)
      return 0;
    const leftGrams = bigrams(left);
    const rightPool = /* @__PURE__ */ new Map();
    for (const gram of bigrams(right)) {
      rightPool.set(gram, (rightPool.get(gram) || 0) + 1);
    }
    let hits = 0;
    for (const gram of leftGrams) {
      const available = rightPool.get(gram) || 0;
      if (available > 0) {
        hits++;
        rightPool.set(gram, available - 1);
      }
    }
    return 2 * hits / (leftGrams.length + bigrams(right).length);
  }
  var ANCHOR_THRESHOLD = 0.62;
  function findAnchorCandidates(sourceTokens, targetTokens) {
    const candidates = [];
    for (let s = 0; s < sourceTokens.length; s++) {
      const sourceNorm = normalizeToken(sourceTokens[s]);
      if (!sourceNorm)
        continue;
      let best = null;
      for (let t = 0; t < targetTokens.length; t++) {
        const score = similarity(sourceTokens[s], targetTokens[t]);
        if (score < ANCHOR_THRESHOLD)
          continue;
        if (!best || score > best.score) {
          best = { sourceIndex: s, targetIndex: t, score };
        }
      }
      if (best)
        candidates.push(best);
    }
    return candidates;
  }
  function monotonicAnchors(candidates) {
    if (candidates.length === 0)
      return [];
    const ordered = [...candidates].sort((a, b) => a.sourceIndex - b.sourceIndex);
    const best = new Array(ordered.length).fill(1);
    const previous = new Array(ordered.length).fill(-1);
    let bestEnd = 0;
    for (let i = 0; i < ordered.length; i++) {
      for (let j = 0; j < i; j++) {
        if (ordered[j].targetIndex < ordered[i].targetIndex && best[j] + 1 > best[i]) {
          best[i] = best[j] + 1;
          previous[i] = j;
        }
      }
      if (best[i] > best[bestEnd])
        bestEnd = i;
    }
    const chain = [];
    for (let i = bestEnd; i >= 0; i = previous[i]) {
      chain.push(ordered[i]);
      if (previous[i] === -1)
        break;
    }
    return chain.reverse();
  }
  var TARGET_FUNCTION_WORDS = {
    en: ["the", "a", "an", "of", "to", "will", "would", "shall", "should", "is", "are", "am", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did"],
    es: ["el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "al"],
    fr: ["le", "la", "les", "un", "une", "des", "du", "de", "au", "aux"],
    de: ["der", "die", "das", "den", "dem", "ein", "eine", "einen", "einem", "zu"],
    pt: ["o", "a", "os", "as", "um", "uma", "de", "do", "da", "dos", "das", "ao"],
    it: ["il", "lo", "la", "i", "gli", "le", "un", "una", "di", "del", "della", "al"],
    nl: ["de", "het", "een", "van", "te"],
    sv: ["en", "ett", "att", "av"]
  };
  function targetFunctionWords(targetLang) {
    const base = (targetLang || "").toLowerCase().split(/[-_]/)[0];
    return new Set(TARGET_FUNCTION_WORDS[base] || []);
  }
  function chunkTargetSpan(words, targetLang) {
    const functionWords = targetFunctionWords(targetLang);
    if (functionWords.size === 0 || words.length < 2)
      return words.slice();
    const chunks = [];
    let pending = [];
    for (const word of words) {
      pending.push(word);
      if (!functionWords.has(normalizeToken(word))) {
        chunks.push(pending.join(" "));
        pending = [];
      }
    }
    if (pending.length > 0) {
      if (chunks.length > 0) {
        chunks[chunks.length - 1] += ` ${pending.join(" ")}`;
      } else {
        chunks.push(pending.join(" "));
      }
    }
    return chunks;
  }
  function distributeProportional(sourceSpan, targetSpan, targetLang) {
    if (sourceSpan.length === 0 && targetSpan.length === 0)
      return [];
    if (sourceSpan.length === 0)
      return [{ source: "", target: targetSpan.join(" "), exact: false }];
    if (targetSpan.length === 0)
      return sourceSpan.map((source) => ({ source, target: "", exact: false }));
    if (sourceSpan.length === targetSpan.length) {
      return sourceSpan.map((source, index) => ({ source, target: targetSpan[index], exact: true }));
    }
    const chunks = chunkTargetSpan(targetSpan, targetLang);
    if (sourceSpan.length === chunks.length) {
      return sourceSpan.map((source, index) => ({ source, target: chunks[index], exact: true }));
    }
    const weights = sourceSpan.map((token) => Math.max(normalizeToken(token).length, 1));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const pairs = [];
    let consumed = 0;
    sourceSpan.forEach((source, index) => {
      const isLast = index === sourceSpan.length - 1;
      const share = isLast ? chunks.length - consumed : Math.max(0, Math.round(weights[index] / totalWeight * chunks.length));
      const take = isLast ? Math.max(share, 0) : Math.min(share, chunks.length - consumed);
      pairs.push({ source, target: chunks.slice(consumed, consumed + take).join(" "), exact: false });
      consumed += take;
    });
    if (consumed < chunks.length && pairs.length > 0) {
      const tail = chunks.slice(consumed).join(" ");
      const last = pairs[pairs.length - 1];
      last.target = last.target ? `${last.target} ${tail}` : tail;
    }
    const merged = mergeEmptyTargets(pairs);
    if (merged.length === chunks.length && merged.every((pair) => pair.target)) {
      return merged.map((pair) => ({ ...pair, exact: true }));
    }
    return merged;
  }
  function mergeEmptyTargets(pairs) {
    const merged = [];
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      if (pair.target || !pair.source) {
        merged.push({ ...pair });
        continue;
      }
      const next = pairs[i + 1];
      if (next) {
        next.source = `${pair.source} ${next.source}`.trim();
        continue;
      }
      if (merged.length > 0) {
        const previous = merged[merged.length - 1];
        previous.source = `${previous.source} ${pair.source}`.trim();
        continue;
      }
      merged.push({ ...pair });
    }
    return merged;
  }
  var SOV_LANGUAGES = /* @__PURE__ */ new Set([
    "ja",
    "ko",
    "hi",
    "bn",
    "ur",
    "pa",
    "gu",
    "mr",
    "ne",
    "si",
    "ta",
    "te",
    "kn",
    "ml",
    "or",
    "as",
    "sa",
    "tr",
    "az",
    "uz",
    "kk",
    "ky",
    "tk",
    "tt",
    "ba",
    "mn",
    "fa",
    "ps",
    "ku",
    "my",
    "bo",
    "dz",
    "eu",
    "am",
    "hy",
    "ka",
    "la"
  ]);
  var VSO_LANGUAGES = /* @__PURE__ */ new Set(["ar", "ga", "gd", "cy", "br", "gv", "mi", "haw", "sm", "to", "tl", "fil"]);
  var SOV_SCRIPT_RANGE = /[぀-ゟ゠-ヿ가-힯ᄀ-ᇿऀ-෿ༀ-࿿က-႟ሀ-፿]/;
  var ARABIC_SCRIPT_RANGE = /[؀-ۿݐ-ݿ]/;
  function wordOrderOf(lang, sample) {
    const base = (lang || "").toLowerCase().split(/[-_]/)[0];
    if (SOV_LANGUAGES.has(base))
      return "sov";
    if (VSO_LANGUAGES.has(base))
      return "vso";
    if (base && base !== "auto" && base !== "unknown")
      return "svo";
    const text3 = sample || "";
    if (SOV_SCRIPT_RANGE.test(text3))
      return "sov";
    if (ARABIC_SCRIPT_RANGE.test(text3))
      return "non-svo";
    return "svo";
  }
  function sharesWordOrder(sourceText, targetText, targetLang, sourceLang) {
    return wordOrderOf(sourceLang, sourceText) === wordOrderOf(targetLang, targetText);
  }
  function buildHeuristicBreakdown(sourceText, targetText, targetLang, sourceLang) {
    const sourceTokens = segmentSourceText(sourceText);
    const targetTokens = segmentTargetText(targetText);
    if (sourceTokens.length === 0 || targetTokens.length === 0) {
      return { tokens: [], origin: "heuristic" };
    }
    const anchors = monotonicAnchors(findAnchorCandidates(sourceTokens, targetTokens));
    const tokens = [];
    const positional = sharesWordOrder(sourceText, targetText, targetLang, sourceLang);
    let sourceCursor = 0;
    let targetCursor = 0;
    const pushSpan = (sourceEnd, targetEnd) => {
      const sourceSpan = sourceTokens.slice(sourceCursor, sourceEnd);
      const targetSpan = targetTokens.slice(targetCursor, targetEnd);
      if (sourceSpan.length === 0 && targetSpan.length === 0)
        return;
      if (!positional) {
        for (const source of sourceSpan)
          tokens.push({ source, target: "", confidence: "low" });
        return;
      }
      for (const pair of distributeProportional(sourceSpan, targetSpan, targetLang)) {
        if (!pair.source && !pair.target)
          continue;
        tokens.push({ source: pair.source, target: pair.target, confidence: pair.exact ? "medium" : "low" });
      }
    };
    for (const anchor of anchors) {
      pushSpan(anchor.sourceIndex, anchor.targetIndex);
      tokens.push({
        source: sourceTokens[anchor.sourceIndex],
        target: targetTokens[anchor.targetIndex],
        confidence: "high"
      });
      sourceCursor = anchor.sourceIndex + 1;
      targetCursor = anchor.targetIndex + 1;
    }
    pushSpan(sourceTokens.length, targetTokens.length);
    const kept = tokens.filter((token) => token.source || token.target);
    if (!positional && !kept.some((token) => token.target))
      return { tokens: [], origin: "heuristic" };
    return { tokens: kept, origin: "heuristic" };
  }
  function coerceConfidence(value) {
    return value === "high" || value === "medium" || value === "low" ? value : "high";
  }
  function coerceString(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  function optionalString(value) {
    const text3 = coerceString(value);
    return text3 ? text3 : void 0;
  }
  function parseModelBreakdown(raw) {
    const text3 = (raw || "").trim();
    if (!text3)
      return null;
    const withoutFences = text3.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const start = withoutFences.indexOf("[");
    const end = withoutFences.lastIndexOf("]");
    if (start === -1 || end === -1 || end <= start)
      return null;
    let parsed;
    try {
      parsed = JSON.parse(withoutFences.slice(start, end + 1));
    } catch {
      return null;
    }
    if (!Array.isArray(parsed))
      return null;
    const tokens = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object")
        continue;
      const record2 = entry;
      const source = coerceString(record2.source ?? record2.s);
      const target = coerceString(record2.target ?? record2.t);
      if (!source && !target)
        continue;
      tokens.push({
        source,
        target,
        lemma: optionalString(record2.lemma ?? record2.l),
        pos: optionalString(record2.pos ?? record2.p),
        note: optionalString(record2.note ?? record2.n),
        confidence: coerceConfidence(record2.confidence)
      });
    }
    return tokens.length > 0 ? tokens : null;
  }
  function buildBreakdownPrompt(sourceText, sourceLangName, targetLangName) {
    return [
      `Break this ${sourceLangName} song lyric down word by word for a learner whose target language is ${targetLangName}.`,
      "Return ONLY a JSON array, no prose and no code fences.",
      "Each element must be an object with these keys:",
      '"source" (the token exactly as it appears in the lyric, in order),',
      `"target" (its meaning in ${targetLangName} in this context),`,
      '"lemma" (the dictionary form of the source token),',
      '"pos" (a short part-of-speech tag such as noun, verb, adj, adv, pron, prep, conj, part, num),',
      '"note" (a short note only when the token is idiomatic, slang, or grammatically notable; otherwise omit).',
      "Cover every meaningful token in order. Merge tokens only when they form one fixed expression.",
      "",
      sourceText
    ].join("\n");
  }
  function breakdownCacheKey(sourceText, targetLang) {
    return `${targetLang}:${(sourceText || "").replace(/\s+/g, " ").trim().toLowerCase()}`;
  }

  // src/utils/modelCatalog.ts
  var MODEL_PROVIDERS = ["openai", "gemini", "grok", "anthropic"];
  var DEFAULT_MODELS = {
    openai: "gpt-4o-mini",
    gemini: "gemini-3.1-flash-lite",
    grok: "grok-4.5",
    anthropic: "claude-haiku-4-5"
  };
  var FALLBACK_MODEL_OPTIONS = {
    openai: [
      { value: "gpt-5.5", text: "GPT-5.5 Speed" },
      { value: "gpt-4o-mini", text: "GPT-4o mini" }
    ],
    gemini: [
      { value: "gemini-3.1-flash-lite", text: "3.1 Flash-Lite" },
      { value: "gemini-3.5-flash", text: "3.5 Flash" },
      { value: "gemini-3.1-pro-preview", text: "3.1 Pro" }
    ],
    grok: [
      { value: "grok-4.5", text: "Grok 4.5" },
      { value: "grok-4.3", text: "Grok 4.3" }
    ],
    anthropic: [
      { value: "claude-haiku-4-5", text: "Haiku 4.5" },
      { value: "claude-sonnet-5", text: "Sonnet 5" },
      { value: "claude-opus-4-8", text: "Opus 4.8" }
    ]
  };
  var CATALOG_TTL_MS = 24 * 60 * 60 * 1e3;
  var CATALOG_REQUEST_TIMEOUT_MS = 1e4;
  var CORS_PROXY_BASE = "https://cors-proxy.spicetify.app/";
  var MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;
  var RETIRED_OPENAI_MODELS = /* @__PURE__ */ new Set(["gpt-4o", "gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"]);
  var RETIRED_GEMINI_MODELS = /* @__PURE__ */ new Set(["gemini-3.1-flash-lite-preview", "gemini-3-pro-preview"]);
  var GEMINI_EXCLUDED = /(image|tts|live|transcribe|embedding|audio|robotics|computer-use|aqa)/;
  var OPENAI_INCLUDED = /^(gpt-|o\d|chatgpt-)/;
  var OPENAI_EXCLUDED = /(audio|realtime|tts|transcribe|image|search|embedding|instruct|codex|cyber|computer-use|moderation|daybreak|rosalind|-\d{4}-\d{2}-\d{2}$)/;
  var GROK_EXCLUDED = /(image|imagine|video|build|multi-agent)/;
  var ModelCatalogHttpError = class extends Error {
    constructor(status) {
      super(`Model list request failed: ${status}`);
      this.status = status;
      this.name = "ModelCatalogHttpError";
    }
  };
  function mapRetiredGeminiModel(id) {
    if (!RETIRED_GEMINI_MODELS.has(id) && !/^gemini-[12][.-]/.test(id))
      return null;
    if (id.includes("flash-lite"))
      return "gemini-3.1-flash-lite";
    if (id.includes("pro"))
      return "gemini-3.1-pro-preview";
    if (id.includes("flash"))
      return "gemini-3.5-flash";
    return DEFAULT_MODELS.gemini;
  }
  function resolveModelId(provider, model) {
    const trimmed = (model || "").trim().replace(/^models\//, "");
    if (!MODEL_ID_PATTERN.test(trimmed))
      return DEFAULT_MODELS[provider];
    if (provider === "openai" && RETIRED_OPENAI_MODELS.has(trimmed))
      return DEFAULT_MODELS.openai;
    if (provider === "gemini")
      return mapRetiredGeminiModel(trimmed) ?? trimmed;
    return trimmed;
  }
  function hashApiKey(apiKey) {
    let hash = 2166136261;
    for (let i = 0; i < apiKey.length; i++) {
      hash ^= apiKey.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
  }
  function cacheKey(provider) {
    return `model-catalog-${provider}`;
  }
  function readCache(provider) {
    try {
      const parsed = JSON.parse(storage.get(cacheKey(provider)) || "null");
      if (!parsed || !Array.isArray(parsed.models) || parsed.models.length === 0)
        return null;
      return parsed;
    } catch {
      return null;
    }
  }
  function fallbackLabel(provider, id) {
    return FALLBACK_MODEL_OPTIONS[provider].find((option) => option.value === id)?.text || id;
  }
  function getModelOptions(provider, selected) {
    const options = [...readCache(provider)?.models ?? FALLBACK_MODEL_OPTIONS[provider]];
    const required = [selected ? resolveModelId(provider, selected) : "", DEFAULT_MODELS[provider]];
    for (const id of required) {
      if (id && !options.some((option) => option.value === id)) {
        options.push({ value: id, text: fallbackLabel(provider, id) });
      }
    }
    return options;
  }
  function isModelCatalogFresh(provider, apiKey, now = Date.now()) {
    const cached = readCache(provider);
    return Boolean(cached && cached.keyHash === hashApiKey(apiKey.trim()) && now - cached.fetchedAt < CATALOG_TTL_MS);
  }
  async function getJson(url, headers) {
    const attempt = async (target) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), CATALOG_REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(target, { method: "GET", headers, signal: controller.signal });
        if (!response.ok)
          throw new ModelCatalogHttpError(response.status);
        return await response.json();
      } finally {
        clearTimeout(timer);
      }
    };
    try {
      return await attempt(url);
    } catch (err) {
      if (err instanceof ModelCatalogHttpError)
        throw err;
      return attempt(`${CORS_PROXY_BASE}${url}`);
    }
  }
  function newestFirst(options) {
    return options.sort((a, b) => b.value.localeCompare(a.value, void 0, { numeric: true }));
  }
  function dedupe(options) {
    const seen = /* @__PURE__ */ new Set();
    return options.filter((option) => {
      if (seen.has(option.value))
        return false;
      seen.add(option.value);
      return true;
    });
  }
  function parseGeminiModels(data) {
    const models = Array.isArray(data?.models) ? data.models : [];
    return newestFirst(dedupe(models.filter((model) => Array.isArray(model?.supportedGenerationMethods) && model.supportedGenerationMethods.includes("generateContent")).map((model) => {
      const value = String(model.name || "").replace(/^models\//, "");
      return { value, text: String(model.displayName || value) };
    }).filter((option) => option.value.startsWith("gemini-") && !GEMINI_EXCLUDED.test(option.value))));
  }
  function parseOpenAIModels(data) {
    const models = Array.isArray(data?.data) ? data.data : [];
    return newestFirst(dedupe(models.map((model) => String(model?.id || "")).filter((id) => OPENAI_INCLUDED.test(id) && !OPENAI_EXCLUDED.test(id)).map((id) => ({ value: id, text: id }))));
  }
  function parseAnthropicModels(data) {
    const models = Array.isArray(data?.data) ? data.data : [];
    return dedupe(models.map((model) => ({ value: String(model?.id || ""), text: String(model?.display_name || model?.id || "") })).filter((option) => option.value.startsWith("claude-")));
  }
  function parseGrokModels(data) {
    const models = Array.isArray(data?.data) ? data.data : [];
    return newestFirst(dedupe(models.map((model) => String(model?.id || "")).filter((id) => id.startsWith("grok-") && !GROK_EXCLUDED.test(id)).map((id) => ({ value: id, text: id }))));
  }
  async function fetchModelList(provider, apiKey) {
    switch (provider) {
      case "gemini":
        return parseGeminiModels(await getJson(
          "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",
          { "x-goog-api-key": apiKey }
        ));
      case "openai":
        return parseOpenAIModels(await getJson(
          "https://api.openai.com/v1/models",
          { "Authorization": `Bearer ${apiKey}` }
        ));
      case "anthropic":
        return parseAnthropicModels(await getJson(
          "https://api.anthropic.com/v1/models?limit=100",
          {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true"
          }
        ));
      case "grok":
        return parseGrokModels(await getJson(
          "https://api.x.ai/v1/models",
          { "Authorization": `Bearer ${apiKey}` }
        ));
    }
  }
  var inflight = /* @__PURE__ */ new Map();
  function refreshModelCatalog(provider, apiKey, options = {}) {
    const key = (apiKey || "").trim();
    if (!key)
      return Promise.resolve(null);
    if (!options.force && isModelCatalogFresh(provider, key))
      return Promise.resolve(null);
    const pending = inflight.get(provider);
    if (pending)
      return pending;
    const request = fetchModelList(provider, key).then((models) => {
      if (models.length === 0)
        return null;
      storage.set(cacheKey(provider), JSON.stringify({ keyHash: hashApiKey(key), fetchedAt: Date.now(), models }));
      return models;
    }).catch((err) => {
      warn(`Could not refresh ${provider} model list:`, err);
      return null;
    }).finally(() => {
      inflight.delete(provider);
    });
    inflight.set(provider, request);
    return request;
  }

  // src/utils/translator.ts
  var DEFAULT_OPENAI_MODEL = DEFAULT_MODELS.openai;
  var DEFAULT_GEMINI_MODEL = DEFAULT_MODELS.gemini;
  var DEFAULT_GROK_MODEL = DEFAULT_MODELS.grok;
  var DEFAULT_ANTHROPIC_MODEL = DEFAULT_MODELS.anthropic;
  var DEFAULT_LIBRETRANSLATE_URL = "https://libretranslate.com/translate";
  var DEFAULT_PARALLEL_CHUNKS = 4;
  var preferredApi = "google";
  var customApiUrl = "";
  var customApiKey = "";
  var customApiFormat = "generic";
  var customApiModel = "";
  var libreTranslateApiUrl = DEFAULT_LIBRETRANSLATE_URL;
  var libreTranslateApiKey = "";
  var deeplApiKey = "";
  var openaiApiKey = "";
  var openaiModel = DEFAULT_OPENAI_MODEL;
  var geminiApiKey = "";
  var geminiModel = DEFAULT_GEMINI_MODEL;
  var geminiTemperature = 0.3;
  var grokApiKey = "";
  var grokModel = DEFAULT_GROK_MODEL;
  var anthropicApiKey = "";
  var anthropicModel = DEFAULT_ANTHROPIC_MODEL;
  var maxParallelChunks = DEFAULT_PARALLEL_CHUNKS;
  var RATE_LIMIT = {
    minDelayMs: 100,
    maxDelayMs: 2e3,
    overloadDelayMs: 1e3,
    maxRetries: 3,
    backoffMultiplier: 2
  };
  var lastApiCallTime = 0;
  var activeMetricsSession = null;
  function beginMetricsSession() {
    activeMetricsSession = { inputTokens: 0, outputTokens: 0, totalTokens: 0, apiCalls: 0 };
    return activeMetricsSession;
  }
  function endMetricsSession(session) {
    if (activeMetricsSession === session) {
      activeMetricsSession = null;
    }
  }
  var SONG_CONTEXT_MAX_LENGTH = 120;
  var activeSongContext = null;
  function cleanSongMetadata(value) {
    return (value || "").replace(/[\u0000-\u001F\u007F"]+/g, " ").replace(/\s+/g, " ").trim().slice(0, SONG_CONTEXT_MAX_LENGTH);
  }
  function resolveSongContext(trackUri, targetLang) {
    const currentUri = getCurrentTrackUri();
    const meta = !trackUri || trackUri === currentUri ? getCurrentTrackMeta() : getTrackCache(trackUri, targetLang) || {};
    const title = cleanSongMetadata(meta.trackName);
    if (!title)
      return null;
    const artist = cleanSongMetadata(meta.artistName);
    return artist ? { title, artist } : { title };
  }
  function buildSongContextNote() {
    if (!activeSongContext)
      return "";
    const song = activeSongContext.artist ? `"${activeSongContext.title}" by ${activeSongContext.artist}` : `"${activeSongContext.title}"`;
    return ` The lyrics are from the song ${song}. Use this only as context, for example to recognize names, characters and references, and keep names as names. Do not translate or output the title or artist.`;
  }
  function buildLyricsTranslationInstruction(langName) {
    return `You are a song lyrics translator. Translate the given lyrics to ${langName}. Output ONLY the translated text, nothing else. Preserve line breaks. Keep the poetic feel and rhythm where possible.${buildSongContextNote()}`;
  }
  function recordApiUsage(usage) {
    if (!activeMetricsSession)
      return;
    activeMetricsSession.apiCalls += 1;
    if (!usage)
      return;
    if (typeof usage.input === "number")
      activeMetricsSession.inputTokens += usage.input;
    if (typeof usage.output === "number")
      activeMetricsSession.outputTokens += usage.output;
    if (typeof usage.total === "number") {
      activeMetricsSession.totalTokens += usage.total;
    } else if (typeof usage.input === "number" || typeof usage.output === "number") {
      activeMetricsSession.totalTokens += (usage.input || 0) + (usage.output || 0);
    }
  }
  function extractOpenAIUsage(data) {
    const usage = data?.usage;
    if (!usage || typeof usage !== "object")
      return null;
    return {
      input: typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : void 0,
      output: typeof usage.completion_tokens === "number" ? usage.completion_tokens : void 0,
      total: typeof usage.total_tokens === "number" ? usage.total_tokens : void 0
    };
  }
  function extractGeminiUsage(data) {
    const usage = data?.usageMetadata;
    if (!usage || typeof usage !== "object")
      return null;
    return {
      input: typeof usage.promptTokenCount === "number" ? usage.promptTokenCount : void 0,
      output: typeof usage.candidatesTokenCount === "number" ? usage.candidatesTokenCount : void 0,
      total: typeof usage.totalTokenCount === "number" ? usage.totalTokenCount : void 0
    };
  }
  function extractAnthropicUsage(data) {
    const usage = data?.usage;
    if (!usage || typeof usage !== "object")
      return null;
    const input = typeof usage.input_tokens === "number" ? usage.input_tokens : void 0;
    const output = typeof usage.output_tokens === "number" ? usage.output_tokens : void 0;
    if (input === void 0 && output === void 0)
      return null;
    return { input, output };
  }
  function getActiveModelName() {
    switch (preferredApi) {
      case "gemini":
        return geminiModel || void 0;
      case "openai":
        return openaiModel || void 0;
      case "grok":
        return grokModel || void 0;
      case "anthropic":
        return anthropicModel || void 0;
      case "custom":
        return customApiModel || void 0;
      default:
        return void 0;
    }
  }
  var BATCH_SEPARATOR_REGEX = /\s*\|\|\|\s*/g;
  var BATCH_MARKER_PREFIX = "[[SLT_BATCH_";
  var BATCH_CHUNK_SIZE = 6;
  var MAX_PARALLEL_CHUNKS = 6;
  var PARALLEL_CHUNK_MIN_LINES = 12;
  var PARALLEL_TARGET_LINES_PER_CHUNK = 8;
  var NON_LATIN_SEGMENT_REGEX = /([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}\p{Script=Cyrillic}\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Devanagari}\p{Script=Greek}]+)/gu;
  var SPICETIFY_CORS_PROXY_BASE = "https://cors-proxy.spicetify.app/";
  var DEEPL_MAX_TEXTS_PER_REQUEST = 50;
  var DEEPL_FREE_BASE_URL = "https://api-free.deepl.com";
  var DEEPL_PRO_BASE_URL = "https://api.deepl.com";
  function normalizeSourceLineForFingerprint(line) {
    return (line || "").replace(/\s+/g, " ").trim().toLowerCase();
  }
  function computeSourceLyricsFingerprint(lines) {
    let hash = 2166136261;
    for (const rawLine of lines) {
      const line = normalizeSourceLineForFingerprint(rawLine);
      const value = `${line}\u241E`;
      for (let i = 0; i < value.length; i++) {
        hash ^= value.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
      }
    }
    return `${lines.length}:${(hash >>> 0).toString(36)}`;
  }
  function hasMixedLatinAndNonLatin(text3) {
    if (!text3)
      return false;
    const hasLatin = /[A-Za-z]/.test(text3);
    const hasNonLatin = NON_LATIN_SEGMENT_REGEX.test(text3);
    NON_LATIN_SEGMENT_REGEX.lastIndex = 0;
    return hasLatin && hasNonLatin;
  }
  function normalizeComparisonText(value) {
    return (value || "").toLowerCase().replace(/[\u200B\u2060\uFEFF]/g, " ").replace(/\s+/g, " ").trim();
  }
  function getLatinSkeleton(text3) {
    return normalizeComparisonText(
      (text3 || "").replace(NON_LATIN_SEGMENT_REGEX, " ").replace(/\s+/g, " ").trim()
    );
  }
  function isSuspiciousMixedLineTranslation(source, translated) {
    if (!hasMixedLatinAndNonLatin(source))
      return false;
    const translatedNorm = normalizeComparisonText(translated);
    const latinSkeleton = getLatinSkeleton(source);
    if (!translatedNorm || !latinSkeleton)
      return false;
    return translatedNorm === latinSkeleton;
  }
  async function repairMixedLineTranslation(source, translated, targetLang) {
    if (!isSuspiciousMixedLineTranslation(source, translated)) {
      return translated;
    }
    const segments = Array.from((source || "").matchAll(NON_LATIN_SEGMENT_REGEX)).map((match) => match[0]);
    if (segments.length === 0) {
      return translated;
    }
    let repaired = source;
    for (const segment of segments) {
      if (!segment || segment.trim().length === 0)
        continue;
      try {
        const segmentResult = await translateText(segment, targetLang);
        const replacement = normalizeTranslatedLine(segmentResult.translatedText || "").trim();
        if (replacement) {
          repaired = repaired.replace(segment, ` ${replacement} `);
        }
      } catch {
      }
    }
    const normalizedRepaired = normalizeTranslatedLine(repaired || "").trim();
    if (!normalizedRepaired || normalizedRepaired === source.trim()) {
      return translated;
    }
    return normalizedRepaired;
  }
  function targetLangIsLatinScript(targetLang) {
    const base = (targetLang || "").toLowerCase().split(/[-_]/)[0];
    return !["ja", "zh", "ko", "ar", "he", "ru", "th", "hi", "el", "fa", "ur", "bn", "ta", "te", "kn", "ml", "gu", "pa", "or", "si", "my", "km", "lo", "ka", "am", "yi", "ug"].includes(base);
  }
  function sourceHasNonLatinScript(text3) {
    if (!text3)
      return false;
    const hit = NON_LATIN_SEGMENT_REGEX.test(text3);
    NON_LATIN_SEGMENT_REGEX.lastIndex = 0;
    return hit;
  }
  function shouldInvalidateIdentityTranslation(source, targetLang) {
    if (!source)
      return false;
    const detected = detectLanguageHeuristic(source);
    if (detected && detected.confidence >= 0.6 && !isSameLanguage(detected.code, targetLang)) {
      return true;
    }
    if (sourceHasNonLatinScript(source) && targetLangIsLatinScript(targetLang)) {
      return true;
    }
    return isLikelyNonTargetLine(source, targetLang);
  }
  function getConfidentLineLanguage(text3) {
    const detected = detectLanguageHeuristic(text3);
    return detected && detected.confidence >= 0.6 ? detected.code : void 0;
  }
  function getConfidentLineLanguages(lines) {
    const languages = /* @__PURE__ */ new Set();
    for (const line of lines) {
      const lang = getConfidentLineLanguage(line);
      if (!lang)
        continue;
      const normalized = normalizeLanguageCode(lang);
      if (normalized === "zh-hani")
        continue;
      languages.add(normalized);
    }
    return languages;
  }
  function getLineSourceLangHint(text3, targetLang, fallbackSourceLang, mixedSourceTrack = false) {
    const lineLang = getConfidentLineLanguage(text3);
    if (lineLang) {
      return lineLang;
    }
    if (mixedSourceTrack) {
      return void 0;
    }
    if (fallbackSourceLang && fallbackSourceLang !== "auto" && fallbackSourceLang !== "unknown" && !isSameLanguage(fallbackSourceLang, targetLang)) {
      return fallbackSourceLang;
    }
    return void 0;
  }
  function looksLikeMarkerDebris(text3) {
    if (!text3)
      return false;
    if (/\[\[\s*SLT/i.test(text3))
      return true;
    if (/\bSLT[_\s-]*BATCH\b/i.test(text3))
      return true;
    if (/\]\]/.test(text3) && /\b\d+\b/.test(text3) && text3.length < 60)
      return true;
    if (/^\s*[A-Za-z]{2,}_\d+\s*\]?\]?/.test(text3))
      return true;
    return false;
  }
  function shouldInvalidateTrackCacheForMixedContent(sourceLines, cachedTranslatedLines, targetLang) {
    if (sourceLines.length === 0 || cachedTranslatedLines.length !== sourceLines.length) {
      return true;
    }
    let suspiciousUnchanged = 0;
    let suspiciousDebris = 0;
    for (let i = 0; i < sourceLines.length; i++) {
      const sourceLine = normalizeSourceLineForFingerprint(sourceLines[i]);
      const translatedLine = normalizeSourceLineForFingerprint(cachedTranslatedLines[i] || "");
      const rawTranslated = cachedTranslatedLines[i] || "";
      if (looksLikeMarkerDebris(rawTranslated)) {
        suspiciousDebris++;
      }
      if (!sourceLine || sourceLine.length < 3) {
        continue;
      }
      if (sourceLine !== translatedLine) {
        continue;
      }
      if (shouldInvalidateIdentityTranslation(sourceLines[i], targetLang)) {
        suspiciousUnchanged++;
      }
    }
    return suspiciousUnchanged >= 1 || suspiciousDebris >= 1;
  }
  function isUsableSourceLangHint(sourceLang) {
    if (!sourceLang)
      return false;
    const normalized = sourceLang.toLowerCase().trim();
    return normalized !== "" && normalized !== "auto" && normalized !== "unknown" && normalized !== "mixed";
  }
  function hasMeaningfulTranslationDifference(source, translated, targetLang, knownSourceLang) {
    const sourceNorm = normalizeComparisonText(source);
    const translatedNorm = normalizeComparisonText(translated);
    if (!sourceNorm || !translatedNorm || sourceNorm === translatedNorm) {
      return false;
    }
    if (sourceHasNonLatinScript(source) && targetLangIsLatinScript(targetLang)) {
      return true;
    }
    if (isUsableSourceLangHint(knownSourceLang) && !isSameLanguage(knownSourceLang, targetLang)) {
      return true;
    }
    const detected = detectLanguageHeuristic(source);
    if (detected && detected.confidence >= 0.6) {
      return !isSameLanguage(detected.code, targetLang);
    }
    return isLikelyNonTargetLine(source, targetLang);
  }
  function shouldInvalidateSameLanguageTrackCache(sourceLang, targetLang, sourceLines, cachedTranslatedLines) {
    if (!sourceLang || !isSameLanguage(sourceLang, targetLang)) {
      return false;
    }
    return !sourceLines.some((line, index) => hasMeaningfulTranslationDifference(line, cachedTranslatedLines[index] || "", targetLang));
  }
  async function rateLimitedDelay() {
    const now = Date.now();
    const timeSinceLastCall = now - lastApiCallTime;
    if (timeSinceLastCall < RATE_LIMIT.minDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT.minDelayMs - timeSinceLastCall));
    }
    lastApiCallTime = Date.now();
  }
  function getCosmosAsync() {
    try {
      return globalThis.Spicetify?.CosmosAsync || null;
    } catch {
      return null;
    }
  }
  function isLikelyCorsOrNetworkError(err) {
    if (err instanceof TypeError)
      return true;
    const message = err instanceof Error ? err.message : String(err || "");
    return /failed to fetch|networkerror|cors|load failed/i.test(message);
  }
  var PROVIDER_REQUEST_TIMEOUT_MS = 3e4;
  function withTimeout(promise, ms, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} request timed out`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }
  async function fetchWithTimeout(url, init, ms, label) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`${label} request timed out`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  var NonRetryableProviderError = class extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
      this.name = "NonRetryableProviderError";
    }
  };
  function isNonRetryableProviderError(err) {
    if (err instanceof NonRetryableProviderError)
      return true;
    const message = err instanceof Error ? err.message : String(err || "");
    const statusMatch = message.match(/API error: (4\d\d)\b/);
    if (!statusMatch)
      return false;
    const status = Number(statusMatch[1]);
    return status !== 408 && status !== 429;
  }
  function isProviderOverloadError(err) {
    if (err instanceof NonRetryableProviderError)
      return false;
    const message = err instanceof Error ? err.message : String(err || "");
    return /API error: (5\d\d|429)\b/.test(message);
  }
  function createProviderHttpError(providerName2, status, errorText) {
    const message = `${providerName2} API error: ${status}${errorText ? ` ${sanitizeProviderErrorText(errorText).slice(0, 240)}` : ""}`;
    if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
      return new NonRetryableProviderError(message, status);
    }
    return new Error(message);
  }
  function createProviderConfigError(message) {
    return new NonRetryableProviderError(message);
  }
  function sanitizeProviderErrorText(text3) {
    return (text3 || "").replace(/sk-[A-Za-z0-9_-]+/g, "sk-...").replace(/AIza[A-Za-z0-9_-]+/g, "AIza...").replace(/AQ\.[A-Za-z0-9_.-]+/g, "AQ...");
  }
  function getSpicetifyCorsProxyUrl(url) {
    return `${SPICETIFY_CORS_PROXY_BASE}${url}`;
  }
  function canUseSpicetifyCorsProxy(url) {
    if (url.startsWith(SPICETIFY_CORS_PROXY_BASE))
      return false;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:")
        return false;
      const host = parsed.hostname.toLowerCase();
      return host !== "localhost" && host !== "127.0.0.1" && host !== "[::1]" && !host.endsWith(".local");
    } catch {
      return false;
    }
  }
  function getCosmosErrorStatus(err) {
    const message = err instanceof Error ? err.message : String(err || "");
    const match = message.match(/error code (-?\d+)/i);
    if (!match)
      return null;
    const status = Number(match[1]);
    return Number.isFinite(status) ? status : null;
  }
  function normalizeCosmosError(err, providerName2) {
    const status = getCosmosErrorStatus(err);
    const message = err instanceof Error ? err.message : String(err || `${providerName2} request failed`);
    if (status !== null && status >= 400 && status < 600) {
      return createProviderHttpError(providerName2, status, message);
    }
    return err instanceof Error ? err : new Error(message);
  }
  function isTransportFailure(err) {
    if (err instanceof NonRetryableProviderError)
      return false;
    const message = err instanceof Error ? err.message : String(err || "");
    if (/API error: \d{3}/.test(message))
      return false;
    if (/resolver not found|no such resolver|failed to resolve/i.test(message))
      return true;
    const status = getCosmosErrorStatus(err);
    if (status !== null && status < 100)
      return true;
    return isLikelyCorsOrNetworkError(err);
  }
  async function runProviderTransports(transports, providerName2) {
    let lastError = null;
    for (const transport of transports) {
      try {
        return await transport();
      } catch (err) {
        if (!isTransportFailure(err)) {
          throw err;
        }
        lastError = err instanceof Error ? err : new Error(String(err || `${providerName2} request failed`));
      }
    }
    throw lastError || new Error(`${providerName2} request failed`);
  }
  function orderProviderTransports(viaCosmos, viaFetch, url, preferCosmos) {
    const transports = [];
    const direct = () => viaFetch(url);
    if (preferCosmos && viaCosmos) {
      transports.push(viaCosmos, direct);
    } else {
      transports.push(direct);
      if (viaCosmos)
        transports.push(viaCosmos);
    }
    if (canUseSpicetifyCorsProxy(url)) {
      transports.push(() => viaFetch(getSpicetifyCorsProxyUrl(url)));
    }
    return transports;
  }
  function cosmosCanCarryHeaders(headers) {
    return Object.keys(headers).every((key) => key.toLowerCase() === "content-type");
  }
  function rejectCosmosErrorPayload(data, providerName2) {
    if (!data || typeof data !== "object" || Array.isArray(data))
      return data;
    const payload = data;
    if (typeof payload.code === "number" && "error" in payload && payload.message === "Failed to fetch") {
      throw createProviderHttpError(providerName2, payload.code, String(payload.error || ""));
    }
    return data;
  }
  function normalizeProviderJsonPayload(data, providerName2) {
    if (typeof data !== "string") {
      return data;
    }
    const trimmed = data.trim();
    if (!trimmed) {
      throw new NonRetryableProviderError(`${providerName2} API returned an empty response`);
    }
    if (trimmed.startsWith("<")) {
      throw new NonRetryableProviderError(`${providerName2} API returned HTML instead of JSON. Check the endpoint URL or API key.`);
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      throw new NonRetryableProviderError(`${providerName2} API returned invalid JSON: ${trimmed.slice(0, 160)}`);
    }
  }
  async function readProviderJsonResponse(response, providerName2) {
    const responseText = await response.text().catch(() => "");
    if (!response.ok) {
      throw createProviderHttpError(providerName2, response.status, responseText);
    }
    return normalizeProviderJsonPayload(responseText, providerName2);
  }
  async function postJsonProvider(url, body, headers, providerName2, options = {}) {
    const cosmos = getCosmosAsync();
    const cosmosPost = cosmosCanCarryHeaders(headers) ? cosmos?.post : void 0;
    const viaCosmos = cosmosPost ? async () => {
      try {
        return normalizeProviderJsonPayload(
          rejectCosmosErrorPayload(
            await withTimeout(cosmosPost(url, body, headers), PROVIDER_REQUEST_TIMEOUT_MS, providerName2),
            providerName2
          ),
          providerName2
        );
      } catch (err) {
        throw normalizeCosmosError(err, providerName2);
      }
    } : null;
    const viaFetch = async (target) => {
      const response = await fetchWithTimeout(target, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      }, PROVIDER_REQUEST_TIMEOUT_MS, providerName2);
      return readProviderJsonResponse(response, providerName2);
    };
    return runProviderTransports(
      orderProviderTransports(viaCosmos, viaFetch, url, Boolean(options.preferCosmos)),
      providerName2
    );
  }
  function buildLibreTranslateForm(text3, targetLang) {
    const params = new URLSearchParams();
    const values = Array.isArray(text3) ? text3 : [text3];
    values.forEach((value) => params.append("q", value));
    params.set("source", "auto");
    params.set("target", getApiTargetLanguage(targetLang));
    params.set("format", "text");
    if (libreTranslateApiKey) {
      params.set("api_key", libreTranslateApiKey);
    }
    return params;
  }
  function formToJsonObject(params) {
    const result = {};
    params.forEach((value, key) => {
      const existing = result[key];
      if (existing === void 0) {
        result[key] = value;
      } else if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        result[key] = [existing, value];
      }
    });
    return result;
  }
  async function postFormProvider(url, params, providerName2, options = {}) {
    const cosmos = getCosmosAsync();
    const cosmosPost = cosmos?.post;
    const viaCosmos = cosmosPost ? async () => {
      try {
        return normalizeProviderJsonPayload(
          rejectCosmosErrorPayload(
            await withTimeout(
              cosmosPost(url, formToJsonObject(params), { "Content-Type": "application/json" }),
              PROVIDER_REQUEST_TIMEOUT_MS,
              providerName2
            ),
            providerName2
          ),
          providerName2
        );
      } catch (err) {
        throw normalizeCosmosError(err, providerName2);
      }
    } : null;
    const viaFetch = async (target) => {
      const response = await fetchWithTimeout(target, {
        method: "POST",
        body: params
      }, PROVIDER_REQUEST_TIMEOUT_MS, providerName2);
      return readProviderJsonResponse(response, providerName2);
    };
    return runProviderTransports(
      orderProviderTransports(viaCosmos, viaFetch, url, Boolean(options.preferCosmos)),
      providerName2
    );
  }
  async function retryWithBackoff(fn, maxRetries = RATE_LIMIT.maxRetries, baseDelay = RATE_LIMIT.minDelayMs) {
    let lastError = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await rateLimitedDelay();
        return await fn();
      } catch (error2) {
        lastError = error2;
        if (isNonRetryableProviderError(error2)) {
          throw error2;
        }
        if (attempt < maxRetries) {
          const attemptBaseDelay = isProviderOverloadError(error2) ? Math.max(baseDelay, RATE_LIMIT.overloadDelayMs) : baseDelay;
          const delay = Math.min(
            attemptBaseDelay * Math.pow(RATE_LIMIT.backoffMultiplier, attempt),
            RATE_LIMIT.maxDelayMs
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError || new Error("All retry attempts failed");
  }
  function setPreferredApi(api, customUrl, apiKeys) {
    preferredApi = api;
    if (customUrl !== void 0) {
      customApiUrl = customUrl;
    }
    if (apiKeys) {
      if (apiKeys.customApiKey !== void 0)
        customApiKey = apiKeys.customApiKey.trim();
      if (apiKeys.customApiFormat !== void 0)
        customApiFormat = apiKeys.customApiFormat;
      if (apiKeys.customApiModel !== void 0)
        customApiModel = apiKeys.customApiModel;
      if (apiKeys.libreTranslateApiUrl !== void 0)
        libreTranslateApiUrl = normalizeLibreTranslateUrl(apiKeys.libreTranslateApiUrl);
      if (apiKeys.libreTranslateApiKey !== void 0)
        libreTranslateApiKey = apiKeys.libreTranslateApiKey.trim();
      if (apiKeys.deeplApiKey !== void 0)
        deeplApiKey = apiKeys.deeplApiKey.trim();
      if (apiKeys.openaiApiKey !== void 0)
        openaiApiKey = apiKeys.openaiApiKey.trim();
      if (apiKeys.openaiModel !== void 0)
        openaiModel = normalizeOpenAIModelName(apiKeys.openaiModel);
      if (apiKeys.geminiApiKey !== void 0)
        geminiApiKey = apiKeys.geminiApiKey.trim();
      if (apiKeys.geminiModel !== void 0)
        geminiModel = normalizeGeminiModelName(apiKeys.geminiModel);
      if (apiKeys.geminiTemperature !== void 0)
        geminiTemperature = normalizeGeminiTemperature(apiKeys.geminiTemperature);
      if (apiKeys.grokApiKey !== void 0)
        grokApiKey = apiKeys.grokApiKey.trim();
      if (apiKeys.grokModel !== void 0)
        grokModel = normalizeGrokModelName(apiKeys.grokModel);
      if (apiKeys.anthropicApiKey !== void 0)
        anthropicApiKey = apiKeys.anthropicApiKey.trim();
      if (apiKeys.anthropicModel !== void 0)
        anthropicModel = normalizeAnthropicModelName(apiKeys.anthropicModel);
      if (apiKeys.maxParallelChunks !== void 0)
        maxParallelChunks = normalizeMaxParallelChunks(apiKeys.maxParallelChunks);
    }
  }
  var CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1e3;
  var MAX_CACHE_ENTRIES = 500;
  function pruneTranslationCache(cache, now = Date.now()) {
    let changed = false;
    Object.keys(cache).forEach((key) => {
      const entry = cache[key];
      if (!entry || typeof entry.timestamp !== "number" || now - entry.timestamp > CACHE_EXPIRY) {
        delete cache[key];
        changed = true;
      }
    });
    const keys = Object.keys(cache);
    if (keys.length > MAX_CACHE_ENTRIES) {
      keys.map((key) => ({ key, timestamp: cache[key].timestamp })).sort((a, b) => a.timestamp - b.timestamp).slice(0, keys.length - MAX_CACHE_ENTRIES).forEach((item) => {
        delete cache[item.key];
        changed = true;
      });
    }
    return changed;
  }
  var SUPPORTED_LANGUAGES = [
    { code: "af", name: "Afrikaans" },
    { code: "sq", name: "Albanian" },
    { code: "am", name: "Amharic" },
    { code: "ar", name: "Arabic" },
    { code: "hy", name: "Armenian" },
    { code: "az", name: "Azerbaijani" },
    { code: "eu", name: "Basque" },
    { code: "be", name: "Belarusian" },
    { code: "bn", name: "Bengali" },
    { code: "bs", name: "Bosnian" },
    { code: "bg", name: "Bulgarian" },
    { code: "ca", name: "Catalan" },
    { code: "ceb", name: "Cebuano" },
    { code: "zh", name: "Chinese (Simplified)" },
    { code: "zh-TW", name: "Chinese (Traditional)" },
    { code: "hr", name: "Croatian" },
    { code: "cs", name: "Czech" },
    { code: "da", name: "Danish" },
    { code: "nl", name: "Dutch" },
    { code: "en", name: "English" },
    { code: "eo", name: "Esperanto" },
    { code: "et", name: "Estonian" },
    { code: "fi", name: "Finnish" },
    { code: "fr", name: "French" },
    { code: "gl", name: "Galician" },
    { code: "ka", name: "Georgian" },
    { code: "de", name: "German" },
    { code: "el", name: "Greek" },
    { code: "gu", name: "Gujarati" },
    { code: "ht", name: "Haitian Creole" },
    { code: "ha", name: "Hausa" },
    { code: "haw", name: "Hawaiian" },
    { code: "he", name: "Hebrew" },
    { code: "hi", name: "Hindi" },
    { code: "hmn", name: "Hmong" },
    { code: "hu", name: "Hungarian" },
    { code: "is", name: "Icelandic" },
    { code: "ig", name: "Igbo" },
    { code: "id", name: "Indonesian" },
    { code: "ga", name: "Irish" },
    { code: "it", name: "Italian" },
    { code: "ja", name: "Japanese" },
    { code: "jv", name: "Javanese" },
    { code: "kn", name: "Kannada" },
    { code: "kk", name: "Kazakh" },
    { code: "km", name: "Khmer" },
    { code: "rw", name: "Kinyarwanda" },
    { code: "ko", name: "Korean" },
    { code: "ku", name: "Kurdish" },
    { code: "ky", name: "Kyrgyz" },
    { code: "lo", name: "Lao" },
    { code: "la", name: "Latin" },
    { code: "lv", name: "Latvian" },
    { code: "lt", name: "Lithuanian" },
    { code: "lb", name: "Luxembourgish" },
    { code: "mk", name: "Macedonian" },
    { code: "mg", name: "Malagasy" },
    { code: "ms", name: "Malay" },
    { code: "ml", name: "Malayalam" },
    { code: "mt", name: "Maltese" },
    { code: "mi", name: "Maori" },
    { code: "mr", name: "Marathi" },
    { code: "mn", name: "Mongolian" },
    { code: "my", name: "Myanmar (Burmese)" },
    { code: "ne", name: "Nepali" },
    { code: "no", name: "Norwegian" },
    { code: "ny", name: "Nyanja (Chichewa)" },
    { code: "or", name: "Odia (Oriya)" },
    { code: "ps", name: "Pashto" },
    { code: "fa", name: "Persian" },
    { code: "pl", name: "Polish" },
    { code: "pt", name: "Portuguese" },
    { code: "pa", name: "Punjabi" },
    { code: "ro", name: "Romanian" },
    { code: "ru", name: "Russian" },
    { code: "sm", name: "Samoan" },
    { code: "gd", name: "Scots Gaelic" },
    { code: "sr", name: "Serbian" },
    { code: "st", name: "Sesotho" },
    { code: "sn", name: "Shona" },
    { code: "sd", name: "Sindhi" },
    { code: "si", name: "Sinhala" },
    { code: "sk", name: "Slovak" },
    { code: "sl", name: "Slovenian" },
    { code: "so", name: "Somali" },
    { code: "es", name: "Spanish" },
    { code: "su", name: "Sundanese" },
    { code: "sw", name: "Swahili" },
    { code: "sv", name: "Swedish" },
    { code: "tl", name: "Tagalog (Filipino)" },
    { code: "tg", name: "Tajik" },
    { code: "ta", name: "Tamil" },
    { code: "tt", name: "Tatar" },
    { code: "te", name: "Telugu" },
    { code: "th", name: "Thai" },
    { code: "tr", name: "Turkish" },
    { code: "tk", name: "Turkmen" },
    { code: "uk", name: "Ukrainian" },
    { code: "ur", name: "Urdu" },
    { code: "ug", name: "Uyghur" },
    { code: "uz", name: "Uzbek" },
    { code: "vi", name: "Vietnamese" },
    { code: "cy", name: "Welsh" },
    { code: "xh", name: "Xhosa" },
    { code: "yi", name: "Yiddish" },
    { code: "yo", name: "Yoruba" },
    { code: "zu", name: "Zulu" }
  ];
  var LANGUAGE_VARIANTS = [
    {
      code: "ca-valencia",
      baseCode: "ca",
      label: "Valencian",
      promptName: "Valencian (the Valencian variant of Catalan, using Valencian vocabulary, orthography and verb forms as codified by the Acad\xE8mia Valenciana de la Llengua)"
    }
  ];
  var VARIANT_CAPABLE_APIS = ["openai", "gemini", "grok", "anthropic", "custom"];
  function providerSupportsLanguageVariants(api) {
    return VARIANT_CAPABLE_APIS.includes(api);
  }
  function getLanguageVariantForBase(baseCode) {
    return LANGUAGE_VARIANTS.find((variant) => variant.baseCode === baseCode);
  }
  function getLanguageVariantByCode(code) {
    return LANGUAGE_VARIANTS.find((variant) => variant.code === code);
  }
  function resolveTargetLanguage(baseCode, variantEnabled, api) {
    if (!variantEnabled || !providerSupportsLanguageVariants(api))
      return baseCode;
    return getLanguageVariantForBase(baseCode)?.code || baseCode;
  }
  function getApiTargetLanguage(targetLang) {
    return getLanguageVariantByCode(targetLang)?.baseCode || targetLang;
  }
  function getCachedTranslation(text3, targetLang) {
    const cache = storage_default.getJSON("translation-cache", {});
    const key = `${targetLang}:${text3}`;
    const cached = cache[key];
    if (cached) {
      if (typeof cached.timestamp === "number" && Date.now() - cached.timestamp < CACHE_EXPIRY) {
        const normalized = normalizeTranslatedLine(cached.translation || "");
        if (normalized !== cached.translation) {
          cache[key] = {
            ...cached,
            translation: normalized,
            timestamp: Date.now()
          };
          storage_default.setJSON("translation-cache", cache);
        }
        if (isSuspiciousMixedLineTranslation(text3, normalized)) {
          delete cache[key];
          storage_default.setJSON("translation-cache", cache);
          return null;
        }
        if (looksLikeMarkerDebris(normalized)) {
          delete cache[key];
          storage_default.setJSON("translation-cache", cache);
          return null;
        }
        if (normalized === text3) {
          if (shouldInvalidateIdentityTranslation(text3, targetLang)) {
            delete cache[key];
            storage_default.setJSON("translation-cache", cache);
            return null;
          }
        }
        return normalized;
      }
      delete cache[key];
      pruneTranslationCache(cache);
      storage_default.setJSON("translation-cache", cache);
    }
    return null;
  }
  function setCacheEntry(cache, text3, targetLang, translation, api) {
    const key = `${targetLang}:${text3}`;
    const normalizedTranslation = normalizeTranslatedLine(translation || "");
    if (normalizedTranslation === text3 && shouldInvalidateIdentityTranslation(text3, targetLang)) {
      delete cache[key];
      return;
    }
    cache[key] = {
      translation: normalizedTranslation,
      timestamp: Date.now(),
      api
    };
  }
  function cacheTranslation(text3, targetLang, translation, api) {
    const cache = storage_default.getJSON("translation-cache", {});
    setCacheEntry(cache, text3, targetLang, translation, api);
    pruneTranslationCache(cache);
    storage_default.setJSON("translation-cache", cache);
  }
  var API_SOURCE_LANG_OVERRIDES = {
    "zh-hans": "zh-CN",
    "zh-hant": "zh-TW",
    "zh-hani": "auto"
  };
  function normalizeSourceLangHint(raw) {
    if (!raw)
      return "auto";
    const value = normalizeLanguageCode(raw);
    if (!value || value === "unknown" || value === "auto")
      return "auto";
    return API_SOURCE_LANG_OVERRIDES[value] || value || "auto";
  }
  async function translateWithGoogle(text3, targetLang, sourceLang) {
    const encodedText = encodeURIComponent(text3);
    const sl = normalizeSourceLangHint(sourceLang);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${getApiTargetLanguage(targetLang)}&dt=t&q=${encodedText}`;
    const response = await fetch(url);
    recordApiUsage(null);
    if (!response.ok) {
      throw new Error(`Google Translate API error: ${response.status}`);
    }
    const data = await response.json();
    const rawDetectedLang = data[2] || "unknown";
    const detectedLang = rawDetectedLang === "unknown" ? "unknown" : normalizeLanguageCode(rawDetectedLang);
    if (data && data[0]) {
      let translation = "";
      for (const sentence of data[0]) {
        if (sentence && sentence[0]) {
          translation += sentence[0];
        }
      }
      if (translation) {
        return { translation, detectedLang };
      }
    }
    throw new Error("Invalid response from Google Translate");
  }
  function normalizeLibreTranslateUrl(url) {
    const trimmed = (url || "").trim();
    return trimmed || DEFAULT_LIBRETRANSLATE_URL;
  }
  function getLibreTranslateUrl() {
    const url = normalizeLibreTranslateUrl(libreTranslateApiUrl);
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
        throw createProviderConfigError("LibreTranslate URL must use http or https.");
      }
      const normalizedPath = parsedUrl.pathname.replace(/\/+$/, "");
      if (!normalizedPath || normalizedPath === "") {
        parsedUrl.pathname = "/translate";
      } else if (!normalizedPath.endsWith("/translate")) {
        parsedUrl.pathname = `${normalizedPath}/translate`;
      }
      return parsedUrl.toString();
    } catch (error2) {
      if (error2 instanceof NonRetryableProviderError) {
        throw error2;
      }
      throw createProviderConfigError("Invalid LibreTranslate URL format. Set it in Settings.");
    }
  }
  function libreTranslateHostedRequiresKey(url) {
    try {
      const host = new URL(url).hostname.toLowerCase();
      return host === "libretranslate.com" || host.endsWith(".libretranslate.com");
    } catch {
      return false;
    }
  }
  function validateLibreTranslateConfig() {
    const url = getLibreTranslateUrl();
    if (libreTranslateHostedRequiresKey(url) && !libreTranslateApiKey) {
      throw createProviderConfigError("LibreTranslate API key required for hosted LibreTranslate. Set a key or use a self-hosted URL.");
    }
    return url;
  }
  async function translateWithLibreTranslate(text3, targetLang) {
    const url = validateLibreTranslateConfig();
    const data = await postFormProvider(
      url,
      buildLibreTranslateForm(text3, targetLang),
      "LibreTranslate",
      { preferCosmos: true }
    );
    recordApiUsage(null);
    if (typeof data?.translatedText === "string") {
      return data.translatedText;
    }
    throw new Error("Invalid response from LibreTranslate API");
  }
  async function translateWithDeepL(text3, targetLang) {
    if (!deeplApiKey) {
      throw createProviderConfigError("DeepL API key not configured. Set it in Settings.");
    }
    const data = await postDeepL([text3], targetLang, "DeepL");
    recordApiUsage(null);
    if (data.translations && data.translations.length > 0) {
      return {
        translation: data.translations[0].text,
        detectedLang: data.translations[0].detected_source_language?.toLowerCase()
      };
    }
    throw new Error("Invalid response from DeepL API");
  }
  async function translateWithOpenAI(text3, targetLang) {
    if (!openaiApiKey) {
      throw createProviderConfigError("OpenAI API key not configured. Set it in Settings.");
    }
    const langName = getTranslationLanguageName(targetLang);
    const data = await postJsonProvider(
      "https://api.openai.com/v1/chat/completions",
      buildOpenAIChatBody(text3, langName),
      {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json"
      },
      "OpenAI",
      { preferCosmos: true }
    );
    recordApiUsage(extractOpenAIUsage(data));
    if (data.choices && data.choices.length > 0) {
      const translation = data.choices[0].message?.content?.trim();
      if (translation) {
        return { translation };
      }
    }
    throw new Error("Invalid response from OpenAI API");
  }
  function normalizeOpenAIModelName(model) {
    return resolveModelId("openai", model);
  }
  function normalizeGrokModelName(model) {
    return resolveModelId("grok", model);
  }
  function normalizeAnthropicModelName(model) {
    return resolveModelId("anthropic", model);
  }
  function isOpenAIReasoningModel(model) {
    return /^(o\d|gpt-5|gpt-6)/.test(model) && !model.includes("-chat");
  }
  function getOpenAIReasoningEffort(model) {
    return model === "gpt-5.5" ? "none" : "low";
  }
  function buildOpenAIChatBody(text3, langName) {
    const model = normalizeOpenAIModelName(openaiModel);
    const useSpeedMode = isOpenAIReasoningModel(model);
    const instruction = buildLyricsTranslationInstruction(langName);
    const outputTokenBudget = Math.max(text3.length * 4, useSpeedMode ? 8e3 : 2048);
    const body = {
      model,
      messages: [
        {
          role: useSpeedMode ? "developer" : "system",
          content: instruction
        },
        {
          role: "user",
          content: text3
        }
      ],
      max_completion_tokens: outputTokenBudget
    };
    if (useSpeedMode) {
      body.reasoning_effort = getOpenAIReasoningEffort(model);
    } else {
      body.temperature = 0.3;
    }
    return body;
  }
  function normalizeGeminiModelName(model) {
    return resolveModelId("gemini", model);
  }
  function normalizeGeminiTemperature(value) {
    const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
    if (!Number.isFinite(parsed)) {
      return 0.3;
    }
    return Math.min(2, Math.max(0, parsed));
  }
  function normalizeMaxParallelChunks(value) {
    const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
    if (!Number.isFinite(parsed)) {
      return DEFAULT_PARALLEL_CHUNKS;
    }
    return Math.min(MAX_PARALLEL_CHUNKS, Math.max(1, Math.floor(parsed)));
  }
  function getGeminiGenerateContentUrl(model) {
    const normalizedModel = normalizeGeminiModelName(model);
    return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(normalizedModel)}:generateContent`;
  }
  function getGeminiHeaders(apiKey) {
    return {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    };
  }
  async function translateWithGemini(text3, targetLang) {
    if (!geminiApiKey) {
      throw createProviderConfigError("Gemini API key not configured. Set it in Settings.");
    }
    const langName = getTranslationLanguageName(targetLang);
    const data = await postJsonProvider(
      getGeminiGenerateContentUrl(geminiModel),
      {
        contents: [
          {
            parts: [
              {
                text: `${buildLyricsTranslationInstruction(langName)}

${text3}`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: geminiTemperature,
          maxOutputTokens: Math.max(text3.length * 3, 2048)
        }
      },
      getGeminiHeaders(geminiApiKey),
      "Gemini",
      { preferCosmos: true }
    );
    recordApiUsage(extractGeminiUsage(data));
    if (data.candidates && data.candidates.length > 0) {
      const translation = data.candidates[0]?.content?.parts?.[0]?.text?.trim();
      if (translation) {
        return { translation };
      }
    }
    throw new Error("Invalid response from Gemini API");
  }
  async function translateWithGrok(text3, targetLang) {
    if (!grokApiKey) {
      throw createProviderConfigError("Grok (xAI) API key not configured. Set it in Settings.");
    }
    const langName = getTranslationLanguageName(targetLang);
    const model = normalizeGrokModelName(grokModel);
    const data = await postJsonProvider(
      "https://api.x.ai/v1/chat/completions",
      {
        model,
        messages: [
          { role: "system", content: buildLyricsTranslationInstruction(langName) },
          { role: "user", content: text3 }
        ],
        temperature: 0.3,
        max_tokens: Math.max(text3.length * 3, 2048)
      },
      {
        "Authorization": `Bearer ${grokApiKey}`,
        "Content-Type": "application/json"
      },
      "Grok",
      { preferCosmos: true }
    );
    recordApiUsage(extractOpenAIUsage(data));
    if (data.choices && data.choices.length > 0) {
      const translation = data.choices[0].message?.content?.trim();
      if (translation) {
        return { translation };
      }
    }
    throw new Error("Invalid response from Grok API");
  }
  function anthropicModelSupportsThinkingToggle(model) {
    return model === "claude-sonnet-5" || model === "claude-opus-4-8";
  }
  async function translateWithAnthropic(text3, targetLang) {
    if (!anthropicApiKey) {
      throw createProviderConfigError("Claude (Anthropic) API key not configured. Set it in Settings.");
    }
    const langName = getTranslationLanguageName(targetLang);
    const model = normalizeAnthropicModelName(anthropicModel);
    const body = {
      model,
      max_tokens: Math.min(8192, Math.max(text3.length * 2, 1024)),
      system: buildLyricsTranslationInstruction(langName),
      messages: [
        { role: "user", content: text3 }
      ]
    };
    if (anthropicModelSupportsThinkingToggle(model)) {
      body.thinking = { type: "disabled" };
    }
    const data = await postJsonProvider(
      "https://api.anthropic.com/v1/messages",
      body,
      {
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
        "Content-Type": "application/json"
      },
      "Claude",
      { preferCosmos: true }
    );
    recordApiUsage(extractAnthropicUsage(data));
    if (Array.isArray(data.content)) {
      const textBlock = data.content.find((block) => block?.type === "text" && typeof block.text === "string");
      const translation = textBlock?.text?.trim();
      if (translation) {
        return { translation };
      }
    }
    throw new Error("Invalid response from Claude API");
  }
  function validateCustomApiUrl() {
    if (!customApiUrl) {
      throw createProviderConfigError("Custom API URL not configured. Set it in Settings.");
    }
    try {
      const parsedUrl = new URL(customApiUrl);
      if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
        throw new Error("Custom API URL must use http or https protocol");
      }
    } catch (e) {
      if (e instanceof TypeError) {
        throw new Error("Invalid Custom API URL format");
      }
      throw e;
    }
    return customApiUrl.trim();
  }
  function getDeepLTargetLanguage(targetLang) {
    const deeplLangMap = {
      "en": "EN-US",
      "pt": "PT-BR",
      "zh": "ZH-HANS",
      "zh-TW": "ZH-HANT"
    };
    const apiLang = getApiTargetLanguage(targetLang);
    return deeplLangMap[apiLang] || apiLang.toUpperCase();
  }
  function buildDeepLBody(texts, targetLang) {
    return {
      text: texts,
      target_lang: getDeepLTargetLanguage(targetLang)
    };
  }
  function getDeepLHeaders(apiKey) {
    return {
      "Authorization": `DeepL-Auth-Key ${apiKey}`,
      "Content-Type": "application/json"
    };
  }
  function isDeepLWrongEndpointError(error2) {
    return error2 instanceof NonRetryableProviderError && error2.status === 403 && /wrong endpoint/i.test(error2.message);
  }
  async function postDeepL(texts, targetLang, providerName2) {
    const apiKey = deeplApiKey;
    const baseUrls = apiKey.endsWith(":fx") ? [DEEPL_FREE_BASE_URL, DEEPL_PRO_BASE_URL] : [DEEPL_PRO_BASE_URL, DEEPL_FREE_BASE_URL];
    const send = (baseUrl) => postJsonProvider(
      getSpicetifyCorsProxyUrl(`${baseUrl}/v2/translate`),
      buildDeepLBody(texts, targetLang),
      getDeepLHeaders(apiKey),
      providerName2
    );
    try {
      return await send(baseUrls[0]);
    } catch (error2) {
      if (!isDeepLWrongEndpointError(error2))
        throw error2;
      return send(baseUrls[1]);
    }
  }
  function getTranslationLanguageName(targetLang) {
    const variant = getLanguageVariantByCode(targetLang);
    if (variant)
      return variant.promptName;
    return SUPPORTED_LANGUAGES.find((l) => l.code === targetLang)?.name || targetLang;
  }
  function getCustomApiHeaders(format) {
    const headers = {
      "Content-Type": "application/json"
    };
    if (!customApiKey) {
      return headers;
    }
    if (format === "gemini") {
      headers["x-goog-api-key"] = customApiKey;
    } else if (format === "deepl") {
      headers["Authorization"] = `DeepL-Auth-Key ${customApiKey}`;
    } else {
      headers["Authorization"] = `Bearer ${customApiKey}`;
      headers["X-API-Key"] = customApiKey;
    }
    return headers;
  }
  function getOpenAiCompatibleUrl(url) {
    const parsedUrl = new URL(url);
    const normalizedPath = parsedUrl.pathname.replace(/\/+$/, "");
    if (normalizedPath.endsWith("/v1")) {
      parsedUrl.pathname = `${normalizedPath}/chat/completions`;
      return parsedUrl.toString();
    }
    return url;
  }
  function buildCustomSingleBody(text3, targetLang, format) {
    const langName = getTranslationLanguageName(targetLang);
    if (format === "openai") {
      return {
        model: customApiModel || openaiModel || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: buildLyricsTranslationInstruction(langName)
          },
          {
            role: "user",
            content: text3
          }
        ],
        temperature: 0.3,
        max_tokens: Math.max(text3.length * 3, 500)
      };
    }
    if (format === "gemini") {
      return {
        contents: [
          {
            parts: [
              {
                text: `${buildLyricsTranslationInstruction(langName)}

${text3}`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: geminiTemperature,
          maxOutputTokens: Math.max(text3.length * 3, 500)
        }
      };
    }
    if (format === "deepl") {
      return {
        text: [text3],
        target_lang: getDeepLTargetLanguage(targetLang)
      };
    }
    const apiLang = getApiTargetLanguage(targetLang);
    return {
      text: text3,
      q: text3,
      source: "auto",
      target: apiLang,
      target_lang: apiLang,
      format: "text"
    };
  }
  function stringifyTranslation(value) {
    if (value === void 0 || value === null)
      return null;
    if (typeof value === "string")
      return value;
    if (typeof value === "number" || typeof value === "boolean")
      return String(value);
    return null;
  }
  function extractTranslation(data) {
    const candidates = [
      data?.translatedText,
      data?.translated_text,
      data?.translation,
      data?.result,
      data?.text,
      data?.data?.translatedText,
      data?.data?.translated_text,
      data?.data?.translation,
      data?.data?.result,
      data?.data?.text,
      data?.translations?.[0]?.text,
      data?.translations?.[0]?.translatedText,
      data?.translations?.[0]?.translated_text,
      data?.choices?.[0]?.message?.content,
      data?.choices?.[0]?.text,
      data?.output_text,
      data?.output?.[0]?.content?.[0]?.text,
      data?.content?.[0]?.text,
      data?.candidates?.[0]?.content?.parts?.[0]?.text,
      Array.isArray(data) ? data[0]?.translatedText : void 0,
      Array.isArray(data) ? data[0]?.translated_text : void 0,
      Array.isArray(data) ? data[0]?.translation : void 0,
      Array.isArray(data) ? data[0]?.text : void 0
    ];
    for (const candidate of candidates) {
      const translation = stringifyTranslation(candidate);
      if (translation) {
        return translation;
      }
    }
    return null;
  }
  async function translateWithCustomApi(text3, targetLang) {
    const format = customApiFormat || "generic";
    const url = format === "openai" ? getOpenAiCompatibleUrl(validateCustomApiUrl()) : validateCustomApiUrl();
    try {
      const data = await postJsonProvider(
        url,
        buildCustomSingleBody(text3, targetLang, format),
        getCustomApiHeaders(format),
        "Custom API",
        { preferCosmos: true }
      );
      recordApiUsage(extractOpenAIUsage(data) || extractGeminiUsage(data));
      const translation = extractTranslation(data);
      if (translation) {
        return {
          translation,
          detectedLang: extractDetectedLanguage(data)
        };
      }
      throw new Error(`Could not parse translation from API response: ${JSON.stringify(data).slice(0, 200)}`);
    } catch (error2) {
      error("Custom API error:", error2);
      throw error2;
    }
  }
  function extractDetectedLanguage(data) {
    return data?.detectedLanguage || data?.detected_language || data?.sourceLang || data?.src || data?.detected_source_language || data?.translations?.[0]?.detected_source_language?.toLowerCase();
  }
  function normalizeBatchTranslations(data) {
    const candidates = [
      data?.translatedText,
      data?.translated_text,
      data?.translation,
      data?.result,
      data?.text,
      data?.data?.translatedText,
      data?.data?.translated_text,
      data?.data?.translations,
      data?.translations,
      data
    ];
    for (const candidate of candidates) {
      if (!Array.isArray(candidate))
        continue;
      if (candidate.every((item) => typeof item === "string")) {
        return {
          translations: candidate.map((item) => item ?? ""),
          detectedLang: extractDetectedLanguage(data)
        };
      }
      if (candidate.every((item) => typeof item === "object" && item !== null && ("text" in item || "translatedText" in item))) {
        const translations = candidate.map((item) => {
          const value = item.translatedText ?? item.text ?? "";
          return String(value);
        });
        return {
          translations,
          detectedLang: extractDetectedLanguage(data)
        };
      }
    }
    return null;
  }
  function customApiSupportsBatchArray() {
    return customApiFormat === "generic" || customApiFormat === "libretranslate" || customApiFormat === "deepl";
  }
  function canUseBatchArrayProvider() {
    if (preferredApi === "libretranslate")
      return true;
    if (preferredApi === "deepl")
      return Boolean(deeplApiKey);
    if (preferredApi === "custom")
      return Boolean(customApiUrl && customApiSupportsBatchArray());
    return false;
  }
  async function translateBatchArray(texts, targetLang) {
    if (texts.length === 0) {
      return { translations: [], detectedLang: void 0 };
    }
    if (preferredApi === "deepl" && !deeplApiKey) {
      throw createProviderConfigError("DeepL API key not configured. Set it in Settings.");
    }
    if (preferredApi === "custom" && !customApiUrl) {
      throw createProviderConfigError("Custom API URL not configured. Set it in Settings.");
    }
    if (preferredApi === "deepl" && deeplApiKey || preferredApi === "custom" && customApiFormat === "deepl") {
      const customUrl = preferredApi === "custom" ? validateCustomApiUrl() : "";
      const translations = [];
      let detectedLang;
      for (let start = 0; start < texts.length; start += DEEPL_MAX_TEXTS_PER_REQUEST) {
        const chunk = texts.slice(start, start + DEEPL_MAX_TEXTS_PER_REQUEST);
        const data2 = preferredApi === "deepl" ? await postDeepL(chunk, targetLang, "DeepL batch") : await postJsonProvider(
          customUrl,
          buildDeepLBody(chunk, targetLang),
          getCustomApiHeaders("deepl"),
          "DeepL batch"
        );
        recordApiUsage(null);
        if (!data2?.translations || !Array.isArray(data2.translations)) {
          throw new Error("DeepL batch returned unexpected format");
        }
        translations.push(...data2.translations.map((t) => t?.text || ""));
        detectedLang = detectedLang || data2.translations[0]?.detected_source_language?.toLowerCase();
      }
      return { translations, detectedLang };
    }
    if (preferredApi === "custom" && !customApiSupportsBatchArray()) {
      throw new Error("Custom API format does not support array batch payloads");
    }
    const url = preferredApi === "libretranslate" ? validateLibreTranslateConfig() : validateCustomApiUrl();
    if (!url) {
      throw new Error("Custom API URL not configured");
    }
    const data = preferredApi === "libretranslate" ? await postFormProvider(
      url,
      buildLibreTranslateForm(texts.join("\n"), targetLang),
      "LibreTranslate batch",
      { preferCosmos: true }
    ) : await postJsonProvider(
      url,
      {
        q: texts,
        text: texts,
        source: "auto",
        target: getApiTargetLanguage(targetLang),
        target_lang: getApiTargetLanguage(targetLang),
        format: "text"
      },
      getCustomApiHeaders(customApiFormat || "generic"),
      "Batch API"
    );
    recordApiUsage(extractOpenAIUsage(data) || extractGeminiUsage(data));
    const normalized = normalizeBatchTranslations(data);
    if (normalized) {
      return normalized;
    }
    const singleTranslation = extractTranslation(data);
    const parsed = singleTranslation ? parseBatchTextFallbacks(singleTranslation, texts.length) : null;
    if (!parsed) {
      throw new Error("Batch API returned non-array payload");
    }
    return {
      translations: parsed,
      detectedLang: extractDetectedLanguage(data)
    };
  }
  function buildMarkedBatchPayload(lines) {
    const markerNonce = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const combinedText = lines.map((line, index) => `${BATCH_MARKER_PREFIX}${markerNonce}_${index}]]${line}`).join("\n");
    return { combinedText, markerNonce };
  }
  function hasInternalBatchMarkers(text3) {
    return (text3 || "").includes(BATCH_MARKER_PREFIX) || /\[\[\s*SLT[\s_-]*BATCH/i.test(text3 || "");
  }
  function parseMarkedBatchResponse(translatedText, expectedCount, markerNonce) {
    const markerRegex = new RegExp(`\\[\\[SLT_BATCH_${markerNonce}_(\\d+)\\]\\]`, "g");
    const matches = [];
    let match;
    while ((match = markerRegex.exec(translatedText)) !== null) {
      matches.push({
        index: Number.parseInt(match[1], 10),
        start: match.index,
        markerEnd: markerRegex.lastIndex
      });
    }
    if (matches.length !== expectedCount) {
      return null;
    }
    const seen = /* @__PURE__ */ new Set();
    const byIndex = new Array(expectedCount).fill("");
    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const next = matches[i + 1];
      if (current.index < 0 || current.index >= expectedCount || seen.has(current.index)) {
        return null;
      }
      seen.add(current.index);
      const segment = translatedText.slice(current.markerEnd, next ? next.start : translatedText.length);
      byIndex[current.index] = segment.replace(/^\s+/, "").trimEnd();
    }
    if (seen.size !== expectedCount) {
      return null;
    }
    return byIndex;
  }
  function normalizeTranslatedLine(text3) {
    return text3.replace(/```[a-z0-9_-]*/gi, "").replace(/\[\[\s*SLT[\s_-]*BATCH[^\]]*\]\]/gi, "").replace(/\[\[\s*[A-Za-z0-9]+[_\s-]*BATCH[_\s-]*[A-Za-z0-9]*[_\s-]*\d+\s*\]\]/gi, "").replace(/\[\[\s*[A-Za-z0-9_\s-]*\d+\s*\]\]/g, "").replace(/\bSLT[\s_-]*BATCH[\s_-]*[A-Za-z0-9_-]*\b/gi, "").replace(/^\s*[A-Za-z]{2,12}[_\s-]+\d+\s*\]?\]?\s*/g, "").replace(/\r?\n+/g, " ").replace(/[\u200B\u2060\uFEFF]/g, " ").replace(/\s+/g, " ").trim();
  }
  function foldWrapperLineForComparison(text3) {
    return (text3 || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  }
  function isBatchWrapperLine(line) {
    const folded = foldWrapperLineForComparison(line);
    if (!folded)
      return true;
    if (/^```/.test(folded))
      return true;
    return /^(here('|')?s|here is|here are|sure[,!. ]|translation:?|translated lyrics:?|ban dich:?|duoi day|day la)/.test(folded);
  }
  function removeBatchWrapperLines(text3) {
    return (text3 || "").split(/\r?\n/).filter((line) => !isBatchWrapperLine(line)).join("\n");
  }
  function parseBatchTextFallbacks(translatedText, expectedCount) {
    const batchText = removeBatchWrapperLines(translatedText);
    const separatorSplit = batchText.split(BATCH_SEPARATOR_REGEX).map((s) => normalizeTranslatedLine(s));
    if (separatorSplit.length === expectedCount) {
      return separatorSplit;
    }
    const newlineSplit = batchText.split(/\r?\n+/).map((s) => normalizeTranslatedLine(s)).filter(Boolean);
    if (newlineSplit.length === expectedCount) {
      return newlineSplit;
    }
    return null;
  }
  function providerSupportsParallelChunking() {
    if (preferredApi === "openai" || preferredApi === "gemini" || preferredApi === "grok" || preferredApi === "anthropic") {
      return true;
    }
    if (preferredApi === "custom") {
      return customApiFormat === "openai" || customApiFormat === "gemini";
    }
    return false;
  }
  function providerHandlesMarkerBatch() {
    if (preferredApi === "libretranslate" || preferredApi === "deepl") {
      return false;
    }
    if (preferredApi === "custom") {
      return customApiFormat === "openai" || customApiFormat === "gemini";
    }
    return true;
  }
  function getConfiguredParallelCap() {
    return Math.min(MAX_PARALLEL_CHUNKS, Math.max(1, Math.floor(maxParallelChunks) || 1));
  }
  function getParallelChunkCount(lineCount) {
    const cap = getConfiguredParallelCap();
    if (cap < 2) {
      return 1;
    }
    return Math.min(cap, Math.max(2, Math.ceil(lineCount / PARALLEL_TARGET_LINES_PER_CHUNK)));
  }
  function shouldUseParallelChunking(lineCount) {
    return providerSupportsParallelChunking() && lineCount >= PARALLEL_CHUNK_MIN_LINES && getParallelChunkCount(lineCount) >= 2;
  }
  function splitIntoChunks(items, chunkCount) {
    const chunks = [];
    const baseSize = Math.floor(items.length / chunkCount);
    let remainder = items.length % chunkCount;
    let start = 0;
    for (let i = 0; i < chunkCount && start < items.length; i++) {
      const size = baseSize + (remainder > 0 ? 1 : 0);
      if (remainder > 0)
        remainder--;
      if (size === 0)
        break;
      chunks.push(items.slice(start, start + size));
      start += size;
    }
    return chunks;
  }
  async function translateParallelChunkedBatch(lines, targetLang, sourceLang) {
    const chunkCount = getParallelChunkCount(lines.length);
    const chunks = splitIntoChunks(lines, chunkCount);
    const chunkResults = await Promise.all(chunks.map(async (chunk) => {
      const { combinedText, markerNonce } = buildMarkedBatchPayload(chunk);
      const result = await retryWithBackoff(() => translateText(combinedText, targetLang, sourceLang));
      const parsed = parseMarkedBatchResponse(result.translatedText, chunk.length, markerNonce) || parseBatchTextFallbacks(result.translatedText, chunk.length);
      if (!parsed || parsed.length !== chunk.length) {
        throw new Error(`Parallel chunk mismatch: sent ${chunk.length}, got ${parsed?.length ?? 0}`);
      }
      return { translations: parsed, detectedLang: result.detectedLanguage };
    }));
    const translations = [];
    let detectedLang;
    for (const chunkResult of chunkResults) {
      translations.push(...chunkResult.translations);
      if (!detectedLang && chunkResult.detectedLang) {
        detectedLang = chunkResult.detectedLang;
      }
    }
    return { translations, detectedLang };
  }
  async function translateChunkedBatch(lines, targetLang, chunkSize = BATCH_CHUNK_SIZE, sourceLang) {
    const translations = [];
    let detectedLang;
    for (let start = 0; start < lines.length; start += chunkSize) {
      const chunk = lines.slice(start, start + chunkSize);
      const { combinedText, markerNonce } = buildMarkedBatchPayload(chunk);
      const result = await retryWithBackoff(() => translateText(combinedText, targetLang, sourceLang));
      const parsed = parseMarkedBatchResponse(result.translatedText, chunk.length, markerNonce) || parseBatchTextFallbacks(result.translatedText, chunk.length);
      if (!parsed || parsed.length !== chunk.length) {
        throw new Error(`Chunked batch mismatch: Sent ${chunk.length}, got ${parsed?.length ?? 0}`);
      }
      if (!detectedLang && result.detectedLanguage) {
        detectedLang = result.detectedLanguage;
      }
      translations.push(...parsed);
    }
    return { translations, detectedLang };
  }
  async function translateSourceAlignedBatch(lines, targetLang, sourceLang) {
    if (lines.length === 0) {
      return { translations: [] };
    }
    if (sourceLang && sourceLang !== "auto" && isSameLanguage(sourceLang, targetLang)) {
      return { translations: [...lines], detectedLang: sourceLang };
    }
    if (lines.length === 1) {
      const result = await retryWithBackoff(() => translateText(lines[0], targetLang, sourceLang));
      return { translations: [result.translatedText], detectedLang: result.detectedLanguage };
    }
    if (canUseBatchArrayProvider()) {
      try {
        const batchResult = await retryWithBackoff(() => translateBatchArray(lines, targetLang));
        if (batchResult.translations.length === lines.length) {
          return batchResult;
        }
      } catch (batchArrayError) {
        if (isNonRetryableProviderError(batchArrayError)) {
          throw batchArrayError;
        }
        warn("Source-aligned batch-array translation unavailable, falling back to marker batching:", batchArrayError);
      }
    }
    if (shouldUseParallelChunking(lines.length)) {
      try {
        const parallelResult = await translateParallelChunkedBatch(lines, targetLang, sourceLang);
        if (parallelResult.translations.length === lines.length) {
          return parallelResult;
        }
      } catch (parallelError) {
        warn("Source-aligned parallel chunked batch failed, falling back to single marker batch:", parallelError);
      }
    }
    if (providerHandlesMarkerBatch()) {
      try {
        const { combinedText, markerNonce } = buildMarkedBatchPayload(lines);
        const result = await retryWithBackoff(() => translateText(combinedText, targetLang, sourceLang));
        const parsed = parseMarkedBatchResponse(result.translatedText, lines.length, markerNonce) || parseBatchTextFallbacks(result.translatedText, lines.length);
        if (parsed && parsed.length === lines.length) {
          return { translations: parsed, detectedLang: result.detectedLanguage };
        }
      } catch (markerBatchError) {
        warn("Source-aligned marker batch failed, falling back to chunked batch:", markerBatchError);
      }
      try {
        return await translateChunkedBatch(lines, targetLang, BATCH_CHUNK_SIZE, sourceLang);
      } catch (chunkedError) {
        warn("Source-aligned chunked batch failed, falling back to per-line translation:", chunkedError);
      }
    }
    const translations = [];
    let detectedLang;
    for (const line of lines) {
      const result = await retryWithBackoff(() => translateText(line, targetLang, sourceLang));
      translations.push(result.translatedText);
      if (!detectedLang && result.detectedLanguage) {
        detectedLang = result.detectedLanguage;
      }
    }
    return { translations, detectedLang };
  }
  async function translateMixedSourceChunks(items, targetLang, fallbackSourceLang) {
    const translations = new Array(items.length);
    const groups = /* @__PURE__ */ new Map();
    let detectedLang;
    items.forEach((item, localIndex) => {
      const sourceLang = getLineSourceLangHint(item.text, targetLang, fallbackSourceLang, true) || "auto";
      const normalizedSourceLang = normalizeSourceLangHint(sourceLang);
      if (normalizedSourceLang !== "auto" && isSameLanguage(normalizedSourceLang, targetLang)) {
        translations[localIndex] = item.text;
        return;
      }
      const groupKey = normalizedSourceLang || "auto";
      const group = groups.get(groupKey) || [];
      group.push({ localIndex, text: item.text });
      groups.set(groupKey, group);
    });
    for (const [sourceLang, group] of groups) {
      const hint = sourceLang === "auto" ? void 0 : sourceLang;
      const result = await translateSourceAlignedBatch(group.map((item) => item.text), targetLang, hint);
      result.translations.forEach((translated, groupIndex) => {
        translations[group[groupIndex].localIndex] = translated;
      });
      if (!detectedLang && result.detectedLang) {
        detectedLang = result.detectedLang;
      }
    }
    return {
      translations: items.map((item, index) => translations[index] || item.text),
      detectedLang
    };
  }
  async function translateText(text3, targetLang, sourceLang) {
    const cached = getCachedTranslation(text3, targetLang);
    if (cached) {
      return {
        originalText: text3,
        translatedText: cached,
        targetLanguage: targetLang
      };
    }
    const tryGoogle = async () => {
      const result = await translateWithGoogle(text3, targetLang, sourceLang);
      return { translation: result.translation, detectedLang: result.detectedLang };
    };
    const tryLibreTranslate = async () => {
      const translation = await translateWithLibreTranslate(text3, targetLang);
      return { translation, detectedLang: void 0 };
    };
    const tryCustom = async () => {
      const result = await translateWithCustomApi(text3, targetLang);
      return { translation: result.translation, detectedLang: result.detectedLang };
    };
    const tryDeepL = async () => {
      const result = await translateWithDeepL(text3, targetLang);
      return { translation: result.translation, detectedLang: result.detectedLang };
    };
    const tryOpenAI = async () => {
      const result = await translateWithOpenAI(text3, targetLang);
      return { translation: result.translation, detectedLang: result.detectedLang };
    };
    const tryGemini = async () => {
      const result = await translateWithGemini(text3, targetLang);
      return { translation: result.translation, detectedLang: result.detectedLang };
    };
    const tryGrok = async () => {
      const result = await translateWithGrok(text3, targetLang);
      return { translation: result.translation, detectedLang: result.detectedLang };
    };
    const tryAnthropic = async () => {
      const result = await translateWithAnthropic(text3, targetLang);
      return { translation: result.translation, detectedLang: result.detectedLang };
    };
    let primaryApi;
    let fallbackApis = [];
    switch (preferredApi) {
      case "libretranslate":
        primaryApi = tryLibreTranslate;
        fallbackApis = [{ name: "google", fn: tryGoogle }];
        break;
      case "deepl":
        primaryApi = tryDeepL;
        fallbackApis = [{ name: "google", fn: tryGoogle }];
        break;
      case "openai":
        primaryApi = tryOpenAI;
        fallbackApis = [{ name: "google", fn: tryGoogle }];
        break;
      case "gemini":
        primaryApi = tryGemini;
        fallbackApis = [{ name: "google", fn: tryGoogle }];
        break;
      case "grok":
        primaryApi = tryGrok;
        fallbackApis = [{ name: "google", fn: tryGoogle }];
        break;
      case "anthropic":
        primaryApi = tryAnthropic;
        fallbackApis = [{ name: "google", fn: tryGoogle }];
        break;
      case "custom":
        primaryApi = tryCustom;
        fallbackApis = [{ name: "google", fn: tryGoogle }, { name: "libretranslate", fn: tryLibreTranslate }];
        break;
      case "google":
      default:
        primaryApi = tryGoogle;
        fallbackApis = [{ name: "libretranslate", fn: tryLibreTranslate }];
        break;
    }
    try {
      const result = await primaryApi();
      cacheTranslation(text3, targetLang, result.translation, preferredApi);
      return {
        originalText: text3,
        translatedText: result.translation,
        detectedLanguage: result.detectedLang,
        targetLanguage: targetLang,
        wasTranslated: true
      };
    } catch (primaryError) {
      if (isNonRetryableProviderError(primaryError)) {
        throw primaryError;
      }
      if (hasInternalBatchMarkers(text3)) {
        if (isProviderOverloadError(primaryError)) {
          throw primaryError;
        }
        const message = primaryError instanceof Error ? primaryError.message : String(primaryError || "Provider failed");
        throw new NonRetryableProviderError(message);
      }
      warn(`Primary API (${preferredApi}) failed, trying fallbacks:`, primaryError);
      for (const fallbackApi of fallbackApis) {
        try {
          const result = await fallbackApi.fn();
          cacheTranslation(text3, targetLang, result.translation, fallbackApi.name);
          return {
            originalText: text3,
            translatedText: result.translation,
            detectedLanguage: result.detectedLang,
            targetLanguage: targetLang,
            wasTranslated: true
          };
        } catch (fallbackError) {
          warn(`Fallback API (${fallbackApi.name}) failed:`, fallbackError);
          continue;
        }
      }
      error("All translation services failed");
      throw new Error("Translation failed. Please try again later.");
    }
  }
  function inferDominantSourceLangFromLines(lines) {
    let zh = 0, ja = 0, ko = 0;
    const zhLines = [];
    for (const line of lines) {
      if (!line)
        continue;
      if (/[぀-ヿ]/.test(line)) {
        ja++;
        continue;
      }
      if (/[가-힯ᄀ-ᇿ]/.test(line)) {
        ko++;
        continue;
      }
      if (/[一-鿿㐀-䶿]/.test(line)) {
        zh++;
        zhLines.push(line);
        continue;
      }
    }
    if (ja > 0 && ja >= zh && ja >= ko)
      return "ja";
    if (ko > 0 && ko >= zh && ko >= ja)
      return "ko";
    if (zh > 0)
      return detectChineseScript(zhLines.join("\n"));
    return void 0;
  }
  function buildMetricsForCache(session, startedAt) {
    if (session.apiCalls === 0)
      return void 0;
    const model = getActiveModelName();
    return {
      model,
      durationMs: Date.now() - startedAt,
      apiCalls: session.apiCalls,
      inputTokens: session.inputTokens > 0 ? session.inputTokens : void 0,
      outputTokens: session.outputTokens > 0 ? session.outputTokens : void 0,
      totalTokens: session.totalTokens > 0 ? session.totalTokens : void 0
    };
  }
  async function translateLyrics(lines, targetLang, trackUri, detectedSourceLang, skipTrackCache = false) {
    const metricsSession = beginMetricsSession();
    const metricsStartedAt = Date.now();
    const previousSongContext = activeSongContext;
    activeSongContext = resolveSongContext(trackUri, targetLang);
    try {
      return await translateLyricsInner(lines, targetLang, trackUri, detectedSourceLang, metricsSession, metricsStartedAt, skipTrackCache);
    } finally {
      activeSongContext = previousSongContext;
      endMetricsSession(metricsSession);
    }
  }
  function buildSourceLanguageCorpus(lines) {
    return lines.filter((line) => line && line.trim().length > 0).join(" ").slice(0, 4e3);
  }
  function detectCorpusLanguageStrict(lines) {
    const corpus = buildSourceLanguageCorpus(lines);
    if (corpus.length < 4)
      return null;
    return detectLanguageHeuristic(corpus);
  }
  function buildSameLanguagePassthrough(lines, targetLang, detectedLang) {
    return lines.map((line) => ({
      originalText: line,
      translatedText: line,
      targetLanguage: targetLang,
      detectedLanguage: detectedLang,
      wasTranslated: false,
      source: "cache"
    }));
  }
  async function translateLyricsInner(lines, targetLang, trackUri, detectedSourceLang, metricsSession, metricsStartedAt, skipTrackCache = false) {
    const currentTrackUri = trackUri || getCurrentTrackUri();
    const sourceFingerprint = computeSourceLyricsFingerprint(lines);
    const lineLanguages = getConfidentLineLanguages(lines);
    const hasMixedSourceLanguages = lineLanguages.size > 1;
    if (!detectedSourceLang || detectedSourceLang === "auto" || detectedSourceLang === "unknown") {
      const inferred = inferDominantSourceLangFromLines(lines);
      if (inferred) {
        detectedSourceLang = inferred;
      }
    } else {
      detectedSourceLang = refineChineseLanguageCode(detectedSourceLang, lines);
    }
    const sameLangFromHint = detectedSourceLang && detectedSourceLang !== "auto" && detectedSourceLang !== "unknown" && isSameLanguage(detectedSourceLang, targetLang);
    const confidentLineLangs = Array.from(lineLanguages);
    const NON_LATIN_SCRIPT_RE = /[぀-ヿ㐀-䶿一-鿿가-힯ᄀ-ᇿЀ-ӿ؀-ۿ֐-׿฀-๿ऀ-ॿͰ-Ͽ]/;
    const targetBase = targetLang.toLowerCase().split("-")[0].split("_")[0];
    const targetIsLatin = !["ja", "zh", "ko", "ru", "uk", "bg", "sr", "mk", "be", "ar", "he", "th", "hi", "el"].includes(targetBase);
    const hasConfidentNonTargetLine = lines.some((line) => {
      if (!line || !line.trim())
        return false;
      const hasNonLatin = NON_LATIN_SCRIPT_RE.test(line);
      return targetIsLatin ? hasNonLatin : !hasNonLatin && /[A-Za-z]/.test(line);
    });
    const sameLangFromLines = !hasMixedSourceLanguages && confidentLineLangs.length > 0 && confidentLineLangs.every((lang) => isSameLanguage(lang, targetLang));
    let sameLangFromCorpus = false;
    if (!sameLangFromHint && !sameLangFromLines) {
      const corpusDetection = detectCorpusLanguageStrict(lines);
      if (corpusDetection && corpusDetection.confidence >= 0.6 && isSameLanguage(corpusDetection.code, targetLang)) {
        sameLangFromCorpus = true;
        if (!detectedSourceLang || detectedSourceLang === "auto" || detectedSourceLang === "unknown") {
          detectedSourceLang = corpusDetection.code;
        }
      }
    }
    if ((sameLangFromHint || sameLangFromLines || sameLangFromCorpus) && !hasConfidentNonTargetLine) {
      if (currentTrackUri && !skipTrackCache) {
        deleteTrackCache(currentTrackUri, targetLang);
      }
      return buildSameLanguagePassthrough(lines, targetLang, detectedSourceLang || targetLang);
    }
    if (hasConfidentNonTargetLine && detectedSourceLang && isSameLanguage(detectedSourceLang, targetLang)) {
      detectedSourceLang = void 0;
    }
    if (currentTrackUri && !skipTrackCache) {
      const trackCache = getTrackCache(currentTrackUri, targetLang);
      if (trackCache && trackCache.lines.length === lines.length) {
        if (shouldInvalidateSameLanguageTrackCache(trackCache.lang, targetLang, lines, trackCache.lines)) {
          deleteTrackCache(currentTrackUri, targetLang);
        } else if (trackCache.sourceFingerprint && trackCache.sourceFingerprint === sourceFingerprint) {
          if (!shouldInvalidateTrackCacheForMixedContent(lines, trackCache.lines, targetLang)) {
            return lines.map((line, index) => ({
              originalText: line,
              translatedText: trackCache.lines[index] || line,
              targetLanguage: targetLang,
              wasTranslated: trackCache.lines[index] !== line,
              source: "cache",
              apiProvider: trackCache.api
            }));
          }
          deleteTrackCache(currentTrackUri, targetLang);
        } else {
          deleteTrackCache(currentTrackUri, targetLang);
        }
      }
    }
    const results = [];
    const cachedResults = /* @__PURE__ */ new Map();
    const uncachedLines = [];
    const lineCacheSnapshot = storage_default.getJSON("translation-cache", {});
    lines.forEach((line, index) => {
      if (!line.trim()) {
        cachedResults.set(index, {
          originalText: line,
          translatedText: line,
          targetLanguage: targetLang,
          wasTranslated: false,
          source: "cache"
        });
      } else {
        const cached = getCachedTranslation(line, targetLang);
        if (cached) {
          const lineKey = `${targetLang}:${line}`;
          const lineCacheEntry = lineCacheSnapshot[lineKey];
          cachedResults.set(index, {
            originalText: line,
            translatedText: cached,
            targetLanguage: targetLang,
            wasTranslated: cached !== line,
            source: "cache",
            apiProvider: lineCacheEntry?.api
          });
        } else {
          uncachedLines.push({ index, text: line });
        }
      }
    });
    if (uncachedLines.length === 0) {
      const finalResults = lines.map((_, index) => cachedResults.get(index));
      const someTranslated2 = finalResults.some((r) => r.wasTranslated);
      if (currentTrackUri && someTranslated2 && !skipTrackCache) {
        const translatedLines = finalResults.map((r) => r.translatedText);
        setTrackCache(
          currentTrackUri,
          targetLang,
          detectedSourceLang || "auto",
          translatedLines,
          preferredApi,
          sourceFingerprint,
          void 0,
          void 0,
          lines,
          buildMetricsForCache(metricsSession, metricsStartedAt)
        );
      }
      return finalResults;
    }
    let detectedLang = detectedSourceLang || "auto";
    try {
      let translatedLines = null;
      if (!hasMixedSourceLanguages && canUseBatchArrayProvider() && uncachedLines.length > 1) {
        try {
          const batchResult = await retryWithBackoff(() => translateBatchArray(uncachedLines.map((l) => l.text), targetLang));
          translatedLines = batchResult.translations;
          if (batchResult.detectedLang) {
            detectedLang = batchResult.detectedLang;
          }
        } catch (batchArrayError) {
          if (isNonRetryableProviderError(batchArrayError)) {
            throw batchArrayError;
          }
          warn("Batch-array translation unavailable, falling back to marker batching:", batchArrayError);
        }
      }
      if (!translatedLines && !hasMixedSourceLanguages && shouldUseParallelChunking(uncachedLines.length)) {
        try {
          const parallelResult = await translateParallelChunkedBatch(uncachedLines.map((l) => l.text), targetLang, detectedSourceLang);
          if (parallelResult.translations.length === uncachedLines.length) {
            translatedLines = parallelResult.translations;
            if (parallelResult.detectedLang) {
              detectedLang = parallelResult.detectedLang;
            }
          }
        } catch (parallelError) {
          warn("Parallel chunked batch failed, falling back to single marker batch:", parallelError);
        }
      }
      if (!translatedLines && !hasMixedSourceLanguages && providerHandlesMarkerBatch()) {
        const { combinedText, markerNonce } = buildMarkedBatchPayload(uncachedLines.map((l) => l.text));
        const result = await retryWithBackoff(() => translateText(combinedText, targetLang, detectedSourceLang));
        translatedLines = parseMarkedBatchResponse(result.translatedText, uncachedLines.length, markerNonce) || parseBatchTextFallbacks(result.translatedText, uncachedLines.length);
        if (result.detectedLanguage) {
          detectedLang = result.detectedLanguage;
        }
      }
      if (!hasMixedSourceLanguages && (!translatedLines || translatedLines.length !== uncachedLines.length) && uncachedLines.length > 1 && providerHandlesMarkerBatch()) {
        warn(`Primary batch parse failed for ${uncachedLines.length} lines, trying chunked batch mode (${BATCH_CHUNK_SIZE}/request)`);
        try {
          const chunked = await translateChunkedBatch(uncachedLines.map((l) => l.text), targetLang, BATCH_CHUNK_SIZE, detectedSourceLang);
          translatedLines = chunked.translations;
          if (chunked.detectedLang) {
            detectedLang = chunked.detectedLang;
          }
        } catch (chunkedError) {
          warn("Chunked batch failed, falling back to per-line translation:", chunkedError);
          translatedLines = null;
        }
      }
      if (hasMixedSourceLanguages && (!translatedLines || translatedLines.length !== uncachedLines.length)) {
        const mixedResult = await translateMixedSourceChunks(uncachedLines, targetLang, detectedSourceLang);
        translatedLines = mixedResult.translations;
        detectedLang = mixedResult.detectedLang || "mixed";
      }
      if (!translatedLines || translatedLines.length !== uncachedLines.length) {
        warn(`Batch parsing unreliable for target ${targetLang}, translating line-by-line (${uncachedLines.length} lines)`);
        const perLineResults = [];
        for (const item of uncachedLines) {
          try {
            const lineSourceLang = getLineSourceLangHint(item.text, targetLang, detectedSourceLang, hasMixedSourceLanguages);
            const single = await retryWithBackoff(() => translateText(item.text, targetLang, lineSourceLang), 1);
            perLineResults.push(single.translatedText);
            if (single.detectedLanguage && !hasMixedSourceLanguages && detectedLang === (detectedSourceLang || "auto")) {
              detectedLang = single.detectedLanguage;
            }
          } catch (singleError) {
            warn("Per-line translation failed for line:", item.index, singleError);
            perLineResults.push(item.text);
          }
        }
        translatedLines = perLineResults;
      }
      if (!translatedLines || translatedLines.length !== uncachedLines.length) {
        throw new Error(`Translation mismatch: Sent ${uncachedLines.length} lines, got ${translatedLines?.length ?? 0}.`);
      }
      for (let i = 0; i < uncachedLines.length; i++) {
        const item = uncachedLines[i];
        if (!item.text.trim())
          continue;
        if (normalizeTranslatedLine(translatedLines[i] || ""))
          continue;
        try {
          const lineSourceLang = getLineSourceLangHint(item.text, targetLang, detectedSourceLang, hasMixedSourceLanguages);
          const single = await retryWithBackoff(() => translateText(item.text, targetLang, lineSourceLang), 1);
          if (normalizeTranslatedLine(single.translatedText || "")) {
            translatedLines[i] = single.translatedText;
          }
        } catch (blankLineError) {
          warn("Re-translation of blank batch line failed:", item.index, blankLineError);
        }
      }
      uncachedLines.forEach((item, i) => {
        cachedResults.set(item.index, {
          originalText: item.text,
          translatedText: normalizeTranslatedLine(translatedLines[i] || "") || item.text,
          targetLanguage: targetLang,
          wasTranslated: (normalizeTranslatedLine(translatedLines[i] || "") || item.text) !== item.text,
          source: "api",
          apiProvider: preferredApi
        });
      });
      const repairCache = storage_default.getJSON("translation-cache", {});
      for (const item of uncachedLines) {
        const existing = cachedResults.get(item.index);
        const initialTranslation = existing?.translatedText || item.text;
        let repairedTranslation = await repairMixedLineTranslation(item.text, initialTranslation, targetLang);
        let finalTranslation = normalizeTranslatedLine(repairedTranslation || "") || item.text;
        const sourceAndTargetMatch = isSameLanguage(detectedLang, targetLang);
        const sourceIsNonLatin = sourceHasNonLatinScript(item.text);
        const targetWantsLatin = targetLangIsLatinScript(targetLang);
        const suspiciousOutput = looksLikeMarkerDebris(finalTranslation) || sourceIsNonLatin && targetWantsLatin && finalTranslation === item.text;
        if (suspiciousOutput) {
          try {
            const lineSourceLang = getLineSourceLangHint(item.text, targetLang, detectedSourceLang, hasMixedSourceLanguages);
            const direct = await retryWithBackoff(() => translateText(item.text, targetLang, lineSourceLang), 1);
            const directNormalized = normalizeTranslatedLine(direct.translatedText || "");
            if (directNormalized && !looksLikeMarkerDebris(directNormalized) && directNormalized !== item.text) {
              finalTranslation = directNormalized;
            } else if (directNormalized && !looksLikeMarkerDebris(directNormalized)) {
              finalTranslation = directNormalized;
            }
          } catch (directError) {
            warn("Direct re-translation failed for suspicious line:", item.index, directError);
          }
        }
        const latinLineInMixedScriptTrack = targetWantsLatin && hasConfidentNonTargetLine && !sourceIsNonLatin;
        if ((sourceAndTargetMatch || latinLineInMixedScriptTrack) && !hasMeaningfulTranslationDifference(item.text, finalTranslation, targetLang)) {
          finalTranslation = item.text;
        }
        if (finalTranslation !== item.text) {
          setCacheEntry(repairCache, item.text, targetLang, finalTranslation, preferredApi);
        }
        cachedResults.set(item.index, {
          originalText: item.text,
          translatedText: finalTranslation,
          targetLanguage: targetLang,
          wasTranslated: finalTranslation !== item.text,
          source: "api",
          apiProvider: preferredApi
        });
      }
      pruneTranslationCache(repairCache);
      storage_default.setJSON("translation-cache", repairCache);
    } catch (error2) {
      error("Batch translation failed (fallback disabled to prevent rate limits):", error2);
      for (const item of uncachedLines) {
        cachedResults.set(item.index, {
          originalText: item.text,
          translatedText: item.text,
          targetLanguage: targetLang,
          wasTranslated: false,
          source: "api"
        });
      }
    }
    for (let i = 0; i < lines.length; i++) {
      results.push(cachedResults.get(i));
    }
    const meaningfulCount = results.reduce(
      (count, r) => r.wasTranslated && hasMeaningfulTranslationDifference(r.originalText, r.translatedText, targetLang, detectedLang) ? count + 1 : count,
      0
    );
    if (meaningfulCount === 0) {
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (!r.wasTranslated)
          continue;
        results[i] = {
          ...r,
          translatedText: r.originalText,
          wasTranslated: false
        };
      }
      if (currentTrackUri && !skipTrackCache) {
        deleteTrackCache(currentTrackUri, targetLang);
      }
      return results;
    }
    const someTranslated = results.some((r) => r.wasTranslated);
    if (currentTrackUri && results.length > 0 && someTranslated && !skipTrackCache) {
      const translatedLines = results.map((r) => r.translatedText);
      setTrackCache(
        currentTrackUri,
        targetLang,
        detectedLang,
        translatedLines,
        preferredApi,
        sourceFingerprint,
        void 0,
        void 0,
        lines,
        buildMetricsForCache(metricsSession, metricsStartedAt)
      );
    }
    return results;
  }
  function clearTranslationCache() {
    storage_default.remove("translation-cache");
    clearAllTrackCache();
  }
  function getCacheStats() {
    const lineCache = storage_default.getJSON("translation-cache", {});
    if (pruneTranslationCache(lineCache)) {
      storage_default.setJSON("translation-cache", lineCache);
    }
    const lineKeys = Object.keys(lineCache);
    const trackStats = getTrackCacheStats();
    let lineSizeBytes = 0;
    let lineOldestTimestamp = null;
    if (lineKeys.length > 0) {
      const timestamps = lineKeys.map((k) => lineCache[k].timestamp);
      lineSizeBytes = JSON.stringify(lineCache).length * 2;
      lineOldestTimestamp = Math.min(...timestamps);
    }
    const oldestTimestamp = lineOldestTimestamp !== null && trackStats.oldestTimestamp !== null ? Math.min(lineOldestTimestamp, trackStats.oldestTimestamp) : lineOldestTimestamp || trackStats.oldestTimestamp;
    return {
      entries: lineKeys.length + trackStats.trackCount,
      oldestTimestamp,
      sizeBytes: lineSizeBytes + trackStats.sizeBytes,
      trackCount: trackStats.trackCount,
      totalLines: trackStats.totalLines
    };
  }
  function getCachedTranslations() {
    const cache = storage_default.getJSON("translation-cache", {});
    if (pruneTranslationCache(cache)) {
      storage_default.setJSON("translation-cache", cache);
    }
    const entries = [];
    for (const key of Object.keys(cache)) {
      const [lang, ...textParts] = key.split(":");
      const original = textParts.join(":");
      entries.push({
        original,
        translated: cache[key].translation,
        language: lang,
        date: new Date(cache[key].timestamp),
        api: cache[key].api
      });
    }
    entries.sort((a, b) => b.date.getTime() - a.date.getTime());
    return entries;
  }
  function deleteCachedTranslation(original, language) {
    const cache = storage_default.getJSON("translation-cache", {});
    const key = `${language}:${original}`;
    if (cache[key]) {
      delete cache[key];
      storage_default.setJSON("translation-cache", cache);
      return true;
    }
    return false;
  }
  function providerSupportsWordBreakdown() {
    return true;
  }
  function breakdownKindFor(api = preferredApi) {
    return VARIANT_CAPABLE_APIS.includes(api) ? "model" : "machine";
  }
  var MACHINE_WORD_LOOKUP_LIMIT = 24;
  var MACHINE_WORD_SINGLE_FALLBACK_LIMIT = 12;
  function splitLookupLines(text3) {
    return (text3 || "").replace(/\r\n?/g, "\n").split("\n").map((line) => line.trim());
  }
  async function lookupWordsWithGoogle(words, targetLang, sourceLang) {
    await rateLimitedDelay();
    const joined = await translateWithGoogle(words.join("\n"), targetLang, sourceLang);
    const lines = splitLookupLines(joined.translation);
    while (lines.length > words.length && !lines[lines.length - 1])
      lines.pop();
    if (lines.length === words.length && lines.every(Boolean))
      return lines;
    if (words.length > MACHINE_WORD_SINGLE_FALLBACK_LIMIT)
      return null;
    const singles = await Promise.all(words.map(async (word) => {
      try {
        const result = await translateWithGoogle(word, targetLang, sourceLang);
        return result.translation.trim();
      } catch {
        return "";
      }
    }));
    return singles.some(Boolean) ? singles : null;
  }
  async function lookupWordsWithMachineTranslation(words, targetLang, sourceLang) {
    if (preferredApi === "deepl" || preferredApi === "libretranslate") {
      try {
        await rateLimitedDelay();
        const result = await translateBatchArray(words, targetLang);
        const translations = result.translations.map((value) => (value || "").trim());
        if (translations.length === words.length && translations.some(Boolean))
          return translations;
      } catch (lookupError) {
        warn("Word lookup via primary provider failed, using Google:", lookupError);
      }
    }
    return lookupWordsWithGoogle(words, targetLang, sourceLang);
  }
  async function requestMachineBreakdown(sourceText, targetLang, sourceLang) {
    const words = segmentSourceText(sourceText);
    if (words.length === 0 || words.length > MACHINE_WORD_LOOKUP_LIMIT)
      return null;
    const unique = Array.from(new Set(words));
    const translations = await lookupWordsWithMachineTranslation(unique, targetLang, sourceLang);
    if (!translations)
      return null;
    const byWord = /* @__PURE__ */ new Map();
    unique.forEach((word, index) => byWord.set(word, translations[index] || ""));
    const tokens = words.map((word) => ({
      source: word,
      target: byWord.get(word) || "",
      confidence: "medium"
    }));
    return tokens.some((token) => token.target) ? tokens : null;
  }
  async function requestModelCompletion(prompt, maxTokens) {
    if (preferredApi === "openai") {
      if (!openaiApiKey)
        throw createProviderConfigError("OpenAI API key not configured. Set it in Settings.");
      const data = await postJsonProvider(
        "https://api.openai.com/v1/chat/completions",
        {
          model: normalizeOpenAIModelName(openaiModel),
          messages: [{ role: "user", content: prompt }],
          max_completion_tokens: maxTokens
        },
        { "Authorization": `Bearer ${openaiApiKey}`, "Content-Type": "application/json" },
        "OpenAI breakdown",
        { preferCosmos: true }
      );
      recordApiUsage(extractOpenAIUsage(data));
      return data?.choices?.[0]?.message?.content?.trim() || "";
    }
    if (preferredApi === "gemini") {
      if (!geminiApiKey)
        throw createProviderConfigError("Gemini API key not configured. Set it in Settings.");
      const data = await postJsonProvider(
        getGeminiGenerateContentUrl(geminiModel),
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, maxOutputTokens: maxTokens }
        },
        getGeminiHeaders(geminiApiKey),
        "Gemini breakdown",
        { preferCosmos: true }
      );
      recordApiUsage(extractGeminiUsage(data));
      return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    }
    if (preferredApi === "grok") {
      if (!grokApiKey)
        throw createProviderConfigError("Grok (xAI) API key not configured. Set it in Settings.");
      const data = await postJsonProvider(
        "https://api.x.ai/v1/chat/completions",
        {
          model: normalizeGrokModelName(grokModel),
          messages: [{ role: "user", content: prompt }],
          temperature: 0,
          max_tokens: maxTokens
        },
        { "Authorization": `Bearer ${grokApiKey}`, "Content-Type": "application/json" },
        "Grok breakdown",
        { preferCosmos: true }
      );
      recordApiUsage(extractOpenAIUsage(data));
      return data?.choices?.[0]?.message?.content?.trim() || "";
    }
    if (preferredApi === "anthropic") {
      if (!anthropicApiKey)
        throw createProviderConfigError("Claude (Anthropic) API key not configured. Set it in Settings.");
      const model = normalizeAnthropicModelName(anthropicModel);
      const body = {
        model,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }]
      };
      if (anthropicModelSupportsThinkingToggle(model)) {
        body.thinking = { type: "disabled" };
      }
      const data = await postJsonProvider(
        "https://api.anthropic.com/v1/messages",
        body,
        {
          "x-api-key": anthropicApiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
          "Content-Type": "application/json"
        },
        "Claude breakdown",
        { preferCosmos: true }
      );
      recordApiUsage(extractAnthropicUsage(data));
      if (Array.isArray(data.content)) {
        const textBlock = data.content.find((block) => block?.type === "text" && typeof block.text === "string");
        return textBlock?.text?.trim() || "";
      }
      return "";
    }
    if (preferredApi === "custom") {
      const url = validateCustomApiUrl();
      if (!url)
        throw createProviderConfigError("Custom API URL not configured. Set it in Settings.");
      if (customApiFormat === "gemini") {
        const data2 = await postJsonProvider(
          url,
          {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0, maxOutputTokens: maxTokens }
          },
          getCustomApiHeaders("gemini"),
          "Custom breakdown",
          { preferCosmos: true }
        );
        recordApiUsage(extractGeminiUsage(data2));
        return data2?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      }
      const data = await postJsonProvider(
        url,
        {
          model: customApiModel || void 0,
          messages: [{ role: "user", content: prompt }],
          max_tokens: maxTokens
        },
        getCustomApiHeaders("openai"),
        "Custom breakdown",
        { preferCosmos: true }
      );
      recordApiUsage(extractOpenAIUsage(data));
      return data?.choices?.[0]?.message?.content?.trim() || "";
    }
    throw new Error(`Word breakdown is not supported by the ${preferredApi} provider`);
  }
  var BREAKDOWN_CACHE_KEY = "breakdown-cache";
  var BREAKDOWN_CACHE_LIMIT = 400;
  var inFlightBreakdowns = /* @__PURE__ */ new Map();
  var breakdownMemo = null;
  function loadBreakdownCache() {
    if (!breakdownMemo)
      breakdownMemo = storage_default.getJSON(BREAKDOWN_CACHE_KEY, {});
    return breakdownMemo;
  }
  function getCachedWordBreakdown(sourceText, targetLang) {
    const entry = loadBreakdownCache()[breakdownCacheKey(sourceText, targetLang)];
    if (!entry?.tokens?.length)
      return null;
    return (entry.kind || "model") === breakdownKindFor() ? entry.tokens : null;
  }
  function storeWordBreakdown(sourceText, targetLang, tokens) {
    const cache = loadBreakdownCache();
    cache[breakdownCacheKey(sourceText, targetLang)] = { tokens, timestamp: Date.now(), kind: breakdownKindFor() };
    const keys = Object.keys(cache);
    if (keys.length > BREAKDOWN_CACHE_LIMIT) {
      keys.sort((a, b) => (cache[a].timestamp || 0) - (cache[b].timestamp || 0)).slice(0, keys.length - BREAKDOWN_CACHE_LIMIT).forEach((key) => delete cache[key]);
    }
    storage_default.setJSON(BREAKDOWN_CACHE_KEY, cache);
  }
  function clearWordBreakdownCache() {
    breakdownMemo = null;
    storage_default.remove(BREAKDOWN_CACHE_KEY);
  }
  async function fetchWordBreakdown(sourceText, sourceLang, targetLang) {
    const trimmed = (sourceText || "").trim();
    if (!trimmed)
      return null;
    if (!providerSupportsWordBreakdown())
      return null;
    if (isOffline())
      return null;
    const cached = getCachedWordBreakdown(trimmed, targetLang);
    if (cached)
      return cached;
    const key = `${breakdownKindFor()}:${breakdownCacheKey(trimmed, targetLang)}`;
    const pending = inFlightBreakdowns.get(key);
    if (pending)
      return pending;
    const request = (async () => {
      try {
        if (breakdownKindFor() === "machine") {
          const machineTokens = await requestMachineBreakdown(trimmed, targetLang, sourceLang);
          if (machineTokens)
            storeWordBreakdown(trimmed, targetLang, machineTokens);
          return machineTokens;
        }
        const prompt = buildBreakdownPrompt(
          trimmed,
          getTranslationLanguageName(sourceLang || "auto"),
          getTranslationLanguageName(targetLang)
        );
        const raw = await requestModelCompletion(prompt, Math.max(600, trimmed.length * 12));
        const tokens = parseModelBreakdown(raw);
        if (tokens)
          storeWordBreakdown(trimmed, targetLang, tokens);
        return tokens;
      } catch (breakdownError) {
        warn("Word breakdown request failed:", breakdownError);
        return null;
      } finally {
        inFlightBreakdowns.delete(key);
      }
    })();
    inFlightBreakdowns.set(key, request);
    return request;
  }
  function isOffline() {
    return typeof navigator !== "undefined" && !navigator.onLine;
  }

  // src/utils/state.ts
  var DEFAULT_LIBRETRANSLATE_URL2 = "https://libretranslate.com/translate";
  function resolveStoredTargetLanguage() {
    return resolveTargetLanguage(
      storage.get("target-language") || "en",
      storage.get("language-variant") === "true",
      storage.get("preferred-api") || "google"
    );
  }
  function parseLanguageList(value) {
    return Array.from(new Set((value || "").split(",").map((code) => code.trim()).filter(Boolean)));
  }
  function resolveStoredNotificationLevel() {
    const stored = storage.get("notification-level");
    if (stored === "all" || stored === "errors" || stored === "off")
      return stored;
    return storage.get("show-notifications") === "false" ? "off" : "all";
  }
  var state = {
    isEnabled: storage.get("translation-enabled") === "true",
    isTranslating: false,
    targetLanguage: resolveStoredTargetLanguage(),
    autoTranslate: storage.get("auto-translate") === "true",
    notificationLevel: resolveStoredNotificationLevel(),
    showSkipNotice: storage.get("show-skip-notice") !== "false",
    showTranslatedNotice: storage.get("show-translated-notice") !== "false",
    get showNotifications() {
      return this.notificationLevel !== "off";
    },
    set showNotifications(value) {
      this.notificationLevel = value ? "all" : "off";
    },
    preferredApi: storage.get("preferred-api") || "google",
    customApiUrl: storage.get("custom-api-url") || "",
    customApiKey: storage.getSecret("custom-api-key") || "",
    customApiFormat: storage.get("custom-api-format") || "generic",
    customApiModel: storage.get("custom-api-model") || "",
    libreTranslateApiUrl: storage.get("libretranslate-api-url") || DEFAULT_LIBRETRANSLATE_URL2,
    libreTranslateApiKey: storage.getSecret("libretranslate-api-key") || "",
    deeplApiKey: storage.getSecret("deepl-api-key") || "",
    openaiApiKey: storage.getSecret("openai-api-key") || "",
    openaiModel: resolveModelId("openai", storage.get("openai-model")),
    geminiApiKey: storage.getSecret("gemini-api-key") || "",
    geminiModel: resolveModelId("gemini", storage.get("gemini-model")),
    geminiTemperature: storage.get("gemini-temperature") || "0.3",
    grokApiKey: storage.getSecret("grok-api-key") || "",
    grokModel: resolveModelId("grok", storage.get("grok-model")),
    anthropicApiKey: storage.getSecret("anthropic-api-key") || "",
    anthropicModel: resolveModelId("anthropic", storage.get("anthropic-model")),
    maxParallelChunks: storage.get("max-parallel-chunks") || "4",
    lastTranslatedSongUri: null,
    translatedLyrics: /* @__PURE__ */ new Map(),
    lastViewMode: null,
    translationAbortController: null,
    overlayMode: storage.get("overlay-mode") || "interleaved",
    skipLanguages: parseLanguageList(storage.get("skip-languages")),
    replaceScriptConversions: storage.get("replace-script-conversions") === "true",
    detectedLanguage: null,
    syncWordHighlight: storage.get("sync-word-highlight") !== "false",
    showQualityIndicator: storage.get("show-quality-indicator") !== "false",
    hideConnectionIndicator: storage.get("hide-connection-indicator") === "true",
    showRomanization: storage.get("show-romanization") === "true",
    learningMode: storage.get("learning-mode") === "true",
    learningVisible: storage.get("learning-visible") !== "false",
    _qualityByIndex: void 0
  };
  function isLearningActive() {
    return state.learningMode && state.learningVisible;
  }

  // src/utils/text.ts
  var INVISIBLE_SEPARATOR_REGEX = /[\u200B\u2060\uFEFF]/g;
  var DIRECTION_MARK_REGEX = /[\u200E\u200F]/g;
  var ZERO_WIDTH_REGEX = /[\u200B\u200E\u200F\u2060\uFEFF]/g;
  function cleanLyricText(text3) {
    return (text3 || "").replace(DIRECTION_MARK_REGEX, "").replace(INVISIBLE_SEPARATOR_REGEX, " ").replace(/\s+/g, " ").trim();
  }
  function normalizeLyricMatchKey(text3) {
    return (text3 || "").toLowerCase().replace(/[\s\p{P}\p{S}\u200B-\u200F\u2060\uFEFF]+/gu, "").trim();
  }
  function hasLyricText(text3) {
    return typeof text3 === "string" && text3.replace(ZERO_WIDTH_REGEX, "").trim() !== "";
  }
  function pickLyricDisplayText(text3, romanizedText) {
    if (hasLyricText(text3))
      return text3;
    return hasLyricText(romanizedText) ? romanizedText : text3 ?? "";
  }

  // src/utils/lyricsFetcher.ts
  var SPICY_API_HOST = "api.spicylyrics.org";
  var SPICY_QUERY_PATH = "/query";
  var SPICY_LYRICS_CACHE_NAMES = ["SpicyLyrics_LyricsStore_g1", "SpicyLyrics_LyricsStore"];
  var MAX_CAPTURE_CACHE_ENTRIES = 50;
  var captureCache = /* @__PURE__ */ new Map();
  var interceptorInstalled = false;
  function setCaptureCache(trackId, data) {
    if (captureCache.has(trackId)) {
      captureCache.delete(trackId);
    }
    captureCache.set(trackId, data);
    if (captureCache.size > MAX_CAPTURE_CACHE_ENTRIES) {
      const oldest = captureCache.keys().next().value;
      if (oldest !== void 0) {
        captureCache.delete(oldest);
      }
    }
  }
  function isLyricsData(obj) {
    if (!obj || typeof obj !== "object")
      return false;
    if (typeof obj.Type === "string" && (obj.Type === "Static" || obj.Type === "Line" || obj.Type === "Syllable")) {
      return true;
    }
    if (Array.isArray(obj.Content) || Array.isArray(obj.Lines))
      return true;
    return false;
  }
  function extractTrackIdFromBody(bodyText) {
    if (!bodyText)
      return null;
    try {
      const parsed = JSON.parse(bodyText);
      const queries = parsed?.queries;
      if (!Array.isArray(queries))
        return null;
      for (const q of queries) {
        const id = q?.variables?.id;
        if (typeof id === "string" && id.length > 0)
          return id;
      }
    } catch {
    }
    return null;
  }
  function processCapturedResponse(trackId, payload) {
    const queries = Array.isArray(payload?.queries) ? payload.queries : [];
    for (const q of queries) {
      const result = q?.result;
      if (!result || result.httpStatus !== 200)
        continue;
      let lyricsData = null;
      if (result.format === "json" && isLyricsData(result.data)) {
        lyricsData = result.data;
      } else if (result.format === "text" && typeof result.data === "string") {
        try {
          const parsed = JSON.parse(result.data);
          if (isLyricsData(parsed))
            lyricsData = parsed;
        } catch {
        }
      }
      if (lyricsData) {
        setCaptureCache(trackId, lyricsData);
        return;
      }
    }
  }
  async function readSpicyLyricsCache(trackId) {
    try {
      if (!trackId || typeof caches === "undefined" || typeof caches.open !== "function") {
        return null;
      }
      for (const cacheName of SPICY_LYRICS_CACHE_NAMES) {
        if (typeof caches.has === "function" && !await caches.has(cacheName)) {
          continue;
        }
        const cache = await caches.open(cacheName);
        const response = await cache.match(`/${trackId}`);
        if (!response || typeof response.json !== "function") {
          continue;
        }
        const item = await response.json();
        if (isLyricsData(item)) {
          return item;
        }
        if (!item || typeof item !== "object" || item.Value === "NO_LYRICS") {
          continue;
        }
        if (typeof item.ExpiresAt === "number" && item.ExpiresAt < Date.now()) {
          continue;
        }
        const content = item.Content;
        if (!content || content.Value === "NO_LYRICS") {
          continue;
        }
        if (isLyricsData(content)) {
          return content;
        }
      }
      return null;
    } catch (err) {
      warn("Failed to read Spicy Lyrics cache:", err);
      return null;
    }
  }
  async function getStoredLyricsData(trackId) {
    const captured = captureCache.get(trackId);
    if (captured)
      return captured;
    const cached = await readSpicyLyricsCache(trackId);
    if (cached) {
      setCaptureCache(trackId, cached);
      return cached;
    }
    return null;
  }
  function installFetchInterceptor() {
    if (interceptorInstalled)
      return;
    if (typeof window === "undefined" || typeof window.fetch !== "function")
      return;
    interceptorInstalled = true;
    const origFetch = window.fetch.bind(window);
    window.fetch = async function patchedFetch(input, init) {
      let url;
      try {
        if (typeof input === "string")
          url = input;
        else if (input instanceof URL)
          url = input.href;
        else
          url = input.url;
      } catch {
        return origFetch(input, init);
      }
      if (!url.includes(SPICY_API_HOST) || !url.includes(SPICY_QUERY_PATH)) {
        return origFetch(input, init);
      }
      let trackId = null;
      try {
        if (typeof init?.body === "string") {
          trackId = extractTrackIdFromBody(init.body);
        } else if (input instanceof Request) {
          const cloned = input.clone();
          const bodyText = await cloned.text();
          trackId = extractTrackIdFromBody(bodyText);
        }
      } catch {
      }
      const response = await origFetch(input, init);
      if (trackId) {
        const capturedTrackId = trackId;
        response.clone().json().then((data) => {
          processCapturedResponse(capturedTrackId, data);
        }).catch(() => {
        });
      }
      return response;
    };
  }
  installFetchInterceptor();
  async function waitForCapture(trackId, timeoutMs = 8e3, pollMs = 100) {
    const start = Date.now();
    let nextStoreCheck = 0;
    while (Date.now() - start < timeoutMs) {
      const cached = captureCache.get(trackId);
      if (cached)
        return cached;
      if (Date.now() >= nextStoreCheck) {
        const stored = await getStoredLyricsData(trackId);
        if (stored)
          return stored;
        nextStoreCheck = Date.now() + 500;
      }
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
    return getStoredLyricsData(trackId);
  }
  function getCurrentTrackId() {
    try {
      const uri = globalThis.Spicetify?.Player?.data?.item?.uri;
      if (uri && typeof uri === "string") {
        const parts = uri.split(":");
        return parts[parts.length - 1] || null;
      }
    } catch (e) {
    }
    return null;
  }
  function getTrackIdFromUri(trackUri) {
    if (!trackUri || typeof trackUri !== "string") {
      return null;
    }
    const parts = trackUri.split(":");
    return parts[parts.length - 1] || null;
  }
  function extractContentLinesData(lyrics) {
    const lineData = [];
    if (!lyrics.Content)
      return lineData;
    for (const group of lyrics.Content) {
      if (group.Type === "Instrumental") {
        const st = group.Lead?.StartTime ?? group.StartTime ?? 0;
        const et = group.Lead?.EndTime ?? group.EndTime ?? 0;
        lineData.push({
          text: "",
          startTime: st,
          endTime: et,
          isInstrumental: true
        });
        continue;
      }
      if (group.Lead?.Syllables && group.Lead.Syllables.length > 0) {
        const syllables = group.Lead.Syllables.filter(
          (syllable) => hasLyricText(syllable.Text) || hasLyricText(syllable.TransliteratedText ?? syllable.RomanizedText)
        );
        if (syllables.length === 0)
          continue;
        const wordTimings = [];
        let lineText = "";
        let romanizedText = "";
        let anyRomanized = false;
        for (let i = 0; i < syllables.length; i++) {
          const syllable = syllables[i];
          const prev = i > 0 ? syllables[i - 1] : null;
          const syllableRoman = syllable.TransliteratedText ?? syllable.RomanizedText;
          const syllableText = pickLyricDisplayText(syllable.Text, syllableRoman);
          wordTimings.push({
            text: syllableText,
            startTime: syllable.StartTime,
            endTime: syllable.EndTime,
            isPartOfWord: syllable.IsPartOfWord
          });
          const romanSyl = syllableRoman ?? syllableText;
          if (syllableRoman && syllableRoman !== syllableText) {
            anyRomanized = true;
          }
          const startsNewWord = prev !== null && !prev.IsPartOfWord;
          if (startsNewWord) {
            lineText += " ";
            if (romanizedText.length > 0)
              romanizedText += " ";
          }
          lineText += syllableText;
          romanizedText += romanSyl;
        }
        lineData.push({
          text: cleanLyricText(lineText),
          startTime: group.Lead.StartTime,
          endTime: group.Lead.EndTime,
          isInstrumental: false,
          romanizedText: anyRomanized ? romanizedText.replace(/\s+/g, " ").trim() : void 0,
          words: wordTimings
        });
        continue;
      }
      if (group.Text !== void 0 && group.StartTime !== void 0 && group.EndTime !== void 0) {
        if (!hasLyricText(group.Text) && !hasLyricText(group.TransliteratedText))
          continue;
        const groupText = pickLyricDisplayText(String(group.Text), group.TransliteratedText);
        const groupRoman = group.TransliteratedText && group.TransliteratedText !== groupText ? group.TransliteratedText : void 0;
        lineData.push({
          text: cleanLyricText(groupText),
          startTime: group.StartTime,
          endTime: group.EndTime,
          isInstrumental: false,
          romanizedText: groupRoman
        });
        continue;
      }
      if (group.Lead) {
        const leadText = group.Lead.Text;
        if (leadText !== void 0) {
          if (!hasLyricText(leadText))
            continue;
          lineData.push({
            text: cleanLyricText(String(leadText)),
            startTime: group.Lead.StartTime,
            endTime: group.Lead.EndTime,
            isInstrumental: false
          });
          continue;
        }
      }
    }
    return lineData;
  }
  function extractStaticLinesData(lyrics) {
    if (!lyrics.Lines)
      return [];
    return lyrics.Lines.filter((line) => hasLyricText(line.Text) || hasLyricText(line.TransliteratedText)).map((line) => {
      const text3 = pickLyricDisplayText(line.Text, line.TransliteratedText);
      return {
        text: cleanLyricText(text3),
        startTime: 0,
        endTime: 0,
        isInstrumental: false,
        romanizedText: line.TransliteratedText && line.TransliteratedText !== text3 ? line.TransliteratedText : void 0
      };
    });
  }
  function extractLinesData(lyrics) {
    switch (lyrics.Type) {
      case "Syllable":
      case "Line":
        return extractContentLinesData(lyrics);
      case "Static":
        return extractStaticLinesData(lyrics);
      default:
        if (lyrics.Content && lyrics.Content.length > 0) {
          return extractContentLinesData(lyrics);
        }
        warn("Unknown lyrics type and no Content:", lyrics.Type, JSON.stringify(Object.keys(lyrics)));
        return [];
    }
  }
  var cachedTrackId = null;
  var cachedLineData = null;
  var cachedLanguage = null;
  function getLyricsLanguage(lyrics) {
    const iso = normalizeLanguageCode(lyrics.LanguageISO2);
    if (iso !== "unknown" && iso !== "auto")
      return iso;
    const language = normalizeLanguageCode(lyrics.Language);
    if (language !== "unknown" && language !== "auto")
      return language;
    return void 0;
  }
  function cacheParsedLyrics(trackId, lyrics) {
    const lineData = extractLinesData(lyrics);
    if (lineData.length === 0) {
      return null;
    }
    cachedTrackId = trackId;
    cachedLineData = lineData;
    cachedLanguage = getLyricsLanguage(lyrics) || null;
    return {
      lines: lineData.map((l) => l.text),
      lineData,
      language: cachedLanguage || void 0
    };
  }
  async function fetchLyricsFromAPI() {
    const trackId = getCurrentTrackId();
    if (!trackId) {
      return null;
    }
    if (trackId === cachedTrackId && cachedLineData) {
      return {
        lines: cachedLineData.map((l) => l.text),
        lineData: cachedLineData,
        language: cachedLanguage || void 0
      };
    }
    try {
      const lyrics = await getStoredLyricsData(trackId) || await waitForCapture(trackId);
      if (!lyrics) {
        return null;
      }
      return cacheParsedLyrics(trackId, lyrics);
    } catch (err) {
      warn("Failed to capture lyrics from Spicy Lyrics fetch:", err);
      return null;
    }
  }
  async function fetchLyricsForTrackUri(trackUri) {
    const trackId = getTrackIdFromUri(trackUri);
    if (!trackId) {
      return null;
    }
    if (trackId === cachedTrackId && cachedLineData) {
      return {
        lines: cachedLineData.map((l) => l.text),
        lineData: cachedLineData,
        language: cachedLanguage || void 0
      };
    }
    try {
      const lyrics = await getStoredLyricsData(trackId) || await waitForCapture(trackId);
      if (!lyrics) {
        return null;
      }
      return cacheParsedLyrics(trackId, lyrics);
    } catch (err) {
      warn("Failed to capture lyrics for track URI:", trackUri, err);
      return null;
    }
  }
  function clearLyricsCache() {
    cachedTrackId = null;
    cachedLineData = null;
    cachedLanguage = null;
    captureCache.clear();
  }

  // src/utils/translationOverlay.ts
  var CINEMA_CONTAINER_SELECTOR = ".Cinema--Container, .spicy-lyrics-cinema, .Root__cinema-view";
  var CINEMA_LYRICS_CONTENT_SELECTOR = ".Cinema--Container .LyricsContent, .spicy-lyrics-cinema .LyricsContent, .Root__cinema-view .LyricsContent";
  function isSidebarLyricsActive(doc = document) {
    if (doc.body?.classList?.contains("SpicySidebarLyrics__Active"))
      return true;
    return Boolean(doc.querySelector("#SpicyLyricsNPVCard #SpicyLyricsPage, #SpicyLyricsPage.CardMode"));
  }
  function findSidebarLyricsPage(doc = document) {
    return doc.querySelector("#SpicyLyricsNPVCard #SpicyLyricsPage") || doc.querySelector("#SpicyLyricsPage.CardMode") || doc.querySelector(":is(.Root__right-sidebar, #Desktop_PanelContainer_Id) #SpicyLyricsPage");
  }
  var currentConfig = {
    mode: "replace",
    opacity: 0.85,
    fontSize: 0.9,
    syncWordHighlight: true,
    showRomanization: false,
    learningMode: false
  };
  var isOverlayEnabled = false;
  var translationMap = /* @__PURE__ */ new Map();
  var romanizationMap = /* @__PURE__ */ new Map();
  var originalTextMap = /* @__PURE__ */ new Map();
  var lineTimingData = [];
  var qualityMap = /* @__PURE__ */ new Map();
  var translationByContent = /* @__PURE__ */ new Map();
  var romanizationByContent = /* @__PURE__ */ new Map();
  var originalByContent = /* @__PURE__ */ new Map();
  var qualityByContent = /* @__PURE__ */ new Map();
  var timingByContent = /* @__PURE__ */ new Map();
  function normalizeCompare(text3) {
    return normalizeLyricMatchKey(text3);
  }
  function buildContentLookupKeys(text3) {
    const nonLatinOnly = text3.replace(/[A-Za-z0-9]/g, " ").replace(/\s+/g, " ").trim();
    const latinOnly = text3.replace(/[^A-Za-z0-9\s'\-]/g, " ").replace(/\s+/g, " ").trim();
    return {
      norm: normalizeCompare(text3),
      nonLatinNorm: nonLatinOnly && nonLatinOnly !== text3 ? normalizeCompare(nonLatinOnly) : "",
      latinNorm: latinOnly && latinOnly !== text3 ? normalizeCompare(latinOnly) : ""
    };
  }
  function lookupByKeys(map, keys) {
    if (map.size === 0)
      return void 0;
    const { norm, nonLatinNorm, latinNorm } = keys;
    if (norm) {
      const direct = map.get(norm);
      if (direct !== void 0)
        return direct;
    }
    if (nonLatinNorm) {
      const match = map.get(nonLatinNorm);
      if (match !== void 0)
        return match;
    }
    if (latinNorm) {
      const match = map.get(latinNorm);
      if (match !== void 0)
        return match;
    }
    if (norm && norm.length >= 4) {
      let best = null;
      for (const [key, value] of map) {
        if (key.length < 4)
          continue;
        if (norm.includes(key) || key.includes(norm)) {
          const ratio = Math.min(key.length, norm.length) / Math.max(key.length, norm.length);
          if (ratio < 0.8)
            continue;
          if (!best || key.length > best.key.length) {
            best = { key, value };
          }
        }
      }
      if (best)
        return best.value;
    }
    return void 0;
  }
  function lookupByContent(map, text3) {
    if (!text3 || map.size === 0)
      return void 0;
    return lookupByKeys(map, buildContentLookupKeys(text3));
  }
  function hasContentData() {
    return translationByContent.size > 0 || romanizationByContent.size > 0 || originalByContent.size > 0;
  }
  function rebuildPerLineMaps(lines, lineTexts) {
    if (!hasContentData())
      return;
    const nextTranslation = /* @__PURE__ */ new Map();
    const nextRomanization = /* @__PURE__ */ new Map();
    const nextOriginal = /* @__PURE__ */ new Map();
    const nextQuality = /* @__PURE__ */ new Map();
    const nextTiming = [];
    let contentLines = 0;
    let matchedLines = 0;
    for (let index = 0; index < lines.length; index++) {
      const text3 = lineTexts[index];
      if (!text3)
        continue;
      contentLines++;
      const keys = buildContentLookupKeys(text3);
      const t = lookupByKeys(translationByContent, keys);
      if (t) {
        nextTranslation.set(index, t);
        matchedLines++;
      }
      const r = lookupByKeys(romanizationByContent, keys);
      if (r)
        nextRomanization.set(index, r);
      const o = lookupByKeys(originalByContent, keys);
      if (o)
        nextOriginal.set(index, o);
      const q = lookupByKeys(qualityByContent, keys);
      if (q)
        nextQuality.set(index, q);
      const tim = lookupByKeys(timingByContent, keys);
      if (tim)
        nextTiming[index] = tim;
    }
    const coverageCollapsed = contentLines > 0 && matchedLines * 2 < contentLines && translationMap.size > matchedLines;
    if (coverageCollapsed)
      return;
    translationMap = nextTranslation;
    romanizationMap = nextRomanization;
    originalTextMap = nextOriginal;
    qualityMap = nextQuality;
    lineTimingData = nextTiming;
  }
  function setTranslationContentData(data) {
    translationByContent = new Map(data);
  }
  function setRomanizationContentData(data) {
    romanizationByContent = new Map(data);
  }
  function setOriginalContentData(data) {
    originalByContent = new Map(data);
  }
  function setQualityContentData(data) {
    qualityByContent = new Map(data);
  }
  function setTimingContentData(data) {
    timingByContent = new Map(data);
  }
  var lastRenderSigMap = /* @__PURE__ */ new WeakMap();
  var lastRenderedLinesMap = /* @__PURE__ */ new WeakMap();
  var lastRenderedOutputMap = /* @__PURE__ */ new WeakMap();
  function extractLineTexts(lines) {
    const texts = [];
    for (let i = 0; i < lines.length; i++) {
      texts.push(extractLineText(lines[i]));
    }
    return texts;
  }
  function computeRenderSignature(lines, lineTexts) {
    const parts = [
      currentConfig.mode,
      currentConfig.syncWordHighlight ? "1" : "0",
      currentConfig.showRomanization ? "1" : "0"
    ];
    for (let i = 0; i < lines.length; i++) {
      const text3 = lineTexts[i];
      const tr = translationMap.get(i) || "";
      const rom = romanizationMap.get(i) || "";
      const orig = originalTextMap.get(i) || "";
      parts.push(`${text3}${tr}${rom}${orig}`);
    }
    return parts.join("");
  }
  var RENDERED_OUTPUT_SELECTOR = ".slt-interleaved-translation, .slt-replace-line, .slt-romanization-line, .slt-original-line";
  function countRenderedOutput(doc) {
    return doc.querySelectorAll(RENDERED_OUTPUT_SELECTOR).length;
  }
  function renderedTargetsIntact(doc, lines) {
    const previous = lastRenderedLinesMap.get(doc);
    if (!previous || previous.length !== lines.length)
      return false;
    for (let i = 0; i < previous.length; i++) {
      const line = previous[i];
      if (line !== lines[i] || !line.isConnected)
        return false;
    }
    return lastRenderedOutputMap.get(doc) === countRenderedOutput(doc);
  }
  function renderSignatureUnchanged(doc, lines, lineTexts) {
    const sig = computeRenderSignature(lines, lineTexts);
    if (lastRenderSigMap.get(doc) === sig && renderedTargetsIntact(doc, lines))
      return true;
    lastRenderSigMap.set(doc, sig);
    lastRenderedLinesMap.set(doc, Array.from(lines));
    return false;
  }
  function markRenderComplete(doc) {
    lastRenderedOutputMap.set(doc, countRenderedOutput(doc));
  }
  function forgetRenderState(doc) {
    lastRenderSigMap.delete(doc);
    lastRenderedLinesMap.delete(doc);
    lastRenderedOutputMap.delete(doc);
  }
  function buildRomanizationLine(doc, index, timingInfo, line, text3) {
    const romanized = text3 !== void 0 ? text3 : romanizationMap.get(index);
    if (!romanized || !romanized.trim())
      return null;
    if (timingInfo?.isInstrumental)
      return null;
    const romanEl = doc.createElement("div");
    romanEl.className = "slt-romanization-line";
    romanEl.dataset.forLine = index.toString();
    romanEl.dataset.lineIndex = index.toString();
    romanEl.textContent = romanized;
    if (timingInfo) {
      romanEl.dataset.startTime = timingInfo.startTime.toString();
      romanEl.dataset.endTime = timingInfo.endTime.toString();
    }
    if (isLineActive(line))
      romanEl.classList.add("active");
    return romanEl;
  }
  function siblingSkippingRomanization(el2, dir) {
    let cur = dir === "next" ? el2.nextElementSibling : el2.previousElementSibling;
    while (cur && cur.classList.contains("slt-romanization-line")) {
      cur = dir === "next" ? cur.nextElementSibling : cur.previousElementSibling;
    }
    return cur;
  }
  function romanizationCompanionText(line, index, mode) {
    if (!currentConfig.showRomanization)
      return "";
    const domText = extractLineText(line);
    const nDom = normalizeCompare(domText);
    const apiOriginal = (originalTextMap.get(index) || "").trim();
    const apiRomanized = (romanizationMap.get(index) || "").trim();
    if (mode === "replace") {
      if (apiRomanized)
        return apiRomanized;
      if (isMostlyLatin(domText) && apiOriginal && normalizeCompare(apiOriginal) !== nDom)
        return domText;
      return "";
    }
    const screenShowsRomanization = apiRomanized !== "" && normalizeCompare(apiRomanized) === nDom;
    const candidates = screenShowsRomanization ? [apiOriginal, apiRomanized] : [apiRomanized, apiOriginal];
    for (const candidate of candidates) {
      if (!candidate)
        continue;
      if (normalizeCompare(candidate) === nDom)
        continue;
      return candidate;
    }
    return "";
  }
  function isMostlyLatin(text3) {
    const letters = (text3 || "").replace(/[^\p{L}]/gu, "");
    if (!letters)
      return false;
    const latin = letters.replace(/[^\p{Script=Latin}]/gu, "");
    return latin.length / letters.length >= 0.8;
  }
  function getPIPWindow() {
    try {
      const docPiP = globalThis.documentPictureInPicture;
      if (docPiP && docPiP.window) {
        return docPiP.window;
      }
    } catch (e) {
    }
    return null;
  }
  function getLyricLines(doc) {
    const isPipDoc = !!doc.querySelector(".spicy-pip-wrapper");
    const excludeSelector = ":not(.musical-line):not(.bg-line)";
    if (isPipDoc) {
      const pipLines = doc.querySelectorAll(`.spicy-pip-wrapper #SpicyLyricsPage .SpicyLyricsScrollContainer .line${excludeSelector}`);
      if (pipLines.length > 0)
        return pipLines;
      const pipLinesAlt = doc.querySelectorAll(`.spicy-pip-wrapper .SpicyLyricsScrollContainer .line${excludeSelector}`);
      if (pipLinesAlt.length > 0)
        return pipLinesAlt;
      const pipLinesFallback = doc.querySelectorAll(`.spicy-pip-wrapper .line${excludeSelector}`);
      if (pipLinesFallback.length > 0)
        return pipLinesFallback;
    }
    const scrollContainerLines = doc.querySelectorAll(`#SpicyLyricsPage .SpicyLyricsScrollContainer .line${excludeSelector}`);
    if (scrollContainerLines.length > 0)
      return scrollContainerLines;
    if (isSidebarLyricsActive(doc)) {
      const sidebarPage = findSidebarLyricsPage(doc);
      const sidebarLines = sidebarPage?.querySelectorAll(`.line${excludeSelector}`);
      if (sidebarLines && sidebarLines.length > 0)
        return sidebarLines;
    }
    const compactLines = doc.querySelectorAll(`#SpicyLyricsPage.ForcedCompactMode .line${excludeSelector}`);
    if (compactLines.length > 0)
      return compactLines;
    const lyricsContentLines = doc.querySelectorAll(`#SpicyLyricsPage .LyricsContent .line${excludeSelector}`);
    if (lyricsContentLines.length > 0)
      return lyricsContentLines;
    return doc.querySelectorAll(`.SpicyLyricsScrollContainer .line${excludeSelector}, .LyricsContent .line${excludeSelector}, .LyricsContainer .line${excludeSelector}`);
  }
  function findLyricsContainer(doc) {
    const pipWrapper = doc.querySelector(".spicy-pip-wrapper");
    if (pipWrapper) {
      const pipScrollContainer = pipWrapper.querySelector("#SpicyLyricsPage .SpicyLyricsScrollContainer");
      if (pipScrollContainer)
        return pipScrollContainer;
      const pipLyricsContent = pipWrapper.querySelector("#SpicyLyricsPage .LyricsContent");
      if (pipLyricsContent)
        return pipLyricsContent;
      const pipPage = pipWrapper.querySelector("#SpicyLyricsPage");
      if (pipPage)
        return pipPage;
      return pipWrapper;
    }
    const scrollContainer = doc.querySelector("#SpicyLyricsPage .SpicyLyricsScrollContainer");
    if (scrollContainer)
      return scrollContainer;
    if (isSidebarLyricsActive(doc)) {
      const sidebarPage = findSidebarLyricsPage(doc);
      const sidebarContainer = sidebarPage?.querySelector(".SpicyLyricsScrollContainer") || sidebarPage?.querySelector(".LyricsContent");
      if (sidebarContainer)
        return sidebarContainer;
    }
    return doc.querySelector("#SpicyLyricsPage .LyricsContent") || doc.querySelector(".LyricsContent") || doc.querySelector(".LyricsContainer");
  }
  function extractLineText(line) {
    const wordGroups = line.querySelectorAll(":scope > .word-group");
    const directWords = line.querySelectorAll(":scope > .word:not(.dot), :scope > .letterGroup");
    if (wordGroups.length > 0 || directWords.length > 0) {
      const parts = [];
      const children = line.children;
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.classList.contains("word-group")) {
          const groupText = child.textContent?.trim() || "";
          if (groupText)
            parts.push(groupText);
        } else if (child.classList.contains("letterGroup")) {
          const groupText = child.textContent?.trim() || "";
          if (groupText)
            parts.push(groupText);
        } else if (child.classList.contains("word") && !child.classList.contains("dot")) {
          const wordText = child.textContent?.trim() || "";
          if (wordText)
            parts.push(wordText);
        } else if (child.classList.contains("dotGroup")) {
          continue;
        }
      }
      if (parts.length > 0) {
        return cleanLyricText(parts.join(" "));
      }
    }
    const words = line.querySelectorAll(".word:not(.dot), .letterGroup");
    if (words.length > 0) {
      const wordUnits = Array.from(words).filter((w) => {
        if (w.classList.contains("letterGroup"))
          return true;
        if (w.closest(".letterGroup"))
          return false;
        return true;
      });
      return cleanLyricText(wordUnits.map((w) => w.textContent || "").join(" "));
    }
    return cleanLyricText(line.textContent);
  }
  var wordUnitsCache = /* @__PURE__ */ new WeakMap();
  function invalidateWordUnitsCache() {
    wordUnitsCache = /* @__PURE__ */ new WeakMap();
  }
  function getWordUnits(line) {
    const cached = wordUnitsCache.get(line);
    if (cached)
      return cached;
    const units = computeWordUnits(line);
    wordUnitsCache.set(line, units);
    return units;
  }
  function computeWordUnits(line) {
    const units = [];
    const allElements = line.querySelectorAll(".word:not(.dot), .letterGroup, .syllable");
    for (const el2 of Array.from(allElements)) {
      if (el2.closest(".letterGroup") && !el2.classList.contains("letterGroup")) {
        continue;
      }
      let isNested = false;
      for (const unit of units) {
        if (unit.contains(el2) && unit !== el2) {
          isNested = true;
          break;
        }
      }
      if (!isNested) {
        units.push(el2);
      }
    }
    return units;
  }
  function isLineActive(line) {
    const classList = line.classList;
    if (classList.contains("Active"))
      return true;
    if (classList.contains("active"))
      return true;
    if (classList.contains("current"))
      return true;
    if (classList.contains("is-active"))
      return true;
    if (!classList.contains("Sung") && !classList.contains("NotSung") && !classList.contains("musical-line")) {
      return true;
    }
    return line.classList.contains("Active") || line.classList.contains("playing") || line.getAttribute("data-active") === "true" || line.dataset.active === "true";
  }
  function findOriginalLineForTranslation(transEl) {
    let prev = transEl.previousElementSibling;
    while (prev && !prev.classList.contains("line")) {
      prev = prev.previousElementSibling;
    }
    return prev;
  }
  function adjacentOriginalLine(el2) {
    if (el2.classList.contains("slt-original-line")) {
      let next = el2.nextElementSibling;
      while (next && !next.classList.contains("line")) {
        next = next.nextElementSibling;
      }
      return next;
    }
    return findOriginalLineForTranslation(el2);
  }
  function applyReplaceMode(doc) {
    invalidateWordUnitsCache();
    const lines = getLyricLines(doc);
    const lineTexts = extractLineTexts(lines);
    rebuildPerLineMaps(lines, lineTexts);
    if (renderSignatureUnchanged(doc, lines, lineTexts))
      return;
    const lyricsContainer = doc.querySelector(".SpicyLyricsScrollContainer");
    const lyricsType = lyricsContainer?.getAttribute("data-lyrics-type") || "Line";
    const claimed = /* @__PURE__ */ new Set();
    lines.forEach((line, index) => {
      const lineEl = line;
      const translation = translationMap.get(index);
      const originalText = lineTexts[index];
      let existing = siblingSkippingRomanization(line, "next");
      if (existing && !existing.classList.contains("slt-replace-line"))
        existing = null;
      const wants = !!translation && translation !== originalText && !!line.parentNode;
      if (!wants) {
        if (existing)
          existing.remove();
        const staleRom = line.nextElementSibling;
        if (staleRom && staleRom.classList.contains("slt-romanization-line"))
          staleRom.remove();
        lineEl.classList.remove("slt-replace-hidden");
        return;
      }
      const timingInfo = lineTimingData[index];
      const isBreak = !originalText.trim() || /^[♪♫•\-–—\s]+$/.test(originalText.trim());
      const hasRomanization = !!romanizationMap.get(index);
      const isInstrumental = timingInfo?.isInstrumental || isBreak;
      const romanizationText = isInstrumental ? "" : romanizationCompanionText(line, index, "replace");
      const sig = [
        translation,
        isInstrumental ? "I" : "",
        currentConfig.syncWordHighlight ? "W" : "",
        romanizationText
      ].join("");
      lineEl.classList.add("slt-replace-hidden");
      lineEl.dataset.sltIndex = index.toString();
      const refreshRomanization = (anchor) => {
        let existingRom = anchor.nextElementSibling;
        if (existingRom && !existingRom.classList.contains("slt-romanization-line"))
          existingRom = null;
        if (!romanizationText) {
          if (existingRom)
            existingRom.remove();
          return;
        }
        if (existingRom) {
          if (existingRom.textContent !== romanizationText)
            existingRom.textContent = romanizationText;
          existingRom.dataset.lineIndex = index.toString();
          existingRom.dataset.forLine = index.toString();
          if (timingInfo) {
            existingRom.dataset.startTime = timingInfo.startTime.toString();
            existingRom.dataset.endTime = timingInfo.endTime.toString();
          }
          existingRom.classList.toggle("active", isLineActive(line));
          claimed.add(existingRom);
          return;
        }
        const romEl = buildRomanizationLine(doc, index, timingInfo, line, romanizationText);
        if (romEl) {
          anchor.parentNode.insertBefore(romEl, anchor.nextSibling);
          claimed.add(romEl);
        }
      };
      if (existing && existing.dataset.sltSig === sig) {
        existing.dataset.lineIndex = index.toString();
        existing.dataset.forLine = index.toString();
        if (timingInfo) {
          existing.dataset.startTime = timingInfo.startTime.toString();
          existing.dataset.endTime = timingInfo.endTime.toString();
        }
        claimed.add(existing);
        refreshRomanization(existing);
        return;
      }
      if (existing)
        existing.remove();
      const replaceEl = doc.createElement("div");
      replaceEl.className = "slt-replace-line slt-sync-translation";
      replaceEl.dataset.lineIndex = index.toString();
      replaceEl.dataset.forLine = index.toString();
      replaceEl.dataset.lyricsType = lyricsType;
      replaceEl.dataset.sltSig = sig;
      if (isInstrumental) {
        replaceEl.textContent = "\u266A \u266A \u266A";
        replaceEl.classList.add("slt-replace-instrumental");
      } else {
        if (currentConfig.syncWordHighlight) {
          appendTranslationWordSpans(doc, replaceEl, translation, line, "slt-replace-word");
        } else {
          replaceEl.textContent = translation;
        }
      }
      if (timingInfo) {
        replaceEl.dataset.startTime = timingInfo.startTime.toString();
        replaceEl.dataset.endTime = timingInfo.endTime.toString();
      }
      replaceEl.addEventListener("click", (e) => {
        e.preventDefault();
        const clickedWord = e.target?.closest?.(".slt-replace-word");
        if (clickedWord) {
          const originalIndex = parseInt(clickedWord.dataset.originalIndex || "-1", 10);
          const originalWords = getWordUnits(line);
          if (originalIndex >= 0 && originalIndex < originalWords.length) {
            originalWords[originalIndex].click();
            return;
          }
        }
        const firstClickable = line.querySelector(".word:not(.dot)") || line.querySelector(".letterGroup");
        if (firstClickable) {
          firstClickable.click();
        } else {
          line.click();
        }
      });
      if (isLineActive(line)) {
        replaceEl.classList.add("active");
      }
      const qualityIndicator = createQualityIndicator(doc, index);
      if (qualityIndicator) {
        replaceEl.appendChild(qualityIndicator);
      }
      line.parentNode.insertBefore(replaceEl, line.nextSibling);
      claimed.add(replaceEl);
      refreshRomanization(replaceEl);
    });
    doc.querySelectorAll(".slt-replace-line, .slt-original-line, .slt-romanization-line").forEach((el2) => {
      if (!claimed.has(el2))
        el2.remove();
    });
    markRenderComplete(doc);
  }
  function appendTranslationWordSpans(doc, container, translation, originalLine, wordClassName) {
    const translatedWords = translation.trim().split(/\s+/).filter(Boolean);
    if (translatedWords.length === 0) {
      container.textContent = translation || "";
      return;
    }
    const originalWords = getWordUnits(originalLine);
    const ratio = translatedWords.length / Math.max(originalWords.length, 1);
    const shouldAnimateLetters = false;
    translatedWords.forEach((word, wordIndex) => {
      const span = doc.createElement("span");
      span.className = wordClassName;
      if (wordClassName === "slt-sync-word") {
        span.classList.add("slt-word-future");
      } else {
        span.classList.add("word-notsng");
      }
      const originalIndex = originalWords.length > 0 ? Math.min(Math.floor(wordIndex / Math.max(ratio, 0.01)), originalWords.length - 1) : wordIndex;
      span.dataset.originalIndex = Math.max(0, originalIndex).toString();
      span.dataset.wordIndex = wordIndex.toString();
      if (shouldAnimateLetters) {
        appendSyncWordLetters(doc, span, word, wordIndex < translatedWords.length - 1);
      } else {
        span.textContent = wordIndex < translatedWords.length - 1 ? word + " " : word;
      }
      container.appendChild(span);
    });
  }
  function lineHasWordStructure(line) {
    return !!line.querySelector(".word:not(.dot), .letterGroup, .word-group, .syllable");
  }
  function splitIntoGraphemes(text3) {
    const segmenterCtor = globalThis.Intl?.Segmenter;
    if (typeof segmenterCtor === "function") {
      const segmenter = new segmenterCtor(void 0, { granularity: "grapheme" });
      return Array.from(segmenter.segment(text3), (segment) => segment.segment);
    }
    return Array.from(text3);
  }
  function appendSyncWordLetters(doc, wordEl, word, appendTrailingSpace) {
    const graphemes = splitIntoGraphemes(word);
    wordEl.textContent = "";
    graphemes.forEach((grapheme, letterIndex) => {
      const letterSpan = doc.createElement("span");
      letterSpan.className = "slt-sync-letter slt-letter-future";
      letterSpan.dataset.letterIndex = letterIndex.toString();
      letterSpan.textContent = grapheme;
      wordEl.appendChild(letterSpan);
    });
    if (appendTrailingSpace) {
      wordEl.appendChild(doc.createTextNode(" "));
    }
  }
  function getMappedOriginalLetterProgresses(originalLine, mappedIndex) {
    const originalWords = getWordUnits(originalLine);
    if (mappedIndex < 0 || mappedIndex >= originalWords.length)
      return null;
    const sourceWord = originalWords[mappedIndex];
    if (!sourceWord.classList.contains("letterGroup"))
      return null;
    const sourceLetters = Array.from(sourceWord.querySelectorAll(".letter"));
    if (sourceLetters.length < 2)
      return null;
    const progressValues = sourceLetters.map((letterEl) => parseFloat(letterEl.style.getPropertyValue("--gradient-position"))).filter((value) => !isNaN(value)).map((value) => Math.max(0, Math.min(1, (value + 20) / 120)));
    if (progressValues.length < 2)
      return null;
    const hasSustainProgress = progressValues.some((value) => value > 0.05 && value < 0.95);
    if (!hasSustainProgress)
      return null;
    return progressValues;
  }
  function updateSyncWordLetterStates(wordEl, gradientPosition, isWordActive, isWordSung, originalLine, mappedOriginalIndex) {
    const letters = Array.from(wordEl.querySelectorAll(":scope > .slt-sync-letter"));
    if (letters.length === 0)
      return;
    const sourceLetterProgresses = getMappedOriginalLetterProgresses(originalLine, mappedOriginalIndex);
    const hasSustainedSource = !!sourceLetterProgresses;
    const progress = Math.max(0, Math.min(1, (gradientPosition + 20) / 120));
    const travelingProgress = progress * letters.length;
    letters.forEach((letterEl, index) => {
      let localProgress = Math.max(0, Math.min(1, travelingProgress - index));
      let isLetterPast = travelingProgress >= index + 1;
      let isLetterActive = !isLetterPast && localProgress > 0;
      if (hasSustainedSource && sourceLetterProgresses) {
        const sourceIndex = Math.floor(index / Math.max(letters.length - 1, 1) * (sourceLetterProgresses.length - 1));
        const sourceProgress = sourceLetterProgresses[sourceIndex];
        localProgress = sourceProgress;
        isLetterPast = sourceProgress >= 0.95;
        isLetterActive = sourceProgress > 0.05 && sourceProgress < 0.95;
      }
      letterEl.classList.toggle("slt-letter-past", isLetterPast);
      letterEl.classList.toggle("slt-letter-active", isLetterActive);
      letterEl.classList.toggle("slt-letter-future", !isLetterPast && !isLetterActive);
      let yShift = 0;
      if (isWordActive && hasSustainedSource) {
        yShift = -0.2 * Math.sin(localProgress * Math.PI);
      } else if (isWordSung) {
        yShift = -0.015;
      }
      setStyleProp(letterEl, "--slt-letter-shift", `${yShift.toFixed(3)}em`);
    });
  }
  function hasWrappedSyncWords(translationEl) {
    const words = Array.from(translationEl.querySelectorAll(":scope > .slt-sync-word"));
    if (words.length < 2)
      return false;
    const firstTop = words[0].offsetTop;
    return words.some((wordEl, index) => index > 0 && Math.abs(wordEl.offsetTop - firstTop) > 2);
  }
  function fallbackToContinuousMultilineGradient(translationEl, translationText, originalLine) {
    if (lineHasWordStructure(originalLine))
      return;
    if (!translationEl.querySelector(":scope > .slt-sync-word"))
      return;
    if (!hasWrappedSyncWords(translationEl))
      return;
    translationEl.textContent = translationText;
    translationEl.dataset.sltGradientMode = "continuous-multiline";
  }
  function applyInterleavedMode(doc) {
    try {
      invalidateWordUnitsCache();
      const lines = getLyricLines(doc);
      if (!lines || lines.length === 0) {
        return;
      }
      const lineTexts = extractLineTexts(lines);
      rebuildPerLineMaps(lines, lineTexts);
      if (renderSignatureUnchanged(doc, lines, lineTexts))
        return;
      const claimed = /* @__PURE__ */ new Set();
      lines.forEach((line, index) => {
        try {
          const lineEl = line;
          const translation = translationMap.get(index);
          const originalText = lineTexts[index];
          const isBreak = !originalText.trim() || /^[♪♫•\-–—\s]+$/.test(originalText.trim());
          let existing = siblingSkippingRomanization(line, "next");
          if (existing && !existing.classList.contains("slt-interleaved-translation"))
            existing = null;
          const wants = (!!translation || isBreak) && translation !== originalText && !!line.parentNode;
          if (!wants) {
            if (existing)
              existing.remove();
            const staleRom = line.nextElementSibling;
            if (staleRom && staleRom.classList.contains("slt-romanization-line"))
              staleRom.remove();
            lineEl.classList.remove("slt-overlay-parent");
            return;
          }
          const timingInfo = lineTimingData[index];
          const romanizationText = isBreak ? "" : romanizationCompanionText(line, index, "interleaved");
          const sig = [
            translation || "",
            isBreak ? "B" : "",
            currentConfig.syncWordHighlight ? "W" : "",
            romanizationText
          ].join("");
          lineEl.classList.add("slt-overlay-parent");
          lineEl.dataset.sltIndex = index.toString();
          const refreshRomanization = (anchor) => {
            let existingRom = anchor.nextElementSibling;
            if (existingRom && !existingRom.classList.contains("slt-romanization-line"))
              existingRom = null;
            if (!romanizationText) {
              if (existingRom)
                existingRom.remove();
              return;
            }
            if (existingRom) {
              if (existingRom.textContent !== romanizationText)
                existingRom.textContent = romanizationText;
              existingRom.dataset.lineIndex = index.toString();
              existingRom.dataset.forLine = index.toString();
              if (timingInfo) {
                existingRom.dataset.startTime = timingInfo.startTime.toString();
                existingRom.dataset.endTime = timingInfo.endTime.toString();
              }
              existingRom.classList.toggle("active", isLineActive(line));
              claimed.add(existingRom);
              return;
            }
            const romEl = buildRomanizationLine(doc, index, timingInfo, line, romanizationText);
            if (romEl) {
              anchor.parentNode.insertBefore(romEl, anchor.nextSibling);
              claimed.add(romEl);
            }
          };
          if (existing && existing.dataset.sltSig === sig) {
            existing.dataset.lineIndex = index.toString();
            existing.dataset.forLine = index.toString();
            if (timingInfo) {
              existing.dataset.startTime = timingInfo.startTime.toString();
              existing.dataset.endTime = timingInfo.endTime.toString();
            }
            claimed.add(existing);
            refreshRomanization(existing);
            return;
          }
          if (existing)
            existing.remove();
          const translationEl = doc.createElement("div");
          translationEl.className = "slt-interleaved-translation";
          translationEl.dataset.forLine = index.toString();
          translationEl.dataset.lineIndex = index.toString();
          translationEl.dataset.sltSig = sig;
          if (isBreak) {
            translationEl.textContent = "\u2022 \u2022 \u2022";
            translationEl.classList.add("slt-music-break");
          } else {
            translationEl.classList.add("slt-sync-translation");
            if (currentConfig.syncWordHighlight && translation) {
              appendTranslationWordSpans(doc, translationEl, translation, line, "slt-sync-word");
            } else {
              translationEl.textContent = translation || "";
            }
          }
          if (timingInfo) {
            translationEl.dataset.startTime = timingInfo.startTime.toString();
            translationEl.dataset.endTime = timingInfo.endTime.toString();
          }
          if (isLineActive(line))
            translationEl.classList.add("active");
          const qualityIndicator = createQualityIndicator(doc, index);
          if (qualityIndicator) {
            translationEl.appendChild(qualityIndicator);
          }
          line.parentNode.insertBefore(translationEl, line.nextSibling);
          claimed.add(translationEl);
          refreshRomanization(translationEl);
          if (!isBreak && currentConfig.syncWordHighlight && translation) {
            fallbackToContinuousMultilineGradient(translationEl, translation, line);
          }
        } catch (lineErr) {
          warn("Failed to process line", index, ":", lineErr);
        }
      });
      doc.querySelectorAll(".slt-interleaved-translation, .slt-original-line, .slt-romanization-line").forEach((el2) => {
        if (!claimed.has(el2))
          el2.remove();
      });
      markRenderComplete(doc);
    } catch (err) {
      warn("Failed to apply interleaved mode:", err);
    }
  }
  function initOverlayContainer(doc) {
    let container = doc.getElementById("spicy-translate-overlay");
    if (!container) {
      container = doc.createElement("div");
      container.id = "spicy-translate-overlay";
      container.className = "spicy-translate-overlay";
    }
    container.className = `spicy-translate-overlay overlay-mode-${currentConfig.mode}`;
    container.style.setProperty("--slt-overlay-opacity", currentConfig.opacity.toString());
    container.style.setProperty("--slt-overlay-font-scale", currentConfig.fontSize.toString());
    return container;
  }
  function setOverlayRomanization(show) {
    currentConfig.showRomanization = show;
  }
  function setOverlayLearningMode(enabled) {
    currentConfig.learningMode = enabled;
    invalidateLearningRow();
    if (!enabled) {
      removeLearningRows(document);
      const pip = getPIPWindow();
      if (pip)
        removeLearningRows(pip.document);
    }
  }
  function updateOverlayConfig(config) {
    currentConfig = { ...currentConfig, ...config };
  }
  function setStyleProp(el2, prop, value) {
    if (el2.style.getPropertyValue(prop) !== value) {
      el2.style.setProperty(prop, value);
    }
  }
  function clearStyleProp(el2, prop) {
    if (el2.style.getPropertyValue(prop) !== "") {
      el2.style.removeProperty(prop);
    }
  }
  function setDataProp(el2, key, value) {
    if (el2.dataset[key] !== value) {
      el2.dataset[key] = value;
    }
  }
  var MIRRORED_LINE_STYLE_PROPS = [
    "--gradient-position",
    "--gradient-alpha",
    "--gradient-alpha-end",
    "--gradient-degrees",
    "--gradient-offset",
    "--BlurAmount",
    "--text-shadow-blur-radius",
    "--text-shadow-opacity",
    "--active-line-distance"
  ];
  function syncTranslationLineFromOriginal(originalLine, translatedLine, lyricsType) {
    const isActive = isLineActive(originalLine);
    const isSung = originalLine.classList.contains("Sung");
    const isNotSung = originalLine.classList.contains("NotSung");
    translatedLine.classList.toggle("active", isActive);
    translatedLine.classList.toggle("Active", isActive);
    translatedLine.classList.toggle("Sung", !isActive && isSung);
    translatedLine.classList.toggle("NotSung", !isActive && isNotSung);
    translatedLine.classList.toggle("OppositeAligned", originalLine.classList.contains("OppositeAligned"));
    translatedLine.classList.toggle("rtl", originalLine.classList.contains("rtl"));
    setStyleProp(translatedLine, "--gradient-degrees", "180deg");
    for (const prop of MIRRORED_LINE_STYLE_PROPS) {
      if (prop === "--gradient-degrees")
        continue;
      const value = originalLine.style.getPropertyValue(prop);
      if (value && value.trim() !== "") {
        setStyleProp(translatedLine, prop, value);
      } else {
        clearStyleProp(translatedLine, prop);
      }
    }
    if (!originalLine.style.getPropertyValue("--gradient-position")) {
      if (isSung) {
        setStyleProp(translatedLine, "--gradient-position", "100%");
      } else if (isNotSung) {
        setStyleProp(translatedLine, "--gradient-position", "-20%");
      }
    }
  }
  function getOverallWordGradientProgress(originalLine) {
    const originalWords = getWordUnits(originalLine);
    if (originalWords.length === 0)
      return null;
    let sungCount = 0;
    let activeWordIndex = -1;
    let activeWordGradient = 0;
    let hasAnyGradientData = false;
    for (let i = 0; i < originalWords.length; i++) {
      const wordEl = originalWords[i];
      let gradientValue = NaN;
      if (wordEl.classList.contains("letterGroup")) {
        const letters = wordEl.querySelectorAll(".letter");
        const letterGradients = [];
        for (const letter of Array.from(letters)) {
          const letterGradient = parseFloat(
            letter.style.getPropertyValue("--gradient-position")
          );
          if (!isNaN(letterGradient)) {
            letterGradients.push(letterGradient);
          }
        }
        if (letterGradients.length > 0) {
          gradientValue = letterGradients.reduce((sum, value) => sum + value, 0) / letterGradients.length;
        }
      } else {
        gradientValue = parseFloat(wordEl.style.getPropertyValue("--gradient-position"));
      }
      if (!isNaN(gradientValue)) {
        hasAnyGradientData = true;
        if (gradientValue >= 90) {
          sungCount = i + 1;
        } else if (gradientValue > -15) {
          activeWordIndex = i;
          activeWordGradient = Math.max(0, Math.min(1, (gradientValue + 20) / 120));
        }
      }
    }
    if (!hasAnyGradientData) {
      return null;
    }
    if (activeWordIndex >= 0) {
      return (activeWordIndex + activeWordGradient) / originalWords.length;
    }
    return sungCount / originalWords.length;
  }
  function getOriginalWordGradients(originalLine) {
    const originalWords = getWordUnits(originalLine);
    const gradients = [];
    for (let i = 0; i < originalWords.length; i++) {
      const wordEl = originalWords[i];
      let gradientValue = NaN;
      if (wordEl.classList.contains("letterGroup")) {
        const letters = wordEl.querySelectorAll(".letter");
        const letterGradients = [];
        for (const letter of Array.from(letters)) {
          const letterGradient = parseFloat(
            letter.style.getPropertyValue("--gradient-position")
          );
          if (!isNaN(letterGradient)) {
            letterGradients.push(letterGradient);
          }
        }
        if (letterGradients.length > 0) {
          gradientValue = letterGradients.reduce((sum, value) => sum + value, 0) / letterGradients.length;
        }
      } else {
        gradientValue = parseFloat(wordEl.style.getPropertyValue("--gradient-position"));
      }
      gradients.push(gradientValue);
    }
    return gradients;
  }
  function updateTranslatedWordGradients(translatedLine, originalLine) {
    const translatedWords = Array.from(
      translatedLine.querySelectorAll(".slt-sync-word, .slt-replace-word")
    );
    if (translatedWords.length === 0)
      return false;
    const isActive = isLineActive(originalLine);
    const isSung = originalLine.classList.contains("Sung");
    const isNotSung = originalLine.classList.contains("NotSung");
    const originalWordGradients = getOriginalWordGradients(originalLine);
    const overallProgress = getOverallWordGradientProgress(originalLine);
    const originalText = originalLine.textContent || "";
    const originalHasNonLatin = /[぀-ヿ㐀-䶿一-鿿가-힯ᄀ-ᇿ؀-ۿ֐-׿Ѐ-ӿ฀-๿Ͱ-Ͽ]/.test(originalText);
    const wordRatio = translatedWords.length / Math.max(originalWordGradients.length, 1);
    const useSmoothFill = originalHasNonLatin || wordRatio < 0.7 || wordRatio > 1.45;
    const PROGRESSION_SMOOTHING = 0.68;
    const PROGRESSION_SNAP_DELTA = 8;
    const LATCH_WHITE_THRESHOLD = 96;
    const groupedTranslatedWordIndexes = /* @__PURE__ */ new Map();
    translatedWords.forEach((wordEl, index) => {
      const mappedIndex = parseInt(wordEl.dataset.originalIndex || "-1", 10);
      if (mappedIndex < 0)
        return;
      if (!groupedTranslatedWordIndexes.has(mappedIndex)) {
        groupedTranslatedWordIndexes.set(mappedIndex, []);
      }
      groupedTranslatedWordIndexes.get(mappedIndex).push(index);
    });
    const hasWordLevelGradient = originalWordGradients.some((value) => !isNaN(value));
    const perWordGradientDegrees = hasWordLevelGradient ? "90deg" : "180deg";
    if (!hasWordLevelGradient && overallProgress === null) {
      const lineGradientRaw = originalLine.style.getPropertyValue("--gradient-position").trim();
      const lineGradient = lineGradientRaw ? parseFloat(lineGradientRaw) : NaN;
      const fallbackGradient = !isNaN(lineGradient) ? Math.max(-20, Math.min(100, lineGradient)) : isSung ? 100 : isNotSung ? -20 : isActive ? 40 : -20;
      translatedWords.forEach((wordEl) => {
        setStyleProp(wordEl, "--gradient-degrees", perWordGradientDegrees);
        setDataProp(wordEl, "sltGradientPos", fallbackGradient.toString());
        setStyleProp(wordEl, "--gradient-position", `${fallbackGradient}%`);
        const isWordSung = fallbackGradient >= 90;
        const isWordActive = fallbackGradient > -15 && fallbackGradient < 90;
        wordEl.classList.toggle("slt-word-past", isWordSung);
        wordEl.classList.toggle("slt-word-active", isWordActive);
        wordEl.classList.toggle("slt-word-future", !isWordSung && !isWordActive);
        wordEl.classList.toggle("word-sung", isWordSung);
        wordEl.classList.toggle("word-active", isWordActive);
        wordEl.classList.toggle("word-notsng", !isWordSung && !isWordActive);
        const mappedIndex = parseInt(wordEl.dataset.originalIndex || "-1", 10);
        updateSyncWordLetterStates(wordEl, fallbackGradient, isWordActive, isWordSung, originalLine, mappedIndex);
      });
      return true;
    }
    translatedWords.forEach((wordEl, i) => {
      setStyleProp(wordEl, "--gradient-degrees", perWordGradientDegrees);
      let gradientPosition = -20;
      const previousGradient = parseFloat(wordEl.dataset.sltGradientPos || "NaN");
      const wasLatchedWhite = wordEl.dataset.sltLatchedWhite === "1";
      if (!isActive) {
        gradientPosition = isSung ? 100 : -20;
        delete wordEl.dataset.sltLatchedWhite;
      } else {
        const mappedIndex2 = parseInt(wordEl.dataset.originalIndex || "-1", 10);
        const mappedGradient = !useSmoothFill && mappedIndex2 >= 0 && mappedIndex2 < originalWordGradients.length ? originalWordGradients[mappedIndex2] : NaN;
        if (!isNaN(mappedGradient)) {
          const groupedIndexes = groupedTranslatedWordIndexes.get(mappedIndex2) || [];
          const groupSize = groupedIndexes.length;
          const indexInGroup = groupedIndexes.indexOf(i);
          if (groupSize > 1 && indexInGroup >= 0) {
            const sourceProgress = Math.max(0, Math.min(1, (mappedGradient + 20) / 120));
            const segmentStart = indexInGroup / groupSize;
            const segmentEnd = (indexInGroup + 1) / groupSize;
            if (sourceProgress <= segmentStart) {
              gradientPosition = -20;
            } else if (sourceProgress >= segmentEnd) {
              gradientPosition = 100;
            } else {
              const localProgress = (sourceProgress - segmentStart) / Math.max(segmentEnd - segmentStart, 1e-4);
              gradientPosition = -20 + Math.max(0, Math.min(1, localProgress)) * 120;
            }
          } else {
            gradientPosition = mappedGradient;
          }
        } else if (overallProgress !== null) {
          const totalWords = Math.max(translatedWords.length, 1);
          const wordStart = i / totalWords;
          const wordEnd = (i + 1) / totalWords;
          if (overallProgress <= wordStart) {
            gradientPosition = -20;
          } else if (overallProgress >= wordEnd) {
            gradientPosition = 100;
          } else {
            const localProgress = (overallProgress - wordStart) / Math.max(wordEnd - wordStart, 1e-4);
            gradientPosition = -20 + Math.max(0, Math.min(1, localProgress)) * 120;
          }
        }
        if (!isNaN(previousGradient)) {
          gradientPosition = Math.max(gradientPosition, previousGradient);
        }
        if (wasLatchedWhite || gradientPosition >= LATCH_WHITE_THRESHOLD) {
          gradientPosition = 100;
          setDataProp(wordEl, "sltLatchedWhite", "1");
        } else if (!isNaN(previousGradient)) {
          const delta = gradientPosition - previousGradient;
          if (delta > PROGRESSION_SNAP_DELTA) {
            gradientPosition = gradientPosition;
          } else if (delta > 0) {
            gradientPosition = previousGradient + delta * PROGRESSION_SMOOTHING;
          } else {
            gradientPosition = previousGradient;
          }
        }
      }
      const clamped = Math.max(-20, Math.min(100, gradientPosition));
      setDataProp(wordEl, "sltGradientPos", clamped.toString());
      setStyleProp(wordEl, "--gradient-position", `${clamped}%`);
      const isWordSung = clamped >= 90;
      const isWordActive = clamped > -15 && clamped < 90;
      wordEl.classList.toggle("slt-word-past", isWordSung);
      wordEl.classList.toggle("slt-word-active", isWordActive);
      wordEl.classList.toggle("slt-word-future", !isWordSung && !isWordActive);
      wordEl.classList.toggle("word-sung", isWordSung);
      wordEl.classList.toggle("word-active", isWordActive);
      wordEl.classList.toggle("word-notsng", !isWordSung && !isWordActive);
      if (!isActive && isNotSung) {
        wordEl.classList.remove("word-sung", "word-active", "slt-word-past", "slt-word-active");
        wordEl.classList.add("word-notsng", "slt-word-future");
      }
      const mappedIndex = parseInt(wordEl.dataset.originalIndex || "-1", 10);
      updateSyncWordLetterStates(
        wordEl,
        clamped,
        wordEl.classList.contains("slt-word-active"),
        wordEl.classList.contains("slt-word-past"),
        originalLine,
        mappedIndex
      );
    });
    return true;
  }
  function updateWordSyncStates(doc) {
    if (!isOverlayEnabled)
      return;
    const lyricsContainer = doc.querySelector(".SpicyLyricsScrollContainer");
    const lyricsType = lyricsContainer?.getAttribute("data-lyrics-type") || "Line";
    const Spicetify2 = globalThis.Spicetify;
    const currentTimeMs = Spicetify2?.Player?.getProgress?.() || 0;
    const currentTime = currentTimeMs / 1e3;
    doc.querySelectorAll(".slt-sync-translation").forEach((transLine) => {
      const transLineEl = transLine;
      const originalLine = findOriginalLineForTranslation(transLineEl);
      if (!originalLine)
        return;
      const originalGradient = originalLine.style.getPropertyValue("--gradient-position").trim();
      const isActive = isLineActive(originalLine);
      const isSung = originalLine.classList.contains("Sung");
      const isNotSung = originalLine.classList.contains("NotSung");
      syncTranslationLineFromOriginal(originalLine, transLineEl, lyricsType);
      const updatedByWords = updateTranslatedWordGradients(transLineEl, originalLine);
      if (updatedByWords) {
        clearStyleProp(transLineEl, "--gradient-position");
        return;
      }
      if (originalGradient !== "") {
        return;
      }
      if (!isActive) {
        setStyleProp(transLineEl, "--gradient-position", isSung ? "100%" : isNotSung ? "-20%" : "-20%");
        return;
      }
      const wordProgress = getOverallWordGradientProgress(originalLine);
      if (wordProgress !== null) {
        setStyleProp(transLineEl, "--gradient-position", `${-20 + wordProgress * 120}%`);
        return;
      }
      const lineStartTime = parseFloat(transLineEl.dataset.startTime || "0");
      const lineEndTime = parseFloat(transLineEl.dataset.endTime || "0");
      if (lineEndTime > 0 && lineStartTime >= 0) {
        if (currentTime >= lineEndTime) {
          setStyleProp(transLineEl, "--gradient-position", "100%");
        } else if (currentTime < lineStartTime) {
          setStyleProp(transLineEl, "--gradient-position", "-20%");
        } else {
          const total = lineEndTime - lineStartTime;
          const pct = total <= 0 ? 1 : (currentTime - lineStartTime) / total;
          setStyleProp(transLineEl, "--gradient-position", `${-20 + Math.max(0, Math.min(1, pct)) * 120}%`);
        }
      }
    });
  }
  function syncBlurToTranslations(doc) {
    doc.querySelectorAll(".slt-interleaved-translation, .slt-replace-line, .slt-romanization-line, .slt-original-line").forEach((transEl) => {
      const transHtml = transEl;
      const isOriginalLine = transHtml.classList.contains("slt-original-line");
      let lineEl = null;
      if (isOriginalLine) {
        let next = transEl.nextElementSibling;
        while (next && !next.classList.contains("line")) {
          next = next.nextElementSibling;
        }
        lineEl = next;
      } else {
        let prev = transEl.previousElementSibling;
        while (prev && !prev.classList.contains("line")) {
          prev = prev.previousElementSibling;
        }
        lineEl = prev;
      }
      if (lineEl) {
        const blurAmount = lineEl.style.getPropertyValue("--BlurAmount");
        if (blurAmount) {
          setStyleProp(transHtml, "--BlurAmount", blurAmount);
        } else {
          clearStyleProp(transHtml, "--BlurAmount");
        }
      }
    });
  }
  var breakdownLookup = null;
  var breakdownPrefetch = null;
  var lastLearningKey = "";
  var lastLearningLine = null;
  var lastPrefetchLine = null;
  var currentTargetLanguage = "";
  var currentSourceLanguage = "";
  var lastLearningCheck = 0;
  var LEARNING_THROTTLE_MS = 120;
  var LEARNING_PREFETCH_AHEAD = 3;
  function setBreakdownLookup(lookup) {
    breakdownLookup = lookup;
    lastLearningKey = "";
  }
  function setBreakdownPrefetch(prefetch) {
    breakdownPrefetch = prefetch;
    lastPrefetchLine = null;
  }
  function prefetchUpcomingBreakdowns(doc, fromLine) {
    if (!breakdownPrefetch || lastPrefetchLine === fromLine)
      return;
    lastPrefetchLine = fromLine;
    const lines = Array.from(doc.querySelectorAll("#SpicyLyricsPage .line, .LyricsContent .line"));
    const start = lines.indexOf(fromLine);
    if (start < 0)
      return;
    const texts = [];
    for (let i = start + 1; i < lines.length && texts.length < LEARNING_PREFETCH_AHEAD; i++) {
      if (lines[i].classList.contains("musical-line") || lines[i].classList.contains("bg-line"))
        continue;
      const text3 = extractLineText(lines[i]);
      if (text3)
        texts.push(text3);
    }
    if (texts.length > 0)
      breakdownPrefetch(texts);
  }
  function findActiveMusicalLine(doc) {
    return doc.querySelector(".line.musical-line.Active, .line.musical-line.active");
  }
  function clearLearningRow(doc) {
    if (!lastLearningKey && !doc.querySelector(".slt-learning-row"))
      return;
    removeLearningRows(doc);
    lastLearningKey = "";
    lastLearningLine = null;
  }
  function setLearningTargetLanguage(lang) {
    if (currentTargetLanguage === lang)
      return;
    currentTargetLanguage = lang;
    invalidateLearningRow();
  }
  function setLearningSourceLanguage(lang) {
    if (currentSourceLanguage === lang)
      return;
    currentSourceLanguage = lang;
    invalidateLearningRow();
  }
  function invalidateLearningRow() {
    lastLearningKey = "";
    lastLearningLine = null;
    lastPrefetchLine = null;
    lastLearningCheck = 0;
  }
  function findActiveLine(doc) {
    const lines = getLyricLines(doc);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.classList.contains("Active") || line.classList.contains("active"))
        return line;
    }
    return null;
  }
  function removeLearningRows(doc) {
    doc.querySelectorAll(".slt-learning-row").forEach((el2) => el2.remove());
    doc.querySelectorAll(".slt-learning-absorbed").forEach((el2) => el2.classList.remove("slt-learning-absorbed"));
  }
  function absorbsTranslation() {
    return currentConfig.mode === "interleaved" || currentConfig.mode === "none";
  }
  function absorbInterleavedTranslation(line) {
    if (currentConfig.mode !== "interleaved")
      return;
    let node = line.nextElementSibling;
    while (node && !node.classList.contains("slt-learning-row")) {
      if (node.classList.contains("slt-interleaved-translation") && !node.classList.contains("slt-learning-absorbed")) {
        node.classList.add("slt-learning-absorbed");
      }
      if (!node.classList.contains("slt-interleaved-translation") && !node.classList.contains("slt-romanization-line") && !node.classList.contains("slt-original-line"))
        break;
      node = node.nextElementSibling;
    }
  }
  function buildLearningRow(doc, tokens, origin, translated) {
    const row = doc.createElement("div");
    row.className = "slt-learning-row";
    row.dataset.origin = origin;
    if (translated && absorbsTranslation()) {
      const sentence = doc.createElement("div");
      sentence.className = "slt-learning-translation";
      sentence.textContent = translated;
      row.appendChild(sentence);
    }
    for (const token of tokens) {
      if (!token.source && !token.target)
        continue;
      const cell = doc.createElement("span");
      cell.className = "slt-learning-token";
      cell.dataset.confidence = token.confidence;
      const source = doc.createElement("span");
      source.className = "slt-learning-source";
      source.textContent = token.source || "\u2014";
      cell.appendChild(source);
      const target = doc.createElement("span");
      target.className = "slt-learning-target";
      target.textContent = token.target || "\u2014";
      cell.appendChild(target);
      const showLemma = token.lemma && token.lemma !== token.source;
      if (showLemma || token.pos) {
        const meta = doc.createElement("span");
        meta.className = "slt-learning-meta";
        if (showLemma) {
          const lemma = doc.createElement("span");
          lemma.className = "slt-learning-lemma";
          lemma.textContent = token.lemma;
          meta.appendChild(lemma);
        }
        if (token.pos) {
          const pos = doc.createElement("span");
          pos.className = "slt-learning-pos";
          pos.textContent = token.pos;
          meta.appendChild(pos);
        }
        cell.appendChild(meta);
      }
      const tip = [token.lemma ? `lemma: ${token.lemma}` : "", token.pos || "", token.note || ""].filter(Boolean).join(" \xB7 ");
      if (tip)
        cell.title = tip;
      row.appendChild(cell);
    }
    return row;
  }
  function updateLearningRow(doc) {
    if (!currentConfig.learningMode) {
      if (lastLearningKey) {
        removeLearningRows(doc);
        invalidateLearningRow();
      }
      return;
    }
    const now = Date.now();
    if (now - lastLearningCheck < LEARNING_THROTTLE_MS)
      return;
    lastLearningCheck = now;
    if (lastLearningLine && lastLearningKey && lastLearningLine.isConnected && (lastLearningLine.classList.contains("Active") || lastLearningLine.classList.contains("active"))) {
      const existingRow = doc.querySelector(".slt-learning-row");
      if (existingRow && existingRow.isConnected) {
        absorbInterleavedTranslation(lastLearningLine);
        return;
      }
    }
    const activeLine = findActiveLine(doc);
    if (!activeLine) {
      const musicalLine = findActiveMusicalLine(doc);
      if (musicalLine) {
        clearLearningRow(doc);
        prefetchUpcomingBreakdowns(doc, musicalLine);
      }
      return;
    }
    prefetchUpcomingBreakdowns(doc, activeLine);
    const sourceText = extractLineText(activeLine);
    if (!sourceText) {
      clearLearningRow(doc);
      return;
    }
    const index = parseInt(activeLine.dataset.sltIndex || "-1", 10);
    const translated = (index >= 0 ? translationMap.get(index) : void 0) || lookupByContent(translationByContent, sourceText) || "";
    if (!translated)
      return;
    const modelTokens = breakdownLookup ? breakdownLookup(sourceText, translated) : null;
    const origin = modelTokens ? "model" : "heuristic";
    const tokens = modelTokens || buildHeuristicBreakdown(sourceText, translated, currentTargetLanguage, currentSourceLanguage).tokens;
    if (tokens.length === 0 && !absorbsTranslation())
      return;
    const key = `${currentConfig.mode}:${origin}:${sourceText}:${translated}:${tokens.length}`;
    const anchor = learningAnchorFor(activeLine);
    if (!anchor || !anchor.parentNode)
      return;
    const existing = doc.querySelector(".slt-learning-row");
    if (existing && existing.isConnected && lastLearningKey === key && existing.previousElementSibling === anchor) {
      lastLearningLine = activeLine;
      absorbInterleavedTranslation(activeLine);
      return;
    }
    removeLearningRows(doc);
    const row = buildLearningRow(doc, tokens, origin, translated);
    anchor.parentNode.insertBefore(row, anchor.nextSibling);
    absorbInterleavedTranslation(activeLine);
    lastLearningKey = key;
    lastLearningLine = activeLine;
  }
  function learningAnchorFor(line) {
    let node = line.nextElementSibling;
    let anchor = line;
    while (node) {
      if (node.classList.contains("slt-interleaved-translation") || node.classList.contains("slt-replace-line") || node.classList.contains("slt-romanization-line") || node.classList.contains("slt-original-line")) {
        anchor = node;
        node = node.nextElementSibling;
        continue;
      }
      break;
    }
    return anchor;
  }
  function restoreOriginalLines(doc) {
    doc.querySelectorAll(".slt-interleaved-translation").forEach((el2) => el2.remove());
    doc.querySelectorAll(".slt-sync-translation").forEach((el2) => el2.remove());
    doc.querySelectorAll(".slt-romanization-line").forEach((el2) => el2.remove());
    doc.querySelectorAll(".slt-original-line").forEach((el2) => el2.remove());
    doc.querySelectorAll(".slt-replace-line").forEach((el2) => el2.remove());
    doc.querySelectorAll(".slt-replace-hidden").forEach((el2) => el2.classList.remove("slt-replace-hidden"));
    doc.querySelectorAll("[data-slt-original-html]").forEach((el2) => {
      const original = el2.dataset.sltOriginalHtml;
      if (original !== void 0) {
        el2.innerHTML = original;
        delete el2.dataset.sltOriginalHtml;
      }
    });
    doc.querySelectorAll("[data-slt-original-text]").forEach((el2) => {
      const original = el2.dataset.sltOriginalText;
      if (original !== void 0) {
        el2.textContent = original;
        delete el2.dataset.sltOriginalText;
      }
    });
    doc.querySelectorAll("[data-slt-replaced-with]").forEach((el2) => {
      delete el2.dataset.sltReplacedWith;
    });
    doc.querySelectorAll(".spicy-translation-container").forEach((el2) => el2.remove());
    doc.querySelectorAll(".spicy-hidden-original").forEach((el2) => {
      el2.classList.remove("spicy-hidden-original");
    });
    doc.querySelectorAll(".spicy-original-wrapper").forEach((wrapper) => {
      const parent = wrapper.parentElement;
      if (parent) {
        const originalContent = wrapper.innerHTML;
        wrapper.remove();
        if (parent.innerHTML.trim() === "" || !parent.querySelector(".word, .syllable, .letterGroup, .letter")) {
          parent.innerHTML = originalContent;
        }
      }
    });
    doc.querySelectorAll(".slt-overlay-parent, .spicy-translated").forEach((el2) => {
      el2.classList.remove("slt-overlay-parent", "spicy-translated");
    });
    doc.querySelectorAll(".slt-sync-word").forEach((el2) => {
      el2.classList.remove("slt-word-past", "slt-word-active", "slt-word-future");
    });
  }
  function applyNoneMode(doc) {
    invalidateWordUnitsCache();
    const lines = getLyricLines(doc);
    if (!lines || lines.length === 0) {
      restoreOriginalLines(doc);
      return;
    }
    const lineTexts = extractLineTexts(lines);
    rebuildPerLineMaps(lines, lineTexts);
    if (renderSignatureUnchanged(doc, lines, lineTexts))
      return;
    restoreOriginalLines(doc);
    if (currentConfig.showRomanization) {
      const claimed = /* @__PURE__ */ new Set();
      lines.forEach((line, index) => {
        const lineEl = line;
        lineEl.dataset.sltIndex = index.toString();
        const romanizationText = romanizationCompanionText(line, index, "none");
        if (!romanizationText)
          return;
        const romanEl = buildRomanizationLine(doc, index, lineTimingData[index], line, romanizationText);
        if (!romanEl || !line.parentNode)
          return;
        line.parentNode.insertBefore(romanEl, line.nextSibling);
        claimed.add(romanEl);
      });
      doc.querySelectorAll(".slt-romanization-line").forEach((el2) => {
        if (!claimed.has(el2))
          el2.remove();
      });
    } else {
      lines.forEach((line, index) => {
        line.dataset.sltIndex = index.toString();
      });
    }
    markRenderComplete(doc);
  }
  function renderTranslations(doc) {
    if (!isOverlayEnabled)
      return;
    if (currentConfig.mode === "none") {
      applyNoneMode(doc);
      return;
    }
    if (translationMap.size === 0 && !hasContentData())
      return;
    switch (currentConfig.mode) {
      case "replace":
        applyReplaceMode(doc);
        break;
      case "interleaved":
        applyInterleavedMode(doc);
        break;
    }
  }
  var lastActiveLineUpdate = 0;
  var ACTIVE_LINE_THROTTLE_MS = 50;
  function isDocumentValid(doc) {
    try {
      return doc && doc.body !== null && doc.defaultView !== null;
    } catch {
      return false;
    }
  }
  function onActiveLineChanged(doc) {
    if (!isOverlayEnabled)
      return;
    if (!isDocumentValid(doc)) {
      const observer = activeLineObservers.get(doc);
      if (observer) {
        try {
          observer.disconnect();
        } catch {
        }
        activeLineObservers.delete(doc);
      }
      return;
    }
    const now = Date.now();
    if (now - lastActiveLineUpdate < ACTIVE_LINE_THROTTLE_MS) {
      return;
    }
    lastActiveLineUpdate = now;
    try {
      if (currentConfig.mode === "interleaved" || currentConfig.mode === "replace" || currentConfig.mode === "none") {
        doc.querySelectorAll(".slt-replace-line, .slt-interleaved-translation, .slt-romanization-line, .slt-original-line").forEach((el2) => {
          const orig = adjacentOriginalLine(el2);
          el2.classList.toggle("active", !!orig && isLineActive(orig));
        });
      }
    } catch (err) {
    }
  }
  var activeLineObservers = /* @__PURE__ */ new Map();
  var activeSyncIntervalId = null;
  var activeSyncRafId = null;
  var SPICY_LYRICS_SETTINGS_KEY = "SL:settings";
  var FRAME_CAP_REFRESH_MS = 1e3;
  var FRAME_CAP_SLACK_MS = 1;
  var frameCapIntervalMs = 0;
  var frameCapCheckedAt = -Infinity;
  var lastSyncFrameAt = -Infinity;
  function readSpicyLyricsFrameInterval() {
    try {
      const spicetifyStorage = globalThis.Spicetify?.LocalStorage;
      const raw = spicetifyStorage?.get?.(SPICY_LYRICS_SETTINGS_KEY) ?? localStorage.getItem(SPICY_LYRICS_SETTINGS_KEY);
      const settings = raw ? JSON.parse(raw) : null;
      if (!settings?.animationFpsCapEnabled)
        return 0;
      const saved = Number(settings.animationFpsCap);
      const fps = Number.isFinite(saved) ? Math.min(240, Math.max(15, saved)) : 60;
      return 1e3 / fps;
    } catch {
      return 0;
    }
  }
  function shouldRunSyncFrame(timestamp) {
    if (timestamp - frameCapCheckedAt >= FRAME_CAP_REFRESH_MS) {
      frameCapIntervalMs = readSpicyLyricsFrameInterval();
      frameCapCheckedAt = timestamp;
    }
    if (frameCapIntervalMs === 0)
      return true;
    const elapsed = timestamp - lastSyncFrameAt;
    if (elapsed < frameCapIntervalMs - FRAME_CAP_SLACK_MS)
      return false;
    lastSyncFrameAt = elapsed >= frameCapIntervalMs && elapsed < frameCapIntervalMs * 2 ? timestamp - elapsed % frameCapIntervalMs : timestamp;
    return true;
  }
  function syncLoop(timestamp = performance.now()) {
    if (!isOverlayEnabled) {
      activeSyncRafId = null;
      return;
    }
    if (!shouldRunSyncFrame(timestamp)) {
      activeSyncRafId = requestAnimationFrame(syncLoop);
      return;
    }
    if (translationMap.size === 0 && !hasContentData()) {
      activeSyncRafId = requestAnimationFrame(syncLoop);
      return;
    }
    try {
      invalidateWordUnitsCache();
      onActiveLineChanged(document);
      updateLearningRow(document);
      updateWordSyncStates(document);
      syncBlurToTranslations(document);
      const pipWindow = getPIPWindow();
      if (pipWindow) {
        try {
          const pipDoc = pipWindow.document;
          if (pipDoc && pipDoc.body) {
            ensurePIPStyles(pipDoc);
            if (translationMap.size > 0 && currentConfig.mode !== "none") {
              const hasTranslations = pipDoc.querySelector(".slt-replace-line, .slt-interleaved-translation");
              if (!hasTranslations) {
                renderTranslations(pipDoc);
              }
            }
            onActiveLineChanged(pipDoc);
            updateWordSyncStates(pipDoc);
            syncBlurToTranslations(pipDoc);
            if (!activeLineObservers.has(pipDoc)) {
              setupActiveLineObserver(pipDoc);
            }
          }
        } catch (pipErr) {
        }
      } else if (activeLineObservers.size > 1) {
        for (const [observedDoc, observer] of activeLineObservers) {
          if (observedDoc === document)
            continue;
          try {
            observer.disconnect();
          } catch {
          }
          activeLineObservers.delete(observedDoc);
        }
      }
    } catch (e) {
    }
    activeSyncRafId = requestAnimationFrame(syncLoop);
  }
  function startActiveSyncInterval() {
    if (activeSyncRafId)
      return;
    activeSyncRafId = requestAnimationFrame(syncLoop);
  }
  function pauseActiveSync() {
    if (getPIPWindow())
      return;
    stopActiveSyncInterval();
  }
  function resumeActiveSync() {
    if (!isOverlayEnabled)
      return;
    startActiveSyncInterval();
  }
  function stopActiveSyncInterval() {
    if (activeSyncRafId) {
      cancelAnimationFrame(activeSyncRafId);
      activeSyncRafId = null;
    }
    if (activeSyncIntervalId) {
      clearInterval(activeSyncIntervalId);
      activeSyncIntervalId = null;
    }
  }
  function setupActiveLineObserver(doc) {
    try {
      if (!isDocumentValid(doc)) {
        return;
      }
      const existingObserver = activeLineObservers.get(doc);
      if (existingObserver) {
        existingObserver.disconnect();
        activeLineObservers.delete(doc);
      }
      let lyricsContainer = findLyricsContainer(doc);
      if (!lyricsContainer && isSidebarLyricsActive(doc)) {
        lyricsContainer = findSidebarLyricsPage(doc);
      }
      if (!lyricsContainer) {
        lyricsContainer = doc.querySelector(".spicy-pip-wrapper #SpicyLyricsPage");
      }
      if (!lyricsContainer) {
        lyricsContainer = doc.querySelector("#SpicyLyricsPage");
      }
      if (!lyricsContainer) {
        startActiveSyncInterval();
        return;
      }
      const observer = new MutationObserver((mutations) => {
        try {
          let activeChanged = false;
          for (const mutation of mutations) {
            if (activeChanged)
              break;
            if (mutation.type === "childList") {
              if (mutation.addedNodes.length > 0)
                activeChanged = true;
            } else if (mutation.type === "attributes") {
              const target = mutation.target;
              if (target && (target.classList?.contains("line") || target.closest?.(".line"))) {
                activeChanged = true;
              }
            }
          }
          if (activeChanged) {
            onActiveLineChanged(doc);
          }
        } catch (e) {
        }
      });
      observer.observe(lyricsContainer, {
        attributes: true,
        attributeFilter: ["class", "data-active", "style"],
        subtree: true,
        childList: true
      });
      activeLineObservers.set(doc, observer);
      startActiveSyncInterval();
      setTimeout(() => onActiveLineChanged(doc), 50);
    } catch (err) {
      warn("Failed to setup active line observer:", err);
      startActiveSyncInterval();
    }
  }
  function enableOverlay(config) {
    if (config) {
      currentConfig = { ...currentConfig, ...config };
    }
    isOverlayEnabled = true;
    initOverlayContainer(document);
    setupActiveLineObserver(document);
    if (translationMap.size > 0) {
      renderTranslations(document);
    }
    document.body.classList.add("slt-overlay-active");
    try {
      const qiVal = localStorage.getItem("spicy-lyric-translator:show-quality-indicator");
      document.body.classList.toggle("slt-hide-quality-indicator", qiVal === "false");
    } catch {
    }
    const pipWindow = getPIPWindow();
    if (pipWindow) {
      ensurePIPStyles(pipWindow.document);
      initOverlayContainer(pipWindow.document);
      setupActiveLineObserver(pipWindow.document);
      if (translationMap.size > 0) {
        renderTranslations(pipWindow.document);
      }
    }
  }
  function disableOverlay() {
    isOverlayEnabled = false;
    stopActiveSyncInterval();
    activeLineObservers.forEach((observer, doc) => {
      observer.disconnect();
    });
    activeLineObservers.clear();
    const cleanup = (doc) => {
      forgetRenderState(doc);
      const overlay = doc.getElementById("spicy-translate-overlay");
      if (overlay)
        overlay.remove();
      const interleavedOverlay = doc.getElementById("slt-interleaved-overlay");
      if (interleavedOverlay)
        interleavedOverlay.remove();
      restoreOriginalLines(doc);
      doc.querySelectorAll(".slt-learning-row").forEach((el2) => el2.remove());
    };
    cleanup(document);
    const pipWindow = getPIPWindow();
    if (pipWindow) {
      cleanup(pipWindow.document);
    }
    translationMap.clear();
    romanizationMap.clear();
    originalTextMap.clear();
    translationByContent.clear();
    romanizationByContent.clear();
    originalByContent.clear();
    qualityByContent.clear();
    timingByContent.clear();
    document.body.classList.remove("slt-overlay-active");
  }
  function updateOverlayContent(translations) {
    translationMap = new Map(translations);
    if (isOverlayEnabled) {
      renderTranslations(document);
      const pipWindow = getPIPWindow();
      if (pipWindow) {
        renderTranslations(pipWindow.document);
      }
    }
  }
  function isOverlayActive() {
    return isOverlayEnabled;
  }
  function setLineTimingData(data) {
    lineTimingData = data;
  }
  function setRomanizationData(data) {
    romanizationMap = new Map(data);
  }
  function setOriginalTextData(data) {
    originalTextMap = new Map(data);
  }
  function setQualityMetadata(metadata) {
    qualityMap = new Map(metadata);
  }
  function createQualityIndicator(doc, index) {
    const meta = qualityMap.get(index);
    if (!meta)
      return null;
    const indicator = doc.createElement("span");
    indicator.className = "slt-quality-indicator";
    const isCached = meta.source === "cache";
    const apiLabel = meta.api === "google" ? "Google" : meta.api === "libretranslate" ? "LibreTranslate" : meta.api === "custom" ? "Custom" : meta.api || "Unknown";
    indicator.dataset.source = meta.source;
    indicator.dataset.api = meta.api || "";
    const dot = doc.createElement("span");
    dot.className = `slt-qi-dot ${isCached ? "slt-qi-cached" : "slt-qi-fresh"}`;
    indicator.appendChild(dot);
    const label = doc.createElement("span");
    label.className = "slt-qi-label";
    label.textContent = isCached ? `Cached \xB7 ${apiLabel}` : `Fresh \xB7 ${apiLabel}`;
    indicator.appendChild(label);
    const tooltipParts = [];
    tooltipParts.push(`Source: ${isCached ? "Cached" : "Live API"}`);
    tooltipParts.push(`Provider: ${apiLabel}`);
    if (meta.detectedLanguage) {
      tooltipParts.push(`Detected: ${meta.detectedLanguage.toUpperCase()}`);
    }
    indicator.title = tooltipParts.join(" | ");
    return indicator;
  }
  function ensurePIPStyles(pipDoc) {
    if (pipDoc.getElementById("slt-pip-styles"))
      return;
    const mainStyle = document.getElementById("spicy-lyric-translator-styles");
    if (mainStyle) {
      const clone = mainStyle.cloneNode(true);
      clone.id = "slt-pip-styles";
      pipDoc.head.appendChild(clone);
    }
  }
  function getOverlayStyles() {
    return `

body.slt-overlay-active .LyricsContent {}

.spicy-translate-overlay {
    pointer-events: none;
    user-select: none;
    z-index: 10;
}

.spicy-pip-wrapper .slt-interleaved-translation {
    font-size: calc(0.82em * var(--slt-overlay-font-scale, 1));
}

.Cinema--Container .slt-interleaved-translation,
.Root__cinema-view .slt-interleaved-translation,
#SpicyLyricsPage.ForcedCompactMode .slt-interleaved-translation {
    font-size: calc(0.88em * var(--slt-overlay-font-scale, 1));
}

#SpicyLyricsPage.SidebarMode .slt-interleaved-translation {
    font-size: calc(0.78em * var(--slt-overlay-font-scale, 1));
}

body.SpicySidebarLyrics__Active #SpicyLyricsPage .slt-interleaved-translation,
#SpicyLyricsPage.CardMode .slt-interleaved-translation {
    font-size: calc(0.65em * var(--slt-overlay-font-scale, 1));
}

.slt-interleaved-translation.slt-music-break {
    color: rgba(255, 255, 255, 0.35) !important;
    -webkit-text-fill-color: rgba(255, 255, 255, 0.35) !important;
    background: none !important;
    font-size: calc(0.35em * var(--slt-overlay-font-scale, 1));
    letter-spacing: 0.3em;
    padding: 8px 0 16px 0;
}

.slt-romanization-line {
    display: block;
    width: 100%;
    flex: 0 0 100%;
    font-size: calc(0.55em * var(--slt-overlay-font-scale, 1));
    font-weight: 600;
    font-style: italic;
    line-height: 1.2;
    padding: 2px 0 2px 0;
    letter-spacing: 0.02em;
    color: rgba(255, 215, 120, 0.78);
    text-align: left;
    white-space: normal;
    word-wrap: break-word;
    overflow-wrap: anywhere;
    word-break: break-word;
    pointer-events: none;
    opacity: 0.7;
    filter: blur(var(--BlurAmount, 0px));
    transition: opacity 0.25s ease, filter 0.25s ease, color 0.25s ease;
}

.slt-romanization-line.OppositeAligned,
.slt-romanization-line.rtl {
    text-align: end;
}

.line.Active + .slt-romanization-line,
.slt-romanization-line.active,
.slt-romanization-line.Active {
    opacity: 1 !important;
    filter: none !important;
    color: rgba(255, 224, 150, 0.95);
}

.line.Sung + .slt-romanization-line,
.slt-romanization-line.Sung {
    opacity: 0.45;
}

.line.NotSung + .slt-romanization-line,
.slt-romanization-line.NotSung {
    opacity: 0.55;
}

.slt-interleaved-translation.Sung,
.slt-replace-line.Sung {
    opacity: var(--Vocal-Sung-opacity, 0.497);
}

.slt-interleaved-translation.NotSung,
.slt-replace-line.NotSung {
    opacity: var(--Vocal-NotSung-opacity, 0.51);
}

.spicy-pip-wrapper .slt-romanization-line {
    font-size: calc(0.7em * var(--slt-overlay-font-scale, 1));
}

.Cinema--Container .slt-romanization-line,
.Root__cinema-view .slt-romanization-line,
#SpicyLyricsPage.ForcedCompactMode .slt-romanization-line {
    font-size: calc(0.75em * var(--slt-overlay-font-scale, 1));
    padding: 3px 0;
}

#SpicyLyricsPage.SidebarMode .slt-romanization-line {
    font-size: calc(0.65em * var(--slt-overlay-font-scale, 1));
    padding: 1px 0;
}

body.SpicySidebarLyrics__Active #SpicyLyricsPage .slt-romanization-line,
#SpicyLyricsPage.CardMode .slt-romanization-line {
    font-size: calc(0.55em * var(--slt-overlay-font-scale, 1));
    padding: 1px 0;
    margin: 0;
}
.slt-learning-row {
    display: flex;
    flex-wrap: wrap;
    align-items: stretch;
    gap: 6px 10px;
    padding: 6px 0 14px 0;
    pointer-events: auto;
    user-select: text;
    text-align: left;
    letter-spacing: 0;
    scale: 1;
    filter: none;
    animation: slt-learning-in 180ms ease-out;
}

.slt-interleaved-translation.slt-learning-absorbed {
    display: none !important;
}

.slt-learning-translation {
    flex-basis: 100%;
    font-size: calc(0.45em * var(--slt-overlay-font-scale, 1));
    line-height: 1.25;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.88);
    margin-bottom: 2px;
}

#SpicyLyricsPage.SidebarMode .slt-learning-translation,
body.SpicySidebarLyrics__Active #SpicyLyricsPage .slt-learning-translation,
#SpicyLyricsPage.CardMode .slt-learning-translation {
    font-size: calc(0.6em * var(--slt-overlay-font-scale, 1));
}

@keyframes slt-learning-in {
    from { opacity: 0; transform: translateY(-2px); }
    to { opacity: 1; transform: none; }
}

.slt-learning-token {
    display: inline-flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
    padding: 3px 7px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid rgba(255, 255, 255, 0.1);
    font-size: calc(0.3em * var(--slt-overlay-font-scale, 1));
    line-height: 1.25;
    font-weight: 600;
    white-space: normal;
    max-width: 16em;
}

.slt-learning-token[data-confidence="medium"] .slt-learning-target,
.slt-learning-token[data-confidence="low"] .slt-learning-target {
    text-decoration: underline dotted rgba(255, 255, 255, 0.35);
    text-underline-offset: 0.2em;
}

.slt-learning-row[data-origin="heuristic"] .slt-learning-token {
    border-style: dashed;
}

.slt-learning-source {
    color: rgba(255, 255, 255, 0.96);
    font-weight: 800;
}

.slt-learning-target {
    color: rgba(255, 255, 255, 0.74);
    font-weight: 600;
}

.slt-learning-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0 0.5em;
    margin-top: auto;
    padding-top: 1px;
}

.slt-learning-lemma {
    color: rgba(255, 255, 255, 0.5);
    font-weight: 500;
    font-style: italic;
}

.slt-learning-pos {
    color: rgba(255, 255, 255, 0.42);
    font-weight: 500;
    text-transform: lowercase;
    letter-spacing: 0.04em;
}

#SpicyLyricsPage.SidebarMode .slt-learning-token,
body.SpicySidebarLyrics__Active #SpicyLyricsPage .slt-learning-token,
#SpicyLyricsPage.CardMode .slt-learning-token {
    font-size: calc(0.42em * var(--slt-overlay-font-scale, 1));
    padding: 2px 5px;
    max-width: 12em;
}
`;
  }

  // src/styles/main.ts
  var styles = `
:root {
    --slt-radius: 16px;
    --slt-radius-sm: 11px;
    --slt-hairline: rgba(255, 255, 255, 0.07);
    --slt-hairline-strong: rgba(255, 255, 255, 0.14);
    --slt-surface: rgba(255, 255, 255, 0.04);
    --slt-surface-hover: rgba(255, 255, 255, 0.07);
    --slt-text: hsla(0, 0%, 100%, 0.92);
    --slt-text-2: hsla(0, 0%, 100%, 0.58);
    --slt-text-3: hsla(0, 0%, 100%, 0.4);
    --slt-accent: var(--spice-button-active, #1db954);
    --slt-ease: cubic-bezier(0.32, 0.72, 0, 1);
    --slt-gloss:
        inset 0 1px 0 rgba(255, 255, 255, 0.14),
        inset 0 0 0 1px rgba(255, 255, 255, 0.06);
}

@keyframes spicy-translate-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

#TranslateToggle.loading svg {
    animation: spicy-translate-spin 1s linear infinite;
}

#TranslateToggle.active svg,
#LearningToggle.active svg {
    color: var(--spice-button-active, #1db954);
}

#TranslateToggle.error svg {
    color: #e74c3c;
}

#SpicyLyricsNPVCard .CardControl:is(#TranslateToggle, #LearningToggle) svg {
    fill: currentColor !important;
}

#TranslateToggle.error {
    animation: spicy-translate-shake 0.5s ease-in-out;
}

@keyframes spicy-translate-shake {
    0%, 100% { transform: translateX(0); }
    20%, 60% { transform: translateX(-3px); }
    40%, 80% { transform: translateX(3px); }
}

.spicy-translate-settings {
    padding: 16px;
}

.spicy-translate-settings .setting-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid var(--spice-misc, #535353);
}

.spicy-translate-settings .setting-item:last-child {
    border-bottom: none;
}

.spicy-translate-settings .setting-label {
    font-weight: 500;
}

.spicy-translate-settings .setting-description {
    font-size: 12px;
    color: var(--spice-subtext, #b3b3b3);
    margin-top: 4px;
}

.spicy-translate-settings select,
.spicy-translate-settings input[type="text"],
.spicy-translate-settings button {
    padding: 8px 16px;
    border-radius: 4px;
    border: none;
    background: var(--spice-button, #535353);
    color: var(--spice-text, #fff);
    cursor: pointer;
    font-size: 14px;
}

.spicy-translate-settings input[type="text"] {
    min-width: 200px;
}

.spicy-translate-settings select:hover,
.spicy-translate-settings button:hover {
    background: var(--spice-button-active, #1db954);
    color: #000;
}

.spicy-translate-settings .toggle-switch {
    position: relative;
    width: 48px;
    height: 24px;
    background: var(--spice-button, #535353);
    border-radius: 12px;
    cursor: pointer;
    transition: background 0.2s;
    flex-shrink: 0;
}

.spicy-translate-settings .toggle-switch.active {
    background: var(--spice-button-active, #1db954);
}

.spicy-translate-settings .toggle-switch::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    background: #fff;
    border-radius: 50%;
    transition: transform 0.2s;
}

.spicy-translate-settings .toggle-switch.active::after {
    transform: translateX(24px);
}

.line.slt-replace-hidden {
    visibility: hidden !important;
    pointer-events: none !important;
    max-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
}

.slt-replace-line {
    display: block;
    font-size: inherit;
    font-weight: 900;
    padding: 12px 0;
    line-height: 1.1818181818;
    pointer-events: auto;
    cursor: pointer;
    text-align: left;
    white-space: normal;
    word-wrap: break-word;
    overflow-wrap: anywhere;
    word-break: break-word;
    letter-spacing: 0;
    box-sizing: border-box;
    padding-inline-end: 0.25em;
    opacity: var(--Vocal-NotSung-opacity, 0.51);
    filter: blur(var(--BlurAmount, 0px));
    transform-origin: left center;
    transition: all 0.3s cubic-bezier(0.37, 0, 0.63, 1);
    --Vocal-NotSung-opacity: 0.51;
    --Vocal-Active-opacity: 1;
    --Vocal-Sung-opacity: 0.497;
    --DefaultLineScale: 1;
    scale: var(--DefaultLineScale);

    --text-shadow-blur-radius: 4px;
    --text-shadow-opacity: 0%;
    text-shadow: 0 0 var(--text-shadow-blur-radius) rgba(255, 255, 255, var(--text-shadow-opacity));

    --gradient-degrees: 180deg;
    --gradient-alpha: 0.85;
    --gradient-alpha-end: 0.5;
    --gradient-position: -20%;
    --gradient-offset: 0%;
    color: transparent !important;
    -webkit-text-fill-color: transparent !important;
    background-clip: text !important;
    -webkit-background-clip: text !important;
    background-image: linear-gradient(
        var(--gradient-degrees),
        rgba(255, 255, 255, var(--gradient-alpha)) var(--gradient-position),
        rgba(255, 255, 255, var(--gradient-alpha-end)) calc(var(--gradient-position) + 20% + var(--gradient-offset))
    ) !important;
    background-size: 100% 1.1818181818em;
    background-repeat: repeat-y;
    -webkit-box-decoration-break: clone;
    box-decoration-break: clone;
}

.slt-replace-line.OppositeAligned,
.slt-replace-line.rtl {
    transform-origin: right center;
    text-align: end;
}

.slt-replace-line:has(.slt-replace-word) {
    background-image: none !important;
    color: inherit !important;
    -webkit-text-fill-color: inherit !important;
    background-clip: border-box !important;
    -webkit-background-clip: border-box !important;
    text-shadow: none;
}

.slt-sync-translation.slt-interleaved-translation:has(.slt-sync-word) {
    background-image: none !important;
    color: inherit !important;
    -webkit-text-fill-color: inherit !important;
    background-clip: border-box !important;
    -webkit-background-clip: border-box !important;
    text-shadow: none;
}

.slt-replace-word {
    display: inline;
    transform-origin: center center;
    will-change: transform;
    transition: opacity 180ms linear, text-shadow 180ms linear;

    --text-shadow-blur-radius: 4px;
    --text-shadow-opacity: 0%;
    text-shadow: 0 0 var(--text-shadow-blur-radius) rgba(255, 255, 255, var(--text-shadow-opacity));

    --gradient-degrees: 180deg;
    --gradient-alpha: 0.85;
    --gradient-alpha-end: 0.5;
    --gradient-position: -20%;
    --gradient-offset: 0%;
    color: transparent !important;
    -webkit-text-fill-color: transparent !important;
    background-clip: text !important;
    -webkit-background-clip: text !important;
    background-image: linear-gradient(
        var(--gradient-degrees),
        rgba(255, 255, 255, var(--gradient-alpha)) var(--gradient-position),
        rgba(255, 255, 255, var(--gradient-alpha-end)) calc(var(--gradient-position) + 20% + var(--gradient-offset))
    ) !important;
}

.slt-replace-word.word-notsng {
    opacity: 0.51;
}
.slt-replace-word.word-sung {
    opacity: 0.5;
}
.slt-replace-word.word-active {
    opacity: 1;
}

.slt-replace-line.Active,
.slt-replace-line.active,
.line.Active + .slt-replace-line {
    filter: none !important;
    opacity: var(--Vocal-Active-opacity, 1) !important;
    scale: 1;
    text-shadow: var(--ActiveTextGlowDef) !important;
}

.slt-replace-line.Sung,
.line.Sung + .slt-replace-line {
    --gradient-position: 100% !important;
    opacity: var(--Vocal-Sung-opacity, 0.497);
    scale: var(--DefaultLineScale, 1);
}

.slt-replace-line.NotSung,
.line.NotSung + .slt-replace-line {
    --gradient-position: -20% !important;
    opacity: var(--Vocal-NotSung-opacity, 0.51);
    scale: var(--DefaultLineScale, 1);
}

.slt-replace-line.active .slt-replace-word.word-notsng {
    opacity: 0.51;
}
.slt-replace-line.active .slt-replace-word.word-sung {
    opacity: 1;
}

.slt-replace-line.NotSung:hover,
.slt-replace-line.Sung:hover {
    --gradient-alpha: 0.8;
    --gradient-alpha-end: 0.8;
    opacity: 0.8 !important;
    filter: none;
}

.slt-replace-line.slt-replace-instrumental {
    color: rgba(255, 255, 255, 0.35) !important;
    -webkit-text-fill-color: rgba(255, 255, 255, 0.35) !important;
    background: none !important;
    background-image: none !important;
    font-size: calc(0.35em);
    letter-spacing: 0.3em;
    padding: 8px 0 16px 0;
    cursor: default;
    pointer-events: none;
}

.spicy-pip-wrapper .slt-replace-line {
    padding: 8px 0;
}

.Cinema--Container .slt-replace-line,
.Root__cinema-view .slt-replace-line,
#SpicyLyricsPage.ForcedCompactMode .slt-replace-line {
    padding: 14px 0;
}

#SpicyLyricsPage.SidebarMode .slt-replace-line {
    padding: 6px 0;
    font-size: 0.9em;
}

body.SpicySidebarLyrics__Active #SpicyLyricsPage .slt-replace-line,
#SpicyLyricsPage.CardMode .slt-replace-line {
    padding: 4px 0;
    font-size: 0.8em;
}

.line.spicy-translated {}

.cache-item:hover {
    background: rgba(255, 255, 255, 0.05);
}

.cache-delete-btn {
    opacity: 0.6;
    transition: opacity 0.2s, background 0.2s;
}

.cache-delete-btn:hover {
    opacity: 1;
    background: #e74c3c !important;
}

body.SpicySidebarLyrics__Active #SpicyLyricsPage .slt-interleaved-translation,
#SpicyLyricsPage.CardMode .slt-interleaved-translation {
    font-size: calc(0.65em * var(--slt-overlay-font-scale, 1));
    margin-top: 2px;
    margin-bottom: 4px;
}

@keyframes slt-ci-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.slt-ci-spinner {
    animation: slt-ci-spin 1s linear infinite;
}

.SLT_ConnectionIndicator {
    display: inline-flex;
    align-items: center;
    margin-right: 8px;
    position: relative;
    z-index: 100;
    -webkit-font-smoothing: antialiased;
}

.slt-ci-button {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    padding: 5px 11px 5px 10px;
    border-radius: 999px;
    background: var(--slt-surface, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--slt-hairline, rgba(255, 255, 255, 0.07));
    box-shadow: var(--slt-gloss);
    -webkit-backdrop-filter: blur(8px) saturate(1.2);
    backdrop-filter: blur(8px) saturate(1.2);
    white-space: nowrap;
    cursor: default;
    transition: background 0.25s var(--slt-ease, ease), border-color 0.25s var(--slt-ease, ease);
}

.slt-ci-button:hover {
    background: var(--slt-surface-hover, rgba(255, 255, 255, 0.07));
    border-color: var(--slt-hairline-strong, rgba(255, 255, 255, 0.14));
}

.slt-ci-dot {
    position: relative;
    width: 7px;
    height: 7px;
    min-width: 7px;
    border-radius: 50%;
    background: var(--slt-ci-c, #5b5b5b);
    flex-shrink: 0;
    transition: background 0.3s var(--slt-ease, ease), box-shadow 0.3s ease;
}

.slt-ci-dot::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 50%;
    box-shadow: 0 0 0 0 var(--slt-ci-c, transparent);
    opacity: 0;
    pointer-events: none;
}

.slt-ci-dot.slt-ci-connecting {
    --slt-ci-c: #9aa0a6;
    animation: slt-ci-pulse 1.4s ease-in-out infinite;
}

.slt-ci-dot.slt-ci-connected,
.slt-ci-dot.slt-ci-great { --slt-ci-c: #1ed760; }
.slt-ci-dot.slt-ci-ok { --slt-ci-c: #ffd35c; }
.slt-ci-dot.slt-ci-bad { --slt-ci-c: #ff9f45; }
.slt-ci-dot.slt-ci-error,
.slt-ci-dot.slt-ci-horrible { --slt-ci-c: #f1556c; }

.slt-ci-dot.slt-ci-connected,
.slt-ci-dot.slt-ci-great,
.slt-ci-dot.slt-ci-ok,
.slt-ci-dot.slt-ci-bad,
.slt-ci-dot.slt-ci-horrible {
    box-shadow: 0 0 7px -1px var(--slt-ci-c);
}

.slt-ci-dot.slt-ci-connected::after,
.slt-ci-dot.slt-ci-great::after,
.slt-ci-dot.slt-ci-ok::after,
.slt-ci-dot.slt-ci-bad::after,
.slt-ci-dot.slt-ci-horrible::after {
    animation: slt-ci-ring 2.4s var(--slt-ease, ease-out) infinite;
}

@keyframes slt-ci-ring {
    0% { box-shadow: 0 0 0 0 var(--slt-ci-c); opacity: 0.5; }
    70% { box-shadow: 0 0 0 5px var(--slt-ci-c); opacity: 0; }
    100% { box-shadow: 0 0 0 5px var(--slt-ci-c); opacity: 0; }
}

@keyframes slt-ci-pulse {
    0%, 100% { opacity: 0.45; transform: scale(0.85); }
    50% { opacity: 1; transform: scale(1.05); }
}

.slt-ci-meta {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    white-space: nowrap;
}

.slt-ci-ping {
    font-family: 'JetBrains Mono', 'SF Mono', 'Consolas', monospace;
    font-size: 0.64rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    color: var(--slt-text, hsla(0, 0%, 100%, 0.92));
    transition: color 0.3s ease;
}

.slt-ci-ping.slt-ci-great { color: #1ed760; }
.slt-ci-ping.slt-ci-ok { color: #ffd35c; }
.slt-ci-ping.slt-ci-bad { color: #ff9f45; }
.slt-ci-ping.slt-ci-horrible { color: #f1556c; }

.slt-ci-sep {
    width: 1px;
    height: 11px;
    border-radius: 1px;
    background: var(--slt-hairline-strong, rgba(255, 255, 255, 0.14));
    flex-shrink: 0;
}

.slt-ci-users-count {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: var(--slt-text-2, hsla(0, 0%, 100%, 0.58));
    font-size: 0.64rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
}

.slt-ci-users-count svg {
    opacity: 0.7;
    flex-shrink: 0;
}

.slt-ci-total-count {
    letter-spacing: 0.01em;
}

@media (prefers-reduced-motion: reduce) {
    .slt-ci-dot,
    .slt-ci-dot::after {
        animation: none !important;
    }
}

body.slt-overlay-active .LyricsContent {}

.spicy-translate-overlay {
    pointer-events: none;
    user-select: none;
    z-index: 10;
}

.slt-interleaved-translation {
    display: block;
    font-size: calc(0.45em * var(--slt-overlay-font-scale, 1));
    font-weight: 900;
    padding: 4px 0 12px 0;
    line-height: 1.1818181818;
    pointer-events: none;
    text-align: left;
    white-space: normal;
    word-wrap: break-word;
    overflow-wrap: anywhere;
    word-break: break-word;
    letter-spacing: 0;
    box-sizing: border-box;
    padding-inline-end: 0.25em;
    opacity: var(--Vocal-NotSung-opacity, 0.51);
    filter: blur(var(--BlurAmount, 0px));
    transform-origin: left center;
    transition: all 0.3s cubic-bezier(0.37, 0, 0.63, 1);
    --Vocal-NotSung-opacity: 0.51;
    --Vocal-Active-opacity: 1;
    --Vocal-Sung-opacity: 0.497;
    --DefaultLineScale: 1;
    scale: var(--DefaultLineScale);

    color: rgba(255, 255, 255, 0.85);
}

.slt-interleaved-translation.OppositeAligned,
.slt-interleaved-translation.rtl {
    transform-origin: right center;
    text-align: end;
}

.line.Active + .slt-interleaved-translation,
.slt-interleaved-translation.active,
.slt-interleaved-translation.Active {
    filter: none !important;
    opacity: var(--Vocal-Active-opacity, 1) !important;
    scale: 1;
    text-shadow: var(--ActiveTextGlowDef) !important;
}

.line.Sung + .slt-interleaved-translation {
    opacity: var(--Vocal-Sung-opacity, 0.497);
}

.line.NotSung + .slt-interleaved-translation {
    opacity: var(--Vocal-NotSung-opacity, 0.51);
}

.slt-sync-translation.slt-interleaved-translation {

    --gradient-degrees: 180deg;
    --gradient-alpha: 0.85;
    --gradient-alpha-end: 0.5;
    --gradient-position: -20%;
    --gradient-offset: 0%;

    color: transparent !important;
    -webkit-text-fill-color: transparent !important;
    background-clip: text !important;
    -webkit-background-clip: text !important;
    background-image: linear-gradient(
        var(--gradient-degrees),
        rgba(255, 255, 255, var(--gradient-alpha)) var(--gradient-position),
        rgba(255, 255, 255, var(--gradient-alpha-end)) calc(var(--gradient-position) + 20% + var(--gradient-offset))
    ) !important;
    background-size: 100% 100%;
    background-repeat: no-repeat;
    -webkit-box-decoration-break: slice;
    box-decoration-break: slice;
}

.slt-sync-translation.slt-interleaved-translation.active {
    --gradient-alpha: 0.85;
    --gradient-alpha-end: 0.5;
    filter: none !important;
}

.slt-sync-translation.slt-interleaved-translation.Sung {
    --gradient-position: 100% !important;
    opacity: var(--Vocal-Sung-opacity, 0.497);
}

.slt-sync-translation.slt-interleaved-translation.NotSung {
    --gradient-position: -20% !important;
    opacity: var(--Vocal-NotSung-opacity, 0.51);
}

.line.Sung + .slt-sync-translation.slt-interleaved-translation {
    --gradient-position: 100%;
}

.line.NotSung + .slt-sync-translation.slt-interleaved-translation {
    --gradient-position: -20%;
}

.line.NotSung + .slt-sync-translation.slt-interleaved-translation.active,
.line.Sung + .slt-sync-translation.slt-interleaved-translation.active,
.line.Active + .slt-sync-translation.slt-interleaved-translation {
    filter: blur(0px) !important;
}

.spicy-pip-wrapper .slt-interleaved-overlay .slt-interleaved-translation,
.spicy-pip-wrapper .slt-interleaved-translation {
    font-size: calc(0.82em * var(--slt-overlay-font-scale, 1));
}

.Cinema--Container .slt-interleaved-overlay .slt-interleaved-translation,
.Root__cinema-view .slt-interleaved-overlay .slt-interleaved-translation,
.Cinema--Container .slt-interleaved-translation,
.Root__cinema-view .slt-interleaved-translation,
#SpicyLyricsPage.ForcedCompactMode .slt-interleaved-overlay .slt-interleaved-translation,
#SpicyLyricsPage.ForcedCompactMode .slt-interleaved-translation {
    font-size: calc(0.88em * var(--slt-overlay-font-scale, 1));
}

#SpicyLyricsPage.SidebarMode .slt-interleaved-overlay .slt-interleaved-translation,
#SpicyLyricsPage.SidebarMode .slt-interleaved-translation {
    font-size: calc(0.78em * var(--slt-overlay-font-scale, 1));
}

body.SpicySidebarLyrics__Active .slt-interleaved-overlay .slt-interleaved-translation,
#SpicyLyricsPage.CardMode .slt-interleaved-overlay .slt-interleaved-translation,
body.SpicySidebarLyrics__Active .slt-interleaved-translation,
#SpicyLyricsPage.CardMode .slt-interleaved-translation {
    font-size: calc(0.65em * var(--slt-overlay-font-scale, 1));
    margin-top: 1px;
    margin-bottom: 3px;
}

.slt-sync-line {
    position: relative;
    display: block;
    margin: 8px 0;
    transition: opacity 0.3s ease, filter 0.3s ease;
}

.slt-sync-original {
    display: block;
    line-height: 1.4;
}

.slt-sync-translation {
    display: block;
    font-size: 0.75em;
    margin-top: 4px;
    line-height: 1.3;
}

.slt-sync-word {
    display: inline;
    transform-origin: center center;
    will-change: transform;
    transition: opacity 180ms linear, text-shadow 180ms linear;
    --text-shadow-blur-radius: 4px;
    --text-shadow-opacity: 0%;
    text-shadow: 0 0 var(--text-shadow-blur-radius) rgba(255, 255, 255, var(--text-shadow-opacity));
    --gradient-degrees: 180deg;
    --gradient-alpha: 0.85;
    --gradient-alpha-end: 0.5;
    --gradient-position: -20%;
    --gradient-offset: 0%;
    color: transparent !important;
    -webkit-text-fill-color: transparent !important;
    background-clip: text !important;
    -webkit-background-clip: text !important;
    background-image: linear-gradient(
        var(--gradient-degrees),
        rgba(255, 255, 255, var(--gradient-alpha)) var(--gradient-position),
        rgba(255, 255, 255, var(--gradient-alpha-end)) calc(var(--gradient-position) + 20% + var(--gradient-offset))
    ) !important;
}

.slt-sync-word.slt-word-past,
.slt-sync-word.slt-word-active,
.slt-sync-word.slt-word-future {

}

.slt-sync-word.slt-word-future {
    opacity: 0.51;
}

.slt-sync-word.slt-word-past {
    opacity: 0.6;
}

.slt-sync-word.slt-word-active {
    opacity: 1;
}

.slt-sync-line.slt-line-sung {
    filter: blur(calc(var(--BlurAmount, 0px) * 0.8));
}

.slt-sync-line.slt-line-active {
    filter: none;
}

.slt-sync-line.slt-line-notsung {
    filter: blur(calc(var(--BlurAmount, 0px) * 0.8));
}

.slt-lyrics-scroll-container {
    overflow-y: scroll;
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    -ms-overflow-style: none;
}

.slt-lyrics-scroll-container::-webkit-scrollbar {
    display: none;
}

#SpicyLyricsPage .SpicyLyricsScrollContainer,
#SpicyLyricsPage .LyricsContent,
.LyricsContainer .LyricsContent {
    scroll-behavior: smooth;
}

.line.Active + .slt-sync-translation {
    opacity: 1 !important;
    filter: none !important;
}

.line.Active + .slt-sync-translation .slt-sync-word.slt-word-active {
    text-shadow: 0 0 var(--text-shadow-blur-radius, 10px) rgba(255, 255, 255, var(--text-shadow-opacity-decimal, 0.5));
}

.line.Active + .slt-sync-translation .slt-sync-word.slt-word-past,
.slt-sync-translation.active .slt-sync-word.slt-word-past,
.slt-sync-translation.Active .slt-sync-word.slt-word-past {
    opacity: 1;
}

.line.Sung + .slt-sync-translation .slt-sync-word {
    --gradient-alpha: 0.5;
    --gradient-alpha-end: 0.35;
}

.line.NotSung + .slt-sync-translation .slt-sync-word {
    --gradient-alpha: 0.85;
    --gradient-alpha-end: 0.5;
}

body.SpicySidebarLyrics__Active .slt-sync-line,
#SpicyLyricsPage.CardMode .slt-sync-line {
    margin: 4px 0;
}

body.SpicySidebarLyrics__Active .slt-sync-translation,
#SpicyLyricsPage.CardMode .slt-sync-translation {
    font-size: 0.65em;
    margin-top: 2px;
}

body.SpicySidebarLyrics__Active .slt-sync-word.slt-word-active,
#SpicyLyricsPage.CardMode .slt-sync-word.slt-word-active {
    text-shadow: 0 0 6px rgba(255, 255, 255, 0.4);
}

.spicy-pip-wrapper .slt-sync-line {
    margin: 6px 0;
}

.spicy-pip-wrapper .slt-sync-translation {
    font-size: 0.8em;
}

.Cinema--Container .slt-sync-line,
.Root__cinema-view .slt-sync-line,
#SpicyLyricsPage.ForcedCompactMode .slt-sync-line {
    margin: 12px 0;
}

.Cinema--Container .slt-sync-translation,
.Root__cinema-view .slt-sync-translation,
#SpicyLyricsPage.ForcedCompactMode .slt-sync-translation {
    font-size: 0.85em;
    margin-top: 6px;
}

.Cinema--Container .slt-sync-word.slt-word-active,
.Root__cinema-view .slt-sync-word.slt-word-active,
#SpicyLyricsPage.ForcedCompactMode .slt-sync-word.slt-word-active {
    text-shadow:
        0 0 15px rgba(255, 255, 255, 0.6),
        0 0 30px rgba(255, 255, 255, 0.4),
        0 0 45px rgba(255, 255, 255, 0.2);
}

body.slt-hide-quality-indicator .slt-quality-indicator {
    display: none !important;
}

.slt-replace-line,
.slt-interleaved-translation,
.slt-sync-translation {
    position: relative;
}

.slt-quality-indicator {
    position: absolute;
    right: 0;
    bottom: -2px;
    display: inline-flex;
    align-items: center;
    gap: 0;
    padding: 2px 4px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(6px);
    font-size: 8px;
    font-weight: 500;
    letter-spacing: 0.02em;
    line-height: 1;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease, gap 0.25s ease, padding 0.25s ease, background 0.25s ease;
    white-space: nowrap;
    color: rgba(255, 255, 255, 0.45) !important;
    -webkit-text-fill-color: rgba(255, 255, 255, 0.45) !important;
    background-image: none !important;
    background-clip: border-box !important;
    -webkit-background-clip: border-box !important;
    z-index: 5;
    cursor: default;
}

.slt-replace-line:hover .slt-quality-indicator,
.slt-interleaved-translation:hover .slt-quality-indicator,
.slt-sync-translation:hover .slt-quality-indicator,
.slt-replace-line.active .slt-quality-indicator,
.slt-replace-line.Active .slt-quality-indicator,
.slt-interleaved-translation.active .slt-quality-indicator,
.slt-interleaved-translation.Active .slt-quality-indicator,
.slt-sync-translation.active .slt-quality-indicator,
.slt-sync-translation.Active .slt-quality-indicator {
    opacity: 0.5;
    pointer-events: auto;
}

.slt-quality-indicator:hover {
    opacity: 0.85 !important;
    gap: 4px;
    padding: 2px 7px;
    background: rgba(255, 255, 255, 0.1);
}

.slt-quality-indicator:hover .slt-qi-label {
    max-width: 120px;
    opacity: 1;
}

.slt-qi-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
}

.slt-qi-dot.slt-qi-cached {
    background: #ffe666;
    box-shadow: 0 0 4px rgba(255, 230, 102, 0.35);
}

.slt-qi-dot.slt-qi-fresh {
    background: #1db954;
    box-shadow: 0 0 4px rgba(29, 185, 84, 0.35);
}

.slt-qi-label {
    max-width: 0;
    overflow: hidden;
    opacity: 0;
    transition: max-width 0.3s ease, opacity 0.25s ease;
    color: rgba(255, 255, 255, 0.55) !important;
    -webkit-text-fill-color: rgba(255, 255, 255, 0.55) !important;
    background-image: none !important;
    background-clip: border-box !important;
    -webkit-background-clip: border-box !important;
}

body.SpicySidebarLyrics__Active .slt-quality-indicator,
#SpicyLyricsPage.CardMode .slt-quality-indicator {
    font-size: 7px;
    padding: 1px 3px;
    bottom: -1px;
}

body.SpicySidebarLyrics__Active .slt-qi-dot,
#SpicyLyricsPage.CardMode .slt-qi-dot {
    width: 4px;
    height: 4px;
}

.spicy-pip-wrapper .slt-quality-indicator {
    font-size: 7px;
    padding: 1px 4px;
}

.Cinema--Container .LyricsContainer::before,
.Root__cinema-view .LyricsContainer::before,
.Cinema--Container .LyricsContainer::after,
.Root__cinema-view .LyricsContainer::after,
.Cinema--Container .simplebar-content::before,
.Root__cinema-view .simplebar-content::before,
.Cinema--Container .simplebar-content::after,
.Root__cinema-view .simplebar-content::after,
#SpicyLyricsPage.ForcedCompactMode .LyricsContainer::before,
#SpicyLyricsPage.ForcedCompactMode .LyricsContainer::after,
#SpicyLyricsPage.ForcedCompactMode .simplebar-content::before,
#SpicyLyricsPage.ForcedCompactMode .simplebar-content::after {
    min-height: 100% !important;
}
#SpicyLyricsPage.SpicyRenderer.Fullscreen.MinimalLyricsMode:not(.CompactMode)
  .LyricsContent:not(.HideLineBlur)
  .line.Sung:not(.musical-line) + .slt-replace-line,
#SpicyLyricsPage.SpicyRenderer.Fullscreen.MinimalLyricsMode:not(.CompactMode)
  .LyricsContent:not(.HideLineBlur)
  .line.Sung:not(.musical-line) + .slt-interleaved-translation,
#SpicyLyricsPage.SpicyRenderer.Fullscreen.MinimalLyricsMode:not(.CompactMode)
  .LyricsContent:not(.HideLineBlur)
  .line.Sung:not(.musical-line) + .slt-romanization-line,
#SpicyLyricsPage.SpicyRenderer.Fullscreen.MinimalLyricsMode:not(.CompactMode)
  .LyricsContent:not(.HideLineBlur)
  .slt-romanization-line.Sung,
#SpicyLyricsPage.SpicyRenderer.Fullscreen.MinimalLyricsMode:not(.CompactMode)
  .LyricsContent:not(.HideLineBlur)
  .slt-interleaved-translation.Sung,
#SpicyLyricsPage.SpicyRenderer.Fullscreen.MinimalLyricsMode:not(.CompactMode)
  .LyricsContent:not(.HideLineBlur)
  .slt-replace-line.Sung {
    opacity: 0 !important;
}

#SpicyLyricsPage.SpicyRenderer.Fullscreen.MinimalLyricsMode:not(.CompactMode)
  .LyricsContent:not(.HideLineBlur)
  .line.NotSung:not(.musical-line) + .slt-replace-line,
#SpicyLyricsPage.SpicyRenderer.Fullscreen.MinimalLyricsMode:not(.CompactMode)
  .LyricsContent:not(.HideLineBlur)
  .line.NotSung:not(.musical-line) + .slt-interleaved-translation,
#SpicyLyricsPage.SpicyRenderer.Fullscreen.MinimalLyricsMode:not(.CompactMode)
  .LyricsContent:not(.HideLineBlur)
  .line.NotSung:not(.musical-line) + .slt-romanization-line,
#SpicyLyricsPage.SpicyRenderer.Fullscreen.MinimalLyricsMode:not(.CompactMode)
  .LyricsContent:not(.HideLineBlur)
  .slt-romanization-line.NotSung,
#SpicyLyricsPage.SpicyRenderer.Fullscreen.MinimalLyricsMode:not(.CompactMode)
  .LyricsContent:not(.HideLineBlur)
  .slt-interleaved-translation.NotSung,
#SpicyLyricsPage.SpicyRenderer.Fullscreen.MinimalLyricsMode:not(.CompactMode)
  .LyricsContent:not(.HideLineBlur)
  .slt-replace-line.NotSung {
    opacity: 0.5 !important;
}
`;
  function injectStyles() {
    const existingStyle = document.getElementById("spicy-lyric-translator-styles");
    if (existingStyle) {
      return;
    }
    const styleElement = document.createElement("style");
    styleElement.id = "spicy-lyric-translator-styles";
    styleElement.textContent = styles + getOverlayStyles();
    document.head.appendChild(styleElement);
  }

  // src/utils/uiTheme.ts
  var MONO_BASE = "#1b1b1b";
  var MONO_OVERRIDES = {
    "--slt-ui-accent": "oklch(0.93 0 0)",
    "--slt-ui-accent-hover": "oklch(0.98 0 0)",
    "--slt-ui-accent-ink": MONO_BASE,
    "--slt-ui-field": MONO_BASE,
    "--slt-ui-field-deep": "#151515",
    "--slt-ui-raised": "#242424",
    "--slt-ui-band": "linear-gradient(90deg, oklch(0.62 0 0), oklch(0.93 0 0))"
  };
  function spicyThemesState() {
    try {
      const state3 = window.SpicyThemes?.getState?.();
      return state3 && typeof state3 === "object" ? state3 : null;
    } catch {
      return null;
    }
  }
  function spicyThemesActive() {
    const state3 = spicyThemesState();
    return !!state3 && state3.isEnabled !== false && !!state3.activeTheme && typeof state3.activeTheme === "object";
  }
  var themeState = {
    get activeTheme() {
      const state3 = spicyThemesState();
      return spicyThemesActive() && state3?.activeTheme ? state3.activeTheme : {};
    }
  };
  function adaptToneVars(tone, vars) {
    if (tone !== "accent" || spicyThemesActive())
      return vars;
    const out = {};
    for (const [key, value] of Object.entries(vars)) {
      out[key] = key in MONO_OVERRIDES ? MONO_OVERRIDES[key] : value.replace(/oklch\(\s*([\d.]+)\s+[\d.]+\s+[\d.]+\s*\)/g, "oklch($1 0 0)");
    }
    out["--slt-ui-knob"] = MONO_BASE;
    return out;
  }

  // src/utils/icons.ts
  var Icons = {
    Translate: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v2.01h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
    </svg>`,
    TranslateOff: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v2.01h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
        <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
    Learning: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z"/>
    </svg>`,
    LearningOff: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z"/>
        <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
    Settings: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
    </svg>`,
    Loading: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="spicy-translate-loading">
        <path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/>
    </svg>`,
    Connection: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
    </svg>`,
    Users: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
    </svg>`
  };

  // src/utils/surface.ts
  var STYLE_ID = "slt-ui-styles";
  var EASE = "cubic-bezier(0.2, 0.9, 0.1, 1)";
  var BRAND_HUE = 28;
  var BRAND_CHROMA = 0.16;
  var reducedMotion = typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  function prefersReducedMotion() {
    return !!reducedMotion?.matches;
  }
  function parseColor(value) {
    if (typeof value !== "string")
      return null;
    const v = value.trim();
    const rgb = v.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)/i);
    if (rgb)
      return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
    let hex = v.replace(/^#/, "");
    if (!/^[0-9a-f]{3,8}$/i.test(hex))
      return null;
    if (hex.length === 3 || hex.length === 4)
      hex = hex.split("").slice(0, 3).map((c) => c + c).join("");
    if (hex.length < 6)
      return null;
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  }
  function toOklch([r8, g8, b8]) {
    const lin = (v) => {
      const c2 = v / 255;
      return c2 <= 0.04045 ? c2 / 12.92 : Math.pow((c2 + 0.055) / 1.055, 2.4);
    };
    const r = lin(r8), g = lin(g8), b = lin(b8);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
    const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    const c = Math.sqrt(A * A + B * B);
    let h = Math.atan2(B, A) * 180 / Math.PI;
    if (h < 0)
      h += 360;
    return { l: L, c, h };
  }
  var clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  var fmt = (n, d = 3) => Number(n.toFixed(d));
  var ok = (l, c, h) => `oklch(${fmt(l)} ${fmt(c)} ${fmt(h, 1)})`;
  var ACCENT_KEYS = [
    "playerAccentColor",
    "highlightColor",
    "gradientStartColor",
    "gradientEndColor",
    "activeGlowColor",
    "glowColor",
    "eqColor",
    "activeLineColor",
    "sungLineColor",
    "animBgColor",
    "bgGlowColor"
  ];
  var BAND_KEYS = [
    "activeLineColor",
    "gradientStartColor",
    "gradientEndColor",
    "activeGlowColor",
    "sungLineColor",
    "glowColor",
    "notSungLineColor"
  ];
  function themeAccent(theme) {
    let best = null;
    for (const key of ACCENT_KEYS) {
      const rgb = parseColor(String(theme[key] ?? ""));
      if (!rgb)
        continue;
      const { c, h } = toOklch(rgb);
      if (!best || c > best.c)
        best = { h, c };
    }
    if (!best || best.c < 0.035)
      return { h: BRAND_HUE, c: BRAND_CHROMA };
    return best;
  }
  function themeBand(theme, accent) {
    const seen = /* @__PURE__ */ new Set();
    const stops = [];
    for (const key of BAND_KEYS) {
      const rgb = parseColor(String(theme[key] ?? ""));
      if (!rgb)
        continue;
      const { l, c, h } = toOklch(rgb);
      const id = `${Math.round(l * 20)}:${Math.round(c * 40)}:${Math.round(h / 20)}`;
      if (seen.has(id))
        continue;
      seen.add(id);
      stops.push(ok(clamp(l, 0.55, 0.92), c, h));
      if (stops.length >= 4)
        break;
    }
    if (stops.length < 2)
      stops.push(accent);
    stops.unshift(accent);
    return `linear-gradient(90deg, ${stops.join(", ")})`;
  }
  var FIXED_TONES = {
    hotfix: { h: 72, c: 0.15 },
    error: { h: 24, c: 0.17 },
    success: { h: 152, c: 0.14 }
  };
  function baseToneVars(tone = "accent") {
    const theme = themeState.activeTheme;
    const base = tone === "accent" ? themeAccent(theme) : FIXED_TONES[tone];
    const h = base.h;
    const c = clamp(base.c, 0.09, 0.19);
    const accent = ok(0.76, c, h);
    const band = tone === "accent" ? themeBand(theme, accent) : `linear-gradient(90deg, ${ok(0.72, c, h - 18)}, ${accent}, ${ok(0.82, c * 0.8, h + 22)})`;
    return {
      "--slt-ui-hue": String(fmt(h, 1)),
      "--slt-ui-accent": accent,
      "--slt-ui-accent-hover": ok(0.83, c * 0.9, h),
      "--slt-ui-accent-ink": ok(0.22, Math.min(c, 0.08), h),
      "--slt-ui-accent-soft": `color-mix(in oklab, ${accent} 16%, transparent)`,
      "--slt-ui-accent-line": `color-mix(in oklab, ${accent} 42%, transparent)`,
      "--slt-ui-field": ok(0.215, Math.min(c * 0.1, 0.012), h),
      "--slt-ui-field-deep": ok(0.18, Math.min(c * 0.08, 9e-3), h),
      "--slt-ui-raised": ok(0.255, Math.min(c * 0.1, 0.012), h),
      "--slt-ui-ink": ok(0.97, 4e-3, h),
      "--slt-ui-ink-muted": ok(0.78, 8e-3, h),
      "--slt-ui-ink-faint": ok(0.62, 8e-3, h),
      "--slt-ui-line": "rgba(255, 255, 255, 0.08)",
      "--slt-ui-band": band
    };
  }
  var painted = /* @__PURE__ */ new Set();
  function paintTone(el2, tone = "accent") {
    const vars = toneVars(tone);
    Object.entries(vars).forEach(([k, v]) => el2.style.setProperty(k, v));
    el2.dataset.sltTone = tone;
    for (const entry of painted) {
      if (entry.el === el2) {
        entry.tone = tone;
        return;
      }
    }
    painted.add({ el: el2, tone });
  }
  function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([key, value]) => {
      if (value === void 0 || value === false)
        return;
      if (key === "class")
        node.className = String(value);
      else if (key === "text")
        node.textContent = String(value);
      else if (key === "html")
        node.innerHTML = String(value);
      else
        node.setAttribute(key, value === true ? "" : String(value));
    });
    children.forEach((child) => {
      if (child === null || child === void 0 || child === false)
        return;
      node.append(child);
    });
    return node;
  }
  function text(content, variant = "") {
    return el("p", { class: `slt-ui-text${variant ? ` slt-ui-text-${variant}` : ""}`, text: content });
  }
  var CLOSE_SVG = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  var CHEVRON_SVG = '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function ensureSurfaceStyles() {
    if (document.getElementById(STYLE_ID))
      return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = SURFACE_STYLES;
    document.head.appendChild(style);
  }
  var stack = [];
  var keyListenerBound = false;
  function topSurface() {
    for (let i = stack.length - 1; i >= 0; i--) {
      if (!stack[i].closed)
        return stack[i];
    }
    return null;
  }
  function openSurfaces() {
    return stack.filter((s) => !s.closed);
  }
  function focusables(root) {
    return Array.from(root.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter((n) => n.offsetParent !== null || n === document.activeElement);
  }
  function onDocumentKey(event) {
    const top = topSurface();
    if (!top)
      return;
    if (event.key === "Escape") {
      const target = event.target;
      const local = target?.closest?.("[data-slt-esc-local]");
      if (local && top.panel.contains(local) && local.value)
        return;
      if (document.querySelector(".slt-ui-menu")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeMenus();
        return;
      }
      if (top.root.dataset.dismissible === "false")
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      top.dismiss();
      return;
    }
    if (event.key !== "Tab")
      return;
    const items = focusables(top.panel);
    if (!items.length)
      return;
    const first = items[0];
    const last = items[items.length - 1];
    const current = document.activeElement;
    const inside = !!current && top.panel.contains(current);
    if (event.shiftKey && (current === first || !inside)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (current === last || !inside)) {
      event.preventDefault();
      first.focus();
    }
  }
  function bindKeys() {
    if (keyListenerBound)
      return;
    keyListenerBound = true;
    document.addEventListener("keydown", onDocumentKey, true);
  }
  function unbindKeysIfIdle() {
    if (topSurface() || !keyListenerBound)
      return;
    keyListenerBound = false;
    document.removeEventListener("keydown", onDocumentKey, true);
  }
  function closeMenus() {
    document.querySelectorAll(".slt-ui-menu").forEach((menu) => {
      menu._sltCleanup?.();
      menu.remove();
    });
  }
  function openMenu(anchor, items, within) {
    closeMenus();
    ensureSurfaceStyles();
    const host = within || anchor.closest("[data-slt-tone]") || document.body;
    const menu = el("div", { class: "slt-ui-menu", role: "menu" });
    items.forEach((item) => {
      const btn = el(
        "button",
        { class: "slt-ui-menu-item", type: "button", role: "menuitem" },
        el("span", { class: "slt-ui-menu-label", text: item.label }),
        item.hint ? el("span", { class: "slt-ui-menu-hint", text: item.hint }) : null
      );
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        closeMenus();
        item.onClick();
      });
      menu.append(btn);
    });
    host.append(menu);
    const a = anchor.getBoundingClientRect();
    const m = menu.getBoundingClientRect();
    const top = a.top - m.height - 6 >= 8 ? a.top - m.height - 6 : a.bottom + 6;
    const left = clamp(a.right - m.width, 8, window.innerWidth - m.width - 8);
    menu.style.top = `${Math.round(top)}px`;
    menu.style.left = `${Math.round(left)}px`;
    menu.querySelector("button")?.focus({ preventScroll: true });
    const onDown = (e) => {
      if (e.target instanceof Node && (menu.contains(e.target) || anchor.contains(e.target)))
        return;
      closeMenus();
    };
    const onKey = (e) => {
      const buttons = Array.from(menu.querySelectorAll("button"));
      const index = buttons.indexOf(document.activeElement);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        buttons[(index + 1) % buttons.length]?.focus();
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        buttons[(index - 1 + buttons.length) % buttons.length]?.focus();
      }
    };
    window.addEventListener("pointerdown", onDown, true);
    menu.addEventListener("keydown", onKey);
    menu._sltCleanup = () => window.removeEventListener("pointerdown", onDown, true);
    if (!prefersReducedMotion()) {
      menu.animate([{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], { duration: 160, easing: EASE });
    }
  }
  function renderActions(footer, actions, handle) {
    footer.innerHTML = "";
    footer.hidden = actions.length === 0;
    actions.forEach((action) => {
      const kind = action.kind || "quiet";
      const cls = `slt-ui-btn slt-ui-btn-${kind}${action.menu ? " slt-ui-btn-menu" : ""}`;
      const node = action.href ? el("a", { class: cls, href: action.href, target: "_blank", rel: "noopener noreferrer", "data-action": action.id }) : el("button", { class: cls, type: "button", "data-action": action.id });
      node.append(el("span", { class: "slt-ui-btn-label", text: action.label }));
      if (action.menu)
        node.insertAdjacentHTML("beforeend", CHEVRON_SVG);
      node.addEventListener("click", async (event) => {
        if (action.menu) {
          event.preventDefault();
          openMenu(node, action.menu, handle.root);
          return;
        }
        if (!action.href)
          event.preventDefault();
        if (handle.root.classList.contains("slt-ui-busy"))
          return;
        try {
          await action.onClick?.(handle);
        } finally {
          if (!action.keepOpen && !handle.closed)
            handle.close();
        }
      });
      footer.append(node);
    });
  }
  function eyebrow(label) {
    const node = el("div", { class: "slt-ui-eyebrow" });
    node.innerHTML = `<span class="slt-ui-eyebrow-mark">${Icons.Translate}</span>`;
    node.append(el("span", { text: label }));
    return node;
  }
  function stagger(nodes, offset = 0) {
    let i = offset;
    for (const node of nodes) {
      node.style.setProperty("--slt-ui-i", String(i++));
    }
  }
  function buildPanel(options, handleRef, kind) {
    const panel = el("section", {
      class: `slt-ui-panel slt-ui-${kind} slt-ui-size-${options.size || "md"}${options.bare ? " slt-ui-bare" : ""}${options.className ? ` ${options.className}` : ""}`,
      role: kind === "dialog" ? "dialog" : "region",
      "aria-modal": kind === "dialog" ? "true" : void 0,
      tabindex: "-1"
    });
    const titleId = `slt-ui-title-${Math.random().toString(36).slice(2, 8)}`;
    panel.setAttribute("aria-labelledby", titleId);
    const titleEl = el("h2", { class: "slt-ui-title", id: titleId, text: options.title });
    const closeBtn = el("button", { class: "slt-ui-x", type: "button", "aria-label": kind === "dock" ? "Hide" : "Close", html: CLOSE_SVG });
    closeBtn.addEventListener("click", () => handleRef.current?.dismiss());
    if (!options.bare) {
      const head = el(
        "header",
        { class: "slt-ui-head slt-ui-stagger" },
        eyebrow(options.eyebrow || "Spicy Lyric Translator"),
        titleEl
      );
      panel.append(head);
      if (options.closeButton !== false && options.dismissible !== false)
        panel.append(closeBtn);
    } else {
      titleEl.classList.add("slt-ui-sr");
      panel.append(titleEl);
    }
    const body = el("div", { class: "slt-ui-body" });
    (options.body || []).forEach((node) => {
      const child = typeof node === "string" ? text(node) : node;
      child.classList.add("slt-ui-stagger");
      body.append(child);
    });
    if (options.content)
      body.append(options.content);
    panel.append(body);
    const footer = el("footer", { class: "slt-ui-actions slt-ui-stagger" });
    panel.append(footer);
    return { panel, body, footer, titleEl };
  }
  function makeHandle(root, parts, options, teardown) {
    const handle = {
      root,
      panel: parts.panel,
      body: parts.body,
      footer: parts.footer,
      closed: false,
      close: (opts = {}) => {
        if (handle.closed)
          return;
        handle.closed = true;
        closeMenus();
        teardown(opts);
        try {
          options.onClose?.();
        } catch {
        }
      },
      dismiss: () => {
        if (handle.closed || options.dismissible === false)
          return;
        handle.close();
        try {
          options.onDismiss?.();
        } catch {
        }
      },
      setBusy: (busy, label) => {
        root.classList.toggle("slt-ui-busy", busy);
        parts.footer.querySelectorAll("button").forEach((b) => {
          b.disabled = busy;
        });
        const primary = parts.footer.querySelector(".slt-ui-btn-primary .slt-ui-btn-label");
        if (primary) {
          if (busy && label) {
            primary.dataset.idle = primary.dataset.idle || primary.textContent || "";
            primary.textContent = label;
          } else if (!busy && primary.dataset.idle) {
            primary.textContent = primary.dataset.idle;
            delete primary.dataset.idle;
          }
        }
      },
      setActions: (actions) => renderActions(parts.footer, actions, handle),
      setTitle: (title) => {
        parts.titleEl.textContent = title;
      },
      setTone: (tone) => paintTone(root, tone)
    };
    return handle;
  }
  function openDialog(options) {
    ensureSurfaceStyles();
    const overlay = el("div", { class: `slt-ui-overlay slt-ui-place-${options.placement || "center"}`, "data-slt-ui": "dialog" });
    overlay.dataset.dismissible = String(options.dismissible !== false);
    if (openSurfaces().some((s) => s.root.classList.contains("slt-ui-overlay")))
      overlay.classList.add("slt-ui-stacked");
    paintTone(overlay, options.tone || "accent");
    const ref = { current: null };
    const parts = buildPanel(options, ref, "dialog");
    overlay.append(parts.panel);
    const previousFocus = document.activeElement;
    let pressedBackdrop = false;
    overlay.addEventListener("pointerdown", (e) => {
      pressedBackdrop = e.target === overlay;
    });
    overlay.addEventListener("click", (e) => {
      if (pressedBackdrop && e.target === overlay)
        ref.current?.dismiss();
      pressedBackdrop = false;
    });
    const handle = makeHandle(overlay, parts, options, ({ silent }) => {
      const index = stack.indexOf(handle);
      if (index >= 0)
        stack.splice(index, 1);
      unbindKeysIfIdle();
      if (previousFocus && previousFocus.isConnected)
        previousFocus.focus({ preventScroll: true });
      overlay.classList.remove("slt-ui-open");
      overlay.classList.add("slt-ui-closing");
      if (silent || prefersReducedMotion())
        overlay.remove();
      else
        setTimeout(() => overlay.remove(), 200);
    });
    ref.current = handle;
    renderActions(parts.footer, options.actions || [], handle);
    stagger(parts.panel.querySelectorAll(".slt-ui-stagger"));
    document.body.append(overlay);
    stack.push(handle);
    bindKeys();
    overlay.getBoundingClientRect();
    overlay.classList.add("slt-ui-open");
    const origin = options.origin;
    if (origin && !prefersReducedMotion()) {
      const r = parts.panel.getBoundingClientRect();
      parts.panel.animate([
        { clipPath: insetFrom(origin, r, 14), opacity: 0.6 },
        { clipPath: "inset(0 round 18px)", opacity: 1 }
      ], { duration: 460, easing: EASE });
    }
    const primary = parts.footer.querySelector(".slt-ui-btn-primary");
    const autofocus = parts.panel.querySelector("[data-slt-autofocus]");
    (autofocus || primary || parts.panel).focus({ preventScroll: true });
    return handle;
  }
  function insetFrom(o, r, radius) {
    const top = clamp(o.top - r.top, 0, r.height);
    const left = clamp(o.left - r.left, 0, r.width);
    const right = clamp(r.right - o.right, 0, r.width);
    const bottom = clamp(r.bottom - o.bottom, 0, r.height);
    if (top + bottom >= r.height - 4 || left + right >= r.width - 4) {
      return `inset(${fmt(r.height / 2 - 20, 0)}px ${fmt(r.width / 2 - 60, 0)}px round ${radius}px)`;
    }
    return `inset(${fmt(top, 0)}px ${fmt(right, 0)}px ${fmt(bottom, 0)}px ${fmt(left, 0)}px round ${radius}px)`;
  }
  var dockHandle = null;
  function activeDock() {
    return dockHandle && !dockHandle.closed ? dockHandle : null;
  }
  function openDock(options) {
    ensureSurfaceStyles();
    dockHandle?.close({ silent: true });
    const region2 = toastRegion();
    const wrap = el("div", { class: "slt-ui-dock-wrap", "data-slt-ui": "dock" });
    paintTone(wrap, options.tone || "accent");
    const ref = { current: null };
    const parts = buildPanel({ ...options, size: "sm" }, ref, "dock");
    wrap.append(parts.panel);
    const handle = makeHandle(wrap, parts, options, ({ silent, to }) => {
      if (dockHandle === handle)
        dockHandle = null;
      if (silent || prefersReducedMotion()) {
        wrap.remove();
        return;
      }
      const r = parts.panel.getBoundingClientRect();
      const anim = parts.panel.animate([
        { clipPath: "inset(0 round 18px)", opacity: 1 },
        to ? { clipPath: insetFrom(to, r, 14), opacity: 0 } : { clipPath: `inset(${fmt(r.height - 6, 0)}px 0 0 0 round 18px)`, opacity: 0 }
      ], { duration: 260, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "forwards" });
      anim.onfinish = () => wrap.remove();
      window.setTimeout(() => wrap.remove(), 400);
    });
    ref.current = handle;
    renderActions(parts.footer, options.actions || [], handle);
    stagger(parts.panel.querySelectorAll(".slt-ui-stagger"));
    region2.prepend(wrap);
    dockHandle = handle;
    wrap.getBoundingClientRect();
    wrap.classList.add("slt-ui-open");
    if (!prefersReducedMotion()) {
      const r = parts.panel.getBoundingClientRect();
      const from = options.origin ? insetFrom(options.origin, r, 14) : `inset(${fmt(r.height - 8, 0)}px 0 0 0 round 18px)`;
      parts.panel.animate([
        { clipPath: from },
        { clipPath: "inset(0 round 18px)" }
      ], { duration: 480, easing: EASE });
    }
    return handle;
  }
  var region = null;
  var regionObserver = null;
  var observedBar = null;
  function placeRegion() {
    if (!region)
      return;
    const bar = document.querySelector(".Root__now-playing-bar") ?? document.querySelector('[data-testid="now-playing-bar"]')?.parentElement ?? null;
    let bottom = 16;
    if (bar) {
      const rect = bar.getBoundingClientRect();
      if (rect.height > 0 && rect.top < window.innerHeight)
        bottom = Math.max(16, window.innerHeight - rect.top + 12);
    }
    region.style.setProperty("--slt-ui-region-bottom", `${Math.round(bottom)}px`);
    if (bar !== observedBar && typeof ResizeObserver !== "undefined") {
      regionObserver?.disconnect();
      observedBar = bar;
      if (bar) {
        regionObserver = new ResizeObserver(placeRegion);
        regionObserver.observe(bar);
      }
    }
  }
  function toastRegion() {
    ensureSurfaceStyles();
    if (!region || !region.isConnected) {
      region = el("div", { class: "slt-ui-region", "aria-live": "polite" });
      paintTone(region, "accent");
      document.body.append(region);
      window.addEventListener("resize", placeRegion);
    }
    placeRegion();
    return region;
  }
  var SURFACE_STYLES = `
.slt-ui-overlay,
.slt-ui-region,
.slt-ui-menu {
    --slt-ui-ease: ${EASE};
    font-family: var(--encore-body-font-stack, var(--fallback-fonts, system-ui, sans-serif));
    -webkit-font-smoothing: antialiased;
    color: var(--slt-ui-ink);
    letter-spacing: 0;
}
.slt-ui-overlay {
    position: fixed;
    inset: 0;
    z-index: 2147482000;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    padding: 16px;
    background: rgba(0, 0, 0, 0);
    -webkit-backdrop-filter: blur(0) saturate(1);
    backdrop-filter: blur(0) saturate(1);
    transition: background-color 0.24s var(--slt-ui-ease), backdrop-filter 0.24s var(--slt-ui-ease), -webkit-backdrop-filter 0.24s var(--slt-ui-ease);
}
.slt-ui-overlay.slt-ui-place-top {
    align-items: flex-start;
    padding-top: min(14vh, 120px);
}
.slt-ui-overlay.slt-ui-open {
    background: rgba(0, 0, 0, 0.6);
    -webkit-backdrop-filter: blur(6px) saturate(1.1);
    backdrop-filter: blur(6px) saturate(1.1);
}
.slt-ui-overlay.slt-ui-stacked.slt-ui-open {
    background: rgba(0, 0, 0, 0.32);
    -webkit-backdrop-filter: blur(2px);
    backdrop-filter: blur(2px);
}
.slt-ui-overlay.slt-ui-closing {
    pointer-events: none;
    transition-duration: 0.16s;
}
.slt-ui-overlay.slt-ui-peek {
    background: transparent !important;
    -webkit-backdrop-filter: none !important;
    backdrop-filter: none !important;
}
.slt-ui-overlay.slt-ui-peek .slt-ui-panel {
    opacity: 0.06 !important;
    transform: scale(0.99) !important;
    transition: opacity 0.18s var(--slt-ui-ease), transform 0.18s var(--slt-ui-ease);
}
.slt-ui-panel {
    position: relative;
    isolation: isolate;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    width: min(var(--slt-ui-w, 30rem), 100%);
    max-height: 100%;
    overflow: hidden;
    border-radius: 18px;
    border: 1px solid var(--slt-ui-line);
    outline: none;
    background: linear-gradient(180deg, var(--slt-ui-field) 0%, var(--slt-ui-field-deep) 100%);
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.05),
        0 24px 60px -24px rgba(0, 0, 0, 0.7),
        0 0 0 1px rgba(0, 0, 0, 0.25);
    color: var(--slt-ui-ink);
    font-size: 14px;
    line-height: 1.45;
}
.slt-ui-size-sm { --slt-ui-w: 25rem; }
.slt-ui-size-md { --slt-ui-w: 31rem; }
.slt-ui-size-lg { --slt-ui-w: 42rem; }
.slt-ui-size-xl { --slt-ui-w: 68rem; }
.slt-ui-dialog {
    opacity: 0;
    transform: translateY(10px);
    transform: translateY(8px) scale(0.985);
    transition: opacity 0.2s var(--slt-ui-ease), transform 0.4s var(--slt-ui-ease);
}
.slt-ui-open > .slt-ui-dialog {
    opacity: 1;
    transform: none;
}
.slt-ui-closing > .slt-ui-dialog {
    opacity: 0;
    transform: translateY(4px) scale(0.985);
    transition-duration: 0.16s;
    transition-timing-function: cubic-bezier(0.4, 0, 1, 1);
}
.slt-ui-head {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 26px 56px 4px 26px;
}
.slt-ui-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 12px;
    font-weight: 600;
    color: var(--slt-ui-ink-muted);
}
.slt-ui-eyebrow-mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--slt-ui-ink-muted);
}
.slt-ui-eyebrow-mark svg { width: 14px; height: 14px; }
.slt-ui-title {
    margin: 0;
    font-size: 24px;
    font-weight: 750;
    line-height: 1.15;
    letter-spacing: -0.02em;
    color: var(--slt-ui-ink);
    overflow-wrap: anywhere;
}
.slt-ui-sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
}
.slt-ui-x {
    position: absolute;
    top: 16px;
    right: 16px;
    z-index: 3;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: var(--slt-ui-ink-muted);
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
}
.slt-ui-x:hover { background: var(--slt-ui-line); color: var(--slt-ui-ink); }
.slt-ui-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px 26px 4px;
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 0;
    overscroll-behavior: contain;
}
.slt-ui-bare .slt-ui-body { padding: 0; gap: 0; flex: 1 1 auto; }
.slt-ui-body::-webkit-scrollbar { width: 6px; }
.slt-ui-body::-webkit-scrollbar-thumb { background: var(--slt-ui-line); border-radius: 6px; }
.slt-ui-text {
    margin: 0;
    font-size: 14px;
    line-height: 1.55;
    color: var(--slt-ui-ink-muted);
}
.slt-ui-text-quiet { font-size: 12.5px; color: var(--slt-ui-ink-faint); }
.slt-ui-text-strong { color: var(--slt-ui-ink); font-weight: 600; }
.slt-ui-text a, .slt-ui-link {
    color: var(--slt-ui-ink);
    font-weight: 600;
    text-decoration: underline;
    text-decoration-color: var(--slt-ui-accent-line);
    text-underline-offset: 3px;
}
.slt-ui-text a:hover, .slt-ui-link:hover { text-decoration-color: var(--slt-ui-accent); }
.slt-ui-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 18px 26px 24px;
}
.slt-ui-actions[hidden] { display: none; }
.slt-ui-bare .slt-ui-actions { display: none; }
.slt-ui-btn {
    appearance: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    box-sizing: border-box;
    min-height: 40px;
    margin: 0;
    padding: 0 18px;
    border: 0;
    border-radius: 12px;
    font: inherit;
    font-size: 13.5px;
    font-weight: 700;
    white-space: nowrap;
    text-decoration: none;
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease, transform 0.12s ease, box-shadow 0.15s ease;
}
.slt-ui-btn:active:not(:disabled) { transform: scale(0.97); }
.slt-ui-btn:disabled { opacity: 0.55; cursor: default; }
.slt-ui-btn-primary {
    background: var(--slt-ui-accent);
    color: var(--slt-ui-accent-ink);
}
.slt-ui-btn-primary:hover:not(:disabled) { background: var(--slt-ui-accent-hover); }
.slt-ui-btn-quiet {
    background: transparent;
    color: var(--slt-ui-ink-muted);
    padding: 0 14px;
}
.slt-ui-btn-quiet:hover:not(:disabled) { background: var(--slt-ui-line); color: var(--slt-ui-ink); }
.slt-ui-btn-ghost {
    background: var(--slt-ui-line);
    color: var(--slt-ui-ink);
}
.slt-ui-btn-ghost:hover:not(:disabled) { background: color-mix(in oklab, var(--slt-ui-ink) 17%, transparent); }
.slt-ui-btn-danger {
    background: color-mix(in oklab, oklch(0.65 0.18 24) 18%, transparent);
    color: oklch(0.85 0.09 24);
}
.slt-ui-btn-danger:hover:not(:disabled) { background: color-mix(in oklab, oklch(0.65 0.18 24) 28%, transparent); }
.slt-ui-btn-menu svg { opacity: 0.7; }
.slt-ui-btn:focus-visible,
.slt-ui-x:focus-visible,
.slt-ui-menu-item:focus-visible,
.slt-ui-toast button:focus-visible {
    outline: 2px solid var(--slt-ui-accent);
    outline-offset: 2px;
}
.slt-ui-busy .slt-ui-btn-primary .slt-ui-btn-label::before {
    content: '';
    display: inline-block;
    width: 12px;
    height: 12px;
    margin-right: 8px;
    vertical-align: -2px;
    border-radius: 50%;
    border: 2px solid color-mix(in oklab, var(--slt-ui-accent-ink) 30%, transparent);
    border-top-color: var(--slt-ui-accent-ink);
    animation: slt-ui-spin 0.8s linear infinite;
}
@keyframes slt-ui-spin { to { transform: rotate(360deg); } }
.slt-ui-stagger {
    transition: opacity 0.34s var(--slt-ui-ease), transform 0.44s var(--slt-ui-ease), filter 0.44s var(--slt-ui-ease);
    transition-delay: calc(120ms + var(--slt-ui-i, 0) * 40ms);
}
.slt-ui-overlay:not(.slt-ui-open):not(.slt-ui-closing) .slt-ui-stagger,
.slt-ui-dock-wrap:not(.slt-ui-open) .slt-ui-stagger {
    opacity: 0;
    transform: translateY(8px);
    filter: blur(3px);
}
.slt-ui-menu {
    position: fixed;
    z-index: 2147482600;
    min-width: 200px;
    padding: 6px;
    border-radius: 14px;
    border: 1px solid var(--slt-ui-line);
    background: linear-gradient(170deg, var(--slt-ui-raised), var(--slt-ui-field));
    box-shadow: 0 18px 40px -16px rgba(0, 0, 0, 0.75);
}
.slt-ui-menu-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
    width: 100%;
    padding: 9px 12px;
    border: 0;
    border-radius: 9px;
    background: transparent;
    color: var(--slt-ui-ink);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
}
.slt-ui-menu-item:hover, .slt-ui-menu-item:focus { background: var(--slt-ui-line); outline: none; }
.slt-ui-menu-hint { font-size: 11.5px; font-weight: 500; color: var(--slt-ui-ink-faint); }
.slt-ui-region {
    position: fixed;
    left: 16px;
    bottom: var(--slt-ui-region-bottom, 96px);
    z-index: 2147482500;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: flex-start;
    gap: 10px;
    width: min(400px, calc(100vw - 32px));
    pointer-events: none;
}
.slt-ui-region > * { pointer-events: auto; }
.slt-ui-dock-wrap { width: 100%; }
.slt-ui-dock {
    width: 100%;
    max-height: min(70vh, 560px);
    box-shadow:
        inset 0 1px 0 color-mix(in oklab, var(--slt-ui-ink) 10%, transparent),
        0 22px 50px -18px rgba(0, 0, 0, 0.8);
}
.slt-ui-dock .slt-ui-head { padding: 22px 52px 2px 22px; }
.slt-ui-dock .slt-ui-title { font-size: 20px; }
.slt-ui-dock .slt-ui-body { padding: 10px 22px 2px; }
.slt-ui-dock .slt-ui-actions { padding: 16px 22px 20px; }
.slt-ui-dock .slt-ui-x { top: 14px; right: 14px; }
.slt-ui-toast {
    position: relative;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: start;
    gap: 12px;
    width: 100%;
    box-sizing: border-box;
    padding: 13px 12px 14px 14px;
    overflow: hidden;
    border-radius: 14px;
    border: 1px solid var(--slt-ui-line);
    background: linear-gradient(180deg, var(--slt-ui-raised) 0%, var(--slt-ui-field) 100%);
    box-shadow: inset 0 1px 0 color-mix(in oklab, var(--slt-ui-ink) 10%, transparent), 0 16px 36px -14px rgba(0, 0, 0, 0.75);
    color: var(--slt-ui-ink);
    font-size: 13px;
}
.slt-ui-toast-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 8px;
    background: var(--slt-ui-accent-soft);
    color: var(--slt-ui-accent);
}
.slt-ui-toast-icon svg { width: 15px; height: 15px; }
.slt-ui-toast-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; padding-top: 3px; }
.slt-ui-toast-title { font-weight: 650; font-size: 13.5px; line-height: 1.35; overflow-wrap: anywhere; }
.slt-ui-toast-count {
    margin-left: 6px;
    padding: 0 6px;
    border-radius: 999px;
    background: var(--slt-ui-line);
    font-size: 11px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--slt-ui-ink-muted);
}
.slt-ui-toast-desc { font-size: 12.5px; line-height: 1.45; color: var(--slt-ui-ink-muted); overflow-wrap: anywhere; }
.slt-ui-toast-actions { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
.slt-ui-toast-btn {
    appearance: none;
    border: 0;
    border-radius: 9px;
    padding: 6px 11px;
    font: inherit;
    font-size: 12.5px;
    font-weight: 700;
    cursor: pointer;
    background: var(--slt-ui-line);
    color: var(--slt-ui-ink);
    transition: background-color 0.15s ease;
}
.slt-ui-toast-btn:hover { background: color-mix(in oklab, var(--slt-ui-ink) 18%, transparent); }
.slt-ui-toast-btn.slt-ui-toast-btn-primary { background: var(--slt-ui-accent); color: var(--slt-ui-accent-ink); }
.slt-ui-toast-btn.slt-ui-toast-btn-primary:hover { background: var(--slt-ui-accent-hover); }
.slt-ui-toast-x {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    padding: 0;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--slt-ui-ink-faint);
    cursor: pointer;
}
.slt-ui-toast-x:hover { background: var(--slt-ui-line); color: var(--slt-ui-ink); }
.slt-ui-toast-timer {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 2px;
    background: transparent;
}
.slt-ui-toast-timer i {
    display: block;
    height: 100%;
    background: color-mix(in oklab, var(--slt-ui-accent) 55%, transparent);
    transform-origin: left center;
}
.slt-ui-dock .slt-ui-actions { justify-content: flex-start; }
.slt-ui-dock .slt-ui-actions .slt-ui-btn-primary { order: -1; flex: 1 1 100%; }
.slt-ui-dock .slt-ui-actions .slt-ui-btn-ghost { margin-left: auto; }
.slt-ui-text[hidden] { display: none; }
.slt-ui-form { display: flex; flex-direction: column; gap: 12px; }
.slt-ui-field { display: flex; flex-direction: column; gap: 6px; font-size: 12px; font-weight: 650; color: var(--slt-ui-ink-muted); }
.slt-ui-input {
    box-sizing: border-box;
    width: 100%;
    min-height: 40px;
    padding: 0 12px;
    border-radius: 11px;
    border: 1px solid var(--slt-ui-line);
    background: color-mix(in oklab, var(--slt-ui-field-deep) 80%, black);
    color: var(--slt-ui-ink);
    font: inherit;
    font-size: 14px;
    font-weight: 500;
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.slt-ui-input:focus { border-color: var(--slt-ui-accent); box-shadow: 0 0 0 3px var(--slt-ui-accent-soft); }
.slt-ui-input::placeholder { color: var(--slt-ui-ink-faint); }
body.slt-update-waiting #TranslateToggle { position: relative; }
body.slt-update-waiting #TranslateToggle::after {
    content: '';
    position: absolute;
    top: 3px;
    right: 3px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: oklch(0.8 0.15 ${BRAND_HUE});
    box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.55);
    pointer-events: none;
}
.slt-ui-ring { width: 18px; height: 18px; transform: rotate(-90deg); }
.slt-ui-ring circle { fill: none; stroke-width: 2.4; }
.slt-ui-ring .slt-ui-ring-track { stroke: var(--slt-ui-line); }
.slt-ui-ring .slt-ui-ring-fill { stroke: var(--slt-ui-accent); stroke-linecap: round; transition: stroke-dashoffset 0.9s linear; }
@media (prefers-reduced-motion: reduce) {
    .slt-ui-overlay, .slt-ui-panel, .slt-ui-stagger, .slt-ui-toast {
        transition-duration: 0.01ms !important;
        transition-delay: 0s !important;
        animation-duration: 0.01ms !important;
    }
    .slt-ui-dialog, .slt-ui-stagger { transform: none !important; filter: none !important; clip-path: none !important; }
}
`;
  function toneVars(tone = "accent") {
    return adaptToneVars(tone, baseToneVars(tone));
  }

  // src/utils/toast.ts
  var MAX_VISIBLE = 3;
  var INBOX_KEY = "notification-inbox";
  var INBOX_LIMIT = 40;
  var DEFAULT_DURATION = {
    info: 4200,
    success: 4200,
    warning: 8e3,
    error: 8e3,
    update: Infinity
  };
  var TONE = {
    info: "accent",
    success: "success",
    warning: "hotfix",
    error: "error",
    update: "accent"
  };
  var ICONS = {
    info: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 7.2v3.9M8 4.9v.1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    success: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.4l2.9 2.9 6.1-6.3" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    warning: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.2l6.3 11H1.7z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 6.5v3.2M8 11.6v.1" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    error: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    update: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 12.5V3.8M4.3 7.3L8 3.6l3.7 3.7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  var live = [];
  var queue = [];
  var hovering = false;
  var hoverBound = false;
  var inboxListeners = /* @__PURE__ */ new Set();
  var inboxActions = /* @__PURE__ */ new Map();
  function readInbox() {
    try {
      const raw = storage.get(INBOX_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((e) => e && typeof e.title === "string") : [];
    } catch {
      return [];
    }
  }
  function writeInbox(entries) {
    storage.set(INBOX_KEY, JSON.stringify(entries.slice(0, INBOX_LIMIT)));
    inboxListeners.forEach((fn) => {
      try {
        fn();
      } catch {
      }
    });
  }
  function getInbox() {
    return readInbox();
  }
  function unreadCount() {
    return readInbox().filter((e) => !e.read).length;
  }
  function markInboxRead() {
    const entries = readInbox();
    if (!entries.some((e) => !e.read))
      return;
    writeInbox(entries.map((e) => ({ ...e, read: true })));
  }
  function clearInbox() {
    writeInbox([]);
  }
  function removeInboxEntries(match) {
    const entries = readInbox();
    const next = entries.filter((e) => !match(e));
    if (next.length !== entries.length)
      writeInbox(next);
  }
  function onInboxChange(listener) {
    inboxListeners.add(listener);
    return () => inboxListeners.delete(listener);
  }
  function registerInboxAction(id, run) {
    inboxActions.set(id, run);
  }
  function runInboxAction(id) {
    const run = inboxActions.get(id);
    if (!run)
      return false;
    run();
    return true;
  }
  function record(options) {
    const kind = options.kind || "info";
    const wants = options.inbox ?? (kind === "warning" || kind === "error" || kind === "update");
    if (!wants)
      return;
    const entries = readInbox();
    const id = options.key || `${kind}:${options.title}`;
    const next = {
      id,
      kind,
      title: options.title,
      description: options.description,
      at: Date.now(),
      read: false,
      actionId: options.inboxAction?.id,
      actionLabel: options.inboxAction?.label
    };
    writeInbox([next, ...entries.filter((e) => e.id !== id)]);
  }
  function bindHover(region2) {
    if (hoverBound)
      return;
    hoverBound = true;
    region2.addEventListener("mouseenter", () => {
      hovering = true;
      live.forEach(pause);
    });
    region2.addEventListener("mouseleave", () => {
      hovering = false;
      live.forEach(resume);
    });
  }
  function pause(t) {
    if (t.timer === null)
      return;
    window.clearTimeout(t.timer);
    t.timer = null;
    t.remaining -= Date.now() - t.startedAt;
    t.barAnim?.pause();
  }
  function resume(t) {
    if (t.closed || !Number.isFinite(t.remaining) || t.timer !== null)
      return;
    t.startedAt = Date.now();
    t.timer = window.setTimeout(() => t.handle.close("timeout"), Math.max(400, t.remaining));
    t.barAnim?.play();
  }
  function startTimer(t, duration) {
    if (t.timer !== null)
      window.clearTimeout(t.timer);
    t.timer = null;
    t.barAnim?.cancel();
    t.barAnim = null;
    t.remaining = duration;
    const bar = t.bar.firstElementChild;
    if (!Number.isFinite(duration)) {
      t.bar.hidden = true;
      return;
    }
    t.bar.hidden = false;
    if (!prefersReducedMotion()) {
      t.barAnim = bar.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], { duration, easing: "linear", fill: "forwards" });
    }
    if (hovering) {
      t.barAnim?.pause();
      return;
    }
    t.startedAt = Date.now();
    t.timer = window.setTimeout(() => t.handle.close("timeout"), duration);
  }
  function fill(node, t) {
    const o = t.options;
    const kind = o.kind || "info";
    paintTone(node, o.tone || TONE[kind]);
    node.setAttribute("role", kind === "error" || kind === "warning" ? "alert" : "status");
    const icon = node.querySelector(".slt-ui-toast-icon");
    icon.innerHTML = ICONS[kind];
    const title = node.querySelector(".slt-ui-toast-title");
    title.textContent = o.title;
    if (t.count > 1)
      title.append(el("span", { class: "slt-ui-toast-count", text: `\xD7${t.count}` }));
    const desc = node.querySelector(".slt-ui-toast-desc");
    desc.textContent = o.description || "";
    desc.hidden = !o.description;
    const actions = node.querySelector(".slt-ui-toast-actions");
    actions.innerHTML = "";
    const all = [...o.actions || []];
    if (o.undo) {
      const undo = o.undo;
      all.unshift({ label: "Undo", primary: !(o.actions || []).some((a) => a.primary), onClick: () => undo() });
    }
    all.forEach((action) => {
      const btn = el("button", { class: `slt-ui-toast-btn${action.primary ? " slt-ui-toast-btn-primary" : ""}`, type: "button", text: action.label });
      btn.addEventListener("click", (event) => {
        action.onClick(event, t.handle);
        t.handle.close("action");
      });
      actions.append(btn);
    });
    actions.hidden = all.length === 0;
  }
  function mount(options) {
    const region2 = toastRegion();
    bindHover(region2);
    const node = el(
      "div",
      { class: "slt-ui-toast" },
      el("span", { class: "slt-ui-toast-icon" }),
      el(
        "div",
        { class: "slt-ui-toast-text" },
        el("div", { class: "slt-ui-toast-title" }),
        el("div", { class: "slt-ui-toast-desc" }),
        el("div", { class: "slt-ui-toast-actions" })
      ),
      el("button", { class: "slt-ui-toast-x", type: "button", "aria-label": "Dismiss", html: CLOSE_SVG })
    );
    const bar = el("div", { class: "slt-ui-toast-timer" }, el("i"));
    node.append(bar);
    const t = {
      handle: null,
      options,
      count: 1,
      timer: null,
      startedAt: Date.now(),
      remaining: 0,
      bar,
      barAnim: null,
      closed: false
    };
    t.handle = {
      el: node,
      rect: () => node.getBoundingClientRect(),
      update: (patch) => {
        t.options = { ...t.options, ...patch };
        fill(node, t);
        if (patch.duration !== void 0 || patch.kind) {
          startTimer(t, t.options.duration ?? DEFAULT_DURATION[t.options.kind || "info"]);
        }
      },
      close: (reason = "dismiss") => {
        if (t.closed)
          return;
        t.closed = true;
        if (t.timer !== null)
          window.clearTimeout(t.timer);
        t.barAnim?.cancel();
        const index = live.indexOf(t);
        if (index >= 0)
          live.splice(index, 1);
        if (reason === "dismiss") {
          try {
            t.options.onDismiss?.();
          } catch {
          }
        }
        const done = () => {
          node.remove();
          flushQueue();
        };
        if (prefersReducedMotion() || reason === "replace") {
          done();
          return;
        }
        const h = node.offsetHeight;
        const anim = node.animate([
          { opacity: 1, transform: "none", height: `${h}px`, marginBottom: "0px" },
          { opacity: 0, transform: "translateX(-14px)", height: `${h}px`, marginBottom: "0px", offset: 0.55 },
          { opacity: 0, transform: "translateX(-14px)", height: "0px", marginBottom: "-10px", paddingTop: "0px", paddingBottom: "0px" }
        ], { duration: 320, easing: "cubic-bezier(0.4, 0, 0.2, 1)", fill: "forwards" });
        let finished = false;
        const once = () => {
          if (finished)
            return;
          finished = true;
          done();
        };
        anim.onfinish = once;
        window.setTimeout(once, 480);
      }
    };
    node.querySelector(".slt-ui-toast-x")?.addEventListener("click", () => t.handle.close("dismiss"));
    fill(node, t);
    region2.append(node);
    live.push(t);
    startTimer(t, options.duration ?? DEFAULT_DURATION[options.kind || "info"]);
    if (!prefersReducedMotion()) {
      node.animate([
        { clipPath: "inset(0 100% 0 0 round 14px)", opacity: 0.4 },
        { clipPath: "inset(0 0 0 0 round 14px)", opacity: 1 }
      ], { duration: 420, easing: "cubic-bezier(0.2, 0.9, 0.1, 1)" });
    }
    return t.handle;
  }
  function flushQueue() {
    while (queue.length && live.length < MAX_VISIBLE) {
      const next = queue.shift();
      next.resolve(mount(next.options));
    }
  }
  function toast(options) {
    record(options);
    if (options.key) {
      const existing = live.find((t) => t.options.key === options.key && !t.closed);
      if (existing) {
        existing.count += options.undo ? 0 : 1;
        if (options.undo)
          existing.count = 1;
        existing.options = { ...existing.options, ...options };
        fill(existing.handle.el, existing);
        startTimer(existing, options.duration ?? DEFAULT_DURATION[options.kind || "info"]);
        if (!prefersReducedMotion()) {
          existing.handle.el.animate([{ transform: "translateX(4px)" }, { transform: "none" }], { duration: 200, easing: "ease-out" });
        }
        return existing.handle;
      }
    }
    if (live.length >= MAX_VISIBLE) {
      const evictable = live.find((t) => Number.isFinite(t.remaining) && !t.options.undo);
      if (evictable) {
        evictable.handle.close("replace");
      } else {
        let resolved = null;
        const proxy = {
          el: document.createElement("div"),
          rect: () => resolved ? resolved.rect() : new DOMRect(),
          update: (patch) => resolved?.update(patch),
          close: (reason) => {
            if (resolved)
              resolved.close(reason);
            else {
              const i = queue.findIndex((q) => q.options === options);
              if (i >= 0)
                queue.splice(i, 1);
            }
          }
        };
        queue.push({ options, resolve: (h) => {
          resolved = h;
        } });
        return proxy;
      }
    }
    return mount(options);
  }
  function dismissToast(key) {
    live.filter((t) => t.options.key === key).forEach((t) => t.handle.close("replace"));
    for (let i = queue.length - 1; i >= 0; i--) {
      if (queue[i].options.key === key)
        queue.splice(i, 1);
    }
  }

  // src/utils/updater.ts
  var METADATA_KEYS = [
    "_spicy_lyric_translater_metadata",
    "_spicy_lyric_translator_metadata"
  ];
  function getLoaderMetadata() {
    try {
      for (const key of METADATA_KEYS) {
        const metadata = window[key];
        if (metadata && metadata.LoadedVersion)
          return metadata;
      }
    } catch {
    }
    return null;
  }
  function clearLoaderMetadata() {
    try {
      for (const key of METADATA_KEYS) {
        if (window[key]) {
          window[key] = {};
        }
      }
    } catch {
    }
  }
  var LOADER_METADATA = getLoaderMetadata();
  var IS_LOADER_MODE = LOADER_METADATA?.IsLoader === true;
  var CURRENT_VERSION = LOADER_METADATA?.LoadedVersion || (true ? "2.2.2" : "0.0.0");
  var LOADED_HASH = typeof LOADER_METADATA?.ContentHash === "string" ? LOADER_METADATA.ContentHash : "";
  var GITHUB_REPO = "7xeh/SpicyLyricTranslator";
  var GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases`;
  var RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`;
  var UPDATE_API_URL = "https://7xeh.dev/apps/spicylyrictranslate/api/version.php";
  var MIN_CHECK_INTERVAL_MS = 15 * 60 * 1e3;
  var DEFAULT_CHECK_INTERVAL_MS = 30 * 60 * 1e3;
  var INITIAL_CHECK_DELAY_MS = 8e3;
  var MAX_BACKOFF_MS = 2 * 60 * 60 * 1e3;
  var REQUEST_TIMEOUT_MS = 6e3;
  var BUNDLE_TIMEOUT_MS = 15e3;
  var BUNDLE_HASH_INTERVAL_MS = 2 * 60 * 60 * 1e3;
  var SCHEDULE_JITTER_MS = 2 * 60 * 1e3;
  var SNOOZE_MS = 12 * 60 * 60 * 1e3;
  var PENDING_TTL_MS = 60 * 60 * 1e3;
  var APPLIED_MODAL_DELAY_MS = 2e3;
  var STORAGE_KEYS = {
    pending: "pending-update",
    snooze: "update-snooze",
    lastVersion: "last-known-version",
    lastHash: "last-known-hash",
    skip: "update-skip"
  };
  var LEGACY_STORAGE_KEYS = [
    "pending-update-version",
    "pending-update-timestamp",
    "pending-update-changelog",
    "hotfix-detected"
  ];
  var isInstalling = false;
  var inFlightCheck = null;
  var lastCheckTime = 0;
  var lastBundleHashTime = 0;
  var currentCheckIntervalMs = DEFAULT_CHECK_INTERVAL_MS;
  var currentBackoffMs = 0;
  var checkTimer = null;
  var schedulerStarted = false;
  function parseVersion(version) {
    if (typeof version !== "string")
      return null;
    const cleanVersion = version.trim().replace(/^v/i, "");
    const match = cleanVersion.match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!match)
      return null;
    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10),
      text: `${match[1]}.${match[2]}.${match[3]}`
    };
  }
  function compareVersions(v1, v2) {
    if (v1.major !== v2.major)
      return v1.major > v2.major ? 1 : -1;
    if (v1.minor !== v2.minor)
      return v1.minor > v2.minor ? 1 : -1;
    if (v1.patch !== v2.patch)
      return v1.patch > v2.patch ? 1 : -1;
    return 0;
  }
  function getCurrentVersion() {
    return parseVersion(CURRENT_VERSION) || { major: 0, minor: 0, patch: 0, text: CURRENT_VERSION };
  }
  function getContentHashShort(length = 8) {
    return LOADED_HASH ? LOADED_HASH.substring(0, length) : "";
  }
  function getBuildHash() {
    return !"96299bb9dcd6081555f722c40a120a654d2a6cb1a88c9b3a401b14f8b1712121".startsWith("SLT_BUILD_HASH_PLACEHOLDER") ? "96299bb9dcd6081555f722c40a120a654d2a6cb1a88c9b3a401b14f8b1712121" : "";
  }
  function getDisplayHash() {
    if (LOADED_HASH)
      return { hash: LOADED_HASH, source: "delivered" };
    const build = getBuildHash();
    if (build)
      return { hash: build, source: "build" };
    return { hash: "", source: "" };
  }
  async function fetchWithTimeout2(input, init = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      window.clearTimeout(timeoutId);
    }
  }
  function withCacheBust(url) {
    try {
      const parsed = new URL(url);
      parsed.searchParams.set("_", Date.now().toString());
      return parsed.href;
    } catch {
      return url;
    }
  }
  async function computeSHA256(text3) {
    try {
      const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text3));
      return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      return null;
    }
  }
  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }
  async function fetchSelfHostedRelease() {
    try {
      const response = await fetchWithTimeout2(`${UPDATE_API_URL}?action=version&_=${Date.now()}`);
      if (!response.ok)
        return null;
      const data = await response.json();
      const version = parseVersion(data?.version);
      if (!version)
        return null;
      const hash = data.hash || data.sha256 || data.checksum || null;
      return {
        version,
        hash: typeof hash === "string" && hash.length > 0 ? hash.toLowerCase() : null,
        downloadUrl: typeof data.download_url === "string" && data.download_url.length > 0 ? data.download_url : `${UPDATE_API_URL}?action=download&version=${encodeURIComponent(version.text)}`,
        releaseUrl: data.release_notes_url || RELEASES_URL,
        changelog: typeof data.changelog === "string" ? data.changelog : ""
      };
    } catch (e) {
      warn("Self-hosted update API unavailable:", e);
      return null;
    }
  }
  async function fetchGitHubRelease(path) {
    try {
      const response = await fetchWithTimeout2(`${GITHUB_API_URL}/${path}`, {
        headers: { "Accept": "application/vnd.github.v3+json" }
      });
      return response.ok ? await response.json() : null;
    } catch {
      return null;
    }
  }
  async function fetchGitHubLatestRelease() {
    const release = await fetchGitHubRelease("latest");
    const version = release ? parseVersion(release.tag_name) : null;
    if (!release || !version)
      return null;
    const jsAsset = Array.isArray(release.assets) ? release.assets.find((asset) => typeof asset?.name === "string" && asset.name.endsWith(".js")) : null;
    return {
      version,
      hash: null,
      downloadUrl: jsAsset?.browser_download_url || "",
      releaseUrl: release.html_url || RELEASES_URL,
      changelog: release.body || ""
    };
  }
  async function fetchRemoteRelease() {
    return await fetchSelfHostedRelease() || await fetchGitHubLatestRelease();
  }
  async function fetchChangelogForVersion(version, allowLatestFallback = true) {
    const tagged = await fetchGitHubRelease(`tags/v${encodeURIComponent(version)}`);
    if (tagged?.body)
      return tagged.body;
    if (!allowLatestFallback)
      return "";
    const latest = await fetchGitHubRelease("latest");
    return latest?.body || "";
  }
  async function detectHotfixHash(remote, trigger) {
    if (!IS_LOADER_MODE || !LOADED_HASH)
      return null;
    if (compareVersions(remote.version, getCurrentVersion()) !== 0)
      return null;
    if (remote.hash) {
      return remote.hash !== LOADED_HASH.toLowerCase() ? remote.hash : null;
    }
    if (!remote.downloadUrl)
      return null;
    const now = Date.now();
    if (trigger === "auto" && now - lastBundleHashTime < BUNDLE_HASH_INTERVAL_MS)
      return null;
    lastBundleHashTime = now;
    try {
      const response = await fetchWithTimeout2(withCacheBust(remote.downloadUrl), {}, BUNDLE_TIMEOUT_MS);
      if (!response.ok)
        return null;
      const hash = await computeSHA256(await response.text());
      return hash && hash !== LOADED_HASH.toLowerCase() ? hash : null;
    } catch (e) {
      debug("Bundle hash check failed:", e);
      return null;
    }
  }
  async function resolveUpdateStatus(trigger) {
    const current = getCurrentVersion();
    try {
      const remote = await fetchRemoteRelease();
      if (!remote) {
        return { status: "error", current, message: "Update server could not be reached" };
      }
      if (compareVersions(remote.version, current) > 0) {
        return { status: "update", current, remote, installable: IS_LOADER_MODE };
      }
      const hotfixHash = await detectHotfixHash(remote, trigger);
      if (hotfixHash) {
        return { status: "hotfix", current, remote, hash: hotfixHash };
      }
      return { status: "current", current, remote };
    } catch (e) {
      error("Update check failed:", e);
      return { status: "error", current, message: e instanceof Error ? e.message : "Unknown error" };
    }
  }
  function getPromptKey(result) {
    if (result.status === "update")
      return `update:${result.remote.version.text}`;
    if (result.status === "hotfix")
      return `hotfix:${result.remote.version.text}:${result.hash}`;
    return null;
  }
  function runCheck(trigger) {
    if (!inFlightCheck) {
      lastCheckTime = Date.now();
      inFlightCheck = resolveUpdateStatus(trigger).finally(() => {
        inFlightCheck = null;
      });
    }
    return inFlightCheck;
  }
  function isSnoozed(key) {
    if (storage.get(STORAGE_KEYS.skip) === key)
      return true;
    try {
      const raw = storage.get(STORAGE_KEYS.snooze);
      if (!raw)
        return false;
      const snooze2 = JSON.parse(raw);
      return snooze2?.key === key && typeof snooze2.until === "number" && snooze2.until > Date.now();
    } catch {
      return false;
    }
  }
  function snooze(key, ms = SNOOZE_MS) {
    storage.set(STORAGE_KEYS.snooze, JSON.stringify({ key, until: Date.now() + ms }));
  }
  function clearSnooze() {
    storage.remove(STORAGE_KEYS.snooze);
    storage.remove(STORAGE_KEYS.skip);
  }
  async function checkForUpdates(options = {}) {
    const trigger = typeof options === "boolean" ? options ? "manual" : "auto" : options.trigger ?? "manual";
    const result = await runCheck(trigger);
    if (result.status === "error") {
      increaseBackoff();
    } else {
      resetBackoff();
    }
    const key = getPromptKey(result);
    if (key && !isInstalling) {
      if (trigger === "manual") {
        clearSnooze();
        presentPrompt(result, "manual");
      } else if (!isSnoozed(key)) {
        presentPrompt(result, "auto");
      } else if (storage.get(STORAGE_KEYS.skip) !== key) {
        setWaiting(result);
      }
    } else if (!key) {
      setWaiting(null);
    }
    if (schedulerStarted && !isInstalling) {
      scheduleNextCheck();
    }
    return result;
  }
  async function getUpdateInfo() {
    const result = await runCheck("manual");
    if (result.status === "error")
      return null;
    return {
      hasUpdate: result.status === "update",
      hasHotfix: result.status === "hotfix",
      currentVersion: result.current.text,
      latestVersion: result.remote.version.text,
      releaseUrl: result.remote.releaseUrl
    };
  }
  async function runManualUpdateCheck(button) {
    if (button?.disabled)
      return null;
    const idleText = button?.dataset.sltIdleText || button?.textContent || "Check for updates";
    const setButton = (label, disabled) => {
      if (!button)
        return;
      button.dataset.sltIdleText = idleText;
      button.textContent = label;
      button.disabled = disabled;
    };
    const restoreLater = (label) => {
      setButton(label, true);
      window.setTimeout(() => setButton(idleText, false), 2500);
    };
    setButton("Checking\u2026", true);
    const result = await runCheck("manual");
    if (result.status === "update" || result.status === "hotfix") {
      setButton(idleText, false);
      clearSnooze();
      resetBackoff();
      presentPrompt(result, "manual");
      return result;
    }
    if (result.status === "current") {
      resetBackoff();
      restoreLater("Up to date");
      setWaiting(null);
      toast({
        kind: "success",
        key: "slt-update-check",
        title: "You're up to date",
        description: `v${result.current.text} is the latest Spicy Lyric Translator.`
      });
      return result;
    }
    increaseBackoff();
    restoreLater("Check failed");
    toast({
      kind: "error",
      key: "slt-update-check",
      title: "Couldn't check for updates",
      description: result.message,
      actions: [{ label: "Try again", onClick: () => {
        runManualUpdateCheck(button);
      } }]
    });
    return result;
  }
  function getScheduledDelay() {
    const jitter = Math.floor(Math.random() * SCHEDULE_JITTER_MS);
    return Math.max(MIN_CHECK_INTERVAL_MS, currentCheckIntervalMs) + jitter + currentBackoffMs;
  }
  function scheduleNextCheck(forceDelayMs) {
    if (checkTimer !== null) {
      window.clearTimeout(checkTimer);
    }
    const delay = typeof forceDelayMs === "number" ? Math.max(1e3, forceDelayMs) : getScheduledDelay();
    checkTimer = window.setTimeout(runScheduledCheck, delay);
  }
  function runScheduledCheck() {
    checkTimer = null;
    if (isInstalling)
      return;
    if (document.hidden) {
      scheduleNextCheck();
      return;
    }
    if (navigator.onLine === false) {
      increaseBackoff();
      scheduleNextCheck();
      return;
    }
    checkForUpdates({ trigger: "auto" }).catch(() => scheduleNextCheck());
  }
  function increaseBackoff() {
    currentBackoffMs = currentBackoffMs === 0 ? 5 * 60 * 1e3 : Math.min(MAX_BACKOFF_MS, currentBackoffMs * 2);
  }
  function resetBackoff() {
    currentBackoffMs = 0;
  }
  function startUpdateChecker(intervalMs = DEFAULT_CHECK_INTERVAL_MS) {
    currentCheckIntervalMs = Math.max(MIN_CHECK_INTERVAL_MS, intervalMs);
    if (schedulerStarted)
      return;
    schedulerStarted = true;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden || isInstalling || inFlightCheck)
        return;
      if (Date.now() - lastCheckTime >= MIN_CHECK_INTERVAL_MS) {
        scheduleNextCheck(3e3);
      }
    });
    window.addEventListener("online", () => {
      if (isInstalling || inFlightCheck)
        return;
      resetBackoff();
      if (Date.now() - lastCheckTime >= MIN_CHECK_INTERVAL_MS) {
        scheduleNextCheck(3e3);
      }
    });
    scheduleNextCheck(INITIAL_CHECK_DELAY_MS);
  }
  function readPending() {
    try {
      const raw = storage.get(STORAGE_KEYS.pending);
      if (!raw)
        return null;
      const pending = JSON.parse(raw);
      if (!pending || pending.kind !== "update" && pending.kind !== "hotfix" || typeof pending.version !== "string") {
        return null;
      }
      return pending;
    } catch {
      return null;
    }
  }
  function playbackInfo() {
    try {
      const player = Spicetify.Player;
      const item = player?.data?.item;
      if (!item?.uri)
        return null;
      const duration = Number(player.getDuration?.() ?? item.duration?.milliseconds ?? player.data?.duration ?? 0) || 0;
      return {
        uri: item.uri,
        name: item.name || "this song",
        duration,
        progress: Number(player.getProgress?.() ?? 0) || 0,
        playing: !!player.isPlaying?.()
      };
    } catch {
      return null;
    }
  }
  function canWaitForSong() {
    const info = playbackInfo();
    return !!info && info.playing && info.duration > 0 && info.duration - info.progress > 8e3;
  }
  function formatClock(ms) {
    const total = Math.max(0, Math.round(ms / 1e3));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }
  var songWaiter = null;
  var waitToast = null;
  function waitForSongEnd(onEnd, onTick) {
    const startUri = playbackInfo()?.uri;
    let done = false;
    const onSong = () => finish();
    const interval = window.setInterval(() => {
      const info = playbackInfo();
      if (!info)
        return;
      if (startUri && info.uri !== startUri) {
        finish();
        return;
      }
      onTick(info);
    }, 1e3);
    const cleanup = () => {
      window.clearInterval(interval);
      try {
        Spicetify.Player.removeEventListener("songchange", onSong);
      } catch {
      }
    };
    const finish = () => {
      if (done)
        return;
      done = true;
      cleanup();
      onEnd();
    };
    try {
      Spicetify.Player.addEventListener("songchange", onSong);
    } catch {
    }
    const first = playbackInfo();
    if (first)
      onTick(first);
    return () => {
      if (done)
        return;
      done = true;
      cleanup();
    };
  }
  function cancelSongWait() {
    songWaiter?.();
    songWaiter = null;
    waitToast = null;
    dismissToast("slt-update-wait");
  }
  var waitingResult = null;
  function setWaiting(result) {
    waitingResult = result && (result.status === "update" || result.status === "hotfix") ? result : null;
    try {
      document.body.classList.toggle("slt-update-waiting", !!waitingResult);
    } catch {
    }
    if (!waitingResult)
      removeInboxEntries((e) => e.id === "slt-update");
  }
  function hasWaitingUpdate() {
    return waitingResult ? { kind: waitingResult.status, version: waitingResult.remote.version.text } : null;
  }
  function openWaitingUpdate(origin) {
    if (waitingResult) {
      openUpdateCard(waitingResult, origin);
      return;
    }
    checkForUpdates({ trigger: "manual" }).catch(() => {
    });
  }
  registerInboxAction("open-update", () => openWaitingUpdate());
  async function installUpdate(result, ui, options = {}) {
    if (isInstalling)
      return;
    isInstalling = true;
    cancelSongWait();
    if (checkTimer !== null) {
      window.clearTimeout(checkTimer);
      checkTimer = null;
    }
    const step = async (percent, label, delayMs) => {
      ui.progress(percent, label);
      await wait(delayMs);
    };
    try {
      await step(18, "Getting things ready\u2026", 220);
      let changelog = result.remote.changelog;
      if (!changelog) {
        changelog = await fetchChangelogForVersion(result.remote.version.text);
      }
      const pending = {
        kind: result.status,
        version: result.remote.version.text,
        fromVersion: result.current.text,
        fromHash: LOADED_HASH,
        changelog,
        createdAt: Date.now(),
        resume: !!options.resume
      };
      if (!storage.set(STORAGE_KEYS.pending, JSON.stringify(pending))) {
        throw new Error("Could not save update state");
      }
      clearSnooze();
      removeInboxEntries((e) => e.id === "slt-update");
      await step(70, result.status === "hotfix" ? "Patch ready" : `v${pending.version} ready`, 280);
      await step(100, "Reloading Spotify\u2026", 320);
      clearLoaderMetadata();
      window.location.reload();
    } catch (e) {
      error("Update install failed:", e);
      storage.remove(STORAGE_KEYS.pending);
      isInstalling = false;
      ui.fail("The update couldn't be installed. Restart Spotify to try again.");
      if (schedulerStarted)
        scheduleNextCheck();
    }
  }
  function backgroundUi() {
    return {
      progress: () => {
      },
      fail: (message) => {
        toast({ kind: "error", title: "Update didn't install", description: message });
      }
    };
  }
  function versionLabels(result) {
    if (result.status === "hotfix") {
      return {
        from: `v${result.current.text} \xB7 ${getContentHashShort() || "current"}`,
        to: `v${result.remote.version.text} \xB7 ${result.hash.substring(0, 8)}`
      };
    }
    return { from: `v${result.current.text}`, to: `v${result.remote.version.text}` };
  }
  function versionRow(from, to) {
    return el(
      "div",
      { class: "slt-upd-versions" },
      el("span", { class: "slt-upd-chip", text: from }),
      el("span", { class: "slt-upd-flow", "aria-hidden": "true" }),
      el("span", { class: "slt-upd-chip slt-upd-chip-to", text: to })
    );
  }
  function notesBlock(changelogHtml, expanded) {
    const content = el("div", { class: "slt-upd-notes-content", html: changelogHtml });
    const node = el("div", { class: "slt-upd-notes" }, el("div", { class: "slt-upd-notes-title", text: "Changelog" }), content);
    node.hidden = !expanded;
    const action = {
      id: "notes",
      label: expanded ? "Hide changelog" : "Show changelog",
      kind: "quiet",
      keepOpen: true,
      onClick: (handle) => {
        const open = node.hidden;
        node.hidden = !open;
        const label = handle.footer.querySelector('[data-action="notes"] .slt-ui-btn-label');
        if (label)
          label.textContent = open ? "Hide changelog" : "Show changelog";
        handle.footer.querySelector('[data-action="notes"]')?.setAttribute("aria-expanded", String(open));
        if (open) {
          node.scrollTop = 0;
          if (!prefersReducedMotion()) {
            node.animate([{ opacity: 0, transform: "translateY(-4px)" }, { opacity: 1, transform: "none" }], { duration: 240, easing: "ease-out" });
          }
        }
      }
    };
    return { node, content, action };
  }
  function progressRing() {
    const node = el("span", { class: "slt-upd-ring-wrap" });
    node.innerHTML = '<svg class="slt-ui-ring" viewBox="0 0 20 20" aria-hidden="true"><circle class="slt-ui-ring-track" cx="10" cy="10" r="7.5"/><circle class="slt-ui-ring-fill" cx="10" cy="10" r="7.5" stroke-dasharray="47.12" stroke-dashoffset="47.12"/></svg>';
    const fill2 = node.querySelector(".slt-ui-ring-fill");
    return {
      node,
      set: (fraction) => fill2.setAttribute("stroke-dashoffset", String(47.12 * (1 - Math.min(1, Math.max(0, fraction)))))
    };
  }
  function presentPrompt(result, trigger) {
    if (result.status !== "update" && result.status !== "hotfix")
      return;
    setWaiting(result);
    const key = getPromptKey(result);
    if (activeCardKey === key && activeDock())
      return;
    if (trigger === "manual") {
      dismissToast("slt-update");
      openUpdateCard(result);
      return;
    }
    const isHotfix = result.status === "hotfix";
    let opened = false;
    toast({
      kind: "update",
      tone: isHotfix ? "hotfix" : "accent",
      key: "slt-update",
      title: isHotfix ? `A patch for v${result.current.text} is ready` : `Spicy Lyric Translator v${result.remote.version.text} is out`,
      description: isHotfix ? "Same version, a few fixes. It takes one quick reload." : `You're on v${result.current.text}.`,
      duration: Infinity,
      inboxAction: { id: "open-update", label: "Open" },
      actions: [{
        label: "Details",
        primary: true,
        onClick: (_event, handle) => {
          opened = true;
          const rect = handle.rect();
          handle.close("replace");
          openUpdateCard(result, rect);
        }
      }],
      onDismiss: () => {
        if (!opened)
          snooze(key);
      }
    });
  }
  var activeCardKey = null;
  function openUpdateCard(result, origin) {
    ensureUpdaterStyles();
    dismissToast("slt-update");
    const key = getPromptKey(result);
    const isHotfix = result.status === "hotfix";
    const installable = isHotfix || result.installable;
    const labels = versionLabels(result);
    const lead = text(installable ? "Installing reloads Spotify. Pick a moment that won\u2019t cut off your music." : "This copy was installed by hand, so grab the new build from the release page.");
    const status = el("div", { class: "slt-upd-status", hidden: true });
    const progress = el(
      "div",
      { class: "slt-upd-progress", hidden: true },
      el("div", { class: "slt-upd-progress-bar" }, el("div", { class: "slt-upd-progress-fill" })),
      el("div", { class: "slt-upd-progress-text", text: "Starting\u2026" })
    );
    const notes = notesBlock(result.remote.changelog ? formatReleaseNotes(result.remote.changelog) : '<span class="slt-upd-muted">Loading changelog\u2026</span>', false);
    if (!result.remote.changelog) {
      fetchChangelogForVersion(result.remote.version.text).then((changelog) => {
        result.remote.changelog = changelog;
        notes.content.innerHTML = formatReleaseNotes(changelog);
      }).catch(() => {
      });
    }
    const laterMenu = {
      id: "later",
      label: "Not now",
      kind: "quiet",
      menu: [
        { label: "Remind me in 4 hours", onClick: () => {
          snooze(key, 4 * 60 * 60 * 1e3);
          card.close();
        } },
        { label: "Remind me tomorrow", onClick: () => {
          snooze(key, 24 * 60 * 60 * 1e3);
          card.close();
        } },
        {
          label: isHotfix ? "Skip this patch" : "Skip this version",
          hint: "No reminders until the next release",
          onClick: () => {
            storage.set(STORAGE_KEYS.skip, key);
            setWaiting(null);
            card.close();
          }
        }
      ]
    };
    const ui = {
      progress: (percent, label) => {
        status.hidden = true;
        lead.hidden = true;
        progress.hidden = false;
        progress.querySelector(".slt-upd-progress-fill").style.width = `${percent}%`;
        progress.querySelector(".slt-upd-progress-text").textContent = label;
        card.setBusy(true);
      },
      fail: (message) => {
        card.setBusy(false);
        progress.hidden = true;
        status.hidden = false;
        status.className = "slt-upd-status slt-upd-status-error";
        status.textContent = message;
        card.setTone("error");
        card.setActions([
          { label: "Close", kind: "quiet" },
          { label: "Reload now", kind: "primary", keepOpen: true, onClick: () => window.location.reload() }
        ]);
      }
    };
    let waitLabel = "After this song";
    const installNow = (resume2 = false) => {
      card.setActions([]);
      installUpdate(result, ui, { resume: resume2 });
    };
    const startSongWait = () => {
      const ring = progressRing();
      const line = el("div", { class: "slt-upd-status-text" });
      const sub = el("div", { class: "slt-upd-status-sub" });
      status.className = "slt-upd-status";
      status.replaceChildren(ring.node, el("div", { class: "slt-upd-status-copy" }, line, sub));
      status.hidden = false;
      lead.hidden = true;
      cancelSongWait();
      songWaiter = waitForSongEnd(() => {
        songWaiter = null;
        waitToast = null;
        dismissToast("slt-update-wait");
        try {
          Spicetify.Player.pause?.();
        } catch {
        }
        if (!card.closed) {
          installNow(true);
          return;
        }
        installUpdate(result, backgroundUi(), { resume: true });
      }, (info) => {
        const left = Math.max(0, info.duration - info.progress);
        waitLabel = `After \u201C${info.name}\u201D \xB7 ${formatClock(left)} left`;
        line.textContent = `Updating when \u201C${info.name}\u201D ends`;
        sub.textContent = info.playing ? `${formatClock(left)} left` : `Paused \xB7 ${formatClock(left)} left`;
        ring.set(info.duration ? info.progress / info.duration : 0);
        waitToast?.update({ description: waitLabel });
      });
      card.setActions([
        { label: "Cancel", kind: "quiet", keepOpen: true, onClick: () => {
          cancelSongWait();
          card.close();
          openUpdateCard(result);
        } },
        { label: "Reload now", kind: "ghost", keepOpen: true, onClick: () => installNow(false) }
      ]);
      card.root.dataset.waiting = "true";
    };
    const baseActions = () => {
      if (!installable) {
        return [
          notes.action,
          laterMenu,
          { label: "Open release page", kind: "primary", href: result.remote.releaseUrl, onClick: () => {
            snooze(key);
          } }
        ];
      }
      if (canWaitForSong()) {
        return [
          notes.action,
          laterMenu,
          { label: "Reload now", kind: "ghost", keepOpen: true, onClick: () => installNow(false) },
          { label: "Update after this song", kind: "primary", keepOpen: true, onClick: startSongWait }
        ];
      }
      return [
        notes.action,
        laterMenu,
        { label: isHotfix ? "Apply and reload" : "Update and reload", kind: "primary", keepOpen: true, onClick: () => installNow(false) }
      ];
    };
    const card = openDock({
      tone: isHotfix ? "hotfix" : "accent",
      eyebrow: isHotfix ? "Spicy Lyric Translator \xB7 Patch" : "Spicy Lyric Translator \xB7 Update",
      title: isHotfix ? `A patch for v${result.current.text}` : `v${result.remote.version.text} is ready`,
      body: [versionRow(labels.from, labels.to), lead, status, progress, notes.node],
      actions: baseActions(),
      origin,
      onDismiss: () => {
        if (songWaiter) {
          waitToast = toast({
            kind: "update",
            tone: isHotfix ? "hotfix" : "accent",
            key: "slt-update-wait",
            title: "Update queued",
            description: waitLabel,
            duration: Infinity,
            inbox: false,
            actions: [
              { label: "Reload now", primary: true, onClick: () => installUpdate(result, backgroundUi(), { resume: false }) },
              { label: "Cancel", onClick: () => cancelSongWait() }
            ],
            onDismiss: () => cancelSongWait()
          });
          return;
        }
        snooze(key);
      },
      onClose: () => {
        if (activeCardKey === key)
          activeCardKey = null;
      }
    });
    activeCardKey = key;
  }
  function resumeAfterReload() {
    return new Promise((resolve) => {
      const started = Date.now();
      const attempt = () => {
        try {
          const player = Spicetify?.Player;
          if (player?.data?.item) {
            if (!player.isPlaying?.())
              player.play?.();
            resolve(true);
            return;
          }
        } catch {
        }
        if (Date.now() - started > 12e3) {
          resolve(false);
          return;
        }
        window.setTimeout(attempt, 400);
      };
      attempt();
    });
  }
  async function showPostUpdateChangelog() {
    const pending = readPending();
    const lastKnownVersion = storage.get(STORAGE_KEYS.lastVersion);
    const lastKnownHash = storage.get(STORAGE_KEYS.lastHash);
    const legacyHotfix = storage.get("hotfix-detected") === "true";
    storage.remove(STORAGE_KEYS.pending);
    for (const key of LEGACY_STORAGE_KEYS)
      storage.remove(key);
    storage.set(STORAGE_KEYS.lastVersion, CURRENT_VERSION);
    if (LOADED_HASH)
      storage.set(STORAGE_KEYS.lastHash, LOADED_HASH);
    const current = getCurrentVersion();
    let applied = null;
    if (pending && Date.now() - pending.createdAt < PENDING_TTL_MS) {
      const target = parseVersion(pending.version);
      const versionDelta = target ? compareVersions(current, target) : -1;
      const reached = pending.kind === "hotfix" ? versionDelta > 0 || versionDelta === 0 && !!LOADED_HASH && LOADED_HASH !== pending.fromHash : versionDelta >= 0;
      if (!reached) {
        await wait(APPLIED_MODAL_DELAY_MS);
        toast({
          kind: "warning",
          title: "The update is downloaded, not applied yet",
          description: "Restart Spotify to finish updating.",
          actions: [{ label: "Reload", primary: true, onClick: () => window.location.reload() }]
        });
        return;
      }
      applied = {
        kind: versionDelta > 0 ? "update" : pending.kind,
        version: CURRENT_VERSION,
        from: pending.fromVersion,
        changelog: versionDelta > 0 ? "" : pending.changelog,
        exactChangelogOnly: false,
        resume: !!pending.resume
      };
    } else if (lastKnownVersion) {
      const last = parseVersion(lastKnownVersion);
      if (last && compareVersions(current, last) > 0) {
        applied = { kind: "update", version: CURRENT_VERSION, from: last.text, changelog: "", exactChangelogOnly: !IS_LOADER_MODE, resume: false };
      } else if (IS_LOADER_MODE && lastKnownVersion === CURRENT_VERSION && LOADED_HASH && (lastKnownHash && lastKnownHash !== LOADED_HASH || legacyHotfix)) {
        applied = { kind: "hotfix", version: CURRENT_VERSION, from: CURRENT_VERSION, changelog: "", exactChangelogOnly: false, resume: false };
      }
    }
    if (!applied)
      return;
    const resumed = applied.resume ? resumeAfterReload() : Promise.resolve(false);
    let changelog = applied.changelog;
    if (!changelog) {
      changelog = await fetchChangelogForVersion(applied.version, !applied.exactChangelogOnly);
      if (!changelog && applied.exactChangelogOnly)
        return;
    }
    await wait(APPLIED_MODAL_DELAY_MS);
    const didResume = await resumed;
    if (applied.kind === "hotfix") {
      const hash = getContentHashShort();
      const version = applied.version;
      toast({
        kind: "success",
        title: `Patched v${version}`,
        description: `${hash ? `Build ${hash}. ` : ""}${didResume ? "Your music picked up where it left off." : "Everything is up to date."}`,
        duration: 9e3,
        inbox: true,
        actions: [{ label: "What changed", onClick: () => openWhatsNew({ mode: "applied", version, changelog, kind: "hotfix", expanded: true }) }]
      });
      return;
    }
    openWhatsNew({ mode: "applied", version: applied.version, from: applied.from, changelog, kind: "update", resumed: didResume });
  }
  async function showCurrentChangelog(options = {}) {
    const changelog = await fetchChangelogForVersion(CURRENT_VERSION);
    openWhatsNew({ mode: "current", version: CURRENT_VERSION, changelog, kind: "update", expanded: options.expanded });
  }
  var settingLinker = null;
  function registerSettingLinker(linker) {
    settingLinker = linker;
  }
  function extractHighlights(body) {
    const out = [];
    for (const raw of (body || "").split("\n")) {
      const m = raw.replace(/\r$/, "").match(/^[-*+]\s+(.*\S)/);
      if (!m)
        continue;
      let line = m[1];
      let setting = null;
      const tag = line.match(/\[setting:([A-Za-z0-9_]+)\]/);
      if (tag) {
        line = line.replace(tag[0], "").trim();
        const found = settingLinker?.byId(tag[1]);
        setting = found || null;
      }
      if (!setting)
        setting = settingLinker?.match(line.replace(/[*_`~]/g, "")) || null;
      if (!line)
        continue;
      out.push({ html: processInlineMarkdown(escapeHtml(line)), setting });
      if (out.length >= 3)
        break;
    }
    return out;
  }
  function openWhatsNew(options) {
    ensureUpdaterStyles();
    const hashShort = getDisplayHash().hash.substring(0, 8);
    const highlights = extractHighlights(options.changelog);
    const notes = notesBlock(formatReleaseNotes(options.changelog), !!options.expanded);
    const meta = el(
      "div",
      { class: "slt-upd-meta" },
      el("span", { class: "slt-upd-chip slt-upd-chip-to", text: `v${options.version}` }),
      hashShort ? el("span", { class: "slt-upd-chip", text: hashShort, title: getDisplayHash().hash }) : null
    );
    const intro = options.mode === "applied" ? text(`${options.from && options.from !== options.version ? `Updated from v${options.from}. ` : ""}${options.resumed ? "Your music picked up where it left off." : "Here are the highlights."}`) : text("The highlights from the version you\u2019re running.");
    const body = [meta, intro];
    let dialog = null;
    if (highlights.length) {
      const list = el("ol", { class: "slt-upd-hl-list" });
      highlights.forEach((h, i) => {
        const item = el(
          "li",
          { class: "slt-upd-hl" },
          el("span", { class: "slt-upd-hl-dot", text: String(i + 1), "aria-hidden": "true" }),
          el("div", { class: "slt-upd-hl-text", html: h.html })
        );
        if (h.setting && settingLinker) {
          const setting = h.setting;
          const btn = el("button", { class: "slt-upd-hl-try", type: "button", text: "Try it", title: `Open \u201C${setting.label}\u201D in settings` });
          btn.addEventListener("click", () => {
            dialog?.close();
            settingLinker?.reveal(setting.id);
          });
          item.append(btn);
        }
        list.append(item);
      });
      body.push(list);
    }
    body.push(notes.node);
    dialog = openDialog({
      eyebrow: options.mode === "applied" ? "Spicy Lyric Translator \xB7 Updated" : "Spicy Lyric Translator",
      title: options.mode === "applied" ? options.kind === "hotfix" ? `Patched v${options.version}` : `You\u2019re on v${options.version}` : `What\u2019s new in v${options.version}`,
      tone: options.kind === "hotfix" ? "hotfix" : "accent",
      size: "md",
      body,
      actions: [
        notes.action,
        { label: "Release page", kind: "quiet", href: `${RELEASES_URL}/tag/v${encodeURIComponent(options.version)}`, keepOpen: true },
        { label: "Done", kind: "primary" }
      ]
    });
  }
  function ensureUpdaterStyles() {
    if (document.getElementById("slt-upd-styles"))
      return;
    const style = document.createElement("style");
    style.id = "slt-upd-styles";
    style.textContent = UPDATER_STYLES;
    document.head.appendChild(style);
  }
  var UPDATER_STYLES = `
.slt-upd-versions, .slt-upd-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}
.slt-upd-chip {
    display: inline-flex;
    align-items: center;
    padding: 5px 10px;
    border-radius: 9px;
    border: 1px solid var(--slt-ui-line);
    background: color-mix(in oklab, var(--slt-ui-ink) 5%, transparent);
    font-family: 'JetBrains Mono', ui-monospace, Consolas, monospace;
    font-size: 12px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--slt-ui-ink-muted);
    white-space: nowrap;
}
.slt-upd-chip-to {
    color: var(--slt-ui-ink);
}
.slt-upd-flow {
    position: relative;
    flex: 1 1 24px;
    min-width: 24px;
    max-width: 80px;
    height: 2px;
    border-radius: 2px;
    background: var(--slt-ui-line);
    overflow: hidden;
}
.slt-upd-flow::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, var(--slt-ui-accent), transparent);
    transform: translateX(-100%);
    animation: slt-upd-flow 1.9s ease-in-out infinite;
}
@keyframes slt-upd-flow { to { transform: translateX(100%); } }
.slt-upd-status {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 12px;
    background: color-mix(in oklab, var(--slt-ui-ink) 5%, transparent);
    border: 1px solid var(--slt-ui-line);
}
.slt-upd-status[hidden], .slt-upd-progress[hidden], .slt-upd-notes[hidden], .slt-ui-text[hidden] { display: none; }
.slt-upd-status-error {
    display: block;
    font-size: 13px;
    color: var(--slt-ui-ink);
    border-color: var(--slt-ui-accent-line);
    background: var(--slt-ui-accent-soft);
}
.slt-upd-status-copy { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.slt-upd-status-text { font-weight: 650; font-size: 13.5px; overflow-wrap: anywhere; }
.slt-upd-status-sub { font-size: 12px; color: var(--slt-ui-ink-faint); font-variant-numeric: tabular-nums; }
.slt-upd-ring-wrap { display: inline-flex; flex: 0 0 auto; }
.slt-upd-ring-wrap .slt-ui-ring { width: 22px; height: 22px; }
.slt-upd-progress { display: flex; flex-direction: column; gap: 8px; }
.slt-upd-progress-bar {
    height: 6px;
    border-radius: 6px;
    background: var(--slt-ui-line);
    overflow: hidden;
}
.slt-upd-progress-fill {
    width: 0;
    height: 100%;
    border-radius: 6px;
    background: var(--slt-ui-accent);
    transition: width 0.45s var(--slt-ui-ease);
}
.slt-upd-progress-text { font-size: 12.5px; color: var(--slt-ui-ink-muted); }
.slt-upd-notes {
    max-height: 260px;
    overflow-y: auto;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid var(--slt-ui-line);
    background: color-mix(in oklab, var(--slt-ui-field-deep) 70%, transparent);
    font-size: 13px;
    line-height: 1.55;
    color: var(--slt-ui-ink-muted);
}
.slt-upd-notes { scrollbar-width: thin; scrollbar-color: var(--slt-ui-line) transparent; }
.slt-upd-notes::-webkit-scrollbar { width: 5px; }
.slt-upd-notes::-webkit-scrollbar-button { display: none; }
.slt-upd-notes::-webkit-scrollbar-thumb { background: var(--slt-ui-line); border-radius: 5px; }
.slt-upd-notes-title {
    margin-bottom: 6px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--slt-ui-ink-faint);
}
.slt-upd-notes-content strong { color: var(--slt-ui-ink); }
.slt-upd-notes-content del { opacity: 0.5; }
.slt-upd-muted { color: var(--slt-ui-ink-faint); }
.slt-upd-hl-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
}
.slt-upd-hl {
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr) auto;
    align-items: baseline;
    gap: 10px;
    padding: 10px 0;
}
.slt-upd-hl + .slt-upd-hl { border-top: 1px solid var(--slt-ui-line); }
.slt-upd-hl-dot {
    color: var(--slt-ui-ink-faint);
    font-size: 12.5px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
}
.slt-upd-hl-text { font-size: 13.5px; line-height: 1.45; color: var(--slt-ui-ink); overflow-wrap: anywhere; }
.slt-upd-hl-text a { color: var(--slt-ui-ink); }
.slt-upd-hl-try {
    appearance: none;
    align-self: center;
    border: 1px solid var(--slt-ui-line);
    border-radius: 9px;
    padding: 5px 10px;
    background: transparent;
    color: var(--slt-ui-ink);
    font: inherit;
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
    cursor: pointer;
    transition: background-color 0.15s ease;
}
.slt-upd-hl-try:hover { background: var(--slt-ui-line); }
.slt-upd-hl-try:focus-visible { outline: 2px solid var(--slt-ui-accent); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
    .slt-upd-flow::after { animation: none; }
}
`;
  function escapeHtml(text3) {
    return String(text3).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function processInlineMarkdown(text3) {
    const sanitizeUrl = (url) => {
      const trimmed = url.trim();
      return /^https?:\/\//i.test(trimmed) ? trimmed : "";
    };
    return text3.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
      const safe = sanitizeUrl(url);
      return safe ? `<img src="${safe}" alt="${alt}" style="max-width: 100%; border-radius: 4px; margin: 4px 0;">` : alt;
    }).replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
      const safe = sanitizeUrl(url);
      return safe ? `<a href="${safe}" style="color: var(--slt-ui-accent); text-decoration: none;" target="_blank" rel="noopener noreferrer">${label}</a>` : label;
    }).replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/(?<![*\w])\*([^*]+?)\*(?![*\w])/g, "<em>$1</em>").replace(/~~(.*?)~~/g, "<del>$1</del>").replace(/`([^`]+)`/g, '<code style="background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 3px; font-size: 12px; color: var(--slt-ui-accent);">$1</code>');
  }
  function formatReleaseNotes(body) {
    if (!body || body.trim() === "") {
      return '<span class="slt-upd-muted">No changelog available for this release.</span>';
    }
    const lines = body.split("\n");
    const output = [];
    let inCodeBlock = false;
    let codeContent = [];
    let inUl = false;
    let inOl = false;
    const closeLists = () => {
      if (inUl) {
        output.push("</ul>");
        inUl = false;
      }
      if (inOl) {
        output.push("</ol>");
        inOl = false;
      }
    };
    for (const rawLine of lines) {
      const line = rawLine.replace(/\r$/, "");
      if (line.trim().startsWith("```")) {
        if (inCodeBlock) {
          output.push(`<pre style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 6px; overflow-x: auto; font-family: 'Fira Code','Consolas',monospace; font-size: 12px; color: var(--slt-ui-ink-muted); margin: 8px 0; white-space: pre-wrap; word-break: break-word;"><code>${codeContent.join("\n")}</code></pre>`);
          codeContent = [];
          inCodeBlock = false;
        } else {
          closeLists();
          inCodeBlock = true;
        }
        continue;
      }
      if (inCodeBlock) {
        codeContent.push(escapeHtml(line));
        continue;
      }
      if (line.trim() === "") {
        closeLists();
        output.push('<div style="height: 8px;"></div>');
        continue;
      }
      const h3 = line.match(/^###\s+(.*)/);
      if (h3) {
        closeLists();
        output.push(`<div style="font-weight: 600; margin-top: 12px; margin-bottom: 6px; color: var(--slt-ui-ink);">${processInlineMarkdown(h3[1])}</div>`);
        continue;
      }
      const h2 = line.match(/^##\s+(.*)/);
      if (h2) {
        closeLists();
        output.push(`<div style="font-weight: 600; font-size: 14px; margin-top: 14px; margin-bottom: 8px; color: var(--slt-ui-ink);">${processInlineMarkdown(h2[1])}</div>`);
        continue;
      }
      const h1 = line.match(/^#\s+(.*)/);
      if (h1) {
        closeLists();
        output.push(`<div style="font-weight: 700; font-size: 15px; margin-top: 16px; margin-bottom: 10px; color: var(--slt-ui-ink);">${processInlineMarkdown(h1[1])}</div>`);
        continue;
      }
      if (line.match(/^(---+|===+|\*\*\*+)\s*$/)) {
        closeLists();
        output.push('<hr style="border: none; border-top: 1px solid var(--slt-ui-line); margin: 12px 0;">');
        continue;
      }
      const bq = line.match(/^>\s?(.*)/);
      if (bq) {
        closeLists();
        output.push(`<div style="border-left: 3px solid var(--slt-ui-accent); padding-left: 12px; margin: 6px 0; color: var(--slt-ui-ink-muted); font-style: italic;">${processInlineMarkdown(bq[1])}</div>`);
        continue;
      }
      const ul = line.match(/^([ \t]*)[-*+]\s+(.*)/);
      if (ul) {
        if (inOl) {
          output.push("</ol>");
          inOl = false;
        }
        if (!inUl) {
          output.push('<ul style="margin: 4px 0; padding-left: 0; list-style: none;">');
          inUl = true;
        }
        const depth = Math.min(Math.floor(ul[1].replace(/\t/g, "  ").length / 2), 5);
        const markers = ["\u2022", "\u25E6", "\u25AA", "\u2023", "\xB7", "\u2022"];
        output.push(`<li style="display: flex; gap: 8px; margin: 3px 0; margin-left: ${depth * 18}px;"><span style="color: var(--slt-ui-accent); flex-shrink: 0;">${markers[depth] || "\u2022"}</span><span>${processInlineMarkdown(ul[2])}</span></li>`);
        continue;
      }
      const ol = line.match(/^([ \t]*)(\d+)[.)]\s+(.*)/);
      if (ol) {
        if (inUl) {
          output.push("</ul>");
          inUl = false;
        }
        if (!inOl) {
          output.push('<ol style="margin: 4px 0; padding-left: 0; list-style: none;">');
          inOl = true;
        }
        const depth = Math.min(Math.floor(ol[1].replace(/\t/g, "  ").length / 2), 5);
        output.push(`<li style="display: flex; gap: 8px; margin: 3px 0; margin-left: ${depth * 18}px;"><span style="color: var(--slt-ui-accent); flex-shrink: 0; min-width: 16px; font-weight: 600;">${ol[2]}.</span><span>${processInlineMarkdown(ol[3])}</span></li>`);
        continue;
      }
      closeLists();
      output.push(`<p style="margin: 4px 0; color: var(--slt-ui-ink-muted);">${processInlineMarkdown(line)}</p>`);
    }
    closeLists();
    if (inCodeBlock) {
      output.push(`<pre style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 12px; color: var(--slt-ui-ink-muted); margin: 8px 0;"><code>${codeContent.join("\n")}</code></pre>`);
    }
    return output.join("");
  }
  var VERSION = CURRENT_VERSION;
  var REPO_URL = RELEASES_URL;

  // src/utils/notify.ts
  function canRenderToasts() {
    try {
      return typeof document !== "undefined" && typeof document.createElement === "function" && !!document.body && typeof document.body.append === "function" && typeof document.head?.appendChild === "function";
    } catch {
      return false;
    }
  }
  function allowed(kind) {
    if (state.notificationLevel === "off")
      return false;
    if (state.notificationLevel === "errors")
      return kind === "error" || kind === "warning";
    return true;
  }
  function fallback(options) {
    try {
      const spicetify = globalThis.Spicetify;
      spicetify?.showNotification?.(options.title, options.kind === "error" || options.kind === "warning");
    } catch {
    }
    return null;
  }
  function notify(input, isError = false) {
    const options = typeof input === "string" ? { title: input, kind: isError ? "error" : "success" } : input;
    const kind = options.kind || "info";
    if (!options.force && !allowed(kind))
      return null;
    if (!canRenderToasts())
      return fallback({ ...options, kind });
    const { force, ...rest } = options;
    return toast({ ...rest, kind });
  }
  function dismissNotification(key) {
    if (canRenderToasts())
      dismissToast(key);
  }

  // src/utils/settingsModel.ts
  var SETTINGS_CATEGORIES = [
    {
      id: "slt-cat-translation",
      label: "Translation",
      icon: "\u6587",
      description: "The language you read in, how translations sit on the lyrics, and when they run.",
      sections: ["Translation", "Behaviour"]
    },
    {
      id: "slt-cat-providers",
      label: "Providers",
      icon: "\u21C4",
      description: "Which service does the translating, plus its key and model.",
      sections: ["Provider", "Custom API", "LibreTranslate", "DeepL", "OpenAI", "Gemini", "Grok", "Claude"]
    },
    {
      id: "slt-cat-interface",
      label: "Interface",
      icon: "\u25D0",
      description: "Notifications and the badges shown around the lyrics.",
      sections: ["Interface"]
    }
  ];
  var API_OPTIONS = [
    { value: "google", text: "Google Translate" },
    { value: "libretranslate", text: "LibreTranslate" },
    { value: "deepl", text: "DeepL" },
    { value: "openai", text: "OpenAI" },
    { value: "gemini", text: "Gemini" },
    { value: "grok", text: "Grok (xAI)" },
    { value: "anthropic", text: "Claude (Anthropic)" },
    { value: "custom", text: "Custom API" }
  ];
  var CUSTOM_API_FORMAT_OPTIONS = [
    { value: "generic", text: "Generic JSON" },
    { value: "libretranslate", text: "LibreTranslate Compatible" },
    { value: "openai", text: "OpenAI Compatible" },
    { value: "gemini", text: "Gemini Compatible" },
    { value: "deepl", text: "DeepL Compatible" }
  ];
  var OVERLAY_MODE_OPTIONS = [
    { value: "replace", text: "Replace" },
    { value: "interleaved", text: "Below each line (default)" },
    { value: "none", text: "None (original lyrics only)" }
  ];
  var SETTINGS_SCHEMA = [
    {
      id: "target-language",
      section: "Translation",
      keywords: "language locale translate to output",
      label: "Target Language",
      type: "select",
      storageKey: "target-language",
      defaultValue: "en",
      options: SUPPORTED_LANGUAGES.map((language) => ({ value: language.code, text: language.name })),
      effects: ["retranslate", "fieldVisibility"]
    },
    {
      id: "language-variant",
      section: "Translation",
      keywords: "variant regional dialect valencian valencia catalan local",
      label: "Use Regional Variant",
      type: "toggle",
      storageKey: "language-variant",
      defaultValue: false,
      description: "Ask the model for the regional variant of the target language. Only available on AI providers that accept written instructions.",
      visibleForApis: ["openai", "gemini", "grok", "anthropic", "custom"],
      visibleWhen: () => Boolean(getLanguageVariantForBase(storage.get("target-language") || "en")),
      effects: ["retranslate"]
    },
    {
      id: "overlay-mode",
      section: "Translation",
      keywords: "display overlay replace interleaved below line none hide off original only",
      label: "Translation Display",
      type: "select",
      storageKey: "overlay-mode",
      defaultValue: "interleaved",
      options: OVERLAY_MODE_OPTIONS,
      description: "How translated lyrics are displayed. None still translates and caches, but leaves the lyrics untouched - pairs with Learning Mode, which shows the translation itself.",
      effects: ["reapplyTranslations"]
    },
    {
      id: "show-romanization",
      section: "Translation",
      keywords: "romanization romaji pinyin transliteration pronunciation reading sing along",
      label: "Show Romanization",
      type: "toggle",
      storageKey: "show-romanization",
      defaultValue: false,
      description: "Show the pronunciation line (pinyin, romaji, ...) alongside the translation, when the lyrics provider supplies one",
      effects: ["romanizationDisplay"]
    },
    {
      id: "skip-languages",
      section: "Translation",
      keywords: "skip exclude ignore never do not translate languages i read understand multilingual bilingual",
      label: "Don't Translate",
      type: "languages",
      storageKey: "skip-languages",
      defaultValue: "",
      options: SUPPORTED_LANGUAGES.map((language) => ({ value: language.code, text: language.name })),
      placeholder: "Add a language\u2026",
      description: "Songs in these languages are left as they are. Add the languages you already read.",
      effects: ["retranslate"]
    },
    {
      id: "replace-script-conversions",
      section: "Translation",
      keywords: "chinese simplified traditional script convert conversion replace in place hanzi",
      label: "Replace Lyrics When Only the Script Changes",
      type: "toggle",
      storageKey: "replace-script-conversions",
      defaultValue: false,
      description: "Between Simplified and Traditional Chinese, show the converted lyrics in place of the original instead of below it.",
      visibleWhen: () => (storage.get("target-language") || "en").startsWith("zh"),
      effects: ["reapplyTranslations"]
    },
    {
      id: "preferred-api",
      section: "Provider",
      keywords: "api provider service engine backend",
      label: "Translation API",
      type: "select",
      storageKey: "preferred-api",
      defaultValue: "google",
      options: API_OPTIONS,
      effects: ["providerVisibility"]
    },
    {
      id: "custom-api-url",
      section: "Custom API",
      keywords: "custom endpoint url self hosted",
      label: "Custom API URL",
      type: "text",
      storageKey: "custom-api-url",
      defaultValue: "",
      placeholder: "https://your-api.com/translate",
      description: "Translation endpoint or compatible API base URL",
      visibleForApis: ["custom"]
    },
    {
      id: "custom-api-format",
      section: "Custom API",
      keywords: "custom format schema payload compatible",
      label: "Custom API Format",
      type: "select",
      storageKey: "custom-api-format",
      defaultValue: "generic",
      options: CUSTOM_API_FORMAT_OPTIONS,
      visibleForApis: ["custom"]
    },
    {
      id: "custom-api-key",
      section: "Custom API",
      keywords: "custom key token auth secret",
      label: "Custom API Key (optional)",
      type: "password",
      storageKey: "custom-api-key",
      defaultValue: "",
      placeholder: "API key",
      secret: true,
      visibleForApis: ["custom"]
    },
    {
      id: "custom-api-model",
      section: "Custom API",
      keywords: "custom model name llm",
      label: "Custom API Model (optional)",
      type: "text",
      storageKey: "custom-api-model",
      defaultValue: "",
      placeholder: "gpt-4o-mini, llama3.1, gemini-3.1-flash-lite",
      visibleForApis: ["custom"]
    },
    {
      id: "libretranslate-api-url",
      section: "LibreTranslate",
      keywords: "libretranslate url endpoint self hosted",
      label: "LibreTranslate URL",
      type: "text",
      storageKey: "libretranslate-api-url",
      defaultValue: "https://libretranslate.com/translate",
      placeholder: "https://libretranslate.com/translate",
      description: "Use the hosted endpoint with a key, or a self-hosted URL without one",
      visibleForApis: ["libretranslate"]
    },
    {
      id: "libretranslate-api-key",
      section: "LibreTranslate",
      keywords: "libretranslate key token auth secret",
      label: "LibreTranslate API Key",
      type: "password",
      storageKey: "libretranslate-api-key",
      defaultValue: "",
      placeholder: "API key",
      description: "Required for hosted libretranslate.com",
      secret: true,
      visibleForApis: ["libretranslate"]
    },
    {
      id: "deepl-api-key",
      section: "DeepL",
      keywords: "deepl key token auth secret pro free",
      label: "DeepL API Key",
      type: "password",
      storageKey: "deepl-api-key",
      defaultValue: "",
      placeholder: "xxxxxxxx-xxxx-xxxx-xxxx:fx",
      description: "Get a free key at deepl.com/pro-api",
      secret: true,
      visibleForApis: ["deepl"]
    },
    {
      id: "openai-api-key",
      section: "OpenAI",
      keywords: "openai key token auth secret gpt",
      label: "OpenAI API Key",
      type: "password",
      storageKey: "openai-api-key",
      defaultValue: "",
      placeholder: "sk-...",
      secret: true,
      visibleForApis: ["openai"]
    },
    {
      id: "openai-model",
      section: "OpenAI",
      keywords: "openai model gpt version",
      label: "OpenAI Model",
      type: "select",
      storageKey: "openai-model",
      defaultValue: "gpt-4o-mini",
      get options() {
        return getModelOptions("openai", storage.get("openai-model"));
      },
      description: "Models available to your API key, refreshed automatically. Mini/nano models are fastest and cheapest",
      visibleForApis: ["openai"]
    },
    {
      id: "gemini-api-key",
      section: "Gemini",
      keywords: "gemini google key token auth secret",
      label: "Gemini API Key",
      type: "password",
      storageKey: "gemini-api-key",
      defaultValue: "",
      placeholder: "AIza... or AQ...",
      description: "Get a key at aistudio.google.com/apikey (AIza... and AQ... keys both work)",
      secret: true,
      visibleForApis: ["gemini"]
    },
    {
      id: "gemini-model",
      section: "Gemini",
      keywords: "gemini model flash pro version",
      label: "Gemini Model",
      type: "select",
      storageKey: "gemini-model",
      defaultValue: "gemini-3.1-flash-lite",
      get options() {
        return getModelOptions("gemini", storage.get("gemini-model"));
      },
      description: "Models available to your API key, refreshed automatically. Flash-Lite is fastest; Flash is balanced; Pro is best for harder lyrics",
      visibleForApis: ["gemini"]
    },
    {
      id: "gemini-temperature",
      section: "Gemini",
      keywords: "gemini temperature randomness creativity",
      label: "Gemini Temperature",
      type: "text",
      storageKey: "gemini-temperature",
      defaultValue: "0.3",
      placeholder: "0.0 - 2.0",
      description: "Controls output randomness (0.0 = deterministic, 2.0 = highly creative)",
      visibleForApis: ["gemini"]
    },
    {
      id: "grok-api-key",
      section: "Grok",
      keywords: "grok xai key token auth secret",
      label: "Grok (xAI) API Key",
      type: "password",
      storageKey: "grok-api-key",
      defaultValue: "",
      placeholder: "xai-...",
      description: "Get a key at console.x.ai",
      secret: true,
      visibleForApis: ["grok"]
    },
    {
      id: "grok-model",
      section: "Grok",
      keywords: "grok xai model version",
      label: "Grok Model",
      type: "select",
      storageKey: "grok-model",
      defaultValue: "grok-4.5",
      get options() {
        return getModelOptions("grok", storage.get("grok-model"));
      },
      description: "Models available to your API key, refreshed automatically",
      visibleForApis: ["grok"]
    },
    {
      id: "anthropic-api-key",
      section: "Claude",
      keywords: "claude anthropic key token auth secret",
      label: "Claude (Anthropic) API Key",
      type: "password",
      storageKey: "anthropic-api-key",
      defaultValue: "",
      placeholder: "sk-ant-...",
      description: "Get a key at console.anthropic.com",
      secret: true,
      visibleForApis: ["anthropic"]
    },
    {
      id: "anthropic-model",
      section: "Claude",
      keywords: "claude anthropic model haiku sonnet opus",
      label: "Claude Model",
      type: "select",
      storageKey: "anthropic-model",
      defaultValue: "claude-haiku-4-5",
      get options() {
        return getModelOptions("anthropic", storage.get("anthropic-model"));
      },
      description: "Models available to your API key, refreshed automatically. Haiku is fastest and cheapest; Sonnet balances cost and quality; Opus is best for nuanced lyrics",
      visibleForApis: ["anthropic"]
    },
    {
      id: "max-parallel-chunks",
      section: "Provider",
      keywords: "parallel concurrent requests speed rate limit cost",
      label: "Parallel Translation Requests",
      type: "select",
      storageKey: "max-parallel-chunks",
      defaultValue: "4",
      options: [
        { value: "1", text: "Off (one request)" },
        { value: "2", text: "2 requests" },
        { value: "3", text: "3 requests" },
        { value: "4", text: "4 requests" },
        { value: "5", text: "5 requests" },
        { value: "6", text: "6 requests" }
      ],
      description: "\u26A0 Splits long songs across concurrent requests for faster translation. Higher values send more requests per song, which can increase API usage/cost and may hit rate limits on free tiers. Lower it (or set Off) if you see errors.",
      visibleForApis: ["openai", "gemini", "grok", "anthropic", "custom"]
    },
    {
      id: "auto-translate",
      section: "Behaviour",
      keywords: "auto automatic song change start",
      label: "Auto-Translate on Song Change",
      type: "toggle",
      storageKey: "auto-translate",
      defaultValue: false
    },
    {
      id: "notification-level",
      section: "Interface",
      keywords: "notifications toasts messages popup alerts errors quiet silent",
      label: "Notifications",
      type: "select",
      storageKey: "notification-level",
      defaultValue: "all",
      effects: ["fieldVisibility"],
      options: [
        { value: "all", text: "All" },
        { value: "errors", text: "Errors and warnings only" },
        { value: "off", text: "Off" }
      ],
      description: "Which pop-up messages to show. Update prompts always appear, and warnings and errors are kept in the notification inbox either way."
    },
    {
      id: "show-skip-notice",
      section: "Interface",
      keywords: "notifications toasts popup already in language same target skip skipped notice",
      label: "Notify When Lyrics Are Already in Target Language",
      type: "toggle",
      storageKey: "show-skip-notice",
      defaultValue: true,
      description: 'Show the "Lyrics already in ..." pop-up when a song is skipped because it is already in the language you translate to.',
      visibleWhen: () => (storage.get("notification-level") || "all") === "all"
    },
    {
      id: "show-translated-notice",
      section: "Interface",
      keywords: "notifications toasts popup translated success complete done notice",
      label: "Notify When a Song Is Translated",
      type: "toggle",
      storageKey: "show-translated-notice",
      defaultValue: true,
      description: "Show the pop-up confirming a song was translated.",
      visibleWhen: () => (storage.get("notification-level") || "all") === "all"
    },
    {
      id: "learning-mode",
      section: "Behaviour",
      keywords: "learning vocabulary study word by word breakdown gloss lemma",
      label: "Learning Mode (word-by-word breakdown)",
      type: "toggle",
      storageKey: "learning-mode",
      defaultValue: false,
      effects: ["learningModeClass", "reapplyTranslations"]
    },
    {
      id: "show-quality-indicator",
      section: "Interface",
      keywords: "quality indicator badge confidence",
      label: "Show Translation Quality Indicator",
      type: "toggle",
      storageKey: "show-quality-indicator",
      defaultValue: true,
      effects: ["qualityIndicatorClass"]
    },
    {
      id: "hide-connection-indicator",
      section: "Interface",
      keywords: "connection status indicator hide ping",
      label: "Hide Connection Status",
      type: "toggle",
      storageKey: "hide-connection-indicator",
      defaultValue: false,
      effects: ["connectionIndicatorClass"]
    }
  ];
  function getSettingField(id) {
    return SETTINGS_SCHEMA.find((field) => field.id === id);
  }
  function getCategoryForSection(section) {
    return SETTINGS_CATEGORIES.find((category) => category.sections.includes(section));
  }
  function getSectionsForCategory(category) {
    return category.sections.filter((section) => SETTINGS_SCHEMA.some((field) => field.section === section));
  }
  function matchesSettingQuery(field, query) {
    const needle = query.trim().toLowerCase();
    if (!needle)
      return true;
    return [field.label, field.section, field.description, field.keywords].some((value) => (value || "").toLowerCase().includes(needle));
  }
  function getCurrentApiPreference() {
    return storage.get("preferred-api") || state.preferredApi || "google";
  }
  function getResolvedTargetLanguage() {
    return resolveTargetLanguage(
      storage.get("target-language") || "en",
      storage.get("language-variant") === "true",
      getCurrentApiPreference()
    );
  }
  function isSettingFieldVisible(field, api = getCurrentApiPreference()) {
    if (field.visibleForApis && !field.visibleForApis.includes(api))
      return false;
    return !field.visibleWhen || field.visibleWhen();
  }
  function getModelFieldId(provider) {
    return `${provider}-model`;
  }
  function getModelProviderForField(fieldId) {
    return MODEL_PROVIDERS.find((provider) => fieldId === getModelFieldId(provider) || fieldId === `${provider}-api-key`) || null;
  }
  function getProviderApiKey(provider) {
    switch (provider) {
      case "openai":
        return state.openaiApiKey;
      case "gemini":
        return state.geminiApiKey;
      case "grok":
        return state.grokApiKey;
      case "anthropic":
        return state.anthropicApiKey;
    }
  }
  async function refreshProviderModelLists(options = {}) {
    const onlyProvider = options.fieldId ? getModelProviderForField(options.fieldId) : null;
    if (options.fieldId && !onlyProvider)
      return [];
    const providers = onlyProvider ? [onlyProvider] : MODEL_PROVIDERS;
    const results = await Promise.all(providers.map(async (provider) => {
      const refreshed = await refreshModelCatalog(provider, getProviderApiKey(provider), { force: options.force });
      return refreshed ? getModelFieldId(provider) : null;
    }));
    return results.filter((id) => Boolean(id));
  }
  function normalizeLegacySelectValue(fieldId, value) {
    const stored = (value || "").trim();
    if (!stored)
      return value;
    const provider = MODEL_PROVIDERS.find((candidate) => fieldId === getModelFieldId(candidate));
    return provider ? resolveModelId(provider, stored) : value;
  }
  function readSettingValue(field) {
    if (field.type === "toggle") {
      const stored2 = storage.get(field.storageKey);
      if (typeof field.defaultValue === "boolean" && field.defaultValue) {
        return stored2 !== "false";
      }
      return stored2 === "true";
    }
    const stored = field.secret ? storage.getSecret(field.storageKey) : storage.get(field.storageKey);
    const normalizedStored = field.type === "select" ? normalizeLegacySelectValue(field.id, stored) : stored;
    if (field.type === "select" && field.options && normalizedStored && field.options.every((option) => option.value !== normalizedStored)) {
      return String(field.defaultValue);
    }
    return normalizedStored ?? String(field.defaultValue);
  }
  function isSettingAtDefault(field) {
    const value = readSettingValue(field);
    if (field.type === "toggle")
      return Boolean(value) === Boolean(field.defaultValue);
    return String(value) === String(field.defaultValue);
  }
  function configureTranslationApi() {
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
  function notifySettingCorrection(message) {
    notify({ kind: "info", title: message, key: "slt-setting-correction" });
  }
  function showLearningCards() {
    state.learningVisible = true;
    storage.set("learning-visible", "true");
  }
  function enforceLearningCoupling(fieldId, value) {
    if (fieldId === "overlay-mode" && String(value) === "none" && !state.learningMode) {
      storage.set("learning-mode", "true");
      state.learningMode = true;
      showLearningCards();
      notifySettingCorrection("Learning Mode turned on - display None hides translations, so the cards show them instead");
      return ["learningModeClass"];
    }
    if (fieldId === "learning-mode" && !Boolean(value) && state.overlayMode === "none") {
      storage.set("overlay-mode", "replace");
      state.overlayMode = "replace";
      notifySettingCorrection("Translation Display switched back to Replace - display None only makes sense with Learning Mode");
      return ["reapplyTranslations"];
    }
    return [];
  }
  function writeSettingValue(field, value) {
    if (field.type === "toggle") {
      storage.set(field.storageKey, String(Boolean(value)));
    } else if (field.secret) {
      storage.setSecret(field.storageKey, String(value));
    } else {
      storage.set(field.storageKey, String(value));
    }
    switch (field.id) {
      case "target-language":
        state.targetLanguage = getResolvedTargetLanguage();
        break;
      case "language-variant":
        state.targetLanguage = getResolvedTargetLanguage();
        break;
      case "overlay-mode":
        state.overlayMode = String(value);
        break;
      case "show-romanization":
        state.showRomanization = Boolean(value);
        break;
      case "skip-languages":
        state.skipLanguages = parseLanguageList(String(value));
        break;
      case "replace-script-conversions":
        state.replaceScriptConversions = Boolean(value);
        break;
      case "preferred-api":
        state.preferredApi = String(value);
        state.targetLanguage = getResolvedTargetLanguage();
        configureTranslationApi();
        break;
      case "custom-api-url":
        state.customApiUrl = String(value);
        configureTranslationApi();
        break;
      case "custom-api-format":
        state.customApiFormat = String(value);
        configureTranslationApi();
        break;
      case "custom-api-key":
        state.customApiKey = String(value);
        configureTranslationApi();
        break;
      case "custom-api-model":
        state.customApiModel = String(value);
        configureTranslationApi();
        break;
      case "libretranslate-api-url":
        state.libreTranslateApiUrl = String(value);
        configureTranslationApi();
        break;
      case "libretranslate-api-key":
        state.libreTranslateApiKey = String(value);
        configureTranslationApi();
        break;
      case "deepl-api-key":
        state.deeplApiKey = String(value);
        configureTranslationApi();
        break;
      case "openai-api-key":
        state.openaiApiKey = String(value);
        configureTranslationApi();
        break;
      case "openai-model":
        state.openaiModel = String(value);
        configureTranslationApi();
        break;
      case "gemini-api-key":
        state.geminiApiKey = String(value);
        configureTranslationApi();
        break;
      case "gemini-model":
        state.geminiModel = String(value);
        configureTranslationApi();
        break;
      case "gemini-temperature":
        state.geminiTemperature = String(value);
        configureTranslationApi();
        break;
      case "grok-api-key":
        state.grokApiKey = String(value);
        configureTranslationApi();
        break;
      case "grok-model":
        state.grokModel = String(value);
        configureTranslationApi();
        break;
      case "anthropic-api-key":
        state.anthropicApiKey = String(value);
        configureTranslationApi();
        break;
      case "anthropic-model":
        state.anthropicModel = String(value);
        configureTranslationApi();
        break;
      case "max-parallel-chunks":
        state.maxParallelChunks = String(value);
        configureTranslationApi();
        break;
      case "auto-translate":
        state.autoTranslate = Boolean(value);
        break;
      case "notification-level":
        state.notificationLevel = String(value);
        break;
      case "show-skip-notice":
        state.showSkipNotice = Boolean(value);
        break;
      case "show-translated-notice":
        state.showTranslatedNotice = Boolean(value);
        break;
      case "show-quality-indicator":
        state.showQualityIndicator = Boolean(value);
        break;
      case "learning-mode":
        state.learningMode = Boolean(value);
        if (state.learningMode)
          showLearningCards();
        break;
      case "hide-connection-indicator":
        state.hideConnectionIndicator = Boolean(value);
        break;
    }
    const coupled = enforceLearningCoupling(field.id, value);
    if (coupled.length === 0)
      return field.effects || [];
    return Array.from(/* @__PURE__ */ new Set([...field.effects || [], ...coupled]));
  }

  // src/utils/quickMenu.ts
  var QUICK_MENU_ID = "slt-quick-menu";
  var QUICK_FIELD_IDS = ["overlay-mode", "learning-mode", "show-romanization"];
  var outsideClickHandler = null;
  var keydownHandler = null;
  function escapeHtml2(text3) {
    return text3.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function closeQuickMenu() {
    const existing = document.getElementById(QUICK_MENU_ID);
    if (existing)
      existing.remove();
    if (outsideClickHandler) {
      document.removeEventListener("mousedown", outsideClickHandler, true);
      outsideClickHandler = null;
    }
    if (keydownHandler) {
      document.removeEventListener("keydown", keydownHandler, true);
      keydownHandler = null;
    }
  }
  function quickMenuStyles() {
    return `
        #${QUICK_MENU_ID} {
            position: fixed;
            z-index: 10000;
            min-width: 236px;
            max-width: 300px;
            padding: 6px;
            box-sizing: border-box;
            border-radius: 8px;
            background: var(--spice-card, #181818);
            border: 1px solid rgba(255, 255, 255, 0.12);
            box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55);
            font-size: 13px;
            color: var(--spice-text, #fff);
            user-select: none;
        }
        #${QUICK_MENU_ID} .slt-qm-group-label {
            padding: 6px 10px 4px;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: var(--spice-subtext, #b3b3b3);
        }
        #${QUICK_MENU_ID} .slt-qm-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            width: 100%;
            padding: 7px 10px;
            border: none;
            border-radius: 5px;
            background: transparent;
            color: inherit;
            font: inherit;
            text-align: left;
            cursor: pointer;
        }
        #${QUICK_MENU_ID} .slt-qm-item:hover {
            background: rgba(255, 255, 255, 0.1);
        }
        #${QUICK_MENU_ID} .slt-qm-check {
            flex: 0 0 auto;
            width: 14px;
            opacity: 0;
            font-weight: 700;
        }
        #${QUICK_MENU_ID} .slt-qm-item[aria-checked="true"] .slt-qm-check {
            opacity: 1;
            color: #1db954;
        }
        #${QUICK_MENU_ID} .slt-qm-label {
            flex: 1 1 auto;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        #${QUICK_MENU_ID} .slt-qm-value {
            flex: 0 0 auto;
            color: var(--spice-subtext, #b3b3b3);
            font-size: 12px;
        }
        #${QUICK_MENU_ID} .slt-qm-sep {
            height: 1px;
            margin: 5px 6px;
            background: rgba(255, 255, 255, 0.1);
        }
        #${QUICK_MENU_ID} select.slt-qm-select {
            flex: 0 0 auto;
            max-width: 130px;
            padding: 3px 6px;
            border-radius: 4px;
            border: 1px solid rgba(255, 255, 255, 0.16);
            background: var(--spice-main, #121212);
            color: var(--spice-text, #fff);
            font: inherit;
            font-size: 12px;
            cursor: pointer;
        }
    `;
  }
  function syncQuickMenuState(menu) {
    menu.querySelectorAll("[data-slt-qm-field]").forEach((el2) => {
      const item = el2;
      const id = item.dataset.sltQmField || "";
      const field = getSettingField(id);
      if (!field)
        return;
      const current = readSettingValue(field);
      if (item.dataset.sltQmValue !== void 0) {
        item.setAttribute("aria-checked", String(item.dataset.sltQmValue === String(current)));
      } else {
        item.setAttribute("aria-checked", String(Boolean(current)));
      }
    });
  }
  function buildToggleRow(field, onChange) {
    const checked = Boolean(readSettingValue(field));
    const item = document.createElement("button");
    item.type = "button";
    item.className = "slt-qm-item";
    item.setAttribute("role", "menuitemcheckbox");
    item.setAttribute("aria-checked", String(checked));
    item.dataset.sltQmField = field.id;
    item.innerHTML = `
        <span class="slt-qm-check">\u2713</span>
        <span class="slt-qm-label">${escapeHtml2(field.label)}</span>
    `;
    item.addEventListener("click", () => {
      const next = item.getAttribute("aria-checked") !== "true";
      item.setAttribute("aria-checked", String(next));
      applySettingById(field.id, next);
      onChange();
    });
    return item;
  }
  function buildModeRows(field, onChange) {
    const wrapper = document.createElement("div");
    const current = String(readSettingValue(field));
    const label = document.createElement("div");
    label.className = "slt-qm-group-label";
    label.textContent = field.label;
    wrapper.appendChild(label);
    (field.options || []).forEach((option) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "slt-qm-item";
      item.setAttribute("role", "menuitemradio");
      item.setAttribute("aria-checked", String(option.value === current));
      item.dataset.sltQmField = field.id;
      item.dataset.sltQmValue = option.value;
      item.innerHTML = `
            <span class="slt-qm-check">\u2713</span>
            <span class="slt-qm-label">${escapeHtml2(option.text)}</span>
        `;
      item.addEventListener("click", () => {
        wrapper.querySelectorAll(".slt-qm-item").forEach((el2) => el2.setAttribute("aria-checked", "false"));
        item.setAttribute("aria-checked", "true");
        applySettingById(field.id, option.value);
        onChange();
      });
      wrapper.appendChild(item);
    });
    return wrapper;
  }
  function buildSelectRow(field, onChange) {
    const current = String(readSettingValue(field));
    const row = document.createElement("div");
    row.className = "slt-qm-item";
    row.style.cursor = "default";
    const label = document.createElement("span");
    label.className = "slt-qm-label";
    label.textContent = field.label;
    const select = document.createElement("select");
    select.className = "slt-qm-select";
    (field.options || []).forEach((option) => {
      const opt = document.createElement("option");
      opt.value = option.value;
      opt.textContent = option.text;
      if (option.value === current)
        opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener("change", () => {
      applySettingById(field.id, select.value);
      onChange();
    });
    select.addEventListener("mousedown", (e) => e.stopPropagation());
    select.addEventListener("click", (e) => e.stopPropagation());
    row.appendChild(label);
    row.appendChild(select);
    return row;
  }
  function positionMenu(menu, x, y) {
    menu.style.left = "0px";
    menu.style.top = "0px";
    const rect = menu.getBoundingClientRect();
    const margin = 8;
    const left = Math.max(margin, Math.min(x, window.innerWidth - rect.width - margin));
    const top = Math.max(margin, Math.min(y, window.innerHeight - rect.height - margin));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }
  function openQuickMenu(x, y) {
    closeQuickMenu();
    try {
      const menu = document.createElement("div");
      menu.id = QUICK_MENU_ID;
      menu.setAttribute("role", "menu");
      const style = document.createElement("style");
      style.textContent = quickMenuStyles();
      menu.appendChild(style);
      const addSeparator = () => {
        const sep = document.createElement("div");
        sep.className = "slt-qm-sep";
        menu.appendChild(sep);
      };
      const refresh = () => syncQuickMenuState(menu);
      QUICK_FIELD_IDS.forEach((id, index) => {
        const field = getSettingField(id);
        if (!field)
          return;
        if (index > 0)
          addSeparator();
        if (field.type === "toggle") {
          menu.appendChild(buildToggleRow(field, refresh));
        } else if (field.id === "overlay-mode") {
          menu.appendChild(buildModeRows(field, refresh));
        } else {
          menu.appendChild(buildSelectRow(field, refresh));
        }
      });
      addSeparator();
      const allSettings = document.createElement("button");
      allSettings.type = "button";
      allSettings.className = "slt-qm-item";
      allSettings.innerHTML = `
            <span class="slt-qm-check"></span>
            <span class="slt-qm-label">All settings\u2026</span>
        `;
      allSettings.addEventListener("click", () => {
        closeQuickMenu();
        openSettingsModal();
      });
      menu.appendChild(allSettings);
      document.body.appendChild(menu);
      positionMenu(menu, x, y);
      outsideClickHandler = (e) => {
        if (!menu.contains(e.target))
          closeQuickMenu();
      };
      keydownHandler = (e) => {
        if (e.key === "Escape")
          closeQuickMenu();
      };
      document.addEventListener("mousedown", outsideClickHandler, true);
      document.addEventListener("keydown", keydownHandler, true);
    } catch (e) {
      warn("Failed to open quick menu, falling back to settings:", e);
      openSettingsModal();
    }
  }

  // src/utils/core.ts
  var lyricsObserver = null;
  var translateDebounceTimer = null;
  var rerenderDebounceTimer = null;
  var reapplyTimers = [];
  var viewModeIntervalId = null;
  var romanizationToggleListener = null;
  var romanizationToggleButton = null;
  var observedLyricsContent = null;
  var lastKnownRomanizationState = null;
  var lastTranslatedRomanizationState = null;
  var contentTranslation = /* @__PURE__ */ new Map();
  var contentQuality = /* @__PURE__ */ new Map();
  var coveredKeys = /* @__PURE__ */ new Set();
  var fillGapsInFlight = false;
  var lastSkippedTranslation = null;
  function normalizeMatchKey(text3) {
    return normalizeLyricMatchKey(text3);
  }
  function buildLyricsKey(lines) {
    let hash = 2166136261;
    let count = 0;
    for (const rawLine of lines) {
      const line = (rawLine || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (!line)
        continue;
      count++;
      const value = `${line}\u241E`;
      for (let i = 0; i < value.length; i++) {
        hash ^= value.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
      }
    }
    return `${count}:${(hash >>> 0).toString(36)}`;
  }
  function matchesSkippedTranslation(trackUri, targetLanguage, romanizationOn, lyricsKey) {
    if (!lastSkippedTranslation)
      return false;
    if (lastSkippedTranslation.trackUri !== trackUri)
      return false;
    if (lastSkippedTranslation.targetLanguage !== targetLanguage)
      return false;
    if (lastSkippedTranslation.romanizationOn !== romanizationOn)
      return false;
    return lastSkippedTranslation.lyricsKey === lyricsKey || lastSkippedTranslation.domLyricsKey === lyricsKey;
  }
  var lastSkipNotifyKey = null;
  function shouldNotifySkip(trackUri, targetLanguage, romanizationOn) {
    if (!state.showSkipNotice)
      return false;
    const key = `${trackUri ?? ""}${targetLanguage}${romanizationOn ? "1" : "0"}`;
    if (lastSkipNotifyKey === key)
      return false;
    lastSkipNotifyKey = key;
    return true;
  }
  function rememberSkippedTranslation(trackUri, targetLanguage, romanizationOn, lyricsKey, domLyricsKey, detectedLanguage) {
    lastSkippedTranslation = {
      trackUri,
      targetLanguage,
      romanizationOn,
      lyricsKey,
      domLyricsKey,
      detectedLanguage
    };
    state.lastTranslatedSongUri = trackUri;
    lastTranslatedRomanizationState = romanizationOn;
    if (detectedLanguage)
      state.detectedLanguage = detectedLanguage;
  }
  function buildMatchKeys(text3) {
    const nonLatinOnly = text3.replace(/[A-Za-z0-9]/g, " ").replace(/\s+/g, " ").trim();
    const latinOnly = text3.replace(/[^A-Za-z0-9\s'\-]/g, " ").replace(/\s+/g, " ").trim();
    return {
      norm: normalizeMatchKey(text3),
      nonLatinNorm: nonLatinOnly && nonLatinOnly !== text3 ? normalizeMatchKey(nonLatinOnly) : "",
      latinNorm: latinOnly && latinOnly !== text3 ? normalizeMatchKey(latinOnly) : ""
    };
  }
  function lookupWithKeys(map, keys) {
    const { norm, nonLatinNorm, latinNorm } = keys;
    if (norm) {
      const direct = map.get(norm);
      if (direct)
        return direct;
    }
    if (nonLatinNorm) {
      const match = map.get(nonLatinNorm);
      if (match)
        return match;
    }
    if (latinNorm) {
      const match = map.get(latinNorm);
      if (match)
        return match;
    }
    if (norm && norm.length >= 4) {
      let best = null;
      for (const [key, value] of map) {
        if (key.length < 4)
          continue;
        if (norm.includes(key) || key.includes(norm)) {
          if (!best || key.length > best.key.length) {
            best = { key, value };
          }
        }
      }
      if (best)
        return best.value;
    }
    return void 0;
  }
  function getPIPWindow2() {
    try {
      const docPiP = globalThis.documentPictureInPicture;
      if (docPiP && docPiP.window)
        return docPiP.window;
    } catch (e) {
    }
    return null;
  }
  function isRomanizationActive() {
    const readUiState = (raw) => {
      if (!raw)
        return null;
      try {
        const obj = JSON.parse(raw);
        if (obj && typeof obj.romanization === "boolean")
          return obj.romanization;
      } catch (e) {
      }
      return null;
    };
    try {
      const spicetifyStorage = globalThis.Spicetify?.LocalStorage;
      const fromSpicetify = readUiState(spicetifyStorage?.get?.("SL:uiState"));
      if (fromSpicetify !== null)
        return fromSpicetify;
    } catch (e) {
    }
    try {
      const fromLocal = readUiState(localStorage.getItem("SL:uiState"));
      if (fromLocal !== null)
        return fromLocal;
    } catch (e) {
    }
    const btn = document.querySelector("#RomanizationToggle");
    if (btn && btn.classList.contains("active"))
      return true;
    const keys = [
      "SpicyLyrics-romanization",
      "SpicyLyrics:romanization",
      "romanization"
    ];
    try {
      const spicetifyStorage = globalThis.Spicetify?.LocalStorage;
      if (spicetifyStorage?.get) {
        for (const key of keys) {
          const val = spicetifyStorage.get(key);
          if (val === "true")
            return true;
          if (val === "false")
            return false;
        }
      }
    } catch (e) {
    }
    try {
      for (const key of keys) {
        const val = localStorage.getItem(key);
        if (val === "true")
          return true;
        if (val === "false")
          return false;
      }
    } catch (e) {
    }
    return false;
  }
  function isSpicyLyricsOpen() {
    if (document.querySelector("#SpicyLyricsPage") || document.querySelector(".spicy-pip-wrapper #SpicyLyricsPage") || document.querySelector(CINEMA_CONTAINER_SELECTOR) || isSidebarLyricsActive()) {
      return true;
    }
    const pipWindow = getPIPWindow2();
    if (pipWindow?.document.querySelector("#SpicyLyricsPage")) {
      return true;
    }
    return false;
  }
  function getLyricsContent() {
    const pipWindow = getPIPWindow2();
    if (pipWindow) {
      const pipContent = pipWindow.document.querySelector("#SpicyLyricsPage .LyricsContainer .LyricsContent") || pipWindow.document.querySelector("#SpicyLyricsPage .LyricsContent") || pipWindow.document.querySelector(".LyricsContent");
      if (pipContent)
        return pipContent;
    }
    if (isSidebarLyricsActive()) {
      const sidebarPage = findSidebarLyricsPage();
      const sidebarContent = sidebarPage?.querySelector(".LyricsContainer .LyricsContent") || sidebarPage?.querySelector(".LyricsContent");
      if (sidebarContent)
        return sidebarContent;
    }
    return document.querySelector("#SpicyLyricsPage .LyricsContainer .LyricsContent") || document.querySelector("#SpicyLyricsPage .LyricsContent") || document.querySelector(".spicy-pip-wrapper .LyricsContent") || document.querySelector(CINEMA_LYRICS_CONTENT_SELECTOR) || document.querySelector(".LyricsContainer .LyricsContent");
  }
  function waitForElement(selector, timeout = 1e4) {
    return new Promise((resolve) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }
      const observer = new MutationObserver((mutations, obs) => {
        const el2 = document.querySelector(selector);
        if (el2) {
          obs.disconnect();
          resolve(el2);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  }
  function updateButtonState() {
    const buttons = [
      document.querySelector("#TranslateToggle"),
      getPIPWindow2()?.document.querySelector("#TranslateToggle")
    ];
    buttons.forEach((button) => {
      if (button) {
        button.innerHTML = state.isEnabled ? Icons.Translate : Icons.TranslateOff;
        button.classList.toggle("active", state.isEnabled);
        const btnWithTippy = button;
        if (btnWithTippy._tippy) {
          btnWithTippy._tippy.setContent(state.isEnabled ? "Disable Translation" : "Enable Translation");
        }
      }
    });
  }
  function restoreButtonState() {
    const buttons = [
      document.querySelector("#TranslateToggle"),
      getPIPWindow2()?.document.querySelector("#TranslateToggle")
    ];
    buttons.forEach((button) => {
      if (button) {
        button.classList.remove("loading", "error");
        button.innerHTML = state.isEnabled ? Icons.Translate : Icons.TranslateOff;
      }
    });
  }
  function setTranslateButtonsLoading(isLoading) {
    const buttons = [
      document.querySelector("#TranslateToggle"),
      getPIPWindow2()?.document.querySelector("#TranslateToggle")
    ];
    buttons.forEach((button) => {
      if (!button)
        return;
      button.classList.toggle("loading", isLoading);
      button.innerHTML = isLoading ? Icons.Loading : state.isEnabled ? Icons.Translate : Icons.TranslateOff;
    });
  }
  function setButtonErrorState(hasError) {
    const buttons = [
      document.querySelector("#TranslateToggle"),
      getPIPWindow2()?.document.querySelector("#TranslateToggle")
    ];
    buttons.forEach((button) => {
      if (button)
        button.classList.toggle("error", hasError);
    });
  }
  function createTranslateButton() {
    const button = document.createElement("button");
    button.id = "TranslateToggle";
    button.className = "ViewControl";
    button.innerHTML = state.isEnabled ? Icons.Translate : Icons.TranslateOff;
    if (state.isEnabled)
      button.classList.add("active");
    if (typeof Spicetify !== "undefined" && Spicetify.Tippy) {
      try {
        const tooltip = Spicetify.Tippy(button, {
          ...Spicetify.TippyProps,
          content: state.isEnabled ? "Disable Translation" : "Enable Translation"
        });
        tooltip?.popper?.classList.add("SpicyLyrics_Tooltip");
      } catch (e) {
        warn("Failed to create tooltip:", e);
      }
    }
    button.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleTranslateToggle();
    });
    button.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = button.getBoundingClientRect();
      const x = e.clientX || rect.left;
      const y = e.clientY || rect.bottom;
      openQuickMenu(x, y);
      return false;
    });
    return button;
  }
  function insertTranslateButton() {
    insertTranslateButtonIntoDocument(document);
    const pipWindow = getPIPWindow2();
    if (pipWindow) {
      insertTranslateButtonIntoDocument(pipWindow.document);
    }
    syncLearningButton();
  }
  function insertTranslateButtonIntoCardControls(doc) {
    const cardControls = doc.querySelector("#SpicyLyricsNPVCard .CardControls");
    if (!cardControls)
      return false;
    if (cardControls.querySelector("#TranslateToggle"))
      return true;
    const button = createTranslateButton();
    button.classList.add("CardControl");
    const expandButton = cardControls.querySelector("#NPVCardExpand");
    if (expandButton) {
      expandButton.insertAdjacentElement("beforebegin", button);
    } else {
      cardControls.insertBefore(button, cardControls.firstChild);
    }
    return true;
  }
  function insertTranslateButtonIntoDocument(doc) {
    if (insertTranslateButtonIntoCardControls(doc))
      return;
    let viewControls = doc.querySelector("#SpicyLyricsPage .ContentBox .ViewControls") || doc.querySelector("#SpicyLyricsPage .ViewControls");
    if (!viewControls && isSidebarLyricsActive(doc)) {
      viewControls = findSidebarLyricsPage(doc)?.querySelector(".ViewControls") || null;
    }
    if (!viewControls) {
      viewControls = doc.querySelector(".ViewControls");
    }
    if (!viewControls)
      return;
    if (viewControls.querySelector("#TranslateToggle"))
      return;
    const romanizeButton = viewControls.querySelector("#RomanizationToggle");
    const translateButton = createTranslateButton();
    if (romanizeButton) {
      romanizeButton.insertAdjacentElement("afterend", translateButton);
    } else {
      const firstChild = viewControls.firstChild;
      if (firstChild) {
        viewControls.insertBefore(translateButton, firstChild);
      } else {
        viewControls.appendChild(translateButton);
      }
    }
  }
  function learningButtonTooltip() {
    return state.learningVisible ? "Hide Learning Mode" : "Show Learning Mode";
  }
  function createLearningButton() {
    const button = document.createElement("button");
    button.id = "LearningToggle";
    button.className = "ViewControl";
    button.innerHTML = state.learningVisible ? Icons.Learning : Icons.LearningOff;
    button.classList.toggle("active", state.learningVisible);
    if (typeof Spicetify !== "undefined" && Spicetify.Tippy) {
      try {
        const tooltip = Spicetify.Tippy(button, {
          ...Spicetify.TippyProps,
          content: learningButtonTooltip()
        });
        tooltip?.popper?.classList.add("SpicyLyrics_Tooltip");
      } catch (e) {
        warn("Failed to create tooltip:", e);
      }
    }
    button.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleLearningToggle();
    });
    return button;
  }
  function syncLearningButtonInDocument(doc) {
    if (!state.learningMode) {
      doc.querySelectorAll("#LearningToggle").forEach((button) => button.remove());
      return;
    }
    doc.querySelectorAll("#TranslateToggle").forEach((translateButton) => {
      const next = translateButton.nextElementSibling;
      if (next && next.id === "LearningToggle")
        return;
      const button = createLearningButton();
      if (translateButton.classList.contains("CardControl"))
        button.classList.add("CardControl");
      translateButton.insertAdjacentElement("afterend", button);
    });
    doc.querySelectorAll("#LearningToggle").forEach((button) => {
      const prev = button.previousElementSibling;
      if (!prev || prev.id !== "TranslateToggle") {
        button.remove();
        return;
      }
      button.innerHTML = state.learningVisible ? Icons.Learning : Icons.LearningOff;
      button.classList.toggle("active", state.learningVisible);
      const btnWithTippy = button;
      if (btnWithTippy._tippy)
        btnWithTippy._tippy.setContent(learningButtonTooltip());
    });
  }
  function syncLearningButton() {
    syncLearningButtonInDocument(document);
    const pipWindow = getPIPWindow2();
    if (pipWindow)
      syncLearningButtonInDocument(pipWindow.document);
  }
  function handleLearningToggle() {
    if (!state.learningMode)
      return;
    state.learningVisible = !state.learningVisible;
    storage.set("learning-visible", state.learningVisible.toString());
    setOverlayLearningMode(isLearningActive());
    syncLearningButton();
  }
  async function handleTranslateToggle() {
    if (state.isTranslating)
      return;
    state.isEnabled = !state.isEnabled;
    storage.set("translation-enabled", state.isEnabled.toString());
    updateButtonState();
    if (state.isEnabled) {
      await translateCurrentLyrics();
    } else {
      removeTranslations();
    }
  }
  function extractLineText2(lineElement) {
    if (lineElement.classList.contains("musical-line"))
      return "";
    const words = lineElement.querySelectorAll(".word:not(.dot), .syllable, .letterGroup");
    if (words.length > 0) {
      return cleanLyricText(Array.from(words).map((w) => w.textContent || "").join(" "));
    }
    const letters = lineElement.querySelectorAll(".letter");
    if (letters.length > 0) {
      return cleanLyricText(Array.from(letters).map((l) => l.textContent || "").join(""));
    }
    return cleanLyricText(lineElement.textContent);
  }
  function getConfidentNonTargetLineIndexes(lines, targetLanguage) {
    const indexes = [];
    const targetBase = targetLanguage.toLowerCase().split("-")[0].split("_")[0];
    const targetIsLatin = !["ja", "zh", "ko", "ar", "he", "ru", "th", "hi", "el"].includes(targetBase);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line || line.trim().length === 0) {
        continue;
      }
      const trimmed = line.trim();
      const detected = detectLanguageHeuristic(trimmed);
      if (detected && detected.confidence >= 0.6 && isExcludedSourceLanguage(detected.code, state.skipLanguages)) {
        continue;
      }
      const hasNonLatin = /[\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF\u0600-\u06FF\u0590-\u05FF\u0400-\u04FF\u0E00-\u0E7F\u0900-\u097F\u0370-\u03FF]/.test(trimmed);
      if (targetIsLatin && hasNonLatin) {
        indexes.push(i);
        continue;
      }
      if (hasNonLatin && trimmed.length < 10) {
        indexes.push(i);
        continue;
      }
      if (targetIsLatin && !hasNonLatin && targetBase !== "ja") {
        const romaji = detectRomanizedJapanese(trimmed);
        if (romaji) {
          indexes.push(i);
          continue;
        }
      }
      if (!detected) {
        if (isLikelyNonTargetLine(trimmed, targetLanguage)) {
          indexes.push(i);
        }
        continue;
      }
      if (!isSameLanguage(detected.code, targetLanguage) && detected.confidence >= 0.6) {
        indexes.push(i);
      }
    }
    return indexes;
  }
  function getLyricsLines() {
    const docs = [document];
    const pip = getPIPWindow2();
    if (pip)
      docs.push(pip.document);
    const excludeSelector = ":not(.musical-line):not(.bg-line)";
    for (const doc of docs) {
      const scrollContainer = doc.querySelectorAll(`#SpicyLyricsPage .SpicyLyricsScrollContainer .line${excludeSelector}`);
      if (scrollContainer.length > 0)
        return scrollContainer;
      const lyricsContent = doc.querySelectorAll(`#SpicyLyricsPage .LyricsContent .line${excludeSelector}`);
      if (lyricsContent.length > 0)
        return lyricsContent;
      if (isSidebarLyricsActive(doc)) {
        const sidebar = findSidebarLyricsPage(doc)?.querySelectorAll(`.line${excludeSelector}`);
        if (sidebar && sidebar.length > 0)
          return sidebar;
      }
      const generic = doc.querySelectorAll(`.LyricsContent .line${excludeSelector}, .LyricsContainer .line${excludeSelector}`);
      if (generic.length > 0)
        return generic;
    }
    return document.querySelectorAll(".non-existent-selector");
  }
  function emptyLineData() {
    return {
      text: "",
      startTime: 0,
      endTime: 0,
      isInstrumental: false
    };
  }
  function hasOriginalScript(lines) {
    return Boolean(lines?.some((line) => /[\u3040-\u30FF\u4E00-\u9FFF\u3400-\u4DBF\uAC00-\uD7AF\u1100-\u11FF\u0600-\u06FF\u0590-\u05FF\u0400-\u04FF\u0E00-\u0E7F\u0900-\u097F\u0370-\u03FF]/.test(line || "")));
  }
  function resolveTranslationSourceLines(input) {
    const domLineTexts = [...input.domLineTexts];
    const cachedOriginalLines = hasOriginalScript(input.cachedSourceLines) ? [...input.cachedSourceLines] : null;
    let apiVocalTexts = input.apiVocalTexts ? [...input.apiVocalTexts] : cachedOriginalLines;
    let apiVocalLineData = input.apiVocalLineData ? [...input.apiVocalLineData] : cachedOriginalLines?.map((line) => ({ ...emptyLineData(), text: line })) || null;
    if (input.romanizationOn) {
      if (!apiVocalTexts || apiVocalTexts.length === 0) {
        return {
          canTranslate: false,
          reason: "missing-original-lyrics",
          lineTexts: [],
          useApiLines: false,
          apiVocalTexts,
          apiVocalLineData
        };
      }
      const hasOriginalText = apiVocalTexts.some((text3) => text3.trim().length > 0);
      return {
        canTranslate: hasOriginalText,
        reason: hasOriginalText ? void 0 : "missing-original-lyrics",
        lineTexts: hasOriginalText ? apiVocalTexts : [],
        useApiLines: hasOriginalText,
        apiVocalTexts,
        apiVocalLineData
      };
    }
    const useApiLines = Boolean(apiVocalTexts && apiVocalTexts.length > 0);
    const lineTexts = useApiLines ? apiVocalTexts : domLineTexts;
    return {
      canTranslate: lineTexts.some((text3) => text3.trim().length > 0),
      lineTexts,
      useApiLines,
      apiVocalTexts,
      apiVocalLineData
    };
  }
  function getLyricsFirstLineText() {
    const lines = getLyricsLines();
    if (lines.length > 0) {
      return lines[0].textContent?.trim() || null;
    }
    return null;
  }
  var LYRICS_SETTLE_DELAY_MS = 150;
  async function waitForLyricsAndTranslate(retries = 10, delay = 500, previousFirstLine, _previousTrackUri) {
    const staleLineRetryLimit = Math.max(3, Math.floor(retries / 3));
    for (let i = 0; i < retries; i++) {
      if (!isSpicyLyricsOpen() || state.isTranslating)
        return;
      const lines = getLyricsLines();
      if (lines.length > 0) {
        const firstLineText = lines[0].textContent?.trim();
        if (firstLineText && firstLineText.length > 0) {
          if (previousFirstLine && firstLineText === previousFirstLine && i < staleLineRetryLimit) {
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
          setupLyricsObserver();
          await new Promise((resolve) => setTimeout(resolve, LYRICS_SETTLE_DELAY_MS));
          await translateCurrentLyrics();
          return;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  async function translateCurrentLyrics() {
    if (state.isTranslating)
      return;
    const currentTrackUri = getCurrentTrackUri();
    const currentRomanization = isRomanizationActive();
    const romanizationChanged = lastTranslatedRomanizationState !== null && currentRomanization !== lastTranslatedRomanizationState;
    if (currentTrackUri && currentTrackUri === state.lastTranslatedSongUri && state.translatedLyrics.size > 0 && !romanizationChanged) {
      let hasRealTranslation = false;
      for (const [src, dst] of state.translatedLyrics) {
        if (src && dst && src !== dst) {
          hasRealTranslation = true;
          break;
        }
      }
      if (hasRealTranslation) {
        const lines2 = getLyricsLines();
        if (lines2.length > 0) {
          applyTranslations(lines2);
        }
        void fillVisibleGaps();
        return;
      }
      state.lastTranslatedSongUri = null;
      state.translatedLyrics.clear();
    }
    if (romanizationChanged) {
      removeTranslations();
    }
    if (isOffline()) {
      const cacheStats = getCacheStats();
      if (cacheStats.entries === 0) {
        notify({
          kind: "warning",
          key: "slt-offline",
          title: "You're offline",
          description: "Translations come back once the connection does. Songs you already translated still work.",
          inbox: false
        });
        return;
      }
    }
    let lines = getLyricsLines();
    if (lines.length === 0)
      return;
    state.isTranslating = true;
    let buttonsLoading = false;
    const phaseStart = Date.now();
    const sincePhaseStart = () => `${Date.now() - phaseStart}ms`;
    try {
      let domLineTexts = [];
      lines.forEach((line) => domLineTexts.push(extractLineText2(line)));
      const nonEmptyDomTexts = domLineTexts.filter((t) => t.trim().length > 0);
      if (nonEmptyDomTexts.length === 0) {
        return;
      }
      const currentTrackUri2 = getCurrentTrackUri();
      const romanizationOn = isRomanizationActive();
      const domLyricsKey = buildLyricsKey(nonEmptyDomTexts);
      if (matchesSkippedTranslation(currentTrackUri2, state.targetLanguage, romanizationOn, domLyricsKey)) {
        removeTranslations();
        state.lastTranslatedSongUri = currentTrackUri2;
        lastTranslatedRomanizationState = romanizationOn;
        return;
      }
      let preApiSkipCheck = null;
      if (!romanizationOn) {
        preApiSkipCheck = await shouldSkipTranslation(nonEmptyDomTexts, state.targetLanguage, currentTrackUri2 || void 0);
        if (preApiSkipCheck.detectedLanguage) {
          state.detectedLanguage = preApiSkipCheck.detectedLanguage;
        }
        if (preApiSkipCheck.skip && getConfidentNonTargetLineIndexes(domLineTexts, state.targetLanguage).length === 0) {
          removeTranslations();
          rememberSkippedTranslation(
            currentTrackUri2,
            state.targetLanguage,
            romanizationOn,
            domLyricsKey,
            domLyricsKey,
            preApiSkipCheck.detectedLanguage
          );
          if (shouldNotifySkip(currentTrackUri2, state.targetLanguage, romanizationOn)) {
            notify({ kind: "info", key: "slt-skip", title: preApiSkipCheck.reason || "Lyrics already in target language" });
          }
          return;
        }
      }
      debug(`translate: skip-check done at ${sincePhaseStart()} (detected=${state.detectedLanguage ?? "none"})`);
      setTranslateButtonsLoading(true);
      buttonsLoading = true;
      let apiLineTexts = null;
      let apiLanguage;
      let apiLineData = null;
      let cachedSourceLines = null;
      let cachedSourceLanguage;
      try {
        const apiResult = await fetchLyricsFromAPI();
        if (apiResult && apiResult.lines.length > 0) {
          apiLineTexts = apiResult.lines;
          apiLanguage = apiResult.language;
          apiLineData = apiResult.lineData;
        }
      } catch (apiErr) {
        warn("SpicyLyrics API fetch failed, falling back to DOM:", apiErr);
      }
      debug(`translate: lyrics API fetch done at ${sincePhaseStart()}`);
      if (romanizationOn && currentTrackUri2) {
        const trackCache = getTrackCache(currentTrackUri2, state.targetLanguage);
        if (trackCache?.sourceLines && hasOriginalScript(trackCache.sourceLines)) {
          cachedSourceLines = trackCache.sourceLines;
          cachedSourceLanguage = trackCache.lang;
        }
      }
      let apiVocalTexts = null;
      let apiVocalLineData = null;
      if (apiLineTexts && apiLineData) {
        apiVocalTexts = [];
        apiVocalLineData = [];
        for (let i = 0; i < apiLineData.length; i++) {
          if (!apiLineData[i].isInstrumental && apiLineTexts[i].trim().length > 0) {
            apiVocalTexts.push(apiLineTexts[i]);
            apiVocalLineData.push(apiLineData[i]);
          }
        }
      }
      let useApiLines = Boolean(apiVocalTexts && apiVocalTexts.length > 0);
      let sourceSelection = resolveTranslationSourceLines({
        domLineTexts,
        romanizationOn,
        apiVocalTexts,
        apiVocalLineData,
        cachedSourceLines
      });
      if (!sourceSelection.canTranslate) {
        removeTranslations();
        if (romanizationOn) {
          notify({
            kind: "warning",
            key: "slt-romanization-source",
            title: "Original lyrics unavailable",
            description: "Spicy Lyrics is only showing the romanized line for this song, so there is nothing to translate from.",
            inbox: false
          });
        }
        return;
      }
      apiVocalTexts = sourceSelection.apiVocalTexts;
      apiVocalLineData = sourceSelection.apiVocalLineData;
      useApiLines = sourceSelection.useApiLines;
      const lineTexts = sourceSelection.lineTexts;
      const nonEmptyTexts = lineTexts.filter((t) => t.trim().length > 0);
      if (nonEmptyTexts.length === 0) {
        return;
      }
      const sourceLyricsKey = buildLyricsKey(nonEmptyTexts);
      if (apiLanguage) {
        apiLanguage = refineChineseLanguageCode(apiLanguage, nonEmptyTexts);
      }
      const detectedLang = apiLanguage || cachedSourceLanguage || state.detectedLanguage || void 0;
      let skipCheck;
      if (romanizationOn && apiLanguage) {
        const apiLangSame = isSameLanguage(apiLanguage, state.targetLanguage);
        skipCheck = apiLangSame ? { skip: true, reason: `Lyrics already in ${apiLanguage.toUpperCase()}`, detectedLanguage: apiLanguage } : { skip: false, detectedLanguage: apiLanguage };
      } else if (romanizationOn) {
        skipCheck = { skip: false, detectedLanguage: "unknown" };
      } else if (apiLanguage && apiLanguage !== "unknown") {
        const apiLangSame = isSameLanguage(apiLanguage, state.targetLanguage);
        if (apiLangSame) {
          skipCheck = { skip: true, reason: `Lyrics already in ${apiLanguage.toUpperCase()}`, detectedLanguage: apiLanguage };
        } else {
          skipCheck = { skip: false, detectedLanguage: apiLanguage };
        }
      } else {
        skipCheck = preApiSkipCheck || await shouldSkipTranslation(nonEmptyTexts, state.targetLanguage, currentTrackUri2 || void 0);
      }
      if (skipCheck.detectedLanguage)
        state.detectedLanguage = skipCheck.detectedLanguage;
      const sourceLanguage = skipCheck.detectedLanguage || state.detectedLanguage;
      if (!skipCheck.skip && sourceLanguage && isExcludedSourceLanguage(sourceLanguage, state.skipLanguages)) {
        removeTranslations();
        state.lastTranslatedSongUri = currentTrackUri2;
        lastTranslatedRomanizationState = romanizationOn;
        if (shouldNotifySkip(currentTrackUri2, state.targetLanguage, romanizationOn)) {
          notify({
            kind: "info",
            key: "slt-skip",
            title: `Not translating ${getLanguageName(sourceLanguage)}`,
            description: "It's on your Don't Translate list."
          });
        }
        return;
      }
      let translations;
      if (skipCheck.skip) {
        if (matchesSkippedTranslation(currentTrackUri2, state.targetLanguage, romanizationOn, sourceLyricsKey)) {
          removeTranslations();
          state.lastTranslatedSongUri = currentTrackUri2;
          lastTranslatedRomanizationState = romanizationOn;
          return;
        }
        const nonTargetIndexes = getConfidentNonTargetLineIndexes(lineTexts, state.targetLanguage);
        const classifiableLineCount = lineTexts.filter((line) => {
          const trimmed = (line || "").trim();
          return trimmed.length > 0 && !/^[♪♫•\-–—\s]+$/.test(trimmed);
        }).length;
        const nonTargetDominates = classifiableLineCount > 0 && nonTargetIndexes.length >= Math.max(2, Math.ceil(classifiableLineCount * 0.35));
        if (nonTargetDominates) {
          translations = await translateLyrics(
            lineTexts,
            state.targetLanguage,
            currentTrackUri2 || void 0,
            void 0
          );
        } else if (nonTargetIndexes.length === 0) {
          removeTranslations();
          state.isTranslating = false;
          rememberSkippedTranslation(
            currentTrackUri2,
            state.targetLanguage,
            romanizationOn,
            sourceLyricsKey,
            domLyricsKey,
            skipCheck.detectedLanguage
          );
          restoreButtonState();
          if (shouldNotifySkip(currentTrackUri2, state.targetLanguage, romanizationOn)) {
            notify({ kind: "info", key: "slt-skip", title: skipCheck.reason || "Lyrics already in target language" });
          }
          return;
        } else {
          const partialLines = nonTargetIndexes.map((index) => lineTexts[index]);
          const partialTranslations = await translateLyrics(
            partialLines,
            state.targetLanguage,
            void 0,
            void 0
          );
          const translatedByIndex = /* @__PURE__ */ new Map();
          partialTranslations.forEach((result, idx) => {
            translatedByIndex.set(nonTargetIndexes[idx], {
              translatedText: result.translatedText,
              source: result.source,
              apiProvider: result.apiProvider
            });
          });
          translations = lineTexts.map((line, index) => {
            const partial = translatedByIndex.get(index);
            const translatedText = partial?.translatedText || line;
            const wasTranslated = translatedByIndex.has(index) && translatedText !== line;
            return {
              originalText: line,
              translatedText,
              targetLanguage: state.targetLanguage,
              wasTranslated,
              source: partial?.source,
              apiProvider: partial?.apiProvider,
              detectedLanguage: state.detectedLanguage || void 0
            };
          });
        }
      } else {
        translations = await translateLyrics(lineTexts, state.targetLanguage, currentTrackUri2 || void 0, state.detectedLanguage || void 0);
      }
      if (currentTrackUri2 && getCurrentTrackUri() !== currentTrackUri2) {
        return;
      }
      debug(`translate: provider done at ${sincePhaseStart()}`);
      const hasMeaningfulTranslation = translations.some(
        (result) => result.wasTranslated && normalizeForComparison(result.originalText) !== normalizeForComparison(result.translatedText)
      );
      const sameLanguagePassthrough = !hasMeaningfulTranslation && translations.some(
        (result) => result.detectedLanguage && isSameLanguage(result.detectedLanguage, state.targetLanguage)
      );
      if (sameLanguagePassthrough) {
        removeTranslations();
        rememberSkippedTranslation(
          currentTrackUri2,
          state.targetLanguage,
          romanizationOn,
          sourceLyricsKey,
          domLyricsKey,
          translations.find((result) => result.detectedLanguage)?.detectedLanguage
        );
        return;
      }
      lastSkippedTranslation = null;
      lastSkipNotifyKey = null;
      state.translatedLyrics.clear();
      const translationByContent2 = /* @__PURE__ */ new Map();
      const qualityByContent2 = /* @__PURE__ */ new Map();
      const romanizationByContent2 = /* @__PURE__ */ new Map();
      const originalByContent2 = /* @__PURE__ */ new Map();
      translations.forEach((result, index) => {
        const source = lineTexts[index];
        const lineData = useApiLines && apiVocalLineData ? apiVocalLineData[index] : void 0;
        const translated = result.translatedText;
        const sourceNorm = normalizeMatchKey(source);
        const romNorm = normalizeMatchKey(lineData?.romanizedText);
        if (source && source.trim()) {
          state.translatedLyrics.set(source, translated);
          if (sourceNorm)
            translationByContent2.set(sourceNorm, translated);
        }
        if (lineData?.romanizedText && lineData.romanizedText.trim()) {
          state.translatedLyrics.set(lineData.romanizedText, translated);
          if (romNorm)
            translationByContent2.set(romNorm, translated);
        }
        if (result.wasTranslated) {
          const meta = {
            source: result.source || "api",
            api: result.apiProvider || state.preferredApi,
            detectedLanguage: state.detectedLanguage || result.detectedLanguage || void 0
          };
          for (const norm of [sourceNorm, romNorm]) {
            if (norm)
              qualityByContent2.set(norm, meta);
          }
        }
        if (lineData) {
          const romanized = lineData.romanizedText || "";
          const original = lineData.text || "";
          for (const norm of [sourceNorm, romNorm, normalizeMatchKey(lineData.text)]) {
            if (!norm)
              continue;
            if (romanized.trim())
              romanizationByContent2.set(norm, romanized);
            if (original.trim())
              originalByContent2.set(norm, original);
          }
        }
      });
      state.lastTranslatedSongUri = currentTrackUri2;
      lastTranslatedRomanizationState = romanizationOn;
      let timingDataForOverlay = null;
      if (useApiLines && apiVocalLineData) {
        timingDataForOverlay = apiVocalLineData;
      } else if (apiLineData) {
        timingDataForOverlay = apiLineData;
      }
      if (timingDataForOverlay) {
        setLineTimingData(timingDataForOverlay);
      }
      if (apiVocalLineData) {
        for (const lineData of apiVocalLineData) {
          if (!lineData)
            continue;
          const romanized = lineData.romanizedText || "";
          const original = lineData.text || "";
          for (const key of [lineData.text, lineData.romanizedText]) {
            const norm = normalizeMatchKey(key);
            if (!norm)
              continue;
            if (romanized.trim())
              romanizationByContent2.set(norm, romanized);
            if (original.trim())
              originalByContent2.set(norm, original);
          }
        }
      }
      if (apiLineData) {
        for (const lineData of apiLineData) {
          if (!lineData)
            continue;
          const romanized = lineData.romanizedText || "";
          const original = lineData.text || "";
          for (const key of [lineData.text, lineData.romanizedText]) {
            const norm = normalizeMatchKey(key);
            if (!norm)
              continue;
            if (romanized.trim() && !romanizationByContent2.has(norm))
              romanizationByContent2.set(norm, romanized);
            if (original.trim() && !originalByContent2.has(norm))
              originalByContent2.set(norm, original);
          }
        }
      }
      const timingByContent2 = /* @__PURE__ */ new Map();
      const addTimingByContent = (data) => {
        if (!data)
          return;
        for (const ld of data) {
          if (!ld)
            continue;
          for (const key of [ld.text, ld.romanizedText]) {
            const norm = normalizeMatchKey(key);
            if (norm && !timingByContent2.has(norm))
              timingByContent2.set(norm, ld);
          }
        }
      };
      addTimingByContent(apiVocalLineData);
      addTimingByContent(apiLineData);
      setTranslationContentData(translationByContent2);
      setRomanizationContentData(romanizationByContent2);
      setOriginalContentData(originalByContent2);
      setQualityContentData(qualityByContent2);
      setTimingContentData(timingByContent2);
      contentTranslation = translationByContent2;
      contentQuality = qualityByContent2;
      coveredKeys = new Set(translationByContent2.keys());
      const buildIndexMapsForLines = (targetLines) => {
        const translationsByIdx = /* @__PURE__ */ new Map();
        const qualityByIdx = /* @__PURE__ */ new Map();
        const romanizationByIdx = /* @__PURE__ */ new Map();
        const originalByIdx = /* @__PURE__ */ new Map();
        const targetArr = Array.from(targetLines);
        const allowIndexFallback = targetArr.length === translations.length;
        targetArr.forEach((line, domIdx) => {
          const domText = extractLineText2(line);
          if (!domText)
            return;
          const matchKeys = buildMatchKeys(domText);
          let translation = lookupWithKeys(translationByContent2, matchKeys);
          if (!translation && allowIndexFallback && translations[domIdx]) {
            translation = translations[domIdx].translatedText;
          }
          if (translation)
            translationsByIdx.set(domIdx, translation);
          let meta = lookupWithKeys(qualityByContent2, matchKeys);
          if (!meta && allowIndexFallback) {
            const result = translations[domIdx];
            if (result?.wasTranslated) {
              meta = {
                source: result.source || "api",
                api: result.apiProvider || state.preferredApi,
                detectedLanguage: state.detectedLanguage || result.detectedLanguage || void 0
              };
            }
          }
          if (meta)
            qualityByIdx.set(domIdx, meta);
          let rom = lookupWithKeys(romanizationByContent2, matchKeys);
          if (!rom && allowIndexFallback && apiVocalLineData && apiVocalLineData[domIdx]?.romanizedText) {
            rom = apiVocalLineData[domIdx].romanizedText;
          }
          if (rom)
            romanizationByIdx.set(domIdx, rom);
          let orig = lookupWithKeys(originalByContent2, matchKeys);
          if (!orig && allowIndexFallback && apiVocalLineData && apiVocalLineData[domIdx]?.text) {
            orig = apiVocalLineData[domIdx].text;
          }
          if (orig)
            originalByIdx.set(domIdx, orig);
        });
        state._translationsByIndex = translationsByIdx;
        state._qualityByIndex = qualityByIdx;
        setRomanizationData(romanizationByIdx);
        setOriginalTextData(originalByIdx);
      };
      buildIndexMapsForLines(lines);
      const freshLines = getLyricsLines();
      if (currentTrackUri2 && getCurrentTrackUri() !== currentTrackUri2) {
        return;
      }
      const useFresh = freshLines.length > 0;
      if (useFresh && freshLines !== lines) {
        buildIndexMapsForLines(freshLines);
      }
      if (useFresh) {
        applyTranslations(freshLines);
      } else {
        applyTranslations(lines);
      }
      debug(`translate: first render at ${sincePhaseStart()}`);
      scheduleTranslationReapply(currentTrackUri2);
      void fillVisibleGaps();
      dismissNotification("slt-translate-failed");
      const notif = buildTranslationNotification(translations, currentTrackUri2, state.targetLanguage);
      if (notif && state.showTranslatedNotice)
        notify({ kind: "success", key: "slt-translated", title: notif });
    } catch (err) {
      error("Translation failed:", err);
      notify({
        kind: "error",
        key: "slt-translate-failed",
        title: "Couldn't translate this song",
        description: err instanceof Error && err.message ? err.message : "The translation service did not answer.",
        actions: [{ label: "Try again", primary: true, onClick: () => {
          forceRetranslate();
        } }]
      });
      setButtonErrorState(true);
      setTimeout(() => setButtonErrorState(false), 3e3);
    } finally {
      state.isTranslating = false;
      if (buttonsLoading) {
        restoreButtonState();
      }
    }
  }
  function normalizeForComparison(text3) {
    return (text3 || "").toLowerCase().replace(/[\s\p{P}\u200B-\u200D\u2060\uFEFF]+/gu, "").trim();
  }
  function formatNotificationDuration(ms) {
    if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0)
      return "";
    if (ms < 1e3)
      return `${Math.round(ms)}ms`;
    const s = ms / 1e3;
    if (s < 60)
      return `${s.toFixed(1)}s`;
    const m = Math.floor(s / 60);
    return `${m}m ${Math.round(s - m * 60)}s`;
  }
  function formatNotificationTokens(n) {
    if (typeof n !== "number" || !Number.isFinite(n) || n <= 0)
      return "";
    if (n < 1e3)
      return `${n} tok`;
    if (n < 1e6)
      return `${(n / 1e3).toFixed(n < 1e4 ? 1 : 0)}k tok`;
    return `${(n / 1e6).toFixed(2)}M tok`;
  }
  function formatProviderName(api) {
    if (!api)
      return "";
    switch (api) {
      case "google":
        return "Google";
      case "libretranslate":
        return "LibreTranslate";
      case "deepl":
        return "DeepL";
      case "openai":
        return "OpenAI";
      case "gemini":
        return "Gemini";
      case "grok":
        return "Grok";
      case "anthropic":
        return "Claude";
      case "custom":
        return "Custom";
      default:
        return api;
    }
  }
  function formatLanguageLabel(code) {
    const normalized = (code || "").trim();
    if (!normalized)
      return "";
    const lower = normalized.toLowerCase();
    if (lower === "unknown" || lower === "auto")
      return "";
    const supported = SUPPORTED_LANGUAGES.find((language) => language.code.toLowerCase() === lower);
    if (supported)
      return supported.name;
    return getLanguageName(normalized);
  }
  function formatLanguagePair(sourceCode, targetCode) {
    const target = formatLanguageLabel(targetCode);
    if (!target)
      return "Translated";
    const source = formatLanguageLabel(sourceCode);
    if (source && source !== target)
      return `${source} \u2192 ${target}`;
    return `Translated to ${target}`;
  }
  function formatProviderWithModel(providerLabel, model) {
    if (!providerLabel)
      return "";
    const trimmed = (model || "").trim();
    if (!trimmed)
      return providerLabel;
    const shortModel = trimmed.toLowerCase().startsWith(providerLabel.toLowerCase()) ? trimmed.slice(providerLabel.length).replace(/^[\s._/-]+/, "") : trimmed;
    return shortModel ? `${providerLabel} (${shortModel})` : providerLabel;
  }
  function buildTranslationNotification(translations, trackUri, targetLang) {
    const someTranslated = translations.some((t) => t.wasTranslated === true);
    if (!someTranslated)
      return null;
    const cacheEntry = trackUri ? getTrackCache(trackUri, targetLang) : null;
    const fromApi = translations.some((t) => t.wasTranslated === true && t.source === "api");
    const providerLabel = formatProviderName(translations.find((t) => t.apiProvider)?.apiProvider || cacheEntry?.api);
    const detectedLanguage = translations.find((t) => formatLanguageLabel(t.detectedLanguage))?.detectedLanguage;
    const parts = [formatLanguagePair(detectedLanguage || cacheEntry?.lang, targetLang)];
    if (!fromApi) {
      parts.push("Cached");
      if (providerLabel)
        parts.push(providerLabel);
      return parts.join(" \xB7 ");
    }
    const metrics = cacheEntry?.metrics;
    const provider = formatProviderWithModel(providerLabel, metrics?.model);
    if (provider)
      parts.push(provider);
    const duration = formatNotificationDuration(metrics?.durationMs);
    if (duration)
      parts.push(duration);
    const tokens = formatNotificationTokens(metrics?.totalTokens);
    if (tokens)
      parts.push(tokens);
    return parts.join(" \xB7 ");
  }
  function looseLatinSkeleton(text3) {
    return (text3 || "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  }
  function resolveOverlayMode() {
    if (state.overlayMode === "interleaved" && state.replaceScriptConversions && isChineseScriptConversion(state.detectedLanguage, state.targetLanguage)) {
      return "replace";
    }
    return state.overlayMode;
  }
  function applyTranslations(lines) {
    const translationMapByIndex = /* @__PURE__ */ new Map();
    lines.forEach((line, index) => {
      const originalText = extractLineText2(line);
      let translatedText = state._translationsByIndex?.get(index);
      if (!translatedText) {
        translatedText = state.translatedLyrics.get(originalText);
      }
      if (!translatedText)
        return;
      if (translatedText === originalText)
        return;
      if (normalizeForComparison(translatedText) === normalizeForComparison(originalText))
        return;
      const bothLatin = /^[\p{Script=Latin}\p{N}\s\p{P}]+$/u.test(originalText) && /^[\p{Script=Latin}\p{N}\s\p{P}]+$/u.test(translatedText);
      if (bothLatin && looseLatinSkeleton(translatedText) === looseLatinSkeleton(originalText)) {
        return;
      }
      translationMapByIndex.set(index, translatedText);
    });
    const overlaySettings = {
      mode: resolveOverlayMode(),
      syncWordHighlight: state.syncWordHighlight,
      showRomanization: state.showRomanization,
      learningMode: isLearningActive()
    };
    if (!isOverlayActive()) {
      enableOverlay(overlaySettings);
    } else {
      updateOverlayConfig(overlaySettings);
    }
    if (state._qualityByIndex) {
      setQualityMetadata(state._qualityByIndex);
    }
    updateOverlayContent(translationMapByIndex);
    debug(`applyTranslations: matched ${translationMapByIndex.size}/${lines.length} DOM lines`);
    return translationMapByIndex.size;
  }
  function clearReapplyTimers() {
    for (const timer of reapplyTimers) {
      clearTimeout(timer);
    }
    reapplyTimers = [];
  }
  function reapplyTranslationsToCurrentLines(trackUri) {
    if (!state.isEnabled || state.isTranslating)
      return;
    if (trackUri && getCurrentTrackUri() !== trackUri)
      return;
    if (state.translatedLyrics.size === 0 && contentTranslation.size === 0)
      return;
    const lines = getLyricsLines();
    if (lines.length === 0)
      return;
    applyTranslations(lines);
  }
  var REAPPLY_DELAYS_MS = [60, 200, 500, 1e3, 1800, 3e3, 5e3];
  function scheduleTranslationReapply(trackUri) {
    clearReapplyTimers();
    for (const delay of REAPPLY_DELAYS_MS) {
      reapplyTimers.push(setTimeout(() => reapplyTranslationsToCurrentLines(trackUri), delay));
    }
  }
  async function fillVisibleGaps() {
    if (!state.isEnabled || state.isTranslating || fillGapsInFlight)
      return;
    if (isRomanizationActive())
      return;
    if (coveredKeys.size === 0 && contentTranslation.size === 0)
      return;
    const lines = getLyricsLines();
    if (lines.length === 0)
      return;
    const missing = [];
    const missingKeys = /* @__PURE__ */ new Set();
    lines.forEach((line) => {
      const text3 = extractLineText2(line);
      if (!text3 || !text3.trim())
        return;
      if (/^[♪♫•\-–—\s]+$/.test(text3.trim()))
        return;
      const key = normalizeMatchKey(text3);
      if (!key || coveredKeys.has(key) || missingKeys.has(key))
        return;
      missingKeys.add(key);
      missing.push(text3);
    });
    if (missing.length === 0)
      return;
    debug(`fillVisibleGaps: ${missing.length} uncovered DOM lines, requesting translation`);
    const gapsStart = Date.now();
    fillGapsInFlight = true;
    try {
      const currentTrackUri = getCurrentTrackUri();
      const results = await translateLyrics(missing, state.targetLanguage, currentTrackUri || void 0, state.detectedLanguage || void 0, true);
      if (currentTrackUri && getCurrentTrackUri() !== currentTrackUri)
        return;
      let added = false;
      results.forEach((result, i) => {
        const source = missing[i];
        const key = normalizeMatchKey(source);
        if (!key)
          return;
        coveredKeys.add(key);
        const translated = result.translatedText;
        if (source.trim())
          state.translatedLyrics.set(source, translated);
        contentTranslation.set(key, translated);
        if (result.wasTranslated) {
          contentQuality.set(key, {
            source: result.source || "api",
            api: result.apiProvider || state.preferredApi,
            detectedLanguage: state.detectedLanguage || result.detectedLanguage || void 0
          });
        }
        added = true;
      });
      if (added) {
        setTranslationContentData(contentTranslation);
        setQualityContentData(contentQuality);
        const fresh = getLyricsLines();
        if (fresh.length > 0)
          applyTranslations(fresh);
      }
      debug(`fillVisibleGaps: completed in ${Date.now() - gapsStart}ms`);
    } catch (err) {
      warn("Failed to fill visible translation gaps:", err);
    } finally {
      fillGapsInFlight = false;
    }
  }
  function forceRetranslate() {
    lastSkippedTranslation = null;
    lastSkipNotifyKey = null;
    lastTranslatedRomanizationState = null;
    state.lastTranslatedSongUri = null;
    state.translatedLyrics.clear();
    state._translationsByIndex = void 0;
    state._qualityByIndex = void 0;
    removeTranslations();
    if (state.isEnabled) {
      translateCurrentLyrics();
    }
  }
  function removeTranslations() {
    clearReapplyTimers();
    if (isOverlayActive())
      disableOverlay();
    contentTranslation = /* @__PURE__ */ new Map();
    contentQuality = /* @__PURE__ */ new Map();
    coveredKeys = /* @__PURE__ */ new Set();
    const docs = [document];
    const pip = getPIPWindow2();
    if (pip)
      docs.push(pip.document);
    docs.forEach((doc) => {
      doc.querySelectorAll("[data-slt-original-html]").forEach((el2) => {
        const original = el2.dataset.sltOriginalHtml;
        if (original !== void 0) {
          el2.innerHTML = original;
          delete el2.dataset.sltOriginalHtml;
        }
      });
      doc.querySelectorAll("[data-slt-original-text]").forEach((el2) => {
        const original = el2.dataset.sltOriginalText;
        if (original !== void 0) {
          el2.textContent = original;
          delete el2.dataset.sltOriginalText;
        }
      });
      doc.querySelectorAll("[data-slt-replaced-with]").forEach((el2) => {
        delete el2.dataset.sltReplacedWith;
      });
      doc.querySelectorAll(".slt-replace-line").forEach((el2) => el2.remove());
      doc.querySelectorAll(".slt-replace-hidden").forEach((el2) => el2.classList.remove("slt-replace-hidden"));
      doc.querySelectorAll(".spicy-translation-container").forEach((el2) => el2.remove());
      doc.querySelectorAll(".slt-interleaved-translation").forEach((el2) => el2.remove());
      doc.querySelectorAll(".spicy-hidden-original").forEach((el2) => el2.classList.remove("spicy-hidden-original"));
      doc.querySelectorAll(".spicy-translated").forEach((el2) => el2.classList.remove("spicy-translated"));
      doc.querySelectorAll(".spicy-original-wrapper").forEach((wrapper) => {
        const parent = wrapper.parentElement;
        if (parent) {
          const originalContent = wrapper.innerHTML;
          wrapper.remove();
          if (parent.innerHTML.trim() === "")
            parent.innerHTML = originalContent;
        }
      });
    });
    state.translatedLyrics.clear();
    state._translationsByIndex = void 0;
    state._qualityByIndex = void 0;
  }
  function setupLyricsObserver() {
    if (lyricsObserver) {
      lyricsObserver.disconnect();
      lyricsObserver = null;
    }
    const lyricsContent = getLyricsContent();
    if (!lyricsContent)
      return;
    observedLyricsContent = lyricsContent;
    try {
      const hasLyricLineNode = (node) => {
        if (node.nodeType !== Node.ELEMENT_NODE)
          return false;
        const el2 = node;
        return el2.classList?.contains("line") || Boolean(el2.querySelector?.(".line"));
      };
      lyricsObserver = new MutationObserver((mutations) => {
        if (!state.isEnabled || state.isTranslating)
          return;
        const hasNewContent = mutations.some(
          (m) => m.type === "childList" && m.addedNodes.length > 0 && Array.from(m.addedNodes).some(hasLyricLineNode)
        );
        if (!hasNewContent || state.isTranslating)
          return;
        const alreadyTranslated = state.translatedLyrics.size > 0 && state.lastTranslatedSongUri === getCurrentTrackUri();
        if (alreadyTranslated) {
          if (rerenderDebounceTimer)
            clearTimeout(rerenderDebounceTimer);
          rerenderDebounceTimer = setTimeout(() => {
            rerenderDebounceTimer = null;
            if (state.isTranslating)
              return;
            const lines = getLyricsLines();
            if (lines.length > 0)
              applyTranslations(lines);
            void fillVisibleGaps();
          }, 200);
        } else if (state.autoTranslate) {
          if (translateDebounceTimer)
            clearTimeout(translateDebounceTimer);
          translateDebounceTimer = setTimeout(() => {
            translateDebounceTimer = null;
            if (!state.isTranslating) {
              if (!state.isEnabled) {
                state.isEnabled = true;
                storage.set("translation-enabled", "true");
                updateButtonState();
              }
              translateCurrentLyrics();
            }
          }, 500);
        }
      });
      lyricsObserver.observe(lyricsContent, {
        childList: true,
        subtree: true
      });
    } catch (e) {
      warn("Failed to setup Lyrics observer:", e);
    }
  }
  async function onSpicyLyricsOpen() {
    let viewControls = await waitForElement("#SpicyLyricsPage .ViewControls", 3e3);
    if (!viewControls && isSidebarLyricsActive()) {
      viewControls = await waitForElement("#SpicyLyricsNPVCard #SpicyLyricsPage .ViewControls, :is(.Root__right-sidebar, #Desktop_PanelContainer_Id) #SpicyLyricsPage .ViewControls", 2e3);
    }
    if (!viewControls)
      viewControls = await waitForElement(".ViewControls", 2e3);
    if (viewControls)
      insertTranslateButton();
    resumeActiveSync();
    setupLyricsObserver();
    setupRomanizationWatcher();
    const pipWindow = getPIPWindow2();
    if (pipWindow) {
      setTimeout(() => {
        insertTranslateButtonIntoDocument(pipWindow.document);
        syncLearningButtonInDocument(pipWindow.document);
      }, 500);
    }
    if (state.isEnabled) {
      updateButtonState();
      state.lastTranslatedSongUri = null;
      waitForLyricsAndTranslate(50, 250);
    } else if (state.autoTranslate) {
      state.isEnabled = true;
      storage.set("translation-enabled", "true");
      updateButtonState();
      waitForLyricsAndTranslate(50, 250);
    }
  }
  function onSpicyLyricsClose() {
    if (translateDebounceTimer) {
      clearTimeout(translateDebounceTimer);
      translateDebounceTimer = null;
    }
    if (rerenderDebounceTimer) {
      clearTimeout(rerenderDebounceTimer);
      rerenderDebounceTimer = null;
    }
    clearReapplyTimers();
    pauseActiveSync();
    state.isTranslating = false;
    if (lyricsObserver) {
      lyricsObserver.disconnect();
      lyricsObserver = null;
    }
    observedLyricsContent = null;
    lastKnownRomanizationState = null;
    lastTranslatedRomanizationState = null;
    cleanupRomanizationWatcher();
  }
  function setupRomanizationWatcher() {
    cleanupRomanizationWatcher();
    const handler = () => {
      setTimeout(async () => {
        if (state.isEnabled) {
          for (let i = 0; i < 20 && state.isTranslating; i++) {
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
          removeTranslations();
          setupLyricsObserver();
          state.lastTranslatedSongUri = null;
          await waitForLyricsAndTranslate(40, 250);
        }
      }, 1200);
    };
    const btn = document.querySelector("#RomanizationToggle");
    if (btn) {
      btn.addEventListener("click", handler);
      romanizationToggleListener = handler;
      romanizationToggleButton = btn;
    }
  }
  function cleanupRomanizationWatcher() {
    if (romanizationToggleListener) {
      if (romanizationToggleButton) {
        romanizationToggleButton.removeEventListener("click", romanizationToggleListener);
      }
      romanizationToggleListener = null;
      romanizationToggleButton = null;
    }
  }
  var requestedBreakdowns = /* @__PURE__ */ new Set();
  var failedBreakdowns = /* @__PURE__ */ new Map();
  var BREAKDOWN_RETRY_MS = 6e4;
  function requestBreakdown(sourceText, onReady) {
    const key = `${state.targetLanguage}:${sourceText}`;
    if (requestedBreakdowns.has(key))
      return;
    const failedAt = failedBreakdowns.get(key);
    if (failedAt && Date.now() - failedAt < BREAKDOWN_RETRY_MS)
      return;
    requestedBreakdowns.add(key);
    const trackUri = getCurrentTrackUri();
    void fetchWordBreakdown(sourceText, state.detectedLanguage || void 0, state.targetLanguage).then((tokens) => {
      if (!tokens) {
        failedBreakdowns.set(key, Date.now());
        return;
      }
      failedBreakdowns.delete(key);
      if (onReady && getCurrentTrackUri() === trackUri)
        onReady();
    }).catch(() => {
      failedBreakdowns.set(key, Date.now());
    }).finally(() => {
      requestedBreakdowns.delete(key);
    });
  }
  function registerBreakdownLookup() {
    setBreakdownLookup((sourceText) => {
      if (!isLearningActive())
        return null;
      setLearningTargetLanguage(state.targetLanguage);
      setLearningSourceLanguage(state.detectedLanguage || "");
      const cached = getCachedWordBreakdown(sourceText, state.targetLanguage);
      if (cached)
        return cached;
      if (!providerSupportsWordBreakdown())
        return null;
      requestBreakdown(sourceText, invalidateLearningRow);
      return null;
    });
    setBreakdownPrefetch((sourceTexts) => {
      if (!isLearningActive() || !providerSupportsWordBreakdown())
        return;
      for (const sourceText of sourceTexts) {
        if (getCachedWordBreakdown(sourceText, state.targetLanguage))
          continue;
        requestBreakdown(sourceText);
      }
    });
  }
  function setupViewModeObserver() {
    registerBreakdownLookup();
    if (viewModeIntervalId)
      clearInterval(viewModeIntervalId);
    viewModeIntervalId = setInterval(() => {
      const isOpen = isSpicyLyricsOpen();
      if (isOpen) {
        if (!document.querySelector("#TranslateToggle")) {
          insertTranslateButton();
        } else {
          syncLearningButton();
        }
        if (romanizationToggleButton && !romanizationToggleButton.isConnected) {
          romanizationToggleListener = null;
          romanizationToggleButton = null;
        }
        if (!romanizationToggleListener && document.querySelector("#RomanizationToggle")) {
          setupRomanizationWatcher();
        }
        const observedContentReplaced = Boolean(observedLyricsContent && !observedLyricsContent.isConnected);
        if (observedContentReplaced) {
          if (lyricsObserver) {
            lyricsObserver.disconnect();
            lyricsObserver = null;
          }
          observedLyricsContent = null;
        }
        if (!lyricsObserver && state.isEnabled) {
          setupLyricsObserver();
          if (observedContentReplaced)
            reapplyTranslationsToCurrentLines();
        }
        const currentRomanization = isRomanizationActive();
        if (lastKnownRomanizationState !== null && currentRomanization !== lastKnownRomanizationState) {
          if (state.isEnabled) {
            if (!state.isTranslating) {
              removeTranslations();
              setupLyricsObserver();
              state.lastTranslatedSongUri = null;
              waitForLyricsAndTranslate(40, 250);
            }
          }
        }
        lastKnownRomanizationState = currentRomanization;
        const pipWindow = getPIPWindow2();
        if (pipWindow && !pipWindow.document.querySelector("#TranslateToggle")) {
          insertTranslateButtonIntoDocument(pipWindow.document);
        }
        if (pipWindow)
          syncLearningButtonInDocument(pipWindow.document);
      }
    }, 2e3);
  }
  function setupKeyboardShortcut() {
    document.addEventListener("keydown", (e) => {
      if (e.altKey && !e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        e.stopPropagation();
        if (isSpicyLyricsOpen())
          handleTranslateToggle();
      }
    });
  }

  // src/utils/modal.ts
  var legacy = null;
  function hideModal() {
    topSurface()?.close();
  }
  function displayModal(options) {
    const content = typeof options.content === "string" ? Object.assign(document.createElement("div"), { innerHTML: options.content }) : options.content;
    if (legacy && !legacy.closed && topSurface() === legacy)
      legacy.close({ silent: true });
    legacy = openDialog({
      title: options.title,
      content,
      size: options.size || (options.isLarge ? "lg" : "md"),
      className: "slt-legacy-dialog",
      onClose: options.onClose || void 0
    });
    return legacy;
  }

  // src/utils/connectivity.ts
  var API_BASE = "https://7xeh.dev/apps/spicylyrictranslate/api/connectivity.php";
  var CLIENT_ID_KEY = "client-id";
  var CLIENT_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  function createUuid() {
    if (crypto.randomUUID) {
      return crypto.randomUUID();
    }
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = bytes[6] & 15 | 64;
    bytes[8] = bytes[8] & 63 | 128;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
    return [
      hex.slice(0, 4).join(""),
      hex.slice(4, 6).join(""),
      hex.slice(6, 8).join(""),
      hex.slice(8, 10).join(""),
      hex.slice(10, 16).join("")
    ].join("-");
  }
  function getOrCreateClientId() {
    let clientId = storage.get(CLIENT_ID_KEY);
    if (!clientId || !CLIENT_ID_REGEX.test(clientId)) {
      clientId = createUuid();
      storage.set(CLIENT_ID_KEY, clientId);
    }
    return clientId;
  }
  var HEARTBEAT_INTERVAL = 3e4;
  var LATENCY_CHECK_INTERVAL = 15e3;
  var CONNECTION_TIMEOUT = 5e3;
  var INITIAL_DELAY = 3e3;
  var LATENCY_SAMPLES = 3;
  var SAMPLE_DELAY = 500;
  var LATENCY_THRESHOLDS = {
    GREAT: 150,
    OK: 300,
    BAD: 500
  };
  var indicatorState = {
    state: "disconnected",
    sessionId: null,
    latencyMs: null,
    totalUsers: 0,
    region: "",
    lastHeartbeat: 0,
    isInitialized: false
  };
  var heartbeatInterval = null;
  var latencyInterval = null;
  var containerElement = null;
  var indicatorHidden = false;
  function applyIndicatorVisibility() {
    if (containerElement) {
      containerElement.style.display = indicatorHidden ? "none" : "";
    }
  }
  function setConnectionIndicatorHidden(hidden) {
    indicatorHidden = hidden;
    applyIndicatorVisibility();
  }
  function getLatencyClass(latencyMs) {
    if (latencyMs <= LATENCY_THRESHOLDS.GREAT)
      return "slt-ci-great";
    if (latencyMs <= LATENCY_THRESHOLDS.OK)
      return "slt-ci-ok";
    if (latencyMs <= LATENCY_THRESHOLDS.BAD)
      return "slt-ci-bad";
    return "slt-ci-horrible";
  }
  function formatUserCount(count) {
    if (!count || count < 0)
      return "0";
    if (count < 1e3)
      return String(count);
    if (count < 1e6) {
      const k = count / 1e3;
      return `${k >= 100 ? Math.round(k) : Math.round(k * 10) / 10}K`;
    }
    return `${Math.round(count / 1e6 * 10) / 10}M`;
  }
  function setLabel(button, text3) {
    button.setAttribute("aria-label", text3);
    button.setAttribute("title", text3);
  }
  function createIndicatorElement() {
    const container = document.createElement("div");
    container.className = "SLT_ConnectionIndicator";
    container.innerHTML = `
        <div class="slt-ci-button" aria-label="Connection Status">
            <span class="slt-ci-dot"></span>
            <div class="slt-ci-meta">
                <span class="slt-ci-ping" aria-label="Round-trip latency to SLT server">--ms</span>
                <span class="slt-ci-sep"></span>
                <span class="slt-ci-users-count slt-ci-total" aria-label="Total users with extension installed">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    <span class="slt-ci-total-count">0</span>
                </span>
            </div>
        </div>
    `;
    return container;
  }
  function updateUI() {
    if (!containerElement)
      return;
    applyIndicatorVisibility();
    const button = containerElement.querySelector(".slt-ci-button");
    const dot = containerElement.querySelector(".slt-ci-dot");
    const pingEl = containerElement.querySelector(".slt-ci-ping");
    const totalCountEl = containerElement.querySelector(".slt-ci-total-count");
    if (!button || !dot)
      return;
    dot.classList.remove("slt-ci-connecting", "slt-ci-connected", "slt-ci-error", "slt-ci-great", "slt-ci-ok", "slt-ci-bad", "slt-ci-horrible");
    switch (indicatorState.state) {
      case "connected": {
        dot.classList.add("slt-ci-connected");
        const latencyClass2 = indicatorState.latencyMs !== null ? getLatencyClass(indicatorState.latencyMs) : "";
        if (indicatorState.latencyMs !== null) {
          dot.classList.add(latencyClass2);
          if (pingEl) {
            pingEl.textContent = `${indicatorState.latencyMs}ms`;
            pingEl.className = `slt-ci-ping ${latencyClass2}`;
          }
        }
        if (totalCountEl)
          totalCountEl.textContent = formatUserCount(indicatorState.totalUsers);
        const ping = indicatorState.latencyMs !== null ? `${indicatorState.latencyMs}ms` : "measuring\u2026";
        setLabel(button, `Connected \xB7 ${ping} \xB7 ${indicatorState.totalUsers.toLocaleString()} users installed`);
        break;
      }
      case "connecting":
      case "reconnecting":
        dot.classList.add("slt-ci-connecting");
        if (pingEl) {
          pingEl.textContent = "--ms";
          pingEl.className = "slt-ci-ping";
        }
        setLabel(button, indicatorState.state === "reconnecting" ? "Reconnecting\u2026" : "Connecting\u2026");
        break;
      case "error":
        dot.classList.add("slt-ci-error");
        if (pingEl) {
          pingEl.textContent = "ERR";
          pingEl.className = "slt-ci-ping slt-ci-horrible";
        }
        setLabel(button, "Connection error \u2014 retrying\u2026");
        break;
      case "disconnected":
      default:
        if (pingEl) {
          pingEl.textContent = "--ms";
          pingEl.className = "slt-ci-ping";
        }
        setLabel(button, "Disconnected");
        break;
    }
  }
  async function fetchWithTimeout3(url, options = {}, timeout = CONNECTION_TIMEOUT) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (error2) {
      clearTimeout(id);
      throw error2;
    }
  }
  async function measureLatency() {
    try {
      const startTime = performance.now();
      const response = await fetchWithTimeout3(`${API_BASE}?action=ping&_=${Date.now()}`);
      if (!response.ok)
        return null;
      await response.json();
      return Math.round(performance.now() - startTime);
    } catch (error2) {
      return null;
    }
  }
  async function measureLatencyAccurate() {
    const samples = [];
    for (let i = 0; i < LATENCY_SAMPLES; i++) {
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, SAMPLE_DELAY));
      }
      const latency = await measureLatency();
      if (latency !== null) {
        samples.push(latency);
      }
    }
    if (samples.length === 0)
      return null;
    if (samples.length === 1)
      return samples[0];
    samples.sort((a, b) => a - b);
    const trimmed = samples.slice(0, -1);
    const avg = trimmed.reduce((sum, val) => sum + val, 0) / trimmed.length;
    return Math.round(avg);
  }
  async function sendHeartbeat() {
    try {
      const params = new URLSearchParams({
        action: "heartbeat",
        session: indicatorState.sessionId || "",
        version: storage.get("extension-version") || "1.0.0",
        clientId: getOrCreateClientId()
      });
      const response = await fetchWithTimeout3(`${API_BASE}?${params}`);
      if (!response.ok)
        throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.success) {
        indicatorState.sessionId = data.sessionId || indicatorState.sessionId;
        indicatorState.totalUsers = data.totalUsers || 0;
        indicatorState.region = data.region || "";
        indicatorState.lastHeartbeat = Date.now();
        if (indicatorState.state !== "connected") {
          indicatorState.state = "connected";
          updateUI();
        }
        return true;
      }
      return false;
    } catch (error2) {
      return false;
    }
  }
  async function connect() {
    indicatorState.state = "connecting";
    updateUI();
    try {
      const params = new URLSearchParams({
        action: "connect",
        version: storage.get("extension-version") || "1.0.0",
        clientId: getOrCreateClientId()
      });
      const response = await fetchWithTimeout3(`${API_BASE}?${params}`);
      if (!response.ok)
        throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.success) {
        indicatorState.sessionId = data.sessionId;
        indicatorState.totalUsers = data.totalUsers || 0;
        indicatorState.region = data.region || "";
        indicatorState.state = "connected";
        indicatorState.lastHeartbeat = Date.now();
        setTimeout(async () => {
          const latency = await measureLatencyAccurate();
          if (latency !== null) {
            indicatorState.latencyMs = latency;
            updateUI();
          }
        }, 1e3);
        updateUI();
        return true;
      }
      throw new Error("Connection failed");
    } catch (error2) {
      const isAbortError = error2 instanceof Error && error2.name === "AbortError";
      if (!isAbortError) {
      }
      indicatorState.state = "error";
      updateUI();
      setTimeout(() => {
        if (indicatorState.state === "error") {
          indicatorState.state = "reconnecting";
          updateUI();
          connect();
        }
      }, 5e3);
      return false;
    }
  }
  async function disconnect() {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    if (latencyInterval) {
      clearInterval(latencyInterval);
      latencyInterval = null;
    }
    if (indicatorState.sessionId) {
      try {
        const params = new URLSearchParams({
          action: "disconnect",
          session: indicatorState.sessionId
        });
        await fetch(`${API_BASE}?${params}`);
      } catch (e) {
      }
    }
    indicatorState.state = "disconnected";
    indicatorState.sessionId = null;
    indicatorState.latencyMs = null;
    updateUI();
  }
  function startPeriodicChecks() {
    heartbeatInterval = setInterval(async () => {
      const success = await sendHeartbeat();
      if (!success && indicatorState.state === "connected") {
        indicatorState.state = "reconnecting";
        updateUI();
        connect();
      }
    }, HEARTBEAT_INTERVAL);
    latencyInterval = setInterval(async () => {
      const latency = await measureLatency();
      if (latency !== null) {
        indicatorState.latencyMs = latency;
        updateUI();
      }
    }, LATENCY_CHECK_INTERVAL);
  }
  function getIndicatorContainer() {
    const topBarContentRight = document.querySelector(".main-topBar-topbarContentRight");
    if (topBarContentRight)
      return topBarContentRight;
    const userWidget = document.querySelector('.main-userWidget-box, [data-testid="user-widget-link"]');
    if (userWidget && userWidget.parentNode)
      return userWidget.parentNode;
    const historyButtons = document.querySelector(".main-topBar-historyButtons");
    if (historyButtons && historyButtons.parentNode)
      return historyButtons.parentNode;
    return null;
  }
  function waitForElement2(selector, timeout = 1e4) {
    return new Promise((resolve) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }
      const observer = new MutationObserver((mutations, obs) => {
        const el2 = document.querySelector(selector);
        if (el2) {
          obs.disconnect();
          resolve(el2);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        resolve(document.querySelector(selector));
      }, timeout);
    });
  }
  async function appendToDOM() {
    if (containerElement && containerElement.parentNode) {
      applyIndicatorVisibility();
      return true;
    }
    const container = getIndicatorContainer();
    if (container) {
      containerElement = createIndicatorElement();
      container.insertBefore(containerElement, container.firstChild);
      applyIndicatorVisibility();
      return true;
    }
    await waitForElement2('.main-topBar-topbarContentRight, .main-userWidget-box, [data-testid="user-widget-link"], .main-topBar-historyButtons');
    const lateContainer = getIndicatorContainer();
    if (lateContainer) {
      containerElement = createIndicatorElement();
      lateContainer.insertBefore(containerElement, lateContainer.firstChild);
      applyIndicatorVisibility();
      return true;
    }
    return false;
  }
  async function initConnectionIndicator() {
    if (indicatorState.isInitialized)
      return;
    const appended = await appendToDOM();
    if (!appended)
      return;
    indicatorState.isInitialized = true;
    await new Promise((resolve) => setTimeout(resolve, INITIAL_DELAY));
    const connected = await connect();
    if (connected) {
      startPeriodicChecks();
    }
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (latencyInterval) {
          clearInterval(latencyInterval);
          latencyInterval = null;
        }
      } else {
        if (indicatorState.state === "connected") {
          latencyInterval = setInterval(async () => {
            const latency = await measureLatency();
            if (latency !== null) {
              indicatorState.latencyMs = latency;
              updateUI();
            }
          }, LATENCY_CHECK_INTERVAL);
          setTimeout(async () => {
            const latency = await measureLatencyAccurate();
            if (latency !== null) {
              indicatorState.latencyMs = latency;
              updateUI();
            }
          }, 500);
        }
      }
    });
    window.addEventListener("beforeunload", () => {
      disconnect();
    });
  }
  function getConnectionState() {
    return { ...indicatorState };
  }
  async function refreshConnection() {
    await disconnect();
    await connect();
    if (indicatorState.state === "connected") {
      startPeriodicChecks();
    }
  }

  // src/utils/settingsShell.ts
  var TAB_META = {
    settings: { label: "Settings", description: "How and when your lyrics get translated." },
    cache: { label: "Cache", description: "Translations and lyrics saved on this device." },
    about: { label: "About", description: "Version, updates, connection and shortcuts." }
  };
  var SEARCH_SVG = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  var EYE_SVG = '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" fill="currentColor"/></svg>';
  var BELL_SVG = '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M4 11V7a4 4 0 118 0v4l1.2 1.5H2.8zM6.5 13.5a1.6 1.6 0 003 0" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  var DIFF_SVG = '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M5 2.5v7M1.5 6h7M9 11.5h5.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  var RESET_SVG = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 8a5.5 5.5 0 1 0 1.7-4"></path><path d="M2 2.5V6h3.5"></path></svg>';
  var REVEAL_SVG = EYE_SVG;
  var liveContainer = null;
  var activeTabId = "settings";
  var activeCategoryId = SETTINGS_CATEGORIES[0].id;
  var goToLive = null;
  var rerenderLive = null;
  var syncChrome = [];
  var fieldHandles = [];
  var teardownLive = null;
  function refreshChrome() {
    syncChrome.forEach((fn) => fn());
  }
  function languageName(code) {
    return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.name || code.toUpperCase();
  }
  function providerName(api) {
    return API_OPTIONS.find((o) => o.value === api)?.text || api;
  }
  function whereLabel(field) {
    const category = getCategoryForSection(field.section);
    if (!category || category.label === field.section)
      return field.section;
    return `${category.label} \xB7 ${field.section}`;
  }
  function describeValue(field, value) {
    if (field.type === "toggle")
      return value ? "On" : "Off";
    if (field.type === "select") {
      const option = (field.options || []).find((o) => o.value === String(value));
      return option ? option.text : String(value || "\u2014");
    }
    if (field.type === "languages") {
      const names = parseLanguageList(String(value)).map(languageName);
      return names.length ? names.join(", ") : "None";
    }
    if (field.secret)
      return value ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : "Not set";
    const str = String(value ?? "");
    return str ? str.length > 32 ? `${str.slice(0, 31)}\u2026` : str : "\u2014";
  }
  function snapshotSettings(fields = SETTINGS_SCHEMA) {
    const saved = fields.map((field) => ({ field, value: readSettingValue(field) }));
    return () => {
      const changes = saved.filter(({ field, value }) => readSettingValue(field) !== value);
      if (changes.length)
        applySettingsBatch(changes);
      refreshAll();
    };
  }
  function offerUndo(title, description, restore) {
    toast({
      kind: "success",
      key: "slt-undo",
      title,
      description,
      duration: 8e3,
      undo: () => {
        restore();
        toast({ kind: "info", key: "slt-undo", title: "Undone", description: "Everything is back the way it was." });
      }
    });
  }
  function changeWithUndo(field, value, title, description) {
    const restore = snapshotSettings([field]);
    applySettingsBatch([{ field, value }]);
    refreshAll();
    offerUndo(title, description, restore);
  }
  function refreshAll() {
    if (!liveContainer)
      return;
    fieldHandles.forEach((handle) => handle.sync());
    applyFilter();
    refreshChrome();
  }
  function buildField(field) {
    const id = `slt-${field.id}`;
    const row = el("div", { class: `slt-m-field slt-m-field-${field.type}`, "data-slt-setting-field": field.id });
    const label = el("label", { class: "slt-m-field-label", for: id, text: field.label });
    if (field.effects?.includes("retranslate")) {
      label.append(el("span", { class: "slt-m-badge", text: "Retranslates", title: "Changing this translates the current song again" }));
    }
    const labelBox = el(
      "div",
      { class: "slt-m-field-labelbox" },
      label,
      field.description ? el("div", { class: "slt-m-field-hint", text: field.description }) : null
    );
    const control = el("div", { class: "slt-m-field-control" });
    let input;
    let syncLanguages = null;
    if (field.type === "toggle") {
      input = el("input", { type: "checkbox", id });
      control.append(el("label", { class: "slt-m-toggle" }, input, el("span", { class: "slt-m-toggle-slider" })));
    } else if (field.type === "select") {
      const select = el("select", { class: "slt-m-select", id });
      (field.options || []).forEach((option) => select.append(el("option", { value: option.value, text: option.text })));
      input = select;
      control.append(select);
    } else if (field.type === "languages") {
      const chips = el("div", { class: "slt-m-langs" });
      const add = el("select", { class: "slt-m-select", id });
      input = add;
      syncLanguages = (value) => {
        const selected = parseLanguageList(value);
        chips.replaceChildren(...selected.map((code) => {
          const remove = el("button", { type: "button", class: "slt-m-lang-remove", title: "Remove", "aria-label": `Remove ${languageName(code)}`, html: CLOSE_SVG });
          remove.addEventListener("click", () => {
            applySettingsBatch([{ field, value: selected.filter((c) => c !== code).join(",") }]);
            refreshAll();
          });
          return el("span", { class: "slt-m-lang" }, languageName(code), remove);
        }));
        add.replaceChildren(
          el("option", { value: "", text: field.placeholder || "Add\u2026" }),
          ...(field.options || []).filter((option) => !selected.includes(option.value)).map((option) => el("option", { value: option.value, text: option.text }))
        );
        add.value = "";
      };
      control.append(el("div", { class: "slt-m-langs-box" }, chips, add));
    } else {
      input = el("input", {
        class: "slt-m-text",
        id,
        type: field.type === "password" ? "password" : "text",
        placeholder: field.placeholder || "",
        autocomplete: "off",
        spellcheck: "false",
        "data-form-type": "other"
      });
      control.append(input);
      if (field.type === "password") {
        const reveal = el("button", { class: "slt-m-reveal", type: "button", title: "Show or hide", "aria-label": `Show ${field.label}`, html: REVEAL_SVG });
        reveal.addEventListener("click", () => {
          const text3 = input;
          text3.type = text3.type === "password" ? "text" : "password";
          reveal.classList.toggle("on", text3.type === "text");
        });
        control.append(reveal);
      }
    }
    const reset = el("button", { class: "slt-m-field-reset", type: "button", title: "Reset to default", "aria-label": `Reset ${field.label} to default`, html: RESET_SVG });
    control.append(reset);
    row.append(labelBox, control);
    const sync = () => {
      const value = readSettingValue(field);
      if (syncLanguages) {
        syncLanguages(String(value));
      } else if (field.type === "toggle") {
        input.checked = value === true;
      } else if (document.activeElement !== input || field.type === "select") {
        input.value = String(value);
      }
      reset.classList.toggle("slt-m-field-reset-on", !isSettingAtDefault(field));
    };
    input.addEventListener("change", () => {
      if (field.type === "languages" && !input.value)
        return;
      const value = field.type === "toggle" ? input.checked : field.type === "languages" ? [...parseLanguageList(String(readSettingValue(field))), input.value].join(",") : input.value;
      applySettingsBatch([{ field, value }]);
      refreshAll();
    });
    reset.addEventListener("click", () => {
      changeWithUndo(field, field.defaultValue, `Reset \u201C${field.label}\u201D`, `Back to ${describeValue(field, field.defaultValue)}.`);
    });
    sync();
    return { field, row, sync };
  }
  function applyFilter() {
    if (!liveContainer)
      return;
    const searchEl = liveContainer.querySelector(".slt-m-cz-search");
    const q = (searchEl?.value || "").trim().toLowerCase();
    const searching = q.length > 0;
    const api = getCurrentApiPreference();
    let hits = 0;
    fieldHandles.forEach(({ field, row }) => {
      const show = isSettingFieldVisible(field, api) && matchesSettingQuery(field, q);
      row.style.display = show ? "" : "none";
      if (show && searching)
        hits++;
    });
    liveContainer.querySelectorAll(".slt-m-cz-sections .slt-m-section").forEach((section) => {
      const any = Array.from(section.querySelectorAll(".slt-m-field")).some((f) => f.style.display !== "none");
      section.style.display = any ? "" : "none";
    });
    liveContainer.querySelectorAll(".slt-m-cz-category").forEach((category) => {
      const any = Array.from(category.querySelectorAll(".slt-m-section")).some((s) => s.style.display !== "none");
      category.style.display = (searching ? any : category.id === activeCategoryId && any) ? "" : "none";
    });
    liveContainer.classList.toggle("slt-m-searching", searching);
    const status = liveContainer.querySelector(".slt-m-cz-status");
    if (status) {
      status.style.display = searching ? "" : "none";
      status.textContent = hits === 0 ? `No settings match \u201C${q}\u201D.` : `${hits} setting${hits === 1 ? "" : "s"} match \u201C${q}\u201D.`;
      status.classList.toggle("slt-m-cz-status-empty", hits === 0);
    }
    const clear = liveContainer.querySelector(".slt-m-cz-clear");
    if (clear)
      clear.style.display = searching ? "" : "none";
  }
  function buildSettingsTab() {
    const tab = el("div", { class: "slt-m-tab-content slt-m-cz" });
    const search = el("input", {
      type: "text",
      class: "slt-m-cz-search",
      placeholder: "Filter settings\u2026",
      spellcheck: "false",
      "aria-label": "Filter settings",
      "data-slt-esc-local": true
    });
    const clear = el("button", { type: "button", class: "slt-m-cz-clear", text: "Clear", "aria-label": "Clear filter" });
    clear.style.display = "none";
    search.addEventListener("input", () => {
      applyFilter();
      refreshChrome();
    });
    search.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && search.value) {
        e.stopPropagation();
        search.value = "";
        applyFilter();
        refreshChrome();
      }
    });
    clear.addEventListener("click", () => {
      search.value = "";
      applyFilter();
      refreshChrome();
      search.focus();
    });
    const toolbar = el(
      "div",
      { class: "slt-m-cz-toolbar" },
      el("span", { class: "slt-m-cz-search-icon", "aria-hidden": "true", html: SEARCH_SVG }),
      search,
      clear
    );
    const status = el("div", { class: "slt-m-cz-status", role: "status" });
    status.style.display = "none";
    const sections = el("div", { class: "slt-m-cz-sections" });
    fieldHandles = [];
    SETTINGS_CATEGORIES.forEach((category) => {
      const categoryEl = el(
        "div",
        { class: "slt-m-cz-category", id: category.id },
        el(
          "div",
          { class: "slt-m-cz-cat-head" },
          el("div", { class: "slt-m-cz-cat-title", text: category.label }),
          el("div", { class: "slt-m-cz-cat-desc", text: category.description })
        )
      );
      getSectionsForCategory(category).forEach((sectionName) => {
        const section = el(
          "div",
          { class: "slt-m-section", "data-section": sectionName },
          el("div", { class: "slt-m-section-title", text: sectionName })
        );
        SETTINGS_SCHEMA.filter((field) => field.section === sectionName).forEach((field) => {
          const handle = buildField(field);
          fieldHandles.push(handle);
          section.append(handle.row);
        });
        categoryEl.append(section);
      });
      sections.append(categoryEl);
    });
    tab.append(toolbar, status, sections);
    return tab;
  }
  function formatBytes(bytes) {
    if (bytes < 1024)
      return `${bytes} B`;
    if (bytes < 1024 * 1024)
      return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  function relativeTime(at) {
    const s = Math.max(0, Math.round((Date.now() - at) / 1e3));
    if (s < 60)
      return "just now";
    const m = Math.round(s / 60);
    if (m < 60)
      return `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 24)
      return `${h} h ago`;
    const d = Math.round(h / 24);
    return `${d} day${d === 1 ? "" : "s"} ago`;
  }
  function armedButton(label, armedLabel, run) {
    const btn = el("button", { class: "slt-m-btn slt-m-btn-danger", type: "button", text: label });
    let timer = null;
    const disarm = () => {
      if (timer !== null)
        window.clearTimeout(timer);
      timer = null;
      btn.classList.remove("slt-m-btn-armed");
      btn.textContent = label;
    };
    btn.addEventListener("click", async () => {
      if (!btn.classList.contains("slt-m-btn-armed")) {
        btn.classList.add("slt-m-btn-armed");
        btn.textContent = armedLabel;
        timer = window.setTimeout(disarm, 3500);
        return;
      }
      disarm();
      btn.disabled = true;
      try {
        await run();
      } finally {
        btn.disabled = false;
      }
    });
    btn.addEventListener("blur", disarm);
    return btn;
  }
  function stat(label, value) {
    return el(
      "div",
      { class: "slt-m-stat" },
      el("div", { class: "slt-m-stat-value", text: value }),
      el("div", { class: "slt-m-stat-label", text: label })
    );
  }
  function buildCacheTab() {
    const tab = el("div", { class: "slt-m-tab-content" });
    const stats = getTrackCacheStats();
    const usage = storage.getStats();
    const viewTranslations = el("button", { class: "slt-m-btn", type: "button", text: "Browse translations" });
    viewTranslations.addEventListener("click", () => openCacheViewer());
    const translations = el(
      "div",
      { class: "slt-m-section" },
      el("div", { class: "slt-m-section-title", text: "Translations" }),
      el("div", { class: "slt-m-about-text", text: "Songs you\u2019ve translated are saved here, so they load instantly and work offline." }),
      el(
        "div",
        { class: "slt-m-stats" },
        stat("Songs", stats.trackCount.toLocaleString()),
        stat("Lines", stats.totalLines.toLocaleString()),
        stat("Size", formatBytes(stats.sizeBytes)),
        stat("Oldest", stats.oldestTimestamp ? relativeTime(stats.oldestTimestamp) : "\u2014")
      ),
      el(
        "div",
        { class: "slt-m-about-actions" },
        viewTranslations,
        armedButton("Delete all translations", "Click again to delete", () => {
          clearAllCachedTranslations();
          rerenderLive?.();
        })
      )
    );
    const viewLyrics = el("button", { class: "slt-m-btn", type: "button", text: "Browse lyrics" });
    viewLyrics.addEventListener("click", () => {
      openSpicyLyricsCacheViewer();
    });
    const lyrics = el(
      "div",
      { class: "slt-m-section" },
      el("div", { class: "slt-m-section-title", text: "Spicy Lyrics lyrics" }),
      el("div", { class: "slt-m-about-text", text: "Lyrics Spicy Lyrics downloaded. Clearing makes it fetch fresh copies, which can fix out-of-sync or wrong lyrics." }),
      el(
        "div",
        { class: "slt-m-about-actions" },
        viewLyrics,
        armedButton("Clear lyrics cache", "Click again to clear", async () => {
          await clearSpicyLyricsCachedLyrics();
          rerenderLive?.();
        })
      )
    );
    const fill2 = el("i");
    fill2.style.width = `${Math.min(100, Math.max(1, usage.percentUsed))}%`;
    const storageSection = el(
      "div",
      { class: "slt-m-section" },
      el("div", { class: "slt-m-section-title", text: "Storage" }),
      el("div", { class: "slt-m-meter", role: "meter", "aria-valuenow": String(usage.percentUsed), "aria-valuemin": "0", "aria-valuemax": "100" }, fill2),
      el("div", { class: "slt-m-about-text", text: `${formatBytes(usage.usedBytes)} of ${formatBytes(usage.maxBytes)} used (${usage.percentUsed}%). The oldest translations are cleared automatically when it fills up.` })
    );
    tab.append(translations, lyrics, storageSection);
    return tab;
  }
  function connectionLabel(value) {
    switch (value) {
      case "connected":
        return "Connected";
      case "connecting":
        return "Connecting\u2026";
      case "reconnecting":
        return "Reconnecting\u2026";
      case "error":
        return "Connection error";
      default:
        return "Disconnected";
    }
  }
  function latencyClass(latencyMs) {
    if (latencyMs === null)
      return "";
    if (latencyMs <= 150)
      return "great";
    if (latencyMs <= 300)
      return "ok";
    if (latencyMs <= 500)
      return "bad";
    return "horrible";
  }
  function buildConnectionCard() {
    const dot = el("span", { class: "slt-m-conn-dot" });
    const stateEl = el("span", { class: "slt-m-conn-state" });
    const ping = el("span", { class: "slt-m-stat-value" });
    const users = el("span", { class: "slt-m-stat-value" });
    const card = el(
      "div",
      { class: "slt-m-section" },
      el(
        "div",
        { class: "slt-m-conn-head" },
        el("div", { class: "slt-m-section-title", text: "Connection" }),
        el("span", { class: "slt-m-conn-status" }, dot, stateEl)
      ),
      el(
        "div",
        { class: "slt-m-stats" },
        el("div", { class: "slt-m-stat" }, ping, el("div", { class: "slt-m-stat-label", text: "Ping" })),
        el("div", { class: "slt-m-stat" }, users, el("div", { class: "slt-m-stat-label", text: "Users installed" }))
      )
    );
    const update = () => {
      const conn = getConnectionState();
      const latency = conn.state === "connected" ? latencyClass(conn.latencyMs) : "";
      dot.className = `slt-m-conn-dot slt-m-conn-${conn.state}${latency ? ` slt-m-lat-${latency}` : ""}`;
      stateEl.textContent = connectionLabel(conn.state);
      ping.textContent = conn.latencyMs !== null ? `${conn.latencyMs} ms` : "\u2014";
      ping.className = `slt-m-stat-value${latency ? ` slt-m-lat-${latency}` : ""}`;
      users.textContent = conn.totalUsers > 0 ? conn.totalUsers.toLocaleString() : "\u2014";
    };
    update();
    const interval = window.setInterval(() => {
      if (!card.isConnected) {
        window.clearInterval(interval);
        return;
      }
      update();
    }, 2e3);
    return card;
  }
  function buildAboutTab() {
    const tab = el("div", { class: "slt-m-tab-content" });
    const { hash, source } = getDisplayHash();
    const shortHash = hash ? hash.substring(0, 8) : "";
    const hashTitle = source === "delivered" ? `SHA-256 of the loaded script \u2014 ${hash}` : `Build hash \u2014 ${hash}`;
    const hero = el(
      "div",
      { class: "slt-m-section" },
      el(
        "div",
        { class: "slt-m-about-hero" },
        el("div", { class: "slt-m-about-title", text: "Spicy Lyric Translator" }),
        el("div", { class: "slt-m-about-version", text: `v${VERSION}` }),
        shortHash ? el("div", { class: "slt-m-about-hash", text: shortHash, title: hashTitle }) : null
      ),
      el("div", { class: "slt-m-about-text", text: "Translates Spicy Lyrics as the song plays, with romanization, a word-by-word learning mode, and caching so songs you\u2019ve already heard load instantly." })
    );
    const check = el("button", { class: "slt-m-btn slt-m-btn-primary", type: "button", text: "Check for updates" });
    check.addEventListener("click", () => {
      runManualUpdateCheck(check);
    });
    const changelog = el("button", { class: "slt-m-btn", type: "button", text: "What\u2019s new" });
    changelog.addEventListener("click", async () => {
      if (changelog.disabled)
        return;
      changelog.disabled = true;
      changelog.textContent = "Loading\u2026";
      try {
        await showCurrentChangelog({ expanded: true });
      } catch {
        toast({ kind: "error", title: "Couldn't load the changelog" });
      } finally {
        changelog.disabled = false;
        changelog.textContent = "What\u2019s new";
      }
    });
    const updates = el(
      "div",
      { class: "slt-m-section" },
      el("div", { class: "slt-m-section-title", text: "Updates" }),
      el("div", { class: "slt-m-about-actions" }, check, changelog)
    );
    const shortcut = (keys, label) => el(
      "div",
      { class: "slt-m-shortcut" },
      el("span", { class: "slt-m-shortcut-keys" }, ...keys.map((k) => el("kbd", { text: k }))),
      el("span", { text: label })
    );
    const shortcuts = el(
      "div",
      { class: "slt-m-section" },
      el("div", { class: "slt-m-section-title", text: "Shortcuts" }),
      shortcut(["Alt", "T"], "Turn translation on or off"),
      shortcut(["Ctrl", "K"], "Search settings, languages and actions"),
      shortcut(["Hold P"], "Peek at the lyrics behind this window"),
      shortcut(["Esc"], "Close the top window")
    );
    const links = el(
      "div",
      { class: "slt-m-section" },
      el(
        "div",
        { class: "slt-m-about-links" },
        el("a", { href: REPO_URL.replace(/\/releases$/, ""), target: "_blank", rel: "noopener noreferrer", text: "GitHub" }),
        el("a", { href: REPO_URL, target: "_blank", rel: "noopener noreferrer", text: "Releases" })
      )
    );
    tab.append(hero, updates, buildConnectionCard(), shortcuts, links);
    return tab;
  }
  function summaryParts() {
    const parts = [`${providerName(getCurrentApiPreference())} \u2192 ${languageName(storage.get("target-language") || "en")}`];
    if (state.showRomanization)
      parts.push("Romanization");
    if (state.learningMode)
      parts.push("Learning");
    if (state.autoTranslate)
      parts.push("Auto");
    return parts;
  }
  function buildMasterBar() {
    const input = el("input", { type: "checkbox", "aria-label": "Turn translation on or off" });
    const title = el("div", { class: "slt-m-enabled-title" });
    const sub = el("div", { class: "slt-m-enabled-sub" });
    const bar = el(
      "div",
      { class: "slt-m-enabled-bar" },
      el("div", { class: "slt-m-enabled-text" }, title, sub),
      el("label", { class: "slt-m-toggle", title: "Alt+T" }, input, el("span", { class: "slt-m-toggle-slider" }))
    );
    const sync = () => {
      input.checked = state.isEnabled;
      bar.classList.toggle("slt-m-enabled-off", !state.isEnabled);
      title.textContent = state.isEnabled ? "Translation on" : "Translation off";
      const parts = summaryParts();
      sub.textContent = state.isEnabled ? parts[0] : "Lyrics stay in their original language";
      sub.title = parts.join(" \xB7 ");
    };
    input.addEventListener("change", async () => {
      if (input.checked !== state.isEnabled)
        await handleTranslateToggle();
      sync();
    });
    syncChrome.push(sync);
    sync();
    return bar;
  }
  function changedFields() {
    return SETTINGS_SCHEMA.filter((field) => !field.secret && !isSettingAtDefault(field));
  }
  function openReviewChanges() {
    const list = el("div", { class: "slt-m-rv-list" });
    const summary = el("p", { class: "slt-ui-text" });
    let dialog = null;
    const render = () => {
      const fields = changedFields();
      list.innerHTML = "";
      summary.textContent = fields.length ? `${fields.length} setting${fields.length === 1 ? " differs" : "s differ"} from the defaults. API keys are left out.` : "Everything is on its default. API keys are left out.";
      fields.forEach((field) => {
        const row = el(
          "div",
          { class: "slt-m-rv-row" },
          el(
            "div",
            { class: "slt-m-rv-head" },
            el("button", { class: "slt-m-rv-label", type: "button", text: field.label, title: "Show this setting" }),
            el("span", { class: "slt-m-rv-where", text: whereLabel(field) })
          ),
          el(
            "div",
            { class: "slt-m-rv-diff" },
            el("span", { class: "slt-m-rv-value", text: describeValue(field, field.defaultValue) }),
            el("span", { class: "slt-m-rv-arrow", "aria-hidden": "true" }),
            el("span", { class: "slt-m-rv-value", text: describeValue(field, readSettingValue(field)) })
          ),
          el("button", { class: "slt-m-rv-revert", type: "button", text: "Revert" })
        );
        row.querySelector(".slt-m-rv-label")?.addEventListener("click", () => {
          dialog?.close();
          revealSetting(field.id);
        });
        row.querySelector(".slt-m-rv-revert")?.addEventListener("click", () => {
          changeWithUndo(field, field.defaultValue, `Reverted \u201C${field.label}\u201D`);
          render();
        });
        list.append(row);
      });
      list.hidden = fields.length === 0;
      const resetAll = dialog?.footer.querySelector('[data-action="reset-all"]');
      if (resetAll)
        resetAll.disabled = fields.length === 0;
    };
    dialog = openDialog({
      eyebrow: "Spicy Lyric Translator \xB7 Review",
      title: "Your changes",
      size: "lg",
      body: [summary, list],
      actions: [
        {
          id: "reset-all",
          label: "Reset all to defaults",
          kind: "danger",
          keepOpen: true,
          onClick: () => {
            const fields = changedFields();
            const restore = snapshotSettings(fields);
            applySettingsBatch(fields.map((field) => ({ field, value: field.defaultValue })));
            refreshAll();
            offerUndo(`Reset ${fields.length} setting${fields.length === 1 ? "" : "s"}`, "Your API keys were kept.", restore);
            render();
          }
        },
        { label: "Done", kind: "primary" }
      ]
    });
    render();
  }
  function paletteItems(close) {
    const items = [];
    SETTINGS_CATEGORIES.forEach((category) => {
      items.push({ group: "Go to", label: `Settings \u203A ${category.label}`, hint: category.description, run: () => {
        close();
        goToLive?.("settings", category.id);
      } });
    });
    ["cache", "about"].forEach((tab) => {
      items.push({ group: "Go to", label: TAB_META[tab].label, hint: TAB_META[tab].description, run: () => {
        close();
        goToLive?.(tab);
      } });
    });
    SETTINGS_SCHEMA.forEach((field) => {
      items.push({
        group: "Settings",
        label: field.label,
        hint: whereLabel(field),
        keywords: `${field.section} ${field.description || ""} ${field.keywords || ""}`,
        run: () => {
          close();
          revealSetting(field.id);
        }
      });
    });
    const target = getSettingField("target-language");
    if (target) {
      SUPPORTED_LANGUAGES.forEach((language) => {
        items.push({
          group: "Languages",
          label: `Translate to ${language.name}`,
          hint: language.code.toUpperCase(),
          keywords: `language target ${language.code}`,
          run: () => {
            close();
            changeWithUndo(target, language.code, `Translating to ${language.name}`);
          }
        });
      });
    }
    const provider = getSettingField("preferred-api");
    if (provider) {
      API_OPTIONS.forEach((option) => {
        items.push({
          group: "Providers",
          label: `Use ${option.text}`,
          keywords: `provider api service engine ${option.value}`,
          run: () => {
            close();
            changeWithUndo(provider, option.value, `Switched to ${option.text}`, "Add its key under Providers if it needs one.");
          }
        });
      });
    }
    items.push(
      {
        group: "Actions",
        label: state.isEnabled ? "Turn translation off" : "Turn translation on",
        keywords: "enable disable toggle alt t",
        run: async () => {
          close();
          await handleTranslateToggle();
          refreshChrome();
        }
      },
      { group: "Actions", label: "Translate this song again", keywords: "retranslate refresh redo", run: () => {
        close();
        forceRetranslate();
      } },
      { group: "Actions", label: "Review changes", hint: "Everything that differs from the defaults", run: () => {
        close();
        openReviewChanges();
      } },
      { group: "Actions", label: "Browse cached translations", keywords: "cache history", run: () => {
        close();
        openCacheViewer();
      } },
      { group: "Actions", label: "Check for updates", keywords: "version update", run: () => {
        close();
        runManualUpdateCheck(null);
      } },
      { group: "Actions", label: "What\u2019s new", keywords: "changelog release notes", run: () => {
        close();
        showCurrentChangelog({ expanded: true }).catch(() => toast({ kind: "error", title: "Couldn't load the changelog" }));
      } },
      { group: "Actions", label: "Notifications", keywords: "inbox bell history", run: () => {
        close();
        openInbox();
      } }
    );
    return items;
  }
  function scoreItem(item, q) {
    const label = item.label.toLowerCase();
    if (label.startsWith(q))
      return 100 - label.length * 0.1;
    const words = label.split(/[\s›·“”()]+/);
    if (words.some((w) => w.startsWith(q)))
      return 70 - label.length * 0.1;
    if (label.includes(q))
      return 50;
    if (`${item.hint || ""} ${item.keywords || ""}`.toLowerCase().includes(q))
      return 20;
    return -1;
  }
  var GROUP_LIMITS = { Settings: 7, Languages: 5, "Go to": 4, Providers: 4, Actions: 4 };
  function openPalette() {
    if (document.querySelector(".slt-m-pal"))
      return;
    let dialog = null;
    const close = () => dialog?.close();
    const all = paletteItems(close);
    const input = el("input", {
      class: "slt-m-pal-input",
      type: "text",
      placeholder: "Search settings, languages and actions\u2026",
      spellcheck: "false",
      "aria-label": "Search Spicy Lyric Translator",
      "data-slt-autofocus": true,
      "data-slt-esc-local": true
    });
    const results = el("div", { class: "slt-m-pal-results", role: "listbox" });
    const foot = el(
      "div",
      { class: "slt-m-pal-foot" },
      el("span", { html: "<kbd>\u2191</kbd><kbd>\u2193</kbd> move" }),
      el("span", { html: "<kbd>Enter</kbd> open" }),
      el("span", { html: "<kbd>Esc</kbd> close" })
    );
    const box = el(
      "div",
      { class: "slt-m-pal" },
      el("div", { class: "slt-m-pal-bar" }, el("span", { class: "slt-m-pal-icon", html: SEARCH_SVG }), input),
      results,
      foot
    );
    let shown = [];
    let active = 0;
    const paint = () => {
      results.innerHTML = "";
      let lastGroup = "";
      shown.forEach((item, i) => {
        if (item.group !== lastGroup) {
          lastGroup = item.group;
          results.append(el("div", { class: "slt-m-pal-group", text: item.group }));
        }
        const row = el(
          "button",
          { class: `slt-m-pal-item${i === active ? " active" : ""}`, type: "button", role: "option", "aria-selected": String(i === active) },
          el("span", { class: "slt-m-pal-label", text: item.label }),
          item.hint ? el("span", { class: "slt-m-pal-hint", text: item.hint }) : null
        );
        row.addEventListener("mousemove", () => {
          if (active === i)
            return;
          active = i;
          results.querySelectorAll(".slt-m-pal-item").forEach((n, j) => n.classList.toggle("active", j === i));
        });
        row.addEventListener("click", () => item.run());
        results.append(row);
      });
      if (!shown.length)
        results.append(el("div", { class: "slt-m-pal-empty", text: input.value.trim() ? "Nothing matches that." : "Start typing to search." }));
      results.querySelector(".slt-m-pal-item.active")?.scrollIntoView({ block: "nearest" });
    };
    const compute = () => {
      const q = input.value.trim().toLowerCase();
      if (!q) {
        shown = all.filter((i) => i.group === "Go to" || i.group === "Actions").slice(0, 11);
      } else {
        const scored = all.map((item) => ({ item, score: scoreItem(item, q) })).filter((x) => x.score >= 0).sort((a, b) => b.score - a.score);
        const byGroup = /* @__PURE__ */ new Map();
        scored.forEach(({ item }) => {
          const list = byGroup.get(item.group) || [];
          if (list.length < (GROUP_LIMITS[item.group] || 4))
            list.push(item);
          byGroup.set(item.group, list);
        });
        shown = ["Settings", "Languages", "Go to", "Providers", "Actions"].flatMap((g) => byGroup.get(g) || []);
      }
      active = Math.min(active, Math.max(0, shown.length - 1));
      paint();
    };
    input.addEventListener("input", () => {
      active = 0;
      compute();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        active = Math.min(shown.length - 1, active + 1);
        paint();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        active = Math.max(0, active - 1);
        paint();
      } else if (e.key === "Enter") {
        e.preventDefault();
        shown[active]?.run();
      } else if (e.key === "Escape" && input.value) {
        e.preventDefault();
        input.value = "";
        compute();
      }
    });
    dialog = openDialog({ title: "Search", bare: true, size: "md", placement: "top", className: "slt-m-pal-dialog", content: box });
    compute();
    input.focus();
  }
  var INBOX_TONE = {
    info: "accent",
    success: "success",
    warning: "hotfix",
    error: "error",
    update: "accent"
  };
  function openInbox() {
    const list = el("div", { class: "slt-m-inbox" });
    let dialog = null;
    const render = (items) => {
      list.innerHTML = "";
      if (!items.length) {
        list.append(el(
          "div",
          { class: "slt-m-inbox-empty" },
          el("div", { class: "slt-m-inbox-empty-title", text: "All caught up" }),
          el("div", { class: "slt-m-inbox-empty-sub", text: "Updates, warnings and errors land here so you never miss one." })
        ));
        return;
      }
      items.forEach((entry) => {
        const dot = el("span", { class: "slt-m-inbox-dot", "aria-hidden": "true" });
        paintTone(dot, INBOX_TONE[entry.kind] || "accent");
        const row = el(
          "div",
          { class: `slt-m-inbox-row${entry.read ? "" : " unread"}` },
          dot,
          el(
            "div",
            { class: "slt-m-inbox-text" },
            el("div", { class: "slt-m-inbox-title", text: entry.title }),
            entry.description ? el("div", { class: "slt-m-inbox-desc", text: entry.description }) : null,
            el("div", { class: "slt-m-inbox-time", text: relativeTime(entry.at) })
          )
        );
        if (entry.actionId) {
          const actionId = entry.actionId;
          const btn = el("button", { class: "slt-m-inbox-btn", type: "button", text: entry.actionLabel || "Open" });
          btn.addEventListener("click", () => {
            dialog?.close();
            runInboxAction(actionId);
          });
          row.append(btn);
        }
        list.append(row);
      });
    };
    render(getInbox());
    dialog = openDialog({
      title: "Notifications",
      size: "md",
      className: "slt-m-inbox-dialog",
      content: list,
      actions: [
        { label: "Clear all", kind: "quiet", keepOpen: true, onClick: () => {
          clearInbox();
          render([]);
        } },
        { label: "Done", kind: "primary" }
      ]
    });
    markInboxRead();
  }
  function iconButton(className, label, svg) {
    return el("button", { class: `slt-m-icon-btn ${className}`, type: "button", "aria-label": label, title: label, html: svg });
  }
  function bindShortcuts(peekButton, overlayOf) {
    const on = () => overlayOf()?.classList.add("slt-ui-peek");
    const off = () => overlayOf()?.classList.remove("slt-ui-peek");
    peekButton.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      on();
    });
    peekButton.addEventListener("pointerup", off);
    peekButton.addEventListener("pointerleave", off);
    peekButton.addEventListener("blur", off);
    peekButton.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        on();
      }
    });
    peekButton.addEventListener("keyup", off);
    const editable = (t) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    const settingsOnTop = () => {
      const surfaces = openSurfaces();
      const top = surfaces[surfaces.length - 1];
      return !!top && !!liveContainer && top.root.contains(liveContainer);
    };
    const onKeyDown = (e) => {
      if (!liveContainer?.isConnected)
        return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        if (!settingsOnTop())
          return;
        e.preventDefault();
        e.stopPropagation();
        openPalette();
        return;
      }
      if (e.key.toLowerCase() === "p" && !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat && !editable(e.target) && settingsOnTop()) {
        on();
      }
    };
    const onKeyUp = (e) => {
      if (e.key.toLowerCase() === "p")
        off();
    };
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", off);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", off);
    };
  }
  function settingById(id) {
    const field = getSettingField(id);
    return field ? { id: field.id, label: field.label } : null;
  }
  function matchSettingInText(input) {
    const haystack = ` ${input.toLowerCase().replace(/[^a-z0-9 ]+/g, " ")} `;
    let best = null;
    SETTINGS_SCHEMA.forEach((field) => {
      const label = field.label.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
      if (label.length < 7 || !label.includes(" "))
        return;
      if (!haystack.includes(` ${label} `))
        return;
      if (!best || label.length > best.label.length)
        best = field;
    });
    const found = best;
    return found ? { id: found.id, label: found.label } : null;
  }
  function isSettingsOpen() {
    return !!liveContainer && liveContainer.isConnected;
  }
  function goToSettings(tab, category) {
    goToLive?.(tab, category);
  }
  function revealSetting(id) {
    if (!liveContainer || !goToLive)
      return;
    const field = getSettingField(id);
    if (!field)
      return;
    goToLive("settings", getCategoryForSection(field.section)?.id);
    const row = liveContainer.querySelector(`.slt-m-field[data-slt-setting-field="${id}"]`);
    if (!row)
      return;
    if (row.style.display === "none") {
      toast({ kind: "info", key: "slt-reveal", title: `\u201C${field.label}\u201D is hidden right now`, description: "It only applies to a different provider or language." });
      return;
    }
    row.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    row.classList.remove("slt-m-spot");
    void row.offsetWidth;
    row.classList.add("slt-m-spot");
    window.setTimeout(() => row.classList.remove("slt-m-spot"), 2400);
    row.querySelector("input, select")?.focus({ preventScroll: true });
  }
  function destroySettingsShell() {
    teardownLive?.();
    teardownLive = null;
    liveContainer = null;
    goToLive = null;
    rerenderLive = null;
    fieldHandles = [];
    syncChrome = [];
  }
  function createSettingsShell(options = {}) {
    ensureShellStyles();
    teardownLive?.();
    const container = el("div", { class: "slt-modal-root" });
    liveContainer = container;
    syncChrome = [];
    if (options.tab)
      activeTabId = options.tab;
    if (options.category)
      activeCategoryId = options.category;
    const renderers = {
      settings: buildSettingsTab,
      cache: buildCacheTab,
      about: buildAboutTab
    };
    const tabContent = el("div", { class: "slt-m-tab-host" });
    const crumbTitle = el("div", { class: "slt-m-crumb-title" });
    const crumbSub = el("div", { class: "slt-m-crumb-sub" });
    function rerender() {
      if (activeTabId !== "settings")
        fieldHandles = [];
      tabContent.innerHTML = "";
      tabContent.appendChild(renderers[activeTabId]());
      applyFilter();
      refreshChrome();
    }
    rerenderLive = rerender;
    function goTo(tab, category) {
      const sameTab = tab === activeTabId;
      activeTabId = tab;
      if (category)
        activeCategoryId = category;
      if (!sameTab || tab !== "settings") {
        rerender();
      } else {
        const search = container.querySelector(".slt-m-cz-search");
        if (search)
          search.value = "";
        applyFilter();
        refreshChrome();
      }
      tabContent.scrollTop = 0;
      if (!prefersReducedMotion()) {
        tabContent.firstElementChild?.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: "cubic-bezier(0.2, 0.9, 0.1, 1)" });
      }
    }
    goToLive = goTo;
    const side = el("aside", { class: "slt-m-side" });
    side.append(
      el(
        "div",
        { class: "slt-m-brand" },
        el("span", { class: "slt-m-brand-mark", html: Icons.Translate }),
        el(
          "div",
          { class: "slt-m-brand-text" },
          el("div", { class: "slt-m-brand-name", text: "Spicy Lyric Translator" }),
          el("div", { class: "slt-m-brand-ver", text: `v${VERSION}` })
        )
      ),
      buildMasterBar()
    );
    const nav = el("nav", { class: "slt-m-side-nav", "aria-label": "Settings sections" });
    nav.append(el("div", { class: "slt-m-side-label", text: "Settings" }));
    const catNav = el("div", { class: "slt-m-cz-nav", role: "tablist" });
    SETTINGS_CATEGORIES.forEach((category) => {
      const btn = el(
        "button",
        { class: "slt-m-side-item", type: "button", role: "tab", "data-target": category.id },
        el("span", { class: "slt-m-cz-nav-icon", "aria-hidden": "true", text: category.icon }),
        el("span", { class: "slt-m-side-item-label", text: category.label })
      );
      btn.addEventListener("click", () => goTo("settings", category.id));
      catNav.append(btn);
    });
    nav.append(catNav, el("div", { class: "slt-m-side-label", text: "Library" }));
    const tabButtons = /* @__PURE__ */ new Map();
    [["cache", "\u25A4"], ["about", "i"]].forEach(([tab, icon]) => {
      const btn = el(
        "button",
        { class: "slt-m-side-item", type: "button", "data-tab": tab },
        el("span", { class: "slt-m-cz-nav-icon", "aria-hidden": "true", text: icon }),
        el("span", { class: "slt-m-side-item-label", text: TAB_META[tab].label })
      );
      btn.addEventListener("click", () => goTo(tab));
      tabButtons.set(tab, btn);
      nav.append(btn);
    });
    side.append(nav);
    const searchHint = el(
      "button",
      { class: "slt-m-side-search", type: "button" },
      el("span", { class: "slt-m-side-search-icon", html: SEARCH_SVG }),
      el("span", { class: "slt-m-side-search-label", text: "Search everything" }),
      el("kbd", { text: "Ctrl K" })
    );
    searchHint.addEventListener("click", openPalette);
    side.append(searchHint);
    const updateChip = el("button", { class: "slt-m-update-chip", type: "button" });
    updateChip.addEventListener("click", () => openWaitingUpdate(updateChip.getBoundingClientRect()));
    const reviewBtn = el(
      "button",
      { class: "slt-m-review-btn", type: "button", title: "Review everything you changed" },
      el("span", { class: "slt-m-review-icon", html: DIFF_SVG }),
      el("span", { class: "slt-m-review-label" })
    );
    reviewBtn.addEventListener("click", openReviewChanges);
    const peekBtn = iconButton("slt-m-peek", "Hold to peek at the lyrics (or hold P)", EYE_SVG);
    const bellBtn = iconButton("slt-m-bell", "Notifications", BELL_SVG);
    const closeBtn = iconButton("slt-m-close", "Close", CLOSE_SVG);
    closeBtn.addEventListener("click", () => {
      openSurfaces().find((s) => s.root.contains(container))?.close();
    });
    const main = el(
      "div",
      { class: "slt-m-main" },
      el(
        "header",
        { class: "slt-m-topbar" },
        el("div", { class: "slt-m-crumb" }, crumbTitle, crumbSub),
        el("div", { class: "slt-m-tools" }, updateChip, reviewBtn, peekBtn, bellBtn, closeBtn)
      ),
      tabContent
    );
    container.append(side, main);
    const syncBell = () => {
      const unread = unreadCount();
      bellBtn.classList.toggle("slt-m-has-unread", unread > 0);
      bellBtn.title = unread ? `Notifications (${unread} new)` : "Notifications";
    };
    bellBtn.addEventListener("click", () => {
      openInbox();
      syncBell();
    });
    const syncShell = () => {
      const searching = !!container.querySelector(".slt-m-cz-search")?.value.trim();
      catNav.querySelectorAll(".slt-m-side-item").forEach((btn) => {
        const on = activeTabId === "settings" && !searching && btn.dataset.target === activeCategoryId;
        btn.classList.toggle("active", on);
        btn.setAttribute("aria-selected", String(on));
      });
      catNav.classList.toggle("slt-m-cz-nav-muted", activeTabId === "settings" && searching);
      tabButtons.forEach((btn, tab) => btn.classList.toggle("active", tab === activeTabId));
      const category = SETTINGS_CATEGORIES.find((c) => c.id === activeCategoryId);
      const onSettings = activeTabId === "settings" && !!category;
      crumbTitle.textContent = onSettings ? category.label : TAB_META[activeTabId].label;
      crumbSub.textContent = onSettings ? category.description : TAB_META[activeTabId].description;
      container.dataset.tab = activeTabId;
      const changed = changedFields().length;
      reviewBtn.classList.toggle("slt-m-has-changes", changed > 0);
      reviewBtn.querySelector(".slt-m-review-label").textContent = changed ? `${changed} change${changed === 1 ? "" : "s"}` : "No changes";
      const waiting = hasWaitingUpdate();
      updateChip.hidden = !waiting;
      if (waiting)
        updateChip.textContent = waiting.kind === "hotfix" ? "Patch ready" : `v${waiting.version} ready`;
      syncBell();
    };
    syncChrome.push(syncShell);
    rerender();
    syncModelLists();
    const stopShortcuts = bindShortcuts(peekBtn, () => container.closest(".slt-ui-overlay"));
    const stopInbox = onInboxChange(syncBell);
    const waitObserver = new MutationObserver(syncShell);
    waitObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    const onFocus = () => refreshChrome();
    window.addEventListener("focus", onFocus);
    teardownLive = () => {
      stopShortcuts();
      stopInbox();
      waitObserver.disconnect();
      window.removeEventListener("focus", onFocus);
    };
    return container;
  }
  function ensureShellStyles() {
    if (document.getElementById("slt-shell-styles"))
      return;
    const style = document.createElement("style");
    style.id = "slt-shell-styles";
    style.textContent = SHELL_STYLES;
    document.head.appendChild(style);
  }
  var SHELL_STYLES = `
.slt-modal-root {
    --slt-m-accent: var(--slt-ui-accent, #1db954);
    --slt-m-accent-soft: var(--slt-ui-accent-soft, rgba(29, 185, 84, 0.12));
    --slt-m-accent-ink: var(--slt-ui-accent-ink, #000);
    --slt-m-bg-elev: color-mix(in oklab, var(--slt-ui-ink, #fff) 4%, transparent);
    --slt-m-border: var(--slt-ui-line, rgba(255, 255, 255, 0.08));
    --slt-m-text: var(--slt-ui-ink, #fff);
    --slt-m-text-dim: var(--slt-ui-ink-muted, #b3b3b3);
    --slt-m-text-faint: var(--slt-ui-ink-faint, #8a8a8a);
    --slt-m-radius: 12px;
    --slt-m-radius-sm: 9px;
    display: grid;
    grid-template-columns: 232px minmax(0, 1fr);
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    box-sizing: border-box;
    color: var(--slt-m-text);
    font-size: 13px;
    line-height: 1.4;
}
.slt-modal-root *, .slt-modal-root *::before, .slt-modal-root *::after { box-sizing: border-box; }
.slt-ui-panel.slt-settings-dialog { height: min(86vh, 820px); }
.slt-settings-dialog .slt-ui-body { overflow: hidden; height: 100%; }

.slt-modal-root .slt-m-side {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-height: 0;
    padding: 22px 14px 14px;
    border-right: 1px solid var(--slt-m-border);
    background: rgba(0, 0, 0, 0.12);
    overflow-y: auto;
}
.slt-modal-root .slt-m-brand { display: flex; align-items: center; gap: 10px; padding: 0 6px; }
.slt-modal-root .slt-m-brand-mark { display: inline-flex; color: var(--slt-m-text); }
.slt-modal-root .slt-m-brand-mark svg { width: 20px; height: 20px; }
.slt-modal-root .slt-m-brand-name { font-weight: 700; font-size: 13.5px; line-height: 1.2; }
.slt-modal-root .slt-m-brand-ver { font-size: 11px; color: var(--slt-m-text-dim); }
.slt-modal-root .slt-m-side-nav { display: flex; flex-direction: column; gap: 2px; flex: 1 1 auto; }
.slt-modal-root .slt-m-side-label {
    padding: 12px 10px 6px;
    font-size: 10.5px;
    font-weight: 750;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: var(--slt-m-text-faint);
}
.slt-modal-root .slt-m-cz-nav { display: flex; flex-direction: column; gap: 2px; transition: opacity 0.2s ease; }
.slt-modal-root .slt-m-cz-nav.slt-m-cz-nav-muted { opacity: 0.4; }
.slt-modal-root .slt-m-side-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    text-align: left;
    background: transparent;
    border: none;
    color: var(--slt-m-text-dim);
    padding: 8px 10px;
    border-radius: 10px;
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.18s cubic-bezier(0.16, 1, 0.3, 1), color 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}
.slt-modal-root .slt-m-side-item:hover { background: var(--slt-m-bg-elev); color: var(--slt-m-text); }
.slt-modal-root .slt-m-side-item.active { background: var(--slt-m-accent-soft); color: var(--slt-m-text); }
.slt-modal-root .slt-m-side-item.active::before {
    content: '';
    position: absolute;
    left: -14px;
    top: 8px;
    bottom: 8px;
    width: 3px;
    border-radius: 0 3px 3px 0;
    background: var(--slt-m-accent);
}
.slt-modal-root .slt-m-cz-nav-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    border-radius: 7px;
    background: var(--slt-m-bg-elev);
    font-size: 11px;
    line-height: 1;
    transition: background 0.18s ease, color 0.18s ease;
}
.slt-modal-root .slt-m-side-item.active .slt-m-cz-nav-icon { background: var(--slt-m-accent); color: var(--slt-m-accent-ink); }
.slt-modal-root .slt-m-side-search {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 9px 10px;
    border-radius: 11px;
    border: 1px solid var(--slt-m-border);
    background: var(--slt-m-bg-elev);
    color: var(--slt-m-text-dim);
    font: inherit;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 0.18s ease, color 0.18s ease;
}
.slt-modal-root .slt-m-side-search:hover { border-color: var(--slt-ui-accent-line, var(--slt-m-accent)); color: var(--slt-m-text); }
.slt-modal-root .slt-m-side-search-icon { display: inline-flex; }
.slt-modal-root .slt-m-side-search-label { flex: 1; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.slt-modal-root:not(.slt-m-searching) .slt-m-cz-cat-head { display: none; }
.slt-modal-root kbd, .slt-m-pal kbd {
    display: inline-flex;
    align-items: center;
    padding: 1px 6px;
    border-radius: 6px;
    border: 1px solid var(--slt-ui-line, rgba(255,255,255,0.12));
    background: color-mix(in oklab, var(--slt-ui-ink, #fff) 6%, transparent);
    font-family: inherit;
    font-size: 10.5px;
    font-weight: 700;
    color: var(--slt-ui-ink-muted, #b3b3b3);
}

.slt-modal-root .slt-m-main { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.slt-modal-root .slt-m-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 20px 18px 14px 26px;
    border-bottom: 1px solid var(--slt-m-border);
}
.slt-modal-root .slt-m-crumb { min-width: 0; }
.slt-modal-root .slt-m-crumb-title { font-size: 20px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.2; }
.slt-modal-root .slt-m-crumb-sub {
    margin-top: 2px;
    font-size: 12.5px;
    color: var(--slt-m-text-dim);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.slt-modal-root .slt-m-tools { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.slt-modal-root .slt-m-icon-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 10px;
    background: transparent;
    color: var(--slt-m-text-dim);
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
.slt-modal-root .slt-m-icon-btn:hover { background: var(--slt-m-bg-elev); color: var(--slt-m-text); }
.slt-modal-root .slt-m-peek:active { background: var(--slt-m-accent-soft); color: var(--slt-m-text); border-color: var(--slt-ui-accent-line, var(--slt-m-accent)); }
.slt-modal-root .slt-m-bell.slt-m-has-unread::after {
    content: '';
    position: absolute;
    top: 7px;
    right: 7px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--slt-m-accent);
    box-shadow: 0 0 0 2px var(--slt-ui-field, #111);
}
.slt-modal-root .slt-m-review-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 34px;
    padding: 0 12px;
    border-radius: 10px;
    border: 1px solid var(--slt-m-border);
    background: transparent;
    color: var(--slt-m-text-dim);
    font: inherit;
    font-size: 12.5px;
    font-weight: 650;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
}
.slt-modal-root .slt-m-review-btn:hover { background: var(--slt-m-bg-elev); color: var(--slt-m-text); }
.slt-modal-root .slt-m-review-btn.slt-m-has-changes { color: var(--slt-m-text); }
.slt-modal-root .slt-m-review-icon { display: inline-flex; }
.slt-modal-root .slt-m-update-chip {
    height: 34px;
    padding: 0 12px;
    border: 0;
    border-radius: 10px;
    background: var(--slt-m-accent);
    color: var(--slt-m-accent-ink);
    font: inherit;
    font-size: 12.5px;
    font-weight: 750;
    cursor: pointer;
}
.slt-modal-root .slt-m-update-chip[hidden] { display: none; }
.slt-modal-root .slt-m-icon-btn:focus-visible,
.slt-modal-root .slt-m-review-btn:focus-visible,
.slt-modal-root .slt-m-update-chip:focus-visible,
.slt-modal-root .slt-m-side-item:focus-visible,
.slt-modal-root .slt-m-side-search:focus-visible,
.slt-modal-root .slt-m-btn:focus-visible,
.slt-modal-root .slt-m-field-reset:focus-visible,
.slt-modal-root .slt-m-reveal:focus-visible {
    outline: 2px solid var(--slt-m-accent);
    outline-offset: 2px;
}

.slt-modal-root .slt-m-enabled-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: var(--slt-m-bg-elev);
    border: 1px solid var(--slt-m-border);
    border-radius: var(--slt-m-radius);
}
.slt-modal-root .slt-m-enabled-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.slt-modal-root .slt-m-enabled-title { font-weight: 750; font-size: 12.5px; }
.slt-modal-root .slt-m-enabled-sub {
    font-size: 11px;
    color: var(--slt-m-text-dim);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.slt-modal-root .slt-m-toggle { position: relative; width: 38px; height: 22px; flex-shrink: 0; display: inline-block; }
.slt-modal-root .slt-m-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
.slt-modal-root .slt-m-toggle-slider {
    position: absolute;
    inset: 0;
    background: rgba(255, 255, 255, 0.18);
    border-radius: 22px;
    cursor: pointer;
    transition: background 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}
.slt-modal-root .slt-m-toggle-slider::before {
    content: '';
    position: absolute;
    width: 16px;
    height: 16px;
    left: 3px;
    top: 3px;
    background: #fff;
    border-radius: 50%;
    transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), background 0.22s ease;
}
.slt-modal-root .slt-m-toggle input:checked + .slt-m-toggle-slider { background: var(--slt-m-accent); }
.slt-modal-root .slt-m-toggle input:checked + .slt-m-toggle-slider::before { transform: translateX(16px); background: var(--slt-ui-knob, #fff); }
.slt-modal-root .slt-m-toggle input:focus-visible + .slt-m-toggle-slider { outline: 2px solid var(--slt-m-accent); outline-offset: 2px; }

.slt-modal-root .slt-m-tab-host {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-gutter: stable;
    padding: 18px 20px 26px 26px;
}
.slt-modal-root .slt-m-tab-host::-webkit-scrollbar { width: 8px; }
.slt-modal-root .slt-m-tab-host::-webkit-scrollbar-thumb { background: var(--slt-m-border); border-radius: 8px; border: 2px solid transparent; background-clip: padding-box; }
.slt-modal-root .slt-m-tab-content { display: flex; flex-direction: column; gap: 12px; animation: slt-m-tab-in 0.28s cubic-bezier(0.16, 1, 0.3, 1); }
.slt-modal-root .slt-m-cz { gap: 0; }
.slt-modal-root .slt-m-cz-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 12px;
    margin-bottom: 14px;
    border: 1px solid var(--slt-m-border);
    border-radius: var(--slt-m-radius);
    background: rgba(255, 255, 255, 0.03);
    transition: border-color 0.2s ease;
}
.slt-modal-root .slt-m-cz-toolbar:focus-within { border-color: var(--slt-m-accent); }
.slt-modal-root .slt-m-cz-search-icon { display: flex; align-items: center; color: var(--slt-m-text-dim); flex-shrink: 0; line-height: 0; }
.slt-modal-root .slt-m-cz-search {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    padding: 2px 0;
    color: var(--slt-m-text);
    font: inherit;
    font-size: 13px;
    outline: none;
}
.slt-modal-root .slt-m-cz-search::placeholder { color: var(--slt-m-text-faint); }
.slt-modal-root .slt-m-cz-clear {
    background: transparent;
    border: none;
    color: var(--slt-m-text-dim);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 3px 6px;
    border-radius: 4px;
    cursor: pointer;
    flex-shrink: 0;
}
.slt-modal-root .slt-m-cz-clear:hover { color: var(--slt-m-text); background: rgba(255, 255, 255, 0.08); }
.slt-modal-root .slt-m-cz-status { font-size: 12px; color: var(--slt-m-text-dim); padding: 0 2px 10px; }
.slt-modal-root .slt-m-cz-status-empty { color: var(--slt-m-text); }
.slt-modal-root .slt-m-cz-sections { display: flex; flex-direction: column; gap: 22px; min-width: 0; }
.slt-modal-root .slt-m-cz-category { display: flex; flex-direction: column; gap: 10px; animation: slt-m-tab-in 0.22s cubic-bezier(0.16, 1, 0.3, 1); }
.slt-modal-root .slt-m-cz-cat-head { padding-bottom: 9px; border-bottom: 1px solid var(--slt-m-border); }
.slt-modal-root .slt-m-cz-cat-title { font-size: 15px; font-weight: 800; color: var(--slt-m-text); }
.slt-modal-root .slt-m-cz-cat-desc { font-size: 12px; line-height: 1.45; color: var(--slt-m-text-dim); margin-top: 3px; }

.slt-modal-root .slt-m-section {
    background: var(--slt-m-bg-elev);
    border: 1px solid var(--slt-m-border);
    border-radius: var(--slt-m-radius);
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
    transition: border-color 0.24s cubic-bezier(0.16, 1, 0.3, 1);
}
.slt-modal-root .slt-m-section:hover { border-color: rgba(255, 255, 255, 0.16); }
.slt-modal-root .slt-m-section-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--slt-m-text-dim);
    margin-bottom: 2px;
}
.slt-modal-root .slt-m-field {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(190px, 300px);
    align-items: center;
    gap: 14px;
    min-height: 40px;
    padding: 7px 0;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
}
.slt-modal-root .slt-m-section-title + .slt-m-field { border-top: none; padding-top: 2px; }
.slt-modal-root .slt-m-field-toggle { grid-template-columns: minmax(0, 1fr) max-content; }
.slt-modal-root .slt-m-field-labelbox { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.slt-modal-root .slt-m-field-label { min-width: 0; font-size: 13px; color: var(--slt-m-text); line-height: 1.3; display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.slt-modal-root .slt-m-field-hint { font-size: 11.5px; line-height: 1.45; color: var(--slt-m-text-dim); max-width: 52ch; }
.slt-modal-root .slt-m-badge {
    padding: 1px 7px;
    border-radius: 999px;
    background: var(--slt-m-accent-soft);
    color: var(--slt-m-text);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.02em;
    white-space: nowrap;
}
.slt-modal-root .slt-m-field-control { display: flex; align-items: center; gap: 8px; justify-content: flex-end; min-width: 0; width: 100%; }
.slt-modal-root .slt-m-field-reset,
.slt-modal-root .slt-m-reveal {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    flex: 0 0 24px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--slt-m-text-dim);
    cursor: pointer;
    transition: opacity 0.18s ease, background 0.18s ease, color 0.18s ease;
}
.slt-modal-root .slt-m-field-reset { visibility: hidden; opacity: 0; }
.slt-modal-root .slt-m-field-reset-on { visibility: visible; opacity: 0.45; }
.slt-modal-root .slt-m-field-reset-on:hover,
.slt-modal-root .slt-m-field-reset-on:focus-visible,
.slt-modal-root .slt-m-reveal:hover,
.slt-modal-root .slt-m-reveal.on { opacity: 1; color: var(--slt-m-text); background: rgba(255, 255, 255, 0.1); }
.slt-modal-root .slt-m-reveal svg { width: 14px; height: 14px; }
.slt-modal-root .slt-m-select,
.slt-modal-root .slt-m-text {
    background-color: rgba(0, 0, 0, 0.3);
    border: 1px solid var(--slt-m-border);
    color: var(--slt-m-text);
    padding: 7px 10px;
    border-radius: var(--slt-m-radius-sm);
    font: inherit;
    font-size: 13px;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    min-height: 34px;
    outline: none;
    text-overflow: ellipsis;
    transition: border-color 0.2s ease, background-color 0.2s ease;
}
.slt-modal-root .slt-m-select {
    appearance: none;
    -webkit-appearance: none;
    padding-right: 30px;
    cursor: pointer;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.55)' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><path d='M6 9l6 6 6-6'/></svg>");
    background-repeat: no-repeat;
    background-position: right 10px center;
}
.slt-modal-root .slt-m-select option { background-color: #1c1c1f; color: #fff; }
.slt-modal-root .slt-m-field-languages { align-items: start; }
.slt-modal-root .slt-m-langs-box { display: flex; flex-direction: column; gap: 6px; flex: 1 1 auto; min-width: 0; }
.slt-modal-root .slt-m-langs { display: flex; flex-wrap: wrap; gap: 5px; }
.slt-modal-root .slt-m-langs:empty { display: none; }
.slt-modal-root .slt-m-lang {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 3px 2px 9px;
    border-radius: 999px;
    background: var(--slt-m-accent-soft);
    color: var(--slt-m-text);
    font-size: 12px;
    line-height: 18px;
}
.slt-modal-root .slt-m-lang-remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--slt-m-text-dim);
    cursor: pointer;
}
.slt-modal-root .slt-m-lang-remove:hover,
.slt-modal-root .slt-m-lang-remove:focus-visible { color: var(--slt-m-text); background: rgba(255, 255, 255, 0.12); }
.slt-modal-root .slt-m-lang-remove svg { width: 10px; height: 10px; }
.slt-modal-root .slt-m-select:focus,
.slt-modal-root .slt-m-text:focus { border-color: var(--slt-m-accent); background-color: rgba(0, 0, 0, 0.45); }
.slt-modal-root .slt-m-text::placeholder { color: var(--slt-m-text-faint); }
.slt-modal-root .slt-m-field.slt-m-spot { border-radius: 10px; animation: slt-m-spot 2.2s cubic-bezier(0.2, 0.9, 0.1, 1); }
@keyframes slt-m-spot {
    0% { box-shadow: 0 0 0 0 var(--slt-m-accent); background: var(--slt-m-accent-soft); }
    20% { box-shadow: 0 0 0 3px var(--slt-ui-accent-line, var(--slt-m-accent)); background: var(--slt-m-accent-soft); }
    100% { box-shadow: 0 0 0 0 transparent; background: transparent; }
}

.slt-modal-root .slt-m-btn {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--slt-m-border);
    color: var(--slt-m-text);
    padding: 7px 12px;
    border-radius: var(--slt-m-radius-sm);
    font: inherit;
    font-size: 12.5px;
    font-weight: 650;
    cursor: pointer;
    min-height: 34px;
    transition: background 0.2s ease, transform 0.16s ease, opacity 0.2s ease, border-color 0.2s ease;
}
.slt-modal-root .slt-m-btn:hover:not(:disabled) { background: rgba(255, 255, 255, 0.12); }
.slt-modal-root .slt-m-btn:active:not(:disabled) { transform: scale(0.98); }
.slt-modal-root .slt-m-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.slt-modal-root .slt-m-btn-primary { background: var(--slt-m-accent); color: var(--slt-m-accent-ink); border-color: var(--slt-m-accent); }
.slt-modal-root .slt-m-btn-primary:hover:not(:disabled) { background: var(--slt-ui-accent-hover, var(--slt-m-accent)); }
.slt-modal-root .slt-m-btn-danger { background: rgba(231, 76, 60, 0.12); border-color: rgba(231, 76, 60, 0.4); color: #f08272; }
.slt-modal-root .slt-m-btn-danger:hover:not(:disabled) { background: rgba(231, 76, 60, 0.22); }
.slt-modal-root .slt-m-btn-armed { background: rgba(231, 76, 60, 0.85); border-color: transparent; color: #fff; }
.slt-modal-root .slt-m-btn-armed:hover:not(:disabled) { background: rgba(231, 76, 60, 0.95); }

.slt-modal-root .slt-m-about-hero { display: flex; align-items: baseline; flex-wrap: wrap; gap: 10px; }
.slt-modal-root .slt-m-about-title { font-size: 18px; font-weight: 800; }
.slt-modal-root .slt-m-about-version {
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    font-size: 12px;
    color: var(--slt-m-text);
    background: var(--slt-m-accent-soft);
    padding: 2px 8px;
    border-radius: 6px;
}
.slt-modal-root .slt-m-about-hash {
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    font-size: 11px;
    color: var(--slt-m-text-dim);
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--slt-m-border);
    padding: 2px 7px;
    border-radius: 6px;
    user-select: all;
}
.slt-modal-root .slt-m-about-text { font-size: 12.5px; color: var(--slt-m-text-dim); line-height: 1.5; }
.slt-modal-root .slt-m-about-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 4px; }
.slt-modal-root .slt-m-about-links { display: flex; gap: 14px; flex-wrap: wrap; }
.slt-modal-root .slt-m-about-links a { color: var(--slt-m-text); text-decoration: underline; text-decoration-color: var(--slt-ui-accent-line, var(--slt-m-border)); text-underline-offset: 3px; font-size: 13px; font-weight: 600; }
.slt-modal-root .slt-m-about-links a:hover { text-decoration-color: var(--slt-m-accent); }
.slt-modal-root .slt-m-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; margin-top: 4px; }
.slt-modal-root .slt-m-stat { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: var(--slt-m-radius-sm); background: rgba(0, 0, 0, 0.2); }
.slt-modal-root .slt-m-stat-value { font-size: 16px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--slt-m-text); }
.slt-modal-root .slt-m-stat-label { font-size: 11px; color: var(--slt-m-text-faint); }
.slt-modal-root .slt-m-meter { height: 6px; border-radius: 6px; background: rgba(255, 255, 255, 0.08); overflow: hidden; margin: 4px 0 2px; }
.slt-modal-root .slt-m-meter i { display: block; height: 100%; border-radius: 6px; background: var(--slt-m-accent); }
.slt-modal-root .slt-m-conn-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.slt-modal-root .slt-m-conn-status { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; color: var(--slt-m-text-dim); }
.slt-modal-root .slt-m-conn-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--slt-m-text-faint); }
.slt-modal-root .slt-m-conn-connecting, .slt-modal-root .slt-m-conn-reconnecting { background: #ffd35c; }
.slt-modal-root .slt-m-conn-error { background: #f1556c; }
.slt-modal-root .slt-m-conn-connected, .slt-modal-root .slt-m-conn-dot.slt-m-lat-great { background: #1ed760; }
.slt-modal-root .slt-m-conn-dot.slt-m-lat-ok { background: #ffd35c; }
.slt-modal-root .slt-m-conn-dot.slt-m-lat-bad { background: #ff9f45; }
.slt-modal-root .slt-m-conn-dot.slt-m-lat-horrible { background: #f1556c; }
.slt-modal-root .slt-m-stat-value.slt-m-lat-great { color: #1ed760; }
.slt-modal-root .slt-m-stat-value.slt-m-lat-ok { color: #ffd35c; }
.slt-modal-root .slt-m-stat-value.slt-m-lat-bad { color: #ff9f45; }
.slt-modal-root .slt-m-stat-value.slt-m-lat-horrible { color: #f1556c; }
.slt-modal-root .slt-m-shortcut { display: flex; align-items: center; gap: 12px; padding: 6px 0; font-size: 12.5px; color: var(--slt-m-text-dim); }
.slt-modal-root .slt-m-shortcut + .slt-m-shortcut { border-top: 1px solid rgba(255, 255, 255, 0.04); }
.slt-modal-root .slt-m-shortcut-keys { display: inline-flex; gap: 4px; min-width: 92px; }

.slt-m-rv-list { display: flex; flex-direction: column; gap: 6px; }
.slt-m-rv-list[hidden] { display: none; }
.slt-m-rv-row {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1.4fr) auto;
    align-items: center;
    gap: 14px;
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid var(--slt-ui-line);
    background: color-mix(in oklab, var(--slt-ui-ink) 3%, transparent);
}
.slt-m-rv-head { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.slt-m-rv-label { padding: 0; border: 0; background: none; color: var(--slt-ui-ink); font: inherit; font-size: 13.5px; font-weight: 650; text-align: left; cursor: pointer; }
.slt-m-rv-label:hover { text-decoration: underline; text-decoration-color: var(--slt-ui-accent-line); text-underline-offset: 3px; }
.slt-m-rv-where { font-size: 11.5px; color: var(--slt-ui-ink-faint); }
.slt-m-rv-diff { display: flex; align-items: center; gap: 10px; min-width: 0; flex-wrap: wrap; }
.slt-m-rv-value { min-width: 0; font-family: 'JetBrains Mono', ui-monospace, Consolas, monospace; font-size: 12px; color: var(--slt-ui-ink-muted); overflow-wrap: anywhere; }
.slt-m-rv-value:last-child { color: var(--slt-ui-ink); }
.slt-m-rv-arrow { width: 14px; height: 1px; background: var(--slt-ui-ink-faint); flex: 0 0 auto; }
.slt-m-rv-revert,
.slt-m-inbox-btn {
    padding: 6px 12px;
    border-radius: 9px;
    border: 1px solid var(--slt-ui-line);
    background: transparent;
    color: var(--slt-ui-ink);
    font: inherit;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
}
.slt-m-rv-revert:hover, .slt-m-inbox-btn:hover { background: var(--slt-ui-line); }

.slt-m-pal-dialog { --slt-ui-w: 38rem; }
.slt-m-pal { display: flex; flex-direction: column; max-height: min(68vh, 560px); }
.slt-m-pal-bar { display: flex; align-items: center; gap: 12px; padding: 18px 20px 14px; border-bottom: 1px solid var(--slt-ui-line); color: var(--slt-ui-ink-muted); }
.slt-m-pal-icon { display: inline-flex; }
.slt-m-pal-input { flex: 1; min-width: 0; border: 0; outline: none; background: transparent; color: var(--slt-ui-ink); font: inherit; font-size: 17px; font-weight: 550; }
.slt-m-pal-input::placeholder { color: var(--slt-ui-ink-faint); }
.slt-m-pal-results { overflow-y: auto; padding: 8px; min-height: 120px; }
.slt-m-pal-results::-webkit-scrollbar { width: 6px; }
.slt-m-pal-results::-webkit-scrollbar-thumb { background: var(--slt-ui-line); border-radius: 6px; }
.slt-m-pal-group { padding: 10px 12px 4px; font-size: 10.5px; font-weight: 750; text-transform: uppercase; letter-spacing: 0.09em; color: var(--slt-ui-ink-faint); }
.slt-m-pal-item {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 14px;
    width: 100%;
    padding: 9px 12px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: var(--slt-ui-ink);
    font: inherit;
    font-size: 13.5px;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
}
.slt-m-pal-item.active { background: var(--slt-ui-accent-soft); box-shadow: inset 2px 0 0 var(--slt-ui-accent); }
.slt-m-pal-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.slt-m-pal-hint { flex: 0 1 auto; min-width: 0; max-width: 55%; font-size: 12px; font-weight: 500; color: var(--slt-ui-ink-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.slt-m-pal-empty { padding: 28px 12px; text-align: center; color: var(--slt-ui-ink-faint); font-size: 13px; }
.slt-m-pal-foot { display: flex; gap: 16px; padding: 10px 20px; border-top: 1px solid var(--slt-ui-line); font-size: 11.5px; color: var(--slt-ui-ink-faint); }
.slt-m-pal-foot kbd { margin-right: 3px; }

.slt-m-inbox { display: flex; flex-direction: column; gap: 6px; }
.slt-m-inbox-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: start;
    gap: 12px;
    padding: 12px;
    border-radius: 12px;
    border: 1px solid var(--slt-ui-line);
    background: color-mix(in oklab, var(--slt-ui-ink) 3%, transparent);
}
.slt-m-inbox-row.unread { border-color: var(--slt-ui-accent-line); }
.slt-m-inbox-dot { width: 9px; height: 9px; margin-top: 5px; border-radius: 50%; background: var(--slt-ui-accent); }
.slt-m-inbox-title { font-weight: 650; font-size: 13.5px; }
.slt-m-inbox-desc { font-size: 12.5px; color: var(--slt-ui-ink-muted); margin-top: 2px; overflow-wrap: anywhere; }
.slt-m-inbox-time { font-size: 11.5px; color: var(--slt-ui-ink-faint); margin-top: 4px; }
.slt-m-inbox-empty { padding: 26px 8px; text-align: center; }
.slt-m-inbox-empty-title { font-weight: 750; font-size: 15px; color: var(--slt-ui-ink); }
.slt-m-inbox-empty-sub { font-size: 13px; color: var(--slt-ui-ink-faint); margin-top: 4px; }

@keyframes slt-m-tab-in {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 760px) {
    .slt-modal-root { grid-template-columns: 1fr; grid-template-rows: auto minmax(0, 1fr); }
    .slt-modal-root .slt-m-side { flex-direction: row; flex-wrap: wrap; align-items: center; padding: 12px; border-right: 0; border-bottom: 1px solid var(--slt-m-border); overflow: visible; }
    .slt-modal-root .slt-m-side-nav { flex-direction: row; flex-wrap: wrap; flex-basis: 100%; }
    .slt-modal-root .slt-m-side-label,
    .slt-modal-root .slt-m-side-item-label,
    .slt-modal-root .slt-m-side-search-label,
    .slt-modal-root .slt-m-side-search kbd,
    .slt-modal-root .slt-m-enabled-sub { display: none; }
    .slt-modal-root .slt-m-cz-nav { flex-direction: row; flex-wrap: wrap; }
    .slt-modal-root .slt-m-side-item { width: auto; }
    .slt-modal-root .slt-m-side-item.active::before { display: none; }
    .slt-modal-root .slt-m-side-search { width: auto; }
    .slt-modal-root .slt-m-topbar { padding: 14px 12px; flex-wrap: wrap; }
    .slt-modal-root .slt-m-review-label { display: none; }
    .slt-modal-root .slt-m-tab-host { padding: 14px 12px 20px; }
    .slt-modal-root .slt-m-field { grid-template-columns: 1fr; align-items: start; gap: 6px; }
    .slt-modal-root .slt-m-field-toggle { grid-template-columns: minmax(0, 1fr) max-content; align-items: center; }
    .slt-modal-root .slt-m-field-reset { visibility: visible; opacity: 0; }
    .slt-modal-root .slt-m-field-reset-on { opacity: 0.6; }
    .slt-m-rv-row { grid-template-columns: 1fr; }
}

@media (prefers-reduced-motion: reduce) {
    .slt-modal-root .slt-m-tab-content, .slt-modal-root .slt-m-cz-category { animation: none; }
    .slt-modal-root *, .slt-modal-root *::before, .slt-modal-root *::after {
        transition-duration: 0.01ms !important;
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
    }
}
`;

  // src/utils/settings.ts
  var SETTINGS_ID = "spicy-lyric-translator-settings";
  var SPICY_LYRICS_CACHE_NAMES2 = ["SpicyLyrics_LyricsStore_g1", "SpicyLyrics_LyricsStore"];
  var LEGACY_ENCORE_PREFIX = "e-10310-";
  var nativeClassMap = /* @__PURE__ */ new Map();
  var nativeEncorePrefix = null;
  function classTokens(element) {
    return element ? Array.from(element.classList) : [];
  }
  function readNativeSettingsClasses(page) {
    const own = document.getElementById(SETTINGS_ID);
    const native = (selector) => Array.from(page.querySelectorAll(selector)).find((element) => !own?.contains(element)) ?? null;
    const map = /* @__PURE__ */ new Map();
    const set = (legacy2, tokens) => {
      const live2 = tokens.filter((token) => token && token !== legacy2);
      if (live2.length > 0)
        map.set(legacy2, live2);
    };
    const row = native("[data-settings-row]");
    if (row) {
      set("x-settings-row", classTokens(row));
      set("x-settings-firstColumn", classTokens(row.children[0]).slice(0, 1));
      set("x-settings-secondColumn", classTokens(row.children[1]).slice(0, 1));
      if (row.parentElement?.parentElement === page)
        set("x-settings-section", classTokens(row.parentElement));
    }
    const toggle = native('[data-settings-row] input[type="checkbox"]');
    if (toggle) {
      const indicatorWrapper = toggle.nextElementSibling;
      set("x-toggle-input", classTokens(toggle));
      set("x-toggle-wrapper", classTokens(toggle.closest("label")));
      set("x-toggle-indicatorWrapper", classTokens(indicatorWrapper));
      set("x-toggle-indicator", classTokens(indicatorWrapper?.firstElementChild));
    }
    set("main-dropDown-dropDown", classTokens(native("[data-settings-row] select")));
    set("x-settings-button", classTokens(native('[data-settings-row] button[data-encore-id="buttonSecondary"]')).filter((token) => !/^(e-\d+-|encore-)/.test(token)));
    const text3 = native('[data-encore-id="text"]');
    const prefix = text3?.className.match(/\b(e-\d+-)text\b/)?.[1] ?? null;
    nativeEncorePrefix = prefix && prefix !== LEGACY_ENCORE_PREFIX ? prefix : null;
    nativeClassMap = map;
  }
  function adoptNativeSettingsClasses(root) {
    if (nativeClassMap.size === 0 && !nativeEncorePrefix)
      return;
    const elements = [root, ...Array.from(root.querySelectorAll("[class]"))];
    for (const element of elements) {
      const additions = [];
      for (const token of Array.from(element.classList)) {
        const mapped = nativeClassMap.get(token);
        if (mapped)
          additions.push(...mapped);
        if (nativeEncorePrefix && token.startsWith(LEGACY_ENCORE_PREFIX)) {
          additions.push(nativeEncorePrefix + token.slice(LEGACY_ENCORE_PREFIX.length));
        }
      }
      if (additions.length > 0)
        element.classList.add(...additions);
    }
  }
  function clearAllCachedTranslations() {
    clearTranslationCache();
    clearWordBreakdownCache();
    notify({ kind: "success", key: "slt-cache", title: "Cached translations deleted", description: "Songs will be translated fresh the next time they play." });
  }
  async function clearSpicyLyricsCachedLyrics() {
    try {
      clearLyricsCache();
      if (typeof caches !== "undefined" && typeof caches.delete === "function") {
        await Promise.all(SPICY_LYRICS_CACHE_NAMES2.map((name) => caches.delete(name)));
      }
      notify({ kind: "success", key: "slt-cache", title: "Spicy Lyrics cache cleared", description: "Lyrics will be downloaded again as songs play." });
    } catch (e) {
      notify({ kind: "error", key: "slt-cache", title: "Couldn't clear the Spicy Lyrics cache", description: e instanceof Error ? e.message : void 0 });
    }
  }
  function createNativeToggle(id, label, checked, onChange) {
    const row = document.createElement("div");
    row.className = "x-settings-row";
    row.dataset.settingsRow = "true";
    row.innerHTML = `
        <div class="x-settings-firstColumn">
            <label class="e-10310-text encore-text-body-small encore-internal-color-text-subdued" for="${id}">${label}</label>
        </div>
        <div class="x-settings-secondColumn">
            <label class="x-toggle-wrapper">
                <input id="${id}" class="x-toggle-input" type="checkbox" ${checked ? "checked" : ""}>
                <span class="x-toggle-indicatorWrapper">
                    <span class="x-toggle-indicator"></span>
                </span>
            </label>
        </div>
    `;
    const input = row.querySelector("input");
    input?.addEventListener("change", () => onChange(input.checked));
    return row;
  }
  function createNativeDropdown(id, label, options, currentValue, onChange) {
    const row = document.createElement("div");
    row.className = "x-settings-row";
    row.dataset.settingsRow = "true";
    row.innerHTML = `
        <div class="x-settings-firstColumn">
            <label class="e-10310-text encore-text-body-small encore-internal-color-text-subdued" for="${id}">${label}</label>
        </div>
        <div class="x-settings-secondColumn">
            <span>
                <select class="main-dropDown-dropDown" id="${id}">
                    ${options.map((opt) => `<option value="${escapeHtml3(opt.value)}" ${opt.value === currentValue ? "selected" : ""}>${escapeHtml3(opt.text)}</option>`).join("")}
                </select>
            </span>
        </div>
    `;
    const select = row.querySelector("select");
    select?.addEventListener("change", () => onChange(select.value));
    return row;
  }
  function createNativeButton(id, label, buttonText, onClick) {
    const row = document.createElement("div");
    row.className = "x-settings-row";
    row.dataset.settingsRow = "true";
    row.innerHTML = `
        <div class="x-settings-firstColumn">
            <label class="e-10310-text encore-text-body-small encore-internal-color-text-subdued" for="${id}">${label}</label>
        </div>
        <div class="x-settings-secondColumn">
            <button id="${id}" class="encore-text-body-small-bold e-10310-legacy-button--small e-10310-legacy-button-secondary--text-base encore-internal-color-text-base e-10310-legacy-button e-10310-legacy-button-secondary e-10310-overflow-wrap-anywhere x-settings-button" data-encore-id="buttonSecondary" type="button">${buttonText}</button>
        </div>
    `;
    const button = row.querySelector("button");
    button?.addEventListener("click", onClick);
    return row;
  }
  function createNativeLanguageList(id, label, options, currentValue, placeholder, onChange) {
    const row = document.createElement("div");
    row.className = "x-settings-row";
    row.dataset.settingsRow = "true";
    row.innerHTML = `
        <div class="x-settings-firstColumn">
            <label class="e-10310-text encore-text-body-small encore-internal-color-text-subdued" for="${id}">${label}</label>
        </div>
        <div class="x-settings-secondColumn">
            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
                <div class="slt-native-langs" style="display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; max-width: 320px;"></div>
                <select class="main-dropDown-dropDown" id="${id}"></select>
            </div>
        </div>
    `;
    const chips = row.querySelector(".slt-native-langs");
    const select = row.querySelector("select");
    let selected = parseLanguageList(currentValue);
    const nameOf = (code) => options.find((option) => option.value === code)?.text || code.toUpperCase();
    const commit = (next) => {
      selected = next;
      render();
      onChange(selected.join(","));
    };
    const render = () => {
      chips.replaceChildren(...selected.map((code) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "encore-text-body-small e-10310-legacy-button--small e-10310-legacy-button-secondary--text-base encore-internal-color-text-base e-10310-legacy-button e-10310-legacy-button-secondary x-settings-button";
        chip.textContent = `${nameOf(code)} \xD7`;
        chip.title = `Remove ${nameOf(code)}`;
        chip.addEventListener("click", () => commit(selected.filter((c) => c !== code)));
        return chip;
      }));
      select.innerHTML = `<option value="">${escapeHtml3(placeholder)}</option>` + options.filter((option) => !selected.includes(option.value)).map((option) => `<option value="${escapeHtml3(option.value)}">${escapeHtml3(option.text)}</option>`).join("");
      select.value = "";
      adoptNativeSettingsClasses(chips);
    };
    select.addEventListener("change", () => {
      if (select.value)
        commit([...selected, select.value]);
    });
    render();
    return row;
  }
  function createNativeInput(id, label, type, currentValue, placeholder, onChange) {
    const row = document.createElement("div");
    row.className = "x-settings-row";
    row.dataset.settingsRow = "true";
    row.innerHTML = `
        <div class="x-settings-firstColumn">
            <label class="e-10310-text encore-text-body-small encore-internal-color-text-subdued" for="${id}">${label}</label>
        </div>
        <div class="x-settings-secondColumn">
            <input type="${type}" id="${id}" class="main-dropDown-dropDown" style="width: 200px;" value="" placeholder="${escapeHtml3(placeholder)}" autocomplete="off" spellcheck="false" data-form-type="other">
        </div>
    `;
    const input = row.querySelector("input");
    if (input)
      input.value = currentValue;
    input?.addEventListener("change", () => onChange(input.value));
    return row;
  }
  function runSettingEffects(effects, value, deferRetranslate = false) {
    if (effects.includes("qualityIndicatorClass")) {
      document.body.classList.toggle("slt-hide-quality-indicator", !Boolean(value));
    }
    if (effects.includes("connectionIndicatorClass")) {
      setConnectionIndicatorHidden(Boolean(value));
    }
    if (effects.includes("romanizationDisplay")) {
      setOverlayRomanization(Boolean(value));
    }
    if (effects.includes("learningModeClass")) {
      setOverlayLearningMode(isLearningActive());
      syncLearningButton();
    }
    const retranslate = effects.includes("romanizationDisplay") || effects.includes("reapplyTranslations") || effects.includes("retranslate");
    if (retranslate && !deferRetranslate)
      forceRetranslate();
    return retranslate;
  }
  function applySettingById(id, value) {
    const field = getSettingField(id);
    if (!field)
      return;
    const effects = writeSettingValue(field, value);
    runSettingEffects(effects, value);
  }
  function applySettingsBatch(changes) {
    let retranslate = false;
    let refreshModels = false;
    for (const { field, value } of changes) {
      const effects = writeSettingValue(field, value);
      if (runSettingEffects(effects, value, true))
        retranslate = true;
      if (field.id.endsWith("-api-key"))
        refreshModels = true;
    }
    if (retranslate)
      forceRetranslate();
    if (refreshModels)
      syncModelLists({ force: true });
  }
  function updateSettingFieldVisibility(root, visibleDisplay) {
    const api = getCurrentApiPreference();
    SETTINGS_SCHEMA.forEach((field) => {
      const row = root.querySelector(`[data-slt-setting-field="${field.id}"]`);
      if (row) {
        row.style.display = isSettingFieldVisible(field, api) ? visibleDisplay : "none";
      }
    });
  }
  function rebuildModelSelects(fieldIds) {
    for (const fieldId of fieldIds) {
      const field = getSettingField(fieldId);
      if (!field)
        continue;
      const value = String(readSettingValue(field));
      for (const elementId of [getNativeSettingInputId(field), getModalSettingInputId(field)]) {
        const select = document.getElementById(elementId);
        if (!(select instanceof HTMLSelectElement))
          continue;
        select.replaceChildren(...(field.options || []).map((option) => {
          const element = document.createElement("option");
          element.value = option.value;
          element.textContent = option.text;
          return element;
        }));
        select.value = value;
      }
    }
  }
  function syncModelLists(options = {}) {
    refreshProviderModelLists(options).then(rebuildModelSelects).catch(() => void 0);
  }
  function handleSettingChange(field, value, root, visibleDisplay = "") {
    const effects = writeSettingValue(field, value);
    runSettingEffects(effects, value);
    if ((effects.includes("providerVisibility") || effects.includes("fieldVisibility")) && root) {
      updateSettingFieldVisibility(root, visibleDisplay);
    }
    if (field.id.endsWith("-api-key")) {
      syncModelLists({ fieldId: field.id, force: true });
    }
  }
  function getNativeSettingInputId(field) {
    return `slt-settings.${field.id}`;
  }
  function getModalSettingInputId(field) {
    return `slt-${field.id}`;
  }
  function createNativeFieldRow(field, root) {
    const id = getNativeSettingInputId(field);
    const value = readSettingValue(field);
    let row;
    if (field.type === "toggle") {
      row = createNativeToggle(id, field.label, Boolean(value), (checked) => handleSettingChange(field, checked, root));
    } else if (field.type === "languages") {
      row = createNativeLanguageList(id, field.label, field.options || [], String(value), field.placeholder || "", (selected) => handleSettingChange(field, selected, root));
    } else if (field.type === "select") {
      row = createNativeDropdown(id, field.label, field.options || [], String(value), (selected) => handleSettingChange(field, selected, root));
    } else {
      row = createNativeInput(id, field.label, field.type === "password" ? "password" : "text", String(value), field.placeholder || "", (inputValue) => handleSettingChange(field, inputValue, root));
    }
    row.dataset.sltSettingField = field.id;
    row.style.display = isSettingFieldVisible(field) ? "" : "none";
    return row;
  }
  function renderNativeSettingsFields(container) {
    for (const category of SETTINGS_CATEGORIES) {
      for (const section of getSectionsForCategory(category)) {
        const fields = SETTINGS_SCHEMA.filter((field) => field.section === section);
        if (fields.length === 0)
          continue;
        const heading = document.createElement("h3");
        heading.className = "slt-native-section-title";
        heading.textContent = `${category.label} \xB7 ${section}`;
        container.appendChild(heading);
        fields.forEach((field) => container.appendChild(createNativeFieldRow(field, container)));
      }
    }
  }
  function createNativeSettingsSection() {
    const section = document.createElement("div");
    section.id = SETTINGS_ID;
    section.innerHTML = `
        <div class="x-settings-section fNaaQ0Cp8Yzy19j8">
            <h2 class="e-10310-text encore-text-body-medium-bold encore-internal-color-text-base">Spicy Lyric Translator</h2>
        </div>
    `;
    const sectionContent = section.querySelector(".x-settings-section.fNaaQ0Cp8Yzy19j8");
    renderNativeSettingsFields(sectionContent);
    syncModelLists();
    sectionContent.appendChild(createNativeButton(
      "slt-settings.view-cache",
      "View Translation Cache",
      "View Cache",
      () => openCacheViewer()
    ));
    sectionContent.appendChild(createNativeButton(
      "slt-settings.clear-cache",
      "Clear All Cached Translations",
      "Clear Cache",
      clearAllCachedTranslations
    ));
    sectionContent.appendChild(createNativeButton(
      "slt-settings.view-changelog",
      `What's New in v${VERSION}`,
      "View Changelog",
      async () => {
        const btn = document.getElementById("slt-settings.view-changelog");
        if (btn) {
          btn.textContent = "Loading...";
          btn.disabled = true;
        }
        try {
          await showCurrentChangelog();
        } catch (e) {
          notify("Failed to load changelog", true);
        } finally {
          if (btn) {
            btn.textContent = "View Changelog";
            btn.disabled = false;
          }
        }
      }
    ));
    const nativeVersionHash = getDisplayHash().hash.substring(0, 8);
    const nativeVersionLabel = `Version ${VERSION}${nativeVersionHash ? ` \xB7 ${nativeVersionHash}` : ""}`;
    sectionContent.appendChild(createNativeButton(
      "slt-settings.check-updates",
      nativeVersionLabel,
      "Check for Updates",
      () => {
        runManualUpdateCheck(document.getElementById("slt-settings.check-updates"));
      }
    ));
    const githubRow = document.createElement("div");
    githubRow.className = "x-settings-row";
    githubRow.dataset.settingsRow = "true";
    githubRow.innerHTML = `
        <div class="x-settings-firstColumn">
            <label class="e-10310-text encore-text-body-small encore-internal-color-text-subdued">GitHub Repository</label>
        </div>
        <div class="x-settings-secondColumn">
            <a href="${REPO_URL}" target="_blank" rel="noopener noreferrer" class="encore-text-body-small-bold e-10310-legacy-button--small e-10310-button--trailing e-10310-legacy-button-secondary--text-base encore-internal-color-text-base e-10310-legacy-button e-10310-legacy-button-secondary e-10310-overflow-wrap-anywhere x-settings-button" data-encore-id="buttonSecondary">View<span aria-hidden="true" class="e-10310-button__icon-wrapper"><svg data-encore-id="icon" role="img" aria-hidden="true" class="e-10310-icon" viewBox="0 0 16 16" style="--encore-icon-height: var(--encore-graphic-size-decorative-smaller); --encore-icon-width: var(--encore-graphic-size-decorative-smaller);"><path d="M1 2.75A.75.75 0 0 1 1.75 2H7v1.5H2.5v11h10.219V9h1.5v6.25a.75.75 0 0 1-.75.75H1.75a.75.75 0 0 1-.75-.75z"></path><path d="M15 1v4.993a.75.75 0 1 1-1.5 0V3.56L8.78 8.28a.75.75 0 0 1-1.06-1.06l4.72-4.72h-2.433a.75.75 0 0 1 0-1.5z"></path></svg></span></a>
        </div>
    `;
    sectionContent.appendChild(githubRow);
    const shortcutRow = document.createElement("div");
    shortcutRow.className = "x-settings-row";
    shortcutRow.dataset.settingsRow = "true";
    shortcutRow.innerHTML = `
        <div class="x-settings-firstColumn">
            <span class="e-10310-text encore-text-marginal encore-internal-color-text-subdued">Keyboard shortcut: Alt+T to toggle translation</span>
        </div>
    `;
    sectionContent.appendChild(shortcutRow);
    return section;
  }
  function injectSettingsIntoPage() {
    const settingsContainer = document.querySelector(".x-settings-container") || document.querySelector('[data-testid="settings-page"]') || document.querySelector("main.x-settings-container");
    if (!settingsContainer) {
      return;
    }
    const existingSettingsSection = document.getElementById(SETTINGS_ID);
    const sectionAlreadyInContainer = !!existingSettingsSection && settingsContainer.contains(existingSettingsSection);
    if (sectionAlreadyInContainer) {
      return;
    }
    readNativeSettingsClasses(settingsContainer);
    const settingsSection = existingSettingsSection || createNativeSettingsSection();
    adoptNativeSettingsClasses(settingsSection);
    const spicyLyricsSettings = document.getElementById("spicy-lyrics-settings");
    const spicyLyricsDevSettings = document.getElementById("spicy-lyrics-dev-settings");
    if (spicyLyricsDevSettings) {
      spicyLyricsDevSettings.after(settingsSection);
    } else if (spicyLyricsSettings) {
      spicyLyricsSettings.after(settingsSection);
    } else {
      const allSections = settingsContainer.querySelectorAll(".x-settings-section fNaaQ0Cp8Yzy19j8");
      if (allSections.length > 0) {
        const lastSection = allSections[allSections.length - 1];
        const lastSectionParent = lastSection.closest("div:not(.x-settings-section fNaaQ0Cp8Yzy19j8):not(.x-settings-container)") || lastSection;
        lastSectionParent.after(settingsSection);
      } else {
        settingsContainer.appendChild(settingsSection);
      }
    }
  }
  function isOnSettingsPage() {
    const hasSettingsContainer = !!document.querySelector(".x-settings-container");
    const hasSettingsTestId = !!document.querySelector('[data-testid="settings-page"]');
    const pathCheck = window.location.pathname.includes("preferences") || window.location.pathname.includes("settings") || window.location.href.includes("preferences") || window.location.href.includes("settings");
    let historyCheck = false;
    try {
      const location = Spicetify.Platform?.History?.location;
      if (location) {
        historyCheck = location.pathname?.includes("preferences") || location.pathname?.includes("settings") || false;
      }
    } catch (e) {
    }
    return hasSettingsContainer || hasSettingsTestId || pathCheck || historyCheck;
  }
  function watchForSettingsPage() {
    if (isOnSettingsPage()) {
      setTimeout(injectSettingsIntoPage, 100);
      setTimeout(injectSettingsIntoPage, 500);
    }
    if (Spicetify.Platform?.History) {
      Spicetify.Platform.History.listen((location) => {
        if (location?.pathname?.includes("preferences") || location?.pathname?.includes("settings")) {
          setTimeout(injectSettingsIntoPage, 100);
          setTimeout(injectSettingsIntoPage, 300);
          setTimeout(injectSettingsIntoPage, 500);
          setTimeout(injectSettingsIntoPage, 1e3);
        }
      });
    }
    const observer = new MutationObserver((mutations) => {
      const settingsContainer = document.querySelector(".x-settings-container") || document.querySelector('[data-testid="settings-page"]');
      if (settingsContainer && !document.getElementById(SETTINGS_ID)) {
        injectSettingsIntoPage();
      }
      const ourSettings = document.getElementById(SETTINGS_ID);
      const spicyLyricsDevSettings = document.getElementById("spicy-lyrics-dev-settings");
      if (ourSettings && spicyLyricsDevSettings && ourSettings.previousElementSibling !== spicyLyricsDevSettings) {
        spicyLyricsDevSettings.after(ourSettings);
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  function formatBytes2(bytes) {
    if (bytes < 1024)
      return bytes + " B";
    if (bytes < 1024 * 1024)
      return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }
  function formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString(void 0, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }
  function formatDurationMs(ms) {
    if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0)
      return "\u2014";
    if (ms < 1e3)
      return `${Math.round(ms)} ms`;
    const seconds = ms / 1e3;
    if (seconds < 60)
      return `${seconds.toFixed(seconds < 10 ? 2 : 1)} s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds - minutes * 60);
    return `${minutes}m ${remainingSeconds}s`;
  }
  function formatTokenCount(n) {
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0)
      return "\u2014";
    if (n < 1e3)
      return String(n);
    if (n < 1e6)
      return `${(n / 1e3).toFixed(n < 1e4 ? 1 : 0)}k`;
    return `${(n / 1e6).toFixed(2)}M`;
  }
  function extractLineSample(line) {
    if (!line)
      return "";
    if (typeof line === "string")
      return line.trim();
    if (typeof line !== "object")
      return "";
    const directText = line.Text || line.text || line.Lead?.Text || line.Lead?.text;
    if (typeof directText === "string" && directText.trim())
      return directText.trim();
    const leadSyllables = line.Lead?.Syllables || line.LeadSyllables;
    if (Array.isArray(leadSyllables) && leadSyllables.length > 0) {
      const joined = leadSyllables.map((s) => typeof s === "string" ? s : s?.Text || s?.text || "").join("");
      if (joined.trim())
        return joined.trim();
    }
    if (Array.isArray(line.Words)) {
      const joined = line.Words.map((w) => typeof w === "string" ? w : w?.Text || w?.text || "").join("");
      if (joined.trim())
        return joined.trim();
    }
    if (Array.isArray(line.Syllables)) {
      const joined = line.Syllables.map((s) => typeof s === "string" ? s : s?.Text || s?.text || "").join("");
      if (joined.trim())
        return joined.trim();
    }
    if (Array.isArray(line.Background)) {
      for (const bg of line.Background) {
        const sample = extractLineSample(bg);
        if (sample)
          return sample;
      }
    }
    return "";
  }
  function formatTrackLength(ms) {
    if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0)
      return "";
    const totalSeconds = Math.floor(ms / 1e3);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }
  function formatApiProviderLabel(api) {
    if (!api)
      return "Unknown";
    switch (api) {
      case "google":
        return "Google Translate";
      case "libretranslate":
        return "LibreTranslate";
      case "deepl":
        return "DeepL";
      case "openai":
        return "OpenAI";
      case "gemini":
        return "Gemini";
      case "grok":
        return "Grok";
      case "anthropic":
        return "Claude";
      case "custom":
        return "Custom API";
      default:
        return api;
    }
  }
  function escapeHtml3(value) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function getTrackIdFromUri2(trackUri) {
    return trackUri.replace("spotify:track:", "");
  }
  async function playCachedTrack(trackUri) {
    const playbackApi = Spicetify?.Platform?.PlaybackAPI;
    const player = Spicetify?.Player;
    try {
      if (playbackApi?.playUri) {
        await playbackApi.playUri(trackUri);
        return true;
      }
      if (playbackApi?.playTrack) {
        await playbackApi.playTrack(trackUri);
        return true;
      }
      if (playbackApi?.play) {
        await playbackApi.play(trackUri);
        return true;
      }
      if (player?.playUri) {
        await player.playUri(trackUri);
        return true;
      }
      if (player?.origin?.playUri) {
        await player.origin.playUri(trackUri);
        return true;
      }
    } catch (e) {
    }
    const cosmos = Spicetify?.CosmosAsync;
    const cosmosAttempts = [
      {
        url: "sp://player/v2/main/command/play",
        body: { uri: trackUri }
      },
      {
        url: "sp://player/v2/main/command/play",
        body: {
          context: { uri: trackUri },
          playback: { initiatingCommand: "play" }
        }
      }
    ];
    if (cosmos?.put) {
      for (const attempt of cosmosAttempts) {
        try {
          await cosmos.put(attempt.url, attempt.body);
          return true;
        } catch (e) {
        }
      }
    }
    try {
      const trackId = getTrackIdFromUri2(trackUri);
      if (trackId && Spicetify.Platform?.History?.push) {
        Spicetify.Platform.History.push(`/track/${trackId}`);
        return true;
      }
    } catch (e) {
    }
    return false;
  }
  async function openCachedLyricsViewer(trackUri, targetLang, sourceLang) {
    const trackCache = getTrackCache(trackUri, targetLang);
    if (!trackCache) {
      notify("Could not load cached translation for this track", true);
      return;
    }
    const translatedLines = trackCache.lines || [];
    const metrics = trackCache.metrics;
    const providerLabel = formatApiProviderLabel(trackCache.api);
    const modelLabel = metrics?.model;
    const renderInfoCell = (label, value, title) => `<div class="slt-lyrics-info-cell"${title ? ` title="${escapeHtml3(title)}"` : ""}>
            <span class="slt-lyrics-info-label">${escapeHtml3(label)}</span>
            <span class="slt-lyrics-info-value">${escapeHtml3(value)}</span>
        </div>`;
    const renderRows = (sourceLines) => {
      const maxLines = Math.max(sourceLines.length, translatedLines.length);
      return Array.from({ length: maxLines }).map((_, idx) => {
        const sourceText = escapeHtml3(sourceLines[idx] ?? "");
        const translatedText = escapeHtml3(translatedLines[idx] ?? "");
        return `
                <div class="slt-lyrics-row">
                    <div class="slt-lyrics-col">${sourceText || "&nbsp;"}</div>
                    <div class="slt-lyrics-col slt-lyrics-col-editable" contenteditable="plaintext-only" spellcheck="false" data-line-index="${idx}" role="textbox" aria-label="Translated line ${idx + 1}">${translatedText}</div>
                </div>
            `;
      }).join("");
    };
    const content = document.createElement("div");
    content.className = "slt-lyrics-viewer";
    const copyLabel = "Copy Lyrics";
    const backToCacheLabel = "< Back to Cache";
    content.innerHTML = `
        <style>
            .slt-lyrics-viewer {
                width: min(760px, 90vw);
                max-width: 100%;
                max-height: 72vh;
                display: flex;
                flex-direction: column;
                gap: 12px;
                padding: 2px 2px 4px;
                box-sizing: border-box;
                overflow-x: hidden;
                overflow-y: hidden;
            }
            .slt-lyrics-header {
                font-size: 13px;
                color: var(--spice-subtext);
                overflow-wrap: anywhere;
            }
            .slt-lyrics-info {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                gap: 8px;
                padding: 12px 14px;
                background: rgba(255, 255, 255, 0.045);
                border-radius: var(--slt-radius-sm);
                border: 1px solid var(--slt-hairline-strong);
            }
            .slt-lyrics-info-cell {
                display: flex;
                flex-direction: column;
                gap: 2px;
                min-width: 0;
            }
            .slt-lyrics-info-label {
                font-size: 10px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.04em;
                color: var(--spice-subtext);
                line-height: 1.3;
            }
            .slt-lyrics-info-value {
                font-size: 13px;
                font-weight: 600;
                color: var(--spice-text);
                line-height: 1.3;
                overflow-wrap: anywhere;
            }
            .slt-lyrics-toolbar {
                display: flex;
                justify-content: flex-end;
                gap: 8px;
                flex-wrap: wrap;
            }
            .slt-lyrics-copy {
                min-height: 36px;
                padding: 8px 14px;
                border-radius: 500px;
                border: none;
                background: var(--spice-button);
                color: var(--spice-text);
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
                transition: opacity 0.2s, background 0.2s;
                white-space: nowrap;
            }
            .slt-lyrics-copy:hover {
                opacity: 0.85;
            }
            .slt-lyrics-copy.slt-copied {
                background: #1db954;
            }
            .slt-lyrics-back {
                min-height: 36px;
                padding: 8px 14px;
                border-radius: 500px;
                border: none;
                background: var(--slt-surface); border: 1px solid var(--slt-hairline-strong); box-shadow: var(--slt-gloss);
                color: var(--spice-text);
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
                white-space: nowrap;
            }
            .slt-lyrics-back:hover {
                opacity: 0.85;
            }
            .slt-lyrics-grid {
                display: flex;
                flex-direction: column;
                gap: 1px;
                background: rgba(255, 255, 255, 0.04);
                border-radius: var(--slt-radius-sm);
                overflow-y: auto;
                overflow-x: hidden;
                max-height: min(54vh, 560px);
                border: 1px solid var(--slt-hairline-strong);
            }
            #slt-lyrics-rows {
                display: flex;
                flex-direction: column;
                gap: 1px;
            }
            .slt-lyrics-row {
                display: grid;
                grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
                gap: 1px;
            }
            .slt-lyrics-col {
                padding: 10px 12px;
                background: rgba(255, 255, 255, 0.045);
                color: var(--spice-text);
                font-size: 13px;
                line-height: 1.4;
                white-space: pre-wrap;
                word-break: break-word;
                overflow-wrap: anywhere;
                min-width: 0;
            }
            .slt-lyrics-head {
                font-size: 11px;
                text-transform: uppercase;
                color: var(--spice-subtext);
                font-weight: 700;
            }
            .slt-lyrics-col-editable {
                min-height: 19px;
                padding: 2px 6px;
                margin: -2px -6px;
                border-radius: 4px;
                border: 1px solid transparent;
                cursor: text;
                transition: background 0.15s, border-color 0.15s;
            }
            .slt-lyrics-col-editable:hover {
                background: rgba(255, 255, 255, 0.05);
                border-color: var(--slt-hairline-strong);
            }
            .slt-lyrics-col-editable:focus {
                outline: none;
                background: rgba(255, 255, 255, 0.08);
                border-color: #1db954;
            }
            .slt-lyrics-col-editable.slt-line-dirty {
                border-color: rgba(29, 185, 84, 0.55);
            }
            .slt-lyrics-save[disabled] {
                opacity: 0.4;
                cursor: default;
            }
            .slt-lyrics-edit-hint {
                font-size: 11px;
                color: var(--spice-subtext);
                align-self: center;
                margin-right: auto;
            }
            @media (max-width: 620px) {
                .slt-lyrics-viewer {
                    width: min(100%, 90vw);
                    padding: 16px;
                }
                .slt-lyrics-toolbar {
                    justify-content: flex-start;
                }
                .slt-lyrics-row {
                    grid-template-columns: 1fr;
                }
            }
        </style>
        <div class="slt-lyrics-toolbar">
            <span class="slt-lyrics-edit-hint">Click a translated line to edit it</span>
            <button id="slt-lyrics-save" class="slt-lyrics-copy slt-lyrics-save" type="button" disabled>Save Edits</button>
            <button id="slt-lyrics-copy-all" class="slt-lyrics-copy" type="button">Copy Lyrics</button>
            <button id="slt-lyrics-back-to-cache" class="slt-lyrics-back" type="button">&lt; Back to Cache</button>
        </div>
        <div class="slt-lyrics-info">
            ${renderInfoCell("Provider", providerLabel)}
            ${renderInfoCell("Model", modelLabel || "\u2014", modelLabel ? `Model: ${modelLabel}` : void 0)}
            ${renderInfoCell("Direction", `${(sourceLang || trackCache.lang || "auto").toUpperCase()} \u2192 ${targetLang.toUpperCase()}`)}
            ${renderInfoCell("Lines", String(translatedLines.length))}
            ${renderInfoCell("Duration", formatDurationMs(metrics?.durationMs), metrics?.apiCalls ? `${metrics.apiCalls} API call${metrics.apiCalls === 1 ? "" : "s"}` : void 0)}
            ${renderInfoCell("Tokens (in/out)", metrics?.totalTokens ? `${formatTokenCount(metrics.inputTokens)} / ${formatTokenCount(metrics.outputTokens)}` : "\u2014", metrics?.totalTokens ? `Total ${formatTokenCount(metrics.totalTokens)} tokens` : void 0)}
            ${renderInfoCell("Cached", formatDate(trackCache.timestamp))}
        </div>
        <div class="slt-lyrics-header">Track ID: ${escapeHtml3(getTrackIdFromUri2(trackUri))}</div>
        <div class="slt-lyrics-grid">
            <div class="slt-lyrics-row">
                <div class="slt-lyrics-col slt-lyrics-head" id="slt-lyrics-source-heading">${escapeHtml3(sourceLang.toUpperCase())} (Source)</div>
                <div class="slt-lyrics-col slt-lyrics-head">${escapeHtml3(targetLang.toUpperCase())} (Translated)</div>
            </div>
            <div id="slt-lyrics-rows">
                ${renderRows([]) || '<div class="slt-lyrics-row"><div class="slt-lyrics-col">No cached lines</div><div class="slt-lyrics-col">No cached lines</div></div>'}
            </div>
        </div>
    `;
    const copyAllButton = content.querySelector("#slt-lyrics-copy-all");
    const backToCacheButton = content.querySelector("#slt-lyrics-back-to-cache");
    if (copyAllButton)
      copyAllButton.textContent = copyLabel;
    if (backToCacheButton)
      backToCacheButton.textContent = backToCacheLabel;
    if (Spicetify.PopupModal) {
      displayModal({
        title: "Cached lyrics",
        content,
        size: "xl"
      });
    }
    const backToCacheBtn = content.querySelector("#slt-lyrics-back-to-cache");
    backToCacheBtn?.addEventListener("click", () => {
      hideModal();
      setTimeout(() => openCacheViewer(), 120);
    });
    const copyBtn = content.querySelector("#slt-lyrics-copy-all");
    copyBtn?.addEventListener("click", async () => {
      const rows = content.querySelectorAll("#slt-lyrics-rows .slt-lyrics-row");
      const lines = [];
      const trackTitle = trackCache.trackName || getTrackIdFromUri2(trackUri);
      const trackArtist = trackCache.artistName || "";
      lines.push(`${trackTitle}${trackArtist ? " - " + trackArtist : ""}`);
      lines.push(`${sourceLang.toUpperCase()} -> ${targetLang.toUpperCase()}`);
      lines.push("-".repeat(40));
      rows.forEach((row) => {
        const cols = row.querySelectorAll(".slt-lyrics-col");
        if (cols.length >= 2) {
          const src = (cols[0].textContent || "").trim();
          const tgt = (cols[1].textContent || "").trim();
          if (src || tgt) {
            lines.push(src || "");
            if (tgt && tgt !== src)
              lines.push(`  -> ${tgt}`);
            lines.push("");
          }
        }
      });
      lines.push("-".repeat(40));
      lines.push("Exported from Spicy Lyric Translator");
      const text3 = lines.join("\n");
      try {
        await navigator.clipboard.writeText(text3);
        copyBtn.textContent = "Copied!";
        copyBtn.classList.add("slt-copied");
        setTimeout(() => {
          copyBtn.textContent = copyLabel;
          copyBtn.classList.remove("slt-copied");
        }, 2e3);
      } catch (e) {
        copyBtn.textContent = "Failed";
        setTimeout(() => {
          copyBtn.textContent = copyLabel;
        }, 2e3);
      }
    });
    const saveBtn = content.querySelector("#slt-lyrics-save");
    let hasUnsavedEdits = false;
    const bindEditableCells = () => {
      content.querySelectorAll(".slt-lyrics-col-editable").forEach((node) => {
        const cell = node;
        if (cell.dataset.bound === "true")
          return;
        cell.dataset.bound = "true";
        cell.addEventListener("input", () => {
          cell.classList.add("slt-line-dirty");
          hasUnsavedEdits = true;
          if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = "Save Edits";
            saveBtn.classList.remove("slt-copied");
          }
        });
        cell.addEventListener("keydown", (event) => {
          const keyEvent = event;
          if (keyEvent.key === "Enter" && !keyEvent.shiftKey) {
            keyEvent.preventDefault();
            cell.blur();
          }
        });
      });
    };
    const renderInto = (sourceLines, emptyMessage) => {
      if (hasUnsavedEdits)
        return;
      const rowsContainer = content.querySelector("#slt-lyrics-rows");
      if (!rowsContainer)
        return;
      rowsContainer.innerHTML = renderRows(sourceLines) || emptyMessage;
      bindEditableCells();
    };
    bindEditableCells();
    saveBtn?.addEventListener("click", () => {
      const cells = Array.from(content.querySelectorAll(".slt-lyrics-col-editable"));
      const editedLines = cells.sort((a, b) => Number(a.dataset.lineIndex || 0) - Number(b.dataset.lineIndex || 0)).map((cell) => (cell.textContent || "").replace(/\s+/g, " ").trim());
      while (editedLines.length > 0 && !editedLines[editedLines.length - 1])
        editedLines.pop();
      if (editedLines.length === 0) {
        saveBtn.textContent = "Nothing to save";
        setTimeout(() => {
          saveBtn.textContent = "Save Edits";
        }, 2e3);
        return;
      }
      const saved = updateTrackCacheLines(trackUri, targetLang, editedLines);
      if (!saved) {
        saveBtn.textContent = "Save failed";
        setTimeout(() => {
          saveBtn.textContent = "Save Edits";
        }, 2500);
        return;
      }
      translatedLines.length = 0;
      translatedLines.push(...editedLines);
      hasUnsavedEdits = false;
      saveBtn.disabled = true;
      saveBtn.textContent = "Saved!";
      saveBtn.classList.add("slt-copied");
      content.querySelectorAll(".slt-line-dirty").forEach((el2) => el2.classList.remove("slt-line-dirty"));
      setTimeout(() => {
        saveBtn.textContent = "Save Edits";
        saveBtn.classList.remove("slt-copied");
      }, 2e3);
      if (getCurrentTrackUri() === trackUri) {
        forceRetranslate();
      }
    });
    const cachedSourceLines = trackCache.sourceLines || [];
    if (cachedSourceLines.length > 0) {
      renderInto(cachedSourceLines, '<div class="slt-lyrics-row"><div class="slt-lyrics-col">No source lyrics found</div><div class="slt-lyrics-col">No cached lines</div></div>');
    }
    try {
      const sourceLyrics = await fetchLyricsForTrackUri(trackUri);
      const sourceLines = sourceLyrics?.lines?.length ? sourceLyrics.lines : cachedSourceLines;
      if (sourceLines.length > 0) {
        renderInto(sourceLines, '<div class="slt-lyrics-row"><div class="slt-lyrics-col">No source lyrics found</div><div class="slt-lyrics-col">No cached lines</div></div>');
      }
      if (sourceLyrics?.language) {
        const sourceHeading = content.querySelector("#slt-lyrics-source-heading");
        if (sourceHeading) {
          sourceHeading.textContent = `${sourceLyrics.language.toUpperCase()} (Source)`;
        }
      }
    } catch (e) {
      if (cachedSourceLines.length === 0) {
        renderInto([], renderRows([]));
      }
    }
  }
  function createCacheViewerUI() {
    const stats = getTrackCacheStats();
    const cachedTracks = getAllCachedTracks();
    const container = document.createElement("div");
    container.className = "slt-cache-viewer";
    container.innerHTML = `
        <style>
            .slt-cache-viewer {
                padding: 2px 2px 4px;
                display: flex;
                flex-direction: column;
                gap: 12px;
                width: 100%;
                max-width: 100%;
                max-height: 72vh;
                box-sizing: border-box;
                overflow: hidden;
            }
            .slt-cache-stats {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 12px;
                padding: 14px;
                background: rgba(255, 255, 255, 0.045);
                border-radius: var(--slt-radius-sm);
                border: 1px solid var(--slt-hairline-strong);
            }
            .slt-stat {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            .slt-stat-label {
                font-size: 11px;
                color: var(--spice-subtext);
                text-transform: uppercase;
                line-height: 1.35;
            }
            .slt-stat-value {
                font-size: 18px;
                font-weight: 700;
                color: var(--spice-text);
                line-height: 1.25;
            }
            .slt-cache-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
                overflow-y: auto;
                min-height: 160px;
                max-height: min(42vh, 420px);
                padding-right: 8px;
            }
            .slt-cache-item {
                display: grid;
                grid-template-columns: minmax(0, 1fr) auto;
                align-items: center;
                padding: 12px 14px;
                background: rgba(255, 255, 255, 0.045);
                border-radius: var(--slt-radius-sm);
                border: 1px solid var(--slt-hairline-strong);
                gap: 12px;
                min-width: 0;
            }
            .slt-cache-item-info {
                display: flex;
                flex-direction: column;
                gap: 2px;
                flex: 1;
                min-width: 0;
            }
            .slt-cache-item-title {
                font-size: 14px;
                font-weight: 600;
                color: var(--spice-text);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                line-height: 1.35;
            }
            .slt-cache-item-artist {
                font-size: 13px;
                color: var(--spice-subtext);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                line-height: 1.35;
            }
            .slt-cache-item-meta {
                font-size: 12px;
                color: var(--spice-subtext);
                opacity: 0.78;
                line-height: 1.35;
                overflow-wrap: anywhere;
            }
            .slt-cache-item-provider {
                display: flex;
                gap: 6px;
                flex-wrap: wrap;
                align-items: center;
                margin-top: 4px;
            }
            .slt-provider-chip {
                display: inline-flex;
                align-items: center;
                font-size: 11px;
                font-weight: 600;
                color: var(--spice-text);
                background: rgba(30, 215, 96, 0.14);
                border: 1px solid rgba(30, 215, 96, 0.28);
                border-radius: 999px;
                padding: 2px 8px;
                line-height: 1.4;
                white-space: nowrap;
            }
            .slt-metric-pill {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                font-size: 11px;
                color: var(--spice-subtext);
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 999px;
                padding: 2px 8px;
                line-height: 1.4;
                white-space: nowrap;
            }
            .slt-cache-delete {
                min-height: 36px;
                padding: 8px 14px;
                border-radius: 999px;
                border: none;
                background: rgba(255, 90, 90, 0.14); border: 1px solid rgba(255, 90, 90, 0.32);
                color: #ff8a8a;
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
                transition: opacity 0.2s, background 0.2s;
                flex-shrink: 0;
                white-space: nowrap;
            }
            .slt-cache-delete:hover {
                background: rgba(255, 90, 90, 0.26);
            }
            .slt-cache-item-actions {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-shrink: 0;
            }
            .slt-cache-action {
                min-height: 36px;
                padding: 8px 14px;
                border-radius: 999px;
                border: none;
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
                transition: opacity 0.2s, background 0.2s;
                color: var(--spice-text);
                background: var(--slt-surface); border: 1px solid var(--slt-hairline-strong); box-shadow: var(--slt-gloss);
                white-space: nowrap;
            }
            .slt-cache-action:hover {
                opacity: 0.85;
            }
            .slt-cache-delete-all {
                min-height: 40px;
                padding: 9px 18px;
                border-radius: 500px;
                border: none;
                background: rgba(255, 90, 90, 0.14); border: 1px solid rgba(255, 90, 90, 0.32);
                color: #ff8a8a;
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
                transition: background 0.2s;
                white-space: normal;
                text-align: center;
            }
            .slt-cache-delete-all:hover {
                background: rgba(255, 90, 90, 0.26);
            }
            .slt-empty-cache {
                text-align: center;
                padding: 24px;
                color: var(--spice-subtext);
                font-size: 14px;
                background: rgba(255, 255, 255, 0.045);
                border-radius: var(--slt-radius-sm);
            }
            .slt-cache-actions {
                display: flex;
                justify-content: center;
                padding-top: 8px;
            }
            .slt-cache-toolbar {
                display: flex;
                justify-content: flex-end;
            }
            .slt-cache-back {
                min-height: 36px;
                padding: 8px 14px;
                border-radius: 500px;
                border: none;
                background: var(--slt-surface); border: 1px solid var(--slt-hairline-strong); box-shadow: var(--slt-gloss);
                color: var(--spice-text);
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
                white-space: nowrap;
            }
            .slt-cache-back:hover {
                opacity: 0.85;
            }
            @media (max-width: 620px) {
                .slt-cache-viewer {
                    width: min(100%, 90vw);
                    padding: 16px;
                }
                .slt-cache-stats {
                    grid-template-columns: 1fr;
                }
                .slt-cache-item {
                    grid-template-columns: 1fr;
                    align-items: stretch;
                }
                .slt-cache-item-actions {
                    justify-content: flex-start;
                    flex-wrap: wrap;
                }
            }
        </style>
        <div class="slt-cache-toolbar">
            <button id="slt-cache-back-to-settings" class="slt-cache-back" type="button">&lt; Back to Settings</button>
        </div>

        <div class="slt-cache-stats">
            <div class="slt-stat">
                <span class="slt-stat-label">Cached Tracks</span>
                <span class="slt-stat-value" id="slt-stat-tracks">${stats.trackCount}</span>
            </div>
            <div class="slt-stat">
                <span class="slt-stat-label">Total Lines</span>
                <span class="slt-stat-value" id="slt-stat-lines">${stats.totalLines}</span>
            </div>
            <div class="slt-stat">
                <span class="slt-stat-label">Cache Size</span>
                <span class="slt-stat-value" id="slt-stat-size">${formatBytes2(stats.sizeBytes)}</span>
            </div>
            <div class="slt-stat">
                <span class="slt-stat-label">Oldest Entry</span>
                <span class="slt-stat-value">${stats.oldestTimestamp ? formatDate(stats.oldestTimestamp) : "N/A"}</span>
            </div>
        </div>

        <div class="slt-cache-list" id="slt-cache-list">
            ${cachedTracks.length === 0 ? '<div class="slt-empty-cache">No cached translations</div>' : cachedTracks.sort((a, b) => b.timestamp - a.timestamp).map((track, index) => {
      const trackId = getTrackIdFromUri2(track.trackUri);
      const displayTitle = track.trackName || `Track ID: ${trackId}`;
      const displayArtist = track.artistName || "";
      const providerLabel = formatApiProviderLabel(track.api);
      const modelLabel = track.metrics?.model;
      const providerBadge = modelLabel ? `${providerLabel} \xB7 ${modelLabel}` : providerLabel;
      const metricsPills = [];
      if (track.metrics?.durationMs) {
        metricsPills.push(`<span class="slt-metric-pill" title="Translation duration">\u23F1 ${formatDurationMs(track.metrics.durationMs)}</span>`);
      }
      if (track.metrics?.totalTokens) {
        metricsPills.push(`<span class="slt-metric-pill" title="Total tokens (input + output)">\u2301 ${formatTokenCount(track.metrics.totalTokens)} tok</span>`);
      }
      if (track.metrics?.apiCalls && track.metrics.apiCalls > 1) {
        metricsPills.push(`<span class="slt-metric-pill" title="API calls">\u21BB ${track.metrics.apiCalls}</span>`);
      }
      return `
                        <div class="slt-cache-item" data-uri="${escapeHtml3(track.trackUri)}" data-lang="${escapeHtml3(track.targetLang)}">
                            <div class="slt-cache-item-info">
                                <span class="slt-cache-item-title">${escapeHtml3(displayTitle)}</span>
                                ${displayArtist ? `<span class="slt-cache-item-artist">${escapeHtml3(displayArtist)}</span>` : ""}
                                <span class="slt-cache-item-meta">${escapeHtml3(track.sourceLang)} \u2192 ${escapeHtml3(track.targetLang)} \xB7 ${track.lineCount} lines \xB7 ${formatDate(track.timestamp)}</span>
                                <span class="slt-cache-item-provider"><span class="slt-provider-chip">${escapeHtml3(providerBadge)}</span>${metricsPills.join("")}</span>
                            </div>
                            <div class="slt-cache-item-actions">
                                <button class="slt-cache-action slt-cache-play" data-index="${index}">Play</button>
                                <button class="slt-cache-action slt-cache-view-lyrics" data-index="${index}" data-source-lang="${escapeHtml3(track.sourceLang)}">View Lyrics</button>
                                <button class="slt-cache-delete" data-index="${index}">Delete</button>
                            </div>
                        </div>
                    `;
    }).join("")}
        </div>

        ${cachedTracks.length > 0 ? `
        <div class="slt-cache-actions">
            <button class="slt-cache-delete-all" id="slt-delete-all-cache">Delete All Cached Translations</button>
        </div>
        ` : ""}
    `;
    setTimeout(() => {
      const backToSettingsBtn = container.querySelector("#slt-cache-back-to-settings");
      backToSettingsBtn?.addEventListener("click", () => {
        hideModal();
        setTimeout(() => openSettingsModal(), 120);
      });
      container.querySelectorAll(".slt-cache-play").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const button = e.currentTarget;
          const item = button.closest(".slt-cache-item");
          const uri = item?.dataset.uri;
          if (!uri)
            return;
          button.disabled = true;
          const previousText = button.textContent;
          button.textContent = "Opening...";
          try {
            const played = await playCachedTrack(uri);
            notify(played ? "Opening cached track" : "Unable to play track directly", !played);
          } finally {
            button.disabled = false;
            button.textContent = previousText || "Play";
          }
        });
      });
      container.querySelectorAll(".slt-cache-view-lyrics").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const button = e.currentTarget;
          const item = button.closest(".slt-cache-item");
          const uri = item?.dataset.uri;
          const lang = item?.dataset.lang;
          const sourceLang = button.dataset.sourceLang || "auto";
          if (!uri || !lang)
            return;
          button.disabled = true;
          const previousText = button.textContent;
          button.textContent = "Loading...";
          try {
            hideModal();
            await new Promise((resolve) => setTimeout(resolve, 120));
            await openCachedLyricsViewer(uri, lang, sourceLang);
          } catch (error2) {
            notify("Failed to open cached lyrics viewer", true);
          } finally {
            button.disabled = false;
            button.textContent = previousText || "View Lyrics";
          }
        });
      });
      container.querySelectorAll(".slt-cache-delete").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const item = e.target.closest(".slt-cache-item");
          if (item) {
            const uri = item.dataset.uri;
            const lang = item.dataset.lang;
            if (uri) {
              deleteTrackCache(uri, lang);
              item.remove();
              const newStats = getTrackCacheStats();
              const tracksEl = container.querySelector("#slt-stat-tracks");
              const linesEl = container.querySelector("#slt-stat-lines");
              const sizeEl = container.querySelector("#slt-stat-size");
              if (tracksEl)
                tracksEl.textContent = String(newStats.trackCount);
              if (linesEl)
                linesEl.textContent = String(newStats.totalLines);
              if (sizeEl)
                sizeEl.textContent = formatBytes2(newStats.sizeBytes);
              const list = container.querySelector("#slt-cache-list");
              if (list && list.querySelectorAll(".slt-cache-item").length === 0) {
                list.innerHTML = '<div class="slt-empty-cache">No cached translations</div>';
                const actionsDiv = container.querySelector(".slt-cache-actions");
                if (actionsDiv)
                  actionsDiv.remove();
              }
            }
          }
        });
      });
      const deleteAllBtn = container.querySelector("#slt-delete-all-cache");
      deleteAllBtn?.addEventListener("click", () => {
        clearAllCachedTranslations();
        const tracksEl = container.querySelector("#slt-stat-tracks");
        const linesEl = container.querySelector("#slt-stat-lines");
        const sizeEl = container.querySelector("#slt-stat-size");
        if (tracksEl)
          tracksEl.textContent = "0";
        if (linesEl)
          linesEl.textContent = "0";
        if (sizeEl)
          sizeEl.textContent = "0 B";
        const list = container.querySelector("#slt-cache-list");
        if (list)
          list.innerHTML = '<div class="slt-empty-cache">No cached translations</div>';
        const actionsDiv = container.querySelector(".slt-cache-actions");
        if (actionsDiv)
          actionsDiv.remove();
      });
    }, 0);
    return container;
  }
  function openCacheViewer() {
    if (Spicetify.PopupModal) {
      displayModal({
        title: "Translation cache",
        content: createCacheViewerUI(),
        isLarge: true
      });
    }
  }
  async function createSpicyLyricsCacheViewerUI() {
    const container = document.createElement("div");
    container.className = "slt-cache-viewer";
    container.innerHTML = `<div style="padding: 20px; text-align: center;">Loading cache...</div>`;
    try {
      let cacheItems = [];
      let totalSize = 0;
      if (typeof caches !== "undefined") {
        for (const cacheName of SPICY_LYRICS_CACHE_NAMES2) {
          if (typeof caches.has === "function" && !await caches.has(cacheName))
            continue;
          const cache = await caches.open(cacheName);
          const keys = await cache.keys();
          const items = await Promise.all(keys.map(async (req) => {
            const url = new URL(req.url);
            const pathParts = url.pathname.split("/").filter(Boolean);
            const trackId = pathParts.length > 0 ? pathParts[pathParts.length - 1] : null;
            const isTrackId = !!trackId && trackId.length === 22;
            let type = "Unknown";
            let lang = "";
            let linesCount = 0;
            let sizeBytes = 0;
            let source = "";
            let trackLengthMs = null;
            let cachedAt = null;
            let rawJson = null;
            let firstLineSample = "";
            try {
              const res = await cache.match(req);
              if (res) {
                const dateHeader = res.headers.get("date");
                if (dateHeader) {
                  const parsedDate = Date.parse(dateHeader);
                  if (!Number.isNaN(parsedDate))
                    cachedAt = parsedDate;
                }
                const buffer = await res.arrayBuffer();
                sizeBytes = buffer.byteLength;
                totalSize += sizeBytes;
                const text3 = new TextDecoder().decode(buffer);
                rawJson = text3;
                const parsed = JSON.parse(text3);
                let lyricsData = parsed;
                if (parsed && !parsed.Type && parsed.Content !== void 0) {
                  lyricsData = parsed.Content;
                }
                if (lyricsData && typeof lyricsData === "object") {
                  if (lyricsData.Type)
                    type = lyricsData.Type;
                  if (lyricsData.Language)
                    lang = lyricsData.Language;
                  if (lyricsData.Source)
                    source = String(lyricsData.Source);
                  else if (lyricsData.Provider)
                    source = String(lyricsData.Provider);
                  if (typeof lyricsData.Length === "number")
                    trackLengthMs = lyricsData.Length;
                  const lineCarrier = lyricsData.Lines || lyricsData.Content;
                  if (Array.isArray(lineCarrier)) {
                    linesCount = lineCarrier.length;
                    for (const line of lineCarrier) {
                      const sample = extractLineSample(line);
                      if (sample) {
                        firstLineSample = sample;
                        break;
                      }
                    }
                  }
                }
              }
            } catch (e) {
            }
            return { req, cacheName, url, trackId, isTrackId, type, lang, linesCount, sizeBytes, source, trackLengthMs, cachedAt, rawJson, firstLineSample };
          }));
          cacheItems.push(...items);
        }
      }
      let currentTotalSize = totalSize;
      container.innerHTML = `
        <style>
            .slt-cache-viewer {
                display: flex;
                flex-direction: column;
                gap: 16px;
                padding: 24px;
                color: var(--spice-text);
                width: min(800px, 90vw);
                max-width: 100%;
                max-height: 72vh;
                box-sizing: border-box;
                overflow: hidden;
            }
            .slt-cache-stats {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 12px;
                padding: 14px;
                background: rgba(255, 255, 255, 0.045);
                border-radius: var(--slt-radius-sm);
                border: 1px solid var(--slt-hairline-strong);
            }
            .slt-stat {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            .slt-stat-label {
                font-size: 11px;
                color: var(--spice-subtext);
                text-transform: uppercase;
                line-height: 1.35;
            }
            .slt-stat-value {
                font-size: 18px;
                font-weight: 700;
                color: var(--spice-text);
                line-height: 1.25;
            }
            .slt-cache-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
                overflow-y: auto;
                min-height: 160px;
                max-height: min(42vh, 420px);
                padding-right: 8px;
            }
            .slt-cache-item {
                display: grid;
                grid-template-columns: minmax(0, 1fr) auto;
                align-items: center;
                padding: 12px 14px;
                background: rgba(255, 255, 255, 0.045);
                border-radius: var(--slt-radius-sm);
                border: 1px solid var(--slt-hairline-strong);
                gap: 12px;
                min-width: 0;
            }
            .slt-cache-item-info {
                display: flex;
                flex-direction: column;
                gap: 2px;
                flex: 1;
                min-width: 0;
            }
            .slt-cache-item-title {
                font-size: 14px;
                font-weight: 600;
                color: var(--spice-text);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                line-height: 1.35;
            }
            .slt-cache-item-meta {
                font-size: 12px;
                color: var(--spice-subtext);
                opacity: 0.78;
                line-height: 1.35;
                overflow-wrap: anywhere;
            }
            .slt-cache-item-provider {
                display: flex;
                gap: 6px;
                flex-wrap: wrap;
                align-items: center;
                margin-top: 4px;
            }
            .slt-provider-chip {
                display: inline-flex;
                align-items: center;
                font-size: 11px;
                font-weight: 600;
                color: var(--spice-text);
                background: rgba(30, 215, 96, 0.14);
                border: 1px solid rgba(30, 215, 96, 0.28);
                border-radius: 999px;
                padding: 2px 8px;
                line-height: 1.4;
                white-space: nowrap;
            }
            .slt-metric-pill {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                font-size: 11px;
                color: var(--spice-subtext);
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 999px;
                padding: 2px 8px;
                line-height: 1.4;
                white-space: nowrap;
            }
            .slt-cache-delete {
                min-height: 36px;
                padding: 8px 14px;
                border-radius: 999px;
                border: none;
                background: rgba(255, 90, 90, 0.14); border: 1px solid rgba(255, 90, 90, 0.32);
                color: #ff8a8a;
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
                transition: opacity 0.2s, background 0.2s;
                flex-shrink: 0;
                white-space: nowrap;
            }
            .slt-cache-delete:hover {
                background: rgba(255, 90, 90, 0.26);
            }
            .slt-cache-item-actions {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-shrink: 0;
            }
            .slt-cache-action {
                min-height: 36px;
                padding: 8px 14px;
                border-radius: 999px;
                border: none;
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
                transition: opacity 0.2s, background 0.2s;
                color: var(--spice-text);
                background: var(--slt-surface); border: 1px solid var(--slt-hairline-strong); box-shadow: var(--slt-gloss);
                white-space: nowrap;
            }
            .slt-cache-action:hover {
                opacity: 0.85;
            }
            .slt-cache-delete-all {
                min-height: 40px;
                padding: 9px 18px;
                border-radius: 500px;
                border: none;
                background: rgba(255, 90, 90, 0.14); border: 1px solid rgba(255, 90, 90, 0.32);
                color: #ff8a8a;
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
                transition: background 0.2s;
                white-space: normal;
                text-align: center;
            }
            .slt-cache-delete-all:hover {
                background: rgba(255, 90, 90, 0.26);
            }
            .slt-empty-cache {
                text-align: center;
                padding: 24px;
                color: var(--spice-subtext);
                font-size: 14px;
                background: rgba(255, 255, 255, 0.045);
                border-radius: var(--slt-radius-sm);
            }
            .slt-cache-actions {
                display: flex;
                justify-content: center;
                padding-top: 8px;
            }
            .slt-cache-toolbar {
                display: flex;
                justify-content: flex-end;
            }
            .slt-cache-back {
                min-height: 36px;
                padding: 8px 14px;
                border-radius: 500px;
                border: none;
                background: var(--slt-surface); border: 1px solid var(--slt-hairline-strong); box-shadow: var(--slt-gloss);
                color: var(--spice-text);
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
                white-space: nowrap;
            }
            .slt-cache-back:hover {
                opacity: 0.85;
            }
            @media (max-width: 620px) {
                .slt-cache-viewer {
                    width: min(100%, 90vw);
                    padding: 16px;
                }
                .slt-cache-stats {
                    grid-template-columns: 1fr;
                }
                .slt-cache-item {
                    grid-template-columns: 1fr;
                    align-items: stretch;
                }
                .slt-cache-item-actions {
                    justify-content: flex-start;
                    flex-wrap: wrap;
                }
            }
        </style>
        <div class="slt-cache-toolbar">
            <button id="slt-sl-cache-back-to-settings" class="slt-cache-back" type="button">&lt; Back to Settings</button>
        </div>

        <div class="slt-cache-stats">
            <div class="slt-stat">
                <span class="slt-stat-label">Cached Requests</span>
                <span class="slt-stat-value" id="slt-sl-stat-tracks">${cacheItems.length}</span>
            </div>
            <div class="slt-stat">
                <span class="slt-stat-label">Cache Size</span>
                <span class="slt-stat-value" id="slt-sl-stat-size">${formatBytes2(totalSize)}</span>
            </div>
        </div>

        <div class="slt-cache-list" id="slt-sl-cache-list">
            ${cacheItems.length === 0 ? '<div class="slt-empty-cache">No cached Spicy Lyrics data</div>' : cacheItems.map((item, index) => {
        const displayTitle = item.isTrackId ? "Track ID: " + item.trackId : item.url.pathname;
        const detailParts = [item.url.hostname];
        if (item.linesCount > 0)
          detailParts.push(`${item.linesCount} lines`);
        if (item.trackLengthMs) {
          const len = formatTrackLength(item.trackLengthMs);
          if (len)
            detailParts.push(len);
        }
        detailParts.push(formatBytes2(item.sizeBytes));
        if (item.cachedAt)
          detailParts.push(formatDate(item.cachedAt));
        const metaText = detailParts.join(" \xB7 ");
        const chips = [];
        if (item.source)
          chips.push(`<span class="slt-provider-chip">${escapeHtml3(item.source)}</span>`);
        if (item.type && item.type !== "Unknown")
          chips.push(`<span class="slt-metric-pill" title="Lyric type">${escapeHtml3(item.type)}</span>`);
        if (item.lang)
          chips.push(`<span class="slt-metric-pill" title="Language">${escapeHtml3(String(item.lang).toUpperCase())}</span>`);
        return `
                    <div class="slt-cache-item" data-url="${escapeHtml3(item.req.url)}" data-cache="${escapeHtml3(item.cacheName)}" data-size="${item.sizeBytes}" data-track="${item.isTrackId ? item.trackId : ""}" data-index="${index}">
                        <div class="slt-cache-item-info">
                            <span class="slt-cache-item-title">${escapeHtml3(displayTitle)}</span>
                            <span class="slt-cache-item-meta">${escapeHtml3(metaText)}</span>
                            ${chips.length ? `<span class="slt-cache-item-provider">${chips.join("")}</span>` : ""}
                        </div>
                        <div class="slt-cache-item-actions">
                            ${item.isTrackId ? `<button class="slt-cache-action slt-cache-play">Play</button>` : ""}
                            <button class="slt-cache-action slt-cache-view" data-index="${index}">View</button>
                            <button class="slt-cache-delete" data-index="${index}">Delete</button>
                        </div>
                    </div>
                `;
      }).join("")}
        </div>

        ${cacheItems.length > 0 ? `
        <div class="slt-cache-actions">
            <button class="slt-cache-delete-all" id="slt-sl-delete-all-cache">Delete All Spicy Lyrics Cache</button>
        </div>
        ` : ""}
    `;
      setTimeout(() => {
        const backToSettingsBtn = container.querySelector("#slt-sl-cache-back-to-settings");
        backToSettingsBtn?.addEventListener("click", () => {
          hideModal();
          setTimeout(() => openSettingsModal(), 120);
        });
        container.querySelectorAll(".slt-cache-play").forEach((btn) => {
          btn.addEventListener("click", async (e) => {
            const button = e.currentTarget;
            const item = button.closest(".slt-cache-item");
            const trackId = item?.dataset.track;
            if (!trackId)
              return;
            button.disabled = true;
            const previousText = button.textContent;
            button.textContent = "Opening...";
            try {
              const uri = `spotify:track:${trackId}`;
              const played = await playCachedTrack(uri);
              notify(played ? "Opening cached track" : "Unable to play track directly", !played);
            } finally {
              button.disabled = false;
              button.textContent = previousText || "Play";
            }
          });
        });
        container.querySelectorAll(".slt-cache-view").forEach((btn) => {
          btn.addEventListener("click", (e) => {
            const button = e.currentTarget;
            const itemEl = button.closest(".slt-cache-item");
            const idxAttr = itemEl?.dataset.index;
            const idx = idxAttr ? parseInt(idxAttr, 10) : -1;
            if (idx < 0 || idx >= cacheItems.length)
              return;
            hideModal();
            setTimeout(() => openSpicyLyricsEntryInspector(cacheItems[idx]), 120);
          });
        });
        container.querySelectorAll(".slt-cache-delete").forEach((btn) => {
          btn.addEventListener("click", async (e) => {
            const item = e.target.closest(".slt-cache-item");
            if (item) {
              const url = item.dataset.url;
              const cacheName = item.dataset.cache || SPICY_LYRICS_CACHE_NAMES2[0];
              if (url && typeof caches !== "undefined") {
                try {
                  const cache = await caches.open(cacheName);
                  await cache.delete(url);
                  const itemSize = parseInt(item.dataset.size || "0", 10);
                  currentTotalSize = Math.max(0, currentTotalSize - itemSize);
                  item.remove();
                  const tracksEl = container.querySelector("#slt-sl-stat-tracks");
                  if (tracksEl) {
                    const current = parseInt(tracksEl.textContent || "0", 10);
                    tracksEl.textContent = String(Math.max(0, current - 1));
                  }
                  const sizeEl = container.querySelector("#slt-sl-stat-size");
                  if (sizeEl)
                    sizeEl.textContent = formatBytes2(currentTotalSize);
                  const list = container.querySelector("#slt-sl-cache-list");
                  if (list && list.querySelectorAll(".slt-cache-item").length === 0) {
                    list.innerHTML = '<div class="slt-empty-cache">No cached Spicy Lyrics data</div>';
                    const actionsDiv = container.querySelector(".slt-cache-actions");
                    if (actionsDiv)
                      actionsDiv.remove();
                  }
                } catch (e2) {
                  console.error("Failed to delete cache item", e2);
                }
              }
            }
          });
        });
        const deleteAllBtn = container.querySelector("#slt-sl-delete-all-cache");
        deleteAllBtn?.addEventListener("click", async () => {
          await clearSpicyLyricsCachedLyrics();
          currentTotalSize = 0;
          const tracksEl = container.querySelector("#slt-sl-stat-tracks");
          if (tracksEl)
            tracksEl.textContent = "0";
          const sizeEl = container.querySelector("#slt-sl-stat-size");
          if (sizeEl)
            sizeEl.textContent = "0 B";
          const list = container.querySelector("#slt-sl-cache-list");
          if (list)
            list.innerHTML = '<div class="slt-empty-cache">No cached Spicy Lyrics data</div>';
          const actionsDiv = container.querySelector(".slt-cache-actions");
          if (actionsDiv)
            actionsDiv.remove();
        });
      }, 0);
    } catch (e) {
      container.innerHTML = `<div style="padding: 20px; text-align: center; color: #ff7373;">Failed to load cache</div>`;
    }
    return container;
  }
  function openSpicyLyricsEntryInspector(item) {
    const content = document.createElement("div");
    content.className = "slt-lyrics-viewer";
    let prettyJson = "";
    try {
      prettyJson = item.rawJson ? JSON.stringify(JSON.parse(item.rawJson), null, 2) : "";
    } catch {
      prettyJson = item.rawJson || "";
    }
    const JSON_VIEW_LIMIT = 2e6;
    let prettyJsonTruncated = false;
    let originalJsonLength = prettyJson.length;
    if (prettyJson.length > JSON_VIEW_LIMIT) {
      prettyJsonTruncated = true;
      prettyJson = prettyJson.slice(0, JSON_VIEW_LIMIT) + `
\u2026 (truncated at ${formatBytes2(JSON_VIEW_LIMIT)} of ${formatBytes2(originalJsonLength)})`;
    }
    const renderInfoCell = (label, value, title) => `<div class="slt-lyrics-info-cell"${title ? ` title="${escapeHtml3(title)}"` : ""}>
            <span class="slt-lyrics-info-label">${escapeHtml3(label)}</span>
            <span class="slt-lyrics-info-value">${escapeHtml3(value)}</span>
        </div>`;
    const displayTitle = item.isTrackId && item.trackId ? `Track ID: ${item.trackId}` : item.url.pathname;
    const trackLen = item.trackLengthMs ? formatTrackLength(item.trackLengthMs) : "";
    content.innerHTML = `
        <style>
            .slt-lyrics-viewer {
                width: min(800px, 90vw);
                max-width: 100%;
                max-height: 78vh;
                display: flex;
                flex-direction: column;
                gap: 12px;
                padding: 2px 2px 4px;
                box-sizing: border-box;
                overflow-x: hidden;
                overflow-y: hidden;
            }
            .slt-lyrics-info {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                gap: 8px;
                padding: 12px 14px;
                background: rgba(255, 255, 255, 0.045);
                border-radius: var(--slt-radius-sm);
                border: 1px solid var(--slt-hairline-strong);
            }
            .slt-lyrics-info-cell { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
            .slt-lyrics-info-label {
                font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
                color: var(--spice-subtext); line-height: 1.3;
            }
            .slt-lyrics-info-value { font-size: 13px; font-weight: 600; color: var(--spice-text); line-height: 1.3; overflow-wrap: anywhere; }
            .slt-lyrics-header { font-size: 13px; color: var(--spice-subtext); overflow-wrap: anywhere; }
            .slt-lyrics-toolbar { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
            .slt-lyrics-back {
                min-height: 36px; padding: 8px 14px; border-radius: 500px; border: none;
                background: var(--slt-surface); border: 1px solid var(--slt-hairline-strong); box-shadow: var(--slt-gloss); color: var(--spice-text);
                font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap;
            }
            .slt-lyrics-back:hover { opacity: 0.85; }
            .slt-lyrics-copy {
                min-height: 36px; padding: 8px 14px; border-radius: 500px; border: none;
                background: var(--spice-button); color: var(--spice-text);
                font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap;
            }
            .slt-lyrics-copy.slt-copied { background: #1db954; }
            .slt-json-box {
                flex: 1;
                min-height: 200px;
                max-height: 48vh;
                overflow: auto;
                background: rgba(0, 0, 0, 0.35);
                border-radius: var(--slt-radius-sm);
                border: 1px solid var(--slt-hairline-strong);
                padding: 12px 14px;
                font-family: 'JetBrains Mono', 'Consolas', monospace;
                font-size: 12px;
                line-height: 1.5;
                color: var(--spice-text);
                white-space: pre;
                tab-size: 2;
            }
            .slt-lyrics-sample {
                font-size: 13px;
                color: var(--spice-text);
                background: rgba(255, 255, 255, 0.045);
                border: 1px solid var(--slt-hairline-strong);
                border-radius: var(--slt-radius-sm);
                padding: 10px 12px;
                line-height: 1.4;
            }
            .slt-lyrics-sample-label {
                font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
                color: var(--spice-subtext); display: block; margin-bottom: 4px;
            }
        </style>
        <div class="slt-lyrics-toolbar">
            <button id="slt-sl-entry-copy" class="slt-lyrics-copy" type="button">Copy JSON</button>
            <button id="slt-sl-entry-back" class="slt-lyrics-back" type="button">&lt; Back to Cache</button>
        </div>
        <div class="slt-lyrics-info">
            ${renderInfoCell("Source", item.source || "Unknown")}
            ${renderInfoCell("Type", item.type !== "Unknown" ? item.type : "\u2014")}
            ${renderInfoCell("Language", item.lang ? item.lang.toUpperCase() : "\u2014")}
            ${renderInfoCell("Lines", item.linesCount ? String(item.linesCount) : "\u2014")}
            ${renderInfoCell("Track Length", trackLen || "\u2014")}
            ${renderInfoCell("Size", formatBytes2(item.sizeBytes))}
            ${renderInfoCell("Cached", item.cachedAt ? formatDate(item.cachedAt) : "\u2014")}
        </div>
        <div class="slt-lyrics-header">${escapeHtml3(displayTitle)} \xB7 ${escapeHtml3(item.url.hostname)}</div>
        ${item.firstLineSample ? `<div class="slt-lyrics-sample"><span class="slt-lyrics-sample-label">First Line</span>${escapeHtml3(item.firstLineSample)}</div>` : ""}
        ${prettyJsonTruncated ? `<div class="slt-lyrics-sample" style="color: #f0b86e;"><span class="slt-lyrics-sample-label">Notice</span>JSON preview truncated for performance. Use Copy JSON to copy the full ${formatBytes2(originalJsonLength)} payload.</div>` : ""}
        <div class="slt-json-box" id="slt-sl-entry-json">${escapeHtml3(prettyJson || "(empty response)")}</div>
    `;
    if (Spicetify.PopupModal) {
      displayModal({
        title: "Spicy Lyrics entry",
        content,
        size: "xl"
      });
    }
    const backBtn = content.querySelector("#slt-sl-entry-back");
    backBtn?.addEventListener("click", () => {
      hideModal();
      setTimeout(() => openSpicyLyricsCacheViewer(), 120);
    });
    const copyBtn = content.querySelector("#slt-sl-entry-copy");
    copyBtn?.addEventListener("click", async () => {
      let fullJson = "";
      try {
        fullJson = item.rawJson ? JSON.stringify(JSON.parse(item.rawJson), null, 2) : "";
      } catch {
        fullJson = item.rawJson || "";
      }
      try {
        await navigator.clipboard.writeText(fullJson || prettyJson || "");
        copyBtn.textContent = "Copied!";
        copyBtn.classList.add("slt-copied");
        setTimeout(() => {
          copyBtn.textContent = "Copy JSON";
          copyBtn.classList.remove("slt-copied");
        }, 2e3);
      } catch {
        copyBtn.textContent = "Failed";
        setTimeout(() => {
          copyBtn.textContent = "Copy JSON";
        }, 2e3);
      }
    });
  }
  async function openSpicyLyricsCacheViewer() {
    if (Spicetify.PopupModal) {
      displayModal({
        title: "Spicy Lyrics cache",
        content: (() => {
          const div = document.createElement("div");
          div.style.padding = "20px";
          div.style.textAlign = "center";
          div.textContent = "Loading cache...";
          return div;
        })(),
        isLarge: true
      });
      const ui = await createSpicyLyricsCacheViewerUI();
      displayModal({
        title: "Spicy Lyrics cache",
        content: ui,
        isLarge: true
      });
    }
  }
  var SLT_MENU_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>';
  function openSettingsModal(options = {}) {
    if (isSettingsOpen()) {
      if (options.reveal)
        revealSetting(options.reveal);
      else if (options.tab)
        goToSettings(options.tab, options.category);
      return;
    }
    openDialog({
      title: "Spicy Lyric Translator settings",
      bare: true,
      size: "xl",
      className: "slt-settings-dialog",
      content: createSettingsShell({ tab: options.tab, category: options.category }),
      onClose: () => destroySettingsShell()
    });
    if (options.reveal)
      revealSetting(options.reveal);
  }
  registerSettingLinker({
    match: matchSettingInText,
    byId: settingById,
    reveal: (id) => openSettingsModal({ reveal: id })
  });
  async function registerSettings() {
    while (typeof Spicetify === "undefined" || !Spicetify.Platform) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    watchForSettingsPage();
    if (Spicetify.Platform?.History) {
      const registerMenuItem = () => {
        if (Spicetify.Menu) {
          try {
            new Spicetify.Menu.Item(
              "SLT Settings",
              false,
              () => openSettingsModal(),
              SLT_MENU_ICON
            ).register();
            return true;
          } catch (e) {
          }
        }
        return false;
      };
      if (!registerMenuItem()) {
        setTimeout(registerMenuItem, 2e3);
      }
    }
  }

  // src/utils/initialize.ts
  var initialized = false;
  async function initialize() {
    if (initialized)
      return;
    while (typeof Spicetify === "undefined" || !Spicetify.Platform) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    initialized = true;
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
    injectStyles();
    setConnectionIndicatorHidden(state.hideConnectionIndicator);
    initConnectionIndicator();
    await registerSettings();
    startUpdateChecker(30 * 60 * 1e3);
    setupKeyboardShortcut();
    showPostUpdateChangelog().catch(() => {
    });
    let wasSpicyLyricsOpen = false;
    const observer = new MutationObserver((mutations) => {
      const isOpen = isSpicyLyricsOpen();
      if (isOpen && !wasSpicyLyricsOpen) {
        wasSpicyLyricsOpen = true;
        onSpicyLyricsOpen();
      } else if (!isOpen && wasSpicyLyricsOpen) {
        wasSpicyLyricsOpen = false;
        onSpicyLyricsClose();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    setupViewModeObserver();
    let lastPlayerTrackUri = getCurrentTrackUri();
    if (Spicetify.Player?.addEventListener) {
      Spicetify.Player.addEventListener("songchange", () => {
        const previousFirstLine = getLyricsFirstLineText();
        const previousTrackUri = lastPlayerTrackUri;
        lastPlayerTrackUri = getCurrentTrackUri();
        setTimeout(() => {
          lastPlayerTrackUri = getCurrentTrackUri();
        }, 1200);
        state.isTranslating = false;
        state.translatedLyrics.clear();
        state._translationsByIndex = void 0;
        state._qualityByIndex = void 0;
        state.detectedLanguage = null;
        state.lastTranslatedSongUri = null;
        clearLyricsCache();
        removeTranslations();
        if (state.isEnabled || state.autoTranslate) {
          if (!state.isEnabled) {
            state.isEnabled = true;
            storage.set("translation-enabled", "true");
            updateButtonState();
          }
          waitForLyricsAndTranslate(60, 250, previousFirstLine, previousTrackUri);
        }
      });
    }
    window.SpicyLyricTranslator = {
      enable: () => {
        state.isEnabled = true;
        storage.set("translation-enabled", "true");
        translateCurrentLyrics();
      },
      disable: () => {
        state.isEnabled = false;
        storage.set("translation-enabled", "false");
        removeTranslations();
      },
      toggle: () => {
        if (isSpicyLyricsOpen())
          handleTranslateToggle();
      },
      setLanguage: (lang) => {
        storage.set("target-language", lang);
        state.targetLanguage = getResolvedTargetLanguage();
      },
      translate: translateCurrentLyrics,
      clearCache: clearTranslationCache,
      getCacheStats,
      getCachedTranslations,
      deleteCachedTranslation,
      getState: () => ({ ...state }),
      setDebugMode,
      isDebugEnabled,
      checkForUpdates: () => checkForUpdates({ trigger: "manual" }),
      getUpdateInfo,
      version: VERSION,
      connectivity: {
        getState: getConnectionState,
        refresh: refreshConnection
      }
    };
  }

  // src/app.ts
  initialize().catch(error);
  var app_default = initialize;
  return __toCommonJS(app_exports);
})();
