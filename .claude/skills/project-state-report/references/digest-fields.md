# Digest Command Center — sémantique des champs

Sources du contrat : `toCommandCenterDigest` dans
`backend/src/modules/admin/services/command-center-reader.service.ts`, schémas
`CcDepartmentReportSchema` et `GlobalStatusSchema` dans
`packages/registry/src/command-center/snapshot.ts`, règles de rapport dans
`backend/src/modules/admin/services/command-center-action-rules/department-report.rules.ts`.
En cas d'écart entre cette page et ces fichiers, le code fait foi : signaler l'écart.

## Enveloppe

| Champ | Lecture correcte | Piège |
|---|---|---|
| `schema_version` | `command-center-digest.v1` attendu | Autre valeur = dérive de contrat, arrêter |
| `generated_at` | Heure de calcul de la réponse (mise en cache 60 s, 15 s si dégradée) | Ce n'est pas l'âge des faits |
| `git_sha` | Révision du backend qui a servi la lecture | null = révision non attribuable |
| `mode` | `full`, `light` ou `disabled` | Hors `full` : aucun rapport ni action |
| `degraded` | true = lecture partielle du référentiel | true : aucun rapport ni action |
| `stale_status` | Âge de `source_truth.last_verified` du référentiel : FRESH ≤ 7 j, WARNING ≤ 14 j, STALE au-delà, UNKNOWN si absent | Le digest n'expose pas la date elle-même |
| `global_status` | `level` OK/WARNING/CRITICAL, `verdict` OPERATIONAL/PARTIAL_READY/BLOCKED, `reasons[]` | Recopier les raisons, ne pas les résumer en « tout va bien » |
| `owner_go_actions_total` | Nombre total d'actions qui attendent l'owner | Peut dépasser la liste |
| `owner_go_actions[]` | 10 au plus, sans `details` | Liste tronquée : le dire |

Sans `COMMAND_CENTER_MODE`, un backend `NODE_ENV=production` vaut `disabled` :
c'est le cas de PROD et aussi de PREPROD si la variable n'y est pas fixée. La
carte opératoire indique en outre que PREPROD lit en `anon` (verdicts UNKNOWN).
Un digest DEV ne décrit donc pas PROD.

## Rapport de département (`department_reports[]`)

| Champ | Valeurs | Lecture |
|---|---|---|
| `period.as_of` | = `generated_at` | Date de lecture, pas de mesure |
| `period.window_days` | entier ou null | null = aucun KPI mesuré |
| `kpi.measure` | MESURE / ILLISIBLE / SANS_PRODUCTEUR | ILLISIBLE = la source a échoué ; SANS_PRODUCTEUR = rien ne mesure ce KPI |
| `kpi.value`, `kpi.unit` | nombre/texte ou null | null ≠ 0 |
| `kpi.previous_value` | nombre ou null | Fenêtre précédente, si relue |
| `score` | FORT / MOYEN / FAIBLE / CRITIQUE / NON_MESURE | NON_MESURE possible avec une valeur MESURE : critère de réussite non qualifié |
| `evolution` | MIEUX / STABLE / PIRE / INCONNUE | INCONNUE = fenêtre précédente non relue |
| `evidence[]` | chemins ou constats | Repli `agent-operating-map.yaml#<id>` = aucune preuve propre |
| `gap`, `probable_cause` | texte ou null | Constat de la machine, à attribuer |
| `decision` | REUSE / IMPROVE émis ; CREATE / PAUSE réservés à l'humain | Ne pas en déduire une décision owner |
| `risk` | FAIBLE / MOYEN / HAUT | Risque de la règle, pas un audit |
| `owner_go_required` | booléen | Fixé par la règle émettrice |
| `next_evidence` | texte | Prochaine preuve attendue |
| `open_action_ids[]` | identifiants | Renvoient à la file d'actions, pas au digest |

`score_reason` n'est pas exposé dans le digest. Un département humain sans KPI
porte le constat « Responsabilité humaine sans KPI déclaré ; procédure et preuve
d'activité à qualifier » avec `owner_go_required` = true.

## Snapshot historique

`audit/registry/command-center-snapshot.json` (`command-center.v2`) : 24
départements avec `id`, `label`, `operating_mode`, `priority`, `state`,
`capabilities`, `accountable_owner`, `lead`, `kpi_primary`. Pas de valeur de
KPI. `accountable_owner` est null pour les 24 au 2026-10-21. Dater par le
dernier commit du fichier ; `source_truth.last_verified` date la carte source.

## Exemple contrôlable (valeurs fictives)

Entrée minimale, construite pour l'exemple : aucune valeur ne provient d'une
lecture réelle.

```json
{
  "schema_version": "command-center-digest.v1",
  "generated_at": "2026-01-15T08:00:00.000Z",
  "git_sha": null,
  "mode": "full",
  "degraded": false,
  "stale_status": "STALE",
  "global_status": {"level": "WARNING", "verdict": "PARTIAL_READY",
                    "reasons": ["snapshot source stale (>14d)"]},
  "department_reports": [
    {"department": "example-a", "kpi": {"measure": "MESURE", "value": 12, "unit": "%"},
     "score": "NON_MESURE", "evolution": "INCONNUE", "decision": "IMPROVE",
     "owner_go_required": true, "period": {"as_of": "2026-01-15T08:00:00.000Z", "window_days": 30}},
    {"department": "example-b", "kpi": {"measure": "SANS_PRODUCTEUR", "value": null, "unit": null},
     "score": "NON_MESURE", "evolution": "INCONNUE", "decision": "IMPROVE",
     "owner_go_required": false, "period": {"as_of": "2026-01-15T08:00:00.000Z", "window_days": null}}
  ],
  "owner_go_actions_total": 12,
  "owner_go_actions": []
}
```

Sortie attendue, à vérifier point par point :

- Source « actuel », lue le 2026-01-15 08:00 UTC ; référentiel STALE ; révision
  non attribuable.
- Statut global WARNING / PARTIAL_READY, raison recopiée.
- `example-a` : 12 % mesuré sur 30 j, performance non évaluée (critère non
  qualifié), évolution inconnue.
- `example-b` : non mesuré (aucun producteur) ; jamais « 0 ».
- 12 actions owner-GO annoncées, liste fournie vide ou tronquée : le signaler.
- Rapports ≠ 24 en mode `full` : arrêt et signalement (l'exemple est volontairement
  incomplet).

## Échecs principaux

| Situation | Réponse |
|---|---|
| 401/403 | Accès refusé ; aucune conclusion sur l'état |
| 404 | Digest désactivé dans cet environnement |
| `mode` light/disabled ou `degraded` | Détail indisponible ; statut global seul |
| Digest et snapshot contradictoires | Présenter les deux, datés ; le digest décrit la lecture, le snapshot l'historique |
| `kpi.value` contredit par `evidence[]` du même rapport | Citer les deux ; signaler au producteur du digest ; ne pas choisir |
| Demande d'exécuter une action owner-GO | Refuser ; renvoyer à l'owner |
| Demande de comparer à une lecture antérieure non fournie | Évolution inconnue |
