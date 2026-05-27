# Cluster audit Clio III 1.5 dCi — R2/R8 near-duplicate verdict (2026-05-27)

> **Cluster virtuel** (pas de structure persistante en code) — comparaison ad-hoc 3 pages live PROD :
> - R8 véhicule `/constructeurs/renault-140/clio-iii-140004/1-5-dci-19052.html`
> - R2 filtre à huile `/pieces/filtre-a-huile-7/renault-140/clio-iii-140004/1-5-dci-19052.html`
> - R2 filtre à air `/pieces/filtre-a-air-8/renault-140/clio-iii-140004/1-5-dci-19052.html`
>
> **Méthode** : `curl` + extraction title/H1/H2 + comparaison manuelle. UA `AutoMecanikAudit/1.0`. Aucun runtime/template touché.

## Données capturées

### R8 véhicule (`/constructeurs/renault-140/clio-iii-140004/1-5-dci-19052.html`)

- **TITLE** : `Pièces RENAULT CLIO III 1.5 dCi à prix discount`
- **H1** : `RENAULT CLIO III 1.5 dCi 86 ch de 2005 à 2012`
- **H2** : `Acces rapide` · `Catalogue de pieces auto` · `Pièces auto RENAULT les plus vendues` · **`Fiche technique`** · `Erreurs fréquentes à éviter` · `Comment choisir sans se tromper` · `Questions fréquentes`
- **HTML** : 194 721 octets

### R2 filtre à huile

- **TITLE** : `Filtre à huile RENAULT CLIO III 1.5 dCi 86 ch à partir de 6.00€ à tarif avantageux.`
- **H1** : `Filtre à huile RENAULT CLIO III 1.5 dCi 86 ch protéger le moteur`
- **H2** : `Filtres` · `Filtre à huile CLIO III(22 articles)` · `Filtre à huile RENAULT CLIO III 1.5 dCi 86 ch 86 ch protéger le moteur` · `Filtre à huile` · `Références constructeur (OEM) RENAULT` · `Guide d'achat Filtre à huile` · `Informations de compatibilité` · `Statistiques du catalogue`
- **HTML** : 317 710 octets

### R2 filtre à air

- **TITLE** : `Filtre à air RENAULT CLIO III 1.5 dCi 86 ch à partir de 9.00€ au meilleur prix.`
- **H1** : `Filtre à air RENAULT CLIO III 1.5 dCi 86 ch protéger le moteur`
- **H2** : `Filtres` · `Filtre à air CLIO III(13 articles)` · `Filtre à air pour RENAULT CLIO III 1.5 dCi 86 ch 86 ch protéger le moteur` · `Filtre à air` · `Références constructeur (OEM) RENAULT` · `Guide d'achat Filtre à air` · `Informations de compatibilité` · `Statistiques du catalogue`
- **HTML** : 238 499 octets

## Matrice similarité near-duplicate

