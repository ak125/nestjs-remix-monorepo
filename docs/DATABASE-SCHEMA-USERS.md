# Schéma Base de Données - Table Users

## Table: `___xtr_customer`

### Structure Complète

| Colonne DB | Type | Nullable | Description | Mapping DTO |
|------------|------|----------|-------------|-------------|
| `cst_id` | text | ❌ | ID unique utilisateur | `id` |
| `cst_mail` | text | ❌ | Email (unique) | `email` |
| `cst_pswd` | text | ❌ | Mot de passe hashé | `password` |
| `cst_keylog` | text | ✅ | Clé de connexion/session | `keylog` |
| `cst_civility` | text | ✅ | Civilité (M./Mme) | `civility` |
| `cst_name` | text | ❌ | Nom de famille | `lastName` |
| `cst_fname` | text | ❌ | Prénom | `firstName` |
| `cst_address` | text | ✅ | Adresse principale | `address` |
| `cst_zip_code` | text | ✅ | Code postal | `zipCode` |
| `cst_city` | text | ✅ | Ville | `city` |
| `cst_country` | text | ✅ | Pays | `country` |
| `cst_tel` | text | ✅ | Téléphone fixe | `phone` |
| `cst_gsm` | text | ✅ | Téléphone mobile | `mobile` |
| `cst_is_cpy` | text | ✅ | Est une entreprise (0/1) | `isCompany` |
| `cst_rs` | text | ✅ | Raison sociale | `companyName` |
| `cst_siret` | text | ✅ | SIRET | `siret` |
| `cst_is_pro` | text | ✅ | Est un professionnel (0/1) | `isPro` |
| `cst_activ` | text | ✅ | Statut actif (0/1) | `isActive` |
| `cst_level` | text | ✅ | Niveau utilisateur | `level` |
| `cst_password_changed_at` | timestamptz | ✅ | Date changement mdp | `passwordChangedAt` |

### Notes Importantes

#### 1. Champs Obligatoires (NOT NULL)
```typescript
// Champs requis pour créer un utilisateur
{
  cst_id: string;      // Généré (UUID)
  cst_mail: string;    // Email unique
  cst_pswd: string;    // Hash du mot de passe
  cst_name: string;    // Nom (lastName)
  cst_fname: string;   // Prénom (firstName)
}
```

#### 2. Type `text` pour Booléens
⚠️ **ATTENTION**: Les booléens sont stockés comme `text` avec valeurs "0" ou "1"

```typescript
// Conversion nécessaire
const isPro = user.cst_is_pro === "1";
const isActive = user.cst_activ === "1";
const isCompany = user.cst_is_cpy === "1";
```

#### 3. Nomenclature `cst_*`
- Tous les champs préfixés `cst_` (customer)
- Convention legacy de la base PHP

### Mapping DTOs Actuels

#### CreateUserDto → Table
```typescript
// DTO
{
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  civility?: string;
  isPro?: boolean;
}

// → Transformation DB
{
  cst_id: generateUUID(),
  cst_mail: email,
  cst_pswd: await hashPassword(password),
  cst_fname: firstName,
  cst_name: lastName,
  cst_tel: phone,
  cst_civility: civility,
  cst_is_pro: isPro ? "1" : "0",
  cst_activ: "1",  // Par défaut actif
  cst_level: "1"   // Par défaut niveau 1
}
```

#### RegisterDto → Table
```typescript
// DTO (auth/dto/register.dto.ts)
{
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  acceptTerms: boolean;
}

// → Transformation DB (identique à CreateUserDto)
```

#### UpdateUserDto → Table
```typescript
// DTO
{
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  mobile?: string;
  civility?: string;
  address?: string;
  zipCode?: string;
  city?: string;
  country?: string;
  companyName?: string;
  siret?: string;
  isActive?: boolean;
}

// → Transformation DB
{
  cst_mail?: email,
  cst_fname?: firstName,
  cst_name?: lastName,
  cst_tel?: phone,
  cst_gsm?: mobile,
  cst_civility?: civility,
  cst_address?: address,
  cst_zip_code?: zipCode,
  cst_city?: city,
  cst_country?: country,
  cst_rs?: companyName,
  cst_siret?: siret,
  cst_activ?: isActive ? "1" : "0"
}
```

### Queries Prisma/Supabase

#### Sélection Utilisateur
```typescript
// Supabase
const { data } = await this.supabase
  .from('___XTR_CUSTOMER')
  .select(`
    cst_id,
    cst_mail,
    cst_name,
    cst_fname,
    cst_tel,
    cst_gsm,
    cst_civility,
    cst_address,
    cst_zip_code,
    cst_city,
    cst_country,
    cst_is_cpy,
    cst_rs,
    cst_siret,
    cst_is_pro,
    cst_activ,
    cst_level,
    cst_password_changed_at
  `)
  .eq('cst_mail', email)
  .single();
```

