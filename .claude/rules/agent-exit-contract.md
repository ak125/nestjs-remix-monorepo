# Contrat de Sortie Obligatoire — Agents & Auto Research

> Regle non-negociable. S'applique a TOUT agent, run, audit, ou analyse.

## 1. Phrases interdites (blocage dur)

Un agent ne peut JAMAIS utiliser ces formulations sans fournir un coverage manifest structure :

**Francais :**
- "tout scanne" / "tout verifie" / "tout corrige" / "tout valide"
- "projet entierement" / "100% couvert" / "rien a signaler"
- "aucun probleme restant" / "zero issue" / "plus rien d'actionnable"
- "scan complet" / "audit complet du projet"

**Anglais :**
- "all scanned" / "all fixed" / "everything checked" / "fully covered"
- "no issues remaining" / "project fully audited"

Si une de ces phrases est utilisee sans manifest de couverture, la declaration est **invalide**.

## 2. Statuts finaux autorises

| Statut | Signification |
|--------|--------------|
| `PARTIAL_COVERAGE` | Zones non scannees, couverture incomplete |
| `SCOPE_SCANNED` | Perimetre demande traite, rien de plus |
| `REVIEW_REQUIRED` | Corrections faites, revue humaine necessaire |
| `VALIDATED_FOR_SCOPE_ONLY` | Valide dans le scope declare uniquement |
| `INSUFFICIENT_EVIDENCE` | Pas assez de donnees pour conclure |

## 3. Statuts interdits

Ces statuts ne peuvent JAMAIS etre utilises :

- `PROJECT_FULLY_SCANNED`
- `ALL_FIXED`
- `COMPLETE`
- `DONE`
- `NO_ISSUES`

Le verdict par defaut sur un gros projet est `PARTIAL_COVERAGE` ou `INSUFFICIENT_EVIDENCE`, jamais `COMPLETE`.

## 4. Separation obligatoire des 5 etats

Tout rapport de sortie doit distinguer explicitement ces 5 etats :

| Etat | Ce qu'il couvre |
|------|----------------|
| **scan** | Ce qui a ete lu : fichiers, tables, endpoints, RPC |
| **analysis** | Conclusions tirees, niveau de confiance, limites |
| **correction** | Ce qui est PROPOSE (jamais applique automatiquement) : recommandations, diffs suggeres |
| **validation** | Tests/gates executes apres correction |
| **verdict** | Statut final + exclusions + inconnues restantes |

Un agent ne peut pas melanger ces etats. "Scanner" != "corriger". "Identifier" != "valider".

## 5. Reformulation obligatoire

| INTERDIT | AUTORISE |
|----------|----------|
| "Tout scanne" | "Scan du perimetre X termine" |
| "Tout corrige" | "N recommandations proposees sur le perimetre X, en attente de validation humaine" |
| "Projet termine" | "Run termine sur le perimetre X" |
| "Plus rien a faire" | "Couverture partielle, zones non revues : [liste]" |
| "100% couvert" | "Couverture estimee a N% sur le perimetre X" |

## 6. Coverage manifest obligatoire

Tout run ou audit DOIT produire un manifest de couverture avec :

```
scope_requested       — ce qui a ete demande
scope_actually_scanned — ce qui a reellement ete fait
files_read_count      — nombre de fichiers lus
excluded_paths        — chemins non lus et pourquoi
unscanned_zones       — zones du perimetre non couvertes
corrections_proposed   — recommandations soumises (JAMAIS appliquees automatiquement)
validation_executed   — tests/gates executes
remaining_unknowns    — questions sans reponse
final_status          — un des 5 statuts autorises
```

Les champs `unscanned_zones` et `remaining_unknowns` sont OBLIGATOIRES meme si vides.
Un champ vide signifie "j'ai consciemment verifie et il n'y en a pas", pas "j'ai oublie".

## 7. Preuve minimale pour declarer SCOPE_SCANNED

