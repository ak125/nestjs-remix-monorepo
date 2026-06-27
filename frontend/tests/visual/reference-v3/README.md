# `reference-v3/` — archive immuable (NE PAS MODIFIER)

Captures de l'état **Tailwind v3** (build pré-migration), conservées comme **preuve historique**.

- **Immuable** : ces PNG ne sont **jamais** ré-écrits, ni par `--update-snapshots`, ni autrement.
- **Hors oracle CI** : ce dossier est **exclu de `testMatch`** (config `playwright.visual.config.ts`) —
  aucun `toHaveScreenshot` ne les référence. L'oracle courant vit dans `../snapshots/`.
- Servent de point de comparaison « avant migration » lors d'une revue `visual-change`.

Voir `../README.md` (topologie à deux niveaux).
