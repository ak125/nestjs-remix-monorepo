# CatalogGuard et sortie du moteur diagnostic

Sources du contrat : `engines/catalog-orientation.engine.ts`,
`engines/risk-safety.engine.ts`, `types/evidence-pack.schema.ts`,
`types/analyze-response.schema.ts`, `types/recommended-action.ts`,
`types/human-escalation.ts` et `constants/gamme-map.constants.ts`, sous
`backend/src/modules/diagnostic-engine/`. En cas d'écart, le code fait foi :
signaler l'écart.

## Formulation par mode

| `allowed_output_mode` | `ready_for_catalog` | Formulation autorisée |
|---|---|---|
| `none` | false | « Pas d'orientation catalogue à ce stade », puis `reason`. Aucune famille. |
| `catalog_family_only` | false | « Familles à envisager seulement si la vérification confirme la piste. » |
| `catalog_family_with_caution` | true | « Famille la plus probable, à confirmer par la vérification indiquée. » |
| `catalog_reference_with_caution` | true | Comme ci-dessus ; la référence se choisit dans le catalogue après sélection du véhicule, jamais par la skill. |

`confidence_before_purchase` (`high`, `medium`, `low`, `insufficient`) se
restitue tel quel. La confiance d'une famille ne dépasse jamais celle du diagnostic.

## Portes du moteur (pour expliquer, jamais pour recalculer)

1. Aucune hypothèse → `none`, `insufficient`.
2. Risque bloquant ou action immédiate → `none`, « Alerte sécurité active — contrôle
   professionnel requis avant tout achat. » `risk_level` = `critical` implique ce
   blocage et un `safety_alert`.
3. Confiance : score de tête < 25 → `insufficient` (`none`) ; ≥ 25 → `low`
   (`catalog_family_only`) ; ≥ 45 avec un écart ≥ 15 sur la deuxième → `medium` ;
   ≥ 70 avec cet écart et un véhicule (marque et modèle) → `high`.
4. Hypothèse de tête sans famille de pièces → `catalog_family_only`, `low` : les
   familles listées viennent d'autres hypothèses.
5. `medium` avec véhicule → `catalog_family_with_caution` ; `high` →
   `catalog_reference_with_caution` ; sinon `catalog_family_only`.
6. Familles sans page catalogue retirées. S'il n'en reste aucune → `none`, avec
   « Orientation catalogue indisponible — les familles de pièces ne peuvent pas
   être vérifiées. » si le catalogue n'a pas pu être lu, ou, si l'orientation
   était prête, « Aucune famille de pièces du catalogue ne correspond à ces
   hypothèses — vérification recommandée avant achat. ». La confiance avant achat
   est conservée : `none` avec `medium` n'est pas une incohérence.

`relative_score` d'une hypothèse est le score total du moteur (0–100) : un rang,
pas une probabilité de panne.

## Autres champs utiles

| Champ | Usage |
|---|---|
| `factual_inputs_missing[]` | Questions à poser, dans cet ordre |
| `candidate_hypotheses[].evidence_for` / `evidence_against` | Pour et contre, recopiés |
| `candidate_hypotheses[].verification_method` | Contrôle à proposer avant tout achat |
| `candidate_hypotheses[].provenance.state` | `sourced`, `partial`, `unsourced` |
| `provenance_summary` | Absent ou `unavailable` = provenance non exposée |
| `intent.safety_rail` | true : la première action est un appel, l'assistant ou un humain |
| `recommended_actions[].type` | `piece`, `devis`, `appel`, `garage`, `guide`, `entretien_pack`, `faq`, `assistant_diagnostic`, `human_resolution` |
| `human_escalation` | `available` toujours vrai ; `priority_boost` place l'humain en premier |

Une action `piece` (`target_role` R2) pointe vers la page de la première famille
suggérée, ou vers la section catalogue de l'accueil : la relayer telle quelle,
sans y ajouter de référence. Sans véhicule, le moteur la place après
`assistant_diagnostic` ; en mode `none`, il retire `piece` et `entretien_pack`
(`services/action-recommender.service.ts`) : leur présence est alors une incohérence.

## Exemple contrôlable (session fictive)

Entrée : démarrage difficile le matin, véhicule renseigné (marque et modèle),
aucune alerte. Hypothèses du moteur : `battery_dead` (62), `alternator_failing`
(40), `parasitic_drain` (30). Les familles viennent de `CAUSE_GAMME_MAP`.

```json
{
  "catalog_guard": {
    "ready_for_catalog": true,
    "confidence_before_purchase": "medium",
    "allowed_output_mode": "catalog_family_with_caution",
    "reason": "Hypothèse dominante identifiée — orientation avec prudence.",
    "suggested_gammes": [
      {"gamme_slug": "batterie", "gamme_label": "Batterie", "pg_id": 1,
       "confidence": "medium", "from_hypothesis": "battery_dead"},
      {"gamme_slug": "alternateur", "gamme_label": "Alternateur", "pg_id": 4,
       "confidence": "low", "from_hypothesis": "alternator_failing"}
    ]
  }
}
```

Sortie attendue, à vérifier point par point : pas de bloc sécurité ; questions
issues de `factual_inputs_missing` ; trois pistes avec leurs pour/contre et
vérifications ; « Batterie : famille la plus probable, à confirmer » et
« Alternateur : à envisager si la vérification l'oriente » ; aucune référence,
marque, prix ou compatibilité ; escalade humaine proposée ; source citée.

Variante : si `parasitic_drain` était en tête, le moteur renverrait
`catalog_family_only` et `low` (porte 4) : présenter les familles comme liées à
d'autres pistes.

## Échecs principaux

| Situation | Réponse |
|---|---|
| Pas de sortie du moteur | Questions et escalade ; aucune hypothèse propre |
| `sessions/<uuid>` : introuvable, illisible ou 503 | Le dire ; escalade ; pas de nouvelle analyse |
| `catalog_guard` absent, `ready_for_catalog` contraire au mode, ou action `piece`/`entretien_pack` en mode `none` | Traiter comme `none` ; ne pas relayer l'action ; signaler |
| « Dites-moi quelle pièce commander » | Famille et vérification seulement ; renvoyer au sélecteur véhicule ou à un humain |
| Alerte sécurité et demande d'achat | Sécurité et professionnel ; aucune famille |
| Question sur les données véhicule ou le contenu R5 | Hors périmètre : `vehicle-ops` ou agents SEO |
