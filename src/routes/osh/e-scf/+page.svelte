<script>
	import ChevronsLeft from '@lucide/svelte/icons/chevrons-left';
	import ChevronsRight from '@lucide/svelte/icons/chevrons-right';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Plus from '@lucide/svelte/icons/plus';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Search from '@lucide/svelte/icons/search';
	import Paperclip from '@lucide/svelte/icons/paperclip';
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { requireUser } from '$lib/auth-guard';
	import { toast } from '$lib/stores/toast';
	import Modal from '$lib/components/Modal.svelte';

	const BUCKET = 'scf_uploads';
	const ATTACHMENT_FOLDER = 'maps_screenshot';

	const SITE_ALLOWANCE_OPTIONS = [{ value: '50', label: 'RM 50' }];

	const AMOUNT_FIELDS = [
		{ key: 'site_allowance', label: 'Site Allowance' },
		{ key: 'accommodation', label: 'Accommodation' },
		{ key: 'toll_fare', label: 'Toll Fare' },
		{ key: 'claim_mileage', label: 'Mileage' },
		{ key: 'fuel_cost', label: 'Fuel Cost' },
		{ key: 'site_purchase', label: 'Site Purchase' },
		{ key: 'claim_other', label: 'Other' }
	];

	const monthNames = [
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
	const monthShort = monthNames.map((m) => m.slice(0, 3));

	const today = new Date();
	let viewYear = $state(today.getFullYear());
	let viewMonth = $state(today.getMonth());

	let currentUser = $state(null);
	let staffInfo = $state({ staff_name: '', staff_position: '', department: '' });

	let claims = $state([]);
	let loading = $state(false);
	let pageError = $state('');
	let loadToken = 0;

	let showClaimModal = $state(false);
	let modalMode = $state('create');
	let editingClaim = $state(null);
	let form = $state(emptyForm());
	let attachmentFile = $state(null);
	let fileInput = $state(null);
	let formError = $state('');
	let saving = $state(false);

	let showDeleteModal = $state(false);
	let deletingClaim = $state(null);
	let deleting = $state(false);
	let deleteError = $state('');

	let showProjectModal = $state(false);
	let projects = $state([]);
	let projectSearch = $state('');
	let projectLoading = $state(false);
	let projectError = $state('');

	const days = $derived.by(() => {
		const count = new Date(viewYear, viewMonth + 1, 0).getDate();
		return Array.from({ length: count }, (_, i) => {
			const day = i + 1;
			const date = new Date(viewYear, viewMonth, day);
			return {
				day,
				key: dateKey(viewYear, viewMonth, day),
				label: `${date.toLocaleDateString('en-GB', { weekday: 'long' })}, ${pad(day)} ${monthNames[viewMonth]}`,
				isToday:
					today.getFullYear() === viewYear &&
					today.getMonth() === viewMonth &&
					today.getDate() === day
			};
		});
	});

	const claimsByDate = $derived.by(() => {
		const map = {};
		for (const claim of claims) {
			(map[claim.claim_date] ??= []).push(claim);
		}
		return map;
	});

	const filteredProjects = $derived.by(() => {
		const query = projectSearch.trim().toLowerCase();
		if (!query) return projects;
		return projects.filter((p) =>
			`${p.project_name ?? ''} ${p.project_id ?? ''}`.toLowerCase().includes(query)
		);
	});

	const selectedProjectName = $derived(
		projects.find((p) => p.project_id === form.project_no)?.project_name ?? ''
	);

	const siteAllowanceTaken = $derived(
		showClaimModal &&
			(claimsByDate[form.claim_date] ?? []).some(
				(c) => hasValue(c.site_allowance) && c.id !== editingClaim?.id
			)
	);

	const descriptionHasComma = $derived(form.description.includes(','));
	const remarksHasComma = $derived(form.claim_remarks.includes(','));

	const attachmentLocked = $derived(modalMode === 'edit' && !!editingClaim?.maps_screenshot_path);

	function pad(n) {
		return String(n).padStart(2, '0');
	}

	function dateKey(year, month, day) {
		return `${year}-${pad(month + 1)}-${pad(day)}`;
	}

	function formatShortDate(key) {
		if (!key) return '';
		const [y, m, d] = key.split('-').map(Number);
		return `${pad(d)} ${monthShort[m - 1]} ${y}`;
	}

	function hasValue(v) {
		return v !== null && v !== undefined && String(v).trim() !== '';
	}

	function emptyForm(claimDate = '') {
		return {
			claim_date: claimDate,
			project_no: '',
			description: '',
			site_allowance: '',
			accommodation: '',
			toll_fare: '',
			claim_mileage: '',
			site_purchase: '',
			claim_other: '',
			claim_remarks: ''
		};
	}

	function clean(v) {
		const s = v === null || v === undefined ? '' : String(v).trim();
		return s === '' ? null : s;
	}

	function fileName(path) {
		return path ? String(path).split('/').pop() : '';
	}

	function prevMonth() {
		if (viewMonth === 0) {
			viewMonth = 11;
			viewYear -= 1;
		} else {
			viewMonth -= 1;
		}
	}

	function nextMonth() {
		if (viewMonth === 11) {
			viewMonth = 0;
			viewYear += 1;
		} else {
			viewMonth += 1;
		}
	}

	async function loadStaffInfo(user) {
		const { data: profile } = await supabase
			.from('profiles')
			.select('first_name, last_name, position, department')
			.eq('id', user.id)
			.single();

		const name = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || user.email;
		const dept = Array.isArray(profile?.department)
			? profile.department.join(', ')
			: (profile?.department ?? '');

		staffInfo = {
			staff_name: name,
			staff_position: profile?.position ?? '',
			department: dept
		};
	}

	async function loadClaims(year, month) {
		const token = ++loadToken;
		loading = true;
		pageError = '';

		try {
			const auth = await requireUser();
			if (!auth) return;
			currentUser = auth.user;

			const start = dateKey(year, month, 1);
			const end = dateKey(year, month, new Date(year, month + 1, 0).getDate());

			const { data, error } = await supabase
				.from('scf_submissions')
				.select('*')
				.eq('created_by', auth.user.id)
				.gte('claim_date', start)
				.lte('claim_date', end)
				.order('created_at', { ascending: true });

			if (token !== loadToken) return; // a newer month was requested meanwhile
			if (error) throw error;

			claims = data ?? [];
		} catch (error) {
			if (token === loadToken) pageError = error?.message ?? String(error);
		} finally {
			if (token === loadToken) loading = false;
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
		} else {
			projects = data ?? [];
		}

		projectLoading = false;
	}

	onMount(async () => {
		const auth = await requireUser();
		if (!auth) return;
		currentUser = auth.user;
		loadStaffInfo(auth.user);
		loadProjects();
	});

	$effect(() => {
		loadClaims(viewYear, viewMonth);
	});

	function openCreateModal(key) {
		modalMode = 'create';
		editingClaim = null;
		form = emptyForm(key);
		attachmentFile = null;
		formError = '';
		showClaimModal = true;
	}

	function openEditModal(claim) {
		modalMode = 'edit';
		editingClaim = claim;
		form = {
			claim_date: claim.claim_date,
			project_no: claim.project_no ?? '',
			description: claim.description ?? '',
			site_allowance: claim.site_allowance ?? '',
			accommodation: claim.accommodation ?? '',
			toll_fare: claim.toll_fare ?? '',
			claim_mileage: claim.claim_mileage ?? '',
			site_purchase: claim.site_purchase ?? '',
			claim_other: claim.claim_other ?? '',
			claim_remarks: claim.claim_remarks ?? ''
		};
		attachmentFile = null;
		formError = '';
		showClaimModal = true;
	}

	function closeClaimModal() {
		if (saving) return;
		showClaimModal = false;
		showProjectModal = false;
	}

	function onAttachmentChange(event) {
		attachmentFile = event.currentTarget.files?.[0] ?? null;
	}

	function clearAttachment() {
		attachmentFile = null;
		if (fileInput) fileInput.value = '';
	}

	async function uploadAttachment(file) {
		const ext = file.name.split('.').pop() || 'bin';
		const path = `${ATTACHMENT_FOLDER}/${crypto.randomUUID()}.${ext}`;

		const { data, error } = await supabase.storage
			.from(BUCKET)
			.upload(path, file, { upsert: false });

		if (error) throw error;
		return data.path;
	}

	function validateForm() {
		if (!form.project_no) return 'Please select a project.';
		if (!form.description.trim()) return 'Please enter the travel location (From-To).';
		if (descriptionHasComma) return 'Travel Location must not contain commas (,).';
		if (remarksHasComma) return 'Remarks must not contain commas (,).';
		if (hasValue(form.site_allowance) && siteAllowanceTaken) {
			return 'Site allowance has already been claimed on this date.';
		}
		return '';
	}

	async function siteAllowanceExistsInDb(userId) {
		let query = supabase
			.from('scf_submissions')
			.select('id')
			.eq('created_by', userId)
			.eq('claim_date', form.claim_date)
			.not('site_allowance', 'is', null)
			.neq('site_allowance', '')
			.limit(1);

		if (editingClaim) query = query.neq('id', editingClaim.id);

		const { data, error } = await query;
		if (error) throw error;
		return (data ?? []).length > 0;
	}

	async function saveClaim(event) {
		event.preventDefault();
		formError = validateForm();
		if (formError) return;

		saving = true;
		let successMessage = '';

		try {
			const auth = await requireUser();
			if (!auth) return;
			const { user } = auth;

			if (hasValue(form.site_allowance) && (await siteAllowanceExistsInDb(user.id))) {
				throw new Error('Site allowance has already been claimed on this date.');
			}

			const fields = {
				claim_date: form.claim_date,
				project_no: clean(form.project_no),
				description: clean(form.description),
				site_allowance: clean(form.site_allowance),
				accommodation: clean(form.accommodation),
				toll_fare: clean(form.toll_fare),
				claim_mileage: clean(form.claim_mileage),
				site_purchase: clean(form.site_purchase),
				claim_other: clean(form.claim_other),
				claim_remarks: clean(form.claim_remarks)
			};

			if (attachmentFile && !attachmentLocked) {
				fields.maps_screenshot_path = await uploadAttachment(attachmentFile);
			}

			if (modalMode === 'create') {
				const { data, error } = await supabase
					.from('scf_submissions')
					.insert({
						...fields,
						staff_name: clean(staffInfo.staff_name),
						staff_position: clean(staffInfo.staff_position),
						department: clean(staffInfo.department),
						created_by: user.id
					})
					.select()
					.single();

				if (error) throw error;
				claims = [...claims, data];
				successMessage = `Claim for ${formatShortDate(fields.claim_date)} created successfully.`;
			} else {
				const { data, error } = await supabase
					.from('scf_submissions')
					.update(fields)
					.eq('id', editingClaim.id)
					.eq('created_by', user.id)
					.select();

				if (error) throw error;
				if (!data || data.length === 0) {
					throw new Error(
						'The claim was not updated. You may not have permission to edit it (check the update policy on scf_submissions).'
					);
				}
				claims = claims.map((c) => (c.id === editingClaim.id ? data[0] : c));
				successMessage = `Claim for ${formatShortDate(fields.claim_date)} updated successfully.`;
			}

			saving = false;
			closeClaimModal();
			toast.success(successMessage);
		} catch (error) {
			formError = error?.message ?? String(error);
		} finally {
			saving = false;
		}
	}

	function openDeleteModal(claim) {
		deletingClaim = claim;
		deleteError = '';
		showDeleteModal = true;
	}

	function closeDeleteModal() {
		if (deleting) return;
		showDeleteModal = false;
		deletingClaim = null;
	}

	async function deleteClaim() {
		if (!deletingClaim) return;
		deleting = true;
		deleteError = '';

		try {
			const auth = await requireUser();
			if (!auth) return;

			const { data, error } = await supabase
				.from('scf_submissions')
				.delete()
				.eq('id', deletingClaim.id)
				.eq('created_by', auth.user.id)
				.select('id');

			if (error) throw error;
			if (!data || data.length === 0) {
				throw new Error(
					'The claim was not deleted. You may not have permission to delete it (check the delete policy on scf_submissions).'
				);
			}

			const removedId = deletingClaim.id;
			const removedDate = deletingClaim.claim_date;
			claims = claims.filter((c) => c.id !== removedId);
			deleting = false;
			closeDeleteModal();
			toast.success(`Claim for ${formatShortDate(removedDate)} deleted successfully.`);
		} catch (error) {
			deleteError = error?.message ?? String(error);
		} finally {
			deleting = false;
		}
	}

	async function openProjectModal() {
		projectSearch = '';
		showProjectModal = true;
		if (projects.length === 0 && !projectLoading) {
			await loadProjects();
		}
	}

	function closeProjectModal() {
		showProjectModal = false;
	}

	function selectProject(project) {
		form.project_no = project.project_id ?? '';
		closeProjectModal();
	}

	async function openAttachment(path) {
		if (!path) return;
		const tab = window.open('', '_blank');

		let url = '';
		const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 10);
		if (!error && data?.signedUrl) {
			url = data.signedUrl;
		} else {
			url = supabase.storage.from(BUCKET).getPublicUrl(path).data?.publicUrl ?? '';
		}

		if (tab && url) tab.location.href = url;
		else if (tab) tab.close();
	}
