# Protocole de sonde labo sûre

Statut : garde-fou **obligatoire** du skill `web-vitals-audit`, pour toute sonde navigateur
(Playwright, CDP) et toute comparaison avant/après. §1 et §3 valent pour toute origine dont le
backend écrit dans la base partagée : PROD, runtime DEV, harnais local. §2 vaut pour PROD. Le skill
reste en lecture seule : ce protocole n'autorise aucune écriture, ni depuis la page ni en base.

## 1. Neutraliser toute écriture DANS la page, avant tout script applicatif

- `page.route(..., route => route.abort())` **ne suffit pas**. Une liste d'URL diverge des
  émetteurs réels, et les `sendBeacon` / `fetch` keepalive émis à la fermeture de la page
  (`visibilitychange` → `hidden`, `pagehide`, où web-vitals envoie INP et CLS) partent hors du
  routage Playwright.
- Le bouchon ci-dessous s'exécute seul : injecter son texte tel quel avant la première navigation,
  par `context.addInitScript({ content: BOUCHON })` (toutes les pages du contexte) ou, en CDP, par
  `Page.addScriptToEvaluateOnNewDocument({ source: BOUCHON })` sur chaque page.

```js
(() => {
  // sendBeacon émet toujours un POST : succès simulé, donc aucun repli vers fetch.
  Object.defineProperty(Navigator.prototype, "sendBeacon", {
    configurable: true,
    value: () => true,
  });
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const req = input instanceof Request ? input : null;
    const method = String((init && init.method) || (req ? req.method : "GET")).toUpperCase();
    const keepalive = Boolean((init && init.keepalive) || (req && req.keepalive));
    return keepalive || (method !== "GET" && method !== "HEAD")
      ? Promise.resolve(new Response(null, { status: 204 }))
      : nativeFetch(input, init);
  };
})();
```

- **Auto-contrôle avant la première URL sondée** : `page.goto("about:blank")`, puis
  `page.evaluate(() => [navigator.sendBeacon, window.fetch].map(String))`. Si une valeur contient
  `[native code]`, le bouchon n'est pas actif : **abandonner le run**.
- Hors bouchon : `XMLHttpRequest`, pixels image, `WebSocket`. Avant chaque campagne, revoir chaque
  résultat de `grep -rnE "XMLHttpRequest|new Image\(|WebSocket\(|EventSource" frontend/app` ; un
  émetteur d'écriture non couvert bloque le run. Une interaction dont le rendu attend une réponse
  POST ne se mesure pas en labo : la lire en RUM (attribution).
- Bloquer en plus, au niveau réseau (`Network.setBlockedURLs` en CDP), les hosts analytics tiers
  chargés par `frontend/app/root.tsx` : leurs hits ne sont ni contrôlables ni purgeables.
- **Marqueur obligatoire** : chaque URL sondée porte `cb=lab-<run_id>` en query string, et la sonde
  reste sur ce document (pas de navigation client) : le beacon RUM relit `window.location.href` à
  l'envoi (`frontend/app/utils/web-vitals.client.ts`). Ce paramètre peut changer la clé de cache
  edge : qualifier la mesure (HIT ou MISS) à partir des en-têtes de réponse.

## 2. Charge : concurrence 1 vers PROD, jamais de fan-out

- **Concurrence 1** vers PROD, toutes sessions et agents confondus, sous un verrou commun :
  `flock -w <délai> "${PROBE_LOCK:-/tmp/web-vitals-prod-probe.lock}" <commande>`.
- Espacer les GET de pages SSR lourdes, sans boucle serrée ni rafale. Point de départ : 30 s
  (heuristique sans source de vérité dans le repo), à allonger si la latence dérive pendant le run.
- **Fan-out interdit** : dans un workflow multi-agents, investigateurs et vérificateurs ne sondent
  jamais PROD en parallèle. La charge des sondes déforme la latence mesurée (TTFB, INP labo).
- Préférer ce qui ne charge pas PROD : banc local sans serveur, lecture RUM, CI Lighthouse PREPROD.
- Déléguer = recopier §1 à §3 **dans le prompt de chaque agent labo**, vérificateurs compris.

## 3. Contrôle SQL après CHAQUE run (lecture seule)

```sql
-- :run_start = horodatage UTC du début du run. Attendu : 0 et 0.
SELECT (SELECT count(*) FROM public.__seo_cwv_raw
         WHERE received_at >= :run_start AND url ~ '[?&]cb=lab') AS cwv_raw_lab,
       (SELECT count(*) FROM public.__seo_event_log
         WHERE created_at >= :run_start AND entity_url ~ '[?&]cb=lab') AS event_log_lab;
```

- Ce contrôle délimite les fuites vers `__seo_cwv_raw` et `__seo_event_log` seulement.
  `seo_link_impressions` et `seo_link_clicks` n'enregistrent que le pathname : aucun contrôle par
  marqueur n'y est possible, leur seule barrière est le bouchon auto-contrôlé (§1).
- Résultat non nul : arrêter toutes les sondes, ne rien relancer, remonter à l'owner les comptes
  par table et par `event_type` ainsi que la fenêtre temporelle.
- **Purge = suppression en base partagée** : jamais exécutée par le skill ni par un agent. Elle
  exige un **GO owner** explicite et nominatif, une **sauvegarde** préalable des lignes ciblées
  (export + sha256) et une transaction unique qui vérifie les comptes attendus. L'upsert de
  réagrégation ne vide pas un bucket horaire devenu sans ligne source : le plan le traite.

## 4. Avant/après : stratifier par uptime du process

- Le coût SSR de cette app peut dépendre de l'uptime du process Node. Un tag ou un redémarrage
  remet le process à neuf : une mesure prise juste après montre un **faux gain**.
- Relever le démarrage du process à chaque tag ou redémarrage : `boot = heure de lecture -
  uptime`, champ `uptime` de `/health` (`process.uptime()`, `backend/src/modules/health/`).
- Comparer à tranche d'uptime égale, `floor(extract(epoch FROM received_at - :boot) / 3600 /
  :tranche_h)`, avec un gabarit témoin qui n'utilise pas le composant suspecté. `:tranche_h` est
  une heuristique (12 au départ) : l'élargir si une tranche manque d'échantillons d'un côté.
- `__seo_cwv_raw`, seule table où exclure `cb=lab` et tout host autre que l'origine PROD, ne garde
  que 48 h (`maintain_cwv_raw_partitions`) : extraire en lecture seule les percentiles par tranche
  du process sortant **avant** le tag. Au-delà, `__seo_cwv_hourly` (par `hour`) permet la tranche
  mais pas ces exclusions : exiger un contrôle §3 nul sur la fenêtre et déclarer le biais hors PROD.
- **Profiling** : ne jamais profiler un process neuf seulement. Mesurer le composant à froid **et**
  après un grand nombre d'appels répétés (ordre de grandeur heuristique : 1 000 puis 100 000). Un
  composant rapide sur process neuf n'est pas exonéré.
- Le verdict terrain (CrUX, groupes GSC) se lit sur une fenêtre glissante de 28 jours : ne rien
  conclure avant J+28 après le tag.
