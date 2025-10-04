# 📋 JOUR 2 - Phase 2.3 : Analyse ProfileService

**Date**: 4 octobre 2025  
**Phase**: 2.3 - Création ProfileService  
**Objectif**: Migrer méthodes de profil depuis UsersService → ProfileService  
**Estimation**: -100 à -120 lignes UsersService

---

## 🎯 OBJECTIF PHASE 2.3

### Problème Actuel
UsersService contient des méthodes de gestion de profil mélangées avec la logique de coordination:
- **getProfile()**: Récupération profil utilisateur (mock data)
- **updateProfile()**: Mise à jour profil
- **findById()**: Recherche par ID (utilise UserService)
- **findByEmail()**: Recherche par email (mock data)

### Solution
Créer **ProfileService** dédié pour:
1. Isoler logique profil utilisateur
2. Centraliser accès données profil
3. Préparer migration vers vraies données DB
4. Réduire responsabilités UsersService

---

## 📊 ANALYSE DES MÉTHODES À MIGRER

### 1️⃣ **getProfile()** - Récupération Profil

**Location**: `users.service.ts` lignes 143-167 (~25 lignes)

```typescript
async getProfile(userId: number): Promise<UserResponseDto> {
  console.log('👤 UsersService.getProfile:', userId);

  try {
    // Simulation de récupération utilisateur
    const mockUsers = await this.getMockUsers();
    const user = mockUsers.find((u) => Number(u.id) === userId);

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    console.log('✅ Profil récupéré:', user.email);
    return user;
  } catch (error: any) {
    console.error('❌ Erreur récupération profil:', error);
    throw new HttpException(
      error?.message || 'Erreur lors de la récupération du profil',
      error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
```

**État actuel**:
- ❌ **Mock data**: Utilise `getMockUsers()` au lieu de DB
- ✅ **Gestion erreurs**: NotFoundException, logging
- ❌ **Type conversion**: userId `number` vs DB `string`

**Problèmes détectés**:
1. Mock data 5 utilisateurs hardcodés
2. Recherche Array.find() au lieu de query DB
3. Aucune utilisation UserService (pourtant injecté)

**Migration ProfileService**:
```typescript
async getProfile(userId: string): Promise<UserResponseDto> {
  // ✅ Utiliser UserService.getUserById() (vraies données DB)
  const user = await this.userService.getUserById(userId);
  
  if (!user) {
    throw new NotFoundException('Utilisateur non trouvé');
  }
  
  // Conversion ___xtr_customer → UserResponseDto
  return this.mapToUserResponse(user);
}
```

**Gain estimé**: ~10 lignes (simplification logique)

---

### 2️⃣ **updateProfile()** - Mise à Jour Profil

**Location**: `users.service.ts` lignes 169-202 (~34 lignes)

```typescript
async updateProfile(
  userId: number,
  updateDto: UpdateProfileDto,
): Promise<UserResponseDto> {
  console.log('✏️ UsersService.updateProfile:', userId, updateDto);

  try {
    // Trouver l'utilisateur existant
    const user = await this.getProfile(userId);

    // Mettre à jour les champs
    const updatedUser: UserResponseDto = {
      ...user,
      firstName: updateDto.firstName || user.firstName,
      lastName: updateDto.lastName || user.lastName,
      tel: updateDto.phone || user.tel,
      updatedAt: new Date(),
    };

    console.log('✅ Profil mis à jour:', user.email);
    return updatedUser;
  } catch (error: any) {
    console.error('❌ Erreur mise à jour profil:', error);
    throw new HttpException(
      error?.message || 'Erreur lors de la mise à jour du profil',
      error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
```

**État actuel**:
- ❌ **Simulation**: Spread operator sur objet, aucune DB update
- ✅ **Validation**: Vérifie utilisateur existe (via getProfile)
- ❌ **Pas de persistence**: Changements perdus après requête

**Problèmes détectés**:
1. updateDto.phone → user.tel (mapping incohérent)
2. Aucun appel UserService.updateUser() ou UPDATE SQL
3. Retourne objet modifié sans sauvegarder

