# Feature Spec: Config Module

**Phase**: 3 Extended (Feature 15/18)  
**Coverage**: +1 module → 77% (27/37 modules)  
**Endpoints**: 36 total (4 controllers: Simple, Enhanced, Metadata, Database)  
**Architecture**: 6 services + 2 validators  
**Lines**: ~1800 (services) + ~800 (controllers) + ~400 (validators/schemas)

---

## 1. Objectif Métier

Module complet de **gestion configuration** avec multi-niveaux : application, environnement, database, metadata, breadcrumbs. Validation Zod, cache Redis, audit trail.

**Business Value**:
- ⚙️ Configuration dynamique (runtime updates, no redeploy)
- 🗄️ Database config (Supabase `___config` table)
- 🔐 Environment validation (required vars check)
- 📋 Metadata management (SEO, social, analytics)
- 🍞 Breadcrumbs config (navigation trails)
- 💾 Cache intégration (Redis TTL 1h)
- ✅ Validation Zod (schemas types enforcement)
- 📊 Stats & analytics (config usage tracking)

**Use Cases**:
- Admin: Update app settings (name, logo, domain, contact)
- Developers: Database config (host, port, credentials)
- Marketing: SEO metadata (title, description, keywords)
- System: Environment validation (startup checks)
- Monitoring: Config audit trail (changes history)

---

## 2. Endpoints Structure (36 Total)

### 2.1 Simple Config Controller - 6 endpoints

**Base**: `GET /api/config/app`

1. `GET /health` - Health check
2. `GET /test-connection` - Test database
3. `GET /` - Get all app config
4. `GET /value/:key` - Get config value by key
5. `PUT /value/:key` - Update config value
6. `GET /stats` - Config statistics

### 2.2 Enhanced Config Controller - 10 endpoints

**Base**: `GET /api/config/enhanced`

1. `GET /health` - Health check
2. `GET /test-db` - Test Supabase connection
3. `GET /:key` - Get config by key
4. `POST /` - Create config
5. `PUT /:key` - Update config
6. `DELETE /:key` - Delete config
7. `POST /import` - Import configs (bulk)
8. `GET /export` - Export configs (backup)
9. `POST /restore` - Restore from backup
10. `GET /history/:key` - Config change history

### 2.3 Enhanced Metadata Controller - 10 endpoints

**Base**: `GET /api/config/metadata`

1. `GET /health` - Health check
2. `GET /` - Get all metadata
3. `GET /:key` - Get metadata by key
4. `POST /` - Create metadata
5. `PUT /:key` - Update metadata
6. `DELETE /:key` - Delete metadata
7. `GET /category/:category` - Get by category (SEO, social, analytics)
8. `POST /bulk` - Bulk update metadata
9. `GET /validate` - Validate metadata
10. `GET /stats` - Metadata statistics

### 2.4 Simple Database Config Controller - 10 endpoints

**Base**: `GET /api/config/database`

1. `GET /health` - Health check
2. `GET /` - List all database configs
3. `GET /:environment` - Get config by environment (dev, staging, prod)
4. `POST /test` - Test database connection
5. `GET /stats` - Database config stats
6. `POST /invalidate-cache` - Invalidate cache
7. `GET /environments` - List available environments
8. `PUT /:environment` - Update database config
9. `DELETE /:environment` - Delete database config
10. `GET /active` - Get active database config

---

## 3. Endpoints Détails (Top 15 Most Used)

### 3.1 GET /api/config/app

**Description**: Récupère toute la configuration application  
**Controller**: `SimpleConfigController.getAppConfig()`  
**Service**: `SimpleConfigService.getAppConfig()`

**Query Params**: Aucun

**Response Example**:
```json
{
  "cnf_id": "1",
  "cnf_name": "Mon Application E-Commerce",
  "cnf_logo": "https://cdn.example.com/logo.png",
  "cnf_domain": "www.example.com",
  "cnf_slogan": "Votre slogan ici",
  "cnf_address": "123 Rue Example, Paris 75001",
  "cnf_mail": "contact@example.com",
  "cnf_phone": "+33 1 23 45 67 89",
  "cnf_phone_call": "+33123456789",
  "cnf_group_name": "Groupe Example",
  "cnf_group_domain": "groupe-example.com",
  "cnf_tva": "FR12345678901",
  "cnf_shipping": "Livraison gratuite dès 50€"
}
```

**Business Logic**:
- Load from cache (Redis `config:app_config`, TTL 1h)
- If cache miss → query Supabase `___config` table (cnf_id = '1')
- Cache result for 1 hour
- Return full config object

**Use Case**: Display app info in frontend (header, footer, contact page)

---

### 3.2 PUT /api/config/app/value/:key

**Description**: Met à jour une valeur de configuration  
**Controller**: `SimpleConfigController.updateConfigValue()`  
**Service**: `SimpleConfigService.updateConfigValue()`

**Path Params**:
- `key` (string): Config key (ex: `cnf_name`, `cnf_logo`, `cnf_mail`)

**Body**:
```json
{
  "value": "Nouveau Nom Application"
}
```

**Response Example**:
```json
{
  "message": "Configuration updated successfully"
}
```

**Business Logic**:
1. Validate key exists in AppConfig interface
2. Update Supabase `___config` table (WHERE cnf_id = '1')
3. Invalidate cache (`config:app_config`)
4. Return success message

**Security**: Admin-only endpoint

---

### 3.3 GET /api/config/enhanced/:key

**Description**: Récupère config par clé (enhanced)  
**Controller**: `EnhancedConfigController.getConfig()`  
**Service**: `EnhancedConfigService.get()`

**Path Params**:
- `key` (string): Config key (ex: `app.debug`, `payment.enabled`)

**Response Example**:
```json
{
  "key": "app.debug",
  "value": "true"
}
```

**Business Logic**:
- Load from cache (Redis `config:{key}`, TTL 1h)
- If cache miss → query Supabase `___config` table (WHERE config_key = key)
- Cache result
- Return key-value pair

**Use Case**: Dynamic feature flags, runtime settings

---

### 3.4 POST /api/config/enhanced

**Description**: Crée nouvelle configuration  
**Controller**: `EnhancedConfigController.setConfig()`  
**Service**: `EnhancedConfigService.set()`

**Body**:
```json
{
  "key": "feature.new_checkout",
  "value": "enabled",
  "description": "Enable new checkout flow"
}
```

**Response Example**:
```json
{
  "message": "Configuration set successfully"
}
```