#### Insertion Utilisateur
```typescript
const { data } = await this.supabase
  .from('___XTR_CUSTOMER')
  .insert({
    cst_id: generateUUID(),
    cst_mail: email,
    cst_pswd: hashedPassword,
    cst_name: lastName,
    cst_fname: firstName,
    cst_tel: phone || null,
    cst_is_pro: isPro ? "1" : "0",
    cst_activ: "1",
    cst_level: "1"
  })
  .select()
  .single();
```

#### Mise à Jour Utilisateur
```typescript
const { data } = await this.supabase
  .from('___XTR_CUSTOMER')
  .update({
    cst_fname: firstName,
    cst_name: lastName,
    cst_tel: phone,
    cst_activ: isActive ? "1" : "0"
  })
  .eq('cst_id', userId)
  .select()
  .single();
```

### Tables Associées

#### Adresses de Facturation
- Table: `___XTR_CUSTOMER_BILLING_ADDRESS`
- Relation: `cst_id` (FK vers `___xtr_customer.cst_id`)

#### Adresses de Livraison
- Table: `___XTR_CUSTOMER_DELIVERY_ADDRESS`
- Relation: `cst_id` (FK vers `___xtr_customer.cst_id`)

#### Messages
- Table: `___XTR_MSG`
- Relation: `msg_cst_id` (FK vers `___xtr_customer.cst_id`)

#### Commandes
- Table: `___XTR_ORDER`
- Relation: `ord_cst_id` (FK vers `___xtr_customer.cst_id`)

### Validation des Données

#### Contraintes Métier
```typescript
// Email
- Format: RFC 5322 compliant
- Unique dans la base
- Obligatoire

// Password
- Multi-format supporté: bcrypt, MD5, SHA1, DES, plain
- Vérification via PasswordCryptoService
- Longueur min: 8 caractères (nouveau)

// Nom/Prénom
- Obligatoires
- Pas de contrainte de longueur en DB (text)
- Recommandé: 2-50 caractères

// isPro
- Stocké: "0" ou "1"
- Défaut: "0"
- Impact: Accès fonctionnalités B2B

// isActive
- Stocké: "0" ou "1"
- Défaut: "1"
- "0" = compte désactivé (login impossible)

// Level
- Stocké: texte (ex: "1", "2", "3")
- "1" = utilisateur standard
- "99" = administrateur
- "100" = super admin
```

### Statistiques Actuelles

**État de la base (Oct 2025):**
- **Total utilisateurs**: 59,142
- **Utilisateurs actifs** (`cst_activ = "1"`): ~58,000
- **Professionnels** (`cst_is_pro = "1"`): ~12,500
- **Entreprises** (`cst_is_cpy = "1"`): ~8,300

### Migrations Nécessaires

#### ⚠️ Problèmes Identifiés

1. **Types Booléens en TEXT**
   - Risque: Valeurs incohérentes ("", "true", "false", "0", "1")
   - Solution: Validation stricte + normalisation

2. **Pas de Timestamps Créa/Modif**
   - Manque: `created_at`, `updated_at`
   - Impact: Impossible de tracer les changements
   - Solution future: Ajouter colonnes + triggers

3. **ID en TEXT vs UUID**
   - Actuel: `cst_id` en text (UUIDs stockés)
   - Recommandé: Type UUID natif PostgreSQL
   - Migration future potentielle

4. **Champs Legacy Non Utilisés**
   - `cst_keylog`: À investiguer (possiblement obsolète)
   - Impact: Aucun si non utilisé

### Bonnes Pratiques

#### Utilisation de SupabaseBaseService
```typescript
// Ne jamais exposer cst_pswd
const userColumns = `
  cst_id,
  cst_mail,
  cst_name,
  cst_fname,
  -- PAS cst_pswd !
  cst_is_pro,
  cst_activ
`;
```

#### Transformation Systématique
```typescript
// Toujours transformer DB → DTO
function mapUserFromDB(dbUser: any): User {
  return {
    id: dbUser.cst_id,
    email: dbUser.cst_mail,
    firstName: dbUser.cst_fname,
    lastName: dbUser.cst_name,
    isPro: dbUser.cst_is_pro === "1",
    isActive: dbUser.cst_activ === "1",
    level: parseInt(dbUser.cst_level || "1", 10),
    // ...
  };
}
```

#### Sécurité
```typescript
// JAMAIS inclure password dans les réponses
// TOUJOURS hasher avant insert/update
// TOUJOURS valider email unique avant insert
```

---

**Dernière mise à jour**: Jour 1 - Phase Testing (Oct 2025)  
**Validé sur**: 59,142 utilisateurs réels
