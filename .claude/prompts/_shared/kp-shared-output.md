# OUTPUT CONTRACT — Keyword Planner (bloc partagé)

Retourne uniquement un JSON valide :

```json
{
  "status": "PLAN_OK | HOLD_INPUT_MISSING | HOLD_EVIDENCE_INSUFFICIENT | HOLD_UPSTREAM_MISSING | REROUTE | ESCALATE",
  "canonical_role": "{ROLE_ID}",
  "generation_mode": "full | targeted | repair",
  "sections_allowed": [],
  "sections_blocked": [],
  "sections_blocked_reasons": {},
  "inputs_missing": [],
  "evidence_status": "SUFFICIENT | PARTIAL | INSUFFICIENT",
  "evidence_per_section": {},
  "reroute": null,
  "target_role": null,
  "warnings": []
}
```

Aucun commentaire hors structure. Le planner ne génère JAMAIS de contenu.