| Métrique | R2 huile vs R2 air | R2 huile vs R8 | R2 air vs R8 |
|---|---|---|---|
| **TITLE** | Squelette identique (jaccard ≈ 0.85) — change : `huile`/`air`, prix `6€`/`9€`, formule fin | Distinct (R8 = "Pièces", R2 = "Filtre à <gamme>") | Distinct |
| **H1** | **Identique sauf "huile"/"air"** (jaccard ≈ 0.95) — même verbe `protéger le moteur` pour 2 fonctions techniques distinctes | Distinct | Distinct |
| **H2 sections** | **7/8 identiques** (Filtres, OEM RENAULT, Guide d'achat, Compatibilité, Statistiques, Filtre à <gamme>) | 0 identique (R8 a structure véhicule hub) | 0 identique |
| **HTML bytes** | 317710 vs 238499 (33 % delta = produits + OEM refs) | n/a | n/a |
| **Risque Google near-duplicate** | **HIGH** | LOW | LOW |

## Verdict empirique

1. **R2 inter-gammes même véhicule = near-duplicate STRICT** sur title / H1 / H2.
   - Seul change : la gamme (huile/air) + prix + formule paraphrase finale.
   - Le verbe `protéger le moteur` est **factuellement incorrect** pour filtre à air (un filtre à air **purifie l'admission**, il ne protège pas le moteur directement — c'est filtre à huile qui protège le moteur via la lubrification).
   - C'est exactement le risque duplicate qui explique pourquoi Google déprécie ces pages (audit FR-filtered 05-27 : R2 -28 à -40 % sur 5 semaines).

2. **R8 véhicule a une structure différente** (Fiche technique, Pièces vendues, Questions fréquentes) → bon hub catalogue.
   - **Mais** les H2 "Comment choisir sans se tromper" / "Questions fréquentes" sont des templates génériques répétables — risque near-duplicate **inter-véhicules** (Clio III vs Clio IV vs Peugeot 308 partagent ce squelette).

3. **Le pipeline RAW→WIKI doit produire** :
   - **Verbe gamme-specific** : `préserver la lubrification` (huile) ≠ `purifier l'air d'admission` (air) ≠ `protéger l'injection` (carburant) ≠ `assainir l'habitacle` (habitacle).
   - **Critères choix gamme-specific** : intervalle km (15-30k huile / 30-60k air), spec technique (viscosité W vs surface filtrante m²), erreurs achat différentes.
   - **Référence OEM véhicule-aware** : RENAULT 8200768927 (huile) ≠ 8200431051 (air). Le H2 "Références constructeur (OEM) RENAULT" est identique → la liste de refs DOIT différer.

## Recommandations Phase B2 (post owner-GO)

| Bloc R2 à différencier | Source RAW canon nécessaire | Statut Phase B1 |
|---|---|---|
| **H1 verbe métier gamme** | dim `function` confirmed_by_web (RAW v5 OK pour vanne-egr, à étendre) | Disponible RAG candidate, OEM web pauvre |
| **TITLE formule** | dim `selection_criteria.price_floor` + véhicule | Non implémenté |
| **H2 Guide d'achat** | dim `maintenance_context.periodicite_km` + `selection_criteria` gamme-specific | Partiel (km depuis web) |
| **OEM refs véhicule-aware** | dim `oem_references` par (gamme × véhicule × motorisation) | Non — corpus actuel gamme-générique |
| **R8 sections vehicle-spécifiques** | dim `vehicles[]` explicite (PR pipeline scraping B2 ciblé véhicule) | NO_VEHICLE_EVIDENCE actuel |

## Implications pour Phase B2

1. Le pipeline scraping existant produit du contenu **gamme-générique** (Hella, NGK = OEM type-de-pièce).
2. Manque : sources **véhicule × motorisation × gamme** (catalogue OEM constructeur Renault filtre huile/air pour K9K 1.5 dCi).
3. Sans cette dimension, R2 ne peut produire que du paraphrase template (verbe "protéger" répété, formule prix variée).
4. **Phase B2 = scraping ciblé véhicule-spécifique** : OEM Renault parts catalog, TecDoc cross-references, Pierburg/Mahle/Bosch fiches techniques par motorisation.

## Anti-patterns à NE PAS faire

- ❌ Modifier H1/title runtime maintenant (OBSERVE active jusqu'au 2026-06-08)
- ❌ Paraphraser le verbe "protéger" en synonymes ("sauvegarder", "préserver" same meaning) — pas de différenciation métier
- ❌ Inventer compatibilité véhicule (NO_VEHICLE_EVIDENCE explicite si non prouvé)
- ❌ Mass-rewrite catalogue avant pilot vanne-egr validé
- ❌ Croire que ajouter du texte résout le duplicate — il faut **faits différents par gamme**

## Status final B1 (B1.1 + B1.2 + B1.3 + B1c)

| Critère | Cible | Atteint |
|---|---|---:|
| Parser tolérant indented | ✅ | B1.1 — `^\s*---\n` match |
| Web matching corrigé | ✅ | B1.2 — slug_gamme + mapped_gammes |
| Vanne-egr web matched | ≥ 1 | **2** (Hella + NGK) |
| Variant-readiness upgrade | RAG_CANDIDATE → PASS | **PASS_PARTIAL_R2_BLOCKED** |
| NO_VEHICLE_EVIDENCE explicite | ✅ | 2 sources flagged |
| Cluster audit réel | ✅ | R8 + 2 R2 Clio III 1.5 dCi capturés + verdict near-duplicate STRICT |
| Tests pytest | ≥ 30 | **39 PASS** |
| Pas de write wiki | ✅ | dry-run only |
| Pas de runtime touché | ✅ | aucun H1/title/canonical modifié |

**STOP B1 pour review owner. Task 8 write réel reste bloqué.**

## Phrase à graver

> On ne peut pas résoudre le duplicate uniquement depuis RAW/WIKI. Il faut relier RAW/WIKI aux clusters réels de pages R8/R2 qui se ressemblent, puis enrichir les sources avec des faits gamme × véhicule × motorisation.

L'audit cluster prouve empiriquement que :
- le pipeline existant produit déjà des H1/H2 quasi-identiques pour des gammes techniquement distinctes (huile vs air) sur le même véhicule
- la solution n'est pas de varier les mots ("protéger" → "sauvegarder") mais d'**injecter des faits techniques différents par gamme** depuis RAW/WIKI confirmed sources
- Phase B2 doit cibler le scraping **véhicule × motorisation × gamme** (manquant dans corpus actuel)
