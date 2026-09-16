import { storage } from './storage';
import { debug, warn, error as logError } from './debug';
import { displayModal, hideModal } from './modal';

declare const __VERSION__: string;

const METADATA_KEYS = [
    '_spicy_lyric_translater_metadata',
    '_spicy_lyric_translator_metadata'
] as const;

function getLoaderMetadata(): any {
    try {
        for (const key of METADATA_KEYS) {
            const metadata = (window as any)[key];
            if (metadata && metadata.LoadedVersion) return metadata;
        }
    } catch {}
    return null;
}

function clearLoaderMetadata(): void {
    try {
        for (const key of METADATA_KEYS) {
            if ((window as any)[key]) {
                (window as any)[key] = {};
            }
        }
    } catch {}
}

const LOADER_METADATA = getLoaderMetadata();
const IS_LOADER_MODE = LOADER_METADATA?.IsLoader === true;
const CURRENT_VERSION: string = LOADER_METADATA?.LoadedVersion
    || (typeof __VERSION__ !== 'undefined' ? __VERSION__ : '0.0.0');
const LOADED_HASH: string = typeof LOADER_METADATA?.ContentHash === 'string' ? LOADER_METADATA.ContentHash : '';

const GITHUB_REPO = '7xeh/SpicyLyricTranslator';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases`;
const RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`;
const UPDATE_API_URL = 'https://7xeh.dev/apps/spicylyrictranslate/api/version.php';

const MIN_CHECK_INTERVAL_MS = 15 * 60 * 1000;
const DEFAULT_CHECK_INTERVAL_MS = 30 * 60 * 1000;
const INITIAL_CHECK_DELAY_MS = 8000;
const MAX_BACKOFF_MS = 2 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 6000;
const BUNDLE_TIMEOUT_MS = 15000;
const BUNDLE_HASH_INTERVAL_MS = 2 * 60 * 60 * 1000;
const SCHEDULE_JITTER_MS = 2 * 60 * 1000;
const SNOOZE_MS = 12 * 60 * 60 * 1000;
const PENDING_TTL_MS = 60 * 60 * 1000;
const APPLIED_MODAL_DELAY_MS = 2000;

const STORAGE_KEYS = {
    pending: 'pending-update',
    snooze: 'update-snooze',
    lastVersion: 'last-known-version',
    lastHash: 'last-known-hash'
} as const;

const LEGACY_STORAGE_KEYS = [
    'pending-update-version',
    'pending-update-timestamp',
    'pending-update-changelog',
    'hotfix-detected'
];

export interface VersionInfo {
    major: number;
    minor: number;
    patch: number;
    text: string;
}

export interface RemoteRelease {
    version: VersionInfo;
    hash: string | null;
    downloadUrl: string;
    releaseUrl: string;
    changelog: string;
}

export type UpdateTrigger = 'auto' | 'manual';

export type UpdateCheckResult =
    | { status: 'update'; current: VersionInfo; remote: RemoteRelease; installable: boolean }
    | { status: 'hotfix'; current: VersionInfo; remote: RemoteRelease; hash: string }
    | { status: 'current'; current: VersionInfo; remote: RemoteRelease }
    | { status: 'error'; current: VersionInfo; message: string };

type PromptKind = 'update' | 'hotfix';

interface PendingUpdate {
    kind: PromptKind;
    version: string;
    fromVersion: string;
    fromHash: string;
    changelog: string;
    createdAt: number;
}

let isInstalling = false;
let inFlightCheck: Promise<UpdateCheckResult> | null = null;
let lastCheckTime = 0;
let lastBundleHashTime = 0;
let currentCheckIntervalMs = DEFAULT_CHECK_INTERVAL_MS;
let currentBackoffMs = 0;
let checkTimer: number | null = null;
let schedulerStarted = false;

export function parseVersion(version: string): VersionInfo | null {
    if (typeof version !== 'string') return null;
    const cleanVersion = version.trim().replace(/^v/i, '');
    const match = cleanVersion.match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!match) return null;

    return {
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10),
        patch: parseInt(match[3], 10),
        text: `${match[1]}.${match[2]}.${match[3]}`
    };
}

export function compareVersions(v1: VersionInfo, v2: VersionInfo): number {
    if (v1.major !== v2.major) return v1.major > v2.major ? 1 : -1;
    if (v1.minor !== v2.minor) return v1.minor > v2.minor ? 1 : -1;
    if (v1.patch !== v2.patch) return v1.patch > v2.patch ? 1 : -1;
    return 0;
}

export function getCurrentVersion(): VersionInfo {
    return parseVersion(CURRENT_VERSION) || { major: 0, minor: 0, patch: 0, text: CURRENT_VERSION };
}

export function getContentHash(): string {
    return LOADED_HASH;
}

