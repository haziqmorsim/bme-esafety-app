const BRAND = {
    ink: '#091747',
	blue: '#093d85',
	navy: '#091747',
	muted: '#5b6480',
	border: '#e3e8f0',
	bg: '#f2f4f9'
};

export const APP_NAME = 'BME e-Safety App';

export function esc(s: string): string {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

export function siteUrl(req: Request): string {
    return (Deno.env.get('SITE_URL') ?? req.headers.get('origin') ?? '').trim().replace(/\/+$/, '');
}

export function logoUrl(base: string): string | null {
    const configured = Deno.env.get('LOGO_URL');
    if (configured) return configured;
    return base ? `${base}/images/bme_logo.jpg` : null;
}

export function expiryText(): string {
    const minutes = Number(Deno.env.get('LINK_EXPIRY_MINUTES') ?? '60');
    if (!Number.isFinite(minutes) || minutes <= 0) return '';
    if (minutes % 60 === 0) {
        const hours = minutes / 60;
        return `${hours} hour ${hours === 1 ? '' : 's'}`;
    }
    return `${minutes} minutes`;
}

export interface buttonEmail {
    title: string;
    greeting?: string;
    paragraphs: string[];
    buttonLabel: string;
    actionLink: string;
    notes: string[];
    logo: string | null;
}

export function buildButtonEmail(e: buttonEmail): string {
    const logo = e.logo
        ? `<img src="${esc(e.logo)}" alt="${APP_NAME}" width="120" style="display:block;height:auto;border:0;margin:0 auto 6px;" />`
        : '';
    const link = esc(e.actionLink);

    const greeting = e.greeting
        ? `<p style="margin:0 0 14px;">${esc(e.greeting)}</p>`
		: '';
    const body = e.paragraphs.map((p) => `<p style="margin:0 0 18px;">${esc(p)}</p>`).join('');
    const notes = e.notes.map((n) => `<p style="margin:0 0 14px;color:${BRAND.muted};font-size:14px;">${esc(n)}</p>`).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(e.title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:24px 0;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid ${BRAND.border};border-radius:14px;overflow:hidden;font-family:Segoe UI,Arial,Helvetica,sans-serif;">
                    <tr>
                        <td style="background:${BRAND.navy};height:6px;line-height:6px;font-size:0;">&nbsp;</td>
                    </tr>
                    <tr>
                        <td style="padding:28px 36px 8px;text-align:center;">
                            ${logo}
                            <h1 style="margin:8px 0 0;font-size:20px;color:${BRAND.blue};">${esc(e.title)}</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:14px 36px 0;color:${BRAND.ink};font-size:15px;line-height:1.6;">
                            ${greeting}
                            ${body}
                            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 18px;">
                                <tr>
                                    <td align="center" bgcolor="${BRAND.navy}" style="border-radius:10px;">
                                        <a href="${link}" target="_blank" rel="noopener"
                                           style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">
                                            ${esc(e.buttonLabel)}
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            ${notes}
                            <p style="margin:18px 0 0;color:${BRAND.ink};font-size:15px;">Regards,<br />${APP_NAME}</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 36px 28px;">
                            <hr style="border:none;border-top:1px solid ${BRAND.border};margin:0 0 14px;" />
                            <p style="margin:0;color:${BRAND.muted};font-size:12px;line-height:1.5;word-break:break-all;">
                                If the button does not work, copy and paste this link into your browser:<br />
                                <a href="${link}" target="_blank" rel="noopener" style="color:${BRAND.blue};">${link}</a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}