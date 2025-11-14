---
title: "Payment & Cart System"
status: implemented
version: 1.0.0
authors: [Backend Team]
created: 2025-11-14
updated: 2025-11-14
relates-to:
  - ../api/payment-api.yaml
  - ../api/cart-api.yaml
  - ../types/payment.schema.ts
  - ../types/cart.schema.ts
tags: [e-commerce, payments, cart, checkout]
---

# Payment & Cart System

## 📝 Overview

Système complet de gestion de panier et de paiements pour la plateforme e-commerce. Supporte les utilisateurs authentifiés et invités, avec intégration Paybox pour les paiements sécurisés.

## 🎯 Goals

- Offrir une expérience fluide de gestion de panier (invités + authentifiés)
- Garantir des paiements sécurisés via Paybox/Cyberplus
- Supporter plusieurs méthodes de paiement
- Gérer les promotions et frais de livraison
- Fournir des analytics détaillés sur les paniers

## 🚫 Non-Goals

- Paiements par portefeuille digital (Apple Pay, Google Pay) dans v1
- Abonnements récurrents
- Split payments (paiements fractionnés)

## 👥 User Stories

### Story 1: Gestion de Panier Invité

**As a** visiteur non authentifié  
**I want** ajouter des produits à mon panier  
**So that** je peux préparer ma commande avant de créer un compte

**Acceptance Criteria:**

- [x] Le panier est stocké en session (cookie + Redis)
- [x] Le panier persiste pendant 30 jours
- [x] Le panier est fusionné lors de la connexion
- [x] Les totaux sont calculés en temps réel

### Story 2: Paiement Sécurisé

**As a** client  
**I want** payer ma commande de manière sécurisée  
**So that** mes données bancaires sont protégées

**Acceptance Criteria:**

- [x] Redirection vers formulaire Paybox sécurisé
- [x] Validation de signature HMAC
- [x] Callback IPN pour validation asynchrone
- [x] Gestion des erreurs et timeouts
- [x] Logs détaillés pour audit

### Story 3: Application de Promotions

**As a** client  
**I want** appliquer un code promo à mon panier  
**So that** je bénéficie de réductions

**Acceptance Criteria:**

- [x] Validation du code promo (existence, validité, conditions)
- [x] Calcul automatique de la réduction
- [x] Affichage du montant économisé
- [x] Un seul code promo à la fois

### Story 4: Calcul des Frais de Livraison

**As a** client  
**I want** connaître les frais de livraison avant de payer  
**So that** je peux choisir la meilleure option

**Acceptance Criteria:**

- [x] Calcul basé sur le code postal
- [x] Prise en compte du poids total
- [x] Affichage des options disponibles
- [x] Mise à jour en temps réel

## 🔄 User Flows

### Flow 1: Checkout Complet (Utilisateur Authentifié)

```
1. Client ajoute produits au panier
   → Validation stock, calcul totaux
2. Client applique code promo (optionnel)
   → Validation promo, recalcul
3. Client saisit adresse de livraison
   → Calcul frais de livraison
4. Client confirme et procède au paiement
   → Création payment record, génération formulaire Paybox
5. Redirection vers Paybox
   → Client saisit CB sur page sécurisée
6. Callback IPN Paybox
   → Validation signature, mise à jour statut
7. Redirection retour client
   → Affichage confirmation commande
```

### Flow 2: Fusion de Panier (Connexion)

```
1. Invité avec panier session
2. Invité se connecte
3. Système détecte panier session + panier user
4. Fusion automatique (quantités cumulées)
5. Notification affichée au client
6. Panier unifié disponible
```

### Flow 3: Gestion Erreur Paiement

```
1. Paiement échoue (CB refusée, timeout, etc.)
2. Callback IPN reçu avec erreur
3. Statut payment → FAILED
4. Client redirigé vers page erreur
5. Panier restauré (items disponibles)
6. Message d'erreur explicite affiché
7. Client peut réessayer
```

## 📋 Functional Requirements

### FR-1: Gestion de Panier Multi-contexte

**Description:** Support seamless des paniers pour invités et utilisateurs authentifiés avec fusion automatique.

**Priority:** High

**Dependencies:** 
- Redis pour cache session
- Supabase pour persistence
- Auth module pour identification user

**Specifications:**
- Panier invité: cookie `cartSessionId` + cache Redis 30j
- Panier user: stocké en DB avec `user_id`
- Fusion: addition quantités, préservation metadata
- TTL: 30j inactifs → purge automatique

