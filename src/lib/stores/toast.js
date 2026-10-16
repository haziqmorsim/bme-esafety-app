import { writable } from "svelte/store";

const DEFAULT_DURATION = 4000;
const MAX_VISIBLE = 4;

const { subscribe, update } = writable([]);

let nextId = 1;
const timers = new Map();

function dismiss(id) {
    clearTimeout(timers.get(id));
    timers.delete(id);
    update((list) => list.filter((t) => t.id !== id));
}

function push(type, message, options = {}) {
    const id = nextId++;
    const duration = options.duration ?? (type === 'error' ? 6000 : DEFAULT_DURATION);

    update((list) => {
        const next = [...list, { id, type, message }];
        for (const old of next.slice(0, Math.max(0, next.length - MAX_VISIBLE))) {
            clearTimeout(timers.get(old.id));
            timers.delete(old.id);
        }
        return next.slice(-MAX_VISIBLE);
    });

    if (timers > 0) {
        timers.set(
            id,
            setTimeout(() => dismiss(id), duration)
        );
    }

    return id;
}

export const toasts = { subscribe };

export const toast = {
    success: (message, options) => push('success', message, options),
    error: (message, options) => push('error', message, options),
    info: (message, options) => push('info', message, options),
    dismiss
};