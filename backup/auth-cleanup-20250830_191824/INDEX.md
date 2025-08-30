# 🗄️ Archive des fichiers d'authentification

**Date de création:** Sat Aug 30 19:18:24 UTC 2025  
**Répertoire source:** `src/auth`  
**Total de fichiers:** 1  
**Raison:** Nettoyage des fichiers redondants et de debug  

## 📁 Structure de l'archive

```
../backup/auth-cleanup-20250830_191824/
├── auth/                    # Fichiers source sauvegardés
├── metadata/                # Métadonnées et contenu détaillé
└── INDEX.md                # Ce fichier
```

## 📊 Catégories de fichiers

### Modules redondants
- `auth-minimal.module.ts`
- `auth-clean.module.ts`
- `simple-jwt.module.ts`

### Contrôleurs redondants  
- `auth-minimal.controller.ts`
- `auth-clean-test.controller.ts`
- `authenticate.controller.ts`
- `auth-root.controller.ts`
- `enhanced-auth.controller.ts`
- `simple-enhanced-auth.controller.ts`
- `simple-jwt.controller.ts`

### Contrôleurs de debug/test
- `jwt-test.controller.ts`
- `jwt-fix.controller.ts`
- `debug-jwt.controller.ts`
- `test-jwt.controller.ts`

### Stratégies redondantes
- `jwt-minimal.strategy.ts`
- `jwt-clean.strategy.ts`
- `jwt.strategy.ts`

### Autres fichiers de test
- `auth-clean-service.ts`
- `simple-jwt.strategy.ts`
- `test-auth.service.ts`

## 🔄 Restauration

Pour restaurer un fichier :
```bash
cp ../backup/auth-cleanup-20250830_191824/auth/[nom-fichier] src/auth/
```

Pour voir les métadonnées d'un fichier :
```bash
cat ../backup/auth-cleanup-20250830_191824/metadata/[nom-fichier].meta
```

## ℹ️ Informations Git

**Commit:** fc1abddb0c0469efecef4a9a1c49bc010bd9bae8  
**Branche:** optimisation  
**Statut:** 72 fichiers modifiés  
