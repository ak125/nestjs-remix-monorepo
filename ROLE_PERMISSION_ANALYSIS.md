# Analyse des Rôles et Permissions - Système Legacy vs NestJS

## 🔍 Analyse du système PHP Legacy

### Structure des tables utilisateurs

#### Table `___config_admin` (Administrateurs/Staff)
```sql
- cnfa_id       : ID unique administrateur
- cnfa_login    : Login de connexion
- cnfa_pswd     : Mot de passe
- cnfa_mail     : Email
- cnfa_keylog   : Clé de session
- cnfa_level    : Niveau d'accès (texte) - Niveaux 1-9
- cnfa_job      : Fonction/poste
- cnfa_name     : Nom de famille
- cnfa_fname    : Prénom
- cnfa_tel      : Téléphone
- cnfa_activ    : Statut actif (1=actif, 0=inactif)
```

#### Table `___xtr_customer` (Clients/Utilisateurs)
```sql
- cst_id        : ID unique client
- cst_mail      : Email
- cst_pswd      : Mot de passe
- cst_keylog    : Clé de session
- cst_level     : Niveau d'accès (0=client standard)
- cst_is_pro    : Statut professionnel (0=non pro, 1=pro)
- cst_activ     : Statut actif (1=actif, 0=inactif)
- cst_name      : Nom de famille
- cst_fname     : Prénom
- cst_address   : Adresse
- cst_zip_code  : Code postal
- cst_city      : Ville
- cst_country   : Pays
- cst_tel       : Téléphone
- cst_gsm       : Mobile
```

### Logique des niveaux d'accès (système PHP)

#### Système dual :
1. **Administrateurs/Staff** (table `___config_admin`)
   - **Niveau 9** : Super-administrateur (Staff + Payment management)
   - **Niveau > 6** : Administrateur commercial (accès modules commercial, expédition, paiement)
   - **Niveau 1-6** : Staff avec accès limité

2. **Clients/Utilisateurs** (table `___xtr_customer`)
   - **Niveau 0** : Utilisateur standard (clients)
   - **cst_is_pro = '1'** : Client professionnel (privilèges étendus)
   - **cst_is_pro = '0'** : Client particulier

### Contrôles d'accès identifiés
```php
// Accès aux modules commerciaux (administrateurs)
$query_log = "SELECT * FROM ___CONFIG_ADMIN WHERE CNFA_LOGIN='$log' AND CNFA_KEYLOG='$mykey' AND CNFA_LEVEL > 6";

// Accès super-admin (administrateurs)
if($PermissionLevel==9) {
    // Affichage Staff management + Payment management
}

// Utilisateurs clients (système séparé)
// Stockés dans ___xtr_customer avec cst_level=0
```

### Exemples d'utilisateurs identifiés
```javascript
// Utilisateurs clients (___xtr_customer)
auto@example.com     : level=1, isPro=0 (client standard)
andre.tessier80@sfr.fr : level=0, isPro=0 (client standard)

// Administrateurs (___config_admin) 
// Aucun identifié dans les logs actuels
```

## 🔧 Corrections apportées au système NestJS

### 1. Interface User mise à jour
```typescript
interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isPro: boolean;
  isActive: boolean;
  level?: number; // Ajouté pour gérer les niveaux
}
```

### 2. Logique navbar corrigée
```typescript
// Logique basée sur l'analyse du système PHP legacy
// Système dual : clients (level 0-1) vs administrateurs (level 7-9)
const isAdmin = user?.level && user.level >= 7; // Administrateurs commerciaux
const isSuperAdmin = user?.level && user.level >= 9; // Super-administrateurs
const isProClient = user?.isPro === true; // Client professionnel
```

### 3. Navigation adaptative
- **Client standard (level 0-1, isPro=false)** :
  - Accueil
  - Mes commandes
  - Nouvelle commande
  
- **Client professionnel (level 0-1, isPro=true)** :
  - Navigation client +
  - Fonctionnalités étendues pour pros
  
- **Administrateur commercial (level >= 7)** :
  - Navigation client +
  - Gestion commandes
  - Clients
  - Rapports
  
- **Super-administrateur (level >= 9)** :
  - Navigation admin +
  - Gestion Staff
  - Gestion Paiements

## 📊 État actuel des utilisateurs
- `auto@example.com` : level=1, isPro=false (client standard)
- `andre.tessier80@sfr.fr` : level=0, isPro=false (client standard)
- `chris2.naul@gmail.com` : level=1, isPro=false (client standard)
- `patrick.bardais@yahoo.fr` : level=1, isPro=false (client standard)

**Note** : Tous les utilisateurs actuels sont des clients standards de la table `___xtr_customer`

## ✅ Validation
- ✅ Système de permissions cohérent avec legacy PHP
- ✅ Navigation adaptative selon les niveaux
- ✅ Sécurité maintenue (pas d'accès admin par défaut)
- ✅ Architecture extensible pour futurs administrateurs

## 🎯 Prochaines étapes
1. Créer des comptes administrateurs si nécessaire
2. Tester l'interface avec différents niveaux d'accès
3. Implémenter les routes manquantes (/admin/staff, /admin/payment)
