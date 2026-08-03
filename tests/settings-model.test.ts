import test from 'node:test';
import assert from 'node:assert/strict';
import {
    SETTINGS_SCHEMA,
    SETTINGS_CATEGORIES,
    getSectionsForCategory,
    matchesSettingQuery,
    isSettingFieldVisible
} from '../src/utils/settingsModel';

test('every setting belongs to a section that a category renders', () => {
    const rendered = new Set(SETTINGS_CATEGORIES.flatMap(getSectionsForCategory));
    const orphans = SETTINGS_SCHEMA.filter(field => !rendered.has(field.section));
    assert.deepEqual(orphans.map(field => field.id), []);
});

test('categories do not claim the same section twice', () => {
    const seen = new Set<string>();
    for (const category of SETTINGS_CATEGORIES) {
        for (const section of category.sections) {
            assert.equal(seen.has(section), false, `section "${section}" claimed twice`);
            seen.add(section);
        }
    }
});

test('setting ids and storage keys are unique', () => {
    const ids = SETTINGS_SCHEMA.map(field => field.id);
    assert.equal(new Set(ids).size, ids.length);
});

test('search matches label, section, description and keywords', () => {
    const targetLanguage = SETTINGS_SCHEMA.find(field => field.id === 'target-language')!;
    assert.equal(matchesSettingQuery(targetLanguage, 'target'), true);
    assert.equal(matchesSettingQuery(targetLanguage, 'TRANSLATION'), true);
    assert.equal(matchesSettingQuery(targetLanguage, 'locale'), true);
    assert.equal(matchesSettingQuery(targetLanguage, ''), true);
    assert.equal(matchesSettingQuery(targetLanguage, 'deepl'), false);

    const deeplKey = SETTINGS_SCHEMA.find(field => field.id === 'deepl-api-key')!;
    assert.equal(matchesSettingQuery(deeplKey, 'deepl'), true);
    assert.equal(matchesSettingQuery(deeplKey, 'token'), true);
});

test('the regional variant toggle is hidden unless the provider and language both support it', () => {
    const storageMap = new Map<string, string>();
    (globalThis as any).localStorage = {
        getItem: (key: string) => storageMap.get(key) ?? null,
        setItem: (key: string, value: string) => {
            storageMap.set(key, String(value));
        },
        removeItem: (key: string) => {
            storageMap.delete(key);
        },
        key: (index: number) => Array.from(storageMap.keys())[index] ?? null,
        get length() {
            return storageMap.size;
        }
    };

    const field = SETTINGS_SCHEMA.find(entry => entry.id === 'language-variant')!;
    assert.ok(field, 'language-variant setting must exist');
    assert.equal(field.type, 'toggle');
    assert.equal(field.defaultValue, false);

    const setTargetLanguage = (code: string) => storageMap.set('spicy-lyric-translator:target-language', code);

    setTargetLanguage('ca');
    assert.equal(isSettingFieldVisible(field, 'openai'), true);
    assert.equal(isSettingFieldVisible(field, 'anthropic'), true);
    assert.equal(isSettingFieldVisible(field, 'google'), false, 'Google cannot honour a variant instruction');
    assert.equal(isSettingFieldVisible(field, 'deepl'), false);

    setTargetLanguage('es');
    assert.equal(isSettingFieldVisible(field, 'openai'), false, 'Spanish has no variant to offer');
});
