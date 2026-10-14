import { openDialog, el, SurfaceHandle, SurfaceOptions } from './surface';
import { notify } from './notify';
import { state } from './state';
import { getCurrentTrackUri, getCurrentTrackMeta, getTrackCache } from './trackCache';
import { fetchLyricsFromAPI, fetchLyricsForTrackUri } from './lyricsFetcher';
import { forceRetranslate, getVisibleLyricsLineTexts } from './core';
import { getLanguageName } from './languageDetection';
import {
    getUserTranslations,
    saveUserTranslations,
    userTranslationKey,
    cleanUserTranslation,
    isKeepOriginal
} from './userTranslations';

interface EditorLine {
    text: string;
    romanized?: string;
    key: string;
}

interface EditorRow {
    line: EditorLine;
    row: HTMLElement;
    input: HTMLTextAreaElement;
    repeat: boolean;
}

const STYLE_ID = 'slt-user-translation-styles';
const SOURCE_FETCH_TIMEOUT_MS = 4000;

const EDITOR_STYLES = `
.slt-ut { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.slt-ut-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; }
.slt-ut-count { font-size: 13px; font-weight: 650; color: var(--slt-ui-ink); margin-right: auto; }
.slt-ut-check { position: relative; display: inline-flex; align-items: center; gap: 7px; padding: 5px 12px 5px 8px; border-radius: 999px; border: 1px solid var(--slt-ui-line); font-size: 12.5px; font-weight: 600; color: var(--slt-ui-ink-muted); cursor: pointer; user-select: none; transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease; }
.slt-ut-check:hover { color: var(--slt-ui-ink); border-color: var(--slt-ui-ink-faint); }
.slt-ut-check input { position: absolute; opacity: 0; width: 1px; height: 1px; margin: 0; pointer-events: none; }
.slt-ut-check-box { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; flex-shrink: 0; box-sizing: border-box; border-radius: 5px; border: 1.5px solid var(--slt-ui-ink-faint); color: transparent; transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease; }
.slt-ut-check-box svg { width: 10px; height: 10px; }
.slt-ut-check:has(input:checked) { color: var(--slt-ui-ink); border-color: var(--slt-ui-accent-line, var(--slt-ui-accent)); background: var(--slt-ui-accent-soft, rgba(255, 255, 255, 0.08)); }
.slt-ut-check input:checked + .slt-ut-check-box { background: var(--slt-ui-accent); border-color: var(--slt-ui-accent); color: var(--slt-ui-accent-ink, #000); }
.slt-ut-check:has(input:focus-visible) { outline: 2px solid var(--slt-ui-accent); outline-offset: 2px; }
.slt-ut-hint { margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--slt-ui-ink-faint); }
.slt-ut-paste { display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 12px; border: 1px solid var(--slt-ui-line); background: var(--slt-ui-raised, rgba(255, 255, 255, 0.04)); }
.slt-ut-paste[hidden] { display: none; }
.slt-ut-paste textarea { min-height: 120px; padding: 10px 12px; resize: vertical; line-height: 1.45; }
.slt-ut-paste-actions { display: flex; gap: 8px; justify-content: flex-end; }
.slt-ut-rows { display: flex; flex-direction: column; gap: 6px; }
.slt-ut-row { display: grid; grid-template-columns: 28px minmax(0, 1fr) minmax(0, 1.15fr); gap: 12px; align-items: start; padding: 10px 12px; border-radius: 12px; border: 1px solid transparent; background: rgba(255, 255, 255, 0.03); }
.slt-ut-row[hidden] { display: none; }
.slt-ut-row.slt-ut-dirty { border-color: var(--slt-ui-accent-line, rgba(29, 185, 84, 0.45)); }
.slt-ut-num { font-size: 11.5px; font-variant-numeric: tabular-nums; color: var(--slt-ui-ink-faint); padding-top: 3px; text-align: right; }
.slt-ut-src { display: flex; flex-direction: column; gap: 3px; min-width: 0; padding-top: 2px; }
.slt-ut-src-text { font-size: 14px; font-weight: 600; color: var(--slt-ui-ink); overflow-wrap: anywhere; }
.slt-ut-roman { font-size: 12.5px; color: var(--slt-ui-ink-muted); font-style: italic; overflow-wrap: anywhere; }
.slt-ut-auto { font-size: 12.5px; color: var(--slt-ui-ink-faint); overflow-wrap: anywhere; }
.slt-ut-auto-label { font-size: 10.5px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; margin-right: 6px; }
.slt-ut-auto-missing { color: #f0b860; }
.slt-ut-repeat { display: inline-block; margin-left: 6px; padding: 0 6px; border-radius: 999px; font-size: 10.5px; font-weight: 700; color: var(--slt-ui-ink-muted); background: rgba(255, 255, 255, 0.08); vertical-align: middle; }
.slt-ut-edit { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.slt-ut .slt-ut-input { min-height: 38px; padding: 8px 12px; resize: none; overflow: hidden; line-height: 1.4; }
.slt-ut-row.slt-ut-kept .slt-ut-input { color: var(--slt-ui-ink-faint); text-decoration: line-through; }
.slt-ut-tools { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.slt-ut-kept-note { font-size: 11.5px; color: var(--slt-ui-ink-faint); margin-left: 4px; }
.slt-ut-row:not(.slt-ut-kept) .slt-ut-kept-note { display: none; }
.slt-ut-mini { border: 1px solid var(--slt-ui-line); background: transparent; color: var(--slt-ui-ink-muted); font: inherit; font-size: 11.5px; font-weight: 600; padding: 3px 9px; border-radius: 999px; cursor: pointer; transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease; }
.slt-ut-mini:hover { color: var(--slt-ui-ink); border-color: var(--slt-ui-ink-faint); background: rgba(255, 255, 255, 0.05); }
.slt-ut-mini-primary { color: var(--slt-ui-accent-ink, #000); background: var(--slt-ui-accent); border-color: transparent; }
.slt-ut-mini-primary:hover { color: var(--slt-ui-accent-ink, #000); background: var(--slt-ui-accent-hover, var(--slt-ui-accent)); }
.slt-ut-empty { padding: 24px 12px; text-align: center; font-size: 13px; color: var(--slt-ui-ink-muted); }
@media (max-width: 720px) {
    .slt-ut-row { grid-template-columns: 22px minmax(0, 1fr); }
    .slt-ut-edit { grid-column: 2; }
}
`;

