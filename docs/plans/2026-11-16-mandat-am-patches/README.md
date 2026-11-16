# Correctifs préparés, non appliqués (mandat AM et son complément, 2026-11-16)

Ces correctifs ne sont **pas appliqués** dans cette PR. Les fichiers `.github/**` sont réservés à
l'owner (garde de fichiers de l'agent, ADR-130 D3.4). Cette PR ne contient donc que les correctifs
et l'inventaire. **Leur application revient à Marwane.**

## Objet

- `morning-health-digest` met à jour **une seule issue**, au titre fixe
  « Rapport du matin — santé de la plateforme (morning-health-digest) », au lieu d'en créer une par
  jour ouvré : 132 issues ouvertes au relevé du 2026-11-15 23:48 UTC. L'issue est retrouvée par ce
  titre parmi celles de `github-actions`, puis créée si elle manque. Son corps est remplacé à chaque
  passage. Un commentaire court n'est posté que si un signal change de couleur.
- `weekly-pr-hygiene` suit le même principe, avec le titre
  « Hygiène hebdomadaire des PR — rapport unique (weekly-pr-hygiene) » (26 issues ouvertes au relevé).
- Le rapport du matin lit six signaux. Chacun porte sa source, son heure de lecture et sa qualité
  (qualifié, cohérent en interne, à requalifier, non qualifié). Une source illisible est écrite
  « indisponible », jamais 0.
  1. Tunnel de paiement, avec les mêmes règles et seuils que `check-payment-tunnel.sh`.
  2. Commandes non payées depuis plus de 24 h (créées entre J-30 et J-1).
  3. 5xx PROD par chemin, appels internes `node` séparés.
  4. Tendance hebdomadaire des clics Google.
  5. Dernier test de fumée.
  6. Issues au label `attend-marwane`.
- L'état des couleurs est conservé dans le corps de l'issue, dans le marqueur
  `<!-- report-state:v1 {…} -->`. Aucun stockage nouveau.
- Le corps de l'issue ne publie que des agrégats : le dépôt est public. Aucun identifiant de
  commande ni aucune donnée client n'y figure.

## Complément : heure, canal, fraîcheur, parcours d'achat, configuration (décisions 67, 68, 72)

### Heure et canal (décision 67)

- Le workflow passe à `cron: "*/15 * * * *"`. Chaque passage vérifie les **urgences** ; le **rapport
  du jour** ne tourne qu'une fois par jour de Paris, au premier passage à partir de 7 h (heure de
  Paris, lue dans la configuration si elle existe). 7 h à Paris vaut 06:00 UTC en hiver et 05:00 UTC
  en été : la porte est calculée en `Europe/Paris`, le cron reste en UTC.
- `workflow_dispatch` produit le rapport du jour tout de suite (`--force`). Le rapport est aussi
  produit à tout passage si l'issue unique n'existe pas encore.
- Rapport du jour : corps de l'issue remplacé. En tête, **« Gestes attendus de Marwane »**, avec
  des liens directs : fusions à décider (PR ouvertes hors brouillon et hors Dependabot), PR de migration (`backend/supabase/migrations/`),
  désaccords à arbitrer (label `needs-human`), issues `attend-marwane`. Puis **une ligne par
  département** (les 24 de `.spec/00-canon/ai-registry/agent-operating-map.yaml`), puis le détail
  des signaux.
- **Mail court du jour**, envoyé après la publication de l'issue (il renvoie à son numéro),
  **seulement s'il y a au moins un geste attendu** ; aucun mail sinon. Un mail du jour en échec
  n'est pas renvoyé automatiquement le même jour ; une relance manuelle (`workflow_dispatch`) le
  renvoie si son état n'est pas « envoyé ».
- **Mail d'urgence immédiat, une seule fois par incident** :
  - parcours d'achat en panne (mandat AU) ;
  - alerte de sécurité critique (Dependabot, code scanning) ;
  - garde-fou des prix déclenché.

  Les incidents déjà signalés sont gardés dans le marqueur `<!-- urgent-state:v1 {…} -->` du corps de
  l'issue. Un incident résolu sort du marqueur ; s'il revient, il est signalé de nouveau. Si la
  source d'une urgence est illisible, ses incidents sont reportés tels quels (ni nouveau mail, ni
  oubli). Un mail d'urgence qui n'est pas parti (canal absent, erreur) est retenté à chaque passage.
