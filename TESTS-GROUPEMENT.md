# 🧪 Plan de tests - Groupement Avant/Arrière

## 📋 Tests à effectuer

### Test 1 : Vérification du groupement de base
**Objectif** : Confirmer que les groupes Avant/Arrière apparaissent

**Commande** :
```bash
curl -s http://localhost:3000/api/catalog/batch-loader \
  -X POST -H "Content-Type: application/json" \
  -d '{"typeId":18376,"gammeId":402,"marqueId":22,"modeleId":22040}' \
  | jq '.grouped_pieces[] | "\(.title_h2): \(.pieces | length) pièces"'
```

**Résultat attendu** :
```
Plaquettes de frein Avant: X pièces (X > 0)
Plaquettes de frein Arrière: Y pièces (Y > 0)
Plaquettes de frein: Z pièces (Z < 44 si détection améliorée)
Accessoires de plaquette: 8 pièces
```

**Critères de succès** :
- ✅ Au moins 1 groupe "Avant" existe
- ✅ Au moins 1 groupe "Arrière" existe
- ✅ Nombre de pièces sans position a diminué (était 44)

---

### Test 2 : Analyse d'une pièce avec position détectée
**Objectif** : Vérifier la source de détection (critère ou piece_name)

**Commande** :
```bash
curl -s http://localhost:3000/api/catalog/batch-loader \
  -X POST -H "Content-Type: application/json" \
  -d '{"typeId":18376,"gammeId":402,"marqueId":22,"modeleId":22040}' \
  | jq '.grouped_pieces[] | select(.title_h2 | contains("Avant")) | .pieces[0] | {id, nom, criterias: (.criterias_techniques | length)}'
```

**Résultat attendu** :
```json
{
  "id": 123456,
  "nom": "Jeu de 4 plaquettes de frein [avec mot-clé position]",
  "criterias": > 0
}
```

**Critères de succès** :
- ✅ Le nom ou un critère contient "avant", "arrière", etc.
- ✅ Au moins 1 critère est chargé (criterias > 0)

---

### Test 3 : Analyse des pièces sans position
**Objectif** : Identifier pourquoi certaines pièces n'ont pas de position

**Commande** :
```bash
bash test-piece-details.sh
```

**Résultat attendu** :
- Liste des critères de 3 pièces sans position
- Identification si critères manquants ou sans mots-clés

**Critères de succès** :
- ✅ Script s'exécute sans erreur
- ✅ Affiche les critères de chaque pièce
- ✅ Indique si position trouvée ou non

---

### Test 4 : Vérification du tri
**Objectif** : Confirmer que les pièces Avant sont avant les Arrière

**Commande** :
```bash
curl -s http://localhost:3000/api/catalog/batch-loader \
  -X POST -H "Content-Type: application/json" \
  -d '{"typeId":18376,"gammeId":402,"marqueId":22,"modeleId":22040}' \
  | jq '.grouped_pieces | map(.title_h2)'
```

**Résultat attendu** :
```json
[
  "Plaquettes de frein Avant",
  "Plaquettes de frein Arrière",
  "Plaquettes de frein",
  "Accessoires de plaquette"
]
```

**Critères de succès** :
- ✅ Groupes avec position AVANT les groupes sans position
- ✅ "Avant" avant "Arrière"
- ✅ "Accessoires" en dernier

---

### Test 5 : Performance
**Objectif** : Vérifier que la détection n'impacte pas les performances

**Commande** :
```bash
time curl -s http://localhost:3000/api/catalog/batch-loader \
  -X POST -H "Content-Type: application/json" \
  -d '{"typeId":18376,"gammeId":402,"marqueId":22,"modeleId":22040}' \
  | jq '.duration'
```

**Résultat attendu** :
```
"<500ms"
real    0m0.5s
```

**Critères de succès** :
- ✅ Réponse < 1 seconde
- ✅ Duration backend < 500ms

---

### Test 6 : Autre véhicule/gamme
**Objectif** : Confirmer que la solution fonctionne sur d'autres cas

**Commande** :
```bash
# Remplacer typeId, gammeId par un autre véhicule
curl -s http://localhost:3000/api/catalog/batch-loader \
  -X POST -H "Content-Type: application/json" \
  -d '{"typeId":<autre_type>,"gammeId":402,"marqueId":<autre_marque>,"modeleId":<autre_modele>}' \
  | jq '.grouped_pieces[] | .title_h2'
```

