import { createUser, findUserByEmployeeNo, findUserByEmail } from '$lib/server/auth.js';
import { redirect, fail } from '@sveltejs/kit';

// SvelteKit expects `actions` to be an object of named handlers.
export const actions = {
	default: async ({ request }) => {
		const data = await request.formData();
		const name = data.get('name');
		const employee_no = data.get('employee_no');
		const email = data.get('email');
		const phone = data.get('phone');
		const position = data.get('position');
		const region = data.get('region');
		const password = data.get('password');
		const confirmPassword = data.get('confirm-password');

		if (
			!name ||
			!employee_no ||
			!email ||
			!phone ||
			!position ||
			!region ||
			!password ||
			!confirmPassword
		) {
			return fail(400, { error: 'Missing fields' });
		}

		const existingEmployeeNo = await findUserByEmployeeNo(employee_no);
		if (existingEmployeeNo) {
			return fail(400, { error: 'This employee has already registered an account' });
		}

		const existingEmail = await findUserByEmail(email);
		if (existingEmail) {
			return fail(400, { error: 'This email has been already registered to an account' });
		}

		if (password !== confirmPassword) {
			return fail(400, { error: 'Passwords do not match' });
		}

		await createUser(name, employee_no, email, phone, position, region, password);

		throw redirect(303, '/signin');
	}
};

export function load() {
	return {
		title: 'Sign Up | BME e-Safety App'
	};
}

export const prerender = false;
