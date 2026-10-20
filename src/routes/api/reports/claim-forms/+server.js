import { error } from "@sveltejs/kit";
import { getRequestUser } from "$lib/server/supabase-admin";
import { assertReportAccess, downloadClaimForms } from "$lib/server/make/reports";
import { fileResponse, readPeriod } from "$lib/server/reports/request";

export async function POST({ request }) {
    const user = await getRequestUser(request);
    if (!user) error(401, 'Please sign in again.');

    const { year, month, userId } = await readPeriod(request);
    await assertReportAccess(user, '/osh/claim-dashboard');

    try {
        return fileResponse(await downloadClaimForms({ year, month, userId }));
    } catch (err) {
        if (err?.status) throw err;
        console.error('[reports] claim form download failed.', err);
        error(502, err?.message ?? 'Could not build the Claim Form.');
    }
}