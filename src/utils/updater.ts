import { storage } from './storage';
import { warn, error as logError } from './debug';

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

export function getContentHash(): string {
    try {
        const metadata = (window as any)._spicy_lyric_translator_metadata;
        const hash = metadata?.ContentHash;
        if (typeof hash === 'string' && hash.length > 0) return hash;
    } catch {}
    return '';
}

export function getContentHashShort(length: number = 8): string {
    const hash = getContentHash();
    return hash ? hash.substring(0, length) : '';
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
            @keyframes slt-modal-fadeIn {
                from { opacity: 0; transform: translateY(8px); }
                to { opacity: 1; transform: translateY(0); }
            }
            @keyframes slt-shimmer {
                0% { background-position: -200% center; }
                100% { background-position: 200% center; }
            }
            @keyframes slt-progress-glow {
                0%, 100% { box-shadow: 0 0 8px rgba(29, 185, 84, 0.3); }
                50% { box-shadow: 0 0 16px rgba(29, 185, 84, 0.6); }
            }
            @keyframes slt-pulse-ring {
                0% { transform: scale(0.9); opacity: 0.6; }
                50% { transform: scale(1.05); opacity: 1; }
                100% { transform: scale(0.9); opacity: 0.6; }
            }
            @keyframes slt-arrow-bounce {
                0%, 100% { transform: translateX(0); }
                50% { transform: translateX(4px); }
            }
            .slt-update-modal {
                padding: 20px;
                color: var(--spice-text);
                animation: slt-modal-fadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
            }
            .slt-update-modal .update-hero {
                display: flex;
                align-items: center;
                gap: 14px;
                margin-bottom: 20px;
                padding: 16px 18px;
                border-radius: 12px;
                background: linear-gradient(135deg, rgba(29, 185, 84, 0.12) 0%, rgba(29, 185, 84, 0.04) 100%);
                border: 1px solid rgba(29, 185, 84, 0.18);
            }
            .slt-update-modal .update-hero-icon {
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
            .slt-update-modal .update-hero-text {
                flex: 1;
            }
            .slt-update-modal .update-hero-title {
                font-size: 16px;
                font-weight: 700;
                color: var(--spice-text);
                margin-bottom: 2px;
            }
            .slt-update-modal .update-hero-subtitle {
                font-size: 12px;
                color: var(--spice-subtext);
            }
            .slt-update-modal .version-info {
                background: rgba(255, 255, 255, 0.04);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                padding: 14px 18px;
                border-radius: 10px;
                margin-bottom: 16px;
                border: 1px solid rgba(255, 255, 255, 0.07);
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
            }
            .slt-update-modal .version-badge {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 5px 12px;
                border-radius: 8px;
                font-size: 13px;
                font-weight: 600;
                font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
            }
            .slt-update-modal .version-badge.current {
                background: rgba(255, 255, 255, 0.06);
                color: var(--spice-subtext);
            }
            .slt-update-modal .version-arrow {
                color: var(--spice-subtext);
                font-size: 16px;
                animation: slt-arrow-bounce 1.8s ease-in-out infinite;
                opacity: 0.7;
            }
            .slt-update-modal .version-badge.latest {
                background: linear-gradient(135deg, rgba(29, 185, 84, 0.2), rgba(30, 215, 96, 0.12));
                color: #1ed760;
                border: 1px solid rgba(29, 185, 84, 0.25);
                box-shadow: 0 0 10px rgba(29, 185, 84, 0.1);
            }
            .slt-update-modal .release-notes {
                background: rgba(255, 255, 255, 0.03);
                backdrop-filter: blur(6px);
                -webkit-backdrop-filter: blur(6px);
                padding: 14px 18px;
                border-radius: 10px;
                margin-bottom: 18px;
                max-height: 260px;
                overflow-y: auto;
                border: 1px solid rgba(255, 255, 255, 0.06);
            }
            .slt-update-modal .release-notes::-webkit-scrollbar {
                width: 5px;
            }
            .slt-update-modal .release-notes::-webkit-scrollbar-track {
                background: transparent;
            }
            .slt-update-modal .release-notes::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.15);
                border-radius: 10px;
            }
            .slt-update-modal .release-notes::-webkit-scrollbar-thumb:hover {
                background: rgba(255, 255, 255, 0.25);
            }
            .slt-update-modal .release-notes-title {
                font-weight: 600;
                font-size: 13px;
                margin-bottom: 12px;
                color: var(--spice-text);
                display: flex;
                align-items: center;
                gap: 8px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .slt-update-modal .release-notes-title svg {
                width: 14px;
                height: 14px;
                opacity: 0.7;
            }
            .slt-update-modal .release-notes-content {
                color: var(--spice-subtext);
                font-size: 13px;
                line-height: 1.65;
            }
            .slt-update-modal .update-progress {
                display: none;
                background: rgba(255, 255, 255, 0.03);
                backdrop-filter: blur(6px);
                -webkit-backdrop-filter: blur(6px);
                padding: 18px;
                border-radius: 10px;
                margin-bottom: 18px;
                border: 1px solid rgba(255, 255, 255, 0.06);
            }
            .slt-update-modal .progress-bar {
                height: 6px;
                background: rgba(255, 255, 255, 0.06);
                border-radius: 6px;
                overflow: hidden;
                margin-bottom: 10px;
            }
            .slt-update-modal .progress-bar-fill {
                height: 100%;
                background: linear-gradient(90deg, #1db954, #1ed760, #1db954);
                background-size: 200% 100%;
                border-radius: 6px;
                transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                width: 0%;
                animation: slt-shimmer 2s linear infinite, slt-progress-glow 2s ease-in-out infinite;
            }
            .slt-update-modal .progress-text {
                font-size: 12px;
                color: var(--spice-subtext);
                text-align: center;
                font-weight: 500;
            }
            .slt-update-modal .update-success {
                display: flex;
                align-items: center;
                gap: 10px;
                color: #1db954;
                font-weight: 500;
            }
            .slt-update-modal .update-error {
                display: flex;
                align-items: center;
                gap: 10px;
                color: #e74c3c;
                font-weight: 500;
            }
            .slt-update-modal .success-icon,
            .slt-update-modal .error-icon {
                font-size: 20px;
            }
            .slt-update-modal .update-buttons {
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            }
            .slt-update-modal .update-btn {
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
            .slt-update-modal .update-btn::after {
                content: '';
                position: absolute;
                inset: 0;
                opacity: 0;
                background: radial-gradient(circle at center, rgba(255,255,255,0.2) 0%, transparent 70%);
                transition: opacity 0.3s;
            }
            .slt-update-modal .update-btn:hover::after {
                opacity: 1;
            }
            .slt-update-modal .update-btn.primary {
                background: linear-gradient(135deg, #1db954, #1ed760);
                color: #000;
                box-shadow: 0 2px 12px rgba(29, 185, 84, 0.25);
            }
            .slt-update-modal .update-btn.primary:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 20px rgba(29, 185, 84, 0.35);
            }
            .slt-update-modal .update-btn.primary:active {
                transform: translateY(0);
                box-shadow: 0 1px 6px rgba(29, 185, 84, 0.2);
            }
            .slt-update-modal .update-btn.secondary {
                background: rgba(255, 255, 255, 0.06);
                color: var(--spice-text);
                border: 1px solid rgba(255, 255, 255, 0.08);
            }
            .slt-update-modal .update-btn.secondary:hover {
                background: rgba(255, 255, 255, 0.1);
                border-color: rgba(255, 255, 255, 0.14);
            }
            .slt-update-modal .update-instructions {
                background: rgba(255, 255, 255, 0.03);
                border-radius: 10px;
                padding: 16px 18px;
                margin-top: 16px;
                border: 1px solid rgba(255, 255, 255, 0.06);
            }
            .slt-update-modal .update-instructions p {
                margin: 0 0 12px 0;
                color: var(--spice-text);
            }
            .slt-update-modal .update-instructions code {
                background: rgba(0, 0, 0, 0.4);
                padding: 3px 8px;
                border-radius: 5px;
                font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
                font-size: 12px;
                color: #1ed760;
                word-break: break-all;
                border: 1px solid rgba(29, 185, 84, 0.15);
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
        <div class="update-hero">
            <div class="update-hero-icon">🚀</div>
            <div class="update-hero-text">
                <div class="update-hero-title">A new version is available!</div>
                <div class="update-hero-subtitle">Spicy Lyric Translator has a shiny new update ready for you.</div>
            </div>
        </div>
        <div class="version-info">
            <span class="version-badge current">${currentVersion.text}</span>
            <span class="version-arrow">→</span>
            <span class="version-badge latest">${latestVersion.text}</span>
        </div>
        <div class="release-notes">
            <div class="release-notes-title"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm6.5-.25A.75.75 0 017.25 7h1a.75.75 0 01.75.75v2.75h.25a.75.75 0 010 1.5h-2a.75.75 0 010-1.5h.25v-2h-.25a.75.75 0 01-.75-.75zM8 6a1 1 0 100-2 1 1 0 000 2z"/></svg>Changelog</div>
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
            title: 'Spicy Lyric Translator',
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
    const sanitizeUrl = (url: string): string => {
        const trimmed = url.trim();
        if (/^https?:\/\//i.test(trimmed)) return trimmed;
        return '';
    };
    return text
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
            const safe = sanitizeUrl(url);
            return safe ? `<img src="${safe}" alt="${alt}" style="max-width: 100%; border-radius: 4px; margin: 4px 0;">` : alt;
        })
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
            const safe = sanitizeUrl(url);
            return safe ? `<a href="${safe}" style="color: #1db954; text-decoration: none;" target="_blank" rel="noopener noreferrer">${text}</a>` : text;
        })
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
            if (!hasShownUpdateNotice) {
                hasShownUpdateNotice = true;
                showUpdateModal(current, latest.version, latest.release);
            }
        } else {
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

interface ChangelogModalOptions {
    isHotfix?: boolean;
    hashShort?: string;
}

function showChangelogModal(version: string, changelog: string, options: ChangelogModalOptions = {}): void {
    const { isHotfix = false, hashShort = '' } = options;
    const heroIcon = isHotfix ? '🔧' : '✨';
    const heroTitle = isHotfix ? 'Hotfix Applied' : 'Updated Successfully';
    const heroSubtitle = isHotfix
        ? "Here's what's new in the hotfix"
        : "Here's what's new in this release";
    const accentVar = isHotfix
        ? '--slt-cl-accent: #ffb74d; --slt-cl-accent-rgb: 255, 183, 77; --slt-cl-accent-alt: #ff9800;'
        : '--slt-cl-accent: #1ed760; --slt-cl-accent-rgb: 30, 215, 96; --slt-cl-accent-alt: #1db954;';
    const content = document.createElement('div');
    content.className = 'slt-changelog-modal' + (isHotfix ? ' slt-changelog-hotfix' : '');
    content.setAttribute('style', accentVar);
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
                background: linear-gradient(135deg, rgba(var(--slt-cl-accent-rgb, 29, 185, 84), 0.12) 0%, rgba(99, 102, 241, 0.08) 100%);
                border: 1px solid rgba(var(--slt-cl-accent-rgb, 29, 185, 84), 0.18);
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
                background: linear-gradient(90deg, transparent, rgba(var(--slt-cl-accent-rgb, 29, 185, 84), 0.4), transparent);
            }
            .slt-changelog-modal .changelog-hero-icon {
                width: 44px;
                height: 44px;
                border-radius: 12px;
                background: linear-gradient(135deg, var(--slt-cl-accent-alt, #1db954), var(--slt-cl-accent, #1ed760));
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 22px;
                flex-shrink: 0;
                box-shadow: 0 4px 12px rgba(var(--slt-cl-accent-rgb, 29, 185, 84), 0.25);
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
                background: linear-gradient(135deg, var(--slt-cl-accent-alt, #1db954), var(--slt-cl-accent, #1ed760));
                color: #000;
                padding: 3px 10px;
                border-radius: 8px;
                font-size: 11px;
                font-weight: 800;
                font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
                letter-spacing: 0.3px;
                box-shadow: 0 2px 8px rgba(var(--slt-cl-accent-rgb, 29, 185, 84), 0.2);
            }
            .slt-changelog-modal .changelog-hash {
                background: rgba(255, 255, 255, 0.06);
                color: var(--spice-subtext);
                padding: 3px 8px;
                border-radius: 6px;
                font-size: 10px;
                font-weight: 600;
                font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
                letter-spacing: 0.3px;
                margin-left: 6px;
                border: 1px solid rgba(255, 255, 255, 0.08);
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
                background: linear-gradient(135deg, var(--slt-cl-accent-alt, #1db954), var(--slt-cl-accent, #1ed760));
                color: #000;
                box-shadow: 0 2px 12px rgba(var(--slt-cl-accent-rgb, 29, 185, 84), 0.25);
            }
            .slt-changelog-modal .changelog-btn.primary:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 20px rgba(var(--slt-cl-accent-rgb, 29, 185, 84), 0.35);
            }
            .slt-changelog-modal .changelog-btn.primary:active {
                transform: translateY(0);
                box-shadow: 0 1px 6px rgba(var(--slt-cl-accent-rgb, 29, 185, 84), 0.2);
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
            <div class="changelog-hero-icon">${heroIcon}</div>
            <div class="changelog-hero-text">
                <div class="changelog-hero-title">
                    ${heroTitle}
                    <span class="changelog-badge">v${version}</span>
                    ${hashShort ? `<span class="changelog-hash">${hashShort}</span>` : ''}
                </div>
                <div class="changelog-hero-subtitle">${heroSubtitle}</div>
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
            title: 'Spicy Lyric Translator',
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
        const hashShort = getContentHashShort();
        const hotfixChangelog = await fetchChangelogForVersion(currentVersion);
        showChangelogModal(currentVersion, hotfixChangelog || '', { isHotfix: true, hashShort });
        return;
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
    const hashShort = getContentHashShort();
    showChangelogModal(CURRENT_VERSION, changelog, { hashShort });
}

export const VERSION = CURRENT_VERSION;
export const REPO_URL = RELEASES_URL;
