export declare const TABLES: {
    readonly pieces: "pieces";
    readonly pieces_price: "pieces_price";
    readonly pieces_marque: "pieces_marque";
    readonly pieces_media_img: "pieces_media_img";
    readonly pieces_criteria: "pieces_criteria";
    readonly pieces_criteria_link: "pieces_criteria_link";
    readonly pieces_criteria_group: "pieces_criteria_group";
    readonly pieces_relation_type: "pieces_relation_type";
    readonly config: "___config";
    readonly config_admin: "___config_admin";
    readonly config_ip: "___config_ip";
    readonly config_old: "___config_old";
    readonly footer_menu: "___footer_menu";
    readonly header_menu: "___header_menu";
    readonly meta_tags_ariane: "___meta_tags_ariane";
    readonly xtr_customer: "___xtr_customer";
    readonly xtr_customer_billing_address: "___xtr_customer_billing_address";
    readonly xtr_customer_delivery_address: "___xtr_customer_delivery_address";
    readonly xtr_delivery_agent: "___xtr_delivery_agent";
    readonly xtr_delivery_ape_corse: "___xtr_delivery_ape_corse";
    readonly xtr_delivery_ape_domtom1: "___xtr_delivery_ape_domtom1";
    readonly xtr_delivery_ape_domtom2: "___xtr_delivery_ape_domtom2";
    readonly xtr_delivery_ape_france: "___xtr_delivery_ape_france";
    readonly xtr_invoice: "___xtr_invoice";
    readonly xtr_invoice_line: "___xtr_invoice_line";
    readonly xtr_msg: "___xtr_msg";
    readonly xtr_order: "___xtr_order";
    readonly xtr_order_line: "___xtr_order_line";
    readonly xtr_order_line_equiv_ticket: "___xtr_order_line_equiv_ticket";
    readonly xtr_order_line_status: "___xtr_order_line_status";
    readonly xtr_order_status: "___xtr_order_status";
    readonly xtr_supplier: "___xtr_supplier";
    readonly xtr_supplier_link_pm: "___xtr_supplier_link_pm";
    readonly pieces_relation_criteria: "pieces_relation_criteria";
    readonly pieces_side_filtre: "pieces_side_filtre";
    readonly pieces_gamme: "pieces_gamme";
    readonly pieces_gamme_cross: "pieces_gamme_cross";
    readonly pieces_list: "pieces_list";
    readonly pieces_details: "pieces_details";
    readonly pieces_ref_brand: "pieces_ref_brand";
    readonly pieces_ref_ean: "pieces_ref_ean";
    readonly pieces_ref_oem: "pieces_ref_oem";
    readonly pieces_ref_search: "pieces_ref_search";
    readonly pieces_status: "pieces_status";
    readonly auto_marque: "auto_marque";
    readonly auto_modele: "auto_modele";
    readonly auto_modele_group: "auto_modele_group";
    readonly auto_type: "auto_type";
    readonly auto_type_motor_code: "auto_type_motor_code";
    readonly auto_type_motor_fuel: "auto_type_motor_fuel";
    readonly auto_type_number_code: "auto_type_number_code";
    readonly catalog_family: "catalog_family";
    readonly catalog_gamme: "catalog_gamme";
    readonly password_resets: "password_resets";
    readonly sessions: "sessions";
    readonly blog_advice: "__blog_advice";
    readonly blog_advice_h2: "__blog_advice_h2";
    readonly blog_advice_h3: "__blog_advice_h3";
    readonly blog_advice_cross: "__blog_advice_cross";
    readonly blog_guide: "__blog_guide";
    readonly blog_guide_h2: "__blog_guide_h2";
    readonly blog_guide_h3: "__blog_guide_h3";
    readonly blog_seo_marque: "__blog_seo_marque";
    readonly blog_meta_tags_ariane: "__blog_meta_tags_ariane";
    readonly seo_gamme: "__seo_gamme";
    readonly seo_gamme_car: "__seo_gamme_car";
    readonly seo_gamme_car_switch: "__seo_gamme_car_switch";
    readonly seo_item_switch: "__seo_item_switch";
    readonly seo_marque: "__seo_marque";
    readonly seo_equip_gamme: "__seo_equip_gamme";
    readonly seo_family_gamme_car_switch: "__seo_family_gamme_car_switch";
    readonly sitemap_p_link: "__sitemap_p_link";
    readonly promo_codes: "promo_codes";
    readonly quantity_discounts: "quantity_discounts";
    readonly shipping_rates_cache: "shipping_rates_cache";
    readonly users: "users";
    readonly products: "products";
};
export declare const COLUMNS: {
    readonly pieces: {
        readonly id: "piece_id";
        readonly ref: "piece_ref";
        readonly ref_clean: "piece_ref_clean";
        readonly name: "piece_name";
        readonly name_comp: "piece_name_comp";
        readonly name_side: "piece_name_side";
        readonly description: "piece_des";
        readonly pm_id: "piece_pm_id";
        readonly pg_id: "piece_pg_id";
        readonly weight: "piece_weight_kgm";
        readonly qty_sale: "piece_qty_sale";
        readonly has_img: "piece_has_img";
        readonly has_oem: "piece_has_oem";
        readonly display: "piece_display";
    };
    readonly pieces_price: {
        readonly piece_id: "pri_piece_id";
        readonly pm_id: "pri_pm_id";
        readonly vente_ttc: "pri_vente_ttc";
        readonly consigne_ttc: "pri_consigne_ttc";
        readonly dispo: "pri_dispo";
        readonly type: "pri_type";
        readonly ean: "pri_ean";
        readonly ref: "pri_ref";
    };
    readonly pieces_marque: {
        readonly id: "pm_id";
        readonly name: "pm_name";
        readonly alias: "pm_alias";
        readonly logo: "pm_logo";
        readonly quality: "pm_quality";
        readonly oes: "pm_oes";
        readonly nb_stars: "pm_nb_stars";
        readonly display: "pm_display";
    };
    readonly pieces_media_img: {
        readonly piece_id: "pmi_piece_id";
        readonly pm_id: "pmi_pm_id";
        readonly folder: "pmi_folder";
        readonly name: "pmi_name";
        readonly sort: "pmi_sort";
        readonly display: "pmi_display";
    };
    readonly pieces_criteria: {
        readonly piece_id: "pc_piece_id";
        readonly cri_id: "pc_cri_id";
        readonly cri_value: "pc_cri_value";
        readonly display: "pc_display";
    };
    readonly pieces_criteria_link: {
        readonly cri_id: "pcl_cri_id";
        readonly criteria: "pcl_cri_criteria";
        readonly unit: "pcl_cri_unit";
        readonly level: "pcl_level";
        readonly display: "pcl_display";
    };
    readonly pieces_relation_type: {
        readonly type_id: "rtp_type_id";
        readonly piece_id: "rtp_piece_id";
        readonly pm_id: "rtp_pm_id";
        readonly pg_id: "rtp_pg_id";
        readonly psf_id: "rtp_psf_id";
    };
    readonly auto_marque: {
        readonly id: "marque_id";
        readonly name: "marque_name";
        readonly alias: "marque_alias";
        readonly logo: "marque_logo";
        readonly display: "marque_display";
    };
    readonly auto_modele: {
        readonly id: "modele_id";
        readonly name: "modele_name";
        readonly alias: "modele_alias";
        readonly marque_id: "modele_marque_id";
        readonly pic: "modele_pic";
        readonly display: "modele_display";
    };
    readonly auto_type: {
        readonly id: "type_id";
        readonly name: "type_name";
        readonly alias: "type_alias";
        readonly modele_id: "type_modele_id";
        readonly marque_id: "type_marque_id";
        readonly engine: "type_engine";
        readonly fuel: "type_fuel";
        readonly power_ps: "type_power_ps";
        readonly display: "type_display";
    };
};
export declare const DEFAULT_VALUES: {
    readonly display: {
        readonly active: "1";
        readonly inactive: "0";
    };
    readonly dispo: {
        readonly available: 1;
        readonly unavailable: 0;
    };
    readonly quality: {
        readonly oes: "OES";
        readonly premium: "A";
    };
};
export declare const LEVELS: {
    readonly CGC: {
        readonly GAMME_PAGE: "1";
        readonly BRAND_PAGE: "2";
        readonly VEHICLE_PAGE: "3";
        readonly BLOG: "5";
    };
    readonly PCL: {
        readonly CRITICAL: "1";
        readonly SECONDARY: "2";
    };
    readonly PG: {
        readonly MAIN: "1";
        readonly SUB: "2";
    };
    readonly FM: {
        readonly POLICIES: "1";
        readonly LEGAL: "2";
    };
};
export declare const CGC_LEVEL_CONFIG: {
    readonly "1": {
        readonly description: "Motorisations les plus consultées";
        readonly displayContext: "grid";
        readonly priority: "high";
        readonly limit: 20;
        readonly showOnPage: "gamme";
        readonly section: "motorisations_enriched";
    };
    readonly "2": {
        readonly description: "Véhicules populaires de la marque";
        readonly displayContext: "grid";
        readonly priority: "medium";
        readonly limit: 50;
        readonly showOnPage: "marque";
        readonly section: "motorisations_brand";
    };
    readonly "3": {
        readonly description: "Toutes les gammes compatibles";
        readonly displayContext: "grid";
        readonly priority: "low";
        readonly limit: 48;
        readonly showOnPage: "type";
        readonly section: "gammes_compatibles";
    };
    readonly "5": {
        readonly description: "Véhicules cités dans le blog/guide";
        readonly displayContext: "blog";
        readonly priority: "medium";
        readonly limit: 10;
        readonly showOnPage: "gamme";
        readonly section: "motorisations_blog";
    };
};
export declare const PCL_LEVEL_CONFIG: {
    readonly listing: {
        readonly maxCriteria: 3;
        readonly levels: readonly ["1", "2"];
        readonly description: "Aperçu rapide sur listing produits";
    };
    readonly detail: {
        readonly maxCriteria: number;
        readonly levels: readonly ["1", "2"];
        readonly description: "Affichage complet sur fiche détaillée";
    };
};
export type CgcLevel = typeof LEVELS.CGC[keyof typeof LEVELS.CGC];
export type PclLevel = typeof LEVELS.PCL[keyof typeof LEVELS.PCL];
export type PgLevel = typeof LEVELS.PG[keyof typeof LEVELS.PG];
export type FmLevel = typeof LEVELS.FM[keyof typeof LEVELS.FM];
export type TableNames = typeof TABLES;
export type ColumnNames = typeof COLUMNS;
//# sourceMappingURL=constants.d.ts.map