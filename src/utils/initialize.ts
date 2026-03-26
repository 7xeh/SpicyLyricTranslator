import { state } from './state';
import { storage } from './storage';
import { setPreferredApi, clearTranslationCache, getCacheStats, getCachedTranslations, deleteCachedTranslation } from './translator';
import { clearLyricsCache } from './lyricsFetcher';
import { injectStyles } from '../styles/main';
import { registerSettings } from './settings';
import { initConnectionIndicator, getConnectionState, refreshConnection } from './connectivity';
import { startUpdateChecker, checkForUpdates, getUpdateInfo, VERSION, showPostUpdateChangelog } from './updater';
import { info, debug } from './debug';

import { 
    translateCurrentLyrics, 
    removeTranslations, 
    handleTranslateToggle, 
    isSpicyLyricsOpen, 
    onSpicyLyricsOpen, 
    onSpicyLyricsClose,
    waitForLyricsAndTranslate,
    updateButtonState,
    setupKeyboardShortcut,
    setupViewModeObserver
} from './core';

export async function initialize(): Promise<void> {
    while (typeof Spicetify === 'undefined' || !Spicetify.Platform) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    info('Initializing...');
    
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
        document.body.classList.add('slt-hide-connection-indicator');
    }
    
    await registerSettings();
    
    startUpdateChecker(30 * 60 * 1000);
    setupKeyboardShortcut();

    showPostUpdateChangelog().catch(e => debug('Changelog display error:', e));
    
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
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    
    setupViewModeObserver();
    
    if (Spicetify.Player?.addEventListener) {
        Spicetify.Player.addEventListener('songchange', () => {
            state.isTranslating = false;
            state.translatedLyrics.clear();
            state._translationsByIndex = undefined;
            clearLyricsCache();
            removeTranslations();
            
            if (state.isEnabled || state.autoTranslate) {
                if (!state.isEnabled) {
                    state.isEnabled = true;
                    storage.set('translation-enabled', 'true');
                    updateButtonState();
                }
                waitForLyricsAndTranslate(20, 800);
            }
        });
    }
    
    (window as any).SpicyLyricTranslator = {
        enable: () => {
            state.isEnabled = true;
            storage.set('translation-enabled', 'true');
            translateCurrentLyrics();
        },
        disable: () => {
            state.isEnabled = false;
            storage.set('translation-enabled', 'false');
            removeTranslations();
        },
        toggle: () => {
            if (isSpicyLyricsOpen()) handleTranslateToggle();
        },
        setLanguage: (lang: string) => {
            state.targetLanguage = lang;
            storage.set('target-language', lang);
        },
        translate: translateCurrentLyrics,
        clearCache: clearTranslationCache,
        getCacheStats: getCacheStats,
        getCachedTranslations: getCachedTranslations,
        deleteCachedTranslation: deleteCachedTranslation,
        getState: () => ({ ...state }),
        checkForUpdates: () => checkForUpdates(true),
        getUpdateInfo: getUpdateInfo,
        version: VERSION,
        connectivity: {
            getState: getConnectionState,
            refresh: refreshConnection
        }
    };
    
    info('Initialized successfully!');
}