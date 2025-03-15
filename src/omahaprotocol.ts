
declare module 'OmahaResponse' {

	interface response {
		response: {
			app: app[]
		}
	}

	interface app {
		appid: string,
		cohort: string
		cohorthint: string
		cohortname: string
		updatecheck: updatecheck,
		status: "ok" | "restricted" | "error-unknownApplication" | "error-invalidAppId"
	}

	interface updatecheck {
		status: "ok",
		manifest: manifest,
		urls: {
			url: url[]
		}
	}

	interface manifest {
		arguments: string,
		packages: packages,
		run: string,
		version: string
	}

	interface packages {
		package: package[]
	}

	interface package {
		fp?: unknown,
		size: string,
		sizediff?: string,
		hash_sha256: string,
		hashdiff_sha256?: string,
		name: string,
		namediff?: string,
	}

	interface url {
		codebase: string,
		codebasediff: string
	}
}
