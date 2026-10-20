import { error } from "@sveltejs/kit";
import JSZip from "jszip";
import { getSupabaseAdmin } from "../supabase-admin";
import { displayDate, monthLabel, num, safeName, text } from "./format";
import { postToMake } from "./dispatch";

const pad = (n) => String(n).padStart(2, '0');
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const fullName = (p) => `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim();
export const departmentText = (p) => Array.isArray(p?.department) ? p.department.join(', ') : text(p?.department);
export const staffId = (p) => text(p?.employee_no ?? p?.staff_no ?? p?.employee_id ?? p?.staff_id ?? '');

export function monthRange(year, month) {
    const last = new Date(year, month + 1, 0).getDate();
    return { start: `${year}-${pad(month + 1)}-01`, end: `${year}-${pad(month + 1)}-${pad(last)}` };
}

function groupBy(rows, key) {
    const map = new Map();
    for (const r of rows) {
        if (!map.has(r[key])) map.set(r[key], []);
        map.get(r[key]).push(r);
    }
    return map;
}

async function loadProfiles(ids) {
    if (ids.length === 0) return new Map();
    const { data, error: e } = await getSupabaseAdmin()
        .from('profiles')
        .select('*')
        .in('id', ids);
    if (e) error(500, e.message);
    return new Map((data ?? []).map((p) => [p.id, p]));
}

export async function assertReportAccess(user, pageRoute) {
    const { data: me } = await getSupabaseAdmin()
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
    const routes = me?.menu_access ?? [];
    const depts = (Array.isArray(me?.department) ? me.department : [me?.department]).map((d) => 
        String(d ?? '').trim().toLowerCase()
    );
    if (!depts.includes('admin') && !routes.includes(pageRoute)) {
        error(403, 'You do not have access to this report.');
    }
    return me;
}

function claimLine(c) {
    const money = (v) => (v === null || v === undefined || String(v).trim() === '' ? '' : num(v).toFixed(2));
    const other = num(c.claim_other) + num(c.fuel_cost);
    return {
        date: displayDate(c.claim_date),
		project: text(c.project_no),
		location: text(c.description),
		mileage: money(c.claim_mileage),
		toll: money(c.toll_fare),
		allowance: money(c.site_allowance),
		acc: money(c.accommodation),
		purchase: money(c.site_purchase),
		other: other ? other.toFixed(2) : '',
		remark: text(c.claim_remarks)
    };
}

async function loadClaimReports(year, month, userId) {
    const { start, end } = monthRange(year, month);
    let query = getSupabaseAdmin()
        .from('scf_submissions')
        .select('*')
        .gte('claim_date', start)
        .lte('claim_date', end)
        .order('claim_date', { ascending: true })
        .order('created_at', { ascending: true });
    if (userId) query = query.eq('created_by', userId);

    const { data, error: e } = await query;
    if (e) error(500, e.message);
    if (!data?.length) error(404, 'There are no claims for this month.');

    const byUser = groupBy(data, 'created_by');
    const profiles = await loadProfiles([...byUser.keys()]);
    const monthText = monthLabel(year, month);

    return [...byUser.entries()].map(([id, rows]) => {
        const p = profiles.get(id) ?? {};
        return {
            userid: staffId(p) || text(rows[0].staff_name),
			username: fullName(p) || text(rows[0].staff_name),
			department: departmentText(p) || text(rows[0].department),
			position: text(p.position || rows[0].staff_position),
			month: monthText,
			useremail: text(p.email),
			lines: rows.map(claimLine)
        };
    });
}

function claimOneBody(r, { email, sendto, delivery }) {
    return {
        delivery,
        userid: r.userid,
        name: r.username,
        department: r.department,
        position: r.position,
        month: r.month,
        lines: r.lines,
        email: text(email),
        sendto: text(sendto)
    };
}

async function loadOtReports(year, month, userId) {
    const { start, end } = monthRange(year, month);
    let query = getSupabaseAdmin()
        .from('ora_submissions')
        .select('*')
        .or(
            `and(actual_date.gte.${start},actual_date.lte.${end}),and(actual_date.is.null,overtime_date.gte.${start},overtime_date.lte.${end})`
        )
        .order('created_at', { ascending: true });
    if (userId) query = query.eq('created_by', userId);

    const { data, error: e } = await query;
    if (e) error(500, e.message);
    if (!data?.length) error(404, 'There are no OT records (e-ORA) for this month.');

    const rows = data
        .map((r) => ({ ...r, _date: r.actual_date || r.overtime_date }))
        .sort((a, b) => String(a._date).localeCompare(String(b._date)));

    const byUser = groupBy(rows, 'created_by');
    const profiles = await loadProfiles([...byUser.keys()]);
    const monthText = monthLabel(year, month);

    return [...byUser.entries()].map(([id, list]) => {
        const p = profiles.get(id) ?? {};
        const first = list[0];
        const total = list.reduce((s, r) => s + num(r.actual_hours ?? r.overtime_hours), 0);
        const items = list.map((r) => {
            const day = text(r.actual_day) || (r._date ? WEEKDAYS[new Date(`${r._date}T00:00:00`).getDay()] : '');
            return {
                date: displayDate(r._date),
				day,
				intime: text(r.actual_in_time),
				outtime: text(r.actual_out_time),
				hours: text(r.actual_hours ?? r.overtime_hours),
				reason: text(r.reason),
				breaktime: ''
            };
        });

        return {
            userid: text(first.employee_no) || staffId(p),
			username: text(first.employee_name) || fullName(p) || text(first.created_by_name),
			department: text(first.department) || departmentText(p),
			year: monthText,
			totalhours: Number.isInteger(total) ? String(total) : total.toFixed(2),
			typeofclaim: [...new Set(list.map((r) => text(r.claim_type)).filter(Boolean))].join(', '),
			useremail: text(p.email),
			items
        };
    });
}

const otOneLine = (items) => items.map((i) => ({
    Date: i.date,
    Day: i.day,
    InTime: i.intime,
    OutTime: i.outtime,
    breaktime: i.breaktime,
    Hours: i.hours,
    Reason: i.reason
}));

const otAllLines = (items) => items.map((i) => ({
    date: i.date,
    day: i.day,
    intime: i.intime,
    outtime: i.outtime,
    hour: i.hours,
    breaktime: i.breaktime,
    reason: i.reason
}));

export async function sendReportEmail({ report, me, user, year, month, userId, recipient }) {
    const myName = fullName(me) || user.email;
    const myEmail = me?.email || user.email;

    const reports = report === 'claim' ? await loadClaimReports(year, month, userId) : await loadOtReports(year, month, userId);

    const skipped = recipient === 'staff' ? reports.filter((r) => !r.useremail).map((r) => r.username) : [];
    const toSend = recipient === 'staff' ? reports.filter((r) => r.useremail) : reports;
    if (toSend.length === 0) error(400, 'None of the selected staff have an e-mail address.');

    const forMe = recipient === 'me';

    if (report === 'claim' && userId) {
        const r = toSend[0];
        await postToMake(
            'MAKE_WEBHOOK_CLAIM_ONE',
            claimOneBody(r, {
                email: forMe ? myEmail : r.useremail,
                sendto: forMe ? myName : r.username,
                delivery: 'email'
            })
        );
    } else if (report === 'claim') {
        await postToMake(
            'MAKE_WEBHOOK_CLAIM_ALL', {
                send: forMe ? 'to' : 'null',
                claim: [{ data: toSend.map((r) => ({ ...r, currentname: myName, currentemail: myEmail })) }]
            }
        );
    } else if (userId) {
        const r = toSend[0];
        await postToMake(
            'MAKE_WEBHOOK_OT_ONE', {
                userid: r.userid,
                username: r.username,
                department: r.department,
                year: r.year,
                totalhours: r.totalhours,
                typeofclaim: r.typeofclaim,
                name: forMe ? myName : r.username,
                email: forMe ? myEmail : r.useremail,
                lines: otOneLines(r.items)
            }
        );
    } else {
        await postToMake(
            'MAKE_WEBHOOK_OT_ALL', {
                send: forMe ? 'to' : 'null',
                ot: [
                    {
                        data: toSend.map(({ items, ...r }) => ({
                            ...r,
                            lines: otAllLines(items),
                            currentname: myName,
                            currentemail: myEmail
                        }))
                    }
                ]
            }
        );
    }

    return { send: toSend.length, skipped };
}

const DOWNLOAD_TIMEOUT_MS = 170_000;
const DOWNLOAD_CONCURRENCY = 3;

async function fetchClaimFile(r) {
    const reply = await postToMake(
        'MAKE_WEBHOOK_CLAIM_ONE',
        claimOneBody(r, {
            email: '',
            sendto: '',
            delivery: 'download'
        }),
        { timeoutMs: DOWNLOAD_TIMEOUT_MS }
    );

    let file;
    try {
        file = JSON.parse(reply);
    } catch {
        throw new Error('Make did not return the file. Check the "download" route (Webhook response) in "claimReport - One User".');
    }
    if (!file?.data) throw new Error(`Make returned no file data for ${r.username}.`);

    return {
        name: safeName(file.fileName || `${r.userid}_${r.month}_Claim Form.xlsx`),
        bytes: Buffer.from(String(file.data), 'base64')
    };
}

export async function downloadClaimForms({ year, month, userId }) {
    const reports = await loadClaimReports(year, month, userId);

    const files = [];
    for (let i = 0; i < reports.length; i += DOWNLOAD_CONCURRENCY) {
        const batch = reports.slice(i, i + DOWNLOAD_CONCURRENCY);
        files.push(...(await Promise.all(batch.map(fetchClaimFile))));
    }

    if (userId || files.length === 1) {
        return {
            fileName: files[0].name,
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            bytes: files[0].bytes
        };
    }

    const zip = new JSZip();
    const used = new Set();
    for (const f of files) {
        let name = f.name;
        for (let n = 2; used.has(name); n++) name = f.name.replace(/(\.xlsx)?$/i, ` (${n})$1`);
        used.add(name);
        zip.file(name, f.bytes);
    }

    return {
        fileName: safeName(`Staff Claim Forms_${monthLabel(year, month)}.zip`),
        contentType: 'application.zip',
        bytes: await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
    };
}