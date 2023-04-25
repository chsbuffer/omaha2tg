export default class TelegramBot {
	private api: string;

	constructor(token: string, api: string = "https://api.telegram.org") {
		this.api = `${api}/bot${token}/`
	}

	_fetch(method: string, body: any) {
		return fetch(this.api + method, {
			method: "POST",
			headers: {"Content-Type": "application/json"},
			body: JSON.stringify(body)
		})
	}

	sendMessage(chat_id: number | string, text: string, parse_mode: string = "HTML") {
		return this._fetch("sendMessage", {chat_id: chat_id, text: text, parse_mode: parse_mode})
	}

	// unused
	setWebhook(url: string) {
		return this._fetch("setWebhook", {url: url})
	}
}
