# Tests CURL

## Utilisation rapide

```bash
# Tests simples
./test-users-simple.sh

# Tests complets
./test-users-api.sh
```

## Résultats actuels

✅ Register fonctionne  
❌ Login retourne 404  
✅ Performance: 5ms/requête  

## Correction login

Vérifier l'endpoint `/auth/login` dans `auth.controller.ts`
