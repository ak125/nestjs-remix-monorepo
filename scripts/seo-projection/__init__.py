"""
scripts/seo-projection — Outils Phase B PR-6c (replay deterministic).

Référence : ADR-059 SEO Runtime Projection (accepted), Phase B PR-6c-a.

Composant critical governance G1/G2 :
- replay_projection.py : validation + génération manifest replay depuis snapshots tar.zst
- Tests Hypothesis property-based pour replay determinism
- CI regression workflow

Garde-fous non-négociables (ADR-059 §"Replay infrastructure = critical governance") :
- Replay SoT = tar.zst immutable EXCLUSIVEMENT (jamais git checkout)
- --dry-run par défaut, --apply explicite obligatoire
- Vérification sha256 STRICTE avant extraction (bit-exact match)
- Versions complètes vérifiées : builder/pipeline/extractor/runner/projection_contract
- 0 écriture wiki canon
- 0 LLM
- 0 DELETE/TRUNCATE/DROP/REVOKE
"""
