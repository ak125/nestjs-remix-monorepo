# Vocabulaire interdit R1 — liste lue par v5-guardian

> Déplacée sans modification depuis `.claude/prompts/R1_ROUTER/editorial.md` §FORBIDDEN VOCABULARY
> (lignes 112-133 à `c70c4025fa`), le 2026-11-15, mandat AD. Ce prompt de génération a été retiré :
> il prenait le RAG gamme comme source de contenu, contrairement à ADR-046. Cette liste reste la
> source unique du check « vocabulaire cross-rôle R1 » de `../SKILL.md` ; ne pas la recopier ailleurs.

## FORBIDDEN VOCABULARY (anglicismes + cross-role)

### Anglicismes interdits (SEO FR strict)
Toute generation contenant un de ces termes est REJETEE :
- **Filtration** : spin-on, insert (en contexte filtre), multi-pass, anti-drain back, anti-drainback, drain-back
- **Moteur** : booster (contexte moteur), brake fluid, oil pan (utiliser carter d'huile)

### Jargon technique accepte (ne pas nettoyer)
Ces termes sont du vocabulaire auto FR standard utilise par les pros :
- **OEM, OES** — acronymes constructeur largement utilises
- **longlife** — norme d'huile VW/BMW (VW 502.00, BMW LL-01)
- **aftermarket** — marche de la rechange
- **by-pass** — terme technique (clapet by-pass, by-pass ralenti, vanne IAC, by-pass thermostat)
- **HDi, dCi, TDI, TSI, PureTech, EcoBoost** — codes motorisation constructeur
- Noms de marques (MANN-FILTER, BOSCH, PURFLUX, MAHLE, HENGST, etc.)

### Cross-role (pas toucher aux autres roles)
- demonter, remontage, couple de serrage, etape 1/2/3 (R3 how-to)
- tutoriel, pas-a-pas (R3)
- bruit anormal, symptome, panne (R5 diagnostic)
- definition, glossaire, encyclopedie, qu'est-ce que (R4 reference)
- comment choisir, guide d'achat, comparatif qualite (R6)