**Business Logic**:
1. Validate key format (regex: `^[a-zA-Z][a-zA-Z0-9_.-]*$`)
2. Check if key already exists (error if exists)
3. Insert into Supabase `___config` table
4. Set cache (`config:{key}`, TTL 1h)
5. Log audit trail (who, when, old value, new value)
6. Return success message

**Security**: Admin-only

---

### 3.5 POST /api/config/enhanced/import

**Description**: Import configurations bulk (backup restore)  
**Controller**: `EnhancedConfigController.importConfigs()`  
**Service**: `EnhancedConfigService.importConfigs()`

**Body**:
```json
{
  "configs": [
    { "key": "app.name", "value": "My App", "description": "App name" },
    { "key": "app.debug", "value": "false", "description": "Debug mode" }
  ],
  "overwrite": true
}
```

**Response Example**:
```json
{
  "message": "10 configurations imported successfully",
  "imported": 10,
  "skipped": 2,
  "errors": []
}
```

**Business Logic**:
1. Validate configs array (Zod schema)
2. For each config:
   - Check if exists
   - If overwrite = true → UPDATE
   - Else → INSERT (skip if exists)
3. Invalidate all config cache
4. Return import stats (imported, skipped, errors)

**Security**: Super Admin only

---

### 3.6 GET /api/config/enhanced/export

**Description**: Export toutes configurations (backup)  
**Controller**: `EnhancedConfigController.exportConfigs()`  
**Service**: `EnhancedConfigService.exportConfigs()`

**Query Params**: Aucun

**Response Example**:
```json
{
  "timestamp": "2025-11-15T12:30:00Z",
  "configs": [
    {
      "cnf_id": "1",
      "cnf_name": "My App",
      "cnf_logo": "https://...",
      "cnf_domain": "example.com"
    }
  ],
  "metadata": {
    "total": 1,
    "exported_by": "admin@example.com",
    "version": "1.0.0"
  }
}
```

**Business Logic**:
- Query all configs from Supabase `___config`
- Format as ConfigBackup (timestamp, configs array, metadata)
- Return JSON (can be saved as .json file)

**Use Case**: Backup before major changes, config migration

---

### 3.7 GET /api/config/metadata

**Description**: Récupère toutes métadonnées  
**Controller**: `EnhancedMetadataController.getAllMetadata()`  
**Service**: `EnhancedMetadataService.getAllMetadata()`

**Query Params**: Aucun

**Response Example**:
```json
{
  "seo": {
    "title": "Mon Site E-Commerce - Achat en ligne",
    "description": "Découvrez notre sélection de produits...",
    "keywords": ["e-commerce", "achat", "livraison"],
    "og_image": "https://cdn.example.com/og-image.jpg"
  },
  "social": {
    "facebook": "https://facebook.com/myapp",
    "twitter": "@myapp",
    "instagram": "@myapp"
  },
  "analytics": {
    "google_analytics": "UA-XXXXXXXXX-1",
    "facebook_pixel": "123456789",
    "gtm_container": "GTM-XXXXXX"
  }
}
```

**Business Logic**:
- Load from cache (Redis `metadata:all`, TTL 1h)
- If cache miss → query Supabase metadata table
- Group by category (SEO, social, analytics)
- Cache result
- Return structured metadata

**Use Case**: Frontend meta tags, SEO optimization

---

### 3.8 POST /api/config/metadata/bulk

**Description**: Mise à jour bulk metadata  
**Controller**: `EnhancedMetadataController.bulkUpdateMetadata()`  
**Service**: `EnhancedMetadataService.bulkUpdate()`

**Body**:
```json
{
  "updates": [
    { "key": "seo.title", "value": "New Title" },
    { "key": "seo.description", "value": "New Description" },
    { "key": "analytics.google_analytics", "value": "UA-NEW-ID" }
  ]
}
```

**Response Example**:
```json
{
  "message": "3 metadata updated successfully",
  "updated": 3,
  "errors": []
}
```

**Business Logic**:
1. Validate updates array (Zod)
2. For each update:
   - Validate key exists
   - Update metadata table
3. Invalidate metadata cache
4. Return bulk update stats

**Security**: Admin-only

---

### 3.9 GET /api/config/database/:environment

**Description**: Récupère config database par environnement  
**Controller**: `SimpleDatabaseConfigController.getConfig()`  
**Service**: `SimpleDatabaseConfigService.getConfig()`

**Path Params**:
- `environment` (string): `development` | `staging` | `production`

**Response Example**:
```json
{
  "environment": "production",
  "host": "db.supabase.co",
  "port": 5432,
  "database": "postgres",
  "username": "postgres",
  "password": "***encrypted***",
  "ssl": true,
  "pool": {
    "min": 2,
    "max": 10
  }
}
```

**Business Logic**:
- Load from cache (Redis `db_config:{environment}`, TTL 30min)
- If cache miss → build from environment variables
  - `DATABASE_HOST_PROD`, `DATABASE_PORT_PROD`, etc.
- Default values for missing vars
- Mask password (show only `***encrypted***`)
- Cache result
- Return database config

**Security**: Super Admin only (sensitive data)

---

### 3.10 POST /api/config/database/test

**Description**: Test connexion database  
**Controller**: `SimpleDatabaseConfigController.testDatabaseConnection()`  
**Service**: `SimpleDatabaseConfigService.testDatabaseConnection()`

**Body**:
```json
{
  "host": "db.example.com",
  "port": 5432,
  "database": "mydb",
  "username": "user",
  "password": "pass"
}
```

**Response Example** (success):
```json
{
  "success": true,
  "message": "Connection successful",
  "duration": 234,
  "serverVersion": "PostgreSQL 14.5"
}
```

**Response Example** (failure):
```json
{
  "success": false,
  "message": "Connection failed",
  "error": "Connection timeout",
  "duration": 5000
}
```

**Business Logic**:
1. Validate connection config (Zod)
2. Attempt connection (timeout 5s)
3. If success → query server version
4. If failure → capture error message
5. Return connection test result

**Use Case**: Validate database config before deployment

---

### 3.11 GET /api/config/app/stats

**Description**: Statistiques configuration  
**Controller**: `SimpleConfigController.getStats()`  
**Service**: `SimpleConfigService.getConfigStats()`

**Response Example**:
```json
{
  "total_fields": 12,
  "filled_fields": 10,
  "empty_fields": 2,
  "last_updated": "2025-11-15T12:30:00Z",
  "most_updated_fields": [
    { "field": "cnf_name", "updates": 45 },
    { "field": "cnf_logo", "updates": 23 }
  ]
}
```

**Business Logic**:
- Count total fields in AppConfig
- Count filled vs empty fields
- Query last update timestamp
- Query audit trail (most updated fields)
- Return stats object

