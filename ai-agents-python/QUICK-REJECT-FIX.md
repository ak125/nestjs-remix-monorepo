# 🎉 Comment Gérer Decision = REJECT

Vous avez reçu cette décision :

```
📊 DÉCISION
   Risk: 100/100
   Confidence: 70/100
   Action: REJECT
```

## 🤔 Que Signifie REJECT ?

- ✅ **Qualité OK** : Confidence = 70/100 (gates validées)
- ⚠️ **Trop de changements** : 137 fichiers modifiés simultanément
- 🛡️ **Principe de prudence** : Éviter gros commits risqués

**Le système a déjà appliqué les corrections** mais ne les commite pas automatiquement.

---

## ✅ Solution Recommandée : Mode Incrémental

Divisez en petits lots de 15-20 fichiers pour réduire le risque :

```bash
cd ai-agents-python
python run_incremental.py --batch-size 20 --max-risk 40
```

### 📊 Résultat Attendu

```
📦 LOT 1/7 (20 fichiers)
   Risk: 22/100       # ✅ < 40
   Confidence: 85/100
   Action: AUTO_COMMIT
   ✅ LOT ACCEPTÉ
   💾 Committed: "fix: Lot 1/7 - 20 corrections"

📦 LOT 2/7 (20 fichiers)
   Risk: 25/100
   Confidence: 82/100
   Action: AUTO_COMMIT
   ✅ LOT ACCEPTÉ
   💾 Committed: "fix: Lot 2/7 - 20 corrections"

...

✅ TERMINÉ: 137/137 fichiers corrigés en 7 commits
```

### ⏱️ Durée Estimée

- **7 lots** × 18s/lot = ~2 minutes
- **7 commits atomiques** faciles à revert
- **Risk par lot** : ~20-25/100 → AUTO_COMMIT

---

## 🎨 Autres Options

### Option 2 : Mode Interactif (Contrôle Total)

```bash
python run_review.py
```

Vous validerez chaque étape :
1. ❓ Findings détectés → "Continuer ?"
2. ❓ Corrections proposées → "Appliquer ?"
3. ❓ Résultat → "Créer commit ?"

### Option 3 : Format Ciblé (Simple)

```bash
python format_massive_files.py --batch-size 30
```

Formatte uniquement les 137 fichiers massifs détectés, par lots de 30.

### Option 4 : Manuel

```bash
# 1. Vérifier changements
git diff --stat

# 2. Si OK, commit
git add -A
git commit -m "style: Auto-format 137 files"

# 3. Tester
npm run build && npm run test
```

---

## 📚 Documentation Complète

Voir **REJECT-GUIDE.md** pour :
- Comprendre le calcul de Risk
- Ajuster les seuils de décision
- Troubleshooting
- Cas d'usage avancés

---

## 🚀 Recommandation Finale

**Pour votre cas (137 fichiers lint/format)** :

```bash
# ✅ MEILLEURE APPROCHE
cd ai-agents-python
python run_incremental.py --batch-size 20

# Durée: ~2min
# Résultat: 7 commits atomiques
# Risk par lot: ~20-25/100 → AUTO_COMMIT
```

**Si vous êtes pressé et confiant** :

```bash
# Commit manuel (après vérification)
git add -A
git commit -m "style: Auto-format 137 files (lint/format)"
git push
```

---

## 💡 Astuce Future

Une fois les **gates M5 et M6** ajoutés :
- Confidence passera à **90+**
- Même avec 137 fichiers → **REVIEW_REQUIRED** (au lieu de REJECT)
- Moins de friction pour corrections sûres

---

**Besoin d'aide ?** Relisez **REJECT-GUIDE.md** 📖
