import { renderReadme } from '$lib/readme';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({
	renderedReadme: await renderReadme('packages/lovely-ansi-svg/README.md')
});