**Migration ProfileService**:
```typescript
async updateProfile(
  userId: string,
  updateDto: UpdateProfileDto,
): Promise<UserResponseDto> {
  // 1. Vérifier utilisateur existe
  const user = await this.getProfile(userId);
  
  // 2. Préparer données pour UPDATE
  const updateData = {
    cst_fname: updateDto.firstName,
    cst_name: updateDto.lastName,
    cst_tel: updateDto.phone,
  };
  
  // 3. UPDATE ___xtr_customer via UserService
  await this.userService.updateUser(userId, updateData);
  
  // 4. Récupérer profil mis à jour
  return this.getProfile(userId);
}
```

**Gain estimé**: ~5 lignes (remplace simulation par vraie logique)

---

### 3️⃣ **findById()** - Recherche par ID

**Location**: `users.service.ts` lignes 769-806 (~38 lignes)

```typescript
async findById(id: string): Promise<UserResponseDto | null> {
  console.log('🔍 UsersService.findById:', id);

  try {
    // Utiliser le service UserService pour chercher dans les vraies tables (customers + admins)
    const user = await this.userService.getUserById(id);

    if (user) {
      // Convertir vers UserResponseDto
      const userResponse: UserResponseDto = {
        id: user.cst_id,
        email: user.cst_mail,
        firstName: user.cst_fname || '',
        lastName: user.cst_name || '',
        isActive: user.cst_activ === '1',
        isPro: user.cst_is_pro === '1',
        tel: user.cst_tel || '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      console.log('✅ Utilisateur trouvé:', userResponse.email);
      return userResponse;
    }

    console.log('❌ Utilisateur non trouvé:', id);
    return null;
  } catch (error: any) {
    console.error('❌ Erreur recherche par ID:', error);
    return null;
  }
}
```

**État actuel**:
- ✅ **Vraies données**: Utilise `UserService.getUserById()`
- ✅ **Mapping DB**: Conversion `___xtr_customer` → `UserResponseDto`
- ✅ **Gestion erreurs**: Try/catch avec logs
- ⚠️ **Utilisé massivement**: 9+ appels dans UsersService

**Problèmes détectés**:
1. Mapping répété (duplication logique si copié dans ProfileService)
2. Conversion booléens `'0'/'1'` → `boolean` hardcodée
3. createdAt/updatedAt fictifs (pas de champs DB correspondants)

**Migration ProfileService**:
```typescript
async findById(id: string): Promise<UserResponseDto | null> {
  try {
    const user = await this.userService.getUserById(id);
    return user ? this.mapToUserResponse(user) : null;
  } catch (error: any) {
    this.logger.error(`Erreur recherche par ID ${id}:`, error);
    return null;
  }
}

// Méthode utilitaire privée
private mapToUserResponse(user: any): UserResponseDto {
  return {
    id: user.cst_id,
    email: user.cst_mail,
    firstName: user.cst_fname || '',
    lastName: user.cst_name || '',
    isActive: user.cst_activ === '1',
    isPro: user.cst_is_pro === '1',
    tel: user.cst_tel || '',
    createdAt: new Date(), // TODO: Ajouter champ cst_created_at dans DB
    updatedAt: new Date(), // TODO: Ajouter champ cst_updated_at dans DB
  };
}
```

**Gain estimé**: ~20 lignes (factorisation mapping)

---

### 4️⃣ **findByEmail()** - Recherche par Email

**Location**: `users.service.ts` lignes 753-767 (~15 lignes)

```typescript
async findByEmail(email: string): Promise<UserResponseDto | null> {
  console.log('📧 UsersService.findByEmail:', email);

  try {
    const users = await this.getMockUsers();
    const user = users.find((u) => u.email === email);
    return user || null;
  } catch (error: any) {
    console.error('❌ Erreur recherche par email:', error);
    return null;
  }
}
```

**État actuel**:
- ❌ **Mock data**: Utilise `getMockUsers()` au lieu de DB
- ❌ **Incohérent**: findById() utilise DB, findByEmail() utilise mock
- ⚠️ **Utilisé pour validation**: Appels dans register(), resetPassword()

**Problèmes détectés**:
1. UserService n'a pas de méthode `getUserByEmail()`
2. Devrait query `___xtr_customer WHERE cst_mail = ?`
3. AuthService.checkIfUserExists() fait déjà cette vérification

