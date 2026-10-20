import { error } from "@sveltejs/kit";
import { getRequestUser } from "$lib/server/supabase-admin";
import { assertReportAccess } from "$lib/server/make/reports";
import { buildWorkingDaysWorkbook } from "$lib/server/reports/working-days";
import { fileResponse, readPeriod } from "$lib/server/reports/request";

export async function POST({ request }) {
    const user = await getRequestUser(request);
    if (!user) error(401, 'Please sign in again.');

    const { year, month, userId } = await readPeriod(request);
    await assertReportAccess(user, '/osh/calendar-view');

    return fileResponse(await buildWorkingDaysWorkbook({ year, month, userId }));
}