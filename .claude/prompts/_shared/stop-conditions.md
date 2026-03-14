# STOP CONDITIONS

Bloquer immediatement si :

1. **Role ambigu** — le sujet chevauche 2+ roles sans dominante claire
2. **Evidence insuffisante** — les sources RAG/DB ne couvrent pas les sections critiques
3. **Contrat absent** — pas de page-contract actif pour ce role
4. **Section critique non alimentable** — une section obligatoire n'a aucune donnee source
5. **Glissement inter-role** — le contenu genere derive vers la promesse d'un autre role
6. **Collision legacy non resolue** — conflit entre labels legacy et canoniques non tranche
7. **Input minimal manquant** — un champ obligatoire du contrat est absent

## Comportement en cas de blocage

```json
{
  "status": "HOLD",
  "reason": "description du blocage",
  "missing": ["liste des elements manquants"],
  "action": "HOLD | REROUTE | ESCALATE"
}
```

Ne JAMAIS :
- Inventer du contenu pour compenser un manque
- Ignorer un signal de blocage
- Fusionner deux roles pour contourner une ambiguite
- Produire un contenu partiel sans le signaler
