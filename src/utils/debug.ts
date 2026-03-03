import { storage } from './storage';

let debugMode: boolean = storage.get('debug-mode') === 'true';

const PREFIX = '[SpicyLyricTranslator]';

export function isDebugEnabled(): boolean {
    return debugMode;
}

export function setDebugMode(enabled: boolean): void {
    debugMode = enabled;
    storage.set('debug-mode', enabled.toString());
    if (enabled) {
        console.log(`${PREFIX} Debug mode enabled`);
    }
}

export function debug(...args: unknown[]): void {
    if (debugMode) {
        console.log(PREFIX, ...args);
    }
}

export function info(...args: unknown[]): void {
    console.log(PREFIX, ...args);
}

export function warn(...args: unknown[]): void {
    console.warn(PREFIX, ...args);
}

export function error(...args: unknown[]): void {
    console.error(PREFIX, ...args);
}

export function debugTag(tag: string, ...args: unknown[]): void {
    if (debugMode) {
        console.log(`${PREFIX} [${tag}]`, ...args);
    }
}

export function createLogger(moduleName: string) {
    const modulePrefix = `${PREFIX} [${moduleName}]`;
    
    return {
        debug: (...args: unknown[]) => {
            if (debugMode) {
                console.log(modulePrefix, ...args);
            }
        },
        info: (...args: unknown[]) => {
            console.log(modulePrefix, ...args);
        },
        warn: (...args: unknown[]) => {
            console.warn(modulePrefix, ...args);
        },
        error: (...args: unknown[]) => {
            console.error(modulePrefix, ...args);
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
