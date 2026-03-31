const STORAGE_PREFIX = "spicy-lyric-translator:";

const MAX_STORAGE_SIZE_BYTES = 4 * 1024 * 1024;

function isLocalStorageAvailable(): boolean {
    try {
        const test = '__storage_test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch (e) {
        return false;
    }
}

function getStorageSize(): number {
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

export const storage = {
    get(key: string): string | null {
        try {
            if (!isLocalStorageAvailable()) return null;
            return localStorage.getItem(STORAGE_PREFIX + key);
        } catch (e) {
            console.error("[SpicyLyricTranslator] Storage get error:", e);
            return null;
        }
    },

    set(key: string, value: string): boolean {
        try {
            if (!isLocalStorageAvailable()) return false;
            
            if (value.length > 10000) {
                const currentSize = getStorageSize();
                if (currentSize + value.length * 2 > MAX_STORAGE_SIZE_BYTES) {
                    console.warn("[SpicyLyricTranslator] Storage limit approaching, clearing old cache");
                    this.remove('translation-cache');
                }
            }
            
            localStorage.setItem(STORAGE_PREFIX + key, value);
            return true;
        } catch (e) {
            if (e instanceof DOMException && e.name === 'QuotaExceededError') {
                console.warn("[SpicyLyricTranslator] Storage quota exceeded, clearing cache");
                this.remove('translation-cache');
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

    remove(key: string): void {
        try {
            if (!isLocalStorageAvailable()) return;
            localStorage.removeItem(STORAGE_PREFIX + key);
        } catch (e) {
            console.error("[SpicyLyricTranslator] Storage remove error:", e);
        }
    },

    getJSON<T>(key: string, defaultValue: T): T {
        try {
            const value = this.get(key);
            if (value === null) return defaultValue;
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                delete parsed.__proto__;
                delete parsed.constructor;
                delete parsed.prototype;
            }
            return parsed as T;
        } catch (e) {
            console.error("[SpicyLyricTranslator] Storage getJSON error:", e);
            return defaultValue;
        }
    },

    setJSON<T>(key: string, value: T): boolean {
        try {
            return this.set(key, JSON.stringify(value));
        } catch (e) {
            console.error("[SpicyLyricTranslator] Storage setJSON error:", e);
            return false;
        }
    },
    
    getStats(): { usedBytes: number; maxBytes: number; percentUsed: number } {
        const used = getStorageSize();
        return {
            usedBytes: used,
            maxBytes: MAX_STORAGE_SIZE_BYTES,
            percentUsed: Math.round((used / MAX_STORAGE_SIZE_BYTES) * 100)
        };
    },
    
    clearAll(): void {
        try {
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith(STORAGE_PREFIX)) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
        } catch (e) {
            console.error("[SpicyLyricTranslator] Storage clearAll error:", e);
        }
    },

    setSecret(key: string, value: string): boolean {
        try {
            const encoded = btoa(unescape(encodeURIComponent(value)));
            return this.set(key, encoded);
        } catch (e) {
            return this.set(key, value);
        }
    },

    getSecret(key: string): string | null {
        try {
            const stored = this.get(key);
            if (stored === null) return null;
            try {
                return decodeURIComponent(escape(atob(stored)));
            } catch {
                return stored;
            }
        } catch (e) {
            return null;
        }
    }
};

export default storage;
