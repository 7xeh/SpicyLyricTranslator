import { storage } from './storage';
import { state } from './state';
import { SUPPORTED_LANGUAGES, clearTranslationCache, setPreferredApi } from './translator';
import { getTrackCacheStats, getAllCachedTracks, deleteTrackCache, clearAllTrackCache, getTrackCache } from './trackCache';
import { VERSION, REPO_URL, checkForUpdates, getUpdateInfo, showCurrentChangelog, getContentHashShort } from './updater';
import { OverlayMode } from './translationOverlay';
import { reapplyTranslations } from './core';
import { fetchLyricsForTrackUri } from './lyricsFetcher';

const SETTINGS_ID = 'spicy-lyric-translator-settings';


function createNativeToggle(id: string, label: string, checked: boolean, onChange: (checked: boolean) => void): HTMLElement {
    const row = document.createElement('div');
    row.className = 'x-settings-row';
    row.innerHTML = `
        <div class="x-settings-firstColumn">
            <label class="e-10310-text encore-text-body-small encore-internal-color-text-subdued" for="${id}">${label}</label>
        </div>
        <div class="x-settings-secondColumn">
            <label class="x-toggle-wrapper">
                <input id="${id}" class="x-toggle-input" type="checkbox" ${checked ? 'checked' : ''}>
                <span class="x-toggle-indicatorWrapper">
                    <span class="x-toggle-indicator"></span>
                </span>
            </label>
        </div>
    `;
    
    const input = row.querySelector('input') as HTMLInputElement;
    input?.addEventListener('change', () => onChange(input.checked));
    
    return row;
}

function createNativeDropdown(id: string, label: string, options: { value: string; text: string }[], currentValue: string, onChange: (value: string) => void): HTMLElement {
    const row = document.createElement('div');
    row.className = 'x-settings-row';
    row.innerHTML = `
        <div class="x-settings-firstColumn">
            <label class="e-10310-text encore-text-body-small encore-internal-color-text-subdued" for="${id}">${label}</label>
        </div>
        <div class="x-settings-secondColumn">
            <span>
                <select class="main-dropDown-dropDown" id="${id}">
                    ${options.map(opt => `<option value="${opt.value}" ${opt.value === currentValue ? 'selected' : ''}>${opt.text}</option>`).join('')}
                </select>
            </span>
        </div>
    `;
    
    const select = row.querySelector('select') as HTMLSelectElement;
    select?.addEventListener('change', () => onChange(select.value));
    
    return row;
}

function createNativeButton(id: string, label: string, buttonText: string, onClick: () => void): HTMLElement {
    const row = document.createElement('div');
    row.className = 'x-settings-row';
    row.innerHTML = `
        <div class="x-settings-firstColumn">
            <label class="e-10310-text encore-text-body-small encore-internal-color-text-subdued" for="${id}">${label}</label>
        </div>
        <div class="x-settings-secondColumn">
            <button id="${id}" class="encore-text-body-small-bold e-10310-legacy-button--small e-10310-legacy-button-secondary--text-base encore-internal-color-text-base e-10310-legacy-button e-10310-legacy-button-secondary e-10310-overflow-wrap-anywhere x-settings-button" data-encore-id="buttonSecondary" type="button">${buttonText}</button>
        </div>
    `;
    
    const button = row.querySelector('button') as HTMLButtonElement;
    button?.addEventListener('click', onClick);
    
    return row;
}

