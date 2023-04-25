const request = require('request-promise')

const token = process.env.BOT_TOKEN;

const url = process.env.URL;
// const url = ''; // to delete webhook, left url empty

const api = `https://api.telegram.org/bot`

// https://core.telegram.org/bots/api#setwebhook
let body = {
	url: url,
}
request({
	method: "POST",
	uri: api + token + "/setWebhook",
	form: body
}).then((resp) => {
	console.log(resp)
})
