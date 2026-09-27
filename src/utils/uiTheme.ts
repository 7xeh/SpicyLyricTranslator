import type { Tone } from './surface';

export type ThemeConfig = Record<string, unknown>;

interface SpicyThemesState {
    isEnabled?: boolean;
    activeTheme?: ThemeConfig;
}

const MONO_BASE = '#1b1b1b';

const MONO_OVERRIDES: Record<string, string> = {
    '--slt-ui-accent': 'oklch(0.93 0 0)',
    '--slt-ui-accent-hover': 'oklch(0.98 0 0)',
    '--slt-ui-accent-ink': MONO_BASE,
    '--slt-ui-field': MONO_BASE,
    '--slt-ui-field-deep': '#151515',
    '--slt-ui-raised': '#242424',
    '--slt-ui-band': 'linear-gradient(90deg, oklch(0.62 0 0), oklch(0.93 0 0))',
};

function spicyThemesState(): SpicyThemesState | null {
    try {
        const state = (window as any).SpicyThemes?.getState?.();
        return state && typeof state === 'object' ? state : null;
    } catch {
        return null;
    }
}

export function spicyThemesActive(): boolean {
    const state = spicyThemesState();
    return !!state && state.isEnabled !== false && !!state.activeTheme && typeof state.activeTheme === 'object';
}

export const themeState = {
    get activeTheme(): ThemeConfig {
        const state = spicyThemesState();
        return spicyThemesActive() && state?.activeTheme ? state.activeTheme : {};
    },
};

export function adaptToneVars(tone: Tone, vars: Record<string, string>): Record<string, string> {
    if (tone !== 'accent' || spicyThemesActive()) return vars;
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(vars)) {
        out[key] = key in MONO_OVERRIDES
            ? MONO_OVERRIDES[key]
            : value.replace(/oklch\(\s*([\d.]+)\s+[\d.]+\s+[\d.]+\s*\)/g, 'oklch($1 0 0)');
    }
    out['--slt-ui-knob'] = MONO_BASE;
    return out;
}
