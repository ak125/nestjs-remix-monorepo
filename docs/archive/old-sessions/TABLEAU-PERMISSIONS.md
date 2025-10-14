# 🔐 TABLEAU DES PERMISSIONS - SYSTÈME UNIFIÉ

**Système** : 15 permissions granulaires  
**Niveaux** : 4 rôles utilisateurs

---

## 📊 VUE D'ENSEMBLE

| Permission | Description | Commercial<br>(3-4) | Responsable<br>(5-6) | Admin<br>(7-8) | Super Admin<br>(9) |
|------------|-------------|:-------------------:|:--------------------:|:--------------:|:------------------:|
| **🎬 ACTIONS SUR COMMANDES (7)** | | | | | |
| `canValidate` | Valider commande (2→3) | ✅ | ❌ | ✅ | ✅ |
| `canShip` | Expédier (3→4) | ✅ | ❌ | ✅ | ✅ |
| `canDeliver` | Marquer livrée (4→5) | ✅ | ❌ | ✅ | ✅ |
| `canCancel` | Annuler commande | ✅ | ❌ | ✅ | ✅ |
| `canReturn` | Gérer retours/SAV | ❌ | ❌ | ✅ | ✅ |
| `canRefund` | Émettre remboursements | ❌ | ❌ | ✅ | ✅ |
| `canSendEmails` | Envoyer emails clients | ✅ | ❌ | ✅ | ✅ |
| **💼 GESTION (3)** | | | | | |
| `canCreateOrders` | Créer nouvelle commande | ❌ | ❌ | ✅ | ✅ |
| `canExport` | Export CSV | ✅ | ✅ | ✅ | ✅ |
| `canMarkPaid` | Marquer payé | ✅ | ❌ | ✅ | ✅ |
| **👁️ AFFICHAGE (3)** | | | | | |
| `canSeeFullStats` | Stats complètes (6 cartes) | ❌ | ✅ | ✅ | ✅ |
| `canSeeFinancials` | Montants impayés, CA | ❌ | ✅ | ✅ | ✅ |
| `canSeeCustomerDetails` | Infos client complètes | ✅ | ✅ | ✅ | ✅ |
| **🎨 INTERFACE (2)** | | | | | |
| `showAdvancedFilters` | Filtres avancés (4 vs 2) | ✅ | ✅ | ✅ | ✅ |
| `showActionButtons` | Boutons d'action | ✅ | ❌ | ✅ | ✅ |
| **TOTAL** | **Permissions actives** | **11/15** | **6/15** | **15/15** | **15/15** |

---

## 🎯 RÉCAPITULATIF PAR RÔLE

### 👔 COMMERCIAL (Niveau 3-4) - 11 permissions

**Ce qu'il PEUT faire** :
- ✅ Consulter la liste des commandes
- ✅ Voir détails d'une commande (modal Info)
- ✅ Voir profil client (lien vers `/admin/users/:id`)
- ✅ **Valider des commandes** (statut 2→3)
- ✅ **Expédier des commandes** (statut 3→4)
- ✅ **Marquer comme livrée** (statut 4→5)
- ✅ **Annuler des commandes**
- ✅ **Envoyer des emails** aux clients
- ✅ **Marquer comme payé**
- ✅ Exporter CSV
- ✅ Utiliser filtres avancés (4 filtres)
- ✅ Voir infos client complètes

**Ce qu'il NE PEUT PAS faire** :
- ❌ **Créer de nouvelles commandes** (réservé Admin)
- ❌ **Voir les statistiques** (pas de cartes stats)
- ❌ **Voir montants financiers** (CA, impayés cachés)
- ❌ Gérer retours/SAV (réservé Admin)
- ❌ Émettre remboursements (réservé Admin)

**Interface** :
- Badge : 👔 Commercial (bleu clair)
- Statistiques : **AUCUNE** (masquées)
- Filtres : 4 complets (Recherche, Statut, Paiement, Période)
- Actions : **TOUS les boutons** (Valider, Expédier, Livrer, Annuler, Rappel)
- Modals : Expédition ✅, Annulation ✅

---

### 📊 RESPONSABLE (Niveau 5-6) - 6 permissions

