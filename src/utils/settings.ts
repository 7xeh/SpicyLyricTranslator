import { storage } from './storage';
import { state } from './state';
import { clearTranslationCache } from './translator';
import { getTrackCacheStats, getAllCachedTracks, deleteTrackCache, getTrackCache } from './trackCache';
import { VERSION, REPO_URL, checkForUpdates, getUpdateInfo, showCurrentChangelog, getContentHashShort } from './updater';
import { reapplyTranslations } from './core';
import { clearLyricsCache, fetchLyricsForTrackUri } from './lyricsFetcher';
import { SETTINGS_SCHEMA, SettingsEffect, SettingsField, getCurrentApiPreference, isSettingFieldVisible, readSettingValue, writeSettingValue } from './settingsModel';

const SETTINGS_ID = 'spicy-lyric-translator-settings';
const SPICY_LYRICS_CACHE_NAME = 'SpicyLyrics_LyricsStore';

function showActionNotification(message: string, isError: boolean = false): void {
    if (state.showNotifications && Spicetify.showNotification) {
        Spicetify.showNotification(message, isError);
    }
}

export function clearAllCachedTranslations(): void {
    clearTranslationCache();
    showActionNotification('All cached translations deleted!');
}

export async function clearSpicyLyricsCachedLyrics(): Promise<void> {
    try {
        clearLyricsCache();
        if (typeof caches !== 'undefined' && typeof caches.delete === 'function') {
            await caches.delete(SPICY_LYRICS_CACHE_NAME);
        }
        showActionNotification('Spicy Lyrics cached lyrics deleted!');
    } catch (e) {
        showActionNotification('Failed to clear Spicy Lyrics cached lyrics', true);
    }
}

export function renderModalCacheActionsMarkup(): string {
    return `
            <div style="display: flex; gap: 8px; width: 100%;">
                <button class="slt-button secondary" id="slt-view-cache" style="flex: 1;">View Translation Cache</button>
                <button class="slt-button secondary" id="slt-view-spicy-lyrics-cache" type="button" style="flex: 1;">View Spicy Lyrics Cache</button>
            </div>
            <div style="display: flex; gap: 8px; width: 100%;">
                <button class="slt-button secondary" id="slt-clear-spicy-lyrics-cache" type="button" style="flex: 1;">Clear Spicy Lyrics Cache</button>
                <button class="slt-button danger" id="slt-clear-translation-cache" type="button" style="flex: 1;">Clear All Cached Translations</button>
            </div>`;
}

export function bindModalCacheActions(container: ParentNode): void {
    const viewSpicyLyricsCacheButton = container.querySelector('#slt-view-spicy-lyrics-cache') as HTMLButtonElement | null;
    const spicyLyricsCacheButton = container.querySelector('#slt-clear-spicy-lyrics-cache') as HTMLButtonElement | null;
    const translationCacheButton = container.querySelector('#slt-clear-translation-cache') as HTMLButtonElement | null;

    viewSpicyLyricsCacheButton?.addEventListener('click', () => {
        Spicetify.PopupModal?.hide();
        setTimeout(() => openSpicyLyricsCacheViewer(), 150);
    });

    spicyLyricsCacheButton?.addEventListener('click', async () => {
        const previousText = spicyLyricsCacheButton.textContent || 'Clear Spicy Lyrics Cache';
        spicyLyricsCacheButton.disabled = true;
        spicyLyricsCacheButton.textContent = 'Clearing...';
        await clearSpicyLyricsCachedLyrics();
        spicyLyricsCacheButton.textContent = 'Cleared';
        setTimeout(() => {
            spicyLyricsCacheButton.disabled = false;
            spicyLyricsCacheButton.textContent = previousText;
        }, 1200);
    });

    translationCacheButton?.addEventListener('click', () => {
        const previousText = translationCacheButton.textContent || 'Clear All Cached Translations';
        translationCacheButton.disabled = true;
        clearAllCachedTranslations();
        translationCacheButton.textContent = 'Cleared';
        setTimeout(() => {
            translationCacheButton.disabled = false;
            translationCacheButton.textContent = previousText;
        }, 1200);
    });
}


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

function createNativeInput(id: string, label: string, type: string, currentValue: string, placeholder: string, onChange: (value: string) => void): HTMLElement {
    const row = document.createElement('div');
    row.className = 'x-settings-row';
    row.innerHTML = `
        <div class="x-settings-firstColumn">
            <label class="e-10310-text encore-text-body-small encore-internal-color-text-subdued" for="${id}">${label}</label>
        </div>
        <div class="x-settings-secondColumn">
            <input type="${type}" id="${id}" class="main-dropDown-dropDown" style="width: 200px;" value="" placeholder="${escapeHtml(placeholder)}" autocomplete="off" spellcheck="false" data-form-type="other">
        </div>
    `;

    const input = row.querySelector('input') as HTMLInputElement;
    if (input) input.value = currentValue;
    input?.addEventListener('change', () => onChange(input.value));

    return row;
}

function runSettingEffects(effects: SettingsEffect[], value: string | boolean): void {
    if (effects.includes('qualityIndicatorClass')) {
        document.body.classList.toggle('slt-hide-quality-indicator', !Boolean(value));
    }
    if (effects.includes('vocabularyModeClass')) {
        document.body.classList.toggle('slt-vocabulary-mode', Boolean(value));
    }
    if (effects.includes('connectionIndicatorClass')) {
        document.body.classList.toggle('slt-hide-connection-indicator', Boolean(value));
    }
    if (effects.includes('reapplyTranslations')) {
        reapplyTranslations();
    }
}