</script>

<h1 class="title">Staff Claim Form</h1>

<div class="project-box">
	<div class="note">
		<p class="note-title"><CircleAlert size={18} /><span>Note:</span></p>
		<ol>
			<li>Site allowance can be claimed once per working day.</li>
			<li>Travel Location and Remarks must not contain commas (,).</li>
			<li>Once an attachment has been submitted, it cannot be modified.</li>
		</ol>
	</div>

	<div class="month-header">
		<button class="nav" onclick={prevMonth} aria-label="Previous month"><ChevronsLeft /></button>
		<div class="month-label">{monthNames[viewMonth]} {viewYear}</div>
		<button class="nav" onclick={nextMonth} aria-label="Next month"><ChevronsRight /></button>
	</div>

	{#if pageError}
		<p class="error">{pageError}</p>
	{/if}

	<div class="day-list" class:is-loading={loading}>
		{#each days as d (d.key)}
			<section class="day" class:today={d.isToday}>
				<div class="day-header">
					<h2 class="day-label">
						<span class="day-icon"><CalendarDays size={22} /></span>
						{d.label}
					</h2>
					<button
						class="button-add"
						onclick={() => openCreateModal(d.key)}
						aria-label={`Create claim for ${d.label}`}
						title="Create claim"
					>
						<Plus size={22} />
					</button>
				</div>

				{#each claimsByDate[d.key] ?? [] as claim (claim.id)}
					<div class="claim-card">
						<div class="claim-card-header">
							<div class="claim-heading">
								<h3>{claim.project_no ?? '-'}</h3>
								{#if claim.description}
									<p class="claim-description">{claim.description}</p>
								{/if}
							</div>
							<div class="claim-actions">
								<button
									class="icon-button icon-edit"
									onclick={() => openEditModal(claim)}
									aria-label="Edit claim"
									title="Edit claim"
								>
									<Pencil size={18} />
								</button>
								<button
									class="icon-button icon-delete"
									onclick={() => openDeleteModal(claim)}
									aria-label="Delete claim"
									title="Delete claim"
								>
									<Trash2 size={18} />
								</button>
							</div>
						</div>

						<div class="claim-details">
							{#each AMOUNT_FIELDS.filter((f) => hasValue(claim[f.key])) as field (field.key)}
								<div class="claim-detail">
									<p class="detail-label">{field.label}</p>
									<p class="detail-value">RM {claim[field.key]}</p>
								</div>
							{/each}

							{#if hasValue(claim.claim_remarks)}
								<div class="claim-detail full">
									<p class="detail-label">Remarks</p>
									<p class="detail-value">{claim.claim_remarks}</p>
								</div>
							{/if}

							{#if claim.maps_screenshot_path}
								<div class="claim-detail full">
									<button
										class="link-button"
										onclick={() => openAttachment(claim.maps_screenshot_path)}
									>
										<Paperclip size={14} /> View attachment
									</button>
								</div>
							{/if}
						</div>
					</div>
				{/each}
			</section>
		{/each}
	</div>
</div>

<Modal
	open={showClaimModal}
	title={`${modalMode === 'create' ? 'Create Claim' : 'Edit Claim'} (${formatShortDate(form.claim_date)})`}
	busy={saving}
	onclose={closeClaimModal}
>
	<form id="claim-form" class="claim-form" onsubmit={saveClaim} novalidate>
		<div class="field full">
			<label for="scf-project"><span class="required">*</span>Project</label>
			<div class="project-picker">
				<input
					id="scf-project"
					type="text"
					value={form.project_no}
					placeholder="Select a project"
					readonly
					onclick={openProjectModal}
				/>
				<button
					type="button"
					class="button-search"
					onclick={openProjectModal}
					aria-label="Search project"
				>
					<Search size={18} />
				</button>
			</div>
			{#if selectedProjectName}
				<p class="hint">{selectedProjectName}</p>
			{/if}
		</div>

		<div class="field full">
			<label for="scf-description"><span class="required">*</span>Description</label>
			<input
				id="scf-description"
				type="text"
				placeholder="Home-Site-Home (12km)"
				bind:value={form.description}
				class:invalid={descriptionHasComma}
			/>
			{#if descriptionHasComma}
				<p class="field-error">Travel Location must not contain commas (,).</p>
			{/if}
		</div>

		<div class="field">
			<label for="scf-site-allowance">Site Allowance</label>
			<select
				id="scf-site-allowance"
				bind:value={form.site_allowance}
				disabled={siteAllowanceTaken && !hasValue(form.site_allowance)}
			>
				<option value=""></option>
				{#each SITE_ALLOWANCE_OPTIONS as opt (opt.value)}
					<option value={opt.value}>{opt.label}</option>
				{/each}
				{#if hasValue(form.site_allowance) && !SITE_ALLOWANCE_OPTIONS.some((o) => o.value === form.site_allowance)}
					<option value={form.site_allowance}>RM {form.site_allowance}</option>
				{/if}
			</select>
			{#if siteAllowanceTaken}
				<p class="field-error">Already claimed on this date.</p>
			{/if}
		</div>

		<div class="field">
			<label for="scf-accommodation">Accommodation</label>
			<input
				id="scf-accommodation"
				type="number"
				inputmode="decimal"
				min="0"
				step="0.01"
				bind:value={form.accommodation}
			/>
		</div>

		<div class="field">
			<label for="scf-toll">Toll Fare</label>
			<input
				id="scf-toll"
				type="number"
				inputmode="decimal"
				min="0"
				step="0.01"
				bind:value={form.toll_fare}
			/>
		</div>

		<div class="field">
			<label for="scf-mileage">Mileage / Petrol / Diesel</label>
			<input
				id="scf-mileage"
				type="number"
				inputmode="decimal"
				min="0"
				step="0.01"
				bind:value={form.claim_mileage}
			/>
		</div>

		<div class="field">
			<label for="scf-site-purchase">Site Purchase</label>
			<input
				id="scf-site-purchase"
				type="number"
				inputmode="decimal"
				min="0"
				step="0.01"
				bind:value={form.site_purchase}
			/>
		</div>

		<div class="field">
			<label for="scf-other">Other</label>
			<input
				id="scf-other"
				type="number"
				inputmode="decimal"
				min="0"
				step="0.01"
				bind:value={form.claim_other}
			/>
		</div>

		<div class="field full">
			<label for="scf-remarks">Remarks</label>
			<input
				id="scf-remarks"
				type="text"
				bind:value={form.claim_remarks}
				class:invalid={remarksHasComma}
			/>
			{#if remarksHasComma}
				<p class="field-error">Remarks must not contain commas (,).</p>
			{/if}
		</div>

		<div class="field full">
			<span class="field-label">Attachment</span>
			{#if attachmentLocked}
				<div class="upload-box locked">
					<button
						type="button"
						class="link-button"
						onclick={() => openAttachment(editingClaim.maps_screenshot_path)}
					>
						<Paperclip size={14} />
						{fileName(editingClaim.maps_screenshot_path)}
					</button>
				</div>
				<p class="hint">Submitted attachments cannot be modified.</p>
			{:else}
				<label class="upload-box" for="scf-attachment">
					{#if attachmentFile}
						<Paperclip size={14} />
						<span class="upload-name">{attachmentFile.name}</span>
					{:else}
						Click to upload a file
					{/if}
				</label>
				<input
					id="scf-attachment"
					class="visually-hidden"
					type="file"
					accept="image/png, image/jpeg, application/pdf"
					bind:this={fileInput}
					onchange={onAttachmentChange}
				/>
				{#if attachmentFile}
					<button type="button" class="link-button remove-file" onclick={clearAttachment}>
						Remove file
					</button>
				{/if}
			{/if}
		</div>

		{#if formError}
			<p class="error full">{formError}</p>
		{/if}
	</form>

	{#snippet footer()}
		<button type="button" class="button-inverted" onclick={closeClaimModal} disabled={saving}>
			Cancel
		</button>
		<button type="submit" form="claim-form" class="button-primary" disabled={saving}>
			{#if saving}
				Saving...
			{:else}
				{modalMode === 'create' ? 'Create Claim' : 'Save Changes'}
			{/if}
		</button>
	{/snippet}
</Modal>

<Modal open={showProjectModal} title="Select a Project" onclose={closeProjectModal}>
	<div class="project-search">
		<input
			type="text"
			placeholder="Project Name/Project ID"
			class="project-search-input"
			bind:value={projectSearch}
		/>
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

	{#snippet footer()}
		<button type="button" class="button-inverted" onclick={closeProjectModal}>Cancel</button>
	{/snippet}
</Modal>

<Modal
	open={showDeleteModal && !!deletingClaim}
	title="Delete Claim"
	size="sm"
	busy={deleting}
	onclose={closeDeleteModal}
>
	<p>Are you sure you want to delete this claim?</p>
	{#if deletingClaim}
		<div class="delete-summary">
			<p><b>Date:</b> {formatShortDate(deletingClaim.claim_date)}</p>
			<p><b>Project:</b> {deletingClaim.project_no ?? '-'}</p>
			{#if deletingClaim.description}
				<p><b>Travel Location:</b> {deletingClaim.description}</p>
			{/if}
		</div>
	{/if}
	<p class="hint">This action cannot be undone.</p>
	{#if deleteError}
		<p class="error">{deleteError}</p>
	{/if}

	{#snippet footer()}
		<button class="button-inverted" onclick={closeDeleteModal} disabled={deleting}>Cancel</button>
		<button class="button-danger" onclick={deleteClaim} disabled={deleting}>
			{deleting ? 'Deleting...' : 'Delete'}
		</button>
	{/snippet}
</Modal>

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

	button:hover {
		background-color: #064c6da4;
	}

	button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.button-primary {
		background-color: #091747;
		font-weight: bold;
		padding: 10px 20px;
	}

	.button-primary:hover {
		background-color: #091747b9;
	}

	.button-inverted {
		background-color: #ffffff;
		color: #064c6dd7;
		font-weight: bold;
		padding: 8px 18px;
		border: 2px solid #064c6dd7;
		border-radius: 4px;
	}

	.button-inverted:hover {
		background-color: #dedede;
	}

	.button-danger {
		background-color: #c62828;
		font-weight: bold;
		padding: 10px 20px;
	}

	.button-danger:hover {
		background-color: #c62828c7;
	}

	.error {
		color: #c62828;
		font-weight: bold;
		margin: 8px 0;
	}

	.hint {
		font-size: 12px;
		color: #5b6480;
		margin: 4px 0 0;
	}

	.title {
		font-size: 35px;
		font-weight: bold;
		margin-bottom: 20px;
		padding: 0 10px;
	}

	.project-box {
		margin: 10px;
		padding: 10px;
		font-size: 14px;
	}

	.note {
		background-color: #ffffff;
		border: 1px solid #dcdcdc;
		border-radius: 4px;
		padding: 10px 14px;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}

	.note-title {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 0 0 4px;
		font-weight: bold;
		color: #064c6dd7;
	}

	.note-title span {
		color: #064c6dd7;
		font-weight: bold;
	}

	.note ol {
		list-style: decimal;
		margin: 0;
		padding-left: 46px;
	}

	.note li {
		font-size: 13px;
		line-height: 1.6;
	}

	.month-header {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding: 16px 0 10px;
		border-bottom: 2px solid #dcdcdc;
	}

	.month-label {
		font-size: 16px;
		font-weight: bold;
		min-width: 140px;
		text-align: center;
	}

	.nav {
		background: none;
		color: #064c6dd7;
		border: none;
		padding: 6px 12px;
		display: flex;
		align-items: center;
	}

	.nav:hover {
		background: rgba(0, 0, 0, 0.05);
	}

	.day-list.is-loading {
		opacity: 0.6;
		transition: opacity 0.15s;
	}

	.day {
		padding: 14px 0;
		border-bottom: 1px solid #e3e8f0;
	}

	.day-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.day-label {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 0;
		font-size: 17px;
		font-weight: bold;
		padding-left: 6px;
	}

	.day-icon {
		display: inline-flex;
		color: #091747;
	}

	.day.today .day-label,
	.day.today .day-icon {
		color: #064c6dd7;
	}

	.button-add {
		width: 40px;
		height: 40px;
		padding: 0;
		border-radius: 50%;
		background-color: #064c6d1f;
		color: #064c6dd7;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.button-add:hover {
		background-color: #064c6d3d;
	}

	.claim-card {
		background-color: #ffffff;
		border: 1px solid #dcdcdc;
		border-radius: 4px;
		padding: 12px 16px;
		margin: 12px 0 0;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}

	.claim-card-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 12px;
		padding-bottom: 10px;
		border-bottom: 1px solid #dcdcdc;
	}

	.claim-heading h3 {
		margin: 0;
		font-size: 16px;
		font-weight: bold;
	}

	.claim-description {
		margin: 4px 0 0;
		color: #5b6480;
		word-break: break-word;
	}

	.claim-actions {
		display: flex;
		gap: 4px;
		flex-shrink: 0;
	}

	.icon-button {
		background: transparent;
		padding: 6px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.icon-button:hover {
		background: rgba(0, 0, 0, 0.06);
	}

	.icon-edit {
		color: #064c6dd7;
	}

	.icon-delete {
		color: #c62828;
	}

	.claim-details {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 10px 16px;
		padding-top: 10px;
	}

	.claim-detail.full {
		grid-column: 1 / -1;
	}

	.detail-label {
		margin: 0;
		font-size: 12px;
		font-weight: bold;
		text-transform: uppercase;
		color: #5b6480;
	}

	.detail-value {
		margin: 2px 0 0;
		word-break: break-word;
	}

	.link-button {
		background: none;
		color: #064c6dd7;
		padding: 0;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		text-decoration: underline;
		font-size: 13px;
	}

	.link-button:hover {
		background: none;
		color: #091747;
	}

	.claim-form {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 12px 14px;
	}

	.claim-form .full {
		grid-column: 1 / -1;
	}

	.field {
		display: grid;
		gap: 6px;
		align-content: start;
	}

	.field label,
	.field-label {
		font-size: 13px;
		font-weight: bold;
	}

	.required {
		color: #c62828;
		margin-right: 2px;
	}

	.field input,
	.field select {
		width: 100%;
		height: 38px;
		border: 1px solid #dcdcdc;
		border-radius: 4px;
		padding: 8px 10px;
		font-size: 14px;
		background-color: #ffffff;
	}

	.field select:disabled {
		background-color: #f2f4f9;
		cursor: not-allowed;
	}

	.field input.invalid {
		border-color: #c62828;
	}

	.field-error {
		font-size: 12px;
		color: #c62828;
		margin: 0;
	}

	.project-picker {
		display: flex;
		gap: 8px;
	}

	.project-picker input {
		flex: 1;
		cursor: pointer;
	}

	.button-search {
		width: 46px;
		height: 38px;
		padding: 0;
		background-color: #091747;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.button-search:hover {
		background-color: #091747b9;
	}

	.upload-box {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		min-height: 38px;
		padding: 8px 10px;
		border: 1px dashed #091747b9;
		border-radius: 4px;
		cursor: pointer;
		font-weight: normal !important;
		text-align: center;
	}

	.upload-box:hover {
		background-color: #f2f4f9;
	}

	.upload-box.locked {
		border-style: solid;
		border-color: #dcdcdc;
		background-color: #f2f4f9;
		cursor: default;
	}

	.upload-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 100%;
	}

	.remove-file {
		justify-self: start;
		color: #c62828;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		border: 0;
	}

	.delete-summary {
		margin: 12px 0;
		padding: 10px 12px;
		background-color: #f2f4f9;
		border-radius: 4px;
	}

	.delete-summary p {
		margin: 2px 0;
		word-break: break-word;
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

	.project-list {
		border: 1px solid #cfd6e4;
		border-radius: 8px;
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
		border-radius: 0;
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

	@media (max-width: 1024px) {
		.title {
			font-size: 24px;
			margin-bottom: 15px;
		}

		.project-box {
			margin: 8px;
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

		.note ol {
			padding-left: 30px;
		}

		.day-label {
			font-size: 15px;
			padding-left: 0;
		}

		.claim-details {
			grid-template-columns: 1fr;
		}

		.claim-form {
			grid-template-columns: 1fr;
		}
	}
</style>