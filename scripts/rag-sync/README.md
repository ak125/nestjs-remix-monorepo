# scripts/rag-sync/

Sync `automecanik-wiki/exports/rag/` → `automecanik-rag/knowledge/` (mirror read-only).

> Pipeline canon (ADR-031 §D20) :
> `automecanik-wiki/exports/rag/` → **`scripts/rag-sync/`** (CI workflow) → `automecanik-rag/knowledge/` (mirror).

## Scripts hébergés

- `sync-wiki-exports-to-rag.py` (anciennement `scripts/rag/sync-from-wiki.py`) — sync idempotent sha256, refuse toute source autre que `wiki/exports/rag/` (garde D20 enforcement). Mode simulation par défaut, `--apply` explicite.

## Invocation

Manuel (DEV) :
```bash
python3 scripts/rag-sync/sync-wiki-exports-to-rag.py \
  --wiki-repo /opt/automecanik/automecanik-wiki \
  --rag-repo  /opt/automecanik/rag \
  --apply
```

CI workflow (plan v3 §Étape 7, à activer) :
- Trigger : push sur `automecanik-wiki/main` qui modifie `exports/rag/**`
- Action : `repository_dispatch` vers `automecanik-rag` qui exécute le sync
- Commit auto sur `automecanik-rag/main` avec marker `synced-from-wiki: <wiki-sha>`

## Intégrité des écritures

Chaque document est copié dans un emplacement temporaire sur le même système de
fichiers, puis remplace sa destination par renommage atomique. Une erreur pendant
la copie ou le remplacement laisse l’ancienne version intacte; un nouveau document
n’est visible qu’une fois sa copie terminée. Les métadonnées du fichier source
restent conservées. Le manifeste `.last-sync.json` suit le même principe et
conserve ses permissions existantes.

Les fichiers temporaires portent une extension `.tmp`, hors du corpus `.md`/`.json`,
et sont nettoyés à la sortie du bloc, y compris en cas d’erreur gérée. Le mode
simulation ne crée ni fichier temporaire ni manifeste. Une erreur reste un code
retour non nul et n’avance pas la date du dernier succès.

Cette garantie porte sur chaque fichier. Elle ne constitue pas une transaction
sur le corpus entier : si un fichier ultérieur échoue, les fichiers précédents
peuvent déjà avoir été remplacés. L’instantané cohérent du corpus et la concurrence
avec les lecteurs restent à traiter séparément. Le script ne supprime pas les
exports retirés ni les fichiers non réconciliés, hormis les fichiers hérités
qu’un tombstone épingle (section suivante).

## Fichiers du miroir absents des exports

Seuls comptent les fichiers que le dépôt rag publie : suivis, ou non suivis et
non ignorés par git (ce que l’étape 4 du cron ajoute). Les fichiers ignorés
(`knowledge/_raw/`, `knowledge/gammes/.backup-*/`) ne sont ni publiés ni comptés.

Le corpus publié avant la garde #1587 et absent des exports (2 008 fichiers au
2026-10-26, corpus vivant du chatbot) est inscrit dans
`audit/baselines/rag-mirror-legacy-baseline.json`. Il est préservé et compté à
chaque passage : ligne de log, champ `legacy_unreconciled` du manifeste et résumé
du cron. Tout autre fichier absent des exports bloque le sync : le refus nomme les
20 premiers, puis donne leur nombre total et l’empreinte de l’ensemble ; deux
refus de même empreinte portent sur le même ensemble. `--list-unreconciled` les
liste tous.

La baseline ne fait que décroître : le cron ne l’écrit jamais et aucun outil n’y
ajoute d’entrée. Une entrée devenue obsolète (fichier retiré du
miroir ou désormais exporté par la WIKI) est signalée `STALE-BASELINE` et met le
cron en `warn`. `--tighten-legacy-baseline` retire ces entrées sans jamais en
ajouter ni synchroniser ; la baseline réduite passe ensuite en PR. Le lancer sur
un instantané de la WIKI à `origin/main`, comme le cron. Ne jamais purger le
miroir pour le faire correspondre aux exports.

## Retrait par tombstone (ADR-031 §D21)

Un fichier hérité ne quitte le miroir que par un tombstone `rag-mirror` du
registre `automecanik-raw/manifests/tombstones.json` (schéma et Gate L dans le
dépôt RAW, entrées produites par `_scripts/tombstone-rag-mirror.py`, jamais à la
main). Avec `--tombstones <registre>`, le sync retire un fichier seulement s’il
est à la fois :

- inscrit à la baseline héritée et absent des exports (un export WIKI du même
  chemin l’emporte) ;
- porteur, au moment du passage, d’un SHA-256 qu’un tombstone épingle pour ce chemin.

Un fichier dont le contenu a changé depuis son tombstone est préservé et signalé
`TOMBSTONE-MISMATCH` (cron en `warn`) ; il se résout par un nouveau tombstone ou
par un export WIKI. `--apply` supprime le fichier et ses répertoires devenus
vides (`WITHDRAW`) ; la simulation l’annonce (`DRY-WITHDRAW`). Rien n’est retiré
quand le sync refuse un fichier hors baseline. Un registre illisible, d’une
version majeure autre que 1 ou dont une entrée sort de `knowledge/` arrête le
sync. Le manifeste (`schema_version` 1.2.0) enregistre
`tombstones: {ref, withdrawn, mismatched}`, `null` sans `--tombstones`.

Le registre n’est pas une source de contenu : il n’autorise que des retraits et
laisse intacte la règle D20 (le contenu ne vient que de `exports/rag`). Le cron
le lit à `origin/main` du clone RAW (`git show`), jamais dans son arbre de
travail, et cite ce commit dans le message du commit rag. Un fichier retiré
devient une entrée `STALE-BASELINE` : la baseline se resserre ensuite par
`--tighten-legacy-baseline` et une PR.

## Source des exports

Le cron lit `exports/rag` dans un instantané de `origin/main` (`git fetch` puis
`git archive`), jamais dans l’arbre de travail du clone wiki partagé, dont il ne
change ni la branche ni les fichiers. Le manifeste enregistre la provenance dans
`source_ref` (`automecanik-wiki@<commit>`).

Validation hors ligne :
```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover \
  -s scripts/rag-sync -p 'test_sync_wiki_exports_to_rag.py' -v
bash scripts/cron/sync-rag-from-wiki.test.sh   # cron horaire, sur dépôts jetables
```

## Référence

- ADR-031 §D20 — sync-from-wiki STRICT lit `wiki/exports/rag/` ONLY
- ADR-031 §D21 — aucune suppression silencieuse, tombstone dans `automecanik-raw/manifests/tombstones.json`
- Plan v3 §Étape 5 Groupe C + §Étape 7 (workflow CI)
