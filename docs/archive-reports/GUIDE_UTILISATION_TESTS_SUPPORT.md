# Guide d'Utilisation et Test - Module Support
*Date: 9 septembre 2025*

## 🚀 Démarrage Rapide

### 1. Lancement des Services

```bash
# Terminal 1 - Backend NestJS
cd /workspaces/nestjs-remix-monorepo/backend
npm run dev

# Terminal 2 - Frontend Remix  
cd /workspaces/nestjs-remix-monorepo/frontend
npm run dev
```

### 2. URLs d'Accès

- **Backend API**: http://localhost:3000
- **Frontend**: http://localhost:3001
- **Documentation API**: http://localhost:3000/api (Swagger)

## 📋 Tests des Fonctionnalités

### 🎫 Système de Contact/Tickets

**Frontend URLs**:
```
http://localhost:3000/support/contact
```

**API Endpoints**:
```bash
# Créer un ticket
POST http://localhost:3000/api/support/contact
Content-Type: application/json

{
  "name": "Jean Dupont",
  "email": "jean@example.com",
  "phone": "0123456789",
  "subject": "Problème commande",
  "message": "Ma commande n'est pas arrivée",
  "priority": "high",
  "category": "order",
  "vehicleInfo": {
    "make": "Renault",
    "model": "Clio",
    "year": "2020"
  }
}

# Récupérer tickets utilisateur
GET http://localhost:3000/api/support/contact/user/{userId}

# Mettre à jour statut ticket
PATCH http://localhost:3000/api/support/contact/{ticketId}/status
{
  "status": "in_progress",
  "staffNote": "Prise en charge par l'équipe"
}
```

### ⭐ Système d'Avis Produits

**API Endpoints**:
```bash
# Soumettre un avis
POST http://localhost:3000/api/support/reviews
{
  "productId": "12345",
  "userId": "user123",
  "rating": 5,
  "title": "Excellent produit",
  "comment": "Très satisfait de mon achat",
  "verified": true
}

# Récupérer avis d'un produit
GET http://localhost:3000/api/support/reviews/product/12345

# Modération d'avis
PATCH http://localhost:3000/api/support/reviews/{reviewId}/moderate
{
  "status": "approved",
  "moderatorNote": "Avis conforme"
}
```

### 📋 Pages Légales

**Frontend URLs**:
```
http://localhost:3001/legal/cgv
http://localhost:3001/legal/politique-confidentialite
http://localhost:3001/legal/politique-cookies
```

**API Endpoints**:
```bash
# Récupérer page légale
GET http://localhost:3000/api/support/legal/cgv

# Accepter document
POST http://localhost:3000/api/support/legal/cgv/accept
{
  "userId": "user123",
  "version": "1.0",
  "ipAddress": "192.168.1.1"
}

# Télécharger PDF
GET http://localhost:3000/api/support/legal/cgv/pdf
```

### 💰 Demandes de Devis

**API Endpoints**:
```bash
# Créer demande de devis
POST http://localhost:3000/api/support/quotes
{
  "userId": "user123",
  "vehicleInfo": {
    "make": "BMW",
    "model": "Serie 3",
    "year": "2019",
    "vin": "WBABX71040GF12345"
  },
  "serviceType": "maintenance",
  "description": "Révision complète 60000km",
  "urgency": "normal",
  "preferredDate": "2025-09-15"
}

# Récupérer devis utilisateur
GET http://localhost:3000/api/support/quotes/user/{userId}
```

### ❓ FAQ Dynamique

**API Endpoints**:
```bash
# Récupérer toutes les FAQ
GET http://localhost:3000/api/support/faq

# Créer FAQ
POST http://localhost:3000/api/support/faq
{
  "question": "Comment suivre ma commande ?",
  "answer": "Vous pouvez suivre votre commande dans votre espace client",
  "category": "orders",
  "tags": ["commande", "suivi", "livraison"]
}

# Rechercher dans FAQ
GET http://localhost:3000/api/support/faq/search?q=commande
```

### 🔧 Système de Réclamations

**API Endpoints**:
```bash
# Créer réclamation
POST http://localhost:3000/api/support/claims
{
  "userId": "user123",
  "orderId": "ORD-12345",
  "type": "product_defect",
  "subject": "Pièce défectueuse",
  "description": "La pièce reçue présente un défaut",
  "severity": "high"
}

# Traiter réclamation
PATCH http://localhost:3000/api/support/claims/{claimId}/process
{
  "resolution": "replacement",
  "compensationAmount": 50.00,
  "notes": "Remplacement de la pièce défectueuse"
}
```

