import { openDialog, el, SurfaceAction, SurfaceHandle } from './surface';
import { notify } from './notify';
import { getCurrentTrackMeta } from './trackCache';
import { normalizeReading } from './furigana';
import type { FuriganaSource } from './furigana';
import { saveFuriganaCorrection, clearFuriganaCorrection } from './furiganaCorrections';
import type { FuriganaCorrectionScope } from './furiganaCorrections';

export interface FuriganaEditRequest {
    trackUri: string;
    lineText: string;
    start: number;
    end: number;
    reading: string;
    autoReading: string;
    source: FuriganaSource;
    candidates: string[];
    origin?: DOMRect | null;
    onChange: () => void;
}

const STYLE_ID = 'slt-furigana-editor-styles';

const EDITOR_STYLES = `
.slt-fe { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.slt-fe-preview { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 14px 12px 12px; border-radius: 14px; background: rgba(255, 255, 255, 0.04); border: 1px solid var(--slt-ui-line); }
.slt-fe-word { font-size: 34px; font-weight: 700; line-height: 1.2; color: var(--slt-ui-ink); }
.slt-fe-word rt { font-size: 0.42em; font-weight: 600; letter-spacing: 0.04em; color: var(--slt-ui-accent); padding-bottom: 2px; }
.slt-fe-context { font-size: 13px; line-height: 1.5; color: var(--slt-ui-ink-faint); text-align: center; overflow-wrap: anywhere; }
.slt-fe-context mark { background: none; color: var(--slt-ui-ink); font-weight: 700; text-decoration: underline; text-decoration-color: var(--slt-ui-accent); text-underline-offset: 3px; }
.slt-fe-label { margin: 0 0 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--slt-ui-ink-faint); }
.slt-fe-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.slt-fe-chip { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--slt-ui-line); background: transparent; color: var(--slt-ui-ink-muted); font: inherit; font-size: 14px; font-weight: 600; padding: 5px 12px; border-radius: 999px; cursor: pointer; transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease; }
.slt-fe-chip:hover { color: var(--slt-ui-ink); border-color: var(--slt-ui-ink-faint); background: rgba(255, 255, 255, 0.05); }
.slt-fe-chip[aria-pressed="true"] { color: var(--slt-ui-accent-ink, #000); background: var(--slt-ui-accent); border-color: transparent; }
.slt-fe-chip:focus-visible { outline: 2px solid var(--slt-ui-accent); outline-offset: 2px; }
.slt-fe-chip-tag { font-size: 10px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; opacity: 0.7; }
.slt-fe-chip-none { font-style: italic; }
.slt-fe-none { margin: 0; font-size: 12.5px; color: var(--slt-ui-ink-faint); }
.slt-fe-scope { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.slt-fe-scope label { position: relative; display: flex; flex-direction: column; gap: 2px; padding: 9px 12px; border-radius: 12px; border: 1px solid var(--slt-ui-line); cursor: pointer; transition: border-color 0.15s ease, background 0.15s ease; }
.slt-fe-scope label:hover { border-color: var(--slt-ui-ink-faint); }
.slt-fe-scope label:has(input:checked) { border-color: var(--slt-ui-accent-line, var(--slt-ui-accent)); background: var(--slt-ui-accent-soft, rgba(255, 255, 255, 0.08)); }
.slt-fe-scope label:has(input:focus-visible) { outline: 2px solid var(--slt-ui-accent); outline-offset: 2px; }
.slt-fe-scope input { position: absolute; opacity: 0; width: 1px; height: 1px; margin: 0; pointer-events: none; }
.slt-fe-scope strong { font-size: 13px; font-weight: 650; color: var(--slt-ui-ink); }
.slt-fe-scope span { font-size: 11.5px; color: var(--slt-ui-ink-faint); }
.slt-fe-hint { margin: 0; font-size: 12px; line-height: 1.5; color: var(--slt-ui-ink-faint); }
`;

function ensureEditorStyles(): void {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = EDITOR_STYLES;
    document.head.appendChild(style);
}

function previewWord(surface: string, reading: string): HTMLElement {
    const ruby = el('ruby', {}, surface);
    ruby.append(el('rt', { text: reading || ' ' }));
    return el('div', { class: 'slt-fe-word' }, ruby);
}

function contextLine(lineText: string, start: number, end: number): HTMLElement {
    return el('div', { class: 'slt-fe-context' },
        lineText.slice(0, start),
        el('mark', { text: lineText.slice(start, end) }),
        lineText.slice(end)
    );
}

function scopeOption(value: FuriganaCorrectionScope, title: string, detail: string, checked: boolean): HTMLElement {
    const input = el('input', { type: 'radio', name: 'slt-fe-scope', value, checked }) as HTMLInputElement;
    return el('label', {}, input, el('strong', { text: title }), el('span', { text: detail }));
}

