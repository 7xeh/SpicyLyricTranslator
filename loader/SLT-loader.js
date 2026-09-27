(async function() {
    const API_HOST = "7xeh.dev";
    const EXTENSION_BASE_URL = "https://7xeh.dev/apps/spicylyrictranslate/releases";
    const VERSION_API_URL = `https://${API_HOST}/apps/spicylyrictranslate/api/version.php`;
    const GITHUB_REPO = '7xeh/SpicyLyricTranslator';
    const GITHUB_LATEST_RELEASE_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
    const ISSUES_URL = 'https://github.com/7xeh/SpicyLyricTranslate/issues';
    const BUNDLE_NAME = 'spicy-lyric-translater.js';
    const ALLOWED_DOWNLOAD_HOSTS = [API_HOST, 'github.com', 'objects.githubusercontent.com', 'release-assets.githubusercontent.com'];
    const STORAGE_PREFIX = 'spicy-lyric-translater:';
    const DEBUG_MODE = localStorage.getItem(STORAGE_PREFIX + 'debug-mode') === 'true';

    const TAG = '%c[SLT-Loader]';
    const TAG_STYLE = 'color: #FF69B4; font-weight: bold;';

    const log = {
        debug: (...args) => DEBUG_MODE && console.log(TAG, TAG_STYLE, ...args),
        info: (...args) => console.log(TAG, TAG_STYLE, ...args),
        warn: (...args) => console.warn(TAG, TAG_STYLE, ...args),
        error: (...args) => console.error(TAG, TAG_STYLE, ...args)
    };

    const storageGet = (key) => localStorage.getItem(STORAGE_PREFIX + key);
    const storageSet = (key, val) => localStorage.setItem(STORAGE_PREFIX + key, val);
    const appendCacheBust = (url) => `${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}`;

    const normalizeVersion = (value) => String(value || '').trim().replace(/^v/i, '');
    const isValidVersion = (value) => /^\d+\.\d+\.\d+$/.test(value);
    const normalizeHash = (value) => {
        const hash = String(value || '').trim().replace(/^sha256:/i, '').toLowerCase();
        return /^[0-9a-f]{64}$/.test(hash) ? hash : null;
    };

    const trustedDownloadUrl = (value) => {
        if (!value) return '';
        try {
            const parsed = new URL(value, `https://${API_HOST}`);
            if (parsed.protocol !== 'https:' || !ALLOWED_DOWNLOAD_HOSTS.includes(parsed.host)) {
                log.warn('Ignoring download URL on an untrusted host:', parsed.host);
                return '';
            }
            return parsed.href;
        } catch {
            return '';
        }
    };

    const computeSHA256 = async (text) => {
        try {
            const data = new TextEncoder().encode(text);
            const buffer = await crypto.subtle.digest('SHA-256', data);
            return Array.from(new Uint8Array(buffer))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
        } catch (e) {
            log.warn('SHA-256 computation unavailable:', e);
            return null;
        }
    };

    const waitForSpicetify = () => {
        return new Promise((resolve, reject) => {
            const check = () => {
                if (
                    typeof Spicetify !== 'undefined' &&
                    Spicetify.Platform &&
                    Spicetify.Player
                ) {
                    log.debug('Spicetify is ready');
                    resolve();
                    return true;
                }
                return false;
            };

            if (check()) return;

            const interval = setInterval(() => {
                if (check()) clearInterval(interval);
            }, 100);

            setTimeout(() => {
                clearInterval(interval);
                reject(new Error('Spicetify not found or not ready after 30 seconds'));
            }, 30000);
        });
    };

    const getVersionInfoFromPrimaryApi = async () => {
        const response = await fetch(appendCacheBust(`${VERSION_API_URL}?action=version`));
        if (!response.ok) throw new Error(`Primary API status ${response.status}`);
        const data = await response.json();
        const version = normalizeVersion(data.version);
        if (!isValidVersion(version)) throw new Error('Primary API did not return a valid version');

        return {
            version,
            hash: normalizeHash(data.hash || data.sha256 || data.checksum),
            downloadUrl: trustedDownloadUrl(data.download_url)
        };
    };

    const getVersionInfoFromGitHub = async () => {
        const response = await fetch(appendCacheBust(GITHUB_LATEST_RELEASE_API), {
            headers: { 'Accept': 'application/vnd.github.v3+json' }
        });
        if (!response.ok) throw new Error(`GitHub API status ${response.status}`);

        const release = await response.json();
        const version = normalizeVersion(release.tag_name);
        if (!isValidVersion(version)) throw new Error('GitHub API did not return a valid release tag');

        const jsAsset = Array.isArray(release.assets)
            ? release.assets.find(asset => typeof asset?.name === 'string' && asset.name.endsWith('.js'))
            : null;

        return {
            version,
            hash: normalizeHash(jsAsset?.digest),
            downloadUrl: trustedDownloadUrl(jsAsset?.browser_download_url)
        };
    };

    const getVersionInfo = async () => {
        try {
            return await getVersionInfoFromPrimaryApi();
        } catch (primaryError) {
            log.warn('Primary version API unavailable, falling back to GitHub:', primaryError);
            return await getVersionInfoFromGitHub();
        }
    };

    const loadExtension = async (version, preferredDownloadUrl = '', expectedHash = null) => {
        const candidates = [
            preferredDownloadUrl,
            `${EXTENSION_BASE_URL}/versions/v${version}/${BUNDLE_NAME}`,
            `${EXTENSION_BASE_URL}/latest/${BUNDLE_NAME}`,
        ].filter(Boolean);

        let response = null;
        let resolvedUrl = '';
        let lastFetchError = null;

        for (const baseUrl of [...new Set(candidates)]) {
            try {
                const currentResponse = await fetch(appendCacheBust(baseUrl));
                if (!currentResponse.ok) {
                    throw new Error(`HTTP ${currentResponse.status}`);
                }
                response = currentResponse;
                resolvedUrl = baseUrl;
                break;
            } catch (e) {
                lastFetchError = e;
                log.debug(`Failed loader source ${baseUrl}:`, e);
            }
        }

        if (!response) {
            throw new Error(`Failed to load extension from all sources: ${lastFetchError?.message || 'Unknown error'}`);
        }

        log.debug('Extension loaded from source:', resolvedUrl);

        const code = await response.text();
        const contentHash = await computeSHA256(code);

        if (expectedHash && contentHash && expectedHash !== contentHash) {
            throw new Error(`Integrity check failed: expected ${expectedHash.substring(0, 12)}, got ${contentHash.substring(0, 12)}`);
        }

        const previousHash = storageGet('content-hash');
        const previousVersion = storageGet('loaded-version');
        const isHotfix = !!(contentHash && previousVersion === version && previousHash && previousHash !== contentHash);

        if (contentHash) storageSet('content-hash', contentHash);
        storageSet('loaded-version', version);

        const metadata = {
            LoadedVersion: version,
            LoadedAt: Date.now(),
            IsLoader: true,
            ContentHash: contentHash,
            IsHotfix: isHotfix,
            utils: {
                log
            }
        };

        window._spicy_lyric_translater_metadata = metadata;
        window._spicy_lyric_translator_metadata = metadata;

        const script = document.createElement('script');
        script.textContent = code;
        document.head.appendChild(script);
        script.remove();

        const hashTag = contentHash ? ` [${contentHash.substring(0, 12)}]` : '';
        if (isHotfix) {
            log.info(`Hotfix loaded for v${version}${hashTag}`);
        } else {
            log.info(`Loaded v${version}${hashTag}`);
        }
    };

    const LOADER_STYLE_ID = 'slt-ld-styles';
    const LOADER_CSS = `
.slt-ld-overlay {
    --slt-ld-accent: oklch(0.93 0 0);
    --slt-ld-accent-ink: #1b1b1b;
    --slt-ld-field: #1b1b1b;
    --slt-ld-deep: #151515;
    --slt-ld-ink: oklch(0.97 0 0);
    --slt-ld-muted: oklch(0.78 0 0);
    --slt-ld-faint: oklch(0.62 0 0);
    --slt-ld-line: rgba(255, 255, 255, 0.09);
    position: fixed;
    inset: 0;
    z-index: 2147482000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    box-sizing: border-box;
    background: rgba(0, 0, 0, 0);
    font-family: var(--encore-body-font-stack, var(--fallback-fonts, system-ui, sans-serif));
    -webkit-font-smoothing: antialiased;
    color: var(--slt-ld-ink);
    transition: background-color 0.24s ease, backdrop-filter 0.24s ease;
}
.slt-ld-overlay.slt-ld-open { background: rgba(0, 0, 0, 0.55); backdrop-filter: blur(6px); }
.slt-ld-overlay.slt-ld-closing { pointer-events: none; background: rgba(0, 0, 0, 0); backdrop-filter: blur(0); }
.slt-ld-panel {
    position: relative;
    width: min(28rem, 100%);
    box-sizing: border-box;
    overflow: hidden;
    padding: 26px 26px 22px;
    border-radius: 18px;
    border: 1px solid var(--slt-ld-line);
    background: linear-gradient(180deg, var(--slt-ld-field), var(--slt-ld-deep));
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 24px 60px -24px rgba(0, 0, 0, 0.7);
    opacity: 0;
    transform: translateY(10px);
    transition: opacity 0.2s ease, transform 0.4s cubic-bezier(0.2, 0.9, 0.1, 1);
}
.slt-ld-open .slt-ld-panel { opacity: 1; transform: none; }
.slt-ld-closing .slt-ld-panel { opacity: 0; transform: translateY(4px) scale(0.985); transition-duration: 0.16s; }
.slt-ld-eyebrow { font-size: 12px; font-weight: 600; color: var(--slt-ld-muted); margin: 0 0 8px; }
.slt-ld-title { margin: 0 0 10px; font-size: 22px; font-weight: 750; letter-spacing: -0.02em; line-height: 1.15; }
.slt-ld-text { margin: 0 0 12px; font-size: 14px; line-height: 1.55; color: var(--slt-ld-muted); }
.slt-ld-text a { color: var(--slt-ld-ink); font-weight: 600; text-underline-offset: 3px; }
.slt-ld-detail {
    margin: 0 0 14px;
    padding: 10px 12px;
    border-radius: 11px;
    border: 1px solid var(--slt-ld-line);
    background: #111;
    font-family: 'JetBrains Mono', ui-monospace, Consolas, monospace;
    font-size: 12px;
    color: var(--slt-ld-muted);
    overflow-wrap: anywhere;
}
.slt-ld-status { display: flex; align-items: center; gap: 10px; font-size: 12.5px; color: var(--slt-ld-faint); font-variant-numeric: tabular-nums; }
.slt-ld-status[hidden] { display: none; }
.slt-ld-ring { width: 18px; height: 18px; transform: rotate(-90deg); flex: 0 0 auto; }
.slt-ld-ring circle { fill: none; stroke-width: 2.4; }
.slt-ld-ring-track { stroke: var(--slt-ld-line); }
.slt-ld-ring-fill { stroke: var(--slt-ld-accent); stroke-linecap: round; transition: stroke-dashoffset 0.95s linear; }
.slt-ld-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
.slt-ld-btn {
    appearance: none;
    min-height: 40px;
    padding: 0 18px;
    border: 0;
    border-radius: 12px;
    font: inherit;
    font-size: 13.5px;
    font-weight: 700;
    cursor: pointer;
    transition: background-color 0.15s ease, transform 0.12s ease;
}
.slt-ld-btn:active { transform: scale(0.97); }
.slt-ld-btn:disabled { opacity: 0.6; cursor: default; }
.slt-ld-btn:focus-visible { outline: 2px solid var(--slt-ld-accent); outline-offset: 2px; }
.slt-ld-primary { background: var(--slt-ld-accent); color: var(--slt-ld-accent-ink); }
.slt-ld-quiet { background: transparent; color: var(--slt-ld-muted); }
.slt-ld-quiet:hover { background: var(--slt-ld-line); color: var(--slt-ld-ink); }
.slt-ld-toast {
    position: fixed;
    left: 16px;
    bottom: 110px;
    z-index: 2147482500;
    padding: 12px 16px;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.09);
    background: linear-gradient(170deg, oklch(0.29 0.05 152), oklch(0.235 0.045 152));
    color: oklch(0.965 0.012 152);
    font-family: var(--encore-body-font-stack, system-ui, sans-serif);
    font-size: 13.5px;
    font-weight: 650;
    box-shadow: 0 16px 36px -14px rgba(0, 0, 0, 0.75);
    transition: opacity 0.3s ease, transform 0.3s ease;
}
@media (prefers-reduced-motion: reduce) {
    .slt-ld-overlay, .slt-ld-panel, .slt-ld-ring-fill { transition-duration: 0.01ms !important; }
    .slt-ld-panel { transform: none !important; }
}`;

    const ensureLoaderStyles = () => {
        if (document.getElementById(LOADER_STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = LOADER_STYLE_ID;
        style.textContent = LOADER_CSS;
        document.head.appendChild(style);
    };

    const h = (tag, props = {}, ...children) => {
        const node = document.createElement(tag);
        Object.entries(props).forEach(([key, value]) => {
            if (value === undefined || value === false) return;
            if (key === 'class') node.className = value;
            else if (key === 'text') node.textContent = value;
            else node.setAttribute(key, value === true ? '' : String(value));
        });
        children.forEach(child => child && node.append(child));
        return node;
    };

    const formatWait = (ms) => {
        const total = Math.max(0, Math.ceil(ms / 1000));
        return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
    };

    const showRecovered = () => {
        ensureLoaderStyles();
        const toast = h('div', { class: 'slt-ld-toast', role: 'status', text: 'Spicy Lyric Translator is back' });
        document.body.append(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-12px)';
            setTimeout(() => toast.remove(), 320);
        }, 3200);
    };

    let activeError = null;

    const showError = (message, retry = null) => {
        activeError?.close(true);
        const mount = () => {
            if (!document.body) {
                setTimeout(mount, 100);
                return;
            }
            ensureLoaderStyles();

            let retryDelay = 30000;
            let nextAt = 0;
            let timer = 0;
            let ticker = 0;
            let busy = false;
            let closed = false;

            const detail = h('p', { class: 'slt-ld-detail', text: String(message || 'Unknown error') });
            const ringFill = h('span');
            ringFill.innerHTML = '<svg class="slt-ld-ring" viewBox="0 0 20 20" aria-hidden="true"><circle class="slt-ld-ring-track" cx="10" cy="10" r="7.5"/><circle class="slt-ld-ring-fill" cx="10" cy="10" r="7.5" stroke-dasharray="47.12" stroke-dashoffset="0"/></svg>';
            const statusText = h('span');
            const status = h('div', { class: 'slt-ld-status', 'aria-live': 'polite', hidden: !retry }, ringFill, statusText);
            const help = h('p', { class: 'slt-ld-text' });
            help.append('Still stuck? Ask on ');
            help.append(h('a', { href: ISSUES_URL, target: '_blank', rel: 'noopener noreferrer', text: 'GitHub Issues' }));
            help.append('.');

            const tryBtn = h('button', { class: 'slt-ld-btn slt-ld-primary', type: 'button', text: 'Try again' });
            const closeBtn = h('button', { class: 'slt-ld-btn slt-ld-quiet', type: 'button', text: retry ? 'Keep trying in background' : 'Close' });
            const panel = h('section', { class: 'slt-ld-panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'slt-ld-title' },
                h('p', { class: 'slt-ld-eyebrow', text: 'Spicy Lyric Translator' }),
                h('h2', { class: 'slt-ld-title', id: 'slt-ld-title', text: "Spicy Lyric Translator couldn't load" }),
                h('p', { class: 'slt-ld-text', text: retry
                    ? "Your lyrics still work, they just won't be translated until this loads. Check your connection, a VPN or an ad blocker."
                    : 'Fully quit Spotify and open it again. That usually fixes this.' }),
                detail,
                status,
                help,
                h('div', { class: 'slt-ld-actions' }, closeBtn, retry ? tryBtn : null),
            );
            const overlay = h('div', { class: 'slt-ld-overlay' }, panel);

            const fill = ringFill.querySelector('.slt-ld-ring-fill');
            const paint = () => {
                if (busy) {
                    statusText.textContent = 'Trying now…';
                    fill.setAttribute('stroke-dashoffset', '0');
                    return;
                }
                const left = nextAt - Date.now();
                statusText.textContent = `Trying again in ${formatWait(left)}`;
                fill.setAttribute('stroke-dashoffset', String(47.12 * (1 - Math.max(0, Math.min(1, left / retryDelay)))));
            };

            const schedule = () => {
                if (!retry || closed === 'done') return;
                clearTimeout(timer);
                nextAt = Date.now() + retryDelay;
                timer = setTimeout(attempt, retryDelay);
                paint();
            };

            const attempt = async () => {
                if (!retry || busy) return;
                busy = true;
                tryBtn.disabled = true;
                tryBtn.textContent = 'Connecting…';
                paint();
                clearTimeout(timer);
                const result = await retry();
                busy = false;
                tryBtn.disabled = false;
                tryBtn.textContent = 'Try again';
                if (result && result.ok) {
                    finish();
                    showRecovered();
                    return;
                }
                if (result && result.message) detail.textContent = result.message;
                retryDelay = Math.min(5 * 60 * 1000, Math.round(retryDelay * 1.6));
                schedule();
            };

            const onKey = (event) => {
                if (event.key !== 'Escape' || closed) return;
                event.preventDefault();
                event.stopImmediatePropagation();
                hide();
            };

            const removeOverlay = (immediate) => {
                document.removeEventListener('keydown', onKey, true);
                if (immediate) {
                    overlay.remove();
                    return;
                }
                overlay.classList.remove('slt-ld-open');
                overlay.classList.add('slt-ld-closing');
                setTimeout(() => overlay.remove(), 220);
            };

            const hide = () => {
                if (closed) return;
                closed = 'hidden';
                removeOverlay(false);
            };

            const finish = (immediate = false) => {
                closed = 'done';
                clearTimeout(timer);
                clearInterval(ticker);
                window.removeEventListener('online', attempt);
                if (activeError === handle) activeError = null;
                if (overlay.isConnected) removeOverlay(immediate);
            };

            const handle = { close: finish };
            activeError = handle;

            tryBtn.addEventListener('click', attempt);
            closeBtn.addEventListener('click', () => (retry ? hide() : finish()));
            overlay.addEventListener('pointerdown', (event) => {
                overlay.dataset.pressed = event.target === overlay ? '1' : '';
            });
            overlay.addEventListener('click', (event) => {
                if (event.target === overlay && overlay.dataset.pressed === '1') retry ? hide() : finish();
            });
            document.addEventListener('keydown', onKey, true);
            if (retry) {
                window.addEventListener('online', attempt);
                ticker = setInterval(paint, 1000);
                schedule();
            }

            document.body.append(overlay);
            overlay.getBoundingClientRect();
            overlay.classList.add('slt-ld-open');
            (retry ? tryBtn : closeBtn).focus({ preventScroll: true });
        };
        mount();
    };

    const loadOnce = async () => {
        try {
            const info = await getVersionInfo();
            await loadExtension(info.version, info.downloadUrl || '', info.hash);
            return { ok: true };
        } catch (err) {
            log.warn('Retry failed:', err);
            return { ok: false, message: err?.message || 'Unknown error' };
        }
    };

    const load = async (retries = 3) => {
        try {
            await waitForSpicetify();
        } catch (err) {
            log.error('Required dependency unavailable:', err);
            showError('Spicetify is not available.');
            return;
        }

        log.info('Loading Spicy Lyric Translator...');

        let lastError;

        for (let i = 0; i < retries; i++) {
            try {
                const info = await getVersionInfo();
                await loadExtension(info.version, info.downloadUrl || '', info.hash);
                return;
            } catch (err) {
                lastError = err;
                log.warn(`Load attempt ${i + 1} failed:`, err);

                if (i < retries - 1) {
                    const delay = 2000 * Math.pow(1.5, i);
                    await new Promise(r => setTimeout(r, delay));
                }
            }
        }

        log.error('Failed to load after all retries:', lastError);
        showError(lastError?.message || 'Unknown error', loadOnce);
    };

    load();
})();
