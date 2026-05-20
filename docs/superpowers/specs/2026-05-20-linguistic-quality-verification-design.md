# Vérification linguistique (grammaire / orthographe / conjugaison) des meta SEO générées

**Date** : 2026-05-20
**Statut** : design (V1 = audit ; Phase 2 = gate)
**Branche** : `feat/seo-linguistic-quality-audit`
**Lié à** : PR #660 (résolution switches R2), plan `utiliser-superpower-strat-gie-immutable-donut` (PR-2 qualité), mémoire `feedback_verify_existing_first`, `feedback_no_auto_page_suppression_ever`, `feedback_no_questionnaire_propose_best`.

---

## 1. Problème

PR #660 a corrigé la **résolution** des switches (`#CompSwitch_X#` ne sont plus strippés à vide). Mais la **composition** du template produit du français bancal. Exemple réel (pg 402, descrip `#LinkGammeCar_402#, #CompSwitch_3_402#`) :

> « Plaquette de frein PEUGEOT 207, au meilleur rapport qualité-prix pour assurer le freinage par friction »

= juxtaposition **sans verbe ni connecteur** (groupe nominal + virgule + complément). Grammaticalement incomplet.

**Constat vérifié (verify-existing, 2026-05-20)** : aucun mécanisme de vérification grammaire/orthographe/conjugaison n'existe dans le monorepo.
- `content-quality-gate.service.ts` = **denylists** (forbidden vocab + must-not-contain) par rôle R1/R3/R4/R6. Pas de grammaire.
- `quality-scoring-engine.service.ts` / `conseil-quality-scorer.service.ts` = scoring **heuristique** par dimensions (seuil/poids). Pas de grammaire.
- Aucune lib NLP/grammaire dans aucun `package.json` (pas de LanguageTool, hunspell, retext, grammalecte…).

→ **Vrai gap.** Pas un checker à réparer ; une capacité à ajouter.

## 2. Objectif

Détecter, dans les meta SEO générées (titre/descrip/H1) **et** dans les fragments switch sources, les défauts : grammaire, conjugaison, accords, orthographe, **phrase incomplète/sans verbe**, ponctuation. **Report-first, zéro auto-correction** (cohérent doctrine `seo-qa` « ne corrige JAMAIS auto, analyse et rapporte »).

**Non-objectifs (YAGNI)** : pas de réécriture auto, pas de gate runtime en V1, pas de nouvelle table, pas de modification d'URL/meta optimisées manuellement.

## 3. Approche retenue (best-in-class, pas de bricolage)

**Moteur : LanguageTool FR auto-hébergé** (open-source, image Docker officielle `erikvl87/languagetool` ou équivalent, API REST `/v2/check`).

Pourquoi ce choix vs alternatives :
| Option | Verdict |
|---|---|
| **LanguageTool self-hosted** ✅ | Standard moderne FR (grammaire+orthographe+style), règles maintenues, **déterministe**, **0 coût/requête**, **self-hosted** (No Paid Render), API REST simple. **RETENU.** |
| Regex/règles maison | ❌ Bricolage explicitement exclu. Ne couvre jamais la conjugaison/accords FR. |
| API payante (Antidote, Grammarly) | ❌ Payant + non self-hostable. Viole No Paid Render. |
| LLM (Claude) par item | ❌ Non-déterministe, coût par item, lent sur 6542 fragments + milliers de combos. Réservable plus tard à une revue éditoriale ciblée, pas au gate de masse. |

**Intégration : extension du framework qualité existant**, pas de système parallèle (`feedback_verify_existing_first`). Le score linguistique deviendra (Phase 2) une **dimension** de `quality-scoring-engine`.

## 4. Architecture

### Composants (chacun une responsabilité claire, testable isolément)

