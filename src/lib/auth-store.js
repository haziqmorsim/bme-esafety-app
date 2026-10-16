import { writable, get } from 'svelte/store';
import { getSupabase } from './supabase';

export const authReady = writable(false);
export const authUser = writable(null);

let started = false;
let unsub = null;

function setUser(user) {
	const current = get(authUser);
	if ((current?.id ?? null) !== (user?.id ?? null) || current?.email !== user?.email) {
		authUser.set(user ?? null);
	}
}

export function initAuthStore() {
	if (started) return;
	started = true;

	const supabase = getSupabase();
	if (!supabase) {
		authReady.set(true);
		authUser.set(null);
		return;
	}

	const seed = async () => {
		try {
			const {
				data: { session }
			} = await supabase.auth.getSession();

			setUser(session?.user ?? null);
		} catch {
			// Leave the user as-is; requireUser() will try again.
		} finally {
			authReady.set(true);
		}
	};

	seed();

	const { data } = supabase.auth.onAuthStateChange((_event, session) => {
		const user = session?.user ?? null;
		setTimeout(() => {
			setUser(user);
			authReady.set(true);
		}, 0);
	});

	unsub = () => data.subscription.unsubscribe();
}

export function destroyAuthStore() {
	unsub?.();
	unsub = null;
	started = false;
	authReady.set(false);
	authUser.set(null);
}

export async function waitForAuthReady(timeoutMs = 8000) {
	if (get(authReady)) {
		return { ready: true, user: get(authUser) };
	}

	return await new Promise((resolve) => {
		const timer = setTimeout(() => {
			stop();
			resolve({ ready: false, user: get(authUser) });
		}, timeoutMs);

		const unsubReady = authReady.subscribe((ready) => {
			if (ready) {
				stop();
				resolve({ ready: true, user: get(authUser) });
			}
		});

		function stop() {
			clearTimeout(timer);
			unsubReady?.();
		}
	});
}