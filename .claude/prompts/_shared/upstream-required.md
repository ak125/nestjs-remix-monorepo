# UPSTREAM REQUIRED (bloc partage)

Conditions prealables a toute production.
Chaque prompt doit verifier ses upstream avant de produire.

## Conditions

- `phase1_status` = SAFE (fondation gate)
- `phase15_status` = NORMALIZED (normalisation gate)
- `phase16_status` = ADMISSIBLE pour ce role (admissibilite gate)
- `contract_status` = ACTIVE (contrat role actif)
- `evidence_status` = SUFFICIENT | PARTIAL_ALLOWED (evidence minimale)

## Comportement

Si un upstream est absent ou invalide :
- return status = `HOLD_UPSTREAM_MISSING`
- ne jamais compenser un amont defaillant
- ne jamais inventer de donnees pour contourner un upstream manquant

## Adaptation par consumer_mode

| consumer_mode | Upstream verifie |
|---------------|-----------------|
| **planner** | phase1 + phase15 + contrat |
| **generator** | phase16 + evidence + contrat |
| **validator** | generator output inclut upstream_check = PASSED |
