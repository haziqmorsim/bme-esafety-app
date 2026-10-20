import { error, json } from "@sveltejs/kit";
import { getRequestUser } from "$lib/server/supabase-admin";
import { assertReportAccess, sendReportEmail } from "$lib/server/make/reports";
import { readPeriod } from "$lib/server/reports/request";

const PAGE_FOR_REPORT = { claim: '/osh/claim-dashboard', ot: '/osh/calendar-view' };

export async function POST({ request }) {
    const user = getRequestUser(request);
    if (!user) error(401, 'Please sign in again.');

    const { body, year, month, userId } = await readPeriod(request);
    const { report, recipient } = body ?? {};

    if (!PAGE_FOR_REPORT[report]) error(400, '"report" must be "claim" or "ot".');
    if (!['staff', 'me'].includes(recipient)) error(400, '"recipient" must be "staff" or "me".');

    const me = await assertReportAccess(user, PAGE_FOR_REPORT[report]);

    try {
        return json(await sendReportEmail({ report, me, user, year, month, userId, recipient }));
    } catch (err) {
        if (err?.status) throw err;
        console.error('[make] report failed:', err);
        error(502, err?.message ?? 'Could not reach Make.');
    }
}