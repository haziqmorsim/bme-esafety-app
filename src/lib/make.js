import { getSupabase } from "./supabase";
import { toast } from "$lib/stores/toast";

const REQUEST_TIMEOUT_MS = 30_000;

const LOCATION_MAX_AGE_MS = 5 * 60 * 1000;
const LOCATION_HARD_LIMIT_MS = 30_000;

const LOCATION_HINTS = {
	unsupported:
		'Your submission location could not be recorded because this browser cannot share its location. Open the app in Chrome or Safari.',
	insecure:
		'Your submission location could not be recorded because the page is not using a secure (https) connection.',
	denied:
		'Your submission location could not be recorded because location access is blocked for this site. Allow location for this site in your browser settings (and turn on Location Services on your phone), then submit again next time.',
	unavailable:
		'Your submission location could not be recorded because your device could not find its position. Turn on Location Services / GPS and try again next time.',
	timeout:
		'Your submission location could not be recorded because finding your position took too long. Make sure Location Services / GPS is on.'
};

let cachedLocation = null;
let pendingLocation = null;
let lastLocationIssue = '';

function requestPosition(options) {
	return new Promise((resolve) => {
		navigator.geolocation.getCurrentPosition(
			(pos) => resolve({ pos }),
			(err) => resolve({ err }),
			options
		);
	});
}

async function readLocation(timeoutMs) {
	lastLocationIssue = '';

	if (typeof navigator === 'undefined' || !navigator.geolocation) {
		lastLocationIssue = 'unsupported';
		return '';
	}
	if (typeof window !== 'undefined' && window.isSecureContext === false) {
		lastLocationIssue = 'insecure';
		return '';
	}

	let result = await requestPosition({
		enableHighAccuracy: false,
		timeout: timeoutMs,
		maximumAge: LOCATION_MAX_AGE_MS
	});
	if (result.err && result.err.code !== 1) {
		result = await requestPosition({ enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 });
	}

	if (result.pos) {
		const { latitude, longitude } = result.pos.coords;
		const value = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
		cachedLocation = { value, at: Date.now() };
		return value;
	}

	const code = result.err?.code;
	lastLocationIssue = code === 1 ? 'denied' : code === 2 ? 'unavailable' : 'timeout';
	console.warn(`[location] Could not get the location (code ${code}): ${result.err?.message}`);
	return '';
}

export function getSubmitLocation(timeoutMs = 12_000) {
	if (cachedLocation && Date.now() - cachedLocation.at < LOCATION_MAX_AGE_MS) {
		return Promise.resolve(cachedLocation.value);
	}
	if (pendingLocation) return pendingLocation;

	const hardLimit = new Promise((resolve) =>
		setTimeout(() => {
			lastLocationIssue = lastLocationIssue || 'timeout';
			resolve('');
		}, LOCATION_HARD_LIMIT_MS)
	);

	pendingLocation = Promise.race([readLocation(timeoutMs), hardLimit])
		.catch(() => '')
		.finally(() => {
			pendingLocation = null;
		});

	return pendingLocation;
}

export function warmUpLocation() {
	if (typeof window === 'undefined') return;
	getSubmitLocation().catch(() => {});
}

export function warnIfNoLocation(location) {
	if (location) return;
	toast.info(LOCATION_HINTS[lastLocationIssue] ?? LOCATION_HINTS.unavailable, { duration: 10_000 });
}

async function accessToken() {
	const supabase = getSupabase();
	const {
		data: { session }
	} = await supabase.auth.getSession();
	return session?.access_token ?? '';
}
 
function friendlyError(err) {
	const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
	return timedOut ? 'The request timed out.' : (err?.message ?? String(err));
}
 
async function postJson(url, body) {
	const token = await accessToken();
	if (!token) return { ok: false, error: 'Your session has expired. Please sign in again.' };
 
	try {
		const res = await fetch(url, {
			method: 'POST',
			headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
		});
 
		const data = await res.json().catch(() => ({}));
		if (!res.ok) return { ok: false, error: data?.message ?? `Request failed (${res.status}).` };
		return { ok: true, data };
	} catch (err) {
		return { ok: false, error: friendlyError(err) };
	}
}
 
/**
 * @param {'hkp'|'ppe'|'tbm'|'idf'|'ipr'|'tnr'|'zca'|'scf'} form
 * @param {string} id
 * @param {{ submitLocation?: string, send?: 'null'|'to', emailTo?: string, force?: boolean }} [options]
 * @returns {Promise<{ ok: boolean, data?: any, error?: string }>}
 */
export function sendToMake(form, id, options = {}) {
	return postJson('/api/make/submit', { form, id, ...options });
}
 
/**
 * @param {{ report: 'claim'|'ot', year: number, month: number, userId?: string|null, recipient: 'staff'|'me' }} params
 */
export function sendReport(params) {
	return postJson('/api/make/report', params);
}
 
const DOWNLOAD_TIMEOUT_MS = 300_000;
 
/**
 * @param {'claim-forms'|'working-days'} kind
 * @param {{ year: number, month: number, userId?: string|null }} params
 * @returns {Promise<{ ok: boolean, fileName?: string, error?: string }>}
 */
export async function downloadReport(kind, params) {
	const token = await accessToken();
	if (!token) return { ok: false, error: 'Your session has expired. Please sign in again.' };
 
	try {
		const res = await fetch(`/api/reports/${kind}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
			body: JSON.stringify(params),
			signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS)
		});
 
		if (!res.ok) {
			const data = await res.json().catch(() => ({}));
			return { ok: false, error: data?.message ?? `Download failed (${res.status}).` };
		}
 
		const disposition = res.headers.get('content-disposition') ?? '';
		const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
		const plain = /filename="([^"]+)"/i.exec(disposition)?.[1];
		const fileName = utf8 ? decodeURIComponent(utf8) : plain || `${kind}.xlsx`;
 
		const url = URL.createObjectURL(await res.blob());
		const a = document.createElement('a');
		a.href = url;
		a.download = fileName;
		document.body.appendChild(a);
		a.click();
		a.remove();
		setTimeout(() => URL.revokeObjectURL(url), 10_000);
 
		return { ok: true, fileName };
	} catch (err) {
		return { ok: false, error: friendlyError(err) };
	}
}