- Dépôt public : l'issue ne montre qu'un libellé générique (« Alerte de sécurité critique
  (Dependabot) », « Garde-fou des prix déclenché »). Le numéro d'alerte, son lien et la clé du
  garde-fou ne vont que dans le mail. La clé du garde-fou est conservée sous forme d'empreinte
  (`prix:<sha256 tronqué à 12>`) dans le marqueur.
- Les dates et heures du marqueur `<!-- report-meta:v1 {…} -->` (jour de Paris traité, mail du jour)
  évitent un second rapport et un second mail le même jour.

### Fraîcheur des sources (décision 68, mandat AT)

Chaque signal porte la date de la donnée qu'il montre, en plus de l'heure de lecture. Une section
« Sources périmées » liste toute donnée de plus de **3 jours** (`fraicheur.max_jours`) et passe le
signal au moins à orange. Une lecture faite pendant le passage est notée
« lecture directe ».

### Parcours d'achat simulé (mandat AU)

Le mandat AU n'avait livré ni workflow ni fichier au relevé du 2026-11-16 07:38 UTC. Le rapport
prévoit son entrée : tant qu'elle manque, le signal est écrit « non branché » et n'entre pas dans la
couleur globale. Deux entrées possibles :

- `PARCOURS_ACHAT_JSON` : chemin d'un fichier ;
- configuration `parcours_achat.workflow` + `parcours_achat.artefact` : l'artefact du dernier run
  terminé de ce workflow est téléchargé (`actions: read`).

Format attendu, `parcours-achat.v1` :

```json
{"schema":"parcours-achat.v1","generated_at":"<ISO UTC>","window_hours":24,
 "availability_pct":97.9,"runs_total":96,"runs_ok":94,
 "steps":[{"name":"accueil","p50_ms":420,"p95_ms":900,"last_ms":410,"ok":true}],
 "last_run":{"at":"<ISO UTC>","ok":true,"failed_step":null}}
```

Le rapport affiche la disponibilité sur 24 h et un tableau du temps par étape (p50, p95, dernier).
Dernier run en échec : rouge et mail d'urgence nommant l'étape. Disponibilité sous
`parcours_achat.disponibilite_min_pct` : orange (aucun seuil par défaut, faute de seuil gouverné).
Fichier hors format ou artefact illisible : « indisponible ».

### Garde-fou des prix

Aucun producteur n'existe au 2026-11-16 (`sell_at_loss` est un 0 écrit en dur dans
`backend/src/modules/admin/services/command-center-actions.service.ts`). Entrée prévue :
`GARDE_PRIX_JSON`, format `garde-prix.v1` :
`{"schema":"garde-prix.v1","generated_at":"<ISO UTC>","declenchements":[{"cle":"<texte>","at":"<ISO UTC>"}]}`.
Sans entrée : « non branché ».

### Configuration des contrats de département (décision 72, mandat AR)

Aucune configuration des contrats de département n'existait sur `main` au relevé. Point d'accroche :
`REPORT_CONFIG`, chemin d'un fichier JSON `report-config.v1` (variable de dépôt
`REPORT_CONFIG_PATH`). Chaque clé absente prend la valeur par défaut du script, et le rapport dit
laquelle des deux situations s'applique. Fichier illisible ou hors schéma : valeurs par défaut et
avertissement `::warning::` dans le journal.

| Clé | Défaut | Effet |
|---|---|---|
| `rapport.heure_paris` | `7` | heure de Paris du rapport du jour (0 à 23) |
| `fraicheur.max_jours` | `3` | âge au-delà duquel une source est périmée |
| `seuils.sitemap_vert_max_h` / `seuils.sitemap_orange_max_h` | `26` / `30` | fraîcheur du sitemap PROD |
| `seuils.registre_max_h` | `26` | fraîcheur du registre d'automatisation |
| `parcours_achat.workflow`, `.artefact`, `.fichier` | vides, `parcours-achat.json` | entrée du mandat AU |
| `parcours_achat.disponibilite_min_pct` | aucun | seuil orange de disponibilité |
| `labels.attente` / `labels.desaccord` | `attend-marwane` / `needs-human` | labels des gestes attendus |
| `migrations.chemin` | `backend/supabase/migrations/` | PR de migration |
| `departements.signaux` | table du script | signal → numéro de département ; **remplace la table par défaut clé par clé**, sans pouvoir retirer un signal |

