let apps: { [key: string]: any } = {
	"{8A69D345-D564-463C-AFF1-A69D9E530F96}": {
		name: "Google Chrome",
		tag: "ChromeStable",
		ogimg: "https://www.google.com/chrome/static/images/homepage/homepage.png",
	},
	"{8237E44A-0054-442C-B6B6-EA0509993955}": {
		name: "Google Chrome Beta",
		tag: "ChromeBeta",
	},
	"{401C381F-E0DE-4B85-8BD8-3F3F14FBDA57}": {
		name: "Google Chrome Dev",
		tag: "ChromeDev",
	},
	"{4EA16AC7-FD5A-47C3-875B-DBF4A2008C20}": {
		name: "Google Chrome Canary",
		tag: "ChromeCanary",
	},
	"{47B07D71-505D-4665-AFD4-4972A30C6530}": {
		name: "Google Play Games Beta",
		tag: "PlayGames",
		ogimg: "https://www.gstatic.com/play/games/pc/googleplaygames-beta-opengraph-7ab5c9b4.png",
	},
	"{232066FE-FF4D-4C25-83B4-3F8747CF7E3A}": {
		name: "Nearby Share Beta",
		tag: "NearbyShare",
		ogimg: "https://lh3.googleusercontent.com/iGXEZbCz1Qo1b3PtgoUZhkLQMOySwqPrEtv9VrAUdOvCCSe4Ke_5S42c8J9N75Rs9Cej9MuiSEHUfOXfK5TaTVf3BUbkxl60uMCOt4fANX19Tnsb9g",
	},
};

let apps_extra: { [key: string]: any } = {
	"{8A69D345-D564-463C-AFF1-A69D9E530F96}": {
		ap: "x64-stable-statsdef_1",
	},
	"{8237E44A-0054-442C-B6B6-EA0509993955}": {
		ap: "-arch_x64-statsdef_1",
	},
	"{401C381F-E0DE-4B85-8BD8-3F3F14FBDA57}": {
		ap: "-arch_x64-statsdef_1",
	},
	"{4EA16AC7-FD5A-47C3-875B-DBF4A2008C20}": {
		cohort: "1:jn:1ojl@0.05",
		ap: "x64-canary-statsdef_1",
	},
	"{47B07D71-505D-4665-AFD4-4972A30C6530}": {
		ap: "beta",
	},
};

async function make_body(kv?: KVNamespace | undefined) {
	let body = {
		_declaration: {
			_attributes: {
				version: "1.0", encoding: "UTF-8",
			},
		}, request: {
			_attributes: {
				protocol: "3.0", updater: "Omaha",
			}, hw: {
				_attributes: {
					physmemory: "16", sse: "1", sse2: "1", sse3: "1", ssse3: "1", sse41: "1", sse42: "1", avx: "1",
				},
			}, os: {
				_attributes: {
					platform: "win", version: "10.0", arch: "x64",
				},
			}, app: [],
		},
	};
	for (const appid in apps) {
		// @ts-ignore
		body.request.app.push({
			_attributes: {
				appid: appid,
				version: kv !== undefined ? (await kv.get(appid)) || "0.0.0.0" : "0.0.0.0",
				...apps_extra[appid],
			},
			updatecheck: {},
		});
	}
	return body;
}

export { apps, make_body };
