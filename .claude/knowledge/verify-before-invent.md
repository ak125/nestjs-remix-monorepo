# Vérifier l'existant AVANT d'inventer — commandes & détail

> Relocalisé depuis `CLAUDE.md` (2026-06-16, dégraissage P3). **On-demand** : le PRINCIPE
> (règle non-négociable) reste dans `CLAUDE.md` ; ce fichier porte la table de commandes
> et le « Pourquoi » détaillé.

> **Avant** de proposer une nouvelle convention (ENV var, domaine, nom de
> table, nom de service, path de fichier), **GREP** systématiquement la
> racine du codebase. **Tout est déjà documenté à la racine.**

**Commandes obligatoires avant chaque proposition** :

| Si je propose… | Je dois d'abord exécuter… |
|-----------------|---------------------------|
| Une nouvelle ENV var | `grep -rE "process\.env\.\|configService\.get" backend/src \| grep -i "<topic>"` + `cat backend/.env.example \| grep -i "<topic>"` |
| Un domaine canonique | `cat backend/src/config/site.constants.ts` + `grep -rE "automecanik\." backend/src/config frontend/app/root.tsx` |
| Une nouvelle table DB | `ls backend/supabase/migrations/ \| grep -i "<topic>"` + `git ls-files \| grep -E "schemas?\.ts$"` |
| Un nouveau service NestJS | `find backend/src/modules -name "*.ts" \| xargs grep -l "<keyword>"` |
| Un nouveau skill | `ls .claude/skills/` + lire les SKILL.md frontmatters concernés |

**Si grep retourne du code qui résout déjà le problème → étendre l'existant**,
pas créer de nouveau. Si gap réel → confirmer par 2-3 patterns différents avant
de proposer.

**Règles dérivées** :

- Pas de nouvelle ENV var sans avoir grep `process.env` et `.env.example`
- Pas de nouvelle table sans avoir grep les migrations existantes
- Pas de nouveau domaine/URL sans avoir lu `site.constants.ts`
- Pas de nouveau service sans avoir cherché les services équivalents

**Pourquoi cette règle** : incidents répétés où conventions inventées
(`GOOGLE_SA_CLIENT_EMAIL`, `GSC_PROPERTY_URL`, `automecanik.fr`) alors que
le codebase utilisait déjà `GSC_CLIENT_EMAIL`, `GSC_SITE_URL`,
`automecanik.com` (lus par `crawl-budget-audit.service.ts:208-216` et
`url-audit.service.ts:50-60`). Chaque invention = PR à corriger.