La table par défaut signal → département est une **proposition à arbitrer avec le mandat AR** :
tunnel, commandes non payées, parcours → 13 ; 5xx, fumée, CI, PR → 21 ; sitemap, régénération,
clics Google → 07 ; audit, registre → 02 ; registre des migrations → 22 ; sécurité → 19 ;
garde-fou des prix → 16 ; issues en attente → 01. Aucune valeur de KPI d'un département n'est
publiée (dépôt public).

### Secrets et variables, par nom (aucune valeur lue ni écrite ici)

- Existants : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- Canal mail, mêmes noms que `scripts/monitoring/check-payment-tunnel.sh` : `GMAIL_CLIENT_ID`,
  `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_USER_EMAIL`, `ALERT_EMAIL_TO`, `EMAIL_FROM`.
  Leur présence parmi les secrets du dépôt n'a pas pu être vérifiée (lecture refusée, 403). S'ils
  manquent, l'issue écrit « canal mail indisponible » : jamais un faux succès.
- Variables de dépôt facultatives : `REPORT_CONFIG_PATH`, `GARDE_PRIX_JSON_PATH`.
- Permission ajoutée : `security-events: read` (alertes de code scanning). Les alertes Dependabot
  étaient désactivées sur le dépôt au relevé (403 « disabled ») : le signal l'écrit.
- Envoi : `.github/scripts/report-mail.py` (nouveau), Gmail SMTP en OAuth2, bibliothèque standard
  seule. Il imprime `OK`, `INDISPONIBLE:<variables>` ou `ERREUR:<étape>:<type>`, jamais une valeur.

## Fichiers

| Correctif | Fichiers touchés | Effet de la fusion |
|---|---|---|
| `01-check-payment-tunnel-check-only.patch` | `scripts/monitoring/check-payment-tunnel.sh` | Ajoute `CHECK_ONLY=1` : le script applique ses règles, imprime `CHECK_ONLY_RESULT …` et sort sans alerter ni écrire son fichier d'état. Sans cette variable, rien ne change. **Sa fusion déclenche `deploy-monitoring-scripts.yml`, qui installe le script sur l'hôte PROD.** |
| `02-rapports-issue-unique-scripts.patch` | `.github/scripts/report-issue-publish.sh` (nouveau), `.github/scripts/report-mail.py` (nouveau), `.github/scripts/morning-health-digest.sh`, `.github/scripts/weekly-pr-hygiene.sh` | Aucun effet tant que les workflows n'appellent pas `--publish`. Sans cet argument, les deux scripts gardent leur sortie actuelle (`title`, `body_path`) et n'envoient aucun mail. |
| `03-rapports-issue-unique-workflows.patch` | `.github/workflows/morning-health-digest.yml`, `.github/workflows/weekly-pr-hygiene.yml` | Les workflows appellent `--publish`. L'étape « create issue » disparaît. Le rapport du matin passe au cron `*/15 * * * *` (urgences à chaque passage, rapport du jour à 7 h de Paris) et reçoit `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` (secrets existants, déjà utilisés par `diag-canon-slugs-export.yml`), les secrets `GMAIL_*`, `ALERT_EMAIL_TO`, `EMAIL_FROM`, les variables `REPORT_CONFIG_PATH`, `GARDE_PRIX_JSON_PATH` et la permission `security-events: read`. **Sa fusion active des mails sortants**, dès que les secrets du canal existent. |

## Application, dans cet ordre

À faire depuis une branche issue de `main` :

