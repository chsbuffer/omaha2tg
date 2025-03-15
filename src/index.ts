import TelegramBot from "./telegram_bot";
import { apps, do_update_check, AppFlavor } from "./omaha";
import { escape } from "lodash-es";
import { app } from "OmahaResponse";

interface Environment {
	KV: KVNamespace;
	BOT_TOKEN: string;
	CHAT_ID: string;
	OWNER_ID: string;
	TELEGRAM_BOT_API?: string;
}

function apply<T, S>(value: T, expr: (obj: T) => S): S {
	return expr(value);
}

async function make_message(bot: TelegramBot, env: Environment, appFlavor: AppFlavor, respApp: app) {
	// this function weaving a Telegram HTML message from the `app`,
	// send to the telegram session specified by CHAT_ID,
	// and update the version string saved in Cloudflare KV

	const appname = appFlavor.name;
	const updatecheck = respApp.updatecheck;
	const version = updatecheck.manifest.version;
	// #region weaving telegram html message

	const msg: string[] = [];
	// Product and version
	msg.push(`${appname} <code>${version}</code>\n`);
	if (appFlavor.tag) {
		msg.push(`#${appFlavor.tag}\n`);
	}
	msg.push("\n");

	// Update Channel Name
	msg.push(`Channel: ${respApp.cohortname}\n`);
	// Download Link
	const url = apply(
		updatecheck.urls.url,
		urls => urls.find(s => s.codebase.startsWith("https://dl.google.com")) ?? urls.at(-1)!
	);
	const urlbase = url.codebase;
	const pkg = updatecheck.manifest.packages.package.at(-1)!;
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
	const res = appFlavor.ogimg
		? await bot.sendPhoto(env.CHAT_ID, appFlavor.ogimg, message)
		: await bot.sendMessage(env.CHAT_ID, message);
	if (!res.ok) {
		console.log(`sendMsg err: ${res.statusText}`);
		return;
	}

	// Upload latest version number to Cloudflare KV
	await env.KV.put(appFlavor.tag, version);
}

async function kv_migrate(kv: KVNamespace) {
	const USER_VERSION_KEY = "user_version"
	const user_version = parseInt(await kv.get(USER_VERSION_KEY) || "0")
	if (user_version < 1) await kv_migrate_1(kv)
	await kv.put(USER_VERSION_KEY, "1")
}

async function kv_migrate_1(kv: KVNamespace) {
	console.log("migrate to v1")
	// Migrate kv key from appid to AppFlavor.tag
	for (const app of apps) {
		const version = await kv.get(app.guid)
		if (version) {
			await kv.put(app.flavors[0].tag, version)
			await kv.delete(app.guid)
		}
	}
}

async function seed(kv: KVNamespace) {
	if (await kv.get("user_version"))
		return;
	console.log("seeding")
	await kv.put("{232066FE-FF4D-4C25-83B4-3F8747CF7E3A}", "1.0.2113.1");
	await kv.put("{401C381F-E0DE-4B85-8BD8-3F3F14FBDA57}", "136.0.7064.0");
	await kv.put("{47B07D71-505D-4665-AFD4-4972A30C6530}", "25.3.22.5");
	await kv.put("{4EA16AC7-FD5A-47C3-875B-DBF4A2008C20}", "136.0.7068.0");
	await kv.put("{8237E44A-0054-442C-B6B6-EA0509993955}", "135.0.7049.17");
	await kv.put("{8A69D345-D564-463C-AFF1-A69D9E530F96}", "134.0.6998.89");
	await kv.put("{C601E9A4-03B0-4188-843E-80058BF16EF9}", "24.11.76.2");
}

// noinspection JSUnusedGlobalSymbols
export default {
	async fetch(req: Request, env: Environment): Promise<Response> {
		console.log(req)
		const url = new URL(req.url);
		switch (url.pathname) {
			case "/seed":
				if (((await env.KV.list()).keys.length > 0))
					return new Response("kv not empty!", { status: 403 });
				await seed(env.KV);
				return Response.redirect(new URL("/list", url.origin).toString())
			case "/list":
				{
					const keys = await env.KV.list();
					const map = new Map();
					for (const key of keys.keys) {
						map.set(key.name, await env.KV.get(key.name))
					}
					return new Response(JSON.stringify(Object.fromEntries(map)));
				}
			case "/reset":
				{
					const keys = await env.KV.list();
					if (url.searchParams.get("keyNum") != keys.keys.length.toString())
						return new Response("Add 'keyNum' parameter with count of KV keys for confirm reset!", { status: 403 })
					for (const key of keys.keys) {
						await env.KV.delete(key.name);
					}
					return new Response(`deleted ${keys.keys.length} keys.`);
				}
			default:
				return new Response("404", { status: 404 });
		}
	},
	async scheduled(event: ScheduledController, env: Environment) {
		console.log(`schedule triggered: UTC ${new Date(event.scheduledTime).toISOString()}`);

		await kv_migrate(env.KV);

		const bot = new TelegramBot(env.BOT_TOKEN, env.TELEGRAM_BOT_API);
		await do_update_check(env.KV, async (appFlavor, updateCheckResponse) => {
			try {
				await make_message(bot, env, appFlavor, updateCheckResponse);
			} catch (e: unknown) {
				console.log(e);
				// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
				await bot.sendMessage(env.OWNER_ID, `<code>${escape(`${e}`)}</code>`);
			}
		});
	},
};
