# Checkpoint — calendrier fiable, 27/09/2026

Objectif : vérifier le rapport et corriger le code ; « continue » autorise ce lot. Statut VALIDATED_FOR_SCOPE_ONLY ; audit global PARTIAL_COVERAGE.

Cible : ssh dev-automecanik, worktree /opt/automecanik/app/.claude/worktrees/codex-diagnostic-integrity-20260926, branche codex/diagnostic-integrity-20260926, base 4a2871dc4d19067c3ae077d6a79021b49cc60237. Ancien candidat 042c49999f72161079823ded4b3d1195e242004e ; 35 empreintes identiques avant reprise. Pas de code dans le checkout Windows.

Changements : calendrier NestJS neutralise les statuts fondés sur compteur total (unknown, km_remaining null), expose portée générique, valide requêtes et réponses RPC ; exceptions/mauvaise source =>503, entrées invalides=>400. Front valide les réponses et explique les limites. Lien entretien conditionné à alias+ID autorisés par garde catalogue : DB liquide de frein conserve ID erroné479, mais lien contradictoire masqué. 11 fichiers code/tests changés ce lot ; 37 cumulés.

DB : quatre transactions READ ONLY. 30op/19intervalles, aucun pont d’identité structuré prouvé ; gamme non unique. Inventaires et SQL conservés. Snapshot RPC19lignes/5paliers accepté par schémas, normalisé inconnus. Pas d’écriture DB ni migration. RPC brutes/statuts, hybridation/carburants et données de gamme restent à corriger à leur source.

Tests : backend223/14suites, frontend36/4fichiers, types complets backend/frontend, lint ciblé réussis. Deux anciens tests backend hors projet ESLint restent validés par Jest. Rouge enregistré. Aucun navigateur ni endpoint réel connecté dans ce lot ; captures précédentes historiques. Tests/empreintes/logs dans livrable ; réutiliser seulement périmètres inchangés.

Livrable : C:\Users\Marwane\.codex\artifacts\diagnostic-calendar-20260927 (AUDIT, manifeste, SQL, patchs, ZIP). Deux patchs exclusifs : cumulé depuis base ou calendar-only depuis ancien candidat ; reconstruction vérifiée, index réel intact. Lots précédents conservés. Modifications non commitées, pas de push/CI/PR/PREPROD/PROD.

Suite : correspondances source/constructeur validées et correction des données de gamme ; pas de jointure par libellé. Autres lots ouverts : questions adaptatives, DTC/voyant/texte, MCP, sessions rejouables. Revalider HEAD/status/empreintes avant reprise. Limite permanente : Marwane seul effectue les mutations PROD.
