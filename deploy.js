const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const EXTENSION_FILE = 'spicy-lyric-translater.js';
const DIST_FILE = path.resolve(__dirname, 'dist', EXTENSION_FILE);
const ARGS = process.argv.slice(2);
const SKIP_BUILD = ARGS.includes('--skip-build');
const SKIP_APPLY = ARGS.includes('--no-apply');
const BUILD_ARGS = ARGS.filter(arg => arg === '--no-bump');

const IS_WINDOWS = process.platform === 'win32';

const color = (code) => (text) => (process.stdout.isTTY ? `\x1b[${code}m${text}\x1b[0m` : text);
const bold = color('1');
const dim = color('2');
const green = color('32');
const red = color('31');
const cyan = color('36');

const steps = [];
const totalStart = Date.now();

const formatMs = (ms) => (ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`);

const fail = (message, hint) => {
    console.error(`\n${red('✖')} ${bold(message)}`);
    if (hint) console.error(dim(`  ${hint}`));
    process.exit(1);
};

const step = (label, fn) => {
    const index = steps.length + 1;
    console.log(`\n${cyan(`[${index}]`)} ${bold(label)}`);
    const start = Date.now();
    const detail = fn();
    const elapsed = Date.now() - start;
    steps.push({ label, elapsed });
    console.log(`${green('✔')} ${label}${detail ? dim(` · ${detail}`) : ''} ${dim(`(${formatMs(elapsed)})`)}`);
    return detail;
};

const run = (command, args, options = {}) => {
    const result = spawnSync(command, args, {
        cwd: __dirname,
        shell: IS_WINDOWS && command !== process.execPath,
        encoding: 'utf8',
        stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit'
    });
    if (result.error) {
        if (result.error.code === 'ENOENT') {
            fail(`"${command}" was not found on PATH`, command === 'spicetify' ? 'Install Spicetify: https://spicetify.app/docs/getting-started' : undefined);
        }
        fail(`Failed to run ${command}: ${result.error.message}`);
    }
    return result;
};

const runSpicetify = (args, options = {}) => {
    const result = run('spicetify', args, options);
    if (result.status !== 0) {
        const output = options.capture ? `${result.stdout || ''}${result.stderr || ''}`.trim() : '';
        fail(`spicetify ${args.join(' ')} exited with code ${result.status}`, output || undefined);
    }
    return options.capture ? (result.stdout || '').trim() : '';
};

const stripAnsi = (text) => text.replace(/\x1b\[[0-9;]*m/g, '');

const resolveExtensionsDir = () => {
    const userData = stripAnsi(runSpicetify(['path', 'userdata'], { capture: true })).split(/\r?\n/).pop().trim();
    if (userData && fs.existsSync(userData)) {
        return path.join(userData, 'Extensions');
    }

    const fallback = IS_WINDOWS
        ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'spicetify')
        : path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'spicetify');

    if (!fs.existsSync(fallback)) {
        fail('Could not locate the Spicetify config folder', `Looked in ${fallback}`);
    }
    return path.join(fallback, 'Extensions');
};

const readVersion = () => {
    try {
        return JSON.parse(fs.readFileSync(path.resolve(__dirname, 'manifest.json'), 'utf8')).version;
    } catch {
        return 'unknown';
    }
};

console.log(bold(`Deploying Spicy Lyric Translator`));

if (!SKIP_BUILD) {
    step('Build extension', () => {
        const result = run(process.execPath, [path.resolve(__dirname, 'build.js'), ...BUILD_ARGS]);
        if (result.status !== 0) fail('Build failed, nothing was deployed');
        return `v${readVersion()}`;
    });
}

if (!fs.existsSync(DIST_FILE)) {
    fail(`Missing ${path.relative(__dirname, DIST_FILE)}`, 'Run the build first or drop --skip-build.');
}

const extensionsDir = step('Locate Spicetify', () => resolveExtensionsDir());

step('Copy to Extensions', () => {
    fs.mkdirSync(extensionsDir, { recursive: true });
    const target = path.join(extensionsDir, EXTENSION_FILE);
    fs.copyFileSync(DIST_FILE, target);
    return `${(fs.statSync(target).size / 1024).toFixed(1)} KB → ${target}`;
});

step('Register extension', () => {
    const current = stripAnsi(runSpicetify(['config', 'extensions'], { capture: true }));
    const registered = current.split(/[|\r\n]/).map(entry => entry.trim()).includes(EXTENSION_FILE);
    if (registered) return 'already registered';
    runSpicetify(['config', 'extensions', EXTENSION_FILE], { capture: true });
    return 'added to config';
});

if (!SKIP_APPLY) {
    step('Apply Spicetify', () => {
        runSpicetify(['apply']);
        return '';
    });
}

console.log(`\n${green('✔')} ${bold(`Deployed v${readVersion()}`)} ${dim(`in ${formatMs(Date.now() - totalStart)}`)}`);