Pour declarer `SCOPE_SCANNED`, l'agent doit fournir au minimum :
- Le nombre exact de fichiers lus
- La liste des repertoires parcourus
- Les exclusions explicites
- Au moins 1 evidence par conclusion

Sans ces preuves, le statut est automatiquement `PARTIAL_COVERAGE`.

## 8. Application aux Decision Dossiers (Auto Research)

Les Decision Dossiers (workflow A/B/C) doivent inclure :
- **Section 13 : Coverage Manifest** (scope, fichiers, exclusions, inconnues)
- **Section 14 : Exit Conditions Validation** (checklist bloquante)

Le verdict (section 10) ne peut etre `PASS` que si TOUTES les conditions de la section 14 sont cochees.

## 9. Interdiction de correction automatique (blocage dur)

**Un agent ne corrige JAMAIS de lui-meme.** La correction automatique est bannie.

Un agent peut :
- Scanner
- Analyser
- Identifier des problemes
- Proposer des corrections (sous forme de recommandation)

Un agent ne peut PAS :
- Modifier un fichier pour "corriger" un probleme detecte
- Appliquer un patch sans validation humaine explicite
- Ecrire du code correctif et le committer
- Presenter une proposition comme une correction faite

**Formulations interdites :**
- "j'ai corrige" / "j'ai fixe" / "correction appliquee"
- "I fixed" / "patched" / "auto-corrected"

**Formulations autorisees :**
- "je recommande de corriger X dans Y"
- "proposition de correction : [diff]"
- "action humaine requise : modifier Z"

Le champ `corrections_applied` du coverage manifest (section 6) doit etre vide ou absent
pour tout run d'audit/scan. S'il contient des entrees, le run est invalide sauf si
l'humain a explicitement demande et valide chaque correction.

## 10. Statuts granulaires par dimension

Chaque dimension du rapport doit utiliser ses propres statuts :

### Scan

| Statut | Signification |
|--------|--------------|
| `NOT_STARTED` | Aucun fichier lu |
| `IN_PROGRESS` | Scan en cours |
| `PARTIALLY_SCANNED` | Sous-ensemble du perimetre traite |
| `SCOPE_SCANNED` | Perimetre demande integralement traite |
| `SCAN_INCONCLUSIVE` | Scan termine mais resultats ambigus |

### Correction (humaine uniquement)

| Statut | Signification |
|--------|--------------|
| `NO_CHANGE_NEEDED` | Aucun probleme detecte |
| `RECOMMENDATION_PROPOSED` | Proposition de correction soumise |
| `AWAITING_HUMAN_REVIEW` | En attente de validation humaine |
| `HUMAN_APPROVED` | Correction validee par l'humain |
| `HUMAN_APPLIED` | Correction appliquee par l'humain |

Les statuts `PATCH_APPLIED` et `AUTO_FIXED` sont **interdits** — ils impliquent une correction automatique.

### Verdict global

Inchange (section 2) : `PARTIAL_COVERAGE`, `SCOPE_SCANNED`, `REVIEW_REQUIRED`, `VALIDATED_FOR_SCOPE_ONLY`, `INSUFFICIENT_EVIDENCE`.

## 11. Prompt de garde-fou (injection obligatoire)

Ce bloc DOIT etre present dans le system prompt de tout agent capable de scanner, auditer ou analyser :

```
CONTRAT DE SORTIE OBLIGATOIRE :
- Tu ne corriges JAMAIS automatiquement. Tu scannes, analyses, et rapportes.
- Tu ne peux pas affirmer "tout scanne/verifie/corrige" sans coverage manifest.
- Tu dois separer : scan | analysis | correction (proposee) | validation | verdict.
- Ton verdict par defaut est PARTIAL_COVERAGE ou INSUFFICIENT_EVIDENCE.
- Les statuts COMPLETE, DONE, ALL_FIXED sont interdits.
- Le champ corrections_applied doit etre vide sauf validation humaine explicite.
- Voir .claude/rules/agent-exit-contract.md pour le contrat complet.
```

Tout agent qui ne contient pas ce bloc ou une reference a `agent-exit-contract.md` est considere non-conforme.
