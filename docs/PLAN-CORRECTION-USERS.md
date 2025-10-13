# 🔧 PLAN DE CORRECTION DU MODULE USERS

**Date**: 2025-01-17  
**Référence**: [ANALYSE-MODULE-USERS-COMPLET.md](./ANALYSE-MODULE-USERS-COMPLET.md)  
**Objectif**: Ajouter les 9 champs manquants et corriger les incohérences

---

## 📋 CHAMPS À AJOUTER

### Dans PHP (`myspace.account.index.php`) mais absents du frontend TypeScript :

| # | Nom PHP | Nom Supabase | Type | Présent Backend | Présent Frontend |
|---|---------|--------------|------|----------------|------------------|
| 1 | `CST_CIVITILY` | `cst_civility` | string | ✅ LegacyUserService | ❌ |
| 2 | `CST_ADDRESS` | `cst_address` | string | ✅ LegacyUserService | ❌ |
| 3 | `CST_ZIP_CODE` | `cst_zip_code` | string | ✅ LegacyUserService | ❌ |
| 4 | `CST_COUNTRY` | `cst_country` | string | ✅ LegacyUserService | ❌ |
| 5 | `CST_TEL` | `cst_tel` | string | ✅ LegacyUserService | ⚠️ Mélangé avec GSM |
| 6 | `CST_GSM` | `cst_gsm` | string | ✅ LegacyUserService | ⚠️ Mélangé avec TEL |
| 7 | `CST_RS` | `cst_rs` | string | ✅ LegacyUserService | ❌ |
| 8 | `CST_SIRET` | `cst_siret` | string | ✅ LegacyUserService | ❌ |
| 9 | - | - | - | - | - |

**Note** : La civilité a une TYPO dans la base de données : `CST_CIVITILY` au lieu de `CST_CIVILITY`

---

## 🎯 STRATÉGIE DE CORRECTION

### Option 1 : Migration Progressive (RECOMMANDÉE ✅)

**Avantages** :
- ✅ Pas de régression
- ✅ Tests progressifs
- ✅ Rollback facile

**Étapes** :
1. Ajouter les champs dans le frontend (interface TypeScript)
2. Mapper les données depuis `LegacyUserService` existant
3. Afficher les nouveaux champs dans l'UI
4. Tester avec données réelles
5. Corriger les incohérences backend en parallèle

### Option 2 : Refactoring Complet (RISQUÉ ⚠️)

**Désavantages** :
- ⚠️ Risque de casser le code existant
- ⚠️ Tests longs
- ⚠️ Rollback difficile

**À éviter pour le moment.**

---

## 📝 CORRECTIONS À APPORTER

### 🔹 Phase 1 : Backend (Corrections mineures)

#### 1.1 Corriger `UsersService.getActiveUsers()`

**Problème actuel** :
```typescript
.from('___xtr_customer')
.eq('cst_active', 1)  // ❌ Mauvais nom de colonne
```

**Correction** :
```typescript
.from('___xtr_customer')
.eq('cst_activ', '1')  // ✅ Bon nom de colonne (string, pas int)
```

**Fichier** : `backend/src/modules/users/users.service.ts`  
**Lignes** : ~465-480

#### 1.2 Corriger `UsersService.searchUsers()`

**Problème actuel** :
```typescript
.or(`cst_email.ilike.%${searchTerm}%,...`)  // ❌ Mauvais nom
```

**Correction** :
```typescript
.or(`cst_mail.ilike.%${searchTerm}%,...`)  // ✅ Bon nom
```

**Fichier** : `backend/src/modules/users/users.service.ts`  
**Lignes** : ~495-525

#### 1.3 Ajouter champs manquants dans mapping `getAllUsers()`

