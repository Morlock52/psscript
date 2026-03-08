#!/bin/zsh
set -euo pipefail

REPO_DIR="/Users/morlock/fun/02_PowerShell_Projects/psscript"
BRANCH="main"
STATE_DIR="$REPO_DIR/.git/autoupdate"
LOG_FILE="$HOME/Library/Logs/psscript-git-auto-update.log"
mkdir -p "$STATE_DIR" "$(dirname "$LOG_FILE")"

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" >> "$LOG_FILE"
}

notify() {
  /usr/bin/osascript -e "display notification \"$2\" with title \"PSScript Git Auto Update\" subtitle \"$1\"" >/dev/null 2>&1 || true
}

cd "$REPO_DIR"

current_branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
before_remote="$(git rev-parse --verify refs/remotes/origin/$BRANCH 2>/dev/null || echo missing)"

git fetch origin "$BRANCH" --quiet

after_remote="$(git rev-parse --verify refs/remotes/origin/$BRANCH 2>/dev/null || echo missing)"
local_head="$(git rev-parse HEAD 2>/dev/null || echo missing)"
status_output="$(git status --porcelain)"
state_file="$STATE_DIR/origin-${BRANCH}.sha"
last_seen="$(cat "$state_file" 2>/dev/null || echo missing)"

echo "$after_remote" > "$state_file"

if [[ "$after_remote" != "$last_seen" && "$after_remote" != "missing" ]]; then
  short_remote="${after_remote[1,7]}"
  notify "origin/$BRANCH changed" "New remote commit: $short_remote"
  log "origin/$BRANCH changed to $after_remote"
fi

if [[ "$current_branch" != "$BRANCH" ]]; then
  log "Skipping pull: current branch is $current_branch"
  exit 0
fi

if [[ -n "$status_output" ]]; then
  log "Skipping pull: worktree is not clean"
  exit 0
fi

if [[ "$local_head" != "$after_remote" ]]; then
  if git pull --ff-only origin "$BRANCH" --quiet; then
    new_head="$(git rev-parse HEAD)"
    short_head="${new_head[1,7]}"
    notify "Updated $BRANCH" "Fast-forwarded to $short_head"
    log "Fast-forwarded local $BRANCH to $new_head"
  else
    notify "Auto update failed" "git pull --ff-only did not succeed"
    log "git pull --ff-only failed"
    exit 1
  fi
else
  log "No update needed"
fi