### FR-2: Paiement Sécurisé Paybox

**Description:** Intégration complète du système de paiement Paybox avec validation HMAC et callbacks IPN.

**Priority:** Critical

**Dependencies:**
- Configuration Paybox (site, rang, clé HMAC)
- Système de queue pour callbacks asynchrones
- Module orders pour création commande

**Specifications:**
- Environnements: TEST (preprod-tpeweb.paybox.com) + PROD (tpeweb.paybox.com)
- Signature HMAC-SHA512 obligatoire
- Timeout: 30min pour completion
- Retry: 3 tentatives sur callback IPN
- Audit trail: tous événements loggés

### FR-3: Système de Promotions

**Description:** Application et validation de codes promotionnels avec règles métier.

**Priority:** Medium

**Dependencies:**
- Module promo pour validation codes
- Cart calculation service pour recalcul

**Specifications:**
- Types: pourcentage ou montant fixe
- Contraintes: montant minimum, catégories, utilisateurs
- Exclusivité: 1 code promo par commande
- Expiration: date de fin obligatoire
- Utilisation: compteur d'utilisation max

### FR-4: Calcul Frais de Livraison

**Description:** Calcul dynamique des frais de livraison basé sur géographie et poids.

**Priority:** High

**Dependencies:**
- Shipping service pour tarifs
- Product data pour poids unitaires

**Specifications:**
- Zones: France métropolitaine, DOM-TOM, International
- Facteurs: code postal + poids total panier
- Options: Standard (48-72h), Express (24h), Point relais
- Gratuit: au-dessus d'un montant seuil configurable

## 🔒 Non-Functional Requirements

### Performance

- Response time API cart: < 200ms (p95)
- Response time API payment: < 500ms (p95)
- Callback IPN processing: < 1s
- Cache hit rate: > 90% pour GET cart

### Security

- Authentication: JWT tokens (15min access + 7j refresh)
- Authorization: Guards NestJS pour routes protégées
- Paybox signature: HMAC-SHA512 validation obligatoire
- PCI-DSS: aucune donnée CB stockée côté backend
- Rate limiting: 100 req/min par IP sur cart, 10 req/min sur payment

### Availability

- SLA: 99.9% uptime
- Degraded mode: cart read-only si Paybox down
- Retry policy: 3 tentatives avec exponential backoff
- Circuit breaker: après 5 échecs consécutifs Paybox

### Scalability

- Max concurrent carts: 10,000
- Payment throughput: 100 paiements/min
- Data volume: 1M+ produits, 100K+ commandes/an
- Redis: horizontal scaling via cluster

## 🎨 API Endpoints

Voir spécifications détaillées:
- [Payment API Spec](../api/payment-api.yaml)
- [Cart API Spec](../api/cart-api.yaml)

### Cart Endpoints

```
GET    /api/cart                    # Récupérer panier actuel
POST   /api/cart/items              # Ajouter un produit
PATCH  /api/cart/items/:id          # Modifier quantité
DELETE /api/cart/items/:id          # Retirer un produit
DELETE /api/cart                    # Vider le panier
POST   /api/cart/promo              # Appliquer code promo
DELETE /api/cart/promo              # Retirer code promo
POST   /api/cart/shipping           # Appliquer méthode livraison
POST   /api/cart/shipping/calculate # Calculer frais livraison
GET    /api/cart/analytics/*        # Analytics panier
```

### Payment Endpoints

```
POST   /api/payments                     # Créer un paiement
GET    /api/payments/:id                 # Détails d'un paiement
GET    /api/payments/user/:userId        # Paiements d'un utilisateur
GET    /api/payments/order/:orderId      # Paiements d'une commande
GET    /api/payments/methods             # Méthodes disponibles
POST   /api/payments/:id/refund          # Rembourser (admin)
POST   /api/paybox/callback              # IPN callback Paybox
GET    /api/paybox/monitoring            # Monitoring (admin)
```

## 📊 Data Requirements

Voir schémas détaillés:
- [Payment Type Schema](../types/payment.schema.ts)
- [Cart Type Schema](../types/cart.schema.ts)

### Entity: Payment

