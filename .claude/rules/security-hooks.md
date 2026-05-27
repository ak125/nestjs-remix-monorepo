# Security-Hooks — pré-filtre advisory, zéro autorité

Plugin marketplace `anthropics/security-hooks` installé en **mode advisory-only**.
Il scanne `Write`/`Edit`/`MultiEdit` avant application et avertit sur patterns
dangereux (`exec`, `eval`, `innerHTML`, `dangerouslySetInnerHTML`, `os.system`,
`pickle`, GitHub Actions injection).

## Règles d'usage

- Un warning déclenche une vérification et, si confirmé, une correction minimale ;
  il ne devient pas un gate bloquant.
- La source de vérité sécurité reste CI : CodeQL, gitleaks, ESLint flat,
  ast-grep, `block-new` ownership, Improvement Gate, tests, review humaine.
- Interdit : transformer security-hooks en gate bloquante, en workflow CI,
  en nouvelle phase ADR-082, en "security control plane".

## Consigne agent

- Respecter les warnings security-hooks lors des éditions.
- Si warning confirmé : préférer la plus petite réécriture sûre.
- Ne pas introduire d'abstraction nouvelle tant que le pattern incriminé
  n'apparaît pas dans 3+ fichiers distincts.
