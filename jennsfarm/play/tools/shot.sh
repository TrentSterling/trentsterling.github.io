#!/usr/bin/env bash
# Jenn's Farm — automated screenshot / test runner (PC2 / Git Bash).
#
# Serves play/ over http (ES modules need http, not file://), screenshots a
# page headless, and ALWAYS kills leftover headless Chromes (they hog the rig).
#
# Usage:
#   ./tools/shot.sh "<path?query>" <out.png> [budget_ms]
# Examples:
#   ./tools/shot.sh "tests/suite.html" suite.png 13000
#   ./tools/shot.sh "index.html?noon&camx=24&camz=24&camh=34&camd=2&campitch=-1.3" topdown.png
#
# Camera params (free cam for inspecting anywhere): camx,camz = world point to
# frame; camh = height; camd = distance back; campitch = radians (down ~ -0.7).
set -u

PLAY_DIR="B:/trontdev/site/jennsfarm/play"
SHOTS="/b/trontdev/_shots"
CHROME="/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"
PORT=8141
PATH_Q="${1:-index.html}"
OUT="${2:-shot.png}"
BUDGET="${3:-8000}"

mkdir -p "$SHOTS"

kill_headless() {
    # headless=new spawns child procs (gpu/renderer/zygote) that DON'T carry
    # --headless in their cmdline, so a filtered kill orphans them and they pile
    # up (40+ seen, crashed the rig). Trent browses with Firefox, so every
    # chrome.exe here is ours -> kill them ALL.
    powershell -NoProfile -Command "Get-Process chrome -ErrorAction SilentlyContinue | Stop-Process -Force" >/dev/null 2>&1 || true
}

# Pre-clean any stragglers
kill_headless

# Serve
python -m http.server "$PORT" --bind 127.0.0.1 --directory "$PLAY_DIR" >/tmp/jf_httpd.log 2>&1 &
SRV=$!
sleep 1.2

# Capture
"$CHROME" --headless=new --use-gl=swiftshader --enable-unsafe-swiftshader \
  --window-size=1280,800 --virtual-time-budget="$BUDGET" \
  --screenshot="$SHOTS/$OUT" "http://127.0.0.1:$PORT/$PATH_Q" >/dev/null 2>&1

# Cleanup: stop server + kill headless Chromes
kill "$SRV" >/dev/null 2>&1 || true
kill_headless

echo "shot -> $SHOTS/$OUT"
