import { writable } from 'svelte/store';
const DEFAULT_DURATION = 5000;
const EXIT_DURATION = 200;
const MAX_VISIBLE = 4;

const { subscribe, update } = writable([]);

let nextId = 1;
const timers = new Map();
const removals = new Map();

const prefersReducedMotion = () =>
	typeof window !== 'undefined' &&
	!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function remove(id) {
	clearTimeout(timers.get(id));
	clearTimeout(removals.get(id));
	timers.delete(id);
	removals.delete(id);
	update((list) => list.filter((t) => t.id !== id));
}

function dismiss(id) {
	if (removals.has(id)) return;

	clearTimeout(timers.get(id));
	timers.delete(id);

	const exitMs = prefersReducedMotion() ? 0 : EXIT_DURATION;
	if (exitMs === 0) {
		remove(id);
		return;
	}

	update((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
	removals.set(
		id,
		setTimeout(() => remove(id), exitMs)
	);
}

function push(type, message, options = {}) {
	const id = nextId++;
	const duration = options.duration ?? DEFAULT_DURATION;

	update((list) => {
		const next = [...list, { id, type, message, leaving: false }];
		for (const old of next.slice(0, Math.max(0, next.length - MAX_VISIBLE))) {
			clearTimeout(timers.get(old.id));
			clearTimeout(removals.get(old.id));
			timers.delete(old.id);
			removals.delete(old.id);
		}
		return next.slice(-MAX_VISIBLE);
	});

	if (duration > 0) {
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