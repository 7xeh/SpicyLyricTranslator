import test from 'node:test';
import assert from 'node:assert/strict';
import {
    splitOkurigana,
    buildFuriganaSegments,
    toHiragana,
    hasKanji,
    countKana,
    normalizeReading,
    uncoveredKanjiRuns,
    resolveFuriganaSegments,
    parseDictionaryFeatures,
    readingForSpan,
    rankReadingCandidates
} from '../src/utils/furigana';
import type { DictionaryEntry, FuriganaToken } from '../src/utils/furigana';

function render(text: string, tokens: FuriganaToken[]): string {
    let out = '';
    let cursor = 0;
    for (const segment of buildFuriganaSegments(tokens)) {
        out += `${text.slice(cursor, segment.start)}[${text.slice(segment.start, segment.end)}|${segment.reading}]`;
        cursor = segment.end;
    }
    return out + text.slice(cursor);
}

function tokens(...parts: [string, string?][]): FuriganaToken[] {
    let position = 1;
    return parts.map(([surface, reading]) => {
        const token = { surface_form: surface, reading, word_position: position };
        position += surface.length;
        return token;
    });
}

test('readings sit on the kanji only, leaving okurigana bare', () => {
    assert.deepEqual(splitOkurigana('眠っ', 'ネムッ'), [{ start: 0, end: 1, reading: 'ねむ' }]);
    assert.deepEqual(splitOkurigana('取り扱い', 'トリアツカイ'), [
        { start: 0, end: 1, reading: 'と' },
        { start: 2, end: 3, reading: 'あつか' }
    ]);
    assert.deepEqual(splitOkurigana('お母さん', 'オカアサン'), [{ start: 1, end: 2, reading: 'かあ' }]);
    assert.deepEqual(splitOkurigana('夢見', 'ユメミ'), [{ start: 0, end: 2, reading: 'ゆめみ' }]);
});

test('kana-only and reading-less tokens get no furigana', () => {
    assert.deepEqual(splitOkurigana('あなた', 'アナタ'), []);
    assert.deepEqual(splitOkurigana('ジャンプ', 'ジャンプ'), []);
    assert.deepEqual(splitOkurigana('隣', ''), []);
    assert.deepEqual(buildFuriganaSegments(tokens(['隣', '*'], ['で', 'デ'])), []);
});

test('a reading that does not line up with the okurigana still covers the kanji', () => {
    assert.deepEqual(splitOkurigana('今日は', 'キョウハ'), [{ start: 0, end: 2, reading: 'きょう' }]);
    assert.deepEqual(splitOkurigana('大人しい', 'オトナシイ'), [{ start: 0, end: 2, reading: 'おとな' }]);
    assert.deepEqual(splitOkurigana('行く', 'ユキ'), [{ start: 0, end: 1, reading: 'ゆき' }]);
});

test('segments map back onto the original line text', () => {
    const line = '隣で眠ってるあなたの';
    assert.equal(
        render(line, tokens(['隣', 'トナリ'], ['で', 'デ'], ['眠っ', 'ネムッ'], ['てる', 'テル'], ['あなた', 'アナタ'], ['の', 'ノ'])),
        '[隣|となり]で[眠|ねむ]ってるあなたの'
    );

    const spaced = '口が開く そして笑った';
    assert.equal(
        render(spaced, tokens(['口', 'クチ'], ['が', 'ガ'], ['開く', 'ヒラク'], [' ', undefined], ['そして', 'ソシテ'], ['笑っ', 'ワラッ'], ['た', 'タ'])),
        '[口|くち]が[開|ひら]く そして[笑|わら]った'
    );
});

test('segments fall back to running offsets when tokens carry no position', () => {
    const line = 'の左手少し汗';
    const plain: FuriganaToken[] = [
        { surface_form: 'の', reading: 'ノ' },
        { surface_form: '左手', reading: 'ヒダリテ' },
        { surface_form: '少し', reading: 'スコシ' },
        { surface_form: '汗', reading: 'アセ' }
    ];
    assert.equal(render(line, plain), 'の[左手|ひだりて][少|すこ]し[汗|あせ]');
});

test('kana and kanji helpers', () => {
    assert.equal(toHiragana('カタカナ・ヴ'), 'かたかな・ゔ');
    assert.equal(hasKanji('ひらがな'), false);
    assert.equal(hasKanji('日々'), true);
    assert.equal(hasKanji(null), false);
    assert.equal(countKana('我爱你'), 0, 'Chinese lyrics have no kana');
    assert.equal(countKana('君の名は'), 2);
});

test('typed readings normalize to hiragana', () => {
    assert.equal(normalizeReading(' サダメ '), 'さだめ');
    assert.equal(normalizeReading('ｻﾀﾞﾒ'), 'さだめ');
    assert.equal(normalizeReading('う ん め い'), 'うんめい');
    assert.equal(normalizeReading(null), '');
});

