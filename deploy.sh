#!/bin/bash
# Plesk post-deployment script. In Plesk > Git > "Post deployment actions" enter:
#   bash deploy.sh
set -e
cd "$(dirname "$0")"

# Plesk's deploy shell defaults to an old system Node. Use a bundled Node 20+ instead:
# prefer 22, then 20, then the newest other version that is at least 20.
PLESK_NODE_ROOT=${PLESK_NODE_ROOT:-/opt/plesk/node}
pick_node() {
  for v in 22 20; do
    [ -x "$PLESK_NODE_ROOT/$v/bin/node" ] && { echo "$PLESK_NODE_ROOT/$v/bin"; return; }
  done
  for d in $(ls -d "$PLESK_NODE_ROOT"/*/bin 2>/dev/null | sort -V -r); do
    [ "$(basename "$(dirname "$d")" | cut -d. -f1)" -ge 20 ] 2>/dev/null && { echo "$d"; return; }
  done
}
NODE_BIN=$(pick_node)
[ -n "$NODE_BIN" ] && export PATH="$NODE_BIN:$PATH"

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)
echo "Using Node $(node -v 2>/dev/null || echo 'not found')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "ERROR: Node 20 or newer is required (Playwright). Install Node 22 or 20 in Plesk (Tools & Settings > Updates, add Node.js)." >&2
  exit 1
fi

npm install --omit=dev
npx playwright install chromium   # cached after the first run
mkdir -p public/shots tmp
date -u +%Y-%m-%dT%H:%M:%SZ > .deployed-at   # shown by /health
touch tmp/restart.txt             # Passenger restarts the app
echo "Deploy finished"