**Use Case**: Admin dashboard, config health monitoring

---

### 3.12 GET /api/config/enhanced/history/:key

**Description**: Historique changements config  
**Controller**: `EnhancedConfigController.getConfigHistory()`  
**Service**: `EnhancedConfigService.getHistory()`

**Path Params**:
- `key` (string): Config key

**Query Params**:
- `limit` (number, default: 50): Max results
- `offset` (number, default: 0): Pagination offset

**Response Example**:
```json
{
  "key": "app.debug",
  "history": [
    {
      "timestamp": "2025-11-15T12:30:00Z",
      "old_value": "false",
      "new_value": "true",
      "changed_by": "admin@example.com",
      "ip_address": "192.168.1.100",
      "user_agent": "Chrome/120.0"
    },
    {
      "timestamp": "2025-11-14T10:20:00Z",
      "old_value": "true",
      "new_value": "false",
      "changed_by": "dev@example.com",
      "ip_address": "192.168.1.50",
      "user_agent": "Firefox/120.0"
    }
  ],
  "total": 125,
  "page": 1,
  "pages": 3
}
```

**Business Logic**:
- Query audit trail table (config_audit_log)
- Filter by config key
- Order by timestamp DESC
- Paginate (limit, offset)
- Return history with pagination metadata

**Use Case**: Audit trail, compliance, troubleshooting

---

### 3.13 GET /api/config/metadata/category/:category

**Description**: Métadonnées par catégorie  
**Controller**: `EnhancedMetadataController.getMetadataByCategory()`  
**Service**: `EnhancedMetadataService.getByCategory()`

**Path Params**:
- `category` (string): `seo` | `social` | `analytics` | `tracking`

**Response Example** (category: seo):
```json
{
  "category": "seo",
  "metadata": {
    "title": "Mon Site E-Commerce",
    "description": "Description SEO optimisée...",
    "keywords": ["keyword1", "keyword2"],
    "og_title": "Open Graph Title",
    "og_description": "OG Description",
    "og_image": "https://cdn.example.com/og-image.jpg",
    "twitter_card": "summary_large_image",
    "canonical_url": "https://www.example.com"
  }
}
```

**Business Logic**:
- Load from cache (Redis `metadata:category:{category}`, TTL 1h)
- If cache miss → query metadata table (WHERE category = :category)
- Parse values (JSON arrays, booleans)
- Cache result
- Return category metadata

**Use Case**: SEO module integration, social sharing

---

### 3.14 POST /api/config/database/invalidate-cache

**Description**: Invalide cache database config  
**Controller**: `SimpleDatabaseConfigController.invalidateCache()`  
**Service**: `SimpleDatabaseConfigService.invalidateCache()`

**Body**:
```json
{
  "environment": "production"
}
```

**Response Example**:
```json
{
  "message": "Cache invalidated successfully",
  "environments": ["production"]
}
```

**Business Logic**:
- If environment specified → invalidate Redis `db_config:{environment}`
- Else → invalidate all database config cache (pattern `db_config:*`)
- Return success message with environments list

**Use Case**: Force reload after database config change

---

### 3.15 GET /api/config/metadata/validate

**Description**: Valide metadata schema  
**Controller**: `EnhancedMetadataController.validateMetadata()`  
**Service**: `EnhancedMetadataService.validate()`

**Query Params**: Aucun

**Response Example** (valid):
```json
{
  "isValid": true,
  "errors": [],
  "warnings": [
    "SEO description is short (< 120 chars)"
  ]
}
```

**Response Example** (invalid):
```json
{
  "isValid": false,
  "errors": [
    "seo.title is required",
    "analytics.google_analytics invalid format (expected UA-XXXXXXXX-X)"
  ],
  "warnings": []
}
```

**Business Logic**:
1. Load all metadata
2. Validate against Zod schemas:
   - SEO: title (required), description (required, 50-160 chars), keywords (array)
   - Social: URLs (valid format)
   - Analytics: IDs (valid format patterns)
3. Check warnings (optional fields, recommendations)
4. Return validation result

**Use Case**: Pre-deployment validation, config health check

---

## 4. Architecture Services

### 4.1 SimpleConfigService - 150 lignes

**Location**: `/backend/src/modules/config/services/simple-config.service.ts`  
**Responsibility**: Configuration application basique (table `___config`)

**Méthodes**:
```typescript
async getAppConfig(): Promise<AppConfig | null>
// Load app config (cnf_id = '1')

async getConfigValue(key: keyof AppConfig): Promise<string | null>
// Get single config value by key

async updateConfigValue(key: keyof AppConfig, value: string): Promise<void>
// Update single config value + invalidate cache

async getConfigStats(): Promise<ConfigStats>
// Statistics (total fields, filled, last update)

async testDatabaseConnection(): Promise<{ status: string; message: string }>
// Test Supabase connection
```

**Cache**: Redis `config:app_config`, TTL 1h

---

### 4.2 EnhancedConfigService - 370 lignes

**Location**: `/backend/src/modules/config/services/enhanced-config.service.ts`  
**Responsibility**: Configuration avancée (key-value, audit, backup)

**Méthodes**:
```typescript
async loadAppConfig(): Promise<ConfigItem | null>
// Load main app config (cnf_id = '1')

async get(key: string): Promise<string | null>
// Get config by key (config_key column)

async set(key: string, value: string, description?: string): Promise<void>
// Set config (INSERT or UPDATE) + audit trail

async delete(key: string): Promise<void>
// Delete config + audit trail

async exportConfigs(): Promise<ConfigBackup>
// Export all configs as backup JSON

async importConfigs(backup: ConfigBackup): Promise<{ imported: number; skipped: number }>
// Import configs from backup (bulk restore)

async getHistory(key: string, limit?: number): Promise<AuditLog[]>
// Get change history for config key

private encrypt(value: string): string
// Encrypt sensitive values (AES-256)

private decrypt(value: string): string
// Decrypt sensitive values
```

**Encryption**: AES-256-GCM (for sensitive values like passwords, API keys)  
**Audit Trail**: Logs all changes (who, when, old value, new value, IP, user agent)

---

### 4.3 EnhancedMetadataService - 250 lignes

**Location**: `/backend/src/modules/config/services/enhanced-metadata.service.ts`  
**Responsibility**: Metadata management (SEO, social, analytics)

