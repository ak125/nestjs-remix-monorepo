# 🚀 Guide d'Utilisation Rapide - Module Paiements

## ⚡ Démarrage Rapide

### 1. Créer les Tables
```bash
cd /workspaces/TEMPLATE_MCP_COMPLETE/nestjs-remix-monorepo
psql -h your-supabase-host -U your-user -d your-db -f create-payment-tables.sql
```

### 2. Démarrer le Serveur
```bash
cd backend
npm run start:dev
```

### 3. Tester le Module
```bash
./test-payment-module.sh
```

## 💳 Utilisation des APIs

### Créer un Paiement
```bash
curl -X POST http://localhost:3001/api/payments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "pay_order_id": 123,
    "pay_amount": 99.99,
    "pay_currency": "EUR",
    "pay_gateway": "STRIPE",
    "pay_customer_email": "client@example.com"
  }'
```

### Initier un Paiement
```bash
curl -X POST http://localhost:3001/api/payments/1/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "returnUrl": "https://votresite.com/success",
    "cancelUrl": "https://votresite.com/cancel"
  }'
```

### Vérifier le Statut
```bash
curl -X GET http://localhost:3001/api/payments/1/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🔧 Configuration des Gateways

### Variables d'Environnement
```env
# Stripe
STRIPE_PUBLIC_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# PayPal
PAYPAL_CLIENT_ID=your_client_id
PAYPAL_CLIENT_SECRET=your_client_secret

# CyberPlus
CYBERPLUS_MERCHANT_ID=your_merchant_id
CYBERPLUS_SECRET_KEY=your_secret_key
```

## 📊 Monitoring et Audit

### Voir les Statistiques
```bash
curl -X GET http://localhost:3001/api/payments/stats \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Consulter les Logs d'Audit
Les logs sont automatiquement créés dans la table `payment_log` pour:
- Création de paiements
- Tentatives de paiement
- Callbacks reçus
- Erreurs et échecs

## 🛠️ Développement

### Ajouter un Nouveau Gateway
1. Étendre l'enum `PaymentGateway` dans les DTOs
2. Ajouter la logique dans `PaymentsService`
3. Créer la route de callback spécifique
4. Mettre à jour la validation

### Structure des Données
```typescript
// Paiement
interface Payment {
  pay_id: number;
  pay_order_id: number;
  pay_amount: number;
  pay_currency: string;
  pay_status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  pay_gateway: 'STRIPE' | 'PAYPAL' | 'CYBERPLUS' | 'BANK_TRANSFER';
  // ... autres champs
}

// Log d'audit
interface PaymentLog {
  log_id: number;
  log_payment_id: number;
  log_action: string;
  log_details: any;
  log_ip_address?: string;
  log_created_at: string;
}
```

## 🚨 Troubleshooting

### Erreurs Communes

**Erreur 500 - Table n'existe pas**
```bash
# Solution: Créer les tables
psql -f create-payment-tables.sql
```

**Erreur 401 - Non autorisé**
```bash
# Solution: Vérifier le token d'authentification
# Utiliser un token valide dans l'en-tête Authorization
```

**Erreur de validation**
```bash
# Solution: Vérifier le format des données
# Consulter la documentation Swagger sur /api/docs
```

## 📖 Ressources

- **Documentation API:** http://localhost:3001/api/docs
- **Rapport technique:** `RAPPORT_FINALISATION_PAIEMENTS.md`
- **Tests:** `test-payment-module.sh`
- **Tables SQL:** `create-payment-tables.sql`

---
**💡 Le module est prêt à l'emploi ! Commencez par créer les tables et tester les APIs.**
