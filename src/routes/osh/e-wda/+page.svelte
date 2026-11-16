<script>
	import { untrack } from 'svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { supabase } from '$lib/supabase';
	import { requireUser } from '$lib/auth-guard';
	import Pagination, { pageSlice } from '$lib/components/Pagination.svelte';
	import { DAILY_FORMS, submissionTiming,	mergeTiming, MYDateKey } from '$lib/submission-timing';

	let selectedDate = $state('');
	let searchText = $state('');
	let rows = $state([]);
	let errorMsg = $state('');
	let loading = $state(false);
	let noNameMatch = $state(false);

	let currentPage = $state(1);
	const pageSize = 20;

	const records = $derived(rows);
	const paginated = $derived(pageSlice(records, currentPage, pageSize));
	let loadToken = 0;
	let supervisorCache = null;

	function displayName(profile) {
		return `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || profile.email || '—';
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

	async function ensureSignedIn() {
		const auth = await requireUser();
		if (!auth) return null;
		return auth.user;
	}

	async function fetchSubmissions(table, dateColumn, supervisorIds, date) {
		if (supervisorIds.length === 0) return [];

		const BATCH = 1000;
		const all = [];

		for (let from = 0; ; from += BATCH) {
			let query = supabase
				.from(table)
				.select(`created_by, created_at, ${dateColumn}`)
				.in('created_by', supervisorIds)
				.order('id', { ascending: true })
				.range(from, from + BATCH - 1);

			if (date) query = query.eq(dateColumn, date);

			const { data, error } = await query;
			if (error) throw error;

			all.push(...(data ?? []));
			if ((data ?? []).length < BATCH) break;
		}

		return all;
	}

	function nextDay(key) {
		return new Date(new Date(`${key}T00:00:00Z`).getTime() + 24 * 60 * 60 * 1000)
			.toISOString()
			.slice(0, 10);
	}

	const cellValue = (timing) => (timing === 'on-time' ? 'Yes' : timing === 'late' ? 'Late' : 'No');

	async function loadSupervisors() {
		if (supervisorCache) return supervisorCache;

		const { data, error } = await supabase
			.from('profiles')
			.select('id, nickname, first_name, last_name, email, position, created_at')
			.eq('position', 'Site Safety Supervisor')
			.order('first_name', { ascending: true });

		if (error) throw error;

		supervisorCache = data ?? [];
		return supervisorCache;
	}

	async function loadAttendance(date, search) {
		const token = ++loadToken;
		loading = true;
		errorMsg = '';
		noNameMatch = false;
		rows = [];

		try {
			const user = await ensureSignedIn();
			if (!user || token !== loadToken) return;

			const everyone = await loadSupervisors();
			if (token !== loadToken) return;

			const needle = search.toLowerCase();
			const supervisors = needle
				? everyone.filter((u) => displayName(u).toLowerCase().includes(needle))
				: everyone;

			if (supervisors.length === 0) {
				noNameMatch = true;
				return;
			}

			const ids = supervisors.map((u) => u.id);

			const results = await Promise.all(
				Object.entries(DAILY_FORMS).map(async ([key, form]) => ({
					key,
					dateColumn: form.dateColumn,
					data: await fetchSubmissions(form.table, form.dateColumn, ids, date)
				}))
			);

			if (token !== loadToken) return;

			const byDay = new Map();
			for (const { key, dateColumn, data } of results) {
				for (const sub of data) {
					const day = String(sub[dateColumn] ?? '').slice(0, 10);
					if (!day) continue;

					const mapKey = `${sub.created_by}|${day}`;
					const entry = byDay.get(mapKey) ?? { tbm: null, ppe: null, hkp: null };
					entry[key] = mergeTiming(entry[key], submissionTiming(sub, dateColumn));
					byDay.set(mapKey, entry);
				}
			}

			const build = (u, day, entry) => {
				const etbm = cellValue(entry.tbm);
				const eppe = cellValue(entry.ppe);
				const ehkp = cellValue(entry.hkp);

				return {
					id: `${u.id}|${day}`,
					date: day,
					name: displayName(u),
					etbm,
					eppe,
					ehkp,
					status: [etbm, eppe, ehkp].every((v) => v !== 'No') ? 'Present' : 'Absent'
				};
			};

			const empty = { tbm: null, ppe: null, hkp: null };
			let built;

			if (date) {
				built = supervisors.map((u) => build(u, date, byDay.get(`${u.id}|${date}`) ?? empty));
			} else {
				const today = MYDateKey(new Date().toISOString());
				built = [];

				for (const u of supervisors) {
					const days = [...byDay.keys()]
						.filter((k) => k.startsWith(`${u.id}|`))
						.map((k) => k.split('|')[1])
						.sort();

					let start = MYDateKey(u.created_at) || today;
					if (days.length && days[0] < start) start = days[0];

					let end = today;
					if (days.length && days[days.length - 1] > end) end = days[days.length - 1];

					for (let day = start; day <= end; day = nextDay(day)) {
						built.push(build(u, day, byDay.get(`${u.id}|${day}`) ?? empty));
					}
				}
			}

			built.sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
			rows = built;
		} catch (e) {
			if (token === loadToken) errorMsg = e?.message ?? String(e);
		} finally {
			if (token === loadToken) loading = false;
		}
	}

	$effect(() => {
		const date = selectedDate;
		const search = searchText.trim();
		currentPage = 1;

		if (!date && !search) {
			loadToken++;
			rows = [];
			errorMsg = '';
			noNameMatch = false;
			loading = false;
			return;
		}

		loading = true;
		const timer = setTimeout(() => untrack(() => loadAttendance(date, search)), search ? 300 : 0);
		return () => clearTimeout(timer);
	});
</script>

<h1 class="title">Working Day Attendance (e-WDA) Record</h1>

<div class="project-box">
	<div class="date-records">
		<div class="filters">
			<div>
				<label for="wda-search">Search by Name</label>
				<input
					id="wda-search"
					type="text"
					class="filter-search"
					placeholder="Site safety supervisor name"
					bind:value={searchText}
				/>
			</div>
			<div class="forms-date">
				<label for="wda-date">Filter by Date</label>
				<div class="date-row">
					<input
						id="wda-date"
						type="date"
						class="filter-date"
						bind:value={selectedDate}
						onfocus={(e) => e.target.showPicker?.()}
					/>
					{#if selectedDate}
						<button type="button" class="button-inverted clear-date" onclick={() => (selectedDate = '')}>
							Clear
						</button>
					{/if}
				</div>
			</div>
		</div>
		<div class="records">
			Showing <b>{paginated.length}</b> of <b>{records.length}</b> records
		</div>
	</div>

	{#if errorMsg}
		<p class="error">{errorMsg}</p>
	{/if}

	<div class="table-container">
		<table class="wda-table">
			<thead>
				<tr>
					<th>Date</th>
					<th>Site Safety Supervisor Name</th>
					<th>eTBM</th>
					<th>ePPE</th>
					<th>eHKP</th>
					<th>Status</th>
				</tr>
			</thead>
			<tbody>
				{#each paginated as r (r.id)}
					<tr>
						<td class="center" data-label="Date">{formatDate(r.date)}</td>
						<td data-label="Supervisor">{r.name}</td>
						<td class="center" class:late={r.etbm === 'Late'} data-label="eTBM">{r.etbm}</td>
						<td class="center" class:late={r.eppe === 'Late'} data-label="ePPE">{r.eppe}</td>
						<td class="center" class:late={r.ehkp === 'Late'} data-label="eHKP">{r.ehkp}</td>
						<td
							class="center"
							class:present={r.status === 'Present'}
							class:absent={r.status === 'Absent'}
							data-label="Status">{r.status}</td
						>
					</tr>
				{:else}
					<tr>
						<td colspan="6" class="empty">
							{#if loading}
								<Spinner inline size={140} label="Loading attendance" />
							{:else if !selectedDate && !searchText.trim()}
								Search by Site Safety Supervisor's Name or choose a specific date.
							{:else if noNameMatch}
								No Site Safety Supervisor matches that name.
							{:else}
								No attendance records found.
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>

		<Pagination
			bind:page={currentPage}
			totalItems={records.length}
			{pageSize}
			showSummary={false}
		/>
	</div>
</div>

<style>
	.table-container {
		margin: 12px 0 0;
	}

	.wda-table .present {
		color: var(--success);
		font-weight: 600;
	}

	.wda-table .absent {
		color: var(--danger);
		font-weight: 600;
	}

	.empty {
		text-align: center;
		padding: 16px;
		color: var(--muted);
	}

	.wda-table .late {
		color: var(--warn);
		font-weight: 600;
	}

	.filters {
		display: flex;
		align-items: flex-end;
		gap: 16px;
	}

	.filters label {
		display: block;
		margin-bottom: 6px;
	}

	.filter-search {
		width: 260px;
		font-size: 12px;
	}

	.date-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.clear-date {
		height: 36px;
		padding: 0 12px;
		font-size: 12px;
		white-space: nowrap;
	}

	.date-records {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 12px;
	}

	.filter-date {
		font-size: 12px;
		cursor: pointer;
	}

	.filter-date::-webkit-calendar-picker-indicator {
		cursor: pointer;
	}

	.records {
		font-size: 12px;
	}

	@media (max-width: 1024px) {
		.date-records {
			flex-wrap: wrap;
			align-items: flex-start;
			gap: 10px;
		}

		.filters {
			flex-wrap: wrap;
		}

		.records {
			width: 100%;
			text-align: left;
		}

		.table-container {
			overflow-x: auto;
		}

		.wda-table {
			min-width: 900px;
		}

		.wda-table th,
		.wda-table td {
			padding: 10px 12px;
			font-size: 13px;
		}
	}

	@media (max-width: 600px) {
		.date-records {
			flex-direction: column;
			align-items: flex-start;
			gap: 8px;
		}

		.filters {
			flex-direction: column;
			align-items: stretch;
			width: 100%;
		}

		.filter-search,
		.filter-date {
			width: 100%;
			font-size: 13px;
		}

		.date-row .filter-date {
			flex: 1;
			min-width: 0;
		}

		.records {
			font-size: 12px;
		}

		.table-container {
			overflow: visible;
		}

		.wda-table {
			min-width: 0;
		}

		.wda-table thead {
			display: none;
		}

		.wda-table,
		.wda-table tbody,
		.wda-table tr,
		.wda-table td {
			display: block;
			width: 100%;
		}

		.wda-table tbody tr {
			margin-bottom: 10px;
			padding: 8px 12px;
			border: 1px solid var(--line);
			border-radius: var(--r-md);
			background-color: var(--surface);
			box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
		}

		.wda-table tbody tr:nth-child(even) {
			background-color: var(--surface);
		}

		.wda-table td,
		.wda-table .center {
			display: grid;
			grid-template-columns: 96px minmax(0, 1fr);
			gap: 8px;
			padding: 4px 0;
			border: none;
			font-size: 14px;
			text-align: left;
			white-space: normal;
			overflow-wrap: anywhere;
		}

		.wda-table td::before {
			content: attr(data-label);
			font-weight: 600;
			color: var(--ink);
		}

		.wda-table td.empty {
			display: block;
			text-align: center;
		}

		.wda-table td.empty::before {
			content: none;
		}
	}
</style>