# Journal des principes — AutoMecanik

> Décision 72 de l'owner (2026-11-15) : le monorepo est la seule source de la gouvernance.
> Décision 73 : le dépôt `ak125/governance-vault` passe en archive en lecture seule, une fois
> déplacé ce qui vit encore.
> Côté vault, ADR-138 transcrit ces deux décisions : il remplace ADR-015, amende 18 ADR et l'AEC
> (version 1.3.0), et dit pour chacun ce qui reste valable (PR ak125/governance-vault#422,
> fusionnée le 2026-11-16 à 20:52 UTC).
> Décision 109 (2026-11-16) : tri du journal. L'audit principe par principe et ses preuves sont
> dans `docs/audit/mandat-bd-20261116/`.

## Règle de vigueur

**Fusionné sur `main` = en vigueur.** Est normatif ce qui est fusionné sur `main` de ce dépôt :
ce journal, les contrats de département (`.spec/00-canon/ai-registry/agent-operating-map.yaml`)
et les réglages vérifiés par schéma en CI. Une ADR du vault n'est plus normative par elle-même.

Un principe entre en vigueur, change ou sort par une PR qui modifie ce fichier. Ce fichier est en
zone CODEOWNERS : la PR suit le circuit élevé, donc l'approbation de l'owner. Il n'existe pas
d'autre statut (pas de `proposed` ni `accepted`). La version en vigueur est celle de `main`. Une
branche, une PR ouverte ou une copie ne sont pas en vigueur.

Chaque principe cite sa source : l'ADR du vault d'où il vient (tri du 2026-11-16,
`docs/audit/mandat-ar-20261116/tri-adr.md`) ou la décision de l'owner. L'ADR reste une archive
de la raison. Ce fichier est la règle. En cas d'écart, ce fichier prime ; l'écart est signalé et
corrigé par PR.

