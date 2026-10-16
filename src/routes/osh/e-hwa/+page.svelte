<script>
	/**
	 * @typedef {{ score: number | null }} AuditItem
	 * @typedef {{ items: AuditItem[] }} Subsection
	 */

	import FileText from '@lucide/svelte/icons/file-text';
	import { supabase } from '$lib/supabase';
	import { goto } from '$app/navigation';
	import { requireUser } from '$lib/auth-guard';
	import { toast } from '$lib/stores/toast';

	let permit_date = '';
	let location_allowed = '';
	let contractor_employees = '';
	let emergency_number = '';

	let subsections = [
		{
			key: 'device',
			title: 'Fire Extinguisher Device',
			items: [
				{ label: 'Powder ABC/Debu Kering', value: '', remarks: '' },
				{ label: 'CO2', value: '', remarks: '' },
				{ label: 'Foam', value: '', remarks: '' }
			]
		},
		{
			key: 'ppe',
			title: 'Personal Protective Equipment',
			items: [
				{ label: 'Safety Helmet/Topi Keselamatan', value: '', remarks: '' },
				{ label: 'Goggle/Face Shield/Pelindung Mata', value: '', remarks: '' },
				{ label: 'Leather Glove/Sarung Tangan Kulit', value: '', remarks: '' },
				{ label: 'Communication Device/Alat Perhubungan', value: '', remarks: '' }
			]
		},
		{
			key: 'fpe',
			title: 'Fire Prevention Equipment',
			items: [
				{ label: 'Fire Blankets', value: '', remarks: '' },
				{ label: 'Gas Detector', value: '', remarks: '' },
				{ label: 'Foam', value: '', remarks: '' }
			]
		}
	];

	let contractor_name = '';
	let contractor_id = '';
	let phone_no = '';
	let company_name = '';
	let coordinator_name = '';
	let officer_name = '';
	let acknowledged = false;
	let created_at = '';
	let created_by = '';

	// let confirmPassword = '';

	// if (!confirmPassword) {
	// 	throw new Error('Please confirm your login password.');
	// }

	let errorMsg = '';
	let saving = false;

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
				permit_date,
				location_allowed,
				contractor_employees,
				emergency_number,
				subsections,
				contractor_name,
				contractor_id,
				phone_no,
				company_name,
				coordinator_name,
				officer_name,
				acknowledged,
				created_by: user.id,
				created_by_name: submitterName
			};

			const { error: insError } = await withTimeout(
				supabase.from('hwa_submissions').insert(payload),
				15000
			);
			if (insError) throw insError;

			toast.success('Hot Work Activities Report (e-HWA) submitted successfully.');
			goto('/');
		} catch (error) {
			errorMsg = error?.message ?? String(error);
		} finally {
			saving = false;
		}
	}
</script>

<h1 class="title">Hot Work Activities Report (e-HWA) Submission</h1>

