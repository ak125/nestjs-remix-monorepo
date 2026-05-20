<!--
Checklist d'entrée vers le canon (G5 canon-only) — PAS une policy.
Supprimez les sections non applicables. Restez bref.
-->

## Résumé
<!-- Quoi + pourquoi : le « pourquoi » du changement vit ici (cf. CLAUDE.md). -->

## Scope
<!-- CLAUDE.md « Vérifier l'existant AVANT d'inventer » · ambiguïté = stop & demander -->
- [ ] Diff chirurgical, une seule promesse, pas de cleanup opportuniste
- [ ] Existant grepé avant tout nouvel artefact (ENV/table/service/route)

## Verification
- [ ] Commande(s) lancée(s) + sortie collée ci-dessous

## SoT & invariants (si applicable)
<!-- Selon domaine : ADR-058 (ownership) · .spec/00-canon/role-matrix.md (SEO) · payments (HMAC/timingSafeEqual) · no-url-changes -->
- [ ] Aucune vérité parallèle ; invariants touchés identifiés

## Runtime impact (si applicable)
<!-- .claude/knowledge/REPO_MAP.md · feature flag / shadow mode si risqué (ADR-055) -->
- [ ] Surfaces : routes / workers / cron / RPC / cache / RLS / SEO / CI gates

## Rollback (si applicable)