**Actuel** :
```typescript
users: result.users.map((user) => ({
  id: String(user.cst_id),
  email: user.cst_mail,
  firstName: user.cst_fname || '',
  lastName: user.cst_name || '',
  tel: user.cst_tel || user.cst_gsm,  // ⚠️ Mélangé
  isPro: user.cst_is_pro === '1',
  isActive: user.cst_activ === '1',
  createdAt: new Date(),
  updatedAt: new Date(),
}))
```

**Correction** :
```typescript
users: result.users.map((user) => ({
  id: String(user.cst_id),
  email: user.cst_mail,
  firstName: user.cst_fname || '',
  lastName: user.cst_name || '',
  civility: user.cst_civility || '',           // 🆕 AJOUT
  address: user.cst_address || '',             // 🆕 AJOUT
  zipCode: user.cst_zip_code || '',            // 🆕 AJOUT
  city: user.cst_city || '',
  country: user.cst_country || '',             // 🆕 AJOUT
  phone: user.cst_tel || '',                   // 🆕 SÉPARÉ
  mobile: user.cst_gsm || '',                  // 🆕 SÉPARÉ
  isPro: user.cst_is_pro === '1',
  isCompany: user.cst_is_cpy === '1',
  companyName: user.cst_rs || '',              // 🆕 AJOUT
  siret: user.cst_siret || '',                 // 🆕 AJOUT
  level: parseInt(user.cst_level) || 1,
  isActive: user.cst_activ === '1',
  createdAt: new Date(),
  updatedAt: new Date(),
}))
```

**Fichier** : `backend/src/modules/users/users.service.ts`  
**Lignes** : ~225-245

---

### 🔹 Phase 2 : Frontend (Ajout champs)

#### 2.1 Mettre à jour l'interface TypeScript

**Fichier** : `frontend/app/routes/admin.users.tsx`  
**Ligne** : 20

**Actuel** :
```typescript
interface User {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email: string;
  city?: string;
  isPro: boolean;
  isCompany: boolean;
  level: number;
  isActive: boolean;
  createdAt?: string;
  lastLogin?: string;
  totalOrders?: number;
  totalSpent?: number;
  role?: string;
}
```

**Correction** :
```typescript
interface User {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  civility?: string;        // 🆕 AJOUT - Civilité (M, Mme, Mlle)
  address?: string;         // 🆕 AJOUT - Adresse complète
  zipCode?: string;         // 🆕 AJOUT - Code postal
  city?: string;
  country?: string;         // 🆕 AJOUT - Pays
  phone?: string;           // 🆕 AJOUT - Téléphone fixe (CST_TEL)
  mobile?: string;          // 🆕 AJOUT - Téléphone mobile (CST_GSM)
  isPro: boolean;
  isCompany: boolean;
  companyName?: string;     // 🆕 AJOUT - Raison sociale (CST_RS)
  siret?: string;           // 🆕 AJOUT - SIRET entreprise
  level: number;
  isActive: boolean;
  createdAt?: string;
  lastLogin?: string;
  totalOrders?: number;
  totalSpent?: number;
  role?: string;            // ⚠️ À SUPPRIMER (pas dans Supabase)
  name?: string;            // ⚠️ À SUPPRIMER (redondant avec firstName + lastName)
}
```

#### 2.2 Mettre à jour le loader

**Fichier** : `frontend/app/routes/admin.users.tsx`  
**Lignes** : 65-85

**Aucune modification nécessaire** si `LegacyUserService` retourne déjà tous les champs.  
Le mapping se fera automatiquement.

#### 2.3 Afficher les nouveaux champs

**Fichier** : `frontend/app/routes/admin.users.tsx`  
**Section** : Tableau des utilisateurs

**Ajouts recommandés** :

1. **Colonne Civilité** (après le nom) :
```tsx
<td className="px-4 py-3">
  {user.civility && (
    <Badge variant="outline">{user.civility}</Badge>
  )}
</td>
```

