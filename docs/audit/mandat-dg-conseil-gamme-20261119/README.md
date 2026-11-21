# Mandat DG — dossier de preuves

Relevé en lecture seule du 2026-11-19, de 06:00 à 06:41 UTC. Le rapport est dans
[`RAPPORT-MANDAT-DG.md`](RAPPORT-MANDAT-DG.md). Ce fichier liste les preuves et explique
comment les rejouer.

## Contenu

| Dossier | Contenu |
|---|---|
| `sql/` | `q01`–`q10` : SELECT seuls, sans aucune écriture |
| `data/` | Résultats bruts des requêtes SQL et du relevé PROD (statuts, heures, liste des pages) |
| `out/` | Tableaux produits par les scripts à partir de `data/` |
| `scripts/` | `classer_requetes.py` (6.1, 6.2, 6.6), `relever_pages_prod.py` (6.4), `tester_gabarits_titres.py` (6.5b). Tous utilisent la bibliothèque standard seule. |

**Ce que contient chaque requête :**

| Requête | Contenu | Résultat |
|---|---|---|
| q01 | Grain requête GSC R1 et conseil, 90 j (2026-08-19 → 11-16) | `data/gsc_r1_conseil_90j.csv` |
| q02 | Totaux GSC par page, 90 j | `data/gsc_totaux_pages_90j.csv` |
| q03 | Gammes et vocabulaires (marques automobiles, modèles, équipementiers) | `data/pieces_gamme.tsv`, `data/vocab_*.txt` |
| q04 / q04b | Recoupement des chiffres du pilotage, sur 31 j et 29 j | `data/q04*-…csv` |
| q05 | Exemples du pilotage, 31 j | `data/q05-…csv` |
| q06 | Taux de clic du site par position, 90 j (courbe attendue) | `data/ctr_site_par_position_90j.csv` |
| q07 | Cible du CTA conseil et règle « indexable » | `data/conseil_cta_indexable.csv` |
| q08 | Source du corps de la page conseil | `data/source_corps_conseil.csv` |
| q09 | Titles conseil reconstruits | `data/titres_conseil.csv` |
| q10 | Mesures du passage (event_log, seo_link_clicks, seo_link_impressions, GA4), en agrégats | `data/passage_conseil_mesures.csv` |

## Rejouer

**Base massdoc, en lecture seule :** délai d'instruction de 30 s, filtre des avis de
collation.

```bash
STATEMENT_TIMEOUT_MS=30000 ./sweep-psql.sh -q --csv -f sql/q01-gsc-requetes-r1-conseil-90j.sql \
  | grep -v -i "collation\|HINT\|DETAIL\|WARNING" > data/gsc_r1_conseil_90j.csv
```

`sweep-psql.sh` est la copie en lecture seule de l'outil de balayage. Aucun secret n'est
écrit ici.

**Classement et tableaux**, à lancer depuis un dossier neutre :

```bash
cd /tmp && python3 -I <D>/scripts/classer_requetes.py           # D = ce dossier
cd /tmp && python3 -I <D>/scripts/tester_gabarits_titres.py <D>
cd /tmp && python3 -I <D>/scripts/relever_pages_prod.py <dossier_html> <D>/data/pages_prod_liste.txt <D>/out
```

Le script `classer_requetes.py` affiche à la fin :
`lignes 6307 gammes R1 93 gammes conseil 70 gammes double 53 duels 447 couples top10 849`.

**Pages PROD.** Ce sont de simples GET, un par seconde, avec un agent utilisateur de
mobile générique. Il y a eu 38 GET en deux lots, sur un budget de 60 (heures dans
`data/pages_prod_horodatage.txt`, codes HTTP dans `data/pages_prod_statuts.txt`). Les
fichiers HTML ne sont pas versionnés : il suffit de les récupérer à nouveau avec la
commande ci-dessous.

```bash
while read t a id; do
  for u in "https://www.automecanik.com/blog-pieces-auto/conseils/$a" "https://www.automecanik.com/pieces/$a-$id.html"; do
    f=$(echo "$u" | sed 's#https://www.automecanik.com/##; s#/#_#g')
    curl -s -o "$f.html" -w "%{http_code} %{size_download} %{url_effective} %{redirect_url}\n" \
      -A "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36" \
      --max-time 20 "$u" >> status.txt
    sleep 1
  done
done < liste.txt
```

## Heures (UTC, 2026-11-19)

| Étape | Heure |
|---|---|
| Lecture GSC disponible | Données jusqu'au 11-16, lues le 11-19 à 04:00Z |
| Relevé PROD, lot 1 | 06:31:15 → 06:31:55 (30 GET) |
| Relevé PROD, lot 2 | 06:34:57 → 06:35:08 (8 GET) |
| q10 | 06:39:16 → 06:39:38 |
| q04, q04b et q05 (recoupement) | 06:40:47 → 06:40:50 |

## Garde-fous respectés

- **Aucune écriture.** Rien n'a été modifié en base, dans le code, dans les contenus, les
  titles, les H1, le sitemap ou `robots.txt`.
- **Aucune donnée client.** Aucun identifiant de session ou d'utilisateur, aucune adresse
  ni aucun agent utilisateur détaillé ne figure en sortie : q10 ne produit que des
  agrégats.
- **Aucun outil payant** et aucun scraping de Google.