```typescript
interface Payment {
  id: string;                    // UUID
  user_id: string | null;        // UUID or null (guest)
  order_id: string;              // UUID référence Order
  amount: number;                // Montant en centimes
  currency: string;              // "EUR"
  status: PaymentStatus;         // PENDING | AUTHORIZED | CAPTURED | FAILED | REFUNDED
  method: PaymentMethod;         // CREDIT_CARD | DEBIT_CARD | CYBERPLUS | PAYBOX
  provider: string;              // "paybox"
  provider_transaction_id: string | null;  // ID transaction Paybox
  provider_response: object | null;        // Réponse complète provider
  metadata: object;              // Données additionnelles
  created_at: Date;
  updated_at: Date;
}

enum PaymentStatus {
  PENDING = 'pending',
  AUTHORIZED = 'authorized',
  CAPTURED = 'captured',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded'
}

enum PaymentMethod {
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  CYBERPLUS = 'cyberplus',
  PAYBOX = 'paybox'
}
```

### Entity: CartItem

```typescript
interface CartItem {
  id: string;                    // UUID
  cart_session_id: string | null;  // Session invité
  user_id: string | null;        // UUID utilisateur
  product_id: string;            // UUID produit
  variant_id: string | null;     // UUID variante
  quantity: number;              // Quantité (> 0)
  unit_price: number;            // Prix unitaire centimes
  unit_consigne: number;         // Consigne unitaire centimes
  subtotal: number;              // quantity * unit_price
  consigne_total: number;        // quantity * unit_consigne
  metadata: {
    product_name: string;
    product_image: string | null;
    variant_name: string | null;
    stock_quantity: number;
  };
  created_at: Date;
  updated_at: Date;
}
```

### Relationships

- Payment → Order: One-to-Many (un order peut avoir plusieurs payments)
- CartItem → Product: Many-to-One
- CartItem → User: Many-to-One (nullable)

## 🧪 Testing Requirements

### Unit Tests

- [x] CartCalculationService: calcul totaux, réductions, frais
- [x] CartValidationService: validation stock, quantités, limites
- [x] PayboxService: génération signature HMAC, validation callbacks
- [x] PaymentValidationService: validation create payment DTO

### Integration Tests

- [x] POST /api/cart/items → vérifie stock disponible
- [x] POST /api/payments → création payment + redirect Paybox
- [x] POST /api/paybox/callback → validation signature + update status
- [x] GET /api/cart → fusion panier invité/user après login

### E2E Tests

- [ ] Flow complet: ajout produits → checkout → paiement → confirmation
- [ ] Flow erreur: paiement échoué → retry
- [ ] Flow promo: application code → validation réduction
- [ ] Flow invité → login → fusion paniers

## 📦 Dependencies

### Internal

- `DatabaseModule`: accès Supabase pour persistence
- `CacheModule`: Redis pour sessions et optimisations
- `AuthModule`: JWT validation et user context
- `ProductsModule`: données produits, stock
- `ShippingModule`: calcul frais de livraison
- `PromoModule`: validation codes promotionnels
- `OrdersModule`: création commandes

### External

- `@nestjs/swagger`: documentation OpenAPI
- `nestjs-zod`: validation DTOs avec Zod
- `crypto`: signature HMAC pour Paybox
- `axios`: requêtes HTTP vers Paybox (monitoring)

## 🚀 Implementation Status

### Phase 1: Cart Management (✅ DONE)

- [x] Cart controller avec endpoints REST
- [x] Support invités + authentifiés
- [x] Cache Redis pour performances
- [x] Calcul automatique des totaux
- [x] Validation stock temps réel

### Phase 2: Payments Integration (✅ DONE)

- [x] Payment controller unifié
- [x] Service Paybox avec signature HMAC
- [x] IPN callback handler
- [x] Redirect controllers (success/error)
- [x] Monitoring endpoints

### Phase 3: Promotions & Shipping (✅ DONE)

- [x] Application codes promo
- [x] Calcul frais de livraison
- [x] Validation règles métier
- [x] API analytics panier

### Phase 4: Production Hardening (🚧 IN PROGRESS)

- [x] Logging structuré (Winston)
- [x] Error handling robuste
- [x] Configuration par environnement
- [ ] Tests E2E complets
- [ ] Load testing (k6)
- [ ] Monitoring Grafana

## 📈 Success Metrics

- **Conversion rate:** > 3% (visiteurs → commandes)
- **Cart abandonment rate:** < 70%
- **Payment success rate:** > 95%
- **Average cart value:** > 50€
- **Payment processing time:** < 5s (p95)
- **API errors rate:** < 0.1%

