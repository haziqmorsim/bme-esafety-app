import { createClient } from '@supabase/supabase-js';
import { browser } from '$app/environment';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

const REQUEST_TIMEOUT_MS = 30_000;
const STORAGE_TIMEOUT_MS = 180_000;

function fetchWithTimeout(input, init = {}) {
	const url = typeof input === 'string' ? input : (input?.url ?? String(input));
	const timeoutMs = url.includes('/storage/v1/') ? STORAGE_TIMEOUT_MS : REQUEST_TIMEOUT_MS;

	const controller = new AbortController();
	const timer = setTimeout(
		() => controller.abort(new DOMException('The request timed out.', 'TimeoutError')),
		timeoutMs
	);

	const outer = init.signal;
	if (outer) {
		if (outer.aborted) controller.abort(outer.reason);
		else outer.addEventListener('abort', () => controller.abort(outer.reason), { once: true });
	}

	return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

let _client = null;

export function getSupabase() {
	if (!browser) return null;
	if (_client) return _client;

	_client = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		auth: {
			persistSession: true,
			autoRefreshToken: true,
			detectSessionInUrl: true
		},
		global: {
			fetch: fetchWithTimeout
		}
	});

	return _client;
}

export const supabase = getSupabase();