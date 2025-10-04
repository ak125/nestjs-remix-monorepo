# 📊 DATABASE SCHEMA - Table ___xtr_msg (Messages)

**Date**: 4 octobre 2025  
**Contexte**: JOUR 2 Phase 2.2 - Délégation MessagesService  
**Source**: Documentation Supabase

---

## 📋 VUE D'ENSEMBLE

### Informations Table

- **Nom**: `___xtr_msg`
- **Type**: Table legacy (format XTR Commerce)
- **Utilisation**: Messagerie interne clients ↔ support
- **Service**: MessagesService + MessageDataService
- **Stockage**: Tous les champs en `text` (legacy)

---

## 📊 STRUCTURE COMPLÈTE (12 colonnes)

### 1️⃣ msg_id (PRIMARY KEY)
```sql
Nom:         msg_id
Type:        text
Format:      text
Nullable:    ❌ Non (PRIMARY KEY)
Description: Identifiant unique du message
```

**Exemple**: `"12345"`, `"67890"`  
**Usage**: Clé primaire, référence unique message  
**Conversion**: `string` en TypeScript

---

### 2️⃣ msg_cst_id (FOREIGN KEY → ___xtr_customer)
```sql
Nom:         msg_cst_id
Type:        text
Format:      text
Nullable:    ❌ Non
Description: ID du client émetteur/destinataire
```

**Exemple**: `"42"`, `"1337"`  
**Relation**: → `___xtr_customer.cst_id`  
**Usage**: Filtrage messages par client  
**Conversion**: `string` → `number` (customerId)

---

### 3️⃣ msg_ord_id (FOREIGN KEY → ___xtr_orders)
```sql
Nom:         msg_ord_id
Type:        text
Format:      text
Nullable:    ✅ Oui (optionnel)
Description: ID de la commande liée (si message contexte commande)
```

**Exemple**: `"ORD_2024_001"`, `null`  
**Relation**: → `___xtr_orders.ord_id`  
**Usage**: Messages contexte commande (SAV, livraison, etc.)  
**Conversion**: `string | null` (orderId)

---

### 4️⃣ msg_orl_id (FOREIGN KEY → ligne commande)
```sql
Nom:         msg_orl_id
Type:        text
Format:      text
Nullable:    ✅ Oui (optionnel)
Description: ID de la ligne de commande liée
```

**Exemple**: `"ORL_001"`, `null`  
**Relation**: → Table lignes commande (à identifier)  
**Usage**: Messages sur article spécifique commande  
**Conversion**: `string | null`

---

### 5️⃣ msg_orl_equiv_id (FOREIGN KEY → équivalence)
```sql
Nom:         msg_orl_equiv_id
Type:        text
Format:      text
Nullable:    ✅ Oui (optionnel)
Description: ID équivalence article (pièce de remplacement)
```

**Exemple**: `"EQUIV_123"`, `null`  
**Relation**: → Table équivalences pièces  
**Usage**: Messages suggestion pièce équivalente  
**Conversion**: `string | null`

---

### 6️⃣ msg_cnfa_id (FOREIGN KEY → ___cnfa_admin)
```sql
Nom:         msg_cnfa_id
Type:        text
Format:      text
Nullable:    ✅ Oui (null si message client)
Description: ID de l'administrateur/staff répondant
```

**Exemple**: `"ADMIN_001"`, `null`  
**Relation**: → `___cnfa_admin.cnfa_id`  
**Usage**: Identifier qui a répondu (support)  
**Conversion**: `string | null` (staffId)

**Logique**:
- `msg_cnfa_id = null` → Message envoyé par client
- `msg_cnfa_id != null` → Message/réponse envoyé par admin

---

### 7️⃣ msg_date (Date création)
```sql
Nom:         msg_date
Type:        text
Format:      text (ISO 8601 ou timestamp)
Nullable:    ❌ Non
Description: Date et heure de création du message
```

