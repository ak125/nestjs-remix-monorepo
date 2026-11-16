# Journal des principes — AutoMecanik

> Décision 72 de l'owner (2026-11-15) : le monorepo est la seule source de la gouvernance.
> Décision 73 : le dépôt `ak125/governance-vault` passe en archive en lecture seule, une fois
> déplacé ce qui vit encore.
> Côté vault, ADR-138 transcrit ces deux décisions : il remplace ADR-015, amende 18 ADR et l'AEC
> (version 1.3.0), et dit pour chacun ce qui reste valable (PR ak125/governance-vault#422,
> **ouverte, non fusionnée au 2026-11-16** ; la signature et la fusion reviennent à l'owner).

## Règle de vigueur

**Fusionné sur `main` = en vigueur.** Un principe entre en vigueur, change ou sort par une PR qui
modifie ce fichier. Ce fichier est en zone CODEOWNERS : la PR suit le circuit élevé, donc
l'approbation de l'owner. Il n'existe pas d'autre statut (pas de `proposed` ni `accepted`).
La version en vigueur est celle de `main`. Une branche, une PR ouverte ou une copie ne sont pas en
vigueur.

Chaque principe cite sa source : l'ADR du vault d'où il vient (tri du 2026-11-16,
`docs/audit/mandat-ar-20261116/tri-adr.md`) ou la décision de l'owner. L'ADR reste une archive
de la raison. Ce fichier est la règle. En cas d'écart, ce fichier prime ; l'écart est signalé et
corrigé par PR.

## Environnements et accès

- **P1.** DEV, PREPROD et PROD restent séparés. Un déploiement se décrit par six objets et six
  preuves. Source : ADR-001, ADR-075.
- **P2.** Aucun agent n'accède directement à la PROD. Source : ADR-002 §2.2.
- **P3.** La base PREPROD est en lecture seule. Source : ADR-028.

## Données et base

- **P4.** Les écritures sensibles en base passent par le RPC gate. Source : ADR-003, ADR-102.
- **P5.** Toute table exposée est protégée par RLS. Source : ADR-021.
- **P6.** Toute migration passe squawk avant d'être appliquée. Source : ADR-065.
- **P7.** `type_id` est une séquence globale monotone, jamais réutilisée. KTYPNR est une clé source,
  jamais un id. Source : ADR-085.

## Paiement et chaîne logicielle

- **P8.** Aucun endpoint de test de paiement n'existe en PROD. Source : ADR-014.
- **P9.** Les images installent leurs dépendances npm avec `--ignore-scripts`. Source : ADR-030.

## Contenu, WIKI et SEO

- **P10.** Le contenu suit RAW → WIKI → projections → consommateurs. Aucun consommateur ne lit RAW.
  Une promotion WIKI se fait sur preuve, auto-review sémantique comprise. Aucune relecture humaine
  n'en est une condition. Seuil de score : 0.85. Source : ADR-031, ADR-091, ADR-119, ADR-125
  (condensés ici en un seul principe).
- **P11.** Le RAG est un consommateur en lecture seule, sans autorité de production de contenu.
  Source : ADR-031, ADR-046.
- **P12.** Chaque rôle SEO a un seul générateur. Les règles métier vivent seulement dans
  `packages/seo-role-contracts/`. Source : ADR-046, ADR-047.
- **P13.** Quatre actions sont interdites en automatique : supprimer, désindexer, pointer le
  canonical vers une page sœur, exclure du sitemap. Source : ADR-067, ADR-068.
- **P14.** Une page sans contenu valable répond HTTP 200 avec `noindex,follow`, jamais 404 ni 410.
  Source : ADR-076.
- **P15.** R2 se compose de R1 ⊕ R8 et préserve `catalog_signature`. Source : ADR-066, ADR-086.
- **P16.** Une gate dure bloque les balises dupliquées sur les pages `indexable_effective`.
  Source : ADR-095.
- **P17.** Chaque champ a une seule autorité. Les slots R1 ne sont jamais réécrits. Source : ADR-111.
- **P18.** Les projections SEO servies sont des snapshots CQRS. Source : ADR-072.

## Diagnostic

- **P19.** La base de diagnostic est sourcée WIKI et n'a qu'une voie d'écriture. Seule une relation
  diagnostic relue est projetée. Source : ADR-112, ADR-115.

## Changements, revue et fusion

- **P20.** Un changement passe par une branche et une PR. La fusion suit l'un des trois circuits.
  - **Faible** : CI verte, puis fusion automatique.
  - **Moyen** : CI verte et verdict GO de la revue Claude sur la tête, puis fusion automatique.
    La revue Claude relit sans écrire ; elle remplace la revue Codex (décision 91).
  - **Élevé** : approbation de l'owner sur la tête. Ce circuit couvre les zones CODEOWNERS, tout
    risque `high`/`critical` de `ownership.yaml` et tout chemin non classé.

  Le circuit est calculé par `scripts/ci/merge-circuit.mjs`. Un agent ne fusionne jamais lui-même
  et n'arme jamais l'auto-fusion : seul le workflow des circuits l'arme. Source : décisions 72 et 91
  (remplacent ADR-102, ADR-123, ADR-124 sur ce point).
  **Statut au 2026-11-16 : proposé, non activé.** Tant que l'owner n'a pas appliqué le workflow
  et réglé la protection de `main`, la règle de la porte ADR-124 reste celle qui s'applique.
- **P21.** Mandat, revue, décision et fusion sont des actes distincts. Le mandat couvre son
  exécution. Source : ADR-121.
- **P22.** La preuve de revue est liée au SHA de tête de la PR. Source : ADR-120.
- **P23.** Avant de créer, on cherche l'existant. Source : ADR-123 D9.
- **P24.** La file de travail unique est faite des issues du monorepo : une issue = un mandat.
  Source : ADR-128.
- **P25.** Chaque routine a un déclencheur unique et un contrat Trigger / Execution / Evidence.
  Aucun orchestrateur maison n'est ajouté. Source : ADR-034, ADR-129.

## Méthode

- **P26.** Les méthodes tierces retirées (BMAD, Superpowers, Spec Kit) ne reviennent pas sans
  décision. Source : ADR-118.
- **P27.** L'amélioration continue est un avis, jamais une gate bloquante. Source : ADR-082.
- **P28.** Toute dérogation porte une clause d'expiration. L'exploration a un budget borné.
  Source : ADR-081.
- **P29.** Est normatif ce qui est fusionné sur `main` dans ce journal, dans les contrats de
  département (`.spec/00-canon/ai-registry/agent-operating-map.yaml`) et dans les réglages vérifiés
  par schéma en CI. Une ADR du vault n'est plus normative par elle-même. Source : décision 72
  (remplace ADR-101 D1 ; côté vault, ADR-138 remplace ADR-015 et amende ADR-101).
- **P30.** Le contrat de sortie des agents (AEC) a une seule source modifiable. Jusqu'à l'étape 1
  du plan de sortie (`docs/audit/mandat-ar-20261116/inventaire-vault-et-plan.md`), c'est
  `ledger/rules/rules-agent-exit-contract.md` du vault ; ensuite,
  `.spec/00-canon/canon-distribution/rules-agent-exit-contract.md` du monorepo, avec son manifeste
  de hash, et sa révision passe par une PR du monorepo et son circuit. Ses copies
  (`.claude/canon-mirrors/`, WIKI, RAW) se génèrent depuis la source et ne s'éditent jamais à la
  main ; une copie non déclarée ne fait pas foi. Source : décisions 72 et 73, ADR-138 D4 (AEC 1.3.0).
- **P31.** Un agent IA propose, analyse et recommande ; il ne s'accorde jamais lui-même une
  validation. La validation suit le contrat du domaine, toujours indépendante du producteur : P10
  pour le WIKI, P20 et P22 pour le code, l'owner pour ce que son domaine lui réserve (par exemple
  `content_approved` en marketing). Source : ADR-129, qui conserve AI2 et AI4 de `rules-ai-cos`.
