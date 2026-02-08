#!/bin/bash
git commit -m "refactor(quality): Phase 3 - frontend console.log to centralized logger

Replace 1057 console.log/warn/error calls across 420 frontend files
with centralized logger utility that suppresses debug/log in production
while keeping warn/error always active.

- Add frontend/app/utils/logger.ts (env-aware logging wrapper)
- Replace console.log to logger.log in routes, services, hooks, components
- Replace console.warn to logger.warn, console.error to logger.error
- Zero active console.log remaining (12 in comments only)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"

echo "Commit done. Status:"
git log --oneline -1
git status --short | head -5
