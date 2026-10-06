import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto, createHash } from 'node:crypto';
import vm from 'node:vm';

const official = 'https://github.com/7xeh/SpicyLyricTranslator/releases/download/v2.2.2/spicy-lyric-translater.js';
const bundle = 'window.testExtensionLoaded = true;';
const digest = createHash('sha256').update(bundle).digest('hex');

function harness(options: { body?: string; crypto?: boolean; template?: string; direct?: boolean } = {}) {
    const requests: string[] = [];
    const scripts: string[] = [];
    const storage = new Map<string, string>();
    if (options.template !== undefined) storage.set('spicetify:corsProxyTemplate', options.template);
    const context: any = {
        URL, TextEncoder, console: { log() {}, warn() {}, error() {} },
        crypto: options.crypto === false ? {} : webcrypto,
        localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) },
        window: {},
        document: {
            createElement: () => ({ textContent: '', remove() {} }),
            head: { appendChild: (script: any) => scripts.push(script.textContent) }
        },
        fetch: async (url: string) => {
            requests.push(url);
            if (url.startsWith('https://api.github.com/')) return {
                ok: true, json: async () => ({ tag_name: 'v2.2.2', assets: [
                    { name: 'other.js', browser_download_url: 'https://github.com/other.js' },
                    { name: 'spicy-lyric-translater.js', browser_download_url: official, digest: `sha256:${digest}` }
                ] })
            };
            if (url.startsWith('https://7xeh.dev/')) throw new TypeError('Failed to fetch (7xeh.dev)');
            if (url.startsWith(official) && !options.direct) throw new TypeError('Failed to fetch (CORS)');
            return { ok: true, text: async () => options.body ?? bundle };
        }
    };
    const source = readFileSync('loader/SLT-loader.js', 'utf8').replace(/\n    load\(\);/, '\n    globalThis.loader = { getVersionInfo, loadExtension };');
    vm.runInNewContext(source, context);
    return { context, requests, scripts };
}

test('primary DNS failure and GitHub CORS failure load the checksum-verified release through the proxy', async () => {
    const h = harness();
    const info = await h.context.loader.getVersionInfo();
    assert.equal(info.downloadUrl, official);
    assert.equal(info.hash, digest);
    await h.context.loader.loadExtension(info.version, info.downloadUrl, info.hash);
    assert.deepEqual(h.scripts, [bundle]);
    assert.ok(h.requests.some(url => url.startsWith('https://cors-proxy.spicetify.app/' + official)));
    assert.equal(h.context.window._spicy_lyric_translator_metadata.ContentHash, digest);
});

test('a tampered proxy response is never injected', async () => {
    const h = harness({ body: bundle + 'tampered' });
    await assert.rejects(h.context.loader.loadExtension('2.2.2', official, digest), /Integrity check failed/);
    assert.deepEqual(h.scripts, []);
});

test('proxy responses require working SHA-256 verification', async () => {
    const h = harness({ crypto: false });
    await assert.rejects(h.context.loader.loadExtension('2.2.2', official, digest), /Cannot verify integrity/);
    assert.deepEqual(h.scripts, []);
});

test('releases without a digest do not use a proxy', async () => {
    const h = harness();
    await assert.rejects(h.context.loader.loadExtension('2.2.2', official, null), /all sources/);
    assert.ok(h.requests.every(url => !url.includes('cors-proxy')));
    assert.deepEqual(h.scripts, []);
});

test('the configured Spicetify proxy is respected', async () => {
    const h = harness({ template: 'https://proxy.example/?url={url}' });
    await h.context.loader.loadExtension('2.2.2', official, digest);
    assert.ok(h.requests.some(url => url.startsWith('https://proxy.example/?url=')));
    assert.deepEqual(h.scripts, [bundle]);
});

for (const template of ['invalid {url}', 'http://proxy.example/{url}', 'https://proxy.example/no-placeholder']) {
    test(`invalid or insecure proxy template is not fetched: ${template}`, async () => {
        const h = harness({ template });
        await assert.rejects(h.context.loader.loadExtension('2.2.2', official, digest), /all sources/);
        assert.equal(h.requests.length, 3);
        assert.deepEqual(h.scripts, []);
    });
}

test('a successful direct download does not contact the proxy', async () => {
    const h = harness({ direct: true });
    await h.context.loader.loadExtension('2.2.2', official, digest);
    assert.equal(h.requests.length, 1);
    assert.deepEqual(h.scripts, [bundle]);
});
