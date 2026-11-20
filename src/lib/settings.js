import { get, writable } from 'svelte/store';
import { getSupabase } from '$lib/supabase';

export const SETTINGS_TABLE = 'app_settings';

export const SESSION_TIMEOUT = { min: 5, max: 480, default: 30 };
export const ANNOUNCEMENT_MAX = 300;
export const ANNOUNCEMENT_LEVELS = ['info', 'warning'];
export const MAX_ROUTES = 30;
export const ROUTE_NAME_MAX = 120;
export const ROUTE_AMOUNT_MAX = 9999;

export const DEFAULT_ROUTES = [
	{ id: 'r1', route: 'Peninsular (Hometown) to Klang Valley (KL & Selangor) (Site)', amount: 30 },
	{ id: 'r2', route: 'Peninsular (Hometown) to Other States in Peninsular (Site)', amount: 50 },
	{ id: 'r3', route: 'Peninsular (Hometown) to Sabah/Sarawak (Site)', amount: 65 },
	{ id: 'r4', route: 'Sabah (Hometown) to Sabah (Site)', amount: 50 },
	{ id: 'r5', route: 'Sarawak (Hometown) to Sarawak (Site)', amount: 50 },
	{ id: 'r6', route: 'Sabah (Hometown) to Sarawak (Site)', amount: 65 },
	{ id: 'r7', route: 'Sarawak (Hometown) to Sabah (Site)', amount: 65 },
	{ id: 'r8', route: 'Sabah/Sarawak (Hometown) to Peninsular (Site)', amount: 65 }
];

export function defaultSettings() {
	return {
		session_timeout_minutes: SESSION_TIMEOUT.default,
		announcement: { enabled: false, level: 'info', message: '' },
		site_allowance_routes: DEFAULT_ROUTES.map((route) => ({ ...route }))
	};
}

export const SETTING_KEYS = Object.keys(defaultSettings());

export function cloneSettings(settings) {
	return JSON.parse(JSON.stringify(settings));
}

function normalizeTimeout(value) {
	const n = Number(value);
	return Number.isInteger(n) && n >= SESSION_TIMEOUT.min && n <= SESSION_TIMEOUT.max
		? n
		: SESSION_TIMEOUT.default;
}

function normalizeAnnouncement(value) {
	const fallback = defaultSettings().announcement;
	if (!value || typeof value !== 'object') return fallback;
	return {
		enabled: value.enabled === true,
		level: ANNOUNCEMENT_LEVELS.includes(value.level) ? value.level : 'info',
		message: String(value.message ?? '').slice(0, ANNOUNCEMENT_MAX)
	};
}

function normalizeRoutes(value) {
	if (!Array.isArray(value)) return defaultSettings().site_allowance_routes;
	const routes = [];
	const seen = new Set();
	for (const item of value) {
		const route = String(item?.route ?? '').trim();
		const amount = Number(item?.amount);
		if (!route || !Number.isFinite(amount) || amount <= 0) continue;
		let id = String(item?.id ?? '').trim() || `r${routes.length + 1}`;
		while (seen.has(id)) id = `${id}_`;
		seen.add(id);
		routes.push({ id, route, amount });
	}
	return routes.length > 0 ? routes : defaultSettings().site_allowance_routes;
}

export function settingsFromRows(rows) {
	const byKey = Object.fromEntries((rows ?? []).map((row) => [row.key, row.value]));
	return {
		session_timeout_minutes: normalizeTimeout(byKey.session_timeout_minutes),
		announcement: normalizeAnnouncement(byKey.announcement),
		site_allowance_routes: normalizeRoutes(byKey.site_allowance_routes)
	};
}

export function formatAmount(amount) {
	return String(Number(Number(amount).toFixed(2)));
}

export function routeLabel(route) {
	return `${route.route} ~ RM${formatAmount(route.amount)} / Day`;
}

export function siteAllowanceOptions(routes) {
	return routes.map((route) => ({
		id: route.id,
		value: formatAmount(route.amount),
		label: routeLabel(route)
	}));
}

