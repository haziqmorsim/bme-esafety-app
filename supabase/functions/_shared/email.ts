export interface Attachment {
    filename: string;
    content: string;
    contentType?: string;
}

function guessContentType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    if (ext === 'pdf') return 'application/pdf';
    if (ext === 'csv') return 'text/csv';
    if (ext === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (ext === 'png') return 'image/png';
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
    return 'application/octet-stream';
}

function normaliseRecipients(to: string): string {
    const list = String(to ?? '')
        .split(/[,;]/)
        .map((a) => a.trim())
        .filter(Boolean);
    if (list.length === 0) throw new Error('No valid recipient e-mail addresses found.');
    return list.join(';');
}

export async function sendEmail(
    to: string,
    subject: string,
    html: string,
    attachments?: Attachment[]
): Promise<void> {
    const recipients = normaliseRecipients(to);

    const flowUrl = Deno.env.get('POWER_AUTOMATE_EMAIL_URL');
    if (!flowUrl) {
        throw new Error(
            'E-mail configuration is incomplete. Set POWER_AUTOMATE_EMAIL_URL to the new Power Automate flow HTTP trigger URL.'
        );
    }
    const sharedKey = Deno.env.get('POWER_AUTOMATE_EMAIL_KEY');

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (sharedKey) headers['x-esafety-key'] = sharedKey;

    const payload = {
        to: recipients,
        subject,
        html,
        attachments: (attachments ?? []).map((a) => ({
            name: a.filename,
            contentBytes: a.content,
            contentType: a.contentType ?? guessContentType(a.filename)
        }))
    };

    const res = await fetch(flowUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`Power Automate sendEmail failed: HTTP ${res.status} ${detail}`.trim());
    }
}