**Méthodes**:
```typescript
async getAllMetadata(): Promise<MetadataCollection>
// Load all metadata grouped by category

async getByCategory(category: MetadataCategory): Promise<Record<string, any>>
// Load metadata for specific category (SEO, social, analytics)

async get(key: string): Promise<string | null>
// Get metadata value by key

async set(key: string, value: any, category?: string): Promise<void>
// Set metadata (auto-detect or specify category)

async bulkUpdate(updates: MetadataUpdate[]): Promise<BulkUpdateResult>
// Bulk update metadata (multiple keys at once)

async validate(): Promise<ValidationResult>
// Validate all metadata against schemas

async delete(key: string): Promise<void>
// Delete metadata entry

async getStats(): Promise<MetadataStats>
// Statistics (total metadata, by category, missing required)
```

**Categories**:
- `seo`: Title, description, keywords, og_image, canonical_url
- `social`: Facebook, Twitter, Instagram, LinkedIn URLs
- `analytics`: Google Analytics, Facebook Pixel, GTM container
- `tracking`: Matomo, Hotjar, custom tracking codes

---

### 4.4 SimpleDatabaseConfigService - 200 lignes

**Location**: `/backend/src/modules/config/services/simple-database-config.service.ts`  
**Responsibility**: Database configuration per environment

**Méthodes**:
```typescript
async getConfig(environment?: string, port?: number): Promise<DatabaseConfig>
// Get database config for environment (dev, staging, prod)

async listConfigs(): Promise<DatabaseConfig[]>
// List all database configs (all environments)

async testDatabaseConnection(config: DatabaseConfig): Promise<DatabaseConnectionTest>
// Test database connection (timeout 5s)

async getStats(): Promise<DatabaseConfigStats>
// Statistics (total configs, by environment, active, with SSL)

async invalidateCache(environment?: string): Promise<void>
// Invalidate cache for environment or all

private buildConfigFromEnvironment(environment: string, port: number): DatabaseConfig
// Build config from env vars (DATABASE_HOST_PROD, etc.)

private getDefaultPort(environment: string): number
// Get default port by environment (5432 for PostgreSQL)
```

**Environment Variables Pattern**:
```
DATABASE_HOST_DEV
DATABASE_PORT_DEV
DATABASE_NAME_DEV
DATABASE_USER_DEV
DATABASE_PASSWORD_DEV

DATABASE_HOST_PROD
DATABASE_PORT_PROD
...
```

---

### 4.5 DatabaseConfigService - 180 lignes

**Location**: `/backend/src/modules/config/services/database-config.service.ts`  
**Responsibility**: Enhanced database config (type-safe, validation)

**Méthodes**:
```typescript
async getDatabaseConfig(environment: ConfigEnvironment): Promise<DatabaseConfig>
// Type-safe database config getter

async getCacheConfig(): Promise<CacheConfig>
// Cache configuration (Redis)

async getSecurityConfig(): Promise<SecurityConfig>
// Security configuration (JWT, encryption, rate limiting)

async getMonitoringConfig(): Promise<MonitoringConfig>
// Monitoring config (logging, metrics, alerts)

async validateConfig(configKey: string): Promise<ConfigValidationResult>
// Validate config against schema

async getFullConfig(): Promise<FullConfigSchema>
// Get complete config (app, database, cache, security, monitoring)
```

**TypeScript Interfaces** (type-safe):
```typescript
interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  pool: { min: number; max: number };
}

interface CacheConfig {
  enabled: boolean;
  host: string;
  port: number;
  ttl: number;
  maxMemory: string;
}
```

---

### 4.6 BreadcrumbService - 120 lignes

**Location**: `/backend/src/modules/config/services/breadcrumb.service.ts`  
**Responsibility**: Breadcrumb navigation config

**Méthodes**:
```typescript
async getBreadcrumbConfig(): Promise<BreadcrumbConfig>
// Get breadcrumb configuration (separator, home label, max depth)

async setBreadcrumbConfig(config: Partial<BreadcrumbConfig>): Promise<void>
// Update breadcrumb config

async generateBreadcrumbs(path: string): Promise<Breadcrumb[]>
// Generate breadcrumbs for URL path

async validateBreadcrumbPath(path: string): Promise<boolean>
// Validate breadcrumb path format
```

**BreadcrumbConfig**:
```typescript
interface BreadcrumbConfig {
  separator: string;          // " > " or " / "
  homeLabel: string;          // "Accueil"
  showHome: boolean;          // true
  maxDepth: number;           // 5
  truncateLabel: number;      // 30 chars
}

interface Breadcrumb {
  label: string;
  url: string;
  isActive: boolean;
}
```

**Use Case**: Auto-generate breadcrumbs for SEO and navigation

---

## 5. Validators & Schemas

### 5.1 ConfigValidator - 200 lignes

**Location**: `/backend/src/modules/config/validators/config.validator.ts`  
**Responsibility**: Validation Zod pour configs

**Méthodes**:
```typescript
async validateCreateConfig(dto: CreateConfigDto): Promise<ValidationResult>
// Validate config creation (key, value, type, description)

async validateUpdateConfig(dto: UpdateConfigDto): Promise<ValidationResult>
// Validate config update (at least 1 field required)

validateValueByType(value: any, type: ConfigType): ValidationResult
// Type-specific validation (string, number, boolean, JSON, array)

validateConfigKey(key: string): ValidationResult
// Key format validation (regex: ^[a-zA-Z][a-zA-Z0-9_.-]*$)

validateConfigCategory(category: string): ValidationResult
// Category format validation
```

**Zod Schemas**:
```typescript
const createConfigSchema = z.object({
  key: z.string()
    .regex(/^[a-zA-Z][a-zA-Z0-9_.-]*$/)
    .min(2).max(100),
  value: z.any(),
  type: z.nativeEnum(ConfigType),
  description: z.string().max(500).optional(),
  category: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/).max(50).optional(),
  isPublic: z.boolean().optional(),
  isReadOnly: z.boolean().optional()
});

const updateConfigSchema = z.object({
  value: z.any().optional(),
  type: z.nativeEnum(ConfigType).optional(),
  description: z.string().max(500).optional(),
  category: z.string().max(50).optional(),
  isPublic: z.boolean().optional(),
  isReadOnly: z.boolean().optional()
}).refine(data => Object.keys(data).length > 0);
```

**ConfigType Enum**:
```typescript
enum ConfigType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  JSON = 'json',
  ARRAY = 'array'
}
```

---

### 5.2 EnvironmentValidator - 100 lignes

**Location**: `/backend/src/modules/config/validators/environment.validator.ts`  
**Responsibility**: Validation variables environnement (startup check)

**Méthodes**:
```typescript
validate(): EnvironmentValidationResult
// Validate all environment variables
// Check required, recommended, format, values
```

**Validation Rules**:

**Required Variables**:
- `NODE_ENV` (development | production | test)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`

**Recommended Variables**:
- `REDIS_URL`
- `PORT`

**Validation Checks**:
```typescript
// NODE_ENV validation
if (!['development', 'production', 'test'].includes(process.env.NODE_ENV)) {
  errors.push('NODE_ENV invalide');
}

// PORT validation
if (PORT < 1 || PORT > 65535) {
  errors.push('PORT invalide');
}

// JWT_SECRET strength
if (JWT_SECRET.length < 32) {
  warnings.push('JWT_SECRET devrait contenir au moins 32 caractères');
}
```

**Return Type**:
```typescript
interface EnvironmentValidationResult {
  isValid: boolean;
  errors: string[];    // Critical errors (app won't start)
  warnings: string[];  // Recommendations (app will start)
}
```

**Use Case**: Run on app startup (main.ts bootstrap)

---

## 6. Database Schema

### 6.1 Table: ___config

**Purpose**: Configuration application principale

**Schema**:
```sql
CREATE TABLE ___config (
  cnf_id VARCHAR PRIMARY KEY,
  cnf_name VARCHAR,
  cnf_logo VARCHAR,              -- URL logo
  cnf_domain VARCHAR,            -- Domain principal
  cnf_slogan VARCHAR,
  cnf_address TEXT,              -- Adresse physique
  cnf_mail VARCHAR,              -- Email contact
  cnf_phone VARCHAR,             -- Téléphone affiché
  cnf_phone_call VARCHAR,        -- Téléphone cliquable (format: +33123456789)
  cnf_group_name VARCHAR,        -- Nom groupe (si multi-marques)
  cnf_group_domain VARCHAR,      -- Domain groupe
  cnf_tva VARCHAR,               -- Numéro TVA
  cnf_shipping TEXT,             -- Info livraison
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Sample Data**:
```sql
INSERT INTO ___config (cnf_id, cnf_name, cnf_logo, cnf_domain, cnf_mail, cnf_phone)
VALUES (
  '1',
  'Mon E-Commerce',
  'https://cdn.example.com/logo.png',
  'www.example.com',
  'contact@example.com',
  '+33 1 23 45 67 89'
);
```

**Note**: `cnf_id = '1'` is main app config (singleton pattern)

---

### 6.2 Table: config_items (Enhanced Config)

**Purpose**: Configuration key-value flexible

**Schema**:
```sql
CREATE TABLE config_items (
  id SERIAL PRIMARY KEY,
  config_key VARCHAR(100) UNIQUE NOT NULL,
  config_value TEXT,
  config_type VARCHAR(20),       -- string, number, boolean, json, array
  description VARCHAR(500),
  category VARCHAR(50),          -- app, database, cache, security, etc.
  is_public BOOLEAN DEFAULT false,
  is_read_only BOOLEAN DEFAULT false,
  is_encrypted BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_config_key ON config_items(config_key);
CREATE INDEX idx_config_category ON config_items(category);
```

**Sample Data**:
```sql
INSERT INTO config_items (config_key, config_value, config_type, category, is_public)
VALUES 
  ('app.debug', 'false', 'boolean', 'app', true),
  ('app.maintenance_mode', 'false', 'boolean', 'app', true),
  ('payment.stripe.enabled', 'true', 'boolean', 'payment', false),
  ('cache.default_ttl', '3600', 'number', 'cache', false);
```

---

### 6.3 Table: config_audit_log

**Purpose**: Audit trail (change history)

**Schema**:
```sql
CREATE TABLE config_audit_log (
  id SERIAL PRIMARY KEY,
  config_key VARCHAR(100) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by VARCHAR(255),       -- User email
  changed_at TIMESTAMP DEFAULT NOW(),
  ip_address VARCHAR(45),        -- IPv4 or IPv6
  user_agent TEXT,
  action VARCHAR(20)             -- CREATE, UPDATE, DELETE
);

CREATE INDEX idx_audit_key ON config_audit_log(config_key);
CREATE INDEX idx_audit_changed_at ON config_audit_log(changed_at DESC);
CREATE INDEX idx_audit_changed_by ON config_audit_log(changed_by);
```

**Sample Data**:
```sql
INSERT INTO config_audit_log (config_key, old_value, new_value, changed_by, ip_address, action)
VALUES (
  'app.debug',
  'false',
  'true',
  'admin@example.com',
  '192.168.1.100',
  'UPDATE'
);
```

---

### 6.4 Table: metadata_items

**Purpose**: Metadata (SEO, social, analytics)

**Schema**:
```sql
CREATE TABLE metadata_items (
  id SERIAL PRIMARY KEY,
  meta_key VARCHAR(100) UNIQUE NOT NULL,
  meta_value TEXT,
  meta_category VARCHAR(50),     -- seo, social, analytics, tracking
  description VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_meta_key ON metadata_items(meta_key);
CREATE INDEX idx_meta_category ON metadata_items(meta_category);
```

**Sample Data**:
```sql
INSERT INTO metadata_items (meta_key, meta_value, meta_category)
VALUES 
  ('seo.title', 'Mon Site E-Commerce - Achat en ligne', 'seo'),
  ('seo.description', 'Découvrez notre sélection...', 'seo'),
  ('analytics.google_analytics', 'UA-XXXXXXXXX-1', 'analytics'),
  ('social.facebook', 'https://facebook.com/myapp', 'social');
```

---

## 7. Frontend Integration

### 7.1 Config API Service

**Location**: `/frontend/app/services/api/config.api.ts`

**Methods**:
```typescript
class ConfigApiService {
  async getAppConfig(): Promise<AppConfig>
  // GET /api/config/app
  
  async updateConfigValue(key: string, value: string): Promise<void>
  // PUT /api/config/app/value/:key
  
  async getConfigStats(): Promise<ConfigStats>
  // GET /api/config/app/stats
  
  async getAllMetadata(): Promise<MetadataCollection>
  // GET /api/config/metadata
  
  async bulkUpdateMetadata(updates: MetadataUpdate[]): Promise<void>
  // POST /api/config/metadata/bulk
  
  async validateConfig(key: string, value: any): Promise<ValidationResult>
  // POST /api/config/validate
  
  async exportConfigs(): Promise<ConfigBackup>
  // GET /api/config/enhanced/export
  
  async importConfigs(backup: ConfigBackup): Promise<ImportResult>
  // POST /api/config/enhanced/import
}
```

---

### 7.2 Admin Config Dashboard

**Location**: `/frontend/app/routes/admin.system-config._index.tsx`

**Features**:
- App config editor (name, logo, domain, contact)
- Database config viewer (per environment)
- Metadata editor (SEO, social, analytics)
- Config validation (pre-save checks)
- Export/Import configs (backup/restore)
- Audit trail viewer (change history)
- Stats dashboard (total configs, filled, last update)

**Sections**:
1. **Application Settings**
   - Name, logo, domain, slogan
   - Contact info (email, phone, address)
   - Company info (TVA, group name)

2. **Database Configuration**
   - Environment selector (dev, staging, prod)
   - Connection details (host, port, database)
   - Test connection button
   - Pool settings (min, max connections)

3. **Metadata Management**
   - SEO tab (title, description, keywords)
   - Social tab (Facebook, Twitter, Instagram URLs)
   - Analytics tab (Google Analytics, Facebook Pixel, GTM)
   - Validation status (errors, warnings)

4. **Backup & Restore**
   - Export configs button → download JSON
   - Import configs file upload
   - Restore from backup (with overwrite option)

5. **Audit Trail**
   - Recent changes table (key, old value, new value, who, when)
   - Filter by config key
   - Filter by user
   - Date range picker

---

### 7.3 Config Context Provider

**Location**: `/frontend/app/contexts/ConfigContext.tsx`

**Purpose**: Global config state management

```typescript
interface ConfigContextValue {
  appConfig: AppConfig | null;
  metadata: MetadataCollection | null;
  loading: boolean;
  error: Error | null;
  
  refreshConfig: () => Promise<void>;
  updateConfig: (key: string, value: string) => Promise<void>;
  validateConfig: (key: string, value: any) => Promise<boolean>;
}

const ConfigProvider = ({ children }) => {
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [metadata, setMetadata] = useState<MetadataCollection | null>(null);
  
  useEffect(() => {
    // Load config on mount
    loadConfig();
  }, []);
  
  const loadConfig = async () => {
    const config = await configApi.getAppConfig();
    const meta = await configApi.getAllMetadata();
    setAppConfig(config);
    setMetadata(meta);
  };
  
  return (
    <ConfigContext.Provider value={{ appConfig, metadata, ... }}>
      {children}
    </ConfigContext.Provider>
  );
};
```

**Usage**:
```typescript
// In any component
const { appConfig, updateConfig } = useConfig();

return (
  <div>
    <h1>{appConfig?.cnf_name}</h1>
    <img src={appConfig?.cnf_logo} />
  </div>
);
```

---

## 8. Business Rules

### 8.1 Cache Strategy

**Redis Keys Pattern**:
```
config:app_config               → Full app config (TTL 1h)
config:{key}                    → Enhanced config key-value (TTL 1h)
metadata:all                    → All metadata (TTL 1h)
metadata:category:{category}    → Metadata by category (TTL 1h)
db_config:{environment}         → Database config (TTL 30min)
```

**Cache Invalidation**:
- On config UPDATE → invalidate specific key + `config:app_config`
- On metadata UPDATE → invalidate `metadata:all` + `metadata:category:{category}`
- On database config UPDATE → invalidate `db_config:{environment}`

**Cache Refresh**:
- Manual: Admin dashboard "Refresh Config" button
- Automatic: TTL expiration (1h for most, 30min for database)

---

### 8.2 Security Rules

**Sensitive Data Encryption**:
- Database passwords (AES-256-GCM)
- API keys (AES-256-GCM)
- JWT secrets (AES-256-GCM)
- Payment credentials (AES-256-GCM)

**Encryption Key Storage**:
- Environment variable: `CONFIG_ENCRYPTION_KEY`
- Minimum 32 characters
- Rotate every 90 days (recommended)

**Access Control**:
- **Public configs**: `is_public = true` (can be read by anyone)
- **Private configs**: `is_public = false` (admin-only)
- **Read-only configs**: `is_read_only = true` (cannot be modified via API)

**Admin-Only Endpoints**:
- PUT /api/config/app/value/:key
- POST /api/config/enhanced
- PUT /api/config/enhanced/:key
- DELETE /api/config/enhanced/:key
- POST /api/config/enhanced/import
- POST /api/config/metadata/bulk
- GET /api/config/database/:environment

---

### 8.3 Validation Rules

**Config Key Format**:
- Regex: `^[a-zA-Z][a-zA-Z0-9_.-]*$`
- Min length: 2 characters
- Max length: 100 characters
- Must start with letter
- Examples: `app.debug`, `payment.stripe.enabled`, `cache.default_ttl`

**Config Value by Type**:
- **string**: Any text (max 10000 chars)
- **number**: Valid number (integer or float)
- **boolean**: `true` | `false` (string or boolean)
- **json**: Valid JSON object
- **array**: Valid JSON array

**Metadata Validation**:
- **SEO title**: Required, 30-70 characters
- **SEO description**: Required, 50-160 characters
- **SEO keywords**: Array, max 10 keywords
- **Google Analytics**: Format `UA-XXXXXXXX-X` or `G-XXXXXXXXXX`
- **Facebook Pixel**: Numeric, 15 digits
- **URLs**: Valid HTTP/HTTPS format

---

### 8.4 Audit Trail Rules

**Logged Actions**:
- CREATE: New config created
- UPDATE: Config value changed
- DELETE: Config deleted
- IMPORT: Configs imported from backup
- EXPORT: Configs exported (logged as READ)

**Captured Information**:
- Config key
- Old value (before change)
- New value (after change)
- Changed by (user email)
- Changed at (timestamp)
- IP address (request IP)
- User agent (browser/client)
- Action type (CREATE, UPDATE, DELETE)

**Retention Policy**:
- Keep audit logs for 1 year
- Archive logs older than 1 year (move to cold storage)
- Admin can view last 1000 changes per config key

---

## 9. Integration Modules

### 9.1 SEO Module

**Use Case**: Dynamic meta tags

**Integration**:
```typescript
// SEOService
async generateMetaTags(route: string): Promise<MetaTags> {
  // 1. Get metadata from ConfigService
  const metadata = await this.configService.getMetadata();
  
  // 2. Build meta tags
  const metaTags = {
    title: metadata.seo.title,
    description: metadata.seo.description,
    keywords: metadata.seo.keywords.join(', '),
    og_title: metadata.seo.og_title,
    og_description: metadata.seo.og_description,
    og_image: metadata.seo.og_image,
    canonical: `${metadata.seo.canonical_url}${route}`
  };
  
  return metaTags;
}
```

---

### 9.2 Analytics Module

**Use Case**: Tracking codes injection

**Integration**:
```typescript
// AnalyticsService
async getTrackingCodes(): Promise<TrackingCodes> {
  const metadata = await this.configService.getMetadata();
  
  return {
    googleAnalytics: metadata.analytics.google_analytics,
    facebookPixel: metadata.analytics.facebook_pixel,
    gtmContainer: metadata.analytics.gtm_container,
    hotjar: metadata.tracking.hotjar_id
  };
}
```

**Frontend Injection** (app/root.tsx):
```tsx
export function loader() {
  const trackingCodes = await analyticsService.getTrackingCodes();
  return { trackingCodes };
}

export default function App() {
  const { trackingCodes } = useLoaderData<typeof loader>();
  
  return (
    <html>
      <head>
        {/* Google Analytics */}
        {trackingCodes.googleAnalytics && (
          <script async src={`https://www.googletagmanager.com/gtag/js?id=${trackingCodes.googleAnalytics}`} />
        )}
        
        {/* Facebook Pixel */}
        {trackingCodes.facebookPixel && (
          <script dangerouslySetInnerHTML={{
            __html: `fbq('init', '${trackingCodes.facebookPixel}');`
          }} />
        )}
      </head>
      <body>
        <Outlet />
      </body>
    </html>
  );
}
```

---

### 9.3 Email Module

**Use Case**: Email footer configuration

**Integration**:
```typescript
// EmailService
async sendEmail(to: string, subject: string, body: string): Promise<void> {
  const appConfig = await this.configService.getAppConfig();
  
  const footer = `
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ccc;">
      <p><strong>${appConfig.cnf_name}</strong></p>
      <p>${appConfig.cnf_address}</p>
      <p>Email: ${appConfig.cnf_mail} | Téléphone: ${appConfig.cnf_phone}</p>
      <p>TVA: ${appConfig.cnf_tva}</p>
    </div>
  `;
  
  const fullBody = body + footer;
  
  await this.emailProvider.send({ to, subject, html: fullBody });
}
```

---

### 9.4 Breadcrumb Module

**Use Case**: Auto-generate navigation breadcrumbs

**Integration**:
```typescript
// BreadcrumbService (from ConfigModule)
async generateBreadcrumbs(path: string): Promise<Breadcrumb[]> {
  const config = await this.getBreadcrumbConfig();
  
  const segments = path.split('/').filter(Boolean);
  const breadcrumbs: Breadcrumb[] = [];
  
  // Home breadcrumb
  if (config.showHome) {
    breadcrumbs.push({
      label: config.homeLabel,
      url: '/',
      isActive: false
    });
  }
  
  // Path segments
  let currentPath = '';
  for (let i = 0; i < segments.length && i < config.maxDepth; i++) {
    currentPath += `/${segments[i]}`;
    const label = segments[i].replace(/-/g, ' ');
    
    breadcrumbs.push({
      label: label.length > config.truncateLabel 
        ? label.substring(0, config.truncateLabel) + '...'
        : label,
      url: currentPath,
      isActive: i === segments.length - 1
    });
  }
  
  return breadcrumbs;
}
```

**Frontend Usage**:
```tsx
// app/components/Breadcrumbs.tsx
export function Breadcrumbs({ path }: { path: string }) {
  const { data: breadcrumbs } = useSWR(`/api/breadcrumbs?path=${path}`);
  const config = useBreadcrumbConfig();
  
  return (
    <nav>
      {breadcrumbs?.map((crumb, i) => (
        <span key={i}>
          {i > 0 && <span>{config.separator}</span>}
          {crumb.isActive ? (
            <span>{crumb.label}</span>
          ) : (
            <Link to={crumb.url}>{crumb.label}</Link>
          )}
        </span>
      ))}
    </nav>
  );
}
```

---

## 10. Error Handling

### 10.1 Config Errors

**Config Not Found**:
```json
{
  "success": false,
  "error": "Configuration non trouvée: app.unknown_key",
  "code": "CONFIG_NOT_FOUND"
}
```

**Invalid Config Key**:
```json
{
  "success": false,
  "error": "Clé de configuration invalide: 123invalid (doit commencer par une lettre)",
  "code": "INVALID_CONFIG_KEY"
}
```

**Read-Only Config**:
```json
{
  "success": false,
  "error": "Configuration en lecture seule: system.version",
  "code": "CONFIG_READ_ONLY"
}
```

---

### 10.2 Validation Errors

**Invalid Type**:
```json
{
  "success": false,
  "error": "Type invalide: 'abc' n'est pas un nombre",
  "code": "INVALID_TYPE",
  "expected": "number",
  "received": "string"
}
```

**Value Out of Range**:
```json
{
  "success": false,
  "error": "Valeur hors limites: port doit être entre 1 et 65535",
  "code": "VALUE_OUT_OF_RANGE"
}
```

---

### 10.3 Database Errors

**Connection Failed**:
```json
{
  "success": false,
  "error": "Échec de connexion à la base de données",
  "code": "DATABASE_CONNECTION_FAILED",
  "details": "Connection timeout after 5000ms"
}
```

**Query Error**:
```json
{
  "success": false,
  "error": "Erreur lors de la lecture de la configuration",
  "code": "DATABASE_QUERY_ERROR",
  "details": "relation '___config' does not exist"
}
```

---

## 11. Performance

### 11.1 Cache Optimization

**Multi-Level Caching**:
```typescript
// Level 1: In-memory cache (fastest)
private memoryCache = new Map<string, { value: any; expiry: number }>();

