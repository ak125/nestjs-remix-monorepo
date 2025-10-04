# 🧹 JOUR 1 - Analyse des DTOs et Plan de Nettoyage

**Date**: 4 octobre 2025  
**Phase**: Jour 1 - Nettoyage des DTOs  
**Durée estimée**: 6h

---

## 🔍 ANALYSE COMPLÈTE DES DTOs

### ❌ PROBLÈME 1: RegisterDto dupliqué 3 fois !

#### Localisation des doublons

**1. Version AuthModule** (`/backend/src/auth/dto/register.dto.ts`) ✅ **À CONSERVER**
```typescript
export const RegisterSchema = z.object({
  email: z.string().email().toLowerCase().trim().max(255),
  password: z.string().min(8).max(100)
    .regex(/[A-Z]/, 'Au moins une majuscule')
    .regex(/[a-z]/, 'Au moins une minuscule')
    .regex(/[0-9]/, 'Au moins un chiffre')
    .regex(/[^A-Za-z0-9]/, 'Au moins un caractère spécial'),
  firstName: z.string().min(2).max(50).optional(),
  lastName: z.string().min(2).max(50).optional(),
  civility: z.enum(['M', 'Mme', 'Mlle']).optional(),
  tel: z.string().regex(/^[\d\s\+\-\(\)]+$/).optional(),
  gsm: z.string().regex(/^[\d\s\+\-\(\)]+$/).optional(),
});

export type RegisterDto = z.infer<typeof RegisterSchema>;
```

**Utilisé par**:
- ✅ `/backend/src/auth/auth.controller.ts` (ligne 24, 41)
- ✅ Production (authentification réelle)

**Statut**: ✅ **VERSION OFFICIELLE - NE PAS TOUCHER**

---

**2. Version UsersModule** (`/backend/src/modules/users/schemas/users.schemas.ts`) ❌ **DOUBLON**
```typescript
export const registerSchema = userBaseSchema.extend({
  password: z.string().min(8)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Mot de passe trop simple'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
});

export type RegisterDto = z.infer<typeof registerSchema>;
```

**Utilisé par**:
- ❌ `/backend/src/modules/users/dto/users.dto.ts` (ligne 7, 22)
- ❌ Export puis réimport (doublon inutile)

**Statut**: ❌ **DOUBLON - À SUPPRIMER**

---

**3. Réexport dans users.dto.ts** ❌ **DOUBLON**
```typescript
// users.dto.ts (ligne 7-8, 22-23)
import { RegisterDto, LoginDto, ... } from '../schemas/users.schemas';

export {
  RegisterDto,  // ❌ DOUBLON avec /auth/dto/register.dto.ts
  LoginDto,     // ❌ DOUBLON avec /auth/dto/login.dto.ts
  ...
};
```

**Utilisé par**:
- ❌ `/backend/src/modules/users/users.service.ts` (ligne 21-22)

**Statut**: ❌ **RÉEXPORT INUTILE - À SUPPRIMER**

---

### ❌ PROBLÈME 2: LoginDto dupliqué 3 fois !

#### Localisation des doublons

**1. Version dédiée** (`/backend/src/modules/users/dto/login.dto.ts`) ✅ **VERSION À CONSERVER**
```typescript
export const LoginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
  rememberMe: z.boolean().optional(),
});

export type LoginDto = z.infer<typeof LoginSchema>;
```

**Utilisé par**:
- Probablement controllers/services

**Statut**: ✅ **VERSION LOCALE - À CONSERVER**

---

**2. Version UsersModule schemas** ❌ **DOUBLON**
```typescript
// users.schemas.ts (ligne 35-39, 105)
export const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
  rememberMe: z.boolean().optional(),
});

export type LoginDto = z.infer<typeof loginSchema>;
```

**Statut**: ❌ **DOUBLON - À SUPPRIMER**

---

**3. Réexport dans users.dto.ts** ❌ **DOUBLON**
```typescript
// users.dto.ts (ligne 8, 23)
import { LoginDto, ... } from '../schemas/users.schemas';
export { LoginDto, ... };
```

**Statut**: ❌ **RÉEXPORT INUTILE - À SUPPRIMER**

---

### ❌ PROBLÈME 3: UpdateUserDto dupliqué 2 fois !

#### Localisation des doublons

**1. Version create-user.dto.ts** ✅ **VERSION À CONSERVER**
```typescript
// /backend/src/modules/users/dto/create-user.dto.ts
export const UpdateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  civility: CivilityEnum.optional(),
  isNewsletterSubscribed: z.boolean().optional(),
  marketingConsent: z.boolean().optional(),
  profileCompleteness: z.number().min(0).max(100).optional(),
});

export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;
```

**Utilisé par**:
- ✅ `/backend/src/modules/users/users.controller.ts` (ligne 32)

**Statut**: ✅ **VERSION UTILISÉE - À CONSERVER**

---

