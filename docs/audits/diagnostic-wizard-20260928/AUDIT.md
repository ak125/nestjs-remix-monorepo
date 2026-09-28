# Vérification approfondie — sélection et reprise du diagnostic, 28 septembre 2026

Statut de ce cinquième lot : **VALIDATED_FOR_SCOPE_ONLY**. Couverture du rapport initial : **PARTIAL_COVERAGE**.
Demande autorisée : « Vérifier le rapport et corriger le code », puis « continuer les corrections et améliorations ».

## Résultat pour l'utilisateur

Après un changement rapide de marque ou de système mécanique, une ancienne réponse réseau ne remplace plus la sélection courante. Les anciens symptômes disparaissent pendant le chargement. Le bouton d'analyse reste désactivé tant que le catalogue courant n'est pas validé ou qu'un symptôme restauré n'y existe plus.

Pendant une analyse, ou si elle échoue, les saisies restent dans un brouillon reprenable à l'étape 2. Un rechargement retrouve les symptômes choisis. Un diagnostic réussi avec son dossier de résultat efface ce brouillon ; le comportement de conservation propre à l'entretien est préservé. Deux clics rapides sur « Suivant » ne font plus sauter l'étape des symptômes.

Ces changements fiabilisent le parcours existant. Ils n'améliorent pas, à eux seuls, la justesse mécanique des causes calculées.

## Défauts reproduits et corrections

| Défaut confirmé | Correction et preuve |
|---|---|
| Réponse tardive d'une ancienne marque, remise à zéro ou nouvelle sélection de la même marque | Génération de requête dans `use-diagnostic-vehicle-selector.ts:15`. Seule la génération courante peut modifier modèles, erreur ou chargement. Invalidation au démontage et à l'effacement. |
| Symptômes d'un autre système ou ancien échec remplaçant un chargement récent | Annulation native des fetch, contrôle du signal après résolution, liste liée au système demandé, nettoyage au démontage dans `StepSymptom.tsx:86`. Les tests comprennent un transport ignorant l'annulation. |
| Catalogue HTTP invalide accepté et sélection restaurée non vérifiée | Statut HTTP et schémas Zod vérifiés ; slugs uniques, libellés non vides, urgence connue, descriptions nulles acceptées. Disponibilité reliée au wizard, `StepSymptom.tsx:147` et `DiagnosticWizard.tsx:441`. |
| Brouillon supprimé dès l'entrée en analyse | Sauvegarde d'une étape 2 reprenable ; suppression après succès avec `evidence_pack`, `DiagnosticWizard.tsx:128`. Tests sur attente, erreur, remontage et succès. |
| État local corrompu ou écrasé au montage | Schéma structurel, version 1 avec compatibilité des anciens brouillons non versionnés, âge entre 0 et 7 jours. L'écriture attend la restauration ; test React StrictMode. |
| Deux temporisations provoquant deux avancées | Une transition à la fois et annulation de sa temporisation au démontage, `DiagnosticWizard.tsx:338`. |

Le schéma du brouillon protège la structure, les valeurs numériques finies non négatives et la durée de vie. Il ne remplace pas la validation métier serveur : carburant, profil d'usage et date d'entretien restent des chaînes dans ce stockage local. Il ne prouve ni l'identité métier du véhicule ni l'existence d'une opération. Les valeurs zéro restent conservées.

Le compteur de génération est limité au hook véhicule : l'API existante n'accepte pas de signal d'annulation. Les requêtes peuvent donc terminer en arrière-plan ; leur réponse périmée est ignorée. Les fetch des symptômes utilisent le mécanisme natif d'annulation en plus du contrôle de fraîcheur.

## Validation exécutée

- Avant correction : **30 échecs et 5 succès sur les 35 nouveaux cas**. Journal `validation/frontend-red.log`.
- Résultat final : **80 tests réussis dans 7 fichiers**, dont les 35 nouveaux cas, sur les vrais composants et hooks. Frontières réseau simulées. Journal `validation/frontend-final.log`.
- Les cinq anciens tests de soumission ont été adaptés pour attendre la disponibilité du bouton ; leurs assertions de charge utile sont conservées. Leur échec intermédiaire provenait du nouveau blocage pendant le chargement, pas d'une suppression du contrôle.
- Contrôle complet des types frontend réussi : `tsc --noEmit --incremental false -p tsconfig.json`, mémoire plafonnée à 4096 Mo. Journal `validation/frontend-typecheck.log` ; sortie vide et code 0.
- Lint des six fichiers : **0 erreur, 0 avertissement** après rangement des imports et retrait d'un import de test inutilisé. Journal `validation/frontend-lint-final.log`.
- Construction Vite du banc navigateur avec les vrais composants et CSS réussie. Des polices/images non copiées dans ce banc sont signalées ; ce n'est pas un build complet de l'application.

