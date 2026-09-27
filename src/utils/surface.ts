import { themeState, ThemeConfig, adaptToneVars } from './uiTheme';
import { Icons } from './icons';

export type Tone = 'accent' | 'hotfix' | 'error' | 'success';

export type ActionKind = 'primary' | 'quiet' | 'danger' | 'ghost';

export interface MenuItem {
    label: string;
    hint?: string;
    onClick: () => void;
}

export interface SurfaceAction {
    label: string;
    kind?: ActionKind;
    id?: string;
    href?: string;
    keepOpen?: boolean;
    menu?: MenuItem[];
    onClick?: (handle: SurfaceHandle) => void | Promise<void>;
}

export interface SurfaceOptions {
    title: string;
    eyebrow?: string;
    tone?: Tone;
    body?: (HTMLElement | string)[];
    content?: HTMLElement;
    actions?: SurfaceAction[];
    size?: 'sm' | 'md' | 'lg' | 'xl';
    bare?: boolean;
    dismissible?: boolean;
    closeButton?: boolean;
    placement?: 'center' | 'top';
    className?: string;
    origin?: DOMRect | null;
    onDismiss?: () => void;
    onClose?: () => void;
}

export interface SurfaceHandle {
    root: HTMLElement;
    panel: HTMLElement;
    body: HTMLElement;
    footer: HTMLElement;
    closed: boolean;
    close: (options?: { silent?: boolean; to?: DOMRect | null }) => void;
    dismiss: () => void;
    setBusy: (busy: boolean, label?: string) => void;
    setActions: (actions: SurfaceAction[]) => void;
    setTitle: (title: string) => void;
    setTone: (tone: Tone) => void;
}

const STYLE_ID = 'slt-ui-styles';
const EASE = 'cubic-bezier(0.2, 0.9, 0.1, 1)';
const BRAND_HUE = 28;
const BRAND_CHROMA = 0.16;

const reducedMotion = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

export function prefersReducedMotion(): boolean {
    return !!reducedMotion?.matches;
}

