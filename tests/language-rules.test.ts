import test from 'node:test';
import assert from 'node:assert/strict';
import {
    parseLanguageRules,
    serializeLanguageRules,
    setLanguageRule,
    findLanguageRule,
    isNoTranslationRule,
    NO_TRANSLATION
} from '../src/utils/languageRules';
import { state, resolveTargetForSource, refreshTargetLanguage, isUntranslatedLanguage } from '../src/utils/state';
import { SETTINGS_SCHEMA, isSettingFieldVisible } from '../src/utils/settingsModel';

const storageMap = new Map<string, string>();
(globalThis as any).localStorage = {
    getItem: (key: string) => storageMap.get(key) ?? null,
    setItem: (key: string, value: string) => { storageMap.set(key, String(value)); },
    removeItem: (key: string) => { storageMap.delete(key); },
    key: (index: number) => Array.from(storageMap.keys())[index] ?? null,
    get length() { return storageMap.size; }
};
const setStored = (key: string, value: string) => storageMap.set(`spicy-lyric-translator:${key}`, value);

const SUGGESTED = 'zh=zh-TW,en=none';

test('rules round-trip through their stored form and drop junk entries', () => {
    const rules = parseLanguageRules(`${SUGGESTED},ja=ja,=fr,ko=,zh=es, de = fr `);
    assert.deepEqual(rules, [
        { source: 'zh', target: 'zh-TW' },
        { source: 'en', target: NO_TRANSLATION },
        { source: 'de', target: 'fr' }
    ]);
    assert.equal(serializeLanguageRules(rules), `${SUGGESTED},de=fr`);
    assert.deepEqual(parseLanguageRules(''), []);
    assert.deepEqual(parseLanguageRules(null), []);
});

test('setLanguageRule adds, retargets in place, and removes', () => {
    let rules = parseLanguageRules(SUGGESTED);
    rules = setLanguageRule(rules, 'ja', 'en');
    assert.equal(serializeLanguageRules(rules), `${SUGGESTED},ja=en`);
    rules = setLanguageRule(rules, 'zh', 'ja');
    assert.equal(serializeLanguageRules(rules), 'zh=ja,en=none,ja=en');
    rules = setLanguageRule(rules, 'en', null);
    assert.equal(serializeLanguageRules(rules), 'zh=ja,ja=en');
});

test('rules match detected codes the way the lyrics actually report them', () => {
    const rules = parseLanguageRules('zh=zh-TW,zh-TW=en,en=none');
    assert.equal(findLanguageRule(rules, 'zh-CN')?.target, 'zh-TW', 'Simplified detection hits the Simplified rule');
    assert.equal(findLanguageRule(rules, 'zh-Hans')?.target, 'zh-TW');
    assert.equal(findLanguageRule(rules, 'zh-TW')?.target, 'en', 'Traditional is its own language');
    assert.equal(findLanguageRule(rules, 'zh-HK')?.target, 'en');
    assert.equal(isNoTranslationRule(findLanguageRule(rules, 'en-US')), true);
    assert.equal(isNoTranslationRule(findLanguageRule(rules, 'pcm')), true, 'English-equivalent detections count as English');
    assert.equal(findLanguageRule(rules, 'ja'), null);
    assert.equal(findLanguageRule(rules, 'unknown'), null);
    assert.equal(findLanguageRule(rules, null), null);
});

test('the effective target follows the song language and falls back to Target Language', () => {
    setStored('target-language', 'en');
    state.languageRules = parseLanguageRules('zh=zh-TW,en=none,ko=ja');
    refreshTargetLanguage(null);
    assert.equal(state.defaultTargetLanguage, 'en');
    assert.equal(state.targetLanguage, 'en');

    assert.equal(refreshTargetLanguage('zh-CN')?.target, 'zh-TW');
    assert.equal(state.targetLanguage, 'zh-TW');

    refreshTargetLanguage('ko');
    assert.equal(state.targetLanguage, 'ja');

    refreshTargetLanguage('es');
    assert.equal(state.targetLanguage, 'en', 'languages without a rule use Target Language');

    const ruledOut = resolveTargetForSource('en');
    assert.equal(ruledOut.target, 'en');
    assert.equal(isNoTranslationRule(ruledOut.rule), true);

    setStored('target-language', 'de');
    refreshTargetLanguage('fr');
    assert.equal(state.targetLanguage, 'de', 'a changed Target Language is picked up');

    state.languageRules = [];
    refreshTargetLanguage('zh-CN');
    assert.equal(state.targetLanguage, 'de');
});

test('a "Don\'t translate" rule leaves a language alone like the Don\'t Translate list', () => {
    state.skipLanguages = ['fr'];
    state.languageRules = parseLanguageRules('en=none,zh=zh-TW');
    assert.equal(isUntranslatedLanguage('en'), true);
    assert.equal(isUntranslatedLanguage('fr'), true);
    assert.equal(isUntranslatedLanguage('zh-CN'), false);
    assert.equal(isUntranslatedLanguage('es'), false);
    assert.equal(isUntranslatedLanguage(null), false);
    state.skipLanguages = [];
    state.languageRules = [];
});

test('the per-language setting is registered and reveals the Chinese script toggle', () => {
    const field = SETTINGS_SCHEMA.find(entry => entry.id === 'language-rules');
    assert.ok(field, 'language-rules setting must exist');
    assert.equal(field.type, 'languageRules');
    assert.equal(field.defaultValue, '');
    assert.ok(field.effects?.includes('retranslate'));

    const scriptToggle = SETTINGS_SCHEMA.find(entry => entry.id === 'replace-script-conversions')!;
    setStored('target-language', 'en');
    setStored('language-rules', 'en=none');
    assert.equal(isSettingFieldVisible(scriptToggle), false);
    setStored('language-rules', 'zh=zh-TW');
    assert.equal(isSettingFieldVisible(scriptToggle), true);
    setStored('language-rules', '');
});
