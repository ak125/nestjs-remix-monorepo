# 📘 EXPLICATION - create-user.dto.ts

**Date**: 4 octobre 2025  
**Objectif**: Comprendre le rôle de create-user.dto.ts

---

## 🎯 À QUOI SERT create-user.dto.ts ?

### Résumé court
`create-user.dto.ts` définit **2 DTOs principaux avec validation Zod** pour :
1. **CreateUserDto** - Créer un utilisateur (opération ADMIN)
2. **UpdateUserDto** - Mettre à jour un utilisateur

---

## 📋 CONTENU DU FICHIER

### 1. CreateUserDto (Admin - Création complète)

**But**: Créer un utilisateur avec TOUS les détails (opération réservée aux ADMINS)

```typescript
export const CreateUserSchema = z.object({
  // CHAMPS OBLIGATOIRES
  email: z.string().email("L'email doit être valide")
    .min(1, "L'email est obligatoire"),
  
  password: z.string()
    .min(8, 'Minimum 8 caractères')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Majuscule + minuscule + chiffre'),
  
  firstName: z.string()
    .min(1, 'Prénom obligatoire')
    .max(50),
  
  lastName: z.string()
    .min(1, 'Nom obligatoire')
    .max(50),

  // CHAMPS OPTIONNELS
  civility: z.enum(['M', 'Mme', 'Autre']).optional(),
  tel: z.string().regex(/^[+]?[0-9\s\-().]{10,20}$/).optional(),
  address: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  zipCode: z.string().regex(/^[0-9]{5}$/).optional(),
  country: z.string().max(100).optional(),
  
  // FLAGS
  isPro: z.boolean().default(false),
  isActive: z.boolean().default(true),
  isNewsletterSubscribed: z.boolean().default(false),
  lastLoginAt: z.date().optional(),
}).strict();

export type CreateUserDto = z.infer<typeof CreateUserSchema>;
```

**Différence avec RegisterDto** (`/auth/dto/register.dto.ts`):
```typescript
RegisterDto (Public - Inscription frontend):
✅ email
✅ password
✅ firstName (optionnel)
✅ lastName (optionnel)
✅ civility (optionnel)
✅ tel (optionnel)
✅ gsm (optionnel)
❌ PAS d'adresse complète
❌ PAS de isPro
❌ PAS de isActive
❌ PAS de contrôle admin

CreateUserDto (Admin - Création backend):
✅ email
✅ password
✅ firstName (OBLIGATOIRE)
✅ lastName (OBLIGATOIRE)
✅ civility (optionnel)
✅ tel (optionnel)
✅ address (COMPLET: address, city, zipCode, country)
✅ isPro (admin peut créer des comptes Pro)
✅ isActive (admin peut créer comptes inactifs)
✅ isNewsletterSubscribed
✅ lastLoginAt
```

---

### 2. UpdateUserDto (Mise à jour profil)

**But**: Mettre à jour les informations d'un utilisateur existant

```typescript
export const UpdateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  civility: z.enum(['M', 'Mme', 'Autre']).optional(),
  isNewsletterSubscribed: z.boolean().optional(),
  marketingConsent: z.boolean().optional(),
  profileCompleteness: z.number().min(0).max(100).optional(),
});

export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;
```

**Caractéristiques**:
- Tous les champs sont **optionnels** (mise à jour partielle)
- Pas de mot de passe (utilisez PasswordService)
- Pas de isPro (opération admin séparée)
- Pas de isActive (opération admin séparée)

---

## 🔄 DIFFÉRENCES ENTRE LES 3 DTOs

### Tableau comparatif

| Champ | RegisterDto (Public) | CreateUserDto (Admin) | UpdateUserDto (Update) |
|-------|----------------------|------------------------|------------------------|
| **email** | ✅ Obligatoire | ✅ Obligatoire | ⚠️ Optionnel |
| **password** | ✅ Obligatoire | ✅ Obligatoire | ❌ Non (PasswordService) |
| **firstName** | ⚠️ Optionnel | ✅ Obligatoire | ⚠️ Optionnel |
| **lastName** | ⚠️ Optionnel | ✅ Obligatoire | ⚠️ Optionnel |
| **civility** | ⚠️ Optionnel | ⚠️ Optionnel | ⚠️ Optionnel |
| **tel/phone** | ⚠️ Optionnel | ⚠️ Optionnel | ⚠️ Optionnel |
| **gsm** | ⚠️ Optionnel | ❌ Non | ❌ Non |
| **address** | ❌ Non | ⚠️ Optionnel (complet) | ❌ Non (AddressesService) |
| **city** | ❌ Non | ⚠️ Optionnel | ❌ Non |
| **zipCode** | ❌ Non | ⚠️ Optionnel | ❌ Non |
| **country** | ❌ Non | ⚠️ Optionnel | ❌ Non |
| **isPro** | ❌ Non | ✅ Default false | ❌ Non |
| **isActive** | ❌ Non | ✅ Default true | ❌ Non |
| **isNewsletterSubscribed** | ❌ Non | ✅ Default false | ⚠️ Optionnel |
| **dateOfBirth** | ❌ Non | ❌ Non | ⚠️ Optionnel |
| **marketingConsent** | ❌ Non | ❌ Non | ⚠️ Optionnel |
| **profileCompleteness** | ❌ Non | ❌ Non | ⚠️ Optionnel |
| **lastLoginAt** | ❌ Non | ⚠️ Optionnel | ❌ Non |

