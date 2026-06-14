# Runtime Truth Audit — P0 · R2 Critical Route Probe

**Date :** 2026-05-30
**Surface :** `/pieces/:gamme/:marque/:modele/:type.html` (rôle SEO **R2 — PRODUIT**)
**Mode :** read-only, GET only, zéro mutation. Skill `runtime-truth-audit` (doctrine fail-explicit, sources canoniques).
**Runtime mesuré :** PROD `https://www.automecanik.com` (vérité que Google/utilisateurs voient) + DEV:3000 origin (pour isoler la couche CDN).
**Spec (côté vérité) :** [pieces.$gamme.$marque.$modele.$type[.]html.tsx](../frontend/app/routes/pieces.$gamme.$marque.$modele.$type%5B.%5Dhtml.tsx) → [pieces-vehicle.loader.server.ts](../frontend/app/utils/pieces-vehicle.loader.server.ts) · [pieces-vehicle.meta.ts](../frontend/app/utils/pieces-vehicle.meta.ts) · [cache-control.ts](../frontend/app/utils/cache-control.ts) · [Caddyfile](../config/caddy/Caddyfile)

---

## Verdict global

**`NO_DRIFT`** sur le contrat code R2 (statut, X-Robots-Tag, canonical, JSON-LD, H1, prix/panier, alternatives soft-404, propagation noindex sur erreur) — conforme en PROD sur 13 URLs réelles couvrant 8 gammes × 9 marques.

**+ 1 dérive `OWNER_DECISION`** : le `max-age` navigateur est **uniformément forcé à 7200s (2h)** en PROD (+ `swr=3600` ajouté), alors que le code fixe délibérément 30–300s par classe. Injectée **en aval de l'app** (ni le code, ni le Caddyfile in-repo) ; couche exacte **inconclusive** (Caddyfile déployé divergent et/ou Cloudflare) → **hors-repo, owner-gated infra**, pas un bug code.

- L'arc SEO récent **#798 / #799 / #801** (propagation X-Robots-Tag noindex + soft-404 + warm fixtures) est **confirmé fonctionnel en PROD live** sur succès / soft-404 / erreur.
- **Aucune PR runtime-truth-p1 code n'est justifiée.** Les fondations runtime R2 sont fiables pour bâtir commerce-loop dessus.

---

## Méthode

Probe HTTP read-only (`/tmp/r2-runtime-probe.sh`, reproductible — annexe) sur 4 classes :

| Classe | Définition | URLs | Attendu (spec) |
|---|---|---|---|
| **A** indexable | dans `sitemap-pieces-{1,2}.xml`, ≥2 produits | 7 (démarreur, alternateur, filtre-à-air, kit-distribution, plaquette-frein, bras-suspension × Citroën/Mercedes/VW/Opel/Fiat/Alfa/Renault) | `200` · meta `index,follow` · self-canonical · JSON-LD Product · origin `max-age=60, s-maxage=86400` |
| **B** soft-404 | 0 produit, IDs valides (`scripts/ci/soft-404-fixtures.txt`) | 3 (BMW/Audi) | `200` · `X-Robots-Tag: noindex,follow` (header) · meta noindex · JSON-LD ItemList · ≥1 alt deep-link · TTL court |
| **C** malformé (synthétique) | slug sans id numérique | 1 | `404`/`410` · noindex |
| **D** type implausible (synthétique) | IDs bien formés, type inexistant | 1 | `200` soft-404 OU `404/410` — jamais `5xx`/index |

Vérité spec = lecture directe du loader (aucune inférence). Vérité runtime = réponses HTTP PROD. Pour l'attribution de couche, comparaison **PROD vs code-origine** (la mesure DEV:3000 a servi quand l'origin répondait, mais DEV est instable — `dev-runtime-not-auto-updated-on-merge` — et l'attribution finale ne dépend que de faits PROD-prouvables, cf. §dérive #1).

---

## Findings par sévérité

- **critical :** 0
- **high :** 0
- **medium :** 1 (CDN browser-TTL override, owner-gated infra)
- **low :** 0
- **NO_DRIFT confirmé :** 10 dimensions sur URLs réelles, 4 classes

---

## Détail — contrat code R2 conforme (NO_DRIFT)

**7 URLs Classe A réelles :**

| Dimension | Attendu (code) | Runtime PROD | Verdict |
|---|---|---|---|
| HTTP status | 200 | 200 ×7 | ✅ |
| meta robots | `index, follow` (count≥2) | `index, follow` ×7 | ✅ |
| X-Robots-Tag (header) | `index, follow` (défaut interceptor) | `index, follow` ×7 | ✅ |
| canonical | self (construit RM V2, anti-doublon) | self ×7 | ✅ |
| JSON-LD @graph | Product + Offer + AggregateOffer + Brand + BreadcrumbList + Car + FAQPage | sur 1 fiche : **Product×15, Offer×14, AggregateOffer, Brand×16, BreadcrumbList, Car, FAQPage, Question×3, Organization, WebSite** | ✅ |
| H1 | 1 unique | 1 ×7 | ✅ |
| prix SSR | présent | 4–5 hits prix/€ SSR ×7 | ✅ |
| add-to-cart SSR | bouton panier SSR | **28× "Ajouter", 17× "panier", 7× "cart"** + markup stock (28× "stock", "en stock", "disponib") | ✅ |
| TTFB | — | 0.64–0.96s | ℹ️ |

