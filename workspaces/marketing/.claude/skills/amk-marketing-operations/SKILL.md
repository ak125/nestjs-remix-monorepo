---
name: amk-marketing-operations
description: Use when checking AutoMecanik campaign capabilities, shared solicitation limits, offline approval requests, economic reports or controlled experiment preparation. Excludes real authorizations, provider actions, production monitoring, payment changes and Fafa video analytics.
type: technique
status: experimental
owners: ["@ak125"]
domain: D12
runtime_class: read-only
llm_safe: true
last_verified: "2026-10-02"
metadata:
  version: "2.1.4"
---

# amk-marketing-operations

## Entrées et périmètre

Checkout AutoMecanik vérifié, objectif commercial, scénario et corpus synthétique. Lire [la recette de préparation et de chargement](../amk-marketing-preparation/references/workbench.md) puis [l'exploitation bornée](references/operations.md). Aucun compte d'expédition ni autorité d'approbation n'est connecté.

## Outils et étapes

1. CLI existant `scripts/marketing/run-reactivation-pilot.ts --operations` avec `tsx` et le tsconfig de la recette. Lire capacités, arbitrage commun, demande d'autorisation et contrôles de délivrabilité.
2. Expliquer préparer/différer/exclure/transmettre. Une opposition commune n'est pas contournée par SMS ou WhatsApp. Le plafond simulé appartient à un seul lot ; aucune atomicité entre processus n'est démontrée.
3. Pour l'économie, employer `--report` : montants entiers par devise, taxes explicites, coûts et attribution inconnus visibles. Lire groupes témoins et incertitude. Ni ouverture ni clic ne prouve une commande ou un gain causal.

   Les frais marketing exigent une date `at` issue de leur source : seuls ceux de `[from,to)` contribuent au rapport. Aucune date par défaut n'est inventée pour un ancien enregistrement. Lire `snapshot_at` pour savoir jusqu'à quand les remboursements sont observés. Une cohorte de ventes ajustée de ses remboursements observés n'est pas un relevé de trésorerie.

4. Une réponse fournisseur incertaine impose rapprochement ; ne pas renvoyer ni changer de fournisseur. Une suspension simulée bloque les propositions encore locales ; les messages déjà acceptés ne sont pas rappelables.
5. Produire les cinq états AEC et le coverage manifest avec `amk-marketing-validation`. Les mandats expirés/suspendus sont refusés et l'autorité absente interdit toute exécution. Présenter les dépendances nommées, sans demander une approbation abstraite pour contourner le blocage.

## Sorties et escalades

Rapport JSON déterministe, sans adresse ni secret. Le CLI n'accepte ni `--approved`, ni `--send`, ni source client arbitraire. Aucun cron ou réglage de confiance n'est activé. Les clés éventuellement présentes dans l'environnement ne sont pas lues.

Pour le scoring, lire les périmètres : `recency_scope` inclut les événements d'achat vérifiés du contact ; `purchase_metrics_scope` limite fréquence, montants et contribution d'achat au score à l'historique fourni. Un événement sans ligne métier rapprochée ne crée ni valeur financière ni commande supplémentaire. Historique incomplet → récence et score inconnus.

Une future action A2 doit vérifier son autorité à l'extérieur de l'agent et immédiatement avant l'effet. Un budget de plan ne garantit pas le débit d'un prestataire. Exiger lot concret, compte exact, bornes, expiration, révocation, journal officiel et retour arrière avant activation séparément autorisée.
