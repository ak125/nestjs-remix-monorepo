# 🧪 Scripts de Test - Guide Complet

Ce dossier contient tous les scripts de test du projet.

## 📊 Validation Complète

```bash
# Valider TOUS les scripts du projet
./scripts/validate-all-scripts.sh

# Résultat: 55/55 scripts valides ✅
```

## 🧪 Tests Disponibles

### Breadcrumb (Fil d'Ariane)

```bash
# Test simple
./scripts/testing/test-breadcrumb-simple.sh

# Test avec curl
./scripts/testing/test-breadcrumb-curl.sh

# Test dynamique complet
./scripts/testing/test-breadcrumb-dynamic.sh

# Validation du breadcrumb
./scripts/testing/validate-breadcrumb.sh

# Validation cohérence URLs
./scripts/testing/validate-url-breadcrumb-coherence.sh
```

### Paiement (Paybox)

```bash
# Test basique Paybox
./scripts/testing/test-paybox.sh

# Test E2E complet
./scripts/testing/test-paybox-e2e.sh

# Test final (production-ready)
./scripts/testing/test-paybox-final.sh

# Test API de paiement
./scripts/testing/test-payment-api.sh
```

### Général (Curl & Cookies)

```bash
# Test curl rapide
./scripts/testing/test-curl-quick.sh

# Test curl final
./scripts/testing/test-curl-final.sh

# Test cookies
./scripts/testing/test-cookie-quick.sh
```

### URLs & Alignement

```bash
# Vérifier alignement des URLs
python3 ./scripts/testing/verify-url-alignment.py
```

## 📋 Scripts de Validation

Tous les scripts ont été validés :
- ✅ **44 scripts Shell** - Syntaxe correcte
- ✅ **11 scripts Python** - Syntaxe correcte
- ✅ **Permissions** - Tous exécutables

## 🔧 Utilisation

### Tests Breadcrumb

```bash
# Test rapide (2-3 secondes)
cd /workspaces/nestjs-remix-monorepo
./scripts/testing/test-breadcrumb-simple.sh

# Test complet (30 secondes)
./scripts/testing/test-breadcrumb-dynamic.sh
```

**URLs testées** :
- `/pieces-auto/renault/clio`
- `/pieces-auto/peugeot/308`
- Pages dynamiques avec paramètres

### Tests Paybox

```bash
# Test local (mode développement)
./scripts/testing/test-paybox.sh

# Test E2E (nécessite backend actif)
./scripts/testing/test-paybox-e2e.sh
```

**Prérequis** :
- Backend actif sur port 3001
- Variables d'environnement Paybox configurées

## 📊 Résultats des Tests

### Format de Sortie

```
✅ Test réussi - Description
❌ Test échoué - Raison
⚠️  Test warning - Attention requise
```

### Codes de Retour

- `0` - Tous les tests réussis
- `1` - Au moins un test échoué
- `2` - Erreur de configuration

## 🚀 Tests Automatisés (CI/CD)

Pour intégrer dans CI/CD :

```yaml
# .github/workflows/test.yml
- name: Validate Scripts
  run: ./scripts/validate-all-scripts.sh

- name: Test Breadcrumb
  run: ./scripts/testing/test-breadcrumb-simple.sh

- name: Test Payment API
  run: ./scripts/testing/test-payment-api.sh
```

## 🔍 Debugging

### Activer le mode verbose

```bash
# Pour les scripts shell
bash -x ./scripts/testing/test-breadcrumb-simple.sh

# Pour les scripts Python
python3 -v ./scripts/testing/verify-url-alignment.py
```

### Logs

Les logs de test sont généralement affichés dans stdout/stderr.
Pour capturer :

```bash
./scripts/testing/test-paybox-e2e.sh 2>&1 | tee test-results.log
```

## 📝 Créer un Nouveau Test

### Template Script Shell

```bash
#!/bin/bash
# test-mon-feature.sh - Description du test

set -e  # Arrêter sur erreur

echo "🧪 Test: Mon Feature"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test 1
if [ condition ]; then
    echo "✅ Test 1 - Réussi"
else
    echo "❌ Test 1 - Échoué"
    exit 1
fi

echo ""
echo "✅ Tous les tests réussis !"
```

### Template Script Python

```python
#!/usr/bin/env python3
# test-mon-feature.py - Description du test

import sys

def test_feature():
    """Test principal"""
    try:
        # Votre test ici
        assert True, "Test échoué"
        print("✅ Test réussi")
        return True
    except Exception as e:
        print(f"❌ Test échoué: {e}")
        return False

if __name__ == "__main__":
    success = test_feature()
    sys.exit(0 if success else 1)
```

## 🔒 Tests de Sécurité

⚠️ **Ne jamais commiter** :
- Tokens d'API réels
- Credentials de production
- Données sensibles dans les logs

Utilisez des variables d'environnement :
```bash
export PAYBOX_API_KEY="test_key"
./scripts/testing/test-paybox.sh
```

## 📚 Documentation

- Tous les tests sont documentés en tête de fichier
- Voir `docs/testing/` pour la documentation complète
- Consulter `CLEANUP-REPORT.md` pour l'organisation

## ✅ Checklist Avant Commit

- [ ] Valider syntaxe : `./scripts/validate-all-scripts.sh`
- [ ] Tests breadcrumb : `./scripts/testing/test-breadcrumb-simple.sh`
- [ ] Tests paiement (si modifié) : `./scripts/testing/test-paybox.sh`
- [ ] Permissions OK : `chmod +x` si nouveau script
- [ ] Documentation mise à jour

---

**Dernière validation** : 2 novembre 2025  
**Scripts validés** : 55/55 ✅  
**Status** : Production Ready 🚀
