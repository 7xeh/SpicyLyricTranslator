const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const BUILD_HASH_PLACEHOLDER = 'SLT_BUILD_HASH_PLACEHOLDER_000000000000000000000000000';

const ARGS = process.argv.slice(2);
const IS_WATCH = ARGS.includes('--watch');
const SKIP_BUMP = IS_WATCH || ARGS.includes('--no-bump');

const MANIFEST_PATH = path.resolve(__dirname, 'manifest.json');
const PACKAGE_PATH = path.resolve(__dirname, 'package.json');
const README_PATH = path.resolve(__dirname, 'README.md');
const README_BADGE = /(img\.shields\.io\/badge\/Version-)\d+\.\d+\.\d+(-)/;
const OUT_DIR = 'dist';
const OUT_DIR_PATH = path.resolve(__dirname, OUT_DIR);
const OUT_FILE = path.join(OUT_DIR_PATH, 'spicy-lyric-translater.js');

const readJson = (filePath) => {
    const raw = fs.readFileSync(filePath, 'utf8');
    return {
        data: JSON.parse(raw),
        eol: raw.includes('\r\n') ? '\r\n' : '\n',
        trailingNewline: /\r?\n$/.test(raw)
    };
};

const writeJson = (filePath, file) => {
    let text = JSON.stringify(file.data, null, 2).replace(/\n/g, file.eol);
    if (file.trailingNewline) text += file.eol;
    fs.writeFileSync(filePath, text);
};

const parseVersion = (version) => {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version).trim());
    if (!match) throw new Error(`Invalid version "${version}" (expected x.y.z)`);
    return match.slice(1).map(Number);
};

const bumpVersion = (version) => {
    let [major, minor, patch] = parseVersion(version);
    patch += 1;
    if (patch > 9) {
        patch = 0;
        minor += 1;
    }
    if (minor > 9) {
        minor = 0;
        major += 1;
    }
    return `${major}.${minor}.${patch}`;
};

const syncReadmeVersion = (version) => {
    if (!fs.existsSync(README_PATH)) return;
    const raw = fs.readFileSync(README_PATH, 'utf8');
    if (!README_BADGE.test(raw)) {
        console.warn('[Version] README.md has no version badge to update');
        return;
    }
    const updated = raw.replace(README_BADGE, `$1${version}$2`);
    if (updated !== raw) fs.writeFileSync(README_PATH, updated);
};

const stampBuildHash = () => {
    if (!fs.existsSync(OUT_FILE)) return;
    const code = fs.readFileSync(OUT_FILE, 'utf8');
    if (!code.includes(BUILD_HASH_PLACEHOLDER)) return;
    const hash = crypto.createHash('sha256').update(code).digest('hex');
    fs.writeFileSync(OUT_FILE, code.split(BUILD_HASH_PLACEHOLDER).join(hash));
    console.log(`[Hash] Build hash: ${hash.substring(0, 12)}`);
};

const formatMs = (ms) => (ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`);

const run = async () => {
    const startedAt = Date.now();

    let manifest;
    let pkg;
    try {
        manifest = readJson(MANIFEST_PATH);
        pkg = readJson(PACKAGE_PATH);
    } catch (e) {
        console.error(`❌ Could not read manifest.json/package.json: ${e.message}`);
        process.exit(1);
    }

    const currentVersion = manifest.data.version;
    let nextVersion;
    try {
        nextVersion = SKIP_BUMP ? currentVersion : bumpVersion(currentVersion);
        parseVersion(nextVersion);
    } catch (e) {
        console.error(`❌ ${e.message} in manifest.json`);
        process.exit(1);
    }

    console.log(`[Init] Mode: ${IS_WATCH ? 'WATCH' : 'BUILD'}`);
    console.log(`[Init] Output: ./${OUT_DIR}/`);
    console.log(SKIP_BUMP
        ? `[Version] ${nextVersion} (no bump)`
        : `[Version] ${currentVersion} -> ${nextVersion}`);

    if (fs.existsSync(OUT_DIR_PATH)) {
        fs.rmSync(OUT_DIR_PATH, { recursive: true, force: true });
    }
    fs.mkdirSync(OUT_DIR_PATH, { recursive: true });

    const buildOptions = {
        entryPoints: ['src/app.ts'],
        bundle: true,
        outfile: OUT_FILE,
        format: 'iife',
        globalName: 'SpicyLyricTranslater',
        platform: 'browser',
        target: 'es2020',
        minify: false,
        sourcemap: IS_WATCH ? 'inline' : false,
        logLevel: 'info',
        define: {
            '__VERSION__': JSON.stringify(nextVersion),
            '__DEV__': JSON.stringify(false),
            '__BUILD_HASH__': JSON.stringify(BUILD_HASH_PLACEHOLDER)
        }
    };

    if (IS_WATCH) {
        const ctx = await esbuild.context(buildOptions);
        await ctx.watch();
        console.log('[Watch] Watching for changes...');
        return;
    }

    console.log('[TS] Checking types...');
    try {
        execSync('npx tsc --noEmit', { stdio: 'inherit', cwd: __dirname });
    } catch (e) {
        console.error(`❌ Type check failed. Version left at ${currentVersion}.`);
        process.exit(1);
    }

    await esbuild.build(buildOptions);
    stampBuildHash();

    if (!SKIP_BUMP) {
        manifest.data.version = nextVersion;
        writeJson(MANIFEST_PATH, manifest);
    }
    if (pkg.data.version !== nextVersion) {
        pkg.data.version = nextVersion;
        writeJson(PACKAGE_PATH, pkg);
    }
    syncReadmeVersion(nextVersion);

    console.log(`✅ Built v${nextVersion} in ${formatMs(Date.now() - startedAt)}`);
};

if (require.main === module) {
    run().catch((e) => {
        console.error(`❌ Build failed${e && e.message ? `: ${e.message}` : ''}`);
        process.exit(1);
    });
}

module.exports = { bumpVersion };
