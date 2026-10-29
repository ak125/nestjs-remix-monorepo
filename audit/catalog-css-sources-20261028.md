# Réduction des sources CSS de production — 28 octobre 2026

## Résultat et périmètre

Le candidat réduit le CSS global de **44 008 à 42 751 octets Brotli q4 (−2,86 %)**, sans feuille supplémentaire. Le LCP médian passe de **1 724 à 1 708 ms**, mais les plages se recouvrent : **aucun gain LCP robuste démontré**. Les interactions et styles contrôlés restent comparables. Verdict : **GO_WITH_WATCH pour une PR brouillon**, validation bornée au périmètre ci-dessous.

Base exacte : `7bf9cfbadec2288fdde6d583e00b0a4febc8d8d6`, branche `codex/catalog-css-sources-20261028`. Les trois commits depuis la qualification historique `c24b7b945` ne changent ni frontend ni dépendances ; le CSS témoin conserve le SHA-256 `ce9e16f7c844388382124f1d6a0471ae15cc000b80ebb17c8f19e2c6cb95ff07`. La qualification PREPROD précédente ne vaut pas qualification de ce nouveau patch.

Travail sur checkout isolé Windows et worktree DEV. Aucun service partagé, conteneur, donnée ou configuration PROD modifié ; aucune migration. Les deux serveurs de mesure n'écoutent que sur `127.0.0.1:3197/3198` sur DEV. Leurs requêtes API non GET sont bloquées ; les images distantes existantes sont lues normalement.

## Diagnostic et correction

Le routeur exclut déjà 99 fichiers admin/UI kit/design system des builds de production. Tailwind les scannait néanmoins. La liste des exclusions est désormais partagée entre le routeur et un petit plugin de build, qui ajoute des directives natives `@source not` pour ces fichiers. La politique de routage reste identique : **148 entrées de manifeste dans les deux builds**, dont Command Center et Video Hub.

La déclaration `content` de la configuration legacy réintroduisait les fichiers après les exclusions. Son unique glob app est déplacé vers `@source` dans `global.css`. Le scanner réel confirme **23 170 candidats identiques en DEV** avant/après cette migration ; en production, aucun des 99 fichiers exclus n'est encore scanné. Ces nombres sont des candidats du scanner, pas des nombres de classes CSS utiles.

La détection automatique et les composants partagés restent actifs. Un contrôle du bundle fait échouer le build si une route exclue du CSS est finalement importée dans un chunk servi. Cela prévient une suppression silencieuse de ses styles. Le plugin ignore la façade JavaScript `?url` et traite la compilation CSS `?transform-only`. Les règles visuelles, polices, preloads et composants applicatifs ne changent pas.

