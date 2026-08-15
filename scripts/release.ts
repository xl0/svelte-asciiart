/**
 * Cuts a release: rolls the changelogs over, bumps the package versions,
 * verifies, commits, tags and pushes.
 *
 *   bun run release [patch|minor|major|x.y.z] [--no-push]
 *
 * All publishable packages live under `packages/<name>/`, each with its own
 * `CHANGELOG.md`, and are versioned in lockstep under a single `v<ver>` tag.
 * A package whose changelog has no [Unreleased] entries keeps its section for
 * next time but is still published at the new version. The tag push triggers
 * `.github/workflows/publish.yml`, which stages the builds on npm and creates
 * the GitHub Release. The script then waits for each staged version to appear,
 * asks for a 2FA code and approves it — that approval is what actually
 * publishes. After tagging, the script pauses with a release summary and
 * asks before pushing — that is the point to inspect the commit; `--no-push`
 * stops there without asking. Nothing reaches npm until it is pushed.
 *
 * Writing changelog entries is `/cl`'s job, not this script's — everything
 * here is mechanical, which is what makes the unattended push at the end
 * acceptable.
 */

import { $, Glob } from 'bun';
import { dirname } from 'node:path';

const die = (msg: string): never => {
	console.error(msg);
	process.exit(1);
};

const parse = (v: string) => {
	const m = v.match(/^(\d+)\.(\d+)\.(\d+)$/);
	return m ? ([Number(m[1]), Number(m[2]), Number(m[3])] as const) : null;
};

const cmp = (a: readonly number[], b: readonly number[]) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

const args = process.argv.slice(2);
const push = !args.includes('--no-push');
const target = args.find((arg) => !arg.startsWith('-')) ?? 'patch';

const branch = (await $`git rev-parse --abbrev-ref HEAD`.text()).trim();
if (branch !== 'master') die(`on ${branch}; releases are cut from master`);
if ((await $`git status --porcelain`.text()).trim()) die('worktree is dirty; commit or stash first');

// The approval at the end needs an npm login; check before touching anything.
if (push && (await $`npm whoami`.nothrow().quiet()).exitCode !== 0)
	die('not logged in to npm (needed to approve the staged release); run npm login first');

// Publishable packages: every packages/*/package.json that is not private.
const pkgs: { dir: string; name: string; pkgPath: string; pkgText: string }[] = [];
for (const pkgPath of [...new Glob('packages/*/package.json').scanSync()].sort()) {
	const pkgText = await Bun.file(pkgPath).text();
	const json = JSON.parse(pkgText);
	if (json.private) continue;
	pkgs.push({ dir: dirname(pkgPath), name: json.name, pkgPath, pkgText });
}
if (!pkgs.length) die('no publishable packages under packages/');

// Lockstep: every package must be at the same version.
const versions = pkgs.map((p) => (JSON.parse(p.pkgText).version ?? '') as string);
const current = versions[0];
if (versions.some((v) => v !== current))
	die(`package versions out of lockstep: ${pkgs.map((p, i) => `${p.name}@${versions[i]}`).join(', ')}`);
const cur = parse(current) ?? die(`version ${current} is not semver`);

let version: string;
if (target === 'patch') version = `${cur[0]}.${cur[1]}.${cur[2] + 1}`;
else if (target === 'minor') version = `${cur[0]}.${cur[1] + 1}.0`;
else if (target === 'major') version = `${cur[0] + 1}.0.0`;
else {
	const explicit = parse(target) ?? die(`not a bump type or a semver version: ${target}`);
	if (cmp(explicit, cur) <= 0) die(`${target} is not greater than the current ${current}`);
	version = target;
}

if ((await $`git tag -l ${`v${version}`}`.text()).trim()) die(`tag v${version} already exists`);

for (const { name } of pkgs) {
	const onNpm = await $`npm view ${`${name}@${version}`} version`.nothrow().quiet();
	if (onNpm.exitCode === 0 && onNpm.stdout.toString().trim()) die(`${name}@${version} is already published to npm`);
}

