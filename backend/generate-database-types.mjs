import fs from 'fs';

// Données extraites de Supabase
const schema = {
  pieces: ['piece_id', 'piece_ref', 'piece_ref_clean', 'piece_pm_id', 'piece_pg_id', 'piece_ga_id', 'piece_des', 'piece_name', 'piece_name_comp', 'piece_name_side', 'piece_fil_id', 'piece_fil_name', 'piece_qty_sale', 'piece_qty_pack', 'piece_weight_kgm', 'piece_has_oem', 'piece_has_img', 'piece_year', 'piece_display', 'piece_sort', 'piece_update', 'piece_pg_pid', 'piece_psf_id', 'search_vector'],
  pieces_price: ['pri_piece_id', 'pri_pm_id', 'pri_ean', 'pri_ref', 'pri_ref_comp', 'pri_des', 'pri_dispo', 'pri_type', 'pri_public_ht', 'pri_gros_ht', 'pri_consigne_ht', 'pri_consigne_ttc', 'pri_remise', 'pri_frs', 'pri_remise_2', 'pri_frs_2', 'pri_remise_3', 'pri_frs_3', 'pri_remise_4', 'pri_frs_4', 'pri_achat_ht', 'pri_marge', 'pri_vente_ht', 'pri_frais_port_ht', 'pri_frais_supp_ht', 'pri_tva', 'pri_vente_ttc', 'pri_vente_tn_ttc', 'pri_qte_cond', 'pri_qte_vente', 'pri_date_from', 'pri_date_to', 'pri_poids', 'pri_udm_poids', 'pri_hauteur', 'pri_longueur', 'pri_largeur', 'pri_udm_dimentions', 'pri_code_metier', 'pri_code_remise', 'pri_code_sfam_nu', 'pri_code_fam_nu', 'pri_xls', 'pri_insert_type'],
  pieces_marque: ['pm_id', 'pm_alias', 'pm_name', 'pm_name_url', 'pm_name_meta', 'pm_logo', 'pm_quality', 'pm_nature', 'pm_preview', 'pm_relfollow', 'pm_sitemap', 'pm_top', 'pm_oes', 'pm_nb_stars', 'pm_display', 'pm_sort'],
  pieces_media_img: ['pmi_piece_id', 'pmi_pm_id', 'pmi_folder', 'pmi_name', 'pmi_sort', 'pmi_display'],
  pieces_criteria: ['pc_piece_id', 'pc_pg_pid', 'pc_pg_id', 'pc_ga_id', 'pc_cri_id', 'pc_cri_value', 'pc_has_txt', 'pc_update_value', 'pc_display', 'pc_sort'],
  pieces_criteria_link: ['pcl_pg_id', 'pcl_pg_pid', 'pcl_cri_id', 'pcl_cri_parent', 'pcl_cri_type', 'pcl_cri_criteria', 'pcl_cri_unit', 'pcl_level', 'pcl_is_filter', 'pcl_has_link', 'pcl_display', 'pcl_sort'],
  pieces_criteria_group: ['cri_id', 'cri_id_parent', 'cri_id_successor', 'cri_criteria', 'cri_unit', 'cri_type_1', 'cri_type_2', 'cri_display'],
  pieces_relation_type: ['rtp_type_id', 'rtp_piece_id', 'rtp_pm_id', 'rtp_pg_id', 'rtp_pg_pid', 'rtp_ga_id', 'rtp_psf_id', 'rtp_inside'],
  pieces_relation_criteria: ['rcp_type_id', 'rcp_piece_id', 'rcp_pm_id', 'rcp_pg_pid', 'rcp_pg_id', 'rcp_cri_id', 'rcp_cri_value', 'rcp_has_txt', 'rcp_display', 'rcp_sort'],
  pieces_gamme: ['pg_id', 'pg_parent', 'pg_ppa_id', 'pg_alias', 'pg_name', 'pg_name_url', 'pg_name_meta', 'pg_pic', 'pg_img', 'pg_wall', 'pg_relfollow', 'pg_sitemap', 'pg_cross', 'pg_level', 'pg_display', 'pg_top'],
  pieces_list: ['pli_piece_id', 'pli_quantity', 'pli_piece_component', 'pli_ga_id', 'pli_sort'],
  pieces_ref_brand: ['prb_id', 'prb_name', 'prb_is_sup', 'prb_is_pc', 'prb_is_cv', 'prb_is_mtb', 'prb_is_eng', 'prb_display'],
  pieces_ref_ean: ['pre_piece_id', 'pre_code_ean'],
  pieces_ref_oem: ['pro_piece_id', 'pro_prb_id', 'pro_oem', 'pro_oem_serach', 'pro_year'],
  pieces_ref_search: ['prs_piece_id', 'prs_search', 'prs_kind', 'prs_ref', 'prs_prb_id', 'prs_year', 'prs_piece_prime'],
  pieces_side_filtre: ['psf_id', 'psf_side', 'psf_sort', 'psf_display'],
  pieces_status: ['pst_id', 'pst_description', 'pst_sort', 'pst_display'],
  pieces_details: ['pd_piece_id', 'pd_ref', 'pd_ref_clean', 'pd_pm_id', 'pd_prb_id', 'pd_pst_id', 'pd_des_eng', 'pd_weight_kgm', 'pd_is_accessory', 'pd_year', 'has_oem', 'has_img', 'pd_display', 'pd_pg_id'],
  pieces_gamme_cross: ['pgc_id', 'pgc_pg_id', 'pgc_pg_cross', 'pgc_level', 'pgc_display', 'pgc_sort'],
  auto_marque: ['marque_id', 'marque_alias', 'marque_name', 'marque_name_url', 'marque_name_meta', 'marque_name_meta_title', 'marque_logo', 'marque_wall', 'marque_relfollow', 'marque_sitemap', 'marque_display', 'marque_sort', 'marque_top'],
  auto_modele: ['modele_id', 'modele_parent', 'modele_marque_id', 'modele_mdg_id', 'modele_alias', 'modele_name', 'modele_name_url', 'modele_name_meta', 'modele_ful_name', 'modele_month_from', 'modele_year_from', 'modele_month_to', 'modele_year_to', 'modele_body', 'modele_pic', 'modele_relfollow', 'modele_sitemap', 'modele_display', 'modele_display_v1', 'modele_sort', 'modele_is_new'],
  auto_modele_group: ['mdg_id', 'mdg_marque_id', 'mdg_name', 'mdg_pic', 'mdg_display', 'mdg_sort'],
  auto_type: ['type_id', 'type_tmf_id', 'type_alias', 'type_modele_id', 'type_marque_id', 'type_name', 'type_name_url', 'type_name_meta', 'type_engine', 'type_fuel', 'type_power_ps', 'type_power_kw', 'type_liter', 'type_month_from', 'type_year_from', 'type_month_to', 'type_year_to', 'type_body', 'type_relfollow', 'type_display', 'type_sort'],
  catalog_family: ['mf_id', 'mf_name', 'mf_name_meta', 'mf_name_system', 'mf_description', 'mf_pic', 'mf_display', 'mf_sort'],
  catalog_gamme: ['mc_id', 'mc_mf_id', 'mc_mf_prime', 'mc_pg_id', 'mc_sort']
};

// Tables utilisées fréquemment dans le code
const frequentTables = Object.keys(schema).filter(t => t.startsWith('pieces') || t.startsWith('auto') || t.startsWith('catalog'));

console.log('✅ Génération du fichier constants.ts avec', Object.keys(schema).length, 'tables');
console.log('📊 Tables fréquentes:', frequentTables.length);

// Générer TABLES
let constantsContent = `export const TABLES = {\n`;
for (const [table, columns] of Object.entries(schema)) {
  const key = table.replace(/^___/, 'config_').replace(/^__/, 'blog_');
  constantsContent += `  ${key}: '${table}',\n`;
}
constantsContent += `} as const;\n`;

console.log('\n✅ Contenu TABLES généré:', constantsContent.split('\n').length, 'lignes');
console.log('\n📝 Exemple de contenu:');
console.log(constantsContent.slice(0, 500) + '...');

