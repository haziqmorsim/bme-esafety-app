import { error, json } from "@sveltejs/kit";
import { timingSafeEqual } from "node:crypto";
import { env } from "$env/dynamic/private";
import { getSupabaseAdmin } from "$lib/server/supabase-admin";
import { FORMS } from "$lib/server/make/payload";

function secretMatches(given) {
    const expected = env.MAKE_CALLBACK_SECRET ?? '';
    if (!expected || !given) return false;
    const a = Buffer.from(String(given));
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST({ request }) {
    if (!secretMatches(request.headers.get('x-make-secret'))) error(401, 'Invalid secret.');

    let body;
    try {
        body = await request.json();
    } catch {
        error(400, 'Invalid JSON body.');
    }

    const form = FORMS[body?.form];
    if (!form || !body?.id) error(400, '"form" and "id" are required.');

    const status = body.status === 'failed' ? 'failed' : 'done';
    const fields = {
        make_status: status,
        make_completed_at: new Date().toISOString(),
        make_error: status === 'failed' ? String(body.error ?? 'Make scenario failed').slice(0, 50) : null
    };
    if (body.report_url) fields.report_url = String(body.report_url);

    const { error: updError } = await getSupabaseAdmin()
        .from(form.table)
        .update(fields)
        .eq('id', String(body.id));

    if (updError) error(500, updError.message);
    return json({ ok: true });
}