// Level 2: Redis cache (shared across instances)
async get(key: string): Promise<any> {
  // Check memory cache first
  const memoryCached = this.memoryCache.get(key);
  if (memoryCached && memoryCached.expiry > Date.now()) {
    return memoryCached.value;
  }
  
  // Check Redis cache
  const redisCached = await this.cacheService.get(key);
  if (redisCached) {
    // Populate memory cache
    this.memoryCache.set(key, {
      value: redisCached,
      expiry: Date.now() + 300000 // 5 min
    });
    return redisCached;
  }
  
  // Load from database
  const dbValue = await this.loadFromDatabase(key);
  
  // Cache in both levels
  await this.cacheService.set(key, dbValue, 3600); // 1h
  this.memoryCache.set(key, {
    value: dbValue,
    expiry: Date.now() + 300000 // 5 min
  });
  
  return dbValue;
}
```

---

### 11.2 Lazy Loading

**Config on Demand**:
```typescript
// Don't load all configs at startup
// Load specific configs when needed

async getConfig(key: string): Promise<any> {
  // Only load this specific config
  return this.enhancedConfigService.get(key);
}
```

---

### 11.3 Batch Operations

**Bulk Metadata Update**:
```typescript
async bulkUpdate(updates: MetadataUpdate[]): Promise<void> {
  // Single database transaction
  await this.supabase.transaction(async (trx) => {
    for (const update of updates) {
      await trx('metadata_items')
        .where('meta_key', update.key)
        .update({ meta_value: update.value });
    }
  });
  
  // Invalidate cache once (not per update)
  await this.cacheService.del('metadata:all');
}
```

---

## 12. Testing

### 12.1 Endpoint Tests

**Get App Config**:
```bash
curl http://localhost:3000/api/config/app
# Expected: { cnf_id: "1", cnf_name: "...", ... }
```

**Update Config**:
```bash
curl -X PUT http://localhost:3000/api/config/app/value/cnf_name \
  -H "Content-Type: application/json" \
  -d '{"value":"New App Name"}'