export function getContentHashShort(length: number = 8): string {
    return LOADED_HASH ? LOADED_HASH.substring(0, length) : '';
}

export function isLoaderMode(): boolean {
    return IS_LOADER_MODE;
}

async function fetchWithTimeout(input: string, init: RequestInit = {}, timeoutMs: number = REQUEST_TIMEOUT_MS): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(input, { ...init, signal: controller.signal });
    } finally {
        window.clearTimeout(timeoutId);
    }
}

function withCacheBust(url: string): string {
    try {
        const parsed = new URL(url);
        parsed.searchParams.set('_', Date.now().toString());
        return parsed.href;
    } catch {
        return url;
    }
}

async function computeSHA256(text: string): Promise<string | null> {
    try {
        const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
        return null;
    }
}

function wait(ms: number): Promise<void> {
    return new Promise(resolve => window.setTimeout(resolve, ms));
}

function notify(message: string, isError: boolean = false): void {
    try {
        Spicetify.showNotification?.(message, isError);
    } catch {}
}

async function fetchSelfHostedRelease(): Promise<RemoteRelease | null> {
    try {
        const response = await fetchWithTimeout(`${UPDATE_API_URL}?action=version&_=${Date.now()}`);
        if (!response.ok) return null;

        const data = await response.json();
        const version = parseVersion(data?.version);
        if (!version) return null;

        const hash = data.hash || data.sha256 || data.checksum || null;
        return {
            version,
            hash: typeof hash === 'string' && hash.length > 0 ? hash.toLowerCase() : null,
            downloadUrl: typeof data.download_url === 'string' && data.download_url.length > 0
                ? data.download_url
                : `${UPDATE_API_URL}?action=download&version=${encodeURIComponent(version.text)}`,
            releaseUrl: data.release_notes_url || RELEASES_URL,
            changelog: typeof data.changelog === 'string' ? data.changelog : ''
        };
    } catch (e) {
        warn('Self-hosted update API unavailable:', e);
        return null;
    }
}

async function fetchGitHubRelease(path: string): Promise<any | null> {
    try {
        const response = await fetchWithTimeout(`${GITHUB_API_URL}/${path}`, {
            headers: { 'Accept': 'application/vnd.github.v3+json' }
        });
        return response.ok ? await response.json() : null;
    } catch {
        return null;
    }
}

async function fetchGitHubLatestRelease(): Promise<RemoteRelease | null> {
    const release = await fetchGitHubRelease('latest');
    const version = release ? parseVersion(release.tag_name) : null;
    if (!release || !version) return null;

    const jsAsset = Array.isArray(release.assets)
        ? release.assets.find((asset: any) => typeof asset?.name === 'string' && asset.name.endsWith('.js'))
        : null;

    return {
        version,
        hash: null,
        downloadUrl: jsAsset?.browser_download_url || '',
        releaseUrl: release.html_url || RELEASES_URL,
        changelog: release.body || ''
    };
}

export async function fetchRemoteRelease(): Promise<RemoteRelease | null> {
    return (await fetchSelfHostedRelease()) || (await fetchGitHubLatestRelease());
}

async function fetchChangelogForVersion(version: string, allowLatestFallback: boolean = true): Promise<string> {
    const tagged = await fetchGitHubRelease(`tags/v${encodeURIComponent(version)}`);
    if (tagged?.body) return tagged.body;
    if (!allowLatestFallback) return '';

    const latest = await fetchGitHubRelease('latest');
    return latest?.body || '';
}

async function detectHotfixHash(remote: RemoteRelease, trigger: UpdateTrigger): Promise<string | null> {
    if (!IS_LOADER_MODE || !LOADED_HASH) return null;
    if (compareVersions(remote.version, getCurrentVersion()) !== 0) return null;

    if (remote.hash) {
        return remote.hash !== LOADED_HASH.toLowerCase() ? remote.hash : null;
    }

    if (!remote.downloadUrl) return null;

    const now = Date.now();
    if (trigger === 'auto' && now - lastBundleHashTime < BUNDLE_HASH_INTERVAL_MS) return null;
    lastBundleHashTime = now;

    try {
        const response = await fetchWithTimeout(withCacheBust(remote.downloadUrl), {}, BUNDLE_TIMEOUT_MS);
        if (!response.ok) return null;
        const hash = await computeSHA256(await response.text());
        return hash && hash !== LOADED_HASH.toLowerCase() ? hash : null;
    } catch (e) {
        debug('Bundle hash check failed:', e);
        return null;
    }
}

