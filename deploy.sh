#!/bin/bash
set -e

HOST="hedachi@hedachimacmini"
DIR="/Users/hedachi/banano-web"

echo "Deploying banano to Mac mini..."
ssh "$HOST" "bash -l -c 'cd $DIR && git pull && npm install --omit=dev && pm2 restart banano'"
echo "Done."
