---
title: "Payments Module - Paybox Integration & Transaction Management"
status: implemented
version: 1.0.0
authors: [Backend Team]
created: 2025-11-18
updated: 2025-11-18
relates-to:
  - ./payment-cart-system.md
  - ./order-management.md
  - ../architecture/001-supabase-direct.md
tags: [payments, paybox, cyberplus, transactions, security, critical]
priority: critical
coverage:
  modules: [payments]
  routes: [/api/payments/*, /api/paybox/*, /admin/paybox/*]
  services: [PaymentService, PayboxService, CyberplusService, PaymentValidationService, PaymentDataService]
---

# Payments Module - Paybox Integration & Transaction Management

## 📝 Overview

Module backend **consolidé** gérant l'intégration complète du système de paiement **Paybox (Verifone)** et l'ancien système **Cyberplus/BNP Paribas**. Architecture sécurisée avec validation HMAC-SHA512, callbacks IPN asynchrones, remboursements, et audit trail complet.

**Consolidation réalisée** :
- Controllers : 3 → 6 (spécialisés par fonction)
- Services : 4 services dédiés + 1 data layer
- Refactoring : 2025-10-05 (Version 1.0.0)

**Passerelles supportées** :
- **Paybox** (PRODUCTION) : TPE Web CGI, HMAC-SHA512
- **Cyberplus** (LEGACY) : BNP Paribas (ancien système, maintenu pour historique)

**Environnements** :
- **TEST** : `preprod-tpeweb.paybox.com` (comptes mutualisés)
- **PROD** : `tpeweb.paybox.com`

## 🎯 Goals

### Objectifs Principaux

1. **Paiements sécurisés** : Intégration Paybox avec validation HMAC obligatoire
2. **Callbacks IPN** : Traitement asynchrone notifications bancaires
3. **Workflow complet** : PENDING → PROCESSING → PAID → REFUNDED
4. **Remboursements** : Total ou partiel via API Paybox
5. **Audit trail** : Logs complets tous événements (création, callback, erreur, remboursement)
6. **Admin monitoring** : Dashboard transactions, statistiques, actions manuelles

### Objectifs Secondaires

- Support multi-devises (EUR prioritaire)
- Timeouts gestion (30 min max paiement)
- Retry logic callbacks IPN (3 tentatives)
- Tests PHP-to-TS migration (page test Paybox)

## 🚫 Non-Goals

- **Paiements récurrents** : Abonnements (v2)
- **Wallets digitaux** : Apple Pay, Google Pay (v2)
- **Split payments** : Paiements fractionnés (v2)
- **Crypto-monnaies** : Bitcoin, Ethereum (non prévu)
- **PCI-DSS compliance** : Délégué à Paybox (hébergé tier)

## 🏗️ Architecture

### Services (5)

```typescript
PaymentsModule
├── PaymentService                   // CRUD principal, workflow statuts
├── PayboxService                    // Intégration Paybox (formulaires, signatures)
├── CyberplusService                 // Legacy BNP Paribas (maintenu pour historique)
├── PaymentValidationService         // Validation HMAC, callbacks IPN
└── PaymentDataService               // Data layer Supabase (transactions, logs)
```

### Controllers (6)

```typescript
├── PaymentsController               // /api/payments/* - CRUD, statuts
├── SystemPayRedirectController      // /systempay-redirect/* - Redirection SystemPay (legacy)
├── PayboxRedirectController         // /api/paybox/redirect - Génération formulaire Paybox
├── PayboxCallbackController         // /api/paybox/callback - IPN notifications
├── PayboxTestController             // /api/paybox/test - Page test (PHP → TS)
└── PayboxMonitoringController       // /admin/paybox/* - Monitoring admin
```

### Workflow Statuts

```
PENDING (Paiement initié, formulaire généré)
  ↓ Client redirigé vers Paybox
PROCESSING (Client saisit CB, validation en cours)
  ↓ Callback IPN reçu avec succès
PAID (Paiement confirmé)
  ↓ Remboursement initié
REFUNDED (Remboursement effectué)

FAILED (Paiement échoué) ← CB refusée, timeout, erreur
CANCELLED (Paiement annulé) ← Client annule sur page Paybox
```

## 📊 Data Model

### Table `payments` (PostgreSQL - Supabase)

```sql
CREATE TABLE payments (
  payment_id              SERIAL PRIMARY KEY,
  payment_ref             VARCHAR(50) UNIQUE NOT NULL,         -- Ex: PAY-2025-001
  
  -- Relations
  order_id                INTEGER REFERENCES commandes(commande_id),
  user_id                 INTEGER REFERENCES users(user_id),
  
  -- Montants
  payment_amount          DECIMAL(10,2) NOT NULL,              -- Montant en EUR
  payment_currency        VARCHAR(3) DEFAULT 'EUR',
  
  -- Statuts
  payment_status          VARCHAR(50) DEFAULT 'PENDING',       -- Workflow principal
  payment_gateway         VARCHAR(50) DEFAULT 'PAYBOX',        -- PAYBOX/CYBERPLUS
  
  -- Données transactionnelles
  transaction_id          VARCHAR(100),                        -- ID transaction bancaire
  authorization_code      VARCHAR(50),                         -- Code autorisation CB
  
  -- Signature HMAC
  hmac_signature          VARCHAR(256),                        -- HMAC-SHA512 signature
  hmac_validated          BOOLEAN DEFAULT false,               -- Signature validée ?
  
  -- Callback IPN
  ipn_received_at         TIMESTAMP,                           -- Date réception IPN
  ipn_attempts            INTEGER DEFAULT 0,                   -- Nombre tentatives IPN
  ipn_last_error          TEXT,                                -- Dernière erreur IPN
  
  -- Métadonnées
  customer_email          VARCHAR(255),
  payment_method          VARCHAR(50),                         -- CARD/PAYPAL/WIRE_TRANSFER
  payment_description     TEXT,
  
  -- Remboursement
  refund_amount           DECIMAL(10,2),                       -- Montant remboursé
  refunded_at             TIMESTAMP,
  
  -- Timestamps
  payment_created_at      TIMESTAMP DEFAULT NOW(),
  payment_updated_at      TIMESTAMP DEFAULT NOW(),
  payment_timeout_at      TIMESTAMP,                           -- Timeout 30 min
  
  -- Indexes performances
  INDEX idx_payments_order (order_id),
  INDEX idx_payments_user (user_id),
  INDEX idx_payments_ref (payment_ref),
  INDEX idx_payments_status (payment_status),
  INDEX idx_payments_transaction (transaction_id)
);
```

### Table `payment_logs` (Audit trail)

```sql
CREATE TABLE payment_logs (
  log_id                  SERIAL PRIMARY KEY,
  payment_id              INTEGER REFERENCES payments(payment_id) ON DELETE CASCADE,
  
  log_type                VARCHAR(50) NOT NULL,                -- CREATED/CALLBACK/ERROR/REFUND
  log_level               VARCHAR(20) DEFAULT 'INFO',          -- INFO/WARN/ERROR
  log_message             TEXT NOT NULL,
  log_data                JSONB,                               -- Données structurées (callback params, etc.)
  
  user_id                 INTEGER REFERENCES users(user_id),   -- Utilisateur déclencheur (si admin)
  ip_address              VARCHAR(50),
  user_agent              TEXT,
  
  log_timestamp           TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_logs_payment (payment_id),
  INDEX idx_logs_type (log_type),
  INDEX idx_logs_timestamp (log_timestamp)
);
```

### Table `payment_refunds` (Remboursements)

```sql
CREATE TABLE payment_refunds (
  refund_id               SERIAL PRIMARY KEY,
  payment_id              INTEGER REFERENCES payments(payment_id),
  
  refund_amount           DECIMAL(10,2) NOT NULL,
  refund_reason           TEXT,
  refund_type             VARCHAR(50) DEFAULT 'FULL',          -- FULL/PARTIAL
  
  refund_status           VARCHAR(50) DEFAULT 'PENDING',       -- PENDING/COMPLETED/FAILED
  refund_transaction_id   VARCHAR(100),                        -- ID transaction remboursement
  
  initiated_by_user_id    INTEGER REFERENCES users(user_id),
  refunded_at             TIMESTAMP,
  
  INDEX idx_refunds_payment (payment_id)
);
```

## 🔌 API Endpoints

### PaymentsController (`/api/payments`)

#### 1. POST `/api/payments/create` - Créer paiement

**Access:** Authenticated user

**Body:**
```json
{
  "orderId": 456,
  "userId": 12345,
  "amount": 245.50,
  "currency": "EUR",
  "customerEmail": "jean@example.com",
  "description": "Commande ORD-2025-001",
  "gateway": "PAYBOX"
}
```

**Response:**
```json
{
  "paymentId": 789,
  "paymentRef": "PAY-2025-001",
  "status": "PENDING",
  "amount": 245.50,
  "currency": "EUR",
  "redirectUrl": "/api/paybox/redirect?paymentId=789",
  "message": "Paiement créé, redirection vers Paybox"
}
```

**Logique:**
1. Valider commande existe (order_id)
2. Valider montant > 0
3. Créer entrée `payments` (statut PENDING)
4. Générer `payment_ref` unique (PAY-YYYY-NNN)
5. Créer log audit (type: CREATED)
6. Définir timeout 30 min (`payment_timeout_at`)
7. Retourner URL redirection Paybox

**Erreurs:**
- 400 : Validation failed (amount <= 0, orderId invalide)
- 404 : Commande inexistante
- 409 : Paiement déjà existant pour cette commande
- 500 : Database error

---

#### 2. GET `/api/payments/:id` - Détail paiement

**Access:** Client propriétaire OU Admin

**Response:**
```json
{
  "paymentId": 789,
  "paymentRef": "PAY-2025-001",
  "orderId": 456,
  "userId": 12345,
  "amount": 245.50,
  "currency": "EUR",
  "status": "PAID",
  "gateway": "PAYBOX",
  "transactionId": "PBX-ABC123456",
  "authorizationCode": "AUTH-789",
  "hmacValidated": true,
  "customerEmail": "jean@example.com",
  "paymentMethod": "CARD",
  "createdAt": "2025-01-14T10:00:00Z",
  "ipnReceivedAt": "2025-01-14T10:05:30Z",
  "logs": [
    {
      "logType": "CREATED",
      "logMessage": "Paiement créé",
      "logTimestamp": "2025-01-14T10:00:00Z"
    },
    {
      "logType": "CALLBACK",
      "logMessage": "IPN reçu, paiement validé",
      "logTimestamp": "2025-01-14T10:05:30Z"
    }
  ]
}
```

**Performance:** < 150ms (p95)

---

#### 3. GET `/api/payments` - Liste paiements (Admin ou Client)

**Access:** Client (ses paiements) OU Admin (tous)

**Query Params:**
```typescript
{
  userId?: number;
  orderId?: number;
  status?: string;          // PENDING/PROCESSING/PAID/FAILED/REFUNDED/CANCELLED
  gateway?: string;         // PAYBOX/CYBERPLUS
  dateFrom?: string;        // ISO date
  dateTo?: string;
  page?: number;
  limit?: number;
}
```

**Response:**
```json
{
  "payments": [
    {
      "paymentId": 789,
      "paymentRef": "PAY-2025-001",
      "orderId": 456,
      "amount": 245.50,
      "status": "PAID",
      "gateway": "PAYBOX",
      "createdAt": "2025-01-14T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 1234,
    "page": 1,
    "limit": 20,
    "totalPages": 62
  }
}
```

**Performance:** < 200ms (p95)

---

#### 4. POST `/api/payments/:id/refund` - Remboursement

**Access:** Admin level 9+

**Body:**
```json
{
  "amount": 100.00,
  "reason": "Produit défectueux",
  "type": "PARTIAL"
}
```

**Response:**
```json
{
  "refundId": 123,
  "paymentId": 789,
  "amount": 100.00,
  "type": "PARTIAL",
  "status": "PENDING",
  "message": "Remboursement initié"
}
```

**Logique:**
1. Vérifier paiement existe et statut = PAID
2. Vérifier montant <= montant_paiement_original
3. Créer entrée `payment_refunds`
4. Appeler API Paybox remboursement (si auto)
5. Mettre à jour statut payment si full refund (→ REFUNDED)
6. Créer log audit (type: REFUND)

**Erreurs:**
- 403 : Permissions insuffisantes
- 404 : Paiement inexistant
- 409 : Paiement non PAID (impossible rembourser)
- 422 : Montant remboursement > montant original

---

### PayboxRedirectController (`/api/paybox/redirect`)

#### 5. GET `/api/paybox/redirect` - Génération formulaire Paybox

**Access:** Public (lien depuis page checkout)

**Query Params:**
```typescript
{
  paymentId: number;        // ID paiement créé via POST /api/payments/create
}
```

**Response:** HTML page avec auto-submit form

```html
<!DOCTYPE html>
<html>
<head>
  <title>Redirection Paybox</title>
</head>
<body>
  <h2>Redirection vers la plateforme de paiement sécurisé...</h2>
  <form id="paybox-form" method="POST" action="https://tpeweb.paybox.com/cgi/MYchoix_pagepaiement.cgi">
    <input type="hidden" name="PBX_SITE" value="1234567" />
    <input type="hidden" name="PBX_RANG" value="001" />
    <input type="hidden" name="PBX_IDENTIFIANT" value="123456789" />
    <input type="hidden" name="PBX_TOTAL" value="24550" />
    <input type="hidden" name="PBX_DEVISE" value="978" />
    <input type="hidden" name="PBX_CMD" value="PAY-2025-001" />
    <input type="hidden" name="PBX_PORTEUR" value="jean@example.com" />
    <input type="hidden" name="PBX_RETOUR" value="Mt:M;Ref:R;Auto:A;Erreur:E" />
    <input type="hidden" name="PBX_HASH" value="SHA512" />
    <input type="hidden" name="PBX_TIME" value="2025-01-14T10:00:00Z" />
    <input type="hidden" name="PBX_HMAC" value="ABC123...HMAC_SIGNATURE" />
  </form>
  <script>
    document.getElementById('paybox-form').submit();
  </script>
</body>
</html>
```

**Logique (PayboxService.generatePaymentForm):**
1. Récupérer paiement par ID
2. Vérifier statut = PENDING
3. Construire paramètres Paybox :
   - `PBX_SITE`, `PBX_RANG`, `PBX_IDENTIFIANT` (config)
   - `PBX_TOTAL` : montant en centimes (245.50€ → 24550)
   - `PBX_DEVISE` : 978 (EUR)
   - `PBX_CMD` : payment_ref (PAY-2025-001)
   - `PBX_PORTEUR` : email client
   - `PBX_RETOUR` : format retour variables (Mt, Ref, Auto, Erreur)
   - `PBX_HASH` : SHA512
   - `PBX_TIME` : ISO8601 timestamp
4. Calculer HMAC-SHA512 :
   - Chaîne signature : concaténation paramètres ordonnés
   - Clé HMAC : config `PAYBOX_HMAC_KEY` (hex-packed)
   - Signature : `crypto.createHmac('sha512', keyBuffer).update(string).digest('hex').toUpperCase()`
5. Ajouter `PBX_HMAC` aux paramètres
6. Générer HTML form auto-submit
7. Mettre à jour statut payment → PROCESSING
8. Créer log audit (type: REDIRECT)

**Configuration Paybox:**
```typescript
// .env
PAYBOX_MODE=PROD                    // TEST ou PROD
PAYBOX_SITE=1234567                 // Numéro site Paybox
PAYBOX_RANG=001                     // Rang (001 par défaut)
PAYBOX_IDENTIFIANT=123456789        // Identifiant commerçant
PAYBOX_HMAC_KEY=0123456789ABCDEF... // Clé HMAC (hex string)
PAYBOX_PAYMENT_URL=https://tpeweb.paybox.com/cgi/MYchoix_pagepaiement.cgi
```

**URLs Paybox:**
- **TEST** : `https://preprod-tpeweb.paybox.com/cgi/MYchoix_pagepaiement.cgi`
- **PROD** : `https://tpeweb.paybox.com/cgi/MYchoix_pagepaiement.cgi`

---

### PayboxCallbackController (`/api/paybox/callback`)

#### 6. GET `/api/paybox/callback` - IPN Notification

**Access:** Public (IP Paybox whitelistées)

**Query Params (envoyés par Paybox):**
```typescript
{
  Mt: string;               // Montant en centimes (24550)
  Ref: string;              // Référence paiement (PAY-2025-001)
  Auto: string;             // Code autorisation (AUTH-789)
  Erreur: string;           // Code erreur (00000 = succès)
  Signature?: string;       // Signature HMAC (si activée)
}
```

**Response:**
```
OK
```

**Logique (PaymentValidationService.validateCallback):**
1. Logger réception IPN (IP source, params)
2. Parser query params
3. Extraire `Ref` (payment_ref)
4. Récupérer paiement par `payment_ref`
5. Vérifier timeout (< 30 min depuis création)
6. Valider signature HMAC (si présente) :
   ```typescript
   const signatureString = `Mt=${Mt}&Ref=${Ref}&Auto=${Auto}&Erreur=${Erreur}`;
   const expectedSignature = crypto.createHmac('sha512', hmacKey)
     .update(signatureString)
     .digest('hex')
     .toUpperCase();
   if (Signature !== expectedSignature) throw new Error('Invalid HMAC');
   ```
7. Analyser code erreur :
   - `00000` : Paiement réussi → Statut PAID
   - `001XX` : CB refusée → Statut FAILED
   - `002XX` : Timeout → Statut FAILED
   - `003XX` : Erreur système → Statut FAILED
8. Mettre à jour paiement :
   - `payment_status` → PAID ou FAILED
   - `transaction_id` → `Auto` (code autorisation)
   - `hmac_validated` → true
   - `ipn_received_at` → NOW()
   - `ipn_attempts` → incrémenter
9. Créer log audit (type: CALLBACK)
10. Si PAID :
    - Mettre à jour commande (`commande_payment_status = PAID`)
    - Envoyer email confirmation client
    - Déclencher workflow préparation
11. Si FAILED :
    - Libérer stock réservé
    - Envoyer email erreur client
12. Retourner `OK` (Paybox attend "OK" en body)

**Retry Logic:**
- Paybox retry IPN si pas de réponse "OK" : 3 tentatives (0s, 60s, 300s)
- Backend track `ipn_attempts` pour détecter doublons
- Idempotence : traiter 1 seule fois par `payment_ref`

**Erreurs:**
- 400 : Signature HMAC invalide
- 404 : Paiement inexistant (Ref inconnu)
- 408 : Timeout dépassé (> 30 min)
- 409 : IPN déjà traité (idempotence)
- 500 : Erreur serveur (Paybox retry)

---

### PayboxTestController (`/api/paybox/test`)

#### 7. GET `/api/paybox/test` - Page test Paybox (PHP → TS)

**Access:** Admin level 8+ (development uniquement)

**Response:** HTML page formulaire test

**Fonctionnalités:**
- Génération formulaire Paybox test
- Montant custom
- Email custom
- Affichage paramètres générés
- Affichage signature HMAC
- Lien vers logs admin

**Usage:** Tester intégration Paybox sans créer vraie commande

---

### PayboxMonitoringController (`/admin/paybox`)

#### 8. GET `/admin/paybox/transactions` - Liste transactions

**Access:** Admin level 8+

**Query Params:** Idem GET `/api/payments`

**Response:** Idem GET `/api/payments` + stats globales

---

#### 9. GET `/admin/paybox/stats` - Statistiques

**Access:** Admin level 8+

**Response:**
```json
{
  "total": 1234,
  "totalAmount": 123456.78,
  "averageAmount": 100.05,
  "byStatus": {
    "PENDING": 12,
    "PROCESSING": 5,
    "PAID": 1100,
    "FAILED": 67,
    "REFUNDED": 50
  },
  "successRate": 94.3,
  "failureReasons": [
    { "code": "00103", "label": "CB refusée", "count": 45 },
    { "code": "00201", "label": "Timeout", "count": 22 }
  ],
  "last30DaysAmount": [
    { "date": "2025-01-01", "amount": 5000.00, "count": 50 },
    { "date": "2025-01-02", "amount": 6200.00, "count": 62 }
  ]
}
```

**Cache:** Redis 1 min  
**Performance:** < 500ms (aggregates)

---

#### 10. POST `/admin/paybox/retry-callback/:paymentId` - Retry IPN manuel

**Access:** Admin level 9+

**Body:**
```json
{
  "reason": "IPN jamais reçu, retry manuel"
}
```

**Response:**
```json
{
  "success": true,
  "paymentId": 789,
  "message": "Callback IPN simulé avec succès"
}
```

**Logique:**
- Récupérer paiement par ID
- Vérifier statut = PROCESSING (bloqué en attente IPN)
- Simuler réception IPN (appel interne `validateCallback`)
- Utile si Paybox IPN perdu (network issue)

---

### CyberplusService (Legacy - BNP Paribas)

**Note:** Service maintenu pour historique, nouveaux paiements utilisent Paybox.

#### 11. POST `/api/cyberplus/callback` - IPN Cyberplus (legacy)

**Access:** Public (IP BNP whitelistées)

**Logique:** Similaire Paybox IPN, signature différente

---

## 🔒 Security

### HMAC Validation

**Algorithme:** HMAC-SHA512

**Clé:** Config `PAYBOX_HMAC_KEY` (hex string, 128 chars)

**Chaîne signature (ordre critique):**
```
PBX_SITE=1234567&PBX_RANG=001&PBX_IDENTIFIANT=123456789&PBX_TOTAL=24550&PBX_DEVISE=978&PBX_CMD=PAY-2025-001&PBX_PORTEUR=jean@example.com&PBX_RETOUR=Mt:M;Ref:R;Auto:A;Erreur:E&PBX_HASH=SHA512&PBX_TIME=2025-01-14T10:00:00Z
```

**Calcul:**
```typescript
const keyBuffer = Buffer.from(hmacKey, 'hex'); // pack("H*", $key)
const hmac = crypto.createHmac('sha512', keyBuffer);
hmac.update(signatureString);
const signature = hmac.digest('hex').toUpperCase();
```

**Validation callback IPN:**
```typescript
const callbackString = `Mt=${Mt}&Ref=${Ref}&Auto=${Auto}&Erreur=${Erreur}`;
const expectedSignature = crypto.createHmac('sha512', keyBuffer)
  .update(callbackString)
  .digest('hex')
  .toUpperCase();
if (Signature !== expectedSignature) throw new Error('Invalid HMAC');
```

### IP Whitelisting

**Paybox IPN IPs (production):**
- `194.2.160.0/24`
- `195.25.67.0/24`

**Config Nginx/Firewall:**
```nginx
location /api/paybox/callback {
  allow 194.2.160.0/24;
  allow 195.25.67.0/24;
  deny all;
  proxy_pass http://backend:3000;
}
```

### PCI-DSS Compliance

- **Aucune donnée CB stockée** : Formulaire Paybox hébergé tier (PCI-compliant)
- **Tokens uniquement** : Backend reçoit tokens anonymisés
- **SSL/TLS obligatoire** : HTTPS sur toutes communications

### Rate Limiting

- **Endpoints publics (IPN)** : 1000 req/min/IP (callbacks Paybox)
- **Endpoints admin** : 100 req/min/user

---

## 📈 Performance

### Objectifs

| Endpoint | Target P95 | Cache TTL |
|----------|-----------|-----------|
| POST /api/payments/create | < 200ms | N/A |
| GET /api/paybox/redirect | < 300ms | N/A |
| GET /api/paybox/callback (IPN) | < 500ms | N/A |
| GET /api/payments/:id | < 150ms | 1 min |
| GET /api/payments | < 200ms | N/A |
| POST /api/payments/:id/refund | < 1s | N/A |
| GET /admin/paybox/stats | < 500ms | 1 min |

### Optimisations

1. **Indexes DB** : Sur `payment_ref`, `transaction_id`, `order_id`, `payment_status`
2. **Cache Redis** : Stats admin (1 min TTL)
3. **Async processing** : Callbacks IPN traités asynchrones (queue BullMQ future)
4. **Logs batch insert** : Insertion logs par batch (performance)
5. **Connection pooling** : Supabase client pooling

---

## 🧪 Tests

### Coverage Targets

- **Unit tests** : ≥ 80% (services)
- **Integration tests** : ≥ 60% (controllers + DB)
- **E2E tests** : Flows critiques (paiement complet avec mock Paybox)

### Tests Prioritaires

#### PayboxService

```typescript
describe('PayboxService', () => {
  it('should generate valid HMAC signature', () => {
    const params = {
      PBX_SITE: '1234567',
      PBX_TOTAL: '24550',
      // ...
    };
    const signature = service.calculateHMAC(params);
    expect(signature).toMatch(/^[A-F0-9]{128}$/); // SHA512 = 128 hex chars
  });

  it('should generate payment form with all required params', () => {
    const formData = service.generatePaymentForm({
      amount: 245.50,
      orderId: 'ORD-001',
      // ...
    });
    expect(formData.parameters.PBX_TOTAL).toBe('24550'); // Centimes
    expect(formData.parameters.PBX_HMAC).toBeDefined();
  });
});
```

#### PaymentValidationService

```typescript
describe('PaymentValidationService', () => {
  it('should validate correct HMAC callback', async () => {
    const callback = {
      Mt: '24550',
      Ref: 'PAY-2025-001',
      Auto: 'AUTH-789',
      Erreur: '00000',
      Signature: 'VALID_HMAC_SIGNATURE'
    };
    const result = await service.validateCallback(callback);
    expect(result.valid).toBe(true);
  });

  it('should reject invalid HMAC callback', async () => {
    const callback = {
      Signature: 'INVALID_SIGNATURE'
    };
    await expect(service.validateCallback(callback))
      .rejects.toThrow('Invalid HMAC');
  });

  it('should handle timeout payments', async () => {
    // Payment créé il y a 31 min
    const result = await service.validateCallback({ Ref: 'PAY-OLD' });
    expect(result.status).toBe('TIMEOUT');
  });
});
```

---

## 📚 Dependencies

### NestJS Modules

- `@nestjs/common` - Core framework
- `@nestjs/config` - Configuration Paybox
- `crypto` (Node.js) - HMAC-SHA512

### External Services

- **Paybox (Verifone)** - Passerelle paiement
- **EmailService** - Notifications clients
- **OrdersModule** - Mise à jour commandes

### Database

- `@supabase/supabase-js` - Supabase client
- `SupabaseBaseService` - Classe de base

---

## 🔄 Migration PHP → TypeScript

### Équivalences

| PHP | TypeScript |
|-----|------------|
| `hash_hmac('sha512', $string, pack("H*", $key))` | `crypto.createHmac('sha512', Buffer.from(key, 'hex')).update(string).digest('hex')` |
| `strtoupper($signature)` | `signature.toUpperCase()` |
| `date("c")` | `new Date().toISOString()` |
| `$_GET['Mt']` | `req.query.Mt` |
| `echo "OK"` | `res.send('OK')` |

### Tests Migration

**Page test Paybox** : `/api/paybox/test` reproduit exactement logique PHP original

---

## 🚀 Deployment

### Environment Variables

```bash
# Paybox Configuration
PAYBOX_MODE=PROD                    # TEST ou PROD
PAYBOX_SITE=1234567
PAYBOX_RANG=001
PAYBOX_IDENTIFIANT=123456789
PAYBOX_HMAC_KEY=0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF
PAYBOX_PAYMENT_URL=https://tpeweb.paybox.com/cgi/MYchoix_pagepaiement.cgi

# URLs (configurées dans back-office Paybox)
# - IPN Callback URL: https://votredomaine.com/api/paybox/callback
# - Retour client OK: https://votredomaine.com/checkout/success
# - Retour client KO: https://votredomaine.com/checkout/error

# Legacy Cyberplus (BNP)
CYBERPLUS_MERCHANT_ID=123456789
CYBERPLUS_SECRET_KEY=xxx

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...
```

### Nginx Configuration (IPN whitelisting)

```nginx
location /api/paybox/callback {
  # Whitelist IPs Paybox uniquement
  allow 194.2.160.0/24;
  allow 195.25.67.0/24;
  deny all;
  
  proxy_pass http://backend:3000;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

---

## 📖 Related Documentation

- [Payment Cart System](./payment-cart-system.md) - Frontend checkout flow
- [Order Management](./order-management.md) - Intégration commandes
- [Paybox Documentation](https://www.paybox.com/documentation/) - Docs officielles Paybox
- [ADR-001: Supabase Direct](../architecture/001-supabase-direct.md)

---

## ✅ Acceptance Criteria

### Critères Fonctionnels

- [ ] Création paiement avec montant validé
- [ ] Génération formulaire Paybox avec HMAC correct
- [ ] Redirection auto-submit vers passerelle
- [ ] Réception IPN callback Paybox
- [ ] Validation signature HMAC-SHA512
- [ ] Mise à jour statut payment (PENDING → PAID)
- [ ] Mise à jour commande associée
- [ ] Notifications email client (confirmation/erreur)
- [ ] Remboursements total/partiel fonctionnels
- [ ] Logs audit complets tous événements

### Critères Techniques

- [ ] Validation Zod sur tous les DTOs
- [ ] Tests unitaires ≥ 80% coverage
- [ ] Tests intégration ≥ 60% coverage
- [ ] HMAC validation 100% conforme Paybox
- [ ] Idempotence callbacks IPN
- [ ] Timeouts gestion (30 min)
- [ ] Retry logic IPN (3 tentatives)
- [ ] Indexes DB créés sur colonnes clés

### Critères Performance

- [ ] POST /api/payments/create < 200ms (p95)
- [ ] GET /api/paybox/redirect < 300ms (p95)
- [ ] GET /api/paybox/callback < 500ms (p95)
- [ ] GET /api/payments/:id < 150ms (p95)
- [ ] GET /admin/paybox/stats < 500ms (p95)

### Critères Sécurité

- [ ] HMAC-SHA512 validation obligatoire
- [ ] IP whitelisting Paybox activé
- [ ] SSL/TLS sur toutes communications
- [ ] Aucune donnée CB stockée (PCI-DSS)
- [ ] Logs audit trail complet
- [ ] Rate limiting actif

---

## 🐛 Known Issues

1. **Comptes test mutualisés** : Pas de clé HMAC valide → Warning logs (normal)
2. **IPN retry Paybox** : Peut générer doublons logs si traitement lent (idempotence OK)
3. **Timeouts réseau** : IPN peut arriver après 30 min (géré par retry logic)

---

## 🔮 Future Enhancements

1. **BullMQ queue** : Traitement IPN asynchrone (améliorer performance)
2. **3D Secure 2.0** : Authentification forte paiements (PSD2)
3. **Webhooks admin** : Notifications Slack/Discord transactions
4. **Multi-devises** : Support USD, GBP (actuellement EUR uniquement)
5. **Paybox Direct API** : API REST moderne (alternative formulaire CGI)
6. **Tokenization CB** : Paiements récurrents sans re-saisie CB

---

**Version:** 1.0.0  
**Last Updated:** 2025-11-18  
**Status:** ✅ Implemented (Production)  
**Maintainer:** Backend Team
