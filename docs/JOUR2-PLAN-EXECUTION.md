# 🚀 JOUR 2 - Délégation et ProfileService

**Date**: 4 octobre 2025  
**Phase**: Jour 2 - Délégation vers services existants + Création ProfileService  
**Durée estimée**: 6h  
**Statut**: En cours

---

## 🎯 OBJECTIFS JOUR 2

### Matin (3h)
1. ✅ Supprimer doublon CreateUserDto dans users.dto.ts
2. 🔄 Importer AuthService dans UsersService
3. 🔄 Déléguer register() → AuthService.register()
4. 🔄 Déléguer login() → AuthService.login()
5. 🔄 Déléguer messages → MessagesService
6. 🧪 Tests délégation

### Après-midi (3h)
7. 🆕 Créer ProfileService
8. ⬆️ Migrer méthodes profil depuis UsersService
9. 🧪 Tests ProfileService
10. 🔗 Intégrer dans UsersModule

---

## 📋 PHASE 1 - Nettoyage final DTOs

### Action 1.1 - Supprimer doublon CreateUserDto

**Problème détecté**:
```typescript
// users.dto.ts (ligne 57-61) ❌ DOUBLON
export interface CreateUserDto {
  email: string;
  name: string;    // ❌ Incompatible avec version Zod
  password: string;
}
```

**Conflit avec**:
```typescript
// create-user.dto.ts ✅ VERSION OFFICIELLE
export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),  // ✅ firstName/lastName (pas "name")
  lastName: z.string().min(1),
  // ... autres champs
});
```

**Action**: Supprimer l'interface CreateUserDto de users.dto.ts

---

## 📋 PHASE 2 - Délégation vers AuthService

### Analyse des méthodes à déléguer

**Fichier**: `/backend/src/modules/users/users.service.ts`

**Méthodes actuelles dans UsersService**:
```typescript
// LIGNE 55-93
async register(registerDto: RegisterDto): Promise<UserResponseDto> {
  // 40 lignes de code
  // ❌ DOUBLON avec AuthService.register()
}

// LIGNE 93-130
async login(loginDto: LoginDto): Promise<LoginResponseDto> {
  // 37 lignes de code
  // ❌ DOUBLON avec AuthService.login()
}
```

**Ces méthodes existent DÉJÀ dans AuthService** (`/auth/auth.service.ts`):
```typescript
// AuthService (803 lignes)
async register(dto: RegisterDto) { ... }
async login(dto: LoginDto) { ... }
async authenticateUser(email, password) { ... }
```

**Solution**: Déléguer UsersService → AuthService

---

## 📋 PHASE 3 - Délégation vers MessagesService

**Méthodes actuelles dans UsersService** (lignes ~550-650):
```typescript
async sendMessage(userId, dto) {
  // Envoyer un message
  // ❌ Devrait utiliser MessagesService
}

async getMessages(userId) {
  // Récupérer messages
  // ❌ Devrait utiliser MessagesService
}

async markMessageAsRead(userId, messageId) {
  // Marquer comme lu
  // ❌ Devrait utiliser MessagesService
}
```

**Ces méthodes existent dans MessagesService** (`/modules/messages/messages.service.ts`):
```typescript
// MessagesService (152 lignes)
async createMessage(data: CreateMessageDto) { ... }
async getMessages(filters: MessageFilters) { ... }
async markAsRead(messageId, userId) { ... }
```

**Solution**: Déléguer UsersService → MessagesService

---

## 📋 PHASE 4 - Création ProfileService

### Structure ProfileService

**Localisation**: `/backend/src/modules/users/services/profile.service.ts`

**Responsabilité**: Gestion des profils utilisateurs

**Méthodes à migrer depuis UsersService**:
```typescript
✅ getProfile(userId: number): Promise<UserProfile>
✅ updateProfile(userId: number, dto: UpdateProfileDto): Promise<UserProfile>
✅ deleteAccount(userId: number): Promise<void>
✅ getUserStats(userId: number): Promise<UserStats>
✅ findById(userId: number): Promise<User | null>
✅ findByEmail(email: string): Promise<User | null>
```

**Architecture**:
```typescript
@Injectable()
export class ProfileService extends SupabaseBaseService {
  constructor(
    configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {
    super(configService);
  }

  // Méthodes profil
}
```

---

## 🔧 PLAN D'EXÉCUTION DÉTAILLÉ

### Étape 1: Supprimer doublon CreateUserDto ✅
- [ ] Supprimer interface de users.dto.ts
- [ ] Vérifier imports
- [ ] Compiler

### Étape 2: Importer AuthService dans UsersService
- [ ] Ajouter import AuthService
- [ ] Injecter dans constructor
- [ ] Vérifier dépendances circulaires

### Étape 3: Déléguer register()
- [ ] Remplacer implémentation par délégation
- [ ] Tests

### Étape 4: Déléguer login()
- [ ] Remplacer implémentation par délégation
- [ ] Tests

### Étape 5: Déléguer messages
- [ ] Importer MessagesService
- [ ] Déléguer sendMessage()
- [ ] Déléguer getMessages()
- [ ] Tests

### Étape 6: Créer ProfileService
- [ ] Créer fichier service
- [ ] Copier méthodes depuis UsersService
- [ ] Adapter pour SupabaseBaseService
- [ ] Créer tests

### Étape 7: Intégrer ProfileService
- [ ] Ajouter dans UsersModule
- [ ] Exporter
- [ ] Déléguer depuis UsersService

### Étape 8: Tests complets
- [ ] Tests unitaires
- [ ] Tests d'intégration
- [ ] Vérifier aucune régression

---

## 📊 MÉTRIQUES ATTENDUES

### Avant Jour 2
- UsersService: 1092 lignes
- AuthService: 803 lignes (existant)
- MessagesService: 152 lignes (existant)
- ProfileService: N/A

### Après Jour 2
- UsersService: ~800 lignes (-292 lignes, -27%)
- AuthService: 803 lignes (inchangé)
- MessagesService: 152 lignes (inchangé)
- ProfileService: ~150-200 lignes (nouveau)

---

**Prêt à démarrer ?** 🚀

Démarrons par l'Étape 1: Supprimer doublon CreateUserDto
