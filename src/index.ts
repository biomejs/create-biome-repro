import { execSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getAllVersions, getLatestVersion } from "@biomejs/version-utils";
import { green, red, reset } from "kolorist";
import ora from "ora";
import prompts, { type Answers } from "prompts";

const NOT_FOUND_INDEX = 0;

async function init() {
	try {
		const versions = await fetchVersions();
		const userInput = await gatherUserInput(versions);
		const projectRoot = setupProjectDirectory(userInput.projectName);

		const shouldPublishRepo = userInput.publishRepo === "yes";

		await scaffoldProject(projectRoot, userInput.version);
		await handleRepositoryCreation(projectRoot, shouldPublishRepo);

		displayNextSteps(
			userInput.projectName,
			userInput.packageManager,
			projectRoot,
		);
	} catch (e) {
		console.error(e);
		process.exit(1);
	}
}

// Fetch the available versions from the dependencies of a given project.
// https://github.com/biomejs/version-utils
async function fetchVersions() {
	const spinner = ora("Fetching versions").start();
	const versions = await getAllVersions();
	spinner.succeed("Fetched versions");
	return versions;
}

// Gather user input through interactive prompts.
async function gatherUserInput(
	versions: string[] | undefined,
): Promise<Answers> {
	return await prompts([
		{
			type: "text",
			name: "projectName",
			message: reset("Project name:"),
			initial: `biome-repro-${Date.now()}`,
		},
		{
			type: versions ? "autocomplete" : "text",
			name: "version",
			message: reset("Biome version:"),
			choices: versions?.map((version) => ({ title: version, value: version })),
			initial: async () => {
				const latestVersion = await getLatestVersion();
				return (
					versions?.findIndex((version) => version === latestVersion) ??
					NOT_FOUND_INDEX
				);
			},
		},
		{
			type: "select",
			name: "packageManager",
			message: reset("Package manager:"),
			choices: ["npm", "pnpm", "bun", "yarn"].map((pm) => ({
				title: pm,
				value: pm,
			})),
		},
		{
			type: "select",
			name: "publishRepo",
			message: reset(
				"Do you want to create a new repository on GitHub for this?",
			),
			choices: [
				{ title: "Yes", value: "yes" },
				{ title: "No", value: "no" },
			],
		},
	]);
}

function setupProjectDirectory(projectName: string): string {
	const cwd = process.cwd();
	const projectRoot = join(cwd, projectName);
	mkdirSync(projectRoot, { recursive: true });
	console.log(`\nScaffolding project in ${projectRoot}...`);
	return projectRoot;
}

async function scaffoldProject(root: string, version: string) {
	cpSync(join(__dirname, "../templates/biome"), root, { recursive: true });
	const packageJsonPath = join(root, "package.json");
	const packageJsonContents = readFileSync(packageJsonPath, "utf-8");
	const packageJson = JSON.parse(packageJsonContents);
	packageJson.devDependencies["@biomejs/biome"] = version;
	writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, "\t"));
}

async function handleRepositoryCreation(root: string, publishRepo: boolean) {
	if (publishRepo) {
		try {
			process.chdir(root);
			console.log("Initializing git repository...");
			initRepoAndCommit();
			if (isGithubCliInstalled()) {
				execSync(
					"gh repo create --public --disable-wiki --disable-issues --source=.",
					{ stdio: "inherit" },
				);
			} else {
				console.log(
					red(
						"GitHub CLI is not installed. Install it from here: https://cli.github.com/",
					),
				);
			}
		} catch (error) {
			console.log(red("Failed to initialize git repository"));
		} finally {
			process.chdir(process.cwd());
		}
	}
}

function displayNextSteps(
	projectName: string,
	packageManager: string,
	root: string,
) {
	console.log("\nDone. Now run:\n");
	if (root !== process.cwd()) {
		console.log(
			green(
				`  cd ${projectName.includes(" ") ? `"${projectName}"` : projectName}`,
			),
		);
	}
	console.log(
		green(`  ${packageManager} ${packageManager === "yarn" ? "" : "install"}`),
	);
	console.log();
}

function isGithubCliInstalled(): boolean {
	try {
		execSync("gh --version");
		return true;
	} catch {
		return false;
	}
}

function initRepoAndCommit() {
	execSync("git init");
	execSync("git add .");
	execSync('git commit -m "Initial commit"');
}

init().catch((e) => {
	console.error(e);
});
