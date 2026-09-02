import { getSettingField, readSettingValue } from './settingsModel';
import type { SettingsField } from './settingsModel';
import { applySettingById, openSettingsModal } from './settings';
import { warn } from './debug';

const QUICK_MENU_ID = 'slt-quick-menu';

const QUICK_FIELD_IDS = ['overlay-mode', 'learning-mode', 'show-romanization'];

let outsideClickHandler: ((e: MouseEvent) => void) | null = null;
let keydownHandler: ((e: KeyboardEvent) => void) | null = null;

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function closeQuickMenu(): void {
    const existing = document.getElementById(QUICK_MENU_ID);
    if (existing) existing.remove();

    if (outsideClickHandler) {
        document.removeEventListener('mousedown', outsideClickHandler, true);
        outsideClickHandler = null;
    }
    if (keydownHandler) {
        document.removeEventListener('keydown', keydownHandler, true);
        keydownHandler = null;
    }
}

function quickMenuStyles(): string {
    return `
        #${QUICK_MENU_ID} {
            position: fixed;
            z-index: 10000;
            min-width: 236px;
            max-width: 300px;
            padding: 6px;
            box-sizing: border-box;
            border-radius: 8px;
            background: var(--spice-card, #181818);
            border: 1px solid rgba(255, 255, 255, 0.12);
            box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55);
            font-size: 13px;
            color: var(--spice-text, #fff);
            user-select: none;
        }
        #${QUICK_MENU_ID} .slt-qm-group-label {
            padding: 6px 10px 4px;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: var(--spice-subtext, #b3b3b3);
        }
        #${QUICK_MENU_ID} .slt-qm-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            width: 100%;
            padding: 7px 10px;
            border: none;
            border-radius: 5px;
            background: transparent;
            color: inherit;
            font: inherit;
            text-align: left;
            cursor: pointer;
        }
        #${QUICK_MENU_ID} .slt-qm-item:hover {
            background: rgba(255, 255, 255, 0.1);
        }
        #${QUICK_MENU_ID} .slt-qm-check {
            flex: 0 0 auto;
            width: 14px;
            opacity: 0;
            font-weight: 700;
        }
        #${QUICK_MENU_ID} .slt-qm-item[aria-checked="true"] .slt-qm-check {
            opacity: 1;
            color: #1db954;
        }
        #${QUICK_MENU_ID} .slt-qm-label {
            flex: 1 1 auto;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        #${QUICK_MENU_ID} .slt-qm-value {
            flex: 0 0 auto;
            color: var(--spice-subtext, #b3b3b3);
            font-size: 12px;
        }
        #${QUICK_MENU_ID} .slt-qm-sep {
            height: 1px;
            margin: 5px 6px;
            background: rgba(255, 255, 255, 0.1);
        }
        #${QUICK_MENU_ID} select.slt-qm-select {
            flex: 0 0 auto;
            max-width: 130px;
            padding: 3px 6px;
            border-radius: 4px;
            border: 1px solid rgba(255, 255, 255, 0.16);
            background: var(--spice-main, #121212);
            color: var(--spice-text, #fff);
            font: inherit;
            font-size: 12px;
            cursor: pointer;
        }
    `;
}

function syncQuickMenuState(menu: HTMLElement): void {
    menu.querySelectorAll('[data-slt-qm-field]').forEach(el => {
        const item = el as HTMLElement;
        const id = item.dataset.sltQmField || '';
        const field = getSettingField(id);
        if (!field) return;

        const current = readSettingValue(field);
        if (item.dataset.sltQmValue !== undefined) {
            item.setAttribute('aria-checked', String(item.dataset.sltQmValue === String(current)));
        } else {
            item.setAttribute('aria-checked', String(Boolean(current)));
        }
    });
}

function buildToggleRow(field: SettingsField, onChange: () => void): HTMLElement {
    const checked = Boolean(readSettingValue(field));

    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'slt-qm-item';
    item.setAttribute('role', 'menuitemcheckbox');
    item.setAttribute('aria-checked', String(checked));
    item.dataset.sltQmField = field.id;
    item.innerHTML = `
        <span class="slt-qm-check">✓</span>
        <span class="slt-qm-label">${escapeHtml(field.label)}</span>
    `;

    item.addEventListener('click', () => {
        const next = item.getAttribute('aria-checked') !== 'true';
        item.setAttribute('aria-checked', String(next));
        applySettingById(field.id, next);
        onChange();
    });

    return item;
}

