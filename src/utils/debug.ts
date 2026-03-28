import { storage } from './storage';

let debugMode: boolean = storage.get('debug-mode') === 'true';

const TAG = '%c[SpicyLyricTranslator]';
const TAG_STYLE = 'color: #FF69B4; font-weight: bold;';

export function isDebugEnabled(): boolean {
    return debugMode;
}

export function setDebugMode(enabled: boolean): void {
    debugMode = enabled;
    storage.set('debug-mode', enabled.toString());
    if (enabled) {
        console.log(TAG, TAG_STYLE, 'Debug mode enabled');
    }
}

export function debug(...args: unknown[]): void {
    if (debugMode) {
        console.log(TAG, TAG_STYLE, ...args);
    }
}

export function info(...args: unknown[]): void {
    console.log(TAG, TAG_STYLE, ...args);
}

export function warn(...args: unknown[]): void {
    console.warn(TAG, TAG_STYLE, ...args);
}

export function error(...args: unknown[]): void {
    console.error(TAG, TAG_STYLE, ...args);
}

export function debugTag(tag: string, ...args: unknown[]): void {
    if (debugMode) {
        console.log(`${TAG} [${tag}]`, TAG_STYLE, ...args);
    }
}

export function createLogger(moduleName: string) {
    const moduleTag = `${TAG} [${moduleName}]`;
    
    return {
        debug: (...args: unknown[]) => {
            if (debugMode) {
                console.log(moduleTag, TAG_STYLE, ...args);
            }
        },
        info: (...args: unknown[]) => {
            console.log(moduleTag, TAG_STYLE, ...args);
        },
        warn: (...args: unknown[]) => {
            console.warn(moduleTag, TAG_STYLE, ...args);
        },
        error: (...args: unknown[]) => {
            console.error(moduleTag, TAG_STYLE, ...args);
        }
    };
}

export default {
    isDebugEnabled,
    setDebugMode,
    debug,
    info,
    warn,
    error,
    debugTag,
    createLogger
};
