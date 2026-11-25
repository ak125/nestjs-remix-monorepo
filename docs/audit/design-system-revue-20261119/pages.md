# Pages mesurées — mandat DZ

Serveur : DEV, `http://127.0.0.1:3000` (serveur Vite de développement). Dépôt lu à
`7368d72d051cf2005ed9f07a6e5e1acb718f60fe`. Fichiers de route relatifs à
`frontend/app/routes/` (convention remix-flat-routes, `frontend/app/routes.ts`).

Deux relevés de statut distincts :

- **Statut du passage** : statut de la réponse principale lu par Playwright pendant la
  mesure, avec l'URL finale (`statut`, `urlFinale`, `debut`, `fin` dans
  `mesures/<id>-<taille>.json`).
- **Statut sans redirection** : `curl` en GET, sans suivre les redirections, de
  01:06:33Z à 01:06:37Z (`mesures/statuts-pages.tsv`, script `scripts/statuts-dz.sh`).

## Pages mesurées (16 pages, 32 passages)

| Id | Type | URL | Fichier de route | Statut sans redirection (heure UTC) | Statut du passage | Passage 390 (UTC, 2026-11-20) | Passage 1440 (UTC) |
|---|---|---|---|---|---|---|---|
| r0-accueil | R0 accueil | `/` | `_index.tsx` | 200 (01:06:33Z) | 200 | 00:13:09–00:14:07 | 00:14:07–00:15:09 |
| r1-gamme | R1 routeur gamme | `/pieces/filtre-a-huile-7.html` | `pieces.$slug.tsx` | 200 (01:06:33Z) | 200 | 00:15:09–00:16:04 | 00:16:04–00:17:02 |
| r2-produit | R2 produit (gamme × véhicule) | `/pieces/filtre-a-huile-7/renault-140/clio-iii-140004/1-5-dci-19052.html` | `pieces.$gamme.$marque.$modele.$type[.]html.tsx` | 200 (01:06:33Z) | 200 | 00:17:03–00:18:17 | 00:18:18–00:19:32 |
| r3-conseils | R3 conseils | `/blog-pieces-auto/conseils/filtre-a-huile` | `blog-pieces-auto.conseils.$pg_alias.tsx` | 200 (01:06:34Z) | 200 | 00:19:36–00:20:40 | 00:20:40–00:21:50 |
| r4-reference | R4 référence | `/reference-auto/filtre-a-huile` | `reference-auto.$slug.tsx` | 200 (01:06:34Z) | 200 | 00:21:50–00:22:41 | 00:22:41–00:23:35 |
| r5-diagnostic | R5 diagnostic, **servi comme R3** | `/diagnostic-auto/voyant-disque-de-frein` | `diagnostic-auto.$slug.tsx` (301), puis `blog-pieces-auto.conseils.$pg_alias.tsx` | **301** → `/blog-pieces-auto/conseils/disque-de-frein#diagnostic-rapide` (01:06:34Z) | 200 sur l'URL finale | 00:23:35–00:24:45 | 00:24:45–00:25:59 |
| r5-index | R5 index diagnostic | `/diagnostic-auto` | `diagnostic-auto._index.tsx` | 200 (01:06:37Z) | 200 | 01:04:06–01:05:01 | 01:05:02–01:05:57 |
| r6-guide-achat | R6 guide d'achat | `/blog-pieces-auto/guide-achat/filtre-a-huile` | `blog-pieces-auto.guide-achat.$pg_alias.tsx` | 200 (01:06:34Z) | 200 | 00:25:59–00:26:47 | 00:26:47–00:27:41 |
| r7-marque | R7 constructeur | `/constructeurs/renault-140.html` | `constructeurs.$brand[.]html.tsx` | 200 (01:06:35Z) | 200 | 00:27:47–00:28:50 | 00:28:51–00:30:01 |
| r8-vehicule | R8 véhicule | `/constructeurs/renault-140/clio-iii-140004/1-5-dci-19052.html` | `constructeurs.$brand.$model.$type[.]html.tsx` | 200 (01:06:35Z) | 200 | 00:30:02–00:30:54 | 00:30:55–00:31:51 |
| panier-vide | panier vide | `/cart` | `cart.tsx` | 200 (01:06:36Z) | 200 | 00:31:51–00:32:25 | 00:32:25–00:33:00 |
| recherche | recherche | `/search?q=filtre+a+huile` | `search.tsx` | 200 (01:06:36Z) | 200 | 00:33:00–00:33:54 | 00:33:54–00:34:52 |
| connexion | connexion | `/login` | `_public+/login.tsx` | 200 (01:06:36Z) | 200 | 00:34:55–00:35:27 | 00:35:27–00:36:00 |
| inscription | inscription | `/register` | `_public+/register.tsx` | 200 (01:06:36Z) | 200 | 00:36:00–00:36:40 | 00:36:41–00:37:23 |
| legale | page légale | `/mentions-legales` | `mentions-legales.tsx` | 200 (01:06:36Z) | 200 | 00:37:23–00:38:10 | 00:38:11–00:38:54 |
| erreur-404 | 404 | `/__dz-probe-404-inexistant` | `$.tsx` | 404 (01:06:37Z) | 404 | 00:38:55–00:39:37 | 00:39:38–00:40:23 |

Passages de défilement à 320×640 et de zoom 200 % (`mesures/<id>-reflow.json`) : même
liste, après les passages de mesure ; l'heure figure dans chaque fichier.

## Page non mesurable

| Id | Type | URL | Fichier de route | Statut | Raison |
|---|---|---|---|---|---|
| commande | première étape de commande | `/checkout` | `checkout.tsx` | **302** → `/cart` (01:06:37Z) | Sans panier ni compte, la page renvoie au panier. L'afficher demanderait d'ajouter un article ou de créer un compte, donc une écriture en base partagée DEV/PROD : **non mesurable sans écriture**. |

## Notes sur le choix des pages

- **R5.** La première URL R5 retenue répond 301 vers l'article conseils de la gamme
  (`diagnostic-auto.$slug.tsx:215-226` appelle `/api/seo/diagnostic/redirect/${slug}`).
  Les 10 URL `/diagnostic-auto/<slug>` liées depuis l'index redirigent toutes vers
  `/blog-pieces-auto/conseils/…` (relevé curl à 01:03:49Z). Le passage `r5-diagnostic`
  mesure donc une **page R3** (disque de frein) ; il est conservé comme second échantillon
  R3. La seule page R5 rendue est l'index `/diagnostic-auto` (`r5-index`).
  `.spec/00-canon/role-matrix.md:64` indique pour R5 un « glissement vers R3 ».
- **R6.** `/blog-pieces-auto/guide-achat/filtre-a-huile` répond 200 sur DEV ;
  `.spec/00-canon/role-matrix.md:160` décrit une consolidation R6 derrière
  `SEO_R6_CONSOLIDATION_ENABLED`. L'état de ce drapeau sur DEV n'a pas été lu.
- **Page légale.** `/mentions-legales` (200). `/legal` répond 302 vers `/legal/cgv`
  (constat hors périmètre, non mesuré).
- **Gamme et véhicule** : filtre à huile, Renault Clio III 1.5 dCi, choisis pour leur
  continuité R1 → R2 → R3 → R4 → R6 → R7 → R8.
- **404** : chemin inventé `/__dz-probe-404-inexistant`, sans écriture.
