const fetch = require("node-fetch");

const token = process.env.BOT_TOKEN;

const url = process.env.URL;
// const url = ''; // to delete webhook, left url empty

const api = `https://api.telegram.org/bot`;

// https://core.telegram.org/bots/api#setwebhook
let body = {
	url: url,
};

fetch(api + token + "/setWebhook", {
	method: "POST",
	body: JSON.stringify(body),
	headers: { "Content-Type": "application/json" },
}).then((resp) => {
	console.log(resp);
});
