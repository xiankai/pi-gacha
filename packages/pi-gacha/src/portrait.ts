/**
 * Detailed ANSI portraits — pure. Renders a compact truecolor pixel-art bust per
 * character using the half-block technique (▀ with fg = top pixel, bg = bottom pixel),
 * so an 8px-tall portrait fits in 4 terminal rows. Recolored from each character's
 * palette; the shared silhouette keeps them consistent while palette makes them
 * distinct. Output is raw ANSI (theme-independent) — pi's Text renders it verbatim.
 */

import { CHARACTERS } from "./characters/registry.ts";

const SKIN = "#f1c9a5";
const RESET = "\x1b[0m";

/**
 * Pixel grid (12 wide × 8 tall). Role chars:
 *   space = transparent · H = hair · S = skin · E = eye · C = cloth · A = accent
 */
const BUST: string[] = [
	"   HHHHHH   ",
	"  HHHHHHHH  ",
	" HHSSSSSSHH ",
	" HHSEESEESH ",
	" HHSSSSSSHH ",
	"  HSSSSSSH  ",
	"  CCCCCCCC  ",
	" CCCCAACCCC ",
];

function hexToRgb(hex: string): [number, number, number] {
	const h = hex.replace("#", "");
	return [Number.parseInt(h.slice(0, 2), 16), Number.parseInt(h.slice(2, 4), 16), Number.parseInt(h.slice(4, 6), 16)];
}

/** Resolve a grid role char to a hex color, or null for transparent. */
function colorFor(role: string, hair: string, cloth: string, accent: string): string | null {
	switch (role) {
		case "H":
			return hair;
		case "S":
			return SKIN;
		case "E":
		case "A":
			return accent;
		case "C":
			return cloth;
		default:
			return null;
	}
}

/** Render the active character's portrait as 4 ANSI half-block lines (12 cells wide). */
export function renderPortrait(characterId: string): string[] {
	const character = CHARACTERS[characterId];
	if (!character) return [];
	const { primary: hair, secondary: cloth, accent } = character.palette;
	const grid = character.portraitGrid ?? BUST;
	const width = 12;
	const lines: string[] = [];

	for (let r = 0; r < grid.length; r += 2) {
		const top = grid[r] ?? "";
		const bot = grid[r + 1] ?? "";
		let line = "";
		for (let c = 0; c < width; c++) {
			const tc = colorFor(top[c] ?? " ", hair, cloth, accent);
			const bc = colorFor(bot[c] ?? " ", hair, cloth, accent);
			if (!tc && !bc) {
				line += " ";
			} else if (tc && bc) {
				const [tr, tg, tb] = hexToRgb(tc);
				const [br, bg, bb] = hexToRgb(bc);
				line += `\x1b[38;2;${tr};${tg};${tb};48;2;${br};${bg};${bb}m▀${RESET}`;
			} else if (tc) {
				const [tr, tg, tb] = hexToRgb(tc);
				line += `\x1b[38;2;${tr};${tg};${tb}m▀${RESET}`;
			} else if (bc) {
				const [br, bg, bb] = hexToRgb(bc);
				line += `\x1b[38;2;${br};${bg};${bb}m▄${RESET}`;
			}
		}
		lines.push(line);
	}
	return lines;
}
