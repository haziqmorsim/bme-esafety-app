import { error, json } from '@sveltejs/kit';
import { getRequestUser, getSupabaseAdmin } from '$lib/server/supabase-admin';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
	if (!depts.includes('admin')) error(403, 'Only Admin users can delete users.');
}

export async function DELETE({ request, params }) {
	const caller = await getRequestUser(request);
	if (!caller) error(401, 'Please sign in again.');
	if (caller.app_metadata?.must_change_password) {
		error(403, 'Change your temporary password before using this page.');
	}

	const admin = getSupabaseAdmin();
	await assertAdmin(admin, caller);

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