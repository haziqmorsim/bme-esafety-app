import { goto } from '$app/navigation';
import { getSupabase } from '$lib/supabase';
import { authUser, waitForAuthReady } from './auth-store';
import { toast } from '$lib/stores/toast';
import { get } from 'svelte/store';

const SESSION_CHECK_TIMEOUT_MS = 15_000;
const TIMED_OUT = Symbol('timed-out');

function withTimeout(promise, ms) {
	let timer;
	return Promise.race([
		promise,
		new Promise((resolve) => {
			timer = setTimeout(() => resolve(TIMED_OUT), ms);
		})
	]).finally(() => clearTimeout(timer));
}

export async function checkSession(timeoutMs = SESSION_CHECK_TIMEOUT_MS) {
	const supabase = getSupabase();
	if (!supabase) return { ok: true, session: null };

	try {
		const result = await withTimeout(supabase.auth.getSession(), timeoutMs);
		if (result === TIMED_OUT) return { ok: false, session: null };
		return { ok: true, session: result?.data?.session ?? null };
	} catch {
		return { ok: true, session: null };
	}
}

export async function requireUser(redirectTo = '/signin') {
	const supabase = getSupabase();
	if (!supabase) return null;

	await waitForAuthReady(8000);

	const check = await checkSession();
	if (!check.ok) {
		toast.error('The connection to the server was interrupted. Please refresh the page.');
		return null;
	}

	let user = check.session?.user ?? get(authUser);

	if (!user) {
		try {
			const result = await withTimeout(supabase.auth.getUser(), SESSION_CHECK_TIMEOUT_MS);
			user = result === TIMED_OUT ? null : (result?.data?.user ?? null);
		} catch {
			user = null;
		}
	}

	if (!user) {
		await goto(redirectTo);
		return null;
	}

	return { supabase, user };
}