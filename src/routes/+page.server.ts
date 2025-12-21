import { readFileSync } from 'fs';
import { resolve } from 'path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import rehypeShiki from '@shikijs/rehype';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const readmePath = resolve('README.md');
	let readmeContent = readFileSync(readmePath, 'utf-8');

	// Skip the specific badge line
	readmeContent = readmeContent
		.split('\n')
		.filter((line) => !line.includes('alexey.work/badge'))
		.join('\n');

	const processedReadme = await unified()
		.use(remarkParse)
		.use(remarkGfm)
		.use(remarkRehype)
		.use(rehypeShiki, {
			theme: 'github-dark'
		})
		.use(rehypeStringify)
		.process(readmeContent);

	return {
		renderedReadme: String(processedReadme)
	};
};
