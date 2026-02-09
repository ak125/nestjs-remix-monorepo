---
name: code-review
description: "Revue systematique de PR/code : securite, architecture, performance, conformite metier. Checklist adaptee au monorepo AutoMecanik."
---

# Code Review Skill

Revue systematique de code ou PR couvrant securite, architecture, performance et logique metier.

## When to Activate
- Invoke with `/code-review`
- When reviewing a PR before merge
- When auditing code changes across modules

## Review Workflow

1. **Lister les fichiers modifies** : `gh pr diff <PR_NUMBER>` ou `git diff origin/main`
2. **Classer par domaine** : backend, frontend, payments, config, migrations
3. **Appliquer la checklist** par domaine (ci-dessous)
4. **Synthese** : resume des findings (bloquants, warnings, suggestions)

## Checklist Universelle (tous fichiers)

- [ ] Pas de secrets hardcodes (.env values, API keys, tokens)
- [ ] Pas d'import depuis module rm/ (BANNI — incident 2026-01-11)
- [ ] Pas de `console.log` oublie (sauf debug intentionnel)
- [ ] TypeScript strict : pas de `any` injustifie, pas de `@ts-ignore`
- [ ] Imports resolus dans Docker (pas de @monorepo/* non lie)

## Checklist Backend (NestJS)

- [ ] Pattern 3-tier respecte : Controller → Service → DataService
- [ ] Validation Zod sur les inputs (pas de `@Body() body: any`)
- [ ] Guards d'authentification sur les routes protegees
- [ ] Pas de requetes N+1 (utiliser RPC ou joins Supabase)
- [ ] Gestion d'erreur explicite (pas de catch vide)

## Checklist Frontend (Remix)

- [ ] Loader pour le data fetching (pas de useEffect + fetch)
- [ ] Meta tags SEO definis (title, description, OG)
- [ ] Composants shadcn/ui (pas de HTML brut pour UI)
- [ ] Classes Tailwind (pas de styles inline)
- [ ] Mobile-first responsive

## Checklist Paiements (CRITIQUE)

- [ ] `timingSafeEqual` pour comparaison de signatures (pas `===`)
- [ ] `normalizeOrderId()` appele avant lookup DB
- [ ] Verification code erreur avant marquage "paye"
- [ ] Idempotence : callbacks replay ne double-traitent pas
- [ ] Pas de cles HMAC en dur dans le code

## Checklist Migrations SQL

- [ ] `IF NOT EXISTS` sur CREATE TABLE/INDEX
- [ ] `BEGIN/COMMIT` pour multi-statements
- [ ] RLS active sur nouvelles tables
- [ ] Pas de DROP sans IF EXISTS
- [ ] Pas de perte de donnees (ALTER DROP COLUMN verifie)

## Checklist Config/Deploy

- [ ] Pas de modification .github/, docker-compose*, Dockerfile sans review
- [ ] turbo.json coherent avec le pipeline
- [ ] Variables d'environnement documentees

## Format de Sortie

```markdown
## Code Review — PR #XX

### Bloquants (MUST FIX)
- [fichier:ligne] Description du probleme

### Warnings (SHOULD FIX)
- [fichier:ligne] Description du risque

### Suggestions (NICE TO HAVE)
- [fichier:ligne] Amelioration proposee

### Verdict
- [ ] APPROVE — pret a merge
- [ ] REQUEST CHANGES — corrections requises
```

## Anti-Patterns (BLOCK)

- Approuver sans avoir lu tous les fichiers modifies
- Ignorer les changements dans le module payments
- Merge sans verification des imports Docker
- Skip la checklist RLS sur les migrations
