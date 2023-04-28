let apps: { [key: string]: string } = {
	"{8A69D345-D564-463C-AFF1-A69D9E530F96}": "Google Chrome",
	"{8237E44A-0054-442C-B6B6-EA0509993955}": "Google Chrome Beta",
	"{401C381F-E0DE-4B85-8BD8-3F3F14FBDA57}": "Google Chrome Dev",
	"{4ea16ac7-fd5a-47c3-875b-dbf4a2008c20}": "Google Chrome Canary",
	"{47B07D71-505D-4665-AFD4-4972A30C6530}": "Google Play Games Beta",
	"{232066FE-FF4D-4C25-83B4-3F8747CF7E3A}": "Nearby Share Beta"
}

let apps_ogimg: { [key: string]: any } = {
	"{8A69D345-D564-463C-AFF1-A69D9E530F96}": "https://www.google.com/chrome/static/images/homepage/homepage.png",
	"{47B07D71-505D-4665-AFD4-4972A30C6530}": "https://www.gstatic.com/play/games/pc/googleplaygames-beta-opengraph-7ab5c9b4.png",
	"{232066FE-FF4D-4C25-83B4-3F8747CF7E3A}": "https://lh3.googleusercontent.com/iGXEZbCz1Qo1b3PtgoUZhkLQMOySwqPrEtv9VrAUdOvCCSe4Ke_5S42c8J9N75Rs9Cej9MuiSEHUfOXfK5TaTVf3BUbkxl60uMCOt4fANX19Tnsb9g"
}

let apps_extra: { [key: string]: any } = {
	"{47B07D71-505D-4665-AFD4-4972A30C6530}": {
		ap: "beta"
	}
}

async function make_body(kv: KVNamespace) {
	let body = {
		_declaration: {
			_attributes: {
				version: "1.0", encoding: "UTF-8"
			}
		}, request: {
			_attributes: {
				protocol: "3.0", updater: "Omaha"
			}, hw: {
				_attributes: {
					physmemory: "16", sse: "1", sse2: "1", sse3: "1", ssse3: "1", sse41: "1", sse42: "1", avx: "1"
				}
			}, os: {
				_attributes: {
					platform: "win", version: "10.0", arch: "x64"
				}
			}, app: []
		}
	}
	for (const appid in apps) {
		// @ts-ignore
		body.request.app.push({
			_attributes: {
				appid: appid,
				version: (await kv.get(appid)) || "0.0.0.0",
				...apps_extra[appid]
			},
			updatecheck: {}
		})
	}
	return body
}

export {apps, apps_ogimg, make_body}
