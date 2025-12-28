# 🚨 Que Faire Quand Decision = REJECT ?

Quand le système retourne **REJECT**, c'est un signal de prudence. Voici vos options :

## 📊 Comprendre le REJECT

```bash
Risk: 100/100         # ⚠️ Trop de changements simultanés
Confidence: 70/100    # ✅ Qualité OK mais volume élevé
Action: REJECT        # 🛑 Ne pas auto-commit
```

**Pourquoi REJECT ?**
- **Risk 100/100** : 137 fichiers modifiés d'un coup
- **Surface trop large** : Même si changements sûrs (lint/format), c'est risqué
- **Principe de prudence** : Petits commits > gros commits

## 🎯 Solutions

### Option 1️⃣ : Mode Incrémental (Recommandé)

Diviser en petits lots de 10-20 fichiers :

```bash
cd ai-agents-python
python run_incremental.py --batch-size 10
```

**Avantages** :
- ✅ Chaque lot : Risk ~15-20/100 → AUTO_COMMIT
- ✅ Commits atomiques et traçables
- ✅ Facile à revert si problème

**Exemple de sortie** :
```
📦 LOT 1/14 (10 finding(s))
   Risk: 18/100
   Confidence: 85/100
   Action: AUTO_COMMIT
   ✅ LOT ACCEPTÉ
   💾 Committed: "fix: Lot 1/14 - 10 corrections"

📦 LOT 2/14 (10 finding(s))
   Risk: 20/100
   ...
```

---

### Option 2️⃣ : Mode Review Interactif

Valider manuellement avant commit :

```bash
cd ai-agents-python
python run_review.py
```

**Workflow** :
1. 🔍 Analyse → affiche findings
2. ❓ Demande confirmation : "Continuer ?"
3. 🔧 Simule corrections (dry-run)
4. ❓ Demande : "Appliquer ?"
5. ✅ Applique corrections
6. 📊 Affiche Risk/Confidence
7. ❓ Demande : "Créer commit ?"

**Avantages** :
- ✅ Contrôle total
- ✅ Validation humaine avant commit
- ✅ Bon pour premiers runs

---

### Option 3️⃣ : Commit Manuel Prudent

Le système a déjà appliqué les corrections. Vous pouvez :

```bash
# 1. Vérifier les changements
git diff

# 2. Vérifier que tout compile/run
npm run build
npm run test

# 3. Commit si tout OK
git add -A
git commit -m "fix: Lint/format corrections (137 files)"

# OU annuler si problème
git reset --hard HEAD
```

**Avantages** :
- ✅ Flexibilité totale
- ✅ Tests manuels possibles
- ❌ Pas d'automatisation

---

### Option 4️⃣ : Ajuster Seuils de Risk

Si vous êtes **confiant** que les changements sont sûrs (lint/format seulement), ajustez config :

```yaml
# config.yaml
decision:
  auto_commit_if:
    max_risk: 50        # Était: 30 → augmenter à 50
    min_confidence: 90  # OK
  
  review_if:
    max_risk: 80        # Était: 60 → augmenter à 80
    min_confidence: 85  # OK
```

**Ensuite relancer** :
```bash
python run.py
# Nouveau résultat probable:
# Risk: 100/100 → encore REJECT :(
```

⚠️ **Attention** : Avec Risk=100, même avec seuils ajustés, ça restera REJECT. Cette option fonctionne pour Risk 40-60.

---

## 🎓 Comprendre le Risk Score

### Formule Risk (F15)

```python
Risk = (
    0.40 × Surface       # Nombre fichiers × lignes modifiées
  + 0.30 × Criticality   # Fichiers critiques (auth, payment)
  + 0.20 × Bug History   # Bugs récents dans ces fichiers
  + 0.10 × Instability   # Commits fréquents = instable
)
```

### Pourquoi Risk = 100 ?

```python
Surface = 137 fichiers × 5 lignes/fichier = 685 lignes
Surface Score = min(100, 685 / 10) = 68/100

Risk = 0.40 × 68 + ... ≈ 100/100  # Dépassement
```

### Comment Réduire Risk ?

1. **Réduire Surface** : Lots de 10 fichiers → Surface=5 → Risk≈20
2. **Éviter fichiers critiques** : Skip auth/, payment/, migrations/
3. **Améliorer Git History** : Commits réguliers = moins instable

---

## 📋 Recommandation Finale

**Pour votre cas (137 fichiers lint/format)** :

```bash
# ✅ MEILLEURE APPROCHE
python run_incremental.py --batch-size 15 --max-risk 30

# Résultat attendu:
# - 9-10 lots
# - Chaque lot: Risk ~20-25/100 → AUTO_COMMIT
# - 9-10 commits atomiques
# - Durée: ~3min (18s × 10 lots)
```

**Si vous préférez manuel** :

```bash
# Vérifier changements
git diff --stat

# Si OK (juste lint/format)
git add -A
git commit -m "style: Auto-format 137 files (black, prettier)"

# Tester
npm run build && npm run test
```

---

## 🔮 Cas Futurs

Une fois les **gates M5 (budgets) et M6 (graph)** ajoutés :

- **Confidence** passera de 70 → **90+**
- **Seuil REVIEW_REQUIRED** sera atteint plus facilement
- **Moins de REJECT** pour corrections sûres

**Prochaine version** :
```
Risk: 100/100
Confidence: 95/100  # ← Grâce aux gates
Action: REVIEW_REQUIRED  # ← Au lieu de REJECT
```

---

## 📞 Aide

- **run_incremental.py** : `python run_incremental.py --help`
- **run_review.py** : Mode interactif (pas d'args)
- **Documentation** : Voir `README.md`

**En cas de doute** : Utilisez `run_review.py` pour validation humaine ! 🧑‍💻