function createNativeSettingsSection(): HTMLElement {
    const section = document.createElement('div');
    section.id = SETTINGS_ID;
    section.innerHTML = `
        <div class="x-settings-section fNaaQ0Cp8Yzy19j8">
            <h2 class="e-10310-text encore-text-body-medium-bold encore-internal-color-text-base">Spicy Lyric Translator</h2>
        </div>
    `;
    
    const sectionContent = section.querySelector('.x-settings-section.fNaaQ0Cp8Yzy19j8') as HTMLElement;

    const languageOptions = SUPPORTED_LANGUAGES.map(l => ({ value: l.code, text: l.name }));
    sectionContent.appendChild(createNativeDropdown(
        'slt-settings.target-language',
        'Target Language',
        languageOptions,
        storage.get('target-language') || 'en',
        (value) => {
            storage.set('target-language', value);
            state.targetLanguage = value;
        }
    ));
    
    sectionContent.appendChild(createNativeDropdown(
        'slt-settings.overlay-mode',
        'Translation Display',
        [
            { value: 'replace', text: 'Replace (default)' },
            { value: 'interleaved', text: 'Below each line' }
        ],
        storage.get('overlay-mode') || 'replace',
        (value) => {
            const mode = value as OverlayMode;
            storage.set('overlay-mode', mode);
            state.overlayMode = mode;
            reapplyTranslations();
        }
    ));
    
    sectionContent.appendChild(createNativeDropdown(
        'slt-settings.preferred-api',
        'Translation API',
        [
            { value: 'google', text: 'Google Translate' },
            { value: 'libretranslate', text: 'LibreTranslate' },
            { value: 'deepl', text: 'DeepL' },
            { value: 'openai', text: 'OpenAI' },
            { value: 'gemini', text: 'Gemini' },
            { value: 'custom', text: 'Custom API' }
        ],
        storage.get('preferred-api') || 'google',
        (value) => {
            const api = value as 'google' | 'libretranslate' | 'deepl' | 'openai' | 'gemini' | 'custom';
            storage.set('preferred-api', api);
            state.preferredApi = api;
            setPreferredApi(api, storage.get('custom-api-url') || '', {
                customApiKey: state.customApiKey,
                deeplApiKey: state.deeplApiKey,
                openaiApiKey: state.openaiApiKey,
                openaiModel: state.openaiModel,
                geminiApiKey: state.geminiApiKey
            });
            
            const customRow = document.getElementById('slt-settings-custom-api-row');
            const customKeyRow = document.getElementById('slt-settings-custom-api-key-row');
            const deeplRow = document.getElementById('slt-settings-deepl-key-row');
            const openaiRow = document.getElementById('slt-settings-openai-key-row');
            const openaiModelRow = document.getElementById('slt-settings-openai-model-row');
            const geminiRow = document.getElementById('slt-settings-gemini-key-row');
            if (customRow) customRow.style.display = api === 'custom' ? '' : 'none';
            if (customKeyRow) customKeyRow.style.display = api === 'custom' ? '' : 'none';
            if (deeplRow) deeplRow.style.display = api === 'deepl' ? '' : 'none';
            if (openaiRow) openaiRow.style.display = api === 'openai' ? '' : 'none';
            if (openaiModelRow) openaiModelRow.style.display = api === 'openai' ? '' : 'none';
            if (geminiRow) geminiRow.style.display = api === 'gemini' ? '' : 'none';
        }
    ));
    
    const customApiRow = document.createElement('div');
    customApiRow.id = 'slt-settings-custom-api-row';
    customApiRow.className = 'x-settings-row';
    customApiRow.style.display = storage.get('preferred-api') === 'custom' ? '' : 'none';
    customApiRow.innerHTML = `
        <div class="x-settings-firstColumn">
            <label class="e-10310-text encore-text-body-small encore-internal-color-text-subdued" for="slt-settings.custom-api-url">Custom API URL</label>
        </div>
        <div class="x-settings-secondColumn">
            <input type="text" id="slt-settings.custom-api-url" class="main-dropDown-dropDown" style="width: 200px;" value="" placeholder="https://your-api.com/translate">
        </div>
    `;
    const customApiInput = customApiRow.querySelector('input') as HTMLInputElement;
    if (customApiInput) customApiInput.value = storage.get('custom-api-url') || '';
    customApiInput?.addEventListener('change', () => {
        storage.set('custom-api-url', customApiInput.value);
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

    // Custom API Key row
    const customApiKeyRow = document.createElement('div');
    customApiKeyRow.id = 'slt-settings-custom-api-key-row';
    customApiKeyRow.className = 'x-settings-row';
    customApiKeyRow.style.display = storage.get('preferred-api') === 'custom' ? '' : 'none';
    customApiKeyRow.innerHTML = `
        <div class="x-settings-firstColumn">
            <label class="e-10310-text encore-text-body-small encore-internal-color-text-subdued" for="slt-settings.custom-api-key">Custom API Key (optional)</label>
        </div>
        <div class="x-settings-secondColumn">
            <input type="password" id="slt-settings.custom-api-key" class="main-dropDown-dropDown" style="width: 200px;" value="" placeholder="API key">
        </div>
    `;
    const customApiKeyInput = customApiKeyRow.querySelector('input') as HTMLInputElement;
    if (customApiKeyInput) customApiKeyInput.value = storage.getSecret('custom-api-key') || '';
    customApiKeyInput?.addEventListener('change', () => {
        storage.setSecret('custom-api-key', customApiKeyInput.value);
        state.customApiKey = customApiKeyInput.value;
        setPreferredApi(state.preferredApi, state.customApiUrl, { customApiKey: customApiKeyInput.value });
    });
    sectionContent.appendChild(customApiKeyRow);

    // DeepL API Key row
    const deeplKeyRow = document.createElement('div');
    deeplKeyRow.id = 'slt-settings-deepl-key-row';
    deeplKeyRow.className = 'x-settings-row';
    deeplKeyRow.style.display = storage.get('preferred-api') === 'deepl' ? '' : 'none';
    deeplKeyRow.innerHTML = `
        <div class="x-settings-firstColumn">
            <label class="e-10310-text encore-text-body-small encore-internal-color-text-subdued" for="slt-settings.deepl-api-key">DeepL API Key</label>
        </div>
        <div class="x-settings-secondColumn">
            <input type="password" id="slt-settings.deepl-api-key" class="main-dropDown-dropDown" style="width: 200px;" value="" placeholder="xxxxxxxx-xxxx-xxxx-xxxx:fx">
        </div>
    `;
    const deeplKeyInput = deeplKeyRow.querySelector('input') as HTMLInputElement;
    if (deeplKeyInput) deeplKeyInput.value = storage.getSecret('deepl-api-key') || '';
    deeplKeyInput?.addEventListener('change', () => {
        storage.setSecret('deepl-api-key', deeplKeyInput.value);
        state.deeplApiKey = deeplKeyInput.value;
        setPreferredApi(state.preferredApi, state.customApiUrl, { deeplApiKey: deeplKeyInput.value });
    });
    sectionContent.appendChild(deeplKeyRow);

    // OpenAI API Key row
    const openaiKeyRow = document.createElement('div');
    openaiKeyRow.id = 'slt-settings-openai-key-row';
    openaiKeyRow.className = 'x-settings-row';
    openaiKeyRow.style.display = storage.get('preferred-api') === 'openai' ? '' : 'none';
    openaiKeyRow.innerHTML = `
        <div class="x-settings-firstColumn">
            <label class="e-10310-text encore-text-body-small encore-internal-color-text-subdued" for="slt-settings.openai-api-key">OpenAI API Key</label>
        </div>
        <div class="x-settings-secondColumn">
            <input type="password" id="slt-settings.openai-api-key" class="main-dropDown-dropDown" style="width: 200px;" value="" placeholder="sk-...">
        </div>
    `;
    const openaiKeyInput = openaiKeyRow.querySelector('input') as HTMLInputElement;
    if (openaiKeyInput) openaiKeyInput.value = storage.getSecret('openai-api-key') || '';
    openaiKeyInput?.addEventListener('change', () => {
        storage.setSecret('openai-api-key', openaiKeyInput.value);
        state.openaiApiKey = openaiKeyInput.value;
        setPreferredApi(state.preferredApi, state.customApiUrl, { openaiApiKey: openaiKeyInput.value });
    });
    sectionContent.appendChild(openaiKeyRow);

    // OpenAI Model row
    const openaiModelRow = document.createElement('div');
    openaiModelRow.id = 'slt-settings-openai-model-row';
    openaiModelRow.className = 'x-settings-row';
    openaiModelRow.style.display = storage.get('preferred-api') === 'openai' ? '' : 'none';
    openaiModelRow.innerHTML = `
        <div class="x-settings-firstColumn">
            <label class="e-10310-text encore-text-body-small encore-internal-color-text-subdued" for="slt-settings.openai-model">OpenAI Model</label>
        </div>
        <div class="x-settings-secondColumn">
            <input type="text" id="slt-settings.openai-model" class="main-dropDown-dropDown" style="width: 200px;" value="" placeholder="gpt-4o-mini">
        </div>
    `;
    const openaiModelInput = openaiModelRow.querySelector('input') as HTMLInputElement;
    if (openaiModelInput) openaiModelInput.value = storage.get('openai-model') || 'gpt-4o-mini';
    openaiModelInput?.addEventListener('change', () => {
        storage.set('openai-model', openaiModelInput.value);
        state.openaiModel = openaiModelInput.value;
        setPreferredApi(state.preferredApi, state.customApiUrl, { openaiModel: openaiModelInput.value });
    });
    sectionContent.appendChild(openaiModelRow);

    // Gemini API Key row
    const geminiKeyRow = document.createElement('div');
    geminiKeyRow.id = 'slt-settings-gemini-key-row';
    geminiKeyRow.className = 'x-settings-row';
    geminiKeyRow.style.display = storage.get('preferred-api') === 'gemini' ? '' : 'none';
    geminiKeyRow.innerHTML = `
        <div class="x-settings-firstColumn">
            <label class="e-10310-text encore-text-body-small encore-internal-color-text-subdued" for="slt-settings.gemini-api-key">Gemini API Key</label>
        </div>
        <div class="x-settings-secondColumn">
            <input type="password" id="slt-settings.gemini-api-key" class="main-dropDown-dropDown" style="width: 200px;" value="" placeholder="AIza...">
        </div>
    `;
    const geminiKeyInput = geminiKeyRow.querySelector('input') as HTMLInputElement;
    if (geminiKeyInput) geminiKeyInput.value = storage.getSecret('gemini-api-key') || '';
    geminiKeyInput?.addEventListener('change', () => {
        storage.setSecret('gemini-api-key', geminiKeyInput.value);
        state.geminiApiKey = geminiKeyInput.value;
        setPreferredApi(state.preferredApi, state.customApiUrl, { geminiApiKey: geminiKeyInput.value });
    });
    sectionContent.appendChild(geminiKeyRow);
    
    sectionContent.appendChild(createNativeToggle(
        'slt-settings.auto-translate',
        'Auto-Translate on Song Change',
        storage.get('auto-translate') === 'true',
        (checked) => {
            storage.set('auto-translate', String(checked));
            state.autoTranslate = checked;
        }
    ));
    
    sectionContent.appendChild(createNativeToggle(
        'slt-settings.show-notifications',
        'Show Notifications',
        storage.get('show-notifications') !== 'false',
        (checked) => {
            storage.set('show-notifications', String(checked));
            state.showNotifications = checked;
        }
    ));

    sectionContent.appendChild(createNativeToggle(
        'slt-settings.show-quality-indicator',
        'Show Translation Quality Indicator',
        storage.get('show-quality-indicator') !== 'false',
        (checked) => {
            storage.set('show-quality-indicator', String(checked));
            state.showQualityIndicator = checked;
            document.body.classList.toggle('slt-hide-quality-indicator', !checked);
        }
    ));

    sectionContent.appendChild(createNativeToggle(
        'slt-settings.vocabulary-mode',
        'Vocabulary / Learning Mode',
        storage.get('vocabulary-mode') === 'true',
        (checked) => {
            storage.set('vocabulary-mode', String(checked));
            state.vocabularyMode = checked;
            document.body.classList.toggle('slt-vocabulary-mode', checked);
            reapplyTranslations();
        }
    ));

    sectionContent.appendChild(createNativeToggle(
        'slt-settings.hide-connection-indicator',
        'Hide Connection Status',
        storage.get('hide-connection-indicator') === 'true',
        (checked) => {
            storage.set('hide-connection-indicator', String(checked));
            state.hideConnectionIndicator = checked;
            document.body.classList.toggle('slt-hide-connection-indicator', checked);
        }
    ));

    sectionContent.appendChild(createNativeButton(
        'slt-settings.view-cache',
        'View Translation Cache',
        'View Cache',
        () => openCacheViewer()
    ));

    sectionContent.appendChild(createNativeButton(
        'slt-settings.clear-cache',
        'Clear All Cached Translations',
        'Clear Cache',
        () => {
            clearAllTrackCache();
            clearTranslationCache();
            if (state.showNotifications && Spicetify.showNotification) {
                Spicetify.showNotification('All cached translations deleted!');
            }
        }
    ));
    
    sectionContent.appendChild(createNativeButton(
        'slt-settings.view-changelog',
        `What's New in v${VERSION}`,
        'View Changelog',
        async () => {
            const btn = document.getElementById('slt-settings.view-changelog') as HTMLButtonElement;
            if (btn) {
                btn.textContent = 'Loading...';
                btn.disabled = true;
            }
            try {
                await showCurrentChangelog();
            } catch (e) {
                if (Spicetify.showNotification) {
                    Spicetify.showNotification('Failed to load changelog', true);
                }
            } finally {
                if (btn) {
                    btn.textContent = 'View Changelog';
                    btn.disabled = false;
                }
            }
        }
    ));

    const nativeVersionHash = getContentHashShort();
    const nativeVersionLabel = `Version ${VERSION}${nativeVersionHash ? ` · ${nativeVersionHash}` : ''}`;
    sectionContent.appendChild(createNativeButton(
        'slt-settings.check-updates',
        nativeVersionLabel,
        'Check for Updates',
        async () => {
            const btn = document.getElementById('slt-settings.check-updates') as HTMLButtonElement;
            if (btn) {
                btn.textContent = 'Checking...';
                btn.disabled = true;
            }
            
            try {
                const updateInfo = await getUpdateInfo();
                if (updateInfo?.hasUpdate) {
                    checkForUpdates(true);
                } else {
                    try {
                        const metadata = (window as any)._spicy_lyric_translater_metadata;
                        if (metadata?.utils?.runHotfixCheck) {
                            metadata.utils.runHotfixCheck();
                        }
                    } catch (_) {}
                    if (btn) btn.textContent = 'Up to date!';
                    setTimeout(() => {
                        if (btn) {
                            btn.textContent = 'Check for Updates';
                            btn.disabled = false;
                        }
                    }, 2000);
                    if (Spicetify.showNotification) {
                        Spicetify.showNotification('You are running the latest version!');
                    }
                }
            } catch (e) {
                if (btn) {
                    btn.textContent = 'Check for Updates';
                    btn.disabled = false;
                }
                if (Spicetify.showNotification) {
                    Spicetify.showNotification('Failed to check for updates', true);
                }
            }
        }
    ));
    
    const githubRow = document.createElement('div');
    githubRow.className = 'x-settings-row';
    githubRow.innerHTML = `
        <div class="x-settings-firstColumn">
            <label class="e-10310-text encore-text-body-small encore-internal-color-text-subdued">GitHub Repository</label>
        </div>
        <div class="x-settings-secondColumn">
            <a href="${REPO_URL}" target="_blank" rel="noopener noreferrer" class="encore-text-body-small-bold e-10310-legacy-button--small e-10310-button--trailing e-10310-legacy-button-secondary--text-base encore-internal-color-text-base e-10310-legacy-button e-10310-legacy-button-secondary e-10310-overflow-wrap-anywhere x-settings-button" data-encore-id="buttonSecondary">View<span aria-hidden="true" class="e-10310-button__icon-wrapper"><svg data-encore-id="icon" role="img" aria-hidden="true" class="e-10310-icon" viewBox="0 0 16 16" style="--encore-icon-height: var(--encore-graphic-size-decorative-smaller); --encore-icon-width: var(--encore-graphic-size-decorative-smaller);"><path d="M1 2.75A.75.75 0 0 1 1.75 2H7v1.5H2.5v11h10.219V9h1.5v6.25a.75.75 0 0 1-.75.75H1.75a.75.75 0 0 1-.75-.75z"></path><path d="M15 1v4.993a.75.75 0 1 1-1.5 0V3.56L8.78 8.28a.75.75 0 0 1-1.06-1.06l4.72-4.72h-2.433a.75.75 0 0 1 0-1.5z"></path></svg></span></a>
        </div>
    `;
    sectionContent.appendChild(githubRow);
    
    const shortcutRow = document.createElement('div');
    shortcutRow.className = 'x-settings-row';
    shortcutRow.innerHTML = `
        <div class="x-settings-firstColumn">
            <span class="e-10310-text encore-text-marginal encore-internal-color-text-subdued">Keyboard shortcut: Alt+T to toggle translation</span>
        </div>
    `;
    sectionContent.appendChild(shortcutRow);
    
    return section;
}

function injectSettingsIntoPage(): void {
    const settingsContainer = document.querySelector('.x-settings-container') || 
                              document.querySelector('[data-testid="settings-page"]') ||
                              document.querySelector('main.x-settings-container');
    if (!settingsContainer) {
        return;
    }

    const existingSettingsSection = document.getElementById(SETTINGS_ID);
    const sectionAlreadyInContainer = !!existingSettingsSection && settingsContainer.contains(existingSettingsSection);
    if (sectionAlreadyInContainer) {
        return;
    }
    
    const settingsSection = existingSettingsSection || createNativeSettingsSection();
    
    const spicyLyricsSettings = document.getElementById('spicy-lyrics-settings');
    const spicyLyricsDevSettings = document.getElementById('spicy-lyrics-dev-settings');
    
    if (spicyLyricsDevSettings) {
        spicyLyricsDevSettings.after(settingsSection);
    } else if (spicyLyricsSettings) {
        spicyLyricsSettings.after(settingsSection);
    } else {
        const allSections = settingsContainer.querySelectorAll('.x-settings-section fNaaQ0Cp8Yzy19j8');
        if (allSections.length > 0) {
            const lastSection = allSections[allSections.length - 1];
            const lastSectionParent = lastSection.closest('div:not(.x-settings-section fNaaQ0Cp8Yzy19j8):not(.x-settings-container)') || lastSection;
            lastSectionParent.after(settingsSection);
        } else {
            settingsContainer.appendChild(settingsSection);
        }
    }
    
}

function isOnSettingsPage(): boolean {
    const hasSettingsContainer = !!document.querySelector('.x-settings-container');
    const hasSettingsTestId = !!document.querySelector('[data-testid="settings-page"]');
    const pathCheck = window.location.pathname.includes('preferences') || 
                      window.location.pathname.includes('settings') ||
                      window.location.href.includes('preferences') ||
                      window.location.href.includes('settings');
    
    let historyCheck = false;
    try {
        const location = Spicetify.Platform?.History?.location;
        if (location) {
            historyCheck = location.pathname?.includes('preferences') || 
                          location.pathname?.includes('settings') ||
                          false;
        }
    } catch (e) {

    }
    
    return hasSettingsContainer || hasSettingsTestId || pathCheck || historyCheck;
}

function watchForSettingsPage(): void {
    if (isOnSettingsPage()) {
        setTimeout(injectSettingsIntoPage, 100);
        setTimeout(injectSettingsIntoPage, 500);
    }
    
    if (Spicetify.Platform?.History) {
        Spicetify.Platform.History.listen((location: any) => {
            if (location?.pathname?.includes('preferences') || location?.pathname?.includes('settings')) {
                setTimeout(injectSettingsIntoPage, 100);
                setTimeout(injectSettingsIntoPage, 300);
                setTimeout(injectSettingsIntoPage, 500);
                setTimeout(injectSettingsIntoPage, 1000);
            }
        });
    }
    
    const observer = new MutationObserver((mutations) => {
        const settingsContainer = document.querySelector('.x-settings-container') || 
                                  document.querySelector('[data-testid="settings-page"]');
        if (settingsContainer && !document.getElementById(SETTINGS_ID)) {
            injectSettingsIntoPage();
        }
        
        const ourSettings = document.getElementById(SETTINGS_ID);
        const spicyLyricsDevSettings = document.getElementById('spicy-lyrics-dev-settings');
        if (ourSettings && spicyLyricsDevSettings && ourSettings.previousElementSibling !== spicyLyricsDevSettings) {
            spicyLyricsDevSettings.after(ourSettings);
        }
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

function createSettingsUI(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'slt-settings-container';
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
                ${SUPPORTED_LANGUAGES.map(l => 
                    `<option value="${l.code}" ${l.code === (storage.get('target-language') || 'en') ? 'selected' : ''}>${l.name}</option>`
                ).join('')}
            </select>
        </div>
        
        <div class="slt-setting-row">
            <label for="slt-overlay-mode">Translation Display</label>
            <select id="slt-overlay-mode">
                <option value="replace" ${(storage.get('overlay-mode') || 'replace') === 'replace' ? 'selected' : ''}>Replace (default)</option>
                <option value="interleaved" ${storage.get('overlay-mode') === 'interleaved' ? 'selected' : ''}>Below each line</option>
            </select>
            <span class="slt-description">How translated lyrics are displayed</span>
        </div>
        
        <div class="slt-setting-row">
            <label for="slt-preferred-api">Translation API</label>
            <select id="slt-preferred-api">
                <option value="google" ${(storage.get('preferred-api') || 'google') === 'google' ? 'selected' : ''}>Google Translate</option>
                <option value="libretranslate" ${storage.get('preferred-api') === 'libretranslate' ? 'selected' : ''}>LibreTranslate</option>
                <option value="deepl" ${storage.get('preferred-api') === 'deepl' ? 'selected' : ''}>DeepL</option>
                <option value="openai" ${storage.get('preferred-api') === 'openai' ? 'selected' : ''}>OpenAI</option>
                <option value="gemini" ${storage.get('preferred-api') === 'gemini' ? 'selected' : ''}>Gemini</option>
                <option value="custom" ${storage.get('preferred-api') === 'custom' ? 'selected' : ''}>Custom API</option>
            </select>
        </div>
        
        <div class="slt-setting-row" id="slt-custom-api-row" style="display: ${storage.get('preferred-api') === 'custom' ? 'flex' : 'none'}">
            <label for="slt-custom-api-url">Custom API URL</label>
            <input type="text" id="slt-custom-api-url" value="${storage.get('custom-api-url') || ''}" placeholder="https://your-api.com/translate">
            <span class="slt-description">LibreTranslate-compatible API endpoint</span>
        </div>

        <div class="slt-setting-row" id="slt-custom-api-key-row" style="display: ${storage.get('preferred-api') === 'custom' ? 'flex' : 'none'}">
            <label for="slt-custom-api-key">Custom API Key (optional)</label>
            <input type="password" id="slt-custom-api-key" value="${storage.get('custom-api-key') || ''}" placeholder="API key">
        </div>

        <div class="slt-setting-row" id="slt-deepl-key-row" style="display: ${storage.get('preferred-api') === 'deepl' ? 'flex' : 'none'}">
            <label for="slt-deepl-api-key">DeepL API Key</label>
            <input type="password" id="slt-deepl-api-key" value="${storage.get('deepl-api-key') || ''}" placeholder="xxxxxxxx-xxxx-xxxx-xxxx:fx">
            <span class="slt-description">Get a free key at deepl.com/pro-api</span>
        </div>

        <div class="slt-setting-row" id="slt-openai-key-row" style="display: ${storage.get('preferred-api') === 'openai' ? 'flex' : 'none'}">
            <label for="slt-openai-api-key">OpenAI API Key</label>
            <input type="password" id="slt-openai-api-key" value="${storage.get('openai-api-key') || ''}" placeholder="sk-...">
        </div>

        <div class="slt-setting-row" id="slt-openai-model-row" style="display: ${storage.get('preferred-api') === 'openai' ? 'flex' : 'none'}">
            <label for="slt-openai-model">OpenAI Model</label>
            <input type="text" id="slt-openai-model" value="${storage.get('openai-model') || 'gpt-4o-mini'}" placeholder="gpt-4o-mini">
            <span class="slt-description">e.g. gpt-4o-mini, gpt-4o, gpt-4-turbo</span>
        </div>

        <div class="slt-setting-row" id="slt-gemini-key-row" style="display: ${storage.get('preferred-api') === 'gemini' ? 'flex' : 'none'}">
            <label for="slt-gemini-api-key">Gemini API Key</label>
            <input type="password" id="slt-gemini-api-key" value="${storage.get('gemini-api-key') || ''}" placeholder="AIza...">
            <span class="slt-description">Get a key at aistudio.google.com/apikey</span>
        </div>
        
        <div class="slt-setting-row slt-toggle-row">
            <label for="slt-auto-translate">Auto-Translate on Song Change</label>
            <label class="slt-toggle">
                <input type="checkbox" id="slt-auto-translate" ${storage.get('auto-translate') === 'true' ? 'checked' : ''}>
                <span class="slt-toggle-slider"></span>
            </label>
        </div>
        
        <div class="slt-setting-row slt-toggle-row">
            <label for="slt-show-notifications">Show Notifications</label>
            <label class="slt-toggle">
                <input type="checkbox" id="slt-show-notifications" ${storage.get('show-notifications') !== 'false' ? 'checked' : ''}>
                <span class="slt-toggle-slider"></span>
            </label>
        </div>

        <div class="slt-setting-row slt-toggle-row">
            <label for="slt-show-quality-indicator">Show Translation Quality Indicator</label>
            <label class="slt-toggle">
                <input type="checkbox" id="slt-show-quality-indicator" ${storage.get('show-quality-indicator') !== 'false' ? 'checked' : ''}>
                <span class="slt-toggle-slider"></span>
            </label>
        </div>

        <div class="slt-setting-row slt-toggle-row">
            <label for="slt-vocabulary-mode">Vocabulary / Learning Mode</label>
            <label class="slt-toggle">
                <input type="checkbox" id="slt-vocabulary-mode" ${storage.get('vocabulary-mode') === 'true' ? 'checked' : ''}>
                <span class="slt-toggle-slider"></span>
            </label>
        </div>

        <div class="slt-setting-row slt-toggle-row">
            <label for="slt-hide-connection-indicator">Hide Connection Status</label>
            <label class="slt-toggle">
                <input type="checkbox" id="slt-hide-connection-indicator" ${storage.get('hide-connection-indicator') === 'true' ? 'checked' : ''}>
                <span class="slt-toggle-slider"></span>
            </label>
        </div>

        <div class="slt-setting-row">
            <button class="slt-button" id="slt-view-cache">View Translation Cache</button>
        </div>
        
        <div class="slt-setting-row" style="flex-direction: row; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div>
                <span style="font-size: 14px; color: var(--spice-subtext);">Version ${VERSION}</span>
                ${(() => { const h = getContentHashShort(); return h ? `<span style="margin: 0 8px; color: var(--spice-subtext);">·</span><span style="font-size: 12px; color: var(--spice-subtext); font-family: 'JetBrains Mono','Consolas',monospace;">${h}</span>` : ''; })()}
                <span style="margin: 0 8px; color: var(--spice-subtext);">•</span>
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
        const targetLangSelect = container.querySelector('#slt-target-language') as HTMLSelectElement;
        const overlayModeSelect = container.querySelector('#slt-overlay-mode') as HTMLSelectElement;
        const preferredApiSelect = container.querySelector('#slt-preferred-api') as HTMLSelectElement;
        const customApiUrlInput = container.querySelector('#slt-custom-api-url') as HTMLInputElement;
        const customApiRow = container.querySelector('#slt-custom-api-row') as HTMLElement;
        const customApiKeyInput = container.querySelector('#slt-custom-api-key') as HTMLInputElement;
        const customApiKeyRow = container.querySelector('#slt-custom-api-key-row') as HTMLElement;
        const deeplApiKeyInput = container.querySelector('#slt-deepl-api-key') as HTMLInputElement;
        const deeplKeyRow = container.querySelector('#slt-deepl-key-row') as HTMLElement;
        const openaiApiKeyInput = container.querySelector('#slt-openai-api-key') as HTMLInputElement;
        const openaiKeyRow = container.querySelector('#slt-openai-key-row') as HTMLElement;
        const openaiModelInput = container.querySelector('#slt-openai-model') as HTMLInputElement;
        const openaiModelRow = container.querySelector('#slt-openai-model-row') as HTMLElement;
        const geminiApiKeyInput = container.querySelector('#slt-gemini-api-key') as HTMLInputElement;
        const geminiKeyRow = container.querySelector('#slt-gemini-key-row') as HTMLElement;
        const autoTranslateCheckbox = container.querySelector('#slt-auto-translate') as HTMLInputElement;
        const showNotificationsCheckbox = container.querySelector('#slt-show-notifications') as HTMLInputElement;
        const showQualityIndicatorCheckbox = container.querySelector('#slt-show-quality-indicator') as HTMLInputElement;
        const vocabularyModeCheckbox = container.querySelector('#slt-vocabulary-mode') as HTMLInputElement;
        const hideConnectionIndicatorCheckbox = container.querySelector('#slt-hide-connection-indicator') as HTMLInputElement;
        const viewCacheButton = container.querySelector('#slt-view-cache') as HTMLButtonElement;
        const viewChangelogPopupButton = container.querySelector('#slt-view-changelog-popup') as HTMLButtonElement;
        const checkUpdatesButton = container.querySelector('#slt-check-updates') as HTMLButtonElement;
        
        targetLangSelect?.addEventListener('change', () => {
            storage.set('target-language', targetLangSelect.value);
            state.targetLanguage = targetLangSelect.value;
        });
        
        overlayModeSelect?.addEventListener('change', () => {
            const mode = overlayModeSelect.value as OverlayMode;
            storage.set('overlay-mode', mode);
            state.overlayMode = mode;
            reapplyTranslations();
        });
        
        preferredApiSelect?.addEventListener('change', () => {
            const api = preferredApiSelect.value as 'google' | 'libretranslate' | 'deepl' | 'openai' | 'gemini' | 'custom';
            storage.set('preferred-api', api);
            state.preferredApi = api;
            setPreferredApi(api, customApiUrlInput?.value || '', {
                customApiKey: state.customApiKey,
                deeplApiKey: state.deeplApiKey,
                openaiApiKey: state.openaiApiKey,
                openaiModel: state.openaiModel,
                geminiApiKey: state.geminiApiKey
            });
            
            if (customApiRow) customApiRow.style.display = api === 'custom' ? 'flex' : 'none';
            if (customApiKeyRow) customApiKeyRow.style.display = api === 'custom' ? 'flex' : 'none';
            if (deeplKeyRow) deeplKeyRow.style.display = api === 'deepl' ? 'flex' : 'none';
            if (openaiKeyRow) openaiKeyRow.style.display = api === 'openai' ? 'flex' : 'none';
            if (openaiModelRow) openaiModelRow.style.display = api === 'openai' ? 'flex' : 'none';
            if (geminiKeyRow) geminiKeyRow.style.display = api === 'gemini' ? 'flex' : 'none';
        });
        
        customApiUrlInput?.addEventListener('change', () => {
            storage.set('custom-api-url', customApiUrlInput.value);
            state.customApiUrl = customApiUrlInput.value;
            setPreferredApi(state.preferredApi, customApiUrlInput.value, {
                customApiKey: state.customApiKey,
                deeplApiKey: state.deeplApiKey,
                openaiApiKey: state.openaiApiKey,
                openaiModel: state.openaiModel,
                geminiApiKey: state.geminiApiKey
            });
        });

        customApiKeyInput?.addEventListener('change', () => {
            storage.set('custom-api-key', customApiKeyInput.value);
            state.customApiKey = customApiKeyInput.value;
            setPreferredApi(state.preferredApi, state.customApiUrl, { customApiKey: customApiKeyInput.value });
        });

        deeplApiKeyInput?.addEventListener('change', () => {
            storage.set('deepl-api-key', deeplApiKeyInput.value);
            state.deeplApiKey = deeplApiKeyInput.value;
            setPreferredApi(state.preferredApi, state.customApiUrl, { deeplApiKey: deeplApiKeyInput.value });
        });

        openaiApiKeyInput?.addEventListener('change', () => {
            storage.set('openai-api-key', openaiApiKeyInput.value);
            state.openaiApiKey = openaiApiKeyInput.value;
            setPreferredApi(state.preferredApi, state.customApiUrl, { openaiApiKey: openaiApiKeyInput.value });
        });

        openaiModelInput?.addEventListener('change', () => {
            storage.set('openai-model', openaiModelInput.value);
            state.openaiModel = openaiModelInput.value;
            setPreferredApi(state.preferredApi, state.customApiUrl, { openaiModel: openaiModelInput.value });
        });

        geminiApiKeyInput?.addEventListener('change', () => {
            storage.set('gemini-api-key', geminiApiKeyInput.value);
            state.geminiApiKey = geminiApiKeyInput.value;
            setPreferredApi(state.preferredApi, state.customApiUrl, { geminiApiKey: geminiApiKeyInput.value });
        });
        
        autoTranslateCheckbox?.addEventListener('change', () => {
            storage.set('auto-translate', String(autoTranslateCheckbox.checked));
            state.autoTranslate = autoTranslateCheckbox.checked;
        });
        
        showNotificationsCheckbox?.addEventListener('change', () => {
            storage.set('show-notifications', String(showNotificationsCheckbox.checked));
            state.showNotifications = showNotificationsCheckbox.checked;
        });

        showQualityIndicatorCheckbox?.addEventListener('change', () => {
            storage.set('show-quality-indicator', String(showQualityIndicatorCheckbox.checked));
            state.showQualityIndicator = showQualityIndicatorCheckbox.checked;
            document.body.classList.toggle('slt-hide-quality-indicator', !showQualityIndicatorCheckbox.checked);
        });

        vocabularyModeCheckbox?.addEventListener('change', () => {
            storage.set('vocabulary-mode', String(vocabularyModeCheckbox.checked));
            state.vocabularyMode = vocabularyModeCheckbox.checked;
            document.body.classList.toggle('slt-vocabulary-mode', vocabularyModeCheckbox.checked);
            reapplyTranslations();
        });

        hideConnectionIndicatorCheckbox?.addEventListener('change', () => {
            storage.set('hide-connection-indicator', String(hideConnectionIndicatorCheckbox.checked));
            state.hideConnectionIndicator = hideConnectionIndicatorCheckbox.checked;
            document.body.classList.toggle('slt-hide-connection-indicator', hideConnectionIndicatorCheckbox.checked);
        });

        viewCacheButton?.addEventListener('click', () => {
            Spicetify.PopupModal?.hide();
            setTimeout(() => openCacheViewer(), 150);
        });
        
        viewChangelogPopupButton?.addEventListener('click', async () => {
            viewChangelogPopupButton.textContent = 'Loading...';
            viewChangelogPopupButton.disabled = true;
            Spicetify.PopupModal?.hide();
            try {
                await showCurrentChangelog();
            } catch (e) {
                if (Spicetify.showNotification) {
                    Spicetify.showNotification('Failed to load changelog', true);
                }
            } finally {
                viewChangelogPopupButton.textContent = 'View Changelog';
                viewChangelogPopupButton.disabled = false;
            }
        });
        
        checkUpdatesButton?.addEventListener('click', async () => {
            checkUpdatesButton.textContent = 'Checking...';
            checkUpdatesButton.disabled = true;
            
            try {
                const updateInfo = await getUpdateInfo();
                if (updateInfo?.hasUpdate) {
                    Spicetify.PopupModal?.hide();
                    setTimeout(() => checkForUpdates(true), 150);
                } else {
                    try {
                        const metadata = (window as any)._spicy_lyric_translater_metadata;
                        if (metadata?.utils?.runHotfixCheck) {
                            metadata.utils.runHotfixCheck();
                        }
                    } catch (_) {}
                    checkUpdatesButton.textContent = 'Up to date!';
                    setTimeout(() => {
                        checkUpdatesButton.textContent = 'Check for Updates';
                        checkUpdatesButton.disabled = false;
                    }, 2000);
                    if (Spicetify.showNotification) {
                        Spicetify.showNotification('You are running the latest version!');
                    }
                }
            } catch (e) {
                checkUpdatesButton.textContent = 'Check for Updates';
                checkUpdatesButton.disabled = false;
                if (Spicetify.showNotification) {
                    Spicetify.showNotification('Failed to check for updates', true);
                }
            }
        });
    }, 0);
    
    return container;
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getTrackIdFromUri(trackUri: string): string {
    return trackUri.replace('spotify:track:', '');
}

async function playCachedTrack(trackUri: string): Promise<boolean> {
    const playbackApi = (Spicetify as any)?.Platform?.PlaybackAPI;
    const player = (Spicetify as any)?.Player;

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

    const cosmos = (Spicetify as any)?.CosmosAsync;
    const cosmosAttempts: Array<{ url: string; body: any }> = [
        {
            url: 'sp://player/v2/main/command/play',
            body: { uri: trackUri }
        },
        {
            url: 'sp://player/v2/main/command/play',
            body: {
                context: { uri: trackUri },
                playback: { initiatingCommand: 'play' }
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
        const trackId = getTrackIdFromUri(trackUri);
        if (trackId && Spicetify.Platform?.History?.push) {
            Spicetify.Platform.History.push(`/track/${trackId}`);
            return true;
        }
    } catch (e) {
    }

    return false;
}

async function openCachedLyricsViewer(trackUri: string, targetLang: string, sourceLang: string): Promise<void> {
    const trackCache = getTrackCache(trackUri, targetLang);
    if (!trackCache) {
        if (Spicetify.showNotification) {
            Spicetify.showNotification('Could not load cached translation for this track', true);
        }
        return;
    }
    const translatedLines = trackCache.lines || [];

    const renderRows = (sourceLines: string[]): string => {
        const maxLines = Math.max(sourceLines.length, translatedLines.length);
        return Array.from({ length: maxLines }).map((_, idx) => {
            const sourceText = escapeHtml(sourceLines[idx] ?? '');
            const translatedText = escapeHtml(translatedLines[idx] ?? '');
            return `
                <div class="slt-lyrics-row">
                    <div class="slt-lyrics-col">${sourceText || '&nbsp;'}</div>
                    <div class="slt-lyrics-col">${translatedText || '&nbsp;'}</div>
                </div>
            `;
        }).join('');
    };

    const content = document.createElement('div');
    content.className = 'slt-lyrics-viewer';
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
            <button id="slt-lyrics-copy-all" class="slt-lyrics-copy" type="button">📋 Copy Lyrics</button>
            <button id="slt-lyrics-back-to-cache" class="slt-lyrics-back" type="button">← Back to Cache</button>
        </div>
        <div class="slt-lyrics-header">Track ID: ${escapeHtml(getTrackIdFromUri(trackUri))}</div>
        <div class="slt-lyrics-grid">
            <div class="slt-lyrics-row">
                <div class="slt-lyrics-col slt-lyrics-head" id="slt-lyrics-source-heading">${escapeHtml(sourceLang.toUpperCase())} (Source)</div>
                <div class="slt-lyrics-col slt-lyrics-head">${escapeHtml(targetLang.toUpperCase())} (Translated)</div>
            </div>
            <div id="slt-lyrics-rows">
                ${renderRows([]) || '<div class="slt-lyrics-row"><div class="slt-lyrics-col">No cached lines</div><div class="slt-lyrics-col">No cached lines</div></div>'}
            </div>
        </div>
    `;

    if (Spicetify.PopupModal) {
        Spicetify.PopupModal.display({
            title: 'Cached Lyrics Viewer',
            content,
            isLarge: true
        });
    }

    const backToCacheBtn = content.querySelector('#slt-lyrics-back-to-cache') as HTMLButtonElement;
    backToCacheBtn?.addEventListener('click', () => {
        Spicetify.PopupModal?.hide();
        setTimeout(() => openCacheViewer(), 120);
    });

    const copyBtn = content.querySelector('#slt-lyrics-copy-all') as HTMLButtonElement;
    copyBtn?.addEventListener('click', async () => {
        const rows = content.querySelectorAll('#slt-lyrics-rows .slt-lyrics-row');
        const lines: string[] = [];
        const trackTitle = trackCache.trackName || getTrackIdFromUri(trackUri);
        const trackArtist = trackCache.artistName || '';
        lines.push(`${trackTitle}${trackArtist ? ' — ' + trackArtist : ''}`);
        lines.push(`${sourceLang.toUpperCase()} → ${targetLang.toUpperCase()}`);
        lines.push('─'.repeat(40));
        rows.forEach(row => {
            const cols = row.querySelectorAll('.slt-lyrics-col');
            if (cols.length >= 2) {
                const src = (cols[0].textContent || '').trim();
                const tgt = (cols[1].textContent || '').trim();
                if (src || tgt) {
                    lines.push(src || '♪');
                    if (tgt && tgt !== src) lines.push(`  → ${tgt}`);
                    lines.push('');
                }
            }
        });
        lines.push('─'.repeat(40));
        lines.push('Exported from Spicy Lyric Translator');
        const text = lines.join('\n');
        try {
            await navigator.clipboard.writeText(text);
            copyBtn.textContent = '✓ Copied!';
            copyBtn.classList.add('slt-copied');
            setTimeout(() => {
                copyBtn.textContent = '📋 Copy Lyrics';
                copyBtn.classList.remove('slt-copied');
            }, 2000);
        } catch (e) {
            copyBtn.textContent = '✗ Failed';
            setTimeout(() => { copyBtn.textContent = '📋 Copy Lyrics'; }, 2000);
        }
    });

    const cachedSourceLines = trackCache.sourceLines || [];

    if (cachedSourceLines.length > 0) {
        const rowsContainer = content.querySelector('#slt-lyrics-rows') as HTMLElement;
        if (rowsContainer) {
            rowsContainer.innerHTML = renderRows(cachedSourceLines) || '<div class="slt-lyrics-row"><div class="slt-lyrics-col">No source lyrics found</div><div class="slt-lyrics-col">No cached lines</div></div>';
        }
    }

    try {
        const sourceLyrics = await fetchLyricsForTrackUri(trackUri);
        const sourceLines = sourceLyrics?.lines?.length ? sourceLyrics.lines : cachedSourceLines;
        const rowsContainer = content.querySelector('#slt-lyrics-rows') as HTMLElement;
        if (rowsContainer && sourceLines.length > 0) {
            rowsContainer.innerHTML = renderRows(sourceLines) || '<div class="slt-lyrics-row"><div class="slt-lyrics-col">No source lyrics found</div><div class="slt-lyrics-col">No cached lines</div></div>';
        }

        if (sourceLyrics?.language) {
            const sourceHeading = content.querySelector('#slt-lyrics-source-heading') as HTMLElement;
            if (sourceHeading) {
                sourceHeading.textContent = `${sourceLyrics.language.toUpperCase()} (Source)`;
            }
        }
    } catch (e) {
        if (cachedSourceLines.length === 0) {
            const rowsContainer = content.querySelector('#slt-lyrics-rows') as HTMLElement;
            if (rowsContainer) {
                rowsContainer.innerHTML = renderRows([]);
            }
        }
    }
}

function createCacheViewerUI(): HTMLElement {
    const stats = getTrackCacheStats();
    const cachedTracks = getAllCachedTracks();
    
    const container = document.createElement('div');
    container.className = 'slt-cache-viewer';
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
            <button id="slt-cache-back-to-settings" class="slt-cache-back" type="button">← Back to Settings</button>
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
                <span class="slt-stat-value">${stats.oldestTimestamp ? formatDate(stats.oldestTimestamp) : 'N/A'}</span>
            </div>
        </div>
        
        <div class="slt-cache-list" id="slt-cache-list">
            ${cachedTracks.length === 0 ? 
                '<div class="slt-empty-cache">No cached translations</div>' :
                cachedTracks
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .map((track, index) => {
                        const trackId = getTrackIdFromUri(track.trackUri);
                        const displayTitle = track.trackName || `Track ID: ${trackId}`;
                        const displayArtist = track.artistName || '';
                        return `
                        <div class="slt-cache-item" data-uri="${track.trackUri}" data-lang="${track.targetLang}">
                            <div class="slt-cache-item-info">
                                <span class="slt-cache-item-title">${escapeHtml(displayTitle)}</span>
                                ${displayArtist ? `<span class="slt-cache-item-artist">${escapeHtml(displayArtist)}</span>` : ''}
                                <span class="slt-cache-item-meta">${track.sourceLang} → ${track.targetLang} · ${track.lineCount} lines · ${formatDate(track.timestamp)}</span>
                            </div>
                            <div class="slt-cache-item-actions">
                                <button class="slt-cache-action slt-cache-play" data-index="${index}">Play</button>
                                <button class="slt-cache-action slt-cache-view-lyrics" data-index="${index}" data-source-lang="${track.sourceLang}">View Lyrics</button>
                                <button class="slt-cache-delete" data-index="${index}">Delete</button>
                            </div>
                        </div>
                    `}).join('')
            }
        </div>
        
        ${cachedTracks.length > 0 ? `
        <div class="slt-cache-actions">
            <button class="slt-cache-delete-all" id="slt-delete-all-cache">Delete All Cached Translations</button>
        </div>
        ` : ''}
    `;
    
    setTimeout(() => {
        const backToSettingsBtn = container.querySelector('#slt-cache-back-to-settings') as HTMLButtonElement;
        backToSettingsBtn?.addEventListener('click', () => {
            Spicetify.PopupModal?.hide();
            setTimeout(() => openSettingsModal(), 120);
        });

        container.querySelectorAll('.slt-cache-play').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const button = e.currentTarget as HTMLButtonElement;
                const item = button.closest('.slt-cache-item') as HTMLElement;
                const uri = item?.dataset.uri;
                if (!uri) return;

                button.disabled = true;
                const previousText = button.textContent;
                button.textContent = 'Opening...';

                try {
                    const played = await playCachedTrack(uri);
                    if (Spicetify.showNotification) {
                        Spicetify.showNotification(played ? 'Opening cached track' : 'Unable to play track directly', !played);
                    }
                } finally {
                    button.disabled = false;
                    button.textContent = previousText || 'Play';
                }
            });
        });

        container.querySelectorAll('.slt-cache-view-lyrics').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const button = e.currentTarget as HTMLButtonElement;
                const item = button.closest('.slt-cache-item') as HTMLElement;
                const uri = item?.dataset.uri;
                const lang = item?.dataset.lang;
                const sourceLang = button.dataset.sourceLang || 'auto';
                if (!uri || !lang) return;

                button.disabled = true;
                const previousText = button.textContent;
                button.textContent = 'Loading...';

                try {
                    Spicetify.PopupModal?.hide();
                    await new Promise(resolve => setTimeout(resolve, 120));
                    await openCachedLyricsViewer(uri, lang, sourceLang);
                } catch (error) {
                    if (Spicetify.showNotification) {
                        Spicetify.showNotification('Failed to open cached lyrics viewer', true);
                    }
                } finally {
                    button.disabled = false;
                    button.textContent = previousText || 'View Lyrics';
                }
            });
        });

        container.querySelectorAll('.slt-cache-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const item = (e.target as HTMLElement).closest('.slt-cache-item') as HTMLElement;
                if (item) {
                    const uri = item.dataset.uri;
                    const lang = item.dataset.lang;
                    if (uri) {
                        deleteTrackCache(uri, lang);
                        item.remove();
                        
                        const newStats = getTrackCacheStats();
                        const tracksEl = container.querySelector('#slt-stat-tracks');
                        const linesEl = container.querySelector('#slt-stat-lines');
                        const sizeEl = container.querySelector('#slt-stat-size');
                        if (tracksEl) tracksEl.textContent = String(newStats.trackCount);
                        if (linesEl) linesEl.textContent = String(newStats.totalLines);
                        if (sizeEl) sizeEl.textContent = formatBytes(newStats.sizeBytes);
                        
                        const list = container.querySelector('#slt-cache-list');
                        if (list && list.querySelectorAll('.slt-cache-item').length === 0) {
                            list.innerHTML = '<div class="slt-empty-cache">No cached translations</div>';
                            const actionsDiv = container.querySelector('.slt-cache-actions');
                            if (actionsDiv) actionsDiv.remove();
                        }
                    }
                }
            });
        });
        
        const deleteAllBtn = container.querySelector('#slt-delete-all-cache');
        deleteAllBtn?.addEventListener('click', () => {
            clearAllTrackCache();
            clearTranslationCache();
            
            const tracksEl = container.querySelector('#slt-stat-tracks');
            const linesEl = container.querySelector('#slt-stat-lines');
            const sizeEl = container.querySelector('#slt-stat-size');
            if (tracksEl) tracksEl.textContent = '0';
            if (linesEl) linesEl.textContent = '0';
            if (sizeEl) sizeEl.textContent = '0 B';
            
            const list = container.querySelector('#slt-cache-list');
            if (list) list.innerHTML = '<div class="slt-empty-cache">No cached translations</div>';
            
            const actionsDiv = container.querySelector('.slt-cache-actions');
            if (actionsDiv) actionsDiv.remove();
            
            if (state.showNotifications && Spicetify.showNotification) {
                Spicetify.showNotification('All cached translations deleted!');
            }
        });
    }, 0);
    
    return container;
}

function openCacheViewer(): void {
    if (Spicetify.PopupModal) {
        Spicetify.PopupModal.display({
            title: 'Translation Cache',
            content: createCacheViewerUI(),
            isLarge: true
        });
    }
}

export function openSettingsModal(): void {
    if (Spicetify.PopupModal) {
        Spicetify.PopupModal.display({
            title: 'Spicy Lyric Translator Settings',
            content: createSettingsUI(),
            isLarge: true
        });
    }
}

export async function registerSettings(): Promise<void> {
    while (typeof Spicetify === 'undefined' || !Spicetify.Platform) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    watchForSettingsPage();

    if (Spicetify.Platform?.History) {
        const registerMenuItem = () => {
            if ((Spicetify as any).Menu) {
                try {
                    new (Spicetify as any).Menu.Item(
                        'Spicy Lyric Translator',
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
            setTimeout(registerMenuItem, 2000);
        }
    }

}

export default registerSettings;
