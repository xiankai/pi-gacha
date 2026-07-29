# AGENTS.md — working on pi-gacha

This repo is a gamified coding-agent harness: **pi** (vendored) + a game layer
shipped as a **pi package**. Read `.claude/plans/*.md` for the full design.

## Ground rules

- **Never edit `vendor/pi/`.** It is an unmodified git submodule. If pi truly
  lacks a hook we need, discuss patching before touching it — the goal is to
  stay upgradeable with upstream. Everything we build lives in `packages/pi-gacha/`.
- **Keep game logic pure.** `packages/pi-gacha/src/*` must not import
  `@earendil-works/pi-*` or Node/pi runtime state. It takes plain inputs and
  returns plain data so it's unit-testable without pi. Only
  `extensions/index.ts` touches pi.
- pi loads the extension via **jiti** and aliases `@earendil-works/pi-coding-agent`,
  `-pi-tui`, `-pi-ai`, `-pi-agent-core`, and `typebox` to the running pi. So the
  extension imports those as bare specifiers with **no install needed**; use
  `import type` where possible.

## Key pi APIs (see vendor/pi/packages/coding-agent/docs/extensions.md)

- Telemetry: `pi.on("message_end")` → `event.message.usage` (`.input`, `.output`,
  `.cost.total`) for assistant messages; `tool_execution_end` → `event.result`,
  `event.isError`; `turn_end`. Live totals can also be summed from
  `ctx.sessionManager.getBranch()`.
- HUD: `ctx.ui.setFooter((tui, theme, footerData) => ({ render(width): string[], invalidate(){} }))`.
- Character widget: `ctx.ui.setWidget(key, (tui, theme) => Component, { placement })`.
- Toasts: `ctx.ui.notify(msg, "info" | "warning" | "error")`.
- Dialogs: `ctx.ui.select`, `confirm`, `input`. Full-screen: `ctx.ui.custom(...)`.
- Persona: `pi.on("before_agent_start")` → return `{ systemPrompt: event.systemPrompt + persona }`.
- Persistence: game save is global at `~/.pi/agent/pi-gacha/save.json`; restore
  on `session_start`, write on `session_shutdown`.
- TUI text: `theme.fg("accent"|"success"|"error"|"warning"|"muted"|"dim", s)`,
  `theme.bold(s)`. `Text` renders strings verbatim, so raw ANSI (24-bit) is fine
  for detailed character portraits.

## Commands

- `pnpm test` / `pnpm typecheck` — game core.
- `pnpm pi:build` — (re)build vendored pi.
- `./bin/pi-gacha [prompt]` — run the harness (needs `DEEPSEEK_API_KEY`).

## Gotchas

- **`pi-crew` is pinned to `0.9.51` in `~/.pi/agent/settings.json`
  (`npm:pi-crew@0.9.51`) and `~/.pi/agent/npm/package.json`.** pi-gacha runs on
  DeepSeek, and pi-crew's globally-loaded `team` tool regressed in `0.9.52` (the
  "API-5 facade split" made its params a top-level `Type.Union` → JSON Schema
  `anyOf` with no `type`). DeepSeek's function validator rejects that with a 400
  on *every* message: `Invalid schema for function 'team': ... got 'type: null'`.
  `0.9.51` is the last version whose `team` schema is a flat `Type.Object`.
  Un-pin once a version >0.9.55 restores an object-typed `team` schema:
  set the source back to `npm:pi-crew` and run
  `node vendor/pi/packages/coding-agent/dist/cli.js update pi-crew`.
