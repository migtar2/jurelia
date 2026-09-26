#!/bin/bash
# VPS Cron: Call alert execution endpoint every hour
# Add to crontab: 0 * * * * /path/to/cron-alerts.sh
#
# Install:
#   chmod +x /opt/cendoj/cron-alerts.sh
#   crontab -e
#   0 * * * * /opt/cendoj/cron-alerts.sh >> /var/log/cendoj-alerts.log 2>&1

set -euo pipefail

ENDPOINT="${ALERT_ENDPOINT:-https://cendoj-poc.vercel.app/api/alerts/execute}"
CRON_SECRET="${CRON_SECRET:?Set CRON_SECRET env var}"

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "$ENDPOINT" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  --max-time 300)

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "[$(date -Iseconds)] HTTP $HTTP_CODE — $BODY"

if [ "$HTTP_CODE" -ne 200 ]; then
  echo "ERROR: Alert execution failed with HTTP $HTTP_CODE" >&2
  exit 1
fi