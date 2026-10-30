# Workspaces et chargement des instructions

Les racines spécialisent le travail ; elles ne sont pas des frontières de permissions.
Les chemins ci-dessous sont relatifs à la racine Git du checkout utilisé.

| Répertoire de départ | Usage et sources locales |
|---|---|
| `.` | Développement ; `CLAUDE.md`, `AGENTS.md`, `.claude/rules/`, `.claude/skills/` |
| `workspaces/seo-batch/` | SEO ; instructions locales, règles SEO, agents R*, skills SEO |
| `workspaces/marketing/` | Marketing ; instructions locales, règles marketing, agents G1 et skills locaux |
| `workspaces/wiki/` | Proposals WIKI ; instructions locales, règles wiki, skill `wiki-proposal-writer` |

## Sélection et application des skills

Ce protocole s'applique à Claude CLI, Codex et aux missions Hermes dans leurs
accès effectifs. Utiliser les fichiers du checkout et de la révision de la mission,
jamais une copie d'instructions d'une autre session supposée équivalente.

1. Lire le contrat racine `CLAUDE.md` s'il n'est pas déjà chargé, puis les
   `CLAUDE.md`, `AGENTS.md` et règles du workspace concerné. Faire cette lecture
   aussi lorsque la tâche de workspace commence depuis la racine du dépôt.
2. Sélectionner les skills d'après leur description et la tâche. Lire le corps
   de chaque `SKILL.md` retenu et ses seules références requises avant l'étape
   correspondante. Respecter les politiques d'invocation explicite ; le chargement
   ne confère aucun droit supplémentaire et n'autorise pas une action hors mandat.
3. Appliquer la procédure, ses entrées et ses validations. Ne pas charger tous les
   corps de skills, invoquer un générateur déprécié ou enchaîner les trois agents
   par défaut. Si aucun skill ne convient, l'indiquer brièvement sans en inventer un.
4. Dans le compte rendu existant, distinguer les chemins réellement lus, les étapes
   exécutées et les résultats vérifiés, avec la révision concernée. Une liste de
   noms ou l'affirmation de l'exécutant ne constitue pas une preuve de lecture.
5. Pour déléguer, transmettre le workspace, la révision, les chemins des skills
   nécessaires, le résultat attendu et les bornes du mandat. L'exécutant les lit
   avec les outils autorisés de sa propre mission ; ne pas supposer un contexte partagé.
6. Si une source obligatoire ou un outil est inaccessible, signaler précisément
   l'étape non exécutée et poursuivre les étapes indépendantes autorisées. Ne pas
   déclarer le skill appliqué, copier une version non vérifiée ou élargir les accès.

Points d'entrée usuels (sélection ciblée, pas un nouvel inventaire exhaustif) :

| Besoin | Source à lire |
|---|---|
| Relecture de sa propre modification explicitement demandée | `.claude/skills/code-auto-review/SKILL.md` |
| Qualifier une capacité et ses preuves d'exécution | `.claude/skills/capability-acceptance/SKILL.md` |
| Orientation diagnostique et limites catalogue | `.claude/skills/diagnostic-orientation/SKILL.md` |
| Contenu gamme/véhicule, WIKI vers consommateurs SEO | `workspaces/seo-batch/.claude/skills/seo-content-loop/SKILL.md` |
| Audit SEO d'une gamme | `workspaces/seo-batch/.claude/skills/seo-gamme-audit/SKILL.md` |
| Connaissance à proposer au WIKI | `workspaces/wiki/.claude/skills/wiki-proposal-writer/SKILL.md` |
| Analyse d'une référence créative | `workspaces/marketing/.claude/skills/creative-pattern-extractor/SKILL.md` |
| Identité et script Fafa | `workspaces/marketing/.claude/skills/fafa-persona-canon/SKILL.md`, puis `workspaces/marketing/.claude/skills/fafa-script-generator/SKILL.md` |
| Revue d'une vidéo | `workspaces/marketing/.claude/skills/fafa-brand-safety-reviewer/SKILL.md` |

