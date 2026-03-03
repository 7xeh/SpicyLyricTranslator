import { storage } from './storage';
import { debug, warn, error as logError, info } from './debug';

declare const __VERSION__: string;

const isLoaderMode = (): boolean => {
    const metadata = (window as any)._spicy_lyric_translator_metadata;
    return metadata?.IsLoader === true;
};

const getLoadedVersion = (): string => {
    const metadata = (window as any)._spicy_lyric_translator_metadata;
    if (metadata?.LoadedVersion) {
        return metadata.LoadedVersion;
    }
    return typeof __VERSION__ !== 'undefined' ? __VERSION__ : '0.0.0';
};

const CURRENT_VERSION = getLoadedVersion();
const GITHUB_REPO = '7xeh/SpicyLyricTranslator';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`;
const EXTENSION_FILENAME = 'spicy-lyric-translator.js';

const UPDATE_API_URL = 'https://7xeh.dev/apps/spicylyrictranslate/api/version.php';

interface VersionInfo {
    major: number;
    minor: number;
    patch: number;
    text: string;
}

interface GitHubRelease {
    tag_name: string;
    name: string;
    html_url: string;
    body: string;
    published_at: string;
    assets: GitHubAsset[];
}

interface GitHubAsset {
    name: string;
    browser_download_url: string;
    size: number;
    download_count: number;
}

interface UpdateState {
    isUpdating: boolean;
    progress: number;
    status: string;
}

const updateState: UpdateState = {
    isUpdating: false,
    progress: 0,
    status: ''
};

let hasShownUpdateNotice = false;
let lastCheckTime = 0;
const MIN_CHECK_INTERVAL_MS = 15 * 60 * 1000;
const DEFAULT_CHECK_INTERVAL_MS = 30 * 60 * 1000;
const MAX_BACKOFF_MS = 2 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 6000;
const SCHEDULE_JITTER_MS = 2 * 60 * 1000;

let currentCheckIntervalMs = DEFAULT_CHECK_INTERVAL_MS;
let currentBackoffMs = 0;
let checkTimer: number | null = null;
let checkInProgress = false;

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs: number = REQUEST_TIMEOUT_MS): Promise<Response> {
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

function getScheduledDelay(baseMs: number): number {
    const normalizedBase = Math.max(MIN_CHECK_INTERVAL_MS, baseMs);
    const jitter = Math.floor(Math.random() * SCHEDULE_JITTER_MS);
    return normalizedBase + jitter + currentBackoffMs;
}

function scheduleNextCheck(forceDelayMs?: number): void {
    if (checkTimer !== null) {
        window.clearTimeout(checkTimer);
    }

    const delay = typeof forceDelayMs === 'number' ? Math.max(1000, forceDelayMs) : getScheduledDelay(currentCheckIntervalMs);
    checkTimer = window.setTimeout(() => {
        checkForUpdates();
    }, delay);
}

function increaseBackoff(): void {
    currentBackoffMs = currentBackoffMs === 0
        ? 5 * 60 * 1000
        : Math.min(MAX_BACKOFF_MS, currentBackoffMs * 2);
}

function resetBackoff(): void {
    currentBackoffMs = 0;
}

function parseVersion(version: string): VersionInfo | null {
    const cleanVersion = version.replace(/^v/, '');
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

function compareVersions(v1: VersionInfo, v2: VersionInfo): number {
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

export function getCurrentVersion(): VersionInfo {
    return parseVersion(CURRENT_VERSION) || {
        major: 1,
        minor: 0,
        patch: 0,
        text: CURRENT_VERSION
    };
}

export async function getLatestVersion(): Promise<{ version: VersionInfo; release: GitHubRelease; downloadUrl: string } | null> {
    let releaseNotes = '';
    let githubRelease: GitHubRelease | null = null;
    
    try {
        const ghResponse = await fetch(GITHUB_API_URL, {
            headers: { 'Accept': 'application/vnd.github.v3+json' }
        });
        if (ghResponse.ok) {
            githubRelease = await ghResponse.json();
            releaseNotes = githubRelease?.body || '';
        }
    } catch (e) {
        debug('Could not fetch GitHub release notes:', e);
    }
    
    try {
        const response = await fetchWithTimeout(`${UPDATE_API_URL}?action=version&_=${Date.now()}`);
        
        if (response.ok) {
            const data = await response.json();
            const version = parseVersion(data.version);
            
            if (version) {
                debug('Got version from self-hosted API:', data.version);
                return {
                    version,
                    release: {
                        tag_name: `v${data.version}`,
                        name: `v${data.version}`,
                        html_url: data.release_notes_url || RELEASES_URL,
                        body: data.changelog || releaseNotes || '',
                        published_at: data.published_at || new Date().toISOString(),
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
    } catch (error) {
        warn('Self-hosted API unavailable, trying GitHub:', error);
    }
    
    if (githubRelease) {
        const version = parseVersion(githubRelease.tag_name);
        if (version) {
            const jsAsset = githubRelease.assets?.find(a => a.name.endsWith('.js'));
            const downloadUrl = jsAsset?.browser_download_url || '';
            return { version, release: githubRelease, downloadUrl };
        }
    }
    
    try {
        const response = await fetchWithTimeout(GITHUB_API_URL, {
            headers: {
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (!response.ok) {
            warn('Failed to fetch latest version:', response.status);
            return null;
        }
        
        const release: GitHubRelease = await response.json();
        const version = parseVersion(release.tag_name);
        
        if (!version) {
            warn('Failed to parse version from tag:', release.tag_name);
            return null;
        }
        
        const jsAsset = release.assets?.find(a => a.name.endsWith('.js'));
        const downloadUrl = jsAsset?.browser_download_url || '';
        
        return { version, release, downloadUrl };
    } catch (error) {
        logError('Error fetching latest version:', error);
        return null;
    }
}

export async function isUpdateAvailable(): Promise<boolean> {
    const latest = await getLatestVersion();
    if (!latest) return false;
    
    const current = getCurrentVersion();
    return compareVersions(latest.version, current) > 0;
}

function getExtensionDownloadUrl(release: GitHubRelease): string | null {
    if (!release.assets || release.assets.length === 0) {
        return null;
    }
    
    const jsAsset = release.assets.find(asset => 
        asset.name.endsWith('.js') && 
        (asset.name.includes('spicy-lyric-translator') || asset.name.includes('spicylyrictranslator'))
    );
    
    if (jsAsset) {
        return jsAsset.browser_download_url;
    }
    
    const anyJs = release.assets.find(asset => asset.name.endsWith('.js'));
    return anyJs ? anyJs.browser_download_url : null;
}

async function performUpdate(release: GitHubRelease, version: VersionInfo, modalContent: HTMLElement): Promise<void> {
    if (updateState.isUpdating) return;
    
    updateState.isUpdating = true;
    updateState.progress = 0;
    updateState.status = 'Preparing update...';
    
    const progressContainer = modalContent.querySelector('.update-progress');
    const progressBar = modalContent.querySelector('.progress-bar-fill') as HTMLElement;
    const progressText = modalContent.querySelector('.progress-text');
    const buttonsContainer = modalContent.querySelector('.update-buttons');
    
    if (progressContainer) {
        (progressContainer as HTMLElement).style.display = 'block';
    }
    if (buttonsContainer) {
        (buttonsContainer as HTMLElement).style.display = 'none';
    }
    
    const updateProgress = () => {
        if (progressBar) {
            progressBar.style.width = `${updateState.progress}%`;
        }
        if (progressText) {
            progressText.textContent = updateState.status;
        }
    };
    
    try {
        storage.set('pending-update-version', version.text);
        storage.set('pending-update-timestamp', Date.now().toString());
        storage.set('pending-update-changelog', release.body || '');
        
        updateState.progress = 30;
        updateState.status = 'Preparing to update...';
        updateProgress();
        
        await new Promise(r => setTimeout(r, 500));
        
        updateState.progress = 60;
        updateState.status = 'Ready to reload...';
        updateProgress();
        
        await new Promise(r => setTimeout(r, 500));
        
        updateState.progress = 100;
        updateState.status = 'Reloading Spotify...';
        updateProgress();
        
        await new Promise(r => setTimeout(r, 300));
        
        if ((window as any)._spicy_lyric_translator_metadata) {
            (window as any)._spicy_lyric_translator_metadata = {};
        }
        
        window.location.reload();
        
    } catch (error) {
        logError('Update failed:', error);
        
        updateState.status = 'Update failed';
        updateProgress();
        
        if (progressContainer && buttonsContainer) {
            (progressContainer as HTMLElement).innerHTML = `
                <div class="update-error">
                    <span class="error-icon">❌</span>
                    <span class="error-text">Update failed. Please try restarting Spotify.</span>
                </div>
            `;
            
            (buttonsContainer as HTMLElement).style.display = 'flex';
            (buttonsContainer as HTMLElement).innerHTML = `
                <button class="update-btn secondary" id="slt-update-cancel">Cancel</button>
                <button class="update-btn primary" id="slt-reload-now">Reload Now</button>
            `;
            
            setTimeout(() => {
                const cancelBtn = document.getElementById('slt-update-cancel');
                const reloadBtn = document.getElementById('slt-reload-now');
                
                if (cancelBtn) {
                    cancelBtn.addEventListener('click', () => {
                        Spicetify.PopupModal.hide();
                        updateState.isUpdating = false;
                    });
                }
                
                if (reloadBtn) {
                    reloadBtn.addEventListener('click', () => {
                        window.location.reload();
                    });
                }
            }, 100);
        }
        
        updateState.isUpdating = false;
    }
}

async function performSilentAutoUpdate(version: VersionInfo, releaseBody?: string): Promise<void> {
    if (updateState.isUpdating) {
        return;
    }

    try {
        updateState.isUpdating = true;
        updateState.progress = 100;
        updateState.status = 'Reloading to apply update';

        storage.set('pending-update-version', version.text);
        storage.set('pending-update-timestamp', Date.now().toString());
        if (releaseBody) {
            storage.set('pending-update-changelog', releaseBody);
        }

        if ((window as any)._spicy_lyric_translator_metadata) {
            (window as any)._spicy_lyric_translator_metadata = {};
        }

        window.setTimeout(() => {
            window.location.reload();
        }, 350);
    } catch (e) {
        logError('Silent auto-update failed:', e);
        updateState.isUpdating = false;
    }
}

function showUpdateModal(currentVersion: VersionInfo, latestVersion: VersionInfo, release: GitHubRelease): void {
    const content = document.createElement('div');
    content.className = 'slt-update-modal';
    content.innerHTML = `
        <style>
            .slt-update-modal {
                padding: 16px;
                color: var(--spice-text);
            }
            .slt-update-modal .update-header {
                font-size: 16px;
                font-weight: 600;
                margin-bottom: 16px;
                color: var(--spice-text);
            }
            .slt-update-modal .version-info {
                background: var(--spice-card);
                padding: 12px 16px;
                border-radius: 8px;
                margin-bottom: 16px;
            }
            .slt-update-modal .version-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }
            .slt-update-modal .version-row:last-child {
                margin-bottom: 0;
            }
            .slt-update-modal .version-label {
                color: var(--spice-subtext);
            }
            .slt-update-modal .version-value {
                font-weight: 600;
                color: var(--spice-text);
            }
            .slt-update-modal .version-new {
                color: #1db954;
            }
            .slt-update-modal .release-notes {
                background: var(--spice-card);
                padding: 12px 16px;
                border-radius: 8px;
                margin-bottom: 16px;
                max-height: 250px;
                overflow-y: auto;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            .slt-update-modal .release-notes::-webkit-scrollbar {
                width: 6px;
            }
            .slt-update-modal .release-notes::-webkit-scrollbar-track {
                background: transparent;
            }
            .slt-update-modal .release-notes::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.2);
                border-radius: 3px;
            }
            .slt-update-modal .release-notes::-webkit-scrollbar-thumb:hover {
                background: rgba(255, 255, 255, 0.3);
            }
            .slt-update-modal .release-notes-title {
                font-weight: 600;
                margin-bottom: 12px;
                color: var(--spice-text);
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .slt-update-modal .release-notes-title::before {
                content: '📋';
            }
            .slt-update-modal .release-notes-content {
                color: var(--spice-subtext);
                font-size: 13px;
                line-height: 1.6;
            }
            .slt-update-modal .update-progress {
                display: none;
                background: var(--spice-card);
                padding: 16px;
                border-radius: 8px;
                margin-bottom: 16px;
            }
            .slt-update-modal .progress-bar {
                height: 8px;
                background: var(--spice-button);
                border-radius: 4px;
                overflow: hidden;
                margin-bottom: 8px;
            }
            .slt-update-modal .progress-bar-fill {
                height: 100%;
                background: #1db954;
                border-radius: 4px;
                transition: width 0.3s ease;
                width: 0%;
            }
            .slt-update-modal .progress-text {
                font-size: 13px;
                color: var(--spice-subtext);
                text-align: center;
            }
            .slt-update-modal .update-success {
                display: flex;
                align-items: center;
                gap: 10px;
                color: #1db954;
            }
            .slt-update-modal .update-error {
                display: flex;
                align-items: center;
                gap: 10px;
                color: #e74c3c;
            }
            .slt-update-modal .success-icon,
            .slt-update-modal .error-icon {
                font-size: 20px;
            }
            .slt-update-modal .update-buttons {
                display: flex;
                gap: 12px;
                justify-content: flex-end;
            }
            .slt-update-modal .update-btn {
                padding: 10px 20px;
                border-radius: 20px;
                border: none;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
                transition: all 0.2s;
            }
            .slt-update-modal .update-btn.primary {
                background: #1db954;
                color: #000;
            }
            .slt-update-modal .update-btn.primary:hover {
                background: #1ed760;
                transform: scale(1.02);
            }
            .slt-update-modal .update-btn.secondary {
                background: var(--spice-card);
                color: var(--spice-text);
            }
            .slt-update-modal .update-btn.secondary:hover {
                background: var(--spice-button);
            }
            .slt-update-modal .update-instructions {
                background: var(--spice-card);
                border-radius: 8px;
                padding: 16px;
                margin-top: 16px;
            }
            .slt-update-modal .update-instructions p {
                margin: 0 0 12px 0;
                color: var(--spice-text);
            }
            .slt-update-modal .update-instructions code {
                background: rgba(0, 0, 0, 0.3);
                padding: 4px 8px;
                border-radius: 4px;
                font-family: 'Fira Code', 'Consolas', monospace;
                font-size: 12px;
                color: #1db954;
                word-break: break-all;
            }
            .slt-update-modal .update-instructions ol {
                margin: 0;
                padding-left: 20px;
                color: var(--spice-subtext);
            }
            .slt-update-modal .update-instructions li {
                margin-bottom: 8px;
                line-height: 1.5;
            }
            .slt-update-modal .update-instructions li:last-child {
                margin-bottom: 0;
            }
            .slt-update-modal .update-instructions li code {
                display: inline-block;
            }
        </style>
        <div class="update-header">🎉 A new version is available!</div>
        <div class="version-info">
            <div class="version-row">
                <span class="version-label">Current Version:</span>
                <span class="version-value">${currentVersion.text}</span>
            </div>
            <div class="version-row">
                <span class="version-label">Latest Version:</span>
                <span class="version-value version-new">${latestVersion.text}</span>
            </div>
        </div>
        <div class="release-notes">
            <div class="release-notes-title">Changelog</div>
            <div class="release-notes-content">${formatReleaseNotes(release.body)}</div>
        </div>
        <div class="update-progress">
            <div class="progress-bar">
                <div class="progress-bar-fill"></div>
            </div>
            <div class="progress-text">Starting update...</div>
        </div>
        <div class="update-buttons">
            <button class="update-btn secondary" id="slt-update-later">Later</button>
            <button class="update-btn primary" id="slt-update-now">Install Update</button>
        </div>
    `;
    
    if (Spicetify.PopupModal) {
        Spicetify.PopupModal.display({
            title: 'Spicy Lyric Translator - Update Available',
            content: content,
            isLarge: true
        });
        
        setTimeout(() => {
            const laterBtn = document.getElementById('slt-update-later');
            const updateBtn = document.getElementById('slt-update-now');
            
            if (laterBtn) {
                laterBtn.addEventListener('click', () => {
                    Spicetify.PopupModal.hide();
                });
            }
            
            if (updateBtn) {
                updateBtn.addEventListener('click', () => {
                    performUpdate(release, latestVersion, content);
                });
            }
        }, 100);
    }
}

function showUpdateSnackbar(latestVersion: VersionInfo, release: GitHubRelease): void {
    if (Spicetify.showNotification) {
        const message = `Spicy Lyric Translator v${latestVersion.text} is available! Click to update.`;
        Spicetify.showNotification(message, false, 10000);
    }
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function processInlineMarkdown(text: string): string {
    return text
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width: 100%; border-radius: 4px; margin: 4px 0;">')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #1db954; text-decoration: none;" target="_blank" rel="noopener noreferrer">$1</a>')
        .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/(?<![*\w])\*([^*]+?)\*(?![*\w])/g, '<em>$1</em>')
        .replace(/~~(.*?)~~/g, '<del>$1</del>')
        .replace(/`([^`]+)`/g, '<code style="background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 3px; font-size: 12px; color: #1db954;">$1</code>');
}

function formatReleaseNotes(body: string): string {
    if (!body || body.trim() === '') {
        return '<span style="color: var(--spice-subtext); font-style: italic;">No changelog available for this release.</span>';
    }

    const lines = body.split('\n');
    const output: string[] = [];
    let inCodeBlock = false;
    let codeContent: string[] = [];
    let inUl = false;
    let inOl = false;

    const closeLists = () => {
        if (inUl) { output.push('</ul>'); inUl = false; }
        if (inOl) { output.push('</ol>'); inOl = false; }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.trim().startsWith('```')) {
            if (inCodeBlock) {
                output.push(`<pre style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 6px; overflow-x: auto; font-family: 'Fira Code','Consolas',monospace; font-size: 12px; color: var(--spice-subtext); margin: 8px 0; white-space: pre-wrap; word-break: break-word;"><code>${codeContent.join('\n')}</code></pre>`);
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

        if (line.trim() === '') {
            closeLists();
            output.push('<div style="height: 8px;"></div>');
            continue;
        }

        const h3 = line.match(/^###\s+(.*)/);
        if (h3) { closeLists(); output.push(`<div style="font-weight: 600; margin-top: 12px; margin-bottom: 6px; color: var(--spice-text);">${processInlineMarkdown(h3[1])}</div>`); continue; }

        const h2 = line.match(/^##\s+(.*)/);
        if (h2) { closeLists(); output.push(`<div style="font-weight: 600; font-size: 14px; margin-top: 14px; margin-bottom: 8px; color: var(--spice-text);">${processInlineMarkdown(h2[1])}</div>`); continue; }

        const h1 = line.match(/^#\s+(.*)/);
        if (h1) { closeLists(); output.push(`<div style="font-weight: 700; font-size: 15px; margin-top: 16px; margin-bottom: 10px; color: var(--spice-text);">${processInlineMarkdown(h1[1])}</div>`); continue; }

        if (line.match(/^(---+|===+|\*\*\*+)\s*$/)) {
            closeLists();
            output.push('<hr style="border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 12px 0;">');
            continue;
        }

        const bq = line.match(/^>\s?(.*)/);
        if (bq) { closeLists(); output.push(`<div style="border-left: 3px solid #1db954; padding-left: 12px; margin: 6px 0; color: var(--spice-subtext); font-style: italic;">${processInlineMarkdown(bq[1])}</div>`); continue; }

        const ul = line.match(/^\s*[-*+]\s+(.*)/);
        if (ul) {
            if (inOl) { output.push('</ol>'); inOl = false; }
            if (!inUl) { output.push('<ul style="margin: 4px 0; padding-left: 0; list-style: none;">'); inUl = true; }
            output.push(`<li style="display: flex; gap: 8px; margin: 4px 0;"><span style="color: #1db954;">•</span><span>${processInlineMarkdown(ul[1])}</span></li>`);
            continue;
        }

        const ol = line.match(/^\s*(\d+)\.\s+(.*)/);
        if (ol) {
            if (inUl) { output.push('</ul>'); inUl = false; }
            if (!inOl) { output.push('<ol style="margin: 4px 0; padding-left: 20px; color: var(--spice-subtext);">'); inOl = true; }
            output.push(`<li style="margin: 4px 0;">${processInlineMarkdown(ol[2])}</li>`);
            continue;
        }

        closeLists();
        output.push(`<p style="margin: 4px 0; color: var(--spice-subtext);">${processInlineMarkdown(line)}</p>`);
    }

    closeLists();
    if (inCodeBlock) {
        output.push(`<pre style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 12px; color: var(--spice-subtext); margin: 8px 0;"><code>${codeContent.join('\n')}</code></pre>`);
    }

    return output.join('');
}

export async function checkForUpdates(force: boolean = false): Promise<void> {
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
            debug(`Update available: ${current.text} → ${latest.version.text}`);
            if (!hasShownUpdateNotice) {
                hasShownUpdateNotice = true;
                info(`Auto-updating Spicy Lyric Translator to ${latest.version.text}`);
            }
            await performSilentAutoUpdate(latest.version, latest.release.body);
            hasShownUpdateNotice = true;
        } else {
            debug('Already on latest version:', current.text);
            resetBackoff();
            hasShownUpdateNotice = false;
        }
    } catch (error) {
        increaseBackoff();
        logError('Error checking for updates:', error);
    } finally {
        checkInProgress = false;

        if (!updateState.isUpdating) {
            scheduleNextCheck();
        }
    }
}

export function startUpdateChecker(intervalMs: number = DEFAULT_CHECK_INTERVAL_MS): void {
    currentCheckIntervalMs = Math.max(MIN_CHECK_INTERVAL_MS, intervalMs);

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            const elapsed = Date.now() - lastCheckTime;
            if (elapsed >= MIN_CHECK_INTERVAL_MS && !checkInProgress && !updateState.isUpdating) {
                checkForUpdates();
            }
        }
    });

    window.addEventListener('online', () => {
        if (!checkInProgress && !updateState.isUpdating) {
            resetBackoff();
            checkForUpdates();
        }
    });

    scheduleNextCheck(5000);

    info('Update checker started');
}

