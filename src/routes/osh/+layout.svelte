<script>
	import { page } from '$app/stores';
	import { warmUpLocation } from '$lib/make';

	let { children } = $props();

	const FORM_ROUTE = /^\/osh\/e-(car|ctr|hkp|hwa|idf|ipr|ora|ppe|sac|scf|soa|tbm|tnr|trf|zca)\/?$/;
	let warmedFor = '';

	$effect(() => {
		const path = $page.url.pathname;
		if (FORM_ROUTE.test(path) && warmedFor !== path) {
			warmedFor = path;
			warmUpLocation();
		}
	});
</script>

{@render children()}