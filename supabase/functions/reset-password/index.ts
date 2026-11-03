import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/email.ts';
import { APP_NAME, buildButtonEmail, expiryText, logoUrl, siteUrl } from '../_shared/email-template.ts';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUBJECT = `Reset your ${APP_NAME} password`;

function buildResetEmail(firstName: string, actionLink: string, base: string): string {
	const expiry = expiryText();
	return buildButtonEmail({
		title: 'Reset your password',
		greeting: firstName ? `Hi ${firstName},` : undefined,
		paragraphs: [
			'We received a request to reset your password. Click the button below to create a new password.'
		],
		buttonLabel: 'Reset Password',
		actionLink,
		notes: [
			...(expiry ? [`This link will expire in ${expiry}.`] : []),
			'If you did not request a password reset, you can ignore this e-mail. Your password will not change.'
		],
		logo: logoUrl(base)
	});
}

Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
	if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

	try {
		const body = await req.json().catch(() => ({}));
		const email = (typeof body?.email === 'string' ? body.email : '').trim().toLowerCase();
		if (!EMAIL_RE.test(email)) {
			return json(400, { error: 'invalid', message: 'Enter a valid e-mail address.' });
		}

		const base = siteUrl(req);
		if (!base) return json(500, { error: 'config', message: 'SITE_URL is not configured.' });
		const redirectTo = `${base}/auth/resetpw`;

		const admin = createClient(
			Deno.env.get('SUPABASE_URL')!,
			Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
			{ auth: { persistSession: false, autoRefreshToken: false } }
		);

		const { data, error } = await admin.auth.admin.generateLink({
			type: 'recovery',
			email,
			options: { redirectTo }
		});

		if (error && (error.status === 404 || /not found/i.test(error.message))) {
			return json(404, {
				error: 'not_found',
				message: 'An account with this e-mail address does not exist.'
			});
		}

		const actionLink = data?.properties?.action_link;
		if (error || !actionLink) {
			console.error('[reset-password] generateLink failed:', error);
			return json(502, { error: 'link_failed', message: error?.message ?? 'Could not create the reset link.' });
		}

		const firstName = String(data?.user?.user_metadata?.first_name ?? '').trim();
		await sendEmail(email, SUBJECT, buildResetEmail(firstName, actionLink, base));

		return json(200, { ok: true });
	} catch (e) {
		console.error('[reset-password] unexpected error:', e);
		return json(500, { error: 'server_error', message: String(e instanceof Error ? e.message : e) });
	}
});