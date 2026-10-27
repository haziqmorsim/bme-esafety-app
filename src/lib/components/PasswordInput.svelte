<script>
	let {
		id,
		value = $bindable(''),
		name = undefined,
		placeholder = '********',
		autocomplete = 'new-password',
		minlength = undefined,
		maxlength = undefined,
		required = true,
		what = 'password'
	} = $props();

	let show = $state(false);
</script>

<div class="password-wrapper">
	<input
		{id}
		{name}
		type={show ? 'text' : 'password'}
		bind:value
		{placeholder}
		class="input-box"
		{autocomplete}
		{minlength}
		{maxlength}
		{required}
	/>
	<button
		type="button"
		class="toggle-password"
		onmousedown={(e) => e.preventDefault()}
		onclick={() => (show = !show)}
		aria-label={show ? `Hide ${what}` : `Show ${what}`}
		aria-pressed={show}
		title={show ? `Hide ${what}` : `Show ${what}`}
	>
		{#if show}
			<!-- Eye-off icon: the password is currently visible -->
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
				<path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
				<path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
				<line x1="2" y1="2" x2="22" y2="22" />
			</svg>
		{:else}
			<!-- Eye icon: the password is currently hidden -->
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
				<circle cx="12" cy="12" r="3" />
			</svg>
		{/if}
	</button>
</div>