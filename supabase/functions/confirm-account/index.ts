import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/email.ts';
import { APP_NAME, buildButtonEmail, expiryText, logoUrl, siteUrl } from '../_shared/email-template.ts';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 72;
const SUBJECT = `Confirm your ${APP_NAME} account`;

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

function buildConfirmEmail(firstName: string, actionLink: string, base: string): string {
	const expiry = expiryText();
	return buildButtonEmail({
		title: 'Confirm your account',
		greeting: firstName ? `Hi ${firstName},` : undefined,
		paragraphs: [
			`Thank you for signing up for the ${APP_NAME}. Click the button below to confirm your e-mail address and activate your account.`
		],
		buttonLabel: 'Confirm Account',
		actionLink,
		notes: [
			...(expiry ? [`This link will expire in ${expiry}.`] : []),
			'If you did not create this account, you can ignore this e-mail.'
		],
		logo: logoUrl(base)
	});
}

async function confirmationLink(admin: SupabaseClient, email: string, redirectTo: string) {
	const { data, error } = await admin.auth.admin.generateLink({
		type: 'recovery',
		email,
		options: { redirectTo }
	});
	return { link: data?.properties?.action_link ?? null, user: data?.user ?? null, error };
}

const isNotFound = (e: { status?: number; message?: string } | null) =>
	!!e && (e.status === 404 || /not found/i.test(e.message ?? ''));

Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
	if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

	try {
		const body = await req.json().catch(() => ({}));
		const email = text(body?.email).toLowerCase();
		const resend = body?.resend === true;

		if (!EMAIL_RE.test(email)) {
			return json(400, { error: 'invalid', message: 'Enter a valid e-mail address.' });
		}

		const base = siteUrl(req);
		if (!base) return json(500, { error: 'config', message: 'SITE_URL is not configured.' });
		const redirectTo = `${base}/signin?confirmed=1`;

		const admin = createClient(
			Deno.env.get('SUPABASE_URL')!,
			Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
			{ auth: { persistSession: false, autoRefreshToken: false } }
		);

		if (resend) {
			const { link, user, error } = await confirmationLink(admin, email, redirectTo);
			if (isNotFound(error)) {
				return json(404, {
					error: 'not_found',
					message: 'An account with this e-mail address does not exist.'
				});
			}
			if (error || !link || !user) {
				console.error('[confirm-account] generateLink (resend) failed:', error);
				return json(502, { error: 'link_failed', message: error?.message ?? 'Could not create the link.' });
			}
			if (user.email_confirmed_at) {
				return json(409, {
					error: 'already_confirmed',
					message: 'This account has already been confirmed. Please sign in.'
				});
			}

			const firstName = text(user.user_metadata?.first_name);
			await sendEmail(email, SUBJECT, buildConfirmEmail(firstName, link, base));
			return json(200, { ok: true });
		}

		const password = typeof body?.password === 'string' ? body.password : '';
		if (password.length < MIN_PASSWORD) {
			return json(400, { error: 'invalid', message: `Password must be at least ${MIN_PASSWORD} characters.` });
		}
		if (password.length > MAX_PASSWORD) {
			return json(400, { error: 'invalid', message: `Password must be at most ${MAX_PASSWORD} characters.` });
		}

		const metadata = {
			first_name: text(body?.first_name) || null,
			last_name: text(body?.last_name) || null,
			nickname: text(body?.nickname) || null,
			employee_no: text(body?.employee_no) || null,
			phone: text(body?.phone) || null,
			department: [],
			position: text(body?.position) || null,
			region: text(body?.region) || null
		};

		const { data: created, error: createError } = await admin.auth.admin.createUser({
			email,
			password,
			email_confirm: false,
			user_metadata: metadata
		});

		if (createError || !created?.user) {
			const message = createError?.message ?? 'Could not create the account.';
			if (createError?.status === 422 || /already|registered|exists/i.test(message)) {
				return json(409, {
					error: 'already_registered',
					message: 'This e-mail address is already registered. Please sign in instead.'
				});
			}
			if (/password/i.test(message)) return json(400, { error: 'invalid', message });
			console.error('[confirm-account] createUser failed:', createError);
			return json(502, { error: 'create_failed', message });
		}

		const userId = created.user.id;
		try {
			const { link, error } = await confirmationLink(admin, email, redirectTo);
			if (error || !link) throw new Error(error?.message ?? 'Could not create the confirmation link.');

			await sendEmail(email, SUBJECT, buildConfirmEmail(metadata.first_name ?? '', link, base));
		} catch (e) {
			await admin.auth.admin.deleteUser(userId).catch(() => {});
			console.error('[confirm-account] sending the confirmation e-mail failed:', e);
			return json(502, {
				error: 'email_failed',
				message: 'The confirmation e-mail could not be sent. Please try again later.'
			});
		}

		return json(200, { ok: true });
	} catch (e) {
		console.error('[confirm-account] unexpected error:', e);
		return json(500, { error: 'server_error', message: String(e instanceof Error ? e.message : e) });
	}
});