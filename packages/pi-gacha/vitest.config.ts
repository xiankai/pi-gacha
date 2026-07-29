import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Resolve pi's runtime packages to the vendored build so extension modules that
// import real pi values (e.g. pi-tui's visibleWidth) can be unit-tested. pi
// itself aliases these at load time; this mirrors that for vitest.
const piDist = (rel: string) => fileURLToPath(new URL(`../../vendor/pi/packages/${rel}`, import.meta.url));

export default defineConfig({
	test: {
		include: ["src/**/*.test.ts", "extensions/**/*.test.ts"],
		environment: "node",
	},
	resolve: {
		alias: {
			"@earendil-works/pi-tui": piDist("tui/dist/index.js"),
			"@earendil-works/pi-ai": piDist("ai/dist/compat.js"),
			"@earendil-works/pi-coding-agent": piDist("coding-agent/dist/index.js"),
		},
	},
});
