import { getSupabase } from "./supabase";

export async function callEdgeFunction(name, body) {
    const supabase = getSupabase();
    if (!supabase) {
        return { ok: false, data: null, code: 'no_client', message: 'Please try again in the browser.' };
    }

    const { data, error } = await supabase.functions.invoke(name, { body });
    if (!error) return { ok: true, data, code: null, message: '' };

    let code = null;
    let message = 'Something went wrong. Please try again.';
    try {
        const res = /** @type {any} */ (error).context;
        const detail = res && typeof res.json === 'function' ? await res.json() : null;
        if (detail?.error) code = String(detail.error);
        if (detail?.message) message = String(detail.message);
        else if (detail?.error && !/^[a-z_]+$/.test(detail.error)) message = String(detail.error);
    } catch {
        // keep the default message
    }

    return { ok: false, data: null, code, message };
}