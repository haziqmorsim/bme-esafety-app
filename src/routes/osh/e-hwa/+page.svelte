<script>
	import { validation, checkSubmit } from '$lib/validation';
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
		if (!checkSubmit(e)) return;
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

			toast.success('e-HWA submitted successfully.');
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
	<form class="forms" use:validation onsubmit={handleSubmit}>
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
					<p class="item-label" data-label-for={`checklist-${sIndex}-${iIndex}`}>{item.label}</p>
					<p class="checklist-radio">
						<input required
							type="radio"
							name={`checklist-${sIndex}-${iIndex}`}
							id={`checklist-${sIndex}-${iIndex}-yes`}
							value="Yes"
							data-message="Select Yes or No."
							bind:group={subsections[sIndex].items[iIndex].value}
						/>
						<label for={`checklist-${sIndex}-${iIndex}-yes`} class="label">Yes</label>
						<input
							type="radio"
							name={`checklist-${sIndex}-${iIndex}`}
							id={`checklist-${sIndex}-${iIndex}-no`}
							value="No"
							bind:group={subsections[sIndex].items[iIndex].value}
						/>
						<label for={`checklist-${sIndex}-${iIndex}-no`} class="label">No</label>
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
		<h2 class="heading" data-label-for="checkbox">Acknowledgement and Submission</h2>
		<div class="container" data-field>
			<div class="checkbox">
				<input data-label="Acknowledgement" type="checkbox" name="checkbox" id="checkbox" bind:checked={acknowledged} required />
			</div>
			<div class="declaration">
				<p>The declaration for the Hot Work Activities Report is as below.</p>
				<p>
					I hereby acknowledge that I have conducted a thorough check and confirm the following:
				</p>
				<ul>
					<li>All information in this report is accurate and up to date.</li>
					<li>All personnel working on site are registered and have appropriate permits.</li>
				</ul>
				<p>I understand that this action may be recorded as part of the official audit trail.</p>
			</div>
		</div>
		<p>Note: Double check if content is correct before submitting.</p>
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

	.index {
		text-align: center;
	}

	.subheading {
		margin: 10px 0;
		font-size: 16px;
		font-weight: 600;
	}

	ul {
		list-style-type: circle;
		margin: 0 0 10px 15px;
	}

	@media (max-width: 1024px) {
		.checklist-grid {
			grid-template-columns: 30px 1fr 90px 1.5fr;
			gap: 8px;
		}

		.checklist-remarks {
			height: 36px;
		}
	}

	@media (max-width: 600px) {
		.subheading {
			margin: 0;
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
			border-radius: var(--r-md);
			border: 1px solid var(--line-strong);
		}

		.container {
			gap: 10px;
		}
	}
</style>