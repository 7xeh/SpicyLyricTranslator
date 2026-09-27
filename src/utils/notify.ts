import { state } from './state';
import { toast, dismissToast, ToastHandle, ToastOptions } from './toast';

export type NotifyKind = 'info' | 'success' | 'warning' | 'error';

export interface NotifyOptions extends Omit<ToastOptions, 'kind'> {
    kind?: NotifyKind;
    force?: boolean;
}

function canRenderToasts(): boolean {
    try {
        return typeof document !== 'undefined'
            && typeof document.createElement === 'function'
            && !!document.body
            && typeof document.body.append === 'function'
            && typeof document.head?.appendChild === 'function';
    } catch {
        return false;
    }
}

function allowed(kind: NotifyKind): boolean {
    if (state.notificationLevel === 'off') return false;
    if (state.notificationLevel === 'errors') return kind === 'error' || kind === 'warning';
    return true;
}

function fallback(options: NotifyOptions): null {
    try {
        const spicetify = (globalThis as any).Spicetify;
        spicetify?.showNotification?.(options.title, options.kind === 'error' || options.kind === 'warning');
    } catch {}
    return null;
}

export function notify(input: NotifyOptions | string, isError: boolean = false): ToastHandle | null {
    const options: NotifyOptions = typeof input === 'string'
        ? { title: input, kind: isError ? 'error' : 'success' }
        : input;
    const kind = options.kind || 'info';
    if (!options.force && !allowed(kind)) return null;
    if (!canRenderToasts()) return fallback({ ...options, kind });
    const { force, ...rest } = options;
    return toast({ ...rest, kind });
}

export function dismissNotification(key: string): void {
    if (canRenderToasts()) dismissToast(key);
}
