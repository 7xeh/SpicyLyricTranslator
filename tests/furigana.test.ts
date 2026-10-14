import test from 'node:test';
import assert from 'node:assert/strict';
import { splitOkurigana, buildFuriganaSegments, toHiragana, hasKanji, countKana } from '../src/utils/furigana';
import type { FuriganaToken } from '../src/utils/furigana';

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
