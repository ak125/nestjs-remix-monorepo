# 📧 Migration vers Resend - Service Email Moderne

## ✅ Migration Complétée

Nous avons remplacé **nodemailer** par **Resend** pour un service email moderne et fiable.

---

## 🎯 Pourquoi Resend ?

### ❌ Problèmes avec nodemailer
- Configuration SMTP complexe
- Problèmes de livrabilité (finit souvent en spam)
- Pas de dashboard analytics
- Nécessite un serveur SMTP
- Pas de tracking des emails

### ✅ Avantages de Resend
- **API ultra-simple** : 3 lignes de code pour envoyer un email
- **Gratuit jusqu'à 3000 emails/mois** (100/jour)
- **Templates React/HTML** avec coloration syntaxique
- **Excellente livrabilité** (infrastructure AWS SES)
- **Dashboard analytics inclus** : taux d'ouverture, clics, bounces
- **Webhooks automatiques** pour tracking
- **Pas de serveur SMTP** à configurer
- **Documentation claire** et exemples TypeScript

---

## 🚀 Configuration en 5 Minutes

### 1. Créer un compte Resend (GRATUIT)

```bash
# Aller sur https://resend.com/signup
# S'inscrire avec Google ou email
```

### 2. Obtenir votre API Key

1. Aller dans **Settings** → **API Keys**
2. Cliquer sur **Create API Key**
3. Nom : `Production` ou `Development`
4. Copier la clé (commence par `re_`)

### 3. Ajouter la clé dans `.env`

```bash
# /workspaces/nestjs-remix-monorepo/backend/.env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx

# Email expéditeur (domaine @resend.dev par défaut)
EMAIL_FROM=notifications@votre-domaine.com

# URL de votre application (pour liens dans emails)
APP_URL=http://localhost:5173
```

### 4. (Optionnel) Configurer votre domaine

**Option A : Utiliser @resend.dev (gratuit, par défaut)**
```
EMAIL_FROM=noreply@resend.dev
```

**Option B : Configurer votre propre domaine**
1. Dans Resend → **Domains** → **Add Domain**
2. Ajouter vos DNS records (MX, TXT, CNAME)
3. Attendre validation (~5 min)
4. Utiliser : `notifications@votre-domaine.com`

### 5. Tester

```bash
cd backend
npm run dev
```

Les emails seront envoyés lors des actions :
- ✅ Validation commande → Email confirmation
- 📦 Expédition → Email avec numéro suivi
- ❌ Annulation → Email annulation
- 💳 Rappel paiement → Email rappel

---

## 📊 Dashboard Resend

Une fois vos premiers emails envoyés, vous pouvez voir dans le dashboard :
- ✉️ **Nombre d'emails envoyés**
- ✅ **Taux de délivrance**
- 👁️ **Taux d'ouverture**
- 🖱️ **Taux de clics**
- 🚫 **Bounces / Erreurs**

Accès : https://resend.com/emails

---

## 🔧 Fichiers Modifiés

### Backend

**Nouveau service :**
```
backend/src/services/email.service.ts (100% réécrit avec Resend)
```

**Dépendances :**
```json
// Avant
"nodemailer": "^7.0.9",
"@types/nodemailer": "^7.0.2"

// Après
"resend": "^4.0.1"
```

**Module :**
```typescript
// backend/src/modules/orders/orders.module.ts
import { EmailService } from '../../services/email.service';

providers: [
  EmailService, // ✅ Déjà ajouté
]
```

---

## 📧 Emails Disponibles

### 1. Confirmation de commande
```typescript
await emailService.sendOrderConfirmation(order, customer);
```
- Envoyé après validation commande (statut 2→3)
- Contient : numéro commande, montant, date
- Bouton : "Voir ma commande"

### 2. Notification d'expédition
```typescript
await emailService.sendShippingNotification(order, customer, trackingNumber);
```
- Envoyé lors expédition (statut 3→4)
- Contient : numéro suivi, lien tracking
- Bouton : "Suivre mon colis"

### 3. Rappel de paiement
```typescript
await emailService.sendPaymentReminder(order, customer);
```
- Envoyé manuellement pour commandes impayées
- Contient : montant à payer, lien paiement
- Bouton : "Payer maintenant"

