# 🔍 ANALYSE PHP - Dashboard Client (myspace.account.index.php)

**Date** : 06 octobre 2025  
**Fichier source** : `myspace.account.index.php`  
**Objectif** : Comparer avec `/admin/users` et identifier les corrections nécessaires

---

## 📋 STRUCTURE DU FICHIER PHP

### 1. Authentification
```php
if(isset($_SESSION['myaklog'])) {
    $mailclt = $_SESSION['myaklog'];
    // Récupération données client
}
```

### 2. Requête Principale
```sql
SELECT * FROM ___XTR_CUSTOMER 
WHERE CST_MAIL = '$mailclt'
```

### 3. Champs Utilisés

#### Données Personnelles
```php
$connectedclt_id         = CST_ID
$connectedclt_mail       = CST_MAIL
$connectedclt_civ        = CST_CIVITILY         // ⚠️ MANQUE dans admin.users
$connectedclt_nom        = CST_NAME
$connectedclt_prenom     = CST_FNAME
$connectedclt_adr        = CST_ADDRESS          // ⚠️ MANQUE dans admin.users
$connectedclt_tel        = CST_TEL              // ⚠️ MANQUE dans admin.users
$connectedclt_port       = CST_GSM              // ⚠️ MANQUE dans admin.users
$connectedclt_zipcode    = CST_ZIP_CODE         // Partiel (seulement city)
$connectedclt_ville      = CST_CITY             // ✅ OK
$connectedclt_pays       = CST_COUNTRY          // ⚠️ MANQUE dans admin.users
```

#### Données Professionnelles
```php
$connectedclt_is_pro     = CST_IS_PRO          // ✅ OK (isPro)
$connectedclt_ste        = CST_RS              // ⚠️ MANQUE dans admin.users
$connectedclt_siret      = CST_SIRET           // ⚠️ MANQUE dans admin.users
```

### 4. Sections Affichées

#### Section 1 : Coordonnées
- Type de compte (Pro/Particulier)
- Société + SIRET (si pro)
- Civilité + Nom + Prénom
- Adresse complète
- Email
- Téléphones (fixe + mobile)

#### Section 2 : Messages (5 derniers)
```sql
SELECT * FROM ___XTR_MSG 
WHERE MSG_CST_ID = $connectedclt_id 
  AND MSG_CNFA_ID != 0
ORDER BY MSG_DATE DESC 
LIMIT 5
```

Colonnes affichées :
- `MSG_ID` (numéro commande/A)
- `MSG_DATE` (date + heure)
- `MSG_SUBJECT` (sujet)
- `MSG_OPEN` (statut lu/non lu - badge visuel)
- Bouton modal pour ouvrir message

#### Section 3 : Commandes (5 dernières)
```sql
SELECT * FROM ___XTR_ORDER 
WHERE ORD_CST_ID = $connectedclt_id 
ORDER BY ORD_DATE DESC 
LIMIT 5
```

Colonnes affichées :
- `ORD_ID` (numéro commande)
- `ORD_DATE` (date)
- `ORD_TOTAL_TTC` (montant)
- `ORD_IS_PAY` (statut paiement)
- Badge visuel si non payé

---

## ❌ PROBLÈMES IDENTIFIÉS dans `/admin/users`

### 1. **Champs Manquants Critiques**

#### Table `___xtr_customer` - Colonnes NON affichées :
```typescript
// ❌ MANQUE dans admin.users.tsx
CST_CIVITILY      // Civilité (M./Mme/Mlle)
CST_ADDRESS       // Adresse
CST_TEL           // Téléphone fixe
CST_GSM           // Mobile/GSM
CST_ZIP_CODE      // Code postal (seulement city affiché)
CST_COUNTRY       // Pays
CST_RS            // Raison sociale (entreprise)
CST_SIRET         // SIRET
```

### 2. **Interface TypeScript Incomplète**

#### Actuel (admin.users.tsx)
```typescript
interface User {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email: string;
  city?: string;           // ✅ OK
  isPro: boolean;          // ✅ OK
  isCompany: boolean;      // ✅ OK
  level: number;           // ✅ OK
  isActive: boolean;       // ✅ OK
  createdAt?: string;
  lastLogin?: string;
  totalOrders?: number;
  totalSpent?: number;
  role?: string;
}
```

