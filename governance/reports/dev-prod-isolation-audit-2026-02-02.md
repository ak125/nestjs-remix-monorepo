# AUDIT DEVSECOPS — ISOLATION DEV/PROD

**Date:** 2026-02-02
**Auditeur:** Claude (DevSecOps Senior)
**Scope:** Supabase, Secrets, Runner, Validator Gates
**Methode:** Analyse statique read-only

---

# LIVRABLE 1 : RAPPORT D'AUDIT

## Resume Executif (10 lignes)

| Verdict | Status |
|---------|--------|
| **Supabase** | RISQUE CRITIQUE — Meme project_ref DEV et PROD |
| **Secrets** | RISQUE CRITIQUE — `.env.production` versionne dans Git |
| **Runner** | RISQUE MODERE — Self-hosted avec acces large |

**Top 3 risques factuels :**
1. DEV et PROD partagent la MEME base Supabase (`cxpojprgwgubzjyqzmoq`)
2. `backend/.env.production` est versionne dans Git (visible dans l'historique)
3. Claude MCP peut executer du SQL (`mcp__supabase__execute_sql`) sur la base partagee

**Ce qui est PROUVE vs NON PROUVE :**
- PROUVE : Meme Supabase project_ref dans `.env` et `.env.production`
- PROUVE : `.env.production` tracke dans Git (`git ls-files`)
- PROUVE : Runner self-hosted avec `deploy` user (sudo+docker)
- PROUVE : Permissions MCP `execute_sql` + `apply_migration` autorisees
- NON PROUVE : Existence d'un projet Supabase separe pour DEV

---

## Preuves Collectees

### Fichiers trouves

```
# .env files (git ls-files | grep .env)
.env.vps                              # VERSIONNE
backend/.env.production               # VERSIONNE (CRITIQUE)
backend/.env.backup-20251104-174224   # VERSIONNE
backend/.env.paybox-test-keys         # VERSIONNE
backend/.env.test                     # VERSIONNE
```

### Extraits de preuves (secrets masques)

**Supabase project_ref identique :**
```
# backend/.env (DEV actif)
SUPABASE_URL=cxpojprgwgubzjyqzmoq.[REDACTED]

# backend/.env.production
SUPABASE_URL=cxpojprgwgubzjyqzmoq.[REDACTED]

# VERDICT: MEME PROJECT_REF = MEME BASE
```

**Permissions MCP Claude :**
```json
// .claude/settings.local.json (lignes 13, 30)
"mcp__supabase__execute_sql",    // PEUT EXECUTER SQL
"mcp__supabase__apply_migration" // PEUT APPLIQUER MIGRATIONS
```

**Runner self-hosted :**
```yaml
# .github/workflows/ci.yml:186
runs-on: [self-hosted, Linux, X64]

# .github/workflows/deploy-prod.yml:15
runs-on: [self-hosted, Linux, X64]
```

**User context :**
```
whoami: deploy
id: uid=1000(deploy) gid=1001(deploy) groups=1001(deploy),27(sudo),1000(docker)
```

---

## Axe 1 — Supabase/DB Isolation

### Constat

**DEV et PROD partagent la MEME base de donnees Supabase.**

Le project_ref `cxpojprgwgubzjyqzmoq` est identique dans :
- `backend/.env` (fichier actif sur serveur DEV)
- `backend/.env.production` (fichier versionne)

### Preuves

| Fichier | Project Ref (tronque) | Host |
|---------|----------------------|------|
| `backend/.env` | cxpojprgwgubzjyqzmoq | aws-0-eu-central-1 |
| `backend/.env.production` | cxpojprgwgubzjyqzmoq | aws-0-eu-central-1 |

```bash
# Commande executee (valeurs masquees)
$ cat backend/.env | grep SUPABASE_URL | cut -d'.' -f1
cxpojprgwgubzjyqzmoq

$ cat backend/.env.production | grep SUPABASE_URL | cut -d'.' -f1
cxpojprgwgubzjyqzmoq
```

### Impact

- Toute modification DEV (INSERT, UPDATE, DELETE, migration) affecte PROD
- Claude MCP avec `execute_sql` peut corrompre les donnees production
- Pas de rollback possible si DEV corrompt PROD

### Verdict : **RISQUE PARTAGE CRITIQUE**

---

## Axe 2 — Secrets Isolation

### Constat

**Fichiers sensibles versionnes dans Git :**

| Fichier | Versionne | Risque |
|---------|-----------|--------|
| `backend/.env.production` | OUI | CRITIQUE |
| `backend/.env.backup-*` | OUI | CRITIQUE |
| `backend/.env.paybox-test-keys` | OUI | MODERE |
| `.env.vps` | OUI | MODERE |

### Preuves

```bash
$ git ls-files | grep -E "\.env" | grep -v example
.env.vps
backend/.env.backup-20251104-174224
backend/.env.paybox-test-keys
backend/.env.production          # FICHIER PROD DANS GIT !
backend/.env.test
```

### .gitignore analyse

```gitignore
# .gitignore patterns
.env
.env.local
.env.*.local        # NE COUVRE PAS .env.production !
!.env.example
```

Le pattern `.env.*.local` ne match pas `.env.production`.

### .dockerignore analyse

```dockerignore
.env
.env.local
.env.*.local
!.env.example       # .env.production N'EST PAS EXCLU !
```

### Verdict : **RISQUE CRITIQUE — SECRETS EXPOSES**

---

## Axe 3 — Runner / CI Isolation

### Constat

**Runner self-hosted avec privileges eleves :**

| Element | Valeur | Risque |
|---------|--------|--------|
| Type | Self-hosted | MODERE |
| User | `deploy` | |
| Sudo | Groupe 27 | MODERE |
| Docker | Groupe 1000 | MODERE |
| Location | Meme serveur que DEV | CRITIQUE |

### Workflow ci.yml (ligne 186-188)

```yaml
deploy:
  runs-on: [self-hosted, Linux, X64]
  needs: [build, lint, typecheck, core-build, import-firewall]
  if: ${{ (github.ref == 'refs/heads/main') && github.event_name == 'push' }}
```

**Points positifs :**
- Deploy conditionne a `main` + `push` (pas sur PR)
- Depend de checks (lint, typecheck, import-firewall)

**Points negatifs :**
- Ligne 212-216 : Copie le `.env` de production vers preprod
- Runner sur meme machine avec acces a `~/production/.env`

```yaml
# ci.yml:212-216
if [ -f ~/production/.env ]; then
  cp ~/production/.env $PREPROD_DIR/.env  # PARTAGE DU .ENV PROD
fi
```

### PR/Fork Security

```yaml
# ci.yml:7
pull_request: {}  # Pas de restriction de forks
```

Les jobs lint/typecheck s'executent sur PR de forks, mais :
- Le deploy est protege (`github.event_name == 'push'`)
- Les secrets ne sont pas exposes aux PR externes

### Verdict : **RISQUE MODERE — CONTROLE MAIS PERFECTIBLE**

---

## Observations Complementaires

### Ce qui est "DEV ONLY" (bien isole)

```typescript
// backend/src/app.module.ts:50 (commente)
// import { AiContentModule } from './modules/ai-content/ai-content.module';
// import { KnowledgeGraphModule } from './modules/knowledge-graph/knowledge-graph.module';
// import { RagProxyModule } from './modules/rag-proxy/rag-proxy.module';
// import { RmModule } from './modules/rm/rm.module';
```

Import Firewall ESLint actif (`backend/.eslintrc.js`)
CI Check `core-build` et `import-firewall`

### Contamination Supply Chain Potentielle

| Vecteur | Risque | Preuve |
|---------|--------|--------|
| Claude MCP -> Supabase | CRITIQUE | `execute_sql` autorise |
| `.env.production` dans Git | CRITIQUE | `git ls-files` |
| Runner acces prod/.env | MODERE | `ci.yml:212-216` |

---

# LIVRABLE 2 : BACKLOG JSON

```json
{
  "generated_at": "2026-02-02",
  "scope": ["supabase", "secrets", "runner", "validator-gates"],
  "items": [
    {
      "id": "DEVSAFE-001",
      "title": "Creer projet Supabase separe pour DEV",
      "priority": "P0",
      "risk": "CRITICAL",
      "status": "TODO"
    },
    {
      "id": "DEVSAFE-002",
      "title": "Supprimer .env.production de Git et de l'historique",
      "priority": "P0",
      "risk": "CRITICAL",
      "status": "TODO"
    },
    {
      "id": "DEVSAFE-003",
      "title": "Restreindre permissions MCP Claude sur DEV",
      "priority": "P0",
      "risk": "CRITICAL",
      "status": "TODO"
    },
    {
      "id": "DEVSAFE-004",
      "title": "Ajouter .env.production au .gitignore",
      "priority": "P1",
      "risk": "HIGH",
      "status": "TODO"
    },
    {
      "id": "DEVSAFE-005",
      "title": "Separer runner DEV du serveur PROD",
      "priority": "P1",
      "risk": "HIGH",
      "status": "TODO"
    },
    {
      "id": "DEVSAFE-006",
      "title": "Implementer GATE-1: No PROD Supabase in DEV",
      "priority": "P1",
      "risk": "HIGH",
      "status": "TODO"
    },
    {
      "id": "DEVSAFE-007",
      "title": "Implementer GATE-2: MCP permissions audit",
      "priority": "P1",
      "risk": "HIGH",
      "status": "TODO"
    },
    {
      "id": "DEVSAFE-008",
      "title": "Implementer GATE-3: Runner blast-radius control",
      "priority": "P2",
      "risk": "MED",
      "status": "TODO"
    },
    {
      "id": "DEVSAFE-009",
      "title": "Implementer GATE-4: Secrets hygiene check",
      "priority": "P2",
      "risk": "MED",
      "status": "TODO"
    },
    {
      "id": "DEVSAFE-010",
      "title": "Rotation des secrets exposes",
      "priority": "P0",
      "risk": "CRITICAL",
      "status": "TODO"
    }
  ]
}
```

---

# RESUME DES VERDICTS

| Axe | Verdict | Priorite |
|-----|---------|----------|
| **Supabase/DB** | RISQUE PARTAGE CRITIQUE | P0 |
| **Secrets** | RISQUE CRITIQUE | P0 |
| **Runner/CI** | RISQUE MODERE | P1 |

## Actions Immediates (P0)

1. **URGENT** : Creer un projet Supabase separe pour DEV
2. **URGENT** : Supprimer `.env.production` de Git + purger l'historique
3. **URGENT** : Rotation de TOUS les secrets exposes
4. **URGENT** : Restreindre permissions MCP Claude