export async function getUpdateInfo(): Promise<{
    hasUpdate: boolean;
    currentVersion: string;
    latestVersion: string | null;
    releaseUrl: string | null;
} | null> {
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

function showChangelogModal(version: string, changelog: string): void {
    const content = document.createElement('div');
    content.className = 'slt-changelog-modal';
    content.innerHTML = `
        <style>
            .slt-changelog-modal {
                padding: 16px;
                color: var(--spice-text);
            }
            .slt-changelog-modal .changelog-header {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 16px;
            }
            .slt-changelog-modal .changelog-badge {
                background: #1db954;
                color: #000;
                padding: 4px 12px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: 700;
            }
            .slt-changelog-modal .changelog-subtitle {
                color: var(--spice-subtext);
                font-size: 13px;
            }
            .slt-changelog-modal .changelog-content {
                background: var(--spice-card);
                padding: 16px;
                border-radius: 8px;
                margin-bottom: 16px;
                max-height: 400px;
                overflow-y: auto;
                border: 1px solid rgba(255, 255, 255, 0.1);
                font-size: 13px;
                line-height: 1.6;
                color: var(--spice-subtext);
            }
            .slt-changelog-modal .changelog-content::-webkit-scrollbar {
                width: 6px;
            }
            .slt-changelog-modal .changelog-content::-webkit-scrollbar-track {
                background: transparent;
            }
            .slt-changelog-modal .changelog-content::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.2);
                border-radius: 3px;
            }
            .slt-changelog-modal .changelog-content::-webkit-scrollbar-thumb:hover {
                background: rgba(255, 255, 255, 0.3);
            }
            .slt-changelog-modal .changelog-content a {
                color: #1db954;
                text-decoration: none;
            }
            .slt-changelog-modal .changelog-content a:hover {
                text-decoration: underline;
            }
            .slt-changelog-modal .changelog-content img {
                max-width: 100%;
                border-radius: 6px;
                margin: 8px 0;
            }
            .slt-changelog-modal .changelog-content strong {
                color: var(--spice-text);
            }
            .slt-changelog-modal .changelog-content del {
                opacity: 0.6;
            }
            .slt-changelog-modal .changelog-buttons {
                display: flex;
                gap: 12px;
                justify-content: flex-end;
            }
            .slt-changelog-modal .changelog-btn {
                padding: 10px 24px;
                border-radius: 20px;
                border: none;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
                transition: all 0.2s;
            }
            .slt-changelog-modal .changelog-btn.primary {
                background: #1db954;
                color: #000;
            }
            .slt-changelog-modal .changelog-btn.primary:hover {
                background: #1ed760;
                transform: scale(1.02);
            }
            .slt-changelog-modal .changelog-btn.secondary {
                background: var(--spice-card);
                color: var(--spice-text);
            }
            .slt-changelog-modal .changelog-btn.secondary:hover {
                background: var(--spice-button);
            }
        </style>
        <div class="changelog-header">
            <span class="changelog-badge">v${version}</span>
            <span class="changelog-subtitle">Here's what's new in this update</span>
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
            title: '\u{1F389} Spicy Lyric Translator Updated!',
            content: content,
            isLarge: true
        });

        setTimeout(() => {
            const dismissBtn = document.getElementById('slt-changelog-dismiss');
            if (dismissBtn) {
                dismissBtn.addEventListener('click', () => {
                    Spicetify.PopupModal.hide();
                });
            }
        }, 100);
    }
}

async function fetchChangelogForVersion(version: string): Promise<string> {
    try {
        const tagUrl = `https://api.github.com/repos/${GITHUB_REPO}/releases/tags/v${version}`;
        const response = await fetchWithTimeout(tagUrl, {
            headers: { 'Accept': 'application/vnd.github.v3+json' }
        });
        if (response.ok) {
            const release: GitHubRelease = await response.json();
            if (release.body) return release.body;
        }
    } catch (e) {
        debug('Could not fetch changelog for version', version, ':', e);
    }

    try {
        const response = await fetchWithTimeout(GITHUB_API_URL, {
            headers: { 'Accept': 'application/vnd.github.v3+json' }
        });
        if (response.ok) {
            const release: GitHubRelease = await response.json();
            if (release.body) return release.body;
        }
    } catch (e) {
        debug('Could not fetch latest release changelog:', e);
    }

    return '';
}

