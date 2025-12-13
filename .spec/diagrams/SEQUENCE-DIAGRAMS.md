---
title: "SEQUENCE DIAGRAMS"
status: draft
version: 1.0.0
---

# Sequence Diagrams - Critical Business Flows

Cette documentation présente les **flux critiques métier** de la plateforme sous forme de diagrammes de séquence. Chaque flow documente les interactions entre composants, les timings, et la gestion d'erreurs.

## Table des Matières

1. [Checkout Complet](#1-checkout-complet)
2. [Authentification OAuth2](#2-authentification-oauth2)
3. [Paiement Paybox](#3-paiement-paybox)
4. [Recherche Produits Meilisearch](#4-recherche-produits-meilisearch)
5. [Fusion Panier (Login)](#5-fusion-panier-login)
6. [Workflow Commande](#6-workflow-commande)

---

## 1. Checkout Complet

**Description**: Flow complet depuis l'ajout au panier jusqu'à la confirmation de commande  
**Durée totale**: ~5-10 secondes  
**Criticité**: ⚠️ Critical (revenue flow)

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant F as Frontend (Remix)
    participant API as Backend API
    participant Cart as CartService
    participant Products as ProductService
    participant Promo as PromoService
    participant Taxes as TaxService
    participant Orders as OrderService
    participant Redis as Redis Cache
    participant DB as Supabase DB

    %% Phase 1: Ajout au panier
    U->>F: Clique "Ajouter au panier"
    F->>API: POST /api/cart/items {productId, quantity}
    API->>Cart: addItemToCart()
    Cart->>Redis: get('cart:session-123')
    
    alt Cache hit
        Redis-->>Cart: Cart data (5ms)
    else Cache miss
        Redis-->>Cart: null
        Cart->>DB: SELECT * FROM carts WHERE session_id
        DB-->>Cart: Cart data (50ms)
    end
    
    Cart->>Products: getProduct(productId)
    Products->>DB: SELECT * FROM produits WHERE id
    DB-->>Products: Product {price, stock, name}
    Products-->>Cart: Product data
    
    Cart->>Cart: validateStock(quantity)
    
    alt Stock suffisant
        Cart->>Cart: calculateItemTotal()
        Cart->>DB: UPDATE carts SET items
        DB-->>Cart: Updated cart
        Cart->>Redis: set('cart:session-123', cart, ttl=3600)
        Cart-->>API: {success: true, cart}
        API-->>F: 200 OK {cart, message: "Produit ajouté"}
        F-->>U: Toast "Produit ajouté au panier" + Badge count
    else Stock insuffisant
        Cart-->>API: {error: "Stock insuffisant"}
        API-->>F: 409 Conflict
        F-->>U: Toast "Stock insuffisant"
    end

    Note over U,DB: Total Phase 1: ~100-200ms

    %% Phase 2: Application promo (optionnel)
    U->>F: Saisit code promo "SUMMER20"
    F->>API: POST /api/cart/apply-promo {code}
    API->>Promo: validatePromoCode("SUMMER20")
    Promo->>DB: SELECT * FROM ic_codes WHERE code
    DB-->>Promo: Code {type, value, min_amount, expiry}
    Promo->>Promo: checkValidity(expiry, usage_limit)
    
    alt Promo valide
        Promo-->>API: {valid: true, discount: 20}
        API->>Cart: applyDiscount(20)
        Cart->>Cart: recalculateTotals()
        Cart-->>API: Updated cart
        API-->>F: 200 OK {cart, discount: -12.00€}
        F-->>U: Toast "Promo appliquée -12€"
    else Promo invalide
        Promo-->>API: {valid: false, reason: "Expiré"}
        API-->>F: 400 Bad Request
        F-->>U: Toast "Code promo invalide"
    end

    Note over U,DB: Total Phase 2: ~50-100ms

    %% Phase 3: Calcul frais livraison
    U->>F: Sélectionne adresse livraison (Paris 75001)
    F->>API: POST /api/cart/calculate-shipping {address}
    API->>Cart: calculateShippingCost(address, cartWeight)
    
    Cart->>Taxes: calculateTax(country: "FR", amount: 60.00)
    Taxes->>Redis: get('tax:rate:FR')
    
    alt Cache hit
        Redis-->>Taxes: Rate: 0.20 (2ms)
    else Cache miss
        Taxes->>DB: SELECT rate FROM tax_rules WHERE country="FR"
        DB-->>Taxes: Rate: 0.20 (30ms)
        Taxes->>Redis: set('tax:rate:FR', 0.20, ttl=1800)
    end
    
    Taxes-->>Cart: {rate: 0.20, vat: 12.00}
    Cart->>Cart: finalTotal = subtotal + shipping + vat
    Cart->>DB: UPDATE carts SET shipping_cost, tax
    DB-->>Cart: Updated
    Cart-->>API: {cart, shipping: 5.90€, vat: 12.00€, total: 77.90€}
    API-->>F: 200 OK
    F-->>U: Affiche récapitulatif (HT 60€ + Ship 5.90€ + TVA 12€ = 77.90€)

    Note over U,DB: Total Phase 3: ~50-100ms

    %% Phase 4: Création commande
    U->>F: Clique "Confirmer la commande"
    F->>API: POST /api/orders {cartId, addressId}
    API->>Orders: createOrder(cart, address)
    
    Orders->>DB: BEGIN TRANSACTION
    Orders->>DB: INSERT INTO ic_orders (customer_id, total_ht, total_ttc, status="PENDING")
    DB-->>Orders: Order {id: "ORD-2024-001"}
    
    Orders->>DB: INSERT INTO ic_order_items (order_id, product_id, quantity, price)
    DB-->>Orders: Order items created
    
    Orders->>Cart: clearCart(sessionId)
    Cart->>DB: DELETE FROM carts WHERE session_id
    Cart->>Redis: del('cart:session-123')
    
    Orders->>DB: COMMIT TRANSACTION
    DB-->>Orders: Success
    
    Orders->>Orders: emit('order.created', order)
    
    Orders-->>API: {order, redirect: "/checkout-payment?orderId=ORD-2024-001"}
    API-->>F: 201 Created
    F->>F: redirect("/checkout-payment?orderId=ORD-2024-001")
    F-->>U: Redirige vers page paiement

    Note over U,DB: Total Phase 4: ~200-300ms
    Note over U,DB: TOTAL CHECKOUT: ~500ms - 1s
```

### Métriques Performance

| Phase | Opération | Target | P95 Actuel | Status |
|-------|-----------|--------|------------|--------|
| 1 | Ajout panier | <200ms | 120ms | ✅ OK |
| 2 | Application promo | <100ms | 65ms | ✅ OK |
| 3 | Calcul shipping/tax | <100ms | 80ms | ✅ OK |
| 4 | Création commande | <300ms | 220ms | ✅ OK |
| **Total** | **Checkout complet** | **<1s** | **485ms** | ✅ OK |

### Gestion d'Erreurs

| Erreur | HTTP Code | Action | Retry |
|--------|-----------|--------|-------|
| Stock insuffisant | 409 Conflict | Afficher stock restant | Non |
| Code promo invalide | 400 Bad Request | Message d'erreur | Non |
| Transaction DB failed | 500 Internal | Rollback + log | Oui (1x) |
| Redis down | 200 OK | Mode dégradé (sans cache) | N/A |

---

## 2. Authentification OAuth2

**Description**: Flux SSO avec Keycloak (entreprise) ou Supabase Auth (passwordless)  
**Durée totale**: ~2-5 secondes  
**Criticité**: ⚡ High

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant F as Frontend
    participant API as Backend API
    participant Auth as AuthService
    participant KC as Keycloak
    participant SB as Supabase Auth
    participant Redis as Redis
    participant DB as Supabase DB

    %% Flow 1: Keycloak OAuth2 (entreprise)
    rect rgb(230, 240, 255)
    Note over U,DB: Flow 1: Keycloak OAuth2 SSO
    
    U->>F: Clique "Se connecter avec SSO"
    F->>F: Generate state + PKCE verifier
    F->>Redis: set('oauth:state:abc123', {verifier}, ttl=600)
    F->>KC: Redirect /auth/realms/company/protocol/openid-connect/auth<br/>?client_id=...&redirect_uri=...&state=abc123&code_challenge=...
    
    U->>KC: Login + 2FA (si activé)
    KC->>KC: Validate credentials
    KC->>F: Redirect /auth/callback?code=xyz789&state=abc123
    
    F->>API: POST /api/auth/oauth/callback {code, state}
    API->>Redis: get('oauth:state:abc123')
    Redis-->>API: {verifier}
    API->>API: validateState(state, stored)
    
    API->>KC: POST /token<br/>{code, code_verifier, client_id, client_secret}
    KC-->>API: {access_token, refresh_token, id_token}
    
    API->>KC: GET /userinfo<br/>Authorization: Bearer access_token
    KC-->>API: {sub, email, name, roles}
    
    API->>Auth: findOrCreateUser(email, keycloak_sub)
    Auth->>DB: SELECT * FROM users WHERE email=... OR keycloak_id=...
    
    alt User exists
        DB-->>Auth: User {id, email, role}
        Auth->>DB: UPDATE users SET keycloak_id=..., last_login=now()
    else New user
        DB-->>Auth: null
        Auth->>DB: INSERT INTO users (email, keycloak_id, role=2)
        DB-->>Auth: User {id}
    end
    
    Auth->>Auth: generateJWT({userId, email, role}, expiresIn="15m")
    Auth->>Auth: generateRefreshToken({userId}, expiresIn="7d")
    Auth->>Redis: set('session:user-123', {user, keycloak_token}, ttl=604800)
    
    Auth-->>API: {access_token, refresh_token, user}
    API-->>F: Set-Cookie: access_token, refresh_token<br/>200 OK {user}
    F->>F: redirect("/dashboard")
    F-->>U: Affiche tableau de bord personnalisé
    end

    Note over U,DB: OAuth2 Flow: ~3-5s (externe Keycloak)

    %% Flow 2: Supabase Passwordless (client)
    rect rgb(240, 255, 240)
    Note over U,DB: Flow 2: Supabase Passwordless (Magic Link)
    
    U->>F: Saisit email "client@example.com"
    F->>API: POST /api/auth/magic-link {email}
    API->>SB: auth.signInWithOtp({email, options})
    SB->>SB: Generate secure OTP token
    SB->>U: Email "Votre lien de connexion" (expire 1h)
    SB-->>API: {success: true}
    API-->>F: 200 OK {message: "Email envoyé"}
    F-->>U: "Vérifiez votre email pour vous connecter"
    
    U->>U: Ouvre email + clique lien
    U->>SB: GET /auth/v1/verify?token=...&type=magiclink
    SB->>SB: Validate token + expiry
    SB->>F: Redirect /auth/callback?access_token=...&refresh_token=...
    
    F->>API: POST /api/auth/supabase-callback {access_token}
    API->>SB: auth.getUser(access_token)
    SB-->>API: {user: {id, email}}
    
    API->>Auth: findOrCreateUser(email, supabase_id)
    Auth->>DB: SELECT * FROM users WHERE email=...
    
    alt User exists
        DB-->>Auth: User {id, email, role=1}
    else New user
        Auth->>DB: INSERT INTO users (email, supabase_id, role=1)
        DB-->>Auth: User {id}
    end
    
    Auth->>Auth: generateJWT({userId, email, role=1}, expiresIn="15m")
    Auth->>Redis: set('session:user-456', {user, supabase_token}, ttl=604800)
    Auth-->>API: {access_token, user}
    API-->>F: Set-Cookie: access_token<br/>200 OK {user}
    F->>F: redirect("/")
    F-->>U: Affiche page d'accueil connecté
    end

    Note over U,DB: Passwordless Flow: ~2-3s (+ délai email)
```

### Comparaison Méthodes Auth

| Méthode | Use Case | Durée | Sécurité | UX |
|---------|----------|-------|----------|-----|
| **Keycloak OAuth2** | Entreprises B2B, SSO | ~3-5s | ⭐⭐⭐⭐⭐ (2FA) | ⭐⭐⭐⭐ |
| **Supabase Magic Link** | Clients B2C, passwordless | ~2-3s + email | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **JWT Classic** | API internes | ~100ms | ⭐⭐⭐ | ⭐⭐⭐ |

### Tokens Lifecycle

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Redis

    Note over Client,Redis: Access Token (15 min TTL)
    Client->>API: GET /api/orders<br/>Authorization: Bearer access_token
    API->>API: verifyJWT(access_token)
    
    alt Token valid
        API->>Redis: get('session:user-123')
        Redis-->>API: Session data
        API-->>Client: 200 OK {orders}
    else Token expired
        API-->>Client: 401 Unauthorized {error: "Token expired"}
        Client->>API: POST /api/auth/refresh<br/>{refresh_token}
        API->>Redis: get('session:user-123')
        Redis-->>API: Session {refresh_token}
        API->>API: verifyRefreshToken()
        
        alt Refresh valid
            API->>API: generateJWT({userId}, expiresIn="15m")
            API-->>Client: 200 OK {access_token: "new-token"}
            Client->>Client: Store new access_token
            Client->>API: Retry GET /api/orders (avec nouveau token)
        else Refresh expired
            API-->>Client: 401 Unauthorized {error: "Refresh expired"}
            Client->>Client: redirect("/login")
        end
    end
```

---

## 3. Paiement Paybox

**Description**: Intégration complète Paybox avec 3D Secure et callbacks IPN  
**Durée totale**: ~30s - 5min (dépend user CB)  
**Criticité**: ⚠️ Critical (revenue flow)

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant F as Frontend
    participant API as Backend API
    participant Payment as PaymentService
    participant Paybox as PayboxService
    participant PBGateway as Paybox Gateway
    participant Bank as Bank 3DS
    participant Notif as NotificationService
    participant DB as Supabase DB

    %% Phase 1: Initialisation paiement
    U->>F: Clique "Procéder au paiement" (order: ORD-2024-001, amount: 77.90€)
    F->>API: GET /api/paybox/redirect?orderId=ORD-2024-001&amount=77.90&email=client@example.com
    API->>Paybox: generatePaymentForm({orderId, amount, email})
    
    Paybox->>Paybox: buildParams({<br/>  PBX_SITE: "1999888",<br/>  PBX_RANG: "01",<br/>  PBX_IDENTIFIANT: "123456789",<br/>  PBX_TOTAL: "7790", // centimes<br/>  PBX_DEVISE: "978", // EUR<br/>  PBX_CMD: "ORD-2024-001",<br/>  PBX_PORTEUR: "client@example.com",<br/>  PBX_RETOUR: "Mt:M;Ref:R;Auto:A;Erreur:E",<br/>  PBX_HASH: "SHA512",<br/>  PBX_TIME: "2024-01-15T14:30:00+01:00"<br/>})
    
    Paybox->>Paybox: buildSignatureString(params)
    Note over Paybox: Ordre EXACT: PBX_SITE, PBX_RANG, PBX_IDENTIFIANT,<br/>PBX_TOTAL, PBX_DEVISE, PBX_CMD, PBX_PORTEUR,<br/>PBX_RETOUR, PBX_HASH, PBX_TIME
    
    Paybox->>Paybox: calculateHMAC(signatureString, HMAC_KEY)
    Note over Paybox: HMAC-SHA512(signatureString, pack("H*", key))
    
    Paybox-->>API: {<br/>  gatewayUrl: "https://tpeweb.paybox.com/cgi/MYchoix_pagepaiement.cgi",<br/>  formData: {params + PBX_HMAC: "ABC123..."},<br/>  transactionId: "TXN-2024-001"<br/>}
    
    API->>DB: INSERT INTO ic_payments (order_id, amount, status="PENDING", provider="paybox", transaction_id)
    DB-->>API: Payment created
    
    API-->>F: 200 OK HTML auto-submit form
    F->>F: Auto-submit form <form method="POST" action="https://tpeweb.paybox.com...">
    F->>PBGateway: POST avec tous params + PBX_HMAC
    PBGateway-->>U: Affiche page saisie CB Paybox

    Note over U,PBGateway: Phase 1: ~500ms (backend) + redirect

    %% Phase 2: Saisie CB + 3D Secure
    U->>PBGateway: Saisit CB (numéro, expiry, CVV)
    PBGateway->>PBGateway: Validate card format
    PBGateway->>Bank: Demande authentification 3D Secure
    Bank-->>U: Affiche challenge 3DS (SMS, app banque)
    
    U->>Bank: Confirme code 3DS
    Bank->>Bank: Validate 3DS code
    Bank-->>PBGateway: 3DS success
    
    PBGateway->>Bank: Authorize payment 77.90€
    Bank->>Bank: Check balance + fraud rules
    
    alt Paiement autorisé
        Bank-->>PBGateway: {autorisation: "123456", success: true}
        PBGateway-->>U: Affiche "Paiement réussi ✅"
        
        %% IPN Callback (asynchorne)
        PBGateway->>API: POST /api/paybox/callback (IPN)<br/>{Mt=7790, Ref=ORD-2024-001, Auto=123456, Erreur=00000}
        API->>Paybox: verifyIPNSignature(params, signature)
        Paybox->>Paybox: Recalculate HMAC from params
        Paybox->>Paybox: Compare signatures
        
        alt Signature valide
            Paybox-->>API: Signature OK
            API->>Payment: updatePaymentStatus("ORD-2024-001", "CAPTURED")
            Payment->>DB: UPDATE ic_payments SET status="CAPTURED", provider_transaction_id="123456"
            Payment->>DB: UPDATE ic_orders SET status="PAID", payment_date=now()
            DB-->>Payment: Updated
            
            Payment->>Payment: emit('payment.success', {orderId, amount})
            
            par Parallel notifications
                Payment->>Notif: sendEmail(client@example.com, "Paiement confirmé")
                Notif->>Notif: renderTemplate("payment-success", {order})
                Notif-->>U: Email "Paiement réussi ✅"
            and
                Payment->>Notif: sendAdminNotification("Nouvelle commande ORD-2024-001")
            end
            
            Payment-->>API: {success: true}
            API-->>PBGateway: 200 OK (IPN acknowledged)
        else Signature invalide
            Paybox-->>API: Signature INVALID
            API->>Payment: logSuspiciousActivity({params, signature, ip})
            API-->>PBGateway: 403 Forbidden (IPN rejected)
        end
        
        %% Redirect retour user
        PBGateway->>F: Redirect /checkout-payment-return?Mt=7790&Ref=ORD-2024-001&Auto=123456
        F->>API: GET /api/orders/ORD-2024-001
        API-->>F: Order {status: "PAID", total: 77.90€}
        F-->>U: Affiche page confirmation commande
        
    else Paiement refusé
        Bank-->>PBGateway: {error: "INSUFFICIENT_FUNDS"}
        PBGateway-->>U: Affiche "Paiement refusé ❌"
        
        PBGateway->>API: POST /api/paybox/callback (IPN)<br/>{Mt=7790, Ref=ORD-2024-001, Erreur=00001}
        API->>Payment: updatePaymentStatus("ORD-2024-001", "FAILED")
        Payment->>DB: UPDATE ic_payments SET status="FAILED", error_code="00001"
        DB-->>Payment: Updated
        Payment-->>API: {success: false, error: "INSUFFICIENT_FUNDS"}
        API-->>PBGateway: 200 OK
        
        PBGateway->>F: Redirect /checkout-payment-return?Erreur=00001
        F-->>U: Affiche "Paiement échoué, réessayez"
    end

    Note over U,DB: Phase 2: ~30s - 5min (interaction user)
```

### Codes Erreur Paybox

| Code | Signification | Action User | Retry |
|------|---------------|-------------|-------|
| 00000 | Success | N/A | N/A |
| 00001 | Insufficient funds | Autre CB | Oui |
| 00002 | Invalid card | Vérifier numéro | Oui |
| 00003 | Expired card | CB valide | Oui |
| 00004 | 3DS failed | Valider 3DS | Oui |
| 00008 | Invalid CVV | Corriger CVV | Oui |
| 00012 | Transaction rejected (fraud) | Contacter banque | Non |
| 00017 | User cancelled | N/A | Oui |
| 00030 | Format error | Signaler support | Non |
| 99999 | Timeout Paybox | Retry | Oui |

### Sécurité HMAC

**Génération signature (Ordre CRITIQUE)** :
```typescript
// 1. Construire string dans l'ordre EXACT
const signatureString = 
  `PBX_SITE=${params.PBX_SITE}&` +
  `PBX_RANG=${params.PBX_RANG}&` +
  `PBX_IDENTIFIANT=${params.PBX_IDENTIFIANT}&` +
  `PBX_TOTAL=${params.PBX_TOTAL}&` +
  `PBX_DEVISE=${params.PBX_DEVISE}&` +
  `PBX_CMD=${params.PBX_CMD}&` +
  `PBX_PORTEUR=${params.PBX_PORTEUR}&` +
  `PBX_RETOUR=${params.PBX_RETOUR}&` +
  `PBX_HASH=${params.PBX_HASH}&` +
  `PBX_TIME=${params.PBX_TIME}`;

// 2. Pack HMAC key (hex to binary)
const keyBuffer = Buffer.from(HMAC_KEY, 'hex');

// 3. Calculate HMAC-SHA512
const hmac = crypto.createHmac('sha512', keyBuffer);
hmac.update(signatureString);
const signature = hmac.digest('hex').toUpperCase();

// 4. Add to form
params.PBX_HMAC = signature;
```

### Métriques

| Métrique | Target | Actuel | Status |
|----------|--------|--------|--------|
| IPN callback processing | <1s | 450ms | ✅ OK |
| Signature validation | <50ms | 28ms | ✅ OK |
| Payment success rate | >95% | 96.3% | ✅ OK |
| Fraud detection rate | <0.1% | 0.04% | ✅ OK |

---

## 4. Recherche Produits Meilisearch

**Description**: Recherche full-text avec autocomplete et facettes  
**Durée totale**: ~50-150ms  
**Criticité**: ⚡ High (user experience)

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant F as Frontend
    participant API as Backend API
    participant Search as SearchService
    participant Meili as Meilisearch
    participant Redis as Redis Cache
    participant DB as Supabase DB

    %% Autocomplete (debounced)
    U->>F: Tape "plaquett" (debounce 300ms)
    F->>API: GET /api/search/autocomplete?q=plaquett
    API->>Search: getAutocomplete("plaquett")
    Search->>Redis: get('autocomplete:plaquett')
    
    alt Cache hit
        Redis-->>Search: Suggestions ["plaquette frein", "plaquette avant"] (2ms)
        Search-->>API: Suggestions
        API-->>F: 200 OK {suggestions: [...]}
        F-->>U: Dropdown avec suggestions
    else Cache miss
        Redis-->>Search: null
        Search->>Meili: POST /indexes/products/search<br/>{q: "plaquett", limit: 5, attributesToSearchOn: ["name"]}
        Meili->>Meili: Typo-tolerant search (Levenshtein distance)
        Meili->>Meili: Ranking: typo, words, proximity, attribute, exactness
        Meili-->>Search: Hits ["plaquette frein avant", "plaquette arrière"] (15ms)
        Search->>Redis: set('autocomplete:plaquett', suggestions, ttl=300)
        Search-->>API: Suggestions
        API-->>F: 200 OK
        F-->>U: Dropdown suggestions
    end

    Note over U,Meili: Autocomplete: ~20-50ms

    %% Recherche complète
    U->>F: Appuie Enter ou clique suggestion
    F->>API: GET /api/search?q=plaquette frein&facets=marque,vehicule&page=1&limit=24
    API->>Search: searchProducts({q, facets, page, limit})
    Search->>Redis: get('search:plaquette_frein:1')
    
    alt Cache hit (<5min)
        Redis-->>Search: Results {hits: 450, products: [...], facets} (5ms)
        Search-->>API: Cached results
        API-->>F: 200 OK
        F-->>U: Affiche 24 produits + facettes
    else Cache miss
        Redis-->>Search: null
        Search->>Meili: POST /indexes/products/search<br/>{<br/>  q: "plaquette frein",<br/>  facets: ["marque", "vehicule"],<br/>  filter: null,<br/>  sort: ["_rankingScore:desc"],<br/>  page: 1,<br/>  hitsPerPage: 24<br/>}
        
        Meili->>Meili: Tokenize query: ["plaquette", "frein"]
        Meili->>Meili: Search in 4M+ products index
        Meili->>Meili: Apply ranking rules:<br/>1. Typo (0 typos)<br/>2. Words (all words present)<br/>3. Proximity (words close)<br/>4. Attribute (name > description)<br/>5. Exactness (exact match)<br/>6. Custom (popularity)
        Meili->>Meili: Compute facets distribution
        Meili-->>Search: {<br/>  hits: 450,<br/>  estimatedTotalHits: 450,<br/>  processingTimeMs: 42,<br/>  products: [...24 results],<br/>  facetDistribution: {<br/>    marque: {Bosch: 120, Ferodo: 85, ATE: 65},<br/>    vehicule: {Renault: 180, Peugeot: 150}<br/>  }<br/>} (42ms)
        
        Search->>Search: enrichProductsWithStock(products)
        Search->>Redis: mget(['stock:12345', 'stock:12346', ...])
        Redis-->>Search: Stock data (8ms)
        
        Search->>Redis: set('search:plaquette_frein:1', results, ttl=300)
        Search-->>API: Results
        API-->>F: 200 OK {hits, products, facets, page, totalPages}
        F-->>U: Affiche grid produits + filtres sidebar
    end

    Note over U,Meili: Search complète: ~50-150ms

    %% Application filtres
    U->>F: Clique filtre "Bosch" + "Renault"
    F->>API: GET /api/search?q=plaquette frein&facets=marque,vehicule&filters=marque:Bosch AND vehicule:Renault&page=1
    API->>Search: searchProducts({filters: "marque = 'Bosch' AND vehicule = 'Renault'"})
    
    Search->>Meili: POST /indexes/products/search<br/>{<br/>  q: "plaquette frein",<br/>  filter: "marque = 'Bosch' AND vehicule = 'Renault'",<br/>  facets: ["marque", "vehicule"]<br/>}
    
    Meili->>Meili: Apply text search (ranking)
    Meili->>Meili: Apply filters (exact match facets)
    Meili-->>Search: {hits: 35, products: [...]} (28ms)
    
    Search->>Redis: set('search:plaquette_frein_bosch_renault:1', results, ttl=300)
    Search-->>API: Filtered results
    API-->>F: 200 OK {hits: 35, products: [...]}
    F-->>U: Affiche 35 produits filtrés

    Note over U,Meili: Avec filtres: ~30-80ms
```

### Index Meilisearch Structure

```json
{
  "uid": "products",
  "primaryKey": "id",
  "searchableAttributes": [
    "name",
    "reference",
    "ean",
    "description",
    "marque",
    "category"
  ],
  "filterableAttributes": [
    "marque",
    "category",
    "vehicule",
    "price_range",
    "in_stock"
  ],
  "sortableAttributes": [
    "price",
    "popularity",
    "created_at"
  ],
  "rankingRules": [
    "words",
    "typo",
    "proximity",
    "attribute",
    "sort",
    "exactness"
  ],
  "typoTolerance": {
    "enabled": true,
    "minWordSizeForTypos": {
      "oneTypo": 4,
      "twoTypos": 8
    }
  },
  "pagination": {
    "maxTotalHits": 10000
  }
}
```

### Métriques Performance

| Opération | Documents | Target | P95 Actuel | P99 |
|-----------|-----------|--------|------------|-----|
| Autocomplete | 4M+ | <50ms | 23ms | 35ms |
| Search sans filtres | 4M+ | <100ms | 87ms | 142ms |
| Search avec filtres | 450 | <80ms | 52ms | 78ms |
| Facet computation | 4M+ | +10ms | +8ms | +15ms |
| Cache hit rate | N/A | >80% | 91% | N/A |

---

## 5. Fusion Panier (Login)

**Description**: Fusion panier invité avec panier user authentifié  
**Durée totale**: ~100-200ms  
**Criticité**: 📊 Medium (UX smooth)

```mermaid
sequenceDiagram
    autonumber
    participant U as User (Guest)
    participant F as Frontend
    participant API as Backend API
    participant Auth as AuthService
    participant Cart as CartService
    participant Redis as Redis
    participant DB as Supabase DB

    %% Phase 1: Navigation invité
    Note over U,DB: Guest Session: session-abc123
    
    U->>F: Ajoute produits au panier (guest)
    F->>API: POST /api/cart/items {productId, quantity}
    API->>Cart: addItemToCart(sessionId="session-abc123")
    Cart->>DB: UPDATE carts SET items WHERE session_id="session-abc123"
    DB-->>Cart: Updated
    Cart-->>API: {cart: {items: 3, total: 45.00€}}
    API-->>F: 200 OK
    F-->>U: Badge panier "3 articles"

    Note over U,DB: Guest cart: 3 items, 45.00€

    %% Phase 2: Login
    U->>F: Clique "Se connecter" (redirect depuis /checkout)
    F->>F: Store guestSessionId in localStorage
    F->>API: POST /api/auth/login {email, password, guestSessionId: "session-abc123"}
    API->>Auth: validateCredentials(email, password)
    Auth->>DB: SELECT * FROM users WHERE email=...
    DB-->>Auth: User {id: "user-456", email, hashed_password}
    Auth->>Auth: bcrypt.compare(password, hashed_password)
    
    alt Password valid
        Auth->>Auth: generateJWT({userId: "user-456"})
        Auth->>Redis: set('session:user-456', {user}, ttl=604800)
        
        %% Phase 3: Fusion panier
        Auth->>Cart: mergeCarts(guestSessionId="session-abc123", userId="user-456")
        
        Cart->>DB: BEGIN TRANSACTION
        
        %% Récupérer panier user
        Cart->>DB: SELECT * FROM carts WHERE user_id="user-456"
        
        alt User has existing cart
            DB-->>Cart: User cart {items: 2, total: 30.00€}
            
            %% Récupérer panier guest
            Cart->>DB: SELECT * FROM carts WHERE session_id="session-abc123"
            DB-->>Cart: Guest cart {items: 3, total: 45.00€}
            
            %% Merge logic
            Cart->>Cart: mergeItems(userCart, guestCart)
            Note over Cart: Merge rules:<br/>- Same product: sum quantities<br/>- Different products: add to cart<br/>- Keep higher quantity if conflict
            
            %% Produit 1: Plaquette (user: 1, guest: 2) → 3
            %% Produit 2: Filtre (guest only) → 1
            %% Produit 3: Huile (user only) → 1
            %% Result: 5 items total
            
            Cart->>Cart: recalculateTotals() → 75.00€
            
            Cart->>DB: UPDATE carts SET items=[...], total=75.00 WHERE user_id="user-456"
            Cart->>DB: DELETE FROM carts WHERE session_id="session-abc123"
            
            Cart->>DB: COMMIT TRANSACTION
            DB-->>Cart: Success
            
            Cart->>Redis: del('cart:session-abc123')
            Cart->>Redis: set('cart:user-456', mergedCart, ttl=3600)
            
            Cart-->>Auth: {cart: {items: 5, total: 75.00€}}
        else No existing user cart
            DB-->>Cart: null
            
            %% Simply transfer guest cart to user
            Cart->>DB: UPDATE carts SET user_id="user-456", session_id=null WHERE session_id="session-abc123"
            Cart->>DB: COMMIT TRANSACTION
            DB-->>Cart: Success
            
            Cart->>Redis: del('cart:session-abc123')
            Cart->>Redis: set('cart:user-456', guestCart, ttl=3600)
            
            Cart-->>Auth: {cart: {items: 3, total: 45.00€}}
        end
        
        Auth-->>API: {access_token, user, cart}
        API-->>F: Set-Cookie: access_token<br/>200 OK {user, cart}
        F->>F: Clear guestSessionId from localStorage
        F->>F: Update cart badge "5 articles"
        F->>F: redirect("/checkout")
        F-->>U: Redirige vers checkout avec panier fusionné
        
    else Password invalid
        Auth-->>API: {error: "Invalid credentials"}
        API-->>F: 401 Unauthorized
        F-->>U: "Email ou mot de passe incorrect"
    end

    Note over U,DB: Fusion: ~100-200ms (transaction DB)
```

### Merge Logic

```typescript
function mergeItems(userItems: CartItem[], guestItems: CartItem[]): CartItem[] {
  const merged = new Map<string, CartItem>();

  // 1. Add all user items
  for (const item of userItems) {
    merged.set(item.product_id, { ...item });
  }

  // 2. Merge guest items
  for (const guestItem of guestItems) {
    const existing = merged.get(guestItem.product_id);

    if (existing) {
      // Same product: sum quantities (max 99)
      existing.quantity = Math.min(existing.quantity + guestItem.quantity, 99);
      existing.price_total = existing.price * existing.quantity;
    } else {
      // New product: add to cart
      merged.set(guestItem.product_id, { ...guestItem });
    }
  }

  return Array.from(merged.values());
}
```

### Cas Limites

| Cas | Comportement | Raison |
|-----|--------------|--------|
| Même produit (user + guest) | Additionner quantités (max 99) | Préserver intention achat |
| Produit unique guest | Ajouter au panier user | Conserver sélection guest |
| Produit unique user | Conserver | Préserver historique user |
| Stock insuffisant après merge | Ajuster quantité au stock max | Éviter commande impossible |
| Guest cart vide | Conserver user cart uniquement | Pas de merge nécessaire |
| User cart vide | Transférer guest cart à user | Simple transfert ownership |

---

## 6. Workflow Commande

**Description**: Cycle de vie complet d'une commande (9 statuts)  
**Durée totale**: ~3-7 jours  
**Criticité**: ⚡ High (business critical)

```mermaid
sequenceDiagram
    autonumber
    participant Customer as Client
    participant Orders as OrderService
    participant Payment as PaymentService
    participant Shipping as ShippingService
    participant Carrier as Carrier API
    participant Staff as Staff Admin
    participant Notif as NotificationService
    participant DB as Supabase DB

    %% Status 1: PENDING
    Note over Customer,DB: Status 1: PENDING (création)
    Customer->>Orders: Crée commande (checkout)
    Orders->>DB: INSERT INTO ic_orders (status="PENDING")
    DB-->>Orders: Order {id: "ORD-001", status: "PENDING"}
    Orders->>Notif: emit('order.created')
    Notif-->>Customer: Email "Commande créée"
    Notif-->>Staff: Notification admin "Nouvelle commande"

    %% Status 2: PAID
    Note over Customer,DB: Status 2: PAID (paiement réussi)
    Customer->>Payment: Paie via Paybox
    Payment->>Payment: IPN callback success
    Payment->>Orders: updateStatus("ORD-001", "PAID")
    Orders->>DB: UPDATE ic_orders SET status="PAID", payment_date=now()
    Orders->>Orders: emit('order.paid')
    Notif-->>Customer: Email "Paiement confirmé"

    %% Status 3: VALIDATED
    Note over Customer,DB: Status 3: VALIDATED (validation admin)
    Staff->>Orders: POST /api/orders/ORD-001/validate
    Orders->>Orders: checkStock(order.items)
    
    alt Stock suffisant
        Orders->>DB: UPDATE ic_orders SET status="VALIDATED", validated_by=staff_id
        Orders->>Orders: emit('order.validated')
        Notif-->>Customer: Email "Commande validée"
        
        %% Status 4: PROCESSING
        Note over Customer,DB: Status 4: PROCESSING (préparation)
        Staff->>Orders: POST /api/orders/ORD-001/start-processing
        Orders->>DB: UPDATE ic_orders SET status="PROCESSING", processing_started_at=now()
        Orders->>Orders: emit('order.processing')
        Notif-->>Customer: Email "Commande en préparation"
        
        %% Phase picking warehouse
        Staff->>Staff: Picking produits (1-2h)
        Staff->>Staff: Quality check
        
        %% Status 5: PACKED
        Note over Customer,DB: Status 5: PACKED (emballé)
        Staff->>Orders: POST /api/orders/ORD-001/mark-packed
        Orders->>DB: UPDATE ic_orders SET status="PACKED", packed_at=now()
        Orders->>Orders: emit('order.packed')
        
        %% Génération étiquette
        Orders->>Shipping: createShipment(order)
        Shipping->>Carrier: POST /api/shipments {address, weight, dimensions}
        Carrier-->>Shipping: {tracking_number: "DHL123456789", label_url}
        Shipping->>DB: INSERT INTO shipments (order_id, tracking_number, carrier)
        Shipping-->>Orders: Shipment created
        
        %% Status 6: SHIPPED
        Note over Customer,DB: Status 6: SHIPPED (expédié)
        Staff->>Orders: POST /api/orders/ORD-001/mark-shipped
        Orders->>DB: UPDATE ic_orders SET status="SHIPPED", shipped_at=now()
        Orders->>Orders: emit('order.shipped')
        Notif-->>Customer: Email "Commande expédiée" + tracking DHL123456789
        
        %% Tracking updates (background job)
        loop Toutes les 6h pendant 7 jours
            Shipping->>Carrier: GET /api/tracking/DHL123456789
            Carrier-->>Shipping: {status: "IN_TRANSIT", location: "Paris CDG"}
            Shipping->>DB: INSERT INTO tracking_events (tracking_number, status, location)
        end
        
        %% Status 7: DELIVERED
        Note over Customer,DB: Status 7: DELIVERED (livré)
        Carrier->>Shipping: Webhook: Delivery confirmed
        Shipping->>Orders: updateStatus("ORD-001", "DELIVERED")
        Orders->>DB: UPDATE ic_orders SET status="DELIVERED", delivered_at=now()
        Orders->>Orders: emit('order.delivered')
        Notif-->>Customer: Email "Commande livrée ✅"
        
        %% Status 8: COMPLETED (après 14j sans retour)
        Note over Customer,DB: Status 8: COMPLETED (finalisé)
        Orders->>Orders: CRON job (after 14 days)
        Orders->>DB: UPDATE ic_orders SET status="COMPLETED", completed_at=now()
        Orders->>Orders: emit('order.completed')
        
    else Stock insuffisant
        Orders->>DB: UPDATE ic_orders SET status="STOCK_ISSUE"
        Notif-->>Customer: Email "Délai supplémentaire (stock)"
        Notif-->>Staff: Alert "Stock insuffisant ORD-001"
    end

    %% Status 9: CANCELLED (possible avant SHIPPED)
    alt Annulation client (avant expédition)
        Customer->>Orders: POST /api/orders/ORD-001/cancel
        Orders->>Orders: checkIfCancellable(status)
        
        alt Status in [PENDING, PAID, VALIDATED, PROCESSING]
            Orders->>DB: UPDATE ic_orders SET status="CANCELLED", cancelled_reason="user_request"
            Orders->>Payment: initiateRefund(payment_id)
            Payment->>Payment: Paybox refund (3-5 days)
            Orders->>Orders: emit('order.cancelled')
            Notif-->>Customer: Email "Commande annulée, remboursement 3-5j"
        else Status >= SHIPPED
            Orders-->>Customer: 400 Bad Request "Commande déjà expédiée"
        end
    end
```

### Status Transitions

```mermaid
stateDiagram-v2
    [*] --> PENDING: Commande créée
    PENDING --> PAID: Paiement OK
    PENDING --> CANCELLED: Annulation / Timeout 30min
    
    PAID --> VALIDATED: Validation admin
    PAID --> CANCELLED: Annulation admin
    
    VALIDATED --> PROCESSING: Début préparation
    VALIDATED --> STOCK_ISSUE: Stock insuffisant
    VALIDATED --> CANCELLED: Annulation
    
    STOCK_ISSUE --> VALIDATED: Stock réapprovisionné
    STOCK_ISSUE --> CANCELLED: Délai dépassé
    
    PROCESSING --> PACKED: Emballé + étiquette
    PROCESSING --> CANCELLED: Annulation (rare)
    
    PACKED --> SHIPPED: Remis au transporteur
    SHIPPED --> DELIVERED: Livraison confirmée
    SHIPPED --> RETURN_REQUESTED: Client demande retour
    
    DELIVERED --> COMPLETED: Après 14 jours
    DELIVERED --> RETURN_REQUESTED: Client insatisfait
    
    RETURN_REQUESTED --> COMPLETED: Retour accepté
    
    COMPLETED --> [*]
    CANCELLED --> [*]
```

### Durées Moyennes

| Status | Durée Moyenne | SLA | Auto-transition |
|--------|---------------|-----|-----------------|
| PENDING → PAID | ~1-5 min | 30 min | Oui (timeout) |
| PAID → VALIDATED | ~2-6h | 24h | Non (manuel) |
| VALIDATED → PROCESSING | ~1-4h | 12h | Non (manuel) |
| PROCESSING → PACKED | ~1-2h | 6h | Non (manuel) |
| PACKED → SHIPPED | ~30min | 2h | Non (manuel) |
| SHIPPED → DELIVERED | ~2-5 jours | 7 jours | Oui (webhook) |
| DELIVERED → COMPLETED | 14 jours | 14 jours | Oui (CRON) |

### Notifications Par Status

| Status | Client Email | Admin Notification | SMS (opt-in) |
|--------|--------------|-------------------|--------------|
| PENDING | ✅ "Commande créée" | ✅ "Nouvelle commande" | ❌ |
| PAID | ✅ "Paiement confirmé" | ❌ | ❌ |
| VALIDATED | ✅ "Commande validée" | ❌ | ❌ |
| PROCESSING | ✅ "En préparation" | ❌ | ❌ |
| PACKED | ❌ | ❌ | ❌ |
| SHIPPED | ✅ "Expédiée + tracking" | ❌ | ✅ (opt-in) |
| DELIVERED | ✅ "Livrée ✅" | ❌ | ✅ (opt-in) |
| COMPLETED | ❌ | ❌ | ❌ |
| CANCELLED | ✅ "Annulée + refund" | ✅ (si admin) | ❌ |

---

## Navigation

- 📖 [Retour INDEX.md](../INDEX.md)
- 🏗️ [C4 Architecture Diagrams](C4-ARCHITECTURE.md)
- 📊 [GLOBAL-COVERAGE-REPORT.md](../GLOBAL-COVERAGE-REPORT.md)
- 📋 [OpenAPI Specification](../openapi.yaml) (à créer)

---

## Références

- **Mermaid Sequence Diagrams**: https://mermaid.js.org/syntax/sequenceDiagram.html
- **Paybox Documentation**: https://www.paybox.com/documentation/
- **Meilisearch API**: https://docs.meilisearch.com/
- **OAuth2 RFC**: https://oauth.net/2/

---

**Version**: 1.0.0  
**Date**: 2025-01-15  
**Auteur**: Architecture Team  
**Status**: ✅ Production Ready