async function resolveUpdateStatus(trigger: UpdateTrigger): Promise<UpdateCheckResult> {
    const current = getCurrentVersion();

    try {
        const remote = await fetchRemoteRelease();
        if (!remote) {
            return { status: 'error', current, message: 'Update server could not be reached' };
        }

        if (compareVersions(remote.version, current) > 0) {
            return { status: 'update', current, remote, installable: IS_LOADER_MODE };
        }

        const hotfixHash = await detectHotfixHash(remote, trigger);
        if (hotfixHash) {
            return { status: 'hotfix', current, remote, hash: hotfixHash };
        }

        return { status: 'current', current, remote };
    } catch (e) {
        logError('Update check failed:', e);
        return { status: 'error', current, message: e instanceof Error ? e.message : 'Unknown error' };
    }
}

function getPromptKey(result: UpdateCheckResult): string | null {
    if (result.status === 'update') return `update:${result.remote.version.text}`;
    if (result.status === 'hotfix') return `hotfix:${result.remote.version.text}:${result.hash}`;
    return null;
}

function isSnoozed(key: string): boolean {
    try {
        const raw = storage.get(STORAGE_KEYS.snooze);
        if (!raw) return false;
        const snooze = JSON.parse(raw);
        return snooze?.key === key && typeof snooze.until === 'number' && snooze.until > Date.now();
    } catch {
        return false;
    }
}

function snooze(key: string): void {
    storage.set(STORAGE_KEYS.snooze, JSON.stringify({ key, until: Date.now() + SNOOZE_MS }));
}

function isUpdaterModalOpen(): boolean {
    try {
        return !!document.querySelector('.slt-updater-modal');
    } catch {
        return false;
    }
}

export async function checkForUpdates(options: { trigger?: UpdateTrigger } | boolean = {}): Promise<UpdateCheckResult> {
    const trigger: UpdateTrigger = typeof options === 'boolean'
        ? (options ? 'manual' : 'auto')
        : (options.trigger ?? 'manual');

    if (!inFlightCheck) {
        lastCheckTime = Date.now();
        inFlightCheck = resolveUpdateStatus(trigger).finally(() => {
            inFlightCheck = null;
        });
    }

    const result = await inFlightCheck;

    if (result.status === 'error') {
        increaseBackoff();
    } else {
        resetBackoff();
    }

    const key = getPromptKey(result);
    if (key && !isInstalling) {
        if (trigger === 'manual') {
            storage.remove(STORAGE_KEYS.snooze);
            presentPrompt(result);
        } else if (!isSnoozed(key) && !isUpdaterModalOpen()) {
            presentPrompt(result);
        }
    }

    if (schedulerStarted && !isInstalling) {
        scheduleNextCheck();
    }

    return result;
}

export async function getUpdateInfo(): Promise<{
    hasUpdate: boolean;
    hasHotfix: boolean;
    currentVersion: string;
    latestVersion: string | null;
    releaseUrl: string | null;
} | null> {
    const result = inFlightCheck ? await inFlightCheck : await resolveUpdateStatus('manual');
    if (result.status === 'error') return null;

    return {
        hasUpdate: result.status === 'update',
        hasHotfix: result.status === 'hotfix',
        currentVersion: result.current.text,
        latestVersion: result.remote.version.text,
        releaseUrl: result.remote.releaseUrl
    };
}

export async function isUpdateAvailable(): Promise<boolean> {
    const info = await getUpdateInfo();
    return !!(info?.hasUpdate || info?.hasHotfix);
}

export async function runManualUpdateCheck(button: HTMLButtonElement | null, options: { beforePrompt?: () => Promise<void> | void } = {}): Promise<UpdateCheckResult | null> {
    if (button?.disabled) return null;

    const idleText = button?.dataset.sltIdleText || button?.textContent || 'Check for Updates';
    const setButton = (text: string, disabled: boolean) => {
        if (!button) return;
        button.dataset.sltIdleText = idleText;
        button.textContent = text;
        button.disabled = disabled;
    };
    const restoreLater = (text: string) => {
        setButton(text, true);
        window.setTimeout(() => setButton(idleText, false), 2500);
    };

    setButton('Checking...', true);

    const result = inFlightCheck ? await inFlightCheck : await resolveUpdateStatus('manual');

    if (result.status === 'update' || result.status === 'hotfix') {
        setButton(idleText, false);
        try {
            await options.beforePrompt?.();
        } catch {}
        storage.remove(STORAGE_KEYS.snooze);
        resetBackoff();
        presentPrompt(result);
        return result;
    }

    if (result.status === 'current') {
        resetBackoff();
        restoreLater('Up to date');
        notify(`You're on the latest version (v${result.current.text})`);
        return result;
    }

    restoreLater('Check failed');
    notify(`Couldn't check for updates: ${result.message}`, true);
    return result;
}

function getScheduledDelay(): number {
    const jitter = Math.floor(Math.random() * SCHEDULE_JITTER_MS);
    return Math.max(MIN_CHECK_INTERVAL_MS, currentCheckIntervalMs) + jitter + currentBackoffMs;
}

