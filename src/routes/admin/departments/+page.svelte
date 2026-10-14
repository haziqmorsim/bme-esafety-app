<script>
	import { onMount } from 'svelte';
	import { getSupabase } from '$lib/supabase';
	import Search from '@lucide/svelte/icons/search';
	import ChevronsLeft from '@lucide/svelte/icons/chevrons-left';
	import ChevronsRight from '@lucide/svelte/icons/chevrons-right';

	let employees = $state([]);
	let loading = $state(true);
	let loadError = $state(null);

	onMount(async () => {
		const supabase = getSupabase();
		if (!supabase) {
			loadError = 'Supabase client is not available.';
			loading = false;
			return;
		}

		const { data, error } = await supabase
			.from('employees')
			.select('id, department, name, title, email')
			.order('department', { ascending: true })
			.order('name', { ascending: true });

		if (error) {
			console.error('Failed to load employees from Supabase:', error.message);
			loadError = error.message;
		} else {
			employees = data ?? [];
		}
		loading = false;
	});

	let selectedDepartment = $state('All');
	let searchText = $state('');
	let currentPage = $state(1);
	const pageSize = 20;

	const normalizeSearch = (value) => value.trim().toLowerCase();

	let departments = $derived([
		'All',
		...Array.from(new Set(employees.map((e) => e.department))).sort((a, b) => a.localeCompare(b))
	]);

	let filteredEmployees = $derived.by(() => {
		const keyword = normalizeSearch(searchText);

		const baseList =
			selectedDepartment === 'All'
				? employees
				: employees.filter((emp) => emp.department === selectedDepartment);

		const filtered = keyword
			? baseList.filter((emp) => {
					const haystack = `${emp.name} ${emp.title} ${emp.email}`.toLowerCase();
					return haystack.includes(keyword);
				})
			: baseList;

		return filtered
			.slice()
			.sort((a, b) => a.department.localeCompare(b.department) || a.name.localeCompare(b.name));
	});

	let totalPages = $derived(Math.max(1, Math.ceil(filteredEmployees.length / pageSize)));
	let pages = $derived(Array.from({ length: totalPages }, (_, i) => i + 1));
	let visiblePages = $derived.by(() => {
		const maxVisible = 3;
		let start = Math.max(1, currentPage - 1);
		let end = Math.min(totalPages, start + maxVisible - 1);

		start = Math.max(1, end - maxVisible + 1);
		return pages.slice(start - 1, end);
	});
	let paginatedEmployees = $derived(
		filteredEmployees.slice((currentPage - 1) * pageSize, currentPage * pageSize)
	);
	let records = $derived(filteredEmployees);

	$effect(() => {
		selectedDepartment;
		searchText;
		currentPage = 1;
	});

	$effect(() => {
		if (currentPage > totalPages) currentPage = totalPages;
		if (currentPage < 1) currentPage = 1;
	});

	// @ts-ignore
	function gotoPage(n) {
		if (n < 1) n = 1;
		if (n > totalPages) n = totalPages;
		currentPage = n;
	}

	function prev() {
		gotoPage(currentPage - 1);
	}

	function next() {
		gotoPage(currentPage + 1);
	}
</script>

<svelte:head>
	<title>Departments and Employees List | BME Automation App</title>
</svelte:head>

<h1 class="title">Departments and Employees List</h1>

