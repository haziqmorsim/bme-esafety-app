<script>
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { requireUser } from '$lib/auth-guard';

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

	<div class="accordion">
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
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
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

	.submissions-filter {
		display: flex;
		align-items: flex-end;
		gap: 12px;
		margin: 10px;
		padding: 10px 0;
	}

	.submissions-filter p {
		margin: 0 0 6px 0;
	}

	.forms-date {
		cursor: pointer;
	}

	.forms-date::-webkit-calendar-picker-indicator {
		cursor: pointer;
	}

	.photo-link {
		text-decoration: underline;
	}

	.project-box {
		margin: 10px;
		font-size: 14px;
	}

	.title {
		font-size: 35px;
		font-weight: bold;
		margin-bottom: 20px;
		padding: 0 10px;
	}

	.accordion {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.acc-section {
		width: 100%;
	}

	.acc-header {
		width: 100%;
		border: 1px solid #091747;
		border-radius: 2px;
		padding: 10px 14px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: #fff;
		color: #091747;
		font-weight: 700;
		cursor: pointer;
	}

	.acc-icon :global(svg) {
		width: 18px;
		height: 18px;
	}

	.acc-body {
		padding: 14px 0 0;
	}

	.empty {
		color: #555;
		padding: 10px 2px;
	}

	.card-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 16px;
	}

	.history-card {
		border: 1px solid #8a8fa3;
		background: #fff;
		padding: 14px;
		min-height: 240px;
	}

	.card-title {
		font-size: 18px;
		font-weight: bold;
		color: #091747;
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
		.title {
			font-size: 22px;
			margin-bottom: 14px;
		}

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

		.project-box {
			margin: 8px;
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
