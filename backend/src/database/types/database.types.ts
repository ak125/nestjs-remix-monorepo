/**
 * Types TypeScript générés automatiquement depuis le schéma Supabase
 * 97 tables découvertes
 * Généré automatiquement - NE PAS MODIFIER MANUELLEMENT
 */

// ===== TABLES PRINCIPALES =====

export interface Am2022Suppliers {
  sup_id: string | null;
  sup_id_steq: string | null;
  sup_pm_id: string | null;
  sup_nr: string | null;
  sup_brand: string | null;
  sup_display: string | null;
  sup_sort: string | null;
  has_img: string | null;
  sup_file: string | null;
}

export interface AutoMarque {
  marque_id: string | null;
  marque_alias: string | null;
  marque_name: string | null;
  marque_name_url: string | null;
  marque_name_meta: string | null;
  marque_name_meta_title: string | null;
  marque_logo: string | null;
  marque_wall: string | null;
  marque_relfollow: string | null;
  marque_sitemap: string | null;
  marque_display: string | null;
  marque_sort: string | null;
  marque_top: string | null;
}

export interface AutoModele {
  modele_id: string | null;
  modele_parent: string | null;
  modele_marque_id: string | null;
  modele_mdg_id: string | null;
  modele_alias: string | null;
  modele_name: string | null;
  modele_name_url: string | null;
  modele_name_meta: string | null;
  modele_ful_name: string | null;
  modele_month_from: string | null;
  modele_year_from: string | null;
  modele_month_to: string | null;
  modele_year_to: string | null;
  modele_body: string | null;
  modele_pic: string | null;
  modele_relfollow: string | null;
  modele_sitemap: string | null;
  modele_display: string | null;
  modele_display_v1: string | null;
  modele_sort: string | null;
  modele_is_new: string | null;
}

export interface AutoModeleGroup {
  mdg_id: string | null;
  mdg_marque_id: string | null;
  mdg_name: string | null;
  mdg_pic: string | null;
  mdg_display: string | null;
  mdg_sort: string | null;
}

export interface AutoModeleRobot {
  modele_id: string | null;
  modele_marque_id: string | null;
  modele_mdg_id: string | null;
  modele_alias: string | null;
  modele_name: string | null;
  modele_name_url: string | null;
  modele_name_meta: string | null;
  modele_month_from: string | null;
  modele_year_from: string | null;
  modele_month_to: string | null;
  modele_year_to: string | null;
  modele_body: string | null;
  modele_pic: string | null;
  modele_relfollow: string | null;
  modele_sitemap: string | null;
  modele_display: string | null;
  modele_sort: string | null;
  modele_is_new: string | null;
}

export interface AutoType {
  type_id: string | null;
  type_tmf_id: string | null;
  type_alias: string | null;
  type_modele_id: string | null;
  type_marque_id: string | null;
  type_name: string | null;
  type_name_url: string | null;
  type_name_meta: string | null;
  type_engine: string | null;
  type_fuel: string | null;
  type_power_ps: string | null;
  type_power_kw: string | null;
  type_liter: string | null;
  type_month_from: string | null;
  type_year_from: string | null;
  type_month_to: string | null;
  type_year_to: string | null;
  type_body: string | null;
  type_relfollow: string | null;
  type_display: string | null;
  type_sort: string | null;
}

export interface AutoTypeMotorCode {
  tmc_type_id: string | null;
  tmc_code: string | null;
}

export interface AutoTypeMotorFuel {
  tmf_id: string | null;
  tmf_motor: string | null;
  tmf_engine: string | null;
  tmf_fuel: string | null;
  tmf_sort: string | null;
  tmf_display: string | null;
}

export interface AutoTypeNumberCode {
  tnc_type_id: string | null;
  tnc_cnit: string | null;
  tnc_code: string | null;
}

export interface CarsEngine {
  eng_id: string | null;
  eng_mfa_id: string | null;
  eng_code: string | null;
}

export interface CatalogFamily {
  mf_id: string | null;
  mf_name: string | null;
  mf_name_meta: string | null;
  mf_name_system: string | null;
  mf_description: string | null;
  mf_pic: string | null;
  mf_display: string | null;
  mf_sort: string | null;
}

export interface CatalogGamme {
  mc_id: string | null;
  mc_mf_id: string | null;
  mc_mf_prime: string | null;
  mc_pg_id: string | null;
  mc_sort: string | null;
}

export interface IcPostback {
  id_ic_postback: string | null;
  id_com: string | null;
  status: string | null;
  statuscode: string | null;
  idsite: string | null;
  idste: string | null;
  orderid: string | null;
  paymentid: string | null;
  transactionid: string | null;
  amount: string | null;
  currency: string | null;
  paymentmethod: string | null;
  ip: string | null;
  ips: string | null;
  datepayment: string | null;
}

