#!/usr/bin/env bash
#
# Guardrail: Check for port exhaustion (TIME_WAIT sockets)
#
# Usage: ./scripts/check-port-exhaustion.sh
#
# Exit codes:
#   0 - Healthy (TIME_WAIT < 5000)
#   1 - Warning/Alert (TIME_WAIT >= 5000)
#

set -uo pipefail

# Get TIME_WAIT count to port 3000
TW=$(ss -ant state time-wait 2>/dev/null | grep ":3000" | wc -l | tr -d ' ')

# Get ESTABLISHED count to port 3000
EST=$(ss -ant state established 2>/dev/null | grep ":3000" | wc -l | tr -d ' ')

# Get port range
PORT_RANGE=$(cat /proc/sys/net/ipv4/ip_local_port_range 2>/dev/null | tr '\t' '-')

echo "=== Port Health Check ==="
echo "TIME_WAIT :3000    = $TW"
echo "ESTABLISHED :3000  = $EST"
echo "Port range         = $PORT_RANGE"
echo ""

if [ "$TW" -gt 10000 ]; then
  echo "❌ CRITICAL: TIME_WAIT extremely high ($TW) - port exhaustion imminent!"
  echo "   Fix: Apply sysctl tuning + keep-alive agents"
  exit 1
elif [ "$TW" -gt 5000 ]; then
  echo "⚠️  WARNING: TIME_WAIT elevated ($TW) - monitor closely"
  exit 1
else
  echo "✅ Port health OK (TIME_WAIT < 5000)"
  exit 0
fi
