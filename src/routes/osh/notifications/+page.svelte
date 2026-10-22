<script>
	/** @type {Array<{ items: Array<any>}>} */
	import Plus from '@lucide/svelte/icons/plus';
	import Spinner from '$lib/components/Spinner.svelte';
	import Search from '@lucide/svelte/icons/search';
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { requireUser } from '$lib/auth-guard';
	import { toast } from '$lib/stores/toast';
	import Modal from '$lib/components/Modal.svelte';

	let notifications = [];
	let errorMsg = '';
	let loading = true;
	let isSaving = false;
	let fromDate = '';
	let toDate = '';
	let isAdmin = false;
	let showCreateModal = false;
	let selectedPriority = 'All';
	let currentUserName = '';
	let searchTitle = '';

	let createForm = {
		title: '',
		summary: '',
		full_content: '',
		priority: '',
		photo_path: '',
		file_path: ''
	};

	let noti_photo_file = null;
	let noti_file_file = null;
	let createError = '';

	function onFile(e, setter) {
		setter(e.currentTarget.files?.[0] ?? null);
	}

	function withTimeout(promise, ms = 20000) {
		return Promise.race([
			promise,
			new Promise((_, reject) => setTimeout(() => reject(new Error('Upload timed out')), ms))
		]);
	}

	async function uploadToBucket(file, folder) {
		if (!file) return null;

		const ext = file.name.split('.').pop() || 'bin';
		const fileName = `${crypto.randomUUID()}.${ext}`;
		const path = `${folder}/${fileName}`;

		const { data, error } = await supabase.storage
			.from('noti_uploads')
			.upload(path, file, { upsert: false });

		if (error) {
			console.error('[upload] error', error);
			throw error;
		}

		return data.path;
	}

	const normalize = (v) => String(v ?? '').toLowerCase();

	$: filteredNotifications = (notifications ?? []).filter((n) => {
		const matchesPriority =
			selectedPriority === 'All' || normalize(n.priority) === normalize(selectedPriority);

		const matchesSearch =
			!searchTitle.trim() || normalize(n.title).includes(normalize(searchTitle));

		const matchesDate = withinRange(n.created_at);

		return matchesPriority && matchesSearch && matchesDate;
	});

	function toISOStart(dateStr) {
		return dateStr ? new Date(dateStr + 'T00:00:00').toISOString() : null;
	}
	function toISOEnd(dateStr) {
		return dateStr ? new Date(dateStr + 'T23:59:59.999').toISOString() : null;
	}

	function fmtDate(iso) {
		const d = new Date(iso);
		return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
	}

	function withinRange(iso) {
		const d = new Date(iso);
		const fromOk = !fromDate || d >= new Date(fromDate + 'T00:00:00');
		const toOk = !toDate || d <= new Date(toDate + 'T23:59:59.999');
		return fromOk && toOk;
	}

	onMount(async () => {
		const auth = await requireUser();
		if (!auth) return;

		const { supabase, user } = auth;

		const { data: profileData, error: profileError } = await supabase
			.from('profiles')
			.select('first_name, last_name, department')
			.eq('id', user.id)
			.single();

		if (profileError) {
			errorMsg = profileError.message;
			loading = false;
			return;
		}

		const firstName = profileData?.first_name ?? '';
		const lastName = profileData?.last_name ?? '';
		currentUserName = `${firstName} ${lastName}`.trim();

		const departments = profileData?.department ?? [];
		isAdmin = Array.isArray(departments) && departments.some((d) => normalize(d) === 'admin');

		const { data, error } = await supabase
			.from('notifications')
			.select(
				'id, created_at, created_by, title, summary, full_content, priority, photo_path, file_path'
			)
			.order('created_at', { ascending: false });

		loading = false;

		if (error) {
			errorMsg = error.message;
			notifications = [];
			return;
		}

		notifications = data ?? [];
	});

	const openCreateModal = () => {
		createForm = {
			title: '',
			summary: '',
			full_content: '',
			priority: '',
			photo_path: '',
			file_path: ''
		};
		noti_photo_file = null;
		noti_file_file = null;
		createError = '';
		showCreateModal = true;
	};

	const closeCreateModal = () => {
		if (isSaving) return;
		showCreateModal = false;
	};

	const createNotification = async () => {
		createError = '';

		const title = createForm.title.trim();
		if (!title) {
			createError = 'Please enter a title.';
			return;
		}
		if (!createForm.priority) {
			createError = 'Please choose a priority.';
			return;
		}

		isSaving = true;

		try {
			const [photo_path, file_path] = await Promise.all([
				withTimeout(uploadToBucket(noti_photo_file, 'noti_photo')),
				withTimeout(uploadToBucket(noti_file_file, 'noti_file'))
			]);

			const payload = {
				title,
				summary: createForm.summary.trim() || null,
				full_content: createForm.full_content.trim() || null,
				priority: createForm.priority.trim() || null,
				photo_path: photo_path ?? null,
				file_path: file_path ?? null,
				created_by: currentUserName || null
			};

			const { data, error } = await supabase
				.from('notifications')
				.insert(payload)
				.select()
				.single();

			if (error) throw error;

			notifications = data ? [data, ...notifications] : notifications;
			isSaving = false;
			closeCreateModal();
			toast.success(`Notification "${title}" created successfully.`);
		} catch (error) {
			createError = error?.message ?? String(error);
		} finally {
			isSaving = false;
		}
	};

	function formatDate(iso) {
		if (!iso) return '';

		const date = new Date(iso);

		const gmt8 = new Date(date.getTime() + 8 * 60 * 60 * 1000);

		const day = String(gmt8.getUTCDate()).padStart(2, '0');
		const month = gmt8.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
		const year = gmt8.getUTCFullYear();

		const hours = String(gmt8.getUTCHours()).padStart(2, '0');
		const minutes = String(gmt8.getUTCMinutes()).padStart(2, '0');

		return `${day} ${month} ${year} ${hours}:${minutes}`;
	}