Source : décision 72 ; côté vault, ADR-138 D1, qui remplace ADR-015 et amende ADR-101 (son D1
reste vrai pour lire l'archive). Cette règle est aussi le principe P29.

## Lecture des lignes « Application »

Sous chaque principe, la ligne « Application » dit ce qui le porte au relevé du 2026-11-16
(`main` `0e2d0e7ed`) : garde, test, contrôle CI, contrainte ou code, avec son chemin. Elle
constate, elle ne règle pas. Un principe est en vigueur quel que soit son niveau.

- **L0** texte seul ; **L1** code ou garde branché ; **L2** testé ; **L3** observé en service
  (DEV, PREPROD, ou check requis de `main` relevé vert) ; **L4** observé en PROD.
- **Intention seulement** : aucun mécanisme ne porte le principe. Il tient par la discipline.
- **Écart** : un code ou une pratique contraire existe. L'écart se corrige dans le code ou la
  pratique ; il n'accorde aucune dérogation.

## Environnements et accès

- **P1.** DEV, PREPROD et PROD sont trois environnements distincts. PREPROD tourne sur l'hôte de
  PROD et lit la base de production en lecture seule (P3). Un déploiement se décrit par six objets
  et six preuves : commit, tag, image, environnement, preuve CI, version servie. Aucun ne prouve
  le suivant. « Déployé » ne s'écrit qu'avec la version servie de l'environnement, lue et datée.
  Source : ADR-075 D2 et D3 ; ADR-001 pour la séparation.
  Application : L3 pour PREPROD. Vocabulaire gardé par `preprod-vocabulary-guard.yml` ; le job
  `🧪 Deploy PREPROD` de `ci.yml` vérifie le label `revision` de l'image et la version servie.
  DEV ne renvoie pas de `revision` sur `/health`. PROD non relevée.
- **P2.** Aucun agent n'accède directement à la PROD : elle n'est atteinte que par `git push`,
  GitHub Actions et Docker. Source : ADR-012, ADR-129 D1. ADR-130 note que le runner posé sur
  l'hôte PROD déplace cette garantie.
  Application : L1. Gardes d'agent dans `scripts/claude-hooks/pretool-bash-guard.sh` (lancement
  d'un déploiement PROD, Docker sur les conteneurs PROD) ; PROD ne se déploie que depuis un tag
  `v*` (`release-prod.yml`). Aucune garde sur un accès distant direct : intention seulement sur ce
  point.
- **P3.** Le déploiement PREPROD est en lecture seule : il lit la base de production par une
  passerelle en lecture seule et n'a aucun accès d'écriture. Il n'existe pas de base PREPROD
  séparée. Source : ADR-028, ADR-075.
  Application : L3. `docker-compose.preprod.yml`, contrôles du job `🧪 Deploy PREPROD`, test
  `scripts/ci/preprod-readonly-gateway.test.cjs`. La couche `write-detect` d'ADR-028 n'existe pas.

## Données et base

- **P4.** Les appels RPC vers la base passent par le RPC gate (`callRpc`), qui les classe par
  niveau et bloque les plus sensibles selon le mode de l'environnement. Une écriture faite hors
  RPC n'y passe pas. Source : ADR-003, ADR-102.
  Application : L3 pour le check requis `🛡️ RPC Safety Gate`, qui refuse tout nouvel appel `.rpc(`
  direct ; `backend/src/security/rpc-gate/rpc-gate.service.ts`. Écart : 12 fichiers appellent
  encore `.rpc(` en direct, sous liste de tolérance. Mode servi en PROD non vérifié.
- **P5.** Toute table exposée est protégée par RLS. Source : ADR-021.
  Application : intention seulement côté dépôt. Aucun contrôle RLS dans le dépôt (`.squawk.toml`
  renvoie aux advisors Supabase). Garde voisine : `scripts/lint/check-definer-anon-surface.sh`.
  État de la base non vérifié.
- **P6.** Toute migration ajoutée ou modifiée par une PR passe squawk avant la fusion.
  Source : ADR-065.
  Application : L3. Check requis `🗄️ Migration Safety` (`ci.yml`, `.squawk.toml`). Les migrations
  antérieures ne sont pas relintées ; l'application manuelle (`apply-supabase-migrations.yml`) ne
  relance pas squawk.
- **P7.** `type_id` est une séquence globale monotone, jamais réutilisée. KTYPNR est une clé source,
  jamais un id. Source : ADR-085.
  Application : L1 pour l'allocateur
  (`backend/supabase/migrations/20260615_massdoc_type_id_allocator.sql`). Son usage n'est imposé
  par aucun appelant, contrainte ou trigger : intention seulement. État de la base non vérifié.

## Paiement et chaîne logicielle

- **P8.** Aucun endpoint de test de paiement n'existe en PROD. Source : ADR-014 (retrait de
  `/api/paybox/callback-test`) ; `.claude/rules/payments.md` pour la règle générale.
  Application : L3 pour le retrait d'ADR-014 (404 relevé sur DEV). Écart : une route de test du
  module de paiement existe sur `main`, sous gardes d'administrateur, sans garde d'environnement.
  La règle ast-grep `no-test-routes-without-env-guard` ne couvre que le frontend. PROD non vérifiée.
- **P9.** Les images installent leurs dépendances npm avec `--ignore-scripts`. Source : ADR-030.
  Application : L2 pour l'image applicative (`Dockerfile`). Écart : `Dockerfile.worker` installe
  sans le drapeau. Le contrôle CI des `postinstall` prévu par ADR-030 n'existe pas.

## Contenu, WIKI et SEO

- **P10.** Le contenu suit RAW → WIKI → projections → consommateurs. Aucun consommateur ne lit RAW.
  Une promotion WIKI se fait sur preuve, auto-review sémantique comprise. Aucune relecture humaine
  d'une fiche n'en est une condition. Restent des actes humains, régis par leurs ADR : la
  validation d'une plage chiffrée par famille, l'autorité d'une source inconnue, le flip
  `diagnostic_safe` et `reviewed`, la relecture des règles de sécurité du diagnostic et celle des
  relations (ADR-119 D7 ; voir P19). Plancher de la promotion automatique : 0.85 ; c'est une
  condition parmi d'autres. Source : ADR-031, ADR-119, ADR-125 D2 pour le seuil, ADR-091 pour la
  porte de promotion (condensés ici en un seul principe).
  Application : L2 dans le dépôt WIKI (`_scripts/promotion_decision.py`, `AUTO_PROMOTE_THRESHOLD`,
  et ses tests). Le verrou des fiches de sécurité est fermé : elles n'ont aujourd'hui aucune voie
  de promotion automatique. « Aucun consommateur ne lit RAW » : aucune garde dans le monorepo.