1. **Service LanguageTool (infra)** — `docker-compose.languagetool.yml` (suit le split per-service existant : `docker-compose.meilisearch.yml`, `…redis.yml`). Conteneur LT, langue `fr`. Exposé en local au backend.
2. **`LanguageToolClientService`** (`backend/src/modules/seo/linguistic/`) — wrappe l'API REST `/v2/check`. Entrée : texte FR. Sortie : `LinguisticIssue[]` (typé : `ruleId`, `category`, `message`, `offset`, `length`, `badFragment`, `suggestions[]`, `severity`). URL via **`LANGUAGETOOL_URL`** (convention `*_URL` existante ; ajouté à `.env.example`). Timeout + fallback propre si LT indispo (l'audit reporte « moteur indisponible », ne crash pas).
3. **`LinguisticAuditRunner`** (script/commande backend) — orchestration V1 :
   - **Source A** : les 6542 fragments `__seo_gamme_car_switch` (par alias).
   - **Source B** : échantillon représentatif de meta **rendues** — réutilise le **vrai** `SeoTemplateService.processTemplates` sur les templates `__seo_gamme_car` × N motorisations (multi-gammes), pour capter les défauts de **composition** (le cas « 207, au meilleur… »).
   - Passe chaque texte dans `LanguageToolClientService`, agrège, classe par sévérité/catégorie.
4. **Rapport** — `docs/seo/linguistic-audit/2026-..-r2-linguistic-audit.{md,json}`. Pas de DB, pas de table (cohérent garde-fou « zéro nouvelle table »).

### Flux de données (V1)

```
__seo_gamme_car_switch (6542)  ┐
                               ├─► LinguisticAuditRunner ─► LanguageToolClientService ─► LT(fr) ─► issues[]
SeoTemplateService.render(...) ┘                                                                     │
   (templates × motorisations)                                                                       ▼
                                                          rapport .md + .json (sévérité, catégorie, texte, suggestion)
```

### Classification des défauts
- `INCOMPLETE_SENTENCE` (phrase sans verbe — cible #1)
- `GRAMMAR` / `AGREEMENT` (accords)
- `CONJUGATION`
- `SPELLING` (orthographe)
- `PUNCTUATION` / `TYPOGRAPHY`
- `STYLE` (informatif, non bloquant)

## 5. Phase 2 (hors V1, après lecture de l'audit)
- Dimension `linguistic` (score 0-100 dérivé de la densité d'issues bloquantes) ajoutée à `quality-scoring-engine` (profils seuil/poids existants).
- **Gate** : un contenu/fragment avec issue bloquante (grammaire/conjugaison/phrase incomplète) ne ship pas avant correction humaine. Report-first maintenu (pas d'auto-fix).
- Décision Phase 2 conditionnée aux chiffres de l'audit V1 (combien de fragments/combos réellement cassés).

## 6. Gestion d'erreurs
- LT indisponible/timeout → l'audit marque les items `engine_unavailable`, n'invente pas de verdict, exit code distinct. Jamais de faux « OK ».
- Fragment vide / non-FR → ignoré proprement, compté à part.

## 7. Tests
- Unit `LanguageToolClientService` : LT mocké, mapping réponse→`LinguisticIssue[]` (cas grammaire, orthographe, vide, erreur réseau).
- Unit classification : phrases FR connues bonnes/mauvaises (dont « groupe nominal, complément » sans verbe → `INCOMPLETE_SENTENCE`).
- Le runner : testé sur un mini-échantillon fixture (pas d'appel réseau réel en CI ; LT mocké).

## 8. Garde-fous respectés
- Verify-existing : étend le framework qualité, conventions `*_URL` + `docker-compose.<svc>.yml`.
- Zéro nouvelle table, zéro URL modifiée, zéro meta réécrite.
- Report-first, zéro auto-correction.
- Branche dédiée + worktree.
- Déterministe (LT, pas LLM).

## 9. Critères de succès V1
- Rapport produit sur les 6542 fragments + échantillon meta rendues, avec décompte par catégorie/sévérité et exemples (texte fautif + suggestion).
- Le cas « 207, au meilleur rapport… » est détecté et classé `INCOMPLETE_SENTENCE`.
- Aucune écriture DB ; LT tourne en conteneur local self-hosted.