export function validateSettings(draft) {
	const errors = {};

	const minutes = Number(draft.session_timeout_minutes);
	if (
		draft.session_timeout_minutes === '' ||
		draft.session_timeout_minutes === null ||
		!Number.isInteger(minutes) ||
		minutes < SESSION_TIMEOUT.min ||
		minutes > SESSION_TIMEOUT.max
	) {
		errors.timeout = `Enter a whole number of minutes from ${SESSION_TIMEOUT.min} to ${SESSION_TIMEOUT.max}.`;
	}

	const message = String(draft.announcement?.message ?? '').trim();
	if (draft.announcement?.enabled && !message) {
		errors.announcement = 'Enter the announcement text, or turn the banner off.';
	} else if (message.length > ANNOUNCEMENT_MAX) {
		errors.announcement = `The announcement can be at most ${ANNOUNCEMENT_MAX} characters.`;
	}

	const routes = draft.site_allowance_routes ?? [];
	if (routes.length === 0) {
		errors.routesList = 'Keep at least one route.';
	} else if (routes.length > MAX_ROUTES) {
		errors.routesList = `At most ${MAX_ROUTES} routes are allowed.`;
	}
	const routeErrors = {};
	routes.forEach((item, index) => {
		const problem = {};
		const name = String(item.route ?? '').trim();
		if (!name) problem.route = 'Route is required.';
		else if (name.length > ROUTE_NAME_MAX) problem.route = `At most ${ROUTE_NAME_MAX} characters.`;

		const raw = item.amount;
		const amount = Number(raw);
		if (raw === '' || raw === null || raw === undefined || !Number.isFinite(amount)) {
			problem.amount = 'Enter an amount.';
		} else if (amount <= 0 || amount > ROUTE_AMOUNT_MAX) {
			problem.amount = `Between 0.01 and ${ROUTE_AMOUNT_MAX}.`;
		} else if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) {
			problem.amount = 'At most 2 decimals.';
		}
		if (Object.keys(problem).length) routeErrors[index] = problem;
	});
	if (Object.keys(routeErrors).length) errors.routes = routeErrors;

	return errors;
}

export function cleanSettings(draft) {
	return {
		session_timeout_minutes: Number(draft.session_timeout_minutes),
		announcement: {
			enabled: draft.announcement.enabled === true,
			level: ANNOUNCEMENT_LEVELS.includes(draft.announcement.level)
				? draft.announcement.level
				: 'info',
			message: String(draft.announcement.message ?? '').trim()
		},
		site_allowance_routes: draft.site_allowance_routes.map((item) => ({
			id: String(item.id),
			route: String(item.route).trim(),
			amount: Number(Number(item.amount).toFixed(2))
		}))
	};
}

export const appSettings = writable(defaultSettings());
export const settingsLoaded = writable(false);

export async function fetchSettings() {
	const supabase = getSupabase();
	if (!supabase) return { settings: defaultSettings(), ok: false };

	const { data, error } = await supabase.from(SETTINGS_TABLE).select('key, value');
	if (error) return { settings: defaultSettings(), ok: false, error };
	return { settings: settingsFromRows(data), ok: true };
}

export async function loadSettings() {
	const { settings, ok } = await fetchSettings();
	if (ok) appSettings.set(settings);
	settingsLoaded.set(true);
	return ok;
}

export async function saveSettings(settings, keys = SETTING_KEYS) {
	const supabase = getSupabase();
	if (!supabase) throw new Error('Not connected to the server.');

	const rows = keys.map((key) => ({ key, value: settings[key] }));
	const { data, error } = await supabase
		.from(SETTINGS_TABLE)
		.upsert(rows, { onConflict: 'key' })
		.select('key');

	if (error) throw error;
	if (!data || data.length < rows.length) {
		throw new Error('The settings were not saved. You may not have permission to change them.');
	}

	appSettings.set({ ...get(appSettings), ...settings });
}