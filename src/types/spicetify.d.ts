declare module 'spcr-settings' {
    export class SettingsSection {
        constructor(name: string, settingsId: string);
        addDropDown(id: string, label: string, options: string[], defaultIndex?: number, callback?: (value: string) => void): void;
        addToggle(id: string, label: string, defaultValue?: boolean, callback?: (value: boolean) => void): void;
        addInput(id: string, label: string, defaultValue?: string, callback?: (value: string) => void): void;
        addButton(id: string, label: string, buttonText: string, callback?: () => void): void;
        getFieldValue<T>(id: string): T;
        setFieldValue(id: string, value: any): void;
        rerender(): void;
        pushSettings(): void;
    }
}

declare const Spicetify: {
    React: typeof React;
    ReactDOM: typeof ReactDOM;
    Platform: {
        History: {
            location: { pathname: string };
            push: (path: string | { pathname: string; state?: any }) => void;
            listen: (callback: (location: any) => void) => () => void;
        };
        PlaybackAPI: any;
    };
    Player: {
        data: {
            item?: {
                uri?: string;
                name?: string;
                artists?: { name: string; uri: string }[];
            };
        };
        addEventListener: (event: string, callback: (e: any) => void) => void;
        removeEventListener: (event: string, callback: (e: any) => void) => void;
    };
    Playbar: {
        Button: new (
            label: string,
            icon: string,
            onClick: (self: any) => void,
            disabled?: boolean,
            active?: boolean,
            registerOnCreate?: boolean
        ) => {
            label: string;
            icon: string;
            active: boolean;
            disabled: boolean;
            element: HTMLButtonElement;
            tippy: any;
            register: () => void;
            deregister: () => void;
        };
        Widget: new (
            label: string,
            icon: string,
            onClick?: (self: any) => void,
            disabled?: boolean,
            active?: boolean,
            registerOnCreate?: boolean
        ) => {
            label: string;
            icon: string;
            active: boolean;
            disabled: boolean;
            element: HTMLButtonElement;
            tippy: any;
            register: () => void;
            deregister: () => void;
        };
    };
    Tippy: (element: Element, options: any) => any;
    TippyProps: any;
    showNotification: (message: string, isError?: boolean, duration?: number) => void;
    PopupModal: {
        display: (options: {
            title: string;
            content: string | HTMLElement;
            isLarge?: boolean;
            onClose?: () => void;
        }) => void;
        hide: () => void;
    };
    LocalStorage: {
        get: (key: string) => string | null;
        set: (key: string, value: string) => void;
    };
    CosmosAsync: {
        get: (url: string, body?: any) => Promise<any>;
        post: (url: string, body?: any, headers?: Record<string, string>) => Promise<any>;
        put: (url: string, body?: any) => Promise<any>;
        del: (url: string, body?: any) => Promise<any>;
    };
    colorExtractor: (uri: string) => Promise<any>;
};

declare interface Window {
    _spicy_lyrics?: any;
    _spicy_lyrics_metadata?: any;
    SpicyLyricTranslater?: any;
}

declare const React: any;
declare const ReactDOM: any;