- **P11.** Le RAG est un consommateur en lecture seule, sans autorité de production de contenu.
  Source : ADR-031, ADR-046.
  Application : L2 pour le neuf (`.ast-grep/rules/no-direct-rag-knowledge-write.yml`,
  `scripts/audit/check-rag-authority-read-ratchet.ts`). Écart : 12 fichiers hors module RAG lisent
  encore la base RAG pour produire du contenu ; la règle de lecture
  (`seo-no-rag-as-content-source.yml`) est en avertissement. Ces producteurs sont à retirer
  (`CLAUDE.md`, invariant 4).
- **P12.** Chaque rôle SEO a un seul générateur. Les règles métier d'un rôle vivent dans les paquets
  canoniques, pas dans les services : l'identité des rôles dans `packages/seo-roles/`, leurs
  contrats dans `packages/seo-role-contracts/`. Source : ADR-040, ADR-046, ADR-047.
  Application : L2 (ast-grep `seo-no-bare-role-literal`, `seo-no-inline-role-keyword-pattern` ;
  `contract-gate.yml`). « Un seul générateur » reste une cible : plusieurs services R1 subsistent.
- **P13.** Sur une page valide (`productCount ≥ 2` et compatibilité réelle), quatre actions sont
  interdites en automatique : supprimer, désindexer, pointer le canonical vers une page sœur,
  exclure du sitemap. Une page invalide relève de P14. Source : ADR-067, ADR-068, écrits pour R2 v2
  « et tout futur rôle SEO transactionnel par analogie ».
  Application : L2 pour R2 v2 (`backend/src/modules/seo/r2/services/r2-eligibility.service.ts` et
  son test). Hors R2 : intention seulement.
- **P14.** Sur R2, quand le véhicule existe au catalogue et que seul le couple gamme × véhicule est
  vide, la page répond HTTP 200 avec `noindex, follow`, sans canonical, avec une liste
  d'alternatives (JSON-LD `ItemList`) ; jamais 404 ni 410 pour ce cas. Les codes 404 et 410
  restent ceux des raisons 1 à 3 de `REJECT` d'ADR-068. Source : ADR-076, ADR-125 D4.
  Application : L2 (`frontend/app/utils/pieces-vehicle.loader.server.ts`, branche `noProducts` ;
  le même chargeur renvoie 404 et 410 pour les autres cas).
- **P15.** R2 se compose de R1 ⊕ R8 et préserve `catalog_signature`. Source : ADR-086 pour la
  composition, ADR-066 pour la signature ; `CLAUDE.md`, invariant 6.
  Application : L2 (`r2-catalog-signature.service.ts`, `r2-composition-input-snapshot.service.ts`
  et son test).
- **P16.** Une gate dure bloque les balises dupliquées sur les pages `indexable_effective`.
  Source : ADR-095.
  Application : L2, implémentée et non activée. `seo-balise-collision-gate.ts` et ses tests ; un
  seul appelant (enrichisseur R8) ; le drapeau `SEO_CHAIN_DUPLICATE_GATE_MODE` vaut `off` par
  défaut et n'est posé dans aucun fichier compose.
