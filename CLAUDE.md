# CLAUDE.md — AutoMecanik / `nestjs-remix-monorepo`

Contrat commun du dépôt ; `AGENTS.md` guide les agents qui ne le chargent pas
nativement. Les règles plus proches précisent leur seul périmètre. La gouvernance
canonique reste dans le dépôt séparé `ak125/governance-vault`.

## Contrat d'exécution — 9 invariants

1. **Inspecter avant de modifier.** Confirmer checkout, branche, HEAD, état Git et
   périmètre autorisé. Préserver les changements et sessions existants. Pour une
   tâche ciblée, commencer par les fichiers connus et `rg`/`rg --files` bornés.
   Pour une exploration transverse, interroger `audit/registry/canonical.json`
   avec un filtre `jq`, puis `.claude/knowledge/REPO_MAP.md` et l'index
   `.claude/knowledge/README.md`. Ne jamais charger le registre en entier.
   Vérifier le code du checkout concerné ; une référence distante ou une mémoire
   peut être périmée. Voir `scripts/ops/check-repo-freshness.sh` si nécessaire.
2. **Étendre l'existant avant de créer.** Chercher les équivalents, leur ownership
   et leurs consommateurs. Pas de source de vérité concurrente, registry ad hoc,
   schéma dupliqué ou abstraction spéculative. Une abstraction nouvelle exige un
   besoin établi dans au moins trois fichiers. Recherche ciblée :
   `.claude/knowledge/verify-before-invent.md`.
3. **Corriger la cause.** Pas de cache caché, constante métier inventée, runtime
   guessing ni feature flag non gouverné. Un fallback n'est admissible que s'il
   est explicitement gouverné et observable ; ne pas masquer une indisponibilité
   par un résultat vide ou un succès.
4. **RAW → WIKI → projections/DB → consommateurs.** RAW est brut ; WIKI est sourcée,
   lintée et validée humainement. Aucun consommateur ne lit RAW directement.
   RAG = consommateur chatbot, sans autorité de production de contenu (ADR-031/046).
   Un producteur RAG→contenu doit être retiré et re-sourcé WIKI dans le mandat autorisé.
5. **Ne pas inventer mots-clés ou URL.** Le top-kw brut de `__seo_keywords` mesure
   la demande ; il ne définit pas un terme produit. Pas de filler SEO générique.
6. **Préserver URL historiques et contrats SEO.** Aucune modification d'URL.
   Référence des rôles : `.spec/00-canon/role-matrix.md` ; contrats exécutables :
   `packages/seo-role-contracts/`. Préserver `catalog_signature` (ADR-066),
   génération structural-first, composition vehicle-aware et relations canoniques.
   Pas d'amplification de duplicate-content, de suppression automatique de page,
   ni de modification des meta_title/description/H1 optimisés sans autorisation.
7. **Vérifier selon le risque.** Relire le diff et apporter une preuve adaptée :
   contrôle statique, test ciblé, API ou parcours réel. Ne pas relancer une preuve
   verte si ses sources, dépendances, configuration et données sont inchangées.
   **CONTRAT DE SORTIE** : `.claude/canon-mirrors/agent-exit-contract.md` (AEC).
   Le mandat humain explicite autorise les corrections de son périmètre ; ne pas
   redemander ce même accord pour chaque étape. Couverture, exclusions, preuves,
   corrections autorisées et inconnues doivent être explicites, sans surpromesse.
   Projections générées (`canonical.json`, `REPO_MAP.md`, blocs AUTO-GENERATED,
   canon mirrors hash-lockés) : corriger leurs sources, jamais les éditer à la main.
8. **Distinguer présent, branché, activé et réellement servi.** Code, tests locaux,
   CI, PREPROD et PROD sont des preuves distinctes. Une mutation runtime évalue
   observabilité, cache, queues, rollout, rollback et feature flags existants.
   Lire `.claude/rules/deployment.md` avant toute action infra : merge `main` =
   chaîne PREPROD ; tag `v*` = chaîne PROD. Aucun des deux ne prouve un déploiement réussi.
