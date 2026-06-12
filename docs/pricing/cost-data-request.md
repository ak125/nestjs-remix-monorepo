# Questionnaire owner — données comptables Phase B

> **Contexte** : la Phase B (compta analytique + seuil de rentabilité)
> ne peut pas être calibrée correctement sans données comptables qui
> ne sont **pas dans la base de données applicative**. Ce document
> liste exactement ce qui est nécessaire, avec le format attendu.
>
> **Sans ces données** : Phase B fonctionne en fallback avec
> estimations industrie et sensibilité ± 30 % — utilisable pour
> identifier les buckets *manifestement* en perte mais imprécis sur
> les buckets borderline. Avec les données réelles : précision
> opérationnelle pour fast-track V1.5.
>
> **Niveau de détail** : agrégats annuels suffisent. Pas besoin de
> ventilation comptable fine. Si un cabinet expert-comptable produit
> un compte de résultat analytique, un dump des comptes 6 et 7 du
> PCG (Plan Comptable Général) suffit largement.

## Cinq inputs nécessaires (12 derniers mois roulants)

### Input 1 — Chiffre d'affaires HT annuel

- **Métrique** : CA total HT sur 12 mois roulants
- **Sources possibles** : compta générale, comptes 7
- **Format** : un seul nombre (€)
- **Pourquoi** : base de la `share_of_total_margin` par bucket et du
  ratio « charges fixes / revenue ».

### Input 2 — Charges fixes annuelles (loyer + utilities + IT)

- **Métrique** : somme annuelle des charges récurrentes
  non-proportionnelles aux ventes
- **Sources possibles** : factures loyer dépôt/bureau, électricité,
  internet, abonnements logiciels (Supabase, hosting, GA, etc.)
- **Format** : un seul nombre (€) ou ventilation 3-4 lignes si dispo
- **Pourquoi** : alloué proportionnellement au revenue dans la
  catégorie « Fixe alloué » du modèle de cost-allocation.

### Input 3 — Masse salariale non-direct annuelle

- **Métrique** : salaires + charges sociales du personnel **non-direct**
  (admin, marketing, IT, comptabilité, direction)
- **Exclusion** : les opérateurs picking/packing/expédition (déjà
  alloués par ligne via les coefficients picking/packing/support)
- **Format** : un seul nombre (€)
- **Pourquoi** : alloué proportionnellement au revenue dans la
  catégorie « Fixe alloué ».

### Input 4 — Coût transport annuel agrégé

- **Métrique** : total annuel des factures transporteurs (Mondial
  Relay, Colissimo, Chronopost, etc.)
- **Format** : un seul nombre (€), idéalement avec nombre de
  commandes expédiées dans la période pour calculer le coût moyen
  par commande
- **Pourquoi** : permet de calibrer `fixed_overhead_per_order` plus
  finement que l'estimation industrie 3–8 €.

### Input 5 — Frais paiement (Paybox / SystemPay) annuels

- **Métrique** : total annuel des commissions paiement (fixe + %)
- **Source** : extraits comptes Paybox/SystemPay, ou ligne dédiée
  dans la compta générale
- **Format** : un seul nombre (€)
- **Pourquoi** : alloué par commande dans la catégorie « Frais
  paiement » (taux moyen 1.2–1.8 % + ~0.10 € fixe en industrie).

## Format de réponse simple

Le plus rapide : une réponse mail ou un petit CSV avec ces 5
nombres, par exemple :

```csv
input,libelle,valeur_eur,notes
1,CA HT annuel,XXXXXX,
2,Charges fixes annuelles,XXXXXX,
3,Masse salariale non-direct,XXXXXX,
4,Coût transport annuel,XXXXXX,nb_commandes=YYYY
5,Frais paiement annuels,XXXXXX,
```

Ou directement dans le mail si plus simple. Les estimations rondes
sont parfaitement utilisables.

## Données *optionnelles* (bonus, pas bloquantes)

Si disponibles facilement, les inputs suivants permettent de
préciser la simulation multi-effets (Phase B.3) :

- **Taux de retour par gamme** (si tracé) — gros impact sur les
  pièces fragiles/électroniques
- **Délai de paiement fournisseur moyen** — affecte le coût du
  capital immobilisé
- **Taux de rupture fournisseur par grand fournisseur** —
  alimente la variable critique « rupture fournisseur »

Pas urgent. Le minimum vital = les 5 inputs ci-dessus.

## Confidentialité

Ces données restent **dans le repo monorepo** (fichier
`docs/pricing/cost-allocation-model.md` dérivé), pas exposées à
l'externe. Aucun salaire individuel, juste les agrégats annuels.

## Prochaine étape post-réponse

1. Affiner `docs/pricing/cost-allocation-model.md` avec les valeurs
   réelles (remplacer les estimations fallback).
2. Re-runner `scripts/audit/pricing-break-even.sql` avec les bonnes
   valeurs.
3. Produire `docs/pricing/break-even-by-bucket.md` avec verdict par
   bucket selon le `decision_closure_protocol`
   (KEEP / MODIFY / REMOVE / STOP / DEFER).
4. Si un bucket sort empiriquement en perte unitaire → PR fast-track
   V1.5 ajustant `min_margin_amount_cents` (pas le taux %, pour
   préserver la forme de courbe).

## Référence doctrine

Voir [`economic-governance-system.md`](./economic-governance-system.md)
pour le cadre conceptuel complet du système pricing (Economic
Governance System), la fonction objectif à 3 contraintes, et le
catalogue d'anti-patterns interdits.
