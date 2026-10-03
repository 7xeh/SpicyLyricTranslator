const MODIFIER_ORDER = ['Ctrl', 'Alt', 'Shift', 'Meta'] as const;
const MODIFIER_CODES = new Set(['ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'ShiftLeft', 'ShiftRight', 'MetaLeft', 'MetaRight', 'OSLeft', 'OSRight']);
const CODE_LABELS: Record<string, string> = {
    Space: 'Space',
    Minus: '-',
    Equal: '=',
    BracketLeft: '[',
    BracketRight: ']',
    Backslash: '\\',
    Semicolon: ';',
    Quote: "'",
    Comma: ',',
    Period: '.',
    Slash: '/',
    Backquote: '`',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right'
};

function keyLabelFromCode(code: string): string | null {
    if (!code || MODIFIER_CODES.has(code)) return null;
    if (/^Key[A-Z]$/.test(code)) return code.slice(3);
    if (/^Digit[0-9]$/.test(code)) return code.slice(5);
    if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code;
    return CODE_LABELS[code] || null;
}

function isFunctionKey(key: string): boolean {
    return /^F([1-9]|1[0-9]|2[0-4])$/.test(key);
}

export function hotkeyFromEvent(event: KeyboardEvent): string | null {
    const key = keyLabelFromCode(event.code);
    if (!key) return null;

    const modifiers: string[] = [];
    if (event.ctrlKey) modifiers.push('Ctrl');
    if (event.altKey) modifiers.push('Alt');
    if (event.shiftKey) modifiers.push('Shift');
    if (event.metaKey) modifiers.push('Meta');

    if (modifiers.length === 0 && !isFunctionKey(key)) return null;
    if (modifiers.length === 1 && modifiers[0] === 'Shift' && !isFunctionKey(key)) return null;
    return [...modifiers, key].join('+');
}

export function normalizeHotkey(value: string | null | undefined): string {
    const parts = (value || '').split('+').map(part => part.trim()).filter(Boolean);
    if (parts.length === 0) return '';

    const key = parts[parts.length - 1];
    const modifiers = new Set(parts.slice(0, -1).map(part => {
        const lower = part.toLowerCase();
        if (lower === 'control' || lower === 'ctrl') return 'Ctrl';
        if (lower === 'option' || lower === 'alt') return 'Alt';
        if (lower === 'cmd' || lower === 'command' || lower === 'meta' || lower === 'win') return 'Meta';
        if (lower === 'shift') return 'Shift';
        return part;
    }));
    const ordered = MODIFIER_ORDER.filter(modifier => modifiers.has(modifier));
    return [...ordered, key.length === 1 ? key.toUpperCase() : key].join('+');
}

export function matchesHotkey(event: KeyboardEvent, hotkey: string): boolean {
    const wanted = normalizeHotkey(hotkey);
    if (!wanted) return false;
    const pressed = hotkeyFromEvent(event);
    return pressed !== null && pressed === wanted;
}

export function describeHotkey(hotkey: string): string {
    return normalizeHotkey(hotkey) || 'Off';
}

export function isEditableTarget(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null;
    if (!element || typeof element.closest !== 'function') return false;
    if (element.isContentEditable) return true;
    return Boolean(element.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]'));
}

export function attachHotkeyCapture(input: HTMLInputElement): void {
    input.readOnly = true;
    input.dataset.sltHotkeyCapture = 'true';

    const commit = (value: string) => {
        input.value = value;
        input.dispatchEvent(new Event('change', { bubbles: true }));
    };

    input.addEventListener('keydown', (event: KeyboardEvent) => {
        if (event.key === 'Tab' || event.key === 'Escape') return;
        event.preventDefault();
        event.stopPropagation();

        if (!event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey
            && (event.key === 'Backspace' || event.key === 'Delete')) {
            commit('');
            return;
        }

        const hotkey = hotkeyFromEvent(event);
        if (hotkey) commit(hotkey);
    });
}
