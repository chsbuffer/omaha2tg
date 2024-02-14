# omaha2tg

Source code for https://t.me/google_omaha

a Google product update checker.

Current checking products: see `src/omaha.ts`

## Notes

nodejs 18.15.0, npm 9.6.5

Create file `.dev.vars` to set dev env vars. format `<key>=<value>`

`npm run dev`

`npm run deploy`

## Reference

[chromium/src/+/main:docs/updater/protocol_3_1.md](https://source.chromium.org/chromium/chromium/src/+/main:docs/updater/protocol_3_1.md)

[omaha/blob/main/doc/ServerProtocolV3.md](https://github.com/google/omaha/blob/main/doc/ServerProtocolV3.md)
