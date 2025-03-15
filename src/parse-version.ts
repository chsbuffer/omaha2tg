interface Version {
	major: number;
	minor: number;
	patch: number;
	build: number;
}

function parseVersion(versionString: string): Version {
	const vparts: string[] = versionString.split(".");
	if (vparts.length !== 4) {
		throw new Error("Version format isn't valid (must be `*.*.*.*`)");
	} else {
		const major: number = parseInt(vparts[0]);
		const minor: number = parseInt(vparts[1]);
		const patch: number = parseInt(vparts[2]);
		const build: number = parseInt(vparts[3]);

		if (isNaN(major) || isNaN(minor) || isNaN(patch) || isNaN(build)) {
			throw new Error("Version format isn't valid (must be `*.*.*.*`)");
		}

		return { major, minor, patch, build };
	}
}

function compareVer(v1: string, v2: string): number {
	const thiz = parseVersion(v1);
	const that = parseVersion(v2);
	if (thiz.major != that.major) {
		return thiz.major - that.major;
	} else if (thiz.minor !== that.minor) {
		return thiz.minor - that.minor;
	} else if (thiz.patch !== that.patch) {
		return thiz.patch - that.patch;
	} else {
		return thiz.build - that.build;
	}
}

export { parseVersion, Version, compareVer };