function scheduleNextCheck(forceDelayMs?: number): void {
    if (checkTimer !== null) {
        window.clearTimeout(checkTimer);
    }

    const delay = typeof forceDelayMs === 'number' ? Math.max(1000, forceDelayMs) : getScheduledDelay();
    checkTimer = window.setTimeout(runScheduledCheck, delay);
}

function runScheduledCheck(): void {
    checkTimer = null;
    if (isInstalling) return;

    if (document.hidden) {
        scheduleNextCheck();
        return;
    }

    if (navigator.onLine === false) {
        increaseBackoff();
        scheduleNextCheck();
        return;
    }

    checkForUpdates({ trigger: 'auto' }).catch(() => scheduleNextCheck());
}

function increaseBackoff(): void {
    currentBackoffMs = currentBackoffMs === 0 ? 5 * 60 * 1000 : Math.min(MAX_BACKOFF_MS, currentBackoffMs * 2);
}

function resetBackoff(): void {
    currentBackoffMs = 0;
}

export function startUpdateChecker(intervalMs: number = DEFAULT_CHECK_INTERVAL_MS): void {
    currentCheckIntervalMs = Math.max(MIN_CHECK_INTERVAL_MS, intervalMs);
    if (schedulerStarted) return;
    schedulerStarted = true;

    document.addEventListener('visibilitychange', () => {
        if (document.hidden || isInstalling || inFlightCheck) return;
        if (Date.now() - lastCheckTime >= MIN_CHECK_INTERVAL_MS) {
            scheduleNextCheck(3000);
        }
    });

    window.addEventListener('online', () => {
        if (isInstalling || inFlightCheck) return;
        resetBackoff();
        if (Date.now() - lastCheckTime >= MIN_CHECK_INTERVAL_MS) {
            scheduleNextCheck(3000);
        }
    });

    scheduleNextCheck(INITIAL_CHECK_DELAY_MS);
}

function readPending(): PendingUpdate | null {
    try {
        const raw = storage.get(STORAGE_KEYS.pending);
        if (!raw) return null;
        const pending = JSON.parse(raw);
        if (!pending || (pending.kind !== 'update' && pending.kind !== 'hotfix') || typeof pending.version !== 'string') {
            return null;
        }
        return pending as PendingUpdate;
    } catch {
        return null;
    }
}

async function installUpdate(result: Extract<UpdateCheckResult, { status: 'update' | 'hotfix' }>, content: HTMLElement): Promise<void> {
    if (isInstalling) return;
    isInstalling = true;

    if (checkTimer !== null) {
        window.clearTimeout(checkTimer);
        checkTimer = null;
    }

    const progress = content.querySelector('.slt-upd-progress') as HTMLElement | null;
    const progressFill = content.querySelector('.slt-upd-progress-fill') as HTMLElement | null;
    const progressText = content.querySelector('.slt-upd-progress-text') as HTMLElement | null;
    const buttons = content.querySelector('.slt-upd-buttons') as HTMLElement | null;

    const step = async (percent: number, text: string, delayMs: number) => {
        if (progressFill) progressFill.style.width = `${percent}%`;
        if (progressText) progressText.textContent = text;
        await wait(delayMs);
    };

    if (progress) progress.style.display = 'block';
    if (buttons) buttons.style.display = 'none';

    try {
        await step(20, 'Preparing update...', 250);

        let changelog = result.remote.changelog;
        if (!changelog) {
            changelog = await fetchChangelogForVersion(result.remote.version.text);
        }

        const pending: PendingUpdate = {
            kind: result.status,
            version: result.remote.version.text,
            fromVersion: result.current.text,
            fromHash: LOADED_HASH,
            changelog,
            createdAt: Date.now()
        };

        if (!storage.set(STORAGE_KEYS.pending, JSON.stringify(pending))) {
            throw new Error('Could not save update state');
        }
        storage.remove(STORAGE_KEYS.snooze);

        await step(70, result.status === 'hotfix' ? 'Hotfix ready' : `v${pending.version} ready`, 300);
        await step(100, 'Reloading Spotify...', 350);

        clearLoaderMetadata();
        window.location.reload();
    } catch (e) {
        logError('Update install failed:', e);
        storage.remove(STORAGE_KEYS.pending);
        isInstalling = false;

        if (progress) {
            progress.innerHTML = `<div class="slt-upd-error">Update couldn't be installed. Restart Spotify to try again.</div>`;
        }
        if (buttons) {
            buttons.style.display = 'flex';
            buttons.innerHTML = `
                <button class="slt-upd-btn secondary" type="button" data-action="close">Close</button>
                <button class="slt-upd-btn primary" type="button" data-action="reload">Reload Now</button>
            `;
            buttons.querySelector('[data-action="close"]')?.addEventListener('click', () => hideModal());
            buttons.querySelector('[data-action="reload"]')?.addEventListener('click', () => window.location.reload());
        }

        if (schedulerStarted) scheduleNextCheck();
    }
}

