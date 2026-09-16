# Orchestration — modèle de script Workflow

Au-delà de trois sondes, orchestrer avec l'outil **Workflow**. Le point qui compte : `pipeline()` et non
`parallel()` entre les deux étapes — chaque constat part en réfutation dès que **sa** sonde rend, sans
attendre les six autres. Sur un passage réel, la sonde la plus lente a mis quatre fois le temps de la plus
rapide : une barrière aurait gaspillé tout cet écart.

Lancer **en arrière-plan** et travailler pendant ce temps : sept sondes ont produit environ 75 agents.

```javascript
export const meta = {
  name: 'balayage-production',
  description: 'Balayage lecture seule, refutation adverse, synthese priorisee',
  phases: [
    { title: 'Sonder',   detail: 'sondes independantes, aveugles les unes aux autres' },
    { title: 'Verifier', detail: 'deux sceptiques a lentilles distinctes par constat' },
    { title: 'Synthese', detail: 'liste priorisee, avant/apres la fenetre' },
  ],
}

// Le contexte partage porte les faits que les sondes ne doivent pas redecouvrir,
// les regles absolues, les recettes d'acces, et surtout ce qui est DEJA connu :
// sans cette derniere ligne, trois sondes rapportent le meme defaut.
const CONTEXTE = [
  'Contexte : <monorepo, base, versions, evenement recent, fenetre a venir>.',
  'Defauts deja connus, ne pas les re-rapporter : <liste>.',
  '',
  'REGLES ABSOLUES : lecture seule stricte. Aucun INSERT/UPDATE/DELETE/DDL, aucune migration,',
  'aucun git commit/push, aucun deploiement.',
  '',
  '<recettes d acces — voir references/access.md>',
  '',
  'Chaque constat porte une preuve reproductible : la commande exacte et un extrait de sa sortie.',
  'Un constat sans preuve executee ne compte pas. Si tu ne trouves rien, rends une liste vide',
  'plutot que des hypotheses.',
].join('\n')

const CONSTATS = {
  type: 'object',
  properties: {
    findings: { type: 'array', items: { type: 'object', properties: {
      titre:       { type: 'string' },
      gravite:     { type: 'string', enum: ['haute', 'moyenne', 'basse'] },
      emplacement: { type: 'string', description: 'fichier:ligne, table, job ou URL' },
      preuve:      { type: 'string', description: 'commande executee + extrait de sortie' },
      impact:      { type: 'string', description: 'ce que ca casse, chiffre si possible' },
      correctif:   { type: 'string', description: 'cause racine, pas contournement' },
      moment:      { type: 'string', enum: ['avant_fenetre', 'apres_fenetre', 'indifferent'] },
    }, required: ['titre','gravite','emplacement','preuve','impact','correctif','moment'] } },
  },
  required: ['findings'],
}

const VERDICT = {
  type: 'object',
  properties: {
    reel:             { type: 'boolean' },
    raison:           { type: 'string' },
    gravite_corrigee: { type: 'string', enum: ['haute', 'moyenne', 'basse'] },
  },
  required: ['reel', 'raison', 'gravite_corrigee'],
}

phase('Sonder')
const resultats = await pipeline(
  SONDES,                                  // [{cle, mission}] — voir references/probes.md
  (s) => agent(`${CONTEXTE}\n\nTA MISSION (sonde ${s.cle}) :\n${s.mission}`,
               { label: `sonde:${s.cle}`, phase: 'Sonder', schema: CONSTATS }),
  (r, s) => {
    const constats = (r?.findings ?? []).slice(0, 6)   // plafond assume, et dit dans le rapport
    if (!constats.length) return []
    return parallel(constats.map((c) => () =>
      parallel([
        'exactitude technique : la preuve montre-t-elle vraiment ce que le constat affirme ?',
        'atteignabilite reelle : ce chemin est-il servi en production, ou est-ce du code mort ?',
      ].map((lentille) => () =>
        agent([CONTEXTE, '',
               `TA MISSION : refuter ce constat. Lentille imposee : ${lentille}`,
               'Par defaut, conclus reel=false si tu ne peux pas confirmer toi-meme avec une commande.',
               'Ne fais pas confiance au constat : re-execute.', '',
               JSON.stringify(c, null, 1)].join('\n'),
              { label: `refute:${s.cle}:${c.titre.slice(0, 28)}`, phase: 'Verifier', schema: VERDICT })
      )).then((votes) => {
        const valides = votes.filter(Boolean)
        return { sonde: s.cle, ...c,
                 confirme: valides.length > 0 && valides.some((v) => v.reel),
                 verdicts: valides.map((v) => ({ reel: v.reel, raison: v.raison })) }
      })
    ))
  },
)

const tous = resultats.flat().filter(Boolean)
const confirmes = tous.filter((f) => f.confirme)
log(`${tous.length} constats sondes, ${confirmes.length} survivent a la refutation`)

phase('Synthese')
const synthese = await agent([CONTEXTE, '',
  'TA MISSION : synthetiser pour la decision qui vient.',
  'Constats confirmes :', JSON.stringify(confirmes, null, 1),
  'Constats ecartes (ne pas les reintroduire sans raison) :',
  JSON.stringify(tous.filter((f) => !f.confirme).map((f) => ({ titre: f.titre, verdicts: f.verdicts })), null, 1),
  '', 'Trois sections : A FAIRE AVANT LA FENETRE / A VERIFIER APRES / PEUT ATTENDRE.',
  'Pas de recommandation sans preuve. Si une section est vide, dis-le franchement.',
].join('\n'), { label: 'synthese', phase: 'Synthese', effort: 'high' })

return { total: tous.length, confirmes: confirmes.length, constats: confirmes, synthese }
```

## Réglages qui comptent

- **`confirme` à une voix sur deux** garde les constats qu'un seul angle valide ; monter à l'unanimité
  écarte les défauts réels mal expliqués. Choisir selon ce qui coûte le plus cher : rater, ou re-vérifier.
- **Plafonner les constats par sonde** (`slice(0, 6)`) borne l'explosion — et se dit dans le rapport, sinon
  une troncature silencieuse se lit comme « on a tout couvert ».
- **Pas de `Date.now()` ni `Math.random()`** dans un script Workflow : ils empêchent la reprise. Dater après
  coup, varier par l'index.
- **Suivre l'avancement** : `journal.jsonl` du répertoire de transcription donne l'état réel, agent par
  agent, sans interrompre le travail en cours.