</script>

<h1 class="title">Notifications and Announcements</h1>

<div class="notifications-filter">
	<div>
		<p>Priority</p>
		<select bind:value={selectedPriority} class="priority-select">
			<option value="All">All Priorities</option>
			<option value="Normal">Normal</option>
			<option value="Important">Important</option>
			<option value="Urgent">Urgent</option>
		</select>
	</div>
	<div>
		<p>Title</p>
		<input
			type="text"
			placeholder="Search by title"
			bind:value={searchTitle}
			class="filter-input"
		/>
	</div>
	<div>
		<p>From Date</p>
		<input
			type="date"
			name="created-date"
			id="date-from"
			class="date-from forms-date"
			bind:value={fromDate}
			on:focus={(e) => e.target.showPicker?.()}
		/>
	</div>
	<div>
		<p>To Date</p>
		<input
			type="date"
			name="created-date"
			id="date-to"
			class="date-to forms-date"
			bind:value={toDate}
			on:focus={(e) => e.target.showPicker?.()}
		/>
	</div>
</div>

<div class="notifications-create">
	{#if isAdmin}
		<button class="button-create" on:click={openCreateModal}
			><Plus size={20} /><span>New Notification</span></button
		>
	{/if}
</div>

{#if errorMsg}
	<p class="error page-error">{errorMsg}</p>
{/if}

<div class="project-box">
	{#each filteredNotifications as n (n.id)}
		<div class="notification-card">
			<div class="notification-info">
				<div class="priority-date">
					<span
						class="priority-badge"
						class:normal={n.priority === 'Normal'}
						class:important={n.priority === 'Important'}
						class:urgent={n.priority === 'Urgent'}
					>
						{n.priority}
					</span>
					<p>{formatDate(n.created_at) ?? ''}</p>
				</div>
				<h3>{n.title ?? '-'}</h3>
				<p class="summary">{n.summary ?? ''}</p>
				<p>{n.full_content ?? ''}</p>
				<p>Photo: {n.photo_path ?? '-'}</p>
				<p>File: {n.file_path ?? '-'}</p>
			</div>
		</div>
	{:else}
		{#if loading}
			<Spinner inline size={140} label="Loading notifications" />
		{:else}
			<p class="empty">
				{notifications.length === 0 ? 'No notifications yet.' : 'No notifications match the filters.'}
			</p>
		{/if}
	{/each}
</div>

<Modal open={showCreateModal} title="New Notification" busy={isSaving} onclose={closeCreateModal}>
	<div class="create-form">
		<label>Title: <input type="text" bind:value={createForm.title} /></label>
		<label>Summary: <input type="text" bind:value={createForm.summary} /></label>
		<label
			>Full Content: <textarea
				name="content"
				id="content"
				rows="6"
				bind:value={createForm.full_content}
			></textarea></label
		>
		<label
			>Priority:
			<select bind:value={createForm.priority} class="priority-select">
				<option value="" disabled selected>Choose Priority</option>
				<option value="Normal">Normal</option>
				<option value="Important">Important</option>
				<option value="Urgent">Urgent</option>
			</select>
		</label>
		<label
			>Photo:
			<div class="upload">
				<p class="upload-text">
					<input
						type="file"
						name="noti_photo"
						id="noti_photo"
						accept="image/png, image/jpeg"
						multiple
						on:change={(e) => (noti_photo_file = e.target.files[0])}
					/>
				</p>
			</div>
		</label>
		<label
			>File:
			<div class="upload">
				<p class="upload-text">
					<input
						type="file"
						name="noti_file"
						id="noti_file"
						accept="image/png, image/jpeg"
						multiple
						on:change={(e) => (noti_file_file = e.target.files[0])}
					/>
				</p>
			</div>
		</label>
	</div>
	{#if createError}
		<p class="error">{createError}</p>
	{/if}

	{#snippet footer()}
		<button class="button-inverted" on:click={closeCreateModal} disabled={isSaving}>Cancel</button>
		<button class="button-confirm" on:click={createNotification} disabled={isSaving}>
			{isSaving ? 'Saving...' : 'Confirm'}
		</button>
	{/snippet}
</Modal>

<style>
	.button-create {
		width: fit-content;
		height: 40px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		margin-left: auto;
	}

	.button-create span {
		color: #ffffff;
	}

	h3 {
		font-size: 18px;
		font-weight: 600;
		margin-bottom: 5px;
	}

	.create-form {
		display: grid;
		gap: 12px;
	}

	.create-form label {
		display: grid;
		gap: 6px;
		font-size: 13px;
		font-weight: 600;
	}

	.create-form input[type='text'],
	.create-form textarea,
	.create-form select {
		width: 100%;
		border: 1px solid var(--line);
		border-radius: var(--r-md);
		padding: 8px 10px;
		font-size: 14px;
		font-weight: normal;
	}

	.button-confirm {
		background-color: var(--ink);
		font-weight: 600;
		padding: 8px 20px;
	}

	.button-confirm:hover:not(:disabled) {
		background-color: var(--brand);
	}

	.error {
		color: var(--danger);
		font-weight: 600;
		margin: 12px 0 0;
	}

	.page-error {
		margin: 0 10px 10px;
	}

	.empty {
		padding: 16px;
		text-align: center;
		color: var(--muted);
	}

	.notification-card {
		align-items: center;
		background-color: var(--surface);
		border: 1px solid var(--line-soft);
		border-left: 4px solid var(--brand);
		border-radius: var(--r-lg);
		padding: 16px 20px;
		box-shadow: var(--shadow-sm);
	}

	.notification-card + .notification-card {
		margin-top: 12px;
	}

	.notifications-create {
		display: flex;
		margin: 10px;
	}

	.priority-select,
	.filter-input,
	.date-from,
	.date-to {
		height: 40px;
		padding: 0 10px;
		font-size: 14px;
	}

	.priority-date {
		display: flex;
		padding: 10px 0;
		justify-content: space-between;
	}

	.priority-badge {
		padding: 3px 10px;
		border-radius: 999px;
		font-size: 12px;
		font-weight: 600;
		color: #fff;
		display: inline-block;
	}

	.priority-badge.normal {
		background-color: var(--brand);
	}

	.priority-badge.important {
		background-color: #fb8c00;
	}

	.priority-badge.urgent {
		background-color: #e53935;
	}

	.priority-select {
		width: 150px;
		cursor: pointer;
	}

	.summary {
		font-size: 16px;
		font-weight: 600;
		text-decoration: underline;
	}

	@media (max-width: 1024px) {
		.notifications-filter {
			flex-wrap: wrap;
			gap: 12px;
		}

		.notifications-filter > div {
			min-width: 220px;
			flex: 1 1 220px;
		}

		.notification-card {
			padding: 12px;
		}

		.notification-info p {
			overflow-wrap: anywhere;
			word-break: break-word;
		}
	}

	@media (max-width: 768px) {
		.notifications-filter {
			gap: 8px;
		}

		.notifications-filter p {
			margin: 0 0 4px 0;
			line-height: 1.2;
		}

		.notifications-filter > div {
			margin: 0;
			padding: 0;
		}

		.filter-input,
		.date-from,
		.date-to,
		.priority-select {
			width: 100%;
		}

		.notifications-create {
			margin: 8px;
		}

		.button-create {
			width: 100%;
			margin-right: 0;
		}

		.notification-card {
			padding: 12px;
		}

		.priority-date {
			gap: 8px;
			padding: 8px 0;
		}

		h3 {
			font-size: 16px;
			word-break: break-word;
			overflow-wrap: anywhere;
		}

		.notification-info p {
			overflow-wrap: anywhere;
			word-break: break-word;
		}

		.summary {
			font-size: 14px;
		}
	}
</style>