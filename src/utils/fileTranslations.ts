import { detectLanguageHeuristic, isSameLanguage, normalizeLanguageCode } from './languageDetection';
import { cleanLyricText } from './text';
import { userTranslationKey } from './userTranslations';

export type FileTranslationMode = 'match' | 'always' | 'off';

export interface FileTranslationSet {
    language?: string;
    lines: Map<string, string>;
}

interface LineWithTranslation {
    text: string;
    translatedText?: string;
}

const DETECTION_CONFIDENCE = 0.6;
const DETECTION_SAMPLE_LINES = 40;

export function parseFileTranslationMode(value: string | null | undefined): FileTranslationMode {
    return value === 'always' || value === 'off' ? value : 'match';
}

function addLine(lines: Map<string, string>, source: string | null | undefined, translation: string | null | undefined): void {
    const key = userTranslationKey(source);
    const cleaned = cleanLyricText(translation);
    if (!key || !cleaned || userTranslationKey(cleaned) === key || lines.has(key)) return;
    lines.set(key, cleaned);
}

export function collectLineTranslations(lineData: LineWithTranslation[] | null | undefined): FileTranslationSet | null {
    const lines = new Map<string, string>();
    (lineData || []).forEach(line => addLine(lines, line.text, line.translatedText));
    return lines.size > 0 ? { lines } : null;
}

function attr(element: Element, name: string): string | null {
    const direct = element.getAttribute(name);
    if (direct !== null) return direct;
    const local = name.split(':').pop()!;
    for (const attribute of Array.from(element.attributes)) {
        if (attribute.localName === local && attribute.name.endsWith(`:${local}`)) return attribute.value;
    }
    return null;
}

function languageOf(element: Element): string | undefined {
    return attr(element, 'xml:lang') || undefined;
}

function vocalText(node: Node): string {
    let text = '';
    node.childNodes.forEach(child => {
        if (child.nodeType === 3) text += child.nodeValue || '';
        else if (child.nodeType === 1 && !attr(child as Element, 'ttm:role')) text += vocalText(child);
    });
    return text;
}

function setFor(sets: Map<string, FileTranslationSet>, language: string | undefined): FileTranslationSet {
    const key = language ? normalizeLanguageCode(language) : '';
    let set = sets.get(key);
    if (!set) {
        set = { language: language || undefined, lines: new Map() };
        sets.set(key, set);
    }
    return set;
}

export function parseTtmlTranslations(xml: string | null | undefined, parser?: DOMParser): FileTranslationSet[] {
    if (!xml || typeof xml !== 'string') return [];
    const domParser = parser || (typeof DOMParser !== 'undefined' ? new DOMParser() : null);
    if (!domParser) return [];

    const doc = domParser.parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length > 0) return [];

    const sourceByKey = new Map<string, string>();
    const sets = new Map<string, FileTranslationSet>();

    Array.from(doc.getElementsByTagNameNS('*', 'p')).forEach(p => {
        const source = cleanLyricText(vocalText(p));
        const key = attr(p, 'itunes:key');
        if (key && source) sourceByKey.set(key, source);

        Array.from(p.children)
            .filter(child => attr(child, 'ttm:role') === 'x-translation')
            .forEach(span => addLine(setFor(sets, languageOf(span)).lines, source, span.textContent));
    });

    Array.from(doc.getElementsByTagNameNS('*', 'translation')).forEach(translation => {
        const set = setFor(sets, languageOf(translation));
        Array.from(translation.getElementsByTagNameNS('*', 'text')).forEach(entry => {
            const source = sourceByKey.get(attr(entry, 'for') || '');
            if (source) addLine(set.lines, source, entry.textContent);
        });
    });

    return Array.from(sets.values()).filter(set => set.lines.size > 0);
}

export function detectSetLanguage(set: FileTranslationSet): string | undefined {
    if (set.language) return set.language;
    const sample = Array.from(set.lines.values()).slice(0, DETECTION_SAMPLE_LINES).join('\n');
    const detected = detectLanguageHeuristic(sample);
    return detected && detected.confidence >= DETECTION_CONFIDENCE ? detected.code : undefined;
}

export function resolveFileTranslations(
    sets: FileTranslationSet[] | null | undefined,
    mode: FileTranslationMode,
    targetLang: string
): Map<string, string> {
    if (mode === 'off' || !sets || sets.length === 0) return new Map();

    const ranked = sets.map(set => {
        const language = detectSetLanguage(set);
        return { set, language, matches: !language || isSameLanguage(language, targetLang) };
    });

    const matching = ranked.filter(entry => entry.matches);
    const chosen = matching.length > 0
        ? matching
        : mode === 'always'
            ? [ranked.reduce((best, entry) => (entry.set.lines.size > best.set.lines.size ? entry : best))]
            : [];

    const merged = new Map<string, string>();
    chosen
        .sort((a, b) => Number(Boolean(b.set.language)) - Number(Boolean(a.set.language)))
        .forEach(entry => entry.set.lines.forEach((value, key) => { if (!merged.has(key)) merged.set(key, value); }));
    return merged;
}

export function mergeTranslationLines(...maps: Map<string, string>[]): Map<string, string> {
    const merged = new Map<string, string>();
    maps.forEach(map => map.forEach((value, key) => merged.set(key, value)));
    return merged;
}
