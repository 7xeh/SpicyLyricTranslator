export const PROFILE_TRIGGER_SELECTOR = [
    '[data-testid="user-widget-link"]',
    '.main-userWidget-box',
    '.main-userWidget-boxCondensed',
].join(', ');

const PROFILE_AVATAR_SELECTOR = '[data-testid="user-widget-avatar"]';
const GLOBAL_NAV_SELECTOR = '#global-nav-bar, .Root__globalNav, .Root__top-bar, .main-topBar-container';
const NOW_PLAYING_BAR_SELECTOR = '.Root__now-playing-bar, .main-nowPlayingBar-nowPlayingBar, [data-npb-layer]';
const SETTINGS_PAGE_SELECTOR = '[data-testid="settings-page"], .x-settings-container';
const SETTINGS_ROW_SELECTOR = '[data-settings-row]';
const MENU_ITEM_SELECTOR = '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]';

function isRendered(element: Element | null | undefined): element is HTMLElement {
    if (!element || !element.isConnected) return false;
    const rect = (element as HTMLElement).getBoundingClientRect?.();
    return !rect || rect.width > 0 || rect.height > 0;
}

export function findProfileTrigger(doc: Document = document): HTMLElement | null {
    const direct = Array.from(doc.querySelectorAll<HTMLElement>(PROFILE_TRIGGER_SELECTOR));
    const rendered = direct.find(isRendered) ?? direct[0];
    if (rendered) return rendered;

    const avatar = doc.querySelector(PROFILE_AVATAR_SELECTOR);
    const avatarButton = avatar?.closest<HTMLElement>('button, [role="button"]');
    if (avatarButton) return avatarButton;

    const nav = doc.querySelector(GLOBAL_NAV_SELECTOR);
    if (!nav) return null;
    const expandable = Array.from(nav.querySelectorAll<HTMLElement>('button[aria-expanded], [role="button"][aria-expanded]'));
    return expandable[expandable.length - 1] ?? null;
}

export function profileTriggerContaining(element: Element | null): HTMLElement | null {
    if (!element) return null;
    const match = element.closest<HTMLElement>(PROFILE_TRIGGER_SELECTOR)
        ?? element.closest(PROFILE_AVATAR_SELECTOR)?.closest<HTMLElement>('button, [role="button"]');
    if (match) return match;
    const trigger = findProfileTrigger(element.ownerDocument);
    return trigger && trigger.contains(element) ? trigger : null;
}

function isTopLevelMenu(menu: Element): boolean {
    const depth = Number.parseInt(menu.getAttribute('data-depth') || '0', 10);
    if (depth > 0) return false;
    return !menu.parentElement?.closest('[role="menu"]');
}

export function findOpenProfileMenu(trigger: HTMLElement | null, doc: Document = document): HTMLElement | null {
    const menus = Array.from(doc.querySelectorAll<HTMLElement>('[role="menu"]'))
        .filter(menu => isRendered(menu) && isTopLevelMenu(menu));
    if (menus.length === 0) return null;

    const controls = trigger?.getAttribute('aria-controls');
    if (controls) {
        const controlled = doc.getElementById(controls);
        const menu = controlled?.matches('[role="menu"]') ? controlled : controlled?.querySelector<HTMLElement>('[role="menu"]');
        if (menu && menus.includes(menu)) return menu;
    }

    const label = trigger?.getAttribute('aria-label')?.trim();
    if (label) {
        const labelled = menus.find(menu => menu.getAttribute('aria-label')?.trim() === label);
        if (labelled) return labelled;
    }

    const labelledBy = (menu: HTMLElement) => {
        const id = menu.getAttribute('aria-labelledby');
        return id ? doc.getElementById(id) : null;
    };
    const ownedByTrigger = menus.find(menu => {
        const labeller = labelledBy(menu);
        return !!labeller && !!trigger && (labeller === trigger || trigger.contains(labeller));
    });
    if (ownedByTrigger) return ownedByTrigger;

    const inContextMenu = menus.filter(menu => menu.closest('#context-menu, [data-encore-id="popover"]'));
    if (inContextMenu.length === 1) return inContextMenu[0];
    return menus.length === 1 ? menus[0] : null;
}

export function menuItemsOf(menu: HTMLElement): HTMLElement[] {
    return Array.from(menu.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR))
        .filter(item => item.parentElement?.closest('[role="menu"]') === menu);
}

export function menuRowOf(item: HTMLElement, menu: HTMLElement): HTMLElement {
    let row: HTMLElement = item;
    while (row.parentElement && row.parentElement !== menu && row.parentElement.getAttribute('role') !== 'group') {
        row = row.parentElement;
    }
    return row;
}

export function findNowPlayingBar(doc: Document = document): HTMLElement | null {
    const legacy = doc.querySelector<HTMLElement>('[data-testid="now-playing-bar"]');
    const candidates = [
        ...Array.from(doc.querySelectorAll<HTMLElement>(NOW_PLAYING_BAR_SELECTOR)),
        ...(legacy?.parentElement ? [legacy.parentElement] : []),
    ];
    return candidates.find(isRendered) ?? candidates[0] ?? null;
}

export function findTopbarActions(doc: Document = document): HTMLElement | null {
    const contentRight = doc.querySelector<HTMLElement>('.main-topBar-topbarContentRight');
    if (contentRight) return contentRight;

    const profile = findProfileTrigger(doc);
    if (profile?.parentElement) return profile.parentElement;

    const history = doc.querySelector('.main-topBar-historyButtons');
    if (history?.parentElement) return history.parentElement;

    return null;
}

export function isOwnElement(element: Element, ownId: string): boolean {
    return !!element.closest(`#${CSS.escape(ownId)}`);
}

export function findSettingsPage(doc: Document = document, ownId?: string): HTMLElement | null {
    const direct = doc.querySelector<HTMLElement>(SETTINGS_PAGE_SELECTOR);
    if (direct) return direct;

    const nativeRow = Array.from(doc.querySelectorAll<HTMLElement>(SETTINGS_ROW_SELECTOR))
        .find(row => !ownId || !isOwnElement(row, ownId));
    const section = nativeRow?.parentElement;
    const page = section?.parentElement;
    if (!page || !page.closest('#main-view, .Root__main-view, main')) return null;
    return page;
}

export function findLastNativeSettingsSection(page: HTMLElement, ownId: string): HTMLElement | null {
    const rows = Array.from(page.querySelectorAll<HTMLElement>(SETTINGS_ROW_SELECTOR))
        .filter(row => !isOwnElement(row, ownId));
    const last = rows[rows.length - 1];
    if (!last) return null;
    let section: HTMLElement = last;
    while (section.parentElement && section.parentElement !== page) section = section.parentElement;
    return section.parentElement === page ? section : null;
}

export function waitForHost<T>(find: () => T | null, timeout: number = 10000): Promise<T | null> {
    return new Promise(resolve => {
        const found = find();
        if (found) {
            resolve(found);
            return;
        }
        let settled = false;
        let scheduled = false;
        const finish = (value: T | null) => {
            if (settled) return;
            settled = true;
            observer.disconnect();
            clearTimeout(timer);
            resolve(value);
        };
        const observer = new MutationObserver(() => {
            if (scheduled) return;
            scheduled = true;
            requestAnimationFrame(() => {
                scheduled = false;
                const value = find();
                if (value) finish(value);
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
        const timer = setTimeout(() => finish(find()), timeout);
    });
}