**Ce qu'il PEUT faire** :
- ✅ Tout comme Commercial +
- ✅ Voir statistiques complètes (6 cartes)
- ✅ Voir montants financiers (CA, Impayé)
- ✅ Utiliser filtres avancés (Paiement, Période)

**Ce qu'il NE PEUT PAS faire** :
- ❌ Valider, Expédier, Annuler des commandes
- ❌ Envoyer des emails
- ❌ Créer de nouvelles commandes
- ❌ Marquer une commande comme payée

**Interface** :
- Badge : 📊 Responsable (vert)
- Statistiques : 6 cartes complètes
- Filtres : 4 complets
- Actions : Voir + Infos uniquement (consultation pure)

**Cas d'usage** : Supervision, reporting, analyse sans modification

---

### 🔑 ADMINISTRATEUR (Niveau 7-8) - 15 permissions

**Ce qu'il PEUT faire** :
- ✅ TOUT
- ✅ Valider commandes
- ✅ Expédier avec tracking
- ✅ Marquer comme livrée
- ✅ Annuler avec raison
- ✅ Gérer retours/SAV
- ✅ Émettre remboursements
- ✅ Envoyer emails (confirmation, expédition, rappel, annulation)
- ✅ Créer nouvelles commandes
- ✅ Marquer comme payé
- ✅ Toutes les statistiques
- ✅ Tous les filtres

**Interface** :
- Badge : 🔑 Administrateur (bleu foncé)
- Statistiques : 6 cartes complètes
- Filtres : 4 complets
- Actions : TOUS les boutons (Valider, Expédier, Rappel, Annuler, Retour, Rembourser)
- Modals : Expédition, Annulation, Retour, Remboursement

**Cas d'usage** : Gestion opérationnelle complète

---

### 👑 SUPER ADMIN (Niveau 9) - 15 permissions

**Identique à Admin** avec badge différent pour identification visuelle.

**Interface** :
- Badge : 👑 Super Admin (violet/purple)
- Permissions : 15/15 (identique Admin)

**Différence** : Accès potentiel à des fonctionnalités futures (paramètres système, logs avancés, etc.)

---

## 🎨 IMPACT SUR L'UI

### Header

| Rôle | Badge | Bouton "Nouvelle Commande" | Bouton "Exporter CSV" |
|------|-------|----------------------------|----------------------|
| Commercial | 👔 Commercial (bleu clair) | ❌ Caché | ✅ Visible |
| Responsable | 📊 Responsable (vert) | ❌ Caché | ✅ Visible |
| Admin | 🔑 Administrateur (bleu foncé) | ✅ Visible | ✅ Visible |
| Super Admin | 👑 Super Admin (violet) | ✅ Visible | ✅ Visible |

### Statistiques

| Rôle | Nombre de cartes | Cartes affichées |
|------|------------------|------------------|
| Commercial | 4 | Total, En Attente, Complétées, CA Total |
| Responsable | 6 | Total, CA Total, CA Mois, Panier Moyen, Impayé, En Attente |
| Admin | 6 | Identique Responsable |
| Super Admin | 6 | Identique Responsable |

### Filtres

| Rôle | Nombre de filtres | Filtres disponibles |
|------|-------------------|---------------------|
| Commercial | 2 | Recherche, Statut commande |
| Responsable | 4 | Recherche, Statut, Paiement, Période |
| Admin | 4 | Identique Responsable |
| Super Admin | 4 | Identique Responsable |

### Boutons d'action dans le tableau

| Rôle | Boutons visibles |
|------|------------------|
| Commercial | Voir, Infos |
| Responsable | Voir, Infos |
| Admin | Voir, Infos, **Valider, Expédier, Rappel, Annuler, Retour, Rembourser** |
| Super Admin | Identique Admin |

### Modals

| Rôle | Modal Expédition | Modal Annulation | Modal Retour | Modal Remboursement |
|------|------------------|------------------|--------------|---------------------|
| Commercial | ❌ | ❌ | ❌ | ❌ |
| Responsable | ❌ | ❌ | ❌ | ❌ |
| Admin | ✅ | ✅ | ✅ | ✅ |
| Super Admin | ✅ | ✅ | ✅ | ✅ |

