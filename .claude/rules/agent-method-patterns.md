# Agent method patterns — idées gstack traduites AutoMecanik-native

> `NON-CANON · ADVISORY · POINTER-ONLY · NO AUTHORITY · NO NEW CONTROL PLANE · NO EXTERNAL DEPENDENCY`
>
> Patterns inspirés de **gstack** (pack de skills tiers), traduits en **pointers** vers les
> mécanismes AutoMecanik **déjà existants**. Aucune nouvelle couche, aucun registre, aucune
> projection, aucune dépendance externe : chaque pattern **renvoie** à sa source autoritaire.
> La vérité reste **vault / registry / DB / RAW→WIKI**.
>
> **Ce fichier n'autorise aucune action, ne remplace aucun gate et ne peut jamais assouplir un
> guard existant. Il aide seulement l'agent à choisir le bon mécanisme existant.**
> *(Garde anti-authority-drift — même classe d'incident que celle documentée côté vault.)*

## Pourquoi ce fichier

gstack organise le travail agent autour d'une discipline (phases, garde-fous, scope, second
avis, routing). AutoMecanik a **déjà** des équivalents — souvent **mécaniques et bloquants** là
où gstack reste *advisory*. Ce fichier ne reconstruit rien : il **nomme** la discipline et
**pointe** vers le mécanisme qui fait foi. But unique = aider un agent à choisir le bon outil
existant, **sans installer gstack** ni créer de système parallèle.

---

## 1. Phases agent — `DISCOVER → DECIDE → PLAN → PATCH → VERIFY → HANDOFF`

> **Ces phases sont un vocabulaire de lecture/sortie — PAS un orchestrateur, PAS un gate CI,
> PAS une nouvelle pipeline.** Elles nomment une discipline déjà présente ; rien ne s'exécute et
> rien ne bloque sur leur base.

| Phase | Ce qu'elle nomme | Mécanisme autoritaire (déjà là) |
|---|---|---|
| **DISCOVER** | cartographier avant de muter | [CLAUDE.md](../../CLAUDE.md) « analyser AVANT muter » → ordre `canonical.json → REPO_MAP → knowledge → ADR vault → grep` |
| **DECIDE** | verdict `REUSE / IMPROVE / CREATE / STOP` | [continuous-improvement-global](../skills/continuous-improvement-global/SKILL.md) (`GO / GO_WITH_WATCH / FIX_AND_RETEST / OWNER_DECISION / STOP_*`) + CLAUDE.md « Prefer extension over creation » |
| **PLAN** | scope borné, risques, rollback | CLAUDE.md « Discipline de périmètre » + branche dédiée / worktree ([deployment.md](deployment.md)) |
| **PATCH** | modification minimale, blast radius réduit | CLAUDE.md « périmètre minimal » |
| **VERIFY** | tests + preuves | champ *Test* de continuous-improvement + vérification runtime PRE-PR / POST-MERGE (CLAUDE.md §Runtime-awareness) |
| **HANDOFF** | résumé owner, next action, no overclaim | [agent-exit-contract.md](../canon-mirrors/agent-exit-contract.md) (coverage manifest, verdict, anti-overclaim) |

---

## 2. Danger-zone — POINTE vers les guards (ne réécrit rien)

Les actions sensibles sont **déjà gardées mécaniquement**. Sources autoritaires :
[pretool-bash-guard.sh](../../scripts/claude-hooks/pretool-bash-guard.sh),
[pretool-supabase-guard.sh](../../scripts/claude-hooks/pretool-supabase-guard.sh),
[pretool-file-guard.sh](../../scripts/claude-hooks/pretool-file-guard.sh),
27 règles [.ast-grep/rules/](../../.ast-grep/rules/), [.husky/pre-commit](../../.husky/pre-commit).

Niveaux : **BLOCK** (refusé) · **WARN** (averti, autorisé) · **DOCTRINE_ONLY** (interdit par
doctrine mais **pas** intercepté par un guard — l'agent s'auto-discipline + demande GO owner).

| Trigger | Niveau actuel | Mécanisme |
|---|---|---|
| `git push origin main` / `--force` / `reset --hard` / `npm install` | **BLOCK** | pretool-bash-guard.sh G1/G3/G4/G5 |
| `docker down/stop/rm` (prod) | **BLOCK** | pretool-bash-guard.sh G2 |
| `DROP` / `TRUNCATE` / `DISABLE RLS` | **BLOCK** | pretool-supabase-guard.sh G1-G3 |
| `.env` / `.github` / docker / lock / build config | **BLOCK** | pretool-file-guard.sh G1-G4 |
| `backend/src/modules/rm/` | **BLOCK** | pretool-file-guard.sh G5 |
| `supabase.rpc` direct (commerce) / order-cart status writes | **BLOCK** *(code)* | ast-grep `commerce-*` |
| `ALTER TABLE DROP COLUMN` / `CREATE TABLE` sans RLS | **WARN** | pretool-supabase-guard.sh G4-G5 |
| `payments/` edits | **WARN** *(not BLOCK)* | pretool-file-guard.sh G3 + [payments.md](payments.md) |
| `gh pr merge` | **DOCTRINE_ONLY** | Airlock / owner-GO — non mécanisé |
| `git tag v*` / `push --tags` / deploy-prod | **DOCTRINE_ONLY** | tag = décision opérateur ([deployment.md](deployment.md)) |
| `UPDATE`/`DELETE` `pieces` / `pieces_price` / `__seo_*` via execute_sql | **DOCTRINE_ONLY** | pricing = module gouverné / pas de touch meta-H1 |

