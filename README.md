# pi-gacha

A gamified coding-agent harness. Real agentic coding (forked from
[pi](https://github.com/earendil-works/pi)) with gacha / idle / RPG mechanics layered on top: you are the **Commander**, your
active **Character** does the coding and talks back in-character, and XP, tokens,
efficiency, currency, and affinity all climb as you work.

## Status

MVP complete. See `.claude/plans/` for the design and milestone plan.

- ✅ M0 scaffold & pi-on-DeepSeek · ✅ M1 pure game core · ✅ M2 telemetry · ✅ M3 HUD
- ✅ M4 persona/mood · ✅ M5 gacha & commands · ✅ M6 idle/upgrades · ✅ M7 ANSI portraits

57 unit tests, clean typecheck. Verified live on DeepSeek: real coding, persona voices
gacha pull, live HUD, idle accrual, and persistence.

## Architecture

- `vendor/pi/` — pi, vendored as a git submodule (built with its own toolchain,
  unmodified). The launcher runs this; the game rides pi's extension API.
- `packages/pi-gacha/` — the game, as a pi package.
  - `src/` — pure, pi-agnostic game logic (XP, economy, gacha, idle, characters). Unit-tested.
  - `extensions/index.ts` — the only file that imports pi; adapts pi events/UI onto `src/`.
  - `themes/` — the Frontline color theme.
- `bin/pi-gacha` — launcher: vendored pi + pi-gacha extension + DeepSeek defaults.

## Setup

Fresh clone? Run the setup script — it fetches the pi submodule, builds it, and
installs dev deps:

```bash
./setup.sh                                          # or: pnpm run setup
./bin/pi-gacha --model deepseek/deepseek-v4-flash   # launch (see Model / provider)
./bin/pi-gacha "add a hello() to main.ts"           # or with an initial task
```

Prerequisites: `git`, plus `node` and `pnpm` at the versions pinned in
[`.tool-versions`](.tool-versions) (node 24). With [mise](https://mise.jdx.dev)
or [asdf](https://asdf-vm.com): `mise install` (or `asdf install`) sets both up.

<details>
<summary>What the script does (to run the steps by hand)</summary>

```bash
git submodule update --init                 # fetch vendored pi
pnpm pi:build                               # cd vendor/pi && npm install && npm run build
pnpm install                                # pi-gacha dev deps (vitest, ts)
```

The one step a fresh clone usually misses: **pi is a separate monorepo with its
own toolchain** and must have its deps installed (`npm install` inside
`vendor/pi`) before it can build — otherwise the build fails with
`tsgo: command not found`. `pnpm pi:build` now does this for you.
</details>

## Model / provider

pi-gacha assumes nothing about your model or provider — that's pi's domain.
`./bin/pi-gacha` just launches pi with the game extension and passes your
arguments through. Choose a model with `--model provider/id` or the interactive
`/model` picker (pi remembers your default), and supply the provider's key the
way pi expects (`export DEEPSEEK_API_KEY=…`, `--api-key`, or `/login`).

- **Built-in providers** (`deepseek`, `openai`, `anthropic`, …) work by name,
  no setup: `./bin/pi-gacha --model deepseek/deepseek-v4-flash`.
- **Local / other servers** come from pi, not pi-gacha — either an installed
  package (`pi install npm:pi-lmstudio` → `--model lmstudio/<id>`) or a
  `~/.pi/agent/models.json` entry for any OpenAI-compatible endpoint (Ollama,
  vLLM, LM Studio, proxies). See pi's model docs.

## Develop

```bash
pnpm test        # vitest over packages/pi-gacha/src
pnpm typecheck
```
