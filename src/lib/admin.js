export function hasAdminDepartment(department) {
    const list = Array.isArray(department) ? department : [department];
    return list.some((d) => String(d ?? '').trim().toLowerCase() === 'admin');
}