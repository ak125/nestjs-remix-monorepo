# Security-Hooks — pré-filtre advisory, zéro autorité

Plugin marketplace `security-guidance@claude-plugins-official` (alias affichage
« Security Hooks / Sécurité Conseils ») installé en **mode advisory-only**.
Il scanne `Write`/`Edit`/`MultiEdit` avant application et avertit sur patterns
dangereux (`exec`, `eval`, `innerHTML`, `dangerouslySetInnerHTML`, `os.system`,
`pickle`, GitHub Actions injection).

## Règles d'usage

- Un warning déclenche une vérification et, si confirmé, une correction minimale ;
  il ne devient pas un gate bloquant.
- La source de vérité sécurité reste hors de ce plugin : les contrôles CI
  (CodeQL, gitleaks, ESLint flat, ast-grep, `block-new` ownership, tests) et la
  Definition of Done canonique, règle vault `rules-engineering-definition-of-done`
  (DoD2 amendée par ADR-120). Ce plugin n'ajoute ni ne retire aucune exigence
  de contrôle, de revue ou d'autorisation, zones STOP de CLAUDE.md comprises.
- Recommandations, non bloquantes : les warnings de ce plugin et l'Improvement
  Check (bloc du modèle de PR, skill `continuous-improvement-global` sur demande
  explicite).
- Interdit : transformer security-hooks en gate bloquante, en workflow CI,
  en nouvelle phase ADR-082, en "security control plane".

## Consigne agent

- Respecter les warnings security-hooks lors des éditions.
- Si warning confirmé : préférer la plus petite réécriture sûre.
- Ne pas introduire d'abstraction nouvelle tant que le pattern incriminé
  n'apparaît pas dans 3+ fichiers distincts.
