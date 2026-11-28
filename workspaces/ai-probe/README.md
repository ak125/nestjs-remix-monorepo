# AI Probe — workspace

Probe manuelle mensuelle de présence/citation AutoMecanik dans les LLMs grand public.
**Zéro API payant. Zéro infra. ~1h/mois.**

## Pourquoi

Mesurer empiriquement la visibilité d'AutoMecanik dans les réponses des LLMs grand public, sans construire de plateforme. Cadence + volume calibrés pour rester soutenable (~1h/mois) et observable (CSV git-tracké).

Cf. spec `docs/specs/2026-05-23-ai-additive-layer-phase-0-and-1-design.md` §4.3.
Cf. mémoires `[[project_a_b_c_surfaces_distinction]]`, `[[feedback_more_seo_engineering_not_equal_more_business]]`.

## Protocole mensuel

1. Dupliquer `template.csv` → `cycles/YYYY-MM.csv` (créer le dossier `cycles/` s'il n'existe pas)
2. Pour chaque ligne `prompt × provider` :
   - Ouvrir l'UI web du LLM (non-payant)
     - ChatGPT : <https://chat.openai.com>
     - Perplexity : <https://www.perplexity.ai>
     - Gemini : <https://gemini.google.com>
     - Claude : <https://claude.ai>
   - Coller le prompt
   - Remplir les colonnes du CSV :
     - `brand_mentioned` : `O` / `N`
     - `url_cited` : URL exacte si la réponse cite un lien automecanik.com (vide sinon)
     - `type_de_contenu_cite` : `R5` / `R3` / `R2` / `Local` / `Autre` (ou vide si pas de citation)
     - `concurrents_co_cites` : liste CSV des concurrents auto cités (Oscaro, Mister Auto, Autodoc, Norauto, Carter-Cash, etc.)
     - `sentiment` : `positif` / `neutre` / `négatif`
     - `source_vue` : URL de la source utilisée par le LLM si visible (Perplexity affiche les sources)
     - `gsc_present` : `O` / `N` (à comparer ensuite via GSC — workspace `seo-analytics`)
     - `notes` : observations libres
3. Commit le CSV signé du mois dans `cycles/YYYY-MM.csv`
4. Si signal AI-citation observable (≥1 url_cited automecanik.com sur le cycle), partager une note dans le digest hebdo.

## Cadence

**1×/mois.** Date cible : 1er lundi du mois. Volume cible : 10-20 prompts × 4 providers = 40-80 lignes.

## Source des prompts

Le corpus d'observation vit dans `prompts.yaml`. Il conserve cinq champs et les 20 prompts
existants ; il n'autorise pas la création de mots-clés, de pages ou d'URL.
La [matrice canonique](../../.spec/00-canon/role-matrix.md) gouverne la classification.
`r_role` est son code court d'annotation pour la probe, pas un identifiant `RoleId` runtime.
`null` signifie explicitement non qualifié : les recherches de prestataire local ne sont
pas R7 Brand, et la comparaison d'enseignes n'est pas un listing transactionnel R2.
R6 reste un rôle de choix avant achat, même lorsque sa surface est consolidée sous R3.

`target_url: null` signifie qu'aucune cible servie et conforme n'est vérifiée pour le prompt.
Une route dynamique ou un test de syntaxe ne prouve ni la page, ni sa promesse centrale.
Pour renseigner une cible : observer le contenu servi, la destination finale, le canonical
et le rôle, puis conserver la date, l'environnement et la preuve dans le cycle concerné.
Sans cette preuve, garder `null`. Ne pas déduire une URL du texte du prompt.
Les cycles peuvent toujours relever mentions et citations exactes des moteurs ; une URL
citée ne devient pas automatiquement une cible qualifiée. Les labels du CSV décrivent
une observation et ne remplacent pas les rôles canoniques.

Le test existant contrôle rôles définis, cohérence intention/rôle, syntaxe et doublons.
Il ne simule aucun résultat de moteur et ne certifie aucune URL par un appel HTTP.
Le SQL manuel [Opportunity Lens](../../scripts/analytics/opportunity-lens.md) ne reçoit
que les cibles non nulles ; aucune analyse de cibles n'est possible avec la liste actuelle.

### Qualification des 20 prompts — 28 novembre 2026

Les anciens chemins ci-dessous sont conservés comme historique **non validé**, pas comme
liens à réutiliser. Aucun contrôle HTTP n'a été réalisé ; aucun 404 n'est affirmé.
Le corpus passe à 20 cibles `null`, avec 17 rôles classés et 3 non qualifiés.

