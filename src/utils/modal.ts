import { openDialog, topSurface, SurfaceHandle, SurfaceOptions } from './surface';

interface ModalOptions {
    title: string;
    content: HTMLElement | string;
    isLarge?: boolean;
    size?: SurfaceOptions['size'];
    onClose?: (() => void) | null;
}

let legacy: SurfaceHandle | null = null;

export function hideModal(): void {
    topSurface()?.close();
}

export function displayModal(options: ModalOptions): SurfaceHandle {
    const content = typeof options.content === 'string'
        ? Object.assign(document.createElement('div'), { innerHTML: options.content })
        : options.content;
    if (legacy && !legacy.closed && topSurface() === legacy) legacy.close({ silent: true });
    legacy = openDialog({
        title: options.title,
        content,
        size: options.size || (options.isLarge ? 'lg' : 'md'),
        className: 'slt-legacy-dialog',
        onClose: options.onClose || undefined,
    });
    return legacy;
}