---

## 🔐 SÉCURITÉ

### Niveaux de protection

1. **Authentification** (`requireUser`)
   - Niveau 3+ minimum requis pour accéder à `/orders`
   - Niveau 1-2 → Erreur 403

2. **Permissions UI** (Client-side)
   - Boutons conditionnels selon permissions
   - Empêche action accidentelle
   - UX adaptée au rôle

3. **Permissions API** (Server-side)
   - Vérification dans `action` handler
   - Retour 403 si permission refusée
   - Logs de sécurité détaillés

### Exemples de protection

#### Commercial tente de valider une commande
```typescript
// CLIENT - Bouton caché
{permissions.canValidate && (
  <button onClick={handleValidate}>Valider</button>
)}

// SERVEUR - Protection API
if (intent === 'validate' && !permissions.canValidate) {
  return json({ error: 'Permission refusée' }, { status: 403 });
}
```

**Résultat** :
- UI : Bouton invisible ✅
- Tentative POST directe : Erreur 403 ✅
- Log backend : `🚫 [Action] Permission refusée - canValidate requis`

---

## 📧 PERMISSIONS EMAILS

| Email | Action | Permission requise |
|-------|--------|-------------------|
| **Confirmation commande** | Valider commande (2→3) | `canValidate` + `canSendEmails` |
| **Notification expédition** | Expédier (3→4) | `canShip` + `canSendEmails` |
| **Rappel paiement** | Rappeler paiement impayé | `canSendEmails` |
| **Annulation commande** | Annuler commande | `canCancel` + `canSendEmails` |

**Note** : Seuls Admin (7+) et Super Admin (9) peuvent envoyer des emails.

---

## 🚀 ÉVOLUTION FUTURE

### Permissions planifiées (pas encore implémentées)

| Permission | Description | Niveaux |
|------------|-------------|---------|
| `canAccessSettings` | Paramètres système | 9 |
| `canViewLogs` | Voir logs détaillés | 7-9 |
| `canManageUsers` | Gérer utilisateurs | 9 |
| `canConfigureEmails` | Config templates emails | 9 |

### Nouvelles actions planifiées

- **Retours/SAV** : Permissions `canReturn` et `canRefund` déjà en place ✅
  - UI à implémenter (modals, boutons)
  - Backend à développer (3 endpoints)
  - Emails à créer (3 templates)
  - Voir : `PLAN-IMPLEMENTATION-RETOURS.md`

---

## 📝 UTILISATION DU SYSTÈME

### Dans le code

```typescript
import { getUserPermissions, getUserRole } from '~/utils/permissions';

// Récupérer les permissions
const permissions = getUserPermissions(user.level);

// Récupérer le rôle (pour affichage)
const role = getUserRole(user.level);

// Utiliser dans l'UI
{permissions.canValidate && <Button>Valider</Button>}

// Afficher le badge
<span className={role.bgColor + ' ' + role.color}>
  {role.badge} {role.label}
</span>
```

### Ajouter une nouvelle permission

1. **Ajouter à l'interface** (`permissions.ts`)
```typescript
export interface UserPermissions {
  // ... permissions existantes
  canNewAction: boolean;  // Nouvelle permission
}
```

2. **Définir par niveau**
```typescript
export function getUserPermissions(level: number): UserPermissions {
  if (level >= 7) {
    return {
      // ... permissions existantes
      canNewAction: true,  // Admin peut faire
    };
  }
  // ...
  return {
    // ... permissions existantes
    canNewAction: false,  // Commercial ne peut pas
  };
}
```

3. **Utiliser dans l'UI**
```tsx
{permissions.canNewAction && (
  <button onClick={handleNewAction}>
    Nouvelle Action
  </button>
)}
```

4. **Protéger dans l'action**
```typescript
if (intent === 'newAction' && !permissions.canNewAction) {
  return json({ error: 'Permission refusée' }, { status: 403 });
}
```

---

**Dernière mise à jour** : 12 octobre 2025  
**Version système** : 1.0  
**Permissions totales** : 15  
**Rôles** : 4
