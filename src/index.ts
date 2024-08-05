import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getAllVersions, getLatestVersion } from "@biomejs/version-utils";
import { green, reset } from "kolorist";
import ora from "ora";
import prompts, { type Answers } from "prompts";

async function init() {
	let result: Answers<"projectName" | "version" | "packageManager">;

	const spinner = ora("Fetching versions").start();
	const versions = await getAllVersions();
	spinner.succeed("Fetched versions");

	try {
		result = await prompts([
			{
				type: "text",
				name: "projectName",
				message: reset("Project name:"),
				initial: `biome-repro-${Date.now()}`,
			},
			{
				type: versions !== undefined ? "autocomplete" : "text",
				name: "version",
				message: reset("Biome version:"),
				choices: versions?.map((version) => {
					return {
						title: version,
						value: version,
					};
				}),
				initial: async () => {
					const latestVersion = await getLatestVersion();
					const index =
						versions?.findIndex((version) => version === latestVersion) ?? 0;
					return index;
				},
			},
			{
				type: "select",
				name: "packageManager",
				message: reset("Package manager:"),
				choices: [
					{
						title: "npm",
						value: "npm",
					},
					{
						title: "pnpm",
						value: "pnpm",
					},
					{
						title: "bun",
						value: "bun",
					},
					{
						title: "yarn",
						value: "yarn",
					},
				],
			},
		]);

		const { projectName, version, packageManager } = result;

		const cwd = process.cwd();
		const targetDir = projectName;
		const root = join(cwd, targetDir);

		mkdirSync(root, { recursive: true });
		console.log(`\nScaffolding project in ${root}...`);

		cpSync(join(__dirname, "../templates/biome"), root, { recursive: true });
		const packageJsonContents = readFileSync(
			join(root, "package.json"),
			"utf-8",
		);
		const packageJson = JSON.parse(packageJsonContents);
		packageJson.devDependencies["@biomejs/biome"] = version;
		writeFileSync(
			join(root, "package.json"),
			JSON.stringify(packageJson, null, "\t"),
		);

		console.log("\nDone. Now run:\n");

		if (root !== cwd) {
			console.log(
				green(
					`  cd ${projectName.includes(" ") ? `"${projectName}"` : projectName}`,
				),
			);
		}

		switch (packageManager) {
			case "yarn":
				console.log(green(`  ${packageManager}`));
				break;
			default:
				console.log(green(`  ${packageManager} install`));
				break;
		}

		console.log();
	} catch (e) {
		console.error(e);
		process.exit(1);
	}
}

init().catch((e) => {
	console.error(e);
});
