import TelegramBot from "./telegram_bot";
import {apps, apps_ogimg, make_body} from "./omaha"
import {js2xml, xml2js} from "xml-js";

const _ = require('lodash/core')

class JsonResponse extends Response {
	constructor(body?: any, init?: ResponseInit | Response) {
		const jsonBody = JSON.stringify(body);
		init = init || {
			headers: {
				'content-type': 'application/json;charset=UTF-8',
			},
		};
		super(jsonBody, init);
	}
}

interface Environment {
	KV: KVNamespace
	ENVIRONMENT: string
	BOT_TOKEN: string
	CHAT_ID: string
	OWNER_ID: string
	BOT_SECRET_TOKEN: string
}

function maybe<T>(value: T | T[]): T[] {
	return Array.isArray(value) ? value : [value]
}

function applyMaybe<T, S>(value: T | T[], expr: (obj: T[]) => S): S {
	return expr(Array.isArray(value) ? value : [value])
}

async function make_message(bot: TelegramBot, env: Environment, app: any) {
	const TAG = "omaha"

	const appid = app._attributes.appid
	const appname = apps[appid] ?? appid

	if (app.updatecheck._attributes.status !== "ok") {
		console.log(`No update for ${appname}`)
		return;
	}

	const ogimg = apps_ogimg[appid]
	let msg: string[] = []
	const updatecheck = app.updatecheck;
	const version = updatecheck.manifest._attributes.version

	msg.push(`${appname} <code>${version}</code>\n\n`)

	let url = applyMaybe(app.updatecheck.urls.url, (urls) => urls.find(s => s._attributes.codebase.startsWith("https://dl.google.com")) ?? urls.at(-1)!)
	let urlbase = url._attributes.codebase

	const pkg = maybe(updatecheck.manifest.packages.package).at(-1)
	msg.push(`Link: ${urlbase}${pkg._attributes.name}\nSHA256: <code>${pkg._attributes.hash_sha256}</code>\nSize: ${((parseInt(pkg._attributes.size) / 1024 ** 2).toFixed(2))} MiB`)

	// send message
	const message = ''.concat(...msg)
	let res = ogimg ? await bot.sendPhoto(env.CHAT_ID, ogimg, message) : await bot.sendMessage(env.CHAT_ID, message)
	if (!res.ok) {
		console.log(`${TAG}: sendMsg err: ${res.statusText}`)
	}

	await env.KV.put(appid, version)
}

// noinspection JSUnusedGlobalSymbols
export default {
	async fetch(request: Request, env: Environment) {
		if (request.method != "POST") {
			return new Response(null, {status: 403})
		}

		const signature = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
		if (signature !== env.BOT_SECRET_TOKEN) {
			return new Response(null, {status: 403})
		}

		const msg: any = await request.json().catch(e => null)
		if (!msg) {
			return new Response(null, {status: 403})
		}

		// response webhook
		return new JsonResponse({
			method: "sendMessage",
			chat_id: msg.message.chat.id,
			text: `hello! ${msg.message.chat.id}`,
		});
	},

	async scheduled(request: Request, env: Environment) {
		let api = env.ENVIRONMENT == "dev" ? "http://localhost:8081" : undefined
		const bot = new TelegramBot(env.BOT_TOKEN, api)

		const body = await make_body(env.KV)
		let resp = await fetch("https://update.googleapis.com/service/update2", {
			method: "POST", body: js2xml(body, {compact: true})
		})
		if (!resp.ok) {
			console.log(`post update2 failed: ${resp.status} ${resp.statusText}`)
			return
		}

		let xml = await resp.text();
		let update2: any = xml2js(xml, {compact: true})

		for (const app of maybe(update2.response.app)) {
			try {
				await make_message(bot, env, app)
			} catch (e) {
				await bot.sendMessage(env.OWNER_ID, `<code>${_.escape(e instanceof Error ? e.stack : e)}</code>\n\n<code>${_.escape(xml)}</code>`)
			}
		}
	}
};


