import { zip } from "lodash-es";
import { compareVer } from "./parse-version";

interface AppFlavor {
	tag: string;
	name: string;
	extra?: any;
	ogimg?: string;
}

interface App {
	guid: string;
	flavors: AppFlavor[];
}

let apps: App[] = [
	{
		guid: "{8A69D345-D564-463C-AFF1-A69D9E530F96}",
		flavors: [
			{
				tag: "ChromeStable",
				name: "Google Chrome",
				ogimg: "https://www.google.com/chrome/static/images/homepage/homepage.png",
				extra: {
					ap: "x64-stable-statsdef_1",
				}
			}
		]
	},
	{
		guid: "{8237E44A-0054-442C-B6B6-EA0509993955}",
		flavors: [
			{
				tag: "ChromeBeta",
				name: "Google Chrome Beta",
			}
		]
	},
	{
		guid: "{401C381F-E0DE-4B85-8BD8-3F3F14FBDA57}",
		flavors: [
			{
				tag: "ChromeDev",
				name: "Google Chrome Dev",
				extra: {
					ap: "-arch_x64-statsdef_1",
				},
			}
		]
	},
	{
		guid: "{4EA16AC7-FD5A-47C3-875B-DBF4A2008C20}",
		flavors: [
			{
				tag: "ChromeCanary",
				name: "Google Chrome Canary",
				extra:
				{
					cohort: "1:jn:1ojl@0.05",
					ap: "x64-canary-statsdef_1",
				},
			}
		]
	},
	{
		guid: "{47B07D71-505D-4665-AFD4-4972A30C6530}",
		flavors: [
			{
				tag: "PlayGames",
				name: "Google Play Games Beta",
				ogimg: "https://www.gstatic.com/play/games/pc/googleplaygames-beta-opengraph-7ab5c9b4.png",
				extra: {
					ap: "beta",
				},
			}
		]
	},
	{
		guid: "{232066FE-FF4D-4C25-83B4-3F8747CF7E3A}",
		flavors: [
			{
				tag: "NearbyShare",
				name: "Quick Share",
				ogimg: "https://lh3.googleusercontent.com/iGXEZbCz1Qo1b3PtgoUZhkLQMOySwqPrEtv9VrAUdOvCCSe4Ke_5S42c8J9N75Rs9Cej9MuiSEHUfOXfK5TaTVf3BUbkxl60uMCOt4fANX19Tnsb9g",
			}
		]
	},
	{
		guid: "{C601E9A4-03B0-4188-843E-80058BF16EF9}",
		flavors: [
			{
				tag: "GPG_Developer_Emulator_Stable",
				name: "Google Play Games Developer Emulator Stable",
				extra: {
					ap: "prod",
				},
			},
			{
				tag: "GPG_Developer_Emulator_Beta",
				name: "Google Play Games Developer Emulator Beta",
				extra: {
					ap: "dogfood",
				},
			}
		]
	},
];

type UpdateCheckCallback = {
	(appFlavor: AppFlavor, updateCheckResponse: any): Promise<void>;
}

async function update_check_request(body: any): Promise<any> {
	let resp = await fetch("https://update.googleapis.com/service/update2/json", {
		method: "POST",
		body: JSON.stringify(body),
	});
	if (!resp.ok) {
		console.log(`post update2 failed: ${resp.status} ${resp.statusText}`);
		return;
	}
	let respText = await resp.text();
	return JSON.parse(respText.substring(5)); // remove Safe JSON Prefixes
}

async function do_update_check(kv: KVNamespace, callback: UpdateCheckCallback) {
	// Ensure that app ids are not duplicated in each request.
	let depth = Math.max(...apps.map(x => x.flavors.length))
	for (let i = 0; i < depth; i++) {
		let body_update = default_body();
		let body_new_install = default_body();
		let flavors: AppFlavor[] = []
		let versions: string[] = []
		for (const app of apps) {
			let flavor = app.flavors[i]
			if (!flavor)
				continue;
			let version = await kv.get(flavor.tag) || "0.0.0.0";
			flavors.push(flavor)
			versions.push(version)

			// @ts-ignore
			body_update.request.app.push({
				appid: app.guid,
				updatecheck: {},
				version: version,
				...flavor.extra,
			});

			// @ts-ignore
			body_new_install.request.app.push({
				appid: app.guid,
				updatecheck: {},
				version: "0.0.0.0",
				...flavor.extra,
			});
		}

		let update_response = await update_check_request(body_update);
		let new_install_response = await update_check_request(body_new_install);
		for (const [appFlavor, current_version, update, new_install] of zip(flavors, versions, update_response.response.app, new_install_response.response.app) as [[AppFlavor, string, any, any]]) {

			const appname = appFlavor.name;
			let updatecheck = update.updatecheck;
			if (updatecheck.status !== "ok") {
				console.log(`No update for "${appname}" v${current_version}`);
				continue;
			}

			const version = updatecheck.manifest.version;
			console.log(`found update for "${appname}" v${current_version}: v${version}`);
			// prefer new_install's full installer.
			if (new_install.updatecheck?.manifest?.version === version) {
				updatecheck = new_install.updatecheck;
			}

			if (compareVer(version, current_version) < 0) {
				console.log(
					`Server responsed "${appname}" v${version} is older than current version v${current_version}, ignored.`
				);
				continue;
			}

			await callback(appFlavor, update)
		}
	} // flavor depth
}

function default_body() {
	return {
		request: {
			"@os": "win",
			"@updater": "updater",
			"acceptformat": "exe",
			"app": [],
			"arch": "x64",
			"dedup": "cr",
			"domainjoined": false,
			"hw": {
				avx: true,
				physmemory: 16,
				sse: true,
				sse2: true,
				sse3: true,
				sse41: true,
				sse42: true,
				ssse3: true,
			},
			"ismachine": 1,
			"os": {
				arch: "x64",
				platform: "win",
				version: "10.0.22622.0",
			},
			"protocol": "3.1",
		},
	}
}


export { apps, AppFlavor, do_update_check, UpdateCheckCallback };
