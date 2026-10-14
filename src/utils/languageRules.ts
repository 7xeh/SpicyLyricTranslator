import { isSameLanguage, normalizeLanguageCode, normalizeTargetLanguageCode } from './languageDetection';

export const NO_TRANSLATION = 'none';

export interface LanguageRule {
    source: string;
    target: string;
}

export function parseLanguageRules(value: string | null | undefined): LanguageRule[] {
    const rules: LanguageRule[] = [];
    (value || '').split(',').forEach(entry => {
        const [source, target] = entry.split('=').map(part => (part || '').trim());
        if (!source || !target || source === target) return;
        if (rules.some(rule => rule.source === source)) return;
        rules.push({ source, target });
    });
    return rules;
}

export function serializeLanguageRules(rules: LanguageRule[]): string {
    return rules.map(rule => `${rule.source}=${rule.target}`).join(',');
}

export function setLanguageRule(rules: LanguageRule[], source: string, target: string | null): LanguageRule[] {
    const index = rules.findIndex(rule => rule.source === source);
    if (!target) return rules.filter(rule => rule.source !== source);
    if (index === -1) return [...rules, { source, target }];
    return rules.map((rule, i) => (i === index ? { source, target } : rule));
}

export function findLanguageRule(rules: LanguageRule[], sourceLanguage: string | null | undefined): LanguageRule | null {
    if (!sourceLanguage || sourceLanguage === 'unknown' || rules.length === 0) return null;
    const normalized = normalizeLanguageCode(sourceLanguage);
    return rules.find(rule => normalizeTargetLanguageCode(rule.source) === normalized)
        || rules.find(rule => isSameLanguage(sourceLanguage, rule.source))
        || null;
}

export function isNoTranslationRule(rule: LanguageRule | null | undefined): boolean {
    return rule?.target === NO_TRANSLATION;
}
