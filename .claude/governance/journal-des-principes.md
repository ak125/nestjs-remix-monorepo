# Journal des principes — AutoMecanik

> Décision 72 de l'owner (2026-11-15) : le monorepo est la seule source de la gouvernance.
> Décision 73 : le dépôt `ak125/governance-vault` passe en archive en lecture seule, une fois
> déplacé ce qui vit encore.
> Côté vault, ADR-138 transcrit ces deux décisions : il remplace ADR-015, amende 18 ADR et l'AEC
> (version 1.3.0), et dit pour chacun ce qui reste valable (PR ak125/governance-vault#422,
> fusionnée le 2026-11-16 à 20:52 UTC).
> Décision 109 (2026-11-16) : tri du journal. L'audit principe par principe et ses preuves sont
> dans `docs/audit/mandat-bd-20261116/`.
> Décision 120 (2026-11-17) : l'owner retient les douze réponses proposées par cet audit
> (`docs/audit/mandat-bd-20261116/README.md`, §5). Ce journal porte celles qui le concernent,
> citées mot pour mot ; les autres partent en mandats séparés
> (`docs/audit/mandat-bd-20261116/projets-de-mandats.md`).

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
constate, elle ne règle pas. Un principe est en vigueur quel que soit son niveau. Une ligne revue
depuis porte sa date : celles du 2026-11-17 sont relevées sur `main` `03ffd4f1e`.

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
- **P32.** Importer un tarif, activer une pièce (la rendre vendable) et l'afficher au catalogue
  sont trois étapes distinctes. Source : ADR-084 « écriture du tarif » (PR vault #315, jamais
  fusionnée).
  Application : L3 pour les tests (check requis `🧪 Backend Tests`, relevé vert sur `main` le
  2026-11-17). Trois services de `backend/src/modules/pricing/services/` :
  `price-import.service.ts` écrit le coût et laisse la disponibilité inchangée par défaut ;
  `price-activation.service.ts` ne change que `pri_dispo` ; `catalog-display-activation.service.ts`
  ne change que `piece_display`, pour des pièces déjà vendables. Écart : l'option `activate` de
  l'import, fermée par défaut, rend vendable dans le même commit. Usage en service non observé.

## Paiement et chaîne logicielle

