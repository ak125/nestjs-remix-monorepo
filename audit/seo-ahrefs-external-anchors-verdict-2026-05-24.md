# Verdict empirique — Ahrefs anchor-texts externes automecanik.com — 2026-05-24

## Coverage manifest

- **Dataset analysé** : 45 anchors (TOP brut UI Ahrefs "Principaux textes d'ancrage", partagé par l'owner)
- **Périmètre** : backlinks **externes** entrants vers `automecanik.com` (≠ maillage interne déjà audité dans [audit/seo-ahrefs-internal-links-verdict-2026-05-24.md](seo-ahrefs-internal-links-verdict-2026-05-24.md))
- **Indices structurels confirmant l'origine externe** :
  - 7 anchors templates multilingues type annuaire (`visit website`, `sitio web`, `visiter le site`, `navigate to website automecanik com`, …)
  - 1 anchor `attention required cloudflare` = `<title>` capturé par un bot pendant un CF challenge (jamais émis par le site)
  - 8 anchors URL brutes (HTTPS/HTTP/domain bare) = comportement aggregateur ou citation forum, jamais émis par les templates Remix internes (Navbar/Footer/BottomNav rendent toujours du texte humain)
- **Sources internes croisées** : 4
  - Audit pair `audit/seo-ahrefs-internal-links-verdict-2026-05-24.md` (méthodologie + canon role-matrix v5)
  - Canon role-matrix v5 `.spec/00-canon/role-matrix.md` (patterns R0-R8)
  - URL contract D3 `packages/seo-url-contract/src/url-rules.ts` (`isMalformedSeoUrl` / `detectMalformedSegment`)
  - Memory `project_a_b_c_surfaces_distinction.md` (vérifier 0 leak surface-C)
- **Invariants testés** : 7/7 (E1-E7)
- **Drifts détectés** : 3 (E3 HTTP, E4 CF challenge, E5 anchor vide) — tous **owner-only, no urgency**
- **Hors scope** : pas de volume par anchor, pas de referring-domains count, pas de split dofollow/nofollow, pas de désaveu, pas d'outreach, pas d'extrapolation au profil complet
- **Limites empiriques** : aucun test live (`curl -I`, `dig`, inspection Caddyfile) → drifts E3 HTTPS adoption + E4 CF challenge sont **hypothesis-only** (cf. anti-overclaim infra)

## Classification taxonomique (Σ = 45)

| # | Catégorie | Comptage | Verdict |
|---|-----------|---------:|---------|
| 1 | Brand pur (`automecanik`) | 1 | OK natural |
| 2 | Brand + keyword (`vente pièces détachées… automecanik`, +1 variante UTF-8 corrompue) | 2 | OK natural |
| 3 | Keyword exact-match court (`filtre à huile`, `plaquettes de frein`, `alternateur`, `étriers de frein`, `disque de frein`, `disques de frein`, `compresseur de climatisation`, `filtre à air`, `filtre à carburant`, `radiateur de chauffage`, `évaporateur de climatisation`, `courroie accessoire`, `pièces autos`, `ventes pièces détaches` [typo référent]) | 14 | OK signal pertinent business |
| 4 | Keyword exact-match long (`vente pièces détachées auto neuves & à prix pas cher`) | 1 | OK natural |
| 5 | URL brute HTTPS racine (`https www automecanik com`) | 1 | OK template |
| 6 | URL brute HTTPS deep-link | 7 | Cross-checkés D3 + role-matrix v5 (cf. section "Deep-links strategic classification") |
| 7 | URL brute HTTP (1 racine + 1 deep-link `…pieces cardan 13 html`) | 2 | **DRIFT E3 — hypothesis-only** |
| 8 | Domain bare (`automecanik com`, `www automecanik com`) | 2 | OK |
| 9 | Template directory multilingue (`visit website`, `visiter le site web`, `visit`, `sitio web`, `visit automecanik com`, `navigate to website automecanik com`, `visiter le site`) | 7 | OK aggregateurs (low value, low risk) |
| 10 | Image alt-text (`automecanik logo`, `logo de automecanik`) | 2 | OK |
| 11 | Anchor vide (`(vide)`) | 1 | **DRIFT E5** (référent externe) |
| 12 | Long sentence content-snippet (4 phrases pédagogiques sur usure embrayage / catalyseur / direction assistée / contrôle état) | 4 | OK forum/blog citations |
| 13 | Cloudflare challenge title (`attention required cloudflare`) | 1 | **DRIFT E4 — hypothesis-only** |
| | **TOTAL** | **45** | |

## Invariants

### E1 — Diversification anchor texte (variété brand/keyword/url/template)

**Status : SATISFIED**

13 catégories distinctes dans le TOP 45 ; pas de catégorie unique > 31% (max = 14/45 = 31% pour keyword exact-match court, qui est lui-même éclaté sur 14 termes différents = 1/45 ≈ 2.2% chacun). Distribution macro saine, **pas de signature de manipulation** (qui se traduirait par une catégorie unique exact-match à > 50% de fréquence + 1-3 termes répétés).

### E2 — Absence anchor toxique

**Status : SATISFIED**

Grep mental sur patterns black-hat (casino, viagra, loan, porn, free-download, gambling, cialis, escort, drugs) : **0 occurrence**. Tous les anchors sont sémantiquement liés au domaine pièces auto / brand / templates aggregateurs / fragments éditoriaux.

### E3 — Adoption HTTPS sur URLs brutes en ancre

**Status : DRIFT mineur — hypothesis-only**

2 anchors HTTP présents (rang #11 `http www automecanik com` + rang #32 `http www automecanik com pieces cardan 13 html`). Quelques sources externes linkent encore en HTTP au lieu de HTTPS.

⚠️ **Non vérifié empiriquement** : sans `curl -I http://www.automecanik.com` (hors scope verifier read-only filesystem), il est **impossible de conclure** si :

- (a) Le redirect 301 HTTP→HTTPS via Caddy est en place et propagé → impact SEO neutre (Google suit le 301, équité de lien préservée)
- (b) Le redirect est cassé ou manquant → équité de lien fragmentée entre HTTP et HTTPS

**Action owner** (hors scope ce verdict) : tester `curl -I http://www.automecanik.com` depuis un poste avec accès réseau et inspecter `docker/Caddyfile` si présent pour confirmer la règle `redir` ou `permanent_redirect`.

### E4 — Cloudflare challenge leak

**Status : DRIFT mineur — hypothesis-only**

1 anchor `attention required cloudflare` (rang #21) = un crawler (probablement non-Google, type aggregateur SEO ou directory submission bot) a heurté une page de challenge Cloudflare et a indexé son `<title>` (`Attention Required! | Cloudflare`) comme texte d'ancrage du backlink.

⚠️ **Non vérifié empiriquement** : sans accès au dashboard Cloudflare (config Bot Fight Mode / Challenge Pages / Super Bot Fight Mode), impossible de conclure si :

- (a) Configuration trop agressive (Challenge appliqué à des UA légitimes) → fix policy CF
- (b) Configuration correcte mais bot SEO tiers cataloguant la cible de challenge → pollution marginale acceptable

**Action owner** (hors scope) : audit `Cloudflare Dashboard > Security > Bots` + revue de la `Challenge Solve Rate` sur 30 jours.

### E5 — Anchor vide

**Status : DRIFT mineur — pas actionnable côté Automecanik**

1 anchor `(vide)` (rang #4) = image-link sur le référent externe sans `alt=""` ni texte. Le HTML du référent ressemble probablement à `<a href="…"><img src="…"/></a>` sans attribut alt.

**Pas d'action mécanique applicable** : l'anchor est édité côté référent (site tiers), pas côté `automecanik.com`. Pourrait être traité par une opération outreach si le référent est identifié — **gated owner**.

### E6 — URL deep-link en anchor

**Status : INFO — pas un drift**

8 anchors URL deep-link (7 HTTPS + 1 HTTP). Origine probable :

- **Aggregateurs auto-générant un anchor depuis l'URL crawlée** (cas du `…blog pieces auto conseils capteur abs &text=…` rang #33 et `…evaporateur de climatisation 471 html &text=…` rang #36 — présence de `&text=…` = fragment SERP / "Featured snippet" Google capturé par un scraper)
- **Citations forums tech** où l'URL est collée en clair sans wrapping `<a href>` éditorial

Cross-check D3 (cf. "Deep-links strategic classification" infra) : **8/8 valid contract D3, 0 surface-C, 1 monitor**.

### E7 — Anchor entropy / concentration sanity

**Status : SATISFIED**

Verdict **qualitatif ordinal** (pas de métrique quantitative inventée — entropie de Shannon ou % exact-match calculé sur 45 anchors n'aurait pas de robustesse statistique) :

- **Aucun anchor exact-match ne domine** (le top exact-match `ventes pièces détaches` arrive en rang #6, derrière brand+keyword/template/url/domain — donc déclassé)
- **Présence forte de brand + URL + template** (rangs #1-#9 hors keyword) — signature naturelle d'un site B2C établi
- **Distribution multi-modale** (brand / keyword / URL / template / content-snippet / image-alt coexistent) — incompatible avec une campagne de linkbuilding sur-optimisée (qui produirait une distribution mono-modale type "exact-match >> reste")

Conclusion E7 : **profil qualitativement compatible avec un profil naturel**. Aucun signal de manipulation type Penguin moderne. Quantification précise requiert un dataset Ahrefs complet (volume par anchor + referring domains), non disponible ici.

## Machine-generated vs human-edited anchors

Micro-taxonomie clé pour lire le profil correctement — tous les anchors ne pèsent pas pareil côté SEO :

| Type | Comptage | Exemples | Poids SEO |
|------|---------:|----------|-----------|
| **(a) Human-edited** | ~21 | Keywords exact-match (14) + brand+keyword long (1) + brand pur (1) + long sentences pédagogiques (4) + image alt logo (édité humain) (1) | **Réel** — éditeurs forum, blogueurs, sites métier qui citent volontairement |
| **(b) Template directory / aggregateurs** | ~14 | `visit website`/`visiter le site`/`sitio web` (7) + URL brutes templates (5 HTTPS + 2 HTTP) | **Marginal** — patterns d'annuaires & widgets sans contexte éditorial |
| **(c) Crawler-generated leak** | 1 | `attention required cloudflare` | **Pollution** — non éditorial, bot capturant un titre transitoire |
| **(d) Mixte ambigu** | ~9 | Image alt non-logo (1) + anchor vide (1) + domain bare (2) + brand variante UTF-8 corrompue (1) + URL deep-link + SERP fragment (2) + URL deep-link "propre" (2) | **Variable** — partie aggregateurs, partie citations humaines |

**Conséquence analytique** : si on retire mentalement les ~15 anchors (b)+(c) du dataset, le TOP "éditorial vrai" devient nettement dominé par **keyword exact-match court + brand + content-snippet pédagogique** — distribution qui reste saine et **n'aggrave pas E7** (entropy concentration). Les anchors templates ne devraient pas influencer le verdict de qualité éditoriale du profil de liens.

## Deep-links strategic classification

Cross-check des 8 URLs deep-link en ancre contre canon role-matrix v5 + URL-contract D3 :

| URL deep-link en anchor (rang) | Pattern décodé | Rôle canon | Verdict |
|--------------------------------|----------------|-----------|---------|
| `…pieces courroie d accessoire 10 renault 140 laguna ii 140028 1 9 dci 15476 html` (#8) | `/pieces/{slug}-{id}/{marque}-{id}/{modele}-{id}/{type}-{id}.html` | **R2 product** | **OK canon** |
| `…blog pieces e de frein` (#12) | `/blog/pieces-e-de-frein` (path court, ≠ canon `/blog-pieces-auto/...`) | **Legacy ?** | **monitor** — vérifier si 301 vers canonical actuelle |
| `…constructeurs citroen 46 html` (#13) | `/constructeurs/citroen-46.html` | **R7 brand** | **OK canon** |
| `…pieces cardan 13 html` (#32, HTTP) | `/pieces/cardan-13.html` | **R1 router gamme** | **OK canon** (mais HTTP → cf. E3) |
| `…blog pieces auto conseils capteur abs &text=…` (#33) | `/blog-pieces-auto/conseils/capteur-abs` + SERP fragment params | **R3 conseil** | **OK canon** (fragment SERP capturé par crawler — ignoré par le serveur) |
| `…blog pieces auto conseils support moteur` (#34) | `/blog-pieces-auto/conseils/support-moteur` | **R3 conseil** | **OK canon** |
| `…pieces capteur temperature d air admission 3939 html` (#35) | `/pieces/capteur-temperature-d-air-admission-3939.html` | **R1 router gamme** | **OK canon** |
| `…pieces evaporateur de climatisation 471 html &text=…` (#36) | `/pieces/evaporateur-de-climatisation-471.html` + SERP fragment | **R1 router gamme** | **OK canon** (fragment ignoré) |

**Bilan deep-links** :

- 7/8 → **canon role-matrix v5** (R1: 3, R2: 1, R3: 2, R7: 1)
- 1/8 → **monitor** (`/blog/pieces-e-de-frein` — slug court non-canonique, vérifier redirect ou route legacy)
- 0/8 → surface-C (`/diagnostic/wizard`, `/assistant`, `/outil` — qui N'EXISTENT PAS per memory `project_a_b_c_surfaces_distinction.md`) ✓
- **0/8 → malformed D3** (trace manuelle de [`isMalformedSeoUrl`](packages/seo-url-contract/src/url-rules.ts#L96-L104) sur les 8 segments décodés : aucun `empty_segment`, `spaces_in_url`, `missing_alias`, `null_in_url`, `type_prefix_fallback`, `repeated_id`, `accented_chars`. Les params query `&text=…` sont écartés par `split('?')[0]` ligne 98)

**Empirical evidence pour le monitor AE4** : `grep -rE "/blog/[a-z]" frontend/app/routes/` montre **0 route Remix publique sous `/blog/{slug}`** — toutes les routes blog convergent vers le préfixe canon `blog-pieces-auto.*` (12 routes trouvées : `_index`, `conseils._index`, `conseils.$pg_alias`, `guide-achat.*`, `auto.$marque.*`, `article.$slug`, etc.). Donc `/blog/pieces-e-de-frein` est nécessairement (a) un fallthrough legacy PHP/Caddy, (b) une 404 actuelle, ou (c) un artefact d'export Ahrefs (mauvaise reconstruction de l'URL depuis le anchor text). L'owner peut trancher avec `curl -I` ou inspection du legacy router PHP s'il existe encore.

Les 2 SERP fragments `&text=…` (rangs #33, #36) sont des fragments d'extraction Google "Featured snippet" capturés par un scraper SEO tiers. Côté Caddy/NestJS, les params query après `?` ou `&` sont ignorés par le routing canonical et par `isMalformedSeoUrl`, donc **pas d'impact SEO**.

## Anomalies consolidées

| # | Type | Source de divergence | Action recommandée (gouvernée) |
|---|------|---------------------|--------------------------------|
| AE1 | DRIFT E3 — HTTP adoption | 2 anchors en `http://` (rangs #11, #32) | Owner : `curl -I http://www.automecanik.com` + inspection `docker/Caddyfile` pour confirmer 301 HTTP→HTTPS. **Hypothesis-only** tant que non testé. |
| AE2 | DRIFT E4 — Cloudflare challenge leak | 1 anchor `attention required cloudflare` (rang #21) | Owner : audit `Cloudflare Dashboard > Security > Bots` + Challenge Solve Rate 30j. **Hypothesis-only** tant que non audité. |
| AE3 | DRIFT E5 — anchor vide | 1 anchor `(vide)` (rang #4) | Pas actionnable côté Automecanik (édition référent). Outreach si référent identifié — **gated owner**. |
| AE4 | MONITOR — slug legacy `/blog/pieces-e-de-frein` | 1 deep-link (rang #12) avec path court non-canonique | Owner : `curl -I https://www.automecanik.com/blog/pieces-e-de-frein` pour confirmer 301 vers canonical `/blog-pieces-auto/...` actuel. |

## Risk matrix compacte

| Drift | Risk | Urgency | Action |
|-------|------|---------|--------|
| E3 HTTP anchors (AE1) | **Low** | None | Owner verify Caddy 301 (lecture passive) |
| E4 Cloudflare title leak (AE2) | **Medium** | None | Owner review CF Challenge Pages policy |
| E5 Empty anchor (AE3) | **Negligible** | None | Ignore (référent externe, pas notre HTML) |
| AE4 Slug legacy monitor | **Low** | None | Owner verify 301 vers canonical actuel |

**Aucune ligne en urgency = High.** Aucun drift n'engage l'équité de lien à un niveau qui justifierait une réaction immédiate.

## Verdict global

Profil de backlinks externes **sain et naturel** sur le TOP 45 anchors :

- **Distribution multi-modale** (brand / keyword / URL / template / content-snippet) — signature naturelle d'un site B2C établi
- **Aucun anchor toxique** (E2 satisfied)
- **Aucun anchor exact-match dominant** (E7 satisfied — entropy compatible profil naturel)
- **Aucun leak surface-C** (0/8 deep-links pointent vers une surface inexistante)
- **8/8 deep-links cross-checkés** contre canon role-matrix v5 et URL-contract D3 — 7 OK canon, 1 monitor legacy

**No urgency** : aucun signal du TOP 45 ne justifie intervention urgente, désaveu (`disavow.txt`), campagne corrective, outreach prioritaire, ou changement canonique des URLs. Les 3 drifts (E3 HTTP, E4 CF, E5 vide) sont **mineurs, hypothesis-only, et owner-only** côté action.

Le profil ne nécessite **aucune décision applicative** côté `automecanik.com` à ce stade. Toute action ultérieure (vérification Caddy, audit CF, outreach référents anchor vide) relève de la **discipline owner sur infra/edge**, hors scope verifier read-only filesystem.

## Hors scope explicite (anti-overclaim)

- **"Profil sain et naturel"** valable sur **TOP 45 anchors uniquement** — non extrapolable au profil complet (Ahrefs expose probablement plusieurs milliers d'anchors uniques en long tail, dont la distribution peut être différente)
- **Dataset bias** — le TOP 45 sur-représente fréquences hautes (templates + URLs + directory patterns d'aggregateurs à fort volume de citations) et **sous-représente** les citations éditoriales longues à faible volume mais haute valeur. Verdict valable pour **pattern macro**, pas pour profil exhaustif. Un audit complet nécessite l'export Ahrefs raw (anchor + volume + DR référent + dofollow/nofollow + premier vu)
- **Drift HTTP→HTTPS (E3)** = **hypothesis-only** tant que `curl -I http://www.automecanik.com` n'est pas vérifié empiriquement. Ne pas conclure que la redirection manque ou est cassée sans test live
- **Drift CF challenge (E4)** = **hypothesis-only** tant que le dashboard Cloudflare n'est pas audité. La présence du titre `attention required cloudflare` comme anchor n'implique pas une mauvaise configuration — peut être un bot SEO tiers piégé par une Challenge Page légitime
- **E7 anchor entropy** = verdict **qualitatif/ordinal** ("brand+url+template domine, exact-match non dominant") — **pas de métrique quantitative** (% exact-match précis, entropie de Shannon, Gini coefficient des anchors) sans dataset complet ; calculer ces métriques sur 45 anchors serait du bruit statistique
- **Aucune action mécanique automatique** — toute action (redirect HTTP, config CF challenge, outreach, disavow) est **owner-only** + accès infra (DNS / edge / dashboard Cloudflare)
- **Pas de claim conversion / commerce-loop** — Memory `feedback_seo_is_not_the_product_acquisition_serves_conversion.md` rappelle que les backlinks ≠ commande organique attribuable. Un profil de backlinks sain est nécessaire mais pas suffisant
- **Pas de plan outreach / linkbuilding / disavow** inventé (Memory `dont_manufacture_small_deliverables.md`) — la demande était "audit + verdict", pas "plan d'action"

## Mémoires canon citées

- `feedback_no_url_changes_ever.md` — STRICT, aucune proposition de modification URL canonique malgré 1 monitor sur slug legacy
- `feedback_no_autoescalation_after_single_go.md` — demande = audit, livrable = verdict seul, pas de Phase B/C
- `dont_manufacture_small_deliverables.md` — pas de plan outreach théâtral
- `feedback_seo_is_not_the_product_acquisition_serves_conversion.md` — pas de claim business depuis backlinks
- `project_a_b_c_surfaces_distinction.md` — vérification 0 leak surface-C
- `feedback_audit_needs_runtime_wiring_and_db_truth.md` — méthodologie cohérente avec l'audit interne pair

---

_Généré par Claude Code (Opus 4.7 1M) sur plan `automecanik-com-confidentialit-condition-zany-thunder.md`. Aucune mutation code/DB/infra. Profil empirique uniquement, owner-only pour toute action ultérieure._