**2. Version user.dto.ts** ❌ **DOUBLON PARTIEL**
```typescript
// /backend/src/modules/users/dto/user.dto.ts
export const UpdateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  civility: z.enum(['M', 'Mme', 'Mlle']).optional(),
  dateOfBirth: z.string().optional(),
  isNewsletterSubscribed: z.boolean().optional(),
  marketingConsent: z.boolean().optional(),
});

export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;
```

**Statut**: ❌ **DOUBLON - À SUPPRIMER ou FUSIONNER**

---

**3. Version users.dto.ts** ❌ **INTERFACE SIMPLE**
```typescript
// /backend/src/modules/users/dto/users.dto.ts (ligne 65-69)
export interface UpdateUserDto {
  name?: string;
  email?: string;
  isPro?: boolean;
}
```

**Statut**: ❌ **DOUBLON INCOMPLET - À SUPPRIMER**

---

## 📊 RÉSUMÉ DES DOUBLONS DÉTECTÉS

### RegisterDto
- ✅ `/auth/dto/register.dto.ts` - **VERSION OFFICIELLE**
- ❌ `/modules/users/schemas/users.schemas.ts` - **DOUBLON À SUPPRIMER**
- ❌ `/modules/users/dto/users.dto.ts` - **RÉEXPORT À SUPPRIMER**

### LoginDto
- ✅ `/modules/users/dto/login.dto.ts` - **VERSION LOCALE**
- ❌ `/modules/users/schemas/users.schemas.ts` - **DOUBLON À SUPPRIMER**
- ❌ `/modules/users/dto/users.dto.ts` - **RÉEXPORT À SUPPRIMER**

### UpdateUserDto
- ✅ `/modules/users/dto/create-user.dto.ts` - **VERSION UTILISÉE**
- ❌ `/modules/users/dto/user.dto.ts` - **DOUBLON À SUPPRIMER**
- ❌ `/modules/users/dto/users.dto.ts` - **INTERFACE À SUPPRIMER**

---

## 🎯 PLAN DE NETTOYAGE

### ÉTAPE 1: Supprimer RegisterDto de users.schemas.ts

**Fichier**: `/backend/src/modules/users/schemas/users.schemas.ts`

**Action**: Supprimer les lignes 19-31 et 104
```typescript
// SUPPRIMER:
export const registerSchema = userBaseSchema
  .extend({
    password: z.string()...
  })
  .refine(...);

export type RegisterDto = z.infer<typeof registerSchema>;
```

---

### ÉTAPE 2: Supprimer LoginDto de users.schemas.ts

**Fichier**: `/backend/src/modules/users/schemas/users.schemas.ts`

**Action**: Supprimer les lignes 33-39 et 105
```typescript
// SUPPRIMER:
export const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
  rememberMe: z.boolean().optional(),
});

export type LoginDto = z.infer<typeof loginSchema>;
```

---

### ÉTAPE 3: Nettoyer users.dto.ts

**Fichier**: `/backend/src/modules/users/dto/users.dto.ts`

**Action**: Supprimer imports et exports RegisterDto/LoginDto
```typescript
// AVANT (ligne 7-8)
import {
  RegisterDto,  // ❌ À SUPPRIMER
  LoginDto,     // ❌ À SUPPRIMER
  UpdateProfileDto,
  UpdateAddressDto,
  UserMessageDto,
  ResetPasswordDto,
  ConfirmResetPasswordDto,
  SearchUsersDto,
} from '../schemas/users.schemas';

// APRÈS
import {
  UpdateProfileDto,
  UpdateAddressDto,
  UserMessageDto,
  ResetPasswordDto,
  ConfirmResetPasswordDto,
  SearchUsersDto,
} from '../schemas/users.schemas';

// AVANT (ligne 22-23)
export {
  RegisterDto,  // ❌ À SUPPRIMER
  LoginDto,     // ❌ À SUPPRIMER
  UpdateProfileDto,
  UpdateAddressDto,
  UserMessageDto,
  ResetPasswordDto,
  ConfirmResetPasswordDto,
  SearchUsersDto,
  UserResponseDto,
  transformUserToResponse,
};

// APRÈS
export {
  UpdateProfileDto,
  UpdateAddressDto,
  UserMessageDto,
  ResetPasswordDto,
  ConfirmResetPasswordDto,
  SearchUsersDto,
  UserResponseDto,
  transformUserToResponse,
};

// AVANT (ligne 65-69)
export interface UpdateUserDto {
  name?: string;
  email?: string;
  isPro?: boolean;
}
// ❌ À SUPPRIMER (utiliser create-user.dto.ts)
```

---

### ÉTAPE 4: Corriger imports dans users.service.ts

**Fichier**: `/backend/src/modules/users/users.service.ts`