## ⚠️ Risks and Mitigations

### Risk 1: Paybox Service Downtime

**Probability:** Low  
**Impact:** High  

**Mitigation:**
- Circuit breaker après 5 échecs consécutifs
- Page d'attente avec retry automatique
- Notification admin si down > 5min
- Fallback: mode commande "à traiter manuellement"

### Risk 2: Redis Cache Failure

**Probability:** Low  
**Impact:** Medium  

**Mitigation:**
- Fallback automatique sur base de données
- Performance dégradée acceptable temporairement
- Monitoring alertes si hit rate < 80%

### Risk 3: Race Condition sur Stock

**Probability:** Medium  
**Impact:** Medium  

**Mitigation:**
- Validation stock atomique au moment du payment
- Lock optimiste avec version checking
- Rollback automatique si stock insuffisant
- Notification client si produit épuisé

### Risk 4: Signature HMAC Invalide

**Probability:** Low  
**Impact:** High  

**Mitigation:**
- Logs détaillés pour debug (paramètres, clé utilisée)
- Script de test signature en isolation
- Validation en environnement TEST avant PROD
- Monitoring alertes si taux rejet > 5%

## 🔄 Migration Strategy

### Backwards Compatibility

- [x] Ancien système décommissionné (SystemPay → Paybox)
- [x] Pas de migration données nécessaire (nouvelles tables)
- [x] Feature flags pour activation progressive

### Data Migration

N/A - Nouveau système, pas de migration existante

## 📚 Documentation

- [x] API documentation: Swagger UI `/api/docs`
- [x] Code documentation: JSDoc inline
- [ ] User guide: Processus de commande
- [ ] Developer guide: Intégration Paybox
- [ ] Runbook: Incidents paiements

## ✅ Definition of Done

- [x] All acceptance criteria met
- [x] Unit tests passing (>70% coverage)
- [x] Integration tests passing
- [ ] E2E tests passing
- [x] Code reviewed and approved
- [x] API documentation up-to-date
- [x] Deployed to staging
- [ ] QA validation completed
- [ ] Performance benchmarks met
- [x] Security review completed (Paybox HMAC validation)
- [ ] Accessibility audit passed (frontend)

## 🔗 Related Documents

- **Architecture Decision:** [ADR-001: Paybox vs SystemPay](../architecture/001-payment-provider-choice.md)
- **API Specifications:**
  - [Payment API OpenAPI](../api/payment-api.yaml)
  - [Cart API OpenAPI](../api/cart-api.yaml)
- **Type Schemas:**
  - [Payment Types](../types/payment.schema.ts)
  - [Cart Types](../types/cart.schema.ts)
- **Configuration:** `backend/src/config/payment.config.ts`
- **Documentation existante:**
  - `backend/SYSTEME-PAIEMENT-ACTUEL.md`
  - `backend/PAYBOX-CONFIGURATION.md`
  - `backend/PAYBOX-PRODUCTION-SETUP.md`

## 📝 Notes

### Décisions Techniques Importantes

1. **Choix Paybox sur SystemPay:**
   - Raison: meilleure documentation, support API moderne, tarifs compétitifs
   - Trade-off: vendor lock-in acceptable pour gain en maintenabilité

2. **Redis pour Cache Panier:**
   - Raison: performances (latence < 1ms vs 10-50ms DB), TTL automatique
   - Trade-off: dépendance infrastructure, mais fallback DB robuste

3. **Signature HMAC Côté Backend:**
   - Raison: sécurité (clé secrète jamais exposée frontend)
   - Trade-off: latence +50ms acceptable pour garantie sécurité

4. **Fusion Panier Automatique:**
   - Raison: UX fluide, évite perte données invité
   - Trade-off: complexité logique merge, mais gain UX majeur

## 📅 Timeline

- **Spec Review:** 2025-11-14
- **Development Start:** 2024-09-01
- **Testing Start:** 2024-10-15
- **Staging Deployment:** 2024-11-01
- **Production Deployment:** 2024-12-01
- **Post-launch Monitoring:** 2024-12-01 → 2025-01-01

## 🔄 Change Log

### v1.0.0 (2025-11-14)

- Initial specification created from existing implementation
- Documented current system architecture
- Identified testing gaps and production hardening tasks
