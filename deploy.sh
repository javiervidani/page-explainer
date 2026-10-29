#!/bin/bash
# Plesk post-deployment script. In Plesk > Git > "Post deployment actions" enter:
#   bash deploy.sh
set -e
cd "$(dirname "$0")"

# Plesk's deploy shell may not have Node on PATH: use the newest bundled version.
if ! command -v npm >/dev/null; then
  NODE_BIN=$(ls -d /opt/plesk/node/*/bin 2>/dev/null | sort -V | tail -1)
  export PATH="$NODE_BIN:$PATH"
fi

npm install --omit=dev
npx playwright install chromium   # cached after the first run
mkdir -p public/shots tmp
touch tmp/restart.txt             # Passenger restarts the app
echo "Deploy finished"
