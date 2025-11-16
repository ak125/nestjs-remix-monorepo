---
title: "Authentication System - Unified Customer & Staff Auth"
status: implemented
version: 1.0.0
authors: [Backend Team, Security Team]
created: 2025-11-14
updated: 2025-11-14
relates-to:
  - ../architecture/001-supabase-direct.md
  - ../architecture/004-state-management-frontend.md
tags: [auth, security, jwt, session, e-commerce, critical]
priority: critical
coverage:
  modules: [auth, users, sessions]
  routes: [/api/auth/*, /account/*, /admin/*]
---

# Authentication System - Unified Customer & Staff Auth

## 📝 Overview

Système d'authentification unifié gérant à la fois les **customers** (59k utilisateurs e-commerce) et le **staff** (admins, commerciaux). Utilise JWT tokens avec refresh token pattern, sessions Redis, et role-based access control (RBAC) pour sécuriser l'accès aux ressources.

Le système supporte les **mots de passe legacy** (MD5+crypt de l'ancien système) tout en migrant progressivement vers **bcrypt** (hashing moderne).

## 🎯 Goals

### Objectifs Principaux

1. **Authentification sécurisée** pour 59k+ utilisateurs
2. **Session management** avec Redis (7 jours de durée)
3. **Role-Based Access Control** (RBAC) : 10 niveaux (0-9)
4. **Protection brute-force** : rate limiting + compte bloqué après 5 tentatives
5. **Migration progressive** : MD5 → bcrypt sans interruption service
6. **Audit trail** : historique connexions, tentatives échouées

### Objectifs Secondaires

- Support multi-device (1 user = N sessions)
- Auto-logout après inactivité (optionnel)
- Password reset sécurisé (email + token)
- 2FA optionnel (future enhancement)

## 🚫 Non-Goals

- **OAuth/SSO** : Pas de Google/Facebook login (hors scope)
- **SAML** : Pas d'enterprise SSO
- **Biometric auth** : Pas de fingerprint/FaceID
- **Magic links** : Pas de passwordless login
- **Multi-tenancy** : 1 seul tenant (notre e-commerce)

## 👥 User Stories

### Story 1: Login Client E-commerce

**As a** customer  
**I want** to login avec email/password  
**So that** je peux accéder à mon compte, historique commandes, panier sauvegardé

**Acceptance Criteria:**

- [ ] Email + password validés (format email, min 6 chars password)
- [ ] JWT access token retourné (15min expiry)
- [ ] Refresh token retourné (7 jours expiry)
- [ ] Session créée dans Redis (user_id, level, email)
- [ ] Cookie `session_token` sécurisé (HttpOnly, Secure, SameSite)
- [ ] Niveau utilisateur (0-3 = customer, 4-6 = commercial, 7-9 = admin)
- [ ] Tentatives échouées comptabilisées (max 5 en 15min)
- [ ] Account bloqué si 5+ tentatives (déblocage automatique après 15min)
- [ ] Historique connexion enregistré (IP, user-agent, timestamp)

**User Flow:**

```
1. User saisit email + password sur /login
   → Frontend POST /api/auth/login
2. Backend vérifie credentials (customers table)
   → Si non trouvé, cherche dans admins table
3. Validation password (bcrypt ou legacy MD5+crypt)
   → Si MD5 legacy, rehash en bcrypt pour prochaine fois
4. Génération JWT tokens (access + refresh)
   → Access: 15min, Refresh: 7 jours
5. Création session Redis (key: session:{user_id}, TTL: 7j)
6. Set cookie `session_token` (HttpOnly, Secure)
7. Return { user, accessToken, refreshToken, expiresIn: 900 }
   → Frontend stocke accessToken en mémoire (pas localStorage)
8. Redirect → /account/dashboard
```

### Story 2: Accès Protégé avec Guards

**As a** developer  
**I want** to protect routes avec AuthGuard et RolesGuard  
**So that** seuls les utilisateurs authentifiés et autorisés accèdent aux ressources

**Acceptance Criteria:**

- [ ] `@UseGuards(AuthGuard('jwt'))` protège endpoints
- [ ] JWT extrait du header `Authorization: Bearer {token}`
- [ ] Token validé (signature, expiration)
- [ ] Payload décodé : `{ sub: user_id, email, userType, level }`
- [ ] `RolesGuard` vérifie niveau utilisateur (level >= required)
- [ ] 401 Unauthorized si token invalide/expiré
- [ ] 403 Forbidden si level insuffisant
- [ ] Request enrichi avec `req.user` (user_id, email, level)

**User Flow:**

```
1. Client envoie request avec token JWT
   → Header: Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR...
2. AuthGuard intercepte request
   → Extrait token du header
3. JwtService.verify(token)
   → Vérifie signature avec JWT_SECRET
   → Vérifie expiration (exp claim)
4. Si valide, payload décodé
   → { sub: "12345", email: "user@example.com", level: 5 }
5. RolesGuard vérifie level (si décorator @Roles(7) présent)
   → Si level < 7, throw ForbiddenException
6. Request.user = payload
   → Controller accède à req.user.sub, req.user.level
7. Response envoyée au client
```

### Story 3: Refresh Token après Expiration

**As a** logged-in user  
**I want** refresh automatique access token  
**So that** je reste connecté sans re-login tous les 15min

**Acceptance Criteria:**

- [ ] Refresh token stocké en cookie sécurisé
- [ ] Frontend détecte 401 sur API call
- [ ] Auto-call `POST /api/auth/refresh` avec refresh token
- [ ] Backend valide refresh token (non expiré, signature OK)
- [ ] Nouveau access token généré (15min)
- [ ] Optionnel : rotation refresh token (sécurité renforcée)
- [ ] Si refresh token invalide, logout forcé

**User Flow:**

```
1. Access token expire après 15min
   → API call retourne 401 Unauthorized
2. Frontend interceptor détecte 401
   → Auto-call POST /api/auth/refresh
3. Backend extrait refresh token du cookie/body
4. Validation refresh token
   → JwtService.verify(refreshToken)
   → Check Redis: session:{user_id} existe ?
5. Génération nouveau access token (15min)
   → Même payload : { sub, email, level }
6. Return { accessToken, expiresIn: 900 }
7. Frontend met à jour token en mémoire
8. Retry original API call avec nouveau token
   → Success
```

### Story 4: Password Reset Flow

**As a** customer  
**I want** to reset mon password si oublié  
**So that** je peux récupérer accès à mon compte

**Acceptance Criteria:**

- [ ] Request reset : POST /api/auth/forgot-password { email }
- [ ] Token reset généré (crypto random 32 bytes)
- [ ] Token stocké Redis (key: reset:{token}, value: user_id, TTL: 1h)
- [ ] Email envoyé avec lien : https://site.com/reset-password?token={token}
- [ ] Lien valide 1h
- [ ] Reset form : nouveau password + confirm
- [ ] Validation password : min 8 chars, 1 uppercase, 1 lowercase, 1 digit
- [ ] Hash password avec bcrypt (cost 10)
- [ ] Update database : customers.cst_pswd
- [ ] Invalidate token Redis
- [ ] Invalidate toutes sessions actives (force re-login)
- [ ] Email confirmation reset

**User Flow:**

```
1. User clique "Mot de passe oublié" sur /login
   → Saisit email → POST /api/auth/forgot-password
2. Backend cherche user par email
   → Si non trouvé, retourne success quand même (anti-enumeration)
3. Génération token reset (crypto.randomBytes(32).toString('hex'))
4. Stockage Redis : reset:{token} = user_id (TTL 1h)
5. Envoi email avec lien
   → https://site.com/reset-password?token={token}
6. User clique lien → Page reset form
7. Saisit nouveau password + confirm → POST /api/auth/reset-password
8. Backend valide token (Redis lookup)
9. Validation password strength
10. Hash password (bcrypt)
11. Update database
12. Invalidate token + sessions
13. Email confirmation + redirect /login
```

## 🔄 User Flows

### Flow 1: Login Complet (Customer)

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend Auth
    participant D as Database (Supabase)
    participant R as Redis

    U->>F: Saisit email + password
    F->>B: POST /api/auth/login
    B->>D: SELECT * FROM customers WHERE email=?
    D-->>B: User data + hashed password
    B->>B: Verify password (bcrypt/MD5)
    B->>B: Generate JWT tokens
    B->>R: SET session:{user_id} (TTL 7d)
    B->>D: INSERT INTO login_history
    B-->>F: { user, accessToken, refreshToken }
    F->>F: Store token in memory
    F->>U: Redirect /account/dashboard
```

### Flow 2: API Call Protégé

```mermaid
sequenceDiagram
    participant F as Frontend
    participant B as Backend API
    participant G as AuthGuard
    participant J as JwtService

    F->>B: GET /api/orders (Authorization: Bearer {token})
    B->>G: AuthGuard intercept
    G->>J: Verify JWT token
    J-->>G: Valid payload { sub, email, level }
    G->>B: req.user = payload
    B->>B: Controller logic
    B-->>F: Response 200 OK
```

### Flow 3: Logout

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend Auth
    participant R as Redis

    U->>F: Clique Logout
    F->>B: POST /api/auth/logout
    B->>R: DEL session:{user_id}
    B->>R: DEL refresh:{token}
    B->>F: Clear cookie session_token
    B-->>F: { success: true }
    F->>F: Clear access token from memory
    F->>U: Redirect /login
```

## 📋 Functional Requirements

### FR-1: User Authentication

**Description:** Valider credentials utilisateur et générer JWT tokens

**Priority:** Critical

**Dependencies:** Database (customers, admins tables), Redis (sessions)

**Specifications:**
- Email format validation (RFC 5322)
- Password min 6 chars (legacy), 8 chars (nouveaux comptes)
- Search customers table, fallback admins table
- Password verification : bcrypt.compare() ou legacy MD5+crypt
- Migration progressive : rehash MD5 → bcrypt on successful login
- JWT payload : `{ sub: user_id, email, userType: 'customer'|'staff', level: 0-9 }`
- Access token : 15min expiry (900s)
- Refresh token : 7 jours expiry (604800s)
- Session Redis : TTL 7 jours
- Cookie : HttpOnly, Secure (HTTPS), SameSite=Strict

### FR-2: Authorization Guards

**Description:** Protéger endpoints avec role-based access control

**Priority:** Critical

**Dependencies:** JWT tokens, NestJS guards

**Specifications:**
- `AuthGuard('jwt')` : valide token JWT
- Extract token from `Authorization: Bearer {token}` header
- Verify signature with JWT_SECRET (env var)
- Decode payload : `{ sub, email, userType, level }`
- `RolesGuard` : check user level >= required level
- Decorator `@Roles(level: number)` pour spécifier niveau requis
- 401 Unauthorized si token invalide/expiré
- 403 Forbidden si level insuffisant
- Attach `req.user` pour access dans controllers

**Access Levels:**
- **0-3** : Customers (cst_level)
- **4-6** : Commercial staff
- **7-9** : Admins (cnfa_level)

### FR-3: Rate Limiting & Brute-Force Protection

**Description:** Limiter tentatives login pour éviter brute-force attacks

**Priority:** High

**Dependencies:** Redis (compteurs)

**Specifications:**
- Max 5 tentatives échouées par IP en 15min
- Redis key : `login_attempts:{ip}` (TTL 900s)
- Incrémente compteur à chaque échec
- Si >= 5, block account temporairement
- Block key : `blocked_account:{email}` (TTL 900s)
- Return 429 Too Many Requests
- Message : "Compte temporairement bloqué. Réessayez dans 15 minutes."
- Reset compteur après login réussi

### FR-4: Session Management

**Description:** Gérer sessions utilisateur avec Redis

**Priority:** High

**Dependencies:** Redis

**Specifications:**
- Session key : `session:{user_id}`
- Value : JSON `{ email, level, userType, loginAt }`
- TTL : 7 jours (604800s)
- Multi-device support : 1 user = N sessions (N sessions keys)
- Logout : delete session key
- Session validation : check Redis key exists + not expired
- Auto-refresh TTL on activity (optionnel)

### FR-5: Password Reset

**Description:** Permettre reset password sécurisé

**Priority:** High

**Dependencies:** Email service, Redis

**Specifications:**
- Generate reset token : `crypto.randomBytes(32).toString('hex')`
- Redis key : `reset:{token}` = user_id (TTL 1h)
- Email template avec lien
- Validate token : lookup Redis
- New password validation : min 8 chars, 1 uppercase, 1 lowercase, 1 digit
- Hash avec bcrypt (cost 10)
- Update database : customers.cst_pswd
- Invalidate token + all sessions
- Send confirmation email

### FR-6: Login History & Audit

**Description:** Enregistrer historique connexions pour audit

**Priority:** Medium

**Dependencies:** Database (login_history table)

**Specifications:**
- Table : `login_history (id, user_id, email, ip, user_agent, success, timestamp)`
- Insert après chaque tentative login (success ou failure)
- Retention : 90 jours
- API endpoint : GET /api/auth/history (admin only)
- Filtres : user_id, date range, success/failure

## 🔒 Non-Functional Requirements

### Performance

- **Login latency** : < 300ms (p95)
- **Token verification** : < 10ms (JWT decode + Redis lookup)
- **Session lookup** : < 5ms (Redis GET)
- **Concurrent logins** : 1000 req/s
- **Redis connection pool** : 10 connections

### Security

- **JWT Secret** : 256-bit random key (env var)
- **Password hashing** : bcrypt cost 10 (2^10 = 1024 rounds)
- **Legacy support** : MD5+crypt (deprecated, migrate on login)
- **Token transmission** : HTTPS only (Secure cookie flag)
- **XSS protection** : HttpOnly cookies (pas accessible JavaScript)
- **CSRF protection** : SameSite=Strict cookies
- **Rate limiting** : 5 login attempts / 15min / IP
- **Session hijacking** : Rotate session ID on privilege escalation

### Reliability

- **Availability** : 99.9% uptime (8.76h downtime/year)
- **Redis failover** : Automatic avec Redis Sentinel/Cluster
- **Database backup** : Daily automated backups (Supabase)
- **Token validation** : Graceful degradation si Redis down (fallback DB)

### Scalability

- **Users** : Support 100k+ concurrent sessions
- **Redis memory** : ~100 bytes/session × 100k = ~10MB
- **Session distribution** : Redis Cluster pour horizontal scaling
- **Stateless API** : JWT permet load balancing sans sticky sessions

### Compliance

- **GDPR** : User consent pour cookies, droit à l'oubli (delete account)
- **Password storage** : Hashing irreversible (bcrypt)
- **Audit logs** : 90 jours rétention login history
- **Data encryption** : TLS 1.3 pour transmission

## 🎨 API Endpoints

### POST /api/auth/login

**Description:** Authenticate user et retourne JWT tokens

**Request:**
```json
{
  "email": "customer@example.com",
  "password": "SecurePass123"
}
```

**Response 200 OK:**
```json
{
  "user": {
    "id": "12345",
    "email": "customer@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "level": 2,
    "isPro": false,
    "isActive": true
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900
}
```

**Response 401 Unauthorized:**
```json
{
  "statusCode": 401,
  "message": "Email ou mot de passe incorrect",
  "error": "Unauthorized"
}
```

**Response 429 Too Many Requests:**
```json
{
  "statusCode": 429,
  "message": "Compte temporairement bloqué. Réessayez dans 15 minutes.",
  "error": "Too Many Requests"
}
```

### POST /api/auth/refresh

**Description:** Refresh access token avec refresh token

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response 200 OK:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900
}
```

### POST /api/auth/logout

**Description:** Logout user et invalidate session

**Request:**
```json
{}
```

**Response 200 OK:**
```json
{
  "success": true,
  "message": "Déconnexion réussie"
}
```

### POST /api/auth/forgot-password

**Description:** Request password reset

**Request:**
```json
{
  "email": "customer@example.com"
}
```

**Response 200 OK:**
```json
{
  "success": true,
  "message": "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé."
}
```

### POST /api/auth/reset-password

**Description:** Reset password avec token

**Request:**
```json
{
  "token": "a1b2c3d4e5f6...",
  "newPassword": "NewSecurePass123",
  "confirmPassword": "NewSecurePass123"
}
```

**Response 200 OK:**
```json
{
  "success": true,
  "message": "Mot de passe réinitialisé avec succès"
}
```

### GET /api/auth/me

**Description:** Get current user info (protected)

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response 200 OK:**
```json
{
  "id": "12345",
  "email": "customer@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "level": 2,
  "isPro": false
}
```

## 📊 Data Requirements

### Entities

#### User (Customer)

```typescript
interface Customer {
  cst_id: number;           // PK
  cst_mail: string;         // Email (unique)
  cst_pswd: string;         // Hashed password (bcrypt or MD5 legacy)
  cst_fname: string;        // First name
  cst_name: string;         // Last name
  cst_tel: string;          // Phone
  cst_level: number;        // Access level (0-3)
  cst_is_pro: '0' | '1';    // Pro account flag
  cst_activ: '0' | '1';     // Active flag
  created_at?: Date;
  updated_at?: Date;
}
```

#### Admin (Staff)

```typescript
interface Admin {
  cnfa_id: number;          // PK
  cnfa_mail: string;        // Email (unique)
  cnfa_pswd: string;        // Hashed password
  cnfa_fname: string;       // First name
  cnfa_name: string;        // Last name
  cnfa_tel: string;         // Phone
  cnfa_level: string;       // Access level (4-9)
  cnfa_activ: '0' | '1';    // Active flag
  created_at?: Date;
  updated_at?: Date;
}
```

#### Session (Redis)

```typescript
interface Session {
  userId: string;
  email: string;
  userType: 'customer' | 'staff';
  level: number;
  loginAt: number;          // Unix timestamp
}

// Redis key: session:{userId}
// TTL: 604800s (7 days)
```

#### JWT Payload

```typescript
interface JwtPayload {
  sub: string;              // User ID
  email: string;
  userType: 'customer' | 'staff';
  level: number;
  iat: number;              // Issued at
  exp: number;              // Expires at
}
```

#### Login History

```typescript
interface LoginHistory {
  id: number;               // PK
  user_id: number;
  email: string;
  ip: string;               // IP address
  user_agent: string;       // Browser/device
  success: boolean;
  error_message?: string;
  timestamp: Date;
}
```

### Relationships

- **Customer** → **LoginHistory** : 1 to many (1 customer = N login attempts)
- **Admin** → **LoginHistory** : 1 to many
- **Customer** → **Session** : 1 to many (multi-device)
- **Admin** → **Session** : 1 to many

### Database Schema

```sql
-- Customers table (existing)
CREATE TABLE customers (
  cst_id SERIAL PRIMARY KEY,
  cst_mail VARCHAR(255) UNIQUE NOT NULL,
  cst_pswd VARCHAR(255) NOT NULL,
  cst_fname VARCHAR(255),
  cst_name VARCHAR(255),
  cst_tel VARCHAR(50),
  cst_level INTEGER DEFAULT 0,
  cst_is_pro CHAR(1) DEFAULT '0',
  cst_activ CHAR(1) DEFAULT '1',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Admins table (existing)
CREATE TABLE admins (
  cnfa_id SERIAL PRIMARY KEY,
  cnfa_mail VARCHAR(255) UNIQUE NOT NULL,
  cnfa_pswd VARCHAR(255) NOT NULL,
  cnfa_fname VARCHAR(255),
  cnfa_name VARCHAR(255),
  cnfa_tel VARCHAR(50),
  cnfa_level VARCHAR(10) DEFAULT '4',
  cnfa_activ CHAR(1) DEFAULT '1',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Login history (new)
CREATE TABLE login_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  email VARCHAR(255) NOT NULL,
  ip VARCHAR(50),
  user_agent TEXT,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_login_history_user_id ON login_history(user_id);
CREATE INDEX idx_login_history_timestamp ON login_history(timestamp);
```

## 🧪 Testing Requirements

### Unit Tests

- [ ] **AuthService.authenticateUser()**
  - Valid credentials (customer) → return user
  - Valid credentials (admin) → return user
  - Invalid email → return null
  - Invalid password → return null
  - Account disabled (cst_activ='0') → return null

- [ ] **AuthService.validatePassword()**
  - Bcrypt password correct → true
  - Bcrypt password incorrect → false
  - Legacy MD5+crypt correct → true + rehash
  - Legacy MD5+crypt incorrect → false

- [ ] **AuthService.generateTokens()**
  - Access token expiry = 900s
  - Refresh token expiry = 604800s
  - Payload contains sub, email, level

- [ ] **AuthGuard.canActivate()**
  - Valid token → true
  - Expired token → throw UnauthorizedException
  - Invalid signature → throw UnauthorizedException
  - Missing token → throw UnauthorizedException

- [ ] **RolesGuard.canActivate()**
  - User level >= required → true
  - User level < required → throw ForbiddenException

### Integration Tests

- [ ] **POST /api/auth/login**
  - Valid customer credentials → 200 + tokens
  - Valid admin credentials → 200 + tokens
  - Invalid credentials → 401
  - 5 failed attempts → 429 (account blocked)
  - Session created in Redis
  - Login history recorded

- [ ] **POST /api/auth/refresh**
  - Valid refresh token → 200 + new access token
  - Expired refresh token → 401
  - Invalid refresh token → 401

- [ ] **POST /api/auth/logout**
  - Valid session → 200 + session deleted
  - Session removed from Redis

- [ ] **GET /api/auth/me**
  - Valid access token → 200 + user info
  - No token → 401
  - Expired token → 401

### E2E Tests

- [ ] **Complete login flow**
  1. User submits login form
  2. Backend validates + returns tokens
  3. Frontend stores token + redirects
  4. User accesses protected page
  5. Token sent in Authorization header
  6. Backend validates + returns data

- [ ] **Token refresh flow**
  1. Access token expires
  2. API call returns 401
  3. Frontend auto-refreshes token
  4. Retry API call with new token
  5. Success

- [ ] **Password reset flow**
  1. User requests reset
  2. Email sent with token
  3. User clicks link + submits new password
  4. Password updated
  5. All sessions invalidated
  6. User logs in with new password

### Security Tests

- [ ] **Brute-force protection**
  - 5 failed logins → account blocked 15min
  - Different IPs → independent counters

- [ ] **Token tampering**
  - Modified payload → signature invalid → 401
  - Modified signature → 401

- [ ] **Session hijacking**
  - Stolen token → limited to 15min (access token expiry)
  - Refresh token rotation mitigates long-term hijack

## 📦 Dependencies

### Internal

- **@nestjs/jwt** : JWT generation/validation
- **@nestjs/passport** : Authentication middleware
- **passport-jwt** : JWT strategy
- **UserService** : Database access (customers, admins)
- **RedisCacheService** : Session storage
- **PasswordCryptoService** : Password hashing (bcrypt, MD5 legacy)

### External

- **Redis** : Session storage (required)
- **Supabase PostgreSQL** : User data (required)
- **Email service** : Password reset emails (required)

## 🚀 Implementation Status

### ✅ Implemented

- [x] JWT token generation (access + refresh)
- [x] AuthGuard + RolesGuard (NestJS guards)
- [x] Session management (Redis)
- [x] Password validation (bcrypt + MD5 legacy)
- [x] Brute-force protection (rate limiting)
- [x] Login history audit
- [x] Unified customer + staff auth
- [x] Multi-device sessions

### 🚧 Partial

- [ ] Password reset flow (backend done, frontend TODO)
- [ ] Email templates (basic done, design TODO)
- [ ] Session auto-refresh on activity (optionnel)

### ❌ Not Started

- [ ] 2FA (Two-Factor Authentication)
- [ ] OAuth/SSO (Google, Facebook)
- [ ] Biometric auth
- [ ] Magic links (passwordless)

## 📈 Success Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| **Login Success Rate** | > 95% | ~97% | ✅ |
| **Login Latency (p95)** | < 300ms | ~250ms | ✅ |
| **Token Validation (p95)** | < 10ms | ~5ms | ✅ |
| **Brute-force Blocks** | < 0.1% users | ~0.05% | ✅ |
| **Session Hijacking Incidents** | 0 | 0 | ✅ |
| **Password Reset Success** | > 90% | ~92% | ✅ |

## ⚠️ Risks and Mitigations

### Risk 1: Redis Down → Sessions Unavailable

**Probability:** Low  
**Impact:** High (all users logged out)  
**Mitigation:**
- Redis Cluster avec automatic failover
- Health checks + monitoring alerts
- Graceful degradation : fallback DB session lookup (slower)

### Risk 2: JWT Secret Leaked

**Probability:** Very Low  
**Impact:** Critical (all tokens forgeable)  
**Mitigation:**
- Secret stocké env var, pas hardcodé
- Secret rotation strategy (generate new secret, accept both old+new for 1h)
- Access logs monitoring suspicious tokens

### Risk 3: Legacy MD5 Passwords Cracked

**Probability:** Medium  
**Impact:** High (account compromise)  
**Mitigation:**
- Force password change for accounts > 2 ans sans login
- Progressive migration MD5 → bcrypt (on successful login)
- Email users to update password

## 🔄 Migration Strategy

### Phase 1: Coexistence MD5 + bcrypt ✅ (Done)

- [x] Support both password formats
- [x] Try bcrypt first, fallback MD5
- [x] Rehash MD5 → bcrypt on successful login

### Phase 2: Force Password Update (Q1 2026)

- [ ] Identify accounts still using MD5 (query database)
- [ ] Email campaign : "Update your password for security"
- [ ] Force password change on next login (if MD5)

### Phase 3: Deprecate MD5 (Q2 2026)

- [ ] Remove MD5 validation code
- [ ] All passwords in bcrypt

## 📚 Documentation

- [x] **API documentation** : Swagger UI at /api/docs
- [x] **Developer guide** : backend/src/auth/README.md
- [ ] **User guide** : docs/user/authentication.md (TODO)
- [x] **Security audit** : docs/security/auth-audit-2024.md

## ✅ Definition of Done

- [x] All acceptance criteria met (user stories)
- [x] Unit tests passing (>80% coverage)
- [x] Integration tests passing
- [x] E2E tests passing (login, refresh, logout flows)
- [x] Code reviewed and approved
- [x] Documentation updated
- [x] Deployed to production
- [x] Security review completed
- [x] Performance benchmarks met (login < 300ms)
- [x] Monitoring alerts configured (Redis, login failures)

## 🔗 Related Documents

- **Architecture**: [ADR-001: Supabase Direct](../architecture/001-supabase-direct.md)
- **Architecture**: [ADR-004: State Management Frontend](../architecture/004-state-management-frontend.md)
- **API Specification**: OpenAPI spec at /api/docs (Swagger)
- **Design Files**: N/A (backend only)

## 📝 Notes

**Current Architecture:**
- **Backend**: NestJS 10 + JWT + Passport + Redis
- **Frontend**: Remix + React 18 + cookies (HttpOnly)
- **Database**: Supabase PostgreSQL (customers, admins tables)
- **Cache**: Redis (sessions, rate limiting)

**Token Strategy:**
- **Access Token**: Short-lived (15min) → minimize damage if stolen
- **Refresh Token**: Long-lived (7 days) → avoid frequent re-logins
- **Cookie**: HttpOnly, Secure, SameSite=Strict → CSRF + XSS protection

**Level Hierarchy:**
- **0-3**: Customers (cst_level)
  - 0: Basic customer
  - 1: Verified customer
  - 2: Premium customer
  - 3: VIP customer
- **4-6**: Commercial staff
  - 4: Junior commercial
  - 5: Senior commercial
  - 6: Commercial manager
- **7-9**: Admins (cnfa_level)
  - 7: Support admin
  - 8: Technical admin
  - 9: Super admin

**Files Locations:**
- **Auth Module**: `backend/src/auth/`
- **Guards**: `backend/src/auth/guards/`
- **DTOs**: `backend/src/auth/dto/` + `backend/src/modules/auth/dto/`
- **Services**: `backend/src/auth/auth.service.ts`
- **Controllers**: `backend/src/auth/auth.controller.ts`
- **Strategies**: `backend/src/auth/local.strategy.ts`

## 📅 Timeline

- **Spec Review:** 2025-11-14
- **Development Start:** 2024-08-01
- **Testing Start:** 2024-09-15
- **Deployment:** 2024-10-01 (Production)

## 🔄 Change Log

### v1.0.0 (2025-11-14)

- Initial specification documenting production auth system
- JWT tokens (15min access + 7d refresh)
- Redis sessions + rate limiting
- Unified customer + staff authentication
- Bcrypt + MD5 legacy support
- RBAC with 10 levels (0-9)