function presentPrompt(result: UpdateCheckResult): void {
    if (result.status !== 'update' && result.status !== 'hotfix') return;

    const key = getPromptKey(result)!;
    const existing = document.querySelector('.slt-updater-modal[data-prompt-key]') as HTMLElement | null;
    if (existing?.dataset.promptKey === key) return;

    const isHotfix = result.status === 'hotfix';
    const installable = isHotfix || result.installable;
    const remoteVersion = result.remote.version.text;

    const fromLabel = isHotfix ? `v${result.current.text} · ${getContentHashShort() || 'current'}` : `v${result.current.text}`;
    const toLabel = isHotfix ? `v${remoteVersion} · ${result.hash.substring(0, 8)}` : `v${remoteVersion}`;

    const title = isHotfix ? 'Hotfix available' : 'Update available';
    const subtitle = isHotfix
        ? `A patched build of v${remoteVersion} is ready. It only takes a quick reload.`
        : installable
            ? `Spicy Lyric Translator v${remoteVersion} is ready to install.`
            : `v${remoteVersion} is out. This copy was installed manually, so grab the new build from GitHub.`;

    const primaryButton = installable
        ? `<button class="slt-upd-btn primary" type="button" data-action="install">${isHotfix ? 'Apply Hotfix' : 'Install & Reload'}</button>`
        : `<a class="slt-upd-btn primary" href="${escapeHtml(result.remote.releaseUrl)}" target="_blank" rel="noopener noreferrer" data-action="open">View Release</a>`;

    const content = buildUpdaterModal({
        variant: isHotfix ? 'hotfix' : 'update',
        icon: isHotfix ? '🔧' : '🚀',
        title,
        subtitle,
        versionRow: { from: fromLabel, to: toLabel },
        changelogHtml: result.remote.changelog
            ? formatReleaseNotes(result.remote.changelog)
            : '<span class="slt-upd-muted">Loading changelog...</span>',
        buttonsHtml: `
            <button class="slt-upd-btn secondary" type="button" data-action="later">Later</button>
            ${primaryButton}
        `,
        withProgress: installable
    });
    content.dataset.promptKey = key;

    if (!result.remote.changelog) {
        fetchChangelogForVersion(remoteVersion).then(changelog => {
            result.remote.changelog = changelog;
            const target = content.querySelector('.slt-upd-notes-content');
            if (target) target.innerHTML = formatReleaseNotes(changelog);
        }).catch(() => {});
    }

    content.querySelector('[data-action="later"]')?.addEventListener('click', () => {
        snooze(key);
        hideModal();
    });
    content.querySelector('[data-action="install"]')?.addEventListener('click', () => {
        installUpdate(result, content);
    });
    content.querySelector('[data-action="open"]')?.addEventListener('click', () => {
        snooze(key);
        hideModal();
    });

    displayModal({ title: 'Spicy Lyric Translator', content, isLarge: true });
}

function showAppliedModal(kind: PromptKind, version: string, changelog: string): void {
    const isHotfix = kind === 'hotfix';
    const hashShort = getContentHashShort();

    const content = buildUpdaterModal({
        variant: isHotfix ? 'hotfix' : 'update',
        icon: isHotfix ? '🔧' : '✨',
        title: isHotfix ? 'Hotfix applied' : 'Updated successfully',
        titleBadges: [`v${version}`, ...(hashShort ? [hashShort] : [])],
        subtitle: isHotfix ? "Here's what changed in this hotfix" : "Here's what's new in this release",
        changelogHtml: formatReleaseNotes(changelog),
        buttonsHtml: `
            <a class="slt-upd-btn secondary" href="${RELEASES_URL}" target="_blank" rel="noopener noreferrer">View on GitHub</a>
            <button class="slt-upd-btn primary" type="button" data-action="dismiss">Got it</button>
        `,
        withProgress: false
    });

    content.querySelector('[data-action="dismiss"]')?.addEventListener('click', () => hideModal());
    displayModal({ title: 'Spicy Lyric Translator', content, isLarge: true });
}