function parseColor(value: string): [number, number, number] | null {
    if (typeof value !== 'string') return null;
    const v = value.trim();
    const rgb = v.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)/i);
    if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
    let hex = v.replace(/^#/, '');
    if (!/^[0-9a-f]{3,8}$/i.test(hex)) return null;
    if (hex.length === 3 || hex.length === 4) hex = hex.split('').slice(0, 3).map(c => c + c).join('');
    if (hex.length < 6) return null;
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

function toOklch([r8, g8, b8]: [number, number, number]): { l: number; c: number; h: number } {
    const lin = (v: number) => {
        const c = v / 255;
        return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    const r = lin(r8), g = lin(g8), b = lin(b8);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
    const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    const c = Math.sqrt(A * A + B * B);
    let h = Math.atan2(B, A) * 180 / Math.PI;
    if (h < 0) h += 360;
    return { l: L, c, h };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const fmt = (n: number, d = 3) => Number(n.toFixed(d));
const ok = (l: number, c: number, h: number) => `oklch(${fmt(l)} ${fmt(c)} ${fmt(h, 1)})`;

const ACCENT_KEYS: (keyof ThemeConfig)[] = [
    'playerAccentColor',
    'highlightColor',
    'gradientStartColor',
    'gradientEndColor',
    'activeGlowColor',
    'glowColor',
    'eqColor',
    'activeLineColor',
    'sungLineColor',
    'animBgColor',
    'bgGlowColor',
];

const BAND_KEYS: (keyof ThemeConfig)[] = [
    'activeLineColor',
    'gradientStartColor',
    'gradientEndColor',
    'activeGlowColor',
    'sungLineColor',
    'glowColor',
    'notSungLineColor',
];

function themeAccent(theme: ThemeConfig): { h: number; c: number } {
    let best: { h: number; c: number } | null = null;
    for (const key of ACCENT_KEYS) {
        const rgb = parseColor(String(theme[key] ?? ''));
        if (!rgb) continue;
        const { c, h } = toOklch(rgb);
        if (!best || c > best.c) best = { h, c };
    }
    if (!best || best.c < 0.035) return { h: BRAND_HUE, c: BRAND_CHROMA };
    return best;
}

function themeBand(theme: ThemeConfig, accent: string): string {
    const seen = new Set<string>();
    const stops: string[] = [];
    for (const key of BAND_KEYS) {
        const rgb = parseColor(String(theme[key] ?? ''));
        if (!rgb) continue;
        const { l, c, h } = toOklch(rgb);
        const id = `${Math.round(l * 20)}:${Math.round(c * 40)}:${Math.round(h / 20)}`;
        if (seen.has(id)) continue;
        seen.add(id);
        stops.push(ok(clamp(l, 0.55, 0.92), c, h));
        if (stops.length >= 4) break;
    }
    if (stops.length < 2) stops.push(accent);
    stops.unshift(accent);
    return `linear-gradient(90deg, ${stops.join(', ')})`;
}

const FIXED_TONES: Record<Exclude<Tone, 'accent'>, { h: number; c: number }> = {
    hotfix: { h: 72, c: 0.15 },
    error: { h: 24, c: 0.17 },
    success: { h: 152, c: 0.14 },
};

function baseToneVars(tone: Tone = 'accent'): Record<string, string> {
    const theme = themeState.activeTheme;
    const base = tone === 'accent' ? themeAccent(theme) : FIXED_TONES[tone];
    const h = base.h;
    const c = clamp(base.c, 0.09, 0.19);
    const accent = ok(0.76, c, h);
    const band = tone === 'accent'
        ? themeBand(theme, accent)
        : `linear-gradient(90deg, ${ok(0.72, c, h - 18)}, ${accent}, ${ok(0.82, c * 0.8, h + 22)})`;
    return {
        '--slt-ui-hue': String(fmt(h, 1)),
        '--slt-ui-accent': accent,
        '--slt-ui-accent-hover': ok(0.83, c * 0.9, h),
        '--slt-ui-accent-ink': ok(0.22, Math.min(c, 0.08), h),
        '--slt-ui-accent-soft': `color-mix(in oklab, ${accent} 16%, transparent)`,
        '--slt-ui-accent-line': `color-mix(in oklab, ${accent} 42%, transparent)`,
        '--slt-ui-field': ok(0.215, Math.min(c * 0.1, 0.012), h),
        '--slt-ui-field-deep': ok(0.18, Math.min(c * 0.08, 0.009), h),
        '--slt-ui-raised': ok(0.255, Math.min(c * 0.1, 0.012), h),
        '--slt-ui-ink': ok(0.97, 0.004, h),
        '--slt-ui-ink-muted': ok(0.78, 0.008, h),
        '--slt-ui-ink-faint': ok(0.62, 0.008, h),
        '--slt-ui-line': 'rgba(255, 255, 255, 0.08)',
        '--slt-ui-band': band,
    };
}

const painted = new Set<{ el: HTMLElement; tone: Tone }>();

export function paintTone(el: HTMLElement, tone: Tone = 'accent'): void {
    const vars = toneVars(tone);
    Object.entries(vars).forEach(([k, v]) => el.style.setProperty(k, v));
    el.dataset.sltTone = tone;
    for (const entry of painted) {
        if (entry.el === el) {
            entry.tone = tone;
            return;
        }
    }
    painted.add({ el, tone });
}

export function refreshSurfaceTokens(): void {
    for (const entry of [...painted]) {
        if (!entry.el.isConnected) {
            painted.delete(entry);
            continue;
        }
        const vars = toneVars(entry.tone);
        Object.entries(vars).forEach(([k, v]) => entry.el.style.setProperty(k, v));
    }
}

export function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    props: Record<string, string | boolean | number | undefined> = {},
    ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([key, value]) => {
        if (value === undefined || value === false) return;
        if (key === 'class') node.className = String(value);
        else if (key === 'text') node.textContent = String(value);
        else if (key === 'html') node.innerHTML = String(value);
        else node.setAttribute(key, value === true ? '' : String(value));
    });
    children.forEach(child => {
        if (child === null || child === undefined || child === false) return;
        node.append(child);
    });
    return node;
}

export function text(content: string, variant: '' | 'quiet' | 'strong' = ''): HTMLElement {
    return el('p', { class: `slt-ui-text${variant ? ` slt-ui-text-${variant}` : ''}`, text: content });
}

export const CLOSE_SVG = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const CHEVRON_SVG = '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function ensureSurfaceStyles(): void {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = SURFACE_STYLES;
    document.head.appendChild(style);
}

const stack: SurfaceHandle[] = [];
let keyListenerBound = false;

export function topSurface(): SurfaceHandle | null {
    for (let i = stack.length - 1; i >= 0; i--) {
        if (!stack[i].closed) return stack[i];
    }
    return null;
}

export function openSurfaces(): SurfaceHandle[] {
    return stack.filter(s => !s.closed);
}

function focusables(root: HTMLElement): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
        .filter(n => n.offsetParent !== null || n === document.activeElement);
}

function onDocumentKey(event: KeyboardEvent): void {
    const top = topSurface();
    if (!top) return;
    if (event.key === 'Escape') {
        const target = event.target as HTMLElement | null;
        const local = target?.closest?.('[data-slt-esc-local]') as HTMLInputElement | null;
        if (local && top.panel.contains(local) && local.value) return;
        if (document.querySelector('.slt-ui-menu')) {
            event.preventDefault();
            event.stopImmediatePropagation();
            closeMenus();
            return;
        }
        if (top.root.dataset.dismissible === 'false') return;
        event.preventDefault();
        event.stopImmediatePropagation();
        top.dismiss();
        return;
    }
    if (event.key !== 'Tab') return;
    const items = focusables(top.panel);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const current = document.activeElement as HTMLElement | null;
    const inside = !!current && top.panel.contains(current);
    if (event.shiftKey && (current === first || !inside)) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && (current === last || !inside)) {
        event.preventDefault();
        first.focus();
    }
}

function bindKeys(): void {
    if (keyListenerBound) return;
    keyListenerBound = true;
    document.addEventListener('keydown', onDocumentKey, true);
}

