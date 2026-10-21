# Vérifier l'existant avant de créer

Chercher les équivalents et consommateurs dans le périmètre concerné, puis étendre
l'existant. Une absence de résultat n'est concluante que si la recherche couvre
les chemins pertinents ; élargir seulement si un doute demeure.

| Proposition | Sources à vérifier |
|---|---|
| Variable de configuration | `process.env` / `configService.get` dans les modules concernés et contrat d'environnement ; ne pas afficher les valeurs des fichiers `.env` |
| Domaine ou URL | `backend/src/config/site.constants.ts` et consommateurs ; conserver les URL historiques |
| Table | Migrations et types de DB du dépôt ; aucune migration implicite |
| Service NestJS | Services et imports des modules concernés |
| Skill | Descriptions sous `.claude/skills/` et celles du workspace concerné |

Utiliser `rg`/Grep ou un filtre du registry selon la question. Aucun nombre fixe
de recherches ni parcours intégral du dépôt n'est requis pour une modification simple.
Les incidents de conventions inventées motivent cette vérification, pas une nouvelle
source de vérité.