export interface Pieces {
  piece_id: string | null;
  piece_ref: string | null;
  piece_ref_clean: string | null;
  piece_pm_id: string | null;
  piece_pg_id: string | null;
  piece_ga_id: string | null;
  piece_des: string | null;
  piece_name: string | null;
  piece_name_comp: string | null;
  piece_name_side: string | null;
  piece_fil_id: string | null;
  piece_fil_name: string | null;
  piece_qty_sale: string | null;
  piece_qty_pack: string | null;
  piece_weight_kgm: string | null;
  piece_has_oem: string | null;
  piece_has_img: string | null;
  piece_year: string | null;
  piece_display: string | null;
  piece_sort: string | null;
  piece_update: string | null;
  piece_pg_pid: string | null;
  piece_psf_id: string | null;
  search_vector: string | null;
}

export interface PiecesCriteria {
  pc_piece_id: string | null;
  pc_pg_pid: string | null;
  pc_pg_id: string | null;
  pc_ga_id: string | null;
  pc_cri_id: string | null;
  pc_cri_value: string | null;
  pc_has_txt: string | null;
  pc_update_value: string | null;
  pc_display: string | null;
  pc_sort: string | null;
}

export interface PiecesCriteriaGroup {
  cri_id: string | null;
  cri_id_parent: string | null;
  cri_id_successor: string | null;
  cri_criteria: string | null;
  cri_unit: string | null;
  cri_type_1: string | null;
  cri_type_2: string | null;
  cri_display: string | null;
}

export interface PiecesCriteriaLink {
  pcl_pg_id: string | null;
  pcl_pg_pid: string | null;
  pcl_cri_id: string | null;
  pcl_cri_parent: string | null;
  pcl_cri_type: string | null;
  pcl_cri_criteria: string | null;
  pcl_cri_unit: string | null;
  pcl_level: string | null;
  pcl_is_filter: string | null;
  pcl_has_link: string | null;
  pcl_display: string | null;
  pcl_sort: string | null;
}

export interface PiecesDetails {
  pd_piece_id: string | null;
  pd_ref: string | null;
  pd_ref_clean: string | null;
  pd_pm_id: string | null;
  pd_prb_id: string | null;
  pd_pst_id: string | null;
  pd_des_eng: string | null;
  pd_weight_kgm: string | null;
  pd_is_accessory: string | null;
  pd_year: string | null;
  has_oem: string | null;
  has_img: string | null;
  pd_display: string | null;
  pd_pg_id: string | null;
}

export interface PiecesGamme {
  pg_id: string | null;
  pg_parent: string | null;
  pg_ppa_id: string | null;
  pg_alias: string | null;
  pg_name: string | null;
  pg_name_url: string | null;
  pg_name_meta: string | null;
  pg_pic: string | null;
  pg_img: string | null;
  pg_wall: string | null;
  pg_relfollow: string | null;
  pg_sitemap: string | null;
  pg_cross: string | null;
  pg_level: string | null;
  pg_display: string | null;
  pg_top: string | null;
}

export interface PiecesGammeCross {
  pgc_id: string | null;
  pgc_pg_id: string | null;
  pgc_pg_cross: string | null;
  pgc_level: string | null;
  pgc_display: string | null;
  pgc_sort: string | null;
}

export interface PiecesList {
  pli_piece_id: string | null;
  pli_quantity: string | null;
  pli_piece_component: string | null;
  pli_ga_id: string | null;
  pli_sort: string | null;
}

export interface PiecesMarque {
  pm_id: string | null;
  pm_alias: string | null;
  pm_name: string | null;
  pm_name_url: string | null;
  pm_name_meta: string | null;
  pm_logo: string | null;
  pm_quality: string | null;
  pm_nature: string | null;
  pm_preview: string | null;
  pm_relfollow: string | null;
  pm_sitemap: string | null;
  pm_top: string | null;
  pm_oes: string | null;
  pm_nb_stars: string | null;
  pm_display: string | null;
  pm_sort: string | null;
}

export interface PiecesMediaImg {
  pmi_piece_id: string | null;
  pmi_pm_id: string | null;
  pmi_folder: string | null;
  pmi_name: string | null;
  pmi_sort: string | null;
  pmi_display: string | null;
}

export interface PiecesPrice {
  pri_piece_id: string | null;
  pri_pm_id: string | null;
  pri_ean: string | null;
  pri_ref: string | null;
  pri_ref_comp: string | null;
  pri_des: string | null;
  pri_dispo: string | null;
  pri_type: string | null;
  pri_public_ht: string | null;
  pri_gros_ht: string | null;
  pri_consigne_ht: string | null;
  pri_consigne_ttc: string | null;
  pri_remise: string | null;
  pri_frs: string | null;
  pri_remise_2: string | null;
  pri_frs_2: string | null;
  pri_remise_3: string | null;
  pri_frs_3: string | null;
  pri_remise_4: string | null;
  pri_frs_4: string | null;
  pri_achat_ht: string | null;
  pri_marge: string | null;
  pri_vente_ht: string | null;
  pri_frais_port_ht: string | null;
  pri_frais_supp_ht: string | null;
  pri_tva: string | null;
  pri_vente_ttc: string | null;
  pri_vente_tn_ttc: string | null;
  pri_qte_cond: string | null;
  pri_qte_vente: string | null;
  pri_date_from: string | null;
  pri_date_to: string | null;
  pri_poids: string | null;
  pri_udm_poids: string | null;
  pri_hauteur: string | null;
  pri_longueur: string | null;
  pri_largeur: string | null;
  pri_udm_dimentions: string | null;
  pri_code_metier: string | null;
  pri_code_remise: string | null;
  pri_code_sfam_nu: string | null;
  pri_code_fam_nu: string | null;
  pri_xls: string | null;
  pri_insert_type: string | null;
}

