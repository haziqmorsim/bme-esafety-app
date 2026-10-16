<script>
	import Search from '@lucide/svelte/icons/search';
	import FileText from '@lucide/svelte/icons/file-text';
	import Check from '@lucide/svelte/icons/check';
	import { supabase } from '$lib/supabase';
	import { goto } from '$app/navigation';
	import { requireUser } from '$lib/auth-guard';

	let showProjectModal = false;
	let projects = [];
	let filteredProjects = [];
	let projectSearch = '';
	let projectLoading = false;
	let projectError = '';

	let project_name = '';
	let project_no = '';
	let date = '';
	let weather = '';

	let subsections = [
		{
			key: 'safety',
			items: [
				{
					label:
						'Review any of the Daily Triple Safety Activities and ensure these are conducted effectively',
					checked: '',
					remarks: ''
				},
				{ note: 'Toolbox Meeting, PPE Visual Inspection, Housekeeping' }
			]
		},
		{
			key: 'bulletin',
			items: [
				{
					label: 'Inspects bulletin boards are up to date and neatly kept',
					checked: '',
					remarks: ''
				},
				{ note: 'Safety and warning signboards are available, visible, and in good condition' }
			]
		},
		{
			key: 'storage',
			items: [
				{ label: 'Check availability of Documentation Storage Area', checked: '', remarks: '' },
				{
					note: "Complete safety document (PTW, Check worker\\'s passport, Permit & CIDB green card validity, SDS, etc.) are stored in an accessible and organized location"
				}
			]
		},
		{
			key: 'firstaid',
			items: [
				{ label: 'First Aid Kit', checked: '', remarks: '' },
				{ note: 'First aid kit available, fully stocked, and checked regularly' }
			]
		},
		{
			key: 'fire',
			items: [
				{ label: 'Fire Extinguisher', checked: '', remarks: '' },
				{ note: 'Fire extinguisher available, condition and expiry date' }
			]
		},
		{
			key: 'noise',
			items: [
				{ label: 'Excessive Noise Identification Checklist', checked: '', remarks: '' },
				{
					note: 'Ensure the checklist for identification of excessive noise is filled up and current'
				}
			]
		},
		{
			key: 'chra',
			items: [
				{ label: 'CHRA Suitability', checked: '', remarks: '' },
				{
					note: 'Confirm that the generic CHRA used is suitable and applicable for the current site activities'
				}
			]
		},
		{
			key: 'audit',
			items: [
				{ label: 'No Compromise Audit', checked: '', remarks: '' },
				{
					note: 'Check and determine if the once a month "No Compromise Audit" is done and if not, to work with the 3S on site to conduct the audit and align the standard of marking'
				}
			]
		}
	];

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

	let showSuccess = false;
	let successTimer;

	const processedSubsections = subsections.map((s) => {
		const items = [];
		for (let i = 0; i < s.items.length; i++) {
			const it = s.items[i];
			if (it.label) {
				let note;
				const next = s.items[i + 1];
				if (next && next.note) {
					note = next.note;
					i++;
				}
				items.push({ label: it.label, note });
			} else if (it.note) {
				items.push({ label: '', note: it.note });
			}
		}
		return { items };
	});

	const subsectionOffsets = (() => {
		const offsets = [];
		let acc = 0;
		for (const s of processedSubsections) {
			offsets.push(acc);
			acc += s.items.length;
		}
		return offsets;
	})();

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
				supabase
					.from('profiles')
					.select('first_name, last_name, nickname')
					.eq('id', user.id)
					.single(),
				15000
			);

			if (profileError) throw profileError;

			const submitterName =
				`${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || user.email;

			const payload = {
				project_name,
				project_no,
				date,
				weather,
				subsections,
				remarks,
				acknowledged,
				created_by: user.id,
				created_by_name: submitterName
			};

			const { error: insErr } = await withTimeout(
				supabase.from('soa_submissions').insert(payload),
				15000
			);
			if (insErr) throw insErr;

			showSuccess = true;

			setTimeout(() => {
				showSuccess = false;
				goto('/');
			}, 3000);
		} catch (error) {
			errorMsg = error?.message ?? String(error);
		} finally {
			saving = false;
		}
	}

	async function loadProjects() {
		projectLoading = true;
		projectError = '';

		const { data, error } = await supabase
			.from('projects')
			.select('project_name, project_id, region, location')
			.order('project_name', { ascending: true });

		if (error) {
			projectError = error.message;
			projects = [];
			filteredProjects = [];
		} else {
			projects = data ?? [];
			filterProjects();
		}

		projectLoading = false;
	}

	function filterProjects() {
		const query = projectSearch.trim().toLowerCase();
		if (!query) {
			filteredProjects = projects;
			return;
		}

		filteredProjects = projects.filter((project) => {
			const name = project.project_name ?? '';
			const id = project.project_id ?? '';
			return `${name} ${id}`.toLowerCase().includes(query);
		});
	}

	async function openProjectModal() {
		showProjectModal = true;
		if (projects.length === 0 && !projectLoading) {
			await loadProjects();
		}
	}

	function closeProjectModal() {
		showProjectModal = false;
	}

	function selectProject(project) {
		project_name = project.project_name ?? '';
		project_no = project.project_id ?? '';
		region = project.region ?? '';
		location = project.location ?? '';
		closeProjectModal();
	}
</script>

<h1 class="title">Safety Officer Audit Report (e-SOA) Submission</h1>

<div class="project-box">
	<form class="forms" onsubmit={handleSubmit}>
		<h2 class="heading">General Information</h2>
		<button type="button" class="button-primary" onclick={openProjectModal}
			><Search />Search Project</button
		>
		<div class="forms-p">
			<label for="project-name" class="forms-label">Project Name:</label>
			<input type="text" class="forms-input" bind:value={project_name} disabled />
		</div>
		<div class="forms-p">
			<label for="project-no" class="forms-label">Project No.:</label>
			<input type="text" class="forms-input" bind:value={project_no} disabled />
		</div>
		<div class="forms-p">
			<label for="audit-date" class="forms-label">Date:</label>
			<input
				type="date"
				class="forms-input forms-date"
				bind:value={date}
				onfocus={(e) => e.target.showPicker?.()}
				required
			/>
		</div>
		<div class="forms-p">
			<label for="audit-weather" class="forms-label">Weather:</label>
			<input type="text" class="forms-input" bind:value={weather} required />
		</div>
		{#if showProjectModal}
			<div class="modal-overlay" role="dialog" aria-modal="true" aria-label="Select project">
				<div class="modal">
					<h3>Select a Project</h3>
					<div class="project-search">
						<input
							type="text"
							placeholder="Project Name/Project ID"
							class="project-search-input"
							bind:value={projectSearch}
							oninput={filterProjects}
						/>
						<button type="button" class="project-search-button" onclick={filterProjects}>
							<Search />
						</button>
					</div>
					<div class="project-list">
						<div class="project-list-header">
							<span>Project Name</span>
							<span>Project ID</span>
						</div>
						{#if projectLoading}
							<p class="project-status">Loading projects...</p>
						{:else if projectError}
							<p class="project-status error">{projectError}</p>
						{:else if filteredProjects.length === 0}
							<p class="project-status">No projects found.</p>
						{:else}
							{#each filteredProjects as project}
								<button type="button" class="project-row" onclick={() => selectProject(project)}>
									<span>{project.project_name ?? '-'}</span>
									<span class="project-row-id">{project.project_id ?? '-'}</span>
								</button>
							{/each}
						{/if}
					</div>
					<div class="modal-actions">
						<button type="button" class="button-secondary" onclick={closeProjectModal}>
							Cancel
						</button>
					</div>
				</div>
			</div>
		{/if}
		<br />
		<hr />
		<h2 class="heading">Safety Officer Audit Checklist</h2>
		<div class="categories">
			<p>No.</p>
			<p>Inspection Item</p>
			<p></p>
			<p>Status</p>
			<p></p>
		</div>
		{#each subsections as subsection, sIndex}
			<div class="audit-grid">
				{#each processedSubsections[sIndex].items as item, iIndex}
					<p class="index">{subsectionOffsets[sIndex] + iIndex + 1}</p>
					<div class="audit-label">
						<p>{item.label}</p>
						{#if item.note}
							<p class="item-note">{item.note}</p>
						{/if}
					</div>
					<div class="audit-check">
						<label class="circle-checkbox">
							<input
								type="checkbox"
								name="item-status"
								bind:checked={subsections[sIndex].items[iIndex].checked}
							/>
							<span class="checkmark" aria-hidden="true"></span>
						</label>
					</div>
					<input
						type="text"
						class="audit-remarks"
						placeholder="Remarks"
						bind:value={subsections[sIndex].items[iIndex].remarks}
					/>
				{/each}
			</div>
		{/each}
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
				<input type="checkbox" name="checkbox" id="checkbox" bind:checked={acknowledged} />
			</div>
			<div class="declaration">
				<p>The declaration for the Safety Officer Audit Report as below:</p>
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
		<p class="note">Note: Double check if content is correct before submitting.</p>
		<!-- <div class="forms-p">
			<p><b>Confirm Login Password</b></p>
			<input type="password" class="forms-input" />
		</div> -->
		{#if errorMsg}
			<p class="error">{errorMsg}</p>
		{/if}
		<div class="submit">
			<button type="submit" class="button-submit"
				><FileText />{saving ? 'Submitting...' : 'Submit'}</button
			>
		</div>
	</form>
	{#if showSuccess}
		<div class="success-overlay">
			<div class="success-popup">
				<h3>Success! <Check strokeWidth={4} /></h3>
				<p>Your form submission was successful.</p>
			</div>
		</div>
	{/if}
</div>

<style>
	* {
		font-family: Arial, Helvetica, sans-serif;
		font-size: 14px;
		color: #091747;
	}

	.audit-check {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
	}

	.circle-checkbox {
		display: inline-block;
		position: relative;
		width: 35px;
		height: 35px;
		cursor: pointer;
	}

	.circle-checkbox input {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
		margin: 0;
		padding: 0;
	}

	.circle-checkbox .checkmark {
		display: inline-block;
		width: 35px;
		height: 35px;
		border-radius: 50%;
		border: 2px solid #091747;
		background: #ffffff;
		box-sizing: border-box;
		position: relative;
	}

	.circle-checkbox .checkmark::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 50%;
		width: 18px;
		height: 18px;
		background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><polyline points='20 6 9 17 4 12' stroke='%23ffffff' stroke-width='2.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>");
		background-repeat: no-repeat;
		background-position: center;
		background-size: 100% 100%;
		transform: translate(-50%, -50%) scale(0);
		transition:
			transform 140ms ease,
			opacity 120ms ease;
		opacity: 0;
		pointer-events: none;
	}
	.circle-checkbox input:checked + .checkmark {
		background: #091747;
	}

	.circle-checkbox input:checked + .checkmark::after {
		transform: translate(-50%, -50%) scale(1);
		opacity: 1;
	}

	.circle-checkbox input:focus + .checkmark {
		outline: 3px solid rgba(9, 23, 71, 0.12);
	}

	.audit-grid {
		margin: 15px 0;
		display: grid;
		grid-template-columns: 40px 3fr 50px 3fr;
		align-items: center;
		gap: 10px;
	}

	.audit-remarks {
		width: 100%;
		height: 35px;
		padding: 6px 10px;
		font-size: 14px;
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

	.button-primary {
		display: flex;
		align-items: center;
		gap: 8px;
		background-color: #091747;
		margin: 10px 0 20px 0;
		padding: 10px 20px;
	}

	.button-primary:hover {
		background-color: #091747b9;
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

	.button-secondary {
		background-color: #ffffff;
		color: #091747;
		border: 1px solid #091747;
		padding: 8px 18px;
		border-radius: 6px;
		cursor: pointer;
		font-weight: bold;
	}

	.button-secondary:hover {
		background-color: #dedede;
	}

	.categories {
		margin: 10px 0;
		display: grid;
		grid-template-columns: 40px 3fr 50px 50px 3fr;
		text-align: center;
		font-weight: bold;
		align-items: center;
		gap: 10px;
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

	.forms-input {
		height: 30px;
		width: 500px;
		font-size: 14px;
	}

	.forms-label {
		width: 150px;
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

	.item-note {
		margin-top: 6px;
		font-size: 12px;
		color: #4a5568;
	}

	.note {
		margin-bottom: 10px;
	}

	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(9, 23, 71, 0.35);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
		z-index: 50;
	}

	.modal {
		background: #ffffff;
		border-radius: 10px;
		box-shadow: 0 12px 30px rgba(0, 0, 0, 0.2);
		padding: 20px;
		width: min(600px, 95vw);
	}

	.modal h3 {
		margin: 0 0 16px 0;
		font-size: 20px;
	}

	.project-search {
		display: flex;
		gap: 10px;
		margin-bottom: 16px;
	}

	.project-search-input {
		flex: 1;
		height: 36px;
		padding: 0 10px;
		border: 1px solid #cfd6e4;
		border-radius: 6px;
		font-size: 14px;
	}

	.project-search-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 36px;
		padding: 0;
		background-color: #091747;
		border-radius: 6px;
	}

	.project-search-button:hover {
		background-color: #091747b9;
	}

	.project-list {
		border: 1px solid #cfd6e4;
		border-radius: 8px;
		overflow: hidden;
		max-height: 320px;
		overflow-y: auto;
	}

	.project-list-header,
	.project-row {
		display: grid;
		grid-template-columns: 1.5fr 1fr;
		gap: 10px;
		padding: 10px 12px;
	}

	.project-list-header {
		background-color: #f2f4f9;
		font-weight: bold;
		border-bottom: 1px solid #cfd6e4;
		text-align: center;
	}

	.project-row {
		width: 100%;
		text-align: left;
		background: #ffffff;
		border: none;
		border-bottom: 1px solid #e3e8f0;
		cursor: pointer;
	}

	.project-row:last-child {
		border-bottom: none;
	}

	.project-row:hover {
		background-color: #dedede;
	}

	.project-row-id {
		text-align: center;
	}

	.project-status {
		padding: 12px;
		margin: 0;
	}

	.modal-actions {
		display: flex;
		justify-content: flex-start;
		margin-top: 16px;
	}

	.project-box {
		margin: 10px;
		border: 1px solid #091747;
		border-radius: 4px;
		padding: 10px;
		font-size: 14px;
	}

	.remarks {
		width: 100%;
		height: 200px;
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

		.forms-label {
			width: 180px;
		}

		.forms-input {
			width: 100%;
			max-width: 100%;
		}

		.categories {
			grid-template-columns: 40px 2.5fr 50px 50px 2.5fr;
			font-size: 13px;
		}

		.audit-grid {
			grid-template-columns: 40px 2.5fr 50px 2.5fr;
			gap: 8px;
		}

		.audit-remarks {
			font-size: 13px;
		}

		.circle-checkbox {
			width: 32px;
			height: 32px;
		}

		.circle-checkbox .checkmark {
			width: 32px;
			height: 32px;
		}

		.remarks {
			height: 180px;
		}

		.modal {
			width: min(600px, 92vw);
			max-height: 85vh;
			overflow: auto;
		}

		.project-row span {
			word-break: break-word;
			overflow-wrap: anywhere;
		}

		.modal {
			width: min(520px, 95vw);
			padding: 16px;
		}

		.project-list-header,
		.project-row {
			grid-template-columns: 1.4fr 1fr;
		}

		p,
		label,
		.declaration p {
			white-space: normal;
			word-break: break-word;
			overflow-wrap: anywhere;
		}
	}

	@media (max-width: 600px) {
		.title {
			font-size: 22px;
			margin-bottom: 14px;
		}

		.heading {
			font-size: 18px;
		}

		.project-box {
			margin: 6px;
			padding: 8px;
		}

		.forms-p {
			flex-direction: column;
			align-items: flex-start;
			gap: 6px;
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

		.categories {
			display: none;
		}

		.audit-grid {
			grid-template-columns: auto 1fr;
			gap: 6px 8px;
		}

		.index {
			align-self: start;
			grid-column: 1;
			font-weight: bold;
		}

		.audit-label {
			grid-column: 2;
		}

		.audit-check {
			grid-column: 1;
			display: flex;
			align-items: center;
		}

		.audit-remarks {
			grid-column: 2;
			width: 100%;
			height: 36px;
			padding: 6px 8px;
			border-radius: 6px;
			border: 1px solid #ccc;
		}

		.circle-checkbox {
			width: 30px;
			height: 30px;
		}

		.circle-checkbox .checkmark {
			width: 30px;
			height: 30px;
		}

		.item-note {
			font-size: 12px;
		}

		.remarks {
			width: 100%;
			height: 160px;
			font-size: 13px;
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

		.button-primary,
		.button-submit {
			width: 100%;
			justify-content: center;
		}

		.submit {
			justify-content: center;
		}
	}
</style>
