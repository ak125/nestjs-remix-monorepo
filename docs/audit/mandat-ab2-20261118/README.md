# Complément AB-2 — sous-agents et skills de workspace dans le registre unique (PR #2081)

Mandat : complément AB-2 au mandat AB (décision 13), rédigé par le chat du département 23 à la
demande de Marwane. Relevé du 2026-11-18, base `main` `23a9e2ae5`.

Un seul registre des outils des agents : `.spec/00-canon/ai-registry/skills.registry.json`,
produit par `scripts/governance/build-skills-registry.js` et contrôlé par `--check` dans
`skills-canon-gate.yml`. Aucun second registre n'est créé.

## 1. Registre avant et après

| | `main` `23a9e2ae5` | branche #2081 |
|---|---|---|
| `skills[]` | 19 (racine) | 47 : racine 19, marketing 11, seo-batch 16, wiki 1 |
| dont conformes au schéma | 18 | 22 (racine 18, marketing 4) |
| `subagents[]` | absent | 45 : racine 3 (mandat), marketing 3, seo-batch 39 |
| `ignoredFiles[]` | absent | 1 : `workspaces/seo-batch/.claude/agents/_shared/kp-shared-output.md` (gabarit sans `name`) |
| `issues[]` | 0 | 24 : les 24 skills de workspace non conformes au schéma local |

- Les 19 entrées racine sont identiques à `main` (comparaison `fast-json-stable-stringify`,
  entrée par entrée).
- Un doublon de nom est une erreur, par type : deux skills, ou deux sous-agents, du même nom
  arrêtent le générateur. Un skill et un sous-agent peuvent porter le même nom
  (cas réel : `keyword-planner` dans seo-batch).
- Une entrée de sous-agent porte `kind: subagent`, son chemin, son sha256, son workspace, et,
  quand le frontmatter les déclare : `department`, `tools`, `disallowed_tools`, `model`, `role`,
  `disable_model_invocation`. Un `department` absent de `agent-operating-map.yaml` va dans
  `issues[]`.
- Schéma : le seul schéma existant, `skill.schema.json`, reçoit `$defs/subagent` (64 lignes
  ajoutées, aucune ligne existante modifiée). Le registre le cite (`subagentSchemaPath`).
- Command Center : `build-command-center-snapshot.js --check` est vert. Le snapshot calculé sur la
  branche est identique à celui de `main`, `generatedAt` mis à part : 0 `DROPPED_CAPABILITY`
  des deux côtés, et les 9 `HANDOFF_INCOMPLETE` existaient déjà. Le Command Center résout les
  capacités par `skills[]` seulement, donc `subagents[]` ne change rien à ce qu'il calcule.

## 2. Ce qui est repris de #2157 (BR) et de #2087 (AK)

Lus sans y écrire. #2081 est la seule PR qui modifie le générateur.

- **BR, patch 1** (`patch-1-registre.patch`, sha256
  `16a5137468e8ebc5e915942f7884fd0d65f54f9348290b76df6d17c82924f04c`) : **repris**. Le
  générateur parcourt la racine puis chaque `workspaces/*/.claude/skills`, dans l'ordre
  alphabétique, avec un champ `workspace` sur l'entrée. Le patch est cité dans l'en-tête du
  générateur.
- **AK, #2087** (head `c32bec31e`, patch sha256
  `c31fcf83de4a6d25ca11d2043db74713f04b40321b27f6862b4919db474dc01a`) :
  - liste `SKILL_ROOTS` limitée à seo-batch : **non reprise**. Le Command Center doit voir tous
    les workspaces, et l'approche BR les couvre sans liste à tenir.
  - chemin de déclenchement du workflow : **idée reprise**, élargie à
    `workspaces/*/.claude/{skills,agents}/**` et `.claude/agents/**`. Comme `.github/` est
    réservé à l'owner, c'est un patch préparé (§5).
  - frontmatter de 9 SKILL.md de seo-batch : **non repris**. Le contenu d'un skill revient au
    département qui l'utilise (décision 13), et #2087 reste tel quel.
  - AK vise un générateur antérieur au verrou des skills tiers (`skills-lock.json`), et ce
    verrou est conservé.