> Les lignes **DOCTRINE_ONLY** ne sont **pas** protégées mécaniquement aujourd'hui. Les fermer =
> durcir les guards (**renforcer, jamais affaiblir**) — décision **owner-gated**, hors de ce
> fichier (qui ne peut pas modifier un guard).

---

## 3. Freeze scope — rituel par tâche

Discipline existante : CLAUDE.md « Discipline de périmètre » + ownership 992 globs
([ownership.yaml](../../.spec/00-canon/repository-registry/ownership.yaml)) + travail en worktree
dédié ([deployment.md](deployment.md)). Rituel à poser en tête de tâche :

```
Allowed:   <chemins du bounded-context concerné>
Forbidden: <tout le reste — ex. payments/, orders/, migrations non demandées>
Hors scope trouvé → report only, jamais de patch.
```

---

## 4. QA = report-only par défaut

Sources autoritaires existantes : Playwright E2E ([playwright.config.ts](../../frontend/playwright.config.ts)),
Lighthouse CI, PROD smoke ([prod-smoke-tests.yml](../../.github/workflows/prod-smoke-tests.yml)),
skills [responsive-audit](../skills/responsive-audit/SKILL.md),
[web-vitals-audit](../skills/web-vitals-audit/SKILL.md),
[runtime-truth-audit](../skills/runtime-truth-audit/SKILL.md).

**Règle : la QA produit d'abord un rapport, jamais un patch auto. Tout fix = GO explicite.**

Invariants commerce à vérifier *(aide-mémoire — autorité = code runtime + prod-smoke-tests.yml,
pas cette liste)* :

- sélecteur véhicule visible (R1)
- lien R3 → R1 présent
- bouton panier masqué si `can_sell=false`
- prix affiché seulement si `price_exists`
- PREORDER vendable si `pri_dispo=3`
- `noindex` sur 404/410, canonical propre
- pas de contenu générique dupliqué visible

Non-couvert par un test existant → **candidat signalé**, **pas** de nouveau skill (V1-first).

---

## 5. Second avis = advisory only

> Second avis multi-modèle = **advisory only**. Primary pointers :
> - existing [code-review](../skills/code-review/SKILL.md) skill
> - existing CodeRabbit review *when available*
> - optional external model review, **never authoritative**
>
> Owner = décision finale. vault / repo / DB = vérité. *Aucun outil tiers n'est nommé comme
> chemin prioritaire.*

5 questions standard du second avis :

1. Ai-je inventé une architecture parallèle ?
2. Ai-je touché hors scope ?
3. Ai-je oublié un rollback ?
4. Ai-je cassé un invariant métier ?
5. Ai-je sur-déclaré `DONE` alors que c'est `PARTIAL` ?

---

## 6. Mémoire = aide au rappel, pas vérité

Doctrine **déjà en place** (rien à construire) :

| Couche | Rôle |
|---|---|
| `MEMORY.md` | gotchas, préférences |
| `CLAUDE.md` | comportement agent |
| vault | décisions canon |
| WIKI | connaissance validée |
| DB | vérité runtime |
| RAG | consultation seulement |

Voir [agent-doc-search.md](agent-doc-search.md) : « pas de nouvel index, pas de couche RAG
parallèle, pas de vérité parallèle ». Une mémoire agent n'est **jamais** source de vérité.

---

## 7. Review routing — vers le bon mécanisme, pas 15 agents génériques

Routing **autoritaire** = [agent-operating-map.yaml](../../.spec/00-canon/ai-registry/agent-operating-map.yaml)
(surfaces root / seo-batch / marketing / wiki / paperclip) + [role-matrix.md](../../.spec/00-canon/role-matrix.md)
(R\*/G\*) + section « Interaction » de chaque skill + [departments-map](../../audit/automecanik-departments-map.md).

Table d'**exemple non-autoritaire** *(illustration ; la source qui fait foi reste
agent-operating-map.yaml, owner-gated)* :

| Tâche | Surface / département |
|---|---|
| pricing / marge / dispo | pricing + supplier |
| supplier (DCA / CAL / NK) | supplier + catalog |
| SEO R1 / R2 / R3 / R8 | seo-batch |
| RAW / WIKI | wiki |
| cart / order / payment | commerce + governance |
| runtime / CWV / errors | runtime + data |
| dashboard / command-center | strategy + governance |

---

## 8. Ce qu'on REFUSE (de gstack)

| Refusé | Pourquoi |
|---|---|
| `/ship`, `/land-and-deploy` auto | PROD owner-gated : tag `v*` = décision opérateur ([deployment.md](deployment.md)) |
| team-required mode | aucune imposition d'outil tiers dans le repo |
| brain / mémoire externe comme canon | vérité = vault / DB / WIKI, jamais une mémoire agent ([agent-doc-search.md](agent-doc-search.md)) |
| browser agent mutant sans garde-fou | toute mutation passe par les gates existants |
| continuous checkpoint push | déclenche CI / PROD ; le push est une action gouvernée |

---

_Non-canon. Pour toute règle qui fait foi, voir la source pointée (vault · `.spec/00-canon/` ·
guards · skills). Ce fichier ne crée aucune autorité._