export async function showPostUpdateChangelog(): Promise<void> {
    const pending = readPending();
    const lastKnownVersion = storage.get(STORAGE_KEYS.lastVersion);
    const lastKnownHash = storage.get(STORAGE_KEYS.lastHash);

    storage.remove(STORAGE_KEYS.pending);
    for (const key of LEGACY_STORAGE_KEYS) storage.remove(key);
    storage.set(STORAGE_KEYS.lastVersion, CURRENT_VERSION);
    if (LOADED_HASH) storage.set(STORAGE_KEYS.lastHash, LOADED_HASH);

    const current = getCurrentVersion();
    let applied: { kind: PromptKind; version: string; changelog: string; exactChangelogOnly: boolean } | null = null;

    if (pending && Date.now() - pending.createdAt < PENDING_TTL_MS) {
        const target = parseVersion(pending.version);
        const versionDelta = target ? compareVersions(current, target) : -1;
        const reached = pending.kind === 'hotfix'
            ? versionDelta > 0 || (versionDelta === 0 && !!LOADED_HASH && LOADED_HASH !== pending.fromHash)
            : versionDelta >= 0;

        if (!reached) {
            await wait(APPLIED_MODAL_DELAY_MS);
            notify('The update was downloaded but not applied yet. Restart Spotify to finish updating.', true);
            return;
        }

        applied = {
            kind: versionDelta > 0 ? 'update' : pending.kind,
            version: CURRENT_VERSION,
            changelog: versionDelta > 0 ? '' : pending.changelog,
            exactChangelogOnly: false
        };
    } else if (lastKnownVersion) {
        const last = parseVersion(lastKnownVersion);
        if (last && compareVersions(current, last) > 0) {
            applied = { kind: 'update', version: CURRENT_VERSION, changelog: '', exactChangelogOnly: !IS_LOADER_MODE };
        } else if (IS_LOADER_MODE && lastKnownVersion === CURRENT_VERSION && LOADED_HASH && lastKnownHash && lastKnownHash !== LOADED_HASH) {
            applied = { kind: 'hotfix', version: CURRENT_VERSION, changelog: '', exactChangelogOnly: false };
        }
    }

    if (!applied) return;

    let changelog = applied.changelog;
    if (!changelog) {
        changelog = await fetchChangelogForVersion(applied.version, !applied.exactChangelogOnly);
        if (!changelog && applied.exactChangelogOnly) return;
    }

    await wait(APPLIED_MODAL_DELAY_MS);
    showAppliedModal(applied.kind, applied.version, changelog);
}

export async function showCurrentChangelog(): Promise<void> {
    const changelog = await fetchChangelogForVersion(CURRENT_VERSION);
    const hashShort = getContentHashShort();

    const content = buildUpdaterModal({
        variant: 'update',
        icon: '📝',
        title: "What's new",
        titleBadges: [`v${CURRENT_VERSION}`, ...(hashShort ? [hashShort] : [])],
        subtitle: 'Changelog for the version you are running',
        changelogHtml: formatReleaseNotes(changelog),
        buttonsHtml: `
            <a class="slt-upd-btn secondary" href="${RELEASES_URL}" target="_blank" rel="noopener noreferrer">View on GitHub</a>
            <button class="slt-upd-btn primary" type="button" data-action="dismiss">Got it</button>
        `,
        withProgress: false
    });

    content.querySelector('[data-action="dismiss"]')?.addEventListener('click', () => hideModal());
    displayModal({ title: 'Spicy Lyric Translator', content, isLarge: true });
}

interface UpdaterModalOptions {
    variant: 'update' | 'hotfix';
    icon: string;
    title: string;
    titleBadges?: string[];
    subtitle: string;
    versionRow?: { from: string; to: string };
    changelogHtml: string;
    buttonsHtml: string;
    withProgress: boolean;
}

function buildUpdaterModal(options: UpdaterModalOptions): HTMLElement {
    const content = document.createElement('div');
    content.className = `slt-updater-modal slt-upd-${options.variant}`;

    const badges = (options.titleBadges || [])
        .map((badge, index) => `<span class="slt-upd-badge${index > 0 ? ' subtle' : ''}">${escapeHtml(badge)}</span>`)
        .join('');

    const versionRow = options.versionRow
        ? `<div class="slt-upd-versions">
                <span class="slt-upd-version from">${escapeHtml(options.versionRow.from)}</span>
                <span class="slt-upd-arrow">→</span>
                <span class="slt-upd-version to">${escapeHtml(options.versionRow.to)}</span>
            </div>`
        : '';

    const progress = options.withProgress
        ? `<div class="slt-upd-progress">
                <div class="slt-upd-progress-bar"><div class="slt-upd-progress-fill"></div></div>
                <div class="slt-upd-progress-text">Starting...</div>
            </div>`
        : '';

    content.innerHTML = `
        <style>${UPDATER_STYLES}</style>
        <div class="slt-upd-hero">
            <div class="slt-upd-hero-icon">${options.icon}</div>
            <div class="slt-upd-hero-text">
                <div class="slt-upd-hero-title">${escapeHtml(options.title)}${badges}</div>
                <div class="slt-upd-hero-subtitle">${escapeHtml(options.subtitle)}</div>
            </div>
        </div>
        ${versionRow}
        <div class="slt-upd-notes">
            <div class="slt-upd-notes-title">Changelog</div>
            <div class="slt-upd-notes-content">${options.changelogHtml}</div>
        </div>
        ${progress}
        <div class="slt-upd-buttons">${options.buttonsHtml}</div>
    `;

    return content;
}

