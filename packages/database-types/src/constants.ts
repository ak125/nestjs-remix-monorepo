/**
 * 🗂️ CONSTANTES DE TABLES ET COLONNES
 * Source unique de vérité pour les noms de tables et colonnes PostgreSQL
 * Généré automatiquement - Évite les erreurs de typage
 */

import type { TableName } from './types';

/**
 * ✅ NOMS DE TABLES - Source unique de vérité
 * Utilisez ces constantes au lieu d'écrire les noms en dur
 * 
 * @example
 * ```ts
 * // ❌ AVANT: Risque d'erreur de typage
 * .from('pieces_prix')
 * 
 * // ✅ APRÈS: Autocomplete + Type-safe
 * .from(TABLES.pieces_price)
 * ```
 */
export const TABLES = {
  // Tables principales - Pièces automobiles
  pieces: 'pieces',
  pieces_price: 'pieces_price',
  pieces_marque: 'pieces_marque',
  pieces_media_img: 'pieces_media_img',
  pieces_criteria: 'pieces_criteria',
  pieces_criteria_link: 'pieces_criteria_link',
  pieces_criteria_group: 'pieces_criteria_group',
  pieces_relation_type: 'pieces_relation_type',

  // Tables legacy/extra - Préfixe ___*
  config: '___config',
  config_admin: '___config_admin',
  config_ip: '___config_ip',
  config_old: '___config_old',
  footer_menu: '___footer_menu',
  header_menu: '___header_menu',
  meta_tags_ariane: '___meta_tags_ariane',
  xtr_customer: '___xtr_customer',
  xtr_customer_billing_address: '___xtr_customer_billing_address',
  xtr_customer_delivery_address: '___xtr_customer_delivery_address',
  xtr_delivery_agent: '___xtr_delivery_agent',
  xtr_delivery_ape_corse: '___xtr_delivery_ape_corse',
  xtr_delivery_ape_domtom1: '___xtr_delivery_ape_domtom1',
  xtr_delivery_ape_domtom2: '___xtr_delivery_ape_domtom2',
  xtr_delivery_ape_france: '___xtr_delivery_ape_france',
  xtr_invoice: '___xtr_invoice',
  xtr_invoice_line: '___xtr_invoice_line',
  xtr_msg: '___xtr_msg',
  xtr_order: '___xtr_order',
  xtr_order_line: '___xtr_order_line',
  xtr_order_line_equiv_ticket: '___xtr_order_line_equiv_ticket',
  xtr_order_line_status: '___xtr_order_line_status',
  xtr_order_status: '___xtr_order_status',
  xtr_supplier: '___xtr_supplier',
  xtr_supplier_link_pm: '___xtr_supplier_link_pm',
  pieces_relation_criteria: 'pieces_relation_criteria',
  pieces_side_filtre: 'pieces_side_filtre',
  pieces_gamme: 'pieces_gamme',
  pieces_gamme_cross: 'pieces_gamme_cross',
  pieces_list: 'pieces_list',
  pieces_details: 'pieces_details',
  pieces_ref_brand: 'pieces_ref_brand',
  pieces_ref_ean: 'pieces_ref_ean',
  pieces_ref_oem: 'pieces_ref_oem',
  pieces_ref_search: 'pieces_ref_search',
  pieces_status: 'pieces_status',

  // Tables véhicules
  auto_marque: 'auto_marque',
  auto_modele: 'auto_modele',
  auto_modele_group: 'auto_modele_group',
  auto_type: 'auto_type',
  auto_type_motor_code: 'auto_type_motor_code',
  auto_type_motor_fuel: 'auto_type_motor_fuel',
  auto_type_number_code: 'auto_type_number_code',

  // Tables catalogue
  catalog_family: 'catalog_family',
  catalog_gamme: 'catalog_gamme',

  // Tables authentification et sécurité
  password_resets: 'password_resets',
  sessions: 'sessions',

  // Tables SEO et blog
  blog_advice: '__blog_advice',
  blog_advice_h2: '__blog_advice_h2',
  blog_advice_h3: '__blog_advice_h3',
  blog_advice_cross: '__blog_advice_cross',
  blog_guide: '__blog_guide',
  blog_guide_h2: '__blog_guide_h2',
  blog_guide_h3: '__blog_guide_h3',
  blog_seo_marque: '__blog_seo_marque',
  blog_meta_tags_ariane: '__blog_meta_tags_ariane',
  seo_gamme: '__seo_gamme',
  seo_gamme_car: '__seo_gamme_car',
  seo_gamme_car_switch: '__seo_gamme_car_switch',
  seo_item_switch: '__seo_item_switch',
  seo_marque: '__seo_marque',
  seo_equip_gamme: '__seo_equip_gamme',
  seo_family_gamme_car_switch: '__seo_family_gamme_car_switch',
  sitemap_p_link: '__sitemap_p_link',

  // Tables système et configuration
  promo_codes: 'promo_codes',
  quantity_discounts: 'quantity_discounts',
  shipping_rates_cache: 'shipping_rates_cache',
  users: 'users',
  products: 'products',
} as const satisfies Record<string, TableName>;

