<script>
	import FileText from '@lucide/svelte/icons/file-text';
	import { supabase } from '$lib/supabase';
	import { goto } from '$app/navigation';
	import { requireUser } from '$lib/auth-guard';
	import { toast } from '$lib/stores/toast';

	let employee_name = '';
	let employee_no = '';
	let department = '';
	let claim_type = '';
	let overtime_date = '';
	let overtime_day = '';
	let overtime_hours = '';
	let actual_date = '';
	let actual_day = '';
	let actual_in_time = '';
	let actual_out_time = '';
	let actual_hours = '';
	let reason = '';
	let remarks = '';
	let acknowledged = false;
	let created_at = '';
	let created_by = '';

	// let confirmPassword = '';

	// if (!confirmPassword) {
	// 	throw new Error('Please confirm your login password.');
	// }

	let errorMsg = '';
	let saving = false;

	function withTimeout(promise, ms = 20000) {
		return Promise.race([
			promise,
			new Promise((_, reject) =>
				setTimeout(() => reject(new Error('The request timed out. Please try again.')), ms)
			)
		]);
	}

	async function handleSubmit(e) {
		e.preventDefault();
		errorMsg = '';
		saving = true;

		try {
			const auth = await requireUser();
			if (!auth) return;

			const { supabase, user } = auth;

			if (!user) throw new Error('Not signed in.');

			const { data: profile, error: profileError } = await withTimeout(
				supabase.from('profiles').select('first_name, last_name').eq('id', user.id).single(),
				15000
			);

			if (profileError) throw profileError;

			const submitterName =
				`${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || user.email;

			const payload = {
				employee_name,
				employee_no,
				department,
				claim_type,
				overtime_date,
				overtime_day,
				overtime_hours,
				actual_date,
				actual_day,
				actual_in_time,
				actual_out_time,
				actual_hours,
				reason,
				remarks,
				acknowledged,
				created_by: user.id,
				created_by_name: submitterName
			};

			const { error: insError } = await withTimeout(
				supabase.from('ora_submissions').insert(payload),
				15000
			);
			if (insError) throw insError;

			toast.success('e-ORA submitted successfully.');
			goto('/');
		} catch (error) {
			errorMsg = error?.message ?? String(error);
		} finally {
			saving = false;
		}
	}
</script>

<h1 class="title">Overtime Requisition Approval Form (e-ORA) Submission</h1>

<div class="project-box">
	<form class="forms" onsubmit={handleSubmit}>
		<h2 class="heading">Employee Information</h2>
		<div class="forms-p">
			<label for="employee-name" class="forms-label">Employee Name:</label>
			<input type="text" class="forms-input" bind:value={employee_name} required />
		</div>
		<div class="forms-p">
			<label for="employee-no" class="forms-label">Employee No.:</label>
			<input type="text" class="forms-input" bind:value={employee_no} required />
		</div>
		<div class="forms-p">
			<label for="department" class="forms-label">Department:</label>
			<select class="department-select" bind:value={department} required>
				<option value="" disabled selected></option>
				<option value="Project">Project</option>
				<option value="OSH">OSH</option>
			</select>
		</div>
		<br />
		<hr />
		<h2 class="heading">Overtime Requisition</h2>
		<div class="forms-p">
			<label for="claim-type" class="forms-label">Type of Claim:</label>
			<select class="claim-select" bind:value={claim_type} required>
				<option value="" disabled selected></option>
				<option value="Overtime">Overtime</option>
				<option value="Duty-Allowance">Duty Allowance</option>
			</select>
		</div>
		<div class="forms-p">
			<label for="overtime-date" class="forms-label">Date:</label>
			<input type="date" class="forms-input forms-date" bind:value={overtime_date} required />
		</div>
		<div class="forms-p">
			<label for="overtime-day" class="forms-label">Day:</label>
			<input type="text" class="forms-input" bind:value={overtime_day} required />
		</div>
		<div class="forms-p">
			<label for="overtime-hours" class="forms-label">No. of Hours:</label>
			<input type="text" class="forms-input" bind:value={overtime_hours} required />
		</div>
		<br />
		<hr />
		<h2 class="heading">Actual Day of Overtime Work</h2>
		<div class="forms-p">
			<label for="actual-date" class="forms-label">Date:</label>
			<input
				type="date"
				class="forms-input"
				bind:value={actual_date}
				onfocus={(e) => e.target.showPicker?.()}
				required
			/>
		</div>
		<div class="forms-p">
			<label for="actual-day" class="forms-label">Day:</label>
			<input type="text" class="forms-input" bind:value={actual_day} required />
		</div>
		<div class="forms-p">
			<label for="actual-in-time" class="forms-label">In Time (From):</label>
			<input type="text" class="forms-input" bind:value={actual_in_time} required />
		</div>
		<div class="forms-p">
			<label for="actual-out-time" class="forms-label">Out Time (To):</label>
			<input type="text" class="forms-input" bind:value={actual_out_time} required />
		</div>
		<div class="forms-p">
			<label for="actual-hours" class="forms-label">No. of Hours:</label>
			<input type="text" class="forms-input" bind:value={actual_hours} required />
		</div>
		<div class="forms-p">
			<label for="reason" class="forms-label">Reason:</label>
			<input type="text" class="forms-input" bind:value={reason} required />
		</div>
		<br />
		<hr />
		<h2 class="heading">Remarks</h2>
		<p>
			<textarea
				name="remarks"
				id="remarks"
				cols="30"
				rows="10"
				class="remarks"
				placeholder="Remarks"
				bind:value={remarks}
			></textarea>
		</p>
		<h2 class="heading">Acknowledgement and Submission</h2>
		<div class="container">
			<div class="checkbox">
				<input type="checkbox" name="checkbox" id="checkbox" bind:checked={acknowledged} required />
			</div>
			<div class="declaration">
				<p>The declaration for the Overtime Requisition and Aprroval Form is as below:</p>
				<p>
					I hereby acknowledge that I have conducted a thorough check and confirm the following:
				</p>
				<p>>> All information in this report is accurate and up to date.</p>
				<p>>> All personnel working on site are registered and have appropriate permits.</p>
				<p>
					By entering my password below, I confirm my identity and consent as a digital
					acknowledgment.
				</p>
				<p>I understand that this action may be recorded as part of the official audit trail.</p>
			</div>
		</div>
		<p>Note: Double check if content is correct before submitting.</p>
		<!-- <div class="forms-p">
			<p><b>Confirm Login Password</b></p>
			<input type="password" class="forms-input" />
		</div> -->
		{#if errorMsg}
			<p class="error">{errorMsg}</p>
		{/if}
		<div class="submit">
			<button type="submit" class="button-submit" disabled={saving}
				><FileText />{saving ? 'Submitting...' : 'Submit'}</button
			>
		</div>
	</form>
</div>

<style>
	.container {
		display: flex;
		margin: 10px 0;
	}

	.department-select,
	.claim-select {
		width: 150px;
		height: 30px;
		margin: 10px 0;
	}

	@media (max-width: 1024px) {
		.department-select,
		.claim-select {
			width: 100%;
		}
	}

	@media (max-width: 600px) {
		.department-select,
		.claim-select {
			width: 100%;
			height: 34px;
			font-size: 13px;
		}

		.container {
			gap: 10px;
		}
	}
</style>