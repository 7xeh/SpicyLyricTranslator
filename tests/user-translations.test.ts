import test from 'node:test';
import assert from 'node:assert/strict';

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

const {
    getUserTranslations,
    hasUserTranslations,
    saveUserTranslations,
    applyUserTranslations,
    coversAllLines,
    userTranslationKey,
    unlinkedTranslationKey,
    isUnlinkedTranslationKey,
    lineOccurrences,
    findUnlinkedLines
} = require('../src/utils/userTranslations') as typeof import('../src/utils/userTranslations');

const TRACK = 'spotify:track:abc';

function result(line: string, translated: string, wasTranslated = true) {
    return { originalText: line, translatedText: translated, targetLanguage: 'en', wasTranslated, source: 'api' as const, apiProvider: 'google' };
}

test('user translations are stored per track and target language', () => {
    storageMap.clear();
    const lines = new Map([[userTranslationKey('Я иду домой'), 'I am walking home']]);
    assert.equal(saveUserTranslations(TRACK, 'en', lines, { trackName: 'Song' }), true);

    assert.equal(getUserTranslations(TRACK, 'en').get(userTranslationKey('Я иду домой')), 'I am walking home');
    assert.equal(getUserTranslations(TRACK, 'EN').size, 1);
    assert.equal(hasUserTranslations(TRACK, 'de'), false);
    assert.equal(hasUserTranslations('spotify:track:other', 'en'), false);
    assert.equal(hasUserTranslations(null, 'en'), false);
});

test('line keys ignore case, spacing and punctuation so DOM and API lines match', () => {
    assert.equal(userTranslationKey('Hello,  World!'), userTranslationKey('hello world'));
    assert.equal(userTranslationKey('Te​quiero'), userTranslationKey('Tequiero'));
});

test('saving blank values removes them and an empty set deletes the track entry', () => {
    storageMap.clear();
    saveUserTranslations(TRACK, 'en', new Map([['a', '  spaced   out  '], ['b', '   ']]));
    assert.deepEqual(Array.from(getUserTranslations(TRACK, 'en')), [['a', 'spaced out']]);

    saveUserTranslations(TRACK, 'en', new Map());
    assert.equal(hasUserTranslations(TRACK, 'en'), false);
    assert.equal(storageMap.get('spicy-lyric-translator:user-translations'), '{}');
});

test('user translations override automatic results and are marked as yours', () => {
    const sources = ['Line one', 'Line two', 'Line one'];
    const results = sources.map(line => result(line, `auto ${line}`));
    const user = new Map([[userTranslationKey('Line one'), 'Mine']]);

    const applied = applyUserTranslations(results, sources, user);
    assert.deepEqual(applied.map(r => r.translatedText), ['Mine', 'auto Line two', 'Mine']);
    assert.deepEqual(applied.map(r => r.source), ['user', 'api', 'user']);
    assert.equal(applied[0].apiProvider, undefined);
    assert.equal(results[0].translatedText, 'auto Line one');
});

test('user translations fill lines the automatic pass left untranslated', () => {
    const sources = ['Untranslatable line'];
    const applied = applyUserTranslations([result('Untranslatable line', 'Untranslatable line', false)], sources, new Map([[userTranslationKey('Untranslatable line'), 'Finally']]));
    assert.equal(applied[0].translatedText, 'Finally');
    assert.equal(applied[0].wasTranslated, true);
});

test('"Keep original" hides the translation for that line', () => {
    const sources = ['Na na na'];
    const applied = applyUserTranslations([result('Na na na', 'Well well well')], sources, new Map([[userTranslationKey('Na na na'), 'Na na na!']]));
    assert.equal(applied[0].translatedText, 'Na na na');
    assert.equal(applied[0].wasTranslated, false);
});

test('coversAllLines only reports full coverage when every translatable line has a translation', () => {
    const user = new Map([[userTranslationKey('a line'), 'x'], [userTranslationKey('b line'), 'y']]);
    assert.equal(coversAllLines(['a line', 'b line', '♪'], user), true);
    assert.equal(coversAllLines(['a line', 'c line'], user), false);
    assert.equal(coversAllLines(['a line'], new Map()), false);
});

test('unlinked keys never collide with a normalized lyric key', () => {
    const key = userTranslationKey('Snap out of it #2');
    assert.equal(isUnlinkedTranslationKey(key), false);
    assert.equal(isUnlinkedTranslationKey(unlinkedTranslationKey(key, 2)), true);
});

test('line occurrences count repeats of the same normalized text', () => {
    assert.deepEqual(lineOccurrences(['Snap out of it', 'Other', 'snap out of it!', '♪', 'Snap out of it']), [1, 1, 2, 0, 3]);
});

test('an unlinked repeat gets its own translation while the rest stay linked', () => {
    const sources = ['Snap out of it', 'Other', 'Snap out of it', 'Snap out of it'];
    const key = userTranslationKey('Snap out of it');
    const user = new Map([[key, 'Wake up now'], [unlinkedTranslationKey(key, 3), 'Wake up eventually']]);
    const results = sources.map(line => result(line, `auto ${line}`));

    const applied = applyUserTranslations(results, sources, user, 'user', true);
    assert.deepEqual(applied.map(r => r.translatedText), ['Wake up now', 'auto Other', 'Wake up now', 'Wake up eventually']);
    assert.deepEqual(Array.from(findUnlinkedLines(sources, user)), [3]);

    const unordered = applyUserTranslations(results, sources, user);
    assert.equal(unordered[3].translatedText, 'Wake up now');
});

test('an unlinked repeat without a shared translation keeps the automatic one elsewhere', () => {
    const sources = ['Snap out of it', 'Snap out of it'];
    const key = userTranslationKey('Snap out of it');
    const user = new Map([[unlinkedTranslationKey(key, 2), 'Wake up eventually']]);
    const applied = applyUserTranslations(sources.map(line => result(line, 'auto')), sources, user, 'user', true);
    assert.deepEqual(applied.map(r => r.translatedText), ['auto', 'Wake up eventually']);
    assert.deepEqual(applied.map(r => r.source), ['api', 'user']);
    assert.equal(coversAllLines(sources, user), false);
    assert.equal(coversAllLines(['Snap out of it'], new Map([[key, 'x']])), true);
    assert.equal(coversAllLines(sources, new Map([[unlinkedTranslationKey(key, 1), 'a'], [unlinkedTranslationKey(key, 2), 'b']])), true);
});

test('a stale unlinked key past the last repeat is ignored', () => {
    const sources = ['Snap out of it', 'Snap out of it'];
    const key = userTranslationKey('Snap out of it');
    const user = new Map([[key, 'Shared'], [unlinkedTranslationKey(key, 7), 'Gone']]);
    const applied = applyUserTranslations(sources.map(line => result(line, 'auto')), sources, user, 'user', true);
    assert.deepEqual(applied.map(r => r.translatedText), ['Shared', 'Shared']);
    assert.equal(findUnlinkedLines(sources, user).size, 0);
});
