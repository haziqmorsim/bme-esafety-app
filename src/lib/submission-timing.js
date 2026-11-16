const MY_OFFSET_MS = 8 * 60 * 60 * 1000; // GMT+8

export const DAILY_FORMS = {
    tbm: { table: 'tbm_submissions', dateColumn: 'meeting_date' },
    ppe: { table: 'ppe_submissions', dateColumn: 'activity_date' },
    hkp: { table: 'hkp_submissions', dateColumn: 'activity_date' }
};

export function MYDateKey(timestamp) {
    const time = new Date(timestamp).getTime();
    if (Number.isNaN(time)) return '';
    return new Date(time + MY_OFFSET_MS).toISOString().slice(0, 10);
}

export function submissionTiming(row, dateColumn) {
    const formDate = String(row?.[dateColumn] ?? '').slice(0, 10);
    const createdDate = MYDateKey(row?.created_at);
    return formDate && createdDate && createdDate > formDate ? 'late' : 'on-time';
}

export function mergeTiming(current, next) {
    if (current === 'on-time' || next === 'on-time') return 'on-time';
    return next ?? current ?? null;
}