function updateSettingFieldVisibility(root: ParentNode, visibleDisplay: string): void {
    const api = getCurrentApiPreference();
    SETTINGS_SCHEMA.forEach(field => {
        const row = root.querySelector(`[data-slt-setting-field="${field.id}"]`) as HTMLElement | null;
        if (row) {
            row.style.display = isSettingFieldVisible(field, api) ? visibleDisplay : 'none';
        }
    });
}

function handleSettingChange(field: SettingsField, value: string | boolean, root?: ParentNode, visibleDisplay: string = ''): void {
    const effects = writeSettingValue(field, value);
    runSettingEffects(effects, value);
    if (effects.includes('providerVisibility') && root) {
        updateSettingFieldVisibility(root, visibleDisplay);
    }
}

function getNativeSettingInputId(field: SettingsField): string {
    return `slt-settings.${field.id}`;
}

function getModalSettingInputId(field: SettingsField): string {
    return `slt-${field.id}`;
}

function createNativeFieldRow(field: SettingsField, root: ParentNode): HTMLElement {
    const id = getNativeSettingInputId(field);
    const value = readSettingValue(field);
    let row: HTMLElement;

    if (field.type === 'toggle') {
        row = createNativeToggle(id, field.label, Boolean(value), checked => handleSettingChange(field, checked, root));
    } else if (field.type === 'select') {
        row = createNativeDropdown(id, field.label, field.options || [], String(value), selected => handleSettingChange(field, selected, root));
    } else {
        row = createNativeInput(id, field.label, field.type === 'password' ? 'password' : 'text', String(value), field.placeholder || '', inputValue => handleSettingChange(field, inputValue, root));
    }

    row.dataset.sltSettingField = field.id;
    row.style.display = isSettingFieldVisible(field) ? '' : 'none';
    return row;
}

function renderNativeSettingsFields(container: HTMLElement): void {
    SETTINGS_SCHEMA.forEach(field => {
        container.appendChild(createNativeFieldRow(field, container));
    });
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

    renderNativeSettingsFields(sectionContent);

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
        clearAllCachedTranslations
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

function renderModalSettingsMarkup(): string {
    return SETTINGS_SCHEMA.map(field => {
        const id = getModalSettingInputId(field);
        const value = readSettingValue(field);
        const display = isSettingFieldVisible(field) ? 'grid' : 'none';
        const description = field.description ? `<span class="slt-description">${escapeHtml(field.description)}</span>` : '';

        if (field.type === 'toggle') {
            return `
        <div class="slt-modal-field slt-modal-toggle-field" data-slt-setting-field="${field.id}" style="display: ${display}">
            <div class="slt-modal-field-copy">
                <label for="${id}">${escapeHtml(field.label)}</label>
                ${description}
            </div>
            <div class="slt-modal-field-control">
                <label class="slt-toggle">
                    <input type="checkbox" id="${id}" ${value === true ? 'checked' : ''}>
                    <span class="slt-toggle-slider"></span>
                </label>
            </div>
        </div>`;
        }

        if (field.type === 'select') {
            return `
        <div class="slt-modal-field" data-slt-setting-field="${field.id}" style="display: ${display}">
            <div class="slt-modal-field-copy">
                <label for="${id}">${escapeHtml(field.label)}</label>
                ${description}
            </div>
            <div class="slt-modal-field-control">
                <select id="${id}">
                    ${(field.options || []).map(option => `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.text)}</option>`).join('')}
                </select>
            </div>
        </div>`;
        }

        return `
        <div class="slt-modal-field" data-slt-setting-field="${field.id}" style="display: ${display}">
            <div class="slt-modal-field-copy">
                <label for="${id}">${escapeHtml(field.label)}</label>
                ${description}
            </div>
            <div class="slt-modal-field-control">
                <input type="${field.type}" id="${id}" value="${escapeHtml(String(value))}" placeholder="${escapeHtml(field.placeholder || '')}" autocomplete="off" spellcheck="false" data-form-type="other">
            </div>
        </div>`;
    }).join('');
}

function bindModalSettingsFields(container: HTMLElement): void {
    SETTINGS_SCHEMA.forEach(field => {
        const control = container.querySelector(`#${getModalSettingInputId(field)}`) as HTMLInputElement | HTMLSelectElement | null;
        if (!control) return;

        const eventName = field.type === 'toggle' ? 'change' : 'change';
        control.addEventListener(eventName, () => {
            const value = field.type === 'toggle'
                ? (control as HTMLInputElement).checked
                : control.value;
            handleSettingChange(field, value, container, 'grid');
        });
    });
}

