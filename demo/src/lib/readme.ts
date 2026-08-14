import { readFileSync } from 'fs';
import { resolve } from 'path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import rehypeShiki from '@shikijs/rehype';

/** Render a repo-relative markdown file to HTML (shiki-highlighted, badge line stripped). */
export async function renderReadme(repoRelPath: string): Promise<string> {
	const content = readFileSync(resolve('..', repoRelPath), 'utf-8')
		.split('\n')
		.filter((line) => !line.includes('alexey.work/badge'))
		.join('\n');

	const processed = await unified()
		.use(remarkParse)
		.use(remarkGfm)
		.use(remarkRehype)
		.use(rehypeShiki, { theme: 'github-dark' })
		.use(rehypeStringify)
		.process(content);

	return String(processed);
}
