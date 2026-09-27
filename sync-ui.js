const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const ARGS = process.argv.slice(2);
const IS_CHECK = ARGS.includes('--check');
const IS_FORCE = ARGS.includes('--force');
const FROM_INDEX = ARGS.indexOf('--from');

const ROOT = __dirname;
const SOURCE_ROOT = path.resolve(ROOT, FROM_INDEX >= 0 && ARGS[FROM_INDEX + 1]
    ? ARGS[FROM_INDEX + 1]
    : (process.env.SPICY_THEMES_DIR || '../SpicyThemes'));
const LOCK_PATH = path.join(ROOT, 'sync-ui.lock.json');

const PREFIX_RULES = [
    { find: /\bst-/g, replace: 'slt-', expect: 'some' },
    { find: /\bst(?=[A-Z])/g, replace: 'slt', expect: 'any' },
    { find: /_st(?=[A-Z])/g, replace: '_slt', expect: 'any' },
];

const TONE_WRAPPER = [
    '',
    "export function toneVars(tone: Tone = 'accent'): Record<string, string> {",
    '    return adaptToneVars(tone, baseToneVars(tone));',
    '}',
    '',
];

const FILES = [
    {
        from: 'src/utils/surface.ts',
        to: 'src/utils/surface.ts',
        rules: [
            {
                find: "import { themeState, ThemeConfig } from './state';",
                replace: "import { themeState, ThemeConfig, adaptToneVars } from './uiTheme';",
                expect: 'one',
            },
            { find: 'export function toneVars(', replace: 'function baseToneVars(', expect: 'one' },
            { find: 'Spicy Themes', replace: 'Spicy Lyric Translator', expect: 'some' },
            { find: 'Icons.Palette', replace: 'Icons.Translate', expect: 'some' },
            { find: '#ThemeToggle', replace: '#TranslateToggle', expect: 'any' },
            ...PREFIX_RULES,
        ],
        append: TONE_WRAPPER,
    },
    {
        from: 'src/utils/toast.ts',
        to: 'src/utils/toast.ts',
        rules: [
            { find: 'Spicy Themes', replace: 'Spicy Lyric Translator', expect: 'any' },
            ...PREFIX_RULES,
        ],
    },
];

const FORBIDDEN = [
    { pattern: /\bst-/, label: 'leftover "st-" prefix' },
    { pattern: /\bst[A-Z]/, label: 'leftover "st" identifier' },
    { pattern: /_st[A-Z]/, label: 'leftover "_st" identifier' },
    { pattern: /Spicy Themes/, label: 'Spicy Themes branding' },
    { pattern: /from '\.\/state'/, label: "import from './state'" },
    { pattern: /ThemeToggle/, label: 'SpicyThemes button id' },
    { pattern: /Icons\.Palette/, label: 'SpicyThemes icon' },
];

const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

const countMatches = (text, find) => {
    if (typeof find === 'string') return text.split(find).length - 1;
    return (text.match(find) || []).length;
};

const applyRule = (text, rule, file) => {
    const count = countMatches(text, rule.find);
    const ok = rule.expect === 'any'
        || (rule.expect === 'one' && count === 1)
        || (rule.expect === 'some' && count > 0);
    if (!ok) {
        throw new Error(`${file.from}: expected ${rule.expect} match(es) of ${String(rule.find)}, found ${count}. SpicyThemes changed shape, update sync-ui.js.`);
    }
    return typeof rule.find === 'string'
        ? text.split(rule.find).join(rule.replace)
        : text.replace(rule.find, rule.replace);
};

const transform = (source, file) => {
    const eol = source.includes('\r\n') ? '\r\n' : '\n';
    let text = file.rules.reduce((acc, rule) => applyRule(acc, rule, file), source);
    if (file.append) {
        if (!text.endsWith(eol)) text += eol;
        text += file.append.join(eol);
    }

    for (const { pattern, label } of FORBIDDEN) {
        if (pattern.test(text)) throw new Error(`${file.from}: output still contains ${label}.`);
    }

    const localImports = [...text.matchAll(/from '\.\/([\w-]+)'/g)].map(m => m[1]);
    for (const name of localImports) {
        const target = path.join(ROOT, path.dirname(file.to), `${name}.ts`);
        if (!fs.existsSync(target)) {
            throw new Error(`${file.from}: imports './${name}', which SLT doesn't have (${path.relative(ROOT, target)}).`);
        }
    }
    return text;
};