function createSettingsUI(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'slt-settings-container';
    container.innerHTML = `
        <style>
            .slt-settings-container {
                padding: 18px 22px 22px;
                display: flex;
                flex-direction: column;
                gap: 10px;
                width: min(680px, 90vw);
                max-width: 100%;
                max-height: 72vh;
                box-sizing: border-box;
                overflow-x: hidden;
                overflow-y: auto;
            }
            .slt-modal-field {
                grid-template-columns: minmax(180px, 1fr) minmax(220px, 300px);
                align-items: center;
                gap: 18px;
                padding: 9px 0;
            }
            .slt-modal-field-copy {
                min-width: 0;
            }
            .slt-modal-field-copy label {
                display: block;
                font-size: 14px;
                font-weight: 500;
                color: var(--spice-text);
                line-height: 1.35;
            }
            .slt-modal-field-control {
                display: flex;
                justify-content: flex-end;
                min-width: 0;
            }
            .slt-modal-field select,
            .slt-modal-field input[type="text"],
            .slt-modal-field input[type="password"] {
                width: 100%;
                min-height: 40px;
                padding: 8px 12px;
                border-radius: 4px;
                border: 1px solid var(--spice-button-disabled);
                background: var(--spice-card);
                color: var(--spice-text);
                font-size: 14px;
                box-sizing: border-box;
            }
            .slt-modal-field select:focus,
            .slt-modal-field input[type="text"]:focus,
            .slt-modal-field input[type="password"]:focus {
                outline: none;
                border-color: var(--spice-button);
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
                padding: 9px 18px;
                border-radius: 500px;
                border: none;
                background: var(--spice-button);
                color: var(--spice-text);
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
                transition: transform 0.1s, background 0.2s;
                white-space: nowrap;
            }
            .slt-button:hover {
                transform: scale(1.02);
                background: var(--spice-button-active);
            }
            .slt-button:active {
                transform: scale(0.98);
            }
            .slt-button.secondary {
                background: var(--spice-card);
                border: 1px solid var(--spice-button-disabled);
            }
            .slt-button.danger {
                background: rgba(255, 80, 80, 0.18);
                border: 1px solid rgba(255, 80, 80, 0.35);
                color: #ff7373;
            }
            .slt-button.danger:hover {
                background: rgba(255, 80, 80, 0.3);
                color: #fff;
            }
            .slt-button:disabled {
                cursor: default;
                opacity: 0.65;
                transform: none;
            }
            .slt-description {
                display: block;
                font-size: 12px;
                color: var(--spice-subtext);
                margin-top: 3px;
                line-height: 1.35;
            }
            .slt-modal-actions,
            .slt-modal-footer {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                flex-wrap: wrap;
                padding-top: 12px;
            }
            .slt-modal-actions {
                border-top: 1px solid rgba(255, 255, 255, 0.08);
                margin-top: 4px;
            }
            .slt-modal-cache-actions {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
                justify-content: flex-end;
            }
            .slt-modal-footer {
                color: var(--spice-subtext);
                font-size: 13px;
                padding-bottom: 2px;
            }
            .slt-modal-footer-buttons {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }
            .slt-modal-meta {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
            }
            .slt-modal-shortcut {
                color: var(--spice-subtext);
                font-size: 12px;
                opacity: 0.7;
                padding-top: 2px;
            }
            @media (max-width: 620px) {
                .slt-modal-field {
                    grid-template-columns: 1fr;
                    gap: 8px;
                }
                .slt-modal-field-control {
                    justify-content: stretch;
                }
            }
        </style>
        
        ${renderModalSettingsMarkup()}

        <div class="slt-modal-actions" style="flex-direction: column; align-items: stretch; gap: 8px;">
            <div style="display: flex; gap: 8px; width: 100%;">
                <button class="slt-button secondary" id="slt-view-cache" style="flex: 1;">View Translation Cache</button>
                <button class="slt-button secondary" id="slt-view-spicy-lyrics-cache" type="button" style="flex: 1;">View Spicy Lyrics Cache</button>
            </div>
            <div style="display: flex; gap: 8px; width: 100%;">
                <button class="slt-button secondary" id="slt-clear-spicy-lyrics-cache" type="button" style="flex: 1;">Clear Spicy Lyrics Cache</button>
                <button class="slt-button danger" id="slt-clear-translation-cache" type="button" style="flex: 1;">Clear All Cached Translations</button>
            </div>
        </div>
        
        <div class="slt-modal-footer">
            <div>
                <span style="font-size: 14px; color: var(--spice-subtext);">Version ${VERSION}</span>
                ${(() => { const h = getContentHashShort(); return h ? `<span style="margin: 0 8px; color: var(--spice-subtext);">·</span><span style="font-size: 12px; color: var(--spice-subtext); font-family: 'JetBrains Mono','Consolas',monospace;">${h}</span>` : ''; })()}
                <span style="margin: 0 8px; color: var(--spice-subtext);">•</span>
                <a href="${REPO_URL}" target="_blank" style="font-size: 14px; color: var(--spice-button);">GitHub</a>
            </div>
            <div class="slt-modal-footer-buttons">
                <button class="slt-button secondary" id="slt-view-changelog-popup">View Changelog</button>
                <button class="slt-button secondary" id="slt-check-updates">Check for Updates</button>
            </div>
        </div>
        
        <div class="slt-modal-shortcut">Keyboard shortcut: Alt+T to toggle translation</div>
    `;
    
    setTimeout(() => {
        bindModalSettingsFields(container);
        bindModalCacheActions(container);
        const viewCacheButton = container.querySelector('#slt-view-cache') as HTMLButtonElement;
        const viewChangelogPopupButton = container.querySelector('#slt-view-changelog-popup') as HTMLButtonElement;
        const checkUpdatesButton = container.querySelector('#slt-check-updates') as HTMLButtonElement;

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

function formatDurationMs(ms: number | undefined): string {
    if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return '—';
    if (ms < 1000) return `${Math.round(ms)} ms`;
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 2 : 1)} s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds - minutes * 60);
    return `${minutes}m ${remainingSeconds}s`;
}

