# omaha2tg

Source code for https://t.me/google_omaha 

a Google product update checker.

Current checking products: see `src/omaha.ts`

## Notes

nodejs 18.15.0, npm 9.6.5

Create file `.dev.vars` to set dev env vars. format `<key>=<value>`

`npm run dev`

`npm run dev-scheduled`

`URL=<> BOT_TOKEN=<> npm run register`

`npm run deploy`

## TODO

- WebHook register not implemented, require request to Telegram Bot API `setWebhook` method manually. see `src/register.js`
- Improve message.
