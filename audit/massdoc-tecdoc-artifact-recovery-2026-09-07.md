# Récupération des artefacts TecDoc — provenance et vérification

> 2026-09-07. PR **strictement non destructive** : elle ne fait que remettre sous contrôle
> de version des fichiers retrouvés. Aucune base touchée, aucun `DROP`, aucune donnée
> supprimée, aucun resize, aucun changement de compute.

## Pourquoi maintenant

Le pipeline d'import TecDoc dépendait de fichiers qui n'existaient plus qu'à **deux
endroits fragiles** : des objets Git **orphelins** (non atteignables depuis une branche,
un tag ou le reflog) dans le dépôt de la machine DEV, et le disque de cette même machine.

`git rev-list --objects --all --reflog | grep c4da30a1` renvoie **zéro** : un
`git gc --prune` détruisait définitivement le parseur, et avec lui toute possibilité de
reconstruire `tecdoc_raw` — donc `source_linkages`. Les audits antérieurs
(`massdoc-c1-tecdoc-reproducibility-2026-09-02.md`, PR #1409) l'avaient déclaré
« absent du disque **et de git** » : la première moitié est vraie, la seconde est fausse.
L'instrument utilisé (`git log --all`) ne voit pas les objets non atteignables.

## Artefacts récupérés

Les 8 fichiers sont restaurés **à leur chemin d'origine**. C'est nécessaire pour les
scripts : sept appelants référencent le parseur par le chemin absolu
`/opt/automecanik/app/scripts/tecdoc-mysql-to-csv.py`.

| fichier | provenance | blob Git (sha1) | statut |
|---|---|---|---|
| `scripts/tecdoc-mysql-to-csv.py` | objet orphelin, dépôt DEV | `c4da30a15cf51fb10f2c77620502e0e7e421eaf9` | **original récupéré** — octet pour octet |
| `scripts/tecdoc-batch-load.sh` | objet orphelin, dépôt DEV | `41ae2667d82a29c8451f59f0560a16614524a946` | **original récupéré** — octet pour octet |
| `scripts/tecdoc-batch-load.py` | objet orphelin, dépôt DEV | `cc3075bf8ef437debbd6cfdad7f6da7d8e00c59f` | **original récupéré** — octet pour octet |
| `scripts/recover-tecdoc-images.py` | objet orphelin, dépôt DEV | `c7a6e67f71f2d098c95270028a776e2e3ace7c7e` | original récupéré **puis expurgé** (§Sécurité) |
| `docs/audit/recovered-tecdoc-2026-09-07/tecdoc-source-mapping.md`<br>_origine : `.spec/00-canon/db-governance/`_ | objet orphelin, dépôt DEV | `af25a1f2b8849a5ec71a646749c931b7ce2b458f` | **document historique** — octet pour octet |
| `docs/audit/recovered-tecdoc-2026-09-07/tecdoc-apply-mapping.md`<br>_origine : `.spec/00-canon/db-governance/`_ | objet orphelin, dépôt DEV | `4ce4583694aca7c2abbb2e17bcccfff12ccfcdbb` | **document historique** — octet pour octet |
| `docs/audit/recovered-tecdoc-2026-09-07/runbook-reimport-tecdoc-images.md`<br>_origine : `docs/`_ | objet orphelin, dépôt DEV | `7e7d030bd307427aa54a242104ec0f65cdcf74f3` | **document historique** — octet pour octet |
| `docs/audit/recovered-tecdoc-2026-09-07/tecdoc-ingestion-rootcause-2026-04-13.md`<br>_origine : `.spec/reports/`_ | objet orphelin, dépôt DEV | `f7530d825303b98b10a58051d9960ea32719817d` | document historique **puis expurgé** (§Sécurité) |

Récupération : `git cat-file -p <blob> > <chemin>`. Chaque fichier a été revérifié après
copie par `git hash-object`, qui rend le sha1 attendu — les 8 correspondent.

> **Les 4 scripts sont restaurés à leur chemin d'origine** — c'est une nécessité
> technique : sept appelants référencent le parseur par chemin absolu.
>
> **Les 4 documents sont regroupés sous `docs/audit/recovered-tecdoc-2026-09-07/`**,
> et non à leur chemin d'origine, pour deux raisons. (1) Deux d'entre eux venaient de
> `.spec/00-canon/` : y restaurer des documents **historiques** leur rendrait une
> apparence d'autorité canon courante, que le CLAUDE.md signale précisément comme
> dangereuse (« legacy `.spec/00-canon` docs self-declare CANON but closure-status »).
> Le canon vit au vault. (2) `docs/audit/**` est déjà couvert par un glob d'ownership
> existant, là où `.spec/00-canon/db-governance/**` et `.spec/reports/**` ne le sont
> pas — les y placer exigerait une édition de `ownership.yaml`, qui est owner-only.
> Le chemin d'origine de chacun est conservé dans le tableau ci-dessus.

## Sécurité — une expurgation, et une rotation à faire

Le scan de secrets a **échoué** sur 2 des 8 fichiers, et il a fallu le lire pour le voir :
`scripts/recover-tecdoc-images.py:50-51` portait les identifiants du portail TecDoc **en
clair**, et le rapport root-cause (lignes 86-87) les recopiait verbatim (c'est ce rapport, écrit en avril 2026, qui signalait déjà la dette).

Deux constats qui ont décidé du traitement :

1. **Le secret n'est PAS dans l'historique atteignable.** `git log --all` sur ce chemin
   ne rend rien, et la recherche du littéral sur les commits atteignables non plus.
   L'exposer serait donc une **régression introduite par cette PR**, pas la perpétuation
   d'un état existant.
2. **`gitleaks` ne le détecte pas** — `no leaks found` sur les 8 fichiers, avec la
   configuration du dépôt. Le mot de passe est court et sans préfixe reconnaissable. La
   garde CI serait **verte et fausse** ; on ne peut pas s'appuyer dessus ici.

Traitement retenu : les deux littéraux sont remplacés par une lecture d'environnement,
sur le modèle que le fichier applique déjà à `SUPABASE_KEY`. C'est la **seule**
modification de contenu de cette PR, et elle est délibérée.

> **Action owner requise, hors PR** : les identifiants du portail TecDoc utilisés par ce
> script doivent être considérés comme **compromis et tournés**. Ils ont séjourné en clair
> dans un objet Git sur la machine DEV. Le compte concerné est identifiable dans le blob
> d'origine `c7a6e67f…`, non reproduit ici.

Aucun autre secret : les scripts lisent `SUPABASE_SERVICE_ROLE_KEY` et
`SUPABASE_DB_PASSWORD` depuis l'environnement ou `backend/.env`. Les valeurs par défaut
présentes (`aws-0-eu-west-3.pooler.supabase.com`, `db.<ref>.supabase.co`, `postgres.<ref>`,
`https://<ref>.supabase.co`) sont des hôtes et identifiants publics ; le project-ref
figure déjà dans 138 fichiers du dépôt, dont `.gitleaks.toml`.

## Dette de portabilité — signalée, non corrigée

Conformément au périmètre, **aucun chemin n'a été « corrigé »**. Les scripts d'origine
contiennent des chemins absolus, qui restent valides tant que les fichiers sont à leur
place d'origine :

| fichier | dette |
|---|---|
| `tecdoc-batch-load.sh:15-20` | `/opt/automecanik/app/.github/SQL-CONVERTED.7z`, `/opt/automecanik/data/tecdoc/{filelists,workdir,logs}`, et le parseur en absolu |
| `tecdoc-mysql-to-csv.py` | aucun chemin absolu, mais **lit le fichier entier en mémoire** (`f.read()`) : 640 Mo d'entrée → ~2 Go de RSS. À revoir avant tout rejeu de masse |
| `tecdoc-batch-load.py:101-117` | valeurs de connexion par défaut en dur ; remonte à `../backend/.env` |
| `recover-tecdoc-images.py:62` | remonte à `../backend/.env` |
| les 3 scripts | `/opt/automecanik/data/tecdoc/` est **hors dépôt** : 17 autres scripts du pipeline y vivent encore, non versionnés |

## Ce que la validation prouve

`bash scripts/test-tecdoc-mysql-to-csv.sh --with-large` → **PASS=9 FAIL=0 SKIP=0**.

Le parseur committé (sha256 `bde7657f851eccdb8146f1c12c5ab286dc45784575a15e018b13416bd46e01b7`)
régénère **octet pour octet** les 7 sorties produites par le pipeline réel en mars 2026,
y compris `012.csv` (1 177 199 036 octets, 13 336 463 lignes, ~2 min). Plus une fixture
synthétique sans aucune dépendance, qui couvre `NULL` vs chaîne vide, `\'`, `''`, `\\`,
virgule et guillemet (quoting RFC 4180), `\t`, `\r`, `\n` en champ multi-ligne,
`0000-00-00`, et la continuité du compteur `_source_row_no` entre deux `INSERT`.

Les octets des 7 fixtures réelles ne sont **pas** versionnés : ce sont des données TecDoc
sous licence. `scripts/tecdoc-parser-fixtures/real-fixtures.sha256` en porte les
empreintes, ce qui permet de rejouer la validation sur une machine qui dispose du
répertoire sans redistribuer la donnée. En l'absence de ce répertoire, le test annonce
explicitement le saut plutôt que de laisser croire à une couverture complète.

## Ce que cette PR ne prouve pas

- **Pas le rejeu complet.** Aucune reconstruction de bout en bout depuis l'archive n'a
  jamais été exécutée. Un parseur validé sur 7 fixtures n'est pas un pipeline rejoué.
- **Pas la reproductibilité du périmètre de mars 2026.** La liste des « DLNR actifs » qui
  pilote `load-t400-active.py` et `populate-source-linkages` n'est ni un fichier ni une
  table figée : c'est une requête sur l'état vivant de la base. Un rejeu aujourd'hui ne
  reconstituerait donc pas le même périmètre.
- **Pas l'autorisation de supprimer quoi que ce soit.** Les ~110 Go de `tecdoc_raw` et
  `source_linkages` restent intouchés, et le restent tant qu'un rejeu réel n'a pas été
  prouvé. La disposition est owner-gated (invariant 9, DB destructive).
- **Pas la fermeture des portes runtime.** Les 5 portes ouvertes sur les schémas
  `tecdoc_*` — dont `__load_tecdoc_raw`, `SECURITY DEFINER` en écriture avec `EXECUTE`
  à `PUBLIC` — sont hors périmètre et feront l'objet d'une PR sécurité dédiée.

## Risque fermé par cette PR

Le pipeline TecDoc ne dépend plus d'objets Git orphelins ni du seul disque de la machine
DEV. Les 4 scripts et 4 documents sont désormais dans `main`, donc répliqués sur GitHub et
sur chaque checkout. Un `git gc --prune` sur la machine DEV est redevenu une opération
sans conséquence.