### 4. Annulation
```typescript
await emailService.sendCancellationEmail(order, customer, reason);
```
- Envoyé lors annulation (statut →6)
- Contient : raison annulation, info remboursement
- Bouton : "Voir mes commandes"

---

## 🧪 Mode Développement

Si `RESEND_API_KEY` n'est pas configurée :
- ⚠️ Les emails ne sont **pas envoyés**
- 📝 Un warning est affiché dans les logs
- ✅ L'application fonctionne normalement

```
⚠️  RESEND_API_KEY non configurée - emails désactivés
💡 Obtenez votre clé gratuite sur https://resend.com
```

Cela permet de développer sans avoir besoin de configurer les emails immédiatement.

---

## 📈 Limites Gratuites

| Plan | Prix | Emails/mois | Emails/jour |
|------|------|-------------|-------------|
| **Free** | 0€ | 3,000 | 100 |
| **Pro** | 10€ | 50,000 | Illimité |
| **Business** | 20€ | 100,000 | Illimité |

Pour un e-commerce moyen :
- **100 commandes/jour** = **300 emails/jour** (confirmation + expédition + rappels)
- ✅ Le plan gratuit suffit pour commencer
- 📈 Passer au plan Pro à 10€/mois si besoin

---

## 🔐 Sécurité

### Variables d'environnement

```bash
# ✅ FAIRE
RESEND_API_KEY=re_xxxxx  # Garder secret, ne jamais commit

# ❌ NE PAS FAIRE
# Ne jamais commit la clé API dans le code
```

### .gitignore

```
.env
.env.local
.env.production
```

---

## 🚀 Production

### Variables d'environnement

```bash
# Production
RESEND_API_KEY=re_production_xxxxx
EMAIL_FROM=notifications@autoparts.fr
APP_URL=https://autoparts.fr
```

### Recommandations

1. **Utiliser un domaine personnalisé** pour meilleure livrabilité
2. **Configurer SPF/DKIM** dans DNS (Resend le fait automatiquement)
3. **Activer webhooks** pour tracking avancé
4. **Monitorer le dashboard** régulièrement

---

## 📚 Documentation

- **Site officiel :** https://resend.com
- **Documentation API :** https://resend.com/docs
- **Exemples TypeScript :** https://resend.com/docs/send-with-nodejs
- **Dashboard :** https://resend.com/emails

---

## ✅ Checklist

- [x] Désinstaller nodemailer
- [x] Installer resend
- [x] Réécrire EmailService avec Resend API
- [x] Ajouter EmailService au OrdersModule
- [x] Créer templates HTML modernes
- [x] Gérer le cas RESEND_API_KEY non configurée
- [ ] **Obtenir clé API Resend** (https://resend.com)
- [ ] **Ajouter RESEND_API_KEY dans .env**
- [ ] Tester envoi emails
- [ ] Vérifier réception dans boîte email
- [ ] (Optionnel) Configurer domaine personnalisé

---

## 🎨 Templates Email

Tous les templates utilisent :
- **Design moderne** avec Tailwind-like styles
- **Responsive** (mobile-friendly)
- **Emojis** pour meilleure lisibilité
- **Boutons CTA** clairs
- **Branding cohérent** (couleurs, footer)

Personnalisation facile dans :
```typescript
backend/src/services/email.service.ts
// Méthodes : getOrderConfirmationTemplate(), getShippingTemplate(), etc.
```

---

## 💬 Support

**Besoin d'aide ?**
- Documentation Resend : https://resend.com/docs
- Support Resend : support@resend.com
- GitHub Resend : https://github.com/resendlabs/resend-node

---

## 🎉 Prochaines Étapes

1. ✅ **Obtenir clé API Resend** (2 min)
2. ✅ **Tester envoi emails** (valider une commande)
3. 📊 **Vérifier dashboard analytics**
4. 🎨 **Personnaliser templates** si besoin
5. 📧 **Configurer domaine personnalisé** (optionnel, recommandé en prod)

**Le service email est prêt à l'emploi ! Il suffit d'ajouter la clé API.** 🚀