function formatTokenCount(n: number | undefined): string {
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return '—';
    if (n < 1000) return String(n);
    if (n < 1000000) return `${(n / 1000).toFixed(n < 10000 ? 1 : 0)}k`;
    return `${(n / 1000000).toFixed(2)}M`;
}

function extractLineSample(line: any): string {
    if (!line) return '';
    if (typeof line === 'string') return line.trim();
    if (typeof line !== 'object') return '';

    const directText = line.Text || line.text || line.Lead?.Text || line.Lead?.text;
    if (typeof directText === 'string' && directText.trim()) return directText.trim();

    const leadSyllables = line.Lead?.Syllables || line.LeadSyllables;
    if (Array.isArray(leadSyllables) && leadSyllables.length > 0) {
        const joined = leadSyllables
            .map((s: any) => (typeof s === 'string' ? s : (s?.Text || s?.text || '')))
            .join('');
        if (joined.trim()) return joined.trim();
    }

    if (Array.isArray(line.Words)) {
        const joined = line.Words
            .map((w: any) => (typeof w === 'string' ? w : (w?.Text || w?.text || '')))
            .join('');
        if (joined.trim()) return joined.trim();
    }

    if (Array.isArray(line.Syllables)) {
        const joined = line.Syllables
            .map((s: any) => (typeof s === 'string' ? s : (s?.Text || s?.text || '')))
            .join('');
        if (joined.trim()) return joined.trim();
    }

    if (Array.isArray(line.Background)) {
        for (const bg of line.Background) {
            const sample = extractLineSample(bg);
            if (sample) return sample;
        }
    }

    return '';
}

