# Gardes de gouvernance — diagnostiquer avant de corriger

> Règle de conduite née de deux erreurs commises le même jour (2026-08-13), sur I6 puis
> sur le protocole PR-8b. À charger avant toute modification d'un ratchet, d'une règle
> ast-grep, d'un invariant, d'un gate CI ou d'un script `scripts/audit/**`.

## Le symptôme trompeur

**Une garde correcte exécutée au mauvais moment produit exactement les mêmes symptômes
qu'une garde défectueuse.** Dans les deux cas : rien n'est signalé, la dette s'accumule,
et le réflexe est de « réparer le détecteur ».

Cas réel : `registry-fresh.yml` lançait `npm run registry` — qui **reconstruit**
`canonical.json` — **avant** `registry:validate-invariants`. L'invariant **I6**
(`checkCanonicalFresh`) était complet, `severity: error`, `exit 1` — mais il ne validait
jamais que du fraîchement régénéré. **Vacant par construction de l'ordre des steps.**
Diagnostic initial « détecteur cassé » : faux. Correction appliquée : déplacer le step,
pas toucher la logique.

## Les 4 passes obligatoires, dans cet ordre

**1. Lire les tests de la garde.** Ce repo encode ses décisions de conception dans des
tests **anti-overclaim** explicites. Exemple :

> `scripts/audit/build-drift-dashboard.test.ts` — *« canonical liveness ignores recorded
> inputHashes — the dashboard is NOT the freshness engine (I6 is) […] if Signal 2 ever
> goes ⚠️ on hash mismatch it has re-become a freshness gate duplicating I6 »*

Ajouter la comparaison de hash au dashboard créait la **SoT dupliquée** que l'invariant #2
interdit. Le test l'a rattrapé.

**2. Chercher qui d'autre porte la responsabilité.** Invariants (`validate-invariants.ts`),
ratchets (`audit/baselines/**` + `scripts/audit/check-*-ratchet.ts`), README de la zone
(`audit/README.md`, `audit/cleanup/README.md`). Si un composant la porte déjà : le réparer
**lui**, ne pas en créer un second.

**3. Vérifier l'ordre d'exécution** — dans le workflow, dans le hook, dans le script.
Une garde qui contrôle un artefact doit s'exécuter **avant** ce qui le régénère.

**4. Lire le contrat de périmètre de la garde.** Une garde a un scope documenté, et
l'appliquer hors scope la déforme. Exemple : `audit/README.md` documente le protocole
PR-8b comme *« non-runtime, non-`backend/src/modules/**` »* — mesure : **12 candidats
éligibles sur 275**, tous des fichiers de types sans imports. Vouloir y faire entrer du
code de module NestJS était le mauvais instrument, pas un seuil à assouplir : la procédure
prévue était les **conditions #0–#8** et la phase **PR-3 backend NestJS-aware**.

## Interdits

- ❌ Assouplir un seuil pour faire passer un cas qui sort du périmètre de la garde.
- ❌ Ajouter un second détecteur pour une responsabilité déjà portée ailleurs.
- ❌ Traiter un `BLOCKED` comme un verdict de vie quand l'outil dit *« review each hit »* —
  `scripts/cleanup/validate-before-delete.sh` bloque à la granularité du **sous-arbre**
  (il grep tous les `@Controller('…')` de `SUBTREE_DIR`), donc il bloque identiquement les
  fichiers vivants et morts d'un module à surface HTTP vivante. Sa sortie est une consigne
  de revue et de **suppression bottom-up**, pas une preuve d'atteignabilité.
- ❌ Conclure « détecteur cassé » avant les 4 passes ci-dessus.

## Quand la garde est réellement défectueuse

Corriger la cause racine, jamais le symptôme, et **prouver la correction sur un cas réel**
avant de la déclarer livrée (sortie de commande dans le corps de la PR). Si la correction
change la sémantique d'un artefact gouverné, rafraîchir la baseline du ratchet **dans la
même PR** — les ratchets symétriques échouent aussi sur une réduction non déclarée.
