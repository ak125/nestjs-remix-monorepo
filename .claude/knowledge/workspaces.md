# Workspaces et chargement des instructions

Les racines spécialisent le travail ; elles ne sont pas des frontières de permissions.
Les chemins ci-dessous sont relatifs à la racine Git du checkout utilisé.

| Répertoire de départ | Usage et sources locales |
|---|---|
| `.` | Développement ; `CLAUDE.md`, `AGENTS.md`, `.claude/rules/`, `.claude/skills/` |
| `workspaces/seo-batch/` | SEO ; instructions locales, règles SEO, agents R*, skills SEO |
| `workspaces/marketing/` | Marketing ; instructions locales, règles marketing, agents G1 et skills locaux |
| `workspaces/wiki/` | Proposals WIKI ; instructions locales, règles wiki, skill `wiki-proposal-writer` |

## Mémoire et reprise

Ne pas supposer une mémoire distincte par workspace : vérifier le chemin indiqué
par le runtime. Pour une reprise, lire un extrait borné du journal et revalider
les états, phases et décomptes historiques contre le checkout et ses preuves.
La présence d'un agent ou d'une route ne prouve pas son activation.

## Claude Code

Vérifié pour l'installation 2.1.301 le 2026-10-20 : les `CLAUDE.md` parents
s'ajoutent à celui du cwd ; les fichiers imbriqués et règles `paths:` se chargent
à la demande. Les règles sans `paths:` se chargent systématiquement dans leur périmètre.
Par défaut, la présence d'un `CLAUDE.md` parent/courant empêche le chargement
alternatif des `AGENTS.md`. Ce dépôt conserve donc son contrat dans `CLAUDE.md`,
sans import circulaire ni duplication dans `AGENTS.md`.

Les skills du cwd et de ses parents jusqu'à la racine Git sont découverts ensemble ;
leur corps est chargé à l'invocation. Une surface spécialisée n'exclut donc pas les
skills racine. Une liste de fichiers ne prouve pas leur invocation ni leurs droits.
Les agents `.claude/agents/` et les miroirs restent à distinguer de leur chargement.

Chaque workspace porte son propre `.claude/settings.json` (hooks, permissions) ;
le réglage racine seul ne s'y applique pas dans cette installation :
la découverte des settings ne doit pas être déduite de celle des `CLAUDE.md`.
Les hooks SessionStart/UserPromptSubmit ajoutent leurs propres extraits bornés ;
ils ne rendent pas toute la documentation canonique automatiquement chargée.

## Codex et Hermes

Codex CLI 0.144.4 : chaîne `AGENTS.override.md` ou `AGENTS.md` de la racine au cwd ;
le fichier racine demande de lire `CLAUDE.md`. Les liens Markdown ne sont pas des
imports. `.agents/skills` est un symlink interne vers les skills racine ; les
skills imbriqués sous `.claude/` ne sont pas une découverte Codex garantie.

Missions Hermes de DEV, constaté le 2026-10-26 sur des missions réelles : avec
l'exécutant Codex (runtime 0.153.2), la session liste les skills du dépôt ; avec
l'exécutant Claude, le contrôleur lance Claude sans sources de réglages, sans
commandes slash ni outils natifs (seul l'outil MCP de la mission) : ni `CLAUDE.md`
ni aucun skill n'entrent dans le contexte ; seule la consigne du contrôleur
demande de lire les `AGENTS.md` applicables. Une mission Claude qui doit suivre un skill le cite par son
chemin dans l'objectif.

Hermes s'exécute sur un autre VPS, sans accès local au checkout
`/opt/automecanik/app`. Ses outils et sections de continuité existants ne prouvent
pas le chargement des instructions de ce dépôt. Le chargement natif de ces règles
reste non raccordé ; aucune copie ni synchronisation n'est ajoutée. Les profils,
configurations globales et droits restent hors du périmètre de cette simplification.

## Contrôle du chargement

Après changement, vérifier les sources dans une nouvelle session à la racine puis
dans un workspace représentatif (`/memory` et `/context` côté Claude, si disponibles).
Ne pas extrapoler à une session déjà ouverte. Aucun chargement réel nouveau ni gain
de tokens/RAM n'est déduit d'un simple contrôle statique.

Sources officielles : [Claude memory](https://code.claude.com/docs/en/memory),
[Claude skills](https://code.claude.com/docs/en/skills),
[Codex AGENTS.md](https://developers.openai.com/codex/guides/agents-md).
