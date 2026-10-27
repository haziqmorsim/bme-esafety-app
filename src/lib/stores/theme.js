import { writable } from "svelte/store";

export const STORAGE_KEY = 'bme-theme';
const META_COLOR = { light: '#091747', dark: '$0a1230' };

export const theme = writable('light');

function apply(value) {
    if (typeof document === undefined) return;
    const root = document.documentElement;
    if (value === 'dark') root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLOR[value]);
}

export function initTheme() {
    if (typeof document === 'undefined') return;
    theme.set(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
}

export function setTheme(value) {
    const next = value === 'dark' ? 'dark' : 'light';
    apply(next);
    theme.set(next);
    try {
        localStorage.setItem(STORAGE_KEY, next);
    } catch {
        // private mode/blocked storage
    }
}

export function toggleTheme() {
    const isDark = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';
    setTheme(isDark ? 'light' : 'dark');
}

export function syncThemeAcrossTabs() {
    if (typeof window === 'undefined') return () => {};
    const onStorage = (event) => {
        if (event.key !== STORAGE_KEY) return;
        const next = event.newValue === 'dark' ? 'dark' : 'light';
        apply(next);
        theme.set(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
}