/**
 * 🔑 COLONNES IMPORTANTES - Documentation des colonnes clés
 * Pour référence et autocomplete
 */
export const COLUMNS = {
  // Table pieces
  pieces: {
    id: 'piece_id',
    ref: 'piece_ref',
    ref_clean: 'piece_ref_clean',
    name: 'piece_name',
    name_comp: 'piece_name_comp',
    name_side: 'piece_name_side',
    description: 'piece_des',
    pm_id: 'piece_pm_id',
    pg_id: 'piece_pg_id',
    weight: 'piece_weight_kgm',
    qty_sale: 'piece_qty_sale',
    has_img: 'piece_has_img',
    has_oem: 'piece_has_oem',
    display: 'piece_display',
  },

  // Table pieces_price (⚠️ Attention: pas pieces_prix !)
  pieces_price: {
    piece_id: 'pri_piece_id',
    pm_id: 'pri_pm_id',
    vente_ttc: 'pri_vente_ttc',
    consigne_ttc: 'pri_consigne_ttc',
    dispo: 'pri_dispo',
    type: 'pri_type',
    ean: 'pri_ean',
    ref: 'pri_ref',
  },

  // Table pieces_marque (⚠️ Attention: pm_quality pas pm_qualite !)
  pieces_marque: {
    id: 'pm_id',
    name: 'pm_name',
    alias: 'pm_alias',
    logo: 'pm_logo',
    quality: 'pm_quality', // ✅ CORRECT (pas pm_qualite)
    oes: 'pm_oes',
    nb_stars: 'pm_nb_stars',
    display: 'pm_display',
  },

  // Table pieces_media_img (⚠️ Attention: pas pieces_images !)
  pieces_media_img: {
    piece_id: 'pmi_piece_id',
    pm_id: 'pmi_pm_id',
    folder: 'pmi_folder',
    name: 'pmi_name',
    sort: 'pmi_sort',
    display: 'pmi_display',
  },

  // Table pieces_criteria (⚠️ Attention: pas pieces_criteres !)
  pieces_criteria: {
    piece_id: 'pc_piece_id',
    cri_id: 'pc_cri_id',
    cri_value: 'pc_cri_value',
    display: 'pc_display',
  },

  // Table pieces_criteria_link
  pieces_criteria_link: {
    cri_id: 'pcl_cri_id',
    criteria: 'pcl_cri_criteria',
    unit: 'pcl_cri_unit',
    level: 'pcl_level',
    display: 'pcl_display',
  },

  // Table pieces_relation_type
  pieces_relation_type: {
    type_id: 'rtp_type_id',
    piece_id: 'rtp_piece_id',
    pm_id: 'rtp_pm_id',
    pg_id: 'rtp_pg_id',
    psf_id: 'rtp_psf_id',
  },

  // Table auto_marque
  auto_marque: {
    id: 'marque_id',
    name: 'marque_name',
    alias: 'marque_alias',
    logo: 'marque_logo',
    display: 'marque_display',
  },

  // Table auto_modele
  auto_modele: {
    id: 'modele_id',
    name: 'modele_name',
    alias: 'modele_alias',
    marque_id: 'modele_marque_id',
    pic: 'modele_pic',
    display: 'modele_display',
  },

  // Table auto_type
  auto_type: {
    id: 'type_id',
    name: 'type_name',
    alias: 'type_alias',
    modele_id: 'type_modele_id',
    marque_id: 'type_marque_id',
    engine: 'type_engine',
    fuel: 'type_fuel',
    power_ps: 'type_power_ps',
    display: 'type_display',
  },
} as const;

/**
 * 🎯 VALEURS PAR DÉFAUT COMMUNES
 */
export const DEFAULT_VALUES = {
  display: {
    active: '1',
    inactive: '0',
  },
  dispo: {
    available: 1,
    unavailable: 0,
  },
  quality: {
    oes: 'OES',
    premium: 'A',
  },
} as const;

/**
 * 🔍 HELPER TYPE - Pour autocomplete dans les requêtes
 */
export type TableNames = typeof TABLES;
export type ColumnNames = typeof COLUMNS;