Le mécanisme natif est documenté dans [Tailwind — détection des sources](https://tailwindcss.com/docs/detecting-classes-in-source-files). L'ordre effectif des sources a aussi été vérifié avec le compilateur et le scanner installés.

## Build et contrôles de code

- Build frontend de production réussi sur Node `24.21.0` ; même résolution des dépendances pour A et B.
- CSS brut : 370 845 → 352 971 octets (−4,82 %) ; gzip : 48 208 → 46 620 ; Brotli q4 : 44 008 → 42 751.
- CSS candidat : `global-1PlIhI59.css`, SHA-256 `c9861b87d1efa59c2dc24c6bd3bf9d78e32adaf8e3f70aae8343ea91f0b356ff`.
- 199 assets JS dans chaque build : 189 identiques octet pour octet ; neuf autres identiques après normalisation des hashes d'assets et du manifeste. Le dernier, `useHydrated`, diffère par le mode du wrapper d'interop généré (`e(t())` / `e(t(),1)`), qui touche l'export `default` ; le hook conserve ses accès nommés `useState` et `useEffect`. Ne pas présenter tous les JS comme identiques.
- Quatre tests unitaires réussis : activation uniquement en build production, exclusions et exceptions, façades Vite, refus d'une route exclue encore émise, conservation des composants partagés.
- `npm run typecheck`, ESLint ciblé et `git diff --check` réussis.

## Mesures comparables

Route R2 : `/pieces/plaquette-de-frein-402/chevrolet-44/cruze-iii-j305-44088/1-6-57414.html`. Chaque serveur utilise le SSR et les assets de son propre build. HTTP/1.1 local, Brotli q4 pré-calculé pour CSS/JS, même API DEV en GET ; aucun build concurrent de ce lot pendant les timings. Ce transport contrôlé n'est pas le réseau public ni le runtime NestJS complet.

Chromium 149, viewport 390×844, DPR 1, tactile, CPU ×4, latence 150 ms, téléchargement 200 000 octets/s, upload 93 750 octets/s. Cache désactivé et vidé à chaque passage ; un échauffement exclu par build ; ordre A-B-B-A-A-B-B-A-A-B, cinq observations par build. Stabilisation quatre secondes après DOMContentLoaded. Les événements d'interaction sont des mesures synthétiques locales, pas un INP terrain.

| Mesure | Témoin | Candidat |
|---|---:|---:|
| LCP médian (plage) | 1 724 ms (1 700–1 760) | 1 708 ms (1 664–1 724) |
| Fin CSS médiane | 1 585 ms | 1 566 ms |
| Hydratation médiane | 5 168 ms | 5 190 ms |
| Ouverture filtres médiane (plage) | 112 ms (104–160) | 104 ms (104–136) |
| Ouverture carte médiane (plage) | 96 ms (96–128) | 112 ms (88–120) |
| Fermeture carte médiane | 128 ms | 120 ms |
| CLS médian hors interactions récentes | 0,01069 | 0,01069 |
| CSS global total reçu | 44 008 octets | 42 751 octets |

La réduction des octets est déterministe ; les petites variations temporelles ne prouvent ni amélioration générale ni régression de réactivité. Six transferts JS chevauchent encore la réponse CSS dans chaque passage. Les octets JS demandés avant LCP restent proches de 295,6 ko. Un seul téléchargement de DM Sans par passage ; aucun changement de preload. Ces valeurs ne doivent pas être comparées directement aux anciens bancs à HTML capturé.

## Validation navigateur et limites

- R2 : 47 cartes initiales, chargement supplémentaire → 56, filtre `<50€` → 28, réinitialisation → 56, tri décroissant, dialog au clavier, Échap et retour du focus validés.
- H1, cartes et styles échantillonnés identiques dans les 12 états : initial, défilement, liste étendue, filtres, filtrage, tri, dialog et largeurs 639/640/641/1440/390. Texte du dialog identique. Desktop avec survol disponible : parité des styles échantillonnés. Captures candidat du premier écran et du dialog inspectées.
- Deux premiers relevés fonctionnels sont conservés : écarts sur des transitions de boutons/texte à 639 ou 640 px. Le contrôle final attend leur fin après avoir matérialisé les éléments hors écran ; aucun code CSS changé entre ces relevés. Les timings A/B ne sont pas relancés ni sélectionnés selon ces résultats.
- Recherche `?q=plaquette` et page gamme 402 : hydratation, H1/titre et styles échantillonnés identiques. Le texte agrégé de `main` est exclu de cette comparaison car il contient la durée variable de recherche ; les titres et boutons restent comparés.
- Accueil : **non qualifié par ce banc**. Le pilote initial rencontrait `public/index.html` statique ; après routage explicite vers le SSR, A et B répondent 500 car `RemixApplicationPort` manque au contexte injecté normalement par NestJS. Aucun fallback ajouté. À couvrir dans l'environnement intégré/PREPROD CI.
- Aucune `pageerror` capturée dans les dix timings, les contrôles R2 et les deux pages complémentaires hydratées. Quatre images produit en 404 sont communes aux deux builds, en mobile et desktop ; la console n'est donc pas entièrement propre.
- Admin authentifié, toutes les autres pages, Safari/Firefox, HTTP/2/3 public et données terrain restent hors preuve. Ni la CI de ce nouveau candidat ni sa PREPROD ne sont qualifiées par les contrôles DEV de ce rapport.

## Preuves, retour arrière et suite

Synthèse vérifiable : [catalog-css-sources-20261028-evidence.json](catalog-css-sources-20261028-evidence.json). Captures, résultats complets et logs : `output/playwright/css-route-sources/` ; pilotes et analyse : `output/playwright/css-sources-*.cjs`, `analyze-css-sources.py`. Copies DEV conservées sous `output/css-route-sources/`, y compris le build témoin.

Le patch applicatif comporte sept fichiers. Retour arrière proportionné : revert du commit du candidat, puis rebuild frontend ; aucune opération sur des données. Aucun tag ou workflow PROD à exécuter. Les serveurs temporaires sont arrêtés après contrôle de leurs PID, arguments et répertoire ; les worktrees et preuves sont conservés.

Prochaine étape : revue du candidat, CI sur son SHA exact, puis qualification via le cycle PREPROD CI avant toute proposition de promotion manuelle. Le faible gain de payload ne justifie pas une revendication de gain LCP significatif.

```json
{
  "scope_requested": "Continuer le chemin critique CSS/LCP et la reactivite sans mutation PROD",
  "scope_actually_scanned": "Sources CSS et exclusions du routeur, builds A/B, 10 timings R2, interactions et styles R2, recherche et gamme",
  "files_read_count": 7,
  "files_read_count_scope": "Les sept fichiers du patch applicatif, integralement controles ; lectures contextuelles, scripts et preuves hors compteur",
  "excluded_paths": ["backend et DB", "ressources et configuration PROD", "donnees partagees"],
  "unscanned_zones": ["admin authentifie", "autres pages", "Safari Firefox", "reseau public HTTP2/3", "RUM"],
  "corrections_proposed": ["Exclure du scan CSS les routes deja absentes du build production"],
  "corrections_applied": ["Sources natives Tailwind", "liste partagee avec le routeur", "garde contre les imports de routes exclues"],
  "validation_executed": ["builds comparables", "4 tests", "typecheck", "lint cible", "scanner reel", "10 timings", "fonctionnel R2", "styles recherche et gamme"],
  "remaining_unknowns": ["Accueil SSR integre et PREPROD du candidat", "CI du nouveau candidat", "gain terrain", "couverture visuelle de toutes les pages"],
  "final_status": "VALIDATED_FOR_SCOPE_ONLY"
}
```