**Migration ProfileService**:
```typescript
async findByEmail(email: string): Promise<UserResponseDto | null> {
  try {
    // Query directe Supabase
    const { data, error } = await this.supabase
      .from('___xtr_customer')
      .select('*')
      .eq('cst_mail', email)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return this.mapToUserResponse(data);
  } catch (error: any) {
    this.logger.error(`Erreur recherche par email ${email}:`, error);
    return null;
  }
}
```

**Gain estimé**: ~10 lignes (remplacement mock par vraie query)

---

## 📊 RÉSUMÉ MÉTRIQUES

### Méthodes à Migrer

| Méthode | Lignes Actuelles | Lignes ProfileService | Gain | Complexité |
|---------|------------------|----------------------|------|------------|
| `getProfile()` | 25 | 15 | -10 | 🟢 Faible |
| `updateProfile()` | 34 | 29 | -5 | 🟡 Moyenne |
| `findById()` | 38 | 18 | -20 | 🟢 Faible |
| `findByEmail()` | 15 | 15 | 0 | 🟢 Faible |
| **TOTAL** | **112 lignes** | **77 lignes** | **-35** | |

### Lignes Supplémentaires ProfileService

| Élément | Lignes | Description |
|---------|--------|-------------|
| Imports | 15 | NestJS, DTOs, services |
| Constructor | 8 | Injection UserService, Logger |
| Méthode utilitaire `mapToUserResponse()` | 18 | Factorisation mapping |
| Documentation classe | 10 | JSDoc |
| **TOTAL OVERHEAD** | **51 lignes** | |

### Calcul Final

```
UsersService AVANT: 1069 lignes (post Phase 2.2)
Méthodes migrées: -112 lignes
Appels délégués: +50 lignes (4 méthodes × ~12 lignes/appel)

UsersService APRÈS: 1069 - 112 + 50 = 1007 lignes
ProfileService créé: 77 + 51 = 128 lignes

RÉDUCTION NETTE UsersService: -62 lignes (-5.8%)
```

**⚠️ Attention**: Gain inférieur aux -150 estimés car:
1. Pas de méthodes `getUserStats()` ni `deleteAccount()` dans le code
2. Appels de délégation ajoutent overhead
3. findById() utilisé 9+ fois → nombreuses délégations

---

## 🔗 DÉPENDANCES ET IMPACTS

### Méthodes UsersService Appelant les Méthodes Profil

**getProfile()** - 1 appel interne:
- `updateProfile()` ligne 177

**findById()** - 9+ appels internes:
- `updateUser()` ligne 284
- `deleteUser()` ligne 318
- `activateUser()` ligne 342
- `deactivateUser()` ligne 386
- `promoteToAdmin()` ligne 410
- `getUserAddresses()` ligne 439
- `createUserAddress()` ligne 463
- Autres méthodes...

**findByEmail()** - 2 appels internes:
- `createUser()` ligne 244
- `resetPassword()` ligne 702

**updateProfile()** - 0 appels internes

### ⚠️ PROBLÈME: Dépendances Circulaires Potentielles

**Scénario problématique**:
```typescript
// UsersService
async updateUser() {
  const user = await this.profileService.findById(id); // ← Appel ProfileService
  // ... logique
}

// ProfileService
async updateProfile() {
  // Besoin d'accéder à AddressesService ou autres services de UsersModule?
}
```

**Solution**: ProfileService doit **SEULEMENT** dépendre de:
- ✅ UserService (database layer)
- ✅ CacheService (optionnel)
- ❌ JAMAIS UsersService (éviter circular dependency)

---

## 🏗️ ARCHITECTURE PROFILESERVICE

### Structure Proposée

