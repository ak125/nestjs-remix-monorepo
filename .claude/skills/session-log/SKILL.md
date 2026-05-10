---
name: session-log
description: Append a 3-4 line curated entry to log.md at the monorepo root. Use when the current Claude Code session has produced commits or PRs and the user (or Stop hook) requests recording it. Format strict, no secrets, append-only. Trigger keywords - "log session", "/log-session", "record this work", or auto-suggested by Stop hook when git activity detected.
---

# session-log

## When to use

- Stop hook detected commits ahead of `main` on the current branch and asked Claude to record the session.
- User explicitly types `/log-session` or "log this session" or "record this work in log.md".
- Major work completed (feature merged, refactor shipped, incident resolved) and the user wants a permanent timeline trace.

## When NOT to use

- Read-only sessions (no commits, no PRs).
- Trivial single-line edits with no merge/PR.
- Internal session noise (debugging, exploration without artifact).
- Anything containing secrets, tokens, internal IPs, credentials.

## Strict format

Append exactly this block at the END of `/opt/automecanik/app/log.md`:

```markdown

## YYYY-MM-DD — sujet bref (max 60 chars)

- **Branche** : `<branch-name>`
- **Décision** : <1 phrase française, l'essentiel de ce qui a été tranché ou produit>
- **Sortie** : PRs #XXX [#YYY] | commits abc1234 [def5678] | fichiers `path/X`, `path/Y`

```

Rules:
- Heading is **always** H2 (`##`), date in `YYYY-MM-DD`.
- "Sujet" max 60 chars, French, no trailing punctuation.
- "Branche" : the actual branch name (use `git branch --show-current`).
- "Décision" : ONE sentence. The most important thing the session decided or produced.
- "Sortie" : factual artifacts only. PRs by number with `#`, commits by short SHA, files by path. Pipe-separated.
- 3 or 4 lines total in the bullet block. Never more.
- Always one blank line BEFORE the new H2 heading and AFTER the closing bullet.

## How to write the entry

1. Determine the date : use today's local date (`date +%F`).
2. Determine the branch : `git branch --show-current` from the worktree where work happened.
3. Determine the sujet : look at the session goal. ONE noun phrase, ≤ 60 chars.
4. Determine the décision : look at the most-impactful commit message OR what the user explicitly asked. ONE sentence.
5. Determine the sortie :
   - Get PRs : `gh pr list --head <branch>` or check session history.
   - Get commits : `git log main..HEAD --pretty=format:'%h'` (short SHAs).
   - Get top-level files : look at the largest `git diff --stat` paths.
6. Append the block to `log.md`.

## Anti-patterns

- ❌ Editing past entries (append-only — corrections = new dated entry)
- ❌ Dumping diff content (PR description handles details)
- ❌ Including secrets / tokens / internal IPs
- ❌ Fluff English / marketing tone (it's a log, not a release note)
- ❌ More than 4 bullet lines
- ❌ Missing one of the 3 required fields (Branche / Décision / Sortie)

## After writing

Confirm with one line : `Logged session to log.md.` — nothing else.