export interface PiecesRefBrand {
  prb_id: string | null;
  prb_name: string | null;
  prb_is_sup: string | null;
  prb_is_pc: string | null;
  prb_is_cv: string | null;
  prb_is_mtb: string | null;
  prb_is_eng: string | null;
  prb_display: string | null;
}

export interface PiecesRefEan {
  pre_piece_id: string | null;
  pre_code_ean: string | null;
}

export interface PiecesRefOem {
  pro_piece_id: string | null;
  pro_prb_id: string | null;
  pro_oem: string | null;
  pro_oem_serach: string | null;
  pro_year: string | null;
}

export interface PiecesRefSearch {
  prs_piece_id: string | null;
  prs_search: string | null;
  prs_kind: string | null;
  prs_ref: string | null;
  prs_prb_id: string | null;
  prs_year: string | null;
  prs_piece_prime: string | null;
}

export interface PiecesRelationCriteria {
  rcp_type_id: string | null;
  rcp_piece_id: string | null;
  rcp_pm_id: string | null;
  rcp_pg_pid: string | null;
  rcp_pg_id: string | null;
  rcp_cri_id: string | null;
  rcp_cri_value: string | null;
  rcp_has_txt: string | null;
  rcp_display: string | null;
  rcp_sort: string | null;
}

export interface PiecesRelationType {
  rtp_type_id: string | null;
  rtp_piece_id: string | null;
  rtp_pm_id: string | null;
  rtp_pg_id: string | null;
  rtp_pg_pid: string | null;
  rtp_ga_id: string | null;
  rtp_psf_id: string | null;
  rtp_inside: string | null;
}

export interface PiecesSideFiltre {
  psf_id: string | null;
  psf_side: string | null;
  psf_sort: string | null;
  psf_display: string | null;
}

export interface PiecesStatus {
  pst_id: string | null;
  pst_description: string | null;
  pst_sort: string | null;
  pst_display: string | null;
}

export interface PromoCodes {
  id: string | null;
  code: string | null;
  type: string | null;
  value: string | null;
  min_amount: string | null;
  max_discount: string | null;
  valid_from: string | null;
  valid_until: string | null;
  usage_limit: string | null;
  usage_count: string | null;
  active: string | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  description: string | null;
  min_items: string | null;
  applicable_products: string | null;
  applicable_categories: string | null;
  customer_groups: string | null;
  usage_limit_per_customer: string | null;
  stackable: string | null;
}

export interface ShippingRatesCache {
  id: string | null;
  zip_code: string | null;
  country: string | null;
  zone: string | null;
  weight_min: string | null;
  weight_max: string | null;
  rate: string | null;
  method: string | null;
  delivery_time: string | null;
  cached_at: string | null;
  expires_at: string | null;
}