9. **Zones STOP : accord nominatif requis.** Paiement (`payments/`, Paybox,
   SystemPay/Cyberplus, `PAYBOX_*`/`SYSTEMPAY_*`), prix/stock runtime, panier/commande,
   RLS, DB destructive et migrations irréversibles, SEO indexé, déploiement PROD.
   Aucun bypass de permission, feature flag, guard, gate CI ou observabilité.
   Les interventions applicatives PROD restent manuelles par Marwane.

## Exécution, autonomie et fin

- Exécuter les tâches simples et réversibles déjà autorisées jusqu'à vérification.
  Planifier les changements complexes ; demander une décision seulement si un choix
  incertain ou une action sensible dépasse le mandat. Pas de refactor, cleanup,
  upgrade ou reformatage opportuniste hors périmètre.
- Un agent par défaut. Déléguer seulement une tâche autonome nécessaire, avec un
  livrable, une borne et sans écritures concurrentes. Les 24 responsabilités du
  Command Center ne sont pas 24 processus : consulter au besoin
  `audit/automecanik-departments-map.md` et
  `scripts/governance/build-command-center-snapshot.js`.
- Hermes peut réaliser les opérations couvertes par ses outils, accès et mandat
  actuels. Aucun transfert systématique à Codex pour ces opérations ; une limite
  effective de profil ou de permissions reste opposable. Ce fichier ne lui accorde
  aucun droit et ne raccorde aucun runtime distant.
- Une opération lourde à la fois ; pas de build complet pour une correction de prose.
  Arrêter sur résultat vérifié, blocage documenté ou budget atteint ; ne poursuivre
  une boucle que pour un défaut ou un risque restant identifié.

## Chargement ciblé et commandes

- Architecture et commandes : lire les `package.json` racine/backend/frontend et
  `.nvmrc`. Monorepo npm : backend NestJS, frontend React Router SSR, `packages/*`.
  Scripts racine existants : `npm run lint`, `npm run typecheck`, `npm test`,
  `npm run build` ; préférer le workspace et le test concernés.
- Règles `.claude/rules/` : `backend.md`, `frontend.md`, `payments.md`,
  `deployment.md` ; `guardrails.md` avant modification d'une garde ;
  `security-hooks.md` pour les avertissements du plugin advisory ;
  `context7.md` pour une API externe incertaine ; `agent-doc-search.md` pour la recherche.
  Les hooks de protection du dépôt restent distincts du plugin advisory.
- Skills : lire le `SKILL.md` pertinent et ses références requises, pas un pack entier.
  Les revues ne sont pas systématiques ; les validations imposées restent applicables.
  `code-auto-review` sert une demande explicite de relecture/correction.
- Reprise : lire `tail -n 80 log.md` si la tâche dépend de l'historique. Une timeline
  ou une mémoire ne remplace pas l'état du checkout.
- Workspaces et chargement Claude/Codex/Hermes :
  `.claude/knowledge/workspaces.md`. Rôles Paperclip : `agents/*/AGENTS.md`,
  à consulter seulement pour le rôle concerné ; UUID dans leur registre.
- Relecture d'un brouillon français : `.claude/prompts/_shared/editorial-review.md`
  avant intervention ; proposition motivée, sans publication ni écriture RAW/WIKI.

## Gouvernance

- Vault séparé : `/opt/automecanik/governance-vault/`. Aucune nouvelle ADR, rule,
  policy ou evidence-pack canonique dans ce monorepo ; ne jamais écrire dans
  `app/.local/governance-vault/`. Changement vault = PR signée, fusion humaine.
- ADR normative seulement si `accepted` et non remplacée. Un écart avec le code
  est à signaler ; le code observé n'accorde pas une dérogation de sécurité.
- Repository Control Plane : L1 `audit/registry/*.json` + L2
  `.spec/00-canon/repository-registry/*.yaml` = sources ; L3 canonical = projection.
  Voir `packages/registry/README.md`. Les documents legacy voisins ne deviennent
  pas normatifs par proximité. L'AI Operating Map
  `.spec/00-canon/ai-registry/agent-operating-map.yaml` est une référence, pas un
  orchestrateur ni une preuve de capacités actives.
- Gardes existantes : `.ast-grep/rules/`, `.husky/pre-commit`,
  `scripts/agents/validate-agents-md.sh`. Ne pas inscrire IP, identifiant sensible
  ou clé dans les instructions d'agents.
