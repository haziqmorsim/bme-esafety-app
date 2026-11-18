const MY_OFFSET_MS = 8 * 60 * 60 * 1000;

export function csvQuote(text) {
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvCell(value) {
    let text = String(value ?? '');
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return csvQuote(text);
}

export function csvDate(value) {
    return String(value ?? '').slice(0, 10);
}

export function csvDateTime(value) {
    const time = new Date(value).getTime();
    if (!value || Number.isNaN(time)) return '';
    return new Date(time + MY_OFFSET_MS).toISOString().slice(0, 19).replace('T', ' ');
}

export function downloadCsv(filename, headers, rows) {
    const lines = [headers.map(csvQuote).join(','), ...rows.map((row) => row.map(csvCell).join(','))];
    const blob = new Blob(['' + lines.join('\r\n') + '\r\n'], {
		type: 'text/csv;charset=utf-8'
	});

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}