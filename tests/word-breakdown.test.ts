import test from 'node:test';
import assert from 'node:assert/strict';
import {
    segmentSourceText,
    segmentTargetText,
    similarity,
    buildHeuristicBreakdown,
    parseModelBreakdown,
    breakdownCacheKey,
    hasCjk,
    chunkTargetSpan
} from '../src/utils/wordBreakdown';

test('segmentSourceText splits Latin text and strips edge punctuation', () => {
    assert.deepEqual(
        segmentSourceText('Kom igen nu, du vet vad!'),
        ['Kom', 'igen', 'nu', 'du', 'vet', 'vad']
    );
});

test('segmentSourceText keeps internal apostrophes and hyphens', () => {
    assert.deepEqual(segmentSourceText("J'suis bien re-tourne"), ["J'suis", 'bien', 're-tourne']);
});

test('segmentSourceText keeps kanji with its trailing hiragana', () => {
    const tokens = segmentSourceText('君の名は');
    assert.ok(tokens.includes('君の'), JSON.stringify(tokens));
    assert.ok(tokens.includes('名は'), JSON.stringify(tokens));
});

test('segmentSourceText breaks long Han runs into word-sized groups', () => {
    const tokens = segmentSourceText('我们今天一起走');
    assert.ok(tokens.length > 1, JSON.stringify(tokens));
    assert.ok(tokens.every(token => token.length <= 3), JSON.stringify(tokens));
    assert.equal(tokens.join(''), '我们今天一起走');
});

test('segmentSourceText separates katakana from surrounding scripts', () => {
    const tokens = segmentSourceText('東京タワー');
    assert.deepEqual(tokens, ['東京', 'タワー']);
});

test('hasCjk distinguishes scripts', () => {
    assert.equal(hasCjk('Jag saknar dig'), false);
    assert.equal(hasCjk('君の名は'), true);
    assert.equal(hasCjk('안녕하세요'), true);
});

test('similarity scores identical and cognate tokens above unrelated ones', () => {
    assert.equal(similarity('Blizzy', 'blizzy'), 1);
    assert.ok(similarity('musik', 'music') > 0.6);
    assert.ok(similarity('hjarta', 'zebra') < 0.4);
});

test('heuristic breakdown pairs one-to-one when counts match', () => {
    const result = buildHeuristicBreakdown('jag saknar dig', 'I miss you');

    assert.equal(result.origin, 'heuristic');
    assert.deepEqual(result.tokens.map(t => t.source), ['jag', 'saknar', 'dig']);
    assert.deepEqual(result.tokens.map(t => t.target), ['I', 'miss', 'you']);
});

test('heuristic breakdown anchors on shared proper nouns', () => {
    const result = buildHeuristicBreakdown('Det ar Blizzy nu', 'It is Blizzy now');

    const anchor = result.tokens.find(token => token.source === 'Blizzy');
    assert.ok(anchor, JSON.stringify(result.tokens));
    assert.equal(anchor!.target, 'Blizzy');
    assert.equal(anchor!.confidence, 'high');
});

test('heuristic breakdown keeps anchors in order and never crosses them', () => {
    const result = buildHeuristicBreakdown('Ozzy och Blizzy', 'Ozzy and Blizzy');

    const sources = result.tokens.map(t => t.source);
    assert.deepEqual(sources, ['Ozzy', 'och', 'Blizzy']);
    assert.equal(result.tokens[0].target, 'Ozzy');
    assert.equal(result.tokens[2].target, 'Blizzy');
});

test('heuristic breakdown covers every target word when counts differ', () => {
    const result = buildHeuristicBreakdown('vi gor', 'we are making mistakes now');

    const joined = result.tokens.map(t => t.target).join(' ').split(/\s+/).filter(Boolean);
    assert.deepEqual(joined, ['we', 'are', 'making', 'mistakes', 'now']);
});

test('heuristic breakdown reports low confidence when counts are uneven', () => {
    const result = buildHeuristicBreakdown('vi gor', 'we are making mistakes now');
    assert.ok(result.tokens.every(token => token.confidence === 'low'));
});

test('heuristic breakdown still produces tokens for CJK sources', () => {
    const result = buildHeuristicBreakdown('君の名は', 'What is your name');

    assert.ok(result.tokens.length > 1, JSON.stringify(result.tokens));
    assert.ok(result.tokens.every(token => token.source || token.target));
});

