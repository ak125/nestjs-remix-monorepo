# Auto-review proposals wiki — batch v3 — 2026-05-29

> ⚠️ **CORRECTION 2026-05-29 (v2)** — Cette version **remplace** une première rédaction
> manuelle (Niveau 0) qui concluait « 5× DATA_WEAK → BLOCKED_SOURCE ». Cette conclusion
> était **dérivée de la mauvaise source** : la *télémétrie de génération*
> (`audit/wiki-bootstrap-runs/*.json → gammes_processed[].decision_brief_quality_verdict`),
> et non des **fichiers proposals réellement reviewables**.
>
> Le verdict **autoritaire** ci-dessous vient de l'outil canon **#783**
> (`scripts/wiki-generators/auto_review_wiki_proposal.py`, exécuté via worktree off
> `origin/main` — absent du checkout DEV 31-commits-en-retard) sur les fichiers proposals
> eux-mêmes. Sortie machine consignée : `audit/wiki-auto-review/<slug>.review.{json,md}`.

---

## Verdict autoritaire (outil #783 sur les fichiers proposals)

| slug | proposal on-disk | `review_verdict` | raison | `auto_promotion_eligible` | safety |
|------|------------------|------------------|--------|---------------------------|--------|
| filtre-a-air | ✓ (pilote G6, 05-02) | **NOT_APPLICABLE** | `decision_brief_missing` | false (`NO_DECISION_BRIEF`) | non |
| plaquette-de-frein | ✓ (pilote G6, 05-02) | **NOT_APPLICABLE** | `decision_brief_missing` | false (`NO_DECISION_BRIEF`) | **oui — `freinage`** ✅ détecté |
| thermostat | ✗ aucune | n/a (rien à reviewer) | pas de proposal | — | — |
| courroie-d-accessoire | ✗ aucune | n/a | pas de proposal | — | — |
| vanne-egr | ✗ aucune | n/a | pas de proposal | — | — |

`human_review_required = false` partout : il n'y a **rien à reviewer** (pas de decision_brief),
donc l'humain n'est pas sollicité — conforme à la doctrine « humain = garde-fou, pas moteur ».
La détection safety du tool fonctionne (`plaquette-de-frein` → `safety_category: freinage`),
mais ne se déclenche pas faute de decision_brief à valider.

## Pourquoi la discordance télémétrie ↔ fichiers

1. **Batch v3 = quasi-intégralement `dry_run=true`** (mode `deterministic_transform_only`).
   La génération a *calculé* `decision_brief_quality_verdict=DATA_WEAK` + `cross_check=NEITHER`
   en mémoire, mais **n'a persisté aucun decision_brief** dans les proposals.
2. Les 2 fichiers proposals présents (`filtre-a-air.md`, `plaquette-de-frein.md`) sont des
   **pilotes G6 ADR-033 antérieurs** (`created 2026-04-28/29`, `updated 2026-05-02`),
   **sans bloc `decision_brief`** (grep = 0).
3. Donc : *télémétrie DATA_WEAK* (« si on générait maintenant, le brief serait faible »)
   **≠** *proposal reviewable* (« il existe un decision_brief à juger »). Le verdict
   reviewable autoritaire est **NOT_APPLICABLE**, pas BLOCKED_SOURCE.

## Next action corrigée

L'action n'est **pas** « enrich RAW puis re-triage de proposals DATA_WEAK » (il n'y a pas de
proposal DATA_WEAK reviewable). La séquence réelle, en amont :

1. **Run de génération non-dry** sur ces slugs pour *persister* des decision_briefs dans les
   proposals (sans ça, l'auto-review est NOT_APPLICABLE par construction).
2. **Mais** la télémétrie dry-run prédit déjà `DATA_WEAK` + `cross_check=NEITHER`
   (`web_with_vehicle_evidence=0` partout) → un run réel produirait des briefs faibles.
   Donc **enrich RAW orienté concordance web↔RAG véhicule-aware** reste le prérequis qualité
   *avant* un run réel utile.
3. `plaquette-de-frein` : même avec un decision_brief, family `freinage` = safety →
   `human_review_required` + source S3 régulatoire (ECE R90) obligatoires. **Jamais auto-accept.**

## Findings transverses (inchangés / renforcés)

- **#793 mergé** : `feat(wiki-bootstrap): add auto-promotion eligibility gate (safety-aware)` —
  le gate d'éligibilité (`auto_promotion_eligible`, safety-aware) est **déjà shippé**. L'outil
  #783 émet désormais `auto_promotion_eligible` + `auto_promotion_reason`.
- **Checkout DEV 31 commits en retard** : l'outil #783 a dû être exécuté via worktree off
  `origin/main` (le tool n'est pas sur le checkout vivant). Gotcha
  `dev-runtime-not-auto-updated-on-merge` ; resync = opération de maintenance owner-gated
  (npm install 5 workspaces + 2 migrations DB partagée).
- **Vocabulaire de verdict** : l'outil canon utilise `REVIEWABLE / REVIEWABLE_WITH_FIXES /
  NOT_REVIEWABLE / NOT_APPLICABLE` + `auto_promotion_eligible`. C'est **le** vocabulaire
  autoritaire — mapper dessus, ne pas en créer d'autre.

## Méthode (traçabilité)

- Outil : `scripts/wiki-generators/auto_review_wiki_proposal.py` (#783) @ `origin/main` `1502af368`.
- Exécution : worktree `/tmp/wt-wiki-autoreview-783` (zéro impact sur DEV:3000 vivant).
- Entrées : `backend/content/automecanik-wiki/proposals/{filtre-a-air,plaquette-de-frein}.md`.
- Sorties machine : `audit/wiki-auto-review/{filtre-a-air,plaquette-de-frein}.review.{json,md}`.