function ensureEditorStyles(): void {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = EDITOR_STYLES;
    document.head.appendChild(style);
}

const CHECK_SVG = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function filterChip(input: HTMLInputElement, label: string): HTMLElement {
    return el('label', { class: 'slt-ut-check' }, input, el('span', { class: 'slt-ut-check-box', html: CHECK_SVG }), label);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
    return Promise.race([promise, new Promise<null>(resolve => setTimeout(() => resolve(null), ms))]);
}

function toEditorLines(texts: string[]): EditorLine[] {
    return texts
        .map(text => ({ text: text.trim(), key: userTranslationKey(text) }))
        .filter(line => line.text && line.key);
}

async function loadSourceLines(trackUri: string, targetLang: string): Promise<EditorLine[]> {
    const isCurrent = trackUri === getCurrentTrackUri();
    let lyrics: Awaited<ReturnType<typeof fetchLyricsFromAPI>> = null;
    try {
        lyrics = await withTimeout(isCurrent ? fetchLyricsFromAPI() : fetchLyricsForTrackUri(trackUri), SOURCE_FETCH_TIMEOUT_MS);
    } catch {
        lyrics = null;
    }

    const apiLines = (lyrics?.lineData || [])
        .filter(line => !line.isInstrumental && line.text.trim())
        .map(line => ({
            text: line.text.trim(),
            romanized: line.romanizedText && line.romanizedText !== line.text ? line.romanizedText : undefined,
            key: userTranslationKey(line.text)
        }))
        .filter(line => line.key);
    if (apiLines.length > 0) return apiLines;

    const cachedSource = getTrackCache(trackUri, targetLang)?.sourceLines || [];
    if (cachedSource.length > 0) return toEditorLines(cachedSource);

    return isCurrent ? toEditorLines(getVisibleLyricsLineTexts()) : [];
}

function loadAutoTranslations(trackUri: string, targetLang: string, userLines: Map<string, string>): Map<string, string> {
    const auto = new Map<string, string>();
    const cache = getTrackCache(trackUri, targetLang);
    cache?.sourceLines?.forEach((source, index) => {
        const translated = cleanUserTranslation(cache.lines[index]);
        const key = userTranslationKey(source);
        if (key && translated && !isKeepOriginal(source, translated)) auto.set(key, translated);
    });

    if (trackUri === getCurrentTrackUri() && targetLang === state.targetLanguage) {
        for (const [source, translated] of state.translatedLyrics) {
            const key = userTranslationKey(source);
            const clean = cleanUserTranslation(translated);
            if (!key || !clean || auto.has(key) || userLines.has(key) || isKeepOriginal(source, clean)) continue;
            auto.set(key, clean);
        }
    }
    return auto;
}