```typescript
/**
 * ProfileService - Gestion des profils utilisateurs
 * 
 * Responsabilités:
 * - Récupération profils (getProfile, findById, findByEmail)
 * - Mise à jour profils (updateProfile)
 * - Mapping ___xtr_customer ↔ UserResponseDto
 * - Cache profils fréquemment accédés
 * 
 * Dépendances:
 * - UserService: Accès données ___xtr_customer
 * - CacheService: Cache profils (optionnel)
 */

@Injectable()
export class ProfileService extends SupabaseBaseService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    configService: ConfigService,
    private readonly userService: UserService,
    private readonly cacheService: CacheService,
  ) {
    super(configService);
  }

  // ===== MÉTHODES PUBLIQUES =====

  async getProfile(userId: string): Promise<UserResponseDto> { ... }
  
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserResponseDto> { ... }
  
  async findById(id: string): Promise<UserResponseDto | null> { ... }
  
  async findByEmail(email: string): Promise<UserResponseDto | null> { ... }

  // ===== MÉTHODES PRIVÉES =====

  private mapToUserResponse(user: any): UserResponseDto { ... }
  
  private async getCachedProfile(userId: string): Promise<UserResponseDto | null> { ... }
  
  private async setCachedProfile(userId: string, profile: UserResponseDto): Promise<void> { ... }
}
```

### Intégration UsersModule

```typescript
// users.module.ts
import { ProfileService } from './services/profile.service';

@Module({
  imports: [
    DatabaseModule,
    CacheModule,
    forwardRef(() => AuthModule),
    MessagesModule,
  ],
  controllers: [UsersController],
  providers: [
    UsersService,
    ProfileService, // ← NOUVEAU
    PasswordService,
    AddressesService,
  ],
  exports: [
    UsersService,
    ProfileService, // ← EXPORT pour autres modules
    PasswordService,
    AddressesService,
  ],
})
export class UsersModule {}
```

### Délégation UsersService → ProfileService

```typescript
// UsersService constructor
constructor(
  // ... autres dépendances
  private readonly profileService: ProfileService,
) {
  super(configService);
}

// Méthode déléguée (exemple)
async getProfile(userId: number): Promise<UserResponseDto> {
  return this.profileService.getProfile(String(userId));
}

async findById(id: string): Promise<UserResponseDto | null> {
  return this.profileService.findById(id);
}
```

---

## ✅ AVANTAGES PROFILESERVICE

### 1. **Séparation des Responsabilités**
- UsersService: Coordination générale
- ProfileService: Gestion profils utilisateurs
- AuthService: Authentification
- MessagesService: Messagerie

### 2. **Réutilisabilité**
- ProfileService exporté → utilisable par autres modules
- Logique profil centralisée
- Pas de duplication mapping

### 3. **Testabilité**
- Tests unitaires ProfileService indépendants
- Mocks UserService faciles
- Isolation logique métier

### 4. **Maintenabilité**
- Mapping `___xtr_customer` centralisé dans 1 endroit
- Changements DB impactent ProfileService uniquement
- Migration vers vraies données facilitée

### 5. **Performance**
- Cache profils via CacheService
- Évite requêtes DB répétées
- Invalidation cache sur updateProfile()

---

## ⚠️ RISQUES ET LIMITATIONS

### 1. **Overhead Appels**
- Chaque `await this.profileService.findById()` ajoute ~12 lignes vs appel direct
- 9+ appels findById() → +108 lignes overhead
- **Mitigation**: Acceptable car améliore architecture

### 2. **Pas de Circular Dependency**
- ProfileService ne doit **JAMAIS** importer UsersService
- **Solution**: ProfileService dépend uniquement de UserService (layer inférieur)

### 3. **Migration Mock → DB**
- getProfile() et findByEmail() utilisent encore mock data
- **Solution**: Phase 2.3 remplace mock par vraies queries

### 4. **Type Conversion**
- userId `number` (controller) vs `string` (DB)
- **Solution**: ProfileService accepte `string`, UsersService convertit

### 5. **Métriques Inférieures**
- Gain -62 lignes vs -150 estimé
- **Explication**: Pas de getUserStats/deleteAccount dans le code actuel

---

## 📝 PLAN D'EXÉCUTION PHASE 2.3

### Étape 1: Créer ProfileService (20 min)

```bash
# Créer fichier
touch backend/src/modules/users/services/profile.service.ts
```

**Contenu**:
- Classe ProfileService extends SupabaseBaseService
- Constructor: UserService, CacheService, ConfigService
- 4 méthodes publiques (getProfile, updateProfile, findById, findByEmail)
- 1 méthode privée mapToUserResponse()
- Remplacer mock data par vraies queries DB

### Étape 2: Ajouter au UsersModule (5 min)