function unbindKeysIfIdle(): void {
    if (topSurface() || !keyListenerBound) return;
    keyListenerBound = false;
    document.removeEventListener('keydown', onDocumentKey, true);
}

export function closeMenus(): void {
    document.querySelectorAll('.slt-ui-menu').forEach(menu => {
        (menu as any)._sltCleanup?.();
        menu.remove();
    });
}

export function openMenu(anchor: HTMLElement, items: MenuItem[], within?: HTMLElement): void {
    closeMenus();
    ensureSurfaceStyles();
    const host = within || anchor.closest<HTMLElement>('[data-slt-tone]') || document.body;
    const menu = el('div', { class: 'slt-ui-menu', role: 'menu' });
    items.forEach(item => {
        const btn = el('button', { class: 'slt-ui-menu-item', type: 'button', role: 'menuitem' },
            el('span', { class: 'slt-ui-menu-label', text: item.label }),
            item.hint ? el('span', { class: 'slt-ui-menu-hint', text: item.hint }) : null,
        );
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeMenus();
            item.onClick();
        });
        menu.append(btn);
    });
    host.append(menu);
    const a = anchor.getBoundingClientRect();
    const m = menu.getBoundingClientRect();
    const top = a.top - m.height - 6 >= 8 ? a.top - m.height - 6 : a.bottom + 6;
    const left = clamp(a.right - m.width, 8, window.innerWidth - m.width - 8);
    menu.style.top = `${Math.round(top)}px`;
    menu.style.left = `${Math.round(left)}px`;
    (menu.querySelector('button') as HTMLButtonElement | null)?.focus({ preventScroll: true });
    const onDown = (e: Event) => {
        if (e.target instanceof Node && (menu.contains(e.target) || anchor.contains(e.target))) return;
        closeMenus();
    };
    const onKey = (e: KeyboardEvent) => {
        const buttons = Array.from(menu.querySelectorAll<HTMLButtonElement>('button'));
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (e.key === 'ArrowDown') { e.preventDefault(); buttons[(index + 1) % buttons.length]?.focus(); }
        if (e.key === 'ArrowUp') { e.preventDefault(); buttons[(index - 1 + buttons.length) % buttons.length]?.focus(); }
    };
    window.addEventListener('pointerdown', onDown, true);
    menu.addEventListener('keydown', onKey);
    (menu as any)._sltCleanup = () => window.removeEventListener('pointerdown', onDown, true);
    if (!prefersReducedMotion()) {
        menu.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 160, easing: EASE });
    }
}

function renderActions(footer: HTMLElement, actions: SurfaceAction[], handle: SurfaceHandle): void {
    footer.innerHTML = '';
    footer.hidden = actions.length === 0;
    actions.forEach(action => {
        const kind = action.kind || 'quiet';
        const cls = `slt-ui-btn slt-ui-btn-${kind}${action.menu ? ' slt-ui-btn-menu' : ''}`;
        const node = action.href
            ? el('a', { class: cls, href: action.href, target: '_blank', rel: 'noopener noreferrer', 'data-action': action.id })
            : el('button', { class: cls, type: 'button', 'data-action': action.id });
        node.append(el('span', { class: 'slt-ui-btn-label', text: action.label }));
        if (action.menu) node.insertAdjacentHTML('beforeend', CHEVRON_SVG);
        node.addEventListener('click', async (event) => {
            if (action.menu) {
                event.preventDefault();
                openMenu(node as HTMLElement, action.menu, handle.root);
                return;
            }
            if (!action.href) event.preventDefault();
            if (handle.root.classList.contains('slt-ui-busy')) return;
            try {
                await action.onClick?.(handle);
            } finally {
                if (!action.keepOpen && !handle.closed) handle.close();
            }
        });
        footer.append(node);
    });
}

function eyebrow(label: string): HTMLElement {
    const node = el('div', { class: 'slt-ui-eyebrow' });
    node.innerHTML = `<span class="slt-ui-eyebrow-mark">${Icons.Translate}</span>`;
    node.append(el('span', { text: label }));
    return node;
}

function stagger(nodes: Iterable<Element>, offset = 0): void {
    let i = offset;
    for (const node of nodes) {
        (node as HTMLElement).style.setProperty('--slt-ui-i', String(i++));
    }
}

