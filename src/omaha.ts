let apps: { [key: string]: string } = {
	"{8A69D345-D564-463C-AFF1-A69D9E530F96}": "Google Chrome",
	"{8237E44A-0054-442C-B6B6-EA0509993955}": "Google Chrome Beta",
	"{401C381F-E0DE-4B85-8BD8-3F3F14FBDA57}": "Google Chrome Dev",
	"{4ea16ac7-fd5a-47c3-875b-dbf4a2008c20}": "Google Chrome Canary",
	"{47B07D71-505D-4665-AFD4-4972A30C6530}": "HPE",
	"{232066FE-FF4D-4C25-83B4-3F8747CF7E3A}": "Nearby Better Together"
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

export {apps, make_body}
