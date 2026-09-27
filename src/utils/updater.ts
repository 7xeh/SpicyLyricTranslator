import { storage } from './storage';
import { debug, warn, error as logError } from './debug';
import { el, text, openDialog, openDock, activeDock, prefersReducedMotion, SurfaceAction, SurfaceHandle } from './surface';
import { toast, dismissToast, removeInboxEntries, registerInboxAction, ToastHandle } from './toast';

declare const __VERSION__: string;
declare const __BUILD_HASH__: string;

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
    lastHash: 'last-known-hash',
    skip: 'update-skip'
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
    resume?: boolean;
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

export function getBuildHash(): string {
    return typeof __BUILD_HASH__ === 'string' && !__BUILD_HASH__.startsWith('SLT_BUILD_HASH_PLACEHOLDER') ? __BUILD_HASH__ : '';
}

export function getDisplayHash(): { hash: string; source: 'delivered' | 'build' | '' } {
    if (LOADED_HASH) return { hash: LOADED_HASH, source: 'delivered' };
    const build = getBuildHash();
    if (build) return { hash: build, source: 'build' };
    return { hash: '', source: '' };
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

function runCheck(trigger: UpdateTrigger): Promise<UpdateCheckResult> {
    if (!inFlightCheck) {
        lastCheckTime = Date.now();
        inFlightCheck = resolveUpdateStatus(trigger).finally(() => {
            inFlightCheck = null;
        });
    }
    return inFlightCheck;
}

function isSnoozed(key: string): boolean {
    if (storage.get(STORAGE_KEYS.skip) === key) return true;
    try {
        const raw = storage.get(STORAGE_KEYS.snooze);
        if (!raw) return false;
        const snooze = JSON.parse(raw);
        return snooze?.key === key && typeof snooze.until === 'number' && snooze.until > Date.now();
    } catch {
        return false;
    }
}

function snooze(key: string, ms: number = SNOOZE_MS): void {
    storage.set(STORAGE_KEYS.snooze, JSON.stringify({ key, until: Date.now() + ms }));
}

function clearSnooze(): void {
    storage.remove(STORAGE_KEYS.snooze);
    storage.remove(STORAGE_KEYS.skip);
}

export async function checkForUpdates(options: { trigger?: UpdateTrigger } | boolean = {}): Promise<UpdateCheckResult> {
    const trigger: UpdateTrigger = typeof options === 'boolean'
        ? (options ? 'manual' : 'auto')
        : (options.trigger ?? 'manual');

    const result = await runCheck(trigger);

    if (result.status === 'error') {
        increaseBackoff();
    } else {
        resetBackoff();
    }

    const key = getPromptKey(result);
    if (key && !isInstalling) {
        if (trigger === 'manual') {
            clearSnooze();
            presentPrompt(result, 'manual');
        } else if (!isSnoozed(key)) {
            presentPrompt(result, 'auto');
        } else if (storage.get(STORAGE_KEYS.skip) !== key) {
            setWaiting(result);
        }
    } else if (!key) {
        setWaiting(null);
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
    const result = await runCheck('manual');
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

export async function runManualUpdateCheck(button: HTMLButtonElement | null): Promise<UpdateCheckResult | null> {
    if (button?.disabled) return null;

    const idleText = button?.dataset.sltIdleText || button?.textContent || 'Check for updates';
    const setButton = (label: string, disabled: boolean) => {
        if (!button) return;
        button.dataset.sltIdleText = idleText;
        button.textContent = label;
        button.disabled = disabled;
    };
    const restoreLater = (label: string) => {
        setButton(label, true);
        window.setTimeout(() => setButton(idleText, false), 2500);
    };

    setButton('Checking…', true);

    const result = await runCheck('manual');

    if (result.status === 'update' || result.status === 'hotfix') {
        setButton(idleText, false);
        clearSnooze();
        resetBackoff();
        presentPrompt(result, 'manual');
        return result;
    }

    if (result.status === 'current') {
        resetBackoff();
        restoreLater('Up to date');
        setWaiting(null);
        toast({
            kind: 'success',
            key: 'slt-update-check',
            title: "You're up to date",
            description: `v${result.current.text} is the latest Spicy Lyric Translator.`,
        });
        return result;
    }

    increaseBackoff();
    restoreLater('Check failed');
    toast({
        kind: 'error',
        key: 'slt-update-check',
        title: "Couldn't check for updates",
        description: result.message,
        actions: [{ label: 'Try again', onClick: () => { runManualUpdateCheck(button); } }],
    });
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

type ActionableResult = Extract<UpdateCheckResult, { status: 'update' | 'hotfix' }>;

interface PlaybackInfo {
    uri: string;
    name: string;
    duration: number;
    progress: number;
    playing: boolean;
}

function playbackInfo(): PlaybackInfo | null {
    try {
        const player: any = Spicetify.Player;
        const item = player?.data?.item;
        if (!item?.uri) return null;
        const duration = Number(player.getDuration?.() ?? item.duration?.milliseconds ?? player.data?.duration ?? 0) || 0;
        return {
            uri: item.uri,
            name: item.name || 'this song',
            duration,
            progress: Number(player.getProgress?.() ?? 0) || 0,
            playing: !!player.isPlaying?.(),
        };
    } catch {
        return null;
    }
}

function canWaitForSong(): boolean {
    const info = playbackInfo();
    return !!info && info.playing && info.duration > 0 && info.duration - info.progress > 8000;
}

function formatClock(ms: number): string {
    const total = Math.max(0, Math.round(ms / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

let songWaiter: (() => void) | null = null;
let waitToast: ToastHandle | null = null;

function waitForSongEnd(onEnd: () => void, onTick: (info: PlaybackInfo) => void): () => void {
    const startUri = playbackInfo()?.uri;
    let done = false;
    const onSong = () => finish();
    const interval = window.setInterval(() => {
        const info = playbackInfo();
        if (!info) return;
        if (startUri && info.uri !== startUri) {
            finish();
            return;
        }
        onTick(info);
    }, 1000);
    const cleanup = () => {
        window.clearInterval(interval);
        try { Spicetify.Player.removeEventListener('songchange', onSong); } catch {}
    };
    const finish = () => {
        if (done) return;
        done = true;
        cleanup();
        onEnd();
    };
    try { Spicetify.Player.addEventListener('songchange', onSong); } catch {}
    const first = playbackInfo();
    if (first) onTick(first);
    return () => {
        if (done) return;
        done = true;
        cleanup();
    };
}

function cancelSongWait(): void {
    songWaiter?.();
    songWaiter = null;
    waitToast = null;
    dismissToast('slt-update-wait');
}

let waitingResult: ActionableResult | null = null;

function setWaiting(result: UpdateCheckResult | null): void {
    waitingResult = result && (result.status === 'update' || result.status === 'hotfix') ? result : null;
    try {
        document.body.classList.toggle('slt-update-waiting', !!waitingResult);
    } catch {}
    if (!waitingResult) removeInboxEntries(e => e.id === 'slt-update');
}

export function hasWaitingUpdate(): { kind: PromptKind; version: string } | null {
    return waitingResult ? { kind: waitingResult.status, version: waitingResult.remote.version.text } : null;
}

export function openWaitingUpdate(origin?: DOMRect | null): void {
    if (waitingResult) {
        openUpdateCard(waitingResult, origin);
        return;
    }
    checkForUpdates({ trigger: 'manual' }).catch(() => {});
}

registerInboxAction('open-update', () => openWaitingUpdate());

interface InstallUi {
    progress: (percent: number, label: string) => void;
    fail: (message: string) => void;
}

async function installUpdate(result: ActionableResult, ui: InstallUi, options: { resume?: boolean } = {}): Promise<void> {
    if (isInstalling) return;
    isInstalling = true;
    cancelSongWait();

    if (checkTimer !== null) {
        window.clearTimeout(checkTimer);
        checkTimer = null;
    }

    const step = async (percent: number, label: string, delayMs: number) => {
        ui.progress(percent, label);
        await wait(delayMs);
    };

    try {
        await step(18, 'Getting things ready…', 220);

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
            createdAt: Date.now(),
            resume: !!options.resume,
        };

        if (!storage.set(STORAGE_KEYS.pending, JSON.stringify(pending))) {
            throw new Error('Could not save update state');
        }
        clearSnooze();
        removeInboxEntries(e => e.id === 'slt-update');

        await step(70, result.status === 'hotfix' ? 'Patch ready' : `v${pending.version} ready`, 280);
        await step(100, 'Reloading Spotify…', 320);

        clearLoaderMetadata();
        window.location.reload();
    } catch (e) {
        logError('Update install failed:', e);
        storage.remove(STORAGE_KEYS.pending);
        isInstalling = false;
        ui.fail("The update couldn't be installed. Restart Spotify to try again.");
        if (schedulerStarted) scheduleNextCheck();
    }
}

function backgroundUi(): InstallUi {
    return {
        progress: () => {},
        fail: (message) => { toast({ kind: 'error', title: "Update didn't install", description: message }); },
    };
}

function versionLabels(result: ActionableResult): { from: string; to: string } {
    if (result.status === 'hotfix') {
        return {
            from: `v${result.current.text} · ${getContentHashShort() || 'current'}`,
            to: `v${result.remote.version.text} · ${result.hash.substring(0, 8)}`,
        };
    }
    return { from: `v${result.current.text}`, to: `v${result.remote.version.text}` };
}

function versionRow(from: string, to: string): HTMLElement {
    return el('div', { class: 'slt-upd-versions' },
        el('span', { class: 'slt-upd-chip', text: from }),
        el('span', { class: 'slt-upd-flow', 'aria-hidden': 'true' }),
        el('span', { class: 'slt-upd-chip slt-upd-chip-to', text: to }),
    );
}

function notesBlock(changelogHtml: string, expanded: boolean): { node: HTMLElement; content: HTMLElement; action: SurfaceAction } {
    const content = el('div', { class: 'slt-upd-notes-content', html: changelogHtml });
    const node = el('div', { class: 'slt-upd-notes' }, el('div', { class: 'slt-upd-notes-title', text: 'Changelog' }), content);
    node.hidden = !expanded;
    const action: SurfaceAction = {
        id: 'notes',
        label: expanded ? 'Hide changelog' : 'Show changelog',
        kind: 'quiet',
        keepOpen: true,
        onClick: (handle) => {
            const open = node.hidden;
            node.hidden = !open;
            const label = handle.footer.querySelector('[data-action="notes"] .slt-ui-btn-label');
            if (label) label.textContent = open ? 'Hide changelog' : 'Show changelog';
            handle.footer.querySelector('[data-action="notes"]')?.setAttribute('aria-expanded', String(open));
            if (open) {
                node.scrollTop = 0;
                if (!prefersReducedMotion()) {
                    node.animate([{ opacity: 0, transform: 'translateY(-4px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'ease-out' });
                }
            }
        },
    };
    return { node, content, action };
}

function progressRing(): { node: HTMLElement; set: (fraction: number) => void } {
    const node = el('span', { class: 'slt-upd-ring-wrap' });
    node.innerHTML = '<svg class="slt-ui-ring" viewBox="0 0 20 20" aria-hidden="true"><circle class="slt-ui-ring-track" cx="10" cy="10" r="7.5"/><circle class="slt-ui-ring-fill" cx="10" cy="10" r="7.5" stroke-dasharray="47.12" stroke-dashoffset="47.12"/></svg>';
    const fill = node.querySelector('.slt-ui-ring-fill') as SVGCircleElement;
    return {
        node,
        set: (fraction) => fill.setAttribute('stroke-dashoffset', String(47.12 * (1 - Math.min(1, Math.max(0, fraction))))),
    };
}

function presentPrompt(result: UpdateCheckResult, trigger: UpdateTrigger): void {
    if (result.status !== 'update' && result.status !== 'hotfix') return;
    setWaiting(result);
    const key = getPromptKey(result)!;
    if (activeCardKey === key && activeDock()) return;

    if (trigger === 'manual') {
        dismissToast('slt-update');
        openUpdateCard(result);
        return;
    }

    const isHotfix = result.status === 'hotfix';
    let opened = false;
    toast({
        kind: 'update',
        tone: isHotfix ? 'hotfix' : 'accent',
        key: 'slt-update',
        title: isHotfix ? `A patch for v${result.current.text} is ready` : `Spicy Lyric Translator v${result.remote.version.text} is out`,
        description: isHotfix ? 'Same version, a few fixes. It takes one quick reload.' : `You're on v${result.current.text}.`,
        duration: Infinity,
        inboxAction: { id: 'open-update', label: 'Open' },
        actions: [{
            label: 'Details',
            primary: true,
            onClick: (_event, handle) => {
                opened = true;
                const rect = handle.rect();
                handle.close('replace');
                openUpdateCard(result, rect);
            },
        }],
        onDismiss: () => {
            if (!opened) snooze(key);
        },
    });
}

let activeCardKey: string | null = null;

function openUpdateCard(result: ActionableResult, origin?: DOMRect | null): void {
    ensureUpdaterStyles();
    dismissToast('slt-update');
    const key = getPromptKey(result)!;
    const isHotfix = result.status === 'hotfix';
    const installable = isHotfix || result.installable;
    const labels = versionLabels(result);

    const lead = text(installable
        ? 'Installing reloads Spotify. Pick a moment that won’t cut off your music.'
        : 'This copy was installed by hand, so grab the new build from the release page.');
    const status = el('div', { class: 'slt-upd-status', hidden: true });
    const progress = el('div', { class: 'slt-upd-progress', hidden: true },
        el('div', { class: 'slt-upd-progress-bar' }, el('div', { class: 'slt-upd-progress-fill' })),
        el('div', { class: 'slt-upd-progress-text', text: 'Starting…' }),
    );
    const notes = notesBlock(result.remote.changelog
        ? formatReleaseNotes(result.remote.changelog)
        : '<span class="slt-upd-muted">Loading changelog…</span>', false);

    if (!result.remote.changelog) {
        fetchChangelogForVersion(result.remote.version.text).then(changelog => {
            result.remote.changelog = changelog;
            notes.content.innerHTML = formatReleaseNotes(changelog);
        }).catch(() => {});
    }

    const laterMenu: SurfaceAction = {
        id: 'later',
        label: 'Not now',
        kind: 'quiet',
        menu: [
            { label: 'Remind me in 4 hours', onClick: () => { snooze(key, 4 * 60 * 60 * 1000); card.close(); } },
            { label: 'Remind me tomorrow', onClick: () => { snooze(key, 24 * 60 * 60 * 1000); card.close(); } },
            {
                label: isHotfix ? 'Skip this patch' : 'Skip this version',
                hint: 'No reminders until the next release',
                onClick: () => {
                    storage.set(STORAGE_KEYS.skip, key);
                    setWaiting(null);
                    card.close();
                },
            },
        ],
    };

    const ui: InstallUi = {
        progress: (percent, label) => {
            status.hidden = true;
            lead.hidden = true;
            progress.hidden = false;
            (progress.querySelector('.slt-upd-progress-fill') as HTMLElement).style.width = `${percent}%`;
            (progress.querySelector('.slt-upd-progress-text') as HTMLElement).textContent = label;
            card.setBusy(true);
        },
        fail: (message) => {
            card.setBusy(false);
            progress.hidden = true;
            status.hidden = false;
            status.className = 'slt-upd-status slt-upd-status-error';
            status.textContent = message;
            card.setTone('error');
            card.setActions([
                { label: 'Close', kind: 'quiet' },
                { label: 'Reload now', kind: 'primary', keepOpen: true, onClick: () => window.location.reload() },
            ]);
        },
    };

    let waitLabel = 'After this song';

    const installNow = (resume = false) => {
        card.setActions([]);
        installUpdate(result, ui, { resume });
    };

    const startSongWait = () => {
        const ring = progressRing();
        const line = el('div', { class: 'slt-upd-status-text' });
        const sub = el('div', { class: 'slt-upd-status-sub' });
        status.className = 'slt-upd-status';
        status.replaceChildren(ring.node, el('div', { class: 'slt-upd-status-copy' }, line, sub));
        status.hidden = false;
        lead.hidden = true;
        cancelSongWait();
        songWaiter = waitForSongEnd(() => {
            songWaiter = null;
            waitToast = null;
            dismissToast('slt-update-wait');
            try { (Spicetify.Player as any).pause?.(); } catch {}
            if (!card.closed) {
                installNow(true);
                return;
            }
            installUpdate(result, backgroundUi(), { resume: true });
        }, (info) => {
            const left = Math.max(0, info.duration - info.progress);
            waitLabel = `After “${info.name}” · ${formatClock(left)} left`;
            line.textContent = `Updating when “${info.name}” ends`;
            sub.textContent = info.playing ? `${formatClock(left)} left` : `Paused · ${formatClock(left)} left`;
            ring.set(info.duration ? info.progress / info.duration : 0);
            waitToast?.update({ description: waitLabel });
        });
        card.setActions([
            { label: 'Cancel', kind: 'quiet', keepOpen: true, onClick: () => { cancelSongWait(); card.close(); openUpdateCard(result); } },
            { label: 'Reload now', kind: 'ghost', keepOpen: true, onClick: () => installNow(false) },
        ]);
        card.root.dataset.waiting = 'true';
    };

    const baseActions = (): SurfaceAction[] => {
        if (!installable) {
            return [
                notes.action,
                laterMenu,
                { label: 'Open release page', kind: 'primary', href: result.remote.releaseUrl, onClick: () => { snooze(key); } },
            ];
        }
        if (canWaitForSong()) {
            return [
                notes.action,
                laterMenu,
                { label: 'Reload now', kind: 'ghost', keepOpen: true, onClick: () => installNow(false) },
                { label: 'Update after this song', kind: 'primary', keepOpen: true, onClick: startSongWait },
            ];
        }
        return [
            notes.action,
            laterMenu,
            { label: isHotfix ? 'Apply and reload' : 'Update and reload', kind: 'primary', keepOpen: true, onClick: () => installNow(false) },
        ];
    };

    const card = openDock({
        tone: isHotfix ? 'hotfix' : 'accent',
        eyebrow: isHotfix ? 'Spicy Lyric Translator · Patch' : 'Spicy Lyric Translator · Update',
        title: isHotfix ? `A patch for v${result.current.text}` : `v${result.remote.version.text} is ready`,
        body: [versionRow(labels.from, labels.to), lead, status, progress, notes.node],
        actions: baseActions(),
        origin,
        onDismiss: () => {
            if (songWaiter) {
                waitToast = toast({
                    kind: 'update',
                    tone: isHotfix ? 'hotfix' : 'accent',
                    key: 'slt-update-wait',
                    title: 'Update queued',
                    description: waitLabel,
                    duration: Infinity,
                    inbox: false,
                    actions: [
                        { label: 'Reload now', primary: true, onClick: () => installUpdate(result, backgroundUi(), { resume: false }) },
                        { label: 'Cancel', onClick: () => cancelSongWait() },
                    ],
                    onDismiss: () => cancelSongWait(),
                });
                return;
            }
            snooze(key);
        },
        onClose: () => {
            if (activeCardKey === key) activeCardKey = null;
        },
    });
    activeCardKey = key;
}

function resumeAfterReload(): Promise<boolean> {
    return new Promise(resolve => {
        const started = Date.now();
        const attempt = () => {
            try {
                const player: any = Spicetify?.Player;
                if (player?.data?.item) {
                    if (!player.isPlaying?.()) player.play?.();
                    resolve(true);
                    return;
                }
            } catch {}
            if (Date.now() - started > 12000) {
                resolve(false);
                return;
            }
            window.setTimeout(attempt, 400);
        };
        attempt();
    });
}

export async function showPostUpdateChangelog(): Promise<void> {
    const pending = readPending();
    const lastKnownVersion = storage.get(STORAGE_KEYS.lastVersion);
    const lastKnownHash = storage.get(STORAGE_KEYS.lastHash);
    const legacyHotfix = storage.get('hotfix-detected') === 'true';

    storage.remove(STORAGE_KEYS.pending);
    for (const key of LEGACY_STORAGE_KEYS) storage.remove(key);
    storage.set(STORAGE_KEYS.lastVersion, CURRENT_VERSION);
    if (LOADED_HASH) storage.set(STORAGE_KEYS.lastHash, LOADED_HASH);

    const current = getCurrentVersion();
    let applied: { kind: PromptKind; version: string; from: string; changelog: string; exactChangelogOnly: boolean; resume: boolean } | null = null;

    if (pending && Date.now() - pending.createdAt < PENDING_TTL_MS) {
        const target = parseVersion(pending.version);
        const versionDelta = target ? compareVersions(current, target) : -1;
        const reached = pending.kind === 'hotfix'
            ? versionDelta > 0 || (versionDelta === 0 && !!LOADED_HASH && LOADED_HASH !== pending.fromHash)
            : versionDelta >= 0;

        if (!reached) {
            await wait(APPLIED_MODAL_DELAY_MS);
            toast({
                kind: 'warning',
                title: 'The update is downloaded, not applied yet',
                description: 'Restart Spotify to finish updating.',
                actions: [{ label: 'Reload', primary: true, onClick: () => window.location.reload() }],
            });
            return;
        }

        applied = {
            kind: versionDelta > 0 ? 'update' : pending.kind,
            version: CURRENT_VERSION,
            from: pending.fromVersion,
            changelog: versionDelta > 0 ? '' : pending.changelog,
            exactChangelogOnly: false,
            resume: !!pending.resume,
        };
    } else if (lastKnownVersion) {
        const last = parseVersion(lastKnownVersion);
        if (last && compareVersions(current, last) > 0) {
            applied = { kind: 'update', version: CURRENT_VERSION, from: last.text, changelog: '', exactChangelogOnly: !IS_LOADER_MODE, resume: false };
        } else if (IS_LOADER_MODE && lastKnownVersion === CURRENT_VERSION && LOADED_HASH && ((lastKnownHash && lastKnownHash !== LOADED_HASH) || legacyHotfix)) {
            applied = { kind: 'hotfix', version: CURRENT_VERSION, from: CURRENT_VERSION, changelog: '', exactChangelogOnly: false, resume: false };
        }
    }

    if (!applied) return;

    const resumed = applied.resume ? resumeAfterReload() : Promise.resolve(false);

    let changelog = applied.changelog;
    if (!changelog) {
        changelog = await fetchChangelogForVersion(applied.version, !applied.exactChangelogOnly);
        if (!changelog && applied.exactChangelogOnly) return;
    }

    await wait(APPLIED_MODAL_DELAY_MS);
    const didResume = await resumed;

    if (applied.kind === 'hotfix') {
        const hash = getContentHashShort();
        const version = applied.version;
        toast({
            kind: 'success',
            title: `Patched v${version}`,
            description: `${hash ? `Build ${hash}. ` : ''}${didResume ? 'Your music picked up where it left off.' : 'Everything is up to date.'}`,
            duration: 9000,
            inbox: true,
            actions: [{ label: 'What changed', onClick: () => openWhatsNew({ mode: 'applied', version, changelog, kind: 'hotfix', expanded: true }) }],
        });
        return;
    }

    openWhatsNew({ mode: 'applied', version: applied.version, from: applied.from, changelog, kind: 'update', resumed: didResume });
}

export async function showCurrentChangelog(options: { expanded?: boolean } = {}): Promise<void> {
    const changelog = await fetchChangelogForVersion(CURRENT_VERSION);
    openWhatsNew({ mode: 'current', version: CURRENT_VERSION, changelog, kind: 'update', expanded: options.expanded });
}

export interface SettingLinker {
    match: (text: string) => { id: string; label: string } | null;
    byId: (id: string) => { id: string; label: string } | null;
    reveal: (id: string) => void;
}

let settingLinker: SettingLinker | null = null;

export function registerSettingLinker(linker: SettingLinker): void {
    settingLinker = linker;
}

interface Highlight {
    html: string;
    setting: { id: string; label: string } | null;
}

function extractHighlights(body: string): Highlight[] {
    const out: Highlight[] = [];
    for (const raw of (body || '').split('\n')) {
        const m = raw.replace(/\r$/, '').match(/^[-*+]\s+(.*\S)/);
        if (!m) continue;
        let line = m[1];
        let setting: Highlight['setting'] = null;
        const tag = line.match(/\[setting:([A-Za-z0-9_]+)\]/);
        if (tag) {
            line = line.replace(tag[0], '').trim();
            const found = settingLinker?.byId(tag[1]);
            setting = found || null;
        }
        if (!setting) setting = settingLinker?.match(line.replace(/[*_`~]/g, '')) || null;
        if (!line) continue;
        out.push({ html: processInlineMarkdown(escapeHtml(line)), setting });
        if (out.length >= 3) break;
    }
    return out;
}

function openWhatsNew(options: {
    mode: 'applied' | 'current';
    version: string;
    from?: string;
    changelog: string;
    kind: PromptKind;
    resumed?: boolean;
    expanded?: boolean;
}): void {
    ensureUpdaterStyles();
    const hashShort = getDisplayHash().hash.substring(0, 8);
    const highlights = extractHighlights(options.changelog);
    const notes = notesBlock(formatReleaseNotes(options.changelog), !!options.expanded);

    const meta = el('div', { class: 'slt-upd-meta' },
        el('span', { class: 'slt-upd-chip slt-upd-chip-to', text: `v${options.version}` }),
        hashShort ? el('span', { class: 'slt-upd-chip', text: hashShort, title: getDisplayHash().hash }) : null,
    );

    const intro = options.mode === 'applied'
        ? text(`${options.from && options.from !== options.version ? `Updated from v${options.from}. ` : ''}${options.resumed ? 'Your music picked up where it left off.' : 'Here are the highlights.'}`)
        : text('The highlights from the version you’re running.');

    const body: HTMLElement[] = [meta, intro];

    let dialog: SurfaceHandle | null = null;
    if (highlights.length) {
        const list = el('ol', { class: 'slt-upd-hl-list' });
        highlights.forEach((h, i) => {
            const item = el('li', { class: 'slt-upd-hl' },
                el('span', { class: 'slt-upd-hl-dot', text: String(i + 1), 'aria-hidden': 'true' }),
                el('div', { class: 'slt-upd-hl-text', html: h.html }),
            );
            if (h.setting && settingLinker) {
                const setting = h.setting;
                const btn = el('button', { class: 'slt-upd-hl-try', type: 'button', text: 'Try it', title: `Open “${setting.label}” in settings` });
                btn.addEventListener('click', () => {
                    dialog?.close();
                    settingLinker?.reveal(setting.id);
                });
                item.append(btn);
            }
            list.append(item);
        });
        body.push(list);
    }
    body.push(notes.node);

    dialog = openDialog({
        eyebrow: options.mode === 'applied' ? 'Spicy Lyric Translator · Updated' : 'Spicy Lyric Translator',
        title: options.mode === 'applied'
            ? (options.kind === 'hotfix' ? `Patched v${options.version}` : `You’re on v${options.version}`)
            : `What’s new in v${options.version}`,
        tone: options.kind === 'hotfix' ? 'hotfix' : 'accent',
        size: 'md',
        body,
        actions: [
            notes.action,
            { label: 'Release page', kind: 'quiet', href: `${RELEASES_URL}/tag/v${encodeURIComponent(options.version)}`, keepOpen: true },
            { label: 'Done', kind: 'primary' },
        ],
    });
}

function ensureUpdaterStyles(): void {
    if (document.getElementById('slt-upd-styles')) return;
    const style = document.createElement('style');
    style.id = 'slt-upd-styles';
    style.textContent = UPDATER_STYLES;
    document.head.appendChild(style);
}

const UPDATER_STYLES = `
.slt-upd-versions, .slt-upd-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}
.slt-upd-chip {
    display: inline-flex;
    align-items: center;
    padding: 5px 10px;
    border-radius: 9px;
    border: 1px solid var(--slt-ui-line);
    background: color-mix(in oklab, var(--slt-ui-ink) 5%, transparent);
    font-family: 'JetBrains Mono', ui-monospace, Consolas, monospace;
    font-size: 12px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--slt-ui-ink-muted);
    white-space: nowrap;
}
.slt-upd-chip-to {
    color: var(--slt-ui-ink);
}
.slt-upd-flow {
    position: relative;
    flex: 1 1 24px;
    min-width: 24px;
    max-width: 80px;
    height: 2px;
    border-radius: 2px;
    background: var(--slt-ui-line);
    overflow: hidden;
}
.slt-upd-flow::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, var(--slt-ui-accent), transparent);
    transform: translateX(-100%);
    animation: slt-upd-flow 1.9s ease-in-out infinite;
}
@keyframes slt-upd-flow { to { transform: translateX(100%); } }
.slt-upd-status {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 12px;
    background: color-mix(in oklab, var(--slt-ui-ink) 5%, transparent);
    border: 1px solid var(--slt-ui-line);
}
.slt-upd-status[hidden], .slt-upd-progress[hidden], .slt-upd-notes[hidden], .slt-ui-text[hidden] { display: none; }
.slt-upd-status-error {
    display: block;
    font-size: 13px;
    color: var(--slt-ui-ink);
    border-color: var(--slt-ui-accent-line);
    background: var(--slt-ui-accent-soft);
}
.slt-upd-status-copy { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.slt-upd-status-text { font-weight: 650; font-size: 13.5px; overflow-wrap: anywhere; }
.slt-upd-status-sub { font-size: 12px; color: var(--slt-ui-ink-faint); font-variant-numeric: tabular-nums; }
.slt-upd-ring-wrap { display: inline-flex; flex: 0 0 auto; }
.slt-upd-ring-wrap .slt-ui-ring { width: 22px; height: 22px; }
.slt-upd-progress { display: flex; flex-direction: column; gap: 8px; }
.slt-upd-progress-bar {
    height: 6px;
    border-radius: 6px;
    background: var(--slt-ui-line);
    overflow: hidden;
}
.slt-upd-progress-fill {
    width: 0;
    height: 100%;
    border-radius: 6px;
    background: var(--slt-ui-accent);
    transition: width 0.45s var(--slt-ui-ease);
}
.slt-upd-progress-text { font-size: 12.5px; color: var(--slt-ui-ink-muted); }
.slt-upd-notes {
    max-height: 260px;
    overflow-y: auto;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid var(--slt-ui-line);
    background: color-mix(in oklab, var(--slt-ui-field-deep) 70%, transparent);
    font-size: 13px;
    line-height: 1.55;
    color: var(--slt-ui-ink-muted);
}
.slt-upd-notes { scrollbar-width: thin; scrollbar-color: var(--slt-ui-line) transparent; }
.slt-upd-notes::-webkit-scrollbar { width: 5px; }
.slt-upd-notes::-webkit-scrollbar-button { display: none; }
.slt-upd-notes::-webkit-scrollbar-thumb { background: var(--slt-ui-line); border-radius: 5px; }
.slt-upd-notes-title {
    margin-bottom: 6px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--slt-ui-ink-faint);
}
.slt-upd-notes-content strong { color: var(--slt-ui-ink); }
.slt-upd-notes-content del { opacity: 0.5; }
.slt-upd-muted { color: var(--slt-ui-ink-faint); }
.slt-upd-hl-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
}
.slt-upd-hl {
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr) auto;
    align-items: baseline;
    gap: 10px;
    padding: 10px 0;
}
.slt-upd-hl + .slt-upd-hl { border-top: 1px solid var(--slt-ui-line); }
.slt-upd-hl-dot {
    color: var(--slt-ui-ink-faint);
    font-size: 12.5px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
}
.slt-upd-hl-text { font-size: 13.5px; line-height: 1.45; color: var(--slt-ui-ink); overflow-wrap: anywhere; }
.slt-upd-hl-text a { color: var(--slt-ui-ink); }
.slt-upd-hl-try {
    appearance: none;
    align-self: center;
    border: 1px solid var(--slt-ui-line);
    border-radius: 9px;
    padding: 5px 10px;
    background: transparent;
    color: var(--slt-ui-ink);
    font: inherit;
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
    cursor: pointer;
    transition: background-color 0.15s ease;
}
.slt-upd-hl-try:hover { background: var(--slt-ui-line); }
.slt-upd-hl-try:focus-visible { outline: 2px solid var(--slt-ui-accent); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
    .slt-upd-flow::after { animation: none; }
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
            return safe ? `<a href="${safe}" style="color: var(--slt-ui-accent); text-decoration: none;" target="_blank" rel="noopener noreferrer">${label}</a>` : label;
        })
        .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/(?<![*\w])\*([^*]+?)\*(?![*\w])/g, '<em>$1</em>')
        .replace(/~~(.*?)~~/g, '<del>$1</del>')
        .replace(/`([^`]+)`/g, '<code style="background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 3px; font-size: 12px; color: var(--slt-ui-accent);">$1</code>');
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
                output.push(`<pre style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 6px; overflow-x: auto; font-family: 'Fira Code','Consolas',monospace; font-size: 12px; color: var(--slt-ui-ink-muted); margin: 8px 0; white-space: pre-wrap; word-break: break-word;"><code>${codeContent.join('\n')}</code></pre>`);
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
        if (h3) { closeLists(); output.push(`<div style="font-weight: 600; margin-top: 12px; margin-bottom: 6px; color: var(--slt-ui-ink);">${processInlineMarkdown(h3[1])}</div>`); continue; }

        const h2 = line.match(/^##\s+(.*)/);
        if (h2) { closeLists(); output.push(`<div style="font-weight: 600; font-size: 14px; margin-top: 14px; margin-bottom: 8px; color: var(--slt-ui-ink);">${processInlineMarkdown(h2[1])}</div>`); continue; }

        const h1 = line.match(/^#\s+(.*)/);
        if (h1) { closeLists(); output.push(`<div style="font-weight: 700; font-size: 15px; margin-top: 16px; margin-bottom: 10px; color: var(--slt-ui-ink);">${processInlineMarkdown(h1[1])}</div>`); continue; }

        if (line.match(/^(---+|===+|\*\*\*+)\s*$/)) {
            closeLists();
            output.push('<hr style="border: none; border-top: 1px solid var(--slt-ui-line); margin: 12px 0;">');
            continue;
        }

        const bq = line.match(/^>\s?(.*)/);
        if (bq) { closeLists(); output.push(`<div style="border-left: 3px solid var(--slt-ui-accent); padding-left: 12px; margin: 6px 0; color: var(--slt-ui-ink-muted); font-style: italic;">${processInlineMarkdown(bq[1])}</div>`); continue; }

        const ul = line.match(/^([ \t]*)[-*+]\s+(.*)/);
        if (ul) {
            if (inOl) { output.push('</ol>'); inOl = false; }
            if (!inUl) { output.push('<ul style="margin: 4px 0; padding-left: 0; list-style: none;">'); inUl = true; }
            const depth = Math.min(Math.floor(ul[1].replace(/\t/g, '  ').length / 2), 5);
            const markers = ['•', '◦', '▪', '‣', '·', '•'];
            output.push(`<li style="display: flex; gap: 8px; margin: 3px 0; margin-left: ${depth * 18}px;"><span style="color: var(--slt-ui-accent); flex-shrink: 0;">${markers[depth] || '•'}</span><span>${processInlineMarkdown(ul[2])}</span></li>`);
            continue;
        }

        const ol = line.match(/^([ \t]*)(\d+)[.)]\s+(.*)/);
        if (ol) {
            if (inUl) { output.push('</ul>'); inUl = false; }
            if (!inOl) { output.push('<ol style="margin: 4px 0; padding-left: 0; list-style: none;">'); inOl = true; }
            const depth = Math.min(Math.floor(ol[1].replace(/\t/g, '  ').length / 2), 5);
            output.push(`<li style="display: flex; gap: 8px; margin: 3px 0; margin-left: ${depth * 18}px;"><span style="color: var(--slt-ui-accent); flex-shrink: 0; min-width: 16px; font-weight: 600;">${ol[2]}.</span><span>${processInlineMarkdown(ol[3])}</span></li>`);
            continue;
        }

        closeLists();
        output.push(`<p style="margin: 4px 0; color: var(--slt-ui-ink-muted);">${processInlineMarkdown(line)}</p>`);
    }

    closeLists();
    if (inCodeBlock) {
        output.push(`<pre style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 12px; color: var(--slt-ui-ink-muted); margin: 8px 0;"><code>${codeContent.join('\n')}</code></pre>`);
    }

    return output.join('');
}

export const VERSION = CURRENT_VERSION;
export const REPO_URL = RELEASES_URL;