// A package's [Unreleased] body runs to the next `## [` heading; it is rolled
// only if it has entries. Refuse a release where no package has any.
const rollable: { path: string; text: string }[] = [];
for (const { dir, name } of pkgs) {
	const path = `${dir}/CHANGELOG.md`;
	const text = await Bun.file(path).text();
	const heading = '## [Unreleased]';
	const start = text.indexOf(heading);
	if (start < 0) die(`${path} has no [Unreleased] section`);
	const rest = text.slice(start + heading.length);
	const nextHeading = rest.search(/^## \[/m);
	if (/^- /m.test(nextHeading < 0 ? rest : rest.slice(0, nextHeading))) rollable.push({ path, text });
	else console.log(`${name}: no [Unreleased] entries, changelog left as is`);
}
if (!rollable.length) die('no package has [Unreleased] entries — run /cl first');

// Verify before touching any files — a failure here must leave the worktree
// clean, or re-runs hit the dirty-worktree guard with a half-applied bump.
for (const { dir } of pkgs) {
	console.log(`\n=== verifying ${dir} @ ${version} ===\n`);
	await $`bun run check`.cwd(dir);
	await $`bun run test`.cwd(dir);
	await $`bun run prepack`.cwd(dir);
	await $`bun pm pack --dry-run`.cwd(dir);
}

const date = new Date().toISOString().slice(0, 10);
for (const { path, text } of rollable) {
	const rolled = text.replace('## [Unreleased]\n', `## [Unreleased]\n\n## [${version}] - ${date}\n`);
	if (rolled === text) die(`could not roll [Unreleased] over in ${path}`);
	await Bun.write(path, rolled);
}

for (const { pkgPath, pkgText } of pkgs) {
	let bumped = pkgText.replace(`"version": "${current}"`, `"version": "${version}"`);
	if (bumped === pkgText) die(`could not rewrite the version in ${pkgPath}`);
	// sibling deps use plain semver ranges (npm publishes the tarball verbatim,
	// so the workspace: protocol must never appear here) — keep them in lockstep
	for (const { name } of pkgs) bumped = bumped.replace(new RegExp(`("${name}": ")[^"]+(")`, 'g'), `$1^${version}$2`);
	await Bun.write(pkgPath, bumped);
}

console.log(`\n=== committing and tagging ${version} ===\n`);
// sync the lockfile with the new versions/ranges — CI installs --frozen-lockfile
await $`bun install`.quiet();
await $`git add bun.lock ${rollable.map((r) => r.path)} ${pkgs.map((p) => p.pkgPath)}`;
await $`git commit -m ${`chore(release): ${version}`}`;
await $`git tag -a ${`v${version}`} -m ${`release ${version}`}`;

// Inspection gate: the release exists only locally at this point. Show what
// it is and confirm before the push kicks off CI.
console.log(`
=== v${version} committed and tagged, nothing pushed yet ===

  packages:   ${pkgs.map((p) => `${p.name}@${version}`).join(', ')}
  changelogs: ${rollable.map((r) => r.path).join(', ') || '(none rolled)'}

Inspect with: git show HEAD --stat && git show HEAD
`);
const manualInstructions = `
Nothing was pushed. Publish later with:

  git push --no-follow-tags origin master && git push origin v${version}

then approve what CI stages: npm stage list <pkg> / npm stage approve <id>.
To abandon instead: git tag -d v${version} && git reset --hard HEAD~1
`;
if (!push) {
	console.log(manualInstructions);
	process.exit(0);
}
if (prompt(`Push master + v${version} and kick off the CI publish? [y/N]`)?.trim().toLowerCase() !== 'y') {
	console.log(manualInstructions);
	process.exit(0);
}

console.log(`\n=== pushing ${version} ===\n`);
// --no-follow-tags: push exactly this release's tag, whatever push.followTags
// is set to locally. An older unpushed tag would otherwise trigger its own run.
await $`git push --no-follow-tags origin master`;
await $`git push origin ${`v${version}`}`;

console.log(`\n=== waiting for CI to stage ${version} on npm ===\n`);
// CI runs in under a minute; ten is a hung workflow, not a slow one.
const deadline = Date.now() + 10 * 60 * 1000;
// one TOTP code is normally valid long enough to approve every package —
// re-prompt only when it expires or is rejected (rare)
let otp: string | undefined;
for (const { name } of pkgs) {
	let stageId: string | undefined;
	while (!stageId) {
		const list = await $`npm stage list ${name} --json`.nothrow().quiet();
		if (list.exitCode !== 0) die(`npm stage list failed:\n${list.stderr.toString()}`);
		const items = JSON.parse(list.stdout.toString()) as { id: string; version: string }[];
		stageId = items.find((item) => item.version === version)?.id;
		if (!stageId) {
			if (Date.now() > deadline) die(`timed out waiting for ${name}; check the workflow run, then npm stage list + npm stage approve <id>`);
			await Bun.sleep(10_000);
			process.stdout.write('.');
		}
	}
	console.log(`${name} staged as ${stageId}`);

	for (let attempt = 1; ; attempt++) {
		otp ??= prompt(`2FA code to approve and publish ${name}:`)?.trim() || undefined;
		if (!otp) die(`no code entered; approve manually with: npm stage approve ${stageId}`);
		if ((await $`npm stage approve ${stageId} --otp ${otp}`.nothrow()).exitCode === 0) break;
		otp = undefined;
		if (attempt === 3) die(`approve manually with: npm stage approve ${stageId}`);
	}
}

console.log(`
Approved and published v${version}: ${pkgs.map((p) => p.name).join(', ')}.
`);