**Action**: Importer depuis les bons fichiers
```typescript
// AVANT (ligne 21-23)
import {
  RegisterDto,  // ❌ Depuis users.dto.ts (doublon)
  LoginDto,     // ❌ Depuis users.dto.ts (doublon)
  LoginResponseDto,
  UserResponseDto,
  UpdateProfileDto,
  UpdateAddressDto,
  PaginatedUsersResponseDto,
  transformUserToResponse,
} from './dto/users.dto';

// APRÈS
import { RegisterDto } from '../../auth/dto/register.dto'; // ✅ Version officielle
import { LoginDto } from './dto/login.dto'; // ✅ Version locale
import {
  LoginResponseDto,
  UserResponseDto,
  UpdateProfileDto,
  UpdateAddressDto,
  PaginatedUsersResponseDto,
  transformUserToResponse,
} from './dto/users.dto';
```

---

### ÉTAPE 5: Fusionner ou supprimer user.dto.ts

**Fichier**: `/backend/src/modules/users/dto/user.dto.ts`

**Options**:

**Option A - SUPPRIMER** (recommandé)
- UpdateUserDto existe déjà dans `create-user.dto.ts`
- Supprimer `user.dto.ts` complètement
- Mettre à jour imports vers `create-user.dto.ts`

**Option B - FUSIONNER**
- Garder `user.dto.ts` comme fichier principal
- Copier types manquants depuis `create-user.dto.ts`
- Supprimer doublons de `create-user.dto.ts`

**Recommandation**: **Option A - SUPPRIMER** user.dto.ts

---

## ✅ CHECKLIST D'EXÉCUTION

### Phase 1: Nettoyage users.schemas.ts
- [ ] Supprimer `registerSchema` (lignes 19-31)
- [ ] Supprimer `loginSchema` (lignes 33-39)
- [ ] Supprimer `export type RegisterDto` (ligne 104)
- [ ] Supprimer `export type LoginDto` (ligne 105)

### Phase 2: Nettoyage users.dto.ts
- [ ] Supprimer import `RegisterDto` (ligne 7)
- [ ] Supprimer import `LoginDto` (ligne 8)
- [ ] Supprimer export `RegisterDto` (ligne 22)
- [ ] Supprimer export `LoginDto` (ligne 23)
- [ ] Supprimer interface `UpdateUserDto` (lignes 65-69)

### Phase 3: Corriger imports users.service.ts
- [ ] Ajouter import `RegisterDto` depuis `/auth/dto/register.dto`
- [ ] Ajouter import `LoginDto` depuis `./dto/login.dto`
- [ ] Supprimer imports depuis `users.dto.ts`

### Phase 4: Supprimer user.dto.ts
- [ ] Vérifier qui utilise `user.dto.ts`
- [ ] Corriger imports vers `create-user.dto.ts`
- [ ] Supprimer le fichier `user.dto.ts`

### Phase 5: Tests
- [ ] Compiler: `npm run build`
- [ ] Tests: `npm test`
- [ ] Vérifier aucune erreur TypeScript
- [ ] Vérifier aucune régression

---

## 📁 ÉTAT FINAL DES DTOs

### Après nettoyage

```
backend/src/
├── auth/
│   └── dto/
│       └── register.dto.ts          ✅ RegisterDto (VERSION OFFICIELLE)
│
├── modules/users/
    └── dto/
        ├── login.dto.ts             ✅ LoginDto (VERSION LOCALE)
        ├── create-user.dto.ts       ✅ CreateUserDto + UpdateUserDto (Zod)
        ├── user-profile.dto.ts      ✅ Profil utilisateur
        ├── user-response.dto.ts     ✅ Réponses API
        ├── user-sessions.dto.ts     ✅ Sessions
        ├── passwords.dto.ts         ✅ Passwords (Zod)
        ├── addresses.dto.ts         ✅ Adresses (Zod)
        ├── messages.dto.ts          ✅ Messages
        ├── users.dto.ts             🔄 Nettoyé (plus RegisterDto/LoginDto)
        ├── user.dto.ts              ❌ SUPPRIMÉ (doublon)
        └── index.ts                 ✅ Exports
```

---

## 🎯 MÉTRIQUES DE SUCCÈS

### Avant nettoyage
- ❌ RegisterDto: 3 définitions
- ❌ LoginDto: 3 définitions
- ❌ UpdateUserDto: 3 définitions
- ❌ Imports confus et circulaires
- ❌ users.schemas.ts: 114 lignes

### Après nettoyage
- ✅ RegisterDto: 1 définition (`/auth/dto/register.dto.ts`)
- ✅ LoginDto: 1 définition (`/modules/users/dto/login.dto.ts`)
- ✅ UpdateUserDto: 1 définition (`create-user.dto.ts`)
- ✅ Imports clairs et directs
- ✅ users.schemas.ts: ~80 lignes (réduction 30%)

---

## ⏱️ TEMPS ESTIMÉ

- **Phase 1**: Nettoyage schemas (30 min)
- **Phase 2**: Nettoyage users.dto.ts (30 min)
- **Phase 3**: Corriger imports (1h)
- **Phase 4**: Supprimer user.dto.ts (30 min)
- **Phase 5**: Tests et validation (1h)

**Total**: ~3h30

---

**Prêt à exécuter le nettoyage ?** 🚀

Prochain fichier: `JOUR1-EXECUTION-NETTOYAGE.md` (log d'exécution)
