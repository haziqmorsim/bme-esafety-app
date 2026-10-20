import { getSupabase } from "./supabase";

const REQUEST_TIMEOUT_MS = 30_000;

export function getSubmitLocation(timeoutMs = 8000) {
    return new Promise((resolve) => {
        if (typeof navigator === 'undefined' || !navigation.geolocation) return resolve('');

        const timer = setTimeout(() => resolve(''), timeoutMs + 500);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                clearTimeout(timer);
                const { latitude, longitude } = pos.coords;
                resolve(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
            },
            () => {
                clearTimeout(timer);
                resolve('');
            },
            { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 }
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

export function sendToMake(form, id, options = {}) {
    return postJson('/api/make/submit', { form, id, ...options });
}

export function sendReport(params) {
    return postJson('/api/make/report', params);
}

const DOWNLOAD_TIMEOUT_MS = 300_000;

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
            const data = res.json().catch(() => ({}));
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