# Verdicts sur le vault avant archivage (complément BC-2, décision 108)

Tableau unique du tri final : une ligne par ADR ou PR ouverte de `ak125/governance-vault`, avec
verdict, preuve et action exacte. Rien n'a été fermé, commenté ni fusionné par l'agent : les
fermetures et la fusion sont dans le bloc de la section F, à lancer par Marwane.

Règle de tri (décision 108) : la preuve est dans le code ; un mécanisme en service (L3 ou L4) dont la
règle est encore voulue donne une ligne du journal ou un champ de contrat ; un mécanisme jamais
construit ne donne aucune règle ; une décision de Marwane prime ; un doute réel n'est pas tranché ;
plus aucune ADR n'est fusionnée dans le vault.

## Mise à jour du 2026-11-17 (complément BC-3)

- `main` a reçu #2114 (une ligne « Application » par principe) : la branche était en conflit sur le
  journal. Conflit résolu par une fusion de `main` ; P32 et P33 portent chacun leur ligne
  « Application ».
- **P32 est réduit.** Deux de ses trois phrases redisaient ce que la PR #2122 (mandat BD) pose en
  P35 (chemin d'écriture unique de `pieces_price`) et P36 (jamais de vente à perte). Elles sont
  retirées. P32 garde la troisième : import, activation et affichage sont trois étapes distinctes.
- P33 est inchangé dans sa règle.
- Le changement d'en-tête du journal porté par cette PR est abandonné : `main` l'a déjà.
- Le commentaire de fermeture de #315 cite P32, P35 et P36 : le bloc ne ferme #315 qu'après la
  fusion de #2116 **et** de #2122. Essai à blanc (`git merge-tree`) : #2122 se fusionne sans
  conflit par-dessus cette branche.
- La question D4 (ligne sur les URL) est reprise par P37 de #2122 : voir section D.
- Le relevé des PR du vault (46) n'a pas été rejoué le 17 nov. dans ce fichier.

## Relevé

- **PR ouvertes de `ak125/governance-vault` : 46**, relevé du **2026-11-16T22:44:14Z**, rejoué à
  23:08:57Z (mêmes 46 numéros), par
  `gh api --paginate 'repos/ak125/governance-vault/pulls?state=open&per_page=100'`.
- Le pilotage en comptait 30 à 22:37 UTC. **Écart : 16.** Les 16 PR les plus anciennes sont
  #13, #22, #29, #59, #64, #70, #72, #75, #88, #92, #93, #110, #114, #116, #122, #131.
  Explication probable, **déduite et non vérifiée** (la liste du pilotage n'a pas été vue) :
  `gh pr list` rend 30 lignes par défaut, les plus récentes d'abord ; 46 − 30 = 16.
- Répartition : 13 PR portent un numéro de l'ensemble (2) ; 33 autres PR.
- Références lues : monorepo `origin/main` = `0e2d0e7ed4db` ; vault `origin/main` = `b2e712791bee`
  (clone local et API identiques). ADR-138 et ADR-137 sont fusionnées sur `main` du vault.

## Échelle L0 à L4 (skill `capability-acceptance`, lu sur `origin/main`)

L0 documentée (rien n'est exécuté) ; L1 implémentée (code présent et branché) ; L2 testée isolément
(test vu rouge puis vert) ; L3 intégrée (parcours complet observé en DEV ou PREPROD) ; L4
opérationnelle (servie dans l'environnement cible, observable, retour arrière connu).

**Limite de la mesure.** Aucun test n'a été rejoué, aucun parcours runtime observé. Un niveau
au-dessus de L1 ne repose ici que sur un run CI cité par son identifiant. Pour une garde de CI,
l'environnement cible est la CI elle-même.

## A. Tableau unique

« R-notes » désigne la recherche jouée pour chaque fichier ajouté par une PR : présence sur `main`
du vault (`git ls-tree origin/main -- <fichier>`) et citations dans le monorepo
(`git grep -l -F <nom> origin/main -- .claude docs/audit/mandat-ar-20261116 .spec/00-canon scripts
.github workspaces AGENTS.md CLAUDE.md`). « C#n » renvoie au commentaire de la section C.

### Ensemble 1 : ADR jamais tranchées (sur `main` du vault, `deferred`)

| Objet | Ce que le texte demande | Preuve dans le code | Niveau | Verdict | Action exacte |
|---|---|---|---|---|---|
| ADR-018, consolidation des colonnes doubles | Supprimer les colonnes TEXT redondantes de `auto_*` et `pieces_*`, garder la forme INTEGER, ajouter une gate CI qui refuse les casts. | Rien trouvé : `ADR-018` dans `.claude .spec scripts .github backend/src` = aucune occurrence ; `gate-no-text-cast` dans `.github scripts .ast-grep` = aucune. Voisin en service, d'une autre ADR (017) : `backend/supabase/migrations/20260421_adr017_rpc_pieces_cast_cleanup.sql:8`. | L0 | fermer sans règle | Aucune PR à fermer. Aucune écriture dans le vault (section E). |
| ADR-057, adoption de `marketingskills` | Adopter des skills tiers par wrapper local mince, un pilote par cycle de 30 jours, 17 skills sur 18 bannis. | Rien trouvé : `ADR-057` ou `marketingskills` dans `.claude AGENTS.md CLAUDE.md .spec/00-canon/ai-registry workspaces/marketing` = aucune occurrence ; aucun `skills-lock.json` dans l'arbre. Amendée par ADR-137, elle-même sans mécanisme. | L0 | fermer sans règle | Aucune PR à fermer. Voisin : P26. |
| ADR-073, graphe de faits canoniques SEO | Créer six tables `__seo_canonical_*`, `__seo_fact_*`, `__seo_editorial_*`, un service et un worker pour une gate Rego. | Rien trouvé : `__seo_canonical_entities`, `__seo_canonical_facts`, `CanonicalFactGraphService` dans `backend/src backend/supabase/migrations packages` = aucune occurrence. | L0 | fermer sans règle | Aucune PR à fermer. Corriger dans le monorepo la citation erronée de `.claude/skills/runtime-truth-audit/checks/attribution-write-gap.md:70` (elle parle du panier). |

### Ensemble 2 : numéros d'ADR qui n'existent qu'en PR ouverte

| Objet | Ce que le texte demande | Preuve dans le code | Niveau | Verdict | Action exacte |
|---|---|---|---|---|---|
| ADR-051, PR #211, budget du bundle frontend | Une source unique `audit-reports/bundle-top10.json`, deux scripts et un dossier de preuves pour tout changement de budget. | Rien trouvé : `bundle-top10`, `check-bundle-fresh`, `bundle:report` dans `frontend/package.json package.json .github/workflows scripts/perf` = aucune occurrence. Le fichier dit « baseline shipped » : contredit par `main`. | L0 | fermer sans règle | Fermer #211 avec C#211. |
| ADR-052, PR #241, graphe de handoff des rôles | Créer `packages/seo-roles/src/handoff-graph.ts`, ajouter R1 aux cibles de R6, supprimer `ALLOWED_LINKS`. | Non construit : `ROLE_HANDOFF_GRAPH` = aucune occurrence ; `ALLOWED_LINKS` toujours en service (`backend/src/modules/seo/types/page-role.types.ts:109`, `internal-linking.service.ts:299`). PR monorepo #405 fermée sans fusion le 2026-05-17. | L0 | fermer sans règle | Fermer #241 avec C#241. |
| ADR-052, PR #214, canon SQL des rôles | Déclarer dépréciée la migration `20260124_add_page_role.sql`, sans changer de code. | ADR documentaire, aucun mécanisme à construire. L'en-tête de la migration dit déjà l'état (`backend/supabase/migrations/20260124_add_page_role.sql:20,23`). | L0 | fermer sans règle | Fermer #214 avec C#214. Voisin : P12. |
| ADR-054, PR #242, audit-trail par défaut | Toute session qui produit une ADR livre un audit-trail dans le vault. | Convention interne au vault : aucun mécanisme dans le monorepo. Les « ADR-054 » cités dans le monorepo désignent un autre sujet (`.github/workflows/seo-shadow-flag-guard.yml:7`). | L0 | fermer sans règle | Fermer #242 avec C#242. |
| ADR-084, PR #315, écriture du tarif `pieces_price` | Un seul chemin d'écriture du tarif (module pricing), jamais de vente à perte, import puis activation puis affichage. | Garde CI : `.ast-grep/rules/commerce-no-direct-pieces-price-write.yml:1,6` (`severity: error`), exécutée par `.github/workflows/audit.yml:60`, run 43969954636 vert le 2026-11-16. Runtime : `backend/src/modules/pricing/services/pricing-invariants.service.ts:42,99` (`VENTE_BELOW_ACHAT`), `backend/src/modules/pricing/services/pricing.repository.ts:226`, `price-activation.service.ts:31` ; tests `__tests__/pricing-invariants.test.ts:50`, `__tests__/price-activation.service.test.ts:7` ; affichage `backend/src/modules/catalog/catalog.service.ts:515`. Trois étapes (relevé du 17 nov.) : `price-import.service.ts:44` (par défaut, disponibilité inchangée), `price-activation.service.ts` (ne change que `pri_dispo`), `catalog-display-activation.service.ts` (ne change que `piece_display`) ; leurs tests passent dans le check requis `🧪 Backend Tests`, run 44034187038 vert sur `main` (`187f46ef5`, 06:54 UTC). | L4 pour la garde CI (chemin d'écriture) ; L3 pour les tests des trois étapes (check requis vert) ; usage en service non observé | journal | 1. PR du monorepo qui ajoute P32, réduit aux trois étapes (section B), circuit élevé. 2. Chemin d'écriture unique et vente à perte : P35 et P36 de la PR #2122 (mandat BD), pas de redite ici. 3. Fermer #315 avec C#315 après la fusion de #2116 et de #2122. |
| « ADR-085 » bis, PR #315, trois surfaces fournisseur | Garder trois surfaces fournisseur distinctes sur des briques communes, sans système parallèle. | Présent : `.claude/knowledge/modules/suppliers.md:59,68,89` ; `backend/src/modules/supplier-truth/supplier-sync.flag.ts:13,16` (surface dormante). Déjà porté par le contrat du département 12 (champ `source`, « supplier-truth inerte tant que SUPPLIER_TRUTH_SYNC_ENABLED ne vaut pas true »). Le numéro 085 est pris sur `main` par un autre texte (P7). | L1 | fermer sans règle | Même PR #315, même commentaire. Voisins : P23 et contrat 12. |
| ADR-097, PR #344, tests soumis à la gate d'ownership | Retirer les fichiers de test des exceptions de la gate `block-new`. | Non construit : `scripts/registry/check-new-files.js:70-75` exempte toujours `**/*.test.ts`, `**/*.spec.ts`, `**/__tests__/**`. | L0 | fermer sans règle | Fermer #344 avec C#344. |
| ADR-122, PR #392, voix marketing | Appliquer trois textes approuvés par Marwane le 2026-11-04 (sourcing factuel, préparations éditoriales, polices de secours). | Aucun des trois n'est appliqué : `.claude/canon-mirrors/marketing-voice.md:6,41-42` (version 1.0.0, ancienne clause) ; `workspaces/marketing/.claude/rules/marketing-batch.md:45` ; `design-system/UX-CONSTITUTION.md:24,26`. | L0 | à décider par Marwane | Fermer #392 avec C#392. Suite dans le monorepo : question D1. |
| ADR-131, PR #413, qualification technique avant promotion WIKI | Ajouter une condition `technical_qualification_pass` : qualification par fiche et contestation par une autre famille de modèles. | Non câblé : `workspaces/seo-batch/.claude/skills/seo-content-loop/SKILL.md:149` (« aucune pièce câblée ») ; rien sur `main` du WIKI (`technical_qualification`, `qualification-technique` = aucun fichier) ; PR WIKI #134 en brouillon. Le texte de la PR dit « Je ratifie ADR-131 » (2026-11-15). | L0 | à décider par Marwane | Fermer #413 avec C#413. Suite dans le monorepo : question D2. |
| ADR-132, PR #414, auteur éditorial et signature | Cinq rôles pour tout contenu publié ; aucune signature ne nomme un LLM comme auteur. | Signature en service : `frontend/app/routes/blog-pieces-auto.conseils.$pg_alias.tsx:386` (`Automecanik - Experts Automobile`). Mention en cause : `frontend/app/components/blog/EditorialTrust.tsx:11`. Question Q4 du texte ouverte, réservée à Marwane. | L1 pour la signature ; L0 pour les cinq rôles | à décider par Marwane | Fermer #414 avec C#414. Suite dans le monorepo : questions D3a et D3b. |
| ADR-133, PR #416, niveau B de la fusion automatique | Créer une seconde GitHub App de revue, clé sur le DEV, revue de préférence par Codex. | Non construit : `level_b` dans `scripts/ci/merge-perimeter-gate.mjs scripts/ci/merge-circuit.mjs .github/workflows` = aucune occurrence ; PR monorepo #2079 ouverte, non fusionnée. | L0 | fermer : conflit avec P20 (décisions 72 et 91, constat AR-6) | Fermer #416 avec C#416. Le sort de la PR monorepo #2079 suit. |
| ADR-134, PR #415, DoD5 nomme des mesures qui existent | Chaque test de la DoD nomme une mesure existante ; ce qui n'est pas mesuré est écrit comme tel. | Mesures en service : `.github/workflows/migration-ledger-freshness.yml`, runs 43677471198 et 43805923442 verts sur `main` (15 et 16 nov.) ; `.github/workflows/registry-fresh.yml`, run 43971112459 vert sur `main` (`0e2d0e7ed`) ; `scripts/ci/apply-supabase-migration.py` ; `scripts/audit/check-ledger-catalog-ratchet.py`. | L4 pour les mesures ; L0 pour le texte de DoD5 | journal | 1. PR du monorepo qui ajoute P33 (section B). 2. Fermer #415 avec C#415. 3. Le texte de DoD5 se corrige au déplacement de la DoD (voir « Non vérifié »). |
| ADR-135, PR #417, sous-agents de mandat | Rattacher trois sous-agents en lecture seule au rôle 23, au titre de `rules-ai-cos`. | Non construit : `.claude/agents/mandat/` absent de `main` ; PR monorepo #2081 en brouillon. P31 ne garde que AI2 et AI4. | L0 | fermer sans règle | Fermer #417 avec C#417. |
| ADR-136, PR #418, point d'entrée unique de la boucle contenu | Toute exécution de la boucle contenu part d'une issue de la file, exécutée par `mandat-remise`. | Présent, non activé : `scripts/ops/mandat-remise.yml` existe sur `main`, hors de `.github/workflows/` (`commandes-owner.md:589`, « inactif ») ; PR monorepo #2080 fermée sans fusion le 2026-11-15. Seul `pilote-file.yml` tourne (run 43935848060). | L1 | fermer sans règle | Fermer #418 avec C#418. Corriger `workspaces/seo-batch/.claude/skills/seo-content-loop/SKILL.md:157`, qui cite encore l'ADR comme décision en cours. Voisins : P24, P25. |

### Ensemble 3 : les 33 autres PR ouvertes

| Objet | Ce que la PR porte | Preuve | Niveau | Verdict | Action exacte |
|---|---|---|---|---|---|
| #13 | Note de session (sélecteur de véhicule du diagnostic). | R-notes : absent de `main`, 0 citation. | L0 | fermer sans règle | Fermer avec C#13. |
| #22, ADR-019 | ADR-019 (escalade de l'AI content advisor). | Fichier **identique** à celui de `main` (même empreinte Git). Code : `backend/src/modules/ai-content/providers/anthropic.provider.ts:216`, aucun appelant dans `backend/src frontend/app scripts`. | L0 (présent, non branché) | fermer sans règle | Fermer avec C#22. |
| #29 | Note de session et compte rendu de l'incident Redis. | Note absente de `main` ; le compte rendu existe sur `main` dans une autre version. | L0 | fermer sans règle | Fermer avec C#29. |
| #59 | Note d'investigation R8. | R-notes : absent, 0 citation. | L0 | fermer sans règle | Fermer avec C#59. |
| #64, « ADR-024 » | Timeline `log.md` alimentée par un hook Stop. | En service sous une autre forme : `.claude/settings.json:55-60` (hook de suggestion), skill `session-log`, `CLAUDE.md:93`. Dernière écriture de `log.md` sur `main` : 2026-10-26. Numéro 024 pris sur `main` par un autre texte. | L3 jusqu'au 2026-10-26 | fermer sans règle | Fermer avec C#64. La convention vit déjà dans `CLAUDE.md:93`. |
| #70 | Note de connaissance (liste déroulante véhicule). | R-notes : absent, 0 citation. | L0 | fermer sans règle | Fermer avec C#70. |
| #72 | Débrief R8. | Fichier **identique** à celui de `main`. | L0 | fermer sans règle | Fermer avec C#72. |
| #75 | Note de connaissance (découpe des `SKILL.md`). | R-notes : absent, 0 citation. | L0 | fermer sans règle | Fermer avec C#75. |
| #88 | Récapitulatif de session. | R-notes : absent, 0 citation. | L0 | fermer sans règle | Fermer avec C#88. |
| #92 | Deux notes de session. | R-notes : absentes, 0 citation. | L0 | fermer sans règle | Fermer avec C#92. |
| #93 | Débrief de session (même fichier que #92). | R-notes : absent, 0 citation. | L0 | fermer sans règle | Fermer avec C#93. |
| #110 | Note de passation. | R-notes : absent, 0 citation. | L0 | fermer sans règle | Fermer avec C#110. |
| #114 | Note de session. | R-notes : absent, 0 citation. | L0 | fermer sans règle | Fermer avec C#114. |
| #116 | Note de passation SEO. | R-notes : absent, 0 citation. | L0 | fermer sans règle | Fermer avec C#116. |
| #122 | Note sur une panne masquée du cron `seo-monitor`. | Le défaut décrit est encore dans le code : `backend/src/workers/processors/seo-monitor.processor.ts:341` appelle `get_random_vehicle_gamme_combinations`, absente de `backend/supabase`. | L0 | fermer sans règle | Fermer avec C#122. Signaler le défaut par une issue du monorepo (P24). |
| #131 | Note de session (feuille de route). | Une autre version du fichier existe sur `main`. | L0 | fermer sans règle | Fermer avec C#131. |
| #136 | Note : toute baseline d'audit a une commande `:refresh`. | Pratique présente : `package.json:57,68,71,75,87`. Aucune décision de l'owner ne la porte. | L1 | fermer sans règle | Fermer avec C#136. |
| #151 | Rétroliens entre notes du vault. | Interne au vault. | L0 | fermer sans règle | Fermer avec C#151. |
| #173, « ADR-044 » | Renommage de `R3GuideController`. | Non construit : aucun `@deprecated` dans `backend/src/modules/blog/controllers/r3-guide.controller.ts` ; aucun fichier `r3-conseils`. Numéro 044 pris sur `main`. | L0 | fermer sans règle | Fermer avec C#173. |
| #196, ADR-047 et ADR-050 | Ratification de deux ADR. | Les deux sont déjà `accepted` sur `main`. Mécanisme d'ADR-050 présent : `backend/supabase/migrations/20260507_seo_quality_history.sql:23`. | L1 | fermer sans règle | Fermer avec C#196. |
| #213 | Note de session. | R-notes : absent, 0 citation. | L0 | fermer sans règle | Fermer avec C#213. |
| #215 | Note : un design pack améliore l'existant. | R-notes : absent, 0 citation. Voisin : P23. | L0 | fermer sans règle | Fermer avec C#215. |
| #217 | Note de session. | R-notes : absent, 0 citation. | L0 | fermer sans règle | Fermer avec C#217. |
| #220 | Sept leçons du sprint bundle (liées à ADR-051). | R-notes : absent, 0 citation. | L0 | fermer sans règle | Fermer avec C#220. |
| #235 | Mise à jour d'un état de cascade et d'un snapshot de planning. | Interne au vault ; le planning est déjà figé (ADR-138, ligne ADR-053). | L0 | fermer sans règle | Fermer avec C#235. |
| #237 | Note : cinq verrous d'une PR de fondation. | R-notes : absent, 0 citation. | L0 | fermer sans règle | Fermer avec C#237. |
| #240, règle R-SEO-URL-IMMUTABLE | Aucune URL ne change sans demande explicite. | Règle absente de `main` du vault et du journal ; portée par `CLAUDE.md` (invariant 6). Les deux gardes prévues ne sont pas construites (`seo-url-immutable` = aucune occurrence). Tests présents : `backend/src/modules/seo/services/policies/__tests__/seo-canonical.service.test.ts`, `packages/seo-url-contract/src/url-rules.test.ts`. | L2 (tests présents, non rejoués) | à décider par Marwane | Fermer avec C#240. Suite dans le monorepo : question D4. |
| #255 | Refactor d'un script du vault. | Interne au vault. | L0 | fermer sans règle | Fermer avec C#255. |
| #335, « ADR-096 » | Dérogation de schéma pour `DepEntry`. | Jamais utilisée : `packages/registry/src/entries/dep-entry.ts:23` porte toujours `declaredIn` ; PR monorepo #1225 en brouillon. Numéro 096 pris sur `main`. | L0 | fermer sans règle | Fermer avec C#335. |
| #345, INC-2026-017 | Compte rendu d'incident : secrets réels dans `backend/.env.test.template`. | Compte rendu absent de `main`. Le fichier est **toujours suivi** sur `origin/main` du monorepo public (`git ls-tree`, contenu non lu). | sans objet | à décider par Marwane | Fermer avec C#345. Suite dans le monorepo : question D5. |
| #351 | Dossier de preuves du pipeline éditorial (520 fichiers), « ne pas fusionner ». | Preuves seules, aucune règle. | L0 | fermer sans règle | Fermer avec C#351. Ne pas supprimer la branche. |
| #390 | Script de détection des collisions de numéros d'ADR. | Outil du vault. | L0 | fermer sans règle | Fermer avec C#390. |
| #420 | Une ligne de sommaire du vault (politique des plugins). | `plugin-enablement-policy` dans `.claude workspaces AGENTS.md CLAUDE.md` = aucune occurrence. | L0 | fermer sans règle | Fermer avec C#420. |

### Hors des trois ensembles, signalé

| Objet | Ce que le texte demande | Preuve | Niveau | Verdict | Action exacte |
|---|---|---|---|---|---|
| ADR-137 (PR #421, **fusionnée** le 2026-11-16T10:08:18Z) | Skills tiers : au niveau du dépôt, par PR, un seul à la fois, `skills-lock.json`, wrapper `amk-<nom>`. | Rien trouvé : aucun `skills-lock.json` ; `supabase-postgres-best-practices` dans `.claude .agents .spec/00-canon/ai-registry package.json` = aucune occurrence. Aucune ligne du journal. | L0 | à décider par Marwane | Question D6. Rien à fermer. |

### Compte par verdict (51 lignes)

| Verdict | Lignes |
|---|---|
| journal | 2 (ADR-084, ADR-134) |
| contrat | 0 |
| fermer sans règle | 42 |
| fermer : conflit | 1 (ADR-133) |
| à décider par Marwane | 6 (ADR-122, ADR-131, ADR-132, #240, #345, ADR-137)  : la suite dans le monorepo. Le bloc demande au clavier la fermeture de chacune des 5 PR du vault |

## B. Textes exacts

### Lignes à ajouter au journal

Ajoutées au journal par la PR qui porte ce fichier, chacune suivie de sa ligne « Application »
(forme de `main` depuis #2114). Numéros P32 et P33 : la PR #2122 prend P34 à P39.

À placer dans « Données et base » :

```
- **P32.** Importer un tarif, activer une pièce (la rendre vendable) et l'afficher au catalogue
  sont trois étapes distinctes. Source : ADR-084 « écriture du tarif » (PR vault #315, jamais
  fusionnée).
```

À placer dans « Changements, revue et fusion » :

```
- **P33.** Un test de la Definition of Done nomme une mesure qui existe et dit ce qu'elle compare.
  Ce qui n'est pas mesuré est écrit comme tel dans la preuve, sans être retiré de l'exigence.
  Source : ADR-134 (PR vault #415, jamais fusionnée).
```

Remarques :

- P32 ne garde d'ADR-084 que ce que la PR #2122 ne pose pas. Les deux autres invariants du texte
  sont en P35 et P36 de #2122 ; si #2122 n'est pas fusionnée, ils ne sont pas au journal. Le
  quatrième (« une référence non vendable ne s'affiche pas sur R2 ») n'est pas repris : le filtre
  sur R2 n'est pas prouvé.
- Écart écrit dans la ligne « Application » de P32 : l'option `activate` de l'import, fermée par
  défaut, rend vendable dans le même commit.
- « ADR-084 » désigne deux sujets dans le monorepo (voir « Incohérences »). D'où le titre entre
  guillemets dans la source de P32.
- P33 reprend mot pour mot le principe directeur d'ADR-134.
- Les deux lignes touchent un fichier en zone CODEOWNERS : circuit élevé, approbation de l'owner.

### Contrats de département : aucun

Aucun verdict « contrat ». Le schéma qui contrôle la carte en CI
(`.spec/00-canon/ai-registry/agent-operating-map.schema.json`) ferme les deux objets possibles :

- `$defs/departmentContract` (lignes 238-242) : six champs requis (`surveillance`, `kpi`, `source`,
  `seuil_action`, `ligne_rapport`, `decisions`), `additionalProperties: false` ;
- `$defs/departmentContractCommon` (lignes 293-294) : cinq champs requis (`rapport`, `entree_kpi`,
  `seuil_franchi`, `donnee_absente`, `sources`), `additionalProperties: false`.

Aucun de ces champs ne porte une règle de procédure. Les propositions « reprendre dans un contrat »
de la PR #422 pour 122, 132 et 136 n'ont donc pas de champ d'accueil.

## C. Commentaires de fermeture

ASCII seul, sans guillemet double, apostrophe, accent grave ni signe dollar. Les commentaires de
#315 et #415 citent le journal : le bloc ne ferme #415 qu'après la fusion de #2116, et #315
qu'après la fusion de #2116 et de #2122 (P35, P36).
Les 44 autres sont vrais quelle que soit la réponse aux questions de la section D. Pour les cinq PR
de cette section, la fermeture découle de la règle 6 du tri, mais le bloc la demande au clavier.

```
C#13: Fermeture sans fusion : note de session sans regle a reprendre. Le vault passe en archive en lecture seule (ADR-138) ; le texte reste lisible dans cette PR.
C#22: Fermeture sans fusion : le fichier ADR-019 de cette PR est identique a celui de main. Rien a fusionner.
C#29: Fermeture sans fusion : note de session sans regle a reprendre, et le rapport Redis du 2026-04-22 existe deja sur main dans une autre version.
C#59: Fermeture sans fusion : note de session sans regle a reprendre. Le vault passe en archive en lecture seule (ADR-138) ; le texte reste lisible dans cette PR.
C#64: Fermeture sans fusion : le numero ADR-024 est deja pris sur main. La timeline log.md vit dans le monorepo : CLAUDE.md ligne 93, skill session-log et hook Stop.
C#70: Fermeture sans fusion : note de connaissance sans regle a reprendre. Le vault passe en archive en lecture seule (ADR-138) ; le texte reste lisible dans cette PR.
C#72: Fermeture sans fusion : le fichier de cette PR est identique a celui de main. Rien a fusionner.
C#75: Fermeture sans fusion : note de connaissance sans regle a reprendre. Le vault passe en archive en lecture seule (ADR-138) ; le texte reste lisible dans cette PR.
C#88: Fermeture sans fusion : note de session sans regle a reprendre. Le vault passe en archive en lecture seule (ADR-138) ; le texte reste lisible dans cette PR.
C#92: Fermeture sans fusion : notes de session sans regle a reprendre. Le vault passe en archive en lecture seule (ADR-138) ; le texte reste lisible dans cette PR.
C#93: Fermeture sans fusion : note de session sans regle a reprendre, deja presente dans la PR #92. Le vault passe en archive en lecture seule (ADR-138).
C#110: Fermeture sans fusion : note de passation sans regle a reprendre. Le vault passe en archive en lecture seule (ADR-138) ; le texte reste lisible dans cette PR.
C#114: Fermeture sans fusion : note de session sans regle a reprendre. Le vault passe en archive en lecture seule (ADR-138) ; le texte reste lisible dans cette PR.
C#116: Fermeture sans fusion : note de passation sans regle a reprendre. Le vault passe en archive en lecture seule (ADR-138) ; le texte reste lisible dans cette PR.
C#122: Fermeture sans fusion : note de connaissance sans regle nouvelle. La regle voisine est dans le monorepo : CLAUDE.md invariant 3, pas de resultat vide qui masque une panne.
C#131: Fermeture sans fusion : une autre version de ce fichier existe deja sur main. Le vault passe en archive en lecture seule (ADR-138).
C#136: Fermeture sans fusion : note de connaissance sans regle a reprendre. La pratique vit dans les scripts refresh du package.json du monorepo.
C#151: Fermeture sans fusion : retroliens internes au vault, sans objet une fois le vault en archive (ADR-138).
C#173: Fermeture sans fusion : le renommage de R3GuideController a jamais ete construit dans le monorepo, et le numero ADR-044 est deja pris sur main. Aucune regle sans mecanisme.
C#196: Fermeture sans fusion : ADR-047 et ADR-050 sont deja acceptees sur main. Rien a fusionner.
C#211: Fermeture sans fusion : mecanisme jamais construit, aucun fichier bundle-top10 ni check-bundle-fresh sur main du monorepo. Le budget de performance releve du contrat du departement 7 dans .spec/00-canon/ai-registry/agent-operating-map.yaml.
C#213: Fermeture sans fusion : note de session sans regle a reprendre. Le vault passe en archive en lecture seule (ADR-138) ; le texte reste lisible dans cette PR.
C#214: Fermeture sans fusion : ADR documentaire sans mecanisme a construire. La regle voisine est le principe P12 du journal du monorepo, .claude/governance/journal-des-principes.md.
C#215: Fermeture sans fusion : note de connaissance sans regle nouvelle. Le principe voisin est P23 du journal du monorepo, .claude/governance/journal-des-principes.md.
C#217: Fermeture sans fusion : note de session sans regle a reprendre. Le vault passe en archive en lecture seule (ADR-138) ; le texte reste lisible dans cette PR.
C#220: Fermeture sans fusion : note de connaissance liee a ADR-051, dont le mecanisme a jamais ete construit. Le texte reste lisible dans cette PR.
C#235: Fermeture sans fusion : etat de cascade et snapshot de planning internes au vault, sans objet une fois le vault en archive (ADR-138).
C#237: Fermeture sans fusion : note de connaissance sans regle a reprendre. Le vault passe en archive en lecture seule (ADR-138) ; le texte reste lisible dans cette PR.
C#240: Fermeture sans fusion : aucune regle ne sera plus fusionnee dans le vault (ADR-138). La regle des URL immuables se lit dans le monorepo : CLAUDE.md, invariant 6.
C#241: Fermeture sans fusion : mecanisme jamais construit, la PR monorepo 405 est fermee sans fusion et ALLOWED_LINKS reste en service. Aucune regle sans mecanisme.
C#242: Fermeture sans fusion : convention interne au vault, sans objet une fois le vault en archive (ADR-138).
C#255: Fermeture sans fusion : refactor des scripts du vault, sans objet une fois le vault en archive (ADR-138).
C#315: Fermeture sans fusion : les regles du tarif (ADR-084) sont reprises au journal du monorepo, .claude/governance/journal-des-principes.md : P32 (import, activation et affichage sont trois etapes), P35 (chemin d ecriture unique) et P36 (jamais de vente a perte). Le second texte, sur les trois surfaces fournisseur, est couvert par P23 et par le contrat du departement 12.
C#335: Fermeture sans fusion : derogation jamais utilisee, la PR monorepo 1225 est encore en brouillon, et le numero ADR-096 est deja pris sur main.
C#344: Fermeture sans fusion : mecanisme jamais construit, scripts/registry/check-new-files.js exempte toujours les fichiers de test. Aucune regle sans mecanisme.
C#345: Fermeture sans fusion : le vault ne recoit plus de PR de registre (ADR-138). Le compte rendu INC-2026-017 reste lisible dans cette PR ; la rotation des secrets reste suivie par le proprietaire.
C#351: Fermeture sans fusion : dossier de preuves sans regle a reprendre. Il reste lisible par cette PR ; ne pas supprimer la branche codex/editorial-pipeline-audit-20260912.
C#390: Fermeture sans fusion : outil de numerotation des ADR, sans objet car aucune ADR ne sera plus ecrite dans le vault (ADR-138).
C#392: Fermeture sans fusion : aucune ADR ne sera plus fusionnee dans le vault (ADR-138). Les trois textes approuves le 2026-11-04 restent lisibles dans cette PR ; leur application passe par une PR du monorepo.
C#413: Fermeture sans fusion : la qualification technique reste non cablee (PR WIKI 134 en brouillon). Aucune regle sans mecanisme ; le principe P10 du journal du monorepo reste en vigueur.
C#414: Fermeture sans fusion : aucune ADR ne sera plus fusionnee dans le vault (ADR-138). La question Q4 et la regle de signature reviennent au proprietaire, dans le monorepo.
C#415: Fermeture sans fusion : le principe est repris au journal du monorepo (P33), .claude/governance/journal-des-principes.md. Le texte de DoD5 sera corrige au deplacement de la Definition of Done dans le monorepo.
C#416: Fermeture : conflit avec le principe P20 du journal du monorepo (decisions 72 et 91 : trois circuits, revue Claude, une seule App dont la cle reste hors du DEV). Le bloc level_b est absent de main.
C#417: Fermeture sans fusion : mecanisme jamais construit, la PR monorepo 2081 est en brouillon et .claude/agents/mandat est absent de main. Le principe P31 du journal ne garde que AI2 et AI4.
C#418: Fermeture sans fusion : la routine mandat-remise existe dans le monorepo mais reste inactive, hors de .github/workflows. Aucune regle sans mecanisme en service ; les principes voisins sont P24 et P25 du journal du monorepo.
C#420: Fermeture sans fusion : entree de sommaire interne au vault, sans objet une fois le vault en archive (ADR-138).
```

## D. À décider par Marwane

| N° | Objet | Question | Réponse proposée |
|---|---|---|---|
| D1 | ADR-122, PR #392 | Les trois textes approuvés le 4 nov. n'ont jamais été appliqués : les applique-t-on directement dans le monorepo ? | Oui, par PR du monorepo : `marketing-batch.md` et `UX-CONSTITUTION.md` tout de suite, la voix marketing à son déplacement (`.spec/00-canon/canon-distribution/rules-marketing-voice.md`). Aucune ligne au journal : ce sont des règles de workspace, et P11 couvre déjà la phrase sur le RAG. |
| D2 | ADR-131, PR #413 | ADR-131 est ratifiée (texte de la PR) mais rien n'est câblé : la règle entre-t-elle au journal maintenant ? | Non. Elle y entre avec la PR qui câble `technical_qualification_pass` dans le décideur du WIKI. D'ici là, P10 reste la règle. |
| D3a | ADR-132, PR #414, question Q4 | Que devient la mention « rédigés et validés par des mécaniciens et techniciens automobile certifiés » ? | Option B du texte : retirer ou réécrire la mention. C'est la seule qui ne suppose pas une validation humaine par article, que P10 exclut et qu'aucun mécanisme ne produit. Page servie : accord nominatif. |
| D3b | ADR-132, PR #414, règle R2 | La règle de signature entre-t-elle au journal ? | Oui, une ligne, une fois Q4 tranchée : « Aucune signature publique ne nomme un LLM ou un outil d'IA comme auteur ; l'auteur déclaré est l'organisation AutoMecanik. Source : ADR-132 R2. » Les cinq rôles (R1) n'y entrent pas : aucun mécanisme. |
| D4 | #240, URL immuables | Le journal n'a aucun principe sur les URL, alors que `CLAUDE.md` (invariant 6) l'interdit : ajoute-t-on une ligne ? | **Mise à jour du 17 nov. : la PR #2122 (mandat BD) pose cette ligne en P37 ; rien à ajouter ici, la réponse est la fusion de #2122.** Proposition d'origine : « Aucune URL servie ne change (chemin, slug, suffixe, route, sitemap, redirection) sans demande explicite de l'owner. Source : `CLAUDE.md` invariant 6. » Sans la clause « 410 Gone » du texte, contraire à P14. |
| D5 | #345, INC-2026-017 | Où vit le registre des incidents une fois le vault archivé, et ce compte rendu y entre-t-il ? | Pas de nouveau registre : un incident est une issue du monorepo (P24). Fermer #345 sans fusion, le texte reste lisible dans la PR. La rotation des secrets reste un geste de l'owner. |
| D6 | ADR-137 (fusionnée) | ADR-137 est acceptée dans le vault depuis ce matin, sans ligne au journal ni mécanisme : la règle des skills tiers entre-t-elle au journal maintenant ? | Non. Elle y entre avec la PR du pilote, celle qui crée `skills-lock.json`. D'ici là, P26 s'applique. |
| D7 | PR monorepo #2079 (niveau B de la porte, ADR-133) | ADR-133 est en conflit avec P20 : ferme-t-on aussi la PR #2079 du monorepo ? | Oui. Elle ajoute une seconde identité de revue que les décisions 72 et 91 remplacent, et elle modifie les deux fichiers de la porte touchés par #2113. |
| D8 | Definition of Done (ADR-134, ADR-138 D6) | La DoD vit dans le vault (`ledger/rules/rules-engineering-definition-of-done.md`, 1.3.0) et le plan de sortie ne la nomme dans aucune étape : où vit-elle après l'archivage ? | Dans le monorepo, à l'étape 5 du plan (`.spec/00-canon/canon-distribution/`), avec le texte de DoD5 corrigé selon P33. Sans ce déplacement, DoD5 reste figée dans l'archive. |
| D9 | Porte ADR-124 | Le circuit faible fusionne déjà les PR documentaires (#2109) : garde-t-on la porte ADR-124 en plus ? | À décider après l'étape 6 (#2113), qui rend la porte indépendante du vault. Tant que P20 la nomme, elle reste. |

## E. Faut-il écrire le statut des trois ADR différées dans le vault ?

**Avis : non. ADR-138 suffit, et il interdit lui-même cette écriture.**

Passages d'ADR-138 sur `main` du vault
(`ledger/decisions/adr/ADR-138-sortie-du-vault-monorepo-source-unique.md`) :

- En-tête : « **Dernière PR de décision du vault.** Après elle, le vault ne reçoit plus que les PR
  techniques du plan de sortie (D5) ; aucune nouvelle décision n'y est écrite. »
- « Ce que cet ADR ne fait pas » : « Il ne tranche pas le sort des ADR `deferred` (018, 057, 073) ni
  des numéros en PR ouverte : des verdicts sont proposés à l'owner dans la PR, sans décision. »
- D1 : « Une ADR du vault n'est plus normative par elle-même. Elle reste l'archive de la raison
  d'une décision ».

Motifs :

1. Passer 018, 057 ou 073 de `deferred` à un autre statut est une décision. ADR-138 dit qu'aucune
   nouvelle décision n'est écrite dans le vault.
2. `deferred` est exact : le vault ne les a jamais tranchées. Réécrire le statut après coup
   fausserait l'archive.
3. La question de leur force est déjà réglée par D1 et par P29 : aucune ADR du vault n'est normative.
4. Le coût est réel (une PR signée et fusionnée par l'owner) pour aucun lecteur.

Si une trace du verdict est voulue, elle s'écrit dans le monorepo, là où le tri existe déjà
(`docs/audit/mandat-ar-20261116/tri-adr.md`), par une PR du monorepo. Ce qui rend l'archive
cohérente, c'est de fermer les 46 PR ouvertes avant l'archivage : un dépôt archivé ne permet plus de
les fermer.

## F. Gestes de Marwane : un seul bloc

Windows PowerShell 32 bits. **Ce bloc n'a pas été exécuté par l'agent** : le DEV n'a pas de PowerShell.
Contrôles faits sur le texte : ASCII seul, aucun `&&`, accolades, parenthèses et guillemets appariés.

Ordre : (1) fermeture commentée de 39 PR du vault ; (2) pour #240, #345, #392, #413 et #414, dont la
suite est à décider (section D), une question au clavier par PR : « non » la laisse ouverte ;
(3) sortie du brouillon de la PR #2116, attente de ses checks, accord au clavier, approbation, attente du check
« 🚦 Circuit de fusion », fusion épinglée sur la tête lue ; (4) fermeture de #415, puis de #315 si
la PR #2122 est fusionnée (sinon #315 reste ouverte et le bloc se relance plus tard) ; (5) compte des
PR restées ouvertes dans le vault (0 si tout est accepté).

Le bloc se relance sans risque : une PR déjà fermée est sautée. Il ne supprime aucune branche (`gh pr
close` sans `--delete-branch`), ce qui garde lisible le dossier de #351. Il lit les checks par
`gh pr checks --json` : `gh` 2.50 ou plus récent ; sinon il s'arrête avant toute fermeture.

```powershell
& {
  $VAULT = "ak125/governance-vault"
  $REPO = "ak125/nestjs-remix-monorepo"
  $OKS = @("SUCCESS", "SKIPPED", "NEUTRAL")
  $WAITS = @("QUEUED", "IN_PROGRESS", "PENDING", "WAITING", "REQUESTED", "EXPECTED")
  $CIRC = "*Circuit de fusion*"
  $RAW = (gh pr checks 2116 --repo $REPO --json name,state)
  if (-not $RAW) { Write-Host "ARRET : checks illisibles (gh 2.50 ou plus recent requis), rien n'est modifie"; return }
  $LOTA = @(
    @("13", "Fermeture sans fusion : note de session sans regle a reprendre. Le vault passe en archive en lecture seule (ADR-138) ; le texte reste lisible dans cette PR."),
    @("22", "Fermeture sans fusion : le fichier ADR-019 de cette PR est identique a celui de main. Rien a fusionner."),
    @("29", "Fermeture sans fusion : note de session sans regle a reprendre, et le rapport Redis du 2026-04-22 existe deja sur main dans une autre version."),
    @("59", "Fermeture sans fusion : note de session sans regle a reprendre. Le vault passe en archive en lecture seule (ADR-138) ; le texte reste lisible dans cette PR."),
    @("64", "Fermeture sans fusion : le numero ADR-024 est deja pris sur main. La timeline log.md vit dans le monorepo : CLAUDE.md ligne 93, skill session-log et hook Stop."),
    @("70", "Fermeture sans fusion : note de connaissance sans regle a reprendre. Le vault passe en archive en lecture seule (ADR-138) ; le texte reste lisible dans cette PR."),
    @("72", "Fermeture sans fusion : le fichier de cette PR est identique a celui de main. Rien a fusionner."),
    @("75", "Fermeture sans fusion : note de connaissance sans regle a reprendre. Le vault passe en archive en lecture seule (ADR-138) ; le texte reste lisible dans cette PR."),
    @("88", "Fermeture sans fusion : note de session sans regle a reprendre. Le vault passe en archive en lecture seule (ADR-138) ; le texte reste lisible dans cette PR."),
    @("92", "Fermeture sans fusion : notes de session sans regle a reprendre. Le vault passe en archive en lecture seule (ADR-138) ; le texte reste lisible dans cette PR."),
    @("93", "Fermeture sans fusion : note de session sans regle a reprendre, deja presente dans la PR #92. Le vault passe en archive en lecture seule (ADR-138)."),
    @("110", "Fermeture sans fusion : note de passation sans regle a reprendre. Le vault passe en archive en lecture seule (ADR-138) ; le texte reste lisible dans cette PR."),
    @("114", "Fermeture sans fusion : note de session sans regle a reprendre. Le vault passe en archive en lecture seule (ADR-138) ; le texte reste lisible dans cette PR."),
    @("116", "Fermeture sans fusion : note de passation sans regle a reprendre. Le vault passe en archive en lecture seule (ADR-138) ; le texte reste lisible dans cette PR."),
    @("122", "Fermeture sans fusion : note de connaissance sans regle nouvelle. La regle voisine est dans le monorepo : CLAUDE.md invariant 3, pas de resultat vide qui masque une panne."),
    @("131", "Fermeture sans fusion : une autre version de ce fichier existe deja sur main. Le vault passe en archive en lecture seule (ADR-138)."),
    @("136", "Fermeture sans fusion : note de connaissance sans regle a reprendre. La pratique vit dans les scripts refresh du package.json du monorepo."),
    @("151", "Fermeture sans fusion : retroliens internes au vault, sans objet une fois le vault en archive (ADR-138)."),
    @("173", "Fermeture sans fusion : le renommage de R3GuideController a jamais ete construit dans le monorepo, et le numero ADR-044 est deja pris sur main. Aucune regle sans mecanisme."),
    @("196", "Fermeture sans fusion : ADR-047 et ADR-050 sont deja acceptees sur main. Rien a fusionner."),
    @("211", "Fermeture sans fusion : mecanisme jamais construit, aucun fichier bundle-top10 ni check-bundle-fresh sur main du monorepo. Le budget de performance releve du contrat du departement 7 dans .spec/00-canon/ai-registry/agent-operating-map.yaml."),
    @("213", "Fermeture sans fusion : note de session sans regle a reprendre. Le vault passe en archive en lecture seule (ADR-138) ; le texte reste lisible dans cette PR."),
    @("214", "Fermeture sans fusion : ADR documentaire sans mecanisme a construire. La regle voisine est le principe P12 du journal du monorepo, .claude/governance/journal-des-principes.md."),
    @("215", "Fermeture sans fusion : note de connaissance sans regle nouvelle. Le principe voisin est P23 du journal du monorepo, .claude/governance/journal-des-principes.md."),
    @("217", "Fermeture sans fusion : note de session sans regle a reprendre. Le vault passe en archive en lecture seule (ADR-138) ; le texte reste lisible dans cette PR."),
    @("220", "Fermeture sans fusion : note de connaissance liee a ADR-051, dont le mecanisme a jamais ete construit. Le texte reste lisible dans cette PR."),
    @("235", "Fermeture sans fusion : etat de cascade et snapshot de planning internes au vault, sans objet une fois le vault en archive (ADR-138)."),
    @("237", "Fermeture sans fusion : note de connaissance sans regle a reprendre. Le vault passe en archive en lecture seule (ADR-138) ; le texte reste lisible dans cette PR."),
    @("241", "Fermeture sans fusion : mecanisme jamais construit, la PR monorepo 405 est fermee sans fusion et ALLOWED_LINKS reste en service. Aucune regle sans mecanisme."),
    @("242", "Fermeture sans fusion : convention interne au vault, sans objet une fois le vault en archive (ADR-138)."),
    @("255", "Fermeture sans fusion : refactor des scripts du vault, sans objet une fois le vault en archive (ADR-138)."),
    @("335", "Fermeture sans fusion : derogation jamais utilisee, la PR monorepo 1225 est encore en brouillon, et le numero ADR-096 est deja pris sur main."),
    @("344", "Fermeture sans fusion : mecanisme jamais construit, scripts/registry/check-new-files.js exempte toujours les fichiers de test. Aucune regle sans mecanisme."),
    @("351", "Fermeture sans fusion : dossier de preuves sans regle a reprendre. Il reste lisible par cette PR ; ne pas supprimer la branche codex/editorial-pipeline-audit-20260912."),
    @("390", "Fermeture sans fusion : outil de numerotation des ADR, sans objet car aucune ADR ne sera plus ecrite dans le vault (ADR-138)."),
    @("416", "Fermeture : conflit avec le principe P20 du journal du monorepo (decisions 72 et 91 : trois circuits, revue Claude, une seule App dont la cle reste hors du DEV). Le bloc level_b est absent de main."),
    @("417", "Fermeture sans fusion : mecanisme jamais construit, la PR monorepo 2081 est en brouillon et .claude/agents/mandat est absent de main. Le principe P31 du journal ne garde que AI2 et AI4."),
    @("418", "Fermeture sans fusion : la routine mandat-remise existe dans le monorepo mais reste inactive, hors de .github/workflows. Aucune regle sans mecanisme en service ; les principes voisins sont P24 et P25 du journal du monorepo."),
    @("420", "Fermeture sans fusion : entree de sommaire interne au vault, sans objet une fois le vault en archive (ADR-138).")
  )
  $LOTC = @(
    @("240", "Fermeture sans fusion : aucune regle ne sera plus fusionnee dans le vault (ADR-138). La regle des URL immuables se lit dans le monorepo : CLAUDE.md, invariant 6.", "D4"),
    @("345", "Fermeture sans fusion : le vault ne recoit plus de PR de registre (ADR-138). Le compte rendu INC-2026-017 reste lisible dans cette PR ; la rotation des secrets reste suivie par le proprietaire.", "D5"),
    @("392", "Fermeture sans fusion : aucune ADR ne sera plus fusionnee dans le vault (ADR-138). Les trois textes approuves le 2026-11-04 restent lisibles dans cette PR ; leur application passe par une PR du monorepo.", "D1"),
    @("413", "Fermeture sans fusion : la qualification technique reste non cablee (PR WIKI 134 en brouillon). Aucune regle sans mecanisme ; le principe P10 du journal du monorepo reste en vigueur.", "D2"),
    @("414", "Fermeture sans fusion : aucune ADR ne sera plus fusionnee dans le vault (ADR-138). La question Q4 et la regle de signature reviennent au proprietaire, dans le monorepo.", "D3a et D3b")
  )
  $LOTB = @(
    @("315", "Fermeture sans fusion : les regles du tarif (ADR-084) sont reprises au journal du monorepo, .claude/governance/journal-des-principes.md : P32 (import, activation et affichage sont trois etapes), P35 (chemin d ecriture unique) et P36 (jamais de vente a perte). Le second texte, sur les trois surfaces fournisseur, est couvert par P23 et par le contrat du departement 12."),
    @("415", "Fermeture sans fusion : le principe est repris au journal du monorepo (P33), .claude/governance/journal-des-principes.md. Le texte de DoD5 sera corrige au deplacement de la Definition of Done dans le monorepo.")
  )

  foreach ($x in $LOTA) {
    $N = $x[0]
    $MSG = $x[1]
    $ST = (gh pr view $N --repo $VAULT --json state --jq .state)
    if ($LASTEXITCODE -ne 0) { Write-Host ("ARRET : etat illisible, PR " + $N); return }
    if ($ST -ne "OPEN") { Write-Host ("Deja fermee : " + $N); continue }
    gh pr close $N --repo $VAULT --comment $MSG
    if ($LASTEXITCODE -ne 0) { Write-Host ("ARRET : fermeture refusee, PR " + $N); return }
  }
  Write-Host "Lot A termine : 39 PR du vault traitees. Suite : 5 PR dont la suite est a decider."
  foreach ($x in $LOTC) {
    $N = $x[0]
    $MSG = $x[1]
    $ST = (gh pr view $N --repo $VAULT --json state --jq .state)
    if ($LASTEXITCODE -ne 0) { Write-Host ("ARRET : etat illisible, PR " + $N); return }
    if ($ST -ne "OPEN") { Write-Host ("Deja fermee : " + $N); continue }
    $QN = $x[2]
    $GO = Read-Host ("Fermer la PR " + $N + " du vault (suite dans le monorepo : question " + $QN + ") ? (oui/non)")
    if ($GO -ne "oui") { Write-Host ("Laissee ouverte : " + $N); continue }
    gh pr close $N --repo $VAULT --comment $MSG
    if ($LASTEXITCODE -ne 0) { Write-Host ("ARRET : fermeture refusee, PR " + $N); return }
  }
  Write-Host "Suite : PR du journal."

  $PST = (gh pr view 2116 --repo $REPO --json state --jq .state)
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : etat de la PR 2116 illisible"; return }
  if ($PST -eq "CLOSED") { Write-Host "ARRET : la PR 2116 est fermee sans fusion, PR 315 et 415 du vault laissees ouvertes"; return }
  if ($PST -eq "MERGED") { Write-Host "PR 2116 deja fusionnee : partie journal sautee" }
  if ($PST -eq "OPEN") {
  $HEAD = (gh pr view 2116 --repo $REPO --json headRefOid --jq .headRefOid)
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : tete illisible"; return }
  gh pr ready 2116 --repo $REPO
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : passage en revue refuse"; return }
  Start-Sleep -Seconds 120
  $VERT = $false
  for ($i = 0; $i -lt 90; $i++) {
    $RAW = (gh pr checks 2116 --repo $REPO --json name,state)
    if (-not $RAW) { Write-Host "ARRET : checks illisibles, rien n'est fusionne"; return }
    $J = (($RAW -join "") | ConvertFrom-Json)
    $O = @($J | Where-Object { $_.name -notlike $CIRC })
    $BAD = @($O | Where-Object { ($OKS -notcontains $_.state) -and ($WAITS -notcontains $_.state) })
    $PEND = @($O | Where-Object { $WAITS -contains $_.state })
    if ($BAD.Count -gt 0) {
      $BAD | ForEach-Object { Write-Host ("  " + $_.state + " : " + $_.name) }
      Write-Host "ARRET : un check est en echec, rien n'est fusionne"; return
    }
    if (($PEND.Count -eq 0) -and ($O.Count -ge 10)) { $VERT = $true; break }
    Write-Host ("Checks en cours : " + $PEND.Count)
    Start-Sleep -Seconds 30
  }
  if (-not $VERT) { Write-Host "ARRET : checks non termines apres 45 minutes, rien n'est fusionne"; return }
  $NOW = (gh pr view 2116 --repo $REPO --json headRefOid --jq .headRefOid)
  if ($NOW -ne $HEAD) { Write-Host ("ARRET : la tete a change : " + $NOW); return }
  $GO = Read-Host ("Approuver et fusionner la PR 2116 (journal : P32, P33) sur la tete " + $HEAD + " ? (oui/non)")
  if ($GO -ne "oui") { Write-Host "Arret demande : journal non fusionne, PR 315 et 415 du vault laissees ouvertes"; return }
  gh pr review 2116 --repo $REPO --approve
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : approbation refusee"; return }
  $CIRCOK = $false
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Seconds 15
    $RAW = (gh pr checks 2116 --repo $REPO --json name,state)
    if (-not $RAW) { continue }
    $J = (($RAW -join "") | ConvertFrom-Json)
    $C = @($J | Where-Object { $_.name -like $CIRC })
    $KO = @($C | Where-Object { $_.state -ne "SUCCESS" })
    if (($C.Count -gt 0) -and ($KO.Count -eq 0)) { $CIRCOK = $true; break }
  }
  if (-not $CIRCOK) { Write-Host "ARRET : le check du circuit n'est pas vert apres l'approbation, rien n'est fusionne"; return }
  gh pr merge 2116 --repo $REPO --squash --match-head-commit $HEAD
  if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : fusion refusee, PR 315 et 415 du vault laissees ouvertes"; return }
  }

  foreach ($x in $LOTB) {
    $N = $x[0]
    $MSG = $x[1]
    $ST = (gh pr view $N --repo $VAULT --json state --jq .state)
    if ($LASTEXITCODE -ne 0) { Write-Host ("ARRET : etat illisible, PR " + $N); return }
    if ($ST -ne "OPEN") { Write-Host ("Deja fermee : " + $N); continue }
    if ($N -eq "315") {
      $BD = (gh pr view 2122 --repo $REPO --json state --jq .state)
      if ($LASTEXITCODE -ne 0) { Write-Host "ARRET : etat de la PR 2122 illisible"; return }
      if ($BD -ne "MERGED") { Write-Host "PR 315 laissee ouverte : la PR 2122 du monorepo (P35, P36) n'est pas fusionnee ; relancer le bloc ensuite"; continue }
    }
    gh pr close $N --repo $VAULT --comment $MSG
    if ($LASTEXITCODE -ne 0) { Write-Host ("ARRET : fermeture refusee, PR " + $N); return }
  }
  Write-Host "PR encore ouvertes dans le vault (0 si tout est accepte) :"
  gh pr list --repo $VAULT --state open --limit 100 --json number --jq length
}
```

Après le bloc : les questions de la section D restent ouvertes. Une réponse « oui » à D3b ou D4 ajoute
une ligne au journal par une nouvelle PR en circuit élevé.

## G. Vérification rejouée par l'agent du mandat

Le tableau a d'abord été dressé par un sous-agent en lecture seule. Ont été rejoués sur `origin/main`
du monorepo (`0e2d0e7ed4db`) et du vault (`b2e712791bee`), le 16 nov. entre 23:08 et 23:20 UTC :

- le compte des 46 PR ouvertes et l'égalité avec les 46 commentaires ;
- ADR-084 : règle ast-grep, étape `audit:ast` d'`audit.yml`, fichiers et tests du module pricing,
  invariant `VENTE_BELOW_ACHAT` ;
- ADR-134 : présence des deux workflows et des deux scripts ; contenu de la PR #415 ;
- ADR-133 : aucune occurrence de `level_b` ; état des PR monorepo #405, #1225, #2079, #2080, #2081 ;
- ADR-097, ADR-052 : `EXCEPTION_GLOBS`, `ALLOWED_LINKS` ;
- ADR-018, 057, 073 : `status: deferred` ; ADR-137 et ADR-138 : `status: accepted` ; fusion de #421 et #422 ;
- #22 et #72 : même empreinte Git que le fichier de `main` ;
- schéma des contrats de département : `additionalProperties: false` ;
- les extraits cités pour ADR-122, ADR-132, ADR-136 et ADR-073.

Deux corrections en sont sorties : le chemin de `pricing.repository.ts`, et la ligne d'ADR-136
(`mandat-remise.yml` existe sur `main`, inactif, hors de `.github/workflows/`). Le reste du tableau
n'a pas été rejoué ligne à ligne : voir « Non vérifié ».

## Incohérences relevées

- **Numéros d'ADR en double.** « ADR-084 » désigne le tarif dans un fichier du monorepo et la
  suppression du niveau modèle de `/constructeurs` en 410 dans quatorze autres
  (`backend/src/modules/seo/seo.controller.ts:411`, `packages/seo-url-contract/src/robots-policy.ts:58`).
  Aucun ADR-084 n'existe sur `main` du vault. Ce 410 est en tension apparente avec P14.
- Les numéros 024 (#64), 044 (#173), 085 (#315) et 096 (#335) sont pris sur `main` par d'autres textes.
- **En-tête du journal périmé** (lignes 6 à 8) : il dit la PR #422 « ouverte, non fusionnée ». Elle
  est fusionnée depuis le 2026-11-16T20:52:02Z.
- `docs/audit/mandat-ar-20261116/tri-adr.md:153` dit ADR-137 « draft » : elle est fusionnée.
- `tri-adr.md:57` rattache la PR #173 à l'ADR-044 de `main` (stratégie SEO) : c'est un autre texte.
- ADR-051 et ADR-054 portent `status: accepted` sans avoir jamais été fusionnées.
- `.github/workflows/perf-gates.yml:18,21` renvoie à `frontend/bundle-stats.config.json`, absent.
- Le préfixe `amk-` prévu par ADR-137 pour les wrappers est déjà pris par quatre skills locaux de
  `workspaces/marketing/.claude/skills/`.
- **Sécurité, à relayer** : `backend/.env.test.template` est toujours suivi sur `origin/main` du
  monorepo public. INC-2026-017 (#345) dit qu'il contient des secrets réels. Contenu non lu.

## Non vérifié

- Le parcours runtime du tarif (ADR-084) : tests non rejoués, aucun parcours observé en DEV ni en
  PROD. Le niveau L4 ne vaut que pour la garde CI.
- Les accords de l'owner cités par les PR : approbation des trois textes d'ADR-122 (4 nov.), « Je
  ratifie ADR-131 » (15 nov.), délégation des questions Q1 à Q3 d'ADR-132. Lus dans les PR seulement.
- Les décisions 91, 105 et 108 : connues par le journal et par le mandat, pas à leur source.
- La liste des 30 PR du pilotage : non vue ; l'explication de l'écart est une déduction.
- Les 33 autres PR : titre, liste des fichiers et premières lignes du corps lus. Diff complet lu
  pour #240 seulement ; sections de décision lues pour #22, #64, #173, #196 et #335.
- Le dossier de #351 (520 fichiers) : non lu ; absence de secret non contrôlée.
- La RPC `get_random_vehicle_gamme_combinations` (#122) : absente des migrations ; son existence en
  base n'est pas contrôlée.
- La conservation d'une PR fermée dans un dépôt archivé : connaissance générale de GitHub, non testée.
- Le déplacement de la Definition of Done : ADR-138 (D6, ligne ADR-120) dit qu'elle « devient une
  source du monorepo à son déplacement », mais `inventaire-vault-et-plan.md` ne la nomme dans aucune
  étape (`definition-of-done` = aucune occurrence). Sans ce déplacement, DoD5 reste figée en 1.3.0.
- L'état fusionnable des 33 autres PR : l'API rend `UNKNOWN`.
- Le dernier run `ci.yml` sur `main` était en cours à la lecture.

## Commandes de lecture utilisées

```
gh api --paginate 'repos/ak125/governance-vault/pulls?state=open&per_page=100'
gh api repos/ak125/governance-vault/pulls/<n>/files?per_page=100
gh pr view <n> --repo ak125/governance-vault --json body,mergeable,additions,deletions,changedFiles
gh pr diff <n> --repo ak125/governance-vault
gh pr view <n> --repo ak125/nestjs-remix-monorepo --json state,isDraft,mergedAt,closedAt
gh run list --repo ak125/nestjs-remix-monorepo --workflow <fichier> --limit 2 --json ...
gh run view <id> --repo ak125/nestjs-remix-monorepo --json workflowName,conclusion,createdAt
git -C /opt/automecanik/app show origin/main:<chemin>
git -C /opt/automecanik/app grep -n -E '<motif>' origin/main -- <chemins bornés>
git -C /opt/automecanik/app ls-tree -r --name-only origin/main <chemin>
git -C /opt/automecanik/governance-vault show origin/main:<chemin>
git -C /opt/automecanik/governance-vault ls-tree origin/main -- <chemin>
```
