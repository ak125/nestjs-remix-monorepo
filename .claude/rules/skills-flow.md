# Skills Flow — Triggers & Chainage

> Claude lit ce fichier a chaque conversation. Il definit QUAND proposer un skill et COMMENT les skills se chainent.

## Regle de proposition

**TOUJOURS proposer, JAMAIS lancer automatiquement.**

Format obligatoire :
> "Je recommande `/skill-name argument` car [raison en 1 phrase]. Tu veux que je lance ?"

Exception : les skills avec `disable-model-invocation: true` ne peuvent etre lances que manuellement par l'utilisateur.

---

## Auto-suggestion

Quand un de ces contextes est detecte, **proposer** le skill correspondant :

| Contexte detecte | Skill a proposer | Argument suggere |
|------------------|-----------------|-----------------|
| Modification dans `modules/payments/` | `/payment-review` | fichier modifie |
| Modification dans `modules/rag-proxy/` ou erreur chat RAG | `/rag-ops diagnose` | — |
| PR ou diff avec 5+ fichiers | `/code-review` | numero PR |
| Construction composant UI / nouvelle page | `/frontend-design` | description composant |
| Demande audit SEO, contenu, ou qualite page | `/content-audit` | URL ou role (R1-R6) |
| Mention mobile, responsive, touch targets | `/responsive-audit` | URL de la page |
| Mention migration, DDL, schema, ALTER TABLE | `/db-migration` | nom migration |
| Demande tests endpoints ou curl | `/backend-test` | endpoint |
| Mention design system, tokens, couleurs, typo | `/ui-ux-pro-max` | requete design |
| Demande audit UI complet ou coherence design | `/ui-os` | full-audit ou phase |
| Production contenu SEO pour une gamme | `/seo-content-architect` | nom gamme |
| Mention governance, vault, DEC, ledger | `/governance-vault-ops` | — |
| Bug vehicule, V-Level, compatibilite pieces, cache vehicule | `/vehicle-ops` | diagnose, vlevel, cache, ou quality |

---

## 3 Chaines declarees

### Chaine CONTENU (sequentielle)

```
content-audit → rag-ops → seo-content-architect
```

1. `/content-audit [page]` detecte lacunes (preuves faibles, FAQ manquante, score < 4/6)
2. Si corpus RAG insuffisant → proposer `/rag-ops ingest`
3. Si contenu a produire/reecrire → proposer `/seo-content-architect [gamme]`
4. Apres production → proposer `/content-audit` pour valider

### Chaine UI (sequentielle)

```
ui-os → frontend-design → ui-ux-pro-max → responsive-audit
```

1. `/ui-os full-audit` identifie les lacunes du design system
2. `/frontend-design [composant]` construit les composants manquants
3. `/ui-ux-pro-max [composant]` valide standards (contraste WCAG, accessibilite)
4. `/responsive-audit [page]` verifie mobile-first et touch targets 44px

### Chaine SECURITE (parallele)

```
code-review ‖ payment-review ‖ backend-test
```

- Quand une PR touche `modules/payments/` → proposer les 3 en parallele
- `code-review` = architecture + securite generale
- `payment-review` = HMAC, callbacks, signatures (specialise)
- `backend-test` = curl validation endpoints gateway

---

## Skills connectes hors chaine

| Skill | Connexions | Note |
|-------|-----------|------|
| `vehicle-ops` | ← seo-content-architect, db-migration / → backend-test, frontend-design | Interagit avec chaine CONTENU (V-Level → SEO) et SECURITE (backend-test) sans sequence stricte |

---

## Skills isoles

| Skill | Pourquoi isole |
|-------|---------------|
| `governance-vault-ops` | Operations ledger, pas de dependance technique avec les autres skills |
