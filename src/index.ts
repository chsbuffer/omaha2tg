import TelegramBot from "./telegram_bot";
import { apps, do_update_check, AppFlavor } from "./omaha";
import { escape } from "lodash-es";

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

async function make_message(bot: TelegramBot, env: Environment, app: AppFlavor, resp: any) {
	// this function weaving a Telegram HTML message from the `app`,
	// send to the telegram session specified by CHAT_ID,
	// and update the version string saved in Cloudflare KV

	const appname = app.name;
	const updatecheck = resp.updatecheck;
	const version = updatecheck.manifest.version;
	// #region weaving telegram html message

	let msg: string[] = [];
	// Product and version
	msg.push(`${appname} <code>${version}</code>\n`);
	if (app.tag) {
		msg.push(`#${app.tag}\n`);
	}
	msg.push("\n");

	// Update Channel Name
	msg.push(`Channel: ${resp.cohortname}\n`);
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
	let res = app.ogimg
		? await bot.sendPhoto(env.CHAT_ID, app.ogimg, message)
		: await bot.sendMessage(env.CHAT_ID, message);
	if (!res.ok) {
		console.log(`sendMsg err: ${res.statusText}`);
		return;
	}

	// Upload latest version number to Cloudflare KV
	await env.KV.put(app.tag, version);
}

async function kv_migrate(kv: KVNamespace) {
	const USER_VERSION_KEY = "user_version"
	let user_version = parseInt(await kv.get(USER_VERSION_KEY) || "0")
	if (user_version < 1) kv_migrate_1(kv)
	kv.put(USER_VERSION_KEY, "1")
}

async function kv_migrate_1(kv: KVNamespace) {
	console.log("migrate to v1")
	// Migrate kv key from appid to AppFlavor.tag
	for (const app of apps) {
		let version = await kv.get(app.guid)
		if (version) {
			kv.put(app.flavors[0].tag, version)
			kv.delete(app.guid)
		}
	}
}

// noinspection JSUnusedGlobalSymbols
export default {
	async scheduled(event: ScheduledController, env: Environment) {
		console.log(`schedule triggered: UTC ${new Date(event.scheduledTime).toISOString()}`);

		kv_migrate(env.KV)

		const bot = new TelegramBot(env.BOT_TOKEN, env.TELEGRAM_BOT_API);
		await do_update_check(env.KV, async (appFlavor, updateCheckResponse) => {
			try {
				await make_message(bot, env, appFlavor, updateCheckResponse);
			} catch (e: any) {
				console.log(e);
				bot.sendMessage(
					env.OWNER_ID,
					`<code>${escape(e instanceof Error ? e.stack : e)}</code>`
				);
			}
		});
	},
};