function formatTrackLength(ms: number | null | undefined): string {
    if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return '';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatApiProviderLabel(api: string | undefined): string {
    if (!api) return 'Unknown';
    switch (api) {
        case 'google': return 'Google Translate';
        case 'libretranslate': return 'LibreTranslate';
        case 'deepl': return 'DeepL';
        case 'openai': return 'OpenAI';
        case 'gemini': return 'Gemini';
        case 'custom': return 'Custom API';
        default: return api;
    }
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
    const metrics = trackCache.metrics;
    const providerLabel = formatApiProviderLabel(trackCache.api);
    const modelLabel = metrics?.model;

    const renderInfoCell = (label: string, value: string, title?: string): string =>
        `<div class="slt-lyrics-info-cell"${title ? ` title="${escapeHtml(title)}"` : ''}>
            <span class="slt-lyrics-info-label">${escapeHtml(label)}</span>
            <span class="slt-lyrics-info-value">${escapeHtml(value)}</span>
        </div>`;

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
    const copyLabel = 'Copy Lyrics';
    const backToCacheLabel = '< Back to Cache';
    content.innerHTML = `
        <style>
            .slt-lyrics-viewer {
                width: min(760px, 90vw);
                max-width: 100%;
                max-height: 72vh;
                display: flex;
                flex-direction: column;
                gap: 12px;
                padding: 18px 22px 22px;
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
                background: var(--spice-card);
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.06);
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
                background: var(--spice-main-elevated);
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
                border-radius: 8px;
                overflow-y: auto;
                overflow-x: hidden;
                max-height: min(54vh, 560px);
                border: 1px solid rgba(255, 255, 255, 0.06);
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
                background: var(--spice-card);
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
            <button id="slt-lyrics-copy-all" class="slt-lyrics-copy" type="button">Copy Lyrics</button>
            <button id="slt-lyrics-back-to-cache" class="slt-lyrics-back" type="button">&lt; Back to Cache</button>
        </div>
        <div class="slt-lyrics-info">
            ${renderInfoCell('Provider', providerLabel)}
            ${renderInfoCell('Model', modelLabel || '—', modelLabel ? `Model: ${modelLabel}` : undefined)}
            ${renderInfoCell('Direction', `${(sourceLang || trackCache.lang || 'auto').toUpperCase()} → ${targetLang.toUpperCase()}`)}
            ${renderInfoCell('Lines', String(translatedLines.length))}
            ${renderInfoCell('Duration', formatDurationMs(metrics?.durationMs), metrics?.apiCalls ? `${metrics.apiCalls} API call${metrics.apiCalls === 1 ? '' : 's'}` : undefined)}
            ${renderInfoCell('Tokens (in/out)', metrics?.totalTokens ? `${formatTokenCount(metrics.inputTokens)} / ${formatTokenCount(metrics.outputTokens)}` : '—', metrics?.totalTokens ? `Total ${formatTokenCount(metrics.totalTokens)} tokens` : undefined)}
            ${renderInfoCell('Cached', formatDate(trackCache.timestamp))}
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

    const copyAllButton = content.querySelector('#slt-lyrics-copy-all') as HTMLButtonElement | null;
    const backToCacheButton = content.querySelector('#slt-lyrics-back-to-cache') as HTMLButtonElement | null;
    if (copyAllButton) copyAllButton.textContent = copyLabel;
    if (backToCacheButton) backToCacheButton.textContent = backToCacheLabel;

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
        lines.push(`${trackTitle}${trackArtist ? ' - ' + trackArtist : ''}`);
        lines.push(`${sourceLang.toUpperCase()} -> ${targetLang.toUpperCase()}`);
        lines.push('-'.repeat(40));
        rows.forEach(row => {
            const cols = row.querySelectorAll('.slt-lyrics-col');
            if (cols.length >= 2) {
                const src = (cols[0].textContent || '').trim();
                const tgt = (cols[1].textContent || '').trim();
                if (src || tgt) {
                    lines.push(src || '');
                    if (tgt && tgt !== src) lines.push(`  -> ${tgt}`);
                    lines.push('');
                }
            }
        });
        lines.push('-'.repeat(40));
        lines.push('Exported from Spicy Lyric Translator');
        const text = lines.join('\n');
        try {
            await navigator.clipboard.writeText(text);
            copyBtn.textContent = 'Copied!';
            copyBtn.classList.add('slt-copied');
            setTimeout(() => {
                copyBtn.textContent = copyLabel;
                copyBtn.classList.remove('slt-copied');
            }, 2000);
        } catch (e) {
            copyBtn.textContent = 'Failed';
            setTimeout(() => { copyBtn.textContent = copyLabel; }, 2000);
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
                padding: 18px 22px 22px;
                display: flex;
                flex-direction: column;
                gap: 12px;
                width: min(680px, 90vw);
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
                background: var(--spice-card);
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.06);
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
                background: var(--spice-card);
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.06);
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
                border-radius: 4px;
                border: none;
                background: rgba(255, 80, 80, 0.2);
                color: #ff5050;
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
                transition: opacity 0.2s, background 0.2s;
                flex-shrink: 0;
                white-space: nowrap;
            }
            .slt-cache-delete:hover {
                background: rgba(255, 80, 80, 0.4);
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
                border-radius: 4px;
                border: none;
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
                transition: opacity 0.2s, background 0.2s;
                color: var(--spice-text);
                background: var(--spice-main-elevated);
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
                background: rgba(255, 80, 80, 0.2);
                color: #ff5050;
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
                transition: background 0.2s;
                white-space: normal;
                text-align: center;
            }
            .slt-cache-delete-all:hover {
                background: rgba(255, 80, 80, 0.4);
            }
            .slt-empty-cache {
                text-align: center;
                padding: 24px;
                color: var(--spice-subtext);
                font-size: 14px;
                background: var(--spice-card);
                border-radius: 8px;
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
                background: var(--spice-main-elevated);
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
                        const providerLabel = formatApiProviderLabel(track.api);
                        const modelLabel = track.metrics?.model;
                        const providerBadge = modelLabel
                            ? `${providerLabel} · ${modelLabel}`
                            : providerLabel;
                        const metricsPills: string[] = [];
                        if (track.metrics?.durationMs) {
                            metricsPills.push(`<span class="slt-metric-pill" title="Translation duration">⏱ ${formatDurationMs(track.metrics.durationMs)}</span>`);
                        }
                        if (track.metrics?.totalTokens) {
                            metricsPills.push(`<span class="slt-metric-pill" title="Total tokens (input + output)">⌁ ${formatTokenCount(track.metrics.totalTokens)} tok</span>`);
                        }
                        if (track.metrics?.apiCalls && track.metrics.apiCalls > 1) {
                            metricsPills.push(`<span class="slt-metric-pill" title="API calls">↻ ${track.metrics.apiCalls}</span>`);
                        }
                        return `
                        <div class="slt-cache-item" data-uri="${escapeHtml(track.trackUri)}" data-lang="${escapeHtml(track.targetLang)}">
                            <div class="slt-cache-item-info">
                                <span class="slt-cache-item-title">${escapeHtml(displayTitle)}</span>
                                ${displayArtist ? `<span class="slt-cache-item-artist">${escapeHtml(displayArtist)}</span>` : ''}
                                <span class="slt-cache-item-meta">${escapeHtml(track.sourceLang)} → ${escapeHtml(track.targetLang)} · ${track.lineCount} lines · ${formatDate(track.timestamp)}</span>
                                <span class="slt-cache-item-provider"><span class="slt-provider-chip">${escapeHtml(providerBadge)}</span>${metricsPills.join('')}</span>
                            </div>
                            <div class="slt-cache-item-actions">
                                <button class="slt-cache-action slt-cache-play" data-index="${index}">Play</button>
                                <button class="slt-cache-action slt-cache-view-lyrics" data-index="${index}" data-source-lang="${escapeHtml(track.sourceLang)}">View Lyrics</button>
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
            clearAllCachedTranslations();
            
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
}async function createSpicyLyricsCacheViewerUI(): Promise<HTMLElement> {
    const container = document.createElement('div');
    container.className = 'slt-cache-viewer';
    
    container.innerHTML = `<div style="padding: 20px; text-align: center;">Loading cache...</div>`;
    
    try {
        let keys: readonly Request[] = [];
        let cacheItems: any[] = [];
        let totalSize = 0;
        
        if (typeof caches !== 'undefined') {
            const cache = await caches.open(SPICY_LYRICS_CACHE_NAME);
            keys = await cache.keys();
            
            cacheItems = await Promise.all(keys.map(async (req) => {
                const url = new URL(req.url);
                const pathParts = url.pathname.split('/').filter(Boolean);
                const trackId = pathParts.length > 0 ? pathParts[pathParts.length - 1] : null;
                const isTrackId = !!trackId && trackId.length === 22;

                let type = 'Unknown';
                let lang = '';
                let linesCount = 0;
                let sizeBytes = 0;
                let source = '';
                let trackLengthMs: number | null = null;
                let cachedAt: number | null = null;
                let rawJson: string | null = null;
                let firstLineSample = '';

                try {
                    const res = await cache.match(req);
                    if (res) {
                        const dateHeader = res.headers.get('date');
                        if (dateHeader) {
                            const parsedDate = Date.parse(dateHeader);
                            if (!Number.isNaN(parsedDate)) cachedAt = parsedDate;
                        }

                        const buffer = await res.arrayBuffer();
                        sizeBytes = buffer.byteLength;
                        totalSize += sizeBytes;

                        const text = new TextDecoder().decode(buffer);
                        rawJson = text;
                        const parsed = JSON.parse(text);
                        let lyricsData = parsed;

                        if (parsed && !parsed.Type && parsed.Content !== undefined) {
                            lyricsData = parsed.Content;
                        }

                        if (lyricsData && typeof lyricsData === 'object') {
                            if (lyricsData.Type) type = lyricsData.Type;
                            if (lyricsData.Language) lang = lyricsData.Language;
                            if (lyricsData.Source) source = String(lyricsData.Source);
                            else if (lyricsData.Provider) source = String(lyricsData.Provider);
                            if (typeof lyricsData.Length === 'number') trackLengthMs = lyricsData.Length;
                            const lineCarrier = lyricsData.Lines || lyricsData.Content;
                            if (Array.isArray(lineCarrier)) {
                                linesCount = lineCarrier.length;
                                for (const line of lineCarrier) {
                                    const sample = extractLineSample(line);
                                    if (sample) { firstLineSample = sample; break; }
                                }
                            }
                        }
                    }
                } catch (e) {}

                return { req, url, trackId, isTrackId, type, lang, linesCount, sizeBytes, source, trackLengthMs, cachedAt, rawJson, firstLineSample };
            }));
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
                background: var(--spice-card);
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.06);
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
                background: var(--spice-card);
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.06);
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
                border-radius: 4px;
                border: none;
                background: rgba(255, 80, 80, 0.2);
                color: #ff5050;
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
                transition: opacity 0.2s, background 0.2s;
                flex-shrink: 0;
                white-space: nowrap;
            }
            .slt-cache-delete:hover {
                background: rgba(255, 80, 80, 0.4);
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
                border-radius: 4px;
                border: none;
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
                transition: opacity 0.2s, background 0.2s;
                color: var(--spice-text);
                background: var(--spice-main-elevated);
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
                background: rgba(255, 80, 80, 0.2);
                color: #ff5050;
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
                transition: background 0.2s;
                white-space: normal;
                text-align: center;
            }
            .slt-cache-delete-all:hover {
                background: rgba(255, 80, 80, 0.4);
            }
            .slt-empty-cache {
                text-align: center;
                padding: 24px;
                color: var(--spice-subtext);
                font-size: 14px;
                background: var(--spice-card);
                border-radius: 8px;
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
                background: var(--spice-main-elevated);
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
                <span class="slt-stat-value" id="slt-sl-stat-size">${formatBytes(totalSize)}</span>
            </div>
        </div>
        
        <div class="slt-cache-list" id="slt-sl-cache-list">
            ${cacheItems.length === 0 ? 
                '<div class="slt-empty-cache">No cached Spicy Lyrics data</div>' :
                cacheItems.map((item, index) => {
                    const displayTitle = item.isTrackId ? 'Track ID: ' + item.trackId : item.url.pathname;

                    const detailParts: string[] = [item.url.hostname];
                    if (item.linesCount > 0) detailParts.push(`${item.linesCount} lines`);
                    if (item.trackLengthMs) {
                        const len = formatTrackLength(item.trackLengthMs);
                        if (len) detailParts.push(len);
                    }
                    detailParts.push(formatBytes(item.sizeBytes));
                    if (item.cachedAt) detailParts.push(formatDate(item.cachedAt));
                    const metaText = detailParts.join(' · ');

                    const chips: string[] = [];
                    if (item.source) chips.push(`<span class="slt-provider-chip">${escapeHtml(item.source)}</span>`);
                    if (item.type && item.type !== 'Unknown') chips.push(`<span class="slt-metric-pill" title="Lyric type">${escapeHtml(item.type)}</span>`);
                    if (item.lang) chips.push(`<span class="slt-metric-pill" title="Language">${escapeHtml(String(item.lang).toUpperCase())}</span>`);

                    return `
                    <div class="slt-cache-item" data-url="${escapeHtml(item.req.url)}" data-size="${item.sizeBytes}" data-track="${item.isTrackId ? item.trackId : ''}" data-index="${index}">
                        <div class="slt-cache-item-info">
                            <span class="slt-cache-item-title">${escapeHtml(displayTitle)}</span>
                            <span class="slt-cache-item-meta">${escapeHtml(metaText)}</span>
                            ${chips.length ? `<span class="slt-cache-item-provider">${chips.join('')}</span>` : ''}
                        </div>
                        <div class="slt-cache-item-actions">
                            ${item.isTrackId ? `<button class="slt-cache-action slt-cache-play">Play</button>` : ''}
                            <button class="slt-cache-action slt-cache-view" data-index="${index}">View</button>
                            <button class="slt-cache-delete" data-index="${index}">Delete</button>
                        </div>
                    </div>
                `}).join('')
            }
        </div>
        
        ${cacheItems.length > 0 ? `
        <div class="slt-cache-actions">
            <button class="slt-cache-delete-all" id="slt-sl-delete-all-cache">Delete All Spicy Lyrics Cache</button>
        </div>
        ` : ''}
    `;
    
    setTimeout(() => {
        const backToSettingsBtn = container.querySelector('#slt-sl-cache-back-to-settings') as HTMLButtonElement;
        backToSettingsBtn?.addEventListener('click', () => {
            Spicetify.PopupModal?.hide();
            setTimeout(() => openSettingsModal(), 120);
        });

        container.querySelectorAll('.slt-cache-play').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const button = e.currentTarget as HTMLButtonElement;
                const item = button.closest('.slt-cache-item') as HTMLElement;
                const trackId = item?.dataset.track;
                if (!trackId) return;

                button.disabled = true;
                const previousText = button.textContent;
                button.textContent = 'Opening...';

                try {
                    const uri = `spotify:track:${trackId}`;
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

        container.querySelectorAll('.slt-cache-view').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const button = e.currentTarget as HTMLButtonElement;
                const itemEl = button.closest('.slt-cache-item') as HTMLElement;
                const idxAttr = itemEl?.dataset.index;
                const idx = idxAttr ? parseInt(idxAttr, 10) : -1;
                if (idx < 0 || idx >= cacheItems.length) return;
                Spicetify.PopupModal?.hide();
                setTimeout(() => openSpicyLyricsEntryInspector(cacheItems[idx]), 120);
            });
        });

        container.querySelectorAll('.slt-cache-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const item = (e.target as HTMLElement).closest('.slt-cache-item') as HTMLElement;
                if (item) {
                    const url = item.dataset.url;
                    if (url && typeof caches !== 'undefined') {
                        try {
                            const cache = await caches.open(SPICY_LYRICS_CACHE_NAME);
                            await cache.delete(url);
                            
                            const itemSize = parseInt(item.dataset.size || '0', 10);
                            currentTotalSize = Math.max(0, currentTotalSize - itemSize);
                            
                            item.remove();
                            
                            const tracksEl = container.querySelector('#slt-sl-stat-tracks');
                            if (tracksEl) {
                                const current = parseInt(tracksEl.textContent || '0', 10);
                                tracksEl.textContent = String(Math.max(0, current - 1));
                            }
                            
                            const sizeEl = container.querySelector('#slt-sl-stat-size');
                            if (sizeEl) sizeEl.textContent = formatBytes(currentTotalSize);
                            
                            const list = container.querySelector('#slt-sl-cache-list');
                            if (list && list.querySelectorAll('.slt-cache-item').length === 0) {
                                list.innerHTML = '<div class="slt-empty-cache">No cached Spicy Lyrics data</div>';
                                const actionsDiv = container.querySelector('.slt-cache-actions');
                                if (actionsDiv) actionsDiv.remove();
                            }
                        } catch (e) {
                            console.error('Failed to delete cache item', e);
                        }
                    }
                }
            });
        });
        
        const deleteAllBtn = container.querySelector('#slt-sl-delete-all-cache');
        deleteAllBtn?.addEventListener('click', async () => {
            await clearSpicyLyricsCachedLyrics();
            
            currentTotalSize = 0;
            const tracksEl = container.querySelector('#slt-sl-stat-tracks');
            if (tracksEl) tracksEl.textContent = '0';
            
            const sizeEl = container.querySelector('#slt-sl-stat-size');
            if (sizeEl) sizeEl.textContent = '0 B';
            
            const list = container.querySelector('#slt-sl-cache-list');
            if (list) list.innerHTML = '<div class="slt-empty-cache">No cached Spicy Lyrics data</div>';
            
            const actionsDiv = container.querySelector('.slt-cache-actions');
            if (actionsDiv) actionsDiv.remove();
        });
    }, 0);
    
    } catch (e) {
        container.innerHTML = `<div style="padding: 20px; text-align: center; color: #ff7373;">Failed to load cache</div>`;
    }
    
    return container;
};

interface SpicyLyricsCacheItem {
    req: Request;
    url: URL;
    trackId: string | null;
    isTrackId: boolean;
    type: string;
    lang: string;
    linesCount: number;
    sizeBytes: number;
    source: string;
    trackLengthMs: number | null;
    cachedAt: number | null;
    rawJson: string | null;
    firstLineSample: string;
}

function openSpicyLyricsEntryInspector(item: SpicyLyricsCacheItem): void {
    const content = document.createElement('div');
    content.className = 'slt-lyrics-viewer';

    let prettyJson = '';
    try {
        prettyJson = item.rawJson ? JSON.stringify(JSON.parse(item.rawJson), null, 2) : '';
    } catch {
        prettyJson = item.rawJson || '';
    }
    const JSON_VIEW_LIMIT = 2_000_000;
    let prettyJsonTruncated = false;
    let originalJsonLength = prettyJson.length;
    if (prettyJson.length > JSON_VIEW_LIMIT) {
        prettyJsonTruncated = true;
        prettyJson = prettyJson.slice(0, JSON_VIEW_LIMIT) + `\n… (truncated at ${formatBytes(JSON_VIEW_LIMIT)} of ${formatBytes(originalJsonLength)})`;
    }

    const renderInfoCell = (label: string, value: string, title?: string): string =>
        `<div class="slt-lyrics-info-cell"${title ? ` title="${escapeHtml(title)}"` : ''}>
            <span class="slt-lyrics-info-label">${escapeHtml(label)}</span>
            <span class="slt-lyrics-info-value">${escapeHtml(value)}</span>
        </div>`;

    const displayTitle = item.isTrackId && item.trackId ? `Track ID: ${item.trackId}` : item.url.pathname;
    const trackLen = item.trackLengthMs ? formatTrackLength(item.trackLengthMs) : '';

    content.innerHTML = `
        <style>
            .slt-lyrics-viewer {
                width: min(800px, 90vw);
                max-width: 100%;
                max-height: 78vh;
                display: flex;
                flex-direction: column;
                gap: 12px;
                padding: 18px 22px 22px;
                box-sizing: border-box;
                overflow-x: hidden;
                overflow-y: hidden;
            }
            .slt-lyrics-info {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                gap: 8px;
                padding: 12px 14px;
                background: var(--spice-card);
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.06);
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
                background: var(--spice-main-elevated); color: var(--spice-text);
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
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.06);
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
                background: var(--spice-card);
                border: 1px solid rgba(255, 255, 255, 0.06);
                border-radius: 8px;
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
            ${renderInfoCell('Source', item.source || 'Unknown')}
            ${renderInfoCell('Type', item.type !== 'Unknown' ? item.type : '—')}
            ${renderInfoCell('Language', item.lang ? item.lang.toUpperCase() : '—')}
            ${renderInfoCell('Lines', item.linesCount ? String(item.linesCount) : '—')}
            ${renderInfoCell('Track Length', trackLen || '—')}
            ${renderInfoCell('Size', formatBytes(item.sizeBytes))}
            ${renderInfoCell('Cached', item.cachedAt ? formatDate(item.cachedAt) : '—')}
        </div>
        <div class="slt-lyrics-header">${escapeHtml(displayTitle)} · ${escapeHtml(item.url.hostname)}</div>
        ${item.firstLineSample ? `<div class="slt-lyrics-sample"><span class="slt-lyrics-sample-label">First Line</span>${escapeHtml(item.firstLineSample)}</div>` : ''}
        ${prettyJsonTruncated ? `<div class="slt-lyrics-sample" style="color: #f0b86e;"><span class="slt-lyrics-sample-label">Notice</span>JSON preview truncated for performance. Use Copy JSON to copy the full ${formatBytes(originalJsonLength)} payload.</div>` : ''}
        <div class="slt-json-box" id="slt-sl-entry-json">${escapeHtml(prettyJson || '(empty response)')}</div>
    `;

    if (Spicetify.PopupModal) {
        Spicetify.PopupModal.display({
            title: 'Spicy Lyrics Entry',
            content,
            isLarge: true
        });
    }

    const backBtn = content.querySelector('#slt-sl-entry-back') as HTMLButtonElement | null;
    backBtn?.addEventListener('click', () => {
        Spicetify.PopupModal?.hide();
        setTimeout(() => openSpicyLyricsCacheViewer(), 120);
    });

    const copyBtn = content.querySelector('#slt-sl-entry-copy') as HTMLButtonElement | null;
    copyBtn?.addEventListener('click', async () => {
        let fullJson = '';
        try {
            fullJson = item.rawJson ? JSON.stringify(JSON.parse(item.rawJson), null, 2) : '';
        } catch {
            fullJson = item.rawJson || '';
        }
        try {
            await navigator.clipboard.writeText(fullJson || prettyJson || '');
            copyBtn.textContent = 'Copied!';
            copyBtn.classList.add('slt-copied');
            setTimeout(() => {
                copyBtn.textContent = 'Copy JSON';
                copyBtn.classList.remove('slt-copied');
            }, 2000);
        } catch {
            copyBtn.textContent = 'Failed';
            setTimeout(() => { copyBtn.textContent = 'Copy JSON'; }, 2000);
        }
    });
}

async function openSpicyLyricsCacheViewer(): Promise<void> {
    if (Spicetify.PopupModal) {
        Spicetify.PopupModal.display({
            title: 'Spicy Lyrics Cache',
            content: (() => {
                const div = document.createElement('div');
                div.style.padding = '20px';
                div.style.textAlign = 'center';
                div.textContent = 'Loading cache...';
                return div;
            })(),
            isLarge: true
        });
        
        const ui = await createSpicyLyricsCacheViewerUI();
        
        Spicetify.PopupModal.display({
            title: 'Spicy Lyrics Cache',
            content: ui,
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
                    [
                        {
                            label: 'Spicy Lyric Translator Settings',
                            callback: openSettingsModal
                        },
                        {
                            label: 'Clear Spicy Lyrics Cache',
                            callback: () => {
                                void clearSpicyLyricsCachedLyrics();
                            }
                        },
                        {
                            label: 'Clear SLT Translation Cache',
                            callback: clearAllCachedTranslations
                        }
                    ].forEach(item => {
                        new (Spicetify as any).Menu.Item(
                            item.label,
                            false,
                            item.callback
                        ).register();
                    });
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