**Exemple**: `"2025-10-04T14:30:00Z"`, `"2025-10-04 14:30:00"`  
**Usage**: Tri chronologique, filtrage par date  
**Conversion**: `string` → `Date` (new Date(msg_date))

---

### 8️⃣ msg_subject (Sujet)
```sql
Nom:         msg_subject
Type:        text
Format:      text
Nullable:    ❌ Non
Description: Sujet du message (titre/objet)
```

**Exemple**: `"Question sur ma commande"`, `"Demande de remboursement"`  
**Usage**: Affichage liste messages, recherche  
**Conversion**: `string`  
**Limite recommandée**: 200 caractères

---

### 9️⃣ msg_content (Contenu)
```sql
Nom:         msg_content
Type:        text
Format:      text (peut contenir HTML)
Nullable:    ❌ Non
Description: Contenu complet du message
```

**Exemple**: `"Bonjour, j'ai une question concernant..."`  
**Usage**: Corps du message  
**Conversion**: `string`  
**Limite recommandée**: 5000 caractères  
**Format**: Texte brut ou HTML (à sanitizer)

---

### 🔟 msg_parent_id (Threading)
```sql
Nom:         msg_parent_id
Type:        text
Format:      text
Nullable:    ✅ Oui (null si message racine)
Description: ID du message parent (fil de discussion)
```

**Exemple**: `"12345"`, `null`  
**Relation**: → `___xtr_msg.msg_id` (auto-référence)  
**Usage**: Système de threading (conversations)  
**Conversion**: `string | null`

**Logique**:
- `msg_parent_id = null` → Message initial (racine discussion)
- `msg_parent_id != null` → Réponse à un message existant

---

### 1️⃣1️⃣ msg_open (Statut lecture)
```sql
Nom:         msg_open
Type:        text
Format:      text ("0" ou "1")
Nullable:    ❌ Non
Description: Indicateur message lu/non lu
```

**Valeurs**:
- `"0"` → Message **NON LU** ❌
- `"1"` → Message **LU** ✅

**Usage**: Badge messages non lus, filtrage  
**Conversion**: `string` → `boolean`
```typescript
const isRead = msg_open === "1"; // false si "0"
```

**⚠️ Note**: Naming contre-intuitif
- `msg_open = "0"` = **fermé** = NON LU
- `msg_open = "1"` = **ouvert** = LU

---

### 1️⃣2️⃣ msg_close (Statut clôture)
```sql
Nom:         msg_close
Type:        text
Format:      text ("0" ou "1")
Nullable:    ❌ Non
Description: Indicateur message/conversation clôturé
```

**Valeurs**:
- `"0"` → Conversation **ACTIVE** (ouverte)
- `"1"` → Conversation **CLÔTURÉE** (résolue)

**Usage**: Filtrage conversations actives/résolues  
**Conversion**: `string` → `boolean`
```typescript
const isClosed = msg_close === "1";
```

**Logique métier**:
- Message actif: `msg_close = "0"` → Nécessite action/réponse
- Message clôturé: `msg_close = "1"` → Problème résolu, archivé

---

## 🔄 CONVERSIONS TYPESCRIPT

### Interface ModernMessage (MessageDataService)

```typescript
export interface ModernMessage {
  id: string;                    // msg_id
  customerId: number;            // msg_cst_id (string → number)
  staffId: string | null;        // msg_cnfa_id
  orderId: string | null;        // msg_ord_id
  type: string;                  // Calculé ou constant 'support'
  title: string;                 // msg_subject
  content: string;               // msg_content
  priority: string;              // Calculé ou constant 'normal'
  msg_open: boolean;             // msg_open ("0"/"1" → boolean)
  msg_close: boolean;            // msg_close ("0"/"1" → boolean)
  isRead: boolean;               // Computed: msg_open === "1"
  created_at: string;            // msg_date (ISO string)
  updated_at: string;            // msg_date (legacy, pas de champ update)
}
```

### Mapping DB → DTO (MessageDataService)

