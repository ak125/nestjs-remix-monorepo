# Diagnostic — entrées sans effet et preuves d’intégration, lot 11

## Résultat

Le contexte du symptôme, la durée d’immobilisation et les réparations récentes étaient acceptés sans modifier le calcul et sans avertissement spécifique. Le résultat indique désormais explicitement ces limites lorsque les champs sont renseignés. Fournir un `session_id` à une nouvelle analyse ne reprend pas cette session : cette limite est également restituée. Ces corrections rendent le comportement observable ; elles n’implémentent pas une interprétation mécanique de ces données.

Deux fichiers de production et deux fichiers de tests sont modifiés dans le worktree DEV `codex/diagnostic-integrity-20260926`. Les changements des lots précédents sont conservés. Aucun commit, push, PR, déploiement, changement RLS ou écriture en base réelle.

## Défauts et corrections

| Entrée | Comportement confirmé | Correction |
|---|---|---|
| `signal_input.context` | Les valeurs contextuelles ne changent pas les hypothèses ni le risque | Limite explicite dans les informations manquantes du résultat |
| `usage_context.immobilized_days` | Accepté sans traitement ; valeurs négatives acceptées | Avertissement, y compris pour zéro ; nombre fini et positif ou nul exigé ; fraction de jour conservée |
| `usage_context.recent_repairs` | Aucun effet sur le diagnostic ou les échéances | Avertissement ; une réparation déclarée ne prouve ni résolution du symptôme ni réalisation des opérations d’entretien |
| `session_id` sur analyse | Aucun mécanisme de reprise/mise à jour de la session fournie | Avertissement distinct ; la route de lecture de session reste le mécanisme de reprise |

Les avertissements d’usage sont également présents dans le bilan d’entretien. Les objets et listes vides ne déclenchent pas d’avertissement injustifié. Le journal contient seulement le nombre de limites, sans recopier les informations fournies.

## Validations

- **Backend : 389 tests réussis, 17 suites**, dont 15 cas supplémentaires. Avant correction : 9 échecs et 108 succès dans les deux suites ciblées. Vérification complète des types backend et lint des quatre fichiers : succès.
- **Frontend inchangé :** les 96 tests / 9 fichiers et les contrôles de types/lint verts du lot 10 sont réutilisés. Les empreintes des fichiers hors delta sont vérifiées avant livraison ; aucune prétention de nouvelle exécution de cette suite.
- **HTTP :** contrôleur Nest réel et moteurs réels sur boucle locale, référentiel figé de 316 lignes et stockage simulé. 62 symptômes rejoués : 58 résultats conformes, quatre refus climatisation maintenus. Les sorties synthétiques de référence restent identiques au lot 9. Les quatre limites ajoutées sont présentes ; une durée négative est rejetée avant sauvegarde. Les trois injections de cause critique absente, inactive ou rattachée au mauvais système restent bloquantes.
- **Base réelle, lecture seule :** projet Supabase `massdoc`, 185 sessions existantes. Les 185 résultats respectent le schéma courant. Une lecture avec le service et le contrôleur actuels restitue exactement le résultat stocké. Les métadonnées SQL confirment les colonnes et la présence des objets `result.evidence_pack`. Les scripts ne publient ni identifiants de sessions, ni contenu des lignes, ni identifiants d’accès. Zéro écriture.
- **Navigateur réel Edge :** composants actuels compilés, résultat issu du rejeu HTTP, API et stockage serveur simulés. Reprise du résultat critique et affichage des quatre limites ; brouillon initial conservé ; zéro nouvelle analyse. Erreur 503 puis récupération au clic : deux lectures et zéro analyse. Session introuvable puis nouveau diagnostic : retour au parcours et retrait du paramètre `session`. Capture examinée. Les seules erreurs console observées concernent deux polices et le favicon absents du banc ; aucun contrôle du presse-papiers n’est revendiqué.
- **CI :** branche candidate absente de GitHub lors du contrôle (404). Le workflow déclenche sur PR et sur push main/dev ; aucun run du candidat n’a été lancé. L’application structurelle d’un patch sur main, détaillée dans `patch-verification.json`, n’est pas une validation CI.

## Limites et prochaine action

La lecture réelle de données persistées est vérifiée, mais **une nouvelle insertion suivie de sa relecture reste non vérifiée**. La base existante est partagée ; cette tâche n’autorise aucune mutation PROD. `usage_context` n’a pas de colonne dédiée dans le stockage observé : les avertissements font partie du résultat, mais le contexte brut n’est pas intégralement conservé pour un rejeu.

Le navigateur vérifie le composant réel, sans prouver la chaîne complète navigateur → application déployée → base. Le bootstrap complet, les cookies véhicule, la couche d’intention optionnelle, PREPROD et PROD ne sont pas validés. Aucun coefficient mécanique n’est inventé pour donner artificiellement un effet aux champs.

Prochaine étape indépendante : préparer une base de test explicitement isolée pour une écriture/relecture réelle et une exécution navigateur sur l’application complète ; publier ensuite un candidat autorisé pour la CI. L’interprétation des contextes et réparations exige des règles métier sourcées et une stratégie de conservation/rejeu avant implémentation.

## Contrat de sortie

Scan ciblé → analyse des consommateurs → correction autorisée en DEV → validations décrites ci-dessus → **VALIDATED_FOR_SCOPE_ONLY**. Le rapport initial reste **PARTIAL_COVERAGE** : ce lot ne clôt pas l’audit global ni les limites métier précédemment identifiées. Le manifeste contient les fichiers et leurs empreintes ; les deux patchs doivent reconstruire le même arbre sans modifier l’index réel.
