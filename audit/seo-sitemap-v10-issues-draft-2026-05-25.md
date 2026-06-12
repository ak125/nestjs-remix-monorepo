# Evidence-pack — 4 issues drafts SEO Sitemap V10 (prêts-à-publier)

> Compagnon du verdict `audit/seo-ahrefs-internal-links-verdict-2026-05-24.md`.
> Chaque section est **autonome** (peut être copiée-collée dans `gh issue create`) et porte son propre contexte, evidence, hypothèses de fix, acceptance criteria, ownership.
> **Aucune action n'est prise par cet artefact** — il arme l'owner pour arbitrage.
> Verifier read-only (constraint `feedback_no_url_changes_ever.md` + `feedback_sitemap_no_trigger.md` STRICT).

---

## Issue #1 — `sitemap-pages.xml` émet `/constructeurs` HTTP 404 avec priority 0.8 [P0]

### Severity
**P0** — Google indexe activement une URL 404 prioritaire. Impact direct ranking + crawl budget gaspillé.

### Evidence (2026-05-24, PROD `www.automecanik.com`)

```
$ curl -sI https://www.automecanik.com/constructeurs
HTTP/2 404
content-type: text/html; charset=utf-8
```

Présent dans le sitemap émis :
```xml
<!-- https://www.automecanik.com/sitemap-pages.xml -->
<url>
  <loc>https://www.automecanik.com/constructeurs</loc>
  <lastmod>2026-05-24</lastmod>
  <changefreq>weekly</changefreq>
  <priority>0.8</priority>
</url>
```

### Root-cause hypothèse

Aucune route Remix racine `/constructeurs` n'existe — uniquement `/constructeurs/{brand}-{id}.html` ([constructeurs.$brand[.]html.tsx](frontend/app/routes/constructeurs.%24brand%5B.%5Dhtml.tsx)). Le générateur `sitemap-v10-static.service.ts` (à confirmer) ou un de ses orchestrateurs émet la racine en assumant qu'elle existe, sans la valider.

### Fix candidates