- **P8.** Aucun endpoint de test de paiement n'existe en PROD. Source : ADR-014 (retrait de
  `/api/paybox/callback-test`) ; `.claude/rules/payments.md` pour la règle générale.
  Application : L3 pour le retrait d'ADR-014 (404 relevé sur DEV). Relevé du 2026-11-17 : la route
  de test du module de paiement signalée le 2026-11-16 est retirée (#2117) ; plus aucune route
  nommée `test` dans `backend/src/modules/payments`. PROD sert une révision qui contient ce
  retrait (`/health` lu à 06:56 UTC) ; la route elle-même n'y a pas été sondée. La règle ast-grep
  `no-test-routes-without-env-guard` ne couvre que le frontend : rien n'empêche le retour d'une
  telle route dans le backend.
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
  exclure du sitemap. Une page invalide relève de P14. Ce principe vaut pour tous les rôles SEO
  (décision 120 : « Pour tous, comme doctrine ; le mécanisme n'existe que pour R2 et le journal le
  dit. »). Source : ADR-067, ADR-068, écrits pour R2 v2 « et tout futur rôle SEO transactionnel par
  analogie » ; décision 120 pour la portée.
  Application : L2 pour R2 v2 (`backend/src/modules/seo/r2/services/r2-eligibility.service.ts` et
  son test). Le mécanisme n'existe que pour R2 ; pour les autres rôles : intention seulement.
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
- **P16.** Une gate dure bloque les balises dupliquées sur les pages `indexable_effective`. Elle
  reste éteinte jusqu'à une décision datée de l'owner (décision 120 : « La laisser éteinte jusqu'à
  une décision datée de ta part ; P16 dit déjà son état. »). Source : ADR-095 ; décision 120 pour
  l'état.
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
- **P41.** Aucune signature publique ne nomme une IA comme auteur. L'auteur affiché est
  AutoMecanik. Source : décision 137 de l'owner (2026-11-17), qui retient ce texte mot pour mot ;
  position de l'owner du 2026-11-14, visant toute signature (article, vidéo, publication sociale).
  Origine du texte : ADR-132 R2, PR ak125/governance-vault#414, ouverte et non fusionnée.
  Application (relevé du 2026-11-17, `main` `fc470e41a`) : L1 pour les pages du site, sans test ni
  contrôle. Le code écrit l'organisation comme auteur : balise `meta author` dans neuf fichiers
  de `frontend/app` et `frontend/public`, champ `author` de type `Organization` des données
  structurées dans cinq fichiers de `frontend/app` et dans
  `backend/src/modules/layout/services/meta-tags.service.ts`. Aucun test, aucune règle ast-grep,
  aucun contrôle CI ne refuse une autre valeur ; deux chemins prennent une valeur variable (ce
  service, et `frontend/app/utils/seo.server.ts`, sans appelant). Observé en PROD le 2026-11-17 à
  14:21 UTC sur deux pages du blog : l'auteur déclaré est l'organisation, sous les graphies
  « Automecanik » et « Automecanik - Experts Automobile ». Vidéo et publication sociale :
  intention seulement, aucune publication vérifiée. Signalé, non tranché ici : le canon de la
  persona Fafa admet la signature « Moi c'est Fafa, le mécano IA d'AutoMecanik. »
  (`workspaces/marketing/.claude/skills/fafa-persona-canon/SKILL.md`), et le gabarit
  `design-system/roles/R3-blog.md` donne un auteur de type `Person`.

## Diagnostic

- **P19.** La base de diagnostic est sourcée WIKI et n'a qu'une voie d'écriture. Seule une relation
  diagnostic relue est projetée. « Relue » se lit `evidence.reviewed: true` : c'est un acte humain
  (ADR-033), et une règle de sécurité du diagnostic exige toujours une source et une relecture
  humaine (ADR-112 D5). Source : ADR-112, ADR-115.
  Application : L2 (migration `20261012_diag_projection_requires_review.sql`, contrainte
  `CHECK (reviewed)` ; `scripts/wiki/validate-gamme-diagnostic-relations.py` et son test). Les
  drapeaux de projection sont éteints par défaut.

## Interface et design system

Décisions de l'owner du 20 nov. 2026, heure de Paris, prises sur l'audit de la PR #2215
(`docs/audit/design-system-revue-20261119/`, en brouillon et non fusionnée au relevé, tête
`89ad601b6`) et ratifiées par « oui » à 22:53. Ordre d'application retenu à 22:44 : « journal,
puis tokens, puis composants et pages ». Les chiffres de rendu cités sont ceux de cet audit ; les
comptes tirés du code sont relevés le 2026-11-20 sur `main` `1210455cd`, dans `frontend/app`
hors admin sauf mention.

- **P44.** Couleurs. Sur les pages publiques, une couleur s'emploie par son rôle, jamais par une
  valeur brute. Le navy et l'orange sont les couleurs de la marque. L'orange signale l'action
  principale : une seule par écran, avec un texte navy ; les autres actions sont en contour. Le
  rouge est réservé à l'erreur et à l'action destructive. Il n'y a ni violet, indigo, rose ou
  fuchsia, ni couleur par famille de pièces, ni thème sombre.
  Source : décisions de l'owner du 20 nov. 2026 (option A3 retenue à 17:29 ; thème sombre
  retiré à 21:56 ; rouge réservé à l'erreur à 21:58 ; violets retirés à 22:29 ; couleur par
  famille retirée à 22:31), ratifiées à 22:53. Audit de la PR #2215, non fusionnée, option A3
  (`options/README.md`, l. 448-461).
  Application (relevé du 2026-11-20, `main` `1210455cd`) : L2. Rôles de couleur dans
  `packages/design-tokens/src/tokens.json` (groupes `navy`, `cta`, `semantic`) ; contrat Zod
  `packages/design-tokens/scripts/tokens-schema.mjs` (rampes `cta` et `navy`) et tests
  `packages/design-tokens/tests/tokens.test.mjs`, lancés par le job « 🎨 Design-tokens gate »
  (`.github/workflows/ci.yml`, l. 150-158). Le ratchet `.github/workflows/impeccable-ratchet.yml`
  bloque un nouveau constat (`audit/impeccable/baseline.json` : 9, dont `ai-color-palette` 1).
  Écarts : 223 emplois de `violet|indigo|pink|fuchsia|purple-NNN` dans 60 fichiers (le mandat
  cite 213 hors admin ; chiffre absent de l'audit #2215) ; jeton `color.accent.persianIndigo`
  `#350B60` ; `frontend/app/utils/family-theme.ts` (couleur par famille, 11 fichiers l'emploient) ;
  57 classes `dark:` dans 6 fichiers, 50 hors admin (le mandat cite 62 ; absent de l'audit) ;
  clés `dark` et `shadcnDark` de `tokens.json`, exigées par `tokens-schema.mjs`.
- **P45.** Lisibilité. Un texte a un contraste d'au moins 4,5:1 (3:1 pour un grand texte) et une
  taille d'au moins 12 px ; un champ de saisie fait 16 px sur mobile. Le bord d'un champ ou d'un
  contrôle atteint 3:1. Le focus au clavier est toujours visible et n'est jamais couvert par un
  élément collant. Une cible tactile fait au moins 44 px. Les animations s'arrêtent quand
  l'utilisateur demande moins de mouvement.
  Source : décisions de l'owner du 20 nov. 2026 (option A3 à 17:29 ; 12 px minimum à 22:02),
  ratifiées à 22:53. WCAG 2.2, critères 1.4.3, 1.4.11, 2.4.7, 2.4.11, 2.5.8 et 2.3.3. Audit de
  la PR #2215, non fusionnée (`options/README.md`, l. 79 ; `README.md`, §f et §g).
  Application (relevé du 2026-11-20, `main` `1210455cd`) : L1. Contrastes des paires de tokens
  calculés dans `packages/design-tokens/tests/tokens.test.mjs` ; arrêt des animations CSS dans
  `frontend/app/styles/animations.css` (l. 175-182, chargé par `frontend/app/root.tsx`, l. 418-425)
  et `frontend/app/global.css` (l. 920-925). Cibles de 44 px et débordement contrôlés par
  `frontend/tests/e2e/mobile-audit-complete.spec.ts`, absent du jeu e2e de la CI.
  `@axe-core/playwright` est déclaré dans `frontend/package.json` sans test qui l'emploie.
  Écarts, mesurés par l'audit #2215 sur dix passages : 466 textes sous le seuil de contraste,
  61 bords sous 3:1, 75 focus invisibles ou couverts ; textes de 10 px dans la barre du bas (§f).
  Le mandat cite 111 textes sous 12 px hors admin, chiffre absent de l'audit ; le code compte
  113 classes `text-[6px]` à `text-[11px]` dans 54 fichiers. `focus:ring-blue-500` : 175 emplois,
  admin compris. `frontend/app/hooks/useScrollBehavior.ts` (l. 15) impose le défilement doux sans
  condition.
- **P46.** Valeurs. Toute valeur d'interface vient des tokens, dont la source unique est
  `packages/design-tokens/src/tokens.json`, sans valeur en double. Trois rayons à rôle fixe
  (8 px champs et boutons, 12 px cartes, 16 px grands blocs) et la pilule ; trois ombres ; trois
  polices (Outfit pour les titres, DM Sans pour le texte, Roboto Mono pour les codes qu'on
  recopie). Toute graisse employée est chargée. Aucune taille, couleur, espacement, rayon ni
  ombre n'est écrit en dur.
  Source : décisions de l'owner du 20 nov. 2026 (rayons 8/12/16 et trois ombres à 22:05 ; Roboto
  Mono pour les codes à 22:14), ratifiées à 22:53. Audit de la PR #2215, non fusionnée
  (`README.md`, §f).
  Application (relevé du 2026-11-20, `main` `1210455cd`) : L2. Source unique `tokens.json`,
  sorties générées vérifiées octet pour octet (`build:check`) et contrat `tokens-schema.mjs` dans
  le job « 🎨 Design-tokens gate » (`.github/workflows/ci.yml`, l. 150-158). Aucune règle ne
  refuse une valeur en dur : `frontend/eslint.config.js` (l. 22-38) ne vise que `w-screen` et
  `hidden`, et `.ast-grep/rules/` n'a aucune règle d'interface. Écarts :
  `borderRadius` a 9 valeurs et `shadows` 8 ; `fontWeight` va de 100 à 900 alors que
  `frontend/app/global.css` (l. 24-52) charge Outfit 400 à 800, DM Sans 400 à 700 et Roboto Mono
  400 (audit §f : Outfit 900 et DM Sans 800-900 employés, non chargés ; `font-black` 13 emplois et
  `font-extrabold` 25, admin compris) ; la pile `mono` place Roboto Mono en quatrième. Le mandat
  cite 22 groupes de valeurs en double, chiffre absent de l'audit ; un regroupement par groupe et
  par valeur en donne 38 (dont `color.primary.*` égal à `color.navy.*`). 37 `rounded-[…]` et
  48 `shadow-[…]` en valeur arbitraire.
- **P47.** Composants. Un bouton, un champ ou une icône vient du composant partagé et de la
  bibliothèque d'icônes unique. Aucun n'est refait à la main dans une page.
  Source : décisions de l'owner du 20 nov. 2026, ratifiées à 22:53. Audit de la PR #2215, non
  fusionnée.
  Application (relevé du 2026-11-20, `main` `1210455cd`) : L0. `.claude/rules/frontend.md` (l. 20)
  prescrit `~/components/ui/` et `lucide-react` ; aucune garde. `lucide-react` est la seule
  bibliothèque d'icônes de `frontend/package.json`. Écarts, hors `components/ui` : 307 `<button`
  et 143 `<input` natifs, 189 `<svg` écrits en ligne dans 50 fichiers.
- **P48.** Stabilité et mesure. Le décalage de mise en page (CLS) ne dépasse pas 0,1, au
  chargement et après défilement, sur chaque type de page. Une image déclare ses dimensions. Les
  mesures se font à 390 px (référence) et 1440 px ; aucune page ne déborde à 360 px ni à 320 px.
  Source : décisions de l'owner du 20 nov. 2026 (CLS à 0,1 à 22:18 ; largeurs 390, 360 et 320 à
  22:21), ratifiées à 22:53. Core Web Vitals : un CLS de 0,1 ou moins est « bon ». Audit de la PR
  #2215, non fusionnée (`README.md`, §h).
  Application (relevé du 2026-11-20, `main` `1210455cd`) : L1. `scripts/lighthouse-cron.sh`
  (l. 28) fixe `THRESH_CLS=0.1`, planification non vérifiée. `.github/workflows/visual-gate.yml`
  (déclenchement manuel) mesure à 390 × 844 et 1920 × 1080 ;
  `frontend/tests/e2e/mobile-audit-complete.spec.ts` contrôle le débordement à 320 px, hors CI.
  Écarts : les CLS après défilement de l'audit #2215 (§h : 0,9179 et 0,5814 sur la page produit,
  0,4103 sur la gamme) sont un artefact de mesure : la sonde force puis retire
  `content-visibility` (`scripts/mesure-dz.cjs`, l. 256 et 269). À la molette, aucune des cinq
  pages ne dépasse 0,0177 après défilement (`options/mesures/cls-causes-dz.md`, PR #2215, tête
  `8d7ba709c`, non fusionnée). Restent deux décalages réels au chargement, sous 0,1 : gamme
  0,0175 à 390 px et 0,0226 à 1440 px, image du haut déclarée carrée et servie en 3:2
  (`GammeHero.tsx`, l. 107-112) ; page produit 0,0199 à 0,0602 à 390 px et 0 à 0,0247 à 1440 px,
  cartes à réserve de 360 px rendues visibles par un glissement (`PiecesGroupedDisplay.tsx`,
  l. 197 ; `global.css`, l. 411-414). 55 `<img>` sur 108 sans dimensions (audit, §h) ;
  `frontend/lighthouse-budget.json` (l. 9) admet un CLS de 0,25 ; aucune mesure à 360 px trouvée.
  La méthode de mesure du CLS reste à fixer avant tout contrôle bloquant : session à part,
  défilement à la molette, plus grande fenêtre de session.

