const TZ = 'Asia/Kuala_Lumpur';

export const MONTH_NAMES = [
    'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December'
];

const pad = (n) => String(n).padStart(2, '0');

function splitIsoDate(value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ''));
	return m ? { y: m[1], m: m[2], d: m[3] } : null;
}

export function displayDate(value) {
    const p = splitIsoDate(value);
    return p ? `${p.d}/${p.m}/${p.y}` : '';
}

export function fileDate(value) {
    const p = splitIsoDate(value);
    return p ? `${p.d}-${p.m}-${p.y}` : '';
}

export function compactDate(value) {
    const p = splitIsoDate(value);
    return p ? `${p.y}${p.m}${p.d}` : '';
}

function partsInTz(timestamp) {
    const date = timestamp ? new Date(timestamp) : new Date();
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-GB', {
            timeZone: TZ,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        })
            .formatToParts(date)
            .map((p) => [p.type, p.value])
    );
    return { ...parts, hour: parts.hour === '24' ? '00' : parts.hour };
}

export function displayDateTime(timestamp) {
    const p = partsInTz(timestamp);
    return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

export function compactTime(timestamp) {
    const p = partsInTz(timestamp);
    return `${p.hour}${p.minute}${p.second}`;
}

export function monthLabel(year, monthIndex) {
    return `${MONTH_NAMES[monthIndex]} ${year}`;
}

export function monthLabelFromDate(value) {
    const p = splitIsoDate(value);
    return p ? monthLabel(p.y, Number(p.m) - 1) : '';
}

export function safeName(value) {
    return String(value ?? '')
        .replace(/[\\/:*?"<>|#%]+/g, '-')
        .replace(/\s+/g, ' ')
		.trim();
}

export function text(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    if (Array.isArray(value)) return value.join(', ');
    return String(value);
}

export function num(value) {
    const n = parseFloat(String(value ?? '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
}