- **(a) Retirer l'émission** de `/constructeurs` du générateur sitemap (additif strict, pas de mutation produit)
- **(b) Créer la route racine `/constructeurs/_index.tsx`** comme hub R7 listing des constructeurs (alternative produit — décision marketing/SEO)
- **(c) Émettre `/marques` ou `/brands` à la place** (décision canonical avant — voir Issue #4)

### Acceptance criteria

- `curl -s /sitemap-pages.xml | grep -E '<loc>.*constructeurs[^/]*</loc>'` retourne 0 ligne OU la cible répond HTTP 200 cohérente
- Re-crawl GSC montre `/constructeurs` désindexée OU canoniquement servie

### Files à toucher (anticipé)

- `backend/src/modules/seo/services/sitemap-v10-static.service.ts` (à confirmer par grep)
- Tests `backend/tests/unit/seo/sitemap-v10-*.test.ts`

### Owner
SEO runtime team (`@fafa`)

---

## Issue #2 — `sitemap-pages.xml` émet `/blog` HTTP 301 au lieu de canonical `/blog-pieces-auto` [P1]

### Severity
**P1** — Sitemap émet une URL qui redirect → crawl budget gaspillé, signal canonical incohérent. Pas un crash mais sub-optimal structurel.

### Evidence (2026-05-24)

```
$ curl -sI https://www.automecanik.com/blog
HTTP/2 301
cache-control: public, max-age=120, stale-while-revalidate=240
```

Présent dans le sitemap :
```xml
<url>
  <loc>https://www.automecanik.com/blog</loc>
  <priority>0.7</priority>
</url>
```

URL canonique réelle dans le code Remix : [frontend/app/routes/blog-pieces-auto._index.tsx](frontend/app/routes/blog-pieces-auto._index.tsx) (R3 hub conseils).

Cross-référence Ahrefs : `/blog-pieces-auto` reçoit **39 942 liens internes**, `/blog` non listé dans le top 497 du dataset → la nav code utilise bien `/blog-pieces-auto` (cohérent avec [Navbar.tsx:253,397](frontend/app/components/Navbar.tsx#L253) + [Footer.tsx:16](frontend/app/components/home/Footer.tsx#L16)).

### Root-cause hypothèse

Le générateur sitemap émet un alias historique `/blog` que Caddy redirige vers `/blog-pieces-auto`. C'est probablement un artefact d'une migration legacy PHP→Remix où `/blog` était l'ancienne URL.

### Fix candidates

- **(a)** Remplacer l'émission `/blog` par `/blog-pieces-auto` dans le générateur sitemap (canonical alignment)
- **(b)** Supprimer l'émission `/blog` (le redirect Caddy reste pour les anciens backlinks externes)
- **(c)** Documenter le redirect dans `.spec/00-canon/seo-runtime/redirects.yaml` (canon overlay L2 ADR-058)

### Acceptance criteria

- `curl -s /sitemap-pages.xml | grep -oE '<loc>[^<]*blog[^<]*</loc>'` → la seule occurrence est `/blog-pieces-auto`
- Le redirect `/blog` → `/blog-pieces-auto` reste fonctionnel (compatibilité externe)

### Files à toucher (anticipé)

- `backend/src/modules/seo/services/sitemap-v10-static.service.ts`
- Tests `backend/tests/unit/seo/sitemap-pages.test.ts`

### Owner
SEO runtime team (`@fafa`)

---

## Issue #3 — Scoring V10 non-différenciant : 100% des `__seo_page` au même bucket priority [P0]

### Severity
**P0** — Tous les sitemaps émis pour les 321 838 pages produit R2 ont `priority ∈ [0.3, 0.5]` (bucket unique). Google ne reçoit aucun signal de priorisation différentielle → crawl budget alloué de façon aveugle sur 700K+ URLs site-wide. Impact direct sur la découverte des pages haut-trafic vs pages cold.

### Evidence

Query DB live (Supabase `cxpojprgwgubzjyqzmoq`, 2026-05-24) :

```sql
SELECT
  CASE
    WHEN priority IS NULL THEN 'NULL'
    WHEN priority = 0 THEN '0.0'
    WHEN priority BETWEEN 0.01 AND 0.3 THEN '0.01-0.3'
    WHEN priority BETWEEN 0.3 AND 0.5 THEN '0.3-0.5'
    WHEN priority BETWEEN 0.5 AND 0.7 THEN '0.5-0.7'
    WHEN priority BETWEEN 0.7 AND 1.0 THEN '0.7-1.0'
    ELSE 'other'
  END AS priority_bucket,
  COUNT(*) AS n,
  ROUND(100.0*COUNT(*)/SUM(COUNT(*)) OVER (), 2) AS pct
FROM __seo_page
GROUP BY 1;

-- Résultat : { "priority_bucket": "0.3-0.5", "n": 321838, "pct": 100.00 }
```

### Root-cause

Le scoring V10 ([sitemap-v10-scoring.service.ts:258-277](backend/src/modules/seo/services/sitemap-v10-scoring.service.ts#L258-L277)) compose `priority` à partir d'un `inboundMap` calculé sur la table `__seo_internal_link`. **Cette table contient 0 rows en live** :

```sql
SELECT COUNT(*) FROM __seo_internal_link; -- 0
```

Définie par [backend/supabase/migrations/20260122_sitemap_v10_enterprise.sql:101-124](backend/supabase/migrations/20260122_sitemap_v10_enterprise.sql#L101-L124) mais **aucun service backend ne l'écrit** (grep complet : 1 reader, 0 writer). Pattern canonique « attribution columns never written » du skill `runtime-truth-audit`.

### Fix candidates

- **(a) Producer batch nightly** — job qui crawle le site rendu (par ex. parseur HTML SSR sur les URLs de `__seo_page`) et upserte `__seo_internal_link(from_url, to_url, link_type, anchor_text)` avec contraintes UNIQUE. Tier 1 lifelong, branché sur le scoring V10 existant.
- **(b) Producer inline** dans `internal-linking.service.ts` — chaque injection de lien à la volée écrit l'edge dans `__seo_internal_link`. Plus simple mais coûteux par render. Phase 1 → A.
- **(c) Suppression du reader scoring** — neutraliser explicitement la composante `GraphStrength` (sortie du score = 0 documenté), accepter le scoring V10 actuel comme limité. Décision « zombie code » canon-stable.

Recommandation verifier : **(a)** — découplage producer/consumer, observable, idempotent, pas de surcharge runtime.

### Acceptance criteria

- `SELECT COUNT(*) FROM __seo_internal_link` ≥ 100 000 (ordre de grandeur des ~105K liens internes rapportés par PHP)
- Distribution `__seo_page.priority` montre au moins 4 buckets distincts
- Sub-sitemaps émis avec priorités différentielles (top 1% à 0.9, bottom 50% à 0.3, etc.)

### Files à toucher (anticipé)

- Nouveau : `backend/src/modules/seo/services/internal-link-crawler.service.ts` + `internal-link-crawler.cron.ts`
- Migration : aucune (table existe déjà)
- Tests : `backend/tests/integration/seo/internal-link-crawler.test.ts`
- Registry overlay : `.spec/00-canon/seo-runtime/internal-link-crawler.yaml` (ADR-058 L2)

### Owner
SEO runtime team (`@fafa`) — possible coordination DB team pour budget IO du crawl batch

### Référence MEMORY canon

- `feedback_audit_needs_runtime_wiring_and_db_truth.md` — méthodologie
- `project_commerce_runtime_truth_audit_20260522.md` F1 — pattern identique (attribution `orl_website_url` orpheline)
- `feedback_seo_runtime_must_integrate_repo_control_plane.md` — enregistrement canon obligatoire

---

## Issue #4 — Doublon `/marques` (38 597 liens, sans canonical) vs `/brands` (canonical OK, contenu vide) [P1]

### Severity
**P1** — Cannibalisation interne. Deux URLs publiques 200 sur la même intention (liste des marques automobiles), signaux SEO divergents, contenu inversé entre les deux. Google indexe les deux et dilue le ranking.

### Evidence (2026-05-24, PROD)

| Aspect | `/marques` | `/brands` |
|--------|-----------|-----------|
| HTTP | 200 | 200 |
| Route Remix | [frontend/app/routes/_public+/marques.tsx](frontend/app/routes/_public%2B/marques.tsx) | [frontend/app/routes/brands._index.tsx](frontend/app/routes/brands._index.tsx) |
| Title | `Marques - Automecanik` | `Toutes les Marques Automobiles (0) \| Pièces Détachées Auto` |
| `<link rel="canonical">` | **ABSENT** | `https://www.automecanik.com/brands` |
| `<meta robots>` | **ABSENT** (= indexable par défaut) | `index, follow` |
| og:url | absent | `https://www.automecanik.com/brands` |
| Liens internes Ahrefs | **38 597** | non listé top 497 (~0 liens) |
| Contenu | non testé — probable stub | **vide** : title affiche `(0)` marques, meta description « 0 marques » |
| Dans sitemap-pages.xml | NON | NON |

### Lecture du paradoxe

- `/marques` reçoit massivement du jus interne (38K liens) — probablement émis par une source server-side legacy non grepable (PHP héritage / Caddy rewrite / template ancien). Mais la page **n'a aucun signal SEO** → Google la traite quand même comme indexable car la balise robots n'est pas restrictive.
- `/brands` est techniquement la « bonne » page (canonical + robots + og:* complets) mais le **loader ne charge aucune donnée** (visible empiriquement dans le title `(0)` et la description). Aucun jus interne ne pointe vers elle.
- Net : ni l'une ni l'autre ne gagne. Google peut indexer `/marques` (qui a le jus mais aucun signal) ou `/brands` (qui a les signaux mais aucun contenu).

### Fix candidates

Décision **canon-niveau** owner — pas un fix mécanique :

- **(a) `/marques` canonique** — corriger le loader `_public+/marques.tsx` pour servir le bon contenu, ajouter `<link rel="canonical" href="/marques">`, désactiver `/brands` (404 ou redirect 301 vers `/marques`). Aligne avec le jus interne actuel (38K).
- **(b) `/brands` canonique** — réparer le loader `brands._index.tsx`, ajouter `/brands` au sitemap, faire pointer la nav code (`/#marques` → `/brands`), 301 `/marques` → `/brands`. Plus moderne (canonical déjà tagué) mais nécessite réorienter 38K liens internes (gros impact).
- **(c) Suppression de l'une** — décision produit.

### Acceptance criteria

- Une seule URL publique 200 servant la liste des marques
- Cette URL apparaît dans `sitemap-pages.xml` avec priority cohérente
- L'autre URL = 301 vers la canonique OU 404 documenté
- La nav code ([Navbar.tsx:243](frontend/app/components/Navbar.tsx#L243) + [Footer.tsx:14](frontend/app/components/home/Footer.tsx#L14)) pointe la canonique (et plus `/#marques` anchor)
- GSC reflow indexation sans cannibalisation

### Files à toucher (anticipé)

- `frontend/app/routes/_public+/marques.tsx` ou `frontend/app/routes/brands._index.tsx` (selon décision)
- `frontend/app/components/Navbar.tsx:243,389`
- `frontend/app/components/home/Footer.tsx:14`
- `backend/src/modules/seo/services/sitemap-v10-static.service.ts`
- Caddyfile (si redirect 301)

### Owner
SEO marketing decision + frontend implementation (`@fafa` + équipe frontend)

### Constraint canon

- `feedback_no_url_changes_ever.md` STRICT — toute mutation URL/canonical/route nécessite demande explicite owner.
- `feedback_no_touch_meta_h1_if_optimized.md` STRICT — vérifier que les meta `/brands` ne sont pas optimisées (le `(0)` suggère qu'elles ne le sont pas — données absentes).

---

## Synthèse de la batch

| # | Sévérité | Impact crawl budget | Fix coût relatif | Owner-decision niveau |
|---|----------|---------------------|------------------|----------------------|
| 1 | P0 | direct (404 indexé) | bas (1 ligne suppr.) | mineur |
| 2 | P1 | indirect (gaspillage redirect) | bas | mineur |
| 3 | P0 | majeur (700K URLs sans signal différentiel) | haut (nouveau service + cron) | majeur |
| 4 | P1 | direct (cannibalisation) | moyen (décision canonical + 5 fichiers) | majeur (canon URL) |

**Order d'attaque recommandé** : #1 → #2 (quick wins additifs) → #3 (vrai chantier scoring) → #4 (décision canon)

Aucune Phase B/C entamée par ce draft. Ouverture/triage des issues = décision owner. L'evidence-pack est complet et autonome — chaque section peut être consommée séparément.

---

_Compagnon de `audit/seo-ahrefs-internal-links-verdict-2026-05-24.md`. Généré par Claude Code (Opus 4.7 1M) sur plan `utiliser-superpower-verifier-automecanik-lively-backus.md`. Aucune mutation code/DB/issue déclenchée._