const UPDATER_STYLES = `
    @keyframes slt-upd-in {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
    }
    @keyframes slt-upd-shimmer {
        0% { background-position: -200% center; }
        100% { background-position: 200% center; }
    }
    @keyframes slt-upd-nudge {
        0%, 100% { transform: translateX(0); }
        50% { transform: translateX(4px); }
    }
    .slt-updater-modal {
        --slt-cl-accent: #1ed760;
        --slt-upd-accent-alt: #1db954;
        --slt-upd-accent-rgb: 30, 215, 96;
        padding: 2px;
        color: var(--spice-text);
        animation: slt-upd-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    .slt-updater-modal.slt-upd-hotfix {
        --slt-cl-accent: #ffb74d;
        --slt-upd-accent-alt: #ff9800;
        --slt-upd-accent-rgb: 255, 183, 77;
    }
    .slt-upd-hero {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 16px;
        padding: 16px 18px;
        border-radius: 12px;
        background: linear-gradient(135deg, rgba(var(--slt-upd-accent-rgb), 0.12) 0%, rgba(var(--slt-upd-accent-rgb), 0.03) 100%);
        border: 1px solid rgba(var(--slt-upd-accent-rgb), 0.2);
    }
    .slt-upd-hero-icon {
        width: 44px;
        height: 44px;
        border-radius: 12px;
        background: linear-gradient(135deg, var(--slt-upd-accent-alt), var(--slt-cl-accent));
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 22px;
        flex-shrink: 0;
        box-shadow: 0 4px 12px rgba(var(--slt-upd-accent-rgb), 0.25);
    }
    .slt-upd-hero-text {
        flex: 1;
        min-width: 0;
    }
    .slt-upd-hero-title {
        font-size: 16px;
        font-weight: 700;
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
    }
    .slt-upd-hero-subtitle {
        font-size: 12px;
        color: var(--spice-subtext);
        margin-top: 3px;
    }
    .slt-upd-badge {
        background: linear-gradient(135deg, var(--slt-upd-accent-alt), var(--slt-cl-accent));
        color: #000;
        padding: 3px 10px;
        border-radius: 8px;
        font-size: 11px;
        font-weight: 800;
        font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
    }
    .slt-upd-badge.subtle {
        background: rgba(255, 255, 255, 0.06);
        color: var(--spice-subtext);
        border: 1px solid rgba(255, 255, 255, 0.08);
        font-size: 10px;
        font-weight: 600;
    }
    .slt-upd-versions {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-wrap: wrap;
        gap: 12px;
        padding: 12px 18px;
        margin-bottom: 16px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.07);
    }
    .slt-upd-version {
        padding: 5px 12px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
    }
    .slt-upd-version.from {
        background: rgba(255, 255, 255, 0.06);
        color: var(--spice-subtext);
    }
    .slt-upd-version.to {
        background: rgba(var(--slt-upd-accent-rgb), 0.15);
        color: var(--slt-cl-accent);
        border: 1px solid rgba(var(--slt-upd-accent-rgb), 0.25);
    }
    .slt-upd-arrow {
        color: var(--spice-subtext);
        animation: slt-upd-nudge 1.8s ease-in-out infinite;
    }
    .slt-upd-notes {
        padding: 14px 18px;
        margin-bottom: 16px;
        border-radius: 10px;
        max-height: 320px;
        overflow-y: auto;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
    }
    .slt-upd-notes::-webkit-scrollbar { width: 5px; }
    .slt-upd-notes::-webkit-scrollbar-track { background: transparent; }
    .slt-upd-notes::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 10px; }
    .slt-upd-notes-title {
        font-weight: 600;
        font-size: 12px;
        margin-bottom: 10px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .slt-upd-notes-content {
        color: var(--spice-subtext);
        font-size: 13px;
        line-height: 1.65;
    }
    .slt-upd-notes-content strong { color: var(--spice-text); }
    .slt-upd-notes-content del { opacity: 0.5; }
    .slt-upd-muted {
        font-style: italic;
        color: var(--spice-subtext);
    }
    .slt-upd-progress {
        display: none;
        padding: 16px 18px;
        margin-bottom: 16px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
    }
    .slt-upd-progress-bar {
        height: 6px;
        border-radius: 6px;
        overflow: hidden;
        margin-bottom: 10px;
        background: rgba(255, 255, 255, 0.06);
    }
    .slt-upd-progress-fill {
        width: 0%;
        height: 100%;
        border-radius: 6px;
        background: linear-gradient(90deg, var(--slt-upd-accent-alt), var(--slt-cl-accent), var(--slt-upd-accent-alt));
        background-size: 200% 100%;
        transition: width 0.35s cubic-bezier(0.4, 0, 0.2, 1);
        animation: slt-upd-shimmer 2s linear infinite;
    }
    .slt-upd-progress-text {
        font-size: 12px;
        font-weight: 500;
        text-align: center;
        color: var(--spice-subtext);
    }
    .slt-upd-error {
        color: #e74c3c;
        font-weight: 500;
        text-align: center;
    }
    .slt-upd-buttons {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
    }
    .slt-upd-btn {
        display: inline-flex;
        align-items: center;
        padding: 10px 24px;
        border-radius: 24px;
        border: none;
        cursor: pointer;
        font-size: 13px;
        font-weight: 700;
        text-decoration: none;
        transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
    }
    .slt-upd-btn.primary {
        background: linear-gradient(135deg, var(--slt-upd-accent-alt), var(--slt-cl-accent));
        color: #000;
        box-shadow: 0 2px 12px rgba(var(--slt-upd-accent-rgb), 0.25);
    }
    .slt-upd-btn.primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 20px rgba(var(--slt-upd-accent-rgb), 0.35);
    }
    .slt-upd-btn.secondary {
        background: rgba(255, 255, 255, 0.06);
        color: var(--spice-text);
        border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .slt-upd-btn.secondary:hover {
        background: rgba(255, 255, 255, 0.1);
    }
`;

