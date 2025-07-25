# Guide de création et test du Super Admin niveau 9

## 📋 Étapes de création

### 1. Exécuter le script SQL dans Supabase

Connectez-vous à votre console Supabase et ouvrez l'éditeur SQL, puis exécutez le contenu du fichier `create-super-admin-level9.sql`.

### 2. Informations de connexion créées

```
Email: superadmin@autoparts.com
Mot de passe: SuperAdmin2025!
Login: superadmin
Niveau: 9 (Super Admin)
```

### 3. Vérification dans Supabase

Après exécution du script, vérifiez que l'admin a été créé :

```sql
SELECT cnfa_id, cnfa_login, cnfa_mail, cnfa_level, cnfa_activ 
FROM ___config_admin 
WHERE cnfa_level = '9';
```

## 🧪 Tests d'authentification

### Test automatique

```bash
# Lancer le script de test complet
./test-super-admin-auth.sh
```

### Tests manuels

#### 1. Test via curl

```bash
# Connexion
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@autoparts.com","password":"SuperAdmin2025!"}' \
  -c cookies.txt -v

# Vérifier la session
curl http://localhost:3000/api/auth/me -b cookies.txt

# Test accès admin
curl http://localhost:3000/api/admin/users -b cookies.txt

# Déconnexion
curl -X POST http://localhost:3000/auth/logout -b cookies.txt
```

#### 2. Test via interface web

1. Allez sur `http://localhost:3000/auth/login`
2. Saisissez :
   - **Email** : `superadmin@autoparts.com`
   - **Mot de passe** : `SuperAdmin2025!`
3. Cliquez sur "Se connecter"
4. Vérifiez l'accès aux sections admin

## 🔧 Dépannage

### Problème : Hash de mot de passe incorrect

Si la connexion échoue, régénérez le hash :

```bash
node generate-super-admin-hash.js
```

Puis mettez à jour dans Supabase :

```sql
UPDATE ___config_admin 
SET cnfa_pswd = 'NOUVEAU_HASH_GENERE'
WHERE cnfa_login = 'superadmin' AND cnfa_level = '9';
```

### Problème : Admin déjà existant

Supprimez l'admin existant avant de recréer :

```sql
DELETE FROM ___config_admin 
WHERE cnfa_login = 'superadmin' OR cnfa_mail = 'superadmin@autoparts.com';
```

### Problème : Backend non accessible

Vérifiez que le backend NestJS est démarré :

```bash
cd backend
npm run start:dev
```

### Problème : Table non trouvée

Vérifiez que la table `___config_admin` existe :

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = '___config_admin';
```

## 📊 Niveaux d'administration

- **Niveau 1-3** : Admin basique
- **Niveau 4-6** : Admin avancé  
- **Niveau 7-8** : Admin expert
- **Niveau 9** : Super Admin (accès total)

## 🔐 Sécurité

- Le mot de passe utilise bcrypt avec 12 rounds
- Le keylog est généré aléatoirement
- L'ID est unique avec timestamp
- Niveau 9 = accès complet au système

## 📁 Fichiers générés

- `create-super-admin-level9.sql` : Script SQL principal
- `generate-super-admin-hash.js` : Générateur de hash bcrypt
- `test-super-admin-auth.sh` : Script de test automatique
- `GUIDE-SUPER-ADMIN.md` : Ce guide
