import { storage } from './storage';
import { el, paintTone, prefersReducedMotion, toastRegion, CLOSE_SVG, Tone } from './surface';

export type ToastKind = 'info' | 'success' | 'warning' | 'error' | 'update';

export interface ToastAction {
    label: string;
    primary?: boolean;
    onClick: (event: MouseEvent, handle: ToastHandle) => void;
}

export interface ToastOptions {
    kind?: ToastKind;
    tone?: Tone;
    title: string;
    description?: string;
    actions?: ToastAction[];
    undo?: () => void;
    duration?: number;
    key?: string;
    inbox?: boolean;
    inboxAction?: { id: string; label: string };
    onDismiss?: () => void;
}

export interface ToastHandle {
    el: HTMLElement;
    close: (reason?: 'dismiss' | 'action' | 'timeout' | 'replace') => void;
    update: (options: Partial<ToastOptions>) => void;
    rect: () => DOMRect;
}

export interface InboxEntry {
    id: string;
    kind: ToastKind;
    title: string;
    description?: string;
    at: number;
    read: boolean;
    actionId?: string;
    actionLabel?: string;
}

const MAX_VISIBLE = 3;
const INBOX_KEY = 'notification-inbox';
const INBOX_LIMIT = 40;
const DEFAULT_DURATION: Record<ToastKind, number> = {
    info: 4200,
    success: 4200,
    warning: 8000,
    error: 8000,
    update: Infinity,
};

const TONE: Record<ToastKind, Tone> = {
    info: 'accent',
    success: 'success',
    warning: 'hotfix',
    error: 'error',
    update: 'accent',
};

const ICONS: Record<ToastKind, string> = {
    info: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 7.2v3.9M8 4.9v.1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    success: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.4l2.9 2.9 6.1-6.3" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    warning: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.2l6.3 11H1.7z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 6.5v3.2M8 11.6v.1" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    error: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    update: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 12.5V3.8M4.3 7.3L8 3.6l3.7 3.7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

interface LiveToast {
    handle: ToastHandle;
    options: ToastOptions;
    count: number;
    timer: number | null;
    startedAt: number;
    remaining: number;
    bar: HTMLElement;
    barAnim: Animation | null;
    closed: boolean;
}

const live: LiveToast[] = [];
const queue: { options: ToastOptions; resolve: (h: ToastHandle) => void }[] = [];
let hovering = false;
let hoverBound = false;

const inboxListeners = new Set<() => void>();
const inboxActions = new Map<string, () => void>();

function readInbox(): InboxEntry[] {
    try {
        const raw = storage.get(INBOX_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.filter(e => e && typeof e.title === 'string') : [];
    } catch {
        return [];
    }
}

function writeInbox(entries: InboxEntry[]): void {
    storage.set(INBOX_KEY, JSON.stringify(entries.slice(0, INBOX_LIMIT)));
    inboxListeners.forEach(fn => { try { fn(); } catch {} });
}

export function getInbox(): InboxEntry[] {
    return readInbox();
}

export function unreadCount(): number {
    return readInbox().filter(e => !e.read).length;
}

export function markInboxRead(): void {
    const entries = readInbox();
    if (!entries.some(e => !e.read)) return;
    writeInbox(entries.map(e => ({ ...e, read: true })));
}

export function clearInbox(): void {
    writeInbox([]);
}

export function removeInboxEntries(match: (entry: InboxEntry) => boolean): void {
    const entries = readInbox();
    const next = entries.filter(e => !match(e));
    if (next.length !== entries.length) writeInbox(next);
}

export function onInboxChange(listener: () => void): () => void {
    inboxListeners.add(listener);
    return () => inboxListeners.delete(listener);
}

export function registerInboxAction(id: string, run: () => void): void {
    inboxActions.set(id, run);
}

export function runInboxAction(id: string): boolean {
    const run = inboxActions.get(id);
    if (!run) return false;
    run();
    return true;
}

function record(options: ToastOptions): void {
    const kind = options.kind || 'info';
    const wants = options.inbox ?? (kind === 'warning' || kind === 'error' || kind === 'update');
    if (!wants) return;
    const entries = readInbox();
    const id = options.key || `${kind}:${options.title}`;
    const next: InboxEntry = {
        id,
        kind,
        title: options.title,
        description: options.description,
        at: Date.now(),
        read: false,
        actionId: options.inboxAction?.id,
        actionLabel: options.inboxAction?.label,
    };
    writeInbox([next, ...entries.filter(e => e.id !== id)]);
}

function bindHover(region: HTMLElement): void {
    if (hoverBound) return;
    hoverBound = true;
    region.addEventListener('mouseenter', () => {
        hovering = true;
        live.forEach(pause);
    });
    region.addEventListener('mouseleave', () => {
        hovering = false;
        live.forEach(resume);
    });
}

function pause(t: LiveToast): void {
    if (t.timer === null) return;
    window.clearTimeout(t.timer);
    t.timer = null;
    t.remaining -= Date.now() - t.startedAt;
    t.barAnim?.pause();
}

function resume(t: LiveToast): void {
    if (t.closed || !Number.isFinite(t.remaining) || t.timer !== null) return;
    t.startedAt = Date.now();
    t.timer = window.setTimeout(() => t.handle.close('timeout'), Math.max(400, t.remaining));
    t.barAnim?.play();
}

function startTimer(t: LiveToast, duration: number): void {
    if (t.timer !== null) window.clearTimeout(t.timer);
    t.timer = null;
    t.barAnim?.cancel();
    t.barAnim = null;
    t.remaining = duration;
    const bar = t.bar.firstElementChild as HTMLElement;
    if (!Number.isFinite(duration)) {
        t.bar.hidden = true;
        return;
    }
    t.bar.hidden = false;
    if (!prefersReducedMotion()) {
        t.barAnim = bar.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration, easing: 'linear', fill: 'forwards' });
    }
    if (hovering) {
        t.barAnim?.pause();
        return;
    }
    t.startedAt = Date.now();
    t.timer = window.setTimeout(() => t.handle.close('timeout'), duration);
}

