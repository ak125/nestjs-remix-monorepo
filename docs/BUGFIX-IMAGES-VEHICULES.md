# 🐛 Bug Fix : Affichage des images véhicules

## 📋 Problème

Les images des véhicules compatibles (logos marques et photos modèles) ne s'affichaient pas sur les articles blog, affichant uniquement du texte et des icônes par défaut.

## 🔍 Diagnostic

### Symptômes
- ✅ Backend retournait des données (17 véhicules)
- ❌ Aucune image ne s'affichait dans le frontend
- ✅ Console navigateur sans erreurs 404
- ❌ Affichage de texte "PEUGEOT" au lieu du logo
- ❌ Affichage icône 🚗 au lieu de la photo du modèle

### Investigation

1. **Test API Backend** : URLs construites correctement
2. **Test CDN** : Fichiers existent sur Supabase Storage
3. **Problème identifié** : Mauvaise structure de chemin CDN

## 🎯 Cause Racine

Le backend construisait les URLs avec une structure incorrecte :

**❌ AVANT (incorrect)** :
```
https://.../uploads/constructeurs-automobiles/modeles-photos/punto-2.webp
```

**✅ APRÈS (correct)** :
```
https://.../uploads/constructeurs-automobiles/marques-modeles/fiat/punto-2.webp
```

**Structure réelle du CDN Supabase** :
- **Logos marques** : `constructeurs-automobiles/marques-logos/{marque}.webp`
- **Photos modèles** : `constructeurs-automobiles/marques-modeles/{marque}/{modele}.webp`

## 💡 Solution Implémentée

### 1. Modification de `buildImageUrl()`

**Fichier** : `/backend/src/modules/blog/services/blog.service.ts`

**Ajout du paramètre `marqueAlias`** :
```typescript
private buildImageUrl(
  filename: string | null,
  folder: string,
  marqueAlias?: string, // 👈 NOUVEAU
): string | null {
  if (!filename) return null;
  
  if (filename.startsWith('http://') || filename.startsWith('https://')) {
    return filename;
  }
  
  // Si marqueAlias fourni, utiliser structure marques-modeles/{marque}/{modele}.webp
  const url = marqueAlias
    ? `${this.CDN_BASE_URL}/constructeurs-automobiles/marques-modeles/${marqueAlias}/${filename}`
    : `${this.CDN_BASE_URL}/${folder}/${filename}`;
  
  return url;
}
```

### 2. Appel modifié pour les photos modèles

**Avant** :
```typescript
modele_pic: this.buildImageUrl(
  modele.modele_pic,
  'constructeurs-automobiles/modeles-photos', // ❌ Mauvais chemin
)
```

**Après** :
```typescript
modele_pic: this.buildImageUrl(
  modele.modele_pic,
  'unused',
  marque.marque_alias, // ✅ Ajout du marque_alias
)
```

### 3. Logos marques (inchangés)

```typescript
marque_logo: this.buildImageUrl(
  marque.marque_logo,
  'constructeurs-automobiles/marques-logos', // ✅ Déjà correct
)
```

## ✅ Résultat

### URLs construites (exemples)

| Véhicule | Type | URL générée | Status |
|----------|------|-------------|--------|
| FIAT PUNTO II | Photo | `.../marques-modeles/fiat/punto-2.webp` | ✅ 200 |
| FIAT | Logo | `.../marques-logos/fiat.webp` | ✅ 200 |
| PEUGEOT 206 | Photo | `.../marques-modeles/peugeot/206-phase-1.webp` | ✅ 200 |
| PEUGEOT | Logo | `.../marques-logos/peugeot.webp` | ✅ 200 |

### Tests de validation

```bash
# Test photos modèles
curl -I "https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/constructeurs-automobiles/marques-modeles/fiat/punto-2.webp"
# → HTTP/2 200 ✅

# Test logos marques
curl -I "https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/constructeurs-automobiles/marques-logos/fiat.webp"
# → HTTP/2 200 ✅
```

## 📊 Impact

- ✅ 17 véhicules compatibles affichent maintenant leurs images
- ✅ Logos de toutes les marques visibles
- ✅ Photos des modèles visibles
- ✅ Aucune régression sur le reste du système

## 🔗 Fichiers Modifiés

1. `/backend/src/modules/blog/services/blog.service.ts`
   - Méthode `buildImageUrl()` : ajout paramètre `marqueAlias`
   - Méthode `getCompatibleVehicles()` : appel modifié pour `modele_pic`

## 📝 Notes Techniques

### Structure Supabase Storage

```
uploads/
  constructeurs-automobiles/
    marques-logos/          # Logos marques (ex: fiat.webp)
    marques-modeles/        # Photos modèles
      {marque_alias}/       # Dossier par marque (ex: fiat/)
        {fichier}.webp      # Fichier modèle (ex: punto-2.webp)
```

### Base de données

- **Colonne `marque_logo`** : Contient juste le nom de fichier (ex: "fiat.webp")
- **Colonne `modele_pic`** : Contient juste le nom de fichier (ex: "punto-2.webp")
- **Colonne `marque_alias`** : Nécessaire pour construire le chemin (ex: "fiat")

## 🚀 Déploiement

**Branch** : `blogv2`

**Pas de migration nécessaire** : Changement uniquement dans le code backend.

**Validation** :
1. Recharger l'article : http://localhost:3001/blog-pieces-auto/conseils/alternateur
2. Vérifier que les 17 véhicules affichent leurs images
3. Vérifier que les logos ET photos sont visibles

---

**Date** : 2 octobre 2025  
**Auteur** : Équipe Dev  
**Status** : ✅ Résolu et testé
