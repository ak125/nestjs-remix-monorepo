# 🔒 Protection de l'Ordre du Catalogue

## 🎯 Problème Résolu

**Avant** : L'ordre du catalogue changeait de manière aléatoire à chaque modification du code.

**Maintenant** : L'ordre est **garanti** et **validé automatiquement** avant chaque commit.

---

## ✅ Solution Mise en Place

### 1️⃣ **Documentation Complète**
📄 [`CATALOGUE-ORDRE-GUIDE.md`](./CATALOGUE-ORDRE-GUIDE.md)

Guide détaillé expliquant :
- Le flux complet de l'ordre (BDD → Backend → Frontend)
- Les 3 règles d'or à respecter
- Les causes communes de désordre
- Checklist avant commit
- Procédure de diagnostic

### 2️⃣ **Script de Validation Automatique**
🔧 [`scripts/validate-catalog-order.sh`](./scripts/validate-catalog-order.sh)

Script qui vérifie automatiquement :
- ✅ Backend accessible
- ✅ API retourne les bonnes données
- ✅ `sort_order` présent sur toutes les familles
- ✅ `sort_order` est croissant (0, 1, 2, ...)
- ✅ Fichiers sources corrects (backend + frontend)
- ✅ Pas de tri manuel dans le frontend

**Utilisation :**
```bash
./scripts/validate-catalog-order.sh
```

### 3️⃣ **Hook Git Pre-Commit**
🪝 `.git/hooks/pre-commit`

Hook Git qui s'exécute automatiquement avant chaque commit pour :
- Détecter si des fichiers catalogue ont été modifiés
- Valider l'ordre avec le script ci-dessus
- **BLOQUER** le commit si l'ordre est incorrect

---

## 🚀 Utilisation

### Validation Manuelle
```bash
# 1. Démarrer le backend
cd backend && npm run dev

# 2. Dans un autre terminal, valider l'ordre
./scripts/validate-catalog-order.sh
```

### Commit avec Validation Automatique
```bash
git add .
git commit -m "feat: migration tokens"
# → Le hook pre-commit valide automatiquement l'ordre
# → Commit autorisé uniquement si validation OK
```

### Ignorer la Validation (NON RECOMMANDÉ)
```bash
git commit --no-verify -m "..."
# ⚠️  À utiliser UNIQUEMENT si le backend n'est pas disponible
```

---

## 📋 Checklist Développeur

Avant de modifier du code lié au catalogue :

- [ ] J'ai lu [`CATALOGUE-ORDRE-GUIDE.md`](./CATALOGUE-ORDRE-GUIDE.md)
- [ ] Je comprends les 3 règles d'or :
  - ✅ Tri **UNIQUEMENT** dans le backend
  - ✅ Préserver l'ordre partout ailleurs
  - ✅ Valider avant chaque commit
- [ ] Le backend est démarré (`npm run dev`)
- [ ] J'ai testé avec `./scripts/validate-catalog-order.sh`

---

## 🐛 Dépannage

### Problème : Le hook pre-commit ne s'exécute pas

**Solution :**
```bash
chmod +x .git/hooks/pre-commit
```

### Problème : Ordre incorrect après modification

**Solution rapide :**
```bash
# 1. Voir les différences avec main
git diff main..HEAD -- backend/src/modules/catalog/services/gamme-unified.service.ts
git diff main..HEAD -- frontend/app/services/api/hierarchy.api.ts

# 2. Restaurer depuis main si nécessaire
git checkout main -- backend/src/modules/catalog/services/gamme-unified.service.ts

# 3. Réappliquer seulement vos changements
```

### Problème : Validation échoue mais je ne vois pas l'erreur

**Diagnostic complet :**
```bash
# 1. Vérifier l'API directement
curl -s http://localhost:3000/api/catalog/gammes/hierarchy | \
  jq '.families[0:5] | .[] | {id, name, sort_order}'

# 2. Vérifier les fichiers sources
grep "order('mf_sort'" backend/src/modules/catalog/services/gamme-unified.service.ts
grep "mf_sort: family.sort_order" frontend/app/services/api/hierarchy.api.ts
```

---

## 📚 Fichiers Clés

| Fichier | Rôle |
|---------|------|
| `CATALOGUE-ORDRE-GUIDE.md` | Documentation complète |
| `scripts/validate-catalog-order.sh` | Script de validation |
| `.git/hooks/pre-commit` | Hook Git automatique |
| `backend/src/modules/catalog/services/gamme-unified.service.ts` | Tri backend |
| `backend/src/modules/catalog/types/gamme.types.ts` | Types avec `sort_order` |
| `frontend/app/services/api/hierarchy.api.ts` | Mapping API frontend |
| `frontend/app/routes/_index.tsx` | Affichage (pas de tri) |
| `frontend/app/hooks/useHomeData.ts` | State management (pas de tri) |

---

## 🎯 Résumé

**Avec cette solution, vous ne devriez PLUS JAMAIS avoir de problème d'ordre du catalogue.**

Si l'ordre change, c'est que :
1. Le hook pre-commit a été ignoré (`--no-verify`)
2. Les fichiers ont été modifiés sans commit
3. Une des 3 règles d'or a été violée

Dans tous les cas, le script de validation vous dira **exactement** ce qui ne va pas.

---

## 📞 Support

En cas de problème persistant :
1. Consultez [`CATALOGUE-ORDRE-GUIDE.md`](./CATALOGUE-ORDRE-GUIDE.md)
2. Exécutez `./scripts/validate-catalog-order.sh` pour un diagnostic
3. Comparez avec `main` : `git diff main..HEAD`

---

**Dernière mise à jour :** 10 novembre 2025
