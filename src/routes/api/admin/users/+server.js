import { error, json } from "@sveltejs/kit";
import { getRequestUser, getSupabaseAdmin } from "$lib/server/supabase-admin";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 72;

const clean = (value) => {
    const text = typeof value === 'string' ? value.trim() : '';
    return text || null;
};

function toDepartment(value) {
    const list = Array.isArray(value) ? value : String(value ?? '').split(',');
    return list.map((v) => String(v).trim()).filter(Boolean);
}

async function assertAdmin(admin, user) {
    const { data: me, error: e } = await admin
        .from('profiles')
        .select('department')
        .eq('id', user.id)
        .maybeSingle();
    if (e) error(500, e.message);

    const depts = (Array.isArray(me?.department) ? me.department : [me?.department]).map((d) => 
        String(d ?? '').trim().toLowerCase()
    );
    if (!depts.includes('admin')) error(403, 'Only Admin users can add users.');
}

export async function POST({ request }) {
    const caller = await getRequestUser(request);
    if (!caller) error(401, 'Please sign in again.');
    if (caller.app_metadata?.must_change_password) {
        error(403, 'Change your temporary password before using this page.');
    }

    const admin = getSupabaseAdmin();
    await assertAdmin(admin, caller);

    let body;
    try {
        body = await request.json();
    } catch {
        error(400, 'Invalid JSON body.');
    }

    const email = String(body?.email ?? '').trim().toLowerCase();
    const password = typeof body?.temporaryPassword === 'string' ? body.temporaryPassword : '';
    const first_name = clean(body?.first_name);
    const last_name = clean(body?.last_name);
    const nickname = clean(body?.nickname);
    const phone = clean(body?.phone);
    const position = clean(body?.position);
    const region = clean(body?.region);
    const department = toDepartment(body?.department);

    if (!first_name) error(400, 'First name is required.');
    if (!EMAIL_RE.test(email)) error(400, 'Enter a valid e-mail address.');
    if (password.length < MIN_PASSWORD) {
        error(400, `The temporary password must be at least ${MIN_PASSWORD} characters.`);
    }
    if (password.length > MAX_PASSWORD) {
        error(400, `The temporary password must be at most ${MAX_PASSWORD} characters.`);
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { first_name, last_name, nickname, phone, department, position, region },
        app_metadata: { must_change_password: true }
    });

    if (createError || !created?.user) {
        const message = createError?.message ?? 'Could not create the user.';
        if (createError?.status === 422 || /already|registered|exists/i.test(message)) {
            error(409, 'A user with this e-mail already exists.');
        }
        if (/password/i.test(message)) error(400, message);
        console.error('[admin/users] createUser: failed', createError);
        error(502, message);
    }

    const id = created.user.id;
    const { data: profile, error: profileError } = await admin
        .from('profiles')
        .upsert(
            { id, email, first_name, last_name, nickname, phone, department, position, region }, 
            { onConflict: 'id' }
        )
        .select('id, email, first_name, last_name, nickname, phone, department, position, region, created_at')
        .single();

    if (profileError) {
        await admin.auth.admin.deleteUser(id).catch(() => {});
        console.error('[admin/users] profile insert failed:', profileError);
        error(500, `The user could not be saved: ${profileError.message}`);
    }

    return json({ user: profile }, { status: 201 });
}