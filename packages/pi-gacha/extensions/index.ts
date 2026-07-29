/**
 * Frontline — a gamified coding-agent layer for pi.
 *
 * This extension is the ONLY module that touches pi's API. All game logic lives
 * in ../src/* as pure, pi-agnostic, unit-tested functions; this file adapts pi's
 * events/UI onto that logic.
 *
 * M2 telemetry + persistence · M3 HUD (live footer + character widget + toasts).
 * Personas/mood (M4) and gacha UI (M5) build on top.
 */

import {
	type ExtensionAPI,
	type ExtensionContext,
	isToolCallEventType,
} from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";
import {
	ACHIEVEMENTS,
	applyCheckIn,
	applyIdle,
	applyPull,
	applySwitch,
	applyTurn,
	applyUpgrade,
	buildPersona,
	deriveMood,
	CHARACTERS,
	type Effect,
	GACHA,
	type GameState,
	progress,
	type Rarity,
	UPGRADES,
	type UpgradeId,
	upgradeCost,
	type VoiceKey,
} from "../src/index.ts";
import { newSessionStats, renderCharacter, renderFooter, type SessionStats } from "./hud.ts";
import { loadState, saveState } from "./save.ts";
import { isTestFilePath, turnActivity } from "./telemetry.ts";
import { showGachaReveal } from "./gacha-reveal.ts";
import { applyCustomCharacters } from "./load-characters.ts";

const VERSION = "0.1.0";

