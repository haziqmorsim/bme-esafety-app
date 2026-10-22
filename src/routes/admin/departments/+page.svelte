<script>
	import { onMount } from 'svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { getSupabase } from '$lib/supabase';
	import Search from '@lucide/svelte/icons/search';
	import Pagination, { pageSlice } from '$lib/components/Pagination.svelte';

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

	let paginatedEmployees = $derived(pageSlice(filteredEmployees, currentPage, pageSize));
	let records = $derived(filteredEmployees);

	$effect(() => {
		selectedDepartment;
		searchText;
		currentPage = 1;
	});
</script>

<svelte:head>
	<title>Departments and Employees List | BME e-Safety App</title>
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
						<td colspan="4" class="empty">
							<Spinner inline size={140} label="Loading employees" />
						</td>
					</tr>
				{:else if loadError}
					<tr>
						<td colspan="4" class="empty">Could not load employees: {loadError}</td>
					</tr>
				{:else if filteredEmployees.length === 0}
					<tr>
						<td colspan="4" class="empty">No employees found.</td>
					</tr>
				{:else}
					{#each paginatedEmployees as employee (employee.id)}
						<tr>
							<td class="col-department" data-label="Department">{employee.department}</td>
							<td class="col-name" data-label="Name">{employee.name}</td>
							<td class="col-position" data-label="Title">{employee.title}</td>
							<td class="col-email" data-label="E-mail">{employee.email}</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>

		<Pagination
			bind:page={currentPage}
			totalItems={filteredEmployees.length}
			{pageSize}
			showSummary={false}
		/>
	</div>
</div>

<style>
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

	.hidden {
		opacity: 0;
	}

	.records {
		font-size: 12px;
	}

	@media (max-width: 1024px) {
		.employee-records {
			flex-direction: column;
			align-items: stretch;
			gap: 10px;
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
	}

	@media (max-width: 600px) {
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
			overflow: visible;
		}

		.dept-table {
			min-width: 0;
		}

		.dept-table thead {
			display: none;
		}

		.dept-table,
		.dept-table tbody,
		.dept-table tr,
		.dept-table td {
			display: block;
			width: 100%;
		}

		.dept-table tbody tr {
			margin-bottom: 10px;
			padding: 8px 12px;
			border: 1px solid var(--line);
			border-radius: var(--r-md);
			background-color: #ffffff;
			box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
		}

		.dept-table tbody tr:nth-child(even) {
			background-color: #ffffff;
		}

		.dept-table td {
			display: grid;
			grid-template-columns: 96px minmax(0, 1fr);
			gap: 8px;
			padding: 4px 0;
			border: none;
			white-space: normal;
			overflow-wrap: anywhere;
			text-align: left;
		}

		.dept-table td::before {
			content: attr(data-label);
			font-weight: 600;
		}

		.dept-table td.empty {
			display: block;
			text-align: center;
		}

		.dept-table td.empty::before {
			content: none;
		}
	}
</style>