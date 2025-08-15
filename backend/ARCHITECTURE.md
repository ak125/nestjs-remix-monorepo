# 🏗️ Architecture Guidelines - NestJS Backend

## 📊 Hiérarchie des Services

```
┌─────────────────────────────────────────┐
│         Services Métier (Top)           │
│   (UsersService, AuthService, etc.)     │
│   - Orchestration de la logique métier  │
│   - Utilise les services de données     │
└────────────────┬────────────────────────┘
                 │ Utilise
┌────────────────▼────────────────────────┐
│      Services de Données (Middle)       │
│  (UserDataService, OrderDataService)    │
│   - CRUD pour une table spécifique      │
│   - Hérite de SupabaseBaseService       │
└────────────────┬────────────────────────┘
                 │ Hérite
┌────────────────▼────────────────────────┐
│     SupabaseBaseService (Base)          │
│   - Client Supabase partagé             │
│   - Méthodes utilitaires communes       │
└─────────────────────────────────────────┘
```

## ✅ RÈGLES OBLIGATOIRES

### 1️⃣ Services de Données (Data Layer)
```typescript
// ✅ CORRECT - Hérite de SupabaseBaseService
export class UserDataService extends SupabaseBaseService {
  async findById(id: string) {
    return this.client
      .from('___xtr_customer')
      .select('*')
      .eq('cst_id', id)
      .single();
  }
}
```

### 2️⃣ Services Métier (Business Layer)
```typescript
// ✅ CORRECT - N'hérite PAS, utilise l'injection
export class UsersService {
  constructor(
    private userDataService: UserDataService,
    private addressDataService: AddressDataService,
  ) {}

  async createUserWithAddress(data: CreateUserDto) {
    // Orchestration de plusieurs services
    const user = await this.userDataService.create(data.user);
    const address = await this.addressDataService.create({
      ...data.address,
      userId: user.id
    });
    return { user, address };
  }
}
```

### 3️⃣ Services Spécialisés (Feature Services)
```typescript
// ✅ CORRECT - Hérite SI gère sa propre table
export class PasswordResetService extends SupabaseBaseService {
  constructor(
    configService: ConfigService,
    private userDataService: UserDataService, // Pour accéder aux users
  ) {
    super(configService);
  }

  async createResetToken(email: string) {
    // Utilise this.client pour sa table
    const token = await this.client
      .from('password_resets')
      .insert({...});
    
    // Utilise userDataService pour les users
    const user = await this.userDataService.findByEmail(email);
  }
}
```

## ❌ ANTI-PATTERNS À ÉVITER

```typescript
// ❌ INCORRECT - N'utilisez jamais DatabaseService
constructor(private db: DatabaseService) {} // N'existe pas!

// ❌ INCORRECT - Service métier qui hérite de SupabaseBaseService
export class UsersService extends SupabaseBaseService {} // Trop couplé!

// ❌ INCORRECT - Accès direct au client dans un service métier
export class UsersService {
  async getUser() {
    return this.client.from('users')... // Pas d'accès direct!
  }
}
```

## 📁 Structure des Dossiers

```
backend/src/
├── database/
│   ├── services/
│   │   ├── supabase-base.service.ts    # Base commune
│   │   ├── user-data.service.ts        # CRUD users
│   │   ├── order-data.service.ts       # CRUD orders
│   │   └── address-data.service.ts     # CRUD addresses
│   └── database.module.ts
├── modules/
│   ├── users/
│   │   ├── users.service.ts            # Logique métier users
│   │   ├── password.service.ts         # Gestion passwords (hérite de base)
│   │   └── users.module.ts
│   └── auth/
│       ├── auth.service.ts             # Logique métier auth
│       └── auth.module.ts
```

## 🎯 Checklist de Validation

- [ ] Pas de `DatabaseService` dans le code
- [ ] Services de données héritent de `SupabaseBaseService`
- [ ] Services métier utilisent l'injection
- [ ] Pas d'accès direct au client Supabase dans les services métier
- [ ] Une responsabilité par service

## 🔄 Migration Status

- [x] Architecture définie
- [ ] Services corrigés
- [ ] Tests validés
- [ ] Documentation mise à jour