## 3. Garde réelle des 3 sous-agents de mandat (6.4)

- Frontmatter : `tools: Read, Grep, Glob, Bash` et `disallowedTools: Write, Edit, NotebookEdit`.
- Bash : `scripts/claude-hooks/pretool-bash-guard.sh`, la garde déjà branchée sur tout appel
  Bash dans `.claude/settings.json`. Le nom du sous-agent appelant est dans l'enveloppe
  PreToolUse (`agent_type`, absent pour la session principale). Tout sous-agent `mandat-*`
  passe en lecture seule, sur liste d'autorisation, en échec fermé :
  - refusés : substitution, redirection vers un fichier, programme ou sous-commande hors liste ;
  - `gh api` : GET seulement ;
  - `git` : sous-commandes de lecture seulement.
- Un hook déclaré dans le frontmatter du sous-agent **ne s'est pas exécuté** (Claude Code
  2.1.327, essai du 2026-11-18, trace vide). Il a donc été retiré au profit du hook de
  `settings.json`, qui reçoit `agent_type` (essai : clé présente pour le sous-agent, absente pour
  la session principale).
- **Essai réel**, avec `claude -p`, un sous-agent `mandat-essai` (même frontmatter) et la garde
  branchée comme dans `settings.json`, dans un projet jetable sous `/tmp` :
  - `echo essai > …/proof-bash.txt` → `BLOCKED (lecture seule, sous-agent mandat-essai) : redirection vers un fichier.` ;
  - `touch …/proof-touch.txt` → `BLOCKED (lecture seule, sous-agent mandat-essai) : programme non autorise en lecture seule : touch.` ;
  - Write : outil absent pour le sous-agent ;
  - `ls` : exécuté ;
  - aucun fichier `proof-*` n'existe après l'essai.