test('kanji the dictionary left bare are found as empty segments', () => {
    const line = '燦々と煌めく';
    assert.deepEqual(uncoveredKanjiRuns(line, [{ start: 3, end: 4, reading: 'きら' }]), [{ start: 0, end: 2, reading: '' }]);
    assert.deepEqual(uncoveredKanjiRuns('あいうえお', []), []);
});

test('corrections override the automatic reading, line before song', () => {
    const line = 'きっと知っていた運命の渦の中を';
    const auto = [
        { start: 3, end: 4, reading: 'し' },
        { start: 8, end: 10, reading: 'うんめい' },
        { start: 11, end: 12, reading: 'うず' },
        { start: 13, end: 14, reading: 'なか' }
    ];
    const resolved = resolveFuriganaSegments(line, auto, { lines: { '13-14': '' }, words: { '運命': 'さだめ', '渦': 'うず' } });
    assert.deepEqual(resolved.map(s => [line.slice(s.start, s.end), s.reading, s.source]), [
        ['知', 'し', 'auto'],
        ['運命', 'さだめ', 'song'],
        ['渦', 'うず', 'song']
    ]);
    assert.equal(resolved[1].auto, 'うんめい');

    const editing = resolveFuriganaSegments(line, auto, { lines: { '13-14': '', '8-10': 'うんめい' }, words: { '運命': 'さだめ' } }, true);
    assert.deepEqual(editing.map(s => [s.reading, s.source]), [['し', 'auto'], ['うんめい', 'line'], ['うず', 'auto'], ['', 'line']]);
});

test('a reading added to a bare kanji shows up', () => {
    const resolved = resolveFuriganaSegments('燦々と', [], { lines: { '0-2': 'さんさん' }, words: {} });
    assert.deepEqual(resolved, [{ start: 0, end: 2, reading: 'さんさん', auto: '', source: 'line' }]);
    assert.deepEqual(resolveFuriganaSegments('燦々と', [], null), []);
    assert.deepEqual(resolveFuriganaSegments('燦々と', [], null, true).map(s => s.reading), ['']);
});

test('dictionary feature rows parse into readings', () => {
    assert.deepEqual(parseDictionaryFeatures('中,名詞,非自立,副詞可能,*,*,*,中,ナカ,ナカ'), { surface: '中', pos: '名詞', posDetail: '非自立', base: '中', reading: 'ナカ' });
    assert.deepEqual(parseDictionaryFeatures('沿っ,動詞,自立,*,*,五段・ワ行促音便,連用タ接続,沿う,ソッ,ソッ')?.base, '沿う');
    assert.equal(parseDictionaryFeatures('ｗ,記号,一般,*,*,*,*,*'), null);
});

test('a candidate reading is trimmed to the kanji it sits on', () => {
    assert.equal(readingForSpan('沿っ', 0, 1, 'ソッ'), 'そ');
    assert.equal(readingForSpan('運命', 0, 2, 'サダメ'), 'さだめ');
    assert.equal(readingForSpan('取り扱い', 2, 3, 'トリアツカイ'), 'あつか');
    assert.equal(readingForSpan('取り扱い', 0, 1, 'トリアツカイ'), 'と');
    assert.equal(readingForSpan('取り扱い', 1, 2, 'トリアツカイ'), '');
});

test('candidates rank the automatic reading first and names last', () => {
    const dictionary: Record<string, DictionaryEntry[]> = {
        '中': [
            { surface: '中', pos: '名詞', posDetail: '非自立', base: '中', reading: 'ナカ' },
            { surface: '中', pos: '名詞', posDetail: '固有名詞', base: '中', reading: 'カナエ' },
            { surface: '中', pos: '名詞', posDetail: '接尾', base: '中', reading: 'チュウ' },
            { surface: '中', pos: '名詞', posDetail: '接尾', base: '中', reading: 'ジュウ' }
        ],
        '沿っ': [{ surface: '沿っ', pos: '動詞', posDetail: '自立', base: '沿う', reading: 'ソッ' }],
        '沿う': [{ surface: '沿う', pos: '動詞', posDetail: '自立', base: '沿う', reading: 'ソウ' }],
        '行く': [
            { surface: '行く', pos: '動詞', posDetail: '自立', base: '行く', reading: 'イク' },
            { surface: '行く', pos: '動詞', posDetail: '自立', base: '行く', reading: 'ユク' }
        ]
    };
    const lookup = (word: string) => dictionary[word] || [];
    assert.deepEqual(rankReadingCandidates('なか', '中', '中', 0, lookup), ['なか', 'ちゅう', 'じゅう', 'かなえ']);
    assert.deepEqual(rankReadingCandidates('そ', '沿', '沿っ', 0, lookup), ['そ']);
    assert.deepEqual(rankReadingCandidates('い', '行', '行く', 0, lookup), ['い', 'ゆ']);
    assert.deepEqual(rankReadingCandidates('', '燦', '燦', 0, lookup), []);
});
