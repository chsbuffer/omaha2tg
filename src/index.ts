import TelegramBot from "./telegram_bot";
import { apps, make_body } from "./omaha";
import { js2xml, xml2js } from "xml-js";

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

function castArray<T>(value: T | T[]): T[] {
	return Array.isArray(value) ? value : [value];
}

function apply<T, S>(value: T, expr: (obj: T) => S): S {
	return expr(value);
}

async function make_message(bot: TelegramBot, env: Environment, app: any, app_fallback: any) {
	const appid = app._attributes.appid;
	const info = apps[appid];
	const appname = info.name ?? appid;

	if (app.updatecheck._attributes.status !== "ok") {
		console.log(`No update for ${appname}`);
		return;
	}

	let msg: string[] = [];

	var updatecheck = app.updatecheck;
	const version = updatecheck.manifest._attributes.version;
	if (app_fallback?.updatecheck?.manifest?._attributes?.version === version) {
		// assume that when the versions are the same, then they are the same build.
		updatecheck = app_fallback.updatecheck;
	}

	msg.push(`${appname} <code>${version}</code>\n`);
	if (info.tag) {
		msg.push(`#${info.tag}\n`);
	}
	msg.push("\n");

	msg.push(`Channel: ${app._attributes.cohortname}\n`);
	// Link
	const url = apply(
		castArray(updatecheck.urls.url),
		urls =>
			urls.find(s => s._attributes.codebase.startsWith("https://dl.google.com")) ?? urls.at(-1),
	);
	const urlbase = url._attributes.codebase;
	const pkg = castArray(updatecheck.manifest.packages.package).at(-1);
	msg.push(`Link: ${urlbase}${pkg._attributes.name}\n`);

	// Arguments
	const install_action = castArray(updatecheck.manifest.actions.action).find(
		a => a._attributes.event === "install" || a._attributes.event === "update",
	);
	if (install_action?._attributes?.arguments) {
		msg.push(
			`${string.upperFirst(install_action._attributes.event)} Arguments: <code>${string.escape(
				install_action._attributes.arguments,
			)}</code>\n`,
		);
	}

	// SHA256, Size
	msg.push(
		`SHA256: <code>${pkg._attributes.hash_sha256}</code>\nSize: ${(
			parseInt(pkg._attributes.size) /
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
		let resp = await fetch("https://update.googleapis.com/service/update2", {
			method: "POST",
			body: js2xml(await make_body(env.KV), { compact: true }),
		});
		if (!resp.ok) {
			console.log(`post update2 failed: ${resp.status} ${resp.statusText}`);
			return;
		}
		let update2: any = xml2js(await resp.text(), { compact: true });

		// update check (no version)
		let resp_fallback = await fetch("https://update.googleapis.com/service/update2", {
			method: "POST",
			body: js2xml(await make_body(), { compact: true }),
		});
		if (!resp_fallback.ok) {
			console.log(
				`post update2 (fallback) failed: ${resp_fallback.status} ${resp_fallback.statusText}`,
			);
			return;
		}
		let update2_fallback: any = xml2js(await resp_fallback.text(), { compact: true });

		for (const apps_and_fallback of array.zip(
			castArray(update2.response.app),
			castArray(update2_fallback.response.app),
		) as [[any, any]]) {
			try {
				await make_message(bot, env, ...apps_and_fallback);
			} catch (e) {
				console.log(e);
				await bot.sendMessage(
					env.OWNER_ID,
					`<code>${string.escape(e instanceof Error ? e.stack : e)}</code>\n\n<code>${string.escape(
						await resp.text(),
					)}</code>`,
				);
			}
		}
	},
};
