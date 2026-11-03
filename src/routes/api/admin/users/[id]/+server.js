import { error, json } from '@sveltejs/kit';
import { getRequestUser, getSupabaseAdmin } from '$lib/server/supabase-admin';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 72;

async function assertAdmin(admin, user, action) {
	const { data: me, error: e } = await admin
		.from('profiles')
		.select('department')
		.eq('id', user.id)
		.maybeSingle();
	if (e) error(500, e.message);

	const depts = (Array.isArray(me?.department) ? me.department : [me?.department]).map((d) =>
		String(d ?? '').trim().toLowerCase()
	);
	if (!depts.includes('admin')) error(403, `Only Admin users can ${action}.`);
}

async function requireAdminCaller(request, action) {
	const caller = await getRequestUser(request);
	if (!caller) error(401, 'Please sign in again.');
	if (caller.app_metadata?.must_change_password) {
		error(403, 'Change your temporary password before using this page.');
	}

	const admin = getSupabaseAdmin();
	await assertAdmin(admin, caller, action);
	return { admin, caller };
}

export async function PATCH({ request, params }) {
	const { admin } = await requireAdminCaller(request, 'set temporary passwords');

	const id = params.id;
	if (!UUID_RE.test(id)) error(400, 'Invalid user id.');

	let body;
	try {
		body = await request.json();
	} catch {
		error(400, 'Invalid JSON body.');
	}

	const password = typeof body?.temporaryPassword === 'string' ? body.temporaryPassword : '';
	if (password.length < MIN_PASSWORD) {
		error(400, `The temporary password must be at least ${MIN_PASSWORD} characters.`);
	}
	if (password.length > MAX_PASSWORD) {
		error(400, `The temporary password must be at most ${MAX_PASSWORD} characters.`);
	}

	const { data: found, error: getError } = await admin.auth.admin.getUserById(id);
	const target = found?.user;
	if (getError || !target) {
		error(404, 'This user does not have a sign-in account, so a password cannot be set.');
	}
	if (target.last_sign_in_at) {
		error(409, 'This user has already signed in, so a new temporary password cannot be set here.');
	}

	const { error: updateError } = await admin.auth.admin.updateUserById(id, {
		password,
		email_confirm: true,
		app_metadata: { ...(target.app_metadata ?? {}), must_change_password: true }
	});

	if (updateError) {
		console.error('[admin/users] set temporary password failed:', updateError);
		if (/password/i.test(updateError.message)) error(400, updateError.message);
		error(502, updateError.message);
	}

	return json({ ok: true });
}

export async function DELETE({ request, params }) {
	const { caller, admin } = await requireAdminCaller(request, 'delete users');

	const id = params.id;
	if (!UUID_RE.test(id)) error(400, 'Invalid user id.');
	if (id === caller.id) error(400, 'You cannot delete your own account.');

	const { error: authError } = await admin.auth.admin.deleteUser(id);
	const alreadyGone = authError && (authError.status === 404 || /not found/i.test(authError.message));
	if (authError && !alreadyGone) {
		console.error('[admin/users] deleteUser failed:', authError);
		error(
			409,
			`The sign-in account could not be deleted (it may still be linked to submitted records): ${authError.message}`
		);
	}

	const { error: profileError } = await admin.from('profiles').delete().eq('id', id);
	if (profileError) {
		console.error('[admin/users] profile delete failed:', profileError);
		error(500, `The profile could not be deleted: ${profileError.message}`);
	}

	return json({ ok: true });
}