function buildModeRows(field: SettingsField, onChange: () => void): HTMLElement {
    const wrapper = document.createElement('div');
    const current = String(readSettingValue(field));

    const label = document.createElement('div');
    label.className = 'slt-qm-group-label';
    label.textContent = field.label;
    wrapper.appendChild(label);

    (field.options || []).forEach(option => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'slt-qm-item';
        item.setAttribute('role', 'menuitemradio');
        item.setAttribute('aria-checked', String(option.value === current));
        item.dataset.sltQmField = field.id;
        item.dataset.sltQmValue = option.value;
        item.innerHTML = `
            <span class="slt-qm-check">✓</span>
            <span class="slt-qm-label">${escapeHtml(option.text)}</span>
        `;

        item.addEventListener('click', () => {
            wrapper.querySelectorAll('.slt-qm-item').forEach(el => el.setAttribute('aria-checked', 'false'));
            item.setAttribute('aria-checked', 'true');
            applySettingById(field.id, option.value);
            onChange();
        });

        wrapper.appendChild(item);
    });

    return wrapper;
}

function buildSelectRow(field: SettingsField, onChange: () => void): HTMLElement {
    const current = String(readSettingValue(field));

    const row = document.createElement('div');
    row.className = 'slt-qm-item';
    row.style.cursor = 'default';

    const label = document.createElement('span');
    label.className = 'slt-qm-label';
    label.textContent = field.label;

    const select = document.createElement('select');
    select.className = 'slt-qm-select';
    (field.options || []).forEach(option => {
        const opt = document.createElement('option');
        opt.value = option.value;
        opt.textContent = option.text;
        if (option.value === current) opt.selected = true;
        select.appendChild(opt);
    });

    select.addEventListener('change', () => {
        applySettingById(field.id, select.value);
        onChange();
    });
    select.addEventListener('mousedown', e => e.stopPropagation());
    select.addEventListener('click', e => e.stopPropagation());

    row.appendChild(label);
    row.appendChild(select);
    return row;
}

function positionMenu(menu: HTMLElement, x: number, y: number): void {
    menu.style.left = '0px';
    menu.style.top = '0px';
    const rect = menu.getBoundingClientRect();
    const margin = 8;

    const left = Math.max(margin, Math.min(x, window.innerWidth - rect.width - margin));
    const top = Math.max(margin, Math.min(y, window.innerHeight - rect.height - margin));

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
}

export function openQuickMenu(x: number, y: number): void {
    closeQuickMenu();

    try {
        const menu = document.createElement('div');
        menu.id = QUICK_MENU_ID;
        menu.setAttribute('role', 'menu');

        const style = document.createElement('style');
        style.textContent = quickMenuStyles();
        menu.appendChild(style);

        const addSeparator = () => {
            const sep = document.createElement('div');
            sep.className = 'slt-qm-sep';
            menu.appendChild(sep);
        };

        const refresh = () => syncQuickMenuState(menu);

        QUICK_FIELD_IDS.forEach((id, index) => {
            const field = getSettingField(id);
            if (!field) return;

            if (index > 0) addSeparator();

            if (field.type === 'toggle') {
                menu.appendChild(buildToggleRow(field, refresh));
            } else if (field.id === 'overlay-mode') {
                menu.appendChild(buildModeRows(field, refresh));
            } else {
                menu.appendChild(buildSelectRow(field, refresh));
            }
        });

        addSeparator();

        const allSettings = document.createElement('button');
        allSettings.type = 'button';
        allSettings.className = 'slt-qm-item';
        allSettings.innerHTML = `
            <span class="slt-qm-check"></span>
            <span class="slt-qm-label">All settings…</span>
        `;
        allSettings.addEventListener('click', () => {
            closeQuickMenu();
            openSettingsModal();
        });
        menu.appendChild(allSettings);

        document.body.appendChild(menu);
        positionMenu(menu, x, y);

        outsideClickHandler = (e: MouseEvent) => {
            if (!menu.contains(e.target as Node)) closeQuickMenu();
        };
        keydownHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeQuickMenu();
        };
        document.addEventListener('mousedown', outsideClickHandler, true);
        document.addEventListener('keydown', keydownHandler, true);
    } catch (e) {
        warn('Failed to open quick menu, falling back to settings:', e);
        openSettingsModal();
    }
}

export default { openQuickMenu, closeQuickMenu };
