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
        return JSON.parse(value);
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
    }
  };
  var storage_default = storage;

  // src/utils/state.ts
  var state = {
    isEnabled: storage.get("translation-enabled") === "true",
    isTranslating: false,
    targetLanguage: storage.get("target-language") || "en",
    autoTranslate: storage.get("auto-translate") === "true",
    showNotifications: storage.get("show-notifications") !== "false",
    preferredApi: storage.get("preferred-api") || "google",
    customApiUrl: storage.get("custom-api-url") || "",
    customApiKey: storage.get("custom-api-key") || "",
    deeplApiKey: storage.get("deepl-api-key") || "",
    openaiApiKey: storage.get("openai-api-key") || "",
    openaiModel: storage.get("openai-model") || "gpt-4o-mini",
    geminiApiKey: storage.get("gemini-api-key") || "",
    lastTranslatedSongUri: null,
    translatedLyrics: /* @__PURE__ */ new Map(),
    lastViewMode: null,
    translationAbortController: null,
    overlayMode: storage.get("overlay-mode") || "interleaved",
    detectedLanguage: null,
    syncWordHighlight: storage.get("sync-word-highlight") !== "false",
    showQualityIndicator: storage.get("show-quality-indicator") !== "false",
    vocabularyMode: storage.get("vocabulary-mode") === "true",
    hideConnectionIndicator: storage.get("hide-connection-indicator") === "true",
    _qualityByIndex: void 0
  };

  // src/utils/debug.ts
  var debugMode = storage.get("debug-mode") === "true";
  var PREFIX = "[SpicyLyricTranslator]";
  function setDebugMode(enabled) {
    debugMode = enabled;
    storage.set("debug-mode", enabled.toString());
    if (enabled) {
      console.log(`${PREFIX} Debug mode enabled`);
    }
  }
  function warn(...args) {
    console.warn(PREFIX, ...args);
  }
  function error(...args) {
    console.error(PREFIX, ...args);
  }

  // src/utils/trackCache.ts
  var CACHE_KEY_PREFIX = "slt-track-cache:";
  var CACHE_INDEX_KEY = "slt-track-cache-index";
  var CACHE_MAX_TRACKS = 100;
  var CACHE_EXPIRY_DAYS = 14;
  var CACHE_EXPIRY_MS = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1e3;
  function getStorage() {
    if (typeof localStorage !== "undefined") {
      return localStorage;
    }
    return null;
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
  function getTrackCache(trackUri, targetLang) {
    const storage2 = getStorage();
    if (!storage2 || !trackUri)
      return null;
    const cacheKey = getCacheKey(trackUri, targetLang);
    try {
      const entryStr = storage2.getItem(cacheKey);
      if (!entryStr)
        return null;
      const entry = JSON.parse(entryStr);
      if (Date.now() - entry.timestamp > CACHE_EXPIRY_MS) {
        storage2.removeItem(cacheKey);
        return null;
      }
      return entry;
    } catch (e) {
      warn("Failed to read track cache:", e);
      return null;
    }
  }
  function setTrackCache(trackUri, targetLang, sourceLang, lines, api, sourceFingerprint, trackName, artistName) {
    const storage2 = getStorage();
    if (!storage2 || !trackUri || !lines.length)
      return;
    const cacheKey = getCacheKey(trackUri, targetLang);
    const meta = trackName ? { trackName, artistName } : getCurrentTrackMeta();
    const entry = {
      lang: sourceLang,
      targetLang,
      lines,
      timestamp: Date.now(),
      api,
      sourceFingerprint,
      trackName: meta.trackName,
      artistName: meta.artistName
    };
    try {
      storage2.setItem(cacheKey, JSON.stringify(entry));
      const index = getCacheIndex();
      const fullKey = `${trackUri}:${targetLang}`;
      if (!index.trackUris.includes(fullKey)) {
        index.trackUris.push(fullKey);
        if (index.trackUris.length > CACHE_MAX_TRACKS) {
          const oldestKey = index.trackUris.shift();
          if (oldestKey) {
            const [oldUri, oldLang] = oldestKey.split(":").slice(0, -1).join(":").split(":");
            const oldCacheKey = getCacheKey(oldUri || oldestKey, oldLang || targetLang);
            storage2.removeItem(oldCacheKey);
          }
        }
        saveCacheIndex(index);
      }
    } catch (e) {
      warn("Failed to set track cache:", e);
      if (e instanceof Error && e.name === "QuotaExceededError") {
        pruneOldestEntries(10);
        try {
          storage2.setItem(cacheKey, JSON.stringify(entry));
        } catch (retryError) {
          warn("Still failed after pruning:", retryError);
        }
      }
    }
  }
  function deleteTrackCache(trackUri, targetLang) {
    const storage2 = getStorage();
    if (!storage2 || !trackUri)
      return;
    const index = getCacheIndex();
    if (targetLang) {
      const cacheKey = getCacheKey(trackUri, targetLang);
      storage2.removeItem(cacheKey);
      const fullKey = `${trackUri}:${targetLang}`;
      index.trackUris = index.trackUris.filter((k) => k !== fullKey);
    } else {
      const keysToRemove = index.trackUris.filter((k) => k.startsWith(trackUri + ":"));
      keysToRemove.forEach((k) => {
        const [uri, lang] = [k.substring(0, k.lastIndexOf(":")), k.substring(k.lastIndexOf(":") + 1)];
        const cacheKey = getCacheKey(uri, lang);
        storage2.removeItem(cacheKey);
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
      const lastColonIdx = fullKey.lastIndexOf(":");
      const uri = fullKey.substring(0, lastColonIdx);
      const lang = fullKey.substring(lastColonIdx + 1);
      const cacheKey = getCacheKey(uri, lang);
      storage2.removeItem(cacheKey);
    });
    saveCacheIndex(index);
  }
  function clearAllTrackCache() {
    const storage2 = getStorage();
    if (!storage2)
      return;
    const index = getCacheIndex();
    index.trackUris.forEach((fullKey) => {
      const lastColonIdx = fullKey.lastIndexOf(":");
      const uri = fullKey.substring(0, lastColonIdx);
      const lang = fullKey.substring(lastColonIdx + 1);
      const cacheKey = getCacheKey(uri, lang);
      storage2.removeItem(cacheKey);
    });
    storage2.removeItem(CACHE_INDEX_KEY);
  }
  function getTrackCacheStats() {
    const storage2 = getStorage();
    if (!storage2)
      return { trackCount: 0, totalLines: 0, oldestTimestamp: null, sizeBytes: 0 };
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
              const entry = JSON.parse(entryStr);
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
      const cacheKey = getCacheKey(uri, lang);
      try {
        const entryStr = storage2.getItem(cacheKey);
        if (entryStr) {
          trackCount++;
          sizeBytes += entryStr.length * 2;
          const entry = JSON.parse(entryStr);
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
  function getAllCachedTracks() {
    const storage2 = getStorage();
    if (!storage2)
      return [];
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
                const entry = JSON.parse(entryStr);
                const keyParts = key.substring(CACHE_KEY_PREFIX.length);
                const lastColonIdx = keyParts.lastIndexOf(":");
                const uri = keyParts.substring(0, lastColonIdx).replace(/_/g, ":");
                const lang = keyParts.substring(lastColonIdx + 1);
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
          }
        }
        if (tracks.length > 0) {
          return tracks.sort((a, b) => b.timestamp - a.timestamp);
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
      const cacheKey = getCacheKey(uri, lang);
      try {
        const entryStr = storage2.getItem(cacheKey);
        if (entryStr) {
          const entry = JSON.parse(entryStr);
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
    { code: "ja", scripts: /[\u3040-\u30FF\u4E00-\u9FAF]/ },
    { code: "zh", scripts: /[\u4E00-\u9FFF]/ },
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
    { code: "pl", words: ["i", "w", "na", "nie", "do", "to", "\u017Ce", "co", "jest", "si\u0119", "ja", "ty", "on", "my", "wy", "ale", "jak", "tak"] },
    { code: "hi", words: ["hai", "hain", "hoon", "tha", "thi", "nahi", "nahin", "kya", "kaise", "kaisa", "kaisi", "kahan", "kyun", "kab", "mera", "meri", "tera", "teri", "tere", "tumhara", "hamara", "apna", "apni", "apne", "tujhe", "mujhe", "mujhko", "tujhko", "tumhe", "hume", "unhe", "isko", "usko", "uski", "iski", "iske", "uske", "dil", "pyar", "ishq", "mohabbat", "zindagi", "duniya", "sapna", "sapne", "raat", "din", "aankh", "aankhein", "ankhiyo", "nazar", "waqt", "gham", "khushi", "dard", "rang", "dhoop", "chand", "sitara", "dekho", "dekh", "dekhna", "suno", "sun", "sunna", "bolo", "bol", "bolna", "chalo", "chal", "chalna", "jao", "jana", "aao", "aaja", "aana", "karo", "karna", "milna", "mila", "milo", "ruk", "ruko", "rukna", "jeena", "jee", "nach", "nachle", "gaana", "gana", "bajao", "baja", "dikha", "dikhao", "dikhaa", "parda", "nakhre", "mein", "pe", "par", "wala", "wali", "wale", "bhi", "aur", "lekin", "magar", "phir", "abhi", "kabhi", "hamesha", "humesha", "sirf", "bas", "bahut", "bohot", "zyada", "kuch", "sab", "koi", "kaun", "yahan", "wahan", "udhar", "idhar", "accha", "acha", "theek", "bilkul", "zaroor", "sach", "jhooth", "alag", "saath", "mann", "mehboob", "dilbar", "sanam", "jannat", "husn", "jaane", "jaana", "toh", "se", "ke", "ka", "ki", "ko", "ne", "tu", "hum", "tum", "main", "yeh", "woh", "ab", "jab", "tab", "agar", "mat", "ya"] },
    { code: "en", words: ["the", "a", "an", "is", "are", "was", "were", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "i", "you", "he", "she", "it", "we", "they", "me", "my", "your", "his", "her", "our", "their", "do", "did", "not", "no", "have", "has", "had", "be", "been", "will", "would", "can", "could", "just", "like", "so", "this", "that", "what", "when", "how", "all", "if", "there", "them", "from", "about", "up", "out", "know", "only", "into", "than", "then", "its", "who", "which", "more", "some", "these", "those", "here"] }
  ];
  var LATIN_LANGUAGE_WORD_SETS = LATIN_LANGUAGE_WORDS.map((lang) => ({
    code: lang.code,
    words: new Set(lang.words)
  }));
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
  function tokenizeWords(text) {
    const matches = text.toLowerCase().match(/[\p{L}']+/gu);
    if (!matches)
      return [];
    return matches.filter((word) => word.length > 1);
  }
  function detectLanguageHeuristic(text) {
    if (!text || text.length < 10) {
      return null;
    }
    const normalizedText = text.trim();
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
    const dominantScript = Object.entries(scriptCounts).map(([code, count]) => ({ code, count, ratio: count / totalChars })).sort((a, b) => b.count - a.count)[0];
    if (dominantScript && dominantScript.ratio > 0.2) {
      if (dominantScript.code === "zh") {
        const japaneseKana = (normalizedText.match(/[\u3040-\u30FF]/g) || []).length;
        if (japaneseKana > 0) {
          return { code: "ja", confidence: 0.9 };
        }
      }
      return {
        code: dominantScript.code,
        confidence: Math.min(0.95, 0.6 + dominantScript.ratio * 0.3)
      };
    }
    const words = tokenizeWords(normalizedText);
    if (words.length < 3) {
      return null;
    }
    const wordCounts = {};
    let maxCount = 0;
    let maxLang = "en";
    for (const lang of LATIN_LANGUAGE_WORD_SETS) {
      let count = 0;
      for (const word of words) {
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
  async function detectLanguageViaAPI(text) {
    const sample = text.slice(0, 500);
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
    const detectedLang = typeof data?.[2] === "string" ? data[2] : "unknown";
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
    const sampleText = buildSampleText(lyrics);
    if (sampleText.length < 20) {
      return { code: "unknown", confidence: 0 };
    }
    const heuristic = detectLanguageHeuristic(sampleText);
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
  function isSameLanguage(source, target) {
    if (!source || source === "unknown")
      return false;
    const normalizeCode = (code) => {
      return code.toLowerCase().split("-")[0].split("_")[0];
    };
    return normalizeCode(source) === normalizeCode(target);
  }
  function assessMixedLanguageContent(lines, targetLanguage) {
    let nonTargetCount = 0;
    let uncertainCount = 0;
    let targetCount = 0;
    const targetBase = targetLanguage.toLowerCase().split("-")[0].split("_")[0];
    const targetIsLatin = !["ja", "zh", "ko", "ar", "he", "ru", "th", "el"].includes(targetBase);
    for (const line of lines) {
      const trimmed = (line || "").trim();
      if (trimmed.length < 3 || /^[•♪♫\s\-–—]+$/.test(trimmed))
        continue;
      if (targetIsLatin) {
        const hasNonLatin = /[\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF\u0600-\u06FF\u0590-\u05FF\u0400-\u04FF\u0E00-\u0E7F\u0900-\u097F\u0370-\u03FF]/.test(trimmed);
        if (hasNonLatin) {
          nonTargetCount++;
          continue;
        }
      }
      const detected = detectLanguageHeuristic(trimmed);
      if (!detected) {
        if (trimmed.length >= 10) {
          uncertainCount++;
        }
        continue;
      }
      if (isSameLanguage(detected.code, targetLanguage)) {
        targetCount++;
      } else if (detected.confidence >= 0.65) {
        nonTargetCount++;
      } else {
        uncertainCount++;
      }
    }
    const totalChecked = targetCount + nonTargetCount + uncertainCount;
    if (totalChecked === 0)
      return { hasMixedContent: false, nonTargetCount: 0, uncertainCount: 0 };
    const hasMixedContent = nonTargetCount >= 2 || nonTargetCount > 0 && uncertainCount > 0 && (nonTargetCount + uncertainCount) / totalChecked > 0.3;
    return { hasMixedContent, nonTargetCount, uncertainCount };
  }
  async function shouldSkipTranslation(lyrics, targetLanguage, trackUri) {
    const nonEmptyLyrics = lyrics.filter((l) => l && l.trim().length > 0 && !/^[•♪♫\s\-–—]+$/.test(l.trim()));
    if (nonEmptyLyrics.length === 0) {
      return { skip: false };
    }
    const sampleText = buildSampleText(nonEmptyLyrics);
    const quickHeuristic = detectLanguageHeuristic(sampleText);
    if (quickHeuristic && quickHeuristic.confidence >= 0.8) {
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

  // src/utils/translator.ts
  var preferredApi = "google";
  var customApiUrl = "";
  var customApiKey = "";
  var deeplApiKey = "";
  var openaiApiKey = "";
  var openaiModel = "gpt-4o-mini";
  var geminiApiKey = "";
  var RATE_LIMIT = {
    minDelayMs: 100,
    maxDelayMs: 2e3,
    maxRetries: 3,
    backoffMultiplier: 2
  };
  var lastApiCallTime = 0;
  var BATCH_SEPARATOR_REGEX = /\s*\|\|\|\s*/g;
  var BATCH_MARKER_PREFIX = "[[SLT_BATCH_";
  var BATCH_CHUNK_SIZE = 6;
  var NON_LATIN_SEGMENT_REGEX = /([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}\p{Script=Cyrillic}\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Devanagari}\p{Script=Greek}]+)/gu;
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
  function hasMixedLatinAndNonLatin(text) {
    if (!text)
      return false;
    const hasLatin = /[A-Za-z]/.test(text);
    const hasNonLatin = NON_LATIN_SEGMENT_REGEX.test(text);
    NON_LATIN_SEGMENT_REGEX.lastIndex = 0;
    return hasLatin && hasNonLatin;
  }
  function normalizeComparisonText(value) {
    return (value || "").toLowerCase().replace(/\s+/g, " ").trim();
  }
  function getLatinSkeleton(text) {
    return normalizeComparisonText(
      (text || "").replace(NON_LATIN_SEGMENT_REGEX, " ").replace(/\s+/g, " ").trim()
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
  function shouldInvalidateTrackCacheForMixedContent(sourceLines, cachedTranslatedLines, targetLang) {
    if (sourceLines.length === 0 || cachedTranslatedLines.length !== sourceLines.length) {
      return true;
    }
    let suspiciousUnchanged = 0;
    for (let i = 0; i < sourceLines.length; i++) {
      const sourceLine = normalizeSourceLineForFingerprint(sourceLines[i]);
      const translatedLine = normalizeSourceLineForFingerprint(cachedTranslatedLines[i] || "");
      if (!sourceLine || sourceLine.length < 3) {
        continue;
      }
      if (sourceLine !== translatedLine) {
        continue;
      }
      const detected = detectLanguageHeuristic(sourceLines[i]);
      if (detected && detected.confidence >= 0.8 && !isSameLanguage(detected.code, targetLang)) {
        suspiciousUnchanged++;
      }
    }
    return suspiciousUnchanged >= 2;
  }
  async function rateLimitedDelay() {
    const now = Date.now();
    const timeSinceLastCall = now - lastApiCallTime;
    if (timeSinceLastCall < RATE_LIMIT.minDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT.minDelayMs - timeSinceLastCall));
    }
    lastApiCallTime = Date.now();
  }
  async function retryWithBackoff(fn, maxRetries = RATE_LIMIT.maxRetries, baseDelay = RATE_LIMIT.minDelayMs) {
    let lastError = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await rateLimitedDelay();
        return await fn();
      } catch (error2) {
        lastError = error2;
        if (error2 instanceof Error && error2.message.includes("40")) {
          throw error2;
        }
        if (attempt < maxRetries) {
          const delay = Math.min(
            baseDelay * Math.pow(RATE_LIMIT.backoffMultiplier, attempt),
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
        customApiKey = apiKeys.customApiKey;
      if (apiKeys.deeplApiKey !== void 0)
        deeplApiKey = apiKeys.deeplApiKey;
      if (apiKeys.openaiApiKey !== void 0)
        openaiApiKey = apiKeys.openaiApiKey;
      if (apiKeys.openaiModel !== void 0)
        openaiModel = apiKeys.openaiModel;
      if (apiKeys.geminiApiKey !== void 0)
        geminiApiKey = apiKeys.geminiApiKey;
    }
  }
  var CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1e3;
  var MAX_CACHE_ENTRIES = 500;
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
  function getCachedTranslation(text, targetLang) {
    const cache = storage_default.getJSON("translation-cache", {});
    const key = `${targetLang}:${text}`;
    const cached = cache[key];
    if (cached) {
      if (Date.now() - cached.timestamp < CACHE_EXPIRY) {
        const normalized = normalizeTranslatedLine(cached.translation || "");
        if (normalized !== cached.translation) {
          cache[key] = {
            ...cached,
            translation: normalized,
            timestamp: Date.now()
          };
          storage_default.setJSON("translation-cache", cache);
        }
        if (isSuspiciousMixedLineTranslation(text, normalized)) {
          delete cache[key];
          storage_default.setJSON("translation-cache", cache);
          return null;
        }
        if (normalized === text) {
          const detected = detectLanguageHeuristic(text);
          if (detected && detected.confidence >= 0.8 && !isSameLanguage(detected.code, targetLang)) {
            delete cache[key];
            storage_default.setJSON("translation-cache", cache);
            return null;
          }
        }
        return normalized;
      }
    }
    return null;
  }
  function cacheTranslation(text, targetLang, translation, api) {
    const cache = storage_default.getJSON("translation-cache", {});
    const key = `${targetLang}:${text}`;
    const normalizedTranslation = normalizeTranslatedLine(translation || "");
    cache[key] = {
      translation: normalizedTranslation,
      timestamp: Date.now(),
      api
    };
    const keys = Object.keys(cache);
    if (keys.length > MAX_CACHE_ENTRIES) {
      const now = Date.now();
      const sorted = keys.map((k) => ({ key: k, entry: cache[k] })).sort((a, b) => a.entry.timestamp - b.entry.timestamp);
      const toRemove = sorted.filter(
        (item) => now - item.entry.timestamp > CACHE_EXPIRY
      ).map((item) => item.key);
      const remaining = keys.length - toRemove.length;
      if (remaining > MAX_CACHE_ENTRIES) {
        const validSorted = sorted.filter(
          (item) => now - item.entry.timestamp <= CACHE_EXPIRY
        );
        const additionalRemove = validSorted.slice(0, remaining - MAX_CACHE_ENTRIES).map((item) => item.key);
        toRemove.push(...additionalRemove);
      }
      toRemove.forEach((k) => delete cache[k]);
    }
    storage_default.setJSON("translation-cache", cache);
  }
  async function translateWithGoogle(text, targetLang) {
    const encodedText = encodeURIComponent(text);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodedText}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Google Translate API error: ${response.status}`);
    }
    const data = await response.json();
    const detectedLang = data[2] || "unknown";
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
  async function translateWithLibreTranslate(text, targetLang) {
    const url = "https://libretranslate.de/translate";
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        q: text,
        source: "auto",
        target: targetLang,
        format: "text"
      })
    });
    if (!response.ok) {
      throw new Error(`LibreTranslate API error: ${response.status}`);
    }
    const data = await response.json();
    return data.translatedText;
  }
  async function translateWithDeepL(text, targetLang) {
    if (!deeplApiKey) {
      throw new Error("DeepL API key not configured. Set it in Settings.");
    }
    const isFreePlan = deeplApiKey.endsWith(":fx");
    const baseUrl = isFreePlan ? "https://api-free.deepl.com" : "https://api.deepl.com";
    const url = `${baseUrl}/v2/translate`;
    const deeplLangMap = {
      "en": "EN-US",
      "pt": "PT-BR",
      "zh": "ZH-HANS",
      "zh-TW": "ZH-HANT"
    };
    const deeplTarget = deeplLangMap[targetLang] || targetLang.toUpperCase();
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `DeepL-Auth-Key ${deeplApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: [text],
        target_lang: deeplTarget
      })
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`DeepL API error: ${response.status} ${errorText}`);
    }
    const data = await response.json();
    if (data.translations && data.translations.length > 0) {
      return {
        translation: data.translations[0].text,
        detectedLang: data.translations[0].detected_source_language?.toLowerCase()
      };
    }
    throw new Error("Invalid response from DeepL API");
  }
  async function translateWithOpenAI(text, targetLang) {
    if (!openaiApiKey) {
      throw new Error("OpenAI API key not configured. Set it in Settings.");
    }
    const langName = SUPPORTED_LANGUAGES.find((l) => l.code === targetLang)?.name || targetLang;
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: openaiModel || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a song lyrics translator. Translate the given lyrics to ${langName}. Output ONLY the translated text, nothing else. Preserve line breaks. Keep the poetic feel and rhythm where possible.`
          },
          {
            role: "user",
            content: text
          }
        ],
        temperature: 0.3,
        max_tokens: Math.max(text.length * 3, 500)
      })
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }
    const data = await response.json();
    if (data.choices && data.choices.length > 0) {
      const translation = data.choices[0].message?.content?.trim();
      if (translation) {
        return { translation };
      }
    }
    throw new Error("Invalid response from OpenAI API");
  }
  async function translateWithGemini(text, targetLang) {
    if (!geminiApiKey) {
      throw new Error("Gemini API key not configured. Set it in Settings.");
    }
    const langName = SUPPORTED_LANGUAGES.find((l) => l.code === targetLang)?.name || targetLang;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `You are a song lyrics translator. Translate the following lyrics to ${langName}. Output ONLY the translated text, nothing else. Preserve line breaks. Keep the poetic feel and rhythm where possible.

${text}`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: Math.max(text.length * 3, 500)
        }
      })
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Gemini API error: ${response.status} ${errorText}`);
    }
    const data = await response.json();
    if (data.candidates && data.candidates.length > 0) {
      const translation = data.candidates[0]?.content?.parts?.[0]?.text?.trim();
      if (translation) {
        return { translation };
      }
    }
    throw new Error("Invalid response from Gemini API");
  }
  async function translateWithCustomApi(text, targetLang) {
    if (!customApiUrl) {
      throw new Error("Custom API URL not configured");
    }
    try {
      const headers = {
        "Content-Type": "application/json"
      };
      if (customApiKey) {
        headers["Authorization"] = `Bearer ${customApiKey}`;
        headers["X-API-Key"] = customApiKey;
      }
      const response = await fetch(customApiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          text,
          q: text,
          source: "auto",
          target: targetLang,
          target_lang: targetLang,
          format: "text"
        })
      });
      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new Error(`Custom API error: ${response.status} ${errorBody}`);
      }
      const data = await response.json();
      const translation = data.translatedText || data.translated_text || data.translation || data.result || data.text || data.translations && data.translations[0]?.text || data.data && data.data.translatedText || data.choices && data.choices[0]?.message?.content || Array.isArray(data) && data[0]?.translatedText;
      if (translation) {
        return {
          translation: typeof translation === "string" ? translation : String(translation),
          detectedLang: data.detectedLanguage || data.detected_language || data.sourceLang || data.src || data.detected_source_language
        };
      }
      throw new Error(`Could not parse translation from API response: ${JSON.stringify(data).slice(0, 200)}`);
    } catch (error2) {
      error("Custom API error:", error2);
      throw error2;
    }
  }
  function extractDetectedLanguage(data) {
    return data?.detectedLanguage || data?.detected_language || data?.sourceLang || data?.src;
  }
  function normalizeBatchTranslations(data) {
    const candidates = [
      data?.translatedText,
      data?.translated_text,
      data?.translation,
      data?.result,
      data?.text,
      data?.data?.translatedText,
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
  async function translateBatchArray(texts, targetLang) {
    if (texts.length === 0) {
      return { translations: [], detectedLang: void 0 };
    }
    if (preferredApi === "deepl" && deeplApiKey) {
      const isFreePlan = deeplApiKey.endsWith(":fx");
      const baseUrl = isFreePlan ? "https://api-free.deepl.com" : "https://api.deepl.com";
      const deeplLangMap = {
        "en": "EN-US",
        "pt": "PT-BR",
        "zh": "ZH-HANS",
        "zh-TW": "ZH-HANT"
      };
      const deeplTarget = deeplLangMap[targetLang] || targetLang.toUpperCase();
      const response2 = await fetch(`${baseUrl}/v2/translate`, {
        method: "POST",
        headers: {
          "Authorization": `DeepL-Auth-Key ${deeplApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: texts,
          target_lang: deeplTarget
        })
      });
      if (!response2.ok) {
        throw new Error(`DeepL batch API error: ${response2.status}`);
      }
      const data2 = await response2.json();
      if (data2.translations && Array.isArray(data2.translations)) {
        return {
          translations: data2.translations.map((t) => t.text || ""),
          detectedLang: data2.translations[0]?.detected_source_language?.toLowerCase()
        };
      }
      throw new Error("DeepL batch returned unexpected format");
    }
    const url = preferredApi === "libretranslate" ? "https://libretranslate.de/translate" : customApiUrl;
    if (!url) {
      throw new Error("Custom API URL not configured");
    }
    const headers = {
      "Content-Type": "application/json"
    };
    if (preferredApi === "custom" && customApiKey) {
      headers["Authorization"] = `Bearer ${customApiKey}`;
      headers["X-API-Key"] = customApiKey;
    }
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        q: texts,
        text: texts,
        source: "auto",
        target: targetLang,
        target_lang: targetLang,
        format: "text"
      })
    });
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(`Batch API error: ${response.status} ${errorBody}`);
    }
    const data = await response.json();
    const normalized = normalizeBatchTranslations(data);
    if (!normalized) {
      throw new Error("Batch API returned non-array payload");
    }
    return normalized;
  }
  function buildMarkedBatchPayload(lines) {
    const markerNonce = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const combinedText = lines.map((line, index) => `${BATCH_MARKER_PREFIX}${markerNonce}_${index}]]${line}`).join("\n");
    return { combinedText, markerNonce };
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
  function normalizeTranslatedLine(text) {
    return text.replace(/\[\[\s*SLT[\s_-]*BATCH[^\]]*\]\]/gi, "").replace(/\r?\n+/g, " ").replace(/\s+/g, " ").trim();
  }
  function parseBatchTextFallbacks(translatedText, expectedCount) {
    const separatorSplit = translatedText.split(BATCH_SEPARATOR_REGEX).map((s) => normalizeTranslatedLine(s));
    if (separatorSplit.length === expectedCount) {
      return separatorSplit;
    }
    const newlineSplit = translatedText.split(/\r?\n+/).map((s) => normalizeTranslatedLine(s)).filter(Boolean);
    if (newlineSplit.length === expectedCount) {
      return newlineSplit;
    }
    return null;
  }
  async function translateChunkedBatch(lines, targetLang, chunkSize = BATCH_CHUNK_SIZE) {
    const translations = [];
    let detectedLang;
    for (let start = 0; start < lines.length; start += chunkSize) {
      const chunk = lines.slice(start, start + chunkSize);
      const { combinedText, markerNonce } = buildMarkedBatchPayload(chunk);
      const result = await retryWithBackoff(() => translateText(combinedText, targetLang));
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
  async function translateText(text, targetLang) {
    const cached = getCachedTranslation(text, targetLang);
    if (cached) {
      return {
        originalText: text,
        translatedText: cached,
        targetLanguage: targetLang
      };
    }
    const tryGoogle = async () => {
      const result = await translateWithGoogle(text, targetLang);
      return { translation: result.translation, detectedLang: result.detectedLang };
    };
    const tryLibreTranslate = async () => {
      const translation = await translateWithLibreTranslate(text, targetLang);
      return { translation, detectedLang: void 0 };
    };
    const tryCustom = async () => {
      const result = await translateWithCustomApi(text, targetLang);
      return { translation: result.translation, detectedLang: result.detectedLang };
    };
    const tryDeepL = async () => {
      const result = await translateWithDeepL(text, targetLang);
      return { translation: result.translation, detectedLang: result.detectedLang };
    };
    const tryOpenAI = async () => {
      const result = await translateWithOpenAI(text, targetLang);
      return { translation: result.translation, detectedLang: result.detectedLang };
    };
    const tryGemini = async () => {
      const result = await translateWithGemini(text, targetLang);
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
      cacheTranslation(text, targetLang, result.translation, preferredApi);
      return {
        originalText: text,
        translatedText: result.translation,
        detectedLanguage: result.detectedLang,
        targetLanguage: targetLang,
        wasTranslated: true
      };
    } catch (primaryError) {
      warn(`Primary API (${preferredApi}) failed, trying fallbacks:`, primaryError);
      for (const fallbackApi of fallbackApis) {
        try {
          const result = await fallbackApi.fn();
          cacheTranslation(text, targetLang, result.translation, fallbackApi.name);
          return {
            originalText: text,
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
  async function translateLyrics(lines, targetLang, trackUri, detectedSourceLang) {
    const currentTrackUri = trackUri || getCurrentTrackUri();
    const sourceFingerprint = computeSourceLyricsFingerprint(lines);
    if (currentTrackUri) {
      const trackCache = getTrackCache(currentTrackUri, targetLang);
      if (trackCache && trackCache.lines.length === lines.length) {
        if (trackCache.sourceFingerprint && trackCache.sourceFingerprint === sourceFingerprint) {
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
          const lineCache = storage_default.getJSON("translation-cache", {});
          const lineKey = `${targetLang}:${line}`;
          const lineCacheEntry = lineCache[lineKey];
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
      if (currentTrackUri) {
        const translatedLines = finalResults.map((r) => r.translatedText);
        setTrackCache(currentTrackUri, targetLang, detectedSourceLang || "auto", translatedLines, preferredApi, sourceFingerprint);
      }
      return finalResults;
    }
    let detectedLang = detectedSourceLang || "auto";
    try {
      let translatedLines = null;
      if ((preferredApi === "custom" || preferredApi === "libretranslate" || preferredApi === "deepl") && uncachedLines.length > 1) {
        try {
          const batchResult = await retryWithBackoff(() => translateBatchArray(uncachedLines.map((l) => l.text), targetLang));
          translatedLines = batchResult.translations;
          if (batchResult.detectedLang) {
            detectedLang = batchResult.detectedLang;
          }
        } catch (batchArrayError) {
          warn("Batch-array translation unavailable, falling back to marker batching:", batchArrayError);
        }
      }
      if (!translatedLines) {
        const { combinedText, markerNonce } = buildMarkedBatchPayload(uncachedLines.map((l) => l.text));
        const result = await retryWithBackoff(() => translateText(combinedText, targetLang));
        translatedLines = parseMarkedBatchResponse(result.translatedText, uncachedLines.length, markerNonce) || parseBatchTextFallbacks(result.translatedText, uncachedLines.length);
        if (result.detectedLanguage) {
          detectedLang = result.detectedLanguage;
        }
      }
      if ((!translatedLines || translatedLines.length !== uncachedLines.length) && uncachedLines.length > 1) {
        warn(`Primary batch parse failed for ${uncachedLines.length} lines, trying chunked batch mode (${BATCH_CHUNK_SIZE}/request)`);
        const chunked = await translateChunkedBatch(uncachedLines.map((l) => l.text), targetLang);
        translatedLines = chunked.translations;
        if (chunked.detectedLang) {
          detectedLang = chunked.detectedLang;
        }
      }
      if (!translatedLines || translatedLines.length !== uncachedLines.length) {
        throw new Error(`Batch translation mismatch: Sent ${uncachedLines.length} lines, got ${translatedLines?.length ?? 0}. API might have stripped delimiters.`);
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
      for (const item of uncachedLines) {
        const existing = cachedResults.get(item.index);
        const initialTranslation = existing?.translatedText || item.text;
        const repairedTranslation = await repairMixedLineTranslation(item.text, initialTranslation, targetLang);
        const finalTranslation = normalizeTranslatedLine(repairedTranslation || "") || item.text;
        cacheTranslation(item.text, targetLang, finalTranslation, preferredApi);
        cachedResults.set(item.index, {
          originalText: item.text,
          translatedText: finalTranslation,
          targetLanguage: targetLang,
          wasTranslated: finalTranslation !== item.text,
          source: "api",
          apiProvider: preferredApi
        });
      }
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
    const someTranslated = results.some((r) => r.wasTranslated);
    if (currentTrackUri && results.length > 0 && someTranslated) {
      const translatedLines = results.map((r) => r.translatedText);
      setTrackCache(currentTrackUri, targetLang, detectedLang, translatedLines, preferredApi, sourceFingerprint);
    }
    return results;
  }
  function clearTranslationCache() {
    storage_default.remove("translation-cache");
    clearAllTrackCache();
  }
  function getCacheStats() {
    const lineCache = storage_default.getJSON("translation-cache", {});
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
  function isOffline() {
    return typeof navigator !== "undefined" && !navigator.onLine;
  }

  // src/utils/lyricsFetcher.ts
  var SPICY_LYRICS_API = "https://api.spicylyrics.org";
  async function getSpotifyAccessToken() {
    try {
      if (globalThis.Spicetify?.CosmosAsync) {
        const result = await globalThis.Spicetify.CosmosAsync.get("sp://oauth/v2/token");
        if (result?.accessToken) {
          return result.accessToken;
        }
      }
    } catch (e) {
    }
    try {
      const session = globalThis.Spicetify?.Platform?.Session;
      if (session?.accessToken) {
        return session.accessToken;
      }
    } catch (e) {
    }
    throw new Error("Could not obtain Spotify access token");
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
  function getSpicyLyricsVersion() {
    try {
      const metadata = globalThis._spicy_lyrics_metadata;
      if (metadata?.LoadedVersion && typeof metadata.LoadedVersion === "string") {
        return metadata.LoadedVersion;
      }
    } catch (e) {
    }
    try {
      const session = globalThis._spicy_lyrics_session;
      const ver = session?.SpicyLyrics?.GetCurrentVersion?.();
      if (ver?.Text) {
        return ver.Text;
      }
    } catch (e) {
    }
    try {
      const stored = globalThis.Spicetify?.LocalStorage?.get("SpicyLyrics-previous-version");
      if (stored && /^\d+\.\d+\.\d+/.test(stored)) {
        return stored;
      }
    } catch (e) {
    }
    return "5.19.11";
  }
  async function querySpicyLyricsAPI(trackId) {
    const token = await getSpotifyAccessToken();
    const spicyVersion = getSpicyLyricsVersion();
    const body = {
      queries: [
        {
          operation: "lyrics",
          variables: {
            id: trackId,
            auth: "SpicyLyrics-WebAuth"
          }
        }
      ],
      client: {
        version: spicyVersion
      }
    };
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5e3);
    try {
      const res = await fetch(`${SPICY_LYRICS_API}/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "SpicyLyrics-Version": spicyVersion,
          "SpicyLyrics-WebAuth": `Bearer ${token}`
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        throw new Error(`SpicyLyrics API request failed with status ${res.status}`);
      }
      const data = await res.json();
      const lyricsResult = data.queries?.[0]?.result;
      if (!lyricsResult) {
        warn("No lyrics query result found in API response");
        return null;
      }
      if (lyricsResult.httpStatus !== 200) {
        return null;
      }
      let lyricsData;
      if (lyricsResult.format === "json") {
        lyricsData = lyricsResult.data;
      } else if (lyricsResult.format === "text" && typeof lyricsResult.data === "string") {
        try {
          lyricsData = JSON.parse(lyricsResult.data);
        } catch {
          return null;
        }
      } else {
        return null;
      }
      return lyricsData;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
      }
      throw err;
    }
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
        const wordTimings = [];
        let lineText = "";
        for (const syllable of group.Lead.Syllables) {
          wordTimings.push({
            text: syllable.Text,
            startTime: syllable.StartTime,
            endTime: syllable.EndTime,
            isPartOfWord: syllable.IsPartOfWord
          });
          if (syllable.IsPartOfWord) {
            lineText += syllable.Text;
          } else {
            if (lineText.length > 0)
              lineText += " ";
            lineText += syllable.Text;
          }
        }
        lineData.push({
          text: lineText.trim(),
          startTime: group.Lead.StartTime,
          endTime: group.Lead.EndTime,
          isInstrumental: false,
          words: wordTimings
        });
        continue;
      }
      if (group.Text !== void 0 && group.StartTime !== void 0 && group.EndTime !== void 0) {
        lineData.push({
          text: String(group.Text).trim(),
          startTime: group.StartTime,
          endTime: group.EndTime,
          isInstrumental: false
        });
        continue;
      }
      if (group.Lead) {
        const leadText = group.Lead.Text;
        if (leadText !== void 0) {
          lineData.push({
            text: String(leadText).trim(),
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
    return lyrics.Lines.map((line) => ({
      text: line.Text?.trim() || "",
      startTime: 0,
      endTime: 0,
      isInstrumental: false
    }));
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
      const lyrics = await querySpicyLyricsAPI(trackId);
      if (!lyrics) {
        return null;
      }
      const lineData = extractLinesData(lyrics);
      if (lineData.length === 0) {
        return null;
      }
      cachedTrackId = trackId;
      cachedLineData = lineData;
      cachedLanguage = lyrics.Language || null;
      const lines = lineData.map((l) => l.text);
      return { lines, lineData, language: lyrics.Language || void 0 };
    } catch (err) {
      warn("Failed to fetch lyrics from SpicyLyrics API:", err);
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
      const lyrics = await querySpicyLyricsAPI(trackId);
      if (!lyrics) {
        return null;
      }
      const lineData = extractLinesData(lyrics);
      if (lineData.length === 0) {
        return null;
      }
      cachedTrackId = trackId;
      cachedLineData = lineData;
      cachedLanguage = lyrics.Language || null;
      return {
        lines: lineData.map((l) => l.text),
        lineData,
        language: lyrics.Language || void 0
      };
    } catch (err) {
      warn("Failed to fetch lyrics for track URI:", trackUri, err);
      return null;
    }
  }
  function clearLyricsCache() {
    cachedTrackId = null;
    cachedLineData = null;
    cachedLanguage = null;
  }

  // src/utils/translationOverlay.ts
  var currentConfig = {
    mode: "replace",
    opacity: 0.85,
    fontSize: 0.9,
    syncWordHighlight: true
  };
  var isOverlayEnabled = false;
  var translationMap = /* @__PURE__ */ new Map();
  var lineTimingData = [];
  var qualityMap = /* @__PURE__ */ new Map();
  var docCacheMap = /* @__PURE__ */ new WeakMap();
  function getDocCache(doc) {
    let cache = docCacheMap.get(doc);
    if (!cache) {
      cache = { lines: null, translationMap: null, lastActiveIndex: -1 };
      docCacheMap.set(doc, cache);
    }
    return cache;
  }
  function resetDocCache(doc) {
    docCacheMap.set(doc, { lines: null, translationMap: null, lastActiveIndex: -1 });
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
    if (doc.body?.classList?.contains("SpicySidebarLyrics__Active")) {
      const sidebarLines = doc.querySelectorAll(`.Root__right-sidebar #SpicyLyricsPage .line${excludeSelector}`);
      if (sidebarLines.length > 0)
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
    if (doc.body?.classList?.contains("SpicySidebarLyrics__Active")) {
      const sidebarContainer = doc.querySelector(".Root__right-sidebar #SpicyLyricsPage .SpicyLyricsScrollContainer") || doc.querySelector(".Root__right-sidebar #SpicyLyricsPage .LyricsContent");
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
        return parts.join(" ").replace(/\s+/g, " ").trim();
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
      return wordUnits.map((w) => w.textContent?.trim() || "").join(" ").replace(/\s+/g, " ").trim();
    }
    return line.textContent?.trim() || "";
  }
  function getWordUnits(line) {
    const units = [];
    const allElements = line.querySelectorAll(".word:not(.dot), .letterGroup, .syllable");
    for (const el of Array.from(allElements)) {
      if (el.closest(".letterGroup") && !el.classList.contains("letterGroup")) {
        continue;
      }
      let isNested = false;
      for (const unit of units) {
        if (unit.contains(el) && unit !== el) {
          isNested = true;
          break;
        }
      }
      if (!isNested) {
        units.push(el);
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
  function applyReplaceMode(doc) {
    resetDocCache(doc);
    const lines = getLyricLines(doc);
    doc.querySelectorAll(".slt-replace-line").forEach((el) => el.remove());
    doc.querySelectorAll(".slt-replace-hidden").forEach((el) => el.classList.remove("slt-replace-hidden"));
    const lyricsContainer = doc.querySelector(".SpicyLyricsScrollContainer");
    const lyricsType = lyricsContainer?.getAttribute("data-lyrics-type") || "Line";
    lines.forEach((line, index) => {
      const translation = translationMap.get(index);
      if (!translation)
        return;
      const originalText = extractLineText(line);
      if (translation === originalText)
        return;
      if (!line.parentNode)
        return;
      line.classList.add("slt-replace-hidden");
      line.dataset.sltIndex = index.toString();
      const replaceEl = doc.createElement("div");
      replaceEl.className = "slt-replace-line slt-sync-translation";
      replaceEl.dataset.lineIndex = index.toString();
      replaceEl.dataset.forLine = index.toString();
      replaceEl.dataset.lyricsType = lyricsType;
      const isBreak = !originalText.trim() || /^[♪♫•\-–—\s]+$/.test(originalText.trim());
      const timingInfo = lineTimingData[index];
      const isInstrumental = timingInfo?.isInstrumental || isBreak;
      if (isInstrumental) {
        replaceEl.textContent = "\u266A \u266A \u266A";
        replaceEl.classList.add("slt-replace-instrumental");
      } else {
        const vocabEnabled = storage.get("vocabulary-mode") === "true";
        if (vocabEnabled) {
          replaceEl.classList.add("slt-vocab-line");
          appendVocabularyPairs(doc, replaceEl, originalText, translation, line, "slt-replace-word");
        } else if (currentConfig.syncWordHighlight) {
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
        const clickedWord = e.target?.closest?.(".slt-replace-word, .slt-vocab-pair");
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
    });
  }
  function appendTranslationWordSpans(doc, container, translation, originalLine, wordClassName) {
    const translatedWords = translation.trim().split(/\s+/).filter(Boolean);
    if (translatedWords.length === 0) {
      container.textContent = translation || "";
      return;
    }
    const originalWords = getWordUnits(originalLine);
    const ratio = translatedWords.length / Math.max(originalWords.length, 1);
    const shouldAnimateLetters = wordClassName === "slt-sync-word" && lineHasSyllableStructure(originalLine);
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
  function appendVocabularyPairs(doc, container, originalText, translatedText, originalLine, wordClassName) {
    const origWords = originalText.trim().split(/\s+/).filter(Boolean);
    const transWords = translatedText.trim().split(/\s+/).filter(Boolean);
    if (origWords.length === 0 || transWords.length === 0) {
      container.textContent = translatedText;
      return;
    }
    const originalWordUnits = getWordUnits(originalLine);
    const pairCount = Math.min(origWords.length, transWords.length);
    const origChunks = distributeWords(origWords, pairCount);
    const transChunks = distributeWords(transWords, pairCount);
    const transRatio = transWords.length / Math.max(originalWordUnits.length, 1);
    let globalWordIndex = 0;
    for (let i = 0; i < pairCount; i++) {
      const pair = doc.createElement("span");
      pair.className = "slt-vocab-pair";
      const chunkWords = transChunks[i].split(/\s+/).filter(Boolean);
      const transSpan = doc.createElement("span");
      transSpan.className = `slt-vocab-translated ${wordClassName}`;
      if (wordClassName === "slt-sync-word") {
        transSpan.classList.add("slt-word-future");
      } else {
        transSpan.classList.add("word-notsng");
      }
      const mappedOriginalIndex = originalWordUnits.length > 0 ? Math.min(Math.floor(globalWordIndex / Math.max(transRatio, 0.01)), originalWordUnits.length - 1) : globalWordIndex;
      transSpan.dataset.originalIndex = Math.max(0, mappedOriginalIndex).toString();
      transSpan.dataset.wordIndex = globalWordIndex.toString();
      transSpan.textContent = transChunks[i];
      pair.appendChild(transSpan);
      globalWordIndex += chunkWords.length;
      const origSpan = doc.createElement("span");
      origSpan.className = "slt-vocab-original";
      origSpan.textContent = origChunks[i];
      pair.appendChild(origSpan);
      pair.title = `${origChunks[i]}  \u2192  ${transChunks[i]}`;
      container.appendChild(pair);
    }
  }
  function distributeWords(words, buckets) {
    if (buckets >= words.length) {
      const result2 = words.map((w) => w);
      while (result2.length < buckets)
        result2.push("");
      return result2;
    }
    const base = Math.floor(words.length / buckets);
    const extra = words.length % buckets;
    const result = [];
    let idx = 0;
    for (let b = 0; b < buckets; b++) {
      const count = base + (b < extra ? 1 : 0);
      result.push(words.slice(idx, idx + count).join(" "));
      idx += count;
    }
    return result;
  }
  function lineHasSyllableStructure(line) {
    return !!line.querySelector(".syllable, .letterGroup .letter, .word-group .syllable");
  }
  function splitIntoGraphemes(text) {
    const segmenterCtor = globalThis.Intl?.Segmenter;
    if (typeof segmenterCtor === "function") {
      const segmenter = new segmenterCtor(void 0, { granularity: "grapheme" });
      return Array.from(segmenter.segment(text), (segment) => segment.segment);
    }
    return Array.from(text);
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
      letterEl.style.setProperty("--slt-letter-shift", `${yShift.toFixed(3)}em`);
    });
  }
  var interleavedScrollHandler = null;
  var interleavedResizeObserver = null;
  var interleavedAnimationFrame = null;
  function setupInterleavedTracking(doc) {
    cleanupInterleavedTracking();
  }
  function cleanupInterleavedTracking() {
    if (interleavedAnimationFrame) {
      cancelAnimationFrame(interleavedAnimationFrame);
      interleavedAnimationFrame = null;
    }
    if (interleavedScrollHandler) {
      const docs = [document];
      const pipWin = getPIPWindow();
      if (pipWin)
        docs.push(pipWin.document);
      docs.forEach((doc) => {
        const container = findLyricsContainer(doc);
        if (container) {
          container.removeEventListener("scroll", interleavedScrollHandler);
        }
      });
      window.removeEventListener("resize", interleavedScrollHandler);
      interleavedScrollHandler = null;
    }
    if (interleavedResizeObserver) {
      interleavedResizeObserver.disconnect();
      interleavedResizeObserver = null;
    }
  }
  function hasWrappedSyncWords(translationEl) {
    const words = Array.from(translationEl.querySelectorAll(":scope > .slt-sync-word"));
    if (words.length < 2)
      return false;
    const firstTop = words[0].offsetTop;
    return words.some((wordEl, index) => index > 0 && Math.abs(wordEl.offsetTop - firstTop) > 2);
  }
  function fallbackToContinuousMultilineGradient(translationEl, translationText, originalLine) {
    if (lineHasSyllableStructure(originalLine))
      return;
    if (!translationEl.querySelector(":scope > .slt-sync-word"))
      return;
    if (!hasWrappedSyncWords(translationEl))
      return;
    translationEl.textContent = translationText;
    translationEl.dataset.sltGradientMode = "continuous-multiline";
  }
  function applyInterleavedMode(doc) {
    resetDocCache(doc);
    try {
      const lines = getLyricLines(doc);
      if (!lines || lines.length === 0) {
        return;
      }
      doc.querySelectorAll(".slt-interleaved-translation").forEach((el) => el.remove());
      doc.querySelectorAll(".slt-sync-translation").forEach((el) => el.remove());
      lines.forEach((line, index) => {
        try {
          const translation = translationMap.get(index);
          const originalText = extractLineText(line);
          const isBreak = !originalText.trim() || /^[♪♫•\-–—\s]+$/.test(originalText.trim());
          if (!translation && !isBreak)
            return;
          if (translation === originalText)
            return;
          if (!line.parentNode) {
            return;
          }
          line.classList.add("slt-overlay-parent");
          line.dataset.sltIndex = index.toString();
          const translationEl = doc.createElement("div");
          translationEl.className = "slt-interleaved-translation";
          translationEl.dataset.forLine = index.toString();
          translationEl.dataset.lineIndex = index.toString();
          const isVocabMode = storage.get("vocabulary-mode") === "true";
          if (isBreak) {
            translationEl.textContent = "\u2022 \u2022 \u2022";
            translationEl.classList.add("slt-music-break");
          } else if (isVocabMode && translation) {
            translationEl.classList.add("slt-vocab-line");
            translationEl.classList.add("slt-sync-translation");
            appendVocabularyPairs(doc, translationEl, originalText, translation, line, "slt-sync-word");
          } else {
            translationEl.classList.add("slt-sync-translation");
            if (currentConfig.syncWordHighlight && translation) {
              appendTranslationWordSpans(doc, translationEl, translation, line, "slt-sync-word");
            } else {
              translationEl.textContent = translation || "";
            }
          }
          const timingInfo = lineTimingData[index];
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
          if (!isBreak && currentConfig.syncWordHighlight && translation) {
            fallbackToContinuousMultilineGradient(translationEl, translation, line);
          }
        } catch (lineErr) {
          warn("Failed to process line", index, ":", lineErr);
        }
      });
      setupInterleavedTracking(doc);
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
    translatedLine.style.setProperty("--gradient-degrees", "180deg");
    for (const prop of MIRRORED_LINE_STYLE_PROPS) {
      if (prop === "--gradient-degrees")
        continue;
      const value = originalLine.style.getPropertyValue(prop);
      if (value && value.trim() !== "") {
        translatedLine.style.setProperty(prop, value);
      } else {
        translatedLine.style.removeProperty(prop);
      }
    }
    if (!originalLine.style.getPropertyValue("--gradient-position")) {
      if (isSung) {
        translatedLine.style.setProperty("--gradient-position", "100%");
      } else if (isNotSung) {
        translatedLine.style.setProperty("--gradient-position", "-20%");
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
        wordEl.style.setProperty("--gradient-degrees", perWordGradientDegrees);
        wordEl.dataset.sltGradientPos = fallbackGradient.toString();
        wordEl.style.setProperty("--gradient-position", `${fallbackGradient}%`);
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
      wordEl.style.setProperty("--gradient-degrees", perWordGradientDegrees);
      let gradientPosition = -20;
      const previousGradient = parseFloat(wordEl.dataset.sltGradientPos || "NaN");
      const wasLatchedWhite = wordEl.dataset.sltLatchedWhite === "1";
      if (!isActive) {
        gradientPosition = isSung ? 100 : -20;
        delete wordEl.dataset.sltLatchedWhite;
      } else {
        const mappedIndex2 = parseInt(wordEl.dataset.originalIndex || "-1", 10);
        const mappedGradient = mappedIndex2 >= 0 && mappedIndex2 < originalWordGradients.length ? originalWordGradients[mappedIndex2] : NaN;
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
          wordEl.dataset.sltLatchedWhite = "1";
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
      wordEl.dataset.sltGradientPos = clamped.toString();
      wordEl.style.setProperty("--gradient-position", `${clamped}%`);
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
    const lines = getLyricLines(doc);
    doc.querySelectorAll(".slt-sync-translation").forEach((transLine) => {
      const transLineEl = transLine;
      const lineIndex = parseInt(transLineEl.dataset.lineIndex || "-1");
      if (lineIndex < 0 || lineIndex >= lines.length)
        return;
      const originalLine = lines[lineIndex];
      if (!originalLine)
        return;
      const originalGradient = originalLine.style.getPropertyValue("--gradient-position").trim();
      const isActive = isLineActive(originalLine);
      const isSung = originalLine.classList.contains("Sung");
      const isNotSung = originalLine.classList.contains("NotSung");
      syncTranslationLineFromOriginal(originalLine, transLineEl, lyricsType);
      const updatedByWords = updateTranslatedWordGradients(transLineEl, originalLine);
      if (updatedByWords) {
        transLineEl.style.removeProperty("--gradient-position");
        return;
      }
      if (originalGradient !== "") {
        return;
      }
      if (!isActive) {
        transLineEl.style.setProperty("--gradient-position", isSung ? "100%" : isNotSung ? "-20%" : "-20%");
        return;
      }
      const wordProgress = getOverallWordGradientProgress(originalLine);
      if (wordProgress !== null) {
        transLineEl.style.setProperty("--gradient-position", `${-20 + wordProgress * 120}%`);
        return;
      }
      const lineStartTime = parseFloat(transLineEl.dataset.startTime || "0");
      const lineEndTime = parseFloat(transLineEl.dataset.endTime || "0");
      if (lineEndTime > 0 && lineStartTime >= 0) {
        if (currentTime >= lineEndTime) {
          transLineEl.style.setProperty("--gradient-position", "100%");
        } else if (currentTime < lineStartTime) {
          transLineEl.style.setProperty("--gradient-position", "-20%");
        } else {
          const total = lineEndTime - lineStartTime;
          const pct = total <= 0 ? 1 : (currentTime - lineStartTime) / total;
          transLineEl.style.setProperty("--gradient-position", `${-20 + Math.max(0, Math.min(1, pct)) * 120}%`);
        }
      }
    });
  }
  function syncBlurToTranslations(doc) {
    doc.querySelectorAll(".slt-interleaved-translation, .slt-replace-line").forEach((transEl) => {
      const transHtml = transEl;
      let lineEl = transEl.previousElementSibling;
      while (lineEl && !lineEl.classList.contains("line")) {
        lineEl = lineEl.previousElementSibling;
      }
      if (lineEl) {
        const blurAmount = lineEl.style.getPropertyValue("--BlurAmount");
        if (blurAmount) {
          transHtml.style.setProperty("--BlurAmount", blurAmount);
        } else {
          transHtml.style.removeProperty("--BlurAmount");
        }
      }
    });
  }
  function renderTranslations(doc) {
    if (!isOverlayEnabled || translationMap.size === 0)
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
      if (currentConfig.mode === "interleaved" || currentConfig.mode === "replace") {
        const cache = getDocCache(doc);
        if (!cache.lines) {
          cache.lines = getLyricLines(doc);
        }
        if (!cache.lines || cache.lines.length === 0)
          return;
        if (!cache.translationMap) {
          cache.translationMap = /* @__PURE__ */ new Map();
          const selector = currentConfig.mode === "replace" ? ".slt-replace-line" : ".slt-interleaved-translation";
          const translationEls = doc.querySelectorAll(selector);
          translationEls.forEach((el) => {
            const idx = parseInt(el.dataset.forLine || el.dataset.lineIndex || "-1", 10);
            if (idx >= 0)
              cache.translationMap.set(idx, el);
          });
        }
        let currentActiveIndex = -1;
        for (let i = 0; i < cache.lines.length; i++) {
          if (isLineActive(cache.lines[i])) {
            currentActiveIndex = i;
            break;
          }
        }
        if (currentActiveIndex !== cache.lastActiveIndex) {
          if (cache.lastActiveIndex !== -1) {
            const oldEl = cache.translationMap.get(cache.lastActiveIndex);
            if (oldEl)
              oldEl.classList.remove("active");
          }
          if (currentActiveIndex !== -1) {
            const newEl = cache.translationMap.get(currentActiveIndex);
            if (newEl) {
              newEl.classList.add("active");
              if (currentConfig.mode === "replace") {
                try {
                  newEl.scrollIntoView({ behavior: "smooth", block: "center" });
                } catch (scrollErr) {
                }
              }
            }
          }
          cache.lastActiveIndex = currentActiveIndex;
        }
      }
    } catch (err) {
    }
  }
  var activeLineObservers = /* @__PURE__ */ new Map();
  var activeSyncIntervalId = null;
  var activeSyncRafId = null;
  function syncLoop() {
    if (!isOverlayEnabled) {
      activeSyncRafId = null;
      return;
    }
    try {
      onActiveLineChanged(document);
      updateWordSyncStates(document);
      syncBlurToTranslations(document);
      const pipWindow = getPIPWindow();
      if (pipWindow) {
        try {
          const pipDoc = pipWindow.document;
          if (pipDoc && pipDoc.body) {
            ensurePIPStyles(pipDoc);
            if (translationMap.size > 0) {
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
      if (!lyricsContainer && doc.body.classList.contains("SpicySidebarLyrics__Active")) {
        lyricsContainer = doc.querySelector(".Root__right-sidebar #SpicyLyricsPage");
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
          let structureChanged = false;
          for (const mutation of mutations) {
            if (mutation.type === "childList") {
              structureChanged = true;
              if (mutation.addedNodes.length > 0)
                activeChanged = true;
            } else if (mutation.type === "attributes") {
              const target = mutation.target;
              if (target && (target.classList?.contains("line") || target.closest?.(".line"))) {
                activeChanged = true;
              }
            }
          }
          if (structureChanged) {
            resetDocCache(doc);
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
    cleanupInterleavedTracking();
    stopActiveSyncInterval();
    activeLineObservers.forEach((observer, doc) => {
      observer.disconnect();
    });
    activeLineObservers.clear();
    const cleanup = (doc) => {
      const overlay = doc.getElementById("spicy-translate-overlay");
      if (overlay)
        overlay.remove();
      const interleavedOverlay = doc.getElementById("slt-interleaved-overlay");
      if (interleavedOverlay)
        interleavedOverlay.remove();
      doc.querySelectorAll(".slt-interleaved-translation").forEach((el) => el.remove());
      doc.querySelectorAll(".slt-sync-translation").forEach((el) => el.remove());
      doc.querySelectorAll(".slt-replace-line").forEach((el) => el.remove());
      doc.querySelectorAll(".slt-replace-hidden").forEach((el) => el.classList.remove("slt-replace-hidden"));
      doc.querySelectorAll("[data-slt-original-html]").forEach((el) => {
        const original = el.dataset.sltOriginalHtml;
        if (original !== void 0) {
          el.innerHTML = original;
          delete el.dataset.sltOriginalHtml;
        }
      });
      doc.querySelectorAll("[data-slt-original-text]").forEach((el) => {
        const original = el.dataset.sltOriginalText;
        if (original !== void 0) {
          el.textContent = original;
          delete el.dataset.sltOriginalText;
        }
      });
      doc.querySelectorAll("[data-slt-replaced-with]").forEach((el) => {
        delete el.dataset.sltReplacedWith;
      });
      doc.querySelectorAll(".spicy-translation-container").forEach((el) => el.remove());
      doc.querySelectorAll(".spicy-hidden-original").forEach((el) => {
        el.classList.remove("spicy-hidden-original");
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
      doc.querySelectorAll(".slt-overlay-parent, .spicy-translated").forEach((el) => {
        el.classList.remove("slt-overlay-parent", "spicy-translated");
      });
      doc.querySelectorAll(".slt-sync-word").forEach((el) => {
        el.classList.remove("slt-word-past", "slt-word-active", "slt-word-future");
      });
    };
    cleanup(document);
    const pipWindow = getPIPWindow();
    if (pipWindow) {
      cleanup(pipWindow.document);
    }
    translationMap.clear();
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
#SpicyLyricsPage.ForcedCompactMode .slt-interleaved-translation {
    font-size: calc(0.88em * var(--slt-overlay-font-scale, 1));
}

#SpicyLyricsPage.SidebarMode .slt-interleaved-translation {
    font-size: calc(0.78em * var(--slt-overlay-font-scale, 1));
}

body.SpicySidebarLyrics__Active #SpicyLyricsPage .slt-interleaved-translation {
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
`;
  }

  // src/styles/main.ts
  var styles = `
@keyframes spicy-translate-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

#TranslateToggle.loading svg {
    animation: spicy-translate-spin 1s linear infinite;
}

#TranslateToggle.active svg {
    color: var(--spice-button-active, #1db954);
}

#TranslateToggle.error svg {
    color: #e74c3c;
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

.slt-replace-line.slt-vocab-line {
    background-image: none !important;
    color: inherit !important;
    -webkit-text-fill-color: inherit !important;
    background-clip: border-box !important;
    -webkit-background-clip: border-box !important;
    text-shadow: none;
    font-weight: inherit;
}

.slt-sync-translation.slt-interleaved-translation:has(.slt-sync-word),
.slt-interleaved-translation.slt-vocab-line {
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
#SpicyLyricsPage.ForcedCompactMode .slt-replace-line {
    padding: 14px 0;
}


#SpicyLyricsPage.SidebarMode .slt-replace-line {
    padding: 6px 0;
    font-size: 0.9em;
}

body.SpicySidebarLyrics__Active #SpicyLyricsPage .slt-replace-line {
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


body.SpicySidebarLyrics__Active #SpicyLyricsPage .slt-interleaved-translation {
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
    display: flex;
    align-items: center;
    margin-right: 8px;
    position: relative;
    z-index: 100;
}

.slt-ci-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border-radius: 20px;
    background: transparent;
    cursor: pointer;
    transition: background 0.25s ease;
    overflow: visible;
    white-space: nowrap;
}

.slt-ci-button:hover {
    background: rgba(255, 255, 255, 0.07);
}

.slt-ci-dot {
    width: 8px;
    height: 8px;
    min-width: 8px;
    border-radius: 50%;
    background: #555;
    transition: background 0.3s ease, box-shadow 0.3s ease;
    flex-shrink: 0;
}

.slt-ci-dot.slt-ci-connecting {
    background: #888;
    animation: slt-ci-pulse 1.5s ease-in-out infinite;
}

.slt-ci-dot.slt-ci-connected {
    background: #1db954;
    box-shadow: 0 0 6px rgba(29, 185, 84, 0.4);
}

.slt-ci-dot.slt-ci-error {
    background: #e74c3c;
    box-shadow: 0 0 6px rgba(231, 76, 60, 0.4);
}

.slt-ci-dot.slt-ci-great {
    background: #1db954;
    box-shadow: 0 0 6px rgba(29, 185, 84, 0.4);
}

.slt-ci-dot.slt-ci-ok {
    background: #ffe666;
    box-shadow: 0 0 6px rgba(255, 230, 102, 0.35);
}

.slt-ci-dot.slt-ci-bad {
    background: #ff944d;
    box-shadow: 0 0 6px rgba(255, 148, 77, 0.35);
}

.slt-ci-dot.slt-ci-horrible {
    background: #e74c3c;
    box-shadow: 0 0 6px rgba(231, 76, 60, 0.4);
}

@keyframes slt-ci-pulse {
    0%, 100% { opacity: 0.4; transform: scale(0.9); }
    50% { opacity: 1; transform: scale(1.1); }
}

.slt-ci-expanded {
    display: flex;
    align-items: center;
    opacity: 1;
    white-space: nowrap;
}

.slt-ci-stats-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.65rem;
    color: var(--spice-subtext, #b3b3b3);
}

.slt-ci-ping {
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    font-size: 0.62rem;
    font-weight: 600;
    color: var(--spice-text, #fff);
    letter-spacing: -0.01em;
    transition: color 0.3s ease;
}

.slt-ci-ping.slt-ci-great { color: #1db954; }
.slt-ci-ping.slt-ci-ok { color: #ffe666; }
.slt-ci-ping.slt-ci-bad { color: #ff944d; }
.slt-ci-ping.slt-ci-horrible { color: #e74c3c; }

.slt-ci-sep {
    width: 1px;
    height: 10px;
    background: rgba(255, 255, 255, 0.12);
    flex-shrink: 0;
}

.slt-ci-users-count {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--spice-subtext, #b3b3b3);
    font-size: 0.62rem;
    font-weight: 500;
}

.slt-ci-users-count svg {
    opacity: 0.55;
}

.slt-ci-users-count.slt-ci-active .slt-ci-active-count {
    color: #1db954;
    font-weight: 600;
}

.slt-ci-users-count.slt-ci-active svg {
    color: #1db954;
    opacity: 0.8;
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
.Cinema--Container .slt-interleaved-translation,
#SpicyLyricsPage.ForcedCompactMode .slt-interleaved-overlay .slt-interleaved-translation,
#SpicyLyricsPage.ForcedCompactMode .slt-interleaved-translation {
    font-size: calc(0.88em * var(--slt-overlay-font-scale, 1));
}

#SpicyLyricsPage.SidebarMode .slt-interleaved-overlay .slt-interleaved-translation,
#SpicyLyricsPage.SidebarMode .slt-interleaved-translation {
    font-size: calc(0.78em * var(--slt-overlay-font-scale, 1));
}

body.SpicySidebarLyrics__Active .slt-interleaved-overlay .slt-interleaved-translation,
body.SpicySidebarLyrics__Active .slt-interleaved-translation {
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








body.SpicySidebarLyrics__Active .slt-sync-line {
    margin: 4px 0;
}

body.SpicySidebarLyrics__Active .slt-sync-translation {
    font-size: 0.65em;
    margin-top: 2px;
}

body.SpicySidebarLyrics__Active .slt-sync-word.slt-word-active {
    text-shadow: 0 0 6px rgba(255, 255, 255, 0.4);
}


.spicy-pip-wrapper .slt-sync-line {
    margin: 6px 0;
}

.spicy-pip-wrapper .slt-sync-translation {
    font-size: 0.8em;
}


.Cinema--Container .slt-sync-line,
#SpicyLyricsPage.ForcedCompactMode .slt-sync-line {
    margin: 12px 0;
}

.Cinema--Container .slt-sync-translation,
#SpicyLyricsPage.ForcedCompactMode .slt-sync-translation {
    font-size: 0.85em;
    margin-top: 6px;
}

.Cinema--Container .slt-sync-word.slt-word-active,
#SpicyLyricsPage.ForcedCompactMode .slt-sync-word.slt-word-active {
    text-shadow: 
        0 0 15px rgba(255, 255, 255, 0.6),
        0 0 30px rgba(255, 255, 255, 0.4),
        0 0 45px rgba(255, 255, 255, 0.2);
}


body.slt-hide-quality-indicator .slt-quality-indicator {
    display: none !important;
}

body.slt-hide-connection-indicator .SLT_ConnectionIndicator {
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

body.SpicySidebarLyrics__Active .slt-quality-indicator {
    font-size: 7px;
    padding: 1px 3px;
    bottom: -1px;
}

body.SpicySidebarLyrics__Active .slt-qi-dot {
    width: 4px;
    height: 4px;
}

.spicy-pip-wrapper .slt-quality-indicator {
    font-size: 7px;
    padding: 1px 4px;
}

.slt-vocab-line {
    display: flex;
    flex-wrap: wrap;
    gap: 3px 5px;
    align-items: flex-end;
    font-size: 0.55em;
}

.slt-vocab-pair {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    padding: 2px 5px 3px;
    border-radius: 5px;
    background: rgba(255, 255, 255, 0.05);
    border-bottom: 1.5px solid rgba(30, 215, 96, 0.25);
    transition: background 0.2s ease, transform 0.2s ease, border-color 0.2s ease;
    cursor: default;
    max-width: 100%;
}

.slt-vocab-pair:hover {
    background: rgba(255, 255, 255, 0.12);
    transform: translateY(-1px);
    border-bottom-color: rgba(30, 215, 96, 0.6);
}

.slt-vocab-translated {
    font-size: 1em;
    font-weight: 700;
    line-height: 1.25;
    white-space: normal;
    word-break: break-word;
    display: inline;
    transform-origin: center center;
    will-change: transform;
    transition: opacity 180ms linear, text-shadow 180ms linear;

    --text-shadow-blur-radius: 4px;
    --text-shadow-opacity: 0%;
    text-shadow: 0 0 var(--text-shadow-blur-radius) rgba(255, 255, 255, var(--text-shadow-opacity));

    --gradient-degrees: 90deg;
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

.slt-vocab-translated.word-notsng,
.slt-vocab-translated.slt-word-future {
    opacity: 0.51;
}

.slt-vocab-translated.word-sung,
.slt-vocab-translated.slt-word-past {
    opacity: 0.5;
    --gradient-position: 100%;
}

.slt-vocab-translated.word-active,
.slt-vocab-translated.slt-word-active {
    opacity: 1;
}

.slt-vocab-original {
    font-size: 0.65em;
    line-height: 1.15;
    color: rgba(255, 255, 255, 0.3);
    letter-spacing: 0.01em;
    filter: blur(3px);
    transition: filter 0.25s ease, color 0.25s ease;
    user-select: none;
    white-space: normal;
    word-break: break-word;
    margin-top: 1px;
}

.slt-vocab-pair:hover .slt-vocab-original {
    filter: blur(0px);
    color: rgba(255, 255, 255, 0.65);
}

.active .slt-vocab-original,
.Active .slt-vocab-original,
.slt-interleaved-translation.active .slt-vocab-original {
    filter: blur(0px);
    color: rgba(255, 255, 255, 0.5);
}

.spicy-pip-wrapper .slt-vocab-pair {
    padding: 1px 3px 2px;
    border-bottom-width: 1px;
}

.spicy-pip-wrapper .slt-vocab-line {
    font-size: 0.5em;
}

.spicy-pip-wrapper .slt-vocab-original {
    font-size: 0.55em;
}

@media (prefers-reduced-motion: reduce) {
    .slt-vocab-original {
        filter: none !important;
    }
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

  // src/utils/updater.ts
  var getLoadedVersion = () => {
    const metadata = window._spicy_lyric_translator_metadata;
    if (metadata?.LoadedVersion) {
      return metadata.LoadedVersion;
    }
    return true ? "1.9.5" : "0.0.0";
  };
  var CURRENT_VERSION = getLoadedVersion();
  var GITHUB_REPO = "7xeh/SpicyLyricTranslator";
  var GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
  var RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`;
  var EXTENSION_FILENAME = "spicy-lyric-translator.js";
  var UPDATE_API_URL = "https://7xeh.dev/apps/spicylyrictranslate/api/version.php";
  var updateState = {
    isUpdating: false,
    progress: 0,
    status: ""
  };
  var hasShownUpdateNotice = false;
  var lastCheckTime = 0;
  var MIN_CHECK_INTERVAL_MS = 15 * 60 * 1e3;
  var DEFAULT_CHECK_INTERVAL_MS = 30 * 60 * 1e3;
  var MAX_BACKOFF_MS = 2 * 60 * 60 * 1e3;
  var REQUEST_TIMEOUT_MS = 6e3;
  var SCHEDULE_JITTER_MS = 2 * 60 * 1e3;
  var currentCheckIntervalMs = DEFAULT_CHECK_INTERVAL_MS;
  var currentBackoffMs = 0;
  var checkTimer = null;
  var checkInProgress = false;
  async function fetchWithTimeout(input, init = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  function getScheduledDelay(baseMs) {
    const normalizedBase = Math.max(MIN_CHECK_INTERVAL_MS, baseMs);
    const jitter = Math.floor(Math.random() * SCHEDULE_JITTER_MS);
    return normalizedBase + jitter + currentBackoffMs;
  }
  function scheduleNextCheck(forceDelayMs) {
    if (checkTimer !== null) {
      window.clearTimeout(checkTimer);
    }
    const delay = typeof forceDelayMs === "number" ? Math.max(1e3, forceDelayMs) : getScheduledDelay(currentCheckIntervalMs);
    checkTimer = window.setTimeout(() => {
      checkForUpdates();
    }, delay);
  }
  function increaseBackoff() {
    currentBackoffMs = currentBackoffMs === 0 ? 5 * 60 * 1e3 : Math.min(MAX_BACKOFF_MS, currentBackoffMs * 2);
  }
  function resetBackoff() {
    currentBackoffMs = 0;
  }
  function parseVersion(version) {
    const cleanVersion = version.replace(/^v/, "");
    const match = cleanVersion.match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!match) {
      return null;
    }
    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10),
      text: cleanVersion
    };
  }
  function compareVersions(v1, v2) {
    if (v1.major !== v2.major) {
      return v1.major > v2.major ? 1 : -1;
    }
    if (v1.minor !== v2.minor) {
      return v1.minor > v2.minor ? 1 : -1;
    }
    if (v1.patch !== v2.patch) {
      return v1.patch > v2.patch ? 1 : -1;
    }
    return 0;
  }
  function getCurrentVersion() {
    return parseVersion(CURRENT_VERSION) || {
      major: 1,
      minor: 0,
      patch: 0,
      text: CURRENT_VERSION
    };
  }
  async function getLatestVersion() {
    let releaseNotes = "";
    let githubRelease = null;
    try {
      const ghResponse = await fetch(GITHUB_API_URL, {
        headers: { "Accept": "application/vnd.github.v3+json" }
      });
      if (ghResponse.ok) {
        githubRelease = await ghResponse.json();
        releaseNotes = githubRelease?.body || "";
      }
    } catch (e) {
    }
    try {
      const response = await fetchWithTimeout(`${UPDATE_API_URL}?action=version&_=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        const version = parseVersion(data.version);
        if (version) {
          return {
            version,
            release: {
              tag_name: `v${data.version}`,
              name: `v${data.version}`,
              html_url: data.release_notes_url || RELEASES_URL,
              body: data.changelog || releaseNotes || "",
              published_at: data.published_at || (/* @__PURE__ */ new Date()).toISOString(),
              assets: [{
                name: EXTENSION_FILENAME,
                browser_download_url: data.download_url,
                size: 0,
                download_count: 0
              }]
            },
            downloadUrl: data.download_url
          };
        }
      }
    } catch (error2) {
      warn("Self-hosted API unavailable, trying GitHub:", error2);
    }
    if (githubRelease) {
      const version = parseVersion(githubRelease.tag_name);
      if (version) {
        const jsAsset = githubRelease.assets?.find((a) => a.name.endsWith(".js"));
        const downloadUrl = jsAsset?.browser_download_url || "";
        return { version, release: githubRelease, downloadUrl };
      }
    }
    try {
      const response = await fetchWithTimeout(GITHUB_API_URL, {
        headers: {
          "Accept": "application/vnd.github.v3+json"
        }
      });
      if (!response.ok) {
        warn("Failed to fetch latest version:", response.status);
        return null;
      }
      const release = await response.json();
      const version = parseVersion(release.tag_name);
      if (!version) {
        warn("Failed to parse version from tag:", release.tag_name);
        return null;
      }
      const jsAsset = release.assets?.find((a) => a.name.endsWith(".js"));
      const downloadUrl = jsAsset?.browser_download_url || "";
      return { version, release, downloadUrl };
    } catch (error2) {
      error("Error fetching latest version:", error2);
      return null;
    }
  }
  async function performSilentAutoUpdate(version, releaseBody) {
    if (updateState.isUpdating) {
      return;
    }
    try {
      updateState.isUpdating = true;
      updateState.progress = 100;
      updateState.status = "Reloading to apply update";
      storage.set("pending-update-version", version.text);
      storage.set("pending-update-timestamp", Date.now().toString());
      if (releaseBody) {
        storage.set("pending-update-changelog", releaseBody);
      }
      if (window._spicy_lyric_translator_metadata) {
        window._spicy_lyric_translator_metadata = {};
      }
      window.setTimeout(() => {
        window.location.reload();
      }, 350);
    } catch (e) {
      error("Silent auto-update failed:", e);
      updateState.isUpdating = false;
    }
  }
  function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function processInlineMarkdown(text) {
    return text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width: 100%; border-radius: 4px; margin: 4px 0;">').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #1db954; text-decoration: none;" target="_blank" rel="noopener noreferrer">$1</a>').replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/(?<![*\w])\*([^*]+?)\*(?![*\w])/g, "<em>$1</em>").replace(/~~(.*?)~~/g, "<del>$1</del>").replace(/`([^`]+)`/g, '<code style="background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 3px; font-size: 12px; color: #1db954;">$1</code>');
  }
  function formatReleaseNotes(body) {
    if (!body || body.trim() === "") {
      return '<span style="color: var(--spice-subtext); font-style: italic;">No changelog available for this release.</span>';
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
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith("```")) {
        if (inCodeBlock) {
          output.push(`<pre style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 6px; overflow-x: auto; font-family: 'Fira Code','Consolas',monospace; font-size: 12px; color: var(--spice-subtext); margin: 8px 0; white-space: pre-wrap; word-break: break-word;"><code>${codeContent.join("\n")}</code></pre>`);
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
        output.push(`<div style="font-weight: 600; margin-top: 12px; margin-bottom: 6px; color: var(--spice-text);">${processInlineMarkdown(h3[1])}</div>`);
        continue;
      }
      const h2 = line.match(/^##\s+(.*)/);
      if (h2) {
        closeLists();
        output.push(`<div style="font-weight: 600; font-size: 14px; margin-top: 14px; margin-bottom: 8px; color: var(--spice-text);">${processInlineMarkdown(h2[1])}</div>`);
        continue;
      }
      const h1 = line.match(/^#\s+(.*)/);
      if (h1) {
        closeLists();
        output.push(`<div style="font-weight: 700; font-size: 15px; margin-top: 16px; margin-bottom: 10px; color: var(--spice-text);">${processInlineMarkdown(h1[1])}</div>`);
        continue;
      }
      if (line.match(/^(---+|===+|\*\*\*+)\s*$/)) {
        closeLists();
        output.push('<hr style="border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 12px 0;">');
        continue;
      }
      const bq = line.match(/^>\s?(.*)/);
      if (bq) {
        closeLists();
        output.push(`<div style="border-left: 3px solid #1db954; padding-left: 12px; margin: 6px 0; color: var(--spice-subtext); font-style: italic;">${processInlineMarkdown(bq[1])}</div>`);
        continue;
      }
      const ul = line.match(/^\s*[-*+]\s+(.*)/);
      if (ul) {
        if (inOl) {
          output.push("</ol>");
          inOl = false;
        }
        if (!inUl) {
          output.push('<ul style="margin: 4px 0; padding-left: 0; list-style: none;">');
          inUl = true;
        }
        output.push(`<li style="display: flex; gap: 8px; margin: 4px 0;"><span style="color: #1db954;">\u2022</span><span>${processInlineMarkdown(ul[1])}</span></li>`);
        continue;
      }
      const ol = line.match(/^\s*(\d+)\.\s+(.*)/);
      if (ol) {
        if (inUl) {
          output.push("</ul>");
          inUl = false;
        }
        if (!inOl) {
          output.push('<ol style="margin: 4px 0; padding-left: 20px; color: var(--spice-subtext);">');
          inOl = true;
        }
        output.push(`<li style="margin: 4px 0;">${processInlineMarkdown(ol[2])}</li>`);
        continue;
      }
      closeLists();
      output.push(`<p style="margin: 4px 0; color: var(--spice-subtext);">${processInlineMarkdown(line)}</p>`);
    }
    closeLists();
    if (inCodeBlock) {
      output.push(`<pre style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 12px; color: var(--spice-subtext); margin: 8px 0;"><code>${codeContent.join("\n")}</code></pre>`);
    }
    return output.join("");
  }
  async function checkForUpdates(force = false) {
    const now = Date.now();
    if (checkInProgress) {
      return;
    }
    if (!force && now - lastCheckTime < MIN_CHECK_INTERVAL_MS) {
      scheduleNextCheck(MIN_CHECK_INTERVAL_MS - (now - lastCheckTime));
      return;
    }
    if (!force && document.hidden) {
      scheduleNextCheck();
      return;
    }
    if (!force && navigator.onLine === false) {
      increaseBackoff();
      scheduleNextCheck();
      return;
    }
    lastCheckTime = now;
    checkInProgress = true;
    try {
      const latest = await getLatestVersion();
      if (!latest) {
        increaseBackoff();
        return;
      }
      const current = getCurrentVersion();
      if (compareVersions(latest.version, current) > 0) {
        if (!hasShownUpdateNotice) {
          hasShownUpdateNotice = true;
        }
        await performSilentAutoUpdate(latest.version, latest.release.body);
        hasShownUpdateNotice = true;
      } else {
        resetBackoff();
        hasShownUpdateNotice = false;
      }
    } catch (error2) {
      increaseBackoff();
      error("Error checking for updates:", error2);
    } finally {
      checkInProgress = false;
      if (!updateState.isUpdating) {
        scheduleNextCheck();
      }
    }
  }
  function startUpdateChecker(intervalMs = DEFAULT_CHECK_INTERVAL_MS) {
    currentCheckIntervalMs = Math.max(MIN_CHECK_INTERVAL_MS, intervalMs);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        const elapsed = Date.now() - lastCheckTime;
        if (elapsed >= MIN_CHECK_INTERVAL_MS && !checkInProgress && !updateState.isUpdating) {
          checkForUpdates();
        }
      }
    });
    window.addEventListener("online", () => {
      if (!checkInProgress && !updateState.isUpdating) {
        resetBackoff();
        checkForUpdates();
      }
    });
    scheduleNextCheck(5e3);
  }
  async function getUpdateInfo() {
    try {
      const current = getCurrentVersion();
      const latest = await getLatestVersion();
      if (!latest) {
        return {
          hasUpdate: false,
          currentVersion: current.text,
          latestVersion: null,
          releaseUrl: null
        };
      }
      return {
        hasUpdate: compareVersions(latest.version, current) > 0,
        currentVersion: current.text,
        latestVersion: latest.version.text,
        releaseUrl: latest.release.html_url
      };
    } catch {
      return null;
    }
  }
  function showChangelogModal(version, changelog) {
    const content = document.createElement("div");
    content.className = "slt-changelog-modal";
    content.innerHTML = `
        <style>
            @keyframes slt-cl-fadeIn {
                from { opacity: 0; transform: translateY(8px); }
                to { opacity: 1; transform: translateY(0); }
            }
            @keyframes slt-confetti-float {
                0% { transform: translateY(0) rotate(0deg); opacity: 1; }
                100% { transform: translateY(-20px) rotate(180deg); opacity: 0; }
            }
            .slt-changelog-modal {
                padding: 20px;
                color: var(--spice-text);
                animation: slt-cl-fadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
            }
            .slt-changelog-modal .changelog-hero {
                display: flex;
                align-items: center;
                gap: 14px;
                margin-bottom: 20px;
                padding: 16px 18px;
                border-radius: 12px;
                background: linear-gradient(135deg, rgba(29, 185, 84, 0.12) 0%, rgba(99, 102, 241, 0.08) 100%);
                border: 1px solid rgba(29, 185, 84, 0.15);
                position: relative;
                overflow: hidden;
            }
            .slt-changelog-modal .changelog-hero::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 1px;
                background: linear-gradient(90deg, transparent, rgba(29, 185, 84, 0.4), transparent);
            }
            .slt-changelog-modal .changelog-hero-icon {
                width: 44px;
                height: 44px;
                border-radius: 12px;
                background: linear-gradient(135deg, #1db954, #1ed760);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 22px;
                flex-shrink: 0;
                box-shadow: 0 4px 12px rgba(29, 185, 84, 0.25);
            }
            .slt-changelog-modal .changelog-hero-text {
                flex: 1;
            }
            .slt-changelog-modal .changelog-hero-title {
                font-size: 16px;
                font-weight: 700;
                color: var(--spice-text);
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .slt-changelog-modal .changelog-badge {
                background: linear-gradient(135deg, #1db954, #1ed760);
                color: #000;
                padding: 3px 10px;
                border-radius: 8px;
                font-size: 11px;
                font-weight: 800;
                font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
                letter-spacing: 0.3px;
                box-shadow: 0 2px 8px rgba(29, 185, 84, 0.2);
            }
            .slt-changelog-modal .changelog-hero-subtitle {
                font-size: 12px;
                color: var(--spice-subtext);
                margin-top: 3px;
            }
            .slt-changelog-modal .changelog-content {
                background: rgba(255, 255, 255, 0.03);
                backdrop-filter: blur(6px);
                -webkit-backdrop-filter: blur(6px);
                padding: 16px 18px;
                border-radius: 10px;
                margin-bottom: 18px;
                max-height: 400px;
                overflow-y: auto;
                border: 1px solid rgba(255, 255, 255, 0.06);
                font-size: 13px;
                line-height: 1.65;
                color: var(--spice-subtext);
            }
            .slt-changelog-modal .changelog-content::-webkit-scrollbar {
                width: 5px;
            }
            .slt-changelog-modal .changelog-content::-webkit-scrollbar-track {
                background: transparent;
            }
            .slt-changelog-modal .changelog-content::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.15);
                border-radius: 10px;
            }
            .slt-changelog-modal .changelog-content::-webkit-scrollbar-thumb:hover {
                background: rgba(255, 255, 255, 0.25);
            }
            .slt-changelog-modal .changelog-content a {
                color: #1ed760;
                text-decoration: none;
                border-bottom: 1px solid rgba(30, 215, 96, 0.3);
                transition: border-color 0.2s;
            }
            .slt-changelog-modal .changelog-content a:hover {
                border-color: #1ed760;
            }
            .slt-changelog-modal .changelog-content img {
                max-width: 100%;
                border-radius: 8px;
                margin: 8px 0;
                border: 1px solid rgba(255, 255, 255, 0.06);
            }
            .slt-changelog-modal .changelog-content strong {
                color: var(--spice-text);
            }
            .slt-changelog-modal .changelog-content del {
                opacity: 0.5;
            }
            .slt-changelog-modal .changelog-buttons {
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            }
            .slt-changelog-modal .changelog-btn {
                padding: 10px 24px;
                border-radius: 24px;
                border: none;
                cursor: pointer;
                font-size: 13px;
                font-weight: 700;
                letter-spacing: 0.2px;
                transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                position: relative;
                overflow: hidden;
            }
            .slt-changelog-modal .changelog-btn::after {
                content: '';
                position: absolute;
                inset: 0;
                opacity: 0;
                background: radial-gradient(circle at center, rgba(255,255,255,0.2) 0%, transparent 70%);
                transition: opacity 0.3s;
            }
            .slt-changelog-modal .changelog-btn:hover::after {
                opacity: 1;
            }
            .slt-changelog-modal .changelog-btn.primary {
                background: linear-gradient(135deg, #1db954, #1ed760);
                color: #000;
                box-shadow: 0 2px 12px rgba(29, 185, 84, 0.25);
            }
            .slt-changelog-modal .changelog-btn.primary:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 20px rgba(29, 185, 84, 0.35);
            }
            .slt-changelog-modal .changelog-btn.primary:active {
                transform: translateY(0);
                box-shadow: 0 1px 6px rgba(29, 185, 84, 0.2);
            }
            .slt-changelog-modal .changelog-btn.secondary {
                background: rgba(255, 255, 255, 0.06);
                color: var(--spice-text);
                border: 1px solid rgba(255, 255, 255, 0.08);
            }
            .slt-changelog-modal .changelog-btn.secondary:hover {
                background: rgba(255, 255, 255, 0.1);
                border-color: rgba(255, 255, 255, 0.14);
            }
        </style>
        <div class="changelog-hero">
            <div class="changelog-hero-icon">\u2728</div>
            <div class="changelog-hero-text">
                <div class="changelog-hero-title">
                    Updated Successfully
                    <span class="changelog-badge">v${version}</span>
                </div>
                <div class="changelog-hero-subtitle">Here's what's new in this release</div>
            </div>
        </div>
        <div class="changelog-content">${formatReleaseNotes(changelog)}</div>
        <div class="changelog-buttons">
            <a href="${RELEASES_URL}" target="_blank" rel="noopener noreferrer" style="text-decoration: none;">
                <button class="changelog-btn secondary" type="button">View on GitHub</button>
            </a>
            <button class="changelog-btn primary" id="slt-changelog-dismiss">Got it</button>
        </div>
    `;
    if (Spicetify.PopupModal) {
      Spicetify.PopupModal.display({
        title: "Spicy Lyric Translator",
        content,
        isLarge: true
      });
      setTimeout(() => {
        const dismissBtn = document.getElementById("slt-changelog-dismiss");
        if (dismissBtn) {
          dismissBtn.addEventListener("click", () => {
            Spicetify.PopupModal.hide();
          });
        }
      }, 100);
    }
  }
  async function fetchChangelogForVersion(version) {
    try {
      const tagUrl = `https://api.github.com/repos/${GITHUB_REPO}/releases/tags/v${version}`;
      const response = await fetchWithTimeout(tagUrl, {
        headers: { "Accept": "application/vnd.github.v3+json" }
      });
      if (response.ok) {
        const release = await response.json();
        if (release.body)
          return release.body;
      }
    } catch (e) {
    }
    try {
      const response = await fetchWithTimeout(GITHUB_API_URL, {
        headers: { "Accept": "application/vnd.github.v3+json" }
      });
      if (response.ok) {
        const release = await response.json();
        if (release.body)
          return release.body;
      }
    } catch (e) {
    }
    return "";
  }
  function showHotfixModal(version, hashShort) {
    const hashLabel = hashShort ? ` [${hashShort}]` : "";
    const content = document.createElement("div");
    content.className = "slt-hotfix-modal";
    content.innerHTML = `
        <style>
            @keyframes slt-hf-fadeIn {
                from { opacity: 0; transform: translateY(8px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .slt-hotfix-modal {
                padding: 20px;
                color: var(--spice-text);
                animation: slt-hf-fadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
            }
            .slt-hotfix-modal .hotfix-hero {
                display: flex;
                align-items: center;
                gap: 14px;
                margin-bottom: 20px;
                padding: 16px 18px;
                border-radius: 12px;
                background: linear-gradient(135deg, rgba(255, 170, 51, 0.12) 0%, rgba(255, 136, 0, 0.06) 100%);
                border: 1px solid rgba(255, 170, 51, 0.18);
                position: relative;
                overflow: hidden;
            }
            .slt-hotfix-modal .hotfix-hero::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 1px;
                background: linear-gradient(90deg, transparent, rgba(255, 170, 51, 0.4), transparent);
            }
            .slt-hotfix-modal .hotfix-hero-icon {
                width: 44px;
                height: 44px;
                border-radius: 12px;
                background: linear-gradient(135deg, #ff9800, #ffb74d);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 22px;
                flex-shrink: 0;
                box-shadow: 0 4px 12px rgba(255, 152, 0, 0.25);
            }
            .slt-hotfix-modal .hotfix-hero-text {
                flex: 1;
            }
            .slt-hotfix-modal .hotfix-hero-title {
                font-size: 16px;
                font-weight: 700;
                color: var(--spice-text);
            }
            .slt-hotfix-modal .hotfix-hero-subtitle {
                font-size: 12px;
                color: var(--spice-subtext);
                margin-top: 3px;
            }
            .slt-hotfix-modal .hotfix-info {
                background: rgba(255, 255, 255, 0.04);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                padding: 14px 18px;
                border-radius: 10px;
                margin-bottom: 18px;
                border: 1px solid rgba(255, 255, 255, 0.07);
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
            }
            .slt-hotfix-modal .hotfix-badge {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 5px 12px;
                border-radius: 8px;
                font-size: 13px;
                font-weight: 600;
                font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
            }
            .slt-hotfix-modal .hotfix-badge.version {
                background: linear-gradient(135deg, rgba(255, 152, 0, 0.2), rgba(255, 183, 77, 0.12));
                color: #ffb74d;
                border: 1px solid rgba(255, 152, 0, 0.25);
            }
            .slt-hotfix-modal .hotfix-badge.hash {
                background: rgba(255, 255, 255, 0.06);
                color: var(--spice-subtext);
                font-size: 11px;
            }
            .slt-hotfix-modal .hotfix-buttons {
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            }
            .slt-hotfix-modal .hotfix-btn {
                padding: 10px 24px;
                border-radius: 24px;
                border: none;
                cursor: pointer;
                font-size: 13px;
                font-weight: 700;
                letter-spacing: 0.2px;
                transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                position: relative;
                overflow: hidden;
                background: linear-gradient(135deg, #ff9800, #ffb74d);
                color: #000;
                box-shadow: 0 2px 12px rgba(255, 152, 0, 0.25);
            }
            .slt-hotfix-modal .hotfix-btn::after {
                content: '';
                position: absolute;
                inset: 0;
                opacity: 0;
                background: radial-gradient(circle at center, rgba(255,255,255,0.2) 0%, transparent 70%);
                transition: opacity 0.3s;
            }
            .slt-hotfix-modal .hotfix-btn:hover::after {
                opacity: 1;
            }
            .slt-hotfix-modal .hotfix-btn:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 20px rgba(255, 152, 0, 0.35);
            }
            .slt-hotfix-modal .hotfix-btn:active {
                transform: translateY(0);
                box-shadow: 0 1px 6px rgba(255, 152, 0, 0.2);
            }
        </style>
        <div class="hotfix-hero">
            <div class="hotfix-hero-icon">\u{1F527}</div>
            <div class="hotfix-hero-text">
                <div class="hotfix-hero-title">Hotfix Applied</div>
                <div class="hotfix-hero-subtitle">A quick fix has been automatically applied to Spicy Lyric Translator.</div>
            </div>
        </div>
        <div class="hotfix-info">
            <span class="hotfix-badge version">v${version}</span>
            ${hashShort ? `<span class="hotfix-badge hash">${hashShort}</span>` : ""}
        </div>
        <div class="hotfix-buttons">
            <button class="hotfix-btn" id="slt-hotfix-dismiss">Got it</button>
        </div>
    `;
    if (Spicetify.PopupModal) {
      Spicetify.PopupModal.display({
        title: "Spicy Lyric Translator",
        content,
        isLarge: false
      });
      setTimeout(() => {
        const dismissBtn = document.getElementById("slt-hotfix-dismiss");
        if (dismissBtn) {
          dismissBtn.addEventListener("click", () => Spicetify.PopupModal.hide());
        }
      }, 100);
    }
  }
  async function showPostUpdateChangelog() {
    const currentVersion = CURRENT_VERSION;
    let targetVersion = null;
    let changelog = null;
    const hotfixDetected = storage.get("hotfix-detected");
    if (hotfixDetected) {
      storage.remove("hotfix-detected");
      await new Promise((r) => setTimeout(r, 2e3));
      const metadata = window._spicy_lyric_translator_metadata;
      const hashShort = metadata?.ContentHash ? metadata.ContentHash.substring(0, 8) : "";
      showHotfixModal(currentVersion, hashShort);
    }
    const pendingVersion = storage.get("pending-update-version");
    if (pendingVersion) {
      const pendingTimestamp = storage.get("pending-update-timestamp");
      storage.remove("pending-update-version");
      storage.remove("pending-update-timestamp");
      if (pendingTimestamp) {
        const elapsed = Date.now() - parseInt(pendingTimestamp, 10);
        if (elapsed > 60 * 60 * 1e3) {
          storage.remove("pending-update-changelog");
          storage.set("last-known-version", currentVersion);
          return;
        }
      }
      changelog = storage.get("pending-update-changelog");
      storage.remove("pending-update-changelog");
      targetVersion = pendingVersion;
    } else {
      const lastKnownVersion = storage.get("last-known-version");
      if (lastKnownVersion && lastKnownVersion !== currentVersion) {
        const lastParsed = parseVersion(lastKnownVersion);
        const currentParsed = parseVersion(currentVersion);
        if (lastParsed && currentParsed && compareVersions(currentParsed, lastParsed) > 0) {
          targetVersion = currentVersion;
        }
      } else if (!lastKnownVersion) {
        storage.set("last-known-version", currentVersion);
        return;
      }
    }
    storage.set("last-known-version", currentVersion);
    if (!targetVersion)
      return;
    if (!changelog) {
      changelog = await fetchChangelogForVersion(targetVersion);
    }
    await new Promise((r) => setTimeout(r, 2e3));
    showChangelogModal(targetVersion, changelog || "");
  }
  async function showCurrentChangelog() {
    const changelog = await fetchChangelogForVersion(CURRENT_VERSION);
    showChangelogModal(CURRENT_VERSION, changelog);
  }
  var VERSION = CURRENT_VERSION;
  var REPO_URL = RELEASES_URL;

  // src/utils/icons.ts
  var Icons = {
    Translate: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v2.01h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
    </svg>`,
    TranslateOff: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v2.01h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
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

  // src/utils/connectivity.ts
  var API_BASE = "https://7xeh.dev/apps/spicylyrictranslate/api/connectivity.php";
  var CLIENT_ID_KEY = "client-id";
  function getOrCreateClientId() {
    let clientId = storage.get(CLIENT_ID_KEY);
    if (!clientId) {
      clientId = crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2, "0")).join("");
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
    activeUsers: 0,
    isViewingLyrics: false,
    region: "",
    lastHeartbeat: 0,
    isInitialized: false
  };
  var heartbeatInterval = null;
  var latencyInterval = null;
  var containerElement = null;
  function getLatencyClass(latencyMs) {
    if (latencyMs <= LATENCY_THRESHOLDS.GREAT)
      return "slt-ci-great";
    if (latencyMs <= LATENCY_THRESHOLDS.OK)
      return "slt-ci-ok";
    if (latencyMs <= LATENCY_THRESHOLDS.BAD)
      return "slt-ci-bad";
    return "slt-ci-horrible";
  }
  function createIndicatorElement() {
    const container = document.createElement("div");
    container.className = "SLT_ConnectionIndicator";
    container.innerHTML = `
        <div class="slt-ci-button" title="Connection Status">
            <div class="slt-ci-dot"></div>
            <div class="slt-ci-expanded">
                <div class="slt-ci-stats-row">
                    <span class="slt-ci-ping" title="Round-trip latency to SLT server">--ms</span>
                    <span class="slt-ci-sep"></span>
                    <span class="slt-ci-users-count slt-ci-total" title="Total users with extension installed">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                            <circle cx="9" cy="7" r="4"/>
                            <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                        <span class="slt-ci-total-count">0</span>
                    </span>
                    <span class="slt-ci-sep"></span>
                    <span class="slt-ci-users-count slt-ci-active" title="Users currently viewing lyrics">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                        <span class="slt-ci-active-count">0</span>
                    </span>
                </div>
            </div>
        </div>
    `;
    return container;
  }
  function updateUI() {
    if (!containerElement)
      return;
    const button = containerElement.querySelector(".slt-ci-button");
    const dot = containerElement.querySelector(".slt-ci-dot");
    const pingEl = containerElement.querySelector(".slt-ci-ping");
    const totalCountEl = containerElement.querySelector(".slt-ci-total-count");
    const activeCountEl = containerElement.querySelector(".slt-ci-active-count");
    if (!button || !dot)
      return;
    dot.classList.remove("slt-ci-connecting", "slt-ci-connected", "slt-ci-error", "slt-ci-great", "slt-ci-ok", "slt-ci-bad", "slt-ci-horrible");
    switch (indicatorState.state) {
      case "connected":
        dot.classList.add("slt-ci-connected");
        if (indicatorState.latencyMs !== null) {
          dot.classList.add(getLatencyClass(indicatorState.latencyMs));
          if (pingEl) {
            pingEl.textContent = `${indicatorState.latencyMs}ms`;
            pingEl.className = `slt-ci-ping ${getLatencyClass(indicatorState.latencyMs)}`;
          }
        }
        if (totalCountEl)
          totalCountEl.textContent = `${indicatorState.totalUsers}`;
        if (activeCountEl)
          activeCountEl.textContent = `${indicatorState.activeUsers}`;
        button.setAttribute("title", `Connected \xB7 ${indicatorState.latencyMs}ms \xB7 ${indicatorState.totalUsers} installed \xB7 ${indicatorState.activeUsers} viewing`);
        break;
      case "connecting":
      case "reconnecting":
        dot.classList.add("slt-ci-connecting");
        if (pingEl) {
          pingEl.textContent = "--ms";
          pingEl.className = "slt-ci-ping";
        }
        button.setAttribute("title", "Connecting...");
        break;
      case "error":
        dot.classList.add("slt-ci-error");
        if (pingEl) {
          pingEl.textContent = "ERR";
          pingEl.className = "slt-ci-ping slt-ci-horrible";
        }
        button.setAttribute("title", "Connection error \u2014 retrying...");
        break;
      case "disconnected":
      default:
        if (pingEl) {
          pingEl.textContent = "--ms";
          pingEl.className = "slt-ci-ping";
        }
        button.setAttribute("title", "Disconnected");
        break;
    }
    if (typeof Spicetify !== "undefined" && Spicetify.Tippy && button && !button._tippy) {
      const baseOnShow = Spicetify.TippyProps?.onShow;
      Spicetify.Tippy(button, {
        ...Spicetify.TippyProps,
        interactive: true,
        appendTo: document.body,
        delay: [200, 100],
        allowHTML: true,
        content: getTooltipContent(),
        onShow(instance) {
          if (typeof baseOnShow === "function")
            baseOnShow(instance);
          instance.setContent(getTooltipContent());
        }
      });
    } else if (button?._tippy) {
      button._tippy.setContent(getTooltipContent());
    }
  }
  function getLatencyColor(ms) {
    if (ms <= LATENCY_THRESHOLDS.GREAT)
      return "#1db954";
    if (ms <= LATENCY_THRESHOLDS.OK)
      return "#ffe666";
    if (ms <= LATENCY_THRESHOLDS.BAD)
      return "#ff944d";
    return "#e74c3c";
  }
  function getLatencyLabel(ms) {
    if (ms <= LATENCY_THRESHOLDS.GREAT)
      return "Excellent";
    if (ms <= LATENCY_THRESHOLDS.OK)
      return "Good";
    if (ms <= LATENCY_THRESHOLDS.BAD)
      return "Fair";
    return "Poor";
  }
  function getTooltipContent() {
    switch (indicatorState.state) {
      case "connected": {
        const latencyColor = indicatorState.latencyMs !== null ? getLatencyColor(indicatorState.latencyMs) : "#888";
        const latencyLabel = indicatorState.latencyMs !== null ? getLatencyLabel(indicatorState.latencyMs) : "...";
        const regionText = indicatorState.region ? `<span style="opacity:0.5;font-size:10px;" title="Server region">${indicatorState.region}</span>` : "";
        return `
                <div style="display:flex;flex-direction:column;gap:8px;padding:4px 0;font-size:12px;min-width:160px;">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:default;" title="Connection status: ${latencyLabel}">
                        <div style="display:flex;align-items:center;gap:6px;">
                            <span style="width:7px;height:7px;border-radius:50%;background:${latencyColor};box-shadow:0 0 6px ${latencyColor}80;"></span>
                            <span style="font-weight:600;">SLT Server</span>
                        </div>
                        ${regionText}
                    </div>
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;border-radius:6px;background:rgba(255,255,255,0.06);">
                        <div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1;cursor:default;" title="Round-trip latency to SLT server">
                            <span style="font-size:10px;opacity:0.5;text-transform:uppercase;letter-spacing:0.05em;">Ping</span>
                            <span style="font-weight:700;color:${latencyColor};font-family:'JetBrains Mono',Consolas,monospace;font-size:13px;">${indicatorState.latencyMs}ms</span>
                            <span style="font-size:9px;opacity:0.4;">${latencyLabel}</span>
                        </div>
                        <div style="width:1px;height:28px;background:rgba(255,255,255,0.08);"></div>
                        <div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1;cursor:default;" title="Total users with the extension installed">
                            <span style="font-size:10px;opacity:0.5;text-transform:uppercase;letter-spacing:0.05em;">Users</span>
                            <span style="font-weight:700;font-size:13px;">${indicatorState.totalUsers}</span>
                            <span style="font-size:9px;opacity:0.4;">installed</span>
                        </div>
                        <div style="width:1px;height:28px;background:rgba(255,255,255,0.08);"></div>
                        <div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1;cursor:default;" title="Users currently viewing lyrics">
                            <span style="font-size:10px;opacity:0.5;text-transform:uppercase;letter-spacing:0.05em;">Active</span>
                            <span style="font-weight:700;color:#1db954;font-size:13px;">${indicatorState.activeUsers}</span>
                            <span style="font-size:9px;opacity:0.4;">viewing</span>
                        </div>
                    </div>
                    <div style="font-size:10px;color:rgba(255,255,255,0.35);text-align:center;padding-top:2px;border-top:1px solid rgba(255,255,255,0.06);cursor:default;" title="No tracking or personal information is collected">
                        No personal data collected
                    </div>
                </div>
            `;
      }
      case "connecting":
      case "reconnecting":
        return `<div style="display:flex;align-items:center;gap:8px;font-size:12px;padding:2px 0;"><span style="width:6px;height:6px;border-radius:50%;background:#888;animation:slt-ci-pulse 1.5s ease-in-out infinite;"></span>Connecting to SLT server...</div>`;
      case "error":
        return `<div style="display:flex;align-items:center;gap:8px;font-size:12px;padding:2px 0;color:#e74c3c;"><span style="width:6px;height:6px;border-radius:50%;background:#e74c3c;"></span>Connection error \u2014 retrying...</div>`;
      default:
        return `<div style="display:flex;align-items:center;gap:8px;font-size:12px;padding:2px 0;opacity:0.7;"><span style="width:6px;height:6px;border-radius:50%;background:#666;"></span>Disconnected</div>`;
    }
  }
  async function fetchWithTimeout2(url, options = {}, timeout = CONNECTION_TIMEOUT) {
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
      const response = await fetchWithTimeout2(`${API_BASE}?action=ping&_=${Date.now()}`);
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
      const shareData = storage.get("share-usage-data") !== "false";
      const params = new URLSearchParams({
        action: "heartbeat",
        session: indicatorState.sessionId || "",
        version: storage.get("extension-version") || "1.0.0",
        active: shareData && indicatorState.isViewingLyrics ? "true" : "false",
        clientId: getOrCreateClientId()
      });
      const response = await fetchWithTimeout2(`${API_BASE}?${params}`);
      if (!response.ok)
        throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.success) {
        indicatorState.sessionId = data.sessionId || indicatorState.sessionId;
        indicatorState.totalUsers = data.totalUsers || 0;
        indicatorState.activeUsers = data.activeUsers || 0;
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
      const response = await fetchWithTimeout2(`${API_BASE}?${params}`);
      if (!response.ok)
        throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.success) {
        indicatorState.sessionId = data.sessionId;
        indicatorState.totalUsers = data.totalUsers || 0;
        indicatorState.activeUsers = data.activeUsers || 0;
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
    indicatorState.activeUsers = 0;
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
    const userWidget = document.querySelector(".main-userWidget-box");
    if (userWidget && userWidget.parentNode)
      return userWidget.parentNode;
    const historyButtons = document.querySelector(".main-topBar-historyButtons");
    if (historyButtons && historyButtons.parentNode)
      return historyButtons.parentNode;
    return null;
  }
  function waitForElement(selector, timeout = 1e4) {
    return new Promise((resolve) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }
      const observer = new MutationObserver((mutations, obs) => {
        const el = document.querySelector(selector);
        if (el) {
          obs.disconnect();
          resolve(el);
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
    if (containerElement && containerElement.parentNode)
      return true;
    const container = getIndicatorContainer();
    if (container) {
      containerElement = createIndicatorElement();
      container.insertBefore(containerElement, container.firstChild);
      return true;
    }
    const topBarContentRight = await waitForElement(".main-topBar-topbarContentRight");
    if (topBarContentRight) {
      containerElement = createIndicatorElement();
      topBarContentRight.insertBefore(containerElement, topBarContentRight.firstChild);
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
  function setViewingLyrics(isViewing) {
    if (indicatorState.isViewingLyrics !== isViewing) {
      indicatorState.isViewingLyrics = isViewing;
      if (indicatorState.state === "connected") {
        sendHeartbeat().then(() => updateUI());
      }
    }
  }
  function notifyShareDataChanged() {
    if (indicatorState.state === "connected") {
      sendHeartbeat().then(() => updateUI());
    }
  }

  // src/utils/core.ts
  var lyricsObserver = null;
  var translateDebounceTimer = null;
  var viewModeIntervalId = null;
  var romanizationToggleListener = null;
  var romanizationToggleButton = null;
  var observedLyricsContent = null;
  var lastKnownRomanizationState = null;
  var lastTranslatedRomanizationState = null;
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
    const btn = document.querySelector("#RomanizationToggle");
    if (btn) {
      if (btn.classList.contains("active"))
        return true;
    }
    try {
      const spicetifyStorage = globalThis.Spicetify?.LocalStorage;
      if (spicetifyStorage?.get) {
        const val = spicetifyStorage.get("SpicyLyrics:romanization");
        if (val === "true")
          return true;
        if (val === "false")
          return false;
      }
    } catch (e) {
    }
    try {
      for (const key of ["SpicyLyrics:romanization", "romanization"]) {
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
    if (document.querySelector("#SpicyLyricsPage") || document.querySelector(".spicy-pip-wrapper #SpicyLyricsPage") || document.querySelector(".Cinema--Container") || document.querySelector(".spicy-lyrics-cinema") || document.body.classList.contains("SpicySidebarLyrics__Active")) {
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
    if (document.body.classList.contains("SpicySidebarLyrics__Active")) {
      const sidebarContent = document.querySelector(".Root__right-sidebar #SpicyLyricsPage .LyricsContainer .LyricsContent") || document.querySelector(".Root__right-sidebar #SpicyLyricsPage .LyricsContent");
      if (sidebarContent)
        return sidebarContent;
    }
    return document.querySelector("#SpicyLyricsPage .LyricsContainer .LyricsContent") || document.querySelector("#SpicyLyricsPage .LyricsContent") || document.querySelector(".spicy-pip-wrapper .LyricsContent") || document.querySelector(".Cinema--Container .LyricsContent") || document.querySelector(".LyricsContainer .LyricsContent");
  }
  function waitForElement2(selector, timeout = 1e4) {
    return new Promise((resolve) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }
      const observer = new MutationObserver((mutations, obs) => {
        const el = document.querySelector(selector);
        if (el) {
          obs.disconnect();
          resolve(el);
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
        Spicetify.Tippy(button, {
          ...Spicetify.TippyProps,
          content: state.isEnabled ? "Disable Translation" : "Enable Translation"
        });
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
      openSettingsModal();
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
  }
  function insertTranslateButtonIntoDocument(doc) {
    let viewControls = doc.querySelector("#SpicyLyricsPage .ContentBox .ViewControls") || doc.querySelector("#SpicyLyricsPage .ViewControls");
    if (!viewControls && doc.body.classList.contains("SpicySidebarLyrics__Active")) {
      viewControls = doc.querySelector(".Root__right-sidebar #SpicyLyricsPage .ViewControls");
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
      return Array.from(words).map((w) => w.textContent?.trim() || "").join(" ").replace(/\s+/g, " ").trim();
    }
    const letters = lineElement.querySelectorAll(".letter");
    if (letters.length > 0) {
      return Array.from(letters).map((l) => l.textContent || "").join("").trim();
    }
    return lineElement.textContent?.trim() || "";
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
      if (targetIsLatin) {
        const hasNonLatin = /[\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF\u0600-\u06FF\u0590-\u05FF\u0400-\u04FF\u0E00-\u0E7F\u0900-\u097F\u0370-\u03FF]/.test(line);
        if (hasNonLatin) {
          indexes.push(i);
          continue;
        }
      }
      const detected = detectLanguageHeuristic(line);
      if (!detected) {
        continue;
      }
      if (!isSameLanguage(detected.code, targetLanguage) && detected.confidence >= 0.7) {
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
      if (doc.body.classList.contains("SpicySidebarLyrics__Active")) {
        const sidebar = doc.querySelectorAll(`.Root__right-sidebar #SpicyLyricsPage .line${excludeSelector}`);
        if (sidebar.length > 0)
          return sidebar;
      }
      const generic = doc.querySelectorAll(`.LyricsContent .line${excludeSelector}, .LyricsContainer .line${excludeSelector}`);
      if (generic.length > 0)
        return generic;
    }
    return document.querySelectorAll(".non-existent-selector");
  }
  async function waitForLyricsAndTranslate(retries = 10, delay = 500) {
    for (let i = 0; i < retries; i++) {
      if (!isSpicyLyricsOpen() || state.isTranslating)
        return;
      const lines = getLyricsLines();
      if (lines.length > 0) {
        const firstLineText = lines[0].textContent?.trim();
        if (firstLineText && firstLineText.length > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
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
      const lines2 = getLyricsLines();
      if (lines2.length > 0 && !document.querySelector(".slt-interleaved-translation, .slt-replace-line, .spicy-translated")) {
        applyTranslations(lines2);
      }
      return;
    }
    if (romanizationChanged) {
      removeTranslations();
    }
    if (isOffline()) {
      const cacheStats = getCacheStats();
      if (cacheStats.entries === 0) {
        if (state.showNotifications && Spicetify.showNotification) {
          Spicetify.showNotification("Offline - translations unavailable", true);
        }
        return;
      }
    }
    let lines = getLyricsLines();
    if (lines.length === 0)
      return;
    state.isTranslating = true;
    const buttons = [
      document.querySelector("#TranslateToggle"),
      getPIPWindow2()?.document.querySelector("#TranslateToggle")
    ];
    buttons.forEach((b) => {
      if (b) {
        b.classList.add("loading");
        b.innerHTML = Icons.Loading;
      }
    });
    try {
      let domLineTexts = [];
      lines.forEach((line) => domLineTexts.push(extractLineText2(line)));
      const nonEmptyDomTexts = domLineTexts.filter((t) => t.trim().length > 0);
      if (nonEmptyDomTexts.length === 0) {
        state.isTranslating = false;
        restoreButtonState();
        return;
      }
      const currentTrackUri2 = getCurrentTrackUri();
      const romanizationOn = isRomanizationActive();
      if (romanizationOn) {
      } else {
        const preApiSkipCheck = await shouldSkipTranslation(nonEmptyDomTexts, state.targetLanguage, currentTrackUri2 || void 0);
        if (preApiSkipCheck.detectedLanguage) {
          state.detectedLanguage = preApiSkipCheck.detectedLanguage;
        }
      }
      let apiLineTexts = null;
      let apiLanguage;
      let apiLineData = null;
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
      let useApiLines = apiVocalTexts && apiVocalTexts.length === lines.length;
      if (!useApiLines && romanizationOn && apiVocalTexts && apiVocalTexts.length > 0) {
        for (let retryAttempt = 0; retryAttempt < 4; retryAttempt++) {
          await new Promise((resolve) => setTimeout(resolve, 400));
          lines = getLyricsLines();
          if (lines.length === 0)
            break;
          domLineTexts = [];
          lines.forEach((line) => domLineTexts.push(extractLineText2(line)));
          if (apiVocalTexts.length === lines.length) {
            useApiLines = true;
            break;
          }
        }
        if (!useApiLines && apiVocalTexts.length > 0 && lines.length > 0) {
          useApiLines = true;
          const domCount = lines.length;
          if (apiVocalTexts.length > domCount) {
            apiVocalTexts = apiVocalTexts.slice(0, domCount);
            if (apiVocalLineData)
              apiVocalLineData = apiVocalLineData.slice(0, domCount);
          } else if (apiVocalTexts.length < domCount) {
            for (let i = apiVocalTexts.length; i < domCount; i++) {
              apiVocalTexts.push(domLineTexts[i] || "");
              if (apiVocalLineData) {
                apiVocalLineData.push({
                  text: domLineTexts[i] || "",
                  startTime: 0,
                  endTime: 0,
                  isInstrumental: false
                });
              }
            }
          }
        }
      }
      if (!useApiLines && apiVocalTexts && apiVocalTexts.length > 0) {
        for (let retryAttempt = 0; retryAttempt < 8; retryAttempt++) {
          await new Promise((resolve) => setTimeout(resolve, 600));
          lines = getLyricsLines();
          if (lines.length === 0)
            break;
          domLineTexts = [];
          lines.forEach((line) => domLineTexts.push(extractLineText2(line)));
          if (apiVocalTexts.length === lines.length) {
            useApiLines = true;
            break;
          }
          const apiTextSet = new Set(apiVocalTexts.map((t) => t.trim().toLowerCase()));
          const domMatchCount = domLineTexts.filter((t) => apiTextSet.has(t.trim().toLowerCase())).length;
          if (domMatchCount > domLineTexts.length * 0.3) {
            break;
          }
        }
      }
      let matchedTimingData = null;
      if (!useApiLines && apiVocalTexts && apiVocalLineData && apiVocalTexts.length > 0) {
        const apiTextMap = /* @__PURE__ */ new Map();
        for (let i = 0; i < apiVocalTexts.length; i++) {
          const norm = apiVocalTexts[i].trim().toLowerCase();
          if (norm && !apiTextMap.has(norm)) {
            apiTextMap.set(norm, apiVocalLineData[i]);
          }
        }
        matchedTimingData = [];
        let matchCount = 0;
        for (let i = 0; i < domLineTexts.length; i++) {
          const domNorm = domLineTexts[i].trim().toLowerCase();
          const matched = apiTextMap.get(domNorm);
          if (matched) {
            matchedTimingData.push(matched);
            matchCount++;
          } else {
            matchedTimingData.push({
              text: domLineTexts[i],
              startTime: 0,
              endTime: 0,
              isInstrumental: false
            });
          }
        }
      }
      const lineTexts = useApiLines ? apiVocalTexts : domLineTexts;
      if (useApiLines) {
      } else if (apiVocalTexts) {
      }
      const nonEmptyTexts = lineTexts.filter((t) => t.trim().length > 0);
      if (nonEmptyTexts.length === 0) {
        state.isTranslating = false;
        restoreButtonState();
        return;
      }
      const detectedLang = apiLanguage || state.detectedLanguage || void 0;
      let skipCheck;
      if (romanizationOn && apiLanguage) {
        const apiLangSame = isSameLanguage(apiLanguage, state.targetLanguage);
        skipCheck = apiLangSame ? { skip: true, reason: `Lyrics already in ${apiLanguage.toUpperCase()}`, detectedLanguage: apiLanguage } : { skip: false, detectedLanguage: apiLanguage };
      } else if (romanizationOn) {
        skipCheck = { skip: false, detectedLanguage: "unknown" };
      } else {
        skipCheck = await shouldSkipTranslation(nonEmptyTexts, state.targetLanguage, currentTrackUri2 || void 0);
      }
      if (skipCheck.detectedLanguage)
        state.detectedLanguage = skipCheck.detectedLanguage;
      let translations;
      if (skipCheck.skip) {
        const nonTargetIndexes = getConfidentNonTargetLineIndexes(lineTexts, state.targetLanguage);
        if (nonTargetIndexes.length === 0) {
          removeTranslations();
          state.isTranslating = false;
          state.lastTranslatedSongUri = currentTrackUri2;
          lastTranslatedRomanizationState = romanizationOn;
          restoreButtonState();
          if (state.showNotifications && Spicetify.showNotification) {
            Spicetify.showNotification(skipCheck.reason || "Lyrics already in target language");
          }
          return;
        }
        const partialLines = nonTargetIndexes.map((index) => lineTexts[index]);
        const partialTranslations = await translateLyrics(
          partialLines,
          state.targetLanguage,
          void 0,
          state.detectedLanguage || void 0
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
      } else {
        translations = await translateLyrics(lineTexts, state.targetLanguage, currentTrackUri2 || void 0, state.detectedLanguage || void 0);
      }
      state.translatedLyrics.clear();
      translations.forEach((result, index) => {
        const domText = domLineTexts[index];
        if (domText) {
          state.translatedLyrics.set(domText, result.translatedText);
        }
        if (useApiLines && lineTexts[index] !== domText) {
          state.translatedLyrics.set(lineTexts[index], result.translatedText);
        }
      });
      state._translationsByIndex = /* @__PURE__ */ new Map();
      translations.forEach((result, index) => {
        state._translationsByIndex.set(index, result.translatedText);
      });
      state._qualityByIndex = /* @__PURE__ */ new Map();
      translations.forEach((result, index) => {
        if (result.wasTranslated) {
          const meta = {
            source: result.source || "api",
            api: result.apiProvider || state.preferredApi,
            detectedLanguage: state.detectedLanguage || result.detectedLanguage || void 0
          };
          state._qualityByIndex.set(index, meta);
        }
      });
      state.lastTranslatedSongUri = currentTrackUri2;
      lastTranslatedRomanizationState = romanizationOn;
      if (useApiLines && apiVocalLineData) {
        setLineTimingData(apiVocalLineData);
      } else if (matchedTimingData) {
        setLineTimingData(matchedTimingData);
      } else if (apiLineData) {
        setLineTimingData(apiLineData);
      }
      const freshLines = getLyricsLines();
      if (freshLines.length > 0) {
        applyTranslations(freshLines);
      } else {
        applyTranslations(lines);
      }
      if (state.showNotifications && Spicetify.showNotification) {
        const wasActuallyTranslated = translations.some((t) => t.wasTranslated === true);
        if (wasActuallyTranslated) {
          const translatedFromApi = translations.some((t) => t.wasTranslated === true && t.source === "api");
          Spicetify.showNotification(translatedFromApi ? "Translated from Api" : "Translated from Cache");
        }
      }
    } catch (err) {
      error("Translation failed:", err);
      if (state.showNotifications && Spicetify.showNotification) {
        Spicetify.showNotification("Translation failed. Please try again.", true);
      }
      setButtonErrorState(true);
      setTimeout(() => setButtonErrorState(false), 3e3);
    } finally {
      state.isTranslating = false;
      restoreButtonState();
    }
  }
  function normalizeForComparison(text) {
    return (text || "").toLowerCase().replace(/[\s\p{P}]+/gu, "").trim();
  }
  function applyTranslations(lines) {
    const translationMapByIndex = /* @__PURE__ */ new Map();
    lines.forEach((line, index) => {
      let translatedText = state._translationsByIndex?.get(index);
      if (!translatedText) {
        const originalText2 = extractLineText2(line);
        translatedText = state.translatedLyrics.get(originalText2);
      }
      const originalText = extractLineText2(line);
      if (translatedText && translatedText !== originalText && normalizeForComparison(translatedText) !== normalizeForComparison(originalText)) {
        translationMapByIndex.set(index, translatedText);
      }
    });
    if (!isOverlayActive()) {
      enableOverlay({
        mode: state.overlayMode,
        syncWordHighlight: state.syncWordHighlight
      });
    }
    if (state._qualityByIndex) {
      setQualityMetadata(state._qualityByIndex);
    }
    updateOverlayContent(translationMapByIndex);
  }
  function reapplyTranslations() {
    if (state.translatedLyrics.size === 0)
      return;
    const savedTranslations = new Map(state.translatedLyrics);
    const savedIndexMap = state._translationsByIndex ? new Map(state._translationsByIndex) : void 0;
    const savedQualityMap = state._qualityByIndex ? new Map(state._qualityByIndex) : void 0;
    const savedUri = state.lastTranslatedSongUri;
    removeTranslations();
    state.translatedLyrics = savedTranslations;
    state._translationsByIndex = savedIndexMap;
    state._qualityByIndex = savedQualityMap;
    state.lastTranslatedSongUri = savedUri;
    const lines = getLyricsLines();
    if (lines.length > 0) {
      applyTranslations(lines);
    }
  }
  function removeTranslations() {
    if (isOverlayActive())
      disableOverlay();
    const docs = [document];
    const pip = getPIPWindow2();
    if (pip)
      docs.push(pip.document);
    docs.forEach((doc) => {
      doc.querySelectorAll("[data-slt-original-html]").forEach((el) => {
        const original = el.dataset.sltOriginalHtml;
        if (original !== void 0) {
          el.innerHTML = original;
          delete el.dataset.sltOriginalHtml;
        }
      });
      doc.querySelectorAll("[data-slt-original-text]").forEach((el) => {
        const original = el.dataset.sltOriginalText;
        if (original !== void 0) {
          el.textContent = original;
          delete el.dataset.sltOriginalText;
        }
      });
      doc.querySelectorAll("[data-slt-replaced-with]").forEach((el) => {
        delete el.dataset.sltReplacedWith;
      });
      doc.querySelectorAll(".slt-replace-line").forEach((el) => el.remove());
      doc.querySelectorAll(".slt-replace-hidden").forEach((el) => el.classList.remove("slt-replace-hidden"));
      doc.querySelectorAll(".spicy-translation-container").forEach((el) => el.remove());
      doc.querySelectorAll(".slt-interleaved-translation").forEach((el) => el.remove());
      doc.querySelectorAll(".spicy-hidden-original").forEach((el) => el.classList.remove("spicy-hidden-original"));
      doc.querySelectorAll(".spicy-translated").forEach((el) => el.classList.remove("spicy-translated"));
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
      lyricsObserver = new MutationObserver((mutations) => {
        if (!state.isEnabled || state.isTranslating)
          return;
        const hasNewContent = mutations.some(
          (m) => m.type === "childList" && m.addedNodes.length > 0 && Array.from(m.addedNodes).some(
            (n) => n.nodeType === Node.ELEMENT_NODE && n.classList?.contains("line")
          )
        );
        if (hasNewContent && state.autoTranslate && !state.isTranslating) {
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
    setViewingLyrics(true);
    let viewControls = await waitForElement2("#SpicyLyricsPage .ViewControls", 3e3);
    if (!viewControls && document.body.classList.contains("SpicySidebarLyrics__Active")) {
      viewControls = await waitForElement2(".Root__right-sidebar #SpicyLyricsPage .ViewControls", 2e3);
    }
    if (!viewControls)
      viewControls = await waitForElement2(".ViewControls", 2e3);
    if (viewControls)
      insertTranslateButton();
    setupLyricsObserver();
    setupRomanizationWatcher();
    const pipWindow = getPIPWindow2();
    if (pipWindow) {
      setTimeout(() => {
        insertTranslateButtonIntoDocument(pipWindow.document);
      }, 500);
    }
    if (state.isEnabled) {
      updateButtonState();
      state.lastTranslatedSongUri = null;
      waitForLyricsAndTranslate(20, 600);
    } else if (state.autoTranslate) {
      state.isEnabled = true;
      storage.set("translation-enabled", "true");
      updateButtonState();
      waitForLyricsAndTranslate(20, 600);
    }
  }
  function onSpicyLyricsClose() {
    setViewingLyrics(false);
    if (translateDebounceTimer) {
      clearTimeout(translateDebounceTimer);
      translateDebounceTimer = null;
    }
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
          await waitForLyricsAndTranslate(15, 500);
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
  function setupViewModeObserver() {
    if (viewModeIntervalId)
      clearInterval(viewModeIntervalId);
    viewModeIntervalId = setInterval(() => {
      const isOpen = isSpicyLyricsOpen();
      if (isOpen) {
        if (!document.querySelector("#TranslateToggle")) {
          insertTranslateButton();
        }
        if (romanizationToggleButton && !romanizationToggleButton.isConnected) {
          romanizationToggleListener = null;
          romanizationToggleButton = null;
        }
        if (!romanizationToggleListener && document.querySelector("#RomanizationToggle")) {
          setupRomanizationWatcher();
        }
        if (observedLyricsContent && !observedLyricsContent.isConnected) {
          if (lyricsObserver) {
            lyricsObserver.disconnect();
            lyricsObserver = null;
          }
          observedLyricsContent = null;
        }
        if (!lyricsObserver && state.isEnabled) {
          setupLyricsObserver();
        }
        const currentRomanization = isRomanizationActive();
        if (lastKnownRomanizationState !== null && currentRomanization !== lastKnownRomanizationState) {
          if (state.isEnabled) {
            if (!state.isTranslating) {
              removeTranslations();
              setupLyricsObserver();
              state.lastTranslatedSongUri = null;
              waitForLyricsAndTranslate(15, 500);
            }
          }
        }
        lastKnownRomanizationState = currentRomanization;
        const pipWindow = getPIPWindow2();
        if (pipWindow && !pipWindow.document.querySelector("#TranslateToggle")) {
          insertTranslateButtonIntoDocument(pipWindow.document);
        }
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

  // src/utils/settings.ts
  var SETTINGS_ID = "spicy-lyric-translator-settings";
  function areDevToolsEnabled() {
    const hasDeveloperSettingsSection = !!document.getElementById("spicy-lyrics-dev-settings");
    try {
      const isTruthy = (value) => {
        if (typeof value === "boolean")
          return value;
        if (typeof value === "number")
          return value === 1;
        if (typeof value === "string") {
          const normalized = value.trim().toLowerCase();
          return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on" || normalized === "enabled";
        }
        return false;
      };
      const platformConfig = Spicetify?.Platform?.Config;
      const globalConfig = Spicetify?.Config;
      const platform = Spicetify?.Platform;
      const runtimeFlag = [
        platform?.DeveloperMode,
        platform?.developerMode,
        platform?.DevTools,
        platform?.devTools,
        platform?.isDeveloper,
        platform?.isDeveloperMode,
        platform?.isDev,
        window?.Spicetify?.DeveloperMode,
        window?.Spicetify?.isDeveloper,
        window?.Spicetify?.isDev
      ].some(isTruthy);
      const configFlag = [
        platformConfig?.enableDeveloperMode ?? platformConfig?.developerMode ?? platformConfig?.devTools ?? platformConfig?.isDeveloper ?? platformConfig?.isDev ?? platformConfig?.["app.enable-developer-mode"] ?? globalConfig?.enableDeveloperMode ?? globalConfig?.developerMode ?? globalConfig?.devTools ?? globalConfig?.isDeveloper ?? globalConfig?.isDev
      ].some(isTruthy);
      const localStorageKeys = [
        "spicetify-enable-devtools",
        "spicetify_developer_mode",
        "spicetify:enable-devtools",
        "spicetify:developer-mode",
        "developer-mode",
        "devtools",
        "app.enable-developer-mode",
        "app.developer-mode"
      ];
      const webStorageFlag = localStorageKeys.some((key) => {
        const value = window.localStorage?.getItem(key);
        return isTruthy(value);
      });
      const spicetifyStorageFlag = localStorageKeys.some((key) => {
        const value = Spicetify?.LocalStorage?.get?.(key);
        return isTruthy(value);
      });
      return hasDeveloperSettingsSection || runtimeFlag || configFlag || webStorageFlag || spicetifyStorageFlag;
    } catch (e) {
      return hasDeveloperSettingsSection;
    }
  }
  function createNativeToggle(id, label, checked, onChange) {
    const row = document.createElement("div");
    row.className = "x-settings-row qV_CxbowaNkMarye";
    row.innerHTML = `
        <div class="x-settings-firstColumn FLjFgCRmVaE0WSqc">
            <label class="e-91000-text encore-text-body-small encore-internal-color-text-subdued" for="${id}">${label}</label>
        </div>
        <div class="x-settings-secondColumn hgljrmQksnQei4xj">
            <label class="x-toggle-wrapper _nD_jYvjV80Rf8sX">
                <input id="${id}" class="x-toggle-input vTxmx3oTF8tWUPD7" type="checkbox" ${checked ? "checked" : ""}>
                <span class="x-toggle-indicator t3q6uAPe7y0rAqRKWrapper hzLQN8eYDPYyn1km">
                    <span class="x-toggle-indicator t3q6uAPe7y0rAqRK"></span>
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
    row.className = "x-settings-row qV_CxbowaNkMarye";
    row.innerHTML = `
        <div class="x-settings-firstColumn FLjFgCRmVaE0WSqc">
            <label class="e-91000-text encore-text-body-small encore-internal-color-text-subdued" for="${id}">${label}</label>
        </div>
        <div class="x-settings-secondColumn hgljrmQksnQei4xj">
            <span>
                <select class="main-dropDown-dropDown lu9EejNhmuMFF3oS" id="${id}">
                    ${options.map((opt) => `<option value="${opt.value}" ${opt.value === currentValue ? "selected" : ""}>${opt.text}</option>`).join("")}
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
    row.className = "x-settings-row qV_CxbowaNkMarye";
    row.innerHTML = `
        <div class="x-settings-firstColumn FLjFgCRmVaE0WSqc">
            <label class="e-91000-text encore-text-body-small encore-internal-color-text-subdued" for="${id}">${label}</label>
        </div>
        <div class="x-settings-secondColumn hgljrmQksnQei4xj">
            <button id="${id}" class="encore-text-body-small-bold e-10180-legacy-button--small e-10180-legacy-button-secondary--text-base encore-internal-color-text-base e-10180-legacy-button e-10180-legacy-button-secondary e-10180-overflow-wrap-anywhere x-settings-button" data-encore-id="buttonSecondary" type="button">${buttonText}</button>
        </div>
    `;
    const button = row.querySelector("button");
    button?.addEventListener("click", onClick);
    return row;
  }
  function createNativeSettingsSection() {
    const section = document.createElement("div");
    section.id = SETTINGS_ID;
    section.innerHTML = `
        <div class="x-settings-section fNaaQ0Cp8Yzy19j8">
            <h2 class="e-91000-text encore-text-body-medium-bold encore-internal-color-text-base">Spicy Lyric Translator</h2>
        </div>
    `;
    const sectionContent = section.querySelector(".x-settings-section fNaaQ0Cp8Yzy19j8");
    const languageOptions = SUPPORTED_LANGUAGES.map((l) => ({ value: l.code, text: l.name }));
    sectionContent.appendChild(createNativeDropdown(
      "slt-settings.target-language",
      "Target Language",
      languageOptions,
      storage.get("target-language") || "en",
      (value) => {
        storage.set("target-language", value);
        state.targetLanguage = value;
      }
    ));
    sectionContent.appendChild(createNativeDropdown(
      "slt-settings.overlay-mode",
      "Translation Display",
      [
        { value: "replace", text: "Replace (default)" },
        { value: "interleaved", text: "Below each line" }
      ],
      storage.get("overlay-mode") || "replace",
      (value) => {
        const mode = value;
        storage.set("overlay-mode", mode);
        state.overlayMode = mode;
        reapplyTranslations();
      }
    ));
    sectionContent.appendChild(createNativeDropdown(
      "slt-settings.preferred-api",
      "Translation API",
      [
        { value: "google", text: "Google Translate" },
        { value: "libretranslate", text: "LibreTranslate" },
        { value: "deepl", text: "DeepL" },
        { value: "openai", text: "OpenAI" },
        { value: "gemini", text: "Gemini" },
        { value: "custom", text: "Custom API" }
      ],
      storage.get("preferred-api") || "google",
      (value) => {
        const api = value;
        storage.set("preferred-api", api);
        state.preferredApi = api;
        setPreferredApi(api, storage.get("custom-api-url") || "", {
          customApiKey: state.customApiKey,
          deeplApiKey: state.deeplApiKey,
          openaiApiKey: state.openaiApiKey,
          openaiModel: state.openaiModel,
          geminiApiKey: state.geminiApiKey
        });
        const customRow = document.getElementById("slt-settings-custom-api-row");
        const customKeyRow = document.getElementById("slt-settings-custom-api-key-row");
        const deeplRow = document.getElementById("slt-settings-deepl-key-row");
        const openaiRow = document.getElementById("slt-settings-openai-key-row");
        const openaiModelRow2 = document.getElementById("slt-settings-openai-model-row");
        const geminiRow = document.getElementById("slt-settings-gemini-key-row");
        if (customRow)
          customRow.style.display = api === "custom" ? "" : "none";
        if (customKeyRow)
          customKeyRow.style.display = api === "custom" ? "" : "none";
        if (deeplRow)
          deeplRow.style.display = api === "deepl" ? "" : "none";
        if (openaiRow)
          openaiRow.style.display = api === "openai" ? "" : "none";
        if (openaiModelRow2)
          openaiModelRow2.style.display = api === "openai" ? "" : "none";
        if (geminiRow)
          geminiRow.style.display = api === "gemini" ? "" : "none";
      }
    ));
    const customApiRow = document.createElement("div");
    customApiRow.id = "slt-settings-custom-api-row";
    customApiRow.className = "x-settings-row qV_CxbowaNkMarye";
    customApiRow.style.display = storage.get("preferred-api") === "custom" ? "" : "none";
    customApiRow.innerHTML = `
        <div class="x-settings-firstColumn FLjFgCRmVaE0WSqc">
            <label class="e-91000-text encore-text-body-small encore-internal-color-text-subdued" for="slt-settings.custom-api-url">Custom API URL</label>
        </div>
        <div class="x-settings-secondColumn hgljrmQksnQei4xj">
            <input type="text" id="slt-settings.custom-api-url" class="main-dropDown-dropDown lu9EejNhmuMFF3oS" style="width: 200px;" value="${storage.get("custom-api-url") || ""}" placeholder="https://your-api.com/translate">
        </div>
    `;
    const customApiInput = customApiRow.querySelector("input");
    customApiInput?.addEventListener("change", () => {
      storage.set("custom-api-url", customApiInput.value);
      state.customApiUrl = customApiInput.value;
      setPreferredApi(state.preferredApi, customApiInput.value, {
        customApiKey: state.customApiKey,
        deeplApiKey: state.deeplApiKey,
        openaiApiKey: state.openaiApiKey,
        openaiModel: state.openaiModel,
        geminiApiKey: state.geminiApiKey
      });
    });
    sectionContent.appendChild(customApiRow);
    const customApiKeyRow = document.createElement("div");
    customApiKeyRow.id = "slt-settings-custom-api-key-row";
    customApiKeyRow.className = "x-settings-row qV_CxbowaNkMarye";
    customApiKeyRow.style.display = storage.get("preferred-api") === "custom" ? "" : "none";
    customApiKeyRow.innerHTML = `
        <div class="x-settings-firstColumn FLjFgCRmVaE0WSqc">
            <label class="e-91000-text encore-text-body-small encore-internal-color-text-subdued" for="slt-settings.custom-api-key">Custom API Key (optional)</label>
        </div>
        <div class="x-settings-secondColumn hgljrmQksnQei4xj">
            <input type="password" id="slt-settings.custom-api-key" class="main-dropDown-dropDown lu9EejNhmuMFF3oS" style="width: 200px;" value="${storage.get("custom-api-key") || ""}" placeholder="API key">
        </div>
    `;
    const customApiKeyInput = customApiKeyRow.querySelector("input");
    customApiKeyInput?.addEventListener("change", () => {
      storage.set("custom-api-key", customApiKeyInput.value);
      state.customApiKey = customApiKeyInput.value;
      setPreferredApi(state.preferredApi, state.customApiUrl, { customApiKey: customApiKeyInput.value });
    });
    sectionContent.appendChild(customApiKeyRow);
    const deeplKeyRow = document.createElement("div");
    deeplKeyRow.id = "slt-settings-deepl-key-row";
    deeplKeyRow.className = "x-settings-row qV_CxbowaNkMarye";
    deeplKeyRow.style.display = storage.get("preferred-api") === "deepl" ? "" : "none";
    deeplKeyRow.innerHTML = `
        <div class="x-settings-firstColumn FLjFgCRmVaE0WSqc">
            <label class="e-91000-text encore-text-body-small encore-internal-color-text-subdued" for="slt-settings.deepl-api-key">DeepL API Key</label>
        </div>
        <div class="x-settings-secondColumn hgljrmQksnQei4xj">
            <input type="password" id="slt-settings.deepl-api-key" class="main-dropDown-dropDown lu9EejNhmuMFF3oS" style="width: 200px;" value="${storage.get("deepl-api-key") || ""}" placeholder="xxxxxxxx-xxxx-xxxx-xxxx:fx">
        </div>
    `;
    const deeplKeyInput = deeplKeyRow.querySelector("input");
    deeplKeyInput?.addEventListener("change", () => {
      storage.set("deepl-api-key", deeplKeyInput.value);
      state.deeplApiKey = deeplKeyInput.value;
      setPreferredApi(state.preferredApi, state.customApiUrl, { deeplApiKey: deeplKeyInput.value });
    });
    sectionContent.appendChild(deeplKeyRow);
    const openaiKeyRow = document.createElement("div");
    openaiKeyRow.id = "slt-settings-openai-key-row";
    openaiKeyRow.className = "x-settings-row qV_CxbowaNkMarye";
    openaiKeyRow.style.display = storage.get("preferred-api") === "openai" ? "" : "none";
    openaiKeyRow.innerHTML = `
        <div class="x-settings-firstColumn FLjFgCRmVaE0WSqc">
            <label class="e-91000-text encore-text-body-small encore-internal-color-text-subdued" for="slt-settings.openai-api-key">OpenAI API Key</label>
        </div>
        <div class="x-settings-secondColumn hgljrmQksnQei4xj">
            <input type="password" id="slt-settings.openai-api-key" class="main-dropDown-dropDown lu9EejNhmuMFF3oS" style="width: 200px;" value="${storage.get("openai-api-key") || ""}" placeholder="sk-...">
        </div>
    `;
    const openaiKeyInput = openaiKeyRow.querySelector("input");
    openaiKeyInput?.addEventListener("change", () => {
      storage.set("openai-api-key", openaiKeyInput.value);
      state.openaiApiKey = openaiKeyInput.value;
      setPreferredApi(state.preferredApi, state.customApiUrl, { openaiApiKey: openaiKeyInput.value });
    });
    sectionContent.appendChild(openaiKeyRow);
    const openaiModelRow = document.createElement("div");
    openaiModelRow.id = "slt-settings-openai-model-row";
    openaiModelRow.className = "x-settings-row qV_CxbowaNkMarye";
    openaiModelRow.style.display = storage.get("preferred-api") === "openai" ? "" : "none";
    openaiModelRow.innerHTML = `
        <div class="x-settings-firstColumn FLjFgCRmVaE0WSqc">
            <label class="e-91000-text encore-text-body-small encore-internal-color-text-subdued" for="slt-settings.openai-model">OpenAI Model</label>
        </div>
        <div class="x-settings-secondColumn hgljrmQksnQei4xj">
            <input type="text" id="slt-settings.openai-model" class="main-dropDown-dropDown lu9EejNhmuMFF3oS" style="width: 200px;" value="${storage.get("openai-model") || "gpt-4o-mini"}" placeholder="gpt-4o-mini">
        </div>
    `;
    const openaiModelInput = openaiModelRow.querySelector("input");
    openaiModelInput?.addEventListener("change", () => {
      storage.set("openai-model", openaiModelInput.value);
      state.openaiModel = openaiModelInput.value;
      setPreferredApi(state.preferredApi, state.customApiUrl, { openaiModel: openaiModelInput.value });
    });
    sectionContent.appendChild(openaiModelRow);
    const geminiKeyRow = document.createElement("div");
    geminiKeyRow.id = "slt-settings-gemini-key-row";
    geminiKeyRow.className = "x-settings-row qV_CxbowaNkMarye";
    geminiKeyRow.style.display = storage.get("preferred-api") === "gemini" ? "" : "none";
    geminiKeyRow.innerHTML = `
        <div class="x-settings-firstColumn FLjFgCRmVaE0WSqc">
            <label class="e-91000-text encore-text-body-small encore-internal-color-text-subdued" for="slt-settings.gemini-api-key">Gemini API Key</label>
        </div>
        <div class="x-settings-secondColumn hgljrmQksnQei4xj">
            <input type="password" id="slt-settings.gemini-api-key" class="main-dropDown-dropDown lu9EejNhmuMFF3oS" style="width: 200px;" value="${storage.get("gemini-api-key") || ""}" placeholder="AIza...">
        </div>
    `;
    const geminiKeyInput = geminiKeyRow.querySelector("input");
    geminiKeyInput?.addEventListener("change", () => {
      storage.set("gemini-api-key", geminiKeyInput.value);
      state.geminiApiKey = geminiKeyInput.value;
      setPreferredApi(state.preferredApi, state.customApiUrl, { geminiApiKey: geminiKeyInput.value });
    });
    sectionContent.appendChild(geminiKeyRow);
    sectionContent.appendChild(createNativeToggle(
      "slt-settings.auto-translate",
      "Auto-Translate on Song Change",
      storage.get("auto-translate") === "true",
      (checked) => {
        storage.set("auto-translate", String(checked));
        state.autoTranslate = checked;
      }
    ));
    sectionContent.appendChild(createNativeToggle(
      "slt-settings.show-notifications",
      "Show Notifications",
      storage.get("show-notifications") !== "false",
      (checked) => {
        storage.set("show-notifications", String(checked));
        state.showNotifications = checked;
      }
    ));
    sectionContent.appendChild(createNativeToggle(
      "slt-settings.show-quality-indicator",
      "Show Translation Quality Indicator",
      storage.get("show-quality-indicator") !== "false",
      (checked) => {
        storage.set("show-quality-indicator", String(checked));
        state.showQualityIndicator = checked;
        document.body.classList.toggle("slt-hide-quality-indicator", !checked);
      }
    ));
    sectionContent.appendChild(createNativeToggle(
      "slt-settings.vocabulary-mode",
      "Vocabulary / Learning Mode",
      storage.get("vocabulary-mode") === "true",
      (checked) => {
        storage.set("vocabulary-mode", String(checked));
        state.vocabularyMode = checked;
        document.body.classList.toggle("slt-vocabulary-mode", checked);
        reapplyTranslations();
      }
    ));
    sectionContent.appendChild(createNativeToggle(
      "slt-settings.share-usage-data",
      "Share Active Viewing Status",
      storage.get("share-usage-data") !== "false",
      (checked) => {
        storage.set("share-usage-data", String(checked));
        notifyShareDataChanged();
      }
    ));
    sectionContent.appendChild(createNativeToggle(
      "slt-settings.hide-connection-indicator",
      "Hide Connection Status",
      storage.get("hide-connection-indicator") === "true",
      (checked) => {
        storage.set("hide-connection-indicator", String(checked));
        state.hideConnectionIndicator = checked;
        document.body.classList.toggle("slt-hide-connection-indicator", checked);
      }
    ));
    if (areDevToolsEnabled()) {
      sectionContent.appendChild(createNativeToggle(
        "slt-settings.debug-mode",
        "Debug Mode (Console Logging)",
        storage.get("debug-mode") === "true",
        (checked) => {
          setDebugMode(checked);
        }
      ));
    }
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
      () => {
        clearAllTrackCache();
        clearTranslationCache();
        if (state.showNotifications && Spicetify.showNotification) {
          Spicetify.showNotification("All cached translations deleted!");
        }
      }
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
          if (Spicetify.showNotification) {
            Spicetify.showNotification("Failed to load changelog", true);
          }
        } finally {
          if (btn) {
            btn.textContent = "View Changelog";
            btn.disabled = false;
          }
        }
      }
    ));
    sectionContent.appendChild(createNativeButton(
      "slt-settings.check-updates",
      `Version ${VERSION}`,
      "Check for Updates",
      async () => {
        const btn = document.getElementById("slt-settings.check-updates");
        if (btn) {
          btn.textContent = "Checking...";
          btn.disabled = true;
        }
        try {
          const updateInfo = await getUpdateInfo();
          if (updateInfo?.hasUpdate) {
            checkForUpdates(true);
          } else {
            if (btn)
              btn.textContent = "Up to date!";
            setTimeout(() => {
              if (btn) {
                btn.textContent = "Check for Updates";
                btn.disabled = false;
              }
            }, 2e3);
            if (Spicetify.showNotification) {
              Spicetify.showNotification("You are running the latest version!");
            }
          }
        } catch (e) {
          if (btn) {
            btn.textContent = "Check for Updates";
            btn.disabled = false;
          }
          if (Spicetify.showNotification) {
            Spicetify.showNotification("Failed to check for updates", true);
          }
        }
      }
    ));
    const githubRow = document.createElement("div");
    githubRow.className = "x-settings-row qV_CxbowaNkMarye";
    githubRow.innerHTML = `
        <div class="x-settings-firstColumn FLjFgCRmVaE0WSqc">
            <label class="e-91000-text encore-text-body-small encore-internal-color-text-subdued">GitHub Repository</label>
        </div>
        <div class="x-settings-secondColumn hgljrmQksnQei4xj">
            <a href="${REPO_URL}" target="_blank" class="encore-text-body-small-bold e-10180-legacy-button--small e-10180-legacy-button-secondary--text-base encore-internal-color-text-base e-10180-legacy-button e-10180-legacy-button-secondary e-10180-overflow-wrap-anywhere x-settings-button e-10180-legacy-button--trailing" data-encore-id="buttonSecondary">View<span aria-hidden="true" class="e-91000-button__icon-wrapper"><svg data-encore-id="icon" role="img" aria-hidden="true" class="e-91000-icon e-91000-baseline" viewBox="0 0 16 16" style="--encore-icon-height: var(--encore-graphic-size-decorative-smaller); --encore-icon-width: var(--encore-graphic-size-decorative-smaller);"><path d="M1 2.75A.75.75 0 0 1 1.75 2H7v1.5H2.5v11h10.219V9h1.5v6.25a.75.75 0 0 1-.75.75H1.75a.75.75 0 0 1-.75-.75z"></path><path d="M15 1v4.993a.75.75 0 1 1-1.5 0V3.56L8.78 8.28a.75.75 0 0 1-1.06-1.06l4.72-4.72h-2.433a.75.75 0 0 1 0-1.5z"></path></svg></span></a>
        </div>
    `;
    sectionContent.appendChild(githubRow);
    const shortcutRow = document.createElement("div");
    shortcutRow.className = "x-settings-row qV_CxbowaNkMarye";
    shortcutRow.innerHTML = `
        <div class="x-settings-firstColumn FLjFgCRmVaE0WSqc">
            <span class="e-91000-text encore-text-marginal encore-internal-color-text-subdued">Keyboard shortcut: Alt+T to toggle translation</span>
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
    const settingsSection = existingSettingsSection || createNativeSettingsSection();
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
  function createSettingsUI() {
    const showDebugToggle = areDevToolsEnabled();
    const container = document.createElement("div");
    container.className = "slt-settings-container";
    container.innerHTML = `
        <style>
            .slt-settings-container {
                padding: 20px;
                display: flex;
                flex-direction: column;
                gap: 18px;
                width: min(760px, 92vw);
                max-width: 100%;
                max-height: 78vh;
                box-sizing: border-box;
                overflow-x: hidden;
                overflow-y: auto;
            }
            .slt-setting-row {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            .slt-setting-row label {
                font-size: 15px;
                font-weight: 500;
                color: var(--spice-text);
            }
            .slt-setting-row select,
            .slt-setting-row input[type="text"] {
                padding: 10px 14px;
                border-radius: 4px;
                border: 1px solid var(--spice-button-disabled);
                background: var(--spice-card);
                color: var(--spice-text);
                font-size: 15px;
            }
            .slt-setting-row select:focus,
            .slt-setting-row input[type="text"]:focus {
                outline: none;
                border-color: var(--spice-button);
            }
            .slt-toggle-row {
                flex-direction: row;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
            }
            .slt-toggle-row > label:first-child {
                margin: 0;
                line-height: 1.35;
                flex: 1;
            }
            .slt-toggle-row .slt-toggle {
                margin-left: auto;
                flex-shrink: 0;
            }
            .slt-toggle {
                position: relative;
                width: 40px;
                height: 20px;
            }
            .slt-toggle input {
                opacity: 0;
                width: 0;
                height: 0;
            }
            .slt-toggle-slider {
                position: absolute;
                cursor: pointer;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: var(--spice-button-disabled);
                transition: .3s;
                border-radius: 20px;
            }
            .slt-toggle-slider:before {
                position: absolute;
                content: "";
                height: 16px;
                width: 16px;
                left: 2px;
                bottom: 2px;
                background-color: white;
                transition: .3s;
                border-radius: 50%;
            }
            .slt-toggle input:checked + .slt-toggle-slider {
                background-color: var(--spice-button);
            }
            .slt-toggle input:checked + .slt-toggle-slider:before {
                transform: translateX(20px);
            }
            .slt-button {
                padding: 11px 22px;
                border-radius: 500px;
                border: none;
                background: var(--spice-button);
                color: var(--spice-text);
                font-size: 15px;
                font-weight: 700;
                cursor: pointer;
                transition: transform 0.1s, background 0.2s;
            }
            .slt-button:hover {
                transform: scale(1.02);
                background: var(--spice-button-active);
            }
            .slt-button:active {
                transform: scale(0.98);
            }
            .slt-description {
                font-size: 13px;
                color: var(--spice-subtext);
                margin-top: 0;
                line-height: 1.35;
            }
        </style>
        
        <div class="slt-setting-row">
            <label for="slt-target-language">Target Language</label>
            <select id="slt-target-language">
                ${SUPPORTED_LANGUAGES.map(
      (l) => `<option value="${l.code}" ${l.code === (storage.get("target-language") || "en") ? "selected" : ""}>${l.name}</option>`
    ).join("")}
            </select>
        </div>
        
        <div class="slt-setting-row">
            <label for="slt-overlay-mode">Translation Display</label>
            <select id="slt-overlay-mode">
                <option value="replace" ${(storage.get("overlay-mode") || "replace") === "replace" ? "selected" : ""}>Replace (default)</option>
                <option value="interleaved" ${storage.get("overlay-mode") === "interleaved" ? "selected" : ""}>Below each line</option>
            </select>
            <span class="slt-description">How translated lyrics are displayed</span>
        </div>
        
        <div class="slt-setting-row">
            <label for="slt-preferred-api">Translation API</label>
            <select id="slt-preferred-api">
                <option value="google" ${(storage.get("preferred-api") || "google") === "google" ? "selected" : ""}>Google Translate</option>
                <option value="libretranslate" ${storage.get("preferred-api") === "libretranslate" ? "selected" : ""}>LibreTranslate</option>
                <option value="deepl" ${storage.get("preferred-api") === "deepl" ? "selected" : ""}>DeepL</option>
                <option value="openai" ${storage.get("preferred-api") === "openai" ? "selected" : ""}>OpenAI</option>
                <option value="gemini" ${storage.get("preferred-api") === "gemini" ? "selected" : ""}>Gemini</option>
                <option value="custom" ${storage.get("preferred-api") === "custom" ? "selected" : ""}>Custom API</option>
            </select>
        </div>
        
        <div class="slt-setting-row" id="slt-custom-api-row" style="display: ${storage.get("preferred-api") === "custom" ? "flex" : "none"}">
            <label for="slt-custom-api-url">Custom API URL</label>
            <input type="text" id="slt-custom-api-url" value="${storage.get("custom-api-url") || ""}" placeholder="https://your-api.com/translate">
            <span class="slt-description">LibreTranslate-compatible API endpoint</span>
        </div>

        <div class="slt-setting-row" id="slt-custom-api-key-row" style="display: ${storage.get("preferred-api") === "custom" ? "flex" : "none"}">
            <label for="slt-custom-api-key">Custom API Key (optional)</label>
            <input type="password" id="slt-custom-api-key" value="${storage.get("custom-api-key") || ""}" placeholder="API key">
        </div>

        <div class="slt-setting-row" id="slt-deepl-key-row" style="display: ${storage.get("preferred-api") === "deepl" ? "flex" : "none"}">
            <label for="slt-deepl-api-key">DeepL API Key</label>
            <input type="password" id="slt-deepl-api-key" value="${storage.get("deepl-api-key") || ""}" placeholder="xxxxxxxx-xxxx-xxxx-xxxx:fx">
            <span class="slt-description">Get a free key at deepl.com/pro-api</span>
        </div>

        <div class="slt-setting-row" id="slt-openai-key-row" style="display: ${storage.get("preferred-api") === "openai" ? "flex" : "none"}">
            <label for="slt-openai-api-key">OpenAI API Key</label>
            <input type="password" id="slt-openai-api-key" value="${storage.get("openai-api-key") || ""}" placeholder="sk-...">
        </div>

        <div class="slt-setting-row" id="slt-openai-model-row" style="display: ${storage.get("preferred-api") === "openai" ? "flex" : "none"}">
            <label for="slt-openai-model">OpenAI Model</label>
            <input type="text" id="slt-openai-model" value="${storage.get("openai-model") || "gpt-4o-mini"}" placeholder="gpt-4o-mini">
            <span class="slt-description">e.g. gpt-4o-mini, gpt-4o, gpt-4-turbo</span>
        </div>

        <div class="slt-setting-row" id="slt-gemini-key-row" style="display: ${storage.get("preferred-api") === "gemini" ? "flex" : "none"}">
            <label for="slt-gemini-api-key">Gemini API Key</label>
            <input type="password" id="slt-gemini-api-key" value="${storage.get("gemini-api-key") || ""}" placeholder="AIza...">
            <span class="slt-description">Get a key at aistudio.google.com/apikey</span>
        </div>
        
        <div class="slt-setting-row slt-toggle-row">
            <label for="slt-auto-translate">Auto-Translate on Song Change</label>
            <label class="slt-toggle">
                <input type="checkbox" id="slt-auto-translate" ${storage.get("auto-translate") === "true" ? "checked" : ""}>
                <span class="slt-toggle-slider"></span>
            </label>
        </div>
        
        <div class="slt-setting-row slt-toggle-row">
            <label for="slt-show-notifications">Show Notifications</label>
            <label class="slt-toggle">
                <input type="checkbox" id="slt-show-notifications" ${storage.get("show-notifications") !== "false" ? "checked" : ""}>
                <span class="slt-toggle-slider"></span>
            </label>
        </div>

        <div class="slt-setting-row slt-toggle-row">
            <label for="slt-show-quality-indicator">Show Translation Quality Indicator</label>
            <label class="slt-toggle">
                <input type="checkbox" id="slt-show-quality-indicator" ${storage.get("show-quality-indicator") !== "false" ? "checked" : ""}>
                <span class="slt-toggle-slider"></span>
            </label>
        </div>

        <div class="slt-setting-row slt-toggle-row">
            <label for="slt-vocabulary-mode">Vocabulary / Learning Mode</label>
            <label class="slt-toggle">
                <input type="checkbox" id="slt-vocabulary-mode" ${storage.get("vocabulary-mode") === "true" ? "checked" : ""}>
                <span class="slt-toggle-slider"></span>
            </label>
        </div>

        <div class="slt-setting-row slt-toggle-row">
            <label for="slt-share-usage-data">Share Active Viewing Status</label>
            <label class="slt-toggle">
                <input type="checkbox" id="slt-share-usage-data" ${storage.get("share-usage-data") !== "false" ? "checked" : ""}>
                <span class="slt-toggle-slider"></span>
            </label>
        </div>

        <div class="slt-setting-row slt-toggle-row">
            <label for="slt-hide-connection-indicator">Hide Connection Status</label>
            <label class="slt-toggle">
                <input type="checkbox" id="slt-hide-connection-indicator" ${storage.get("hide-connection-indicator") === "true" ? "checked" : ""}>
                <span class="slt-toggle-slider"></span>
            </label>
        </div>

        ${showDebugToggle ? `
        <div class="slt-setting-row slt-toggle-row">
            <label for="slt-debug-mode">Debug Mode (Console Logging)</label>
            <label class="slt-toggle">
                <input type="checkbox" id="slt-debug-mode" ${storage.get("debug-mode") === "true" ? "checked" : ""}>
                <span class="slt-toggle-slider"></span>
            </label>
        </div>
        ` : ""}
        
        <div class="slt-setting-row">
            <button class="slt-button" id="slt-view-cache">View Translation Cache</button>
        </div>
        
        <div class="slt-setting-row" style="flex-direction: row; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div>
                <span style="font-size: 14px; color: var(--spice-subtext);">Version ${VERSION}</span>
                <span style="margin: 0 8px; color: var(--spice-subtext);">\u2022</span>
                <a href="${REPO_URL}" target="_blank" style="font-size: 14px; color: var(--spice-button);">GitHub</a>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button class="slt-button" id="slt-view-changelog-popup" style="padding: 9px 18px; font-size: 13px; white-space: nowrap;">View Changelog</button>
                <button class="slt-button" id="slt-check-updates" style="padding: 9px 18px; font-size: 13px; white-space: nowrap;">Check for Updates</button>
            </div>
        </div>
        
        <div class="slt-setting-row" style="padding-top: 0; opacity: 0.6;">
            <span class="slt-description">Keyboard shortcut: Alt+T to toggle translation</span>
        </div>
    `;
    setTimeout(() => {
      const targetLangSelect = container.querySelector("#slt-target-language");
      const overlayModeSelect = container.querySelector("#slt-overlay-mode");
      const preferredApiSelect = container.querySelector("#slt-preferred-api");
      const customApiUrlInput = container.querySelector("#slt-custom-api-url");
      const customApiRow = container.querySelector("#slt-custom-api-row");
      const customApiKeyInput = container.querySelector("#slt-custom-api-key");
      const customApiKeyRow = container.querySelector("#slt-custom-api-key-row");
      const deeplApiKeyInput = container.querySelector("#slt-deepl-api-key");
      const deeplKeyRow = container.querySelector("#slt-deepl-key-row");
      const openaiApiKeyInput = container.querySelector("#slt-openai-api-key");
      const openaiKeyRow = container.querySelector("#slt-openai-key-row");
      const openaiModelInput = container.querySelector("#slt-openai-model");
      const openaiModelRow = container.querySelector("#slt-openai-model-row");
      const geminiApiKeyInput = container.querySelector("#slt-gemini-api-key");
      const geminiKeyRow = container.querySelector("#slt-gemini-key-row");
      const autoTranslateCheckbox = container.querySelector("#slt-auto-translate");
      const showNotificationsCheckbox = container.querySelector("#slt-show-notifications");
      const showQualityIndicatorCheckbox = container.querySelector("#slt-show-quality-indicator");
      const vocabularyModeCheckbox = container.querySelector("#slt-vocabulary-mode");
      const shareUsageDataCheckbox = container.querySelector("#slt-share-usage-data");
      const hideConnectionIndicatorCheckbox = container.querySelector("#slt-hide-connection-indicator");
      const debugModeCheckbox = container.querySelector("#slt-debug-mode");
      const viewCacheButton = container.querySelector("#slt-view-cache");
      const viewChangelogPopupButton = container.querySelector("#slt-view-changelog-popup");
      const checkUpdatesButton = container.querySelector("#slt-check-updates");
      targetLangSelect?.addEventListener("change", () => {
        storage.set("target-language", targetLangSelect.value);
        state.targetLanguage = targetLangSelect.value;
      });
      overlayModeSelect?.addEventListener("change", () => {
        const mode = overlayModeSelect.value;
        storage.set("overlay-mode", mode);
        state.overlayMode = mode;
        reapplyTranslations();
      });
      preferredApiSelect?.addEventListener("change", () => {
        const api = preferredApiSelect.value;
        storage.set("preferred-api", api);
        state.preferredApi = api;
        setPreferredApi(api, customApiUrlInput?.value || "", {
          customApiKey: state.customApiKey,
          deeplApiKey: state.deeplApiKey,
          openaiApiKey: state.openaiApiKey,
          openaiModel: state.openaiModel,
          geminiApiKey: state.geminiApiKey
        });
        if (customApiRow)
          customApiRow.style.display = api === "custom" ? "flex" : "none";
        if (customApiKeyRow)
          customApiKeyRow.style.display = api === "custom" ? "flex" : "none";
        if (deeplKeyRow)
          deeplKeyRow.style.display = api === "deepl" ? "flex" : "none";
        if (openaiKeyRow)
          openaiKeyRow.style.display = api === "openai" ? "flex" : "none";
        if (openaiModelRow)
          openaiModelRow.style.display = api === "openai" ? "flex" : "none";
        if (geminiKeyRow)
          geminiKeyRow.style.display = api === "gemini" ? "flex" : "none";
      });
      customApiUrlInput?.addEventListener("change", () => {
        storage.set("custom-api-url", customApiUrlInput.value);
        state.customApiUrl = customApiUrlInput.value;
        setPreferredApi(state.preferredApi, customApiUrlInput.value, {
          customApiKey: state.customApiKey,
          deeplApiKey: state.deeplApiKey,
          openaiApiKey: state.openaiApiKey,
          openaiModel: state.openaiModel,
          geminiApiKey: state.geminiApiKey
        });
      });
      customApiKeyInput?.addEventListener("change", () => {
        storage.set("custom-api-key", customApiKeyInput.value);
        state.customApiKey = customApiKeyInput.value;
        setPreferredApi(state.preferredApi, state.customApiUrl, { customApiKey: customApiKeyInput.value });
      });
      deeplApiKeyInput?.addEventListener("change", () => {
        storage.set("deepl-api-key", deeplApiKeyInput.value);
        state.deeplApiKey = deeplApiKeyInput.value;
        setPreferredApi(state.preferredApi, state.customApiUrl, { deeplApiKey: deeplApiKeyInput.value });
      });
      openaiApiKeyInput?.addEventListener("change", () => {
        storage.set("openai-api-key", openaiApiKeyInput.value);
        state.openaiApiKey = openaiApiKeyInput.value;
        setPreferredApi(state.preferredApi, state.customApiUrl, { openaiApiKey: openaiApiKeyInput.value });
      });
      openaiModelInput?.addEventListener("change", () => {
        storage.set("openai-model", openaiModelInput.value);
        state.openaiModel = openaiModelInput.value;
        setPreferredApi(state.preferredApi, state.customApiUrl, { openaiModel: openaiModelInput.value });
      });
      geminiApiKeyInput?.addEventListener("change", () => {
        storage.set("gemini-api-key", geminiApiKeyInput.value);
        state.geminiApiKey = geminiApiKeyInput.value;
        setPreferredApi(state.preferredApi, state.customApiUrl, { geminiApiKey: geminiApiKeyInput.value });
      });
      autoTranslateCheckbox?.addEventListener("change", () => {
        storage.set("auto-translate", String(autoTranslateCheckbox.checked));
        state.autoTranslate = autoTranslateCheckbox.checked;
      });
      showNotificationsCheckbox?.addEventListener("change", () => {
        storage.set("show-notifications", String(showNotificationsCheckbox.checked));
        state.showNotifications = showNotificationsCheckbox.checked;
      });
      showQualityIndicatorCheckbox?.addEventListener("change", () => {
        storage.set("show-quality-indicator", String(showQualityIndicatorCheckbox.checked));
        state.showQualityIndicator = showQualityIndicatorCheckbox.checked;
        document.body.classList.toggle("slt-hide-quality-indicator", !showQualityIndicatorCheckbox.checked);
      });
      vocabularyModeCheckbox?.addEventListener("change", () => {
        storage.set("vocabulary-mode", String(vocabularyModeCheckbox.checked));
        state.vocabularyMode = vocabularyModeCheckbox.checked;
        document.body.classList.toggle("slt-vocabulary-mode", vocabularyModeCheckbox.checked);
        reapplyTranslations();
      });
      shareUsageDataCheckbox?.addEventListener("change", () => {
        storage.set("share-usage-data", String(shareUsageDataCheckbox.checked));
        notifyShareDataChanged();
      });
      hideConnectionIndicatorCheckbox?.addEventListener("change", () => {
        storage.set("hide-connection-indicator", String(hideConnectionIndicatorCheckbox.checked));
        state.hideConnectionIndicator = hideConnectionIndicatorCheckbox.checked;
        document.body.classList.toggle("slt-hide-connection-indicator", hideConnectionIndicatorCheckbox.checked);
      });
      debugModeCheckbox?.addEventListener("change", () => {
        setDebugMode(debugModeCheckbox.checked);
      });
      viewCacheButton?.addEventListener("click", () => {
        Spicetify.PopupModal?.hide();
        setTimeout(() => openCacheViewer(), 150);
      });
      viewChangelogPopupButton?.addEventListener("click", async () => {
        viewChangelogPopupButton.textContent = "Loading...";
        viewChangelogPopupButton.disabled = true;
        Spicetify.PopupModal?.hide();
        try {
          await showCurrentChangelog();
        } catch (e) {
          if (Spicetify.showNotification) {
            Spicetify.showNotification("Failed to load changelog", true);
          }
        } finally {
          viewChangelogPopupButton.textContent = "View Changelog";
          viewChangelogPopupButton.disabled = false;
        }
      });
      checkUpdatesButton?.addEventListener("click", async () => {
        checkUpdatesButton.textContent = "Checking...";
        checkUpdatesButton.disabled = true;
        try {
          const updateInfo = await getUpdateInfo();
          if (updateInfo?.hasUpdate) {
            Spicetify.PopupModal?.hide();
            setTimeout(() => checkForUpdates(true), 150);
          } else {
            checkUpdatesButton.textContent = "Up to date!";
            setTimeout(() => {
              checkUpdatesButton.textContent = "Check for Updates";
              checkUpdatesButton.disabled = false;
            }, 2e3);
            if (Spicetify.showNotification) {
              Spicetify.showNotification("You are running the latest version!");
            }
          }
        } catch (e) {
          checkUpdatesButton.textContent = "Check for Updates";
          checkUpdatesButton.disabled = false;
          if (Spicetify.showNotification) {
            Spicetify.showNotification("Failed to check for updates", true);
          }
        }
      });
    }, 0);
    return container;
  }
  function formatBytes(bytes) {
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
  function escapeHtml2(value) {
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
      if (Spicetify.showNotification) {
        Spicetify.showNotification("Could not load cached translation for this track", true);
      }
      return;
    }
    const translatedLines = trackCache.lines || [];
    const renderRows = (sourceLines) => {
      const maxLines = Math.max(sourceLines.length, translatedLines.length);
      return Array.from({ length: maxLines }).map((_, idx) => {
        const sourceText = escapeHtml2(sourceLines[idx] ?? "");
        const translatedText = escapeHtml2(translatedLines[idx] ?? "");
        return `
                <div class="slt-lyrics-row">
                    <div class="slt-lyrics-col">${sourceText || "&nbsp;"}</div>
                    <div class="slt-lyrics-col">${translatedText || "&nbsp;"}</div>
                </div>
            `;
      }).join("");
    };
    const content = document.createElement("div");
    content.className = "slt-lyrics-viewer";
    content.innerHTML = `
        <style>
            .slt-lyrics-viewer {
                width: min(2640px, calc(96vw - 28px));
                max-width: calc(96vw - 28px);
                max-height: 76vh;
                display: flex;
                flex-direction: column;
                gap: 12px;
                box-sizing: border-box;
                overflow-x: hidden;
                overflow-y: hidden;
            }
            .slt-lyrics-header {
                font-size: 13px;
                color: var(--spice-subtext);
                overflow-wrap: anywhere;
            }
            .slt-lyrics-toolbar {
                display: flex;
                justify-content: flex-end;
                gap: 8px;
            }
            .slt-lyrics-copy {
                padding: 8px 14px;
                border-radius: 999px;
                border: none;
                background: var(--spice-button);
                color: var(--spice-text);
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                transition: opacity 0.2s, background 0.2s;
            }
            .slt-lyrics-copy:hover {
                opacity: 0.85;
            }
            .slt-lyrics-copy.slt-copied {
                background: #1db954;
            }
            .slt-lyrics-back {
                padding: 8px 14px;
                border-radius: 999px;
                border: none;
                background: var(--spice-main-elevated);
                color: var(--spice-text);
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
            }
            .slt-lyrics-back:hover {
                opacity: 0.85;
            }
            .slt-lyrics-grid {
                display: flex;
                flex-direction: column;
                gap: 1px;
                background: rgba(255, 255, 255, 0.04);
                border-radius: 8px;
                overflow-y: auto;
                overflow-x: hidden;
                max-height: 66vh;
            }
            .slt-lyrics-row {
                display: grid;
                grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
                gap: 1px;
            }
            .slt-lyrics-col {
                padding: 10px 12px;
                background: var(--spice-card);
                color: var(--spice-text);
                font-size: 13px;
                line-height: 1.4;
                white-space: pre-wrap;
                word-break: break-word;
                overflow-wrap: anywhere;
            }
            .slt-lyrics-head {
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 0.04em;
                color: var(--spice-subtext);
                font-weight: 600;
            }
        </style>
        <div class="slt-lyrics-toolbar">
            <button id="slt-lyrics-copy-all" class="slt-lyrics-copy" type="button">\u{1F4CB} Copy Lyrics</button>
            <button id="slt-lyrics-back-to-cache" class="slt-lyrics-back" type="button">\u2190 Back to Cache</button>
        </div>
        <div class="slt-lyrics-header">Track ID: ${escapeHtml2(getTrackIdFromUri2(trackUri))}</div>
        <div class="slt-lyrics-grid">
            <div class="slt-lyrics-row">
                <div class="slt-lyrics-col slt-lyrics-head" id="slt-lyrics-source-heading">${escapeHtml2(sourceLang.toUpperCase())} (Source)</div>
                <div class="slt-lyrics-col slt-lyrics-head">${escapeHtml2(targetLang.toUpperCase())} (Translated)</div>
            </div>
            <div id="slt-lyrics-rows">
                ${renderRows([]) || '<div class="slt-lyrics-row"><div class="slt-lyrics-col">No cached lines</div><div class="slt-lyrics-col">No cached lines</div></div>'}
            </div>
        </div>
    `;
    if (Spicetify.PopupModal) {
      Spicetify.PopupModal.display({
        title: "Cached Lyrics Viewer",
        content,
        isLarge: true
      });
    }
    const backToCacheBtn = content.querySelector("#slt-lyrics-back-to-cache");
    backToCacheBtn?.addEventListener("click", () => {
      Spicetify.PopupModal?.hide();
      setTimeout(() => openCacheViewer(), 120);
    });
    const copyBtn = content.querySelector("#slt-lyrics-copy-all");
    copyBtn?.addEventListener("click", async () => {
      const rows = content.querySelectorAll("#slt-lyrics-rows .slt-lyrics-row");
      const lines = [];
      const trackTitle = trackCache.trackName || getTrackIdFromUri2(trackUri);
      const trackArtist = trackCache.artistName || "";
      lines.push(`${trackTitle}${trackArtist ? " \u2014 " + trackArtist : ""}`);
      lines.push(`${sourceLang.toUpperCase()} \u2192 ${targetLang.toUpperCase()}`);
      lines.push("\u2500".repeat(40));
      rows.forEach((row) => {
        const cols = row.querySelectorAll(".slt-lyrics-col");
        if (cols.length >= 2) {
          const src = (cols[0].textContent || "").trim();
          const tgt = (cols[1].textContent || "").trim();
          if (src || tgt) {
            lines.push(src || "\u266A");
            if (tgt && tgt !== src)
              lines.push(`  \u2192 ${tgt}`);
            lines.push("");
          }
        }
      });
      lines.push("\u2500".repeat(40));
      lines.push("Exported from Spicy Lyric Translator");
      const text = lines.join("\n");
      try {
        await navigator.clipboard.writeText(text);
        copyBtn.textContent = "\u2713 Copied!";
        copyBtn.classList.add("slt-copied");
        setTimeout(() => {
          copyBtn.textContent = "\u{1F4CB} Copy Lyrics";
          copyBtn.classList.remove("slt-copied");
        }, 2e3);
      } catch (e) {
        copyBtn.textContent = "\u2717 Failed";
        setTimeout(() => {
          copyBtn.textContent = "\u{1F4CB} Copy Lyrics";
        }, 2e3);
      }
    });
    try {
      const sourceLyrics = await fetchLyricsForTrackUri(trackUri);
      const sourceLines = sourceLyrics?.lines?.length ? sourceLyrics.lines : [];
      const rowsContainer = content.querySelector("#slt-lyrics-rows");
      if (rowsContainer) {
        rowsContainer.innerHTML = renderRows(sourceLines) || '<div class="slt-lyrics-row"><div class="slt-lyrics-col">No source lyrics found</div><div class="slt-lyrics-col">No cached lines</div></div>';
      }
      if (sourceLyrics?.language) {
        const sourceHeading = content.querySelector("#slt-lyrics-source-heading");
        if (sourceHeading) {
          sourceHeading.textContent = `${sourceLyrics.language.toUpperCase()} (Source)`;
        }
      }
    } catch (e) {
      const rowsContainer = content.querySelector("#slt-lyrics-rows");
      if (rowsContainer) {
        rowsContainer.innerHTML = renderRows([]);
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
                padding: 16px;
                display: flex;
                flex-direction: column;
                gap: 16px;
                max-height: 60vh;
            }
            .slt-cache-stats {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 12px;
                padding: 12px;
                background: var(--spice-card);
                border-radius: 8px;
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
            }
            .slt-stat-value {
                font-size: 18px;
                font-weight: 600;
                color: var(--spice-text);
            }
            .slt-cache-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
                overflow-y: auto;
                max-height: 300px;
                padding-right: 8px;
            }
            .slt-cache-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 10px 12px;
                background: var(--spice-card);
                border-radius: 6px;
                gap: 12px;
            }
            .slt-cache-item-info {
                display: flex;
                flex-direction: column;
                gap: 2px;
                flex: 1;
                min-width: 0;
            }
            .slt-cache-item-title {
                font-size: 13px;
                font-weight: 500;
                color: var(--spice-text);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .slt-cache-item-artist {
                font-size: 12px;
                color: var(--spice-subtext);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .slt-cache-item-meta {
                font-size: 11px;
                color: var(--spice-subtext);
                opacity: 0.7;
            }
            .slt-cache-delete {
                padding: 6px 10px;
                border-radius: 4px;
                border: none;
                background: rgba(255, 80, 80, 0.2);
                color: #ff5050;
                font-size: 12px;
                cursor: pointer;
                transition: background 0.2s;
                flex-shrink: 0;
            }
            .slt-cache-delete:hover {
                background: rgba(255, 80, 80, 0.4);
            }
            .slt-cache-item-actions {
                display: flex;
                align-items: center;
                gap: 6px;
                flex-shrink: 0;
            }
            .slt-cache-action {
                padding: 6px 10px;
                border-radius: 4px;
                border: none;
                font-size: 12px;
                cursor: pointer;
                transition: opacity 0.2s;
                color: var(--spice-text);
                background: var(--spice-main-elevated);
            }
            .slt-cache-action:hover {
                opacity: 0.85;
            }
            .slt-cache-delete-all {
                padding: 10px 20px;
                border-radius: 500px;
                border: none;
                background: rgba(255, 80, 80, 0.2);
                color: #ff5050;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: background 0.2s;
            }
            .slt-cache-delete-all:hover {
                background: rgba(255, 80, 80, 0.4);
            }
            .slt-empty-cache {
                text-align: center;
                padding: 24px;
                color: var(--spice-subtext);
                font-size: 14px;
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
                padding: 8px 14px;
                border-radius: 999px;
                border: none;
                background: var(--spice-main-elevated);
                color: var(--spice-text);
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
            }
            .slt-cache-back:hover {
                opacity: 0.85;
            }
        </style>
        <div class="slt-cache-toolbar">
            <button id="slt-cache-back-to-settings" class="slt-cache-back" type="button">\u2190 Back to Settings</button>
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
                <span class="slt-stat-value" id="slt-stat-size">${formatBytes(stats.sizeBytes)}</span>
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
      return `
                        <div class="slt-cache-item" data-uri="${track.trackUri}" data-lang="${track.targetLang}">
                            <div class="slt-cache-item-info">
                                <span class="slt-cache-item-title">${escapeHtml2(displayTitle)}</span>
                                ${displayArtist ? `<span class="slt-cache-item-artist">${escapeHtml2(displayArtist)}</span>` : ""}
                                <span class="slt-cache-item-meta">${track.sourceLang} \u2192 ${track.targetLang} \xB7 ${track.lineCount} lines \xB7 ${formatDate(track.timestamp)}</span>
                            </div>
                            <div class="slt-cache-item-actions">
                                <button class="slt-cache-action slt-cache-play" data-index="${index}">Play</button>
                                <button class="slt-cache-action slt-cache-view-lyrics" data-index="${index}" data-source-lang="${track.sourceLang}">View Lyrics</button>
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
        Spicetify.PopupModal?.hide();
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
            if (Spicetify.showNotification) {
              Spicetify.showNotification(played ? "Opening cached track" : "Unable to play track directly", !played);
            }
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
            Spicetify.PopupModal?.hide();
            await new Promise((resolve) => setTimeout(resolve, 120));
            await openCachedLyricsViewer(uri, lang, sourceLang);
          } catch (error2) {
            if (Spicetify.showNotification) {
              Spicetify.showNotification("Failed to open cached lyrics viewer", true);
            }
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
                sizeEl.textContent = formatBytes(newStats.sizeBytes);
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
        clearAllTrackCache();
        clearTranslationCache();
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
        if (state.showNotifications && Spicetify.showNotification) {
          Spicetify.showNotification("All cached translations deleted!");
        }
      });
    }, 0);
    return container;
  }
  function openCacheViewer() {
    if (Spicetify.PopupModal) {
      Spicetify.PopupModal.display({
        title: "Translation Cache",
        content: createCacheViewerUI(),
        isLarge: true
      });
    }
  }
  function openSettingsModal() {
    if (Spicetify.PopupModal) {
      Spicetify.PopupModal.display({
        title: "Spicy Lyric Translator Settings",
        content: createSettingsUI(),
        isLarge: true
      });
    }
  }
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
              "Spicy Lyric Translator",
              false,
              openSettingsModal
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
  async function initialize() {
    while (typeof Spicetify === "undefined" || !Spicetify.Platform) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    setPreferredApi(state.preferredApi, state.customApiUrl, {
      customApiKey: state.customApiKey,
      deeplApiKey: state.deeplApiKey,
      openaiApiKey: state.openaiApiKey,
      openaiModel: state.openaiModel,
      geminiApiKey: state.geminiApiKey
    });
    injectStyles();
    initConnectionIndicator();
    if (state.hideConnectionIndicator) {
      document.body.classList.add("slt-hide-connection-indicator");
    }
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
    if (Spicetify.Player?.addEventListener) {
      Spicetify.Player.addEventListener("songchange", () => {
        state.isTranslating = false;
        state.translatedLyrics.clear();
        state._translationsByIndex = void 0;
        clearLyricsCache();
        removeTranslations();
        if (state.isEnabled || state.autoTranslate) {
          if (!state.isEnabled) {
            state.isEnabled = true;
            storage.set("translation-enabled", "true");
            updateButtonState();
          }
          waitForLyricsAndTranslate(20, 800);
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
        state.targetLanguage = lang;
        storage.set("target-language", lang);
      },
      translate: translateCurrentLyrics,
      clearCache: clearTranslationCache,
      getCacheStats,
      getCachedTranslations,
      deleteCachedTranslation,
      getState: () => ({ ...state }),
      checkForUpdates: () => checkForUpdates(true),
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