function fill(node: HTMLElement, t: LiveToast): void {
    const o = t.options;
    const kind = o.kind || 'info';
    paintTone(node, o.tone || TONE[kind]);
    node.setAttribute('role', kind === 'error' || kind === 'warning' ? 'alert' : 'status');
    const icon = node.querySelector('.slt-ui-toast-icon') as HTMLElement;
    icon.innerHTML = ICONS[kind];
    const title = node.querySelector('.slt-ui-toast-title') as HTMLElement;
    title.textContent = o.title;
    if (t.count > 1) title.append(el('span', { class: 'slt-ui-toast-count', text: `×${t.count}` }));
    const desc = node.querySelector('.slt-ui-toast-desc') as HTMLElement;
    desc.textContent = o.description || '';
    desc.hidden = !o.description;
    const actions = node.querySelector('.slt-ui-toast-actions') as HTMLElement;
    actions.innerHTML = '';
    const all: ToastAction[] = [...(o.actions || [])];
    if (o.undo) {
        const undo = o.undo;
        all.unshift({ label: 'Undo', primary: !(o.actions || []).some(a => a.primary), onClick: () => undo() });
    }
    all.forEach(action => {
        const btn = el('button', { class: `slt-ui-toast-btn${action.primary ? ' slt-ui-toast-btn-primary' : ''}`, type: 'button', text: action.label });
        btn.addEventListener('click', (event) => {
            action.onClick(event, t.handle);
            t.handle.close('action');
        });
        actions.append(btn);
    });
    actions.hidden = all.length === 0;
}