```typescript
// Exemple conversion depuis ___xtr_msg
const modernMessage: ModernMessage = {
  id: row.msg_id,
  customerId: parseInt(row.msg_cst_id, 10),
  staffId: row.msg_cnfa_id || null,
  orderId: row.msg_ord_id || null,
  type: 'support',
  title: row.msg_subject,
  content: row.msg_content,
  priority: 'normal',
  msg_open: row.msg_open === '1',
  msg_close: row.msg_close === '1',
  isRead: row.msg_open === '1',
  created_at: row.msg_date,
  updated_at: row.msg_date,
};
```

---

## 📊 STATISTIQUES & QUERIES UTILES

### Compter Messages Par Client

```sql
SELECT 
  msg_cst_id,
  COUNT(*) as total_messages,
  SUM(CASE WHEN msg_open = '0' THEN 1 ELSE 0 END) as unread_count,
  SUM(CASE WHEN msg_close = '1' THEN 1 ELSE 0 END) as closed_count
FROM ___xtr_msg
GROUP BY msg_cst_id;
```

### Messages Non Lus (Inbox)

```sql
SELECT *
FROM ___xtr_msg
WHERE msg_cst_id = '42'
  AND msg_open = '0'
  AND msg_close = '0'
ORDER BY msg_date DESC;
```

### Conversations Actives (Support)

```sql
SELECT *
FROM ___xtr_msg
WHERE msg_close = '0'
  AND msg_cnfa_id IS NULL  -- Messages clients sans réponse
ORDER BY msg_date ASC;
```

### Fil de Discussion Complet

```sql
-- Messages racine
SELECT *
FROM ___xtr_msg
WHERE msg_parent_id IS NULL
  AND msg_id = '12345';

-- Réponses
SELECT *
FROM ___xtr_msg
WHERE msg_parent_id = '12345'
ORDER BY msg_date ASC;
```

### Statistiques Globales

```sql
SELECT 
  COUNT(*) as total_messages,
  COUNT(DISTINCT msg_cst_id) as unique_customers,
  SUM(CASE WHEN msg_open = '0' THEN 1 ELSE 0 END) as unread_total,
  SUM(CASE WHEN msg_close = '0' THEN 1 ELSE 0 END) as active_conversations,
  AVG(CASE WHEN msg_cnfa_id IS NOT NULL THEN 1 ELSE 0 END) * 100 as response_rate
FROM ___xtr_msg;
```

---

## 🔧 UTILISATION MESSAGESSERVICE

### Création Message (Client)

```typescript
// Client envoie message
const message = await messagesService.createMessage({
  customerId: '42',          // → msg_cst_id
  staffId: 'system',         // → msg_cnfa_id (null pour client)
  orderId: 'ORD_001',        // → msg_ord_id (optionnel)
  subject: 'Ma question',    // → msg_subject
  content: 'Bonjour...',     // → msg_content
  priority: 'normal',        // → Métadonnée (pas en DB)
});

// INSERT INTO ___xtr_msg VALUES (
//   msg_id: UUID(),
//   msg_cst_id: '42',
//   msg_ord_id: 'ORD_001',
//   msg_orl_id: null,
//   msg_orl_equiv_id: null,
//   msg_cnfa_id: null,        // ← Client = null
//   msg_date: NOW(),
//   msg_subject: 'Ma question',
//   msg_content: 'Bonjour...',
//   msg_parent_id: null,      // ← Message racine
//   msg_open: '0',            // ← Non lu par défaut
//   msg_close: '0'            // ← Actif par défaut
// )
```

### Réponse Admin

```typescript
// Admin répond
const reply = await messagesService.createMessage({
  customerId: '42',            // → msg_cst_id (même client)
  staffId: 'ADMIN_001',        // → msg_cnfa_id ✅
  subject: 'Re: Ma question',  // → msg_subject
  content: 'Réponse...',       // → msg_content
  priority: 'normal',
});

// INSERT avec msg_cnfa_id != null et msg_parent_id = ID message original
```