**3 URLs Classe B (soft-404) :**

| Dimension | Attendu | Runtime PROD | Verdict |
|---|---|---|---|
| HTTP status | 200 | 200 ×3 | ✅ |
| X-Robots-Tag (header) | `noindex, follow` | `noindex, follow` ×3 | ✅ **(#798 live)** |
| meta robots | `noindex, follow` | `noindex, follow` ×3 | ✅ |
| canonical | absent (ne pas self-canonicaliser un soft-404) | absent ×3 | ✅ |
| JSON-LD | ItemList + ListItem | `ItemList, ListItem` ×3 | ✅ |
| alt deep-links | ≥1 (seuil smoke) | **15–19** ×3 (très au-dessus) | ✅ |

**Classe C (malformé synthétique) :** `410 Gone` + `X-Robots-Tag: noindex, follow`, **déterministe** (410 sur 6/6 requêtes no-cache + 3/3 sans query-string). Conforme à la branche `PERMANENT_MALFORMED → 410` du loader. ✅

**Classe D (type implausible synthétique) :** `200` soft-404 `noindex, follow` + ItemList + `s-maxage=30` (origine) — la branche genuine-empty courte-TTL. Jamais `5xx`, jamais `index`. ✅

> **Conclusion contrat :** l'arc #798/#799/#801 tient en PROD. La propagation noindex via header (cœur de #798) fonctionne sur succès, soft-404, **et** erreur 410. Le warm fixtures (#801) est cohérent avec les soft-404 servis (15–19 alternatives, bien au-delà du seuil ≥1).

---

## Détail — dérive #1 (medium, OWNER_DECISION, couche aval inconclusive)

**Le `max-age` navigateur est forcé uniformément à 7200s (2h) en PROD, écrasant le `max-age` per-classe de l'origine.**

Attribution de couche (`Cache-Control` par classe et par runtime) :

| Classe | Origine = code (loader) | PROD (chaîne complète, re-mesuré 2026-05-30) |
|---|---|---|
| A succès | `max-age=60, s-maxage=86400, swr=3600` | `max-age=7200, s-maxage=86400, swr=3600` |
| B soft-404 (hasAlternatives) | `max-age=300, s-maxage=3600` (pas de swr) | `max-age=7200, s-maxage=3600, swr=3600` |
| D genuine-empty | `max-age=30, s-maxage=30` (pas de swr) | `max-age=7200, s-maxage=30, swr=3600` |

> Colonne « Origine = code » = valeurs lues dans [pieces-vehicle.loader.server.ts](../frontend/app/utils/pieces-vehicle.loader.server.ts) (l.342, 360, 559) + confirmées plus tôt cette session sur DEV:3000 **quand il répondait**. ⚠️ DEV:3000 est instable (`dev-runtime-not-auto-updated-on-merge`) et **ne répondait plus au moment de la re-vérification** — la colonne origine est donc adossée au **code source** (reproductible), pas à une mesure DEV live de ce tour.

Preuves d'attribution (toutes **PROD-prouvables sans DEV**) :

- **Pas le code applicatif** : `grep -rnE "max-age=7200"` sur `frontend/app` → 0. Le code écrit `max-age` ∈ {60, 300, 30} selon la branche. Le 7200 est donc injecté **en aval** de l'app.
- **Pas le Caddyfile in-repo** : [config/caddy/Caddyfile:225](../config/caddy/Caddyfile) `@products` poserait `s-maxage=86400` pour **tout** `/pieces/`. Or PROD préserve le `s-maxage` **per-classe** (86400 / 3600 / 30). Donc la règle `@products` **telle qu'écrite dans le repo n'est pas la transformation active**.
- **Le tier edge est préservé, le tier navigateur est réécrit** : `s-maxage` (edge) intact per-classe ; seul `max-age` (navigateur) est uniformisé à 7200. Plus un ajout de `stale-while-revalidate=3600` là où l'origine n'en met pas (B, D).

**⚠️ Attribution exacte = INCONCLUSIVE (corrigé après re-mesure).** Une lecture initiale concluait « Cloudflare Browser Cache TTL = 2h ». La re-mesure l'infirme partiellement : un override Browser-Cache-TTL **pur réécrirait `max-age` mais n'ajouterait pas `swr=3600`** sur B/D. Or `swr=3600` **est** ajouté → la transformation n'est pas un simple Browser-TTL Cloudflare. Candidats restants, départageables uniquement avec accès owner :
- **Caddyfile déployé** sur 49.12.233.2 **divergent de l'in-repo** (drift config-déployée — une règle qui force `max-age=7200`+`swr=3600` en préservant le `s-maxage` amont). Hypothèse la plus compatible avec les 3 faits.
- **Cloudflare** (Browser-TTL + Cache Rule ajoutant swr), ou combinaison Caddy×Cloudflare.

**Confiance :** *haute* sur le **fait** (drift `max-age` réel, reproductible) et sur **« ni code ni Caddy-in-repo »**. *Inconclusive* sur la **couche exacte** — nécessite (a) le Caddyfile **déployé** sur 49.12.233.2 et (b) le dashboard Cloudflare (Caching + Cache Rules) pour trancher.

**Impact :**
- **Commerce (Classe A) :** le navigateur d'un visiteur récurrent peut afficher prix/dispo d'une fiche **jusqu'à 2h** au lieu de 1min voulu par l'origine. Borné (même navigateur, <2h ; conversions majoritairement in-session ou navigation fraîche → touche le CDN/origin). Contredit l'intention explicite `max-age=60`. Lien : commerce-loop.
- **Discipline error-TTL (B/D) :** l'origine veut ≤30–300s pour recovery rapide (mémoire `feedback_no_long_ttl_cache_on_error_paths`, #637). Le `s-maxage` court est **préservé** (edge + autres users récupèrent vite) ; seul le navigateur individuel garde une page « 0 produit » jusqu'à 2h. Atténué.

**Pourquoi OWNER_DECISION, pas une PR code :**
- Le correctif est un réglage infra (Cloudflare « Browser Cache TTL → Respect Existing Headers », et/ou le Caddyfile déployé), **hors de ce repo**.
- Blast radius large (toutes les routes publiques) → owner-gated (sécurité opérationnelle CLAUDE.md).
- Réversible, advisory → minimal moving parts.

**Action proposée (owner) — diagnostiquer la couche AVANT de corriger :**
1. **Dumper le Caddyfile déployé** sur 49.12.233.2 et le diff vs [l'in-repo](../config/caddy/Caddyfile). Hypothèse n°1 : une règle déployée force `max-age=7200`+`swr=3600` en préservant le `s-maxage` amont (le bloc `@products` in-repo ne correspond pas au runtime → drift config-déployée).
2. Si Caddy déployé == in-repo (pas la source), vérifier **Cloudflare → Caching → Configuration → Browser Cache TTL** + **Cache Rules** (une règle peut réécrire `max-age` et ajouter `swr`). Passer à **« Respect Existing Headers »** si l'override n'est pas voulu.
3. **Cible** : rendre la main au `max-age` per-route de l'origine (60s succès / 30s erreur) pour la fraîcheur prix/dispo + discipline error-TTL.
4. Si le 7200 est **intentionnel**, **documenter** la décision (runbook à côté de `scripts/ops/cloudflare-purge-by-pattern.sh`) pour clore l'écart spec↔runtime **explicitement** plutôt que silencieusement (canon : no silent drift).

---

## Non-findings (vérifiés, écartés — honnêteté de mesure)

- **Classe C « flip 410↔200 »** : **non reproduit**. Toutes les observations (probe + 6/6 no-cache + 3/3 plain) = `410` déterministe. Aucune trace de 200. → pas un finding.
- **add-to-cart absent SSR** : **faux**, dû à un terme de grep trop étroit dans le probe v1. Le markup panier/stock est bien SSR'd (cf. tableau Classe A). → pas un finding.
- **`cache-control: DELME`** : apparu une fois dans une sortie grep mal formée (interaction `--compressed`), **non reproductible** sur 5 dumps raw propres (1 seul header `cache-control`, valeur normale, à chaque fois). → artefact de parsing, pas un header PROD réel.
- **`x-robots-tag` vide sur Classe A** (probe run 1) : bug de parsing du probe, pas la réalité. Le défaut interceptor `index, follow` est bien présent (correct sur page indexable), confirmé sur DEV origin + dumps PROD.

---

## Critère de sortie (rappel cadrage)

| Verdict | Issue |
|---|---|
| `NO_DRIFT` | **← contrat code R2** : 10 dimensions ✅, 4 classes conformes, arc #798/#801 confirmé live. **Pas de PR code.** |
| `DRIFT_CONFIRMED` → 1 PR ciblée | non — la seule dérive est CDN/infra-config, pas code |
| `OWNER_DECISION` | **← browser `max-age=7200` uniforme** vs origin 30–300s. Action : vérifier Cloudflare Browser Cache TTL + Caddyfile déployé ; documenter si intentionnel. |
| `INCONCLUSIVE` | aucun (les candidats C-flip / cart / DELME ont été écartés par re-mesure) |

**Pas de runtime-truth-p1 code à ouvrir.** Le runtime R2 est sain.

---

## Annexe — probe reproductible

Script : `/tmp/r2-runtime-probe.sh` (read-only, GET only). Résultats bruts : `/tmp/r2-probe-results.jsonl` (12 lignes JSON valides). Attribution de couche : comparer `BASE=https://www.automecanik.com` vs `BASE=http://localhost:3000` (origin, sans Cloudflare). URLs Classe A/B issues de `sitemap-pieces-{1,2}.xml` (PROD) + `scripts/ci/soft-404-fixtures.txt`. Aucune donnée mutée.