---

## 🚀 UTILISATION DANS LE CODE

### CreateUserDto

**Fichier**: `/backend/src/modules/users/users.service.ts`

**Méthode**: `createUser(createUserDto: CreateUserControllerDto)`
```typescript
async createUser(
  createUserDto: CreateUserControllerDto,
): Promise<UserResponseDto> {
  console.log('➕ UsersService.createUser:', createUserDto.email);

  try {
    // 1. Vérifier si l'email existe déjà
    const existingUser = await this.findByEmail(createUserDto.email);
    if (existingUser) {
      throw new ConflictException('Cet email est déjà utilisé');
    }

    // 2. Hacher le mot de passe (bcrypt)
    const hashedPassword = await this.hashPassword(createUserDto.password);

    // 3. Créer l'utilisateur dans la DB
    const userData = {
      email: createUserDto.email,
      firstName: createUserDto.firstName,
      lastName: createUserDto.lastName,
      isPro: createUserDto.isPro || false,
      password: hashedPassword,
      // ... autres champs
    };

    const user = await this.supabase
      .from('___XTR_CUSTOMER')
      .insert(userData)
      .select()
      .single();

    return transformUserToResponse(user);
  } catch (error) {
    // Gestion erreurs
  }
}
```

**Routes associées**:
```typescript
// users.controller.ts
@Post('admin/create') // Route ADMIN
@UseGuards(IsAdminGuard)
async createUserAdmin(@Body() dto: CreateUserDto) {
  return this.usersService.createUser(dto);
}
```

---

### UpdateUserDto

**Fichier**: `/backend/src/modules/users/users.service.ts`

**Méthode**: `updateUser(userId, updateUserDto: UpdateUserDto)`
```typescript
async updateUser(
  userId: string,
  updateUserDto: UpdateUserDto,
): Promise<UserResponseDto> {
  try {
    // 1. Récupérer l'utilisateur existant
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // 2. Préparer les données de mise à jour
    const updatedData = {
      email: updateUserDto.email || user.email,
      firstName: updateUserDto.firstName || user.firstName,
      lastName: updateUserDto.lastName || user.lastName,
      // Note: isPro devrait être géré par UsersAdminService
      isPro: user.isPro,
      isActive: user.isActive,
      // ... autres champs optionnels
    };

    // 3. Mettre à jour dans la DB
    const updatedUser = await this.supabase
      .from('___XTR_CUSTOMER')
      .update(updatedData)
      .eq('cst_id', userId)
      .select()
      .single();

    return transformUserToResponse(updatedUser);
  } catch (error) {
    // Gestion erreurs
  }
}
```

**Routes associées**:
```typescript
// users.controller.ts
@Put(':id')
@UseGuards(AuthenticatedGuard)
async updateUser(
  @Param('id') id: string,
  @Body() dto: UpdateUserDto
) {
  return this.usersService.updateUser(id, dto);
}
```

---

## 📊 SCÉNARIOS D'UTILISATION

### Scénario 1: Inscription utilisateur (Public)
```
Frontend → POST /api/auth/register
↓
RegisterDto (auth/dto/register.dto.ts)
↓
AuthService.register()
↓
Création utilisateur basique
```

**Données requises**: email, password  
**Données optionnelles**: firstName, lastName, civility, tel, gsm

---

### Scénario 2: Admin créer un utilisateur (Dashboard Admin)
```
Dashboard Admin → POST /api/users/admin/create
↓
CreateUserDto (create-user.dto.ts)
↓
UsersService.createUser()
↓
Création utilisateur complète (avec adresse, isPro, isActive)
```

**Données requises**: email, password, firstName, lastName  
**Données optionnelles**: civility, tel, address, city, zipCode, country, isPro, isActive, isNewsletterSubscribed, lastLoginAt

