<script>
	/** @type {Array<{ items: Array<any>}>} */
	import Plus from '@lucide/svelte/icons/plus';
	import Search from '@lucide/svelte/icons/search';
	import Close from '@lucide/svelte/icons/x';
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { requireUser } from '$lib/auth-guard';

	let notifications = [];
	let errorMsg = '';
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

	let noti_photo;
	let noti_file;

	function onFile(e, setter) {
		setter(e.currentTarget.files?.[0] ?? null);
	}

	let showSuccess = false;
	let successTimer;

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
		showCreateModal = true;
	};

	const closeCreateModal = () => {
		showCreateModal = false;
	};

	const createNotification = async () => {
		isSaving = true;
		errorMsg = '';

		const [photo_path, file_path] = await Promise.all([
			uploadToBucket(noti_photo_file, 'noti_photo'),
			uploadToBucket(noti_file_file, 'noti_file')
		]);

		const payload = {
			title: createForm.title.trim() || null,
			summary: createForm.summary.trim() || null,
			full_content: createForm.full_content.trim() || null,
			priority: createForm.priority.trim() || null,
			photo_path: createForm.photo_path.trim() || null,
			file_path: createForm.file_path.trim() || null,
			created_by: currentUserName || null
		};

		const { data, error } = await supabase.from('notifications').insert(payload).select().single();

		isSaving = false;

		if (error) {
			errorMsg = error.message;
			return;
		}

		notifications = data ? [data, ...notifications] : notifications;
		closeCreateModal();
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
	<div>
		<p class="hidden">Search</p>
		<button class="button-primary" id="button-search"><Search />Search Notification</button>
	</div>
</div>

<div class="notifications-create">
	{#if isAdmin}
		<button class="button-create" on:click={openCreateModal}
			><Plus /><span>New Notification</span></button
		>
	{/if}
</div>

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
	{/each}
</div>

{#if showCreateModal}
	<div class="modal-backdrop" role="presentation">
		<div class="modal" role="dialog" aria-modal="true" aria-label="Create notification">
			<button class="modal-close" on:click={closeCreateModal} disabled={isSaving}>
				<Close size={18} />
			</button>
			<h2>New Notification</h2>
			<div class="modal-body">
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
			<div class="modal-actions">
				<button class="button-inverted" on:click={closeCreateModal} disabled={isSaving}>
					Cancel
				</button>
				<button on:click={createNotification} disabled={isSaving}>
					{isSaving ? 'Saving...' : 'Confirm'}
				</button>
			</div>
		</div>
	</div>
{/if}

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
		border: 2px solid #ffffff;
		border-radius: 4px;
		cursor: pointer;
	}

	button:hover {
		background-color: #064c6da4;
	}

	.button-create {
		width: 200px;
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

	.button-inverted {
		background-color: #ffffff;
		color: #064c6dd7;
		font-size: small;
		padding: 6px 14px;
		border: 2px solid #064c6dd7;
		border-radius: 4px;
		cursor: pointer;
	}

	.button-inverted:hover {
		background-color: #dedede;
	}

	.button-primary {
		background-color: #091747;
		padding: 10px 20px;
	}

	.button-primary:hover {
		background-color: #091747b9;
	}

	#button-search {
		height: 40px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		border: 1px;
	}

	.filter-input {
		width: 350px;
		font-size: 14px;
	}

	.forms-date {
		cursor: pointer;
	}

	.forms-date::-webkit-calendar-picker-indicator {
		cursor: pointer;
	}

	h2 {
		font-weight: bold;
	}

	h3 {
		font-size: 18px;
		font-weight: bold;
		margin-bottom: 5px;
	}

	.hidden {
		opacity: 0;
	}

	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(9, 23, 71, 0.45);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 32px 20px;
		z-index: 10;
	}

	.modal {
		position: relative;
		width: min(560px, 100%);
		max-height: calc(100vh - 64px);
		overflow: auto;
		background: #ffffff;
		border-radius: 8px;
		padding: 20px;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
	}

	.modal-close {
		position: absolute;
		top: 20px;
		right: 12px;
		background: transparent;
		border: none;
		cursor: pointer;
		padding: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #091747;
	}

	.modal-close:hover {
		background: rgba(0, 0, 0, 0.05);
		border-radius: 50%;
	}

	.modal h2 {
		margin: 0 0 16px;
		font-size: 20px;
	}

	.modal-body {
		display: grid;
		gap: 12px;
	}

	.modal-body label {
		display: grid;
		gap: 6px;
		font-size: 13px;
		font-weight: bold;
	}

	.modal-body input {
		border: 1px solid #dcdcdc;
		border-radius: 4px;
		padding: 8px 10px;
		font-size: 14px;
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		margin-top: 18px;
	}

	.notification-card {
		align-items: center;
		background-color: #ffffff;
		border: 1px solid #dcdcdc;
		border-radius: 4px;
		padding: 15px;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}

	.notifications-create {
		display: flex;
		margin: 10px;
	}

	.notifications-filter {
		display: flex;
		align-items: flex-end;
		gap: 12px;
		margin: 10px;
		padding: 10px 0;
	}

	.notifications-filter p {
		margin: 0 0 6px 0;
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
		padding: 4px 10px;
		border-radius: 12px;
		font-size: 12px;
		font-weight: bold;
		color: #fff;
		display: inline-block;
	}

	.priority-badge.normal {
		background-color: #064c6dd7;
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

	.project-box {
		margin: 10px;
		border-radius: 4px;
		font-size: 14px;
	}

	.summary {
		font-size: 16px;
		font-weight: bold;
		text-decoration: underline;
	}

	.title {
		font-size: 35px;
		font-weight: bold;
		margin-bottom: 20px;
		padding: 0 10px;
	}

	.upload {
		height: 200px;
		display: flex;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: 10px;
		border: 1px solid #091747;
		border-radius: 2px;
	}

	.upload-text {
		width: fit-content;
	}

	.upload-text input[type='file'] {
		font-size: 14px;
	}

	.upload-text input[type='file']::file-selector-button {
		background-color: #091747;
		color: #ffffff;
		border: none;
		padding: 6px 12px;
		border-radius: 4px;
		cursor: pointer;
		margin-right: 10px;
	}

	.upload-text input[type='file']::file-selector-button:hover {
		background-color: #091747b9;
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

		.filter-input {
			width: 100%;
		}

		#button-search {
			margin-top: 0;
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
		.title {
			font-size: 22px;
			margin-bottom: 14px;
		}

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

		.hidden {
			display: none;
		}

		.filter-input,
		.date-from,
		.date-to,
		.priority-select {
			width: 100%;
		}

		#button-search {
			width: 100%;
			justify-content: center;
			margin-top: 6px;
		}

		.notifications-create {
			margin: 8px;
		}

		.button-create {
			width: 100%;
			margin-right: 0;
		}

		.project-box {
			margin: 8px;
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

		.modal-backdrop {
			padding: 16px 12px;
		}

		.modal {
			padding: 16px;
		}

		.modal-actions {
			flex-direction: column;
			gap: 8px;
		}

		.modal-actions button {
			width: 100%;
		}

		.upload-text {
			width: 100%;
		}

		.upload-text input[type='file'] {
			width: 100%;
		}
	}
</style>
