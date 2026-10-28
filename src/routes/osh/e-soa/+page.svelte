<script>
	import { validation, checkSubmit } from '$lib/validation';
	import Search from '@lucide/svelte/icons/search';
	import Spinner from '$lib/components/Spinner.svelte';
	import FileText from '@lucide/svelte/icons/file-text';
	import { supabase } from '$lib/supabase';
	import { goto } from '$app/navigation';
	import { requireUser } from '$lib/auth-guard';
	import Modal from '$lib/components/Modal.svelte';
	import { toast } from '$lib/stores/toast';

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
		if (!checkSubmit(e)) return;
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

			toast.success('e-SOA submitted successfully.');
			goto('/');
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
		closeProjectModal();
	}
</script>

<h1 class="title">Safety Officer Audit Report (e-SOA) Submission</h1>

<div class="project-box">
	<form class="forms" use:validation onsubmit={handleSubmit}>
		<h2 class="heading">General Information</h2>
		<button type="button" class="button-primary" onclick={openProjectModal}
			><Search />Search Project</button
		>
		<div class="forms-p">
			<label for="project-name" class="forms-label">Project Name:</label>
			<input data-message="Select a project using Search Project." required type="text" class="forms-input" bind:value={project_name} readonly />
		</div>
		<div class="forms-p">
			<label for="project-no" class="forms-label">Project No.:</label>
			<input required type="text" class="forms-input" bind:value={project_no} readonly />
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
		<Modal open={showProjectModal} title="Select a Project" onclose={closeProjectModal}>
			<div class="project-search">
				<input
					type="text"
					placeholder="Project Name/Project No."
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
					<span>Project No.</span>
				</div>
				{#if projectLoading}
					<div class="project-status">
						<Spinner inline size={140} label="Loading projects" />
					</div>
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
			{#snippet footer()}
				<button type="button" class="button-secondary" onclick={closeProjectModal}>
					Cancel
				</button>
			{/snippet}
		</Modal>
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
		<h2 class="heading" data-label-for="checkbox">Acknowledgement and Submission</h2>
		<div class="container" data-field>
			<div class="checkbox">
				<input data-label="Acknowledgement" required type="checkbox" name="checkbox" id="checkbox" bind:checked={acknowledged} />
			</div>
			<div class="declaration">
				<p>The declaration for the Safety Officer Audit Report is as below.</p>
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
		<p class="note">Note: Double check if content is correct before submitting.</p>
		{#if errorMsg}
			<p class="error">{errorMsg}</p>
		{/if}
		<div class="submit">
			<button type="submit" class="button-submit"
				><FileText />{saving ? 'Submitting...' : 'Submit'}</button
			>
		</div>
	</form>
</div>

<style>
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
		border: 2px solid var(--line-strong);
		background: var(--surface);
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
		background: var(--fill);
	}

	.circle-checkbox input:checked + .checkmark::after {
		transform: translate(-50%, -50%) scale(1);
		opacity: 1;
	}

	.circle-checkbox input:focus + .checkmark {
		outline: 3px solid var(--focus-soft);
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

	.categories {
		margin: 10px 0;
		display: grid;
		grid-template-columns: 40px 3fr 50px 50px 3fr;
		text-align: center;
		font-weight: 600;
		align-items: center;
		gap: 10px;
	}

	.container {
		display: flex;
		margin: 10px 0;
	}

	.index {
		text-align: center;
	}

	.item-note {
		margin-top: 6px;
		font-size: 12px;
		color: var(--muted);
	}

	.note {
		margin-bottom: 10px;
	}

	ul {
		list-style-type: circle;
		margin: 0 0 10px 15px;
	}

	@media (max-width: 1024px) {
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

		.project-row span {
			word-break: break-word;
			overflow-wrap: anywhere;
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
			font-weight: 600;
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
			border-radius: var(--r-md);
			border: 1px solid var(--line-strong);
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

		.container {
			gap: 10px;
		}
	}
</style>