function escapeHtml(text: string): string {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function processInlineMarkdown(text: string): string {
    const sanitizeUrl = (url: string): string => {
        const trimmed = url.trim();
        return /^https?:\/\//i.test(trimmed) ? trimmed : '';
    };
    return text
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
            const safe = sanitizeUrl(url);
            return safe ? `<img src="${safe}" alt="${alt}" style="max-width: 100%; border-radius: 4px; margin: 4px 0;">` : alt;
        })
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
            const safe = sanitizeUrl(url);
            return safe ? `<a href="${safe}" style="color: var(--slt-cl-accent, #1db954); text-decoration: none;" target="_blank" rel="noopener noreferrer">${label}</a>` : label;
        })
        .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/(?<![*\w])\*([^*]+?)\*(?![*\w])/g, '<em>$1</em>')
        .replace(/~~(.*?)~~/g, '<del>$1</del>')
        .replace(/`([^`]+)`/g, '<code style="background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 3px; font-size: 12px; color: var(--slt-cl-accent, #1db954);">$1</code>');
}

function formatReleaseNotes(body: string): string {
    if (!body || body.trim() === '') {
        return '<span class="slt-upd-muted">No changelog available for this release.</span>';
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

    for (const rawLine of lines) {
        const line = rawLine.replace(/\r$/, '');

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
        if (bq) { closeLists(); output.push(`<div style="border-left: 3px solid var(--slt-cl-accent, #1db954); padding-left: 12px; margin: 6px 0; color: var(--spice-subtext); font-style: italic;">${processInlineMarkdown(bq[1])}</div>`); continue; }

        const ul = line.match(/^([ \t]*)[-*+]\s+(.*)/);
        if (ul) {
            if (inOl) { output.push('</ol>'); inOl = false; }
            if (!inUl) { output.push('<ul style="margin: 4px 0; padding-left: 0; list-style: none;">'); inUl = true; }
            const depth = Math.min(Math.floor(ul[1].replace(/\t/g, '  ').length / 2), 5);
            const markers = ['•', '◦', '▪', '‣', '·', '•'];
            output.push(`<li style="display: flex; gap: 8px; margin: 3px 0; margin-left: ${depth * 18}px;"><span style="color: var(--slt-cl-accent, #1db954); flex-shrink: 0;">${markers[depth] || '•'}</span><span>${processInlineMarkdown(ul[2])}</span></li>`);
            continue;
        }

        const ol = line.match(/^([ \t]*)(\d+)[.)]\s+(.*)/);
        if (ol) {
            if (inUl) { output.push('</ul>'); inUl = false; }
            if (!inOl) { output.push('<ol style="margin: 4px 0; padding-left: 0; list-style: none;">'); inOl = true; }
            const depth = Math.min(Math.floor(ol[1].replace(/\t/g, '  ').length / 2), 5);
            output.push(`<li style="display: flex; gap: 8px; margin: 3px 0; margin-left: ${depth * 18}px;"><span style="color: var(--slt-cl-accent, #1db954); flex-shrink: 0; min-width: 16px; font-weight: 600;">${ol[2]}.</span><span>${processInlineMarkdown(ol[3])}</span></li>`);
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

export const VERSION = CURRENT_VERSION;
export const REPO_URL = RELEASES_URL;