**Critères de succès** :
- ✅ Groupement fonctionne aussi sur d'autres véhicules
- ✅ Pas de régression

---

## 🔍 Analyse approfondie (si nécessaire)

### Script d'analyse des 44 pièces restantes

**Commande** :
```bash
cd /workspaces/nestjs-remix-monorepo
node migrations/analyze-missing-positions.js
```

**Ce qu'il fait** :
1. Charge les 100 premières pièces plaquettes du véhicule de test
2. Identifie lesquelles ont le critère `pc_cri_id = 100`
3. Analyse les critères des pièces SANS position
4. Cherche d'autres critères contenant des mots-clés de position
5. Affiche des statistiques détaillées

**Résultat attendu** :
```
📊 Total pièces: 65
✅ Pièces AVEC critère Côté d'assemblage (100): 13
❌ Pièces SANS critère 100: 52

📋 Analyse des 10 premières pièces sans position...

🔧 Pièce ID: 433145
  📌 2 critères:
     ✅   [206] Largeur: "17" mm
     ✅   [100] Côté d'assemblage: "Essieu avant" 🎯

🔎 Recherche de critères alternatifs...
✅ Critères alternatifs trouvés:
  🎯 [XXX] Nom du critère (Y occurrences)
     Valeurs: avant, arrière, ...
```

---

## 📊 Métriques de succès globales

### Avant optimisation
- 0 groupe avec position
- 100% des pièces mélangées

### Objectif minimal
- ✅ 2 groupes avec position (Avant + Arrière)
- ✅ > 20% des pièces avec position détectée

### Objectif optimal
- ✅ > 50% des pièces avec position détectée
- ✅ < 10 pièces réellement sans position
- ✅ Temps de réponse < 500ms

---

## 🐛 Problèmes connus à surveiller

### Problème 1 : Critères non chargés
**Symptôme** : `criterias_techniques` est un tableau vide `[]`

**Diagnostic** :
```bash
# Vérifier dans les logs backend
grep "DEBUG-CRITERES" logs/*.log
```

**Solution** : Vérifier que `validPieceIdsStr` est utilisé (string[] pas number[])

---

### Problème 2 : Détection ne fonctionne pas
**Symptôme** : Toujours 44 pièces sans position après les modifications

**Diagnostic** :
```bash
# Vérifier les logs de détection
grep "DETECTION" logs/*.log

# Ou regarder directement le nom des pièces
curl -s http://localhost:3000/api/catalog/batch-loader \
  -X POST -H "Content-Type: application/json" \
  -d '{"typeId":18376,"gammeId":402}' \
  | jq '.grouped_pieces[] | select(.title_h2 == "Plaquettes de frein") | .pieces[0:3] | .[] | .nom'
```

**Solution** : Vérifier que les noms contiennent bien "avant" ou "arrière"

---

### Problème 3 : Mauvais groupement
**Symptôme** : Des pièces "Avant" dans le groupe "Arrière"

**Diagnostic** :
```bash
# Vérifier la logique de détection
curl -s http://localhost:3000/api/catalog/batch-loader \
  -X POST -H "Content-Type: application/json" \
  -d '{"typeId":18376,"gammeId":402}' \
  | jq '.grouped_pieces[] | select(.title_h2 | contains("Avant")) | .pieces[] | select(.nom | contains("arrière"))'
```

**Solution** : Améliorer la regex de détection (priorité "essieu avant" > "avant")

---

## ✅ Checklist finale

Avant de valider la feature :

- [ ] Test 1 : Groupement visible (Avant + Arrière)
- [ ] Test 2 : Source de détection identifiée (critère ou nom)
- [ ] Test 3 : Analyse des pièces sans position effectuée
- [ ] Test 4 : Tri correct (Avant → Arrière → Sans position → Accessoires)
- [ ] Test 5 : Performance acceptable (< 1s)
- [ ] Test 6 : Fonctionne sur un autre véhicule
- [ ] Logs de détection présents dans la console
- [ ] Documentation SOLUTION-GROUPEMENT-POSITIONS.md à jour

---

## 🚀 Validation production

Une fois les tests OK en développement :

1. **Merge vers main** (après code review)
2. **Déploiement staging** avec monitoring
3. **Tests sur 5-10 véhicules différents**
4. **Monitoring performance** (temps de réponse, erreurs)
5. **Déploiement production** si OK

---

**Date** : 2025-11-24  
**Version** : 1.0  
**Statut** : 🧪 En test
