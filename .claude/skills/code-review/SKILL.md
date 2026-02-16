---
name: code-review
description: "Systematic PR/code review: security, architecture, performance, business compliance. Checklist adapted to AutoMecanik monorepo."
argument-hint: "[PR-number or file-path]"
allowed-tools: Read, Grep, Glob, Bash
version: "1.1"
---

# Code Review Skill

Revue systématique de code ou PR couvrant sécurité, architecture, performance et logique métier.

## Quand proposer ce skill

| Contexte detecte | Proposition |
|------------------|------------|
| PR ouverte ou diff avec 5+ fichiers | `/code-review [PR-number]` |
| Avant push sur main (validation) | `/code-review` |
| Refactor touchant 3+ modules | `/code-review [fichier]` |
| Modification `modules/payments/` | `/code-review` + `/payment-review` (chaine securite) |

---

## Niveaux de Severite

| Niveau | Symbole | Signification | Impact sur merge |
|--------|---------|---------------|-----------------|
| **BLOQUANT** | :no_entry: | Faille securite, perte de donnees, crash prod | Merge IMPOSSIBLE |
| **HAUTE** | :warning: | Bug probable, anti-pattern, regression | Discussion requise avant merge |
| **SUGGESTION** | :bulb: | Amelioration, cleanup, optimisation | Backlog, merge possible |

**Criteres d'approbation :**
- 0 BLOQUANT = condition necessaire
- 0 HAUTE non-resolue = condition necessaire
- SUGGESTION = informatif, ne bloque pas

---

## Review Workflow 4 Phases

### Phase 1 — Scope Assessment

1. **Lister les fichiers modifies** : `gh pr diff <PR_NUMBER>` ou `git diff origin/main`
2. **Compter** : fichiers, insertions, suppressions
3. **Classifier par domaine** :

| Domaine | Fichiers | Checklist applicables |
|---------|----------|----------------------|
| Backend | `backend/src/**` | Universelle + Backend |
| Frontend | `frontend/app/**` | Universelle + Frontend |
| Payments | `modules/payments/**` | Universelle + Backend + Paiements |
| Migrations | `*.sql` | Universelle + Migrations |
| Config | `.github/`, `docker-compose*`, `Dockerfile` | Universelle + Config |

4. **Evaluer le risque** :

| Critere | Bas | Moyen | Haut |
|---------|-----|-------|------|
| Fichiers modifies | 1-3 | 4-10 | 11+ |
| Modules touches | 1 | 2-3 | 4+ |
| Touche payments/ | Non | — | Oui |
| Touche config/ | Non | — | Oui |

### Phase 2 — Checklist par domaine

Appliquer les checklists pertinentes selon la Phase 1.

### Phase 3 — Security & Performance

**Security Patterns a verifier :**

| Pattern | Check | Severite |
|---------|-------|----------|
| SQL Injection | Pas de string concatenation dans les queries Supabase | BLOQUANT |
| XSS | Pas de `dangerouslySetInnerHTML` sans sanitization | BLOQUANT |
| RLS Bypass | Pas de `service_role` key expose cote frontend | BLOQUANT |
| Timing Attack | `timingSafeEqual` pour comparaison crypto | BLOQUANT |
| Secrets Leak | Pas de API keys, tokens, passwords dans le code | BLOQUANT |
| CSRF | Formulaires POST avec protection CSRF | HAUTE |
| Auth Bypass | Guards sur toutes les routes protegees | HAUTE |

**Performance Checks :**

| Check | Comment verifier | Severite |
|-------|-----------------|----------|
| Queries N+1 | Boucle avec query Supabase inside | HAUTE |
| Bundle size | Nouvel import lourd (moment, lodash full) | HAUTE |
| Cache invalidation | Modification cache sans TTL ou clear strategy | SUGGESTION |
| Missing index | Query sur colonne non-indexee (table > 10K rows) | SUGGESTION |

### Phase 4 — Testing Validation

- [ ] Les tests existants passent-ils toujours ?
- [ ] Y a-t-il de nouveaux tests pour les nouvelles fonctionnalites ?
- [ ] TypeScript compile sans erreur (`npm run typecheck`)
- [ ] Lint passe (`npm run lint`)

---

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
- [ ] Pas de perte de données (ALTER DROP COLUMN vérifié)

## Checklist Config/Deploy

- [ ] Pas de modification .github/, docker-compose*, Dockerfile sans review
- [ ] turbo.json coherent avec le pipeline
- [ ] Variables d'environnement documentees

---

## Format de Sortie

```markdown
## Code Review — PR #XX

### Scope
- Fichiers : [N] modifies ([insertions]+, [suppressions]-)
- Domaines : [liste]
- Risque : Bas / Moyen / Haut

### Bloquants :no_entry: (MUST FIX)
- [fichier:ligne] Description du probleme

### Haute :warning: (SHOULD FIX)
- [fichier:ligne] Description du risque

### Suggestions :bulb: (NICE TO HAVE)
- [fichier:ligne] Amelioration proposee

### Security & Performance
- [resultats Phase 3]

### Verdict
- [ ] **APPROVE** — 0 BLOQUANT, 0 HAUTE non-resolue
- [ ] **REQUEST CHANGES** — [N] BLOQUANT(s), [N] HAUTE(s)
```

## Anti-Patterns (BLOCK)

- Approuver sans avoir lu tous les fichiers modifies
- Ignorer les changements dans le module payments
- Merge sans verification des imports Docker
- Skip la checklist RLS sur les migrations

---

## Interaction avec Autres Skills

| Skill | Direction | Declencheur |
|-------|-----------|-------------|
| `payment-review` | → propose | Si diff touche `modules/payments/` → proposer `/payment-review` |
| `backend-test` | → propose | Apres review, proposer `/backend-test` pour validation curl |
| `db-migration` | → verifie | Si diff contient des fichiers `.sql`, verifier les patterns migration |
