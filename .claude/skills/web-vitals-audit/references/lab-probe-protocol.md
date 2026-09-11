# Protocole de sonde labo sûre

Statut : garde-fou **obligatoire** du skill `web-vitals-audit`. S'applique à toute sonde qui
charge une page de l'origine PROD (Playwright, CDP, requêtes répétées de pages SSR) et à toute
comparaison avant/après. Le skill reste en lecture seule : ce protocole n'autorise aucune écriture.

## 1. Neutraliser la télémétrie DANS la page, avant tout script applicatif

- `page.route(..., route => route.abort())` **ne suffit pas** : `navigator.sendBeacon` et
  `fetch(..., { keepalive: true })` émis au `pagehide` / `visibilitychange` (flush web-vitals,
  beacon funnel) partent hors du routage Playwright à la fermeture de la page ou du contexte.
  Ils atteignent alors les tables first-party comme des visites humaines.
- Injecter le bouchon ci-dessous avec `context.addInitScript` (ou
  `Page.addScriptToEvaluateOnNewDocument` en CDP) **avant** la première navigation :

```js
function neutraliserTelemetrie() {
  Object.defineProperty(Navigator.prototype, "sendBeacon", {
    configurable: true,
    value: () => true, // succès simulé : aucun repli vers fetch keepalive
  });
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) =>
    (init && init.keepalive) || (input instanceof Request && input.keepalive)
      ? Promise.resolve(new Response(null, { status: 204 }))
      : nativeFetch(input, init);
}
```

- Avant chaque campagne, ré-inventorier les émetteurs côté client depuis le code (source de
  vérité) : `grep -rn "sendBeacon\|keepalive" frontend/app`. Un émetteur qui n'utilise aucune
  de ces deux primitives doit être ajouté au bouchon avant le run.
- Bloquer en plus, au niveau réseau (`Network.setBlockedURLs` en CDP), les hosts analytics tiers
  chargés par `frontend/app/root.tsx` : leurs hits ne sont ni contrôlables ni purgeables.
- **Marqueur obligatoire** : chaque URL sondée porte `cb=lab-<run_id>` en query string. Le beacon
  RUM enregistre `window.location.href` (`frontend/app/utils/web-vitals.client.ts`) : le marqueur
  rend toute fuite délimitable. Ce paramètre peut changer la clé de cache edge : qualifier la
  mesure (HIT ou MISS) à partir des en-têtes de réponse.

## 2. Charge : concurrence 1 vers PROD, jamais de fan-out

- **Concurrence 1** : une seule sonde vers PROD à la fois, toutes sessions et agents confondus.
  Chaque run s'exécute sous `flock -w <délai> "$PROBE_LOCK" <commande>`, avec un verrou partagé
  dont le chemin est passé en variable (jamais en dur dans un fichier versionné).
- Au moins 30 s entre deux GET de pages SSR lourdes. Pas de boucle serrée, pas de rafale.
- **Fan-out interdit** : dans un workflow multi-agents, investigateurs et vérificateurs ne sondent
  jamais PROD en parallèle. La charge des sondes déforme la latence mesurée (TTFB, INP labo) et
  invalide la mesure elle-même.
- Préférer ce qui ne charge pas PROD : banc local de la fonction suspecte sans serveur, lecture
  RUM, CI Lighthouse PREPROD.
- Déléguer une sonde = recopier ce protocole (§1 à §3) **dans le prompt de chaque agent labo**,
  vérificateurs compris.

## 3. Contrôle SQL après CHAQUE run (lecture seule)

```sql
-- :run_start = horodatage UTC du début du run. Attendu : 0 et 0.
SELECT (SELECT count(*) FROM public.__seo_cwv_raw
         WHERE received_at >= :run_start AND url ~ '[?&]cb=lab') AS cwv_raw_lab,
       (SELECT count(*) FROM public.__seo_event_log
         WHERE created_at >= :run_start AND entity_url ~ '[?&]cb=lab') AS event_log_lab;
```

- Résultat non nul : arrêter toutes les sondes, ne rien relancer, remonter à l'owner les comptes
  par table et par `event_type` ainsi que la fenêtre temporelle.
- **Purge = suppression en base partagée** : jamais exécutée par le skill ni par un agent. Elle
  exige un **GO owner** explicite et nominatif, une **sauvegarde** préalable des lignes ciblées
  (export + sha256) et une transaction unique qui vérifie les comptes attendus.
- La réagrégation par upsert ne vide pas un bucket horaire devenu sans ligne source : le plan
  soumis à l'owner traite ces buckets explicitement.
- Ce qui n'est pas purgeable (analytics tiers) : exclusion analytique documentée de la fenêtre.

## 4. Avant/après : stratifier par uptime du process

- Le coût SSR de cette app peut dépendre de l'uptime du process Node. Un tag ou un redémarrage
  remet le process à neuf : une mesure prise juste après montre un **faux gain**.
- Relever le démarrage du process à chaque tag ou redémarrage : `boot = heure de lecture -
  uptime`, champ `uptime` de `/health` (`process.uptime()`, `backend/src/modules/health/`).
- Comparer uniquement à tranche d'uptime égale, par exemple
  `floor(extract(epoch FROM received_at - :boot) / 43200) * 12` (tranches de 12 h), avec un
  gabarit témoin qui n'utilise pas le composant suspecté. Exclure `cb=lab` et les hosts non PROD
  (`localhost`).
- **Profiling** : ne jamais profiler un process neuf seulement. Mesurer le composant à froid
  **et** après un grand nombre d'appels répétés (par exemple 1 000 puis 100 000). Un composant
  rapide sur process neuf n'est pas exonéré.
- Le verdict terrain (CrUX, groupes GSC) se lit sur une fenêtre glissante de 28 jours : ne rien
  conclure avant J+28 après le tag.