Pour une relecture française, lire aussi
`.claude/prompts/_shared/editorial-review.md` ; préserver les affirmations admises,
les chiffres, les conditions et le périmètre du contenu. Les autres skills se
sélectionnent par leur description dans le workspace utile, sans recopier leur contenu.

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
Depuis la racine, les skills des workspaces descendants ne sont pas tous chargés
au démarrage : travailler dans le workspace approprié ou lire leur chemin explicite
selon le protocole ci-dessus. Vérifier la disponibilité avant une invocation native.
Les agents `.claude/agents/` et les miroirs restent à distinguer de leur chargement.

Chaque workspace porte son propre `.claude/settings.json` (hooks, permissions) ;
le réglage racine seul ne s'y applique pas dans cette installation :
la découverte des settings ne doit pas être déduite de celle des `CLAUDE.md`.
Les hooks SessionStart/UserPromptSubmit ajoutent leurs propres extraits bornés ;
ils ne rendent pas toute la documentation canonique automatiquement chargée.

## Codex et Hermes

Codex CLI 0.144.4 : chaîne `AGENTS.override.md` ou `AGENTS.md` de la racine au cwd ;
le fichier racine demande de lire `CLAUDE.md`. Les liens Markdown ne sont pas des
imports. À la racine et dans chaque workspace, `.agents/skills` est un lien
relatif `../.claude/skills` vers les sources locales. La découverte dépend du cwd
de la session ; un lien de workspace n'expose pas ses skills à toutes les sessions
racine. Sur un checkout qui matérialise les symlinks en fichiers texte, la découverte
native reste indisponible : effectuer la lecture explicite et signaler cette limite.

Missions Hermes de DEV, constaté le 2026-10-26 sur des missions réelles : avec
l'exécutant Codex (runtime 0.153.2), la session liste les skills du dépôt ; avec
l'exécutant Claude, le contrôleur lance Claude sans sources de réglages, sans
commandes slash ni outils natifs (seul l'outil MCP de la mission) : ni `CLAUDE.md`
ni aucun skill n'entrent dans le contexte ; seule la consigne du contrôleur
demande de lire les `AGENTS.md` applicables. L'objectif d'une mission doit donc
nommer le workspace et les chemins des skills nécessaires, puis imposer leur
lecture par l'outil autorisé de la mission avant application. Le présent protocole
explicite ce contrat ; il ne modifie pas le lanceur installé ni ne prouve sa recette.

Hermes s'exécute sur un autre VPS, sans accès local au checkout
`/opt/automecanik/app`. Ses outils et sections de continuité existants ne prouvent
pas le chargement des instructions de ce dépôt. Le chargement natif de ces règles
reste non raccordé ; aucune copie ni synchronisation n'est ajoutée. Les profils,
configurations globales et droits restent hors du périmètre de cette simplification.
Le profil marketing possède son propre export approuvé et son lecteur de skills
avec contrôle de provenance (`scripts/marketing/hermes/marketing_profile.py`).
Utiliser ce lecteur dans son périmètre ; ne pas exposer tous les workspaces au profil,
changer sa release ou réactiver settings, hooks et outils natifs pour contourner
une lecture refusée. Si le contrôleur doit évoluer, inspecter sa source installée
et conserver son isolation ; elle n'est pas versionnée dans ce dépôt.

## Contrôle du chargement

Contrôle statique du dépôt :
`bash scripts/agents/validate-agents-md.sh --skill-wiring`.
Il vérifie les liens de découverte et les chemins de skills cités ci-dessus ;
il ne certifie ni invocation native ni application de la procédure.

Après changement, vérifier les sources dans une nouvelle session à la racine puis
dans un workspace représentatif (`/memory` et `/context` côté Claude, si disponibles).
Ne pas extrapoler à une session déjà ouverte. Aucun chargement réel nouveau ni gain
de tokens/RAM n'est déduit d'un simple contrôle statique.
Pour chaque exécutant effectivement utilisé, observer une tâche bornée sans effet
externe : chemin et révision lus, procédure suivie, résultat attendu et observé.
Pour Hermes, tester séparément le lecteur natif du profil et une mission déléguée ;
une réussite Claude CLI directe ne valide pas le lanceur Hermes vers Claude.

Sources officielles : [Claude memory](https://code.claude.com/docs/en/memory),
[Claude skills](https://code.claude.com/docs/en/skills),
[Codex AGENTS.md](https://developers.openai.com/codex/guides/agents-md).
