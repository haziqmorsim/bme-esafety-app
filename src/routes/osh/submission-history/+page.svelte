<script>
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { requireUser } from '$lib/auth-guard';
	import Modal from '$lib/components/Modal.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { toast } from '$lib/stores/toast';
	import { sendToMake } from '$lib/make';

	let submissions = $state([]);
	let errorMsg = $state('');
	let loading = $state(false);
	let fromDate = $state('');
	let toDate = $state('');

	let open = $state({
		TBM: false,
		PPE: false,
		HKP: false
	});

	function toggle(type) {
		open = { ...open, [type]: !open[type] };
	}

	function formatDateTime(iso) {
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

	function formatDate(iso) {
		if (!iso) return '';

		const date = new Date(iso);

		const gmt8 = new Date(date.getTime() + 8 * 60 * 60 * 1000);

		const day = String(gmt8.getUTCDate()).padStart(2, '0');
		const month = gmt8.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
		const year = gmt8.getUTCFullYear();

		return `${day} ${month} ${year}`;
	}

	function withinRange(iso) {
		const d = new Date(iso);
		const fromOk = !fromDate || d >= new Date(fromDate + 'T00:00:00');
		const toOk = !toDate || d <= new Date(toDate + 'T23:59:59.999');
		return fromOk && toOk;
	}

	async function loadHistory() {
		loading = true;
		errorMsg = '';
		submissions = [];

		try {
			const auth = await requireUser();
			if (!auth) return;

			const { supabase, user } = auth;
			if (!user) throw new Error('Not signed in.');

			const [tbmRes, ppeRes, hkpRes] = await Promise.all([
				supabase
					.from('tbm_submissions')
					.select(
						'id, created_at, created_by_name, project_no, project_name, meeting_date, tbm_form_path, tbm_photo_path, ptw_form_path, other_doc_path'
					)
					.eq('created_by', user.id)
					.order('created_at', { ascending: false }),

				supabase
					.from('ppe_submissions')
					.select(
						'id, created_at, created_by_name, project_no, project_name, activity_date, ppe_photo_path'
					)
					.eq('created_by', user.id)
					.order('created_at', { ascending: false }),

				supabase
					.from('hkp_submissions')
					.select(
						'id, created_at, created_by_name, project_no, project_name, activity_date, hkp_photo_path'
					)
					.eq('created_by', user.id)
					.order('created_at', { ascending: false })
			]);

			if (tbmRes.error) throw tbmRes.error;
			if (ppeRes.error) throw ppeRes.error;
			if (hkpRes.error) throw hkpRes.error;

			const merged = [
				...(tbmRes.data ?? []).map((r) => ({ type: 'TBM', ...r })),
				...(ppeRes.data ?? []).map((r) => ({ type: 'PPE', ...r })),
				...(hkpRes.data ?? []).map((r) => ({ type: 'HKP', ...r }))
			].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

			if (fromDate || toDate) {
				submissions = merged.filter((r) => withinRange(r.created_at));
			} else {
				submissions = merged;
			}
		} catch (e) {
			errorMsg = e?.message ?? String(e);
		} finally {
			loading = false;
		}
	}

	const tbmRows = $derived.by(() => submissions.filter((s) => s.type === 'TBM'));
	const ppeRows = $derived.by(() => submissions.filter((s) => s.type === 'PPE'));
	const hkpRows = $derived.by(() => submissions.filter((s) => s.type === 'HKP'));

	const FORM_KEY = { TBM: 'tbm', PPE: 'ppe', HKP: 'hkp' };
	let emailTarget = $state(null);
	let emailAddress = $state('');
	let emailSending = $state(false);

	async function openEmail(type, row) {
		emailTarget = { type, id: row.id, project_no: row.project_no };
		if (!emailAddress) {
			const auth = await requireUser();
			emailAddress = auth?.user?.email ?? '';
		}
	}

	function closeEmail() {
		if (emailSending) return;
		emailTarget = null;
	}

	async function sendEmailCopy(e) {
		e.preventDefault();
		if (!emailTarget || emailSending) return;

		emailSending = true;
		const res = await sendToMake(FORM_KEY[emailTarget.type], emailTarget.id, {
			send: 'to',
			emailTo: emailAddress.trim()
		});
		emailSending = false;

		if (res.ok) {
			toast.success(`The e-${emailTarget.type} PDF will be e-mailed to ${emailAddress.trim()} shortly.`);
			emailTarget = null;
		} else {
			toast.error(res.error);
		}
	}

	onMount(loadHistory);
</script>

<h1 class="title">Submission History</h1>

<div class="submissions-filter">
	<div>
		<p>From Date</p>
		<input
			type="date"
			class="date-from forms-date"
			bind:value={fromDate}
			onchange={loadHistory}
			onfocus={(e) => e.target.showPicker?.()}
		/>
	</div>
	<div>
		<p>To Date</p>
		<input
			type="date"
			class="date-to forms-date"
			bind:value={toDate}
			onchange={loadHistory}
			onfocus={(e) => e.target.showPicker?.()}
		/>
	</div>
</div>

<div class="project-box">
	{#if errorMsg}
		<p class="error">{errorMsg}</p>
	{/if}

	{#if loading}
		<Spinner inline size={140} label="Loading submissions" />
	{/if}

	<div class="accordion" class:is-loading={loading}>
		<!-- TBM -->
		<div class="acc-section">
			<button type="button" class="acc-header" onclick={() => toggle('TBM')}>
				<span>Tool Box Meeting (e-TBM) ({tbmRows.length})</span>
				<span class="acc-icon">
					{#if open.TBM}
						<ChevronDown />
					{:else}
						<ChevronLeft />
					{/if}
				</span>
			</button>

			{#if open.TBM}
				<div class="acc-body">
					{#if tbmRows.length === 0}
						<p class="empty">No submissions</p>
					{:else}
						<div class="card-grid">
							{#each tbmRows as r (r.id)}
								<div class="history-card">
									<p class="card-title">{r.project_no ?? '-'}</p>
									<p><b>Project Name:</b> {r.project_name ?? '-'}</p>
									<p><b>Submission Date:</b> {formatDateTime(r.created_at)}</p>
									<p><b>Meeting Date:</b> {formatDate(r.meeting_date) ?? '-'}</p>

									<p class="doc-line">
										<b>Photo of Filled TBM Form:</b>
										{#if r.tbm_form_path}
											<a href={r.tbm_form_path} target="_blank" rel="noreferrer" class="photo-link"
												>View Photo</a
											>
										{:else}
											-
										{/if}
									</p>
									<p class="doc-line">
										<b>Photo(s) of TBM in Session:</b>
										{#if r.tbm_photo_path}
											<a href={r.tbm_photo_path} target="_blank" rel="noreferrer" class="photo-link"
												>View Photo</a
											>
										{:else}
											-
										{/if}
									</p>
									<p class="doc-line">
										<b>Photo of Filled PTW Form</b>
										{#if r.ptw_form_path}
											<a href={r.ptw_form_path} target="_blank" rel="noreferrer" class="photo-link"
												>View Photo</a
											>
										{:else}
											-
										{/if}
									</p>
									<p class="doc-line">
										<b>Another Document:</b>
										{#if r.other_doc_path}
											<a href={r.other_doc_path} target="_blank" rel="noreferrer" class="photo-link"
												>View Photo</a
											>
										{:else}
											-
										{/if}
									</p>
									<button type="button" class="button-email" onclick={() => openEmail('TBM', r)}>
										E-mail PDF
									</button>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- PPE -->
		<div class="acc-section">
			<button type="button" class="acc-header" onclick={() => toggle('PPE')}>
				<span>PPE Visual Inspections (e-PPE) ({ppeRows.length})</span>
				<span class="acc-icon">
					{#if open.PPE}
						<ChevronDown />
					{:else}
						<ChevronLeft />
					{/if}
				</span>
			</button>

			{#if open.PPE}
				<div class="acc-body">
					{#if ppeRows.length === 0}
						<p class="empty">No submissions</p>
					{:else}
						<div class="card-grid">
							{#each ppeRows as r (r.id)}
								<div class="history-card">
									<p class="card-title">{r.project_no ?? '-'}</p>
									<p><b>Project Name:</b> {r.project_name ?? '-'}</p>
									<p><b>Submission Date:</b> {formatDateTime(r.created_at)}</p>
									<p><b>Activity Date:</b> {formatDate(r.activity_date) ?? '-'}</p>

									<p class="doc-line">
										<b>Photos of Wearing PPE on Site:</b>
										{#if r.ppe_photo_path}
											<a href={r.ppe_photo_path} target="_blank" rel="noreferrer" class="photo-link"
												>View Photo</a
											>
										{:else}
											-
										{/if}
									</p>
									<button type="button" class="button-email" onclick={() => openEmail('PPE', r)}>
										E-mail PDF
									</button>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- HKP -->
		<div class="acc-section">
			<button type="button" class="acc-header" onclick={() => toggle('HKP')}>
				<span>Housekeeping Report (e-HKP) ({hkpRows.length})</span>
				<span class="acc-icon">
					{#if open.HKP}
						<ChevronDown />
					{:else}
						<ChevronLeft />
					{/if}
				</span>
			</button>

			{#if open.HKP}
				<div class="acc-body">
					{#if hkpRows.length === 0}
						<p class="empty">No submissions</p>
					{:else}
						<div class="card-grid">
							{#each hkpRows as r (r.id)}
								<div class="history-card">
									<p class="card-title">{r.project_no ?? '—'}</p>
									<p><b>Project Name:</b> {r.project_name ?? '—'}</p>
									<p><b>Submission Date:</b> {formatDateTime(r.created_at)}</p>
									<p><b>Activity Date:</b> {formatDate(r.activity_date) ?? '-'}</p>

									<p class="doc-line">
										<b>Photo of Housekeeping:</b>
										{#if r.hkp_photo_path}
											<a href={r.hkp_photo_path} target="_blank" rel="noreferrer" class="photo-link"
												>View Photo</a
											>
										{:else}
											-
										{/if}
									</p>
									<button type="button" class="button-email" onclick={() => openEmail('HKP', r)}>
										E-mail PDF
									</button>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>

<Modal
	open={!!emailTarget}
	title="E-mail PDF Report"
	subtitle={emailTarget ? `e-${emailTarget.type} · ${emailTarget.project_no ?? ''}` : ''}
	busy={emailSending}
	onclose={closeEmail}
>
	<form id="email-copy-form" class="email-form" onsubmit={sendEmailCopy}>
		<label for="email-copy-to">Send the PDF to</label>
		<input id="email-copy-to" type="email" bind:value={emailAddress} required />
	</form>
	{#snippet footer()}
		<button type="button" class="button-secondary" onclick={closeEmail} disabled={emailSending}>
			Cancel
		</button>
		<button type="submit" form="email-copy-form" class="button-primary" disabled={emailSending}>
			{emailSending ? 'Sending...' : 'Send'}
		</button>
	{/snippet}
</Modal>

<style>
	.submissions-filter {
		display: flex;
		align-items: flex-end;
		gap: 12px;
		margin: 10px;
		padding: 10px 0;
	}

	.photo-link {
		color: var(--link);
		font-weight: 600;
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.accordion {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.accordion.is-loading {
		display: none;
	}

	.acc-section {
		width: 100%;
	}

	.acc-header {
		width: 100%;
		border: 1px solid var(--line);
		border-radius: var(--r-md);
		padding: 13px 16px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: var(--mist);
		color: var(--ink);
		font-size: 15px;
		font-weight: 600;
		cursor: pointer;
		text-align: left;
	}

	.acc-header:hover:not(:disabled) {
		background: var(--mist-2);
		border-color: var(--line-strong);
	}

	.acc-icon :global(svg) {
		width: 18px;
		height: 18px;
	}

	.acc-body {
		padding: 14px 0 0;
	}

	.empty {
		color: var(--muted);
		padding: 10px 2px;
	}

	.card-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 16px;
	}

	.button-email {
		margin-top: 12px;
	}

	.button-primary:disabled,
	.button-secondary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.email-form {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.email-form input {
		width: 100%;
	}

	.history-card {
		border: 1px solid var(--line-soft);
		border-radius: var(--r-lg);
		background: var(--surface);
		box-shadow: var(--shadow-sm);
		padding: 18px;
		min-height: 240px;
	}

	.card-title {
		font-size: 18px;
		font-weight: 600;
		color: var(--ink);
		margin: 0 0 10px;
	}

	.doc-line {
		margin: 8px 0;
	}

	@media (max-width: 1024px) {
		.submissions-filter {
			flex-wrap: wrap;
			gap: 12px;
		}

		.submissions-filter > div {
			min-width: 220px;
			flex: 1 1 220px;
		}
	}

	@media (max-width: 768px) {
		.submissions-filter {
			gap: 8px;
		}

		.submissions-filter p {
			margin: 0 0 4px 0;
			line-height: 1.2;
		}

		.submissions-filter > div {
			margin: 0;
			padding: 0;
		}

		.date-from,
		.date-to {
			width: 100%;
		}

		.acc-header {
			padding: 10px;
			font-size: 14px;
			gap: 10px;
		}

		.acc-body {
			padding: 10px 0 0;
		}

		.card-grid {
			grid-template-columns: 1fr;
			gap: 12px;
		}

		.history-card {
			min-height: auto;
			padding: 12px;
		}

		.card-title {
			font-size: 16px;
			word-break: break-word;
		}

		.history-card p {
			word-break: break-word;
			overflow-wrap: anywhere;
		}

		.doc-line {
			word-break: break-word;
			overflow-wrap: anywhere;
		}

		.photo-link {
			display: inline-block;
			max-width: 100%;
			word-break: break-all;
		}

		.acc-icon :global(svg) {
			width: 16px;
			height: 16px;
		}
	}

	.photo-link {
		color: var(--link);
		font-weight: 600;
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.accordion {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.accordion.is-loading {
		display: none;
	}

	.acc-section {
		width: 100%;
	}

	.acc-header {
		width: 100%;
		border: 1px solid var(--line);
		border-radius: var(--r-md);
		padding: 13px 16px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: var(--mist);
		color: var(--ink);
		font-size: 15px;
		font-weight: 600;
		cursor: pointer;
		text-align: left;
	}

	.acc-header:hover:not(:disabled) {
		background: var(--mist-2);
		border-color: var(--line-strong);
	}

	.acc-icon :global(svg) {
		width: 18px;
		height: 18px;
	}

	.acc-body {
		padding: 14px 0 0;
	}

	.empty {
		color: var(--muted);
		padding: 10px 2px;
	}

	.card-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 16px;
	}

	.button-email {
		margin-top: 12px;
	}

	.button-primary:disabled,
	.button-secondary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.email-form {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.email-form input {
		width: 100%;
	}

	.history-card {
		border: 1px solid var(--line-soft);
		border-radius: var(--r-lg);
		background: var(--surface);
		box-shadow: var(--shadow-sm);
		padding: 18px;
		min-height: 240px;
	}

	.card-title {
		font-size: 18px;
		font-weight: 600;
		color: var(--ink);
		margin: 0 0 10px;
	}

	.doc-line {
		margin: 8px 0;
	}

	@media (max-width: 1024px) {
		.submissions-filter {
			flex-wrap: wrap;
			gap: 12px;
		}

		.submissions-filter > div {
			min-width: 220px;
			flex: 1 1 220px;
		}
	}

	@media (max-width: 768px) {
		.submissions-filter {
			gap: 8px;
		}

		.submissions-filter p {
			margin: 0 0 4px 0;
			line-height: 1.2;
		}

		.submissions-filter > div {
			margin: 0;
			padding: 0;
		}

		.date-from,
		.date-to {
			width: 100%;
		}

		.acc-header {
			padding: 10px;
			font-size: 14px;
			gap: 10px;
		}

		.acc-body {
			padding: 10px 0 0;
		}

		.card-grid {
			grid-template-columns: 1fr;
			gap: 12px;
		}

		.history-card {
			min-height: auto;
			padding: 12px;
		}

		.card-title {
			font-size: 16px;
			word-break: break-word;
		}

		.history-card p {
			word-break: break-word;
			overflow-wrap: anywhere;
		}

		.doc-line {
			word-break: break-word;
			overflow-wrap: anywhere;
		}

		.photo-link {
			display: inline-block;
			max-width: 100%;
			word-break: break-all;
		}

		.acc-icon :global(svg) {
			width: 16px;
			height: 16px;
		}
	}
</style>