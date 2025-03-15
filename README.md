# omaha2tg

Source code for https://t.me/google_omaha

a Google product update checker.

Current checking products: see `src/omaha.ts`

## Notes

nodejs 20.18.3, yarn 1.22.22

`cp wrangler.toml.template wrangler.toml`

group id contains -100 prefix

`yarn run dev`

`yarn run deploy`

## Reference

[chromium/src/+/main:docs/updater/protocol_3_1.md](https://source.chromium.org/chromium/chromium/src/+/main:docs/updater/protocol_3_1.md)

[omaha/blob/main/doc/ServerProtocolV3.md](https://github.com/google/omaha/blob/main/doc/ServerProtocolV3.md)