#### Requis (d'après PHP)
```typescript
interface User {
  // ✅ Existant OK
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  city?: string;
  isPro: boolean;
  isCompany: boolean;
  level: number;
  isActive: boolean;
  
  // ❌ MANQUE - À AJOUTER
  civility?: string;        // CST_CIVITILY
  address?: string;         // CST_ADDRESS
  telephone?: string;       // CST_TEL
  mobile?: string;          // CST_GSM
  zipCode?: string;         // CST_ZIP_CODE
  country?: string;         // CST_COUNTRY
  companyName?: string;     // CST_RS (Raison Sociale)
  siret?: string;           // CST_SIRET
  
  // ✅ Bonus (déjà présent)
  createdAt?: string;
  lastLogin?: string;
  totalOrders?: number;
  totalSpent?: number;
}
```

### 3. **API Backend Incomplète**

#### Actuel (backend)
```typescript
// backend/src/modules/users/legacy-users.controller.ts
// Retourne seulement champs basiques
```

#### Requis
```typescript
// Doit retourner TOUS les champs de ___xtr_customer
async findAll() {
  const { data } = await this.supabase
    .from('___xtr_customer')
    .select(`
      cst_id,
      cst_mail,
      cst_civitily,          // ⭐ AJOUTER
      cst_name,
      cst_fname,
      cst_address,           // ⭐ AJOUTER
      cst_tel,               // ⭐ AJOUTER
      cst_gsm,               // ⭐ AJOUTER
      cst_zip_code,          // ⭐ AJOUTER
      cst_city,
      cst_country,           // ⭐ AJOUTER
      cst_is_pro,
      cst_rs,                // ⭐ AJOUTER
      cst_siret,             // ⭐ AJOUTER
      cst_activ
    `);
}
```

### 4. **Affichage Incomplet dans la Table**

#### Colonnes Actuelles
```tsx
<th>ID</th>
<th>Email</th>
<th>Nom</th>
<th>Type</th>      // Pro/Particulier ✅
<th>Niveau</th>
<th>Localisation</th>  // Seulement ville ❌
<th>Statut</th>
<th>Actions</th>
```

#### Colonnes Manquantes
```tsx
// ❌ PAS DE colonne pour :
- Civilité (M./Mme)
- Adresse complète
- Téléphones (fixe + mobile)
- Pays
- Raison sociale (si pro)
- SIRET (si pro)
```

### 5. **Page Détail Utilisateur Incomplète**

#### Fichier : `admin.users.$id.tsx`

Doit afficher :
```tsx
// Section Informations Personnelles
- Civilité
- Nom complet
- Email
- Adresse complète (rue + CP + ville + pays)
- Téléphone fixe
- Mobile/GSM

// Section Professionnelle (si isPro)
- Raison sociale
- SIRET
- Type de compte (Pro/Entreprise)

// Section Activité (NOUVEAU)
- Dernières commandes (5)
- Messages récents (5)
- Total dépensé
- Nombre commandes
```

---

## 🔧 CORRECTIONS NÉCESSAIRES

### Correction 1 : Mettre à jour l'interface User

**Fichier** : `frontend/app/routes/admin.users.tsx`

```typescript
interface User {
  // Identifiants
  id: string;
  email: string;
  
  // Identité
  civility?: string;        // ⭐ NOUVEAU
  firstName?: string;
  lastName?: string;
  name?: string;
  
  // Coordonnées
  address?: string;         // ⭐ NOUVEAU
  zipCode?: string;         // ⭐ NOUVEAU
  city?: string;
  country?: string;         // ⭐ NOUVEAU
  telephone?: string;       // ⭐ NOUVEAU
  mobile?: string;          // ⭐ NOUVEAU
  
  // Professionnel
  isPro: boolean;
  isCompany: boolean;
  companyName?: string;     // ⭐ NOUVEAU
  siret?: string;           // ⭐ NOUVEAU
  
  // Système
  level: number;
  isActive: boolean;
  createdAt?: string;
  lastLogin?: string;
  
  // Stats
  totalOrders?: number;
  totalSpent?: number;
  role?: string;
}
```

### Correction 2 : Ajouter Colonnes dans la Table

**Fichier** : `frontend/app/routes/admin.users.tsx`

