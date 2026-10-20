import { error, json } from "@sveltejs/kit";
import { getRequestUser } from "$lib/server/supabase-admin";
import { dispatchSubmission } from "$lib/server/make/dispatch";

export async function POST({ request }) {
    const user = await getRequestUser(request);
    if (!user) error(401, 'Please sign in again.');

    let body;
    try {
        body = await request.json();
    } catch {
        error(400, 'Invalid JSON body.');
    }

    const { form, id, submitLocation, send = 'null', emailTo, force = false } = body ?? {};
    if (!form || !id) error(400, '"form" and "id" are required.');
    if (!['null', 'to'].includes(send)) error(400, '"send" must be "null" or "to".');

    try {
        const result = await dispatchSubmission({
            formKey: String(form),
            id: String(id),
            user,
            send,
            emailTo: emailTo ? String(emailTo).trim() : undefined,
            submitLocation,
            force: !!force
        });
        return json(result);
    } catch (err) {
        if (err?.status) throw err;
        console.error('[make] dispatch failed:', err);
        error(502, err?.message ?? 'Could not reach Make.');
    }
}