- **P17.** Chaque champ a une seule autorité : un champ n'a jamais deux sources sur une même page
  (ADR-111 D1, écrit pour les champs R1 d'une gamme basculée). Aucun writer n'écrit les slots R1 ;
  les tables `__seo_r1_gamme_slots` et `__seo_gamme_purchase_guide` restent intactes, et leur sort
  est une décision de l'owner (D5). Source : ADR-111.
  Application : L2 (`backend/src/config/field-catalog.constants.ts`, un rôle propriétaire par champ
  éditorial protégé ; test `scripts/audit/rag-r1-write-closure.test.ts`).
- **P18.** Les projections SEO servies sont des snapshots CQRS. Source : ADR-072, écrit pour R2.
  Application : L2 pour R2 (migration `20260516_seo_r2_v2_cqrs_snapshot.sql`,
  `pr-2e-readiness-gate.yml`). Pour les autres rôles, la lecture des projections est sous drapeau
  `SEO_PROJECTION_READ_V1`, éteint par défaut. État servi non vérifié.

## Diagnostic

- **P19.** La base de diagnostic est sourcée WIKI et n'a qu'une voie d'écriture. Seule une relation
  diagnostic relue est projetée. « Relue » se lit `evidence.reviewed: true` : c'est un acte humain
  (ADR-033), et une règle de sécurité du diagnostic exige toujours une source et une relecture
  humaine (ADR-112 D5). Source : ADR-112, ADR-115.
  Application : L2 (migration `20261012_diag_projection_requires_review.sql`, contrainte
  `CHECK (reviewed)` ; `scripts/wiki/validate-gamme-diagnostic-relations.py` et son test). Les
  drapeaux de projection sont éteints par défaut.

## Changements, revue et fusion

- **P20.** Un changement passe par une branche et une PR. La fusion suit l'un des trois circuits.
  - **Faible** : CI verte, puis fusion automatique.
  - **Moyen** : CI verte et verdict GO de la revue Claude sur la tête, puis fusion automatique.
    La revue Claude relit sans écrire ; elle remplace la revue Codex (décision 91). Elle
    s'authentifie par le seul jeton `CLAUDE_CODE_OAUTH_TOKEN`, sans clé d'API ni repli
    (décision 105). Sans verdict, la PR reste en attente : c'est un échec fermé, jamais un GO.
  - **Élevé** : approbation de l'owner sur la tête. Ce circuit couvre les zones CODEOWNERS, tout
    risque `high`/`critical` de `ownership.yaml` et tout chemin non classé.

  Le circuit est calculé par `scripts/ci/merge-circuit.mjs`. Un agent ne fusionne jamais lui-même
  et n'arme jamais l'auto-fusion : seul le workflow des circuits l'arme
  (`.github/workflows/merge-circuits.yml`), par l'App GitHub `automecanik-actions`, dont la clé
  n'existe que dans l'environnement `app-actions` restreint à `main`, jamais sur le DEV.
  Transition : tant que l'owner n'a pas réglé la protection de `main` pour ce workflow, la règle
  de la porte ADR-124 reste celle qui s'applique. Source : décisions 72, 91 et 105 ; ADR-138 D2.
  Les circuits amendent ADR-102, ADR-123 et ADR-124 sur ce point ; ADR-123 et ADR-124 leur cèdent
  une fois les circuits activés.
  Application, relevé du 2026-11-16 : le workflow est sur `main` (#2093, #2107, #2110) ; test
  `scripts/ci/merge-circuit.test.mjs` vert.
  - Faible : L4, observé une fois de bout en bout (PR #2109, fusionnée par l'App à 22:21 UTC).
  - Moyen : L2, jamais observé en service ; aucune revue Claude n'y a rendu de verdict.
  - Élevé : L2, non observé tel qu'écrit. Les PR #2110 et #2111 ont été fusionnées par l'owner
    lui-même, sans revue approuvante enregistrée, le check `🚦 Circuit de fusion` en échec.
  - `🚦 Circuit de fusion` n'est pas un check requis de `main`. Dire si la transition est close
    revient à l'owner ; ce journal ne le tranche pas.
- **P21.** Mandat, revue, décision et fusion sont des actes distincts : chacun a son auteur et sa
  preuve, aucun n'en emporte un autre. Le mandat explicite couvre son exécution et sa vérification,
  dans ses limites : il ne lève aucune permission technique, aucune validation propre à un domaine,
  aucune restriction de fusion, de publication ou de déploiement. Source : ADR-121.
  Application : intention seulement. La séparation de la fusion est portée par P20.
- **P22.** La preuve de revue est liée au SHA de tête de la PR : un push qui change la tête la rend
  périmée. Source : ADR-120.
  Application : L2. Le workflow des circuits lie l'approbation et l'armement au SHA de tête
  (`--match-head-commit`). Le check requis `🧾 DoD self-evaluation present`
  (`scripts/ci/pr-dod-gate.mjs`) laisse l'item de preuve de revue en avis.
- **P23.** Avant de créer, on cherche l'existant : les équivalents et leurs consommateurs, sans
  quota fixe. Un résultat nul ne prouve pas à lui seul l'absence. Source : ADR-123 D9.
  Application : intention seulement (`.claude/knowledge/verify-before-invent.md`). Garde voisine :
  `registry-new-file-gate.yml` exige un propriétaire et un domaine pour tout nouveau fichier.
- **P24.** La file de travail unique est faite des issues du monorepo : une issue = un mandat.
  Source : ADR-128.
  Application : L3 pour la routine `pilote-file.yml`. Écart de pratique : les mandats du
  2026-11-16 (AR à BD) sont transmis en session, pas en issue. ADR-128 n'active rien par lui-même ;
  chaque activation est une étape de son plan, déclenchée par l'owner.
- **P25.** Chaque routine a un déclencheur unique et un contrat Trigger / Execution / Evidence.
  Aucun orchestrateur maison n'est ajouté : ni bus d'événements, ni ordonnanceur, ni registre
  d'agents, ni moteur de permissions, ni tableau de bord, ni orchestrateur de tâches.
  Source : ADR-034, ADR-128 D3, ADR-129.
  Application : L2 (`automation-registry-validate.yml`, `cron-schedulemodule-guard.yml`). Trois
  décorateurs `@Cron(` subsistent dans `backend/src` alors que `ScheduleModule` est désactivé. Le
  module `command-center-orchestrator` existe sous drapeau éteint (ADR-087).

## Méthode

- **P26.** Les méthodes tierces retirées (BMAD, Superpowers, Spec Kit) ne reviennent pas sans
  décision. Source : ADR-118.
  Application : L0, appliqué par absence. Aucune garde contre un retour : intention seulement.
- **P27.** L'amélioration continue est un avis, jamais une gate bloquante. Source : ADR-082.
  Application : L0, appliqué. Aucun workflow n'en fait une porte.
- **P28.** Toute dérogation porte une clause d'expiration. L'exploration a un budget borné.
  - G9 : un verdict empirique cité pour justifier un `DO_NOT_START`, un pivot stratégique ou une
    priorité `TOP` expire 12 semaines après sa date de mesure, sauf renouvellement par une nouvelle
    mesure.
  - G10 : `EXPLORATION_BUDGET` compte au plus 3 entrées, dont une seule active ; une sonde tient
    en 5 jours-agent au plus, et son coût de gouvernance ne dépasse pas 20 % de son temps
    d'exécution.

  Source : ADR-081 (G9, G10) ; ADR-138, qui place leur lecture dans ce journal.
  Application : G10, L2 (`scripts/governance/validate-exploration-probe.sh`, branché dans
  `governance-checks.yml`). G9, L1 (`scripts/governance/check-verdict-expirations.sh`, rapport
  seul, non branché). « Toute dérogation » : intention seulement.
- **P29.** Voir la règle de vigueur, en tête de ce fichier : c'est le même principe. Le numéro est
  gardé pour les renvois.
  Application : L2 (`ci.yml`, `scripts/governance/validate-agent-operating-map.js --contracts`).
  « Réglages vérifiés par schéma en CI » ne désigne aujourd'hui que ce contrôle des contrats.
- **P30.** Le contrat de sortie des agents (AEC) a une seule source modifiable. Jusqu'à l'étape 1
  du plan de sortie (`docs/audit/mandat-ar-20261116/inventaire-vault-et-plan.md`), c'est
  `ledger/rules/rules-agent-exit-contract.md` du vault ; ensuite,
  `.spec/00-canon/canon-distribution/rules-agent-exit-contract.md` du monorepo, avec son manifeste
  de hash, et sa révision passe par une PR du monorepo et son circuit. Ses copies
  (`.claude/canon-mirrors/`, WIKI, RAW) se génèrent depuis la source et ne s'éditent jamais à la
  main ; une copie non déclarée ne fait pas foi. Source : décisions 72 et 73, ADR-138 D4 (AEC 1.3.0).
  Application : L2 (`agent-exit-contract-hash.yml`, `canon-sync.yml`). Au 2026-11-16, l'étape 1
  n'est pas fusionnée (PR #2112 ouverte) : la source modifiable est celle du vault.
- **P31.** Un agent IA propose, analyse et recommande ; il ne s'accorde jamais lui-même une
  validation. La validation suit le contrat du domaine, toujours indépendante du producteur : P10
  et P19 pour le WIKI et le diagnostic, P20 et P22 pour le code, l'approbation de l'owner pour une
  règle de ce journal (règle de vigueur) et pour ce que son domaine lui réserve (par exemple
  `content_approved` en marketing, `workspaces/marketing/fafa-media-factory/README.md`).
  Source : ADR-129, qui conserve AI2 et AI4 de `rules-ai-cos`.
  Application : intention seulement dans le monorepo. Le WIKI refuse une autorité de relecture
  auto-déclarée (`promotion_decision.py`, motif `REVIEW_AUTHORITY_CLAIMED`).
