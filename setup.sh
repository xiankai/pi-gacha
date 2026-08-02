#!/usr/bin/env bash
#
# setup.sh — one-shot setup for a fresh pi-gacha clone.
#
# Fetches the vendored pi submodule, builds it with its own toolchain, and
# installs pi-gacha's dev dependencies. Safe to re-run: the pi build is
# skipped if it's already present (use --force to rebuild).
#
# Usage:
#   ./setup.sh            # set up (skip pi build if already built)
#   ./setup.sh --force    # force a clean rebuild of vendored pi
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

FORCE=0
[[ "${1:-}" == "--force" ]] && FORCE=1

say()  { printf '\n\033[1;36m==>\033[0m %s\n' "$1"; }
die()  { printf '\n\033[1;31mError:\033[0m %s\n' "$1" >&2; exit 1; }

PI_CLI="$ROOT/vendor/pi/packages/coding-agent/dist/cli.js"

# --- prerequisites ---------------------------------------------------------
# Node and pnpm versions are pinned in .tool-versions (asdf / mise). If you use
# one of those, run `mise install` (or `asdf install`) first.
command -v git  >/dev/null || die "git is required but not found."
command -v node >/dev/null || die "node (24, per .tool-versions) is required but not found."
command -v npm  >/dev/null || die "npm is required but not found (ships with node)."
command -v pnpm >/dev/null || die "pnpm is required but not found. Install it: https://pnpm.io/installation"

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[[ "$NODE_MAJOR" -ge 24 ]] || die "node 24+ required (see .tool-versions); found $(node -v)."

# --- 1. vendored pi submodule ---------------------------------------------
say "Fetching vendored pi (git submodule)"
git submodule update --init

# --- 2. build vendored pi --------------------------------------------------
# pi is a separate monorepo with its OWN toolchain (npm + tsgo). It must have
# its deps installed before it can build — this is the step a fresh clone
# most often misses.
if [[ "$FORCE" -eq 1 || ! -f "$PI_CLI" ]]; then
	say "Building vendored pi (npm install + npm run build inside vendor/pi)"
	( cd vendor/pi && npm install && npm run build )
else
	say "Vendored pi already built — skipping (use ./setup.sh --force to rebuild)"
fi
[[ -f "$PI_CLI" ]] || die "pi build did not produce $PI_CLI"

# --- 3. pi-gacha dev deps --------------------------------------------------
say "Installing pi-gacha dev dependencies (pnpm)"
pnpm install

# --- done ------------------------------------------------------------------
say "Setup complete."
cat <<'EOF'

Next steps:
  ./bin/pi-gacha [task]        # launches pi + the game; pick a model with /model
                               # (pi remembers it) or pass --model provider/id
  # Provide the provider's key the way pi expects (e.g. export DEEPSEEK_API_KEY,
  # or /login). See the README's "Model / provider" section.

Dev:
  pnpm test        # vitest over packages/pi-gacha
  pnpm typecheck
EOF
