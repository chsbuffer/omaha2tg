import TelegramBot from "./telegram_bot";
import { apps, make_body } from "./omaha";
import { zip, escape } from "lodash-es";
import { compareVer } from "./parse-version";

interface Environment {
	KV: KVNamespace;
	ENVIRONMENT: string;
	BOT_TOKEN: string;
	CHAT_ID: string;
	OWNER_ID: string;
}

function apply<T, S>(value: T, expr: (obj: T) => S): S {
	return expr(value);
}

async function make_message(bot: TelegramBot, env: Environment, app: any, app_fallback: any) {
	// this function weaving a Telegram HTML message from the `app`,
	// send to the telegram session specified by CHAT_ID,
	// and update the version string saved in Cloudflare KV

	const appid = app.appid;
	const current_version = (await env.KV.get(appid)) ?? "0.0.0.0";

	const info = apps[appid];
	const appname = info.name ?? appid;
	if (app.updatecheck.status !== "ok") {
		// "ok": An update is available and should be applied.
		console.log(`No update for "${appname}" v${current_version}`);
		return;
	}

	const version = app.updatecheck.manifest.version;
	console.log(`found update for "${appname}" v${current_version}: v${version}`);
	// select app_fallback when two versions are the same.
	// this is because we don't like the incremental update package from `app`.
	var updatecheck: any;
	if (app_fallback?.updatecheck?.manifest?.version === version) {
		updatecheck = app_fallback.updatecheck;
	} else {
		updatecheck = app.updatecheck;
	}

	// when server responsed version is lower than KV saved version ... fuck google.
	if (compareVer(version, current_version) < 0) {
		console.log(
			`Server responsed "${appname}" v${version} is older than current version v${current_version}, ignored.`
		);
		return;
	}

	// #region weaving telegram html message

	let msg: string[] = [];
	// Product and version
	msg.push(`${appname} <code>${version}</code>\n`);
	if (info.tag) {
		msg.push(`#${info.tag}\n`);
	}
	msg.push("\n");

	// Update Channel Name
	msg.push(`Channel: ${app.cohortname}\n`);
	// Download Link
	const url = apply(
		updatecheck.urls.url,
		urls => urls.find((s: any) => s.codebase.startsWith("https://dl.google.com")) ?? urls.at(-1)
	);
	const urlbase = url.codebase;
	const pkg = updatecheck.manifest.packages.package.at(-1);
	msg.push(`Link: ${urlbase}${pkg.name}\n`);

	// Arguments
	if (updatecheck.manifest.arguments) {
		msg.push(`Arguments: <code>${escape(updatecheck.manifest.arguments)}</code>\n`);
	}

	// SHA256, Download Size
	msg.push(
		`SHA256: <code>${pkg.hash_sha256}</code>\nSize: ${(parseInt(pkg.size) / 1024 ** 2).toFixed(
			2
		)} MiB`
	);

	//#endregion

	// send message to telegram
	const message = "".concat(...msg);
	let res = info.ogimg
		? await bot.sendPhoto(env.CHAT_ID, info.ogimg, message)
		: await bot.sendMessage(env.CHAT_ID, message);
	if (!res.ok) {
		console.log(`sendMsg err: ${res.statusText}`);
		return;
	}

	// Upload latest version number to Cloudflare KV
	await env.KV.put(appid, version);
}

// noinspection JSUnusedGlobalSymbols
export default {
	async scheduled(event: ScheduledController, env: Environment) {
		console.log(`schedule triggered: UTC ${new Date(event.scheduledTime).toISOString()}`);

		let api = env.ENVIRONMENT == "dev" ? "http://localhost:8081" : undefined;
		const bot = new TelegramBot(env.BOT_TOKEN, api);

		// update check (Worker KV saved versions)
		let resp = await fetch("https://update.googleapis.com/service/update2/json", {
			method: "POST",
			body: JSON.stringify(await make_body(env.KV)),
		});
		if (!resp.ok) {
			console.log(`post update2 failed: ${resp.status} ${resp.statusText}`);
			return;
		}
		let respText = await resp.text();
		let update2: any = JSON.parse(respText.substring(5)); // remove Safe JSON Prefixes

		// update check (no version)
		let resp_fallback = await fetch("https://update.googleapis.com/service/update2/json", {
			method: "POST",
			body: JSON.stringify(await make_body()),
		});
		if (!resp_fallback.ok) {
			console.log(
				`post update2 (fallback) failed: ${resp_fallback.status} ${resp_fallback.statusText}`
			);
			return;
		}
		let update2_fallback: any = JSON.parse((await resp_fallback.text()).substring(5));

		for (const apps_and_fallback of zip(update2.response.app, update2_fallback.response.app) as [
			[any, any]
		]) {
			try {
				await make_message(bot, env, ...apps_and_fallback);
			} catch (e: any) {
				console.log(e);
				bot.sendMessage(
					env.OWNER_ID,
					`<code>${escape(e instanceof Error ? e.stack : e)}</code>\n\n<code>${escape(
						respText
					)}</code>`
				);
			}
		}
	},
};
