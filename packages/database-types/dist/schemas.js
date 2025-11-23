import { z } from 'zod';
export const PiecesSchema = z.object({
    piece_id: z.string().nullable(),
    piece_ref: z.string().nullable(),
    piece_ref_clean: z.string().nullable(),
    piece_pm_id: z.string().nullable(),
    piece_pg_id: z.string().nullable(),
    piece_ga_id: z.string().nullable(),
    piece_des: z.string().nullable(),
    piece_name: z.string().nullable(),
    piece_name_comp: z.string().nullable(),
    piece_name_side: z.string().nullable(),
    piece_fil_id: z.string().nullable(),
    piece_fil_name: z.string().nullable(),
    piece_qty_sale: z.string().nullable(),
    piece_qty_pack: z.string().nullable(),
    piece_weight_kgm: z.string().nullable(),
    piece_has_oem: z.string().nullable(),
    piece_has_img: z.string().nullable(),
    piece_year: z.string().nullable(),
    piece_display: z.string().nullable(),
    piece_sort: z.string().nullable(),
    piece_update: z.string().nullable(),
    piece_pg_pid: z.string().nullable(),
    piece_psf_id: z.string().nullable(),
    search_vector: z.string().nullable()
});
export const PiecesPriceSchema = z.object({
    pri_piece_id: z.string().nullable(),
    pri_pm_id: z.string().nullable(),
    pri_ean: z.string().nullable(),
    pri_ref: z.string().nullable(),
    pri_ref_comp: z.string().nullable(),
    pri_des: z.string().nullable(),
    pri_dispo: z.string().nullable(),
    pri_type: z.string().nullable(),
    pri_public_ht: z.string().nullable(),
    pri_gros_ht: z.string().nullable(),
    pri_consigne_ht: z.string().nullable(),
    pri_consigne_ttc: z.string().nullable(),
    pri_remise: z.string().nullable(),
    pri_frs: z.string().nullable(),
    pri_remise_2: z.string().nullable(),
    pri_frs_2: z.string().nullable(),
    pri_remise_3: z.string().nullable(),
    pri_frs_3: z.string().nullable(),
    pri_remise_4: z.string().nullable(),
    pri_frs_4: z.string().nullable(),
    pri_achat_ht: z.string().nullable(),
    pri_marge: z.string().nullable(),
    pri_vente_ht: z.string().nullable(),
    pri_frais_port_ht: z.string().nullable(),
    pri_frais_supp_ht: z.string().nullable(),
    pri_tva: z.string().nullable(),
    pri_vente_ttc: z.string().nullable(),
    pri_vente_tn_ttc: z.string().nullable(),
    pri_qte_cond: z.string().nullable(),
    pri_qte_vente: z.string().nullable(),
    pri_date_from: z.string().nullable(),
    pri_date_to: z.string().nullable(),
    pri_poids: z.string().nullable(),
    pri_udm_poids: z.string().nullable(),
    pri_hauteur: z.string().nullable(),
    pri_longueur: z.string().nullable(),
    pri_largeur: z.string().nullable(),
    pri_udm_dimentions: z.string().nullable(),
    pri_code_metier: z.string().nullable(),
    pri_code_remise: z.string().nullable(),
    pri_code_sfam_nu: z.string().nullable(),
    pri_code_fam_nu: z.string().nullable(),
    pri_xls: z.string().nullable(),
    pri_insert_type: z.string().nullable()
});
export const PiecesMarqueSchema = z.object({
    pm_id: z.string().nullable(),
    pm_alias: z.string().nullable(),
    pm_name: z.string().nullable(),
    pm_name_url: z.string().nullable(),
    pm_name_meta: z.string().nullable(),
    pm_logo: z.string().nullable(),
    pm_quality: z.string().nullable(),
    pm_nature: z.string().nullable(),
    pm_preview: z.string().nullable(),
    pm_relfollow: z.string().nullable(),
    pm_sitemap: z.string().nullable(),
    pm_top: z.string().nullable(),
    pm_oes: z.string().nullable(),
    pm_nb_stars: z.string().nullable(),
    pm_display: z.string().nullable(),
    pm_sort: z.string().nullable()
});
export const PiecesMediaImgSchema = z.object({
    pmi_piece_id: z.string().nullable(),
    pmi_pm_id: z.string().nullable(),
    pmi_folder: z.string().nullable(),
    pmi_name: z.string().nullable(),
    pmi_sort: z.string().nullable(),
    pmi_display: z.string().nullable()
});
export const PiecesCriteriaSchema = z.object({
    pc_piece_id: z.string().nullable(),
    pc_pg_pid: z.string().nullable(),
    pc_pg_id: z.string().nullable(),
    pc_ga_id: z.string().nullable(),
    pc_cri_id: z.string().nullable(),
    pc_cri_value: z.string().nullable(),
    pc_has_txt: z.string().nullable(),
    pc_update_value: z.string().nullable(),
    pc_display: z.string().nullable(),
    pc_sort: z.string().nullable()
});
export const PiecesCriteriaLinkSchema = z.object({
    pcl_pg_id: z.string().nullable(),
    pcl_pg_pid: z.string().nullable(),
    pcl_cri_id: z.string().nullable(),
    pcl_cri_parent: z.string().nullable(),
    pcl_cri_type: z.string().nullable(),
    pcl_cri_criteria: z.string().nullable(),
    pcl_cri_unit: z.string().nullable(),
    pcl_level: z.string().nullable(),
    pcl_is_filter: z.string().nullable(),
    pcl_has_link: z.string().nullable(),
    pcl_display: z.string().nullable(),
    pcl_sort: z.string().nullable()
});
export const AutoMarqueSchema = z.object({
    marque_id: z.string().nullable(),
    marque_alias: z.string().nullable(),
    marque_name: z.string().nullable(),
    marque_name_url: z.string().nullable(),
    marque_name_meta: z.string().nullable(),
    marque_name_meta_title: z.string().nullable(),
    marque_logo: z.string().nullable(),
    marque_wall: z.string().nullable(),
    marque_relfollow: z.string().nullable(),
    marque_sitemap: z.string().nullable(),
    marque_display: z.string().nullable(),
    marque_sort: z.string().nullable(),
    marque_top: z.string().nullable()
});
export const AutoModeleSchema = z.object({
    modele_id: z.string().nullable(),
    modele_parent: z.string().nullable(),
    modele_marque_id: z.string().nullable(),
    modele_mdg_id: z.string().nullable(),
    modele_alias: z.string().nullable(),
    modele_name: z.string().nullable(),
    modele_name_url: z.string().nullable(),
    modele_name_meta: z.string().nullable(),
    modele_ful_name: z.string().nullable(),
    modele_month_from: z.string().nullable(),
    modele_year_from: z.string().nullable(),
    modele_month_to: z.string().nullable(),
    modele_year_to: z.string().nullable(),
    modele_body: z.string().nullable(),
    modele_pic: z.string().nullable(),
    modele_relfollow: z.string().nullable(),
    modele_sitemap: z.string().nullable(),
    modele_display: z.string().nullable(),
    modele_display_v1: z.string().nullable(),
    modele_sort: z.string().nullable(),
    modele_is_new: z.string().nullable()
});
export const AutoTypeSchema = z.object({
    type_id: z.string().nullable(),
    type_tmf_id: z.string().nullable(),
    type_alias: z.string().nullable(),
    type_modele_id: z.string().nullable(),
    type_marque_id: z.string().nullable(),
    type_name: z.string().nullable(),
    type_name_url: z.string().nullable(),
    type_name_meta: z.string().nullable(),
    type_engine: z.string().nullable(),
    type_fuel: z.string().nullable(),
    type_power_ps: z.string().nullable(),
    type_power_kw: z.string().nullable(),
    type_liter: z.string().nullable(),
    type_month_from: z.string().nullable(),
    type_year_from: z.string().nullable(),
    type_month_to: z.string().nullable(),
    type_year_to: z.string().nullable(),
    type_body: z.string().nullable(),
    type_relfollow: z.string().nullable(),
    type_display: z.string().nullable(),
    type_sort: z.string().nullable()
});
export const Am2022SuppliersSchema = z.object({
    sup_id: z.string().nullable(),
    sup_id_steq: z.string().nullable(),
    sup_pm_id: z.string().nullable(),
    sup_nr: z.string().nullable(),
    sup_brand: z.string().nullable(),
    sup_display: z.string().nullable(),
    sup_sort: z.string().nullable(),
    has_img: z.string().nullable(),
    sup_file: z.string().nullable()
});
export const AutoModeleGroupSchema = z.object({
    mdg_id: z.string().nullable(),
    mdg_marque_id: z.string().nullable(),
    mdg_name: z.string().nullable(),
    mdg_pic: z.string().nullable(),
    mdg_display: z.string().nullable(),
    mdg_sort: z.string().nullable()
});
export const AutoModeleRobotSchema = z.object({
    modele_id: z.string().nullable(),
    modele_marque_id: z.string().nullable(),
    modele_mdg_id: z.string().nullable(),
    modele_alias: z.string().nullable(),
    modele_name: z.string().nullable(),
    modele_name_url: z.string().nullable(),
    modele_name_meta: z.string().nullable(),
    modele_month_from: z.string().nullable(),
    modele_year_from: z.string().nullable(),
    modele_month_to: z.string().nullable(),
    modele_year_to: z.string().nullable(),
    modele_body: z.string().nullable(),
    modele_pic: z.string().nullable(),
    modele_relfollow: z.string().nullable(),
    modele_sitemap: z.string().nullable(),
    modele_display: z.string().nullable(),
    modele_sort: z.string().nullable(),
    modele_is_new: z.string().nullable()
});
export const AutoTypeMotorCodeSchema = z.object({
    tmc_type_id: z.string().nullable(),
    tmc_code: z.string().nullable()
});
export const AutoTypeMotorFuelSchema = z.object({
    tmf_id: z.string().nullable(),
    tmf_motor: z.string().nullable(),
    tmf_engine: z.string().nullable(),
    tmf_fuel: z.string().nullable(),
    tmf_sort: z.string().nullable(),
    tmf_display: z.string().nullable()
});
export const AutoTypeNumberCodeSchema = z.object({
    tnc_type_id: z.string().nullable(),
    tnc_cnit: z.string().nullable(),
    tnc_code: z.string().nullable()
});
export const CarsEngineSchema = z.object({
    eng_id: z.string().nullable(),
    eng_mfa_id: z.string().nullable(),
    eng_code: z.string().nullable()
});
export const CatalogFamilySchema = z.object({
    mf_id: z.string().nullable(),
    mf_name: z.string().nullable(),
    mf_name_meta: z.string().nullable(),
    mf_name_system: z.string().nullable(),
    mf_description: z.string().nullable(),
    mf_pic: z.string().nullable(),
    mf_display: z.string().nullable(),
    mf_sort: z.string().nullable()
});
export const CatalogGammeSchema = z.object({
    mc_id: z.string().nullable(),
    mc_mf_id: z.string().nullable(),
    mc_mf_prime: z.string().nullable(),
    mc_pg_id: z.string().nullable(),
    mc_sort: z.string().nullable()
});
export const IcPostbackSchema = z.object({
    id_ic_postback: z.string().nullable(),
    id_com: z.string().nullable(),
    status: z.string().nullable(),
    statuscode: z.string().nullable(),
    idsite: z.string().nullable(),
    idste: z.string().nullable(),
    orderid: z.string().nullable(),
    paymentid: z.string().nullable(),
    transactionid: z.string().nullable(),
    amount: z.string().nullable(),
    currency: z.string().nullable(),
    paymentmethod: z.string().nullable(),
    ip: z.string().nullable(),
    ips: z.string().nullable(),
    datepayment: z.string().nullable()
});
export const PiecesCriteriaGroupSchema = z.object({
    cri_id: z.string().nullable(),
    cri_id_parent: z.string().nullable(),
    cri_id_successor: z.string().nullable(),
    cri_criteria: z.string().nullable(),
    cri_unit: z.string().nullable(),
    cri_type_1: z.string().nullable(),
    cri_type_2: z.string().nullable(),
    cri_display: z.string().nullable()
});
export const PiecesDetailsSchema = z.object({
    pd_piece_id: z.string().nullable(),
    pd_ref: z.string().nullable(),
    pd_ref_clean: z.string().nullable(),
    pd_pm_id: z.string().nullable(),
    pd_prb_id: z.string().nullable(),
    pd_pst_id: z.string().nullable(),
    pd_des_eng: z.string().nullable(),
    pd_weight_kgm: z.string().nullable(),
    pd_is_accessory: z.string().nullable(),
    pd_year: z.string().nullable(),
    has_oem: z.string().nullable(),
    has_img: z.string().nullable(),
    pd_display: z.string().nullable(),
    pd_pg_id: z.string().nullable()
});
export const PiecesGammeSchema = z.object({
    pg_id: z.string().nullable(),
    pg_parent: z.string().nullable(),
    pg_ppa_id: z.string().nullable(),
    pg_alias: z.string().nullable(),
    pg_name: z.string().nullable(),
    pg_name_url: z.string().nullable(),
    pg_name_meta: z.string().nullable(),
    pg_pic: z.string().nullable(),
    pg_img: z.string().nullable(),
    pg_wall: z.string().nullable(),
    pg_relfollow: z.string().nullable(),
    pg_sitemap: z.string().nullable(),
    pg_cross: z.string().nullable(),
    pg_level: z.string().nullable(),
    pg_display: z.string().nullable(),
    pg_top: z.string().nullable()
});
export const PiecesGammeCrossSchema = z.object({
    pgc_id: z.string().nullable(),
    pgc_pg_id: z.string().nullable(),
    pgc_pg_cross: z.string().nullable(),
    pgc_level: z.string().nullable(),
    pgc_display: z.string().nullable(),
    pgc_sort: z.string().nullable()
});
export const PiecesListSchema = z.object({
    pli_piece_id: z.string().nullable(),
    pli_quantity: z.string().nullable(),
    pli_piece_component: z.string().nullable(),
    pli_ga_id: z.string().nullable(),
    pli_sort: z.string().nullable()
});
export const PiecesRefBrandSchema = z.object({
    prb_id: z.string().nullable(),
    prb_name: z.string().nullable(),
    prb_is_sup: z.string().nullable(),
    prb_is_pc: z.string().nullable(),
    prb_is_cv: z.string().nullable(),
    prb_is_mtb: z.string().nullable(),
    prb_is_eng: z.string().nullable(),
    prb_display: z.string().nullable()
});
export const PiecesRefEanSchema = z.object({
    pre_piece_id: z.string().nullable(),
    pre_code_ean: z.string().nullable()
});
export const PiecesRefOemSchema = z.object({
    pro_piece_id: z.string().nullable(),
    pro_prb_id: z.string().nullable(),
    pro_oem: z.string().nullable(),
    pro_oem_serach: z.string().nullable(),
    pro_year: z.string().nullable()
});
export const PiecesRefSearchSchema = z.object({
    prs_piece_id: z.string().nullable(),
    prs_search: z.string().nullable(),
    prs_kind: z.string().nullable(),
    prs_ref: z.string().nullable(),
    prs_prb_id: z.string().nullable(),
    prs_year: z.string().nullable(),
    prs_piece_prime: z.string().nullable()
});
export const PiecesRelationCriteriaSchema = z.object({
    rcp_type_id: z.string().nullable(),
    rcp_piece_id: z.string().nullable(),
    rcp_pm_id: z.string().nullable(),
    rcp_pg_pid: z.string().nullable(),
    rcp_pg_id: z.string().nullable(),
    rcp_cri_id: z.string().nullable(),
    rcp_cri_value: z.string().nullable(),
    rcp_has_txt: z.string().nullable(),
    rcp_display: z.string().nullable(),
    rcp_sort: z.string().nullable()
});
export const PiecesRelationTypeSchema = z.object({
    rtp_type_id: z.string().nullable(),
    rtp_piece_id: z.string().nullable(),
    rtp_pm_id: z.string().nullable(),
    rtp_pg_id: z.string().nullable(),
    rtp_pg_pid: z.string().nullable(),
    rtp_ga_id: z.string().nullable(),
    rtp_psf_id: z.string().nullable(),
    rtp_inside: z.string().nullable()
});
export const PiecesSideFiltreSchema = z.object({
    psf_id: z.string().nullable(),
    psf_side: z.string().nullable(),
    psf_sort: z.string().nullable(),
    psf_display: z.string().nullable()
});
export const PiecesStatusSchema = z.object({
    pst_id: z.string().nullable(),
    pst_description: z.string().nullable(),
    pst_sort: z.string().nullable(),
    pst_display: z.string().nullable()
});
export const PromoCodesSchema = z.object({
    id: z.string().nullable(),
    code: z.string().nullable(),
    type: z.string().nullable(),
    value: z.string().nullable(),
    min_amount: z.string().nullable(),
    max_discount: z.string().nullable(),
    valid_from: z.string().nullable(),
    valid_until: z.string().nullable(),
    usage_limit: z.string().nullable(),
    usage_count: z.string().nullable(),
    active: z.string().nullable(),
    created_at: z.string().nullable(),
    updated_at: z.string().nullable(),
    created_by: z.string().nullable(),
    description: z.string().nullable(),
    min_items: z.string().nullable(),
    applicable_products: z.string().nullable(),
    applicable_categories: z.string().nullable(),
    customer_groups: z.string().nullable(),
    usage_limit_per_customer: z.string().nullable(),
    stackable: z.string().nullable()
});
export const ShippingRatesCacheSchema = z.object({
    id: z.string().nullable(),
    zip_code: z.string().nullable(),
    country: z.string().nullable(),
    zone: z.string().nullable(),
    weight_min: z.string().nullable(),
    weight_max: z.string().nullable(),
    rate: z.string().nullable(),
    method: z.string().nullable(),
    delivery_time: z.string().nullable(),
    cached_at: z.string().nullable(),
    expires_at: z.string().nullable()
});
export const UsersSchema = z.object({
    id: z.string().nullable(),
    email: z.string().nullable(),
    name: z.string().nullable(),
    password: z.string().nullable(),
    created_at: z.string().nullable(),
    updated_at: z.string().nullable()
});
export const VIndexUsageSchema = z.object({
    schemaname: z.string().nullable(),
    tablename: z.string().nullable(),
    indexname: z.string().nullable(),
    idx_scan: z.string().nullable(),
    idx_tup_read: z.string().nullable(),
    idx_tup_fetch: z.string().nullable(),
    index_size: z.string().nullable()
});
export const VTableHealthSchema = z.object({
    schemaname: z.string().nullable(),
    tablename: z.string().nullable(),
    total_size: z.string().nullable(),
    live_rows: z.string().nullable(),
    dead_rows: z.string().nullable(),
    dead_ratio: z.string().nullable(),
    last_vacuum: z.string().nullable(),
    last_autovacuum: z.string().nullable(),
    last_analyze: z.string().nullable()
});
export const ConfigSchema = z.object({
    cnf_id: z.string().nullable(),
    cnf_name: z.string().nullable(),
    cnf_logo: z.string().nullable(),
    cnf_domain: z.string().nullable(),
    cnf_slogan: z.string().nullable(),
    cnf_mf: z.string().nullable(),
    cnf_address: z.string().nullable(),
    cnf_lat: z.string().nullable(),
    cnf_lng: z.string().nullable(),
    cnf_mail: z.string().nullable(),
    cnf_phone: z.string().nullable(),
    cnf_phone_call: z.string().nullable(),
    cnf_group_name: z.string().nullable(),
    cnf_group_domain: z.string().nullable(),
    cnf_tva: z.string().nullable(),
    cnf_timber: z.string().nullable(),
    cnf_shipping: z.string().nullable(),
    cnf_fiscal_year: z.string().nullable(),
    cnf_fiscal_bl_from: z.string().nullable(),
    cnf_fiscal_inv_from: z.string().nullable(),
    cnf_owner_name: z.string().nullable(),
    cnf_owner_domain: z.string().nullable(),
    cnf_hr: z.string().nullable()
});
export const ConfigAdminSchema = z.object({
    cnfa_id: z.string().nullable(),
    cnfa_login: z.string().nullable(),
    cnfa_pswd: z.string().nullable(),
    cnfa_mail: z.string().nullable(),
    cnfa_keylog: z.string().nullable(),
    cnfa_level: z.string().nullable(),
    cnfa_job: z.string().nullable(),
    cnfa_name: z.string().nullable(),
    cnfa_fname: z.string().nullable(),
    cnfa_tel: z.string().nullable(),
    cnfa_activ: z.string().nullable()
});
export const ConfigIpSchema = z.object({
    cnfip_id: z.string().nullable(),
    cnfip_name: z.string().nullable(),
    cnfip_alias: z.string().nullable(),
    cnfip_value: z.string().nullable()
});
export const ConfigOldSchema = z.object({
    cnf_id: z.string().nullable(),
    cnf_name: z.string().nullable(),
    cnf_domain: z.string().nullable(),
    cnf_address: z.string().nullable(),
    cnf_mail: z.string().nullable(),
    cnf_phone: z.string().nullable(),
    cnf_phone_call: z.string().nullable(),
    cnf_hr: z.string().nullable(),
    cnf_group_name: z.string().nullable(),
    cnf_group_domain: z.string().nullable(),
    cnf_owner_name: z.string().nullable(),
    cnf_owner_domain: z.string().nullable()
});
export const FooterMenuSchema = z.object({
    fm_id: z.string().nullable(),
    fm_title: z.string().nullable(),
    fm_alias: z.string().nullable(),
    fm_level: z.string().nullable(),
    fm_relfollow: z.string().nullable()
});
export const HeaderMenuSchema = z.object({
    hm_id: z.string().nullable(),
    hm_name: z.string().nullable(),
    hm_alias: z.string().nullable(),
    hm_link: z.string().nullable(),
    hm_float: z.string().nullable(),
    hm_relfollow: z.string().nullable()
});
export const MetaTagsArianeSchema = z.object({
    mta_id: z.string().nullable(),
    mta_title: z.string().nullable(),
    mta_descrip: z.string().nullable(),
    mta_keywords: z.string().nullable(),
    mta_ariane: z.string().nullable(),
    mta_h1: z.string().nullable(),
    mta_content: z.string().nullable(),
    mta_alias: z.string().nullable(),
    mta_relfollow: z.string().nullable()
});
export const XtrCustomerSchema = z.object({
    cst_id: z.string().nullable(),
    cst_mail: z.string().nullable(),
    cst_pswd: z.string().nullable(),
    cst_keylog: z.string().nullable(),
    cst_civility: z.string().nullable(),
    cst_name: z.string().nullable(),
    cst_fname: z.string().nullable(),
    cst_address: z.string().nullable(),
    cst_zip_code: z.string().nullable(),
    cst_city: z.string().nullable(),
    cst_country: z.string().nullable(),
    cst_tel: z.string().nullable(),
    cst_gsm: z.string().nullable(),
    cst_is_cpy: z.string().nullable(),
    cst_rs: z.string().nullable(),
    cst_siret: z.string().nullable(),
    cst_is_pro: z.string().nullable(),
    cst_activ: z.string().nullable(),
    cst_level: z.string().nullable(),
    cst_password_changed_at: z.string().nullable()
});
export const XtrCustomerBillingAddressSchema = z.object({
    cba_id: z.string().nullable(),
    cba_cst_id: z.string().nullable(),
    cba_mail: z.string().nullable(),
    cba_civility: z.string().nullable(),
    cba_name: z.string().nullable(),
    cba_fname: z.string().nullable(),
    cba_address: z.string().nullable(),
    cba_zip_code: z.string().nullable(),
    cba_city: z.string().nullable(),
    cba_country: z.string().nullable(),
    cba_tel: z.string().nullable(),
    cba_gsm: z.string().nullable()
});
export const XtrCustomerDeliveryAddressSchema = z.object({
    cda_id: z.string().nullable(),
    cda_cst_id: z.string().nullable(),
    cda_mail: z.string().nullable(),
    cda_civility: z.string().nullable(),
    cda_name: z.string().nullable(),
    cda_fname: z.string().nullable(),
    cda_address: z.string().nullable(),
    cda_zip_code: z.string().nullable(),
    cda_city: z.string().nullable(),
    cda_country: z.string().nullable(),
    cda_tel: z.string().nullable(),
    cda_gsm: z.string().nullable()
});
export const XtrDeliveryAgentSchema = z.object({
    da_id: z.string().nullable(),
    da_name: z.string().nullable(),
    da_icon: z.string().nullable(),
    da_preview: z.string().nullable(),
    da_extern: z.string().nullable(),
    da_sql_table: z.string().nullable(),
    da_fee: z.string().nullable(),
    da_seuil: z.string().nullable(),
    da_fee_new: z.string().nullable()
});
export const XtrDeliveryApeCorseSchema = z.object({
    tpg_id: z.string().nullable(),
    tpg_min: z.string().nullable(),
    tpg_max: z.string().nullable(),
    tpg_frais_port_ht: z.string().nullable(),
    tpg_frais_port: z.string().nullable()
});
export const XtrDeliveryApeDomtom1Schema = z.object({
    tpg_id: z.string().nullable(),
    tpg_min: z.string().nullable(),
    tpg_max: z.string().nullable(),
    tpg_frais_port_ht: z.string().nullable(),
    tpg_frais_port: z.string().nullable()
});
export const XtrDeliveryApeDomtom2Schema = z.object({
    tpg_id: z.string().nullable(),
    tpg_min: z.string().nullable(),
    tpg_max: z.string().nullable(),
    tpg_frais_port_ht: z.string().nullable(),
    tpg_frais_port: z.string().nullable()
});
export const XtrDeliveryApeFranceSchema = z.object({
    tpg_id: z.string().nullable(),
    tpg_min: z.string().nullable(),
    tpg_max: z.string().nullable(),
    tpg_frais_port_ht: z.string().nullable(),
    tpg_frais_port: z.string().nullable(),
    tpg_frais_ajouter_50: z.string().nullable(),
    tpg_frais_ajouter: z.string().nullable()
});
export const XtrInvoiceSchema = z.object({
    inv_id: z.string().nullable(),
    inv_ord_id: z.string().nullable(),
    inv_cst_id: z.string().nullable(),
    inv_cba_id: z.string().nullable(),
    inv_cda_id: z.string().nullable(),
    inv_date: z.string().nullable(),
    inv_amount_ht: z.string().nullable(),
    inv_deposit_ht: z.string().nullable(),
    inv_shipping_fee_ht: z.string().nullable(),
    inv_total_ht: z.string().nullable(),
    inv_tva: z.string().nullable(),
    inv_amount_ttc: z.string().nullable(),
    inv_deposit_ttc: z.string().nullable(),
    inv_shipping_fee_ttc: z.string().nullable(),
    inv_total_ttc: z.string().nullable(),
    inv_da_id: z.string().nullable(),
    inv_info: z.string().nullable()
});
export const XtrInvoiceLineSchema = z.object({
    invl_id: z.string().nullable(),
    invl_inv_id: z.string().nullable(),
    invl_pg_id: z.string().nullable(),
    invl_pg_name: z.string().nullable(),
    invl_pm_id: z.string().nullable(),
    invl_pm_name: z.string().nullable(),
    invl_art_ref: z.string().nullable(),
    invl_art_ref_clean: z.string().nullable(),
    invl_art_price_sell_unit_ht: z.string().nullable(),
    invl_art_price_sell_unit_ttc: z.string().nullable(),
    invl_art_deposit_unit_ht: z.string().nullable(),
    invl_art_deposit_unit_ttc: z.string().nullable(),
    invl_art_quantity: z.string().nullable(),
    invl_art_price_sell_ht: z.string().nullable(),
    invl_art_price_sell_ttc: z.string().nullable(),
    invl_art_deposit_ht: z.string().nullable(),
    invl_art_deposit_ttc: z.string().nullable()
});
export const XtrMsgSchema = z.object({
    msg_id: z.string().nullable(),
    msg_cst_id: z.string().nullable(),
    msg_ord_id: z.string().nullable(),
    msg_orl_id: z.string().nullable(),
    msg_orl_equiv_id: z.string().nullable(),
    msg_cnfa_id: z.string().nullable(),
    msg_date: z.string().nullable(),
    msg_subject: z.string().nullable(),
    msg_content: z.string().nullable(),
    msg_parent_id: z.string().nullable(),
    msg_open: z.string().nullable(),
    msg_close: z.string().nullable()
});
export const XtrOrderSchema = z.object({
    ord_id: z.string().nullable(),
    ord_cst_id: z.string().nullable(),
    ord_cba_id: z.string().nullable(),
    ord_cda_id: z.string().nullable(),
    ord_date: z.string().nullable(),
    ord_amount_ht: z.string().nullable(),
    ord_deposit_ht: z.string().nullable(),
    ord_shipping_fee_ht: z.string().nullable(),
    ord_total_ht: z.string().nullable(),
    ord_tva: z.string().nullable(),
    ord_amount_ttc: z.string().nullable(),
    ord_deposit_ttc: z.string().nullable(),
    ord_shipping_fee_ttc: z.string().nullable(),
    ord_total_ttc: z.string().nullable(),
    ord_is_pay: z.string().nullable(),
    ord_date_pay: z.string().nullable(),
    ord_da_id: z.string().nullable(),
    ord_info: z.string().nullable(),
    ord_dept_id: z.string().nullable(),
    ord_ords_id: z.string().nullable(),
    ord_parent: z.string().nullable(),
    ord_link: z.string().nullable(),
    ord_link_type: z.string().nullable()
});
export const XtrOrderLineSchema = z.object({
    orl_id: z.string().nullable(),
    orl_ord_id: z.string().nullable(),
    orl_pg_id: z.string().nullable(),
    orl_pg_name: z.string().nullable(),
    orl_pm_id: z.string().nullable(),
    orl_pm_name: z.string().nullable(),
    orl_art_ref: z.string().nullable(),
    orl_art_ref_clean: z.string().nullable(),
    orl_art_price_buy_unit_public_ht: z.string().nullable(),
    orl_art_price_buy_unit_public_ttc: z.string().nullable(),
    orl_art_price_buy_discount: z.string().nullable(),
    orl_art_price_buy_unit_ht: z.string().nullable(),
    orl_art_price_buy_unit_ttc: z.string().nullable(),
    orl_art_price_sell_margin: z.string().nullable(),
    orl_art_price_sell_unit_ht: z.string().nullable(),
    orl_art_price_sell_unit_ttc: z.string().nullable(),
    orl_art_deposit_unit_ht: z.string().nullable(),
    orl_art_deposit_unit_ttc: z.string().nullable(),
    orl_art_quantity: z.string().nullable(),
    orl_art_price_buy_ht: z.string().nullable(),
    orl_art_price_buy_ttc: z.string().nullable(),
    orl_art_price_sell_ht: z.string().nullable(),
    orl_art_price_sell_ttc: z.string().nullable(),
    orl_art_deposit_ht: z.string().nullable(),
    orl_art_deposit_ttc: z.string().nullable(),
    orl_spl_id: z.string().nullable(),
    orl_spl_name: z.string().nullable(),
    orl_spl_date: z.string().nullable(),
    orl_spl_price_buy_unit_ht: z.string().nullable(),
    orl_spl_price_buy_unit_ttc: z.string().nullable(),
    orl_spl_price_buy_ht: z.string().nullable(),
    orl_spl_price_buy_ttc: z.string().nullable(),
    orl_website_url: z.string().nullable(),
    orl_orls_id: z.string().nullable(),
    orl_equiv_id: z.string().nullable()
});
export const XtrOrderLineEquivTicketSchema = z.object({
    orlet_id: z.string().nullable(),
    orlet_ord_id: z.string().nullable(),
    orlet_orl_id: z.string().nullable(),
    orlet_equiv_id: z.string().nullable(),
    orlet_amount_ttc: z.string().nullable()
});
export const XtrOrderLineStatusSchema = z.object({
    orls_id: z.string().nullable(),
    orls_name: z.string().nullable(),
    orls_action: z.string().nullable(),
    orls_color: z.string().nullable(),
    orls_dept_id: z.string().nullable()
});
export const XtrOrderStatusSchema = z.object({
    ords_id: z.string().nullable(),
    ords_named: z.string().nullable(),
    ords_action: z.string().nullable(),
    ords_color: z.string().nullable(),
    ords_dept_id: z.string().nullable()
});
export const XtrSupplierSchema = z.object({
    spl_id: z.string().nullable(),
    spl_name: z.string().nullable(),
    spl_alias: z.string().nullable(),
    spl_display: z.string().nullable(),
    spl_sort: z.string().nullable()
});
export const XtrSupplierLinkPmSchema = z.object({
    slpm_id: z.string().nullable(),
    slpm_pm_id: z.string().nullable(),
    slpm_spl_id: z.string().nullable(),
    slpm_display: z.string().nullable()
});
export const BlogAdviceSchema = z.object({
    ba_id: z.string().nullable(),
    ba_title: z.string().nullable(),
    ba_descrip: z.string().nullable(),
    ba_keywords: z.string().nullable(),
    ba_h1: z.string().nullable(),
    ba_alias: z.string().nullable(),
    ba_h2: z.string().nullable(),
    ba_preview: z.string().nullable(),
    ba_content: z.string().nullable(),
    ba_wall: z.string().nullable(),
    ba_create: z.string().nullable(),
    ba_update: z.string().nullable(),
    ba_pg_id: z.string().nullable(),
    ba_visit: z.string().nullable(),
    ba_cta_anchor: z.string().nullable(),
    ba_cta_link: z.string().nullable()
});
export const BlogAdviceCrossSchema = z.object({
    bac_id: z.string().nullable(),
    bac_ba_id: z.string().nullable(),
    bac_ba_id_cross: z.string().nullable()
});
export const BlogAdviceH2Schema = z.object({
    ba2_id: z.string().nullable(),
    ba2_h2: z.string().nullable(),
    ba2_content: z.string().nullable(),
    ba2_wall: z.string().nullable(),
    ba2_create: z.string().nullable(),
    ba2_update: z.string().nullable(),
    ba2_ba_id: z.string().nullable(),
    ba2_cta_anchor: z.string().nullable(),
    ba2_cta_link: z.string().nullable()
});
export const BlogAdviceH3Schema = z.object({
    ba3_id: z.string().nullable(),
    ba3_h3: z.string().nullable(),
    ba3_content: z.string().nullable(),
    ba3_wall: z.string().nullable(),
    ba3_create: z.string().nullable(),
    ba3_update: z.string().nullable(),
    ba3_ba2_id: z.string().nullable(),
    ba3_cta_anchor: z.string().nullable(),
    ba3_cta_link: z.string().nullable()
});
export const BlogGuideSchema = z.object({
    bg_id: z.string().nullable(),
    bg_title: z.string().nullable(),
    bg_descrip: z.string().nullable(),
    bg_keywords: z.string().nullable(),
    bg_h1: z.string().nullable(),
    bg_alias: z.string().nullable(),
    bg_h2: z.string().nullable(),
    bg_preview: z.string().nullable(),
    bg_content: z.string().nullable(),
    bg_wall: z.string().nullable(),
    bg_create: z.string().nullable(),
    bg_update: z.string().nullable(),
    bg_visit: z.string().nullable(),
    bg_cta_anchor: z.string().nullable(),
    bg_cta_link: z.string().nullable()
});
export const BlogGuideH2Schema = z.object({
    bg2_id: z.string().nullable(),
    bg2_h2: z.string().nullable(),
    bg2_content: z.string().nullable(),
    bg2_wall: z.string().nullable(),
    bg2_create: z.string().nullable(),
    bg2_update: z.string().nullable(),
    bg2_bg_id: z.string().nullable(),
    bg2_cta_anchor: z.string().nullable(),
    bg2_cta_link: z.string().nullable()
});
export const BlogGuideH3Schema = z.object({
    bg3_id: z.string().nullable(),
    bg3_h3: z.string().nullable(),
    bg3_content: z.string().nullable(),
    bg3_wall: z.string().nullable(),
    bg3_create: z.string().nullable(),
    bg3_update: z.string().nullable(),
    bg3_bg2_id: z.string().nullable(),
    bg3_cta_anchor: z.string().nullable(),
    bg3_cta_link: z.string().nullable()
});
export const BlogMetaTagsArianeSchema = z.object({
    mta_id: z.string().nullable(),
    mta_title: z.string().nullable(),
    mta_descrip: z.string().nullable(),
    mta_keywords: z.string().nullable(),
    mta_ariane: z.string().nullable(),
    mta_h1: z.string().nullable(),
    mta_content: z.string().nullable(),
    mta_alias: z.string().nullable(),
    mta_relfollow: z.string().nullable()
});
export const BlogSeoMarqueSchema = z.object({
    bsm_id: z.string().nullable(),
    bsm_title: z.string().nullable(),
    bsm_descrip: z.string().nullable(),
    bsm_keywords: z.string().nullable(),
    bsm_h1: z.string().nullable(),
    bsm_content: z.string().nullable(),
    bsm_marque_id: z.string().nullable()
});
export const CrossGammeCarSchema = z.object({
    cgc_id: z.string().nullable(),
    cgc_pg_id: z.string().nullable(),
    cgc_marque_id: z.string().nullable(),
    cgc_modele_id: z.string().nullable(),
    cgc_type_id: z.string().nullable(),
    cgc_level: z.string().nullable()
});
export const CrossGammeCarNewSchema = z.object({
    cgc_id: z.string().nullable(),
    cgc_pg_id: z.string().nullable(),
    cgc_marque_id: z.string().nullable(),
    cgc_mdg_id: z.string().nullable(),
    cgc_modele_id: z.string().nullable(),
    cgc_type_id: z.string().nullable(),
    cgc_level: z.string().nullable()
});
export const CrossGammeCarNew2Schema = z.object({
    cgc_id: z.string().nullable(),
    cgc_pg_id: z.string().nullable(),
    cgc_marque_id: z.string().nullable(),
    cgc_mdg_id: z.string().nullable(),
    cgc_modele_id: z.string().nullable(),
    cgc_type_id: z.string().nullable(),
    cgc_level: z.string().nullable()
});
export const SeoEquipGammeSchema = z.object({
    seg_id: z.string().nullable(),
    seg_content: z.string().nullable(),
    seg_pm_id: z.string().nullable(),
    seg_pg_id: z.string().nullable()
});
export const SeoFamilyGammeCarSwitchSchema = z.object({
    sfgcs_id: z.string().nullable(),
    sfgcs_content: z.string().nullable(),
    sfgcs_alias: z.string().nullable(),
    sfgcs_mf_id: z.string().nullable(),
    sfgcs_pg_id: z.string().nullable()
});
export const SeoGammeSchema = z.object({
    sg_id: z.string().nullable(),
    sg_title: z.string().nullable(),
    sg_descrip: z.string().nullable(),
    sg_keywords: z.string().nullable(),
    sg_h1: z.string().nullable(),
    sg_content: z.string().nullable(),
    sg_pg_id: z.string().nullable()
});
export const SeoGammeCarSchema = z.object({
    sgc_id: z.string().nullable(),
    sgc_title: z.string().nullable(),
    sgc_descrip: z.string().nullable(),
    sgc_h1: z.string().nullable(),
    sgc_preview: z.string().nullable(),
    sgc_content: z.string().nullable(),
    sgc_pg_id: z.string().nullable()
});
export const SeoGammeConseilSchema = z.object({
    sgc_id: z.string().nullable(),
    sgc_title: z.string().nullable(),
    sgc_content: z.string().nullable(),
    sgc_pg_id: z.string().nullable()
});
export const SeoGammeInfoSchema = z.object({
    sgi_id: z.string().nullable(),
    sgi_content: z.string().nullable(),
    sgi_pg_id: z.string().nullable()
});
export const SeoItemSwitchSchema = z.object({
    sis_id: z.string().nullable(),
    sis_content: z.string().nullable(),
    sis_alias: z.string().nullable(),
    sis_pg_id: z.string().nullable()
});
export const SeoMarqueSchema = z.object({
    sm_id: z.string().nullable(),
    sm_title: z.string().nullable(),
    sm_descrip: z.string().nullable(),
    sm_keywords: z.string().nullable(),
    sm_h1: z.string().nullable(),
    sm_content: z.string().nullable(),
    sm_marque_id: z.string().nullable()
});
export const SeoTypeSwitchSchema = z.object({
    sts_id: z.string().nullable(),
    sts_content: z.string().nullable(),
    sts_alias: z.string().nullable()
});
export const SitemapBlogSchema = z.object({
    map_id: z.string().nullable(),
    map_alias: z.string().nullable(),
    map_date: z.string().nullable()
});
export const SitemapMarqueSchema = z.object({
    map_id: z.string().nullable(),
    map_marque_alias: z.string().nullable(),
    map_marque_id: z.string().nullable()
});
export const SitemapMotorisationSchema = z.object({
    map_id: z.string().nullable(),
    map_marque_alias: z.string().nullable(),
    map_marque_id: z.string().nullable(),
    map_modele_alias: z.string().nullable(),
    map_modele_id: z.string().nullable(),
    map_type_alias: z.string().nullable(),
    map_type_id: z.string().nullable()
});
export const SitemapPLinkSchema = z.object({
    map_id: z.string().nullable(),
    map_pg_alias: z.string().nullable(),
    map_pg_id: z.string().nullable(),
    map_marque_alias: z.string().nullable(),
    map_marque_id: z.string().nullable(),
    map_modele_alias: z.string().nullable(),
    map_modele_id: z.string().nullable(),
    map_type_alias: z.string().nullable(),
    map_type_id: z.string().nullable(),
    map_has_item: z.string().nullable()
});
export const SitemapPXmlSchema = z.object({
    map_id: z.string().nullable(),
    map_pg_id: z.string().nullable(),
    map_marque_id: z.string().nullable(),
    map_file: z.string().nullable(),
    map_has_link: z.string().nullable()
});
export const SitemapSearchLinkSchema = z.object({
    map_id: z.string().nullable(),
    map_pg_alias: z.string().nullable(),
    map_pg_id: z.string().nullable(),
    map_marque_alias: z.string().nullable(),
    map_marque_id: z.string().nullable(),
    map_modele_alias: z.string().nullable(),
    map_modele_id: z.string().nullable(),
    map_type_alias: z.string().nullable(),
    map_type_id: z.string().nullable()
});
export const DatabaseSchema = z.object({
    ___config: z.unknown(),
    ___config_admin: z.unknown(),
    ___config_ip: z.unknown(),
    ___config_old: z.unknown(),
    ___footer_menu: z.unknown(),
    ___header_menu: z.unknown(),
    ___meta_tags_ariane: z.unknown(),
    ___xtr_customer: z.unknown(),
    ___xtr_customer_billing_address: z.unknown(),
    ___xtr_customer_delivery_address: z.unknown(),
    ___xtr_delivery_agent: z.unknown(),
    ___xtr_delivery_ape_corse: z.unknown(),
    ___xtr_delivery_ape_domtom1: z.unknown(),
    ___xtr_delivery_ape_domtom2: z.unknown(),
    ___xtr_delivery_ape_france: z.unknown(),
    ___xtr_invoice: z.unknown(),
    ___xtr_invoice_line: z.unknown(),
    ___xtr_msg: z.unknown(),
    ___xtr_order: z.unknown(),
    ___xtr_order_line: z.unknown(),
    ___xtr_order_line_equiv_ticket: z.unknown(),
    ___xtr_order_line_status: z.unknown(),
    ___xtr_order_status: z.unknown(),
    ___xtr_supplier: z.unknown(),
    ___xtr_supplier_link_pm: z.unknown(),
    __blog_advice: z.unknown(),
    __blog_advice_cross: z.unknown(),
    __blog_advice_h2: z.unknown(),
    __blog_advice_h3: z.unknown(),
    __blog_advice_old: z.unknown(),
    __blog_guide: z.unknown(),
    __blog_guide_h2: z.unknown(),
    __blog_guide_h3: z.unknown(),
    __blog_meta_tags_ariane: z.unknown(),
    __blog_seo_marque: z.unknown(),
    __cross_gamme_car: z.unknown(),
    __cross_gamme_car_new: z.unknown(),
    __cross_gamme_car_new2: z.unknown(),
    __seo_equip_gamme: z.unknown(),
    __seo_family_gamme_car_switch: z.unknown(),
    __seo_gamme: z.unknown(),
    __seo_gamme_car: z.unknown(),
    __seo_gamme_car_switch: z.unknown(),
    __seo_gamme_conseil: z.unknown(),
    __seo_gamme_info: z.unknown(),
    __seo_item_switch: z.unknown(),
    __seo_marque: z.unknown(),
    __seo_type_switch: z.unknown(),
    __sitemap_blog: z.unknown(),
    __sitemap_gamme: z.unknown(),
    __sitemap_marque: z.unknown(),
    __sitemap_motorisation: z.unknown(),
    __sitemap_p_link: z.unknown(),
    __sitemap_p_xml: z.unknown(),
    __sitemap_search_link: z.unknown(),
    am_2022_suppliers: z.unknown(),
    auto_marque: z.unknown(),
    auto_modele: z.unknown(),
    auto_modele_group: z.unknown(),
    auto_modele_robot: z.unknown(),
    auto_type: z.unknown(),
    auto_type_motor_code: z.unknown(),
    auto_type_motor_fuel: z.unknown(),
    auto_type_number_code: z.unknown(),
    cars_engine: z.unknown(),
    catalog_family: z.unknown(),
    catalog_gamme: z.unknown(),
    categories: z.unknown(),
    ic_postback: z.unknown(),
    password_resets: z.unknown(),
    pieces: z.unknown(),
    pieces_criteria: z.unknown(),
    pieces_criteria_group: z.unknown(),
    pieces_criteria_link: z.unknown(),
    pieces_details: z.unknown(),
    pieces_gamme: z.unknown(),
    pieces_gamme_cross: z.unknown(),
    pieces_list: z.unknown(),
    pieces_marque: z.unknown(),
    pieces_media_img: z.unknown(),
    pieces_price: z.unknown(),
    pieces_ref_brand: z.unknown(),
    pieces_ref_ean: z.unknown(),
    pieces_ref_oem: z.unknown(),
    pieces_ref_search: z.unknown(),
    pieces_relation_criteria: z.unknown(),
    pieces_relation_type: z.unknown(),
    pieces_side_filtre: z.unknown(),
    pieces_status: z.unknown(),
    products: z.unknown(),
    promo_codes: z.unknown(),
    promo_usage: z.unknown(),
    sessions: z.unknown(),
    shipping_rates_cache: z.unknown(),
    users: z.unknown(),
    v_index_usage: z.unknown(),
    v_table_health: z.unknown()
});
export const PiecesSchemas = {
    Pieces: PiecesSchema,
    PiecesPrice: PiecesPriceSchema,
    PiecesMarque: PiecesMarqueSchema,
    PiecesMediaImg: PiecesMediaImgSchema,
    PiecesCriteria: PiecesCriteriaSchema,
    PiecesCriteriaLink: PiecesCriteriaLinkSchema,
};
export const AutoSchemas = {
    AutoMarque: AutoMarqueSchema,
    AutoModele: AutoModeleSchema,
    AutoType: AutoTypeSchema,
};
export const AllSchemas = {
    ...PiecesSchemas,
    ...AutoSchemas,
};
//# sourceMappingURL=schemas.js.map