const readLock = () => {
    try {
        return JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8'));
    } catch {
        return null;
    }
};

const sourceInfo = () => {
    const git = (cmd) => execSync(`git -C "${SOURCE_ROOT}" ${cmd}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    try {
        const commit = git('rev-parse --short HEAD');
        const dirty = git(`status --porcelain -- ${FILES.map(f => f.from).join(' ')}`).length > 0;
        return { commit, dirty };
    } catch {
        return { commit: null, dirty: null };
    }
};

const readOutput = (file) => {
    const target = path.join(ROOT, file.to);
    return fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
};

const handEdited = (lock) => FILES.filter(file => {
    const current = readOutput(file);
    const recorded = lock?.files?.[file.to]?.output;
    return current !== null && recorded && sha256(current) !== recorded;
});

const main = () => {
    const lock = readLock();
    const hasSource = fs.existsSync(path.join(SOURCE_ROOT, FILES[0].from));
    const edited = handEdited(lock);

    if (IS_CHECK) {
        let failed = false;
        for (const file of edited) {
            console.error(`✗ ${file.to} was edited by hand. Change it in SpicyThemes and run npm run sync-ui.`);
            failed = true;
        }
        if (!hasSource) {
            console.warn(`! SpicyThemes not found at ${SOURCE_ROOT}; only checked for hand edits.`);
        } else {
            for (const file of FILES) {
                const expected = transform(fs.readFileSync(path.join(SOURCE_ROOT, file.from), 'utf8'), file);
                if (readOutput(file) !== expected) {
                    console.error(`✗ ${file.to} is behind SpicyThemes. Run npm run sync-ui.`);
                    failed = true;
                }
            }
        }
        if (failed) process.exit(1);
        console.log('✓ Shared UI files match SpicyThemes.');
        return;
    }

    if (!hasSource) {
        console.error(`✗ SpicyThemes not found at ${SOURCE_ROOT}. Pass --from <path> or set SPICY_THEMES_DIR.`);
        process.exit(1);
    }

    if (edited.length && !IS_FORCE) {
        for (const file of edited) console.error(`✗ ${file.to} was edited by hand since the last sync.`);
        console.error('  Move those changes into SpicyThemes, or rerun with --force to overwrite them.');
        process.exit(1);
    }

    const nextFiles = {};
    let changed = 0;
    for (const file of FILES) {
        const source = fs.readFileSync(path.join(SOURCE_ROOT, file.from), 'utf8');
        const output = transform(source, file);
        const target = path.join(ROOT, file.to);
        if (readOutput(file) !== output) {
            fs.writeFileSync(target, output);
            changed++;
            console.log(`↻ ${file.to}`);
        } else {
            console.log(`= ${file.to}`);
        }
        nextFiles[file.to] = { from: file.from, source: sha256(source), output: sha256(output) };
    }

    const info = sourceInfo();
    const nextLock = {
        source: { repo: 'SpicyThemes', commit: info.commit, dirty: info.dirty },
        files: nextFiles,
    };
    const lockText = `${JSON.stringify(nextLock, null, 2)}\n`;
    if (!lock || JSON.stringify(lock) !== JSON.stringify(nextLock)) fs.writeFileSync(LOCK_PATH, lockText);

    const origin = info.commit ? `SpicyThemes@${info.commit}${info.dirty ? ' (uncommitted changes)' : ''}` : 'SpicyThemes';
    console.log(changed ? `✓ Synced ${changed} file(s) from ${origin}.` : `✓ Already in sync with ${origin}.`);
};

try {
    main();
} catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
}