export function openFuriganaEditor(request: FuriganaEditRequest): SurfaceHandle {
    ensureEditorStyles();
    const { trackUri, lineText, start, end } = request;
    const surface = lineText.slice(start, end);
    const target = { lineText, start, end };
    let selected = request.reading;

    const preview = el('div', { class: 'slt-fe-preview' });
    const renderPreview = () => {
        preview.replaceChildren(previewWord(surface, selected), contextLine(lineText, start, end));
    };

    const input = el('input', {
        class: 'slt-ui-input',
        type: 'text',
        value: request.reading,
        placeholder: 'Type the reading in kana, e.g. さだめ',
        spellcheck: 'false',
        autocomplete: 'off',
        'aria-label': 'Reading',
        'data-slt-autofocus': true,
        'data-slt-esc-local': true
    }) as HTMLInputElement;

    const chips = el('div', { class: 'slt-fe-chips', role: 'group', 'aria-label': 'Dictionary readings' });
    const chipButtons: HTMLButtonElement[] = [];
    const syncChips = () => {
        chipButtons.forEach(chip => chip.setAttribute('aria-pressed', String(chip.dataset.reading === selected)));
    };
    const select = (reading: string) => {
        selected = reading;
        input.value = reading;
        syncChips();
        renderPreview();
    };

    const candidates = request.candidates.filter(Boolean);
    candidates.forEach(reading => {
        const chip = el('button', { class: 'slt-fe-chip', type: 'button', 'data-reading': reading }, reading) as HTMLButtonElement;
        if (reading === request.autoReading) chip.append(el('span', { class: 'slt-fe-chip-tag', text: 'auto' }));
        chip.addEventListener('click', () => select(reading));
        chip.addEventListener('dblclick', () => { select(reading); save(); });
        chipButtons.push(chip);
        chips.append(chip);
    });
    const noneChip = el('button', { class: 'slt-fe-chip slt-fe-chip-none', type: 'button', 'data-reading': '' }, 'No reading') as HTMLButtonElement;
    noneChip.addEventListener('click', () => select(''));
    chipButtons.push(noneChip);
    chips.append(noneChip);

    input.addEventListener('input', () => {
        selected = normalizeReading(input.value);
        syncChips();
        renderPreview();
    });
    input.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.isComposing) {
            event.preventDefault();
            save();
        }
    });

    const scope = el('div', { class: 'slt-fe-scope', role: 'radiogroup', 'aria-label': 'Apply to' },
        scopeOption('line', 'This line', 'And its repeats', request.source !== 'song'),
        scopeOption('song', 'Whole song', `Every ${surface} in this song`, request.source === 'song')
    );

    const root = el('div', { class: 'slt-fe' },
        preview,
        el('div', {},
            el('p', { class: 'slt-fe-label', text: 'Dictionary readings' }),
            candidates.length > 0 ? chips : el('div', {}, el('p', { class: 'slt-fe-none', text: 'The dictionary has no other readings for this word. Type the one the singer uses below.' }), chips)
        ),
        el('div', {}, el('p', { class: 'slt-fe-label', text: 'Reading' }), input),
        el('div', {}, el('p', { class: 'slt-fe-label', text: 'Apply to' }), scope),
        el('p', { class: 'slt-fe-hint', text: 'Katakana and half-width kana are saved as hiragana. Corrections stay on this device for this song only.' })
    );

    let handle: SurfaceHandle | null = null;

    const finish = (ok: boolean, title: string) => {
        if (!ok) {
            notify({ kind: 'error', key: 'slt-furigana-edit-save', title: "Couldn't save the reading", description: 'Spotify refused to store it. Clearing cached translations may free up space.' });
            return;
        }
        handle?.close();
        request.onChange();
        notify({ kind: 'success', key: 'slt-furigana-edit-save', title, duration: 2400 });
    };

    function save(): void {
        const chosenScope = (scope.querySelector('input:checked') as HTMLInputElement | null)?.value === 'song' ? 'song' : 'line';
        const reading = normalizeReading(input.value);
        if (reading === request.autoReading && request.source === 'auto') {
            handle?.close();
            return;
        }
        const ok = reading === request.autoReading && chosenScope === 'line' && request.source === 'line'
            ? clearFuriganaCorrection(trackUri, target)
            : saveFuriganaCorrection(trackUri, target, reading, chosenScope, getCurrentTrackMeta());
        const where = chosenScope === 'song' ? `every ${surface} in this song` : 'this line';
        finish(ok, reading ? `${surface} now reads ${reading} on ${where}` : `${surface} shows no reading on ${where}`);
    }

    const actions: SurfaceAction[] = [];
    if (request.source !== 'auto') {
        actions.push({
            label: 'Use automatic',
            kind: 'ghost',
            keepOpen: true,
            onClick: () => finish(clearFuriganaCorrection(trackUri, target), `${surface} is back to the automatic reading`)
        });
    }
    actions.push({ label: 'Cancel', id: 'cancel' });
    actions.push({ label: 'Save', kind: 'primary', id: 'save', keepOpen: true, onClick: () => save() });

    renderPreview();
    syncChips();
    handle = openDialog({
        title: 'Fix reading',
        eyebrow: 'Furigana',
        content: root,
        size: 'sm',
        origin: request.origin || null,
        actions
    });
    input.select();
    return handle;
}