```typescript
// users.module.ts
providers: [
  UsersService,
  ProfileService, // ← AJOUTER
  ...
],
exports: [
  UsersService,
  ProfileService, // ← AJOUTER
  ...
],
```

### Étape 3: Délégation dans UsersService (25 min)

**Modifier**:
- Constructor: Injecter ProfileService
- getProfile(): Déléguer vers profileService.getProfile()
- updateProfile(): Déléguer vers profileService.updateProfile()
- findById(): Déléguer vers profileService.findById()
- findByEmail(): Déléguer vers profileService.findByEmail()

**Supprimer**:
- Implémentation complète des 4 méthodes (gardées comme wrapper)

### Étape 4: Tests Compilation (5 min)

```bash
npm run build
```

**Vérifier**:
- 0 erreur TypeScript
- Imports ProfileService corrects
- Pas de circular dependency

### Étape 5: Validation Fonctionnelle (10 min)

```bash
# Tester endpoints profil
curl http://localhost:3000/api/users/profile -H "Authorization: Bearer TOKEN"
curl -X PATCH http://localhost:3000/api/users/profile -d '{"firstName":"Test"}' -H "Authorization: Bearer TOKEN"
```

### Étape 6: Documentation (15 min)

**Créer**:
- `JOUR2-PHASE2.3-EXECUTION-LOG.md`: Log détaillé implémentation
- Documenter dans ce fichier les résultats

### Étape 7: Commit Git (5 min)

```bash
git add backend/src/modules/users/services/profile.service.ts
git add backend/src/modules/users/users.service.ts
git add backend/src/modules/users/users.module.ts
git add docs/JOUR2-PHASE2.3-*.md

git commit -m "refactor(users): JOUR 2 Phase 2.3 - Création ProfileService

✅ Création ProfileService dédié gestion profils
- getProfile(): Migration mock → vraies données UserService
- updateProfile(): Ajout UPDATE DB (était simulation)
- findById(): Factorisation mapping ___xtr_customer
- findByEmail(): Migration mock → query Supabase directe
- mapToUserResponse(): Méthode utilitaire mapping centralisé

✅ Configuration modules
- UsersModule: ProfileService dans providers + exports
- UsersService: Injection ProfileService, délégation 4 méthodes

📊 Métriques
- UsersService: -112 lignes (méthodes migrées) +50 lignes (délégations) = -62 lignes nettes
- ProfileService créé: 128 lignes (77 logique + 51 overhead)
- Total JOUR 2: Phase 2.1 (-29) + Phase 2.2 (+7) + Phase 2.3 (-62) = -84 lignes

🎯 Améliorations
- ❌ AVANT: Mock data getMockUsers(), simulation updateProfile
- ✅ APRÈS: Vraies queries ___xtr_customer, UPDATE DB persist
- ✅ Mapping centralisé (1 seul endroit)
- ✅ Architecture: ProfileService réutilisable par autres modules
- ✅ Cache profils via CacheService

📚 Documentation
- JOUR2-PHASE2.3-ANALYSE-PROFILE.md: Analyse complète
- JOUR2-PHASE2.3-EXECUTION-LOG.md: Log implémentation

✅ Validation
- 0 erreurs TypeScript
- Pas de circular dependency
- Tests endpoints profil OK

📦 État JOUR 2: -84 lignes total (UsersService: 1069 → 985)
📦 Prochaine étape: Phase 2.4 - Tests et nettoyage final"
```

---

## 🎯 SUCCÈS ATTENDUS PHASE 2.3

### Métriques
- ✅ UsersService: 1069 → 985 lignes (-84 lignes depuis début JOUR 2)
- ✅ ProfileService créé: 128 lignes
- ✅ Architecture: 4 services spécialisés (Auth, Messages, Profile, Addresses)

### Qualité
- ✅ Mock data remplacé par vraies queries DB
- ✅ updateProfile() persiste changements
- ✅ Mapping ___xtr_customer centralisé
- ✅ 0 circular dependency

### Tests
- ✅ Compilation OK
- ✅ Endpoints profil fonctionnels
- ✅ Pas de régression authentification

---

**État**: Analyse complète Phase 2.3 terminée  
**Prochain**: Exécution création ProfileService + délégation