## Changements, revue et fusion

- **P20.** Un changement passe par une branche et une PR. La fusion suit l'un des trois circuits.
  - **Faible** : CI verte, puis fusion automatique.
  - **Moyen** : CI verte et verdict GO de la revue Claude sur la tête, puis fusion automatique.
    La revue Claude relit sans écrire ; elle remplace la revue Codex (décision 91). Elle
    s'authentifie par le seul jeton `CLAUDE_CODE_OAUTH_TOKEN`, sans clé d'API ni repli
    (décision 105). Sans verdict, la PR reste en attente : c'est un échec fermé, jamais un GO.
  - **Élevé** : revue approuvante de l'owner enregistrée sur la tête, puis fusion par l'App
    (décision 120 : « Enregistrer la revue approuvante, puis laisser l'App fusionner ; ajouter
    `🚦 Circuit de fusion` aux checks requis de `main`. »). Ce circuit couvre les zones CODEOWNERS,
    tout risque `high`/`critical` de `ownership.yaml` et tout chemin non classé.

  Le circuit est calculé par `scripts/ci/merge-circuit.mjs`. Un agent ne fusionne jamais lui-même
  et n'arme jamais l'auto-fusion : seul le workflow des circuits l'arme
  (`.github/workflows/merge-circuits.yml`), par l'App GitHub `automecanik-actions`, dont la clé
  n'existe que dans l'environnement `app-actions` restreint à `main`, jamais sur le DEV.
  La transition est close (décision 120 : « Oui pour le circuit faible, observé en service ; la
  porte ADR-124 est close, son script n'étant appelé par aucun workflow. »). Le circuit faible est
  déclaré activé ; la décision ne déclare activé que celui-là. La porte ADR-124 ne s'applique
  plus : aucune fusion ne passe par elle. Source : décisions 72, 91, 105 et 120 ; ADR-138 D2.
  Les circuits amendent ADR-102, ADR-123 et ADR-124 sur ce point ; ADR-124 leur a cédé, ADR-123
  leur cède une fois les circuits activés.
  Application, relevé du 2026-11-17 : le workflow est sur `main` (#2093, #2107, #2110) ; test
  `scripts/ci/merge-circuit.test.mjs` vert au relevé du 2026-11-16.
  - Faible : L4, observé deux fois de bout en bout (PR #2109, fusionnée par l'App le 2026-11-16 à
    22:21 UTC ; PR #2119, le 2026-11-17 à 02:06 UTC).
  - Moyen : L2, jamais observé en service ; aucune PR n'a porté le label `circuit:moyen`, aucune
    revue Claude n'a rendu de verdict.
  - Élevé : L3 pour la revue approuvante, enregistrée sur la tête de six PR (#2095, #2117, #2088,
    #2094, #2115, #2114, du 2026-11-16 à 23:45 UTC au 2026-11-17 à 06:54 UTC). Écart : « puis
    fusion par l'App » n'est pas ce que fait le workflow. Il n'arme jamais l'auto-fusion d'une PR
    du circuit élevé ; ces six PR ont été fusionnées par l'owner, trois d'entre elles avant que le
    check `🚦 Circuit de fusion` ait rendu son résultat. Rendre la règle vraie demande une
    modification du workflow, réservée à l'owner.
  - `🚦 Circuit de fusion` n'est pas un check requis de `main` au relevé ; l'ajouter est un acte
    de l'owner. Le script de la porte ADR-124 et son test sont retirés du dépôt
    (décision 132).
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
  Jusqu'à l'activation du plan d'ADR-128, un mandat transmis en session vaut mandat au même titre
  qu'une issue (décision 120 : « Garder les deux voies jusqu'à l'activation du plan d'ADR-128, et
  l'écrire dans P24. »). Source : ADR-128 ; décision 120 pour les deux voies.
  Application : L3 pour la routine `pilote-file.yml`. Les mandats du 2026-11-16 et du 2026-11-17
  (AR et suivants) sont transmis en session : c'est l'une des deux voies. ADR-128 n'active rien
  par lui-même ; chaque activation est une étape de son plan, déclenchée par l'owner.
- **P25.** Chaque routine a un déclencheur unique et un contrat Trigger / Execution / Evidence.
  Aucun orchestrateur maison n'est ajouté : ni bus d'événements, ni ordonnanceur, ni registre
  d'agents, ni moteur de permissions, ni tableau de bord, ni orchestrateur de tâches. Cette
  interdiction vaut par défaut (décision 120 : « Par défaut : une exception passe par une PR sur
  le journal, donc par ton approbation. »).
  Source : ADR-034, ADR-128 D3, ADR-129 ; décision 120 pour l'exception.
  Application : L2 (`automation-registry-validate.yml`, `cron-schedulemodule-guard.yml`). Trois
  décorateurs `@Cron(` subsistent dans `backend/src` alors que `ScheduleModule` est désactivé. Le
  module `command-center-orchestrator` existe sous drapeau éteint (ADR-087).
- **P42.** Un incident a une fiche : une issue du monorepo, au label `incident`. Aucun autre
  registre d'incidents n'est tenu. La fiche a trois rubriques obligatoires : ce qui s'est passé,
  pourquoi, ce qui l'empêche de revenir. Elle ne se ferme que lorsque la troisième désigne, avec
  son lien, le test ou le contrôle automatique qui empêche le retour de l'incident. Si aucun
  contrôle n'est possible, la fiche le dit et reste ouverte jusqu'à la décision de l'owner. Le
  dépôt est public : une fiche ne porte ni secret, ni détail qui aiderait une attaque, ni donnée
  de client. Un compte rendu d'incident resté dans le vault y reste lisible, sans être recopié.
  Source : décision 138 de l'owner, 17 nov. 2026. À 16:51, heure de Paris, sur la fiche par
  incident : « oui mais il faut que cela sert de memoire pour ne plus avoir les meme incident ».
  À 17:18, à la question « D'accord pour cette règle : une fiche d'incident ne peut être fermée
  que lorsqu'elle indique ce qui empêche désormais son retour (un test ou un contrôle
  automatique), avec le lien ? » : « oui ».
  Application, relevé du 2026-11-17 sur `main` `a9bd755d6` : L0. Rien ne porte encore la règle en
  service. `scripts/ci/incident-issue-gate.mjs` rend le verdict d'une fiche fermée (`evaluate`,
  l. 201) et rédige le commentaire de réouverture (`renderComment`, l. 247), mais aucun workflow
  ne le lance et son test n'est pas dans le dépôt. Le gabarit `.github/ISSUE_TEMPLATE/incident.yml`,
  le workflow `.github/workflows/incident-issue-gate.yml`, le test et son étape dans `audit.yml`
  sont dans un patch réservé à l'owner
  (`docs/audit/mandat-bd-20261116/complement-4-incidents/`). Ce patch fusionné : L2. L3 à la
  première réouverture observée. Limites du contrôle : un lien est admis s'il désigne une PR
  fusionnée de ce dépôt ou un fichier présent sur `main` ; le contrôle ne juge pas si le test cité
  couvre la cause. Retirer le label `incident` sort la fiche du contrôle. Écarts, relevé du
  2026-11-17 à 20:47 UTC sur `main` `705dc2c1e` : deux issues portent le label `incident`, #264 et
  #2144, toutes deux ouvertes. #264 n'a aucune des trois rubriques ; #2144 a les trois, mais la
  première sous le titre « Ce qui se passe », qui n'est pas celui du gabarit. Deux comptes rendus
  antérieurs sont des fichiers (`.spec/incidents/2026-02-configservice-crash.md`,
  `.spec/reports/incident-2026-04-14-payments-sev1.md`). Une fiche ouverte figure dans la liste
  que lit la routine de P24 (`scripts/ops/pilote-file.sh`, l. 58), qui liste toutes les issues
  ouvertes. À relever à nouveau à la fusion.
- **P33.** Un test de la Definition of Done nomme une mesure qui existe et dit ce qu'elle compare.
  Ce qui n'est pas mesuré est écrit comme tel dans la preuve, sans être retiré de l'exigence.
  Source : ADR-134 (PR vault #415, jamais fusionnée).
  Application : L0 pour le texte, appliqué à DoD5. La Definition of Done est dans ce dépôt
  (`.spec/00-canon/canon-distribution/rules-engineering-definition-of-done.md`, version 1.4.0,
  décision 139, PR #2142 fusionnée le 2026-11-17) : les tests 1 à 4 de DoD5 nomment chacun un
  contrôle et ce qu'il compare, et sa section « Non mesuré » liste ce qu'aucun contrôle ne vérifie.
  L3 pour deux de ces mesures, relevées vertes sur `main` le 2026-11-19
  (`migration-ledger-freshness.yml`, `registry-fresh.yml`). Écart : les sections « Escape hatch »
  et « Enforcement automatique » de la DoD citent `weekly-vault-lint.yml` et `vault-governance.yml`,
  absents de ce dépôt (question D19). Aucune garde ne vérifie qu'un test de la DoD nomme une
  mesure existante : intention seulement.

## Méthode

- **P26.** Les méthodes tierces retirées (BMAD, Superpowers, Spec Kit) ne reviennent pas sans
  décision. Source : ADR-118.
  Application : L0, appliqué par absence. Aucune garde contre un retour : intention seulement.
- **P27.** L'amélioration continue est un avis, jamais une gate bloquante. Cette interdiction vaut
  par défaut (décision 120 : « Par défaut : une exception passe par une PR sur le journal, donc
  par ton approbation. »). Source : ADR-082 ; décision 120 pour l'exception.
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
  `governance-checks.yml`). G9 : intention seulement ; son script de rapport, jamais branché,
  est retiré (décision 129). « Toute dérogation » : intention seulement.
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
  Application : L2. Contrôle local, sans réseau : `scripts/canon/compute-canon-hashes.py --check`
  et ses tests, lancés par `canon-distribution.yml`, `agent-exit-contract-hash.yml`,
  `marketing-voice-hash.yml` et `.husky/pre-commit`. L'étape 1 est fusionnée (PR #2112,
  2026-11-17) : la source modifiable est celle du monorepo. Les dépôts WIKI et RAW comparent
  encore leurs copies au manifeste figé du vault, jusqu'à l'étape 4 du plan.
- **P31.** Un agent IA propose, analyse et recommande ; il ne s'accorde jamais lui-même une
  validation. La validation suit le contrat du domaine, toujours indépendante du producteur : P10
  et P19 pour le WIKI et le diagnostic, P20 et P22 pour le code, l'approbation de l'owner pour une
  règle de ce journal (règle de vigueur) et pour ce que son domaine lui réserve (par exemple
  `content_approved` en marketing, `workspaces/marketing/fafa-media-factory/README.md`).
  « Toujours indépendante du producteur » ne s'applique pas au circuit faible (décision 120 :
  « Non : pour le code de risque faible, la CI est la validation ; l'écrire dans P31. »).
  Source : ADR-129, qui conserve AI2 et AI4 de `rules-ai-cos` ; décision 120 pour le circuit
  faible.
  Application : intention seulement dans le monorepo. Le WIKI refuse une autorité de relecture
  auto-déclarée (`promotion_decision.py`, motif `REVIEW_AUTHORITY_CLAIMED`). Pour le code de
  risque faible, la validation est celle des checks requis de `main` (P20, circuit faible).
- **P40.** Un skill tiers se déclare dans `skills-lock.json`, à la racine du dépôt. Pour chaque
  dossier de `.claude/skills/` qu'il liste, le verrou épingle un dépôt GitHub, un commit de
  40 caractères, le chemin du `SKILL.md` amont et l'empreinte du dossier. Le dossier commité doit
  redonner cette empreinte : un fichier amont modifié est refusé. Un skill tiers a un wrapper
  local `amk-<nom>`, soumis au schéma des skills locaux. Un skill absent du verrou suit ce schéma,
  d'où que vienne son texte. Source : décision de l'owner du 17 nov. 2026, à 14:36, heure de
  Paris : « oui. Sans cette transcription, fusionner le socle et le skill reviendrait à appliquer
  une règle qui n'est pas en vigueur. » ; à 14:46 : « Justement, consolider le principe qu'il nous
  faut, il est interdit de recopier les ADR. Tous les nouveaux contrats ont été effectués après
  preuve du code. Et vérifier encore. » Raison archivée dans ADR-137.
  Application, relevé du 2026-11-17 sur la branche de #2104 : L2.
  `scripts/governance/validate-skills-frontmatter.js` lit le verrou (l. 63-64, 135-156), envoie
  un skill listé à son contrôle (l. 316-317), vérifie l'entrée (l. 236-261), recalcule
  l'empreinte (l. 175-225, 262-268), lit le frontmatter amont (l. 271-287), exige le wrapper
  (l. 289-295) et signale une entrée sans dossier (l. 396-421).
  `scripts/governance/build-skills-registry.js` marque l'entrée `origin: third_party`, hors des
  écarts (l. 111-126). Test `scripts/governance/__tests__/skills-third-party-lock.test.ts` :
  16 cas, verts. `.github/workflows/skills-canon-gate.yml` se déclenche aussi sur
  `skills-lock.json` et sur ce test (l. 36-37), lance le validateur (l. 65-70) puis le test
  (l. 72-74). Écarts : le job reste en avertissement seul (`continue-on-error: true`, l. 49).
  Seul `.claude/skills/` de la racine est contrôlé. Aucun skill tiers n'est installé : rien n'est
  servi. À relever à nouveau à la fusion.
- **P43.** Aucun plugin Claude Code qui injecte au démarrage d'une session un contexte tiré
  d'autres sessions, sans relecture (hook `SessionStart`), n'est actif dans une session du dépôt.
  Les plugins exclus se déclarent dans `.claude/settings.json` (`enabledPlugins`, à `false`).
  Source : demandes de l'owner dans le chat de pilotage. Le 15 nov. 2026 vers 15:13, heure de
  Tunis : « Fait le » (désactiver `remember` dans les réglages utilisateur du DEV, fait à
  14:13:55 UTC). Le 17 nov. 2026 à 21:50, heure de Paris : « utilise meilleure approche » (pour
  faire durer cette désactivation). Origine : note
  `ledger/knowledge/claude-code-plugin-enablement-policy-20260504.md` du vault, PR
  ak125/governance-vault#419, fusionnée le 2026-11-15, en archive.
  Application, relevé du 2026-11-17 sur la branche de cette PR (base `main` `705dc2c1e`) : L1.
  `.claude/settings.json` met `remember@claude-plugins-official` et
  `goodmem@claude-plugins-official` à `false`. Le réglage du projet prime sur celui de
  l'utilisateur : essai du 2026-11-17 à 20:55 UTC, Claude Code 2.1.326, dossier de configuration
  isolé où l'utilisateur active les deux plugins ; `claude plugin list --json` les donne activés
  hors du dépôt et désactivés dans le dépôt. La documentation de Claude Code pose la règle
  générale (une clé posée à un niveau plus haut l'emporte) sans traiter ce cas. `remember`
  (0.43.1) porte un hook `SessionStart` qui injecte ses fichiers de mémoire ; `goodmem` (0.1.0)
  n'en porte pas : il est exclu par la demande de l'owner, non par ce critère. Écarts :
  `.claude/settings.local.json`, l'option `--settings` et les réglages gérés priment sur ce
  fichier, et rien ne refuse un `true` qui y serait posé ; aucun contrôle ne lit
  `.claude/settings.json` ; un autre plugin du même type n'est exclu que s'il y est déclaré.
  Aucune session du dépôt n'a été observée sous ce réglage : à relever après la fusion.

## Règles en service entrées au journal

Ces six règles étaient portées par le code sans figurer au journal
(`docs/audit/mandat-bd-20261116/contradictions.md`, §F). Elles y entrent par la décision 120 :
« Six d'abord : `timingSafeEqual`, autorités commerce, jamais vendre à perte, URL immuables, PROD
depuis un tag `v*` seulement, zones STOP. » Lignes « Application » relevées le 2026-11-17.

- **P34.** Dans le module de paiement, une signature ou un HMAC se compare par
  `crypto.timingSafeEqual`, jamais par `===` ni `!==`. Source : décision 120 ;
  `.claude/rules/payments.md`.
  Application : L2. Règle ast-grep `payments-no-raw-equality`, en erreur sur
  `backend/src/modules/payments/**`, lancée par `.husky/pre-commit` et par `audit.yml` (chemins
  filtrés, relevé vert ; ce n'est pas un check requis de `main`). Comparaison faite par
  `timingSafeEqual` dans `cyberplus.service.ts` et `payment-validation.service.ts` ; test
  `backend/tests/unit/cyberplus-signature.test.ts`, dans le check requis `🧪 Backend Tests`. Le
  retour Paybox se vérifie par signature RSA (`paybox-callback-gate.service.ts`), sans comparaison
  de chaînes. Hors de ce module : aucune garde. PROD non vérifiée.
- **P35.** Chaque écriture du commerce a une seule autorité déclarée. Le tarif `pieces_price`
  s'écrit par le seul module pricing gouverné. Le statut d'une commande s'écrit par `OrdersService`
  et `OrderStatusService`, celui d'une ligne par `OrderActionsService`. Les RPC de commande sont
  réservées à leurs propriétaires déclarés et portent un `p_correlation_id`. La table des
  fournisseurs se lit par `SupplierTruthModule`. `createOrder` ne relit pas le panier du serveur.
  Source : décision 120 ; `.spec/00-canon/commerce-runtime/authority-graph.yaml`.
  Application : L2. Huit règles ast-grep `commerce-*` en erreur (`.husky/pre-commit` ;
  `audit.yml` sur chemins filtrés, relevé vert) ; le canon est validé par
  `commerce-runtime-canon-gate.yml` (`scripts/governance/validate-authority-graph.js`), dont le
  dernier passage date du 2026-09-24. Aucun de ces contrôles n'est un check requis de `main`.
  Une neuvième règle, `commerce-no-fictional-supplier-cols`, est éteinte. Ces règles lisent le
  code TypeScript du backend : une écriture faite en SQL ou hors du backend n'y passe pas. État
  de la base non vérifié.
- **P36.** Aucune pièce n'est vendue à perte : le prix de vente HT n'est jamais inférieur au prix
  d'achat HT. Source : décision 120.
  Application : L2 sur deux chemins de code.
  `backend/src/modules/pricing/services/pricing-invariants.service.ts` (`VENTE_BELOW_ACHAT`) et
  son test, dans le check requis `🧪 Backend Tests` ;
  `backend/src/modules/orders/services/orders.service.ts` refuse la commande d'une pièce vendue à
  perte. Ni contrainte ni trigger en base dans les migrations du dépôt. État de la
  base et PROD non vérifiés.
- **P37.** Les URL sont immuables : aucune URL historique n'est modifiée. Source : décision 120 ;
  `CLAUDE.md`, invariant 6.
  Application : L2. Workflow `seo-url-immutability.yml` et
  `scripts/seo/check-url-immutability.mjs`, sur les PR qui touchent `frontend/app/routes/**` ou
  `backend/src/modules/seo/**` (relevé vert) ; ce n'est pas un check requis de `main`, et le
  script n'a pas de test. Dérogation par le label `r-seo-09-override`. Hors de ces chemins
  (données, sitemap, redirections) : intention seulement.
- **P38.** La PROD ne se déploie que depuis un tag `v*`. Le tag porte la décision de l'owner.
  Source : décision 120 ; `.claude/rules/deployment.md` ; `CLAUDE.md`, invariants 8 et 9.
  Application : L4. `release-prod.yml` ne part que d'un tag `v*` et refuse toute autre référence
  avant le checkout, lancement manuel compris ; il exige la preuve PREPROD du commit
  (`scripts/ci/prod-preprod-evidence.mjs` et son test). Garde d'agent :
  `scripts/claude-hooks/pretool-bash-guard.sh` bloque la création et le push d'un tag `v*`.
  Observé le 2026-11-17 : `/health` de PROD sert la révision du dernier tag déployé (lu à
  06:56 UTC). Qui peut pousser un tag `v*` relève des permissions GitHub, non vérifiées ici.
- **P39.** Zones STOP : paiement, prix et stock servis, panier et commande, RLS, opération de base
  destructive et migration irréversible, SEO indexé, déploiement PROD. Y agir exige l'accord
  nominatif de l'owner. Aucun contournement de permission, de drapeau, de garde, de contrôle CI ou
  d'observabilité. Source : décision 120 ; `CLAUDE.md`, invariant 9.
  Application : L1, partielle. Les chemins de code du paiement, du prix, du stock, du panier, de
  la commande, des migrations, des workflows et du déploiement PROD sont en zone CODEOWNERS, donc
  en circuit élevé (P20). La revue Claude du circuit moyen rend HOLD sur une zone STOP
  (`merge-circuits.yml`). Gardes d'agent pour la PROD (P2, P38). « Accord nominatif » : aucun
  mécanisme ne le vérifie hors de l'approbation de la PR. RLS, SEO indexé et tout acte fait hors
  d'une PR (base, exécution) : intention seulement.
