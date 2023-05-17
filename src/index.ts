import TelegramBot from "./telegram_bot";
import { apps, make_body } from "./omaha";

const array = require("lodash/array");
const string = require("lodash/string");

class JsonResponse extends Response {
	constructor(body?: any, init?: ResponseInit | Response) {
		const jsonBody = JSON.stringify(body);
		init = init || {
			headers: {
				"content-type": "application/json;charset=UTF-8",
			},
		};
		super(jsonBody, init);
	}
}

interface Environment {
	KV: KVNamespace;
	ENVIRONMENT: string;
	BOT_TOKEN: string;
	CHAT_ID: string;
	OWNER_ID: string;
	BOT_SECRET_TOKEN: string;
}

function apply<T, S>(value: T, expr: (obj: T) => S): S {
	return expr(value);
}

async function make_message(bot: TelegramBot, env: Environment, app: any, app_fallback: any) {
	const appid = app.appid;
	const info = apps[appid];
	const appname = info.name ?? appid;

	if (app.updatecheck.status !== "ok") {
		console.log(`No update for ${appname}`);
		return;
	}

	let msg: string[] = [];

	var updatecheck = app.updatecheck;
	const version = updatecheck.manifest.version;
	if (app_fallback?.updatecheck?.manifest?.version === version) {
		// assume that when the versions are the same, then they are the same build.
		updatecheck = app_fallback.updatecheck;
	}

	msg.push(`${appname} <code>${version}</code>\n`);
	if (info.tag) {
		msg.push(`#${info.tag}\n`);
	}
	msg.push("\n");

	msg.push(`Channel: ${app.cohortname}\n`);
	// Link
	const url = apply(
		updatecheck.urls.url,
		urls =>
			urls.find((s: any) => s.codebase.startsWith("https://dl.google.com")) ?? urls.at(-1),
	);
	const urlbase = url.codebase;
	const pkg = updatecheck.manifest.packages.package.at(-1);
	msg.push(`Link: ${urlbase}${pkg.name}\n`);

	// Arguments
	if (updatecheck.manifest.arguments) {
		msg.push(
			`Arguments: <code>${string.escape(updatecheck.manifest.arguments)}</code>\n`,
		);
	}

	// SHA256, Size
	msg.push(
		`SHA256: <code>${pkg.hash_sha256}</code>\nSize: ${(
			parseInt(pkg.size) /
			1024 ** 2
		).toFixed(2)} MiB`,
	);

	// send message
	const message = "".concat(...msg);
	let res = info.ogimg
		? await bot.sendPhoto(env.CHAT_ID, info.ogimg, message)
		: await bot.sendMessage(env.CHAT_ID, message);
	if (!res.ok) {
		console.log(`sendMsg err: ${res.statusText}`);
		return;
	}

	await env.KV.put(appid, version);
}

// noinspection JSUnusedGlobalSymbols
export default {
	async fetch(request: Request, env: Environment) {
		if (request.method != "POST") {
			return new Response(null, { status: 403 });
		}

		const signature = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
		if (signature !== env.BOT_SECRET_TOKEN) {
			return new Response(null, { status: 403 });
		}

		const msg: any = await request.json().catch(e => null);
		if (!msg) {
			return new Response(null, { status: 403 });
		}

		// response webhook
		return new JsonResponse({
			method: "sendMessage",
			chat_id: msg.message.chat.id,
			text: `hello! ${msg.message.chat.id}`,
		});
	},

	async scheduled(request: Request, env: Environment) {
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
				`post update2 (fallback) failed: ${resp_fallback.status} ${resp_fallback.statusText}`,
			);
			return;
		}
		let update2_fallback: any = JSON.parse((await resp_fallback.text()).substring(5));

		for (const apps_and_fallback of array.zip(
			update2.response.app,
			update2_fallback.response.app,
		) as [[any, any]]) {
			try {
				await make_message(bot, env, ...apps_and_fallback);
			} catch (e) {
				console.log(e);
				await bot.sendMessage(
					env.OWNER_ID,
					`<code>${string.escape(e instanceof Error ? e.stack : e)}</code>\n\n<code>${string.escape(
						respText,
					)}</code>`,
				);
			}
		}
	},
};
