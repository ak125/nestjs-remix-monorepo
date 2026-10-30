# Raccordements pour Claude CLI — filtre à huile (pg_id 7)

Seuls les raccordements nécessaires au dossier filtre à huile. Les 13 besoins du dossier plaquettes ne sont pas des
prérequis : deux points recoupent un besoin plaquettes (FH-5 compteur, FH-11 `stages`) parce que le filtre à huile en
a besoin pour son propre compte. Reproductions faites le 30/10/2026 sur la base `980b2f8a7`, le site public et la base
en lecture seule.

Hors périmètre de Claude CLI sans accord nominatif : prix et stock (titres « à partir de 5.00€ », meta « dès 5€ »,
« En stock »), champs SEO protégés (title, meta, H1), déploiement PROD. Ces points sont signalés, pas confiés.

## Synthèse

| Id | Raccordement | Type | Bloque |
|---|---|---|---|
| FH-1 | R3 sert du texte WIX en anglais extrait brut | données | R3 S4_DEPOSE |
| FH-2 | `restoreAccents` réécrit les URL des liens ; liens S7 sans id | code + données | R3 S7 |
| FH-3 | Aucun producteur WIKI → R1/R3 ; contenus servis issus du RAG | producteur | tout texte R1/R3 du § 1 |
| FH-4 | Bornes de S4_MICRO_SEO divergentes entre contrat et constantes | contrat | R1 S4 |
| FH-5 | Affirmations R1 contredites (D.2, « cartouche » 1.5 dCi, compteur en dur) | données + code | R1 |
| FH-6 | R4 : symptômes attribués au filtre, liens vers des 404 | code + données | R4, maillage R1 |
| FH-7 | Page véhicule : marques de freinage ; position de montage encore servie | code ; état PROD | pages véhicule |
| FH-8 | Catalogue Clio III : forme du filtre incohérente | données | toute mention Clio III |
| FH-9 | `PieceExpliquee` : accroche absente, libellés fixes, un seul bandeau | code | rendu V1 |
| FH-10 | Aucune composition pour C1, C2, C3 | code | rendu des courts |
| FH-11 | `approvalRecord.stages` exigé par le code, absent du schéma | contrat | G7 de V1 |
| FH-12 | Critères techniques non affichés sur la page véhicule | à vérifier | R1 S4 § 3-4, S6 « Dimensions » |
| FH-13 | Pas de baseline GSC pour pg_id 7 | données | mesure avant/après |
| FH-14 | Vignettes de la famille Filtres cassées (habitacle, boîte auto) | données ou code | R1 S8, R3 S7 |

Hors Claude CLI (owner ou chaîne WIKI) : spot-check humain de la fiche WIKI (promue automatiquement) ; admission des
faits F-C1 à F-C9 ; validation humaine des claims de V1 ; voix et visuels ; décision sur les champs SEO protégés.

## FH-1 — Texte WIX brut servi en R3

Reproduction :

```bash
curl -s https://www.automecanik.com/blog-pieces-auto/conseils/filtre-a-huile | grep -c "combustion chamber"
```

Résultat le 30/10 à 11:47Z : `3`. Source en base :

```sql
select sgc_id, sgc_section_type, sgc_enriched_by, sgc_enriched_at, sgc_sources
from __seo_gamme_conseil where sgc_pg_id::text = '7' and sgc_content ilike '%combustion chamber%';
```

