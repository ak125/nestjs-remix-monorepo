#!/bin/sh
# ðŸš€ SCRIPT DE DÃ‰MARRAGE WORKER
# Lance Supercronic + BullMQ Worker en parallÃ¨le

set -e

echo "ðŸ”§ Starting Worker Container..."
echo "ðŸ“… Supercronic crontab: /app/crontab"
echo "ðŸ”„ BullMQ worker concurrency: ${WORKER_CONCURRENCY}"

# DÃ©marrer le worker NestJS en arriÃ¨re-plan
echo "ðŸš€ Starting BullMQ Worker..."
node /app/backend/dist/workers/main.js &
WORKER_PID=$!

# Attendre que le worker soit prÃªt
sleep 3

# DÃ©marrer Supercronic en premier plan
echo "ðŸ“… Starting Supercronic..."
exec supercronic /app/crontab

# Si Supercronic crash, tuer le worker
trap "kill $WORKER_PID" EXIT