```tsx
<thead>
  <tr>
    <th>☑️</th>
    <th>ID</th>
    <th>Civilité</th>           {/* ⭐ NOUVEAU */}
    <th>Email</th>
    <th>Nom complet</th>
    <th>Téléphones</th>          {/* ⭐ NOUVEAU */}
    <th>Adresse</th>             {/* ⭐ NOUVEAU */}
    <th>Type</th>
    <th>Entreprise</th>          {/* ⭐ NOUVEAU (si pro) */}
    <th>Niveau</th>
    <th>Statut</th>
    <th>Actions</th>
  </tr>
</thead>
<tbody>
  {users.map(user => (
    <tr key={user.id}>
      <td><input type="checkbox" /></td>
      <td><code>{user.id.slice(0, 8)}...</code></td>
      
      {/* ⭐ NOUVEAU : Civilité */}
      <td>{user.civility || '-'}</td>
      
      <td>{user.email}</td>
      
      <td>
        {user.civility} {user.firstName} {user.lastName}
      </td>
      
      {/* ⭐ NOUVEAU : Téléphones */}
      <td>
        {user.telephone && <div>📞 {user.telephone}</div>}
        {user.mobile && <div>📱 {user.mobile}</div>}
      </td>
      
      {/* ⭐ NOUVEAU : Adresse complète */}
      <td>
        {user.address && (
          <div className="text-sm">
            {user.address}<br/>
            {user.zipCode} {user.city}<br/>
            {user.country}
          </div>
        )}
      </td>
      
      <td>
        {user.isPro && <Badge>Pro</Badge>}
        {user.isCompany && <Badge>Entreprise</Badge>}
      </td>
      
      {/* ⭐ NOUVEAU : Raison sociale */}
      <td>
        {user.isPro && user.companyName && (
          <div className="text-sm">
            <Building className="w-3 h-3 inline" />
            {user.companyName}
            {user.siret && <div className="text-xs text-gray-500">{user.siret}</div>}
          </div>
        )}
      </td>
      
      {/* ... reste identique */}
    </tr>
  ))}
</tbody>
```

### Correction 3 : Mettre à jour le Backend

**Fichier** : `backend/src/modules/users/legacy-users.service.ts`

```typescript
async findAll(filters: FilterUsersDto) {
  let query = this.supabase
    .from('___xtr_customer')
    .select(`
      cst_id,
      cst_mail,
      cst_civitily,        // ⭐ AJOUTER
      cst_name,
      cst_fname,
      cst_address,         // ⭐ AJOUTER
      cst_tel,             // ⭐ AJOUTER
      cst_gsm,             // ⭐ AJOUTER
      cst_zip_code,        // ⭐ AJOUTER
      cst_city,
      cst_country,         // ⭐ AJOUTER
      cst_is_pro,
      cst_is_ste,
      cst_rs,              // ⭐ AJOUTER
      cst_siret,           // ⭐ AJOUTER
      cst_activ,
      cst_level,
      cst_created_at
    `, { count: 'exact' });
  
  // ... reste du code
  
  // Mapper vers format frontend
  return data.map(user => ({
    id: user.cst_id,
    email: user.cst_mail,
    civility: user.cst_civitily,           // ⭐ MAPPER
    firstName: user.cst_fname,
    lastName: user.cst_name,
    address: user.cst_address,             // ⭐ MAPPER
    telephone: user.cst_tel,               // ⭐ MAPPER
    mobile: user.cst_gsm,                  // ⭐ MAPPER
    zipCode: user.cst_zip_code,            // ⭐ MAPPER
    city: user.cst_city,
    country: user.cst_country,             // ⭐ MAPPER
    isPro: user.cst_is_pro === '1',
    isCompany: user.cst_is_ste === '1',
    companyName: user.cst_rs,              // ⭐ MAPPER
    siret: user.cst_siret,                 // ⭐ MAPPER
    isActive: user.cst_activ === '1',
    level: parseInt(user.cst_level) || 1,
    createdAt: user.cst_created_at
  }));
}
```

### Correction 4 : Page Détail Complète

**Fichier** : `frontend/app/routes/admin.users.$id.tsx`

