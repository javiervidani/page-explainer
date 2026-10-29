#!/bin/bash
# Waits until the server reports the expected version, i.e. the latest push is live.
#   bash scripts/check-deploy.sh https://pagelens.datashellv.com            (expects package.json version)
#   bash scripts/check-deploy.sh https://pagelens.datashellv.com 1.2.0
URL=${1:?usage: check-deploy.sh <base-url> [version]}
cd "$(dirname "$0")/.."
WANT=${2:-$(node -p "require('./package.json').version")}
for i in $(seq 1 ${CHECK_TRIES:-30}); do
  OUT=$(curl -fsS -m 10 "$URL/health" 2>/dev/null) || OUT=""
  GOT=$(echo "$OUT" | node -pe 'try{JSON.parse(require("fs").readFileSync(0)).version}catch{""}')
  if [ "$GOT" = "$WANT" ]; then echo "OK: server runs $WANT"; echo "$OUT"; exit 0; fi
  echo "waiting... server reports '${GOT:-no answer}', want $WANT"; sleep 10
done
echo "FAILED: server did not reach $WANT"; exit 1