→ `sgc_id` 21, `S4_DEPOSE`, `content-gen-skill`, 2026-03-17, source `rag` `gammes/filtre-a-huile.md` champ
`diagnostic.causes`. Fini quand : la section ne contient plus de texte source brut ; son contenu vient de la fiche
WIKI (texte admis du § 1.2 S4_DEPOSE d'AUDIT.md après relecture). Écrire en base relève de FH-3 ou d'une écriture
autorisée nommément.

## FH-2 — Liens S7 de R3 en 410

Deux défauts cumulés.

1. Code : `restoreAccents` (`backend/src/config/fr-accent-map.ts:98`) applique `[/\bpieces\b/gi, 'pièces']`
   (l.30) au HTML des sections, attributs compris (`backend/src/modules/blog/services/blog-seo.service.ts:251`).
   `href="/pieces/x"` devient `href="/pièces/x"`.
2. Données : la section S7 (`sgc_id` `conseil-7-S7-1771371936783`) stocke `/pieces/<slug>` sans id, qui répond 410
   même sans accent.

Reproduction :

```bash
curl -s https://www.automecanik.com/blog-pieces-auto/conseils/filtre-a-huile | grep -o 'href="/pièces/[^"]*"'
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "https://www.automecanik.com/pi%C3%A8ces/filtre-a-air"
curl -s -o /dev/null -w "%{http_code}\n" https://www.automecanik.com/pieces/filtre-a-air
```

Attendu le 30/10 : 6 liens ; 301 vers `/pieces/filtre-a-air` ; 410. Le défaut 1 touche toute section conseil qui
contient un lien `/pieces/` : correction générique, test sur un attribut `href`.

Fini quand : `restoreAccents` ne modifie ni URL ni attribut (test) ; S7 ne pointe que vers des gammes affichées
(`/pieces/bouchon-de-vidange-593.html`, `/pieces/filtre-a-air-8.html`, `/pieces/filtre-a-carburant-9.html`,
`/pieces/filtre-d-habitacle-424.html`, toutes en 200) ; huile moteur (`pg_id` 1862, `pg_display` 0) et « joint de
vidange carter » (aucune gamme) retirés.

## FH-3 — Producteur WIKI → R1 et R3

Constat : R1 et R3 servent des lignes produites depuis le RAG, contre l'invariant RAW → WIKI → projections
(ADR-031/046 : le RAG n'a pas d'autorité de production de contenu).

```sql
select sgpg_id, sgpg_source_type, sgpg_source_uri, sgpg_updated_at
from __seo_gamme_purchase_guide where sgpg_pg_id::text = '7';
select sgc_section_type, sgc_enriched_by, sgc_enriched_at, sgc_sources->0->>'type' src
from __seo_gamme_conseil where sgc_pg_id::text = '7' order by sgc_order;
```

→ R1 : ligne 127, `rag`, `rag://gammes/filtre-a-huile.md+guides/choisir-filtre-huile.md`, 2026-04-21. R3 : 12
sections, toutes `rag`, enrichies du 03/03 au 04/04/2026.

```bash
rg -l "__seo_gamme_purchase_guide" backend/src scripts -g '!*.test.*' | xargs rg -l -i "automecanik-wiki|wiki/gamme"
rg -l "__seo_gamme_conseil" backend/src scripts -g '!*.test.*' | xargs rg -l -i "automecanik-wiki|wiki/gamme"
```

→ aucun fichier le 30/10. La fiche est déjà dans le sous-module : pointeur `88017732`, blob `c0f7a257` identique au
commit WIKI `a4783348` lu ici ; aucune montée de sous-module requise pour elle.

Fini quand : un producteur gouverné lit la fiche WIKI à un commit épinglé, n'écrit que des faits admis dans les
colonnes R1 (`R1_SECTION_CONFIG`) et les sections R3, échoue fermé sur un fait non admis, et le RAG n'écrit plus ces
tables. Chercher d'abord l'existant (`.claude/knowledge/verify-before-invent.md`) et la gouvernance applicable ; pas de
producteur parallèle. Les textes du § 1 d'AUDIT.md servent d'attendu de relecture, pas d'écriture directe.

## FH-4 — Bornes de S4_MICRO_SEO

`packages/seo-role-contracts/src/contracts/r1.ts:25-26` : 1 500 à 3 000 caractères.
`backend/src/config/r1-keyword-plan.constants.ts:112` : `min_chars: 700`.
Le S4 proposé (1 741 caractères) passe les deux. Fini quand : une seule source de bornes, ou un test qui échoue si
elles divergent.

## FH-5 — Affirmations R1 contredites

| Affirmation servie | Origine | Contredite par |
|---|---|---|
| « le code moteur figure sur votre carte grise (case D.2) » | `__seo_gamme_purchase_guide.sgpg_compatibility_axes`, ligne 127 | cerfa 13749*05 : D.2 = type, variante, version (F-C7) |
| « Les moteurs diesel modernes (1.5 dCi, 1.6 HDI, 2.0 TDI) utilisent majoritairement des filtres cartouche » | `__seo_gamme.sg_content`, `sg_pg_id` 7 | catalogue : 19052 et 19053 affichent des filtres vissés (FH-8) |
| « 2 847 diagnostics ce mois » | `frontend/app/components/gamme/GammeDiagnosticCTA.tsx:68`, en dur | aucune mesure |

Reproduction :

```bash
curl -s https://www.automecanik.com/pieces/filtre-a-huile-7.html | grep -o 'case D.2\|majoritairement des filtres cartouche\|2 847' | sort | uniq -c
```

Attendu le 30/10 : 6, 3, 1. Fini quand : les deux phrases sont retirées des données (ou remplacées par le § 1.1) et
le compteur ne vient plus d'une constante. `sg_content` est un contenu historique : retrait, pas réécriture libre.

## FH-6 — R4 : symptômes et liens

`frontend/app/routes/reference-auto.$slug.tsx:1175` construit `/diagnostic-auto/${symptome}` avec le texte brut de
`__seo_reference.symptomes_associes` (ligne `id` 118, 10 éléments, mise à jour 2026-04-04).

```bash
curl -s https://www.automecanik.com/reference-auto/filtre-a-huile | grep -o 'href="/diagnostic-auto/[^"]*"' | sort -u
curl -s -o /dev/null -w "%{http_code}\n" "https://www.automecanik.com/diagnostic-auto/Huile%20tres%20noire%20avant%20echeance%20vidange" -L
```

Attendu : 5 liens de symptômes plus l'index ; 404. La fiche WIKI ne relie aucun symptôme au filtre
(`diagnostic_safe: false`). Fini quand : le composant ne lie qu'un slug de diagnostic existant, et la liste de
symptômes du filtre à huile est retirée.

## FH-7 — Pages véhicule

- `frontend/app/components/pieces/PiecesOemSection.tsx:137-138` : « (Bosch, TRW, Brembo...) » sur toutes les gammes.
  Fini quand : exemples absents ou tirés des marques de la gamme affichée.
- Position de montage : corrigée sur `main` par #1854 (`3f7771af2`, l.149-159 et 207-210), incluse dans le tag
  `v2026.10.30-bundle-octobre-980b2f8` (créé 2026-10-30T11:12:21Z). À 11:47Z et 11:54Z, la page 19052 sert encore
  « montées à l'arrière ». Aucun changement de code : état du déploiement PROD à constater par Marwane.

```bash
curl -s https://www.automecanik.com/pieces/filtre-a-huile-7/renault-140/clio-iii-140004/1-5-dci-19052.html | sed 's/<!-- -->//g' | grep -c "montées à l"
```

Attendu tant que la version corrigée n'est pas servie : 1 ou plus.

## FH-8 — Catalogue Clio III 1.5 dCi

```sql
with rel as (select rtp_type_id, rtp_piece_id from pieces_relation_type
             where rtp_pg_id = 7 and rtp_type_id in (19052, 19053))
select rel.rtp_type_id, p.piece_display, coalesce(pc.pc_cri_value, '(sans valeur)') type_de_filtre,
       count(distinct p.piece_id)
from rel join pieces p on p.piece_id = rel.rtp_piece_id
left join pieces_criteria pc on pc.pc_piece_id_i = p.piece_id and pc.pc_cri_id = '826'
group by 1, 2, 3 order by 1, 2, 3;
```

Le 30/10 : affichables 74 (19052) et 73 (19053), dont 24 et 23 avec « Filtre vissé » et 50 sans critère ; non
affichées : 8 « Cartouche filtrante » par type. La page 19052 montre 24 références. Fini quand : le propriétaire du
catalogue confirme la forme pour chaque type, séparément, et explique le passage de 74 à 24. Aucune comparaison entre
19052 et 19053 n'est établie.

## FH-9 — `PieceExpliquee`

`services/remotion-renderer/src/compositions/PieceExpliquee.tsx` :

| Ligne | Constat | Effet sur V1 |
|---|---|---|
| 32-44 | pas de prop `hook` | accroche seulement dite ; invisible sans voix |
| 111 | « Quand la changer » en dur | accord au féminin pour « Filtre à huile » |
| 259, 273 | 3 signes au plus sous « Signes d'usure » en dur | les deux cartes de V1 disent qu'aucun signe ne désigne le filtre |
| 286 | gravité `low` par défaut | V1 fixe `low` et `high` |
| props `disclaimer` | un seul bandeau continu | `disclaimer-3` (14-24 s) et `disclaimer-4` (fin) non affichables |

Fini quand : accroche, titres de section et avertissements par fenêtre viennent des props, avec test de rendu.

## FH-10 — Compositions des courts

`NeChangePasTropVite` exige trois causes ; `SymptomeTroisCauses` affiche « 3 causes possibles » en dur. Besoins :
C1, une question puis une séquence d'étapes ; C2, une comparaison de deux pièces ; C3, un schéma animé en trois temps.
Planification par `fafa-remotion-template-planner` ; une composition générique paramétrée plutôt que trois.

## FH-11 — `approvalRecord.stages`

`backend/src/modules/media-factory/services/video-gates.service.ts:87` exige un tableau `stages` (étape 1) et l.332
une étape `script_text` approuvée (G7). `workspaces/marketing/fafa-media-factory/governance/approval-record.schema.json`
ne le prévoit pas. Reproduction :

```bash
node scripts/marketing/fafa-pilot-governance.cjs workspaces/marketing/fafa-media-factory/scripts/draft/fafa-filtre-huile-001
```

Sortie 1 aujourd'hui (`INVALID_claim-table`, validation humaine attendue) ; une fois les claims validés, G7 restera
FAIL tant que schéma et code divergent. Fini quand : schéma et code alignés, un dossier conforme passe l'étape 1.

## FH-12 — Affichage des critères techniques

```bash
curl -s https://www.automecanik.com/pieces/filtre-a-huile-7/renault-140/clio-iii-140004/1-5-dci-19052.html \
  | sed 's/<[^>]*>/ /g' | grep -c -i -E "hauteur|diamètre ext|filetage|by-pass|joint torique"
```

Résultat le 30/10 : 0. En base : hauteur, diamètre extérieur, filetage, pression d'ouverture du by-pass (1 958
pièces), Version (anti-retour, by-pass, joint torique inclus). Fini quand : on sait sur quelle page ces critères sont
visibles (fiche produit, comparateur) ; sinon les phrases R1 qui y renvoient sont retirées.

