<script>
	import ChevronsLeft from '@lucide/svelte/icons/chevrons-left';
	import Spinner from '$lib/components/Spinner.svelte';
	import ChevronsRight from '@lucide/svelte/icons/chevrons-right';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
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
	import { sendToMake } from '$lib/make';
	import Modal from '$lib/components/Modal.svelte';

	const BUCKET = 'scf_uploads';
	const ATTACHMENT_FOLDER = 'maps_screenshot';

	const SITE_ALLOWANCE_OPTIONS = [
		{ id: 'r1', value: '30', label: 'Peninsular (Hometown) to Klang Valley (KL & Selangor) (Site) ~ RM30 / Day' },
		{ id: 'r2', value: '50', label: 'Peninsular (Hometown) to Other States in Peninsular (Site) ~ RM50 / Day' },
		{ id: 'r3', value: '65', label: 'Peninsular (Hometown) to Sabah/Sarawak (Site) ~ RM65 / Day' },
		{ id: 'r4', value: '50', label: 'Sabah (Hometown) to Sabah (Site) ~ RM50 / Day' },
		{ id: 'r5', value: '50', label: 'Sarawak (Hometown) to Sarawak (Site) ~ RM50 / Day' },
		{ id: 'r6', value: '65', label: 'Sabah (Hometown) to Sarawak (Site) ~ RM65 / Day' },
		{ id: 'r7', value: '65', label: 'Sarawak (Hometown) to Sabah (Site) ~ RM65 / Day' },
		{ id: 'r8', value: '65', label: 'Sabah/Sarawak (Hometown) to Peninsular (Site) ~ RM65 / Day' }
	];
	const LEGACY_ROUTE = 'legacy';

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
	let expanded = $state({});

	let showClaimModal = $state(false);
	let modalMode = $state('create');
	let editingClaim = $state(null);
	let form = $state(emptyForm());
	let attachmentFile = $state(null);
	let fileInput = $state(null);
	let formError = $state('');
	let siteRoute = $state('');
	let fieldErr = $state({});
	let submitted = $state(false);
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
				label: `${date.toLocaleDateString('en-GB', { weekday: 'long' })}, ${pad(day)}/${pad(viewMonth + 1)}/${viewYear}`,
				shortLabel: `${date.toLocaleDateString('en-GB', { weekday: 'short' })}, ${pad(day)}/${pad(viewMonth + 1)}/${viewYear}`,
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

	function money2(v) {
		const text = clean(v);
		if (text === null) return null;
		const n = Number(text);
		return Number.isFinite(n) ? n.toFixed(2) : text;
	}

	function claimsOn(key) {
		return claimsByDate[key] ?? [];
	}

	function toggleDay(key) {
		expanded[key] = !expanded[key];
	}

	function pickRoute(id) {
		siteRoute = id;
		const option = SITE_ALLOWANCE_OPTIONS.find((o) => o.id === id);
		if (option) form.site_allowance = option.value;
		else if (id !== LEGACY_ROUTE) form.site_allowance = '';
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

			if (token !== loadToken) return;
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
		siteRoute = '';
		attachmentFile = null;
		formError = '';
		fieldErr = {};
		submitted = false;
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
		siteRoute = !hasValue(form.site_allowance)
			? ''
			: (SITE_ALLOWANCE_OPTIONS.find((o) => o.value === String(form.site_allowance))?.id ?? LEGACY_ROUTE);
		attachmentFile = null;
		formError = '';
		fieldErr = {};
		submitted = false;
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
		const e = {};
		if (!form.project_no) e.project_no = 'Select a project using Search Project.';
		if (!form.description.trim()) e.description = 'Description is required.';
		if (!hasValue(form.site_allowance)) e.site_allowance = 'Site Allowance is required.';
		if (!hasValue(form.accommodation)) e.accommodation = 'Accommodation is required.';
		if (!hasValue(form.toll_fare)) e.toll_fare = 'Toll Fare is required.';
		if (!hasValue(form.claim_mileage)) e.claim_mileage = 'Mileage / Petrol / Diesel is required.';
		if (!hasValue(form.site_purchase)) e.site_purchase = 'Site Purchase is required.';
		fieldErr = e;
		return (
			Object.keys(e).length === 0 &&
			!descriptionHasComma &&
			!remarksHasComma &&
			!(hasValue(form.site_allowance) && siteAllowanceTaken)
		);
	}

	$effect(() => {
		if (submitted && showClaimModal) validateForm();
	});

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
		formError = '';
		submitted = true;
		if (!validateForm()) return;

		saving = true;
		let successMessage = '';
		let savedId = null;

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
				accommodation: money2(form.accommodation),
				toll_fare: money2(form.toll_fare),
				claim_mileage: money2(form.claim_mileage),
				site_purchase: money2(form.site_purchase),
				claim_other: money2(form.claim_other),
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
				savedId = data.id;
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
				savedId = data[0].id;
				successMessage = `Claim for ${formatShortDate(fields.claim_date)} updated successfully.`;
			}

			if (fields.maps_screenshot_path && savedId) {
				const sent = await sendToMake('scf', savedId);
				if (!sent.ok) {
					toast.error(`The claim was saved, but the attachment was not sent to Make: ${sent.error}`);
				}
			}

			expanded[fields.claim_date] = true;
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
						<span class="day-icon"><CalendarDays size={20} /></span>
						<span class="label-long">{d.label}</span>
						<span class="label-short">{d.shortLabel}</span>
						<span class="claim-count">
							{claimsOn(d.key).length}
						</span>
					</h2>
					<div class="day-actions">
						<button
							class="button-toggle"
							onclick={() => toggleDay(d.key)}
							aria-expanded={!!expanded[d.key]}
							aria-label={`${expanded[d.key] ? 'Collapse' : 'Expand'} ${d.label}`}
							title={expanded[d.key] ? 'Collapse' : 'Expand'}
						>
							{#if expanded[d.key]}<ChevronDown size={20} />{:else}<ChevronLeft size={20} />{/if}
						</button>
						<button
							class="button-add"
							onclick={() => openCreateModal(d.key)}
							aria-label={`Add claim for ${d.label}`}
							title="Add claim"
						>
							<Plus size={20} />
						</button>
					</div>
				</div>

				{#if expanded[d.key] && claimsOn(d.key).length === 0}
					<p class="no-claims">No claims yet.</p>
				{/if}

				{#each expanded[d.key] ? claimsOn(d.key) : [] as claim (claim.id)}
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
									class="icon-button bg-danger"
									onclick={() => openDeleteModal(claim)}
									aria-label="Delete claim"
									title="Delete claim"
								>
									<Trash2 size={18} />
								</button>
								<button
									class="icon-button bg-teal"
									onclick={() => openEditModal(claim)}
									aria-label="Edit claim"
									title="Edit claim"
								>
									<Pencil size={18} />
								</button>
							</div>
						</div>

						<div class="claim-details">
							{#each AMOUNT_FIELDS.filter((f) => hasValue(claim[f.key])) as field (field.key)}
								<div class="claim-detail">
									<p class="detail-label">{field.label}</p>
									<p class="detail-value">RM {field.key === 'site_allowance' ? claim[field.key] : money2(claim[field.key])}</p>
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
	title={`${modalMode === 'create' ? 'Add Claim' : 'Edit Claim'} (${formatShortDate(form.claim_date)})`}
	busy={saving}
	onclose={closeClaimModal}
>
	<form id="claim-form" class="claim-form" novalidate onsubmit={saveClaim}>
		<div class="field full">
			<label for="scf-project">Project <span class="required">*</span></label>
			<div class="project-picker">
				<input
					id="scf-project"
					type="text"
					value={form.project_no}
					placeholder="Select a project"
					class:invalid={fieldErr.project_no}
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
			{#if fieldErr.project_no}<p class="field-err">{fieldErr.project_no}</p>{/if}
			{#if selectedProjectName}
				<p class="hint">{selectedProjectName}</p>
			{/if}
		</div>

		<div class="field full">
			<label for="scf-description">Description <span class="required">*</span></label>
			<input
				id="scf-description"
				type="text"
				placeholder="Home-Site-Home (12km)"
				bind:value={form.description}
				class:invalid={descriptionHasComma || fieldErr.description}
			/>
			{#if descriptionHasComma}
				<p class="field-err">Travel Location must not contain commas (,).</p>
			{:else if fieldErr.description}
				<p class="field-err">{fieldErr.description}</p>
			{/if}
		</div>

		<div class="field">
			<label for="scf-site-allowance">Site Allowance (RM) <span class="required">*</span></label>
			<select
				id="scf-site-allowance"
				class:invalid={fieldErr.site_allowance}
				value={siteRoute}
				onchange={(e) => pickRoute(e.currentTarget.value)}
				disabled={siteAllowanceTaken && !hasValue(form.site_allowance)}
			>
				<option value=""></option>
				{#each SITE_ALLOWANCE_OPTIONS as opt (opt.id)}
					<option value={opt.id}>{opt.label}</option>
				{/each}
				{#if siteRoute === LEGACY_ROUTE}
					<option value={LEGACY_ROUTE}>RM {form.site_allowance}</option>
				{/if}
			</select>
			{#if siteAllowanceTaken}
				<p class="field-err">Already claimed on this date.</p>
			{:else if fieldErr.site_allowance}
				<p class="field-err">{fieldErr.site_allowance}</p>
			{/if}
		</div>

		<div class="field">
			<label for="scf-accommodation">Accommodation (RM) <span class="required">*</span></label>
			<input
				id="scf-accommodation"
				type="number"
				inputmode="decimal"
				min="0"
				step="0.01"
				bind:value={form.accommodation}
				class:invalid={fieldErr.accommodation}
			/>
			{#if fieldErr.accommodation}<p class="field-err">{fieldErr.accommodation}</p>{/if}
		</div>

		<div class="field">
			<label for="scf-toll">Toll Fare (RM) <span class="required">*</span></label>
			<input
				id="scf-toll"
				type="number"
				inputmode="decimal"
				min="0"
				step="0.01"
				bind:value={form.toll_fare}
				class:invalid={fieldErr.toll_fare}
			/>
			{#if fieldErr.toll_fare}<p class="field-err">{fieldErr.toll_fare}</p>{/if}
		</div>

		<div class="field">
			<label for="scf-mileage">Mileage / Petrol / Diesel (RM) <span class="required">*</span></label>
			<input
				id="scf-mileage"
				type="number"
				inputmode="decimal"
				min="0"
				step="0.01"
				bind:value={form.claim_mileage}
				class:invalid={fieldErr.claim_mileage}
			/>
			{#if fieldErr.claim_mileage}<p class="field-err">{fieldErr.claim_mileage}</p>{/if}
		</div>

		<div class="field">
			<label for="scf-site-purchase">Site Purchase (RM) <span class="required">*</span></label>
			<input
				id="scf-site-purchase"
				type="number"
				inputmode="decimal"
				min="0"
				step="0.01"
				bind:value={form.site_purchase}
				class:invalid={fieldErr.site_purchase}
			/>
			{#if fieldErr.site_purchase}<p class="field-err">{fieldErr.site_purchase}</p>{/if}
		</div>

		<div class="field">
			<label for="scf-other">Other (RM)</label>
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
				<p class="field-err">Remarks must not contain commas (,).</p>
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
		<button type="submit" form="claim-form" class="button-confirm" disabled={saving}>
			{#if saving}
				Saving...
			{:else}
				{modalMode === 'create' ? 'Add Claim' : 'Save Changes'}
			{/if}
		</button>
	{/snippet}
</Modal>

<Modal open={showProjectModal} title="Select a Project" onclose={closeProjectModal}>
	<div class="project-search">
		<input
			type="text"
			placeholder="Project Name/Project No."
			class="project-search-input"
			bind:value={projectSearch}
		/>
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
	.button-danger:hover {
		background-color: #c62828c7;
	}

	.button-confirm {
		background-color: var(--fill);
		font-weight: 600;
		padding: 8px 20px;
	}

	.button-confirm:hover:not(:disabled) {
		background-color: var(--brand);
	}

	.error {
		color: var(--danger);
		font-weight: 600;
		margin: 8px 0;
	}

	.hint {
		font-size: 12px;
		color: var(--muted);
		margin: 4px 0 0;
	}

	.note {
		background-color: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--r-md);
		padding: 10px 14px;
		box-shadow: var(--shadow-sm);
	}

	.note-title {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 0 0 4px;
		font-weight: 600;
		color: var(--link);
	}

	.note-title span {
		color: var(--link);
		font-weight: 600;
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
		border-bottom: 2px solid var(--line);
	}

	.month-label {
		font-size: 16px;
		font-weight: 600;
		min-width: 140px;
		text-align: center;
	}

	.nav {
		background: none;
		color: var(--link);
		border: none;
		padding: 6px 12px;
		display: flex;
		align-items: center;
	}

	.nav:hover {
		background: var(--hover-tint);
	}

	.day-list.is-loading {
		opacity: 0.6;
		transition: opacity 0.15s;
	}

	.day {
		padding: 14px 0;
		border-bottom: 1px solid var(--line-soft);
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
		font-weight: 600;
		padding-left: 6px;
	}

	.day-icon {
		display: inline-flex;
		color: var(--ink);
	}

	.label-short {
		display: none;
	}

	.day.today .day-label,
	.day.today .day-icon {
		color: var(--link);
	}

	.day-actions {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}

	.claim-count {
		flex-shrink: 0;
		padding: 2px 8px;
		border-radius: 999px;
		background-color: var(--brand-tint);
		color: var(--link);
		font-size: 12px;
		font-weight: 600;
		white-space: nowrap;
	}

	.no-claims {
		margin: 10px 0 0;
		padding-left: 6px;
		font-size: 13px;
		color: var(--muted);
	}

	.button-add,
	.button-toggle {
		width: 40px;
		height: 40px;
		padding: 0;
		border-radius: 50%;
		background-color: var(--brand-tint);
		color: var(--link);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.button-add:hover,
	.button-toggle:hover {
		background-color: var(--brand-tint-hover);
	}

	.claim-card {
		background-color: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--r-lg);
		padding: 12px 16px;
		margin: 12px 0 0;
		box-shadow: var(--shadow-sm);
	}

	.claim-card-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 12px;
		padding-bottom: 10px;
		border-bottom: 1px solid var(--line);
	}

	.claim-heading h3 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
	}

	.claim-description {
		margin: 4px 0 0;
		color: var(--muted);
		word-break: break-word;
	}

	.claim-actions {
		display: flex;
		gap: 6px;
		flex-shrink: 0;
	}

	.icon-button {
		width: 40px;
		height: 32px;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #ffffff;
		flex-shrink: 0;
	}

	.icon-button:hover {
		opacity: 0.8;
	}

	.bg-teal {
		background-color: var(--brand);
	}

	.bg-danger {
		background-color: var(--danger-solid);
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
		font-weight: 600;
		text-transform: uppercase;
		color: var(--muted);
	}

	.detail-value {
		margin: 2px 0 0;
		word-break: break-word;
	}

	.link-button {
		background: none;
		color: var(--link);
		padding: 0;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		text-decoration: underline;
		font-size: 13px;
	}

	.link-button:hover {
		background: none;
		color: var(--ink);
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
		font-weight: 600;
	}

	.field input,
	.field select {
		width: 100%;
		height: 38px;
		border: 1px solid var(--line);
		border-radius: var(--r-md);
		padding: 8px 10px;
		font-size: 14px;
		background-color: var(--surface);
	}

	.field select:disabled {
		background-color: var(--mist);
		cursor: not-allowed;
	}

	.field input.invalid,
	.field select.invalid {
		border-color: var(--danger);
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
		background-color: var(--fill);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.button-search:hover {
		background-color: var(--brand);
	}

	.upload-box {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		min-height: 38px;
		padding: 8px 10px;
		border: 1px dashed var(--line-strong);
		border-radius: var(--r-lg);
		cursor: pointer;
		font-weight: normal !important;
		text-align: center;
	}

	.upload-box:hover {
		background-color: var(--mist);
	}

	.upload-box.locked {
		border-style: solid;
		border-color: var(--line);
		background-color: var(--mist);
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
		color: var(--danger);
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

	.delete-summary p {
		margin: 2px 0;
		word-break: break-word;
	}

	@media (min-width: 1025px) {
		.day-list {
			display: grid;
			grid-template-columns: repeat(3, minmax(0, 1fr));
			align-items: start;
			gap: 12px;
			padding-top: 14px;
		}

		.day {
			padding: 10px 12px;
			border: 1px solid var(--line);
			border-radius: var(--r-lg);
			background-color: var(--mist);
		}

		.day.today {
			border-color: var(--link);
		}

		.day-label {
			gap: 6px;
			font-size: 14px;
			padding-left: 0;
		}

		.button-add,
		.button-toggle {
			width: 32px;
			height: 32px;
		}

		.claim-count {
			font-size: 11px;
			padding: 1px 7px;
		}

		.no-claims {
			margin-top: 8px;
			padding-left: 0;
		}

		.claim-card {
			padding: 8px 10px;
			margin-top: 8px;
		}

		.claim-card-header {
			padding-bottom: 6px;
		}

		.claim-heading h3 {
			font-size: 14px;
		}

		.claim-description {
			margin-top: 2px;
			font-size: 13px;
		}

		.claim-details {
			gap: 6px 10px;
			padding-top: 6px;
		}

		.detail-label {
			font-size: 11px;
		}

		.detail-value {
			margin-top: 0;
			font-size: 13px;
		}
	}

	@media (max-width: 600px) {
		.label-long {
			display: none;
		}

		.label-short {
			display: inline;
			white-space: nowrap;
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