function autoGrow(input: HTMLTextAreaElement): void {
    input.style.height = 'auto';
    input.style.height = `${input.scrollHeight + 2}px`;
}

function resolveTrackMeta(trackUri: string, targetLang: string): { trackName?: string; artistName?: string } {
    if (trackUri === getCurrentTrackUri()) return getCurrentTrackMeta();
    const cache = getTrackCache(trackUri, targetLang);
    return { trackName: cache?.trackName, artistName: cache?.artistName };
}

export async function openUserTranslationEditor(options: { trackUri?: string; targetLang?: string } = {}): Promise<void> {
    const trackUri = options.trackUri || getCurrentTrackUri();
    const targetLang = options.targetLang || state.targetLanguage;
    if (!trackUri) {
        notify({ kind: 'warning', key: 'slt-user-translation', title: 'Play a song first', description: 'Your own translation is saved for the song that is playing.' });
        return;
    }

    ensureEditorStyles();
    const sourceLines = await loadSourceLines(trackUri, targetLang);
    if (sourceLines.length === 0) {
        notify({ kind: 'warning', key: 'slt-user-translation', title: 'No lyrics to translate', description: 'Open the song in Spicy Lyrics so its lines can be loaded, then try again.' });
        return;
    }

    const savedLines = getUserTranslations(trackUri, targetLang);
    const autoLines = loadAutoTranslations(trackUri, targetLang, savedLines);
    const meta = resolveTrackMeta(trackUri, targetLang);
    const uniqueKeys = Array.from(new Set(sourceLines.map(line => line.key)));
    const occurrences = new Map<string, number>();
    sourceLines.forEach(line => occurrences.set(line.key, (occurrences.get(line.key) || 0) + 1));
    const missingAutoCount = uniqueKeys.filter(key => !autoLines.has(key)).length;

    const root = el('div', { class: 'slt-ut' });
    const count = el('span', { class: 'slt-ut-count' });
    const missingFilter = el('input', { type: 'checkbox' }) as HTMLInputElement;
    const repeatFilter = el('input', { type: 'checkbox' }) as HTMLInputElement;
    const head = el('div', { class: 'slt-ut-head' },
        count,
        filterChip(missingFilter, `No automatic translation (${missingAutoCount})`),
        filterChip(repeatFilter, 'Hide repeated lines')
    );
    const hint = el('p', {
        class: 'slt-ut-hint',
        text: 'Leave a line empty to keep the automatic translation. Repeated lines share one translation. "Keep original" shows no translation under that line. Your translations stay on this device and survive clearing the cache.'
    });

    const pasteInput = el('textarea', {
        class: 'slt-ui-input',
        placeholder: 'Paste your translation here, one line per lyric line. Blank lines are skipped.',
        spellcheck: 'false'
    }) as HTMLTextAreaElement;
    const pasteApply = el('button', { class: 'slt-ut-mini slt-ut-mini-primary', type: 'button', text: 'Fill lines' });
    const pasteCancel = el('button', { class: 'slt-ut-mini', type: 'button', text: 'Cancel' });
    const pastePanel = el('div', { class: 'slt-ut-paste' }, pasteInput, el('div', { class: 'slt-ut-paste-actions' }, pasteCancel, pasteApply));
    pastePanel.hidden = true;

    const rowsContainer = el('div', { class: 'slt-ut-rows' });
    const emptyFilterNote = el('div', { class: 'slt-ut-empty', text: 'Every line already has an automatic translation.' });
    emptyFilterNote.hidden = true;
    root.append(head, hint, pastePanel, rowsContainer, emptyFilterNote);

    const initialValues = new Map<string, string>(uniqueKeys.map(key => [key, savedLines.get(key) || '']));
    const values = new Map(initialValues);
    const rows: EditorRow[] = [];
    const seen = new Set<string>();

    let handle: SurfaceHandle | null = null;
    let confirmDiscard = false;

    const isDirty = (): boolean => uniqueKeys.some(key => (values.get(key) || '') !== (initialValues.get(key) || ''));

    const refreshRowState = (entry: EditorRow): void => {
        const value = values.get(entry.line.key) || '';
        entry.row.classList.toggle('slt-ut-dirty', value !== (initialValues.get(entry.line.key) || ''));
        entry.row.classList.toggle('slt-ut-kept', Boolean(value) && isKeepOriginal(entry.line.text, value));
    };

    const cancelLabel = (): HTMLElement | null =>
        handle?.footer.querySelector('[data-action="cancel"] .slt-ui-btn-label') as HTMLElement | null;

    const refreshSummary = (): void => {
        const yours = uniqueKeys.filter(key => cleanUserTranslation(values.get(key))).length;
        count.textContent = `${yours} of ${uniqueKeys.length} line${uniqueKeys.length === 1 ? '' : 's'} translated by you`;
        const dirty = isDirty();
        if (handle) {
            dialogOptions.dismissible = !dirty;
            handle.root.dataset.dismissible = String(!dirty);
            const closeButton = handle.panel.querySelector('.slt-ui-x') as HTMLElement | null;
            if (closeButton) closeButton.style.display = dirty ? 'none' : '';
        }
        if (!dirty && confirmDiscard) {
            confirmDiscard = false;
            const label = cancelLabel();
            if (label) label.textContent = 'Cancel';
        }
    };

    const setValue = (key: string, value: string, except?: HTMLTextAreaElement): void => {
        values.set(key, value);
        rows.forEach(entry => {
            if (entry.line.key !== key) return;
            if (entry.input !== except) {
                entry.input.value = value;
                autoGrow(entry.input);
            }
            refreshRowState(entry);
        });
        refreshSummary();
    };

    const applyFilters = (): void => {
        let visible = 0;
        rows.forEach(entry => {
            const hidden = (missingFilter.checked && autoLines.has(entry.line.key)) || (repeatFilter.checked && entry.repeat);
            entry.row.hidden = hidden;
            if (!hidden) visible++;
        });
        emptyFilterNote.hidden = visible > 0;
    };

    sourceLines.forEach((line, index) => {
        const repeat = seen.has(line.key);
        seen.add(line.key);
        const auto = autoLines.get(line.key);
        const total = occurrences.get(line.key) || 1;

        const sourceText = el('div', { class: 'slt-ut-src-text', text: line.text });
        if (!repeat && total > 1) sourceText.append(el('span', { class: 'slt-ut-repeat', text: `×${total}` }));
        if (repeat) sourceText.append(el('span', { class: 'slt-ut-repeat', text: 'repeat' }));

        const autoNode = auto
            ? el('div', { class: 'slt-ut-auto' }, el('span', { class: 'slt-ut-auto-label', text: 'Auto' }), auto)
            : el('div', { class: 'slt-ut-auto slt-ut-auto-missing', text: 'No automatic translation' });

        const input = el('textarea', {
            class: 'slt-ui-input slt-ut-input',
            rows: '1',
            spellcheck: 'false',
            placeholder: auto ? 'Keep the automatic translation' : 'Your translation',
            'aria-label': `Your translation for line ${index + 1}`
        }) as HTMLTextAreaElement;
        input.value = values.get(line.key) || '';

        const tools = el('div', { class: 'slt-ut-tools' });
        if (auto) tools.append(el('button', { class: 'slt-ut-mini', type: 'button', 'data-tool': 'auto', text: 'Use automatic', title: 'Copy the automatic translation into the box to tweak it' }));
        tools.append(
            el('button', { class: 'slt-ut-mini', type: 'button', 'data-tool': 'keep', text: 'Keep original', title: 'Show no translation under this line' }),
            el('button', { class: 'slt-ut-mini', type: 'button', 'data-tool': 'clear', text: 'Clear' }),
            el('span', { class: 'slt-ut-kept-note', text: 'No translation will show for this line' })
        );

        const row = el('div', { class: 'slt-ut-row' },
            el('span', { class: 'slt-ut-num', text: String(index + 1) }),
            el('div', { class: 'slt-ut-src' },
                sourceText,
                line.romanized ? el('div', { class: 'slt-ut-roman', text: line.romanized }) : null,
                autoNode
            ),
            el('div', { class: 'slt-ut-edit' }, input, tools)
        );

        const entry: EditorRow = { line, row, input, repeat };
        rows.push(entry);
        rowsContainer.append(row);
        refreshRowState(entry);

        input.addEventListener('input', () => {
            autoGrow(input);
            setValue(line.key, input.value, input);
        });
        input.addEventListener('keydown', event => {
            if (event.key !== 'Enter' || event.shiftKey) return;
            event.preventDefault();
            const visibleRows = rows.filter(candidate => !candidate.row.hidden);
            const next = visibleRows[visibleRows.indexOf(entry) + 1];
            if (next) next.input.focus();
            else input.blur();
        });
        tools.addEventListener('click', event => {
            const tool = (event.target as HTMLElement).closest('[data-tool]')?.getAttribute('data-tool');
            if (tool === 'auto' && auto) setValue(line.key, auto);
            else if (tool === 'keep') setValue(line.key, line.text);
            else if (tool === 'clear') setValue(line.key, '');
            else return;
            input.focus();
        });
    });

    missingFilter.addEventListener('change', applyFilters);
    repeatFilter.addEventListener('change', applyFilters);

    const fillFromAuto = (): void => {
        uniqueKeys.forEach(key => {
            const auto = autoLines.get(key);
            if (auto && !cleanUserTranslation(values.get(key))) setValue(key, auto);
        });
    };

    const copyTranslations = async (): Promise<void> => {
        const text = sourceLines.map(line => cleanUserTranslation(values.get(line.key)) || autoLines.get(line.key) || '').join('\n');
        try {
            await navigator.clipboard.writeText(text);
            notify({ kind: 'success', key: 'slt-user-translation', title: 'Translation copied', description: 'One line per lyric line, ready to paste back in later.' });
        } catch {
            notify({ kind: 'error', key: 'slt-user-translation', title: "Couldn't copy to the clipboard" });
        }
    };

    pasteCancel.addEventListener('click', () => {
        pastePanel.hidden = true;
        pasteInput.value = '';
    });
    pasteApply.addEventListener('click', () => {
        const pasted = pasteInput.value.split(/\r?\n/).map(cleanUserTranslation).filter(Boolean);
        const targets = rows.filter(entry => !entry.row.hidden);
        const filled = Math.min(pasted.length, targets.length);
        for (let i = 0; i < filled; i++) setValue(targets[i].line.key, pasted[i]);
        pastePanel.hidden = true;
        pasteInput.value = '';
        const extra = pasted.length > targets.length ? ` ${pasted.length - targets.length} pasted line${pasted.length - targets.length === 1 ? ' was' : 's were'} left over.` : '';
        notify({ kind: 'info', key: 'slt-user-translation', title: `Filled ${filled} of ${targets.length} lines`, description: `Check that the lines still match up before saving.${extra}` });
    });

    const save = (): void => {
        const merged = getUserTranslations(trackUri, targetLang);
        uniqueKeys.forEach(key => {
            const value = cleanUserTranslation(values.get(key));
            if (value) merged.set(key, value);
            else merged.delete(key);
        });
        if (!saveUserTranslations(trackUri, targetLang, merged, meta)) {
            notify({ kind: 'error', key: 'slt-user-translation', title: "Couldn't save your translation", description: 'Spotify refused to store it. Clearing cached translations may free up space.' });
            return;
        }
        handle?.close();
        const yours = uniqueKeys.filter(key => merged.has(key)).length;
        notify({
            kind: 'success',
            key: 'slt-user-translation',
            title: yours > 0 ? 'Your translation is saved' : 'Your translation was removed',
            description: yours > 0 ? `${yours} line${yours === 1 ? '' : 's'} will use your wording.` : 'This song is back to automatic translation.'
        });
        if (trackUri === getCurrentTrackUri() && targetLang === state.targetLanguage) forceRetranslate();
    };

    const dialogOptions: SurfaceOptions = {
        title: meta.trackName ? `Translate "${meta.trackName}"` : 'Translate this song yourself',
        eyebrow: `${meta.artistName ? `${meta.artistName} · ` : ''}Into ${getLanguageName(targetLang)}`,
        content: root,
        size: 'xl',
        actions: [
            {
                label: 'More',
                kind: 'ghost',
                menu: [
                    { label: 'Start from the automatic translation', hint: 'Fills empty lines', onClick: fillFromAuto },
                    { label: 'Paste translated lines…', hint: 'One per line', onClick: () => { pastePanel.hidden = false; pasteInput.focus(); } },
                    { label: 'Copy translation', hint: 'Plain text', onClick: () => { void copyTranslations(); } },
                    { label: 'Clear all lines', onClick: () => uniqueKeys.forEach(key => setValue(key, '')) }
                ]
            },
            {
                label: 'Cancel',
                id: 'cancel',
                keepOpen: true,
                onClick: current => {
                    if (!isDirty() || confirmDiscard) {
                        current.close();
                        return;
                    }
                    confirmDiscard = true;
                    const label = cancelLabel();
                    if (label) label.textContent = 'Discard changes?';
                }
            },
            { label: 'Save', id: 'save', kind: 'primary', keepOpen: true, onClick: save }
        ]
    };

    handle = openDialog(dialogOptions);
    rows.forEach(entry => autoGrow(entry.input));
    refreshSummary();
    applyFilters();
    const firstEmpty = rows.find(entry => !entry.input.value);
    (firstEmpty || rows[0])?.input.focus({ preventScroll: true });
}

export default { openUserTranslationEditor };
