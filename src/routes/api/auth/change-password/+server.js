import { error, json } from "@sveltejs/kit";
import { createClient } from "@supabase/supabase-js";
import { env } from "$env/dynamic/private";
import { getRequestUser, getSupabaseAdmin } from "$lib/server/supabase-admin";

const MIN_PASSWORD = 8;
const MAX_PASSWORD = 72;

async function matchesCurrentPassword(email, password) {
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return false;

    const anon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
    });

    try {
        const { data } = await anon.auth.signInWithPassword({ email, password });
        if (data?.session) {
            await anon.auth.signOut({ scope: 'local' }).catch(() => {});
            return true;
        }
    } catch {
        // treat a failed check as different
    }
    return false;
}

export async function POST({ request }) {
    const user = await getRequestUser(request);
    if (!user) error(401, 'Please sign in again.');

    if (!user.app_metadata?.must_change_password) {
        error(409, 'Your password does not need to be changed here.');
    }

    let body;
    try {
        body = await request.json();
    } catch {
        error(400, 'Invalid JSON body.');
    }

    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';
    if (newPassword.length < MIN_PASSWORD) {
        error(400, `Password must be at least ${MIN_PASSWORD} characters.`);
    }
    if (newPassword.length > MAX_PASSWORD) {
        error(400, `Password must be at most ${MAX_PASSWORD} characters.`);
    }
    if (user.email && (await matchesCurrentPassword(user.email, newPassword))) {
        error(400, 'Choose a password that is different from the temporary one.');
    }

    const { error: updateError } = await getSupabaseAdmin().auth.admin.updateUserById(user.id, {
        password: newPassword,
        app_metadata: {...(user.app_metadata ?? {}), must_change_password: false }
    });

    if (updateError) {
        console.error('[change-password] update failed:', updateError);
        error(updateError.status && updateError.status < 500 ? 400 : 502, updateError.message);
    }

    return json({ ok: true });
}