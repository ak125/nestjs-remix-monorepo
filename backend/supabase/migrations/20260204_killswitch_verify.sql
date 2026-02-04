-- =====================================================
-- KILL-SWITCH DEV: Script de vérification
-- Date: 2026-02-04
-- À exécuter APRÈS le script principal pour valider
-- =====================================================

-- 1. Vérifier que le rôle existe
SELECT '1. Role dev_readonly' as check,
       CASE WHEN EXISTS(SELECT 1 FROM pg_roles WHERE rolname = 'dev_readonly')
            THEN '✅ CREATED' ELSE '❌ MISSING' END as status;

-- 2. Vérifier les permissions du rôle
SELECT '2. Role permissions' as check,
       rolsuper, rolcreatedb, rolcreaterole, rolcanlogin
FROM pg_roles WHERE rolname = 'dev_readonly';

-- 3. Vérifier les tables d'audit
SELECT '3. Audit tables' as check,
       CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = '_killswitch_audit')
            THEN '✅ _killswitch_audit' ELSE '❌ MISSING' END as audit,
       CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = '_killswitch_breakglass')
            THEN '✅ _killswitch_breakglass' ELSE '❌ MISSING' END as breakglass;

-- 4. Vérifier les permissions sur tables critiques
SELECT '4. Critical table permissions' as check,
       table_name,
       string_agg(privilege_type, ', ') as privileges
FROM information_schema.table_privileges
WHERE grantee = 'dev_readonly'
  AND table_schema = 'public'
  AND table_name IN ('ic_postback', '___xtr_order', '___xtr_customer', 'users')
GROUP BY table_name
ORDER BY table_name;

-- 5. Compter les tables avec SELECT
SELECT '5. Tables with SELECT permission' as check,
       COUNT(*) as table_count
FROM information_schema.table_privileges
WHERE grantee = 'dev_readonly'
  AND privilege_type = 'SELECT'
  AND table_schema = 'public';

-- 6. Vérifier les fonctions break-glass
SELECT '6. Break-glass functions' as check,
       routine_name,
       CASE WHEN routine_name IS NOT NULL THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('check_breakglass', 'grant_breakglass', 'revoke_breakglass', 'list_active_breakglass')
ORDER BY routine_name;

-- =====================================================
-- TESTS D'ÉCRITURE (doivent ÉCHOUER pour dev_readonly)
-- =====================================================
-- ATTENTION: Ces tests doivent être exécutés avec SET ROLE dev_readonly

-- Pour tester manuellement:
-- SET ROLE dev_readonly;
-- INSERT INTO ic_postback (id_com) VALUES ('TEST'); -- DOIT ÉCHOUER
-- RESET ROLE;

-- =====================================================
-- RÉSUMÉ
-- =====================================================
SELECT '=== KILL-SWITCH DEV VERIFICATION ===' as summary;
SELECT 'Si tous les checks sont ✅, le kill-switch est correctement installé.' as note;
SELECT 'Prochaine étape: ALTER ROLE dev_readonly WITH PASSWORD ''...'';' as next_step;