<div class="project-box">
	<div class="employee-records">
		<div class="filter-bar">
			<div>
				<p>Department</p>
				<select class="department-select" bind:value={selectedDepartment}>
					{#each departments as department}
						<option value={department}
							>{department === 'All' ? 'All Departments' : department}</option
						>
					{/each}
				</select>
			</div>
			<div>
				<p>Employee</p>
				<input
					type="text"
					placeholder="Search by employee"
					class="filter-input"
					bind:value={searchText}
				/>
			</div>
			<div>
				<p class="hidden">Search</p>
				<button class="button-primary" id="button-search"><Search />Search Employee</button>
			</div>
		</div>
		<div class="records">
			Showing <b>{paginatedEmployees.length}</b> of <b>{records.length}</b> records
		</div>
	</div>

	<div class="table-container">
		<table class="dept-table">
			<thead>
				<tr>
					<th class="col-department">Department</th>
					<th class="col-name">Name</th>
					<th class="col-position">Title</th>
					<th class="col-email">E-mail Address</th>
				</tr>
			</thead>
			<tbody>
				{#if loading}
					<tr>
						<td colspan="4">Loading employees…</td>
					</tr>
				{:else if loadError}
					<tr>
						<td colspan="4">Could not load employees: {loadError}</td>
					</tr>
				{:else if filteredEmployees.length === 0}
					<tr>
						<td colspan="4">No employees found.</td>
					</tr>
				{:else}
					{#each paginatedEmployees as employee (employee.id)}
						<tr>
							<td class="col-department">{employee.department}</td>
							<td class="col-name">{employee.name}</td>
							<td class="col-position">{employee.title}</td>
							<td class="col-email">{employee.email}</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>

		<div class="pagination">
			<button onclick={prev} disabled={currentPage === 1} aria-label="Previous"
				><ChevronsLeft /></button
			>
			{#each visiblePages as p}
				<button class:active={p === currentPage} onclick={() => gotoPage(p)}>{p}</button>
			{/each}
			<button onclick={next} disabled={currentPage === totalPages} aria-label="Next"
				><ChevronsRight /></button
			>
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

	button:hover {
		background-color: #064c6da4;
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

	.col-email {
		width: 25%;
	}

	.col-department {
		width: 20%;
		text-align: center;
	}

	.col-name {
		width: 30%;
	}

	.col-position {
		width: 25%;
		text-align: center;
	}

	.department-select {
		height: 40px;
		width: 150px;
		padding: 0 10px;
		font-size: 14px;
		cursor: pointer;
	}

	.employee-records {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 12px;
	}

	.filter-bar {
		display: flex;
		align-items: flex-end;
		gap: 12px;
		padding: 10px 0;
	}

	.filter-bar p {
		margin: 0 0 6px 0;
	}

	.filter-input {
		width: 350px;
		height: 40px;
		padding: 0 10px;
		font-size: 14px;
	}

	.hidden {
		opacity: 0;
	}

	.project-box {
		margin: 10px;
		font-size: 14px;
	}

	.table-container {
		margin-top: 12px;
	}

	.records {
		font-size: 12px;
	}

	.dept-table {
		width: 100%;
		border-collapse: collapse;
	}

	.dept-table th,
	.dept-table td {
		border: 1px solid #091747b9;
		padding: 12px 16px;
		font-size: 14px;
	}

	.dept-table thead th {
		background-color: #091747;
		color: #ffffff;
		font-weight: 700;
		text-align: center;
	}

	.dept-table tbody tr:nth-child(even) {
		background-color: #ececec;
	}

	.title {
		font-size: 35px;
		font-weight: bold;
		margin-bottom: 20px;
		padding: 0 10px;
	}

	.pagination {
		display: flex;
		gap: 6px;
		justify-content: flex-end;
		margin-top: 12px;
	}

	.pagination button {
		min-width: 34px;
		height: 34px;
		border-radius: 4px;
		border: 1px solid #283a5a33;
		background: white;
		color: #091747;
		cursor: pointer;
		padding: 0 8px;
	}

	.pagination button[disabled] {
		opacity: 0.5;
		cursor: default;
	}

	.pagination button.active,
	.pagination button.active:focus {
		background: #091747;
		color: white;
		border-color: #091747;
	}

	.pagination button:hover:not([disabled]) {
		background: #091747b9;
		color: white;
	}

	@media (max-width: 1024px) {
		.title {
			font-size: 24px;
			margin-bottom: 15px;
			padding: 0 8px;
		}

		.project-box {
			margin: 8px;
		}

		.employee-records {
			flex-direction: column;
			align-items: stretch;
			gap: 10px;
		}

		.filter-bar {
			flex-wrap: wrap;
			align-items: flex-end;
			gap: 12px;
			padding: 8px 0;
		}

		.filter-bar > div {
			min-width: 220px;
		}

		.department-select,
		.filter-input {
			width: 100%;
		}

		#button-search {
			width: 100%;
		}

		.records {
			align-self: flex-start;
		}

		.table-container {
			overflow-x: auto;
			-webkit-overflow-scrolling: touch;
		}

		.dept-table {
			min-width: 760px;
		}

		.dept-table th,
		.dept-table td {
			padding: 10px 12px;
			white-space: nowrap;
		}

		.pagination {
			flex-wrap: wrap;
			gap: 6px;
		}
	}

	@media (max-width: 600px) {
		.title {
			font-size: 22px;
			margin-bottom: 14px;
			padding: 0 6px;
		}

		.project-box {
			margin: 6px;
		}

		.filter-bar {
			flex-direction: column;
			align-items: stretch;
			gap: 8px;
		}

		.filter-bar > div {
			width: 100%;
			min-width: 0;
		}

		.department-select,
		.filter-input,
		#button-search {
			width: 100%;
		}

		.filter-input,
		.department-select,
		#button-search {
			height: 40px;
		}

		#button-search {
			justify-content: center;
		}

		.records {
			font-size: 12px;
		}

		.table-container {
			margin-top: 10px;
			overflow-x: auto;
			-webkit-overflow-scrolling: touch;
		}

		.dept-table {
			min-width: 700px;
		}

		.pagination {
			flex-wrap: wrap;
		}

		.pagination button {
			min-width: 36px;
			height: 36px;
		}
	}
</style>