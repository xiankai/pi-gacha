# ⬡ Frontline — a gamified coding-agent layer for pi

[![npm](https://img.shields.io/npm/v/@pi-gacha/pi-gacha)](https://www.npmjs.com/package/@pi-gacha/pi-gacha)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

Frontline turns your pi coding sessions into a light RPG. Code to earn XP and Cores, pull for new characters from the gacha, deploy them to shape your system prompt, and watch your live HUD track your session.

## ✨ Features

- **characters** — Deployable companions with distinct personas, voice lines, and ANSI portraits
- **XP & Levels** — Earn XP from output tokens, tool calls, edits, and passing tests
- **Cores** — Currency earned as you code, awarded on level-up, and accrued while idle
- **Gacha** — Spend 300 Cores to recruit a new character (5★: gold, 4★: purple, 3★: blue)
- **Live HUD** — Footer bar with level, XP bar, Cores, tokens, and a character widget with portrait
- **Mood System** — character voice lines shift based on your success/error streak
- **Check-in** — Daily login bonus with streak rewards
- **Achievements** — Milestones for firsts, milestones, and mastery
- **Upgrades** — Spend Cores on permanent bonuses (Overclock, Neural Boost, Idle Array)
- **Customizable** — Swap in your own characters, portraits, and voice lines with a JSON file

## 📦 Install

```bash
# From npm (requires pi 0.74+)
pi install npm:@pi-gacha/pi-gacha

# Or direct from GitHub
pi install git:github.com/xiankai/pi-gacha
```

Try without installing permanently:
```bash
pi -e npm:@pi-gacha/pi-gacha
```

## 🚀 Commands

| Command | Description |
|---|---|
| `/pi-gacha` or `/stats` | Show your level, Cores, roster and achievements |
| `/characters` | List your roster and deploy a character interactively |
| `/switch <name>` | Deploy a character by name (e.g. `/switch sentinel`) |
| `/gacha` | Spend 300 Cores to recruit a character |
| `/pulls` | Show your gacha pull history this session |
| `/upgrades` | View and buy permanent upgrades with Cores |
| `/achievements` | List all achievements and progress |

## 🎮 How it works

Frontline hooks into pi's lifecycle events (`turn_end`, `tool_call`, `session_start`) to track your activity. Game logic is pure and unit-tested in `src/`; the pi wiring lives in `extensions/`.

### Earning

| Action | XP | Cores |
|---|---|---|
| Output tokens | 1 per 50 tokens | 1 per 100 tokens |
| Tool calls | 5 per call | 1 per success |
| Edits (write/edit) | 10 per edit | — |
| Tests passed | 50 per test | 10 per test |
| Level up | — | 50 |
| Check-in (daily) | — | 10 + streak |
| Idle (away time) | — | 30/hr (cap 480) |

### Gacha rates

| Rarity | Rate | Color |
|---|---|---|
| 3★ | 75% | Blue |
| 4★ | 20% | Purple |
| 5★ | 5% | Gold |
| 5★ pity | Guaranteed at 50 pulls | — |

### Upgrades

| Upgrade | Effect | Max | Cost/level |
|---|---|---|---|
| Overclock | +10% Cores earned | 5 | 200 × (level + 1) |
| Idle Array | +50% passive rate | 5 | 300 × (level + 1) |

## 🎨 Custom Content

Frontline's built-in characters are original archetypes. You can replace or extend them
with your own characters — no code changes needed.

### Custom character file format

Place a `characters.json` in either:

| Scope | Path |
|---|---|
| **Global** | `~/.pi/agent/pi-gacha/characters.json` |
| **Project** | `.pi/pi-gacha/characters.json` (takes priority) |

The file is a JSON object keyed by character ID, following the `characterDef` shape:

```json
{
  "my_operator": {
    "id": "my_operator",
    "name": "My Operator",
    "rarity": 5,
    "klass": "Sniper",
    "blurb": "A short flavor description.",
    "palette": { "primary": "#c0392b", "secondary": "#2c3e50", "accent": "#e74c3c" },
    "persona": "You are My Operator... Address the user as 'Commander'. Keep remarks brief.",
    "voiceLines": {
      "greet": ["Ready, Commander."],
      "thinking": ["Analyzing."],
      "success": ["Done."],
      "error": ["Adjusting."],
      "levelup": ["Level {level}."],
      "gacha": ["A new arrival."],
      "idle": ["Awaiting orders."]
    },
    "portrait": ["[ My Operator ]", "  ~sniper~"],
    "portraitGrid": [
      "  HHHHHHHH  ",
      " HHHHHHHHHH ",
      " HHSSSSSSHH ",
      " HHSEESEESH ",
      " HHSSSSSSHH ",
      "  HSSSSSSH  ",
      "  CCCCCCCC  ",
      " CCCCCCCCCC "
    ]
  }
}
```

A character with the same `id` as a built-in character fully replaces it; a new `id` is added
to the pool. The `portraitGrid` is an optional 12×8 pixel-role grid:

| Char | Meaning |
|---|---|
| `space` | Transparent |
| `H` | Hair (uses `palette.primary`) |
| `S` | Skin |
| `E` | Eye (uses `palette.accent`) |
| `C` | Cloth (uses `palette.secondary`) |
| `A` | Accent (uses `palette.accent`) |

Reload pi (`/reload`) or start a new session to pick up the changes.
## 🧩 Package structure

```
extensions/
├── index.ts          ← Pi entry point (lifecycle, commands, HUD)
├── gacha-reveal.ts   ← Full TUI gacha animation overlay
├── hud.ts            ← Footer & character widget renderers
├── save.ts           ← Filesystem persistence (~/.pi/agent/pi-gacha/save.json)
└── telemetry.ts      ← Turn activity extraction

src/                  ← Pure game core (no pi imports)
├── config.ts         ← All balance constants (single-file tuning)
├── reducer.ts        ← State machine (applyPull, applyTurn, etc.)
├── gacha.ts          ← RNG-based gacha rolls
├── idle.ts           ← Idle reward calculation
├── xp.ts             ← XP math
├── economy.ts        ← Economy calculations
├── persona.ts        ← System prompt generation
├── portrait.ts       ← ANSI half-block portraits
├── achievements.ts   ← Achievement definitions
├── state.ts / types.ts
└── characters/
    └── registry.ts   ← character definitions (name, rarity, class, palette, voice lines)

themes/
└── pi-gacha-default.json
```

## 🏗️ Development

```bash
# Clone & install
git clone https://github.com/xiankai/pi-gacha
cd pi-gacha
pnpm install

# Run tests
pnpm test              # 63+ tests across 10 suites
pnpm typecheck         # TypeScript checks

# Run locally (from repo root)
./bin/pi-gacha
```

## 📄 License

MIT. See [LICENSE](./LICENSE).