function mount(options: ToastOptions): ToastHandle {
    const region = toastRegion();
    bindHover(region);

    const node = el('div', { class: 'slt-ui-toast' },
        el('span', { class: 'slt-ui-toast-icon' }),
        el('div', { class: 'slt-ui-toast-text' },
            el('div', { class: 'slt-ui-toast-title' }),
            el('div', { class: 'slt-ui-toast-desc' }),
            el('div', { class: 'slt-ui-toast-actions' }),
        ),
        el('button', { class: 'slt-ui-toast-x', type: 'button', 'aria-label': 'Dismiss', html: CLOSE_SVG }),
    );
    const bar = el('div', { class: 'slt-ui-toast-timer' }, el('i'));
    node.append(bar);

    const t: LiveToast = {
        handle: null as unknown as ToastHandle,
        options,
        count: 1,
        timer: null,
        startedAt: Date.now(),
        remaining: 0,
        bar,
        barAnim: null,
        closed: false,
    };

    t.handle = {
        el: node,
        rect: () => node.getBoundingClientRect(),
        update: (patch) => {
            t.options = { ...t.options, ...patch };
            fill(node, t);
            if (patch.duration !== undefined || patch.kind) {
                startTimer(t, t.options.duration ?? DEFAULT_DURATION[t.options.kind || 'info']);
            }
        },
        close: (reason = 'dismiss') => {
            if (t.closed) return;
            t.closed = true;
            if (t.timer !== null) window.clearTimeout(t.timer);
            t.barAnim?.cancel();
            const index = live.indexOf(t);
            if (index >= 0) live.splice(index, 1);
            if (reason === 'dismiss') {
                try { t.options.onDismiss?.(); } catch {}
            }
            const done = () => {
                node.remove();
                flushQueue();
            };
            if (prefersReducedMotion() || reason === 'replace') {
                done();
                return;
            }
            const h = node.offsetHeight;
            const anim = node.animate([
                { opacity: 1, transform: 'none', height: `${h}px`, marginBottom: '0px' },
                { opacity: 0, transform: 'translateX(-14px)', height: `${h}px`, marginBottom: '0px', offset: 0.55 },
                { opacity: 0, transform: 'translateX(-14px)', height: '0px', marginBottom: '-10px', paddingTop: '0px', paddingBottom: '0px' },
            ], { duration: 320, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' });
            let finished = false;
            const once = () => {
                if (finished) return;
                finished = true;
                done();
            };
            anim.onfinish = once;
            window.setTimeout(once, 480);
        },
    };

    node.querySelector('.slt-ui-toast-x')?.addEventListener('click', () => t.handle.close('dismiss'));

    fill(node, t);
    region.append(node);
    live.push(t);
    startTimer(t, options.duration ?? DEFAULT_DURATION[options.kind || 'info']);

    if (!prefersReducedMotion()) {
        node.animate([
            { clipPath: 'inset(0 100% 0 0 round 14px)', opacity: 0.4 },
            { clipPath: 'inset(0 0 0 0 round 14px)', opacity: 1 },
        ], { duration: 420, easing: 'cubic-bezier(0.2, 0.9, 0.1, 1)' });
    }
    return t.handle;
}

function flushQueue(): void {
    while (queue.length && live.length < MAX_VISIBLE) {
        const next = queue.shift()!;
        next.resolve(mount(next.options));
    }
}

export function toast(options: ToastOptions): ToastHandle {
    record(options);

    if (options.key) {
        const existing = live.find(t => t.options.key === options.key && !t.closed);
        if (existing) {
            existing.count += options.undo ? 0 : 1;
            if (options.undo) existing.count = 1;
            existing.options = { ...existing.options, ...options };
            fill(existing.handle.el, existing);
            startTimer(existing, options.duration ?? DEFAULT_DURATION[options.kind || 'info']);
            if (!prefersReducedMotion()) {
                existing.handle.el.animate([{ transform: 'translateX(4px)' }, { transform: 'none' }], { duration: 200, easing: 'ease-out' });
            }
            return existing.handle;
        }
    }

    if (live.length >= MAX_VISIBLE) {
        const evictable = live.find(t => Number.isFinite(t.remaining) && !t.options.undo);
        if (evictable) {
            evictable.handle.close('replace');
        } else {
            let resolved: ToastHandle | null = null;
            const proxy: ToastHandle = {
                el: document.createElement('div'),
                rect: () => resolved ? resolved.rect() : new DOMRect(),
                update: (patch) => resolved?.update(patch),
                close: (reason) => {
                    if (resolved) resolved.close(reason);
                    else {
                        const i = queue.findIndex(q => q.options === options);
                        if (i >= 0) queue.splice(i, 1);
                    }
                },
            };
            queue.push({ options, resolve: (h) => { resolved = h; } });
            return proxy;
        }
    }
    return mount(options);
}

export function dismissToast(key: string): void {
    live.filter(t => t.options.key === key).forEach(t => t.handle.close('replace'));
    for (let i = queue.length - 1; i >= 0; i--) {
        if (queue[i].options.key === key) queue.splice(i, 1);
    }
}

export function notify(message: string, isError = false): ToastHandle {
    return toast({ kind: isError ? 'error' : 'success', title: message });
}