<div class="project-box">
	<form class="forms" onsubmit={handleSubmit}>
		<h2 class="heading">General Information</h2>
		<div class="forms-p">
			<label for="permit-date" class="forms-label">Permit Validity Date:</label>
			<input
				type="date"
				class="forms-input forms-date"
				bind:value={permit_date}
				onfocus={(e) => e.target.showPicker?.()}
				required
			/>
		</div>
		<div class="forms-p">
			<label for="hotwork-location" class="forms-label">Hot Work Location Allowed:</label>
			<input type="text" class="forms-input" bind:value={location_allowed} required />
		</div>
		<div class="forms-p">
			<label for="hotwork-contractor-employees" class="forms-label">Contractor and Employees:</label
			>
			<input type="text" class="forms-input" bind:value={contractor_employees} required />
		</div>
		<div class="forms-p">
			<label for="hotwork-emergency-number" class="forms-label">Emergency Number:</label>
			<input type="text" class="forms-input" bind:value={emergency_number} required />
		</div>
		<br />
		<hr />
		<h2 class="heading">Hot Work Safety Checklist</h2>
		{#each subsections as subsection, sIndex}
			<h3 class="subheading">{subsection.title}</h3>
			<div class="checklist-grid">
				{#each subsection.items as item, iIndex}
					<p class="index">{iIndex + 1}.</p>
					<p class="item-label">{item.label}</p>
					<p class="checklist-radio">
						<input
							type="radio"
							name="checklist-boolean"
							id="checklist-yes"
							bind:value={subsections[sIndex].items[iIndex].value}
						/>
						<label for="checklist-yes" class="label">Yes</label>
						<input
							type="radio"
							name="checklist-boolean"
							id="checklist-no"
							bind:value={subsections[sIndex].items[iIndex].value}
						/>
						<label for="checklist-no" class="label">No</label>
					</p>
					<input
						type="text"
						class="checklist-remarks"
						placeholder="Remarks"
						bind:value={subsections[sIndex].items[iIndex].remarks}
					/>
				{/each}
			</div>
			<br />
		{/each}
		<p class="note">
			<b
				>Permission to do Hot Work and this approval is valid to the location specified in the hot
				work permit only, contractor must apply for a different hot work permit for a different
				location.</b
			>
		</p>
		<br />
		<hr />
		<h2 class="heading">Contractor Information</h2>
		<div class="forms-p">
			<label for="contractor-name" class="forms-label">Contractor Name:</label>
			<input type="text" class="forms-input" bind:value={contractor_name} required />
		</div>
		<div class="forms-p">
			<label for="ic-passport" class="forms-label">IC or Passport No.:</label>
			<input type="text" class="forms-input" bind:value={contractor_id} required />
		</div>
		<div class="forms-p">
			<label for="phone-no" class="forms-label">Phone No.:</label>
			<input type="text" class="forms-input" bind:value={phone_no} required />
		</div>
		<div class="forms-p">
			<label for="company-name" class="forms-label">Company Name:</label>
			<input type="text" class="forms-input" bind:value={company_name} required />
		</div>
		<br />
		<h2 class="heading">Verified By</h2>
		<div class="forms-p">
			<label for="coordinator-name" class="forms-label">Project Coordinator Name:</label>
			<input type="text" class="forms-input" bind:value={coordinator_name} required />
		</div>
		<div class="forms-p">
			<label for="officer-name" class="forms-label">SHE Officer Name:</label>
			<input type="text" class="forms-input" bind:value={officer_name} required />
		</div>
		<br />
		<hr />
		<h2 class="heading">Acknowledgement and Submission</h2>
		<div class="container">
			<div class="checkbox">
				<input type="checkbox" name="checkbox" id="checkbox" bind:checked={acknowledged} required />
			</div>
			<div class="declaration">
				<p>The declaration for the Hot Work Activities Report as below:</p>
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
	* {
		font-family: Arial, Helvetica, sans-serif;
		font-size: 14px;
		color: #091747;
	}

	button {
		background-color: #064c6dd7;
		color: #ffffff;
		border: none;
		font-size: small;
		padding: 6px 14px;
		border-radius: 4px;
		cursor: pointer;
	}

	.button-submit {
		display: flex;
		align-items: center;
		gap: 8px;
		background-color: #091747;
		font-weight: bold;
		margin: 5px;
		padding: 10px 20px;
	}

	.button-submit:hover {
		background-color: #091747b9;
	}

	.checklist-grid {
		margin-top: 15px;
		display: grid;
		grid-template-columns: 40px 1fr 100px 2fr;
		align-items: center;
		gap: 10px;
	}

	.checklist-radio {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
	}

	.checklist-remarks {
		width: 100%;
		height: 38px;
		padding: 6px 10px;
		font-size: 14px;
	}

	.container {
		display: flex;
		margin: 10px 0;
	}

	.declaration {
		padding: 0 10px;
		font-weight: bold;
	}

	.declaration p {
		margin-bottom: 10px;
	}

	.forms {
		margin: 0;
		position: relative;
	}

	.forms-date {
		cursor: pointer;
	}

	.forms-date::-webkit-calendar-picker-indicator {
		cursor: pointer;
	}

	.forms-input {
		height: 30px;
		width: 500px;
		font-size: 14px;
	}

	.forms-label {
		width: 200px;
		font-size: 14px;
	}

	.forms-p {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 10px 0;
	}

	.heading {
		margin: 10px 0;
		font-size: 20px;
		font-weight: bold;
	}

	.index {
		text-align: center;
	}

	.project-box {
		margin: 10px;
		border: 1px solid #091747;
		border-radius: 4px;
		padding: 10px;
		font-size: 14px;
	}

	.subheading {
		margin: 10px 0;
		font-size: 16px;
		font-weight: bold;
	}

	.submit {
		display: flex;
		justify-content: flex-end;
	}

	.title {
		font-size: 35px;
		font-weight: bold;
		margin-bottom: 20px;
		padding: 0 10px;
	}

	@media (max-width: 1024px) {
		.title {
			font-size: 24px;
			margin-bottom: 15px;
		}

		.project-box {
			margin: 8px;
			padding: 10px;
		}

		.forms-input {
			width: 100%;
			max-width: 100%;
		}

		.forms-label {
			width: 180px;
		}

		.forms-p {
			align-items: flex-start;
		}

		.checklist-grid {
			grid-template-columns: 30px 1fr 90px 1.5fr;
			gap: 8px;
		}

		.checklist-remarks {
			height: 36px;
		}

		.declaration {
			padding-left: 8px;
		}

		.declaration p {
			word-break: break-word;
			overflow-wrap: anywhere;
		}
	}

	@media (max-width: 600px) {
		.title {
			font-size: 22px;
			margin-bottom: 14px;
		}

		.project-box {
			margin: 6px;
			padding: 8px;
		}

		.heading {
			font-size: 18px;
		}

		.subheading {
			margin: 0;
		}

		.forms-p {
			flex-direction: column;
			align-items: flex-start;
			gap: 4px;
		}

		.forms-label {
			width: 100%;
			font-size: 13px;
		}

		.forms-input {
			width: 100%;
			height: 34px;
			font-size: 13px;
		}

		.checklist-grid {
			grid-template-columns: auto 1fr;
			gap: 6px 8px;
		}

		.index {
			grid-column: 1;
			margin-top: 5px;
		}

		.item-label {
			grid-column: 2;
			margin-top: 5px;
		}

		.checklist-radio {
			grid-column: 1 / -1;
			display: flex;
			gap: 20px;
			margin: 6px 0;
		}

		.checklist-remarks {
			grid-column: 1 / -1;
			width: 100%;
			height: 40px;
			padding: 8px;
			border-radius: 6px;
			border: 1px solid #ccc;
		}

		.container {
			gap: 10px;
		}

		.declaration {
			padding: 0;
			font-size: 13px;
		}

		.declaration p {
			font-size: 13px;
		}

		.submit {
			justify-content: center;
		}

		.button-submit {
			width: 100%;
			justify-content: center;
		}
	}
</style>