```tsx
export default function UserDetail() {
  const { user } = useLoaderData<typeof loader>();
  
  return (
    <div className="space-y-6">
      {/* Section Identité */}
      <Card>
        <CardHeader>
          <CardTitle>Informations personnelles</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="font-medium text-gray-500">Civilité</dt>
              <dd>{user.civility || '-'}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Nom complet</dt>
              <dd>{user.civility} {user.firstName} {user.lastName}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Téléphone fixe</dt>
              <dd>{user.telephone || '-'}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Mobile</dt>
              <dd>{user.mobile || '-'}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Adresse</dt>
              <dd>
                {user.address && (
                  <>
                    {user.address}<br/>
                    {user.zipCode} {user.city}<br/>
                    {user.country}
                  </>
                )}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
      
      {/* Section Pro (si applicable) */}
      {user.isPro && (
        <Card>
          <CardHeader>
            <CardTitle>Informations professionnelles</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="font-medium text-gray-500">Type</dt>
                <dd>
                  <Badge>
                    {user.isCompany ? 'Entreprise' : 'Professionnel'}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500">Raison sociale</dt>
                <dd>{user.companyName || '-'}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500">SIRET</dt>
                <dd>{user.siret || '-'}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}
      
      {/* Section Messages (5 derniers) */}
      <Card>
        <CardHeader>
          <CardTitle>Messages récents</CardTitle>
        </CardHeader>
        <CardContent>
          {/* ⭐ À IMPLÉMENTER : Liste des 5 derniers messages */}
          <UserMessagesWidget userId={user.id} />
        </CardContent>
      </Card>
      
      {/* Section Commandes (5 dernières) */}
      <Card>
        <CardHeader>
          <CardTitle>Commandes récentes</CardTitle>
        </CardHeader>
        <CardContent>
          {/* ⭐ À IMPLÉMENTER : Liste des 5 dernières commandes */}
          <UserOrdersWidget userId={user.id} />
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 📊 TABLES SUPABASE IMPLIQUÉES

### Table Principale : `___xtr_customer`
```sql
-- Colonnes utilisées dans le PHP
CST_ID              INT PRIMARY KEY
CST_MAIL            VARCHAR(255)
CST_CIVITILY        VARCHAR(10)      -- M./Mme/Mlle
CST_NAME            VARCHAR(100)
CST_FNAME           VARCHAR(100)
CST_ADDRESS         TEXT
CST_TEL             VARCHAR(20)
CST_GSM             VARCHAR(20)
CST_ZIP_CODE        VARCHAR(10)
CST_CITY            VARCHAR(100)
CST_COUNTRY         VARCHAR(100)
CST_IS_PRO          TINYINT(1)
CST_RS              VARCHAR(255)     -- Raison sociale
CST_SIRET           VARCHAR(50)
CST_ACTIV           TINYINT(1)
CST_LEVEL           INT
```

### Table Messages : `___xtr_msg`
```sql
MSG_ID              INT PRIMARY KEY
MSG_CST_ID          INT              -- FK vers ___xtr_customer
MSG_CNFA_ID         INT              -- ID staff
MSG_ORD_ID          INT              -- Numéro commande
MSG_DATE            DATETIME
MSG_SUBJECT         TEXT
MSG_OPEN            TINYINT(1)       -- 0=non lu, 1=lu
```

### Table Commandes : `___xtr_order`
```sql
ORD_ID              INT PRIMARY KEY
ORD_CST_ID          INT              -- FK vers ___xtr_customer
ORD_DATE            DATETIME
ORD_TOTAL_TTC       DECIMAL(10,2)
ORD_IS_PAY          TINYINT(1)       -- 0=non payé, 1=payé
```

---

## ✅ CHECKLIST DE CORRECTIONS

### Backend
- [ ] Ajouter colonnes manquantes dans `legacy-users.service.ts`
- [ ] Créer `UserMessagesWidget` endpoint (5 derniers messages)
- [ ] Créer `UserOrdersWidget` endpoint (5 dernières commandes)
- [ ] Mettre à jour DTO `UserDto` avec nouveaux champs

### Frontend - Liste
- [ ] Mettre à jour interface `User`
- [ ] Ajouter colonnes : Civilité, Téléphones, Adresse, Entreprise
- [ ] Améliorer filtres (par pays, par code postal)

### Frontend - Détail
- [ ] Créer composant `UserMessagesWidget`
- [ ] Créer composant `UserOrdersWidget`
- [ ] Afficher toutes les coordonnées complètes
- [ ] Section professionnelle (si pro)

### Tests
- [ ] Tester affichage avec utilisateur particulier
- [ ] Tester affichage avec utilisateur pro
- [ ] Tester affichage avec entreprise
- [ ] Vérifier tous les champs mappés correctement

---

## 🎯 PRIORITÉS

### 🔴 CRITIQUE (À faire maintenant)
1. Ajouter champs manquants dans backend (address, tel, gsm, country, etc.)
2. Mettre à jour interface TypeScript User
3. Afficher adresse complète dans la table

### 🟡 IMPORTANT (Cette semaine)
4. Créer widgets Messages + Commandes
5. Page détail utilisateur complète
6. Tests avec vraies données

### 🟢 BONUS (Plus tard)
7. Export CSV avec tous les champs
8. Filtres avancés (par pays, par code postal)
9. Statistiques par type de client

---

**Prêt à implémenter les corrections !** 🚀