function buildPanel(options: SurfaceOptions, handleRef: { current: SurfaceHandle | null }, kind: 'dialog' | 'dock') {
    const panel = el('section', {
        class: `slt-ui-panel slt-ui-${kind} slt-ui-size-${options.size || 'md'}${options.bare ? ' slt-ui-bare' : ''}${options.className ? ` ${options.className}` : ''}`,
        role: kind === 'dialog' ? 'dialog' : 'region',
        'aria-modal': kind === 'dialog' ? 'true' : undefined,
        tabindex: '-1',
    });
    const titleId = `slt-ui-title-${Math.random().toString(36).slice(2, 8)}`;
    panel.setAttribute('aria-labelledby', titleId);

    const titleEl = el('h2', { class: 'slt-ui-title', id: titleId, text: options.title });
    const closeBtn = el('button', { class: 'slt-ui-x', type: 'button', 'aria-label': kind === 'dock' ? 'Hide' : 'Close', html: CLOSE_SVG });
    closeBtn.addEventListener('click', () => handleRef.current?.dismiss());

    if (!options.bare) {
        const head = el('header', { class: 'slt-ui-head slt-ui-stagger' },
            eyebrow(options.eyebrow || 'Spicy Lyric Translator'),
            titleEl,
        );
        panel.append(head);
        if (options.closeButton !== false && options.dismissible !== false) panel.append(closeBtn);
    } else {
        titleEl.classList.add('slt-ui-sr');
        panel.append(titleEl);
    }

    const body = el('div', { class: 'slt-ui-body' });
    (options.body || []).forEach(node => {
        const child = typeof node === 'string' ? text(node) : node;
        child.classList.add('slt-ui-stagger');
        body.append(child);
    });
    if (options.content) body.append(options.content);
    panel.append(body);

    const footer = el('footer', { class: 'slt-ui-actions slt-ui-stagger' });
    panel.append(footer);
    return { panel, body, footer, titleEl };
}

function makeHandle(
    root: HTMLElement,
    parts: { panel: HTMLElement; body: HTMLElement; footer: HTMLElement; titleEl: HTMLElement },
    options: SurfaceOptions,
    teardown: (opts: { silent?: boolean; to?: DOMRect | null }) => void,
): SurfaceHandle {
    const handle: SurfaceHandle = {
        root,
        panel: parts.panel,
        body: parts.body,
        footer: parts.footer,
        closed: false,
        close: (opts = {}) => {
            if (handle.closed) return;
            handle.closed = true;
            closeMenus();
            teardown(opts);
            try { options.onClose?.(); } catch {}
        },
        dismiss: () => {
            if (handle.closed || options.dismissible === false) return;
            handle.close();
            try { options.onDismiss?.(); } catch {}
        },
        setBusy: (busy, label) => {
            root.classList.toggle('slt-ui-busy', busy);
            parts.footer.querySelectorAll<HTMLButtonElement>('button').forEach(b => { b.disabled = busy; });
            const primary = parts.footer.querySelector('.slt-ui-btn-primary .slt-ui-btn-label') as HTMLElement | null;
            if (primary) {
                if (busy && label) {
                    primary.dataset.idle = primary.dataset.idle || primary.textContent || '';
                    primary.textContent = label;
                } else if (!busy && primary.dataset.idle) {
                    primary.textContent = primary.dataset.idle;
                    delete primary.dataset.idle;
                }
            }
        },
        setActions: (actions) => renderActions(parts.footer, actions, handle),
        setTitle: (title) => { parts.titleEl.textContent = title; },
        setTone: (tone) => paintTone(root, tone),
    };
    return handle;
}