- Revue de sécurité automatique du commit `bc4fef4f8` : elle a signalé 4 contournements, et
  14 commandes d'écriture passaient effectivement. Exemples : `sort "-o" f`, `sort -uo f`,
  `sort --out=f`, `sort --compress-program=sh`, `echo >&1fichier`, `git grep -iO`,
  `git ls-remote --upload=`, `uniq ENTREE SORTIE`, `sort {-o,f}`, `$'\x2do'`, `${!y}`,
  `printf -v`, `gh api -iXPOST`. Correction :
  - l'effacement des guillemets par regex est remplacé par une analyse de gauche à droite (perl),
    qui tient compte des guillemets ; si l'analyse échoue, la commande est refusée ;
  - refusés en plus : un mot commençant par `-` dont les guillemets ou l'échappement débutent
    avant le `=` (le nom de l'option serait masqué), les accolades, `$'…'`, `$[`, et tout `${…}`
    autre que `${NOM}` ;
  - les options sont vérifiées sur la liste des arguments : options groupées, et toute
    abréviation d'une option longue dangereuse ;
  - redirection : seuls `/dev/null` exact et `>&N` ou `>&-` sont admis ;
  - `uniq` accepte au plus un fichier, et `printf -v` est refusé.
  - seconde revue (commit `48ca21dfd`) : 3 contournements de plus, tous confirmés : un `#` hors
    guillemets (commentaire bash) qui masquait la ligne suivante, une valeur collée à une option
    courte (`sort -o/tmp/f`, `git grep -O/bin/sh`, `git ls-remote -u/x`), et `rg --hostname-bin`.
    Sont désormais refusés : un `#` en début de mot, les here-documents (`<<<` reste admis) ;
    une lettre d'option est repérée même suivie d'une valeur collée.
- Tests : 49 cas ajoutés à `scripts/test-claude-hooks.sh` (19, puis 30 issus des deux revues :
  contournements et lectures courantes). Les 161 cas de la section bash-guard passent. L'essai
  réel avec `claude -p` a été fait avant cette correction ; les cas `echo >` et `touch` restent
  dans les tests avec la même enveloppe. Le reste de la suite n'a pas été relancé : ses tests de surveillance
  (nodemon, tsc) attendent un `node_modules` local, absent du worktree.
- Limites :
  - la garde est lue depuis `/opt/automecanik/app` (chemin de `settings.json`), donc elle
    n'agit qu'une fois ce checkout à jour de `main` ;
  - si le script manque, le hook ne bloque pas (code ≠ 2) ;
  - un sous-agent renommé hors `mandat-*` sort de la garde.

## 4. Hooks et règles : format proposé, non inscrit (6.3)

Rien n'est inscrit. Le format proposé pour un tableau de plus dans le même registre :

```json
{ "kind": "hook", "event": "PreToolUse", "matcher": "Bash",
  "script": "scripts/claude-hooks/pretool-bash-guard.sh", "checksum": "sha256:…",
  "declared_in": ".claude/settings.json", "scope": "session" }
{ "kind": "rule", "name": "payments", "path": ".claude/rules/payments.md",
  "checksum": "sha256:…", "loaded_by": "CLAUDE.md", "department": "…" }
```

- Source des hooks : les blocs `hooks` de `.claude/settings.json` et des `settings.json` de
  workspace.
- Source des règles : `.claude/rules/*.md` et les règles de workspace.
- Doublon (même `event` + `matcher` + `script`) : erreur.

## 5. Fichiers réservés : patchs préparés, non appliqués (6.5)

- `.github/workflows/skills-canon-gate.yml` (réservé à l'owner) :
  `skills-canon-gate.patch` (sha256
  `a495dad01f5a0185d30fa4121f2e5f42e334ac3e26b5857a72ce6e24a788afc9`, `git apply --check`
  vert). Il ajoute les chemins `.claude/agents/**` et `workspaces/*/.claude/{skills,agents}/**`
  et lance `skills-registry-subagents.test.ts`. Tant qu'il n'est pas appliqué, la CI lance
  `--check` (le générateur et `.spec/00-canon/ai-registry/**` sont déjà des déclencheurs), mais
  pas ce nouveau test.
- `.spec/00-canon/repository-registry/ownership.yaml` (réservé à l'owner) :
  `ownership-snippet-2081.yaml` couvre `.claude/agents/**` et `audit/agents/**` (D15, `@ak125`).
  - Preuve : `classify()` de `check-new-files.js` sur `ownership.yaml` + l'extrait donne `ok`
    pour les 5 fichiers de la PR qui étaient `missing_both`.
  - Les autres fichiers neufs sont déjà couverts : `docs/audit/**`, ou exception `*.test.ts`.
  - Application par l'owner :
    `bash /home/deploy/resync/resync-pr.sh 2081 --ownership /home/deploy/resync/ownership-snippet-2081.yaml`,
    après copie de l'extrait à ce chemin. La copie n'a pas été faite : écrire hors du worktree
    sort du mandat.
  - Tant que ce n'est pas fait, `Block-new` reste rouge sur ces 5 fichiers.
- `skills.registry.json` et `skill.schema.json` (`.spec/00-canon/ai-registry/`) sont modifiés
  dans la PR, comme le mandat le demande : circuit élevé, approbation de Marwane.

## 6. Contreparties AI6 relues au journal (6.6)

- AI6 n'est ni au journal des principes ni dans `.spec/`. C'est une règle du Vault
  (`rules-ai-cos.md`), qui n'est plus normative (décision 72, règle de vigueur).
- Les trois sous-agents ne citent plus le Vault ni ADR-129 comme autorité.
- Leurs contreparties restent des propositions, sans source normative, et leur décision revient
  à l'owner :
  - `agents/ceo` ;
  - `agents/cto` ;
  - `workspaces/seo-batch/.claude/agents/conseil-batch.md`.
- `mandat-reception` cite la source AEC du monorepo
  (`.spec/00-canon/canon-distribution/rules-agent-exit-contract.md`, P30).
- `audit/agents/inventaire-2026-11-15.md` est un relevé daté : laissé tel quel, avec en tête un
  renvoi vers ce document.
- Écart signalé : P25 interdit d'ajouter un « registre d'agents » parmi les orchestrateurs
  maison. #2081 n'en crée pas : il étend l'inventaire généré existant, qui ne déclenche, ne
  route et n'autorise rien. Le jugement revient à l'owner.
- **Projet de ligne de journal** (non écrit au journal ; PR à part, approuvée par l'owner) :

  > **P(n).** Un agent ou sous-agent ajouté au dépôt est inscrit au registre généré
  > `skills.registry.json` avec son département. Son ajout dit quel agent existant il remplace
  > ou pourquoi il n'en remplace aucun ; un retrait se décide par l'owner. Source : décision 13 ;
  > mandat AB-2.

## 7. `audit/agents/agent-operating-map.patch` (6.7)

**Gardé comme patch préparé, non refait, à ne pas appliquer.** Raisons :

- il ne s'applique plus à `main` (`patch failed … :412`) ;
- ses `nodes[]` et `loads.agents` déclareraient une seconde fois les sous-agents que
  `subagents[]` porte désormais ;
- ses commentaires citent comme autorité des règles du Vault (AI1, AI5, AI6, ADR-129, ADR-135).

Le rattachement d'un sous-agent à son département passe par le champ `department` de son
frontmatter, que le registre relève et vérifie contre la carte.

## 8. Constats hors périmètre, listés seulement (6.8)

- **Sous-agents sans fiche, sur `main`** : 42 sur 42.
  - `main` porte 43 fichiers `.claude/agents/**/*.md` (marketing 3, seo-batch 40), dont un
    gabarit `_shared` sans `name`.
  - Aucun ne déclare de `department`, et `agent-operating-map.yaml` n'en liste aucun dans
    `loads.agents`.
  - Les 3 sous-agents de mandat de cette PR ne sont pas sur `main`.
- **Sous-agents qui lisent le RAG** (chemin ou appel RAG concret dans le prompt) : 21, tous dans
  seo-batch.
  - 5 sont neutralisés : `conseil-batch`, `r1-content-batch`, `r4-content-batch`,
    `r6-content-batch`, `r7-brand-rag-generator`.
  - Les 16 autres sont à examiner par le mandat BI (écart P11) : `agentic-critic`,
    `agentic-planner`, `agentic-solver`, `brief-enricher`, `research-agent`,
    `r1/r2/r3/r4/r5/r6/r7/r8-keyword-planner`, `r3-keyword-plan-batch`, `r3-image-prompt`,
    `r6-image-prompt`.
  - Ce sont des candidats, pas un verdict : on n'a pas vérifié s'ils produisent du contenu.
- **`agents/cto/AGENTS.md`** : 3 lignes (25 à 27) portent des adresses IPv4 (2 adresses
  distinctes, non recopiées ici), contre la règle « pas d'IP dans les instructions d'agents ».

## 9. Appliqué, testé, proposé

| État | Contenu |
|---|---|
| Appliqué (PR #2081, brouillon) | générateur étendu ; `$defs/subagent` ; registre régénéré ; garde lecture seule `mandat-*` ; 3 sous-agents mis à jour (garde, citations Vault retirées) ; test du générateur ; 19 cas de garde ; ce dossier |
| Testé | `--check` vert ; 22 tests (générateur 6 nouveaux + verrou 16) ; 161 cas bash-guard (dont 30 issus des revues de sécurité) ; Command Center `--check` et 23 tests ; essai réel de refus d'écriture |
| Proposé, non appliqué | `skills-canon-gate.patch` ; `ownership-snippet-2081.yaml` ; format hooks/règles ; ligne de journal ; contreparties ; constats §8 |
| Inconnu | effet en DEV tant que `/opt/automecanik/app` n'est pas à jour de `main` ; hook de frontmatter de sous-agent dans une version future de Claude Code |