```bash
git apply --check docs/plans/2026-11-16-mandat-am-patches/01-check-payment-tunnel-check-only.patch
git apply         docs/plans/2026-11-16-mandat-am-patches/01-check-payment-tunnel-check-only.patch
git apply docs/plans/2026-11-16-mandat-am-patches/02-rapports-issue-unique-scripts.patch
git apply docs/plans/2026-11-16-mandat-am-patches/03-rapports-issue-unique-workflows.patch
chmod +x .github/scripts/report-issue-publish.sh .github/scripts/report-mail.py

# contrôles statiques
shellcheck -x .github/scripts/report-issue-publish.sh .github/scripts/morning-health-digest.sh \
  .github/scripts/weekly-pr-hygiene.sh scripts/monitoring/check-payment-tunnel.sh
python3 -m py_compile .github/scripts/report-mail.py
actionlint .github/workflows/morning-health-digest.yml .github/workflows/weekly-pr-hygiene.yml
```

On peut appliquer les correctifs 02 et 03 seuls, dans une PR qui ne touche pas l'hôte PROD. Dans ce
cas, le signal « Tunnel de paiement » s'affiche « indisponible » avec le motif « mode CHECK_ONLY
absent du script (patch non appliqué) », jusqu'à ce que le correctif 01 soit fusionné. Le rapport ne
lit jamais le tunnel par un autre chemin.

Premier passage à blanc, sans écriture dans GitHub, depuis la branche appliquée :

```bash
REPO=ak125/nestjs-remix-monorepo SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
  bash .github/scripts/morning-health-digest.sh        # sans --publish : imprime title= et body_path=
```

Ce passage à blanc n'envoie aucun mail et n'écrit aucun marqueur.

## Hors de ces correctifs

- La fermeture des 132 et 26 issues datées revient au mandat U (PR #2076). Ces correctifs n'en ferment
  aucune.
- Le label `attend-marwane` n'est pas créé par ces correctifs. S'il n'existe pas, le signal le dit.
- Le workflow du parcours d'achat simulé (mandat AU), la configuration des contrats (mandat AR) et
  un producteur du garde-fou des prix ne sont pas créés ici : seule leur entrée est prévue.
- `closure-t48h-slo-digest.yml` pourra reprendre `report-issue-publish.sh` plus tard ; il n'est pas
  modifié ici.

## Preuves (scratchpad de la session `662e39b2-69ff-455f-a5c8-016d1efb0199`)

- Les correctifs, rejoués sur des copies de la base `9908188b38`, reproduisent octet pour octet les
  sept fichiers testés (`cmp`), et passent `git apply --check`.
- shellcheck 0.10.0 (`-S warning`) sur les quatre scripts : rc 0. Les scripts d'origine ne passent
  pas (rc 1). `python3 -m py_compile` sur `report-mail.py` : OK.
- actionlint 1.7.12 sur les deux workflows : rc 0.
- Complément : 33 assertions, 33 réussies (2026-11-16 08:11:50 UTC), avec un `gh` factice, un
  PostgREST factice et un envoi de mail factice. Couvert : porte de 7 h (avant, après, le même
  jour, le lendemain, `--force`, issue absente) ; 24 lignes de département ; aucun mail sans geste
  attendu ; urgences (premier mail, pas de doublon, résolution, récidive, source illisible, nouvelle
  alerte seule) ; garde-fou des prix (clé dans le mail seulement) ; parcours d'achat (valide, en
  panne, hors format, non branché, périmé, artefact lu ou illisible) ; configuration (lue,
  illisible, absente) ; canal mail absent puis revenu, erreur SMTP ; issue illisible (rc 1, aucun
  mail) ; liste des PR illisible (liste partielle, « au moins ») ; mode actuel inchangé ; aucun
  secret ni adresse dans les corps publiés.
- `report-mail.py` réel, sans réseau : variables absentes → `INDISPONIBLE:…` rc 2 ; corps absent →
  `ERREUR:corps:fichier_absent` rc 1. Aucun envoi réel n'a été fait.
- Scénarios du mandat AM, avec un PostgREST factice et un `gh` factice :
  - tunnel vert, BURST et LOW_RATE (avec comparaison à `CHECK_ONLY`) ;
  - source indisponible, écrite « indisponible » et non 0 ;
  - issue absente, alors créée ;
  - issue existante, avec son corps remplacé ;
  - changement de couleur, avec un commentaire ;
  - couleur inchangée, sans commentaire ;
  - homonyme d'un autre auteur, ignoré ;
  - hygiène hebdomadaire, en mode actuel et en mode `--publish`.
