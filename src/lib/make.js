import { getSupabase } from "./supabase";

const REQUEST_TIMEOUT_MS = 30_000;

export function getSubmitLocation(timeoutMs = 10_000) {
	return new Promise((resolve) => {
		if (typeof navigator === 'undefined' || !navigator.geolocation) {
			console.warn('[location] Geolocation is not available in this browser.');
			return resolve('');
		}
 
		const timer = setTimeout(() => {
			console.warn('[location] Timed out waiting for the browser location.');
			resolve('');
		}, timeoutMs + 500);
 
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				clearTimeout(timer);
				const { latitude, longitude } = pos.coords;
				resolve(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
			},
			(err) => {
				console.warn(`[location] Could not get the location (code ${err?.code}): ${err?.message}`);
				clearTimeout(timer);
				resolve('');
			},
			{ enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 300_000 }
		);
	});
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