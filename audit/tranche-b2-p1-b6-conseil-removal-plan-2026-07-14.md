# Tranche B2-P1 — Plan exact de retrait de B6 (`ConseilEnricherService`) — PILOTE

```
Status:            PLAN READ-ONLY — AUCUN CODE MODIFIÉ
Exécution:         NOT AUTHORIZED — exige GO owner nominatif, puis UNE PR pilote B6 uniquement
Tree de preuve:    origin/main @ 2cd7e1785 (call graph complet : fichier lu intégralement, 2719 lignes)
Gouvernance:       ADR-027 §Correction 2026-07-07 (vault d04815e) — S2_DIAG = INPUT A (__diag_*) + INPUT B
                   (WIKI diagnostic_relations[]) ; RAG = 0 autorité ; JAMAIS fallback RAG ni observable
Invariants:        ni flag transitoire, ni nouveau gate, ni adaptateur RAG→WIKI ; contenu servi existant
                   reste STATIQUE ; entrée canonique absente ⇒ aucune nouvelle écriture
Doc compagnon:     audit/tranche-b2-0-producers-revalidation-2026-07-14.md
```

## 1. Pourquoi B6 est le bon pilote (preuves)

- Violation directe et double : RAG→`__seo_gamme_conseil` (servi R3) **et** RAG→`sg_descrip_draft`
  (`__seo_gamme`) ; l'ancienne justification (ADR-027 pilier 4 « RAG primary ») vient d'être
  supersedée au vault.
- **Un seul chemin d'invocation runtime** : `execution-router.service.ts:261-265`
  (`case RoleId.R3_CONSEILS` → `enricher.enrichSingle!(targetId, pgAlias ?? targetId)`, 2 args).
- **Zéro consommateur déterministe légitime** (règle owner « conserver seulement si un consommateur
  réel le prouve » → aucun) : `writeSections`/`writeSeoDescripDraft`/`executeEnrichment` sont
  `private` ; `enrichWithKeywordPlan` (public) a **0 caller** repo-wide ; seule la fn pure
  `formatGammeDisplayName:244-256` est importée — par son propre test uniquement
  (`conseil-enricher.naming.test.ts:14`), aucun consommateur runtime.
- Les 2 branches déterministes internes meurent avec le service **et c'est aligné** :
  - `buildS2DiagFromObservable:1333` (fallback observable→S2_DIAG) = précisément ce
    qu'ADR-027 §Correction interdit (« jamais fallback RAG ni observable ») ;
  - title-only:1895-1910 (headings du keyword plan) n'est joignable QUE via le flow RAG-gated,
    et stampe `rag-legacy` des rows non-RAG (`:2126`) — une fausse provenance de plus.
- La branche `ragMdMerger.merge:478` (réécriture du `.md` RAG) est **déjà morte par callers**
  (le router passe `supplementaryFiles=[]`).

## 2. Périmètre de retrait EXACT (branches RAG → supprimer)

| # | Élément | file:line (tree 2cd7e1785) | Action |
|---|---|---|---|
| 1 | `ConseilEnricherService` (service entier) | `backend/src/modules/admin/services/conseil-enricher.service.ts` (2719 l.) | **SUPPRIMER le fichier**. Aucune méthode à sauver : surface publique = `enrichSingle` (RAG-gated) + `enrichWithKeywordPlan` (morte) ; privates inaccessibles ; fn pure sans consommateur runtime |
| 2 | Provider + import DI | `backend/src/modules/admin/admin.module.ts:78,272` | Retirer les 2 lignes |
| 3 | Entrée registry `R3_CONSEILS` | `backend/src/config/execution-registry.constants.ts:74-95` | Retirer l'entrée (ou la marquer retirée si le type l'exige — suivre le précédent R3_GUIDE `:67-72`, entrée supprimée + commentaire) |
| 4 | Case router `R3_CONSEILS` | `execution-router.service.ts:261-265` + `serviceClassMap:94-96` | **RÉUTILISER le pattern R4/R5 existant** (`dispatchR4Single:381-388`, `dispatchR5Single:421-428`) : échec explicite `R3_CONSEILS generation-from-RAG removed (ADR-027 §Correction / ADR-080)` — PAS de silent skip |
| 5 | Test orphelin | `conseil-enricher.naming.test.ts` | Supprimer avec le service (il ne teste que la fn pure du fichier supprimé) |
| 6 | Event mort (si confirmé au moment de la PR) | `backend/src/modules/admin/events/keyword-plan.events.ts` (`KEYWORD_PLAN_VALIDATED` : ni émis ni consommé) | Supprimer si toujours 0 référence (post-solution closeout Q1) |