# Expected: { message: "Configuration updated successfully" }
```

**Test Database Connection**:
```bash
curl -X POST http://localhost:3000/api/config/database/test \
  -H "Content-Type: application/json" \
  -d '{
    "host":"localhost",
    "port":5432,
    "database":"mydb",
    "username":"user",
    "password":"pass"
  }'
# Expected: { success: true, duration: 234, serverVersion: "PostgreSQL 14.5" }
```

---

### 12.2 Unit Tests

```typescript
describe('EnhancedConfigService', () => {
  test('should get config from cache', async () => {
    await cacheService.set('config:app.debug', 'true', 3600);
    
    const value = await configService.get('app.debug');
    
    expect(value).toBe('true');
  });

  test('should set config and invalidate cache', async () => {
    await configService.set('app.new_key', 'value', 'Test key');
    
    const cached = await cacheService.get('config:app.new_key');
    expect(cached).toBe('value');
  });

  test('should validate config key format', () => {
    const result = validator.validateConfigKey('app.debug');
    expect(result.isValid).toBe(true);
    
    const invalid = validator.validateConfigKey('123invalid');
    expect(invalid.isValid).toBe(false);
  });
});
```

---

## 13. Migration Notes

### 13.1 Database Setup

**Create Tables**:
```sql
-- Run migrations
CREATE TABLE ___config (...);
CREATE TABLE config_items (...);
CREATE TABLE config_audit_log (...);
CREATE TABLE metadata_items (...);