test('heuristic breakdown returns nothing for empty input', () => {
    assert.deepEqual(buildHeuristicBreakdown('', 'hello').tokens, []);
    assert.deepEqual(buildHeuristicBreakdown('hej', '').tokens, []);
});

test('parseModelBreakdown reads a clean JSON array', () => {
    const tokens = parseModelBreakdown('[{"source":"saknar","target":"miss","lemma":"sakna","pos":"verb"}]');

    assert.equal(tokens?.length, 1);
    assert.equal(tokens![0].lemma, 'sakna');
    assert.equal(tokens![0].pos, 'verb');
    assert.equal(tokens![0].confidence, 'high');
});

test('parseModelBreakdown tolerates code fences and surrounding prose', () => {
    const raw = 'Sure!\n```json\n[{"source":"dig","target":"you"}]\n```\nHope that helps.';
    const tokens = parseModelBreakdown(raw);

    assert.equal(tokens?.length, 1);
    assert.equal(tokens![0].target, 'you');
});

test('parseModelBreakdown accepts short key aliases', () => {
    const tokens = parseModelBreakdown('[{"s":"jag","t":"I","l":"jag","p":"pron","n":"subject"}]');

    assert.equal(tokens![0].source, 'jag');
    assert.equal(tokens![0].target, 'I');
    assert.equal(tokens![0].note, 'subject');
});

test('parseModelBreakdown rejects malformed or empty payloads', () => {
    assert.equal(parseModelBreakdown(''), null);
    assert.equal(parseModelBreakdown('not json at all'), null);
    assert.equal(parseModelBreakdown('[]'), null);
    assert.equal(parseModelBreakdown('[{"nothing":"useful"}]'), null);
    assert.equal(parseModelBreakdown('[{"source":"a"'), null);
});

test('breakdownCacheKey is stable across whitespace and case', () => {
    assert.equal(
        breakdownCacheKey('  Jag   SAKNAR dig ', 'en'),
        breakdownCacheKey('jag saknar dig', 'en')
    );
    assert.notEqual(breakdownCacheKey('jag saknar dig', 'en'), breakdownCacheKey('jag saknar dig', 'de'));
});

test('target function words group with the content word that follows', () => {
    assert.deepEqual(
        chunkTargetSpan(['The', 'roar', 'of', 'thunder', 'will', 'tear', 'us', 'apart'], 'en'),
        ['The roar', 'of thunder', 'will tear', 'us', 'apart']
    );
});

test('chunking is a no-op for a target language with no function word list', () => {
    const words = ['The', 'roar', 'of', 'thunder'];
    assert.deepEqual(chunkTargetSpan(words, 'ja'), words);
    assert.deepEqual(chunkTargetSpan(words, undefined), words);
});

test('trailing function words fold into the previous chunk', () => {
    assert.deepEqual(chunkTargetSpan(['tear', 'us', 'apart', 'the'], 'en'), ['tear', 'us', 'apart the']);
});

test('Russian to English aligns without shifting off by one', () => {
    const result = buildHeuristicBreakdown(
        'Грохот грома разорвёт нас на части',
        'The roar of thunder will tear us apart',
        'en'
    );

    assert.deepEqual(result.tokens.map(t => t.source), ['Грохот', 'грома', 'разорвёт', 'нас', 'на части']);
    assert.deepEqual(
        result.tokens.map(t => t.target),
        ['The roar', 'of thunder', 'will tear', 'us', 'apart']
    );
});

test('a clean chunk alignment is not reported as low confidence', () => {
    const result = buildHeuristicBreakdown(
        'Грохот грома разорвёт нас на части',
        'The roar of thunder will tear us apart',
        'en'
    );

    assert.ok(result.tokens.every(token => token.confidence !== 'low'), JSON.stringify(result.tokens));
});

test('source tokens left without a target merge into their neighbour', () => {
    const result = buildHeuristicBreakdown('на части', 'apart', 'en');

    assert.equal(result.tokens.length, 1);
    assert.equal(result.tokens[0].source, 'на части');
    assert.equal(result.tokens[0].target, 'apart');
});

test('every target word survives chunked distribution', () => {
    const result = buildHeuristicBreakdown('Грохот грома разорвёт нас на части', 'The roar of thunder will tear us apart', 'en');
    const words = result.tokens.map(t => t.target).join(' ').split(/\s+/).filter(Boolean);

    assert.deepEqual(words, ['The', 'roar', 'of', 'thunder', 'will', 'tear', 'us', 'apart']);
});