## 3. Ce qui est CONSERVÉ (et pourquoi)

| Élément | Preuve | Raison |
|---|---|---|
| Table `__seo_gamme_conseil` + rows existantes | servie R3 | Fail-closed = contenu statique, pas de suppression de données |
| Lecteurs de la table (blog-seo, sitemap, monitoring, etc.) | lectures seules vérifiées | Indépendants du RAG |
| `ConseilQualityScorerService` | `conseil-quality-scorer.service.ts:268-273` (update `sgc_quality_score` only) | Déterministe, ne touche pas le contenu — KEEP non-mutant de contenu |
| `RagMdMergerService` | autre consommateur légal : `admin-rag-ingest.controller.ts:33` (INGESTION_INDEX) | Maintenance du corpus RAG = légale (axe RAG-chatbot) ; seul l'appel B6 disparaît |
| `RagProxyService` / rag-proxy module | chatbot + ingestion | Axe RAG légal (ADR-080) — hors périmètre |
| CanonGate / QualityGate / canon `@repo/seo-roles` | purs | Réutilisables par le futur chemin canonique WIKI→projection (rien à adapter maintenant) |
| Provenance `rag-legacy` des rows existantes | `source-provenance.constants.ts:15` | Audit trail — ne pas réécrire l'histoire |

## 4. Preuve « aucun fallback RAG ne subsiste » (obligations de la PR)

Après retrait, chemins restants vers `__seo_gamme_conseil` :
1. `ConseilQualityScorerService` — déterministe, score uniquement ✅
2. **Agent `conseil-batch`** (`workspaces/seo-batch/.claude/agents/conseil-batch.md:300-326`) —
   INSERT SQL direct via MCP `execute_sql`, avec étape optionnelle `POST /api/rag/search`
   (`:190-198`). **Hors runtime backend, piloté humain.** ⚠ C'est le SEUL chemin RAG→table
   survivant — il doit être **surfacé à l'owner dans la PR pilote** (décision séparée : amender
   l'agent workspace ou l'accepter comme surface humaine) ; il n'est PAS fermable par cette PR
   monorepo sans toucher une surface hors périmètre.

Vérifications mécaniques à embarquer dans la PR :
- `grep -rn "ConseilEnricherService" backend/ frontend/ scripts/` = **0** ;
- `grep -rn "enrichWithKeywordPlan"` = 0 ;
- router : test RED→GREEN « dispatch R3_CONSEILS → échec explicite ADR-027 » (même forme que les
  tests R4/R5 existants) ;
- serving R3 inchangé : lecture d'une gamme existante avant/après (contenu statique identique) ;
- `tsc` 0 erreur ; suite backend verte.

## 5. Ratchet (même PR, obligatoire)

- Le retrait fait disparaître 2 clés du baseline : `conseil-enricher.service.ts::__seo_gamme` (1)
  et `::__seo_gamme_conseil` (1) → sans refresh, ratchet **exit 1** (voulu).
- La PR embarque `npm run audit:served-write-ratchet:refresh` → baseline attendu **66→64 clés /
  272→270 occurrences**. Règle de review : le diff du baseline ne contient QUE des suppressions —
  toute ligne ajoutée ou count augmenté = STOP (le refresh n'a pas de garde directionnelle).

## 6. Ordre d'exécution de la PR pilote (après GO)

1. Tests RED d'abord : router-échec-explicite R3_CONSEILS + absence de writer (grep-test si le
   repo en a le pattern) ;
2. Retrait #1-6 du §2 ; adaptation imports/module ;
3. `tsc` + suite backend + ratchet refresh (baseline en baisse) ;
4. Preuves §4 dans la description de PR (avant/après serving R3 inclus) ;
5. PR **B6 uniquement** — aucun autre flow embarqué, aucune modification de `payments/`, d'URLs,
   de meta/H1, ni du module rag-proxy.

## 7. Hors périmètre explicite de la PR pilote

- Recâblage canonique WIKI→projection→`__seo_gamme_conseil` (NEEDS_CANONICAL_REWIRE — chantier
  séparé, le contenu reste statique d'ici là) ;
- agent `conseil-batch` (workspace, décision owner séparée — surfacé §4) ;
- B1–B5/B7–B8 (groupes suivants après validation du pilote) ;
- toute activation de flag, tout nouveau gate, tout adaptateur RAG→WIKI (interdits).
