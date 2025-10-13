# 📋 Instructions pour créer les données de test

## 🔍 Étape 1: Trouver le CST_ID de monia123@gmail.com

Exécutez cette requête dans Supabase SQL Editor :

```sql
SELECT cst_id, cst_mail, cst_name, cst_fname 
FROM ___xtr_customer 
WHERE cst_mail = 'monia123@gmail.com';
```

Notez le `cst_id` (par exemple: 5)

## 🔍 Étape 2: Vérifier la structure des tables d'adresses

```sql
-- Structure table facturation
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = '___xtr_customer_billing_address'
ORDER BY ordinal_position;

-- Structure table livraison  
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = '___xtr_customer_delivery_address'
ORDER BY ordinal_position;
```

## 📝 Étape 3: Adapter le script

Une fois que vous connaissez la structure exacte, modifiez le script `create-test-data-monia-postgres.sql` en conséquence.

## 💡 Si cba_id est auto-incrémenté

Ne l'incluez PAS dans l'INSERT :

```sql
INSERT INTO ___xtr_customer_billing_address 
(cba_cst_id, cba_civility, cba_name, cba_fname, cba_address, cba_zip_code, cba_city, cba_country, cba_mail)
VALUES
(5, 'Mme', 'Test', 'Monia', '123 Avenue des Tests', '75001', 'Paris', 'France', 'monia123@gmail.com')
RETURNING cba_id;
```

Remplacez `5` par le vrai CST_ID.
