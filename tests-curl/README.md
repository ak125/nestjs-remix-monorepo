# Tests Curl — Smoke Tests Prod

> Pack minimal : 20 scripts, 0 dépendance, vérification HTTP + JSON critique.

## Structure

```
tests-curl/
├── foundation/     # Foundation gate, pool admissible
├── refresh/        # Content refresh, enrichissement
├── roles/          # Rôles canoniques R1-R6
├── qa/             # QA scoring, audit
├── regression/     # Legacy->canon, anti-régression
└── run-all.sh      # Lance tout, affiche PASS/FAIL
```

## Usage

```bash
# Tout lancer
./tests-curl/run-all.sh

# Un dossier
for f in tests-curl/roles/*.sh; do bash "$f"; done

# Un test
bash tests-curl/roles/01-r1-router-health.sh
```

## Conventions

- Chaque script vérifie : code HTTP + 1-2 champs JSON critiques
- Sortie : `PASS: nom` ou `FAIL: nom (détail)`
- Variables : `BASE_URL` (défaut `http://localhost:3000`)
- Auth admin : cookie file `tests-curl/.cookies` (créé par `00-auth.sh`)

## Pré-requis

```bash
# Login admin (crée le cookie)
bash tests-curl/00-auth.sh
```
