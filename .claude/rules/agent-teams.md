# Agent Teams — Quand proposer

> **Regle** : Claude doit **suggerer** (jamais lancer automatiquement) un agent team quand il detecte un des patterns ci-dessous. Toujours attendre la validation explicite de l'utilisateur.
>
> Format de suggestion : *"Je recommande un agent team pour cette tache car [raison]. Composition proposee : [...]. Tu veux que je lance ?"*

## Criteres de declenchement (PROPOSER un team)

| Pattern detecte | Template suggere |
|----------------|-----------------|
| Refactor touchant **3+ modules** (backend + frontend + tests/types) | Couche technique |
| Code review de **PR avec 10+ fichiers** modifies | Review parallele |
| Debug avec **cause incertaine** (plusieurs hypotheses plausibles) | Debug concurrent |
| Nouvelle feature **cross-domain** (ex: paiement + commande + notification) | Domaine metier |
| Audit SEO / compliance **multi-aspects** | Review parallele |
| Migration DB + adaptation code + tests | Couche technique |

## Criteres d'exclusion (NE PAS proposer)

- Tache isolee dans 1-2 fichiers
- Bug evident avec cause connue
- Modifications sur les **memes fichiers** (conflits garantis)
- Taches sequentielles avec dependances entre etapes
- Simple ajout de feature dans un seul module

## Templates d'equipe

**Template 1 — Couche technique** (refactors, features multi-couches)
- Backend Agent : NestJS controllers/services/data-services
- Frontend Agent : Remix routes/components/hooks
- Quality Agent : tests, types partages, validation

**Template 2 — Review parallele** (PR reviews, audits)
- Security Agent : vulnerabilites, injection, auth, RLS
- Performance Agent : requetes N+1, cache, bundle size
- Business Agent : coherence metier, edge cases, UX

**Template 3 — Debug concurrent** (bugs complexes)
- Hypothesis A/B/C Agents : chacun teste une theorie differente
- Les agents doivent **challenger les theories des autres**
- Max 4 agents

**Template 4 — Domaine metier** (features cross-domain)
- Un agent par domaine impacte (Paiements, Catalogue, Vehicules, SEO, Admin, Support)
- Max 4 agents pour limiter le cout en tokens

## Regles de securite pour les teams

- Les agents respectent le workflow git : **jamais de push sur main** sans validation
- Les agents respectent l'Airlock : pas de modification de fichiers systeme (`scripts/`, `.github/`, `docker-compose`, etc.)
- Mode **delegate** recommande pour le lead (coordination seulement)
- Chaque agent travaille sur des **fichiers distincts** — verifier l'absence de conflits avant lancement