export async function showPostUpdateChangelog(): Promise<void> {
    const currentVersion = CURRENT_VERSION;
    let targetVersion: string | null = null;
    let changelog: string | null = null;

    const hotfixDetected = storage.get('hotfix-detected');
    if (hotfixDetected) {
        storage.remove('hotfix-detected');
        await new Promise(r => setTimeout(r, 2000));
        const metadata = (window as any)._spicy_lyric_translator_metadata;
        const hashShort = metadata?.ContentHash ? metadata.ContentHash.substring(0, 8) : '';
        const hashLabel = hashShort ? ` [${hashShort}]` : '';
        if (Spicetify.showNotification) {
            Spicetify.showNotification(`Spicy Lyric Translator v${currentVersion} hotfix applied!${hashLabel}`);
        }
        info(`Hotfix applied for v${currentVersion}${hashLabel}`);
    }

    const pendingVersion = storage.get('pending-update-version');
    if (pendingVersion) {
        const pendingTimestamp = storage.get('pending-update-timestamp');

        storage.remove('pending-update-version');
        storage.remove('pending-update-timestamp');

        if (pendingTimestamp) {
            const elapsed = Date.now() - parseInt(pendingTimestamp, 10);
            if (elapsed > 60 * 60 * 1000) {
                storage.remove('pending-update-changelog');
                storage.set('last-known-version', currentVersion);
                return;
            }
        }

        changelog = storage.get('pending-update-changelog');
        storage.remove('pending-update-changelog');
        targetVersion = pendingVersion;
    } else {
        const lastKnownVersion = storage.get('last-known-version');
        if (lastKnownVersion && lastKnownVersion !== currentVersion) {
            const lastParsed = parseVersion(lastKnownVersion);
            const currentParsed = parseVersion(currentVersion);
            if (lastParsed && currentParsed && compareVersions(currentParsed, lastParsed) > 0) {
                targetVersion = currentVersion;
                debug(`Version change detected: ${lastKnownVersion} → ${currentVersion}`);
            }
        } else if (!lastKnownVersion) {
            storage.set('last-known-version', currentVersion);
            return;
        }
    }

    storage.set('last-known-version', currentVersion);

    if (!targetVersion) return;

    if (!changelog) {
        changelog = await fetchChangelogForVersion(targetVersion);
    }

    await new Promise(r => setTimeout(r, 2000));

    showChangelogModal(targetVersion, changelog || '');
}

export async function showCurrentChangelog(): Promise<void> {
    const changelog = await fetchChangelogForVersion(CURRENT_VERSION);
    showChangelogModal(CURRENT_VERSION, changelog);
}

export const VERSION = CURRENT_VERSION;
export const REPO_URL = RELEASES_URL;
