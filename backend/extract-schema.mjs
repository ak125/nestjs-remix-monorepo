import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cxpojprgwgubzjyqzmoq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1YnpqeXF6bW9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjUzNDU5NSwiZXhwIjoyMDY4MTEwNTk1fQ.ta_KmARDalKoBf6pIKNwZM0e6cBGO3F15CEgfw0lkzY';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 Extraction du schéma complet depuis Supabase...\n');

// Récupérer toutes les tables via l'API PostgreSQL
const { data: tables, error } = await supabase
  .rpc('get_all_tables');

if (error) {
  // Méthode alternative : requête directe sur information_schema
  const { data: tablesAlt, error: errorAlt } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .order('table_name');
  
  if (errorAlt) {
    console.error('❌ Impossible de récupérer les tables:', errorAlt.message);
    
    // Dernière tentative : lister manuellement les tables connues
    console.log('\n📋 Utilisation de la liste manuelle des tables principales:\n');
    
    const knownTables = [
      'pieces', 'pieces_price', 'pieces_marque', 'pieces_media_img',
      'pieces_criteria', 'pieces_criteria_link', 'pieces_criteria_group',
      'pieces_relation_type', 'pieces_relation_criteria', 'pieces_gamme',
      'pieces_list', 'pieces_ref_brand', 'pieces_ref_ean', 'pieces_ref_oem',
      'pieces_ref_search', 'pieces_side_filtre', 'pieces_status', 'pieces_details',
      'pieces_gamme_cross',
      'auto_marque', 'auto_modele', 'auto_modele_group', 'auto_modele_robot',
      'auto_type', 'auto_type_motor_code', 'auto_type_motor_fuel', 'auto_type_number_code',
      'catalog_family', 'catalog_gamme', 'cars_engine',
      '___config', '___config_admin', '___config_ip', '___config_old',
      '___footer_menu', '___header_menu', '___meta_tags_ariane',
      '___xtr_customer', '___xtr_customer_billing_address', '___xtr_customer_delivery_address',
      '___xtr_delivery_agent', '___xtr_delivery_ape_corse', '___xtr_delivery_ape_domtom1',
      '___xtr_delivery_ape_domtom2', '___xtr_delivery_ape_france',
      '___xtr_invoice', '___xtr_invoice_line', '___xtr_msg',
      '___xtr_order', '___xtr_order_line', '___xtr_order_line_equiv_ticket',
      '___xtr_order_line_status', '___xtr_order_status',
      '___xtr_supplier', '___xtr_supplier_link_pm',
      '__blog_advice', '__blog_advice_cross', '__blog_advice_h2', '__blog_advice_h3',
      '__blog_advice_old', '__blog_guide', '__blog_guide_h2', '__blog_guide_h3',
      '__blog_meta_tags_ariane', '__blog_seo_marque',
      '__cross_gamme_car', '__cross_gamme_car_new', '__cross_gamme_car_new2',
      '__seo_equip_gamme', '__seo_family_gamme_car_switch', '__seo_gamme',
      '__seo_gamme_car', '__seo_gamme_car_switch', '__seo_gamme_conseil',
      '__seo_gamme_info', '__seo_item_switch', '__seo_marque', '__seo_type_switch',
      '__sitemap_blog', '__sitemap_gamme', '__sitemap_marque', '__sitemap_motorisation',
      '__sitemap_p_link', '__sitemap_p_xml', '__sitemap_search_link',
      'am_2022_suppliers', 'categories', 'crawl_budget_experiments', 'crawl_budget_metrics',
      'ic_postback', 'password_resets', 'products', 'promo_codes', 'promo_usage',
      'sessions', 'shipping_rates_cache', 'users'
    ];
    
    console.log(`📊 Total: ${knownTables.length} tables\n`);
    
    // Tester et extraire les colonnes pour chaque table
    for (const tableName of knownTables) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
        
        if (!error && data && data.length > 0) {
          const columns = Object.keys(data[0]);
          console.log(`✅ ${tableName} (${columns.length} colonnes)`);
          console.log(`   Colonnes: ${columns.join(', ')}\n`);
        } else if (!error) {
          // Table vide, essayer de récupérer les colonnes via head
          const { data: headData, error: headError } = await supabase
            .from(tableName)
            .select('*')
            .limit(0);
          
          console.log(`✅ ${tableName} (table vide)`);
        }
      } catch (err) {
        console.log(`⚠️  ${tableName}: ${err.message}`);
      }
    }
  }
}

