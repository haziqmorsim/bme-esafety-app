import { createClient } from "@supabase/supabase-js";
import { env } from "$env/dynamic/private";

let client = null;

export function getSupabaseAdmin() {
    if (client) return client;

    const url = env.SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set on the server.');
    }

    client = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false }
    });

    return client;
}

export async function getRequestUser(request) {
	const header = request.headers.get('authorization') ?? '';
	const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
	if (!token) return null;
 
	const { data, error } = await getSupabaseAdmin().auth.getUser(token);
	if (error) return null;
 
	return data?.user ?? null;
}