## 🔍 Tests avec cURL

### Test Complet Contact Service

```bash
# 1. Créer un ticket
curl -X POST http://localhost:3000/api/support/contact \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "subject": "Test Ticket",
    "message": "Ceci est un test",
    "priority": "medium",
    "category": "technical"
  }'

# 2. Lister les tickets
curl -X GET http://localhost:3000/api/support/contact \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Reviews

```bash
# Ajouter un avis
curl -X POST http://localhost:3000/api/support/reviews \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "TEST-PRODUCT",
    "userId": "TEST-USER",
    "rating": 4,
    "title": "Bon produit",
    "comment": "Conforme à mes attentes"
  }'
```

## 🧪 Tests d'Intégration Frontend

### 1. Test Interface Contact

```bash
# Ouvrir dans le navigateur
open http://localhost:3001/support/contact

# Remplir le formulaire et vérifier :
# ✅ Validation des champs en temps réel
# ✅ Upload de fichiers
# ✅ Sélection véhicule
# ✅ Messages de confirmation
```

### 2. Test Pages Légales

```bash
# Tester navigation
open http://localhost:3001/legal/cgv

# Vérifier :
# ✅ Affichage du document
# ✅ Statut acceptation (si connecté)
# ✅ Bouton acceptation
# ✅ Download PDF
```

## 📊 Monitoring et Analytics

### Vérifier les Logs

```bash
# Backend logs
tail -f /workspaces/nestjs-remix-monorepo/backend/logs/support.log

# Métriques support
curl http://localhost:3000/api/support/analytics/metrics
```

### Dashboard Support

```bash
# Statistiques en temps réel
curl http://localhost:3000/api/support/analytics/dashboard
```

## 🛠️ Outils de Développement

### Base de Données

```sql
-- Vérifier données support
SELECT * FROM ___xtr_msg WHERE msg_content LIKE '%"type":"support%';

-- Statistiques tickets
SELECT 
  JSON_EXTRACT(msg_content, '$.category') as category,
  COUNT(*) as count
FROM ___xtr_msg 
WHERE msg_content LIKE '%"type":"support_ticket%'
GROUP BY JSON_EXTRACT(msg_content, '$.category');
```

### Redis Cache

```bash
# Vérifier cache
redis-cli keys "support:*"
redis-cli get "support:stats:daily"
```

## 🔧 Configuration Avancée

### Variables d'Environnement

```bash
# Backend .env
SUPPORT_EMAIL_ENABLED=true
SUPPORT_FILE_UPLOAD_MAX_SIZE=10MB
SUPPORT_NOTIFICATION_WEBHOOKS=true
LEGAL_PDF_GENERATION=true

# Frontend .env
REACT_APP_SUPPORT_API_URL=http://localhost:3000/api/support
REACT_APP_FILE_UPLOAD_ENABLED=true
```

### Personnalisation

```typescript
// Configuration support
export const supportConfig = {
  ticketPriorities: ['low', 'medium', 'high', 'urgent'],
  categories: ['technical', 'billing', 'product', 'shipping'],
  autoAssignment: true,
  notificationChannels: ['email', 'sms', 'push']
};
```

## ✅ Checklist de Test

### Backend API
- [ ] Tous les endpoints répondent (200/201)
- [ ] Validation des données d'entrée
- [ ] Gestion des erreurs (400/404/500)
- [ ] Authentification et autorisation
- [ ] Logs et monitoring actifs

### Frontend Interface  
- [ ] Formulaires fonctionnels
- [ ] Navigation fluide
- [ ] Responsive design
- [ ] Messages d'erreur/succès
- [ ] Upload de fichiers

### Intégration
- [ ] Communication backend/frontend
- [ ] Gestion des sessions
- [ ] Notifications en temps réel
- [ ] Performance acceptable (<2s)

## 🚀 Déploiement Production

```bash
# Build production
npm run build

# Variables production
NODE_ENV=production
DATABASE_URL=your_production_db
REDIS_URL=your_redis_instance
MAIL_SERVICE_API_KEY=your_api_key
```

## 📞 Support et Documentation

- **API Documentation**: http://localhost:3000/api-docs
- **GitHub**: https://github.com/ak125/nestjs-remix-monorepo/tree/support-module
- **Issues**: Utiliser le système de tickets intégré !

---

**Le module support est maintenant opérationnel et prêt pour une utilisation en production !** 🎉