export default function piGacha(pi: ExtensionAPI) {
	let state: GameState | null = null;
	let session: SessionStats = newSessionStats();
	let currentLine = "";
	let turnStartedAt = 0;
	let modelId = "";
	let hudTui: TUI | null = null;
	/** toolCallId -> bash command, captured for test-pass detection. */
	const bashCommands = new Map<string, string>();
	/** Test files edited/written this session — only their test runs count. */
	const modifiedTestFiles = new Set<string>();
	/** Session-scoped mood signal. */
	let successStreak = 0;
	/** Pull log for the current session. */
	const pullLog: { rarity: Rarity; characterId: string | null; dupe: boolean; refund: number; }[] = [];
	let errorStreak = 0;

	const now = () => Date.now();
	const refresh = () => hudTui?.requestRender();

	/** Pick a voice line for a situation, substituting {level}. */
	function voice(key: VoiceKey): string {
		const character = state?.activeCharacterId ? CHARACTERS[state.activeCharacterId] : undefined;
		const lines = character?.voiceLines[key] ?? [];
		if (lines.length === 0) return "";
		const pick = lines[Math.floor(Math.random() * lines.length)];
		return pick.replace("{level}", String(state?.level ?? 1));
	}

	/** Surface reducer effects as toasts (persistent milestones only). */
	function surface(ctx: ExtensionContext, effects: Effect[]) {
		if (!ctx.hasUI) return;
		for (const e of effects) {
			switch (e.type) {
				case "level_up":
					ctx.ui.notify(`⭐ Level ${e.level}! +${e.coresAwarded} Cores, Commander.`, "info");
					break;
				case "achievement":
					ctx.ui.notify(`🏅 Achievement unlocked: ${e.name}${e.cores > 0 ? ` (+${e.cores} Cores)` : ""}`, "info");
					break;
				case "idle_reward":
					ctx.ui.notify(`💤 +${e.amount} Cores accrued while away (${e.hours.toFixed(1)}h).`, "info");
					break;
				case "pull": {
					pullLog.push({ rarity: e.rarity, characterId: e.characterId, dupe: e.dupe, refund: e.refund });
					const name = e.characterId ? CHARACTERS[e.characterId]?.name : null;
					const label = name
						? `${name} joins the roster!`
						: e.dupe
							? `dupe, +${e.refund} Cores`
							: `no ${e.rarity}★ in pool — +${e.refund} Cores`;
					ctx.ui.notify(`✦ ${"★".repeat(e.rarity)} ${label}`, "info");
					break;
				}
				case "check_in":
					ctx.ui.notify(`📅 Check-in x${e.streak}! +${e.cores} Cores, Commander.`, "info");
					break;
				case "notify":
					ctx.ui.notify(e.message, "info");
					break;
				// "cores" is reflected live in the footer; no toast per turn.
			}
		}
	}

	/** Install the footer + character widget. Render closures read live state. */
	function installHud(ctx: ExtensionContext) {
		if (!ctx.hasUI) return;
		modelId = ctx.model?.id ?? modelId;

		ctx.ui.setFooter((tui, theme, footerData) => {
			hudTui = tui;
			return {
				invalidate() {},
				render(width: number) {
					if (!state) return [];
					return renderFooter(state, session, modelId, footerData.getGitBranch(), theme, width);
				},
			};
		});

		ctx.ui.setWidget("pi-gacha-character", (tui, theme) => {
			hudTui = tui;
			return {
				invalidate() {},
				render() {
					if (!state) return [];
					return renderCharacter(state, currentLine, theme);
				},
			};
		});
	}

	pi.on("session_start", (_event, ctx) => {
		applyCustomCharacters(ctx.cwd);
		state = loadState(now());
		session = newSessionStats();
		successStreak = 0;
		errorStreak = 0;
		modifiedTestFiles.clear();

		// Daily check-in (before idle so both sets of effects surface).
		const checkInResult = applyCheckIn(state, now());
		state = checkInResult.state;
		const idleResult = applyIdle(state, now());
		state = idleResult.state;
		saveState(state);

		const gotIdle = idleResult.effects.some((e) => e.type === "idle_reward");
		const gotCheckIn = checkInResult.effects.some((e) => e.type === "check_in");
		currentLine = voice(gotIdle ? "idle" : gotCheckIn ? "greet" : "greet");

		if (ctx.hasUI) {
			installHud(ctx);
			// Surface check-in effects first, then idle effects.
			surface(ctx, [...checkInResult.effects, ...idleResult.effects]);
			refresh();
		}
	});

	// Inject the active character's persona (+ affinity/mood flavor) each turn.
	pi.on("before_agent_start", (event) => {
		if (!state?.activeCharacterId) return;
		const affinity = state.characters[state.activeCharacterId]?.affinity ?? 0;
		const persona = buildPersona(state.activeCharacterId, affinity, deriveMood(successStreak, errorStreak));
		if (!persona) return;
		return { systemPrompt: `${event.systemPrompt}\n\n${persona}` };
	});

	pi.on("tool_call", (event) => {
		if (isToolCallEventType("bash", event)) {
			bashCommands.set(event.toolCallId, event.input.command);
		} else if (
			isToolCallEventType("edit", event) ||
			isToolCallEventType("write", event)
		) {
			if (isTestFilePath(event.input.path)) {
				modifiedTestFiles.add(event.input.path);
			}
		}
	});

	pi.on("turn_start", () => {
		turnStartedAt = now();
		currentLine = voice("thinking");
		refresh();
	});

	pi.on("turn_end", (event, ctx) => {
		if (!state) return;
		const activity = turnActivity(event.message, event.toolResults, bashCommands);
		bashCommands.clear();

		// Only award test-pass XP/Cores for novel test files (M7 rule).
		if (activity.testsPassed > 0 && modifiedTestFiles.size === 0) {
			activity.testsPassed = 0;
		}

		// Session HUD counters + tk/s for this turn.
		session.tokensIn += activity.tokensIn;
		session.tokensOut += activity.tokensOut;
		session.cost += activity.cost;
		session.edits += activity.edits;
		const elapsedMs = Math.max(1, now() - turnStartedAt);
		session.lastTps = activity.tokensOut / (elapsedMs / 1000);

		const hadError = (event.toolResults ?? []).some((r) => r.isError);
		if (hadError) {
			errorStreak += 1;
			successStreak = 0;
		} else {
			successStreak += 1;
			errorStreak = 0;
		}
		currentLine = voice(hadError ? "error" : "success");

		const result = applyTurn(state, activity);
		state = result.state;
		saveState(state);
		surface(ctx, result.effects);
		refresh();
	});

	pi.on("session_shutdown", () => {
		if (!state) return;
		state.lastPlayedAt = now();
		saveState(state);
	});

	/** Persist + surface effects + repaint after a command mutates state. */
	function commit(ctx: ExtensionContext, result: { state: GameState; effects: Effect[] }) {
		state = result.state;
		saveState(state);
		surface(ctx, result.effects);
		refresh();
	}

	function showStats(ctx: ExtensionContext) {
		if (!state) {
			ctx.ui.notify(`Frontline v${VERSION} — no save loaded yet.`, "info");
			return;
		}
		const p = progress(state.level, state.xp);
		const character = state.activeCharacterId ? CHARACTERS[state.activeCharacterId] : undefined;
		ctx.ui.notify(
			`▲ ${character?.name ?? "No Character"} · Lv.${state.level} (${p.xp}/${p.xpToNext} XP) · ` +
				`⬡${state.cores} Cores · ${Object.keys(state.characters).length}/${Object.keys(CHARACTERS).length} Characters · ` +
				`${state.achievements.length} achievements · pity ${state.pity}/${GACHA.pity5}`,
			"info",
		);
	}
	pi.registerCommand("stats", {
		description: "Show Frontline status (level, Cores, roster, achievements)",
		handler: async (_args, ctx) => showStats(ctx),
	});
	pi.registerCommand("pi-gacha", {
		description: "Alias for /stats",
		handler: async (_args, ctx) => showStats(ctx),
	});

	pi.registerCommand("characters", {
		description: "List your roster and deploy a Character",
		handler: async (_args, ctx) => {
			if (!state) return;
			const s = state;
			const owned = Object.keys(s.characters);
			const labels = owned.map((id) => {
				const d = CHARACTERS[id];
				const active = id === s.activeCharacterId ? " ✓ deployed" : "";
				return `${d.name} — ${d.klass} ${"★".repeat(d.rarity)} · ♥${s.characters[id].affinity}${active}`;
			});
			const choice = await ctx.ui.select("Deploy which Character, Commander?", labels);
			if (choice === undefined) return;
			const id = owned[labels.indexOf(choice)];
			if (id) commit(ctx, applySwitch(s, id));
		},
	});

	pi.registerCommand("switch", {
		description: "Deploy a Character by name (e.g. /switch sentinel)",
		getArgumentCompletions: (prefix: string) =>
			Object.values(CHARACTERS)
				.filter((d) => state?.characters[d.id] && d.name.toLowerCase().startsWith(prefix.toLowerCase()))
				.map((d) => ({ value: d.id, label: d.name, description: d.klass })),
		handler: async (args, ctx) => {
			if (!state) return;
			const q = args.trim().toLowerCase();
			const id = Object.keys(CHARACTERS).find((k) => k === q || CHARACTERS[k].name.toLowerCase() === q);
			if (!id) {
				ctx.ui.notify(`Unknown Character: "${args.trim()}". Try /characters.`, "warning");
				return;
			}
			commit(ctx, applySwitch(state, id));
		},
	});

	pi.registerCommand("gacha", {
		description: `Recruit a Character (${GACHA.pullCost} Cores)`,
		handler: async (_args, ctx) => {
			if (!state) return;
			const result = applyPull(state, Math.random, now());
			state = result.state;
			saveState(state);

			// Find the pull effect for display info
			const pullEffect = result.effects.find((e) => e.type === "pull");
			const otherEffects = result.effects.filter((e) => e.type !== "pull");

			// Surface non-pull effects (level ups, achievements, etc.)
			surface(ctx, otherEffects);

			// Show the flashy reveal overlay
			if (pullEffect && ctx.hasUI) {
				await showGachaReveal(ctx, pullEffect.rarity, pullEffect.characterId ?? "", !pullEffect.dupe, pullEffect.refund);
			}

			refresh();
		},
	});

	pi.registerCommand("upgrades", {
		description: "View and buy upgrades with Cores",
		handler: async (_args, ctx) => {
			if (!state) return;
			const s = state;
			const ids = Object.keys(UPGRADES) as UpgradeId[];
			const labels = ids.map((id) => {
				const def = UPGRADES[id];
				const lvl = s.upgrades[id] ?? 0;
				const cost = upgradeCost(id, lvl);
				const price = cost === null ? "MAX" : `${cost} Cores`;
				return `${def.name} [Lv.${lvl}/${def.maxLevel}] — ${def.description} (${price})`;
			});
			const choice = await ctx.ui.select(`Cores: ⬡${s.cores}. Buy which upgrade?`, labels);
			if (choice === undefined) return;
			const id = ids[labels.indexOf(choice)];
			if (id) commit(ctx, applyUpgrade(s, id));
		},
	});

	pi.registerCommand("achievements", {
		description: "List achievements",
		handler: async (_args, ctx) => {
			if (!state) return;
			const have = new Set(state.achievements);
			const lines = ACHIEVEMENTS.map(
				(a) => `${have.has(a.id) ? "🏅" : "🔒"} ${a.name} — ${a.description}`,
			);
			ctx.ui.notify(
				`Achievements ${have.size}/${ACHIEVEMENTS.length}\n${lines.join("\n")}`,
				"info",
			);
		},
	});

	pi.registerCommand("pulls", {
		description: "Show gacha pull history this session",
		handler: async (_args, ctx) => {
			if (pullLog.length === 0) {
				ctx.ui.notify("No pulls recorded this session, Commander.", "info");
				return;
			}
			const lines = pullLog.map(
				(p, i) =>
					`${i + 1}. ${p.characterId ? CHARACTERS[p.characterId]?.name ?? p.characterId : "(refund)"} ${"★".repeat(p.rarity)}` +
					(p.dupe ? " (dupe)" : "") +
					(p.refund > 0 ? ` +${p.refund} Cores` : ""),
			);
			ctx.ui.notify(`Pull history (${pullLog.length}):\n${lines.join("\n")}`, "info");
		},
	});
}