2. **Colonne Contact** (après l'email) :
```tsx
<td className="px-4 py-3 text-sm">
  {user.phone && (
    <div className="flex items-center gap-1">
      <Phone className="w-3 h-3" />
      <span>{user.phone}</span>
    </div>
  )}
  {user.mobile && (
    <div className="flex items-center gap-1">
      <Smartphone className="w-3 h-3" />
      <span>{user.mobile}</span>
    </div>
  )}
</td>
```

3. **Colonne Adresse complète** (remplacer la colonne ville) :
```tsx
<td className="px-4 py-3 text-sm">
  {user.address && (
    <div className="space-y-1">
      <div>{user.address}</div>
      <div className="text-muted-foreground">
        {user.zipCode} {user.city}
      </div>
      {user.country && (
        <div className="text-muted-foreground">{user.country}</div>
      )}
    </div>
  )}
</td>
```

4. **Colonne Entreprise** (après le badge Pro) :
```tsx
{user.isCompany && (
  <td className="px-4 py-3 text-sm">
    <div className="space-y-1">
      <div className="font-medium">{user.companyName}</div>
      {user.siret && (
        <div className="text-xs text-muted-foreground">
          SIRET: {user.siret}
        </div>
      )}
    </div>
  </td>
)}
```

---

## 🧪 TESTS À EFFECTUER

### Test 1 : Vérifier les données backend

```bash
# Test de l'API avec curl
curl -X GET "http://localhost:3000/api/legacy-users?page=1&limit=5" \
  -H "Content-Type: application/json" | jq
```

**Vérifier** :
- ✅ Champ `civility` présent
- ✅ Champ `address` présent
- ✅ Champ `zipCode` présent
- ✅ Champ `country` présent
- ✅ Champs `phone` et `mobile` séparés
- ✅ Champs `companyName` et `siret` présents

### Test 2 : Vérifier l'affichage frontend

1. Naviguer vers `/admin/users`
2. Vérifier que les colonnes apparaissent
3. Vérifier les données pour un utilisateur pro
4. Vérifier les données pour une entreprise

### Test 3 : Vérifier les filtres

1. Rechercher un utilisateur par nom
2. Filtrer par statut (actif/inactif)
3. Filtrer par type (pro/particulier)

---

## ⚠️ POINTS D'ATTENTION

### 1. Typo dans la base de données

**Problème** : Le champ civilité est nommé `CST_CIVITILY` (avec TYPO) au lieu de `CST_CIVILITY`

**Solutions** :

**Option A** : Corriger la typo dans Supabase (RECOMMANDÉ)
```sql
-- Renommer la colonne
ALTER TABLE ___xtr_customer 
RENAME COLUMN cst_civitily TO cst_civility;
```

**Option B** : Utiliser le mauvais nom en attendant
```typescript
// Dans le mapping
civility: user.cst_civitily || '',  // ⚠️ Typo intentionnelle
```

### 2. Distinction phone/mobile

**Problème actuel** : Le backend mélange `cst_tel` et `cst_gsm`

**Solution** : Les séparer clairement dans le mapping (déjà fait dans Phase 1.3)

### 3. Champs optionnels

**Tous les nouveaux champs sont optionnels** (`?`) car :
- Pas tous les utilisateurs ont une adresse
- Pas tous les utilisateurs ont un téléphone
- Pas tous les utilisateurs sont des entreprises

**Interface correcte** :
```typescript
civility?: string;        // Optionnel
address?: string;         // Optionnel
zipCode?: string;         // Optionnel
city?: string;            // Optionnel
country?: string;         // Optionnel
phone?: string;           // Optionnel
mobile?: string;          // Optionnel
companyName?: string;     // Optionnel (si isCompany)
siret?: string;           // Optionnel (si isCompany)
```

---

## 📦 FICHIERS À MODIFIER

### Backend (3 fichiers)

1. ✅ **`backend/src/modules/users/users.service.ts`**
   - Ligne ~225-245 : Ajouter champs dans mapping `getAllUsers()`
   - Ligne ~465-480 : Corriger `cst_active` → `cst_activ`
   - Ligne ~495-525 : Corriger `cst_email` → `cst_mail`

2. ✅ **`backend/src/modules/users/dto/users.dto.ts`** (à créer si n'existe pas)
   - Créer `UserResponseDto` avec tous les champs

3. ⚠️ **`backend/src/database/services/user-data.service.ts`** (OPTIONNEL)
   - Corriger les noms de colonnes `customer_*` → `cst_*`
   - OU supprimer ce service (redondant avec `LegacyUserService`)

### Frontend (1 fichier)

1. ✅ **`frontend/app/routes/admin.users.tsx`**
   - Ligne 20 : Mettre à jour interface `User`
   - Ligne ~200-500 : Ajouter colonnes dans le tableau

---

## 🚀 ORDRE D'EXÉCUTION

### Étape 1 : Backend minimal (30 min)

```bash
# 1. Ouvrir le fichier users.service.ts
code backend/src/modules/users/users.service.ts

# 2. Corriger les 3 sections identifiées dans Phase 1
# 3. Tester avec curl
curl http://localhost:3000/api/users?page=1&limit=5 | jq
```

### Étape 2 : Frontend (1h)

```bash
# 1. Ouvrir le fichier admin.users.tsx
code frontend/app/routes/admin.users.tsx

# 2. Mettre à jour l'interface User (ligne 20)
# 3. Ajouter les colonnes dans le tableau
# 4. Tester dans le navigateur
npm run dev
```

### Étape 3 : Tests (30 min)

```bash
# 1. Naviguer vers /admin/users
# 2. Vérifier l'affichage
# 3. Tester les filtres
# 4. Vérifier les données d'un utilisateur pro
# 5. Vérifier les données d'une entreprise
```

---

## ✅ CHECKLIST DE VALIDATION

### Backend
- [ ] ✅ Champs ajoutés dans mapping `getAllUsers()`
- [ ] ✅ Colonne `cst_activ` corrigée dans `getActiveUsers()`
- [ ] ✅ Colonne `cst_mail` corrigée dans `searchUsers()`
- [ ] ✅ Distinction `phone` / `mobile` dans mapping
- [ ] ✅ Test API curl réussi

### Frontend
- [ ] ✅ Interface `User` mise à jour
- [ ] ✅ Colonne civilité ajoutée
- [ ] ✅ Colonne contact (phone/mobile) ajoutée
- [ ] ✅ Colonne adresse complète ajoutée
- [ ] ✅ Section entreprise (companyName/siret) ajoutée
- [ ] ✅ Affichage testé dans le navigateur

### Tests
- [ ] ✅ Données affichées correctement
- [ ] ✅ Filtres fonctionnent
- [ ] ✅ Pagination fonctionne
- [ ] ✅ Utilisateurs pro affichés correctement
- [ ] ✅ Entreprises affichées correctement

---

## 📊 ESTIMATION DES EFFORTS

| Tâche | Temps estimé | Difficulté |
|-------|--------------|------------|
| Backend - Corrections mineures | 30 min | 🟢 Facile |
| Frontend - Mise à jour interface | 15 min | 🟢 Facile |
| Frontend - Ajout colonnes | 45 min | 🟡 Moyen |
| Tests | 30 min | 🟢 Facile |
| **TOTAL** | **2h** | 🟢 Facile |

---

## 🎯 RÉSULTAT ATTENDU

Après application de ce plan :

1. ✅ Interface `User` complète avec les 9 champs manquants
2. ✅ Backend cohérent avec noms de colonnes corrects
3. ✅ Affichage complet dans `/admin/users`
4. ✅ Données identiques au PHP (`myspace.account.index.php`)
5. ✅ Distinction claire entre téléphone fixe et mobile
6. ✅ Affichage des informations entreprise (companyName, siret)

---

**Date de création** : 2025-01-17  
**Auteur** : GitHub Copilot  
**Statut** : ✅ Plan de correction prêt à exécuter