-- Insert default data
INSERT INTO ___config (cnf_id, cnf_name, cnf_domain, cnf_mail)
VALUES ('1', 'My App', 'example.com', 'contact@example.com');

INSERT INTO metadata_items (meta_key, meta_value, meta_category)
VALUES 
  ('seo.title', 'My App - Home', 'seo'),
  ('seo.description', 'Welcome to My App', 'seo');
```

---

### 13.2 Environment Variables Migration

**Old**: Hardcoded configs  
**New**: Environment variables

**Migration Script**:
```typescript
async migrateToEnvVars() {
  // Read old configs from database
  const oldConfigs = await this.loadLegacyConfigs();
  
  // Generate .env file
  const envContent = oldConfigs.map(config => 
    `${config.key.toUpperCase().replace('.', '_')}=${config.value}`
  ).join('\n');
  
  await fs.writeFile('.env.new', envContent);
  
  console.log('Migration complete. Review .env.new and merge with .env');
}
```

---

## 14. Summary

**Module Config**: Gestion configuration multi-niveaux avec validation Zod, cache Redis, audit trail complet.

**Endpoints**: 36 total (4 controllers)
- Simple Config: 6 endpoints (app config basique)
- Enhanced Config: 10 endpoints (key-value, audit, backup)
- Metadata: 10 endpoints (SEO, social, analytics)
- Database Config: 10 endpoints (per environment)

**Services**: 6 total
- SimpleConfigService (150 lignes, app config basique)
- EnhancedConfigService (370 lignes, key-value + audit)
- EnhancedMetadataService (250 lignes, metadata management)
- SimpleDatabaseConfigService (200 lignes, database config)
- DatabaseConfigService (180 lignes, type-safe config)
- BreadcrumbService (120 lignes, navigation config)
- Total: ~1270 lignes

**Validators**: 2 total
- ConfigValidator (200 lignes, Zod validation)
- EnvironmentValidator (100 lignes, startup validation)
- Total: ~300 lignes

**Features**:
- Configuration dynamique (runtime updates)
- Multi-niveaux (app, database, metadata, breadcrumbs)
- Validation Zod (type enforcement)
- Cache Redis (TTL 1h app, 30min database)
- Audit trail (change history avec IP, user agent)
- Encryption AES-256-GCM (sensitive data)
- Backup/Restore (export/import JSON)
- Environment validation (startup checks)

**Configuration Types**:
- **Application**: Name, logo, domain, contact, company info
- **Database**: Host, port, credentials, pool settings (per environment)
- **Metadata**: SEO (title, description, keywords), social URLs, analytics IDs
- **Breadcrumbs**: Separator, home label, max depth, truncate length

**Cache Strategy**:
- Pattern: `config:*`, `metadata:*`, `db_config:*`
- TTL: 1h (app/metadata), 30min (database)
- Multi-level: In-memory (5min) + Redis (1h)
- Invalidation: On UPDATE (specific key + related)

**Security**:
- Encryption: AES-256-GCM (passwords, API keys, secrets)
- Access control: Public vs Private configs
- Read-only configs (cannot be modified via API)
- Admin-only endpoints (PUT, POST, DELETE)
- Audit trail: Who, when, IP, user agent

**Validation**:
- Config key format: `^[a-zA-Z][a-zA-Z0-9_.-]*$`
- Value by type: string, number, boolean, JSON, array
- Metadata: SEO (30-70 chars title, 50-160 description)
- Environment: Required vars (NODE_ENV, SUPABASE_URL, JWT_SECRET)

**Integration**:
- SEO Module: Dynamic meta tags
- Analytics Module: Tracking codes injection
- Email Module: Footer configuration
- Breadcrumb Module: Auto-generate navigation

**Database**:
- `___config`: Main app config (cnf_id = '1')
- `config_items`: Key-value flexible configs
- `config_audit_log`: Change history
- `metadata_items`: SEO, social, analytics

**Testing**:
- Endpoint tests (curl app config, update, database test)
- Unit tests (cache, validation, audit)
- Integration tests (backup/restore, bulk update)

**Migration**:
- Database tables creation
- Default data insertion
- Environment variables migration (.env generation)

**Business Value**:
- Zero-downtime config updates (no redeploy)
- Centralized config management (single source of truth)
- Audit compliance (full change history)
- Security (encryption, access control)
- Performance (multi-level cache, lazy loading)
- Developer experience (type-safe, validation)

**Coverage**: +1 module → 77% (27/37 modules)
**Lines**: ~3000 total documentation
