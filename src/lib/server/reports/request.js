import { error } from "@sveltejs/kit";

export async function readPeriod(request) {
    let body;
    try {
        body = await request.json();
    } catch {
        error(400, 'Invalid JSON body');
    }

    const year = Number(body?.year);
    const month = Number(body?.month);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 0 || month > 11) {
        error(400, 'A valid year and month are required.');
    }

    return {
        body,
        year,
        month,
        userId: body?.userId ? String(body.userId) : null
    };
}

export function fileResponse({ fileName, contentType, bytes }) {
    const ascii = fileName.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, "'");
    return new Response(bytes, {
        headers: {
            'content-type': contentType,
            'content-length': String(bytes.length),
            'content-disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
            'cache-control': 'no-store'
        }
    });
}