export function openDialog(options: SurfaceOptions): SurfaceHandle {
    ensureSurfaceStyles();
    const overlay = el('div', { class: `slt-ui-overlay slt-ui-place-${options.placement || 'center'}`, 'data-slt-ui': 'dialog' });
    overlay.dataset.dismissible = String(options.dismissible !== false);
    if (openSurfaces().some(s => s.root.classList.contains('slt-ui-overlay'))) overlay.classList.add('slt-ui-stacked');
    paintTone(overlay, options.tone || 'accent');

    const ref: { current: SurfaceHandle | null } = { current: null };
    const parts = buildPanel(options, ref, 'dialog');
    overlay.append(parts.panel);

    const previousFocus = document.activeElement as HTMLElement | null;
    let pressedBackdrop = false;
    overlay.addEventListener('pointerdown', (e) => { pressedBackdrop = e.target === overlay; });
    overlay.addEventListener('click', (e) => {
        if (pressedBackdrop && e.target === overlay) ref.current?.dismiss();
        pressedBackdrop = false;
    });

    const handle = makeHandle(overlay, parts, options, ({ silent }) => {
        const index = stack.indexOf(handle);
        if (index >= 0) stack.splice(index, 1);
        unbindKeysIfIdle();
        if (previousFocus && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
        overlay.classList.remove('slt-ui-open');
        overlay.classList.add('slt-ui-closing');
        if (silent || prefersReducedMotion()) overlay.remove();
        else setTimeout(() => overlay.remove(), 200);
    });
    ref.current = handle;
    renderActions(parts.footer, options.actions || [], handle);
    stagger(parts.panel.querySelectorAll('.slt-ui-stagger'));

    document.body.append(overlay);
    stack.push(handle);
    bindKeys();
    overlay.getBoundingClientRect();
    overlay.classList.add('slt-ui-open');

    const origin = options.origin;
    if (origin && !prefersReducedMotion()) {
        const r = parts.panel.getBoundingClientRect();
        parts.panel.animate([
            { clipPath: insetFrom(origin, r, 14), opacity: 0.6 },
            { clipPath: 'inset(0 round 18px)', opacity: 1 },
        ], { duration: 460, easing: EASE });
    }

    const primary = parts.footer.querySelector<HTMLElement>('.slt-ui-btn-primary');
    const autofocus = parts.panel.querySelector<HTMLElement>('[data-slt-autofocus]');
    (autofocus || primary || parts.panel).focus({ preventScroll: true });
    return handle;
}

function insetFrom(o: DOMRect, r: DOMRect, radius: number): string {
    const top = clamp(o.top - r.top, 0, r.height);
    const left = clamp(o.left - r.left, 0, r.width);
    const right = clamp(r.right - o.right, 0, r.width);
    const bottom = clamp(r.bottom - o.bottom, 0, r.height);
    if (top + bottom >= r.height - 4 || left + right >= r.width - 4) {
        return `inset(${fmt(r.height / 2 - 20, 0)}px ${fmt(r.width / 2 - 60, 0)}px round ${radius}px)`;
    }
    return `inset(${fmt(top, 0)}px ${fmt(right, 0)}px ${fmt(bottom, 0)}px ${fmt(left, 0)}px round ${radius}px)`;
}

let dockHandle: SurfaceHandle | null = null;

export function activeDock(): SurfaceHandle | null {
    return dockHandle && !dockHandle.closed ? dockHandle : null;
}

export function openDock(options: SurfaceOptions): SurfaceHandle {
    ensureSurfaceStyles();
    dockHandle?.close({ silent: true });
    const region = toastRegion();
    const wrap = el('div', { class: 'slt-ui-dock-wrap', 'data-slt-ui': 'dock' });
    paintTone(wrap, options.tone || 'accent');
    const ref: { current: SurfaceHandle | null } = { current: null };
    const parts = buildPanel({ ...options, size: 'sm' }, ref, 'dock');
    wrap.append(parts.panel);

    const handle = makeHandle(wrap, parts, options, ({ silent, to }) => {
        if (dockHandle === handle) dockHandle = null;
        if (silent || prefersReducedMotion()) {
            wrap.remove();
            return;
        }
        const r = parts.panel.getBoundingClientRect();
        const anim = parts.panel.animate([
            { clipPath: 'inset(0 round 18px)', opacity: 1 },
            to ? { clipPath: insetFrom(to, r, 14), opacity: 0 } : { clipPath: `inset(${fmt(r.height - 6, 0)}px 0 0 0 round 18px)`, opacity: 0 },
        ], { duration: 260, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' });
        anim.onfinish = () => wrap.remove();
        window.setTimeout(() => wrap.remove(), 400);
    });
    ref.current = handle;
    renderActions(parts.footer, options.actions || [], handle);
    stagger(parts.panel.querySelectorAll('.slt-ui-stagger'));

    region.prepend(wrap);
    dockHandle = handle;
    wrap.getBoundingClientRect();
    wrap.classList.add('slt-ui-open');

    if (!prefersReducedMotion()) {
        const r = parts.panel.getBoundingClientRect();
        const from = options.origin
            ? insetFrom(options.origin, r, 14)
            : `inset(${fmt(r.height - 8, 0)}px 0 0 0 round 18px)`;
        parts.panel.animate([
            { clipPath: from },
            { clipPath: 'inset(0 round 18px)' },
        ], { duration: 480, easing: EASE });
    }
    return handle;
}

let region: HTMLElement | null = null;
let regionObserver: ResizeObserver | null = null;
let observedBar: HTMLElement | null = null;

function placeRegion(): void {
    if (!region) return;
    const bar = document.querySelector<HTMLElement>('.Root__now-playing-bar');
    let bottom = 16;
    if (bar) {
        const rect = bar.getBoundingClientRect();
        if (rect.height > 0 && rect.top < window.innerHeight) bottom = Math.max(16, window.innerHeight - rect.top + 12);
    }
    region.style.setProperty('--slt-ui-region-bottom', `${Math.round(bottom)}px`);
    if (bar !== observedBar && typeof ResizeObserver !== 'undefined') {
        regionObserver?.disconnect();
        observedBar = bar;
        if (bar) {
            regionObserver = new ResizeObserver(placeRegion);
            regionObserver.observe(bar);
        }
    }
}

export function toastRegion(): HTMLElement {
    ensureSurfaceStyles();
    if (!region || !region.isConnected) {
        region = el('div', { class: 'slt-ui-region', 'aria-live': 'polite' });
        paintTone(region, 'accent');
        document.body.append(region);
        window.addEventListener('resize', placeRegion);
    }
    placeRegion();
    return region;
}

const SURFACE_STYLES = `
.slt-ui-overlay,
.slt-ui-region,
.slt-ui-menu {
    --slt-ui-ease: ${EASE};
    font-family: var(--encore-body-font-stack, var(--fallback-fonts, system-ui, sans-serif));
    -webkit-font-smoothing: antialiased;
    color: var(--slt-ui-ink);
    letter-spacing: 0;
}
.slt-ui-overlay {
    position: fixed;
    inset: 0;
    z-index: 2147482000;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    padding: 16px;
    background: rgba(0, 0, 0, 0);
    -webkit-backdrop-filter: blur(0) saturate(1);
    backdrop-filter: blur(0) saturate(1);
    transition: background-color 0.24s var(--slt-ui-ease), backdrop-filter 0.24s var(--slt-ui-ease), -webkit-backdrop-filter 0.24s var(--slt-ui-ease);
}
.slt-ui-overlay.slt-ui-place-top {
    align-items: flex-start;
    padding-top: min(14vh, 120px);
}
.slt-ui-overlay.slt-ui-open {
    background: rgba(0, 0, 0, 0.6);
    -webkit-backdrop-filter: blur(6px) saturate(1.1);
    backdrop-filter: blur(6px) saturate(1.1);
}
.slt-ui-overlay.slt-ui-stacked.slt-ui-open {
    background: rgba(0, 0, 0, 0.32);
    -webkit-backdrop-filter: blur(2px);
    backdrop-filter: blur(2px);
}
.slt-ui-overlay.slt-ui-closing {
    pointer-events: none;
    transition-duration: 0.16s;
}
.slt-ui-overlay.slt-ui-peek {
    background: transparent !important;
    -webkit-backdrop-filter: none !important;
    backdrop-filter: none !important;
}
.slt-ui-overlay.slt-ui-peek .slt-ui-panel {
    opacity: 0.06 !important;
    transform: scale(0.99) !important;
    transition: opacity 0.18s var(--slt-ui-ease), transform 0.18s var(--slt-ui-ease);
}
.slt-ui-panel {
    position: relative;
    isolation: isolate;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    width: min(var(--slt-ui-w, 30rem), 100%);
    max-height: 100%;
    overflow: hidden;
    border-radius: 18px;
    border: 1px solid var(--slt-ui-line);
    outline: none;
    background: linear-gradient(180deg, var(--slt-ui-field) 0%, var(--slt-ui-field-deep) 100%);
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.05),
        0 24px 60px -24px rgba(0, 0, 0, 0.7),
        0 0 0 1px rgba(0, 0, 0, 0.25);
    color: var(--slt-ui-ink);
    font-size: 14px;
    line-height: 1.45;
}
.slt-ui-size-sm { --slt-ui-w: 25rem; }
.slt-ui-size-md { --slt-ui-w: 31rem; }
.slt-ui-size-lg { --slt-ui-w: 42rem; }
.slt-ui-size-xl { --slt-ui-w: 68rem; }
.slt-ui-dialog {
    opacity: 0;
    transform: translateY(10px);
    transform: translateY(8px) scale(0.985);
    transition: opacity 0.2s var(--slt-ui-ease), transform 0.4s var(--slt-ui-ease);
}
.slt-ui-open > .slt-ui-dialog {
    opacity: 1;
    transform: none;
}
.slt-ui-closing > .slt-ui-dialog {
    opacity: 0;
    transform: translateY(4px) scale(0.985);
    transition-duration: 0.16s;
    transition-timing-function: cubic-bezier(0.4, 0, 1, 1);
}
.slt-ui-head {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 26px 56px 4px 26px;
}
.slt-ui-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 12px;
    font-weight: 600;
    color: var(--slt-ui-ink-muted);
}
.slt-ui-eyebrow-mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--slt-ui-ink-muted);
}
.slt-ui-eyebrow-mark svg { width: 14px; height: 14px; }
.slt-ui-title {
    margin: 0;
    font-size: 24px;
    font-weight: 750;
    line-height: 1.15;
    letter-spacing: -0.02em;
    color: var(--slt-ui-ink);
    overflow-wrap: anywhere;
}
.slt-ui-sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
}
.slt-ui-x {
    position: absolute;
    top: 16px;
    right: 16px;
    z-index: 3;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: var(--slt-ui-ink-muted);
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
}
.slt-ui-x:hover { background: var(--slt-ui-line); color: var(--slt-ui-ink); }
.slt-ui-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px 26px 4px;
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 0;
    overscroll-behavior: contain;
}
.slt-ui-bare .slt-ui-body { padding: 0; gap: 0; flex: 1 1 auto; }
.slt-ui-body::-webkit-scrollbar { width: 6px; }
.slt-ui-body::-webkit-scrollbar-thumb { background: var(--slt-ui-line); border-radius: 6px; }
.slt-ui-text {
    margin: 0;
    font-size: 14px;
    line-height: 1.55;
    color: var(--slt-ui-ink-muted);
}
.slt-ui-text-quiet { font-size: 12.5px; color: var(--slt-ui-ink-faint); }
.slt-ui-text-strong { color: var(--slt-ui-ink); font-weight: 600; }
.slt-ui-text a, .slt-ui-link {
    color: var(--slt-ui-ink);
    font-weight: 600;
    text-decoration: underline;
    text-decoration-color: var(--slt-ui-accent-line);
    text-underline-offset: 3px;
}
.slt-ui-text a:hover, .slt-ui-link:hover { text-decoration-color: var(--slt-ui-accent); }
.slt-ui-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 18px 26px 24px;
}
.slt-ui-actions[hidden] { display: none; }
.slt-ui-bare .slt-ui-actions { display: none; }
.slt-ui-btn {
    appearance: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    box-sizing: border-box;
    min-height: 40px;
    margin: 0;
    padding: 0 18px;
    border: 0;
    border-radius: 12px;
    font: inherit;
    font-size: 13.5px;
    font-weight: 700;
    white-space: nowrap;
    text-decoration: none;
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease, transform 0.12s ease, box-shadow 0.15s ease;
}
.slt-ui-btn:active:not(:disabled) { transform: scale(0.97); }
.slt-ui-btn:disabled { opacity: 0.55; cursor: default; }
.slt-ui-btn-primary {
    background: var(--slt-ui-accent);
    color: var(--slt-ui-accent-ink);
}
.slt-ui-btn-primary:hover:not(:disabled) { background: var(--slt-ui-accent-hover); }
.slt-ui-btn-quiet {
    background: transparent;
    color: var(--slt-ui-ink-muted);
    padding: 0 14px;
}
.slt-ui-btn-quiet:hover:not(:disabled) { background: var(--slt-ui-line); color: var(--slt-ui-ink); }
.slt-ui-btn-ghost {
    background: var(--slt-ui-line);
    color: var(--slt-ui-ink);
}
.slt-ui-btn-ghost:hover:not(:disabled) { background: color-mix(in oklab, var(--slt-ui-ink) 17%, transparent); }
.slt-ui-btn-danger {
    background: color-mix(in oklab, oklch(0.65 0.18 24) 18%, transparent);
    color: oklch(0.85 0.09 24);
}
.slt-ui-btn-danger:hover:not(:disabled) { background: color-mix(in oklab, oklch(0.65 0.18 24) 28%, transparent); }
.slt-ui-btn-menu svg { opacity: 0.7; }
.slt-ui-btn:focus-visible,
.slt-ui-x:focus-visible,
.slt-ui-menu-item:focus-visible,
.slt-ui-toast button:focus-visible {
    outline: 2px solid var(--slt-ui-accent);
    outline-offset: 2px;
}
.slt-ui-busy .slt-ui-btn-primary .slt-ui-btn-label::before {
    content: '';
    display: inline-block;
    width: 12px;
    height: 12px;
    margin-right: 8px;
    vertical-align: -2px;
    border-radius: 50%;
    border: 2px solid color-mix(in oklab, var(--slt-ui-accent-ink) 30%, transparent);
    border-top-color: var(--slt-ui-accent-ink);
    animation: slt-ui-spin 0.8s linear infinite;
}
@keyframes slt-ui-spin { to { transform: rotate(360deg); } }
.slt-ui-stagger {
    transition: opacity 0.34s var(--slt-ui-ease), transform 0.44s var(--slt-ui-ease), filter 0.44s var(--slt-ui-ease);
    transition-delay: calc(120ms + var(--slt-ui-i, 0) * 40ms);
}
.slt-ui-overlay:not(.slt-ui-open):not(.slt-ui-closing) .slt-ui-stagger,
.slt-ui-dock-wrap:not(.slt-ui-open) .slt-ui-stagger {
    opacity: 0;
    transform: translateY(8px);
    filter: blur(3px);
}
.slt-ui-menu {
    position: fixed;
    z-index: 2147482600;
    min-width: 200px;
    padding: 6px;
    border-radius: 14px;
    border: 1px solid var(--slt-ui-line);
    background: linear-gradient(170deg, var(--slt-ui-raised), var(--slt-ui-field));
    box-shadow: 0 18px 40px -16px rgba(0, 0, 0, 0.75);
}
.slt-ui-menu-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
    width: 100%;
    padding: 9px 12px;
    border: 0;
    border-radius: 9px;
    background: transparent;
    color: var(--slt-ui-ink);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
}
.slt-ui-menu-item:hover, .slt-ui-menu-item:focus { background: var(--slt-ui-line); outline: none; }
.slt-ui-menu-hint { font-size: 11.5px; font-weight: 500; color: var(--slt-ui-ink-faint); }
.slt-ui-region {
    position: fixed;
    left: 16px;
    bottom: var(--slt-ui-region-bottom, 96px);
    z-index: 2147482500;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: flex-start;
    gap: 10px;
    width: min(400px, calc(100vw - 32px));
    pointer-events: none;
}
.slt-ui-region > * { pointer-events: auto; }
.slt-ui-dock-wrap { width: 100%; }
.slt-ui-dock {
    width: 100%;
    max-height: min(70vh, 560px);
    box-shadow:
        inset 0 1px 0 color-mix(in oklab, var(--slt-ui-ink) 10%, transparent),
        0 22px 50px -18px rgba(0, 0, 0, 0.8);
}
.slt-ui-dock .slt-ui-head { padding: 22px 52px 2px 22px; }
.slt-ui-dock .slt-ui-title { font-size: 20px; }
.slt-ui-dock .slt-ui-body { padding: 10px 22px 2px; }
.slt-ui-dock .slt-ui-actions { padding: 16px 22px 20px; }
.slt-ui-dock .slt-ui-x { top: 14px; right: 14px; }
.slt-ui-toast {
    position: relative;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: start;
    gap: 12px;
    width: 100%;
    box-sizing: border-box;
    padding: 13px 12px 14px 14px;
    overflow: hidden;
    border-radius: 14px;
    border: 1px solid var(--slt-ui-line);
    background: linear-gradient(180deg, var(--slt-ui-raised) 0%, var(--slt-ui-field) 100%);
    box-shadow: inset 0 1px 0 color-mix(in oklab, var(--slt-ui-ink) 10%, transparent), 0 16px 36px -14px rgba(0, 0, 0, 0.75);
    color: var(--slt-ui-ink);
    font-size: 13px;
}
.slt-ui-toast-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 8px;
    background: var(--slt-ui-accent-soft);
    color: var(--slt-ui-accent);
}
.slt-ui-toast-icon svg { width: 15px; height: 15px; }
.slt-ui-toast-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; padding-top: 3px; }
.slt-ui-toast-title { font-weight: 650; font-size: 13.5px; line-height: 1.35; overflow-wrap: anywhere; }
.slt-ui-toast-count {
    margin-left: 6px;
    padding: 0 6px;
    border-radius: 999px;
    background: var(--slt-ui-line);
    font-size: 11px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--slt-ui-ink-muted);
}
.slt-ui-toast-desc { font-size: 12.5px; line-height: 1.45; color: var(--slt-ui-ink-muted); overflow-wrap: anywhere; }
.slt-ui-toast-actions { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
.slt-ui-toast-btn {
    appearance: none;
    border: 0;
    border-radius: 9px;
    padding: 6px 11px;
    font: inherit;
    font-size: 12.5px;
    font-weight: 700;
    cursor: pointer;
    background: var(--slt-ui-line);
    color: var(--slt-ui-ink);
    transition: background-color 0.15s ease;
}
.slt-ui-toast-btn:hover { background: color-mix(in oklab, var(--slt-ui-ink) 18%, transparent); }
.slt-ui-toast-btn.slt-ui-toast-btn-primary { background: var(--slt-ui-accent); color: var(--slt-ui-accent-ink); }
.slt-ui-toast-btn.slt-ui-toast-btn-primary:hover { background: var(--slt-ui-accent-hover); }
.slt-ui-toast-x {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    padding: 0;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--slt-ui-ink-faint);
    cursor: pointer;
}
.slt-ui-toast-x:hover { background: var(--slt-ui-line); color: var(--slt-ui-ink); }
.slt-ui-toast-timer {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 2px;
    background: transparent;
}
.slt-ui-toast-timer i {
    display: block;
    height: 100%;
    background: color-mix(in oklab, var(--slt-ui-accent) 55%, transparent);
    transform-origin: left center;
}
.slt-ui-dock .slt-ui-actions { justify-content: flex-start; }
.slt-ui-dock .slt-ui-actions .slt-ui-btn-primary { order: -1; flex: 1 1 100%; }
.slt-ui-dock .slt-ui-actions .slt-ui-btn-ghost { margin-left: auto; }
.slt-ui-text[hidden] { display: none; }
.slt-ui-form { display: flex; flex-direction: column; gap: 12px; }
.slt-ui-field { display: flex; flex-direction: column; gap: 6px; font-size: 12px; font-weight: 650; color: var(--slt-ui-ink-muted); }
.slt-ui-input {
    box-sizing: border-box;
    width: 100%;
    min-height: 40px;
    padding: 0 12px;
    border-radius: 11px;
    border: 1px solid var(--slt-ui-line);
    background: color-mix(in oklab, var(--slt-ui-field-deep) 80%, black);
    color: var(--slt-ui-ink);
    font: inherit;
    font-size: 14px;
    font-weight: 500;
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.slt-ui-input:focus { border-color: var(--slt-ui-accent); box-shadow: 0 0 0 3px var(--slt-ui-accent-soft); }
.slt-ui-input::placeholder { color: var(--slt-ui-ink-faint); }
body.slt-update-waiting #TranslateToggle { position: relative; }
body.slt-update-waiting #TranslateToggle::after {
    content: '';
    position: absolute;
    top: 3px;
    right: 3px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: oklch(0.8 0.15 ${BRAND_HUE});
    box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.55);
    pointer-events: none;
}
.slt-ui-ring { width: 18px; height: 18px; transform: rotate(-90deg); }
.slt-ui-ring circle { fill: none; stroke-width: 2.4; }
.slt-ui-ring .slt-ui-ring-track { stroke: var(--slt-ui-line); }
.slt-ui-ring .slt-ui-ring-fill { stroke: var(--slt-ui-accent); stroke-linecap: round; transition: stroke-dashoffset 0.9s linear; }
@media (prefers-reduced-motion: reduce) {
    .slt-ui-overlay, .slt-ui-panel, .slt-ui-stagger, .slt-ui-toast {
        transition-duration: 0.01ms !important;
        transition-delay: 0s !important;
        animation-duration: 0.01ms !important;
    }
    .slt-ui-dialog, .slt-ui-stagger { transform: none !important; filter: none !important; clip-path: none !important; }
}
`;

export function toneVars(tone: Tone = 'accent'): Record<string, string> {
    return adaptToneVars(tone, baseToneVars(tone));
}
