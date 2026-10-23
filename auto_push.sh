#!/bin/bash
# Watch this repo and auto-commit/push on any change.
# Usage: ./auto_push.sh   (Ctrl+C to stop)

set -u
cd "$(dirname "$0")"

if ! command -v fswatch >/dev/null 2>&1; then
  echo "fswatch not found. Install with: brew install fswatch" >&2
  exit 1
fi

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

sync_once() {
  # exFAT drives spawn AppleDouble junk files (._*) on every write; strip them
  # before staging so they never get committed and never re-trigger the watch.
  find . -name '._*' -not -path './.git/*' -delete 2>/dev/null

  git add -A

  if git diff --cached --quiet; then
    return
  fi

  git commit -m "auto: $(date '+%Y-%m-%d %H:%M:%S')" >/dev/null
  log "committed $(git log -1 --format=%h)"

  if git push origin HEAD 2>/tmp/auto_push_err.log; then
    log "pushed to GitHub"
  else
    log "push failed, will retry on next change:"
    cat /tmp/auto_push_err.log >&2
  fi
}

log "watching $(pwd) — Ctrl+C to stop"
sync_once

fswatch -o -r \
  --exclude '\.git/' \
  --exclude '\._' \
  --latency 3 \
  . | while read -r _; do
    sync_once
  done