export interface Users {
  id: string | null;
  email: string | null;
  name: string | null;
  password: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface VIndexUsage {
  schemaname: string | null;
  tablename: string | null;
  indexname: string | null;
  idx_scan: string | null;
  idx_tup_read: string | null;
  idx_tup_fetch: string | null;
  index_size: string | null;
}

export interface VTableHealth {
  schemaname: string | null;
  tablename: string | null;
  total_size: string | null;
  live_rows: string | null;
  dead_rows: string | null;
  dead_ratio: string | null;
  last_vacuum: string | null;
  last_autovacuum: string | null;
  last_analyze: string | null;
}


// ===== TABLES SYSTÈME/INTERNES =====

export interface Config {
  cnf_id: string | null;
  cnf_name: string | null;
  cnf_logo: string | null;
  cnf_domain: string | null;
  cnf_slogan: string | null;
  cnf_mf: string | null;
  cnf_address: string | null;
  cnf_lat: string | null;
  cnf_lng: string | null;
  cnf_mail: string | null;
  cnf_phone: string | null;
  cnf_phone_call: string | null;
  cnf_group_name: string | null;
  cnf_group_domain: string | null;
  cnf_tva: string | null;
  cnf_timber: string | null;
  cnf_shipping: string | null;
  cnf_fiscal_year: string | null;
  cnf_fiscal_bl_from: string | null;
  cnf_fiscal_inv_from: string | null;
  cnf_owner_name: string | null;
  cnf_owner_domain: string | null;
  cnf_hr: string | null;
}

export interface ConfigAdmin {
  cnfa_id: string | null;
  cnfa_login: string | null;
  cnfa_pswd: string | null;
  cnfa_mail: string | null;
  cnfa_keylog: string | null;
  cnfa_level: string | null;
  cnfa_job: string | null;
  cnfa_name: string | null;
  cnfa_fname: string | null;
  cnfa_tel: string | null;
  cnfa_activ: string | null;
}

export interface ConfigIp {
  cnfip_id: string | null;
  cnfip_name: string | null;
  cnfip_alias: string | null;
  cnfip_value: string | null;
}

export interface ConfigOld {
  cnf_id: string | null;
  cnf_name: string | null;
  cnf_domain: string | null;
  cnf_address: string | null;
  cnf_mail: string | null;
  cnf_phone: string | null;
  cnf_phone_call: string | null;
  cnf_hr: string | null;
  cnf_group_name: string | null;
  cnf_group_domain: string | null;
  cnf_owner_name: string | null;
  cnf_owner_domain: string | null;
}

export interface FooterMenu {
  fm_id: string | null;
  fm_title: string | null;
  fm_alias: string | null;
  fm_level: string | null;
  fm_relfollow: string | null;
}

export interface HeaderMenu {
  hm_id: string | null;
  hm_name: string | null;
  hm_alias: string | null;
  hm_link: string | null;
  hm_float: string | null;
  hm_relfollow: string | null;
}

export interface MetaTagsAriane {
  mta_id: string | null;
  mta_title: string | null;
  mta_descrip: string | null;
  mta_keywords: string | null;
  mta_ariane: string | null;
  mta_h1: string | null;
  mta_content: string | null;
  mta_alias: string | null;
  mta_relfollow: string | null;
}

export interface XtrCustomer {
  cst_id: string | null;
  cst_mail: string | null;
  cst_pswd: string | null;
  cst_keylog: string | null;
  cst_civility: string | null;
  cst_name: string | null;
  cst_fname: string | null;
  cst_address: string | null;
  cst_zip_code: string | null;
  cst_city: string | null;
  cst_country: string | null;
  cst_tel: string | null;
  cst_gsm: string | null;
  cst_is_cpy: string | null;
  cst_rs: string | null;
  cst_siret: string | null;
  cst_is_pro: string | null;
  cst_activ: string | null;
  cst_level: string | null;
  cst_password_changed_at: string | null;
}

export interface XtrCustomerBillingAddress {
  cba_id: string | null;
  cba_cst_id: string | null;
  cba_mail: string | null;
  cba_civility: string | null;
  cba_name: string | null;
  cba_fname: string | null;
  cba_address: string | null;
  cba_zip_code: string | null;
  cba_city: string | null;
  cba_country: string | null;
  cba_tel: string | null;
  cba_gsm: string | null;
}

export interface XtrCustomerDeliveryAddress {
  cda_id: string | null;
  cda_cst_id: string | null;
  cda_mail: string | null;
  cda_civility: string | null;
  cda_name: string | null;
  cda_fname: string | null;
  cda_address: string | null;
  cda_zip_code: string | null;
  cda_city: string | null;
  cda_country: string | null;
  cda_tel: string | null;
  cda_gsm: string | null;
}

export interface XtrDeliveryAgent {
  da_id: string | null;
  da_name: string | null;
  da_icon: string | null;
  da_preview: string | null;
  da_extern: string | null;
  da_sql_table: string | null;
  da_fee: string | null;
  da_seuil: string | null;
  da_fee_new: string | null;
}

export interface XtrDeliveryApeCorse {
  tpg_id: string | null;
  tpg_min: string | null;
  tpg_max: string | null;
  tpg_frais_port_ht: string | null;
  tpg_frais_port: string | null;
}

export interface XtrDeliveryApeDomtom1 {
  tpg_id: string | null;
  tpg_min: string | null;
  tpg_max: string | null;
  tpg_frais_port_ht: string | null;
  tpg_frais_port: string | null;
}

export interface XtrDeliveryApeDomtom2 {
  tpg_id: string | null;
  tpg_min: string | null;
  tpg_max: string | null;
  tpg_frais_port_ht: string | null;
  tpg_frais_port: string | null;
}

export interface XtrDeliveryApeFrance {
  tpg_id: string | null;
  tpg_min: string | null;
  tpg_max: string | null;
  tpg_frais_port_ht: string | null;
  tpg_frais_port: string | null;
  tpg_frais_ajouter_50: string | null;
  tpg_frais_ajouter: string | null;
}

export interface XtrInvoice {
  inv_id: string | null;
  inv_ord_id: string | null;
  inv_cst_id: string | null;
  inv_cba_id: string | null;
  inv_cda_id: string | null;
  inv_date: string | null;
  inv_amount_ht: string | null;
  inv_deposit_ht: string | null;
  inv_shipping_fee_ht: string | null;
  inv_total_ht: string | null;
  inv_tva: string | null;
  inv_amount_ttc: string | null;
  inv_deposit_ttc: string | null;
  inv_shipping_fee_ttc: string | null;
  inv_total_ttc: string | null;
  inv_da_id: string | null;
  inv_info: string | null;
}

export interface XtrInvoiceLine {
  invl_id: string | null;
  invl_inv_id: string | null;
  invl_pg_id: string | null;
  invl_pg_name: string | null;
  invl_pm_id: string | null;
  invl_pm_name: string | null;
  invl_art_ref: string | null;
  invl_art_ref_clean: string | null;
  invl_art_price_sell_unit_ht: string | null;
  invl_art_price_sell_unit_ttc: string | null;
  invl_art_deposit_unit_ht: string | null;
  invl_art_deposit_unit_ttc: string | null;
  invl_art_quantity: string | null;
  invl_art_price_sell_ht: string | null;
  invl_art_price_sell_ttc: string | null;
  invl_art_deposit_ht: string | null;
  invl_art_deposit_ttc: string | null;
}

export interface XtrMsg {
  msg_id: string | null;
  msg_cst_id: string | null;
  msg_ord_id: string | null;
  msg_orl_id: string | null;
  msg_orl_equiv_id: string | null;
  msg_cnfa_id: string | null;
  msg_date: string | null;
  msg_subject: string | null;
  msg_content: string | null;
  msg_parent_id: string | null;
  msg_open: string | null;
  msg_close: string | null;
}

export interface XtrOrder {
  ord_id: string | null;
  ord_cst_id: string | null;
  ord_cba_id: string | null;
  ord_cda_id: string | null;
  ord_date: string | null;
  ord_amount_ht: string | null;
  ord_deposit_ht: string | null;
  ord_shipping_fee_ht: string | null;
  ord_total_ht: string | null;
  ord_tva: string | null;
  ord_amount_ttc: string | null;
  ord_deposit_ttc: string | null;
  ord_shipping_fee_ttc: string | null;
  ord_total_ttc: string | null;
  ord_is_pay: string | null;
  ord_date_pay: string | null;
  ord_da_id: string | null;
  ord_info: string | null;
  ord_dept_id: string | null;
  ord_ords_id: string | null;
  ord_parent: string | null;
  ord_link: string | null;
  ord_link_type: string | null;
}

export interface XtrOrderLine {
  orl_id: string | null;
  orl_ord_id: string | null;
  orl_pg_id: string | null;
  orl_pg_name: string | null;
  orl_pm_id: string | null;
  orl_pm_name: string | null;
  orl_art_ref: string | null;
  orl_art_ref_clean: string | null;
  orl_art_price_buy_unit_public_ht: string | null;
  orl_art_price_buy_unit_public_ttc: string | null;
  orl_art_price_buy_discount: string | null;
  orl_art_price_buy_unit_ht: string | null;
  orl_art_price_buy_unit_ttc: string | null;
  orl_art_price_sell_margin: string | null;
  orl_art_price_sell_unit_ht: string | null;
  orl_art_price_sell_unit_ttc: string | null;
  orl_art_deposit_unit_ht: string | null;
  orl_art_deposit_unit_ttc: string | null;
  orl_art_quantity: string | null;
  orl_art_price_buy_ht: string | null;
  orl_art_price_buy_ttc: string | null;
  orl_art_price_sell_ht: string | null;
  orl_art_price_sell_ttc: string | null;
  orl_art_deposit_ht: string | null;
  orl_art_deposit_ttc: string | null;
  orl_spl_id: string | null;
  orl_spl_name: string | null;
  orl_spl_date: string | null;
  orl_spl_price_buy_unit_ht: string | null;
  orl_spl_price_buy_unit_ttc: string | null;
  orl_spl_price_buy_ht: string | null;
  orl_spl_price_buy_ttc: string | null;
  orl_website_url: string | null;
  orl_orls_id: string | null;
  orl_equiv_id: string | null;
}

export interface XtrOrderLineEquivTicket {
  orlet_id: string | null;
  orlet_ord_id: string | null;
  orlet_orl_id: string | null;
  orlet_equiv_id: string | null;
  orlet_amount_ttc: string | null;
}

export interface XtrOrderLineStatus {
  orls_id: string | null;
  orls_name: string | null;
  orls_action: string | null;
  orls_color: string | null;
  orls_dept_id: string | null;
}

export interface XtrOrderStatus {
  ords_id: string | null;
  ords_named: string | null;
  ords_action: string | null;
  ords_color: string | null;
  ords_dept_id: string | null;
}

export interface XtrSupplier {
  spl_id: string | null;
  spl_name: string | null;
  spl_alias: string | null;
  spl_display: string | null;
  spl_sort: string | null;
}

export interface XtrSupplierLinkPm {
  slpm_id: string | null;
  slpm_pm_id: string | null;
  slpm_spl_id: string | null;
  slpm_display: string | null;
}

export interface BlogAdvice {
  ba_id: string | null;
  ba_title: string | null;
  ba_descrip: string | null;
  ba_keywords: string | null;
  ba_h1: string | null;
  ba_alias: string | null;
  ba_h2: string | null;
  ba_preview: string | null;
  ba_content: string | null;
  ba_wall: string | null;
  ba_create: string | null;
  ba_update: string | null;
  ba_pg_id: string | null;
  ba_visit: string | null;
  ba_cta_anchor: string | null;
  ba_cta_link: string | null;
}

export interface BlogAdviceCross {
  bac_id: string | null;
  bac_ba_id: string | null;
  bac_ba_id_cross: string | null;
}

export interface BlogAdviceH2 {
  ba2_id: string | null;
  ba2_h2: string | null;
  ba2_content: string | null;
  ba2_wall: string | null;
  ba2_create: string | null;
  ba2_update: string | null;
  ba2_ba_id: string | null;
  ba2_cta_anchor: string | null;
  ba2_cta_link: string | null;
}

export interface BlogAdviceH3 {
  ba3_id: string | null;
  ba3_h3: string | null;
  ba3_content: string | null;
  ba3_wall: string | null;
  ba3_create: string | null;
  ba3_update: string | null;
  ba3_ba2_id: string | null;
  ba3_cta_anchor: string | null;
  ba3_cta_link: string | null;
}

export interface BlogGuide {
  bg_id: string | null;
  bg_title: string | null;
  bg_descrip: string | null;
  bg_keywords: string | null;
  bg_h1: string | null;
  bg_alias: string | null;
  bg_h2: string | null;
  bg_preview: string | null;
  bg_content: string | null;
  bg_wall: string | null;
  bg_create: string | null;
  bg_update: string | null;
  bg_visit: string | null;
  bg_cta_anchor: string | null;
  bg_cta_link: string | null;
}

export interface BlogGuideH2 {
  bg2_id: string | null;
  bg2_h2: string | null;
  bg2_content: string | null;
  bg2_wall: string | null;
  bg2_create: string | null;
  bg2_update: string | null;
  bg2_bg_id: string | null;
  bg2_cta_anchor: string | null;
  bg2_cta_link: string | null;
}

export interface BlogGuideH3 {
  bg3_id: string | null;
  bg3_h3: string | null;
  bg3_content: string | null;
  bg3_wall: string | null;
  bg3_create: string | null;
  bg3_update: string | null;
  bg3_bg2_id: string | null;
  bg3_cta_anchor: string | null;
  bg3_cta_link: string | null;
}

export interface BlogMetaTagsAriane {
  mta_id: string | null;
  mta_title: string | null;
  mta_descrip: string | null;
  mta_keywords: string | null;
  mta_ariane: string | null;
  mta_h1: string | null;
  mta_content: string | null;
  mta_alias: string | null;
  mta_relfollow: string | null;
}

export interface BlogSeoMarque {
  bsm_id: string | null;
  bsm_title: string | null;
  bsm_descrip: string | null;
  bsm_keywords: string | null;
  bsm_h1: string | null;
  bsm_content: string | null;
  bsm_marque_id: string | null;
}

export interface CrossGammeCar {
  cgc_id: string | null;
  cgc_pg_id: string | null;
  cgc_marque_id: string | null;
  cgc_modele_id: string | null;
  cgc_type_id: string | null;
  cgc_level: string | null;
}

export interface CrossGammeCarNew {
  cgc_id: string | null;
  cgc_pg_id: string | null;
  cgc_marque_id: string | null;
  cgc_mdg_id: string | null;
  cgc_modele_id: string | null;
  cgc_type_id: string | null;
  cgc_level: string | null;
}

export interface CrossGammeCarNew2 {
  cgc_id: string | null;
  cgc_pg_id: string | null;
  cgc_marque_id: string | null;
  cgc_mdg_id: string | null;
  cgc_modele_id: string | null;
  cgc_type_id: string | null;
  cgc_level: string | null;
}

export interface SeoEquipGamme {
  seg_id: string | null;
  seg_content: string | null;
  seg_pm_id: string | null;
  seg_pg_id: string | null;
}

export interface SeoFamilyGammeCarSwitch {
  sfgcs_id: string | null;
  sfgcs_content: string | null;
  sfgcs_alias: string | null;
  sfgcs_mf_id: string | null;
  sfgcs_pg_id: string | null;
}

export interface SeoGamme {
  sg_id: string | null;
  sg_title: string | null;
  sg_descrip: string | null;
  sg_keywords: string | null;
  sg_h1: string | null;
  sg_content: string | null;
  sg_pg_id: string | null;
}

export interface SeoGammeCar {
  sgc_id: string | null;
  sgc_title: string | null;
  sgc_descrip: string | null;
  sgc_h1: string | null;
  sgc_preview: string | null;
  sgc_content: string | null;
  sgc_pg_id: string | null;
}

export interface SeoGammeConseil {
  sgc_id: string | null;
  sgc_title: string | null;
  sgc_content: string | null;
  sgc_pg_id: string | null;
}

export interface SeoGammeInfo {
  sgi_id: string | null;
  sgi_content: string | null;
  sgi_pg_id: string | null;
}

export interface SeoItemSwitch {
  sis_id: string | null;
  sis_content: string | null;
  sis_alias: string | null;
  sis_pg_id: string | null;
}

export interface SeoMarque {
  sm_id: string | null;
  sm_title: string | null;
  sm_descrip: string | null;
  sm_keywords: string | null;
  sm_h1: string | null;
  sm_content: string | null;
  sm_marque_id: string | null;
}

export interface SeoTypeSwitch {
  sts_id: string | null;
  sts_content: string | null;
  sts_alias: string | null;
}

export interface SitemapBlog {
  map_id: string | null;
  map_alias: string | null;
  map_date: string | null;
}

export interface SitemapMarque {
  map_id: string | null;
  map_marque_alias: string | null;
  map_marque_id: string | null;
}

export interface SitemapMotorisation {
  map_id: string | null;
  map_marque_alias: string | null;
  map_marque_id: string | null;
  map_modele_alias: string | null;
  map_modele_id: string | null;
  map_type_alias: string | null;
  map_type_id: string | null;
}

export interface SitemapPLink {
  map_id: string | null;
  map_pg_alias: string | null;
  map_pg_id: string | null;
  map_marque_alias: string | null;
  map_marque_id: string | null;
  map_modele_alias: string | null;
  map_modele_id: string | null;
  map_type_alias: string | null;
  map_type_id: string | null;
  map_has_item: string | null;
}

export interface SitemapPXml {
  map_id: string | null;
  map_pg_id: string | null;
  map_marque_id: string | null;
  map_file: string | null;
  map_has_link: string | null;
}

export interface SitemapSearchLink {
  map_id: string | null;
  map_pg_alias: string | null;
  map_pg_id: string | null;
  map_marque_alias: string | null;
  map_marque_id: string | null;
  map_modele_alias: string | null;
  map_modele_id: string | null;
  map_type_alias: string | null;
  map_type_id: string | null;
}


// ===== TYPES UTILITAIRES =====

export type TableName = 
'___config'  | '___config_admin'  | '___config_ip'  | '___config_old'  | '___footer_menu'  | '___header_menu'  | '___meta_tags_ariane'  | '___xtr_customer'  | '___xtr_customer_billing_address'  | '___xtr_customer_delivery_address'  | '___xtr_delivery_agent'  | '___xtr_delivery_ape_corse'  | '___xtr_delivery_ape_domtom1'  | '___xtr_delivery_ape_domtom2'  | '___xtr_delivery_ape_france'  | '___xtr_invoice'  | '___xtr_invoice_line'  | '___xtr_msg'  | '___xtr_order'  | '___xtr_order_line'  | '___xtr_order_line_equiv_ticket'  | '___xtr_order_line_status'  | '___xtr_order_status'  | '___xtr_supplier'  | '___xtr_supplier_link_pm'  | '__blog_advice'  | '__blog_advice_cross'  | '__blog_advice_h2'  | '__blog_advice_h3'  | '__blog_advice_old'  | '__blog_guide'  | '__blog_guide_h2'  | '__blog_guide_h3'  | '__blog_meta_tags_ariane'  | '__blog_seo_marque'  | '__cross_gamme_car'  | '__cross_gamme_car_new'  | '__cross_gamme_car_new2'  | '__seo_equip_gamme'  | '__seo_family_gamme_car_switch'  | '__seo_gamme'  | '__seo_gamme_car'  | '__seo_gamme_car_switch'  | '__seo_gamme_conseil'  | '__seo_gamme_info'  | '__seo_item_switch'  | '__seo_marque'  | '__seo_type_switch'  | '__sitemap_blog'  | '__sitemap_gamme'  | '__sitemap_marque'  | '__sitemap_motorisation'  | '__sitemap_p_link'  | '__sitemap_p_xml'  | '__sitemap_search_link'  | 'am_2022_suppliers'  | 'auto_marque'  | 'auto_modele'  | 'auto_modele_group'  | 'auto_modele_robot'  | 'auto_type'  | 'auto_type_motor_code'  | 'auto_type_motor_fuel'  | 'auto_type_number_code'  | 'cars_engine'  | 'catalog_family'  | 'catalog_gamme'  | 'categories'  | 'ic_postback'  | 'password_resets'  | 'pieces'  | 'pieces_criteria'  | 'pieces_criteria_group'  | 'pieces_criteria_link'  | 'pieces_details'  | 'pieces_gamme'  | 'pieces_gamme_cross'  | 'pieces_list'  | 'pieces_marque'  | 'pieces_media_img'  | 'pieces_price'  | 'pieces_ref_brand'  | 'pieces_ref_ean'  | 'pieces_ref_oem'  | 'pieces_ref_search'  | 'pieces_relation_criteria'  | 'pieces_relation_type'  | 'pieces_side_filtre'  | 'pieces_status'  | 'products'  | 'promo_codes'  | 'promo_usage'  | 'sessions'  | 'shipping_rates_cache'  | 'users'  | 'v_index_usage'  | 'v_table_health';


export interface Database {
  '___config': Config;
  '___config_admin': ConfigAdmin;
  '___config_ip': ConfigIp;
  '___config_old': ConfigOld;
  '___footer_menu': FooterMenu;
  '___header_menu': HeaderMenu;
  '___meta_tags_ariane': MetaTagsAriane;
  '___xtr_customer': XtrCustomer;
  '___xtr_customer_billing_address': XtrCustomerBillingAddress;
  '___xtr_customer_delivery_address': XtrCustomerDeliveryAddress;
  '___xtr_delivery_agent': XtrDeliveryAgent;
  '___xtr_delivery_ape_corse': XtrDeliveryApeCorse;
  '___xtr_delivery_ape_domtom1': XtrDeliveryApeDomtom1;
  '___xtr_delivery_ape_domtom2': XtrDeliveryApeDomtom2;
  '___xtr_delivery_ape_france': XtrDeliveryApeFrance;
  '___xtr_invoice': XtrInvoice;
  '___xtr_invoice_line': XtrInvoiceLine;
  '___xtr_msg': XtrMsg;
  '___xtr_order': XtrOrder;
  '___xtr_order_line': XtrOrderLine;
  '___xtr_order_line_equiv_ticket': XtrOrderLineEquivTicket;
  '___xtr_order_line_status': XtrOrderLineStatus;
  '___xtr_order_status': XtrOrderStatus;
  '___xtr_supplier': XtrSupplier;
  '___xtr_supplier_link_pm': XtrSupplierLinkPm;
  '__blog_advice': BlogAdvice;
  '__blog_advice_cross': BlogAdviceCross;
  '__blog_advice_h2': BlogAdviceH2;
  '__blog_advice_h3': BlogAdviceH3;
  '__blog_advice_old': Record<string, any>; // Table vide
  '__blog_guide': BlogGuide;
  '__blog_guide_h2': BlogGuideH2;
  '__blog_guide_h3': BlogGuideH3;
  '__blog_meta_tags_ariane': BlogMetaTagsAriane;
  '__blog_seo_marque': BlogSeoMarque;
  '__cross_gamme_car': CrossGammeCar;
  '__cross_gamme_car_new': CrossGammeCarNew;
  '__cross_gamme_car_new2': CrossGammeCarNew2;
  '__seo_equip_gamme': SeoEquipGamme;
  '__seo_family_gamme_car_switch': SeoFamilyGammeCarSwitch;
  '__seo_gamme': SeoGamme;
  '__seo_gamme_car': SeoGammeCar;
  '__seo_gamme_car_switch': Record<string, any>; // Table vide ou manquante
  '__seo_gamme_conseil': SeoGammeConseil;
  '__seo_gamme_info': SeoGammeInfo;
  '__seo_item_switch': SeoItemSwitch;
  '__seo_marque': SeoMarque;
  '__seo_type_switch': SeoTypeSwitch;
  '__sitemap_blog': SitemapBlog;
  '__sitemap_gamme': Record<string, any>; // Table vide ou manquante
  '__sitemap_marque': SitemapMarque;
  '__sitemap_motorisation': SitemapMotorisation;
  '__sitemap_p_link': SitemapPLink;
  '__sitemap_p_xml': SitemapPXml;
  '__sitemap_search_link': SitemapSearchLink;
  'am_2022_suppliers': Am2022Suppliers;
  'auto_marque': AutoMarque;
  'auto_modele': AutoModele;
  'auto_modele_group': AutoModeleGroup;
  'auto_modele_robot': AutoModeleRobot;
  'auto_type': AutoType;
  'auto_type_motor_code': AutoTypeMotorCode;
  'auto_type_motor_fuel': AutoTypeMotorFuel;
  'auto_type_number_code': AutoTypeNumberCode;
  'cars_engine': CarsEngine;
  'catalog_family': CatalogFamily;
  'catalog_gamme': CatalogGamme;
  'categories': Record<string, any>; // Table vide ou manquante
  'ic_postback': IcPostback;
  'password_resets': Record<string, any>; // Table vide ou manquante
  'pieces': Pieces;
  'pieces_criteria': PiecesCriteria;
  'pieces_criteria_group': PiecesCriteriaGroup;
  'pieces_criteria_link': PiecesCriteriaLink;
  'pieces_details': PiecesDetails;
  'pieces_gamme': PiecesGamme;
  'pieces_gamme_cross': PiecesGammeCross;
  'pieces_list': PiecesList;
  'pieces_marque': PiecesMarque;
  'pieces_media_img': PiecesMediaImg;
  'pieces_price': PiecesPrice;
  'pieces_ref_brand': PiecesRefBrand;
  'pieces_ref_ean': PiecesRefEan;
  'pieces_ref_oem': PiecesRefOem;
  'pieces_ref_search': PiecesRefSearch;
  'pieces_relation_criteria': PiecesRelationCriteria;
  'pieces_relation_type': PiecesRelationType;
  'pieces_side_filtre': PiecesSideFiltre;
  'pieces_status': PiecesStatus;
  'products': Record<string, any>; // Table vide ou manquante (utiliser 'pieces' à la place)
  'promo_codes': PromoCodes;
  'promo_usage': Record<string, any>; // Table vide ou manquante
  'sessions': Record<string, any>; // Table vide ou manquante
  'shipping_rates_cache': ShippingRatesCache;
  'users': Users;
  'v_index_usage': VIndexUsage;
  'v_table_health': VTableHealth;
}


// Helper types pour les requêtes
export type TableRow<T extends TableName> = Database[T];
export type TableInsert<T extends TableName> = Partial<Database[T]>;
export type TableUpdate<T extends TableName> = Partial<Database[T]>;