Le dernier lot backend reste une preuve historique : 277 tests / 15 suites, types backend et contre-preuves SQL du lot MCP. Aucun fichier backend, dépendance ou configuration n'est modifié ici. Les empreintes antérieures hors des six fichiers de ce lot sont contrôlées à l'assemblage ; la différence complète entre les arbres candidats est limitée à ces six fichiers et à la documentation.

## Preuve navigateur et limites

Un banc local compilé affiche « Vérification DEV · API simulée » et utilise le vrai `DiagnosticWizard`. Le navigateur intégré a montré : sélection initiale restaurée, lancement de l'analyse, erreur simulée visible, rechargement réel de la page, retour à l'étape 2 avec « Bruit au freinage » coché et bouton d'analyse actif. Le changement rapide Moteur → Freinage se termine avec le seul symptôme de freinage et impose une nouvelle sélection.

Les captures `browser/error.png` et `browser/recovery.png`, les états accessibles et `browser/evidence.json` documentent ce parcours. Le banc ne réinitialise le stockage qu'au premier chargement de sa session : le rechargement prouve la reprise enregistrée par le composant. Aucun stockage interne n'a été lu par l'outil navigateur. Les tests unitaires apportent la preuve déterministe des différentes résolutions réseau dans le désordre.

Le serveur temporaire local et l'onglet de test ont été fermés. Le banc source est conservé dans le livrable ; sa compilation était réalisée dans `output/playwright/wizard-20260928` du worktree DEV, puis déplacée hors du dépôt. Les captures ne prouvent ni une API connectée, ni un contrôle mobile, ni une CI, ni PREPROD/PROD. Aucun accès DB n'a été nécessaire dans ce lot.

## Réexamen des questions complémentaires et des codes défaut

La vérification ciblée confirme l'écart du rapport sans inventer de règle de calcul. Les types générés déclarent `__diag_context_questions` et `dcq_weight_modifier: Json | null` (`database.types.ts:2125`), sans relation ou formule exploitable. L'entrée accepte un dictionnaire de réponses ; le chemin observé les conserve en session, mais ne les transmet pas au calcul des causes. Aucun consommateur de cette table n'a été trouvé dans la recherche ciblée du backend et du frontend. Sa présence et son contenu en base n'ont pas été vérifiés dans ce lot.

Le gestionnaire de saisie DTC du parcours index renvoie vers un paramètre `dtc` sans consommateur établi dans le parcours inspecté. Une redirection ne constitue pas une analyse de code défaut. Le raccordement n'a pas été fabriqué et la route indexée n'a pas été modifiée.

| Constat du rapport initial | État après ce lot |
|---|---|
| D05 — dossiers et reprise | **Partiel** : reprise du brouillon local réparée ; dossier serveur consultable/rejouable et partage non traités. |
| D02 — données indisponibles acceptées | Protection étendue aux catalogues de symptômes/systèmes et aux sélections restaurées ; pas d'audit global de toutes les API. |
| D07 — validations insuffisantes | 35 nouveaux cas et 80 tests ciblés verts, preuve navigateur simulée ; intégration connectée et CI encore ouvertes. |
| B01/B02 — questions et effet des réponses | Ouvert : contrat métier de questions, options et effet sur le classement à établir. |
| B04/B05 — modes et DTC | Ouvert/partiel selon les lots antérieurs ; aucun parcours DTC nouveau. |
| C01/C03/C05 — identités, MCP et fragmentation | Conclusions antérieures conservées ; aucun mapping ou raccordement ajouté. |

Les autres constats des quatre lots précédents restent inchangés. En particulier, aucun pourcentage de précision mécanique, correspondance constructeur ou effet causal nouveau n'est revendiqué. Ce lot ne clôt pas les 28 constats du rapport initial.

## Candidat et reprise

Travail non commité dans `/opt/automecanik/app/.claude/worktrees/codex-diagnostic-integrity-20260926`, compte `deploy` sur `dev-automecanik`, branche `codex/diagnostic-integrity-20260926`. Base `4a2871dc4d19067c3ae077d6a79021b49cc60237`, précédent candidat `c50a4f9d1bf725abb3311363028892ca3598e0e8`.

`patch-verification.json` identifie l'arbre final, les deux reconstructions, les empreintes et l'applicabilité au main observé. Le patch cumulé contient les cinq lots ; `wizard-only.patch` part exclusivement du précédent candidat. L'index réel est préservé. Les instructions d'intégration et de retour arrière figurent dans `LISEZ-MOI.md`.

Aucun commit, push, PR, déploiement ou changement DB. Prochaine action utile : choisir un parcours restant et établir son contrat vérifiable avant activation, puis obtenir une preuve HTTP connectée du candidat intégré. Le checkpoint permet de poursuivre sans relancer les validations inchangées.