### Marquer Comme Lu

```typescript
await messagesService.markAsRead(messageId, readerId);

// UPDATE ___xtr_msg
// SET msg_open = '1'
// WHERE msg_id = messageId
```

### Clôturer Conversation

```typescript
await messagesService.closeMessage(messageId);

// UPDATE ___xtr_msg
// SET msg_close = '1'
// WHERE msg_id = messageId
```

---

## ⚠️ POINTS D'ATTENTION

### 1. Stockage Text Partout

**Problème**: Tous les champs sont `text`, pas de types natifs
- Dates: `text` au lieu de `timestamp`
- Booléens: `"0"/"1"` au lieu de `boolean`
- IDs numériques: `text` au lieu de `integer`

**Impact**: Conversions nécessaires application-side

### 2. Naming msg_open Contre-Intuitif

```typescript
// ⚠️ ATTENTION: Logique inversée
msg_open = "0" → NON LU (fermé)
msg_open = "1" → LU (ouvert)

// Solution: Utiliser isRead au lieu de msg_open dans interface
isRead: msg_open === "1"
```

### 3. Threading Optionnel

- `msg_parent_id` permet threading mais pas obligatoire
- Messages plats possibles (tous msg_parent_id = null)
- Besoin logique application pour gérer fils discussion

### 4. Relations Multiples

- Message peut être lié à commande (msg_ord_id)
- ET ligne commande (msg_orl_id)
- ET équivalence (msg_orl_equiv_id)
- Complexité requêtes JOIN si besoin contexte complet

### 5. Pas de Champ Updated_At

- `msg_date` = création uniquement
- Pas de champ modification
- Besoin trigger ou champ custom si historique modifications

---

## 🎯 RECOMMENDATIONS

### Migration Future (Optionnel)

```sql
-- Table moderne avec types natifs
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  staff_id INTEGER REFERENCES staff(id),
  order_id INTEGER REFERENCES orders(id),
  subject VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES messages(id),
  is_read BOOLEAN DEFAULT false,
  is_closed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index performance
CREATE INDEX idx_messages_customer ON messages(customer_id);
CREATE INDEX idx_messages_unread ON messages(is_read) WHERE is_read = false;
CREATE INDEX idx_messages_active ON messages(is_closed) WHERE is_closed = false;
CREATE INDEX idx_messages_parent ON messages(parent_id);
```

### Vues Simplifiées

```sql
-- Vue messages non lus
CREATE VIEW unread_messages AS
SELECT 
  msg_id as id,
  msg_cst_id as customer_id,
  msg_subject as subject,
  msg_date as created_at
FROM ___xtr_msg
WHERE msg_open = '0';

-- Vue conversations actives
CREATE VIEW active_conversations AS
SELECT 
  msg_id as id,
  msg_cst_id as customer_id,
  msg_subject as subject,
  msg_cnfa_id as staff_id,
  msg_date as created_at
FROM ___xtr_msg
WHERE msg_close = '0';
```

---

## 📚 FICHIERS LIÉS

**Services**:
- `backend/src/modules/messages/messages.service.ts` (152 lignes)
- `backend/src/modules/messages/repositories/message-data.service.ts` (200+ lignes)

**DTOs**:
- `backend/src/modules/messages/dto/message.schemas.ts` (187 lignes)

**Controllers**:
- `backend/src/modules/messages/messages.controller.ts`

**Gateway**:
- `backend/src/modules/messages/messaging.gateway.ts` (WebSocket)

**Documentation**:
- `docs/JOUR2-PHASE2.2-ANALYSE-MESSAGES.md`
- `docs/JOUR2-PHASE2.2-EXECUTION-LOG.md`
- `docs/JOUR2-PHASE2.2-AUDIT-MESSAGERIE-COMPLET.md`

---

**Auteur**: Documentation générée Phase 2.4  
**Date**: 4 octobre 2025  
**Source**: Schéma Supabase ___xtr_msg
