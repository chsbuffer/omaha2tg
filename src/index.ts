import TelegramBot from "./telegram_bot";
import {apps, make_body} from "./omaha"
import {js2xml, xml2js} from "xml-js";

const _ = require('lodash')

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
	TEST_CHAT_ID: string
	BOT_SECRET_TOKEN: string
}

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
		const TAG = "omaha"
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

		let update2: any = xml2js(await resp.text(), {compact: true})

		for (const app of update2.response.app) {
			let appid = app._attributes.appid
			let appname = apps[appid] ?? appid

			if (app.updatecheck._attributes.status === "ok") {
				let version = app.updatecheck.manifest._attributes.version
				// message detail text
				let detail = js2xml(app, {compact: true, spaces: 1});
				detail = _.escape(detail)
				// send message
				let res = await bot.sendMessage(env.TEST_CHAT_ID,
					`${appname} new version: ${version}!\n<code>${detail}</code>`)
				if (!res.ok) {
					console.log(`${TAG}: sendMsg err: ${res.statusText}`)

				}

				await env.KV.put(appid, version)
			} else {
				console.log(`No update for ${appname}`)
			}
		}
	}
};
