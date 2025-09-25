-- 📊 ANALYSE FINALE : Mise à jour des statistiques
-- À exécuter EN DERNIER, après que TOUS les 4 index soient créés
-- Met à jour les statistiques pour l'optimiseur PostgreSQL

ANALYZE pieces_relation_type;
ANALYZE pieces;
ANALYZE pieces_gamme;
ANALYZE catalog_gamme;
ANALYZE catalog_family;

-- ✅ Message final
SELECT 'ANALYSE TERMINÉE AVEC SUCCÈS!' as status,
       'Statistiques mises à jour' as message,
       'Les requêtes sont maintenant optimisées!' as final_message;