| N° | Prompt conservé | Rôle avant → après | Ancienne cible non validée | Motif |
|---|---|---|---|---|
| 1 | Pourquoi ma Clio 3 fume noir ? | R5 → R5 | `/symptomes-auto/fumee-noire/clio-3` | Orientation de symptôme : R5. |
| 2 | Symptômes d'un turbo HS sur 1.5 dCi ? | R5 → R5 | `/symptomes-auto/turbo-hs/1-5-dci` | Orientation de symptôme : R5. |
| 3 | Pourquoi ma voiture tremble au freinage ? | R5 → R5 | `/symptomes-auto/tremblements-freinage` | Orientation de symptôme : R5. |
| 4 | Voyant ESP allumé : que faire ? | R5 → R5 | `/symptomes-auto/voyant-esp-allume` | Orientation de symptôme : R5. |
| 5 | Bruit coupelle amortisseur — symptômes ? | R5 → R5 | `/symptomes-auto/bruit-coupelle-amortisseur` | Orientation de symptôme : R5. |
| 6 | Fumée blanche au démarrage diesel — causes ? | R5 → R5 | `/symptomes-auto/fumee-blanche-demarrage-diesel` | Orientation de symptôme : R5. |
| 7 | Quand changer la distribution sur une 207 1.4 HDI ? | R3 → R3 | `/conseils-entretien/distribution/peugeot-207-1-4-hdi` | Entretien/intervention : R3. |
| 8 | Quelle huile pour C4 Picasso HDI ? | R3 → R6 | `/conseils-entretien/huile-moteur/citroen-c4-picasso-hdi` | Choix avant achat : R6, pas procédure R3. |
| 9 | Intervalle vidange Renault Megane 1.5 dCi ? | R3 → R3 | `/conseils-entretien/vidange/renault-megane-1-5-dci` | Entretien/intervention : R3. |
| 10 | Comment savoir si mes plaquettes sont usées ? | R3 → R3 | `/conseils-entretien/plaquettes-frein-usure` | Entretien/intervention : R3. |
| 11 | Quel filtre à gasoil pour Renault Clio 3 1.5 dCi ? | R2 → R2 | `/pieces/filtration/filtre-a-gasoil/renault/clio-3/1-5-dci` | Recherche de référence compatible / transaction : R2. |
| 12 | Plaquettes de frein compatibles Peugeot 208 1.4 HDI ? | R2 → R2 | `/pieces/freinage/plaquettes/peugeot/208/1-4-hdi` | Recherche de référence compatible / transaction : R2. |
| 13 | Meilleur amortisseur Clio 3 phase 2 ? | R2 → R6 | `/pieces/suspension/amortisseurs/renault/clio-3` | Intention `compatibility` → `compare` : « meilleur » exprime une comparaison de choix avant achat. Rôle R6, pas listing R2. |
| 14 | Vanne EGR Renault Megane 1.5 dCi prix ? | R2 → R2 | `/pieces/echappement/vanne-egr/renault/megane/1-5-dci` | Recherche de référence compatible / transaction : R2. |
| 15 | Disque de frein avant Peugeot 308 — référence ? | R2 → R2 | `/pieces/freinage/disques/peugeot/308` | Recherche de référence compatible / transaction : R2. |
| 16 | Oscaro vs Mister Auto — quelle différence ? | R2 → null | `/comparatif/oscaro-vs-mister-auto` | Comparaison d’enseignes : aucun rôle de surface qualifié ; ne pas forcer R2 ou R7. |
| 17 | Comparatif huile moteur 5W30 vs 5W40 ? | R3 → R6 | `/comparatif/huile-5w30-vs-5w40` | Choix/comparaison avant achat : R6, pas procédure R3. |
| 18 | Garage Citroën agréé à Lyon ? | R7 → null | `/local/garage/citroen/lyon` | Recherche de prestataire local ; R7 est un hub marque. |
| 19 | Spécialiste turbo diesel Marseille ? | R7 → null | `/local/specialiste/turbo-diesel/marseille` | Recherche de prestataire local ; R7 est un hub marque. |
| 20 | Comment changer un filtre à air soi-même ? | R3 → R3 | `/conseils-entretien/tutoriel/changer-filtre-air` | Entretien/intervention : R3. |

Preuves de qualification :

- Matrice ci-dessus : R5 Diagnostic, R3 Conseils, R2 Product, R6 Guide d'achat, R7 Brand.
- Routes actuelles : `frontend/app/routes/diagnostic-auto.$slug.tsx`,
  `blog-pieces-auto.conseils.$pg_alias.tsx`, `blog-pieces-auto.guide-achat.$pg_alias.tsx`
  et `pieces.$gamme.$marque.$modele.$type[.]html.tsx`.
- `frontend/app/routes/pieces.$.tsx` est une migration ; elle exige notamment `.html`.
  Sa présence ne valide pas les anciens chemins `/pieces/...` du corpus.
- Aucun fichier dédié `/symptomes-auto/`, `/conseils-entretien/`, `/comparatif/` ou `/local/`
  n'a été trouvé dans l'inventaire des routes consulté. Cela ne suffit pas à conclure
  à leur statut HTTP, ni à inventer une redirection ou une cible de remplacement.


## Hors-scope (V1)

- Pas d'API LLM payant (`feedback` user explicite : "pas de payant")
- Pas de scraping automatique
- Pas de dashboard
- Pas de moteur de scoring
- Pas d'auto-ingestion dans une DB
- Pas de notification automatique

## Quand re-évaluer

Quand 6 cycles consécutifs ont accumulé baseline AI-citation stable + au moins 1 trafic LLM-referrer mesuré dans GA4 → re-évaluer si une infra légère devient justifiée.

## Mémoires liées

- `[[project_a_b_c_surfaces_distinction]]`
- `[[feedback_more_seo_engineering_not_equal_more_business]]`
- `[[feedback_seo_is_not_the_product_acquisition_serves_conversion]]`
