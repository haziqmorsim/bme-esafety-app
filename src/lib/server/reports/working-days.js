import { error } from "@sveltejs/kit";
import ExcelJS from 'exceljs';
import { getSupabaseAdmin } from "../supabase-admin";
import { monthLabel, safeName } from "../make/format";
import { fullName, staffId } from "../make/reports";

const TZ_OFFSET = '+08:00';
const FORMS = [
    { key: 'tbm', table: 'tbm-submissions', label: 'e-TBM' },
    { key: 'ppe', table: 'ppe-submissions', label: 'e-PPE' },
    { key: 'hkp', table: 'hkp-submissions', label: 'e-HKP' }
];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const STATUS_FILL = { Working: 'FFC6EFCE', Incomplete: 'FFFFEB9C', 'Not Working': 'FFF2F2F2' };

const pad = (n) => String(n).padStart(2, '0');

function myDateKey(ts) {
    const d = new Date(new Date(ts).getTime() + 8 * 60 * 60 * 1000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function statusOf(s) {
    const count = FORMS.filter((f) => s?.[f.key]).length;
    return count === FORMS.length ? 'Working' : count > 0 ? 'Incomplete' : 'Not Working';
}

function sheetName(name, used) {
    const base = String(name || 'User').replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 28) || 'User';
    let candidate = base;
    for (let n = 2; used.has(candidate.toLowerCase()); n++) candidate = `${base.slice(0, 26)} ${n}`;
    used.add(candidate.toLowerCase());
    return candidate;
}

function styleHeader(row) {
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
	row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF091747' } };
	row.alignment = { vertical: 'middle', horizontal: 'center' };
}

export async function buildWorkingDaysWorkbook({ year, month, userId }) {
    const db = getSupabaseAdmin();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startISO = `${year}-${pad(month + 1)}-01T00:00:00${TZ_OFFSET}`;
    const next = month === 11 ? `${year + 1}-01-01` : `${year}-${pad(month + 2)}-01`;
    const endISO = `${next}T00:00:00${TZ_OFFSET}`;

    const results = await Promise.all(
        FORMS.map((f) => {
            let q = db
                .from(f.table)
                .select('created_by, created_at')
                .gte('created_at', startISO)
                .lt('created_at', endISO);
            if (userId) q = q.eq('created_by', userId);
            return q;
        })
    );
    const byUser = new Map();
    results.forEach((res, i) => {
        if (res.error) error(500, res.error.message);
        for (const row of res.data ?? []) {
            if (!byUser.has(row.created_by)) byUser.set(row.created_by, {});
            const days = byUser.get(row.created_by);
            const key = myDateKey(row.created_at);
            (days[key] ??= {})[FORMS[i].key] = true;
        }
    });

    const userIds = userId ? [userId] : [,,,byUser.keys()];
    if (userIds.length === 0) error(404, 'There are no working day records for this month.');

    const [{ data: profiles, error: pErr }, { data: holidays, error: hErr }] = await Promise.all([
        db
            .from('profiles')
            .select('*')
            .in('id', userIds),
        db
            .from('holidays')
            .select('holiday_date, name')
            .gte('holiday_date', `${year}-${pad(month + 1)}-01`)
            .lte('holiday_date', `${year}-${pad(month + 1)}-${pad(daysInMonth)}`)
    ]);
    if (pErr) error(500, pErr.message);
    if (hErr) error(500, hErr.message);

    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
    const holidayByDate = {};
    for (const h of holidays ?? []) (holidayByDate[h.holiday_date] ??= []).push(h.name);

    const people = userIds
        .map((id) => {
            const p = profileById.get(id) ?? {};
            return { 
                id, 
                name: fullName(p) || p.email || id, 
                staffNo: staffId(p), 
                days: byUser.get(id) ?? {} 
            };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

    const wb = new ExcelJS.Workbook();
    wb.creator = 'BME e-Safety App';
    wb.created = new Date();
    const monthText = monthLabel(year, month);
    const used = new Set();

    if (!userId) {
        const ws = wb.addWorksheet(sheetName('Summary', used));
        ws.columns = [
            { header: 'Name', key: 'name', width: 32 },
			{ header: 'Staff No.', key: 'staffNo', width: 14 },
			{ header: 'Working', key: 'working', width: 12 },
			{ header: 'Incomplete', key: 'incomplete', width: 12 },
			{ header: 'Not Working', key: 'notWorking', width: 13 }
        ];
        ws.spliceRows(1, 0, [`Working Day Record - ${monthText}`], []);
        ws.getCell('A1').font = { bold: true, size: 14 };
        styleHeader(ws.getRow(3));
        for (const person of people) {
            const counts = { Working: 0, Incomplete: 0, 'Not Working': 0 };
            for (let d = 1; d <= daysInMonth; d++) {
                counts[statusOf(person.days[`${year}-${pad(month + 1)}-${pad(d)}`])]++;
            }
            ws.addRow({
                name: person.name,
				staffNo: person.staffNo,
				working: counts.Working,
				incomplete: counts.Incomplete,
				notWorking: counts['Not Working']
            });
        }
    }

    for (const person of people) {
		const ws = wb.addWorksheet(sheetName(person.name, used));
		ws.columns = [
			{ key: 'date', width: 13 },
			{ key: 'day', width: 12 },
			{ key: 'holiday', width: 28 },
			...FORMS.map((f) => ({ key: f.key, width: 9 })),
			{ key: 'status', width: 14 }
		];
		ws.addRow([`Working Day Record - ${person.name}${person.staffNo ? ` (${person.staffNo})` : ''}`]);
		ws.addRow([monthText]);
		ws.addRow([]);
		ws.getCell('A1').font = { bold: true, size: 14 };
		const header = ws.addRow(['Date', 'Day', 'Public Holiday', ...FORMS.map((f) => f.label), 'Status']);
		styleHeader(header);
 
		for (let d = 1; d <= daysInMonth; d++) {
			const key = `${year}-${pad(month + 1)}-${pad(d)}`;
			const s = person.days[key];
			const status = statusOf(s);
			const row = ws.addRow({
				date: `${pad(d)}/${pad(month + 1)}/${year}`,
				day: WEEKDAYS[new Date(year, month, d).getDay()],
				holiday: (holidayByDate[key] ?? []).join(', '),
				...Object.fromEntries(FORMS.map((f) => [f.key, s?.[f.key] ? '✓' : ''])),
				status
			});
			row.getCell('status').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STATUS_FILL[status] } };
			FORMS.forEach((f) => (row.getCell(f.key).alignment = { horizontal: 'center' }));
		}
		ws.views = [{ state: 'frozen', ySplit: 4 }];
	}
 
	const label = userId ? people[0].name : 'All Users';
	return {
		fileName: safeName(`Working Day Record_${label}_${monthText}.xlsx`),
		contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		bytes: Buffer.from(await wb.xlsx.writeBuffer())
	};
}