## FH-13 — Baseline GSC

```sql
select count(*) from __seo_gamme_gsc_baseline where pg_id::text = '7';
```

→ 0. Fini quand : une ligne datée existe pour R1, R3 et R4 avant toute mise en ligne des textes, avec la même méthode
que les autres gammes.

## FH-14 — Vignettes de la famille Filtres cassées

`processCatalogueFamille` construit l'image depuis `pg_pic`
(`backend/src/modules/gamme-rest/services/gamme-data-transformer.service.ts:162-170`). Pour 424 et 416, `pg_pic`
désigne un objet absent du stockage ; `pg_img` désigne un objet présent.

```sql
select pg_id, pg_alias, pg_pic, pg_img from pieces_gamme where pg_id::text in ('8','9','416','424');
```

```bash
B=https://www.automecanik.com/img/uploads/articles/gammes-produits/catalogue
for s in filtre-habitacle filtre-boite-auto filtre-d-habitacle filtre-boite-automatique; do
  printf '%s %s\n' "$(curl -s -o /dev/null -w '%{http_code}' "$B/$s.webp")" "$s"
done
```

Résultat le 30/10 : `pg_pic` 424 = `filtre-habitacle.webp` (400, `NoSuchKey`), 416 = `filtre-boite-auto.webp` (400) ;
`pg_img` 424 = `filtre-d-habitacle.webp` (200), 416 = `filtre-boite-automatique.webp` (200) ; 8 et 9 : `pg_pic` =
`pg_img`, 200. Les deux URL cassées sont servies dans le HTML de R1. Fini quand : les vignettes servies en R1 pour
l'habitacle et la boîte auto répondent 200 ; le choix entre corriger `pg_pic` et lire `pg_img` revient au propriétaire
du catalogue, après recherche des autres lecteurs de `pg_pic`.