**Avantages**:
- Admin peut créer des comptes Pro (`isPro: true`)
- Admin peut créer des comptes inactifs (`isActive: false`)
- Admin peut renseigner adresse complète immédiatement
- Admin peut définir date de dernière connexion

---

### Scénario 3: Utilisateur met à jour son profil
```
Frontend → PUT /api/users/:id
↓
UpdateUserDto (create-user.dto.ts)
↓
UsersService.updateUser()
↓
Mise à jour partielle du profil
```

**Données modifiables**: firstName, lastName, email, phone, dateOfBirth, civility, isNewsletterSubscribed, marketingConsent, profileCompleteness

**Non modifiable** (nécessite routes/services dédiés):
- Password → PasswordService.changePassword()
- Adresses → AddressesService
- isPro → UsersAdminService (futur)
- isActive → UsersAdminService (futur)

---

## 🎯 POURQUOI 2 DTOs DANS LE MÊME FICHIER ?

### Raisons architecturales

1. **Cohérence fonctionnelle**
   - CreateUserDto et UpdateUserDto sont liés au **CRUD utilisateur**
   - Regrouper dans le même fichier facilite la maintenance
   - Évite la dispersion des DTOs

2. **Partage de types**
   - `CivilityEnum` partagé entre les 2 DTOs
   - Évite la duplication de code

3. **Séparation des responsabilités**
   - `create-user.dto.ts` → CRUD utilisateur (admin)
   - `/auth/dto/register.dto.ts` → Inscription publique
   - `/dto/passwords.dto.ts` → Gestion mots de passe
   - `/dto/addresses.dto.ts` → Gestion adresses

---

## ⚠️ PROBLÈME DÉTECTÉ

### Doublon CreateUserDto

**Localisation**:
1. `/modules/users/dto/create-user.dto.ts` ✅ **VERSION ZOD (À GARDER)**
2. `/modules/users/dto/users.dto.ts` ❌ **INTERFACE SIMPLE (DOUBLON)**

```typescript
// users.dto.ts (ligne 57-61) ❌ DOUBLON
export interface CreateUserDto {
  email: string;
  name: string;    // ❌ Incompatible avec version Zod (firstName/lastName)
  password: string;
}
```

**Problème**:
- Version Zod utilise `firstName` + `lastName`
- Version interface utilise `name`
- Crée confusion et incompatibilités

**Solution** (Jour 2):
- Supprimer l'interface de `users.dto.ts`
- N'utiliser QUE la version Zod de `create-user.dto.ts`

---

## 📚 RÉSUMÉ

### create-user.dto.ts sert à :

1. **CreateUserDto** (Admin)
   - Créer des utilisateurs avec tous les détails
   - Réservé aux opérations admin
   - Validation Zod stricte
   - Permet isPro, isActive, adresse complète

2. **UpdateUserDto** (User + Admin)
   - Mettre à jour le profil utilisateur
   - Tous champs optionnels (update partiel)
   - Validation Zod
   - Ne gère PAS password/adresses (services dédiés)

3. **CivilityEnum** (Partagé)
   - Type civilité : 'M', 'Mme', 'Autre'
   - Réutilisable dans autres DTOs

### Relation avec autres DTOs

```
Inscription Public:
RegisterDto (/auth/dto/register.dto.ts)
↓
AuthService.register()

Création Admin:
CreateUserDto (create-user.dto.ts)
↓
UsersService.createUser() → UsersAdminService (futur)

Mise à jour:
UpdateUserDto (create-user.dto.ts)
↓
UsersService.updateUser() → ProfileService (futur)
```

---

## 🔄 ÉVOLUTION FUTURE (Jour 2-3)

### Après consolidation

1. **UsersAdminService** (nouveau)
   - Déplacer `createUser()` depuis UsersService
   - Utiliser CreateUserDto
   - Route: POST /api/users/admin/create

2. **ProfileService** (nouveau)
   - Déplacer `updateUser()` depuis UsersService
   - Utiliser UpdateUserDto
   - Route: PUT /api/users/:id/profile

3. **UsersService** (coordinateur)
   - Ne garde que la coordination
   - Délègue vers services spécialisés

---

**Est-ce plus clair maintenant ?** 🤔

**Questions complémentaires possibles**:
1. Pourquoi CreateUserDto au lieu de réutiliser RegisterDto ?
2. Comment gérer les adresses si UpdateUserDto ne les gère pas ?
3. Quelle est la différence entre isPro (compte) et roles (permissions) ?
