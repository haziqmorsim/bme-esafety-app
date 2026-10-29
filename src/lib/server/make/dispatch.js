import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getSupabaseAdmin } from '$lib/server/supabase-admin.js';
import { FORMS, commonFields, makeReportId } from './payload.js';

const SIGNED_URL_SECONDS = 60 * 60 * 24 * 7;
const MAKE_TIMEOUT_MS = 20_000;

export async function postToMake(webhookEnv, body, { timeoutMs = MAKE_TIMEOUT_MS } = {}) {
	const url = env[webhookEnv];
	if (!url) throw new Error(`${webhookEnv} is not set in the server environment.`);

	const headers = { 'content-type': 'application/json' };
	if (env.MAKE_WEBHOOK_API_KEY) headers['x-make-apikey'] = env.MAKE_WEBHOOK_API_KEY;

	const res = await fetch(url, {
		method: 'POST',
		headers,
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(timeoutMs)
	});

	const reply = await res.text();
	if (!res.ok) {
		throw new Error(`Make webhook returned ${res.status}: ${reply.slice(0, 200)}`);
	}
	return reply;
}

async function signPaths(bucket, paths) {
	const list = (paths ?? []).map(String).filter(Boolean);
	if (list.length === 0) return [];

	const direct = list.filter((p) => /^https?:\/\//i.test(p));
	const toSign = list.filter((p) => !/^https?:\/\//i.test(p));
	if (!bucket || toSign.length === 0) return direct;

	const { data, error: signError } = await getSupabaseAdmin()
		.storage.from(bucket)
		.createSignedUrls(toSign, SIGNED_URL_SECONDS);

	if (signError) throw new Error(`Could not sign files in "${bucket}": ${signError.message}`);

	const signed = (data ?? []).filter((d) => d.signedUrl && !d.error).map((d) => d.signedUrl);
	return [...direct, ...signed];
}

async function toAddress(location) {
	const key = env.GOOGLE_MAPS_API_KEY;
	const m = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(location ?? '');
	if (!key || !m) return location;

	try {
		const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${m[1]},${m[2]}&key=${key}`;
		const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
		const data = await res.json();
		return data?.results?.[0]?.formatted_address || location;
	} catch {
		return location;
	}
}

async function loadProfile(userId) {
	const { data } = await getSupabaseAdmin().from('profiles').select('*').eq('id', userId).maybeSingle();
	return data ?? null;
}

async function loadProject(projectNo) {
	if (!projectNo) return null;
	const { data } = await getSupabaseAdmin()
		.from('projects')
		.select('*')
		.eq('project_id', projectNo)
		.limit(1);
	return data?.[0] ?? null;
}

async function saveStatus(table, id, fields) {
	const { error: updError } = await getSupabaseAdmin().from(table).update(fields).eq('id', id);
	if (updError) console.error(`[make] could not update ${table}.${id}:`, updError.message);
}

/**
 * Sends one saved submission to its Make scenario.
 *
 * @param {object}  opts
 * @param {string}  opts.formKey         key in FORMS (hkp, ppe, tbm, ...)
 * @param {string}  opts.id              submission row id
 * @param {object}  opts.user            signed-in Supabase user (from the bearer token)
 * @param {'null'|'to'} [opts.send]      'null' = new submission flow, 'to' = e-mail a PDF copy
 * @param {string}  [opts.emailTo]       recipient when send === 'to'
 * @param {string}  [opts.submitLocation] "lat, lng" captured by the browser
 * @param {boolean} [opts.force]         re-send even if it was already sent
 */
export async function dispatchSubmission({
	formKey,
	id,
	user,
	send = 'null',
	emailTo,
	submitLocation,
	force = false
}) {
	const form = FORMS[formKey];
	if (!form) error(400, `Unknown form "${formKey}".`);
	if (send === 'to' && !form.emailCopy) error(400, `${form.label} has no "e-mail a copy" flow.`);
	if (send === 'to' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTo ?? '')) {
		error(400, 'Please enter a valid e-mail address.');
	}

	const db = getSupabaseAdmin();
	const { data: row, error: rowError } = await db.from(form.table).select('*').eq('id', id).maybeSingle();

	if (rowError) error(500, rowError.message);
	if (!row) error(404, `${form.label} submission not found.`);
	if (row.created_by !== user.id) error(403, 'You can only send your own submissions.');

	if (form.requires && !form.requires(row)) {
		console.warn(`[make] skipped ${formKey} ${id}: ${form.table} row has no usable attachment`);
		return {
			status: 'skipped',
			reason: 'Nothing to send for this record.',
			detail: { table: form.table, id: row.id, columns: Object.keys(row).join(', ') }
		};
	}

	const isNew = send === 'null';
	if (isNew && !force && ['sent', 'done'].includes(row.make_status)) {
		return { status: 'already-sent', reportId: row.report_id };
	}

	const [profile, project, address] = await Promise.all([
		loadProfile(row.created_by),
		loadProject(row.project_no),
		submitLocation && !row.submit_location ? toAddress(String(submitLocation)) : null
	]);
	if (address) row.submit_location = address.slice(0, 300);

	const prefix = form.label.replace('e-', '');
	const reportId = row.report_id || makeReportId(prefix, row, row[form.dateColumn]);

	const ctx = {
		form: formKey,
		row,
		profile,
		project,
		reportId,
		send,
		emailTo: isNew ? profile?.email || user.email : emailTo,
		sign: (paths) => signPaths(form.bucket, paths)
	};

	const body = { ...commonFields(ctx), ...(await form.build(ctx)) };

	try {
		await postToMake(form.webhookEnv, body);
	} catch (err) {
		if (isNew) {
			await saveStatus(form.table, id, {
				report_id: reportId,
				submit_location: row.submit_location ?? null,
				make_status: 'failed',
				make_error: String(err?.message ?? err).slice(0, 500)
			});
		}
		throw err;
	}

	if (isNew) {
		await saveStatus(form.table, id, {
			report_id: reportId,
			submit_location: row.submit_location ?? null,
			make_status: 'sent',
			make_sent_at: new Date().toISOString(),
			make_error: null
		});
	}

	return { status: 'sent', reportId };
}