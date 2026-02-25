export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      ___config: {
        Row: {
          cnf_address: string | null
          cnf_domain: string | null
          cnf_fiscal_bl_from: string | null
          cnf_fiscal_inv_from: string | null
          cnf_fiscal_year: string | null
          cnf_group_domain: string | null
          cnf_group_name: string | null
          cnf_hr: string | null
          cnf_id: string
          cnf_lat: string | null
          cnf_lng: string | null
          cnf_logo: string | null
          cnf_mail: string | null
          cnf_mf: string | null
          cnf_name: string | null
          cnf_owner_domain: string | null
          cnf_owner_name: string | null
          cnf_phone: string | null
          cnf_phone_call: string | null
          cnf_shipping: string | null
          cnf_slogan: string | null
          cnf_timber: string | null
          cnf_tva: string | null
        }
        Insert: {
          cnf_address?: string | null
          cnf_domain?: string | null
          cnf_fiscal_bl_from?: string | null
          cnf_fiscal_inv_from?: string | null
          cnf_fiscal_year?: string | null
          cnf_group_domain?: string | null
          cnf_group_name?: string | null
          cnf_hr?: string | null
          cnf_id: string
          cnf_lat?: string | null
          cnf_lng?: string | null
          cnf_logo?: string | null
          cnf_mail?: string | null
          cnf_mf?: string | null
          cnf_name?: string | null
          cnf_owner_domain?: string | null
          cnf_owner_name?: string | null
          cnf_phone?: string | null
          cnf_phone_call?: string | null
          cnf_shipping?: string | null
          cnf_slogan?: string | null
          cnf_timber?: string | null
          cnf_tva?: string | null
        }
        Update: {
          cnf_address?: string | null
          cnf_domain?: string | null
          cnf_fiscal_bl_from?: string | null
          cnf_fiscal_inv_from?: string | null
          cnf_fiscal_year?: string | null
          cnf_group_domain?: string | null
          cnf_group_name?: string | null
          cnf_hr?: string | null
          cnf_id?: string
          cnf_lat?: string | null
          cnf_lng?: string | null
          cnf_logo?: string | null
          cnf_mail?: string | null
          cnf_mf?: string | null
          cnf_name?: string | null
          cnf_owner_domain?: string | null
          cnf_owner_name?: string | null
          cnf_phone?: string | null
          cnf_phone_call?: string | null
          cnf_shipping?: string | null
          cnf_slogan?: string | null
          cnf_timber?: string | null
          cnf_tva?: string | null
        }
        Relationships: []
      }
      ___config_admin: {
        Row: {
          cnfa_activ: string | null
          cnfa_fname: string | null
          cnfa_id: string
          cnfa_job: string | null
          cnfa_keylog: string | null
          cnfa_level: string | null
          cnfa_login: string | null
          cnfa_mail: string | null
          cnfa_name: string | null
          cnfa_pswd: string | null
          cnfa_tel: string | null
        }
        Insert: {
          cnfa_activ?: string | null
          cnfa_fname?: string | null
          cnfa_id: string
          cnfa_job?: string | null
          cnfa_keylog?: string | null
          cnfa_level?: string | null
          cnfa_login?: string | null
          cnfa_mail?: string | null
          cnfa_name?: string | null
          cnfa_pswd?: string | null
          cnfa_tel?: string | null
        }
        Update: {
          cnfa_activ?: string | null
          cnfa_fname?: string | null
          cnfa_id?: string
          cnfa_job?: string | null
          cnfa_keylog?: string | null
          cnfa_level?: string | null
          cnfa_login?: string | null
          cnfa_mail?: string | null
          cnfa_name?: string | null
          cnfa_pswd?: string | null
          cnfa_tel?: string | null
        }
        Relationships: []
      }
      ___config_ip: {
        Row: {
          cnfip_alias: string | null
          cnfip_id: string
          cnfip_name: string | null
          cnfip_value: string | null
        }
        Insert: {
          cnfip_alias?: string | null
          cnfip_id: string
          cnfip_name?: string | null
          cnfip_value?: string | null
        }
        Update: {
          cnfip_alias?: string | null
          cnfip_id?: string
          cnfip_name?: string | null
          cnfip_value?: string | null
        }
        Relationships: []
      }
      ___config_old: {
        Row: {
          cnf_address: string | null
          cnf_domain: string | null
          cnf_group_domain: string | null
          cnf_group_name: string | null
          cnf_hr: string | null
          cnf_id: string
          cnf_mail: string | null
          cnf_name: string | null
          cnf_owner_domain: string | null
          cnf_owner_name: string | null
          cnf_phone: string | null
          cnf_phone_call: string | null
        }
        Insert: {
          cnf_address?: string | null
          cnf_domain?: string | null
          cnf_group_domain?: string | null
          cnf_group_name?: string | null
          cnf_hr?: string | null
          cnf_id: string
          cnf_mail?: string | null
          cnf_name?: string | null
          cnf_owner_domain?: string | null
          cnf_owner_name?: string | null
          cnf_phone?: string | null
          cnf_phone_call?: string | null
        }
        Update: {
          cnf_address?: string | null
          cnf_domain?: string | null
          cnf_group_domain?: string | null
          cnf_group_name?: string | null
          cnf_hr?: string | null
          cnf_id?: string
          cnf_mail?: string | null
          cnf_name?: string | null
          cnf_owner_domain?: string | null
          cnf_owner_name?: string | null
          cnf_phone?: string | null
          cnf_phone_call?: string | null
        }
        Relationships: []
      }
      ___footer_menu: {
        Row: {
          fm_alias: string | null
          fm_id: string
          fm_level: string | null
          fm_relfollow: string | null
          fm_title: string | null
        }
        Insert: {
          fm_alias?: string | null
          fm_id: string
          fm_level?: string | null
          fm_relfollow?: string | null
          fm_title?: string | null
        }
        Update: {
          fm_alias?: string | null
          fm_id?: string
          fm_level?: string | null
          fm_relfollow?: string | null
          fm_title?: string | null
        }
        Relationships: []
      }
      ___header_menu: {
        Row: {
          hm_alias: string | null
          hm_float: string | null
          hm_id: string
          hm_link: string | null
          hm_name: string | null
          hm_relfollow: string | null
        }
        Insert: {
          hm_alias?: string | null
          hm_float?: string | null
          hm_id: string
          hm_link?: string | null
          hm_name?: string | null
          hm_relfollow?: string | null
        }
        Update: {
          hm_alias?: string | null
          hm_float?: string | null
          hm_id?: string
          hm_link?: string | null
          hm_name?: string | null
          hm_relfollow?: string | null
        }
        Relationships: []
      }
      ___legal_pages: {
        Row: {
          alias: string
          breadcrumb: string | null
          content: string
          created_at: string | null
          description: string | null
          effective_date: string | null
          h1: string | null
          id: number
          indexable: boolean | null
          keywords: string | null
          title: string
          updated_at: string | null
          version: number | null
        }
        Insert: {
          alias: string
          breadcrumb?: string | null
          content: string
          created_at?: string | null
          description?: string | null
          effective_date?: string | null
          h1?: string | null
          id?: number
          indexable?: boolean | null
          keywords?: string | null
          title: string
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          alias?: string
          breadcrumb?: string | null
          content?: string
          created_at?: string | null
          description?: string | null
          effective_date?: string | null
          h1?: string | null
          id?: number
          indexable?: boolean | null
          keywords?: string | null
          title?: string
          updated_at?: string | null
          version?: number | null
        }
        Relationships: []
      }
      ___meta_tags_ariane: {
        Row: {
          mta_alias: string | null
          mta_ariane: string | null
          mta_content: string | null
          mta_descrip: string | null
          mta_h1: string | null
          mta_id: string
          mta_keywords: string | null
          mta_relfollow: string | null
          mta_title: string | null
        }
        Insert: {
          mta_alias?: string | null
          mta_ariane?: string | null
          mta_content?: string | null
          mta_descrip?: string | null
          mta_h1?: string | null
          mta_id: string
          mta_keywords?: string | null
          mta_relfollow?: string | null
          mta_title?: string | null
        }
        Update: {
          mta_alias?: string | null
          mta_ariane?: string | null
          mta_content?: string | null
          mta_descrip?: string | null
          mta_h1?: string | null
          mta_id?: string
          mta_keywords?: string | null
          mta_relfollow?: string | null
          mta_title?: string | null
        }
        Relationships: []
      }
      ___xtr_customer: {
        Row: {
          cst_activ: string | null
          cst_address: string | null
          cst_city: string | null
          cst_civility: string | null
          cst_country: string | null
          cst_fname: string | null
          cst_gsm: string | null
          cst_id: string
          cst_is_cpy: string | null
          cst_is_pro: string | null
          cst_keylog: string | null
          cst_level: string | null
          cst_mail: string | null
          cst_name: string | null
          cst_password_changed_at: string | null
          cst_pswd: string | null
          cst_rs: string | null
          cst_siret: string | null
          cst_tel: string | null
          cst_zip_code: string | null
        }
        Insert: {
          cst_activ?: string | null
          cst_address?: string | null
          cst_city?: string | null
          cst_civility?: string | null
          cst_country?: string | null
          cst_fname?: string | null
          cst_gsm?: string | null
          cst_id: string
          cst_is_cpy?: string | null
          cst_is_pro?: string | null
          cst_keylog?: string | null
          cst_level?: string | null
          cst_mail?: string | null
          cst_name?: string | null
          cst_password_changed_at?: string | null
          cst_pswd?: string | null
          cst_rs?: string | null
          cst_siret?: string | null
          cst_tel?: string | null
          cst_zip_code?: string | null
        }
        Update: {
          cst_activ?: string | null
          cst_address?: string | null
          cst_city?: string | null
          cst_civility?: string | null
          cst_country?: string | null
          cst_fname?: string | null
          cst_gsm?: string | null
          cst_id?: string
          cst_is_cpy?: string | null
          cst_is_pro?: string | null
          cst_keylog?: string | null
          cst_level?: string | null
          cst_mail?: string | null
          cst_name?: string | null
          cst_password_changed_at?: string | null
          cst_pswd?: string | null
          cst_rs?: string | null
          cst_siret?: string | null
          cst_tel?: string | null
          cst_zip_code?: string | null
        }
        Relationships: []
      }
      ___xtr_customer_billing_address: {
        Row: {
          cba_address: string | null
          cba_city: string | null
          cba_civility: string | null
          cba_country: string | null
          cba_cst_id: string | null
          cba_fname: string | null
          cba_gsm: string | null
          cba_id: string
          cba_mail: string | null
          cba_name: string | null
          cba_tel: string | null
          cba_zip_code: string | null
        }
        Insert: {
          cba_address?: string | null
          cba_city?: string | null
          cba_civility?: string | null
          cba_country?: string | null
          cba_cst_id?: string | null
          cba_fname?: string | null
          cba_gsm?: string | null
          cba_id: string
          cba_mail?: string | null
          cba_name?: string | null
          cba_tel?: string | null
          cba_zip_code?: string | null
        }
        Update: {
          cba_address?: string | null
          cba_city?: string | null
          cba_civility?: string | null
          cba_country?: string | null
          cba_cst_id?: string | null
          cba_fname?: string | null
          cba_gsm?: string | null
          cba_id?: string
          cba_mail?: string | null
          cba_name?: string | null
          cba_tel?: string | null
          cba_zip_code?: string | null
        }
        Relationships: []
      }
      ___xtr_customer_delivery_address: {
        Row: {
          cda_address: string | null
          cda_city: string | null
          cda_civility: string | null
          cda_country: string | null
          cda_cst_id: string | null
          cda_fname: string | null
          cda_gsm: string | null
          cda_id: string
          cda_mail: string | null
          cda_name: string | null
          cda_tel: string | null
          cda_zip_code: string | null
        }
        Insert: {
          cda_address?: string | null
          cda_city?: string | null
          cda_civility?: string | null
          cda_country?: string | null
          cda_cst_id?: string | null
          cda_fname?: string | null
          cda_gsm?: string | null
          cda_id: string
          cda_mail?: string | null
          cda_name?: string | null
          cda_tel?: string | null
          cda_zip_code?: string | null
        }
        Update: {
          cda_address?: string | null
          cda_city?: string | null
          cda_civility?: string | null
          cda_country?: string | null
          cda_cst_id?: string | null
          cda_fname?: string | null
          cda_gsm?: string | null
          cda_id?: string
          cda_mail?: string | null
          cda_name?: string | null
          cda_tel?: string | null
          cda_zip_code?: string | null
        }
        Relationships: []
      }
      ___xtr_delivery_agent: {
        Row: {
          da_extern: string | null
          da_fee: string | null
          da_fee_new: string | null
          da_icon: string | null
          da_id: string
          da_name: string | null
          da_preview: string | null
          da_seuil: string | null
          da_sql_table: string | null
        }
        Insert: {
          da_extern?: string | null
          da_fee?: string | null
          da_fee_new?: string | null
          da_icon?: string | null
          da_id: string
          da_name?: string | null
          da_preview?: string | null
          da_seuil?: string | null
          da_sql_table?: string | null
        }
        Update: {
          da_extern?: string | null
          da_fee?: string | null
          da_fee_new?: string | null
          da_icon?: string | null
          da_id?: string
          da_name?: string | null
          da_preview?: string | null
          da_seuil?: string | null
          da_sql_table?: string | null
        }
        Relationships: []
      }
      ___xtr_delivery_ape_corse: {
        Row: {
          tpg_frais_port: string | null
          tpg_frais_port_ht: string | null
          tpg_id: string
          tpg_max: string | null
          tpg_min: string | null
        }
        Insert: {
          tpg_frais_port?: string | null
          tpg_frais_port_ht?: string | null
          tpg_id: string
          tpg_max?: string | null
          tpg_min?: string | null
        }
        Update: {
          tpg_frais_port?: string | null
          tpg_frais_port_ht?: string | null
          tpg_id?: string
          tpg_max?: string | null
          tpg_min?: string | null
        }
        Relationships: []
      }
      ___xtr_delivery_ape_domtom1: {
        Row: {
          tpg_frais_port: string | null
          tpg_frais_port_ht: string | null
          tpg_id: string
          tpg_max: string | null
          tpg_min: string | null
        }
        Insert: {
          tpg_frais_port?: string | null
          tpg_frais_port_ht?: string | null
          tpg_id: string
          tpg_max?: string | null
          tpg_min?: string | null
        }
        Update: {
          tpg_frais_port?: string | null
          tpg_frais_port_ht?: string | null
          tpg_id?: string
          tpg_max?: string | null
          tpg_min?: string | null
        }
        Relationships: []
      }
      ___xtr_delivery_ape_domtom2: {
        Row: {
          tpg_frais_port: string | null
          tpg_frais_port_ht: string | null
          tpg_id: string
          tpg_max: string | null
          tpg_min: string | null
        }
        Insert: {
          tpg_frais_port?: string | null
          tpg_frais_port_ht?: string | null
          tpg_id: string
          tpg_max?: string | null
          tpg_min?: string | null
        }
        Update: {
          tpg_frais_port?: string | null
          tpg_frais_port_ht?: string | null
          tpg_id?: string
          tpg_max?: string | null
          tpg_min?: string | null
        }
        Relationships: []
      }
      ___xtr_delivery_ape_france: {
        Row: {
          tpg_frais_ajouter: string | null
          tpg_frais_ajouter_50: string | null
          tpg_frais_port: string | null
          tpg_frais_port_ht: string | null
          tpg_id: string
          tpg_max: string | null
          tpg_min: string | null
        }
        Insert: {
          tpg_frais_ajouter?: string | null
          tpg_frais_ajouter_50?: string | null
          tpg_frais_port?: string | null
          tpg_frais_port_ht?: string | null
          tpg_id: string
          tpg_max?: string | null
          tpg_min?: string | null
        }
        Update: {
          tpg_frais_ajouter?: string | null
          tpg_frais_ajouter_50?: string | null
          tpg_frais_port?: string | null
          tpg_frais_port_ht?: string | null
          tpg_id?: string
          tpg_max?: string | null
          tpg_min?: string | null
        }
        Relationships: []
      }
      ___xtr_invoice: {
        Row: {
          inv_amount_ht: string | null
          inv_amount_ttc: string | null
          inv_cba_id: string | null
          inv_cda_id: string | null
          inv_cst_id: string | null
          inv_da_id: string | null
          inv_date: string | null
          inv_deposit_ht: string | null
          inv_deposit_ttc: string | null
          inv_id: string
          inv_info: string | null
          inv_ord_id: string | null
          inv_shipping_fee_ht: string | null
          inv_shipping_fee_ttc: string | null
          inv_total_ht: string | null
          inv_total_ttc: string | null
          inv_tva: string | null
        }
        Insert: {
          inv_amount_ht?: string | null
          inv_amount_ttc?: string | null
          inv_cba_id?: string | null
          inv_cda_id?: string | null
          inv_cst_id?: string | null
          inv_da_id?: string | null
          inv_date?: string | null
          inv_deposit_ht?: string | null
          inv_deposit_ttc?: string | null
          inv_id: string
          inv_info?: string | null
          inv_ord_id?: string | null
          inv_shipping_fee_ht?: string | null
          inv_shipping_fee_ttc?: string | null
          inv_total_ht?: string | null
          inv_total_ttc?: string | null
          inv_tva?: string | null
        }
        Update: {
          inv_amount_ht?: string | null
          inv_amount_ttc?: string | null
          inv_cba_id?: string | null
          inv_cda_id?: string | null
          inv_cst_id?: string | null
          inv_da_id?: string | null
          inv_date?: string | null
          inv_deposit_ht?: string | null
          inv_deposit_ttc?: string | null
          inv_id?: string
          inv_info?: string | null
          inv_ord_id?: string | null
          inv_shipping_fee_ht?: string | null
          inv_shipping_fee_ttc?: string | null
          inv_total_ht?: string | null
          inv_total_ttc?: string | null
          inv_tva?: string | null
        }
        Relationships: []
      }
      ___xtr_invoice_line: {
        Row: {
          invl_art_deposit_ht: string | null
          invl_art_deposit_ttc: string | null
          invl_art_deposit_unit_ht: string | null
          invl_art_deposit_unit_ttc: string | null
          invl_art_price_sell_ht: string | null
          invl_art_price_sell_ttc: string | null
          invl_art_price_sell_unit_ht: string | null
          invl_art_price_sell_unit_ttc: string | null
          invl_art_quantity: string | null
          invl_art_ref: string | null
          invl_art_ref_clean: string | null
          invl_id: string
          invl_inv_id: string | null
          invl_pg_id: string | null
          invl_pg_name: string | null
          invl_pm_id: string | null
          invl_pm_name: string | null
        }
        Insert: {
          invl_art_deposit_ht?: string | null
          invl_art_deposit_ttc?: string | null
          invl_art_deposit_unit_ht?: string | null
          invl_art_deposit_unit_ttc?: string | null
          invl_art_price_sell_ht?: string | null
          invl_art_price_sell_ttc?: string | null
          invl_art_price_sell_unit_ht?: string | null
          invl_art_price_sell_unit_ttc?: string | null
          invl_art_quantity?: string | null
          invl_art_ref?: string | null
          invl_art_ref_clean?: string | null
          invl_id: string
          invl_inv_id?: string | null
          invl_pg_id?: string | null
          invl_pg_name?: string | null
          invl_pm_id?: string | null
          invl_pm_name?: string | null
        }
        Update: {
          invl_art_deposit_ht?: string | null
          invl_art_deposit_ttc?: string | null
          invl_art_deposit_unit_ht?: string | null
          invl_art_deposit_unit_ttc?: string | null
          invl_art_price_sell_ht?: string | null
          invl_art_price_sell_ttc?: string | null
          invl_art_price_sell_unit_ht?: string | null
          invl_art_price_sell_unit_ttc?: string | null
          invl_art_quantity?: string | null
          invl_art_ref?: string | null
          invl_art_ref_clean?: string | null
          invl_id?: string
          invl_inv_id?: string | null
          invl_pg_id?: string | null
          invl_pg_name?: string | null
          invl_pm_id?: string | null
          invl_pm_name?: string | null
        }
        Relationships: []
      }
      ___xtr_msg: {
        Row: {
          msg_close: string | null
          msg_cnfa_id: string | null
          msg_content: string | null
          msg_cst_id: string | null
          msg_date: string | null
          msg_id: string
          msg_open: string | null
          msg_ord_id: string | null
          msg_orl_equiv_id: string | null
          msg_orl_id: string | null
          msg_parent_id: string | null
          msg_subject: string | null
        }
        Insert: {
          msg_close?: string | null
          msg_cnfa_id?: string | null
          msg_content?: string | null
          msg_cst_id?: string | null
          msg_date?: string | null
          msg_id: string
          msg_open?: string | null
          msg_ord_id?: string | null
          msg_orl_equiv_id?: string | null
          msg_orl_id?: string | null
          msg_parent_id?: string | null
          msg_subject?: string | null
        }
        Update: {
          msg_close?: string | null
          msg_cnfa_id?: string | null
          msg_content?: string | null
          msg_cst_id?: string | null
          msg_date?: string | null
          msg_id?: string
          msg_open?: string | null
          msg_ord_id?: string | null
          msg_orl_equiv_id?: string | null
          msg_orl_id?: string | null
          msg_parent_id?: string | null
          msg_subject?: string | null
        }
        Relationships: []
      }
      ___xtr_order: {
        Row: {
          ord_amount_ht: string | null
          ord_amount_ttc: string | null
          ord_cba_id: string | null
          ord_cda_id: string | null
          ord_cst_id: string | null
          ord_da_id: string | null
          ord_date: string | null
          ord_date_pay: string | null
          ord_deposit_ht: string | null
          ord_deposit_ttc: string | null
          ord_dept_id: string | null
          ord_id: string
          ord_info: string | null
          ord_is_pay: string | null
          ord_link: string | null
          ord_link_type: string | null
          ord_ords_id: string | null
          ord_parent: string | null
          ord_shipping_fee_ht: string | null
          ord_shipping_fee_ttc: string | null
          ord_total_ht: string | null
          ord_total_ttc: string | null
          ord_tva: string | null
        }
        Insert: {
          ord_amount_ht?: string | null
          ord_amount_ttc?: string | null
          ord_cba_id?: string | null
          ord_cda_id?: string | null
          ord_cst_id?: string | null
          ord_da_id?: string | null
          ord_date?: string | null
          ord_date_pay?: string | null
          ord_deposit_ht?: string | null
          ord_deposit_ttc?: string | null
          ord_dept_id?: string | null
          ord_id: string
          ord_info?: string | null
          ord_is_pay?: string | null
          ord_link?: string | null
          ord_link_type?: string | null
          ord_ords_id?: string | null
          ord_parent?: string | null
          ord_shipping_fee_ht?: string | null
          ord_shipping_fee_ttc?: string | null
          ord_total_ht?: string | null
          ord_total_ttc?: string | null
          ord_tva?: string | null
        }
        Update: {
          ord_amount_ht?: string | null
          ord_amount_ttc?: string | null
          ord_cba_id?: string | null
          ord_cda_id?: string | null
          ord_cst_id?: string | null
          ord_da_id?: string | null
          ord_date?: string | null
          ord_date_pay?: string | null
          ord_deposit_ht?: string | null
          ord_deposit_ttc?: string | null
          ord_dept_id?: string | null
          ord_id?: string
          ord_info?: string | null
          ord_is_pay?: string | null
          ord_link?: string | null
          ord_link_type?: string | null
          ord_ords_id?: string | null
          ord_parent?: string | null
          ord_shipping_fee_ht?: string | null
          ord_shipping_fee_ttc?: string | null
          ord_total_ht?: string | null
          ord_total_ttc?: string | null
          ord_tva?: string | null
        }
        Relationships: []
      }
      ___xtr_order_line: {
        Row: {
          orl_art_deposit_ht: string | null
          orl_art_deposit_ttc: string | null
          orl_art_deposit_unit_ht: string | null
          orl_art_deposit_unit_ttc: string | null
          orl_art_price_buy_discount: string | null
          orl_art_price_buy_ht: string | null
          orl_art_price_buy_ttc: string | null
          orl_art_price_buy_unit_ht: string | null
          orl_art_price_buy_unit_public_ht: string | null
          orl_art_price_buy_unit_public_ttc: string | null
          orl_art_price_buy_unit_ttc: string | null
          orl_art_price_sell_ht: string | null
          orl_art_price_sell_margin: string | null
          orl_art_price_sell_ttc: string | null
          orl_art_price_sell_unit_ht: string | null
          orl_art_price_sell_unit_ttc: string | null
          orl_art_quantity: string | null
          orl_art_ref: string | null
          orl_art_ref_clean: string | null
          orl_equiv_id: string | null
          orl_id: string
          orl_ord_id: string | null
          orl_orls_id: string | null
          orl_pg_id: string | null
          orl_pg_name: string | null
          orl_pm_id: string | null
          orl_pm_name: string | null
          orl_spl_date: string | null
          orl_spl_id: string | null
          orl_spl_name: string | null
          orl_spl_price_buy_ht: string | null
          orl_spl_price_buy_ttc: string | null
          orl_spl_price_buy_unit_ht: string | null
          orl_spl_price_buy_unit_ttc: string | null
          orl_website_url: string | null
        }
        Insert: {
          orl_art_deposit_ht?: string | null
          orl_art_deposit_ttc?: string | null
          orl_art_deposit_unit_ht?: string | null
          orl_art_deposit_unit_ttc?: string | null
          orl_art_price_buy_discount?: string | null
          orl_art_price_buy_ht?: string | null
          orl_art_price_buy_ttc?: string | null
          orl_art_price_buy_unit_ht?: string | null
          orl_art_price_buy_unit_public_ht?: string | null
          orl_art_price_buy_unit_public_ttc?: string | null
          orl_art_price_buy_unit_ttc?: string | null
          orl_art_price_sell_ht?: string | null
          orl_art_price_sell_margin?: string | null
          orl_art_price_sell_ttc?: string | null
          orl_art_price_sell_unit_ht?: string | null
          orl_art_price_sell_unit_ttc?: string | null
          orl_art_quantity?: string | null
          orl_art_ref?: string | null
          orl_art_ref_clean?: string | null
          orl_equiv_id?: string | null
          orl_id: string
          orl_ord_id?: string | null
          orl_orls_id?: string | null
          orl_pg_id?: string | null
          orl_pg_name?: string | null
          orl_pm_id?: string | null
          orl_pm_name?: string | null
          orl_spl_date?: string | null
          orl_spl_id?: string | null
          orl_spl_name?: string | null
          orl_spl_price_buy_ht?: string | null
          orl_spl_price_buy_ttc?: string | null
          orl_spl_price_buy_unit_ht?: string | null
          orl_spl_price_buy_unit_ttc?: string | null
          orl_website_url?: string | null
        }
        Update: {
          orl_art_deposit_ht?: string | null
          orl_art_deposit_ttc?: string | null
          orl_art_deposit_unit_ht?: string | null
          orl_art_deposit_unit_ttc?: string | null
          orl_art_price_buy_discount?: string | null
          orl_art_price_buy_ht?: string | null
          orl_art_price_buy_ttc?: string | null
          orl_art_price_buy_unit_ht?: string | null
          orl_art_price_buy_unit_public_ht?: string | null
          orl_art_price_buy_unit_public_ttc?: string | null
          orl_art_price_buy_unit_ttc?: string | null
          orl_art_price_sell_ht?: string | null
          orl_art_price_sell_margin?: string | null
          orl_art_price_sell_ttc?: string | null
          orl_art_price_sell_unit_ht?: string | null
          orl_art_price_sell_unit_ttc?: string | null
          orl_art_quantity?: string | null
          orl_art_ref?: string | null
          orl_art_ref_clean?: string | null
          orl_equiv_id?: string | null
          orl_id?: string
          orl_ord_id?: string | null
          orl_orls_id?: string | null
          orl_pg_id?: string | null
          orl_pg_name?: string | null
          orl_pm_id?: string | null
          orl_pm_name?: string | null
          orl_spl_date?: string | null
          orl_spl_id?: string | null
          orl_spl_name?: string | null
          orl_spl_price_buy_ht?: string | null
          orl_spl_price_buy_ttc?: string | null
          orl_spl_price_buy_unit_ht?: string | null
          orl_spl_price_buy_unit_ttc?: string | null
          orl_website_url?: string | null
        }
        Relationships: []
      }
      ___xtr_order_line_equiv_ticket: {
        Row: {
          orlet_amount_ttc: string | null
          orlet_equiv_id: string | null
          orlet_id: string
          orlet_ord_id: string | null
          orlet_orl_id: string | null
        }
        Insert: {
          orlet_amount_ttc?: string | null
          orlet_equiv_id?: string | null
          orlet_id: string
          orlet_ord_id?: string | null
          orlet_orl_id?: string | null
        }
        Update: {
          orlet_amount_ttc?: string | null
          orlet_equiv_id?: string | null
          orlet_id?: string
          orlet_ord_id?: string | null
          orlet_orl_id?: string | null
        }
        Relationships: []
      }
      ___xtr_order_line_status: {
        Row: {
          orls_action: string | null
          orls_color: string | null
          orls_dept_id: string | null
          orls_id: string
          orls_name: string | null
        }
        Insert: {
          orls_action?: string | null
          orls_color?: string | null
          orls_dept_id?: string | null
          orls_id: string
          orls_name?: string | null
        }
        Update: {
          orls_action?: string | null
          orls_color?: string | null
          orls_dept_id?: string | null
          orls_id?: string
          orls_name?: string | null
        }
        Relationships: []
      }
      ___xtr_order_status: {
        Row: {
          ords_action: string | null
          ords_color: string | null
          ords_dept_id: string | null
          ords_id: string
          ords_named: string | null
        }
        Insert: {
          ords_action?: string | null
          ords_color?: string | null
          ords_dept_id?: string | null
          ords_id: string
          ords_named?: string | null
        }
        Update: {
          ords_action?: string | null
          ords_color?: string | null
          ords_dept_id?: string | null
          ords_id?: string
          ords_named?: string | null
        }
        Relationships: []
      }
      ___xtr_supplier: {
        Row: {
          spl_alias: string | null
          spl_display: string | null
          spl_id: string
          spl_name: string | null
          spl_sort: string | null
        }
        Insert: {
          spl_alias?: string | null
          spl_display?: string | null
          spl_id: string
          spl_name?: string | null
          spl_sort?: string | null
        }
        Update: {
          spl_alias?: string | null
          spl_display?: string | null
          spl_id?: string
          spl_name?: string | null
          spl_sort?: string | null
        }
        Relationships: []
      }
      ___xtr_supplier_link_pm: {
        Row: {
          slpm_display: string | null
          slpm_id: string
          slpm_pm_id: string | null
          slpm_spl_id: string | null
        }
        Insert: {
          slpm_display?: string | null
          slpm_id: string
          slpm_pm_id?: string | null
          slpm_spl_id?: string | null
        }
        Update: {
          slpm_display?: string | null
          slpm_id?: string
          slpm_pm_id?: string | null
          slpm_spl_id?: string | null
        }
        Relationships: []
      }
      __admin_job_health: {
        Row: {
          avg_duration_ms: number | null
          consecutive_failures: number | null
          id: number
          last_error: string | null
          last_failure_at: string | null
          last_success_at: string | null
          queue_name: string
          total_completed: number | null
          total_failed: number | null
          updated_at: string | null
        }
        Insert: {
          avg_duration_ms?: number | null
          consecutive_failures?: number | null
          id?: number
          last_error?: string | null
          last_failure_at?: string | null
          last_success_at?: string | null
          queue_name: string
          total_completed?: number | null
          total_failed?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_duration_ms?: number | null
          consecutive_failures?: number | null
          id?: number
          last_error?: string | null
          last_failure_at?: string | null
          last_success_at?: string | null
          queue_name?: string
          total_completed?: number | null
          total_failed?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      __blog_advice: {
        Row: {
          ba_alias: string | null
          ba_content: string | null
          ba_create: string | null
          ba_cta_anchor: string | null
          ba_cta_link: string | null
          ba_descrip: string | null
          ba_h1: string | null
          ba_h2: string | null
          ba_id: string
          ba_keywords: string | null
          ba_pg_id: string | null
          ba_preview: string | null
          ba_title: string | null
          ba_update: string | null
          ba_visit: string | null
          ba_wall: string | null
        }
        Insert: {
          ba_alias?: string | null
          ba_content?: string | null
          ba_create?: string | null
          ba_cta_anchor?: string | null
          ba_cta_link?: string | null
          ba_descrip?: string | null
          ba_h1?: string | null
          ba_h2?: string | null
          ba_id: string
          ba_keywords?: string | null
          ba_pg_id?: string | null
          ba_preview?: string | null
          ba_title?: string | null
          ba_update?: string | null
          ba_visit?: string | null
          ba_wall?: string | null
        }
        Update: {
          ba_alias?: string | null
          ba_content?: string | null
          ba_create?: string | null
          ba_cta_anchor?: string | null
          ba_cta_link?: string | null
          ba_descrip?: string | null
          ba_h1?: string | null
          ba_h2?: string | null
          ba_id?: string
          ba_keywords?: string | null
          ba_pg_id?: string | null
          ba_preview?: string | null
          ba_title?: string | null
          ba_update?: string | null
          ba_visit?: string | null
          ba_wall?: string | null
        }
        Relationships: []
      }
      __blog_advice_cross: {
        Row: {
          bac_ba_id: string | null
          bac_ba_id_cross: string | null
          bac_id: string
        }
        Insert: {
          bac_ba_id?: string | null
          bac_ba_id_cross?: string | null
          bac_id: string
        }
        Update: {
          bac_ba_id?: string | null
          bac_ba_id_cross?: string | null
          bac_id?: string
        }
        Relationships: []
      }
      __blog_advice_h2: {
        Row: {
          ba2_ba_id: string | null
          ba2_content: string | null
          ba2_create: string | null
          ba2_cta_anchor: string | null
          ba2_cta_link: string | null
          ba2_h2: string | null
          ba2_id: string
          ba2_update: string | null
          ba2_wall: string | null
        }
        Insert: {
          ba2_ba_id?: string | null
          ba2_content?: string | null
          ba2_create?: string | null
          ba2_cta_anchor?: string | null
          ba2_cta_link?: string | null
          ba2_h2?: string | null
          ba2_id: string
          ba2_update?: string | null
          ba2_wall?: string | null
        }
        Update: {
          ba2_ba_id?: string | null
          ba2_content?: string | null
          ba2_create?: string | null
          ba2_cta_anchor?: string | null
          ba2_cta_link?: string | null
          ba2_h2?: string | null
          ba2_id?: string
          ba2_update?: string | null
          ba2_wall?: string | null
        }
        Relationships: []
      }
      __blog_advice_h3: {
        Row: {
          ba3_ba2_id: string | null
          ba3_content: string | null
          ba3_create: string | null
          ba3_cta_anchor: string | null
          ba3_cta_link: string | null
          ba3_h3: string | null
          ba3_id: string
          ba3_update: string | null
          ba3_wall: string | null
        }
        Insert: {
          ba3_ba2_id?: string | null
          ba3_content?: string | null
          ba3_create?: string | null
          ba3_cta_anchor?: string | null
          ba3_cta_link?: string | null
          ba3_h3?: string | null
          ba3_id: string
          ba3_update?: string | null
          ba3_wall?: string | null
        }
        Update: {
          ba3_ba2_id?: string | null
          ba3_content?: string | null
          ba3_create?: string | null
          ba3_cta_anchor?: string | null
          ba3_cta_link?: string | null
          ba3_h3?: string | null
          ba3_id?: string
          ba3_update?: string | null
          ba3_wall?: string | null
        }
        Relationships: []
      }
      __blog_advice_old: {
        Row: {
          ba_alias: string | null
          ba_content: string | null
          ba_create: string | null
          ba_descrip: string | null
          ba_h1: string | null
          ba_h2: string | null
          ba_id: string
          ba_keywords: string | null
          ba_pg_id: string | null
          ba_preview: string | null
          ba_status: string | null
          ba_title: string | null
          ba_update: string | null
          ba_visit: string | null
          ba_wall: string | null
        }
        Insert: {
          ba_alias?: string | null
          ba_content?: string | null
          ba_create?: string | null
          ba_descrip?: string | null
          ba_h1?: string | null
          ba_h2?: string | null
          ba_id: string
          ba_keywords?: string | null
          ba_pg_id?: string | null
          ba_preview?: string | null
          ba_status?: string | null
          ba_title?: string | null
          ba_update?: string | null
          ba_visit?: string | null
          ba_wall?: string | null
        }
        Update: {
          ba_alias?: string | null
          ba_content?: string | null
          ba_create?: string | null
          ba_descrip?: string | null
          ba_h1?: string | null
          ba_h2?: string | null
          ba_id?: string
          ba_keywords?: string | null
          ba_pg_id?: string | null
          ba_preview?: string | null
          ba_status?: string | null
          ba_title?: string | null
          ba_update?: string | null
          ba_visit?: string | null
          ba_wall?: string | null
        }
        Relationships: []
      }
      __blog_guide: {
        Row: {
          bg_alias: string | null
          bg_content: string | null
          bg_create: string | null
          bg_cta_anchor: string | null
          bg_cta_link: string | null
          bg_descrip: string | null
          bg_h1: string | null
          bg_h2: string | null
          bg_id: string
          bg_keywords: string | null
          bg_preview: string | null
          bg_title: string | null
          bg_update: string | null
          bg_visit: string | null
          bg_wall: string | null
        }
        Insert: {
          bg_alias?: string | null
          bg_content?: string | null
          bg_create?: string | null
          bg_cta_anchor?: string | null
          bg_cta_link?: string | null
          bg_descrip?: string | null
          bg_h1?: string | null
          bg_h2?: string | null
          bg_id: string
          bg_keywords?: string | null
          bg_preview?: string | null
          bg_title?: string | null
          bg_update?: string | null
          bg_visit?: string | null
          bg_wall?: string | null
        }
        Update: {
          bg_alias?: string | null
          bg_content?: string | null
          bg_create?: string | null
          bg_cta_anchor?: string | null
          bg_cta_link?: string | null
          bg_descrip?: string | null
          bg_h1?: string | null
          bg_h2?: string | null
          bg_id?: string
          bg_keywords?: string | null
          bg_preview?: string | null
          bg_title?: string | null
          bg_update?: string | null
          bg_visit?: string | null
          bg_wall?: string | null
        }
        Relationships: []
      }
      __blog_guide_h2: {
        Row: {
          bg2_bg_id: string | null
          bg2_content: string | null
          bg2_create: string | null
          bg2_cta_anchor: string | null
          bg2_cta_link: string | null
          bg2_h2: string | null
          bg2_id: string
          bg2_update: string | null
          bg2_wall: string | null
        }
        Insert: {
          bg2_bg_id?: string | null
          bg2_content?: string | null
          bg2_create?: string | null
          bg2_cta_anchor?: string | null
          bg2_cta_link?: string | null
          bg2_h2?: string | null
          bg2_id: string
          bg2_update?: string | null
          bg2_wall?: string | null
        }
        Update: {
          bg2_bg_id?: string | null
          bg2_content?: string | null
          bg2_create?: string | null
          bg2_cta_anchor?: string | null
          bg2_cta_link?: string | null
          bg2_h2?: string | null
          bg2_id?: string
          bg2_update?: string | null
          bg2_wall?: string | null
        }
        Relationships: []
      }
      __blog_guide_h3: {
        Row: {
          bg3_bg2_id: string | null
          bg3_content: string | null
          bg3_create: string | null
          bg3_cta_anchor: string | null
          bg3_cta_link: string | null
          bg3_h3: string | null
          bg3_id: string
          bg3_update: string | null
          bg3_wall: string | null
        }
        Insert: {
          bg3_bg2_id?: string | null
          bg3_content?: string | null
          bg3_create?: string | null
          bg3_cta_anchor?: string | null
          bg3_cta_link?: string | null
          bg3_h3?: string | null
          bg3_id: string
          bg3_update?: string | null
          bg3_wall?: string | null
        }
        Update: {
          bg3_bg2_id?: string | null
          bg3_content?: string | null
          bg3_create?: string | null
          bg3_cta_anchor?: string | null
          bg3_cta_link?: string | null
          bg3_h3?: string | null
          bg3_id?: string
          bg3_update?: string | null
          bg3_wall?: string | null
        }
        Relationships: []
      }
      __blog_meta_tags_ariane: {
        Row: {
          mta_alias: string | null
          mta_ariane: string | null
          mta_content: string | null
          mta_descrip: string | null
          mta_h1: string | null
          mta_id: string
          mta_keywords: string | null
          mta_relfollow: string | null
          mta_title: string | null
        }
        Insert: {
          mta_alias?: string | null
          mta_ariane?: string | null
          mta_content?: string | null
          mta_descrip?: string | null
          mta_h1?: string | null
          mta_id: string
          mta_keywords?: string | null
          mta_relfollow?: string | null
          mta_title?: string | null
        }
        Update: {
          mta_alias?: string | null
          mta_ariane?: string | null
          mta_content?: string | null
          mta_descrip?: string | null
          mta_h1?: string | null
          mta_id?: string
          mta_keywords?: string | null
          mta_relfollow?: string | null
          mta_title?: string | null
        }
        Relationships: []
      }
      __blog_seo_marque: {
        Row: {
          bsm_content: string | null
          bsm_descrip: string | null
          bsm_h1: string | null
          bsm_id: string
          bsm_keywords: string | null
          bsm_marque_id: string
          bsm_title: string | null
        }
        Insert: {
          bsm_content?: string | null
          bsm_descrip?: string | null
          bsm_h1?: string | null
          bsm_id: string
          bsm_keywords?: string | null
          bsm_marque_id: string
          bsm_title?: string | null
        }
        Update: {
          bsm_content?: string | null
          bsm_descrip?: string | null
          bsm_h1?: string | null
          bsm_id?: string
          bsm_keywords?: string | null
          bsm_marque_id?: string
          bsm_title?: string | null
        }
        Relationships: []
      }
      __catalog_id_mapping: {
        Row: {
          cim_automecanik_id: number
          cim_created_at: string | null
          cim_entity_type: string
          cim_external_id: string
          cim_id: number
          cim_metadata: Json | null
          cim_source: string | null
          cim_updated_at: string | null
          cim_version: string | null
        }
        Insert: {
          cim_automecanik_id: number
          cim_created_at?: string | null
          cim_entity_type: string
          cim_external_id: string
          cim_id?: number
          cim_metadata?: Json | null
          cim_source?: string | null
          cim_updated_at?: string | null
          cim_version?: string | null
        }
        Update: {
          cim_automecanik_id?: number
          cim_created_at?: string | null
          cim_entity_type?: string
          cim_external_id?: string
          cim_id?: number
          cim_metadata?: Json | null
          cim_source?: string | null
          cim_updated_at?: string | null
          cim_version?: string | null
        }
        Relationships: []
      }
      __catalog_import_history: {
        Row: {
          cih_completed_at: string | null
          cih_created_by: string | null
          cih_errors: Json | null
          cih_id: number
          cih_notes: string | null
          cih_source_files: Json | null
          cih_started_at: string | null
          cih_stats: Json | null
          cih_status: string | null
          cih_version: string
        }
        Insert: {
          cih_completed_at?: string | null
          cih_created_by?: string | null
          cih_errors?: Json | null
          cih_id?: number
          cih_notes?: string | null
          cih_source_files?: Json | null
          cih_started_at?: string | null
          cih_stats?: Json | null
          cih_status?: string | null
          cih_version: string
        }
        Update: {
          cih_completed_at?: string | null
          cih_created_by?: string | null
          cih_errors?: Json | null
          cih_id?: number
          cih_notes?: string | null
          cih_source_files?: Json | null
          cih_started_at?: string | null
          cih_stats?: Json | null
          cih_status?: string | null
          cih_version?: string
        }
        Relationships: []
      }
      __cross_gamme_car: {
        Row: {
          cgc_id: string
          cgc_level: string | null
          cgc_marque_id: string | null
          cgc_modele_id: string | null
          cgc_pg_id: string | null
          cgc_type_id: string | null
        }
        Insert: {
          cgc_id: string
          cgc_level?: string | null
          cgc_marque_id?: string | null
          cgc_modele_id?: string | null
          cgc_pg_id?: string | null
          cgc_type_id?: string | null
        }
        Update: {
          cgc_id?: string
          cgc_level?: string | null
          cgc_marque_id?: string | null
          cgc_modele_id?: string | null
          cgc_pg_id?: string | null
          cgc_type_id?: string | null
        }
        Relationships: []
      }
      __cross_gamme_car_new: {
        Row: {
          cgc_id: string
          cgc_level: string | null
          cgc_marque_id: string | null
          cgc_mdg_id: string | null
          cgc_modele_id: string | null
          cgc_pg_id: string | null
          cgc_type_id: string | null
        }
        Insert: {
          cgc_id: string
          cgc_level?: string | null
          cgc_marque_id?: string | null
          cgc_mdg_id?: string | null
          cgc_modele_id?: string | null
          cgc_pg_id?: string | null
          cgc_type_id?: string | null
        }
        Update: {
          cgc_id?: string
          cgc_level?: string | null
          cgc_marque_id?: string | null
          cgc_mdg_id?: string | null
          cgc_modele_id?: string | null
          cgc_pg_id?: string | null
          cgc_type_id?: string | null
        }
        Relationships: []
      }
      __cross_gamme_car_new2: {
        Row: {
          cgc_id: string
          cgc_level: string | null
          cgc_marque_id: string | null
          cgc_mdg_id: string | null
          cgc_modele_id: string | null
          cgc_pg_id: string | null
          cgc_type_id: string | null
        }
        Insert: {
          cgc_id: string
          cgc_level?: string | null
          cgc_marque_id?: string | null
          cgc_mdg_id?: string | null
          cgc_modele_id?: string | null
          cgc_pg_id?: string | null
          cgc_type_id?: string | null
        }
        Update: {
          cgc_id?: string
          cgc_level?: string | null
          cgc_marque_id?: string | null
          cgc_mdg_id?: string | null
          cgc_modele_id?: string | null
          cgc_pg_id?: string | null
          cgc_type_id?: string | null
        }
        Relationships: []
      }
      __diag_context_questions: {
        Row: {
          dcq_code: string
          dcq_created_at: string | null
          dcq_enabled: boolean | null
          dcq_id: number
          dcq_label: string
          dcq_options: Json | null
          dcq_order: number | null
          dcq_subsystems: string[] | null
          dcq_type: string
          dcq_weight_modifier: Json | null
        }
        Insert: {
          dcq_code: string
          dcq_created_at?: string | null
          dcq_enabled?: boolean | null
          dcq_id?: number
          dcq_label: string
          dcq_options?: Json | null
          dcq_order?: number | null
          dcq_subsystems?: string[] | null
          dcq_type: string
          dcq_weight_modifier?: Json | null
        }
        Update: {
          dcq_code?: string
          dcq_created_at?: string | null
          dcq_enabled?: boolean | null
          dcq_id?: number
          dcq_label?: string
          dcq_options?: Json | null
          dcq_order?: number | null
          dcq_subsystems?: string[] | null
          dcq_type?: string
          dcq_weight_modifier?: Json | null
        }
        Relationships: []
      }
      __diag_related_parts: {
        Row: {
          drp_created_at: string | null
          drp_enabled: boolean | null
          drp_id: number
          drp_message: string | null
          drp_probability: number | null
          drp_relation: string
          drp_source_pg_id: number
          drp_target_pg_id: number
        }
        Insert: {
          drp_created_at?: string | null
          drp_enabled?: boolean | null
          drp_id?: number
          drp_message?: string | null
          drp_probability?: number | null
          drp_relation: string
          drp_source_pg_id: number
          drp_target_pg_id: number
        }
        Update: {
          drp_created_at?: string | null
          drp_enabled?: boolean | null
          drp_id?: number
          drp_message?: string | null
          drp_probability?: number | null
          drp_relation?: string
          drp_source_pg_id?: number
          drp_target_pg_id?: number
        }
        Relationships: []
      }
      __diag_safe_phrases: {
        Row: {
          dsp_enabled: boolean | null
          dsp_id: number
          dsp_phrase: string
          dsp_usage: string
        }
        Insert: {
          dsp_enabled?: boolean | null
          dsp_id?: number
          dsp_phrase: string
          dsp_usage: string
        }
        Update: {
          dsp_enabled?: boolean | null
          dsp_id?: number
          dsp_phrase?: string
          dsp_usage?: string
        }
        Relationships: []
      }
      __diag_symptom_family: {
        Row: {
          dsf_check_action: string | null
          dsf_created_at: string | null
          dsf_enabled: boolean | null
          dsf_id: number
          dsf_max_km: number | null
          dsf_min_km: number | null
          dsf_pg_id: number
          dsf_priority: number | null
          dsf_probability: number
          dsf_symptom_code: string
        }
        Insert: {
          dsf_check_action?: string | null
          dsf_created_at?: string | null
          dsf_enabled?: boolean | null
          dsf_id?: number
          dsf_max_km?: number | null
          dsf_min_km?: number | null
          dsf_pg_id: number
          dsf_priority?: number | null
          dsf_probability: number
          dsf_symptom_code: string
        }
        Update: {
          dsf_check_action?: string | null
          dsf_created_at?: string | null
          dsf_enabled?: boolean | null
          dsf_id?: number
          dsf_max_km?: number | null
          dsf_min_km?: number | null
          dsf_pg_id?: number
          dsf_priority?: number | null
          dsf_probability?: number
          dsf_symptom_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "__diag_symptom_family_dsf_symptom_code_fkey"
            columns: ["dsf_symptom_code"]
            isOneToOne: false
            referencedRelation: "__diag_symptoms"
            referencedColumns: ["ds_code"]
          },
        ]
      }
      __diag_symptoms: {
        Row: {
          ds_category: string
          ds_code: string
          ds_created_at: string | null
          ds_enabled: boolean | null
          ds_icon: string | null
          ds_id: number
          ds_label: string
          ds_severity: string | null
          ds_subsystem: string | null
        }
        Insert: {
          ds_category: string
          ds_code: string
          ds_created_at?: string | null
          ds_enabled?: boolean | null
          ds_icon?: string | null
          ds_id?: number
          ds_label: string
          ds_severity?: string | null
          ds_subsystem?: string | null
        }
        Update: {
          ds_category?: string
          ds_code?: string
          ds_created_at?: string | null
          ds_enabled?: boolean | null
          ds_icon?: string | null
          ds_id?: number
          ds_label?: string
          ds_severity?: string | null
          ds_subsystem?: string | null
        }
        Relationships: []
      }
      __import_batch_contract: {
        Row: {
          ibc_blocked_reason: string | null
          ibc_completeness_ratio: number | null
          ibc_created_at: string | null
          ibc_entity_type: string
          ibc_expected_count: number
          ibc_expected_tables: string[] | null
          ibc_gate_passed: boolean | null
          ibc_id: number
          ibc_import_id: number
          ibc_min_rowcounts: Json | null
          ibc_received_count: number | null
          ibc_rejected_count: number | null
          ibc_source_checksums: Json | null
          ibc_source_version: string | null
          ibc_status: string | null
          ibc_updated_at: string | null
          ibc_validated_count: number | null
          ibc_validation_ratio: number | null
        }
        Insert: {
          ibc_blocked_reason?: string | null
          ibc_completeness_ratio?: number | null
          ibc_created_at?: string | null
          ibc_entity_type: string
          ibc_expected_count: number
          ibc_expected_tables?: string[] | null
          ibc_gate_passed?: boolean | null
          ibc_id?: number
          ibc_import_id: number
          ibc_min_rowcounts?: Json | null
          ibc_received_count?: number | null
          ibc_rejected_count?: number | null
          ibc_source_checksums?: Json | null
          ibc_source_version?: string | null
          ibc_status?: string | null
          ibc_updated_at?: string | null
          ibc_validated_count?: number | null
          ibc_validation_ratio?: number | null
        }
        Update: {
          ibc_blocked_reason?: string | null
          ibc_completeness_ratio?: number | null
          ibc_created_at?: string | null
          ibc_entity_type?: string
          ibc_expected_count?: number
          ibc_expected_tables?: string[] | null
          ibc_gate_passed?: boolean | null
          ibc_id?: number
          ibc_import_id?: number
          ibc_min_rowcounts?: Json | null
          ibc_received_count?: number | null
          ibc_rejected_count?: number | null
          ibc_source_checksums?: Json | null
          ibc_source_version?: string | null
          ibc_status?: string | null
          ibc_updated_at?: string | null
          ibc_validated_count?: number | null
          ibc_validation_ratio?: number | null
        }
        Relationships: []
      }
      __import_gate_status: {
        Row: {
          igs_blocker_reason: string | null
          igs_checked_at: string | null
          igs_details: Json | null
          igs_gate_name: string
          igs_gate_number: number
          igs_id: number
          igs_import_id: number
          igs_passed: boolean | null
        }
        Insert: {
          igs_blocker_reason?: string | null
          igs_checked_at?: string | null
          igs_details?: Json | null
          igs_gate_name: string
          igs_gate_number: number
          igs_id?: number
          igs_import_id: number
          igs_passed?: boolean | null
        }
        Update: {
          igs_blocker_reason?: string | null
          igs_checked_at?: string | null
          igs_details?: Json | null
          igs_gate_name?: string
          igs_gate_number?: number
          igs_id?: number
          igs_import_id?: number
          igs_passed?: boolean | null
        }
        Relationships: []
      }
      __import_manifest: {
        Row: {
          im_created_at: string | null
          im_error: string | null
          im_expected: boolean | null
          im_file_hash: string | null
          im_file_name: string
          im_file_path: string | null
          im_file_size: number | null
          im_id: number
          im_import_id: number
          im_line_count: number | null
          im_processed: boolean | null
          im_processed_at: string | null
          im_received: boolean | null
        }
        Insert: {
          im_created_at?: string | null
          im_error?: string | null
          im_expected?: boolean | null
          im_file_hash?: string | null
          im_file_name: string
          im_file_path?: string | null
          im_file_size?: number | null
          im_id?: number
          im_import_id: number
          im_line_count?: number | null
          im_processed?: boolean | null
          im_processed_at?: string | null
          im_received?: boolean | null
        }
        Update: {
          im_created_at?: string | null
          im_error?: string | null
          im_expected?: boolean | null
          im_file_hash?: string | null
          im_file_name?: string
          im_file_path?: string | null
          im_file_size?: number | null
          im_id?: number
          im_import_id?: number
          im_line_count?: number | null
          im_processed?: boolean | null
          im_processed_at?: string | null
          im_received?: boolean | null
        }
        Relationships: []
      }
      __import_proof: {
        Row: {
          ip_actual_value: string | null
          ip_created_at: string | null
          ip_details: Json | null
          ip_expected_value: string | null
          ip_gate_number: number | null
          ip_id: number
          ip_import_id: number
          ip_passed: boolean
          ip_proof_type: string
          ip_tolerance: number | null
        }
        Insert: {
          ip_actual_value?: string | null
          ip_created_at?: string | null
          ip_details?: Json | null
          ip_expected_value?: string | null
          ip_gate_number?: number | null
          ip_id?: number
          ip_import_id: number
          ip_passed: boolean
          ip_proof_type: string
          ip_tolerance?: number | null
        }
        Update: {
          ip_actual_value?: string | null
          ip_created_at?: string | null
          ip_details?: Json | null
          ip_expected_value?: string | null
          ip_gate_number?: number | null
          ip_id?: number
          ip_import_id?: number
          ip_passed?: boolean
          ip_proof_type?: string
          ip_tolerance?: number | null
        }
        Relationships: []
      }
      __marketing_analytics_digests: {
        Row: {
          ai_recommendations: Json | null
          ai_summary: string | null
          created_at: string | null
          digest_json: Json
          digest_type: string
          id: number
          week_iso: string
        }
        Insert: {
          ai_recommendations?: Json | null
          ai_summary?: string | null
          created_at?: string | null
          digest_json: Json
          digest_type?: string
          id?: number
          week_iso: string
        }
        Update: {
          ai_recommendations?: Json | null
          ai_summary?: string | null
          created_at?: string | null
          digest_json?: Json
          digest_type?: string
          id?: number
          week_iso?: string
        }
        Relationships: []
      }
      __marketing_backlinks: {
        Row: {
          anchor_text: string | null
          anchor_type: string | null
          campaign_id: number | null
          created_at: string | null
          da_score: number | null
          dr_score: number | null
          first_seen: string | null
          id: number
          last_checked: string | null
          link_type: string | null
          notes: string | null
          source_category: string | null
          source_domain: string
          source_url: string
          status: string | null
          target_url: string
          updated_at: string | null
        }
        Insert: {
          anchor_text?: string | null
          anchor_type?: string | null
          campaign_id?: number | null
          created_at?: string | null
          da_score?: number | null
          dr_score?: number | null
          first_seen?: string | null
          id?: number
          last_checked?: string | null
          link_type?: string | null
          notes?: string | null
          source_category?: string | null
          source_domain: string
          source_url: string
          status?: string | null
          target_url: string
          updated_at?: string | null
        }
        Update: {
          anchor_text?: string | null
          anchor_type?: string | null
          campaign_id?: number | null
          created_at?: string | null
          da_score?: number | null
          dr_score?: number | null
          first_seen?: string | null
          id?: number
          last_checked?: string | null
          link_type?: string | null
          notes?: string | null
          source_category?: string | null
          source_domain?: string
          source_url?: string
          status?: string | null
          target_url?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "__marketing_backlinks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "__marketing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      __marketing_brand_rules: {
        Row: {
          active: boolean | null
          channel: string | null
          created_at: string | null
          id: number
          rule_key: string
          rule_type: string
          rule_value: Json
          severity: string
        }
        Insert: {
          active?: boolean | null
          channel?: string | null
          created_at?: string | null
          id?: number
          rule_key: string
          rule_type: string
          rule_value: Json
          severity?: string
        }
        Update: {
          active?: boolean | null
          channel?: string | null
          created_at?: string | null
          id?: number
          rule_key?: string
          rule_type?: string
          rule_value?: Json
          severity?: string
        }
        Relationships: []
      }
      __marketing_campaigns: {
        Row: {
          budget_euros: number | null
          created_at: string | null
          end_date: string | null
          goal_backlinks: number | null
          goal_da_min: number | null
          id: number
          name: string
          notes: string | null
          start_date: string | null
          status: string
          type: string
          updated_at: string | null
        }
        Insert: {
          budget_euros?: number | null
          created_at?: string | null
          end_date?: string | null
          goal_backlinks?: number | null
          goal_da_min?: number | null
          id?: number
          name: string
          notes?: string | null
          start_date?: string | null
          status?: string
          type: string
          updated_at?: string | null
        }
        Update: {
          budget_euros?: number | null
          created_at?: string | null
          end_date?: string | null
          goal_backlinks?: number | null
          goal_da_min?: number | null
          id?: number
          name?: string
          notes?: string | null
          start_date?: string | null
          status?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      __marketing_content_library: {
        Row: {
          asset_type: string
          avg_performance_score: number | null
          channel: string | null
          content: Json
          created_at: string | null
          gamme_id: number | null
          id: number
          is_evergreen: boolean | null
          last_used_at: string | null
          pillar: string | null
          recycle_after_days: number | null
          status: string | null
          tags: string[] | null
          times_used: number | null
          updated_at: string | null
        }
        Insert: {
          asset_type: string
          avg_performance_score?: number | null
          channel?: string | null
          content: Json
          created_at?: string | null
          gamme_id?: number | null
          id?: number
          is_evergreen?: boolean | null
          last_used_at?: string | null
          pillar?: string | null
          recycle_after_days?: number | null
          status?: string | null
          tags?: string[] | null
          times_used?: number | null
          updated_at?: string | null
        }
        Update: {
          asset_type?: string
          avg_performance_score?: number | null
          channel?: string | null
          content?: Json
          created_at?: string | null
          gamme_id?: number | null
          id?: number
          is_evergreen?: boolean | null
          last_used_at?: string | null
          pillar?: string | null
          recycle_after_days?: number | null
          status?: string | null
          tags?: string[] | null
          times_used?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      __marketing_content_roadmap: {
        Row: {
          assigned_to: string | null
          backlink_potential: string | null
          blog_advice_id: number | null
          content_type: string
          created_at: string | null
          deadline: string | null
          estimated_words: number | null
          ga4_traffic: number | null
          id: number
          notes: string | null
          pg_id: number | null
          priority: string | null
          seo_observable_id: number | null
          seo_reference_id: number | null
          slug: string | null
          status: string | null
          target_family: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          backlink_potential?: string | null
          blog_advice_id?: number | null
          content_type: string
          created_at?: string | null
          deadline?: string | null
          estimated_words?: number | null
          ga4_traffic?: number | null
          id?: number
          notes?: string | null
          pg_id?: number | null
          priority?: string | null
          seo_observable_id?: number | null
          seo_reference_id?: number | null
          slug?: string | null
          status?: string | null
          target_family?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          backlink_potential?: string | null
          blog_advice_id?: number | null
          content_type?: string
          created_at?: string | null
          deadline?: string | null
          estimated_words?: number | null
          ga4_traffic?: number | null
          id?: number
          notes?: string | null
          pg_id?: number | null
          priority?: string | null
          seo_observable_id?: number | null
          seo_reference_id?: number | null
          slug?: string | null
          status?: string | null
          target_family?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      __marketing_guest_posts: {
        Row: {
          anchor_text_used: string | null
          campaign_id: number | null
          content_md: string | null
          created_at: string | null
          da_score: number | null
          id: number
          notes: string | null
          outreach_id: number | null
          published_at: string | null
          published_url: string | null
          slug: string
          status: string | null
          target_site: string
          target_url_in_article: string | null
          title: string
          updated_at: string | null
          word_count: number | null
        }
        Insert: {
          anchor_text_used?: string | null
          campaign_id?: number | null
          content_md?: string | null
          created_at?: string | null
          da_score?: number | null
          id?: number
          notes?: string | null
          outreach_id?: number | null
          published_at?: string | null
          published_url?: string | null
          slug: string
          status?: string | null
          target_site: string
          target_url_in_article?: string | null
          title: string
          updated_at?: string | null
          word_count?: number | null
        }
        Update: {
          anchor_text_used?: string | null
          campaign_id?: number | null
          content_md?: string | null
          created_at?: string | null
          da_score?: number | null
          id?: number
          notes?: string | null
          outreach_id?: number | null
          published_at?: string | null
          published_url?: string | null
          slug?: string
          status?: string | null
          target_site?: string
          target_url_in_article?: string | null
          title?: string
          updated_at?: string | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "__marketing_guest_posts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "__marketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "__marketing_guest_posts_outreach_id_fkey"
            columns: ["outreach_id"]
            isOneToOne: false
            referencedRelation: "__marketing_outreach"
            referencedColumns: ["id"]
          },
        ]
      }
      __marketing_kpi_snapshots: {
        Row: {
          avg_position: number | null
          backlinks_da30plus: number | null
          content_coverage_pct: number | null
          created_at: string | null
          diagnostic_anchors: number | null
          guest_posts_published: number | null
          id: number
          indexed_pages: number | null
          notes: string | null
          organic_traffic: number | null
          outreach_accepted: number | null
          outreach_sent: number | null
          referring_domains: number | null
          snapshot_date: string
          total_backlinks: number | null
        }
        Insert: {
          avg_position?: number | null
          backlinks_da30plus?: number | null
          content_coverage_pct?: number | null
          created_at?: string | null
          diagnostic_anchors?: number | null
          guest_posts_published?: number | null
          id?: number
          indexed_pages?: number | null
          notes?: string | null
          organic_traffic?: number | null
          outreach_accepted?: number | null
          outreach_sent?: number | null
          referring_domains?: number | null
          snapshot_date: string
          total_backlinks?: number | null
        }
        Update: {
          avg_position?: number | null
          backlinks_da30plus?: number | null
          content_coverage_pct?: number | null
          created_at?: string | null
          diagnostic_anchors?: number | null
          guest_posts_published?: number | null
          id?: number
          indexed_pages?: number | null
          notes?: string | null
          organic_traffic?: number | null
          outreach_accepted?: number | null
          outreach_sent?: number | null
          referring_domains?: number | null
          snapshot_date?: string
          total_backlinks?: number | null
        }
        Relationships: []
      }
      __marketing_outreach: {
        Row: {
          campaign_id: number | null
          contact_email: string | null
          contact_name: string | null
          created_at: string | null
          followup_at: string | null
          id: number
          notes: string | null
          proposed_title: string | null
          responded_at: string | null
          result_url: string | null
          sent_at: string | null
          status: string | null
          subject_line: string | null
          target_da: number | null
          target_site: string
          template_type: string
          updated_at: string | null
        }
        Insert: {
          campaign_id?: number | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string | null
          followup_at?: string | null
          id?: number
          notes?: string | null
          proposed_title?: string | null
          responded_at?: string | null
          result_url?: string | null
          sent_at?: string | null
          status?: string | null
          subject_line?: string | null
          target_da?: number | null
          target_site: string
          template_type: string
          updated_at?: string | null
        }
        Update: {
          campaign_id?: number | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string | null
          followup_at?: string | null
          id?: number
          notes?: string | null
          proposed_title?: string | null
          responded_at?: string | null
          result_url?: string | null
          sent_at?: string | null
          status?: string | null
          subject_line?: string | null
          target_da?: number | null
          target_site?: string
          template_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "__marketing_outreach_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "__marketing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      __marketing_social_posts: {
        Row: {
          actual_clicks: number | null
          actual_conversions: number | null
          actual_engagement_rate: number | null
          actual_reach: number | null
          ai_model: string | null
          ai_provider: string | null
          approved_at: string | null
          approved_by: string | null
          brand_gate_level: string | null
          channels: Json
          channels_list: string[]
          compliance_gate_level: string | null
          content_source: string | null
          created_at: string | null
          day_of_week: number
          expected_clicks: number | null
          expected_reach: number | null
          gamme_alias: string | null
          gamme_id: number | null
          gate_summary: Json | null
          generation_prompt_hash: string | null
          id: number
          objective: string
          performance_score: number | null
          performance_updated_at: string | null
          primary_channel: string
          published_at: string | null
          quality_score: number | null
          reused: boolean | null
          slot_label: string
          source_url: string | null
          status: string
          updated_at: string | null
          utm_campaign: string
          utm_content: string | null
          utm_medium: string
          utm_source: string
          week_iso: string
        }
        Insert: {
          actual_clicks?: number | null
          actual_conversions?: number | null
          actual_engagement_rate?: number | null
          actual_reach?: number | null
          ai_model?: string | null
          ai_provider?: string | null
          approved_at?: string | null
          approved_by?: string | null
          brand_gate_level?: string | null
          channels?: Json
          channels_list?: string[]
          compliance_gate_level?: string | null
          content_source?: string | null
          created_at?: string | null
          day_of_week: number
          expected_clicks?: number | null
          expected_reach?: number | null
          gamme_alias?: string | null
          gamme_id?: number | null
          gate_summary?: Json | null
          generation_prompt_hash?: string | null
          id?: number
          objective: string
          performance_score?: number | null
          performance_updated_at?: string | null
          primary_channel: string
          published_at?: string | null
          quality_score?: number | null
          reused?: boolean | null
          slot_label: string
          source_url?: string | null
          status?: string
          updated_at?: string | null
          utm_campaign: string
          utm_content?: string | null
          utm_medium?: string
          utm_source: string
          week_iso: string
        }
        Update: {
          actual_clicks?: number | null
          actual_conversions?: number | null
          actual_engagement_rate?: number | null
          actual_reach?: number | null
          ai_model?: string | null
          ai_provider?: string | null
          approved_at?: string | null
          approved_by?: string | null
          brand_gate_level?: string | null
          channels?: Json
          channels_list?: string[]
          compliance_gate_level?: string | null
          content_source?: string | null
          created_at?: string | null
          day_of_week?: number
          expected_clicks?: number | null
          expected_reach?: number | null
          gamme_alias?: string | null
          gamme_id?: number | null
          gate_summary?: Json | null
          generation_prompt_hash?: string | null
          id?: number
          objective?: string
          performance_score?: number | null
          performance_updated_at?: string | null
          primary_channel?: string
          published_at?: string | null
          quality_score?: number | null
          reused?: boolean | null
          slot_label?: string
          source_url?: string | null
          status?: string
          updated_at?: string | null
          utm_campaign?: string
          utm_content?: string | null
          utm_medium?: string
          utm_source?: string
          week_iso?: string
        }
        Relationships: []
      }
      __marketing_utm_registry: {
        Row: {
          created_at: string | null
          ga4_clicks: number | null
          ga4_conversions: number | null
          ga4_last_synced: string | null
          ga4_revenue: number | null
          ga4_sessions: number | null
          id: number
          social_post_id: number | null
          target_url: string
          utm_campaign: string
          utm_content: string | null
          utm_medium: string
          utm_source: string
        }
        Insert: {
          created_at?: string | null
          ga4_clicks?: number | null
          ga4_conversions?: number | null
          ga4_last_synced?: string | null
          ga4_revenue?: number | null
          ga4_sessions?: number | null
          id?: number
          social_post_id?: number | null
          target_url: string
          utm_campaign: string
          utm_content?: string | null
          utm_medium: string
          utm_source: string
        }
        Update: {
          created_at?: string | null
          ga4_clicks?: number | null
          ga4_conversions?: number | null
          ga4_last_synced?: string | null
          ga4_revenue?: number | null
          ga4_sessions?: number | null
          id?: number
          social_post_id?: number | null
          target_url?: string
          utm_campaign?: string
          utm_content?: string | null
          utm_medium?: string
          utm_source?: string
        }
        Relationships: [
          {
            foreignKeyName: "__marketing_utm_registry_social_post_id_fkey"
            columns: ["social_post_id"]
            isOneToOne: false
            referencedRelation: "__marketing_social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      __marketing_weekly_plans: {
        Row: {
          calendar_rules: Json
          created_at: string | null
          id: number
          performance_summary: Json | null
          plan_json: Json
          posts_approved: number | null
          posts_generated: number | null
          posts_published: number | null
          priority_gammes: Json
          status: string
          updated_at: string | null
          week_iso: string
        }
        Insert: {
          calendar_rules: Json
          created_at?: string | null
          id?: number
          performance_summary?: Json | null
          plan_json: Json
          posts_approved?: number | null
          posts_generated?: number | null
          posts_published?: number | null
          priority_gammes: Json
          status?: string
          updated_at?: string | null
          week_iso: string
        }
        Update: {
          calendar_rules?: Json
          created_at?: string | null
          id?: number
          performance_summary?: Json | null
          plan_json?: Json
          posts_approved?: number | null
          posts_generated?: number | null
          posts_published?: number | null
          priority_gammes?: Json
          status?: string
          updated_at?: string | null
          week_iso?: string
        }
        Relationships: []
      }
      __qa_protected_meta_hash: {
        Row: {
          h1_override_backup: string | null
          h1_override_hash: string | null
          pg_alias: string
          pg_id: number
          ref_canonical_backup: string | null
          ref_hash: string | null
          ref_meta_backup: string | null
          ref_title_backup: string | null
          seo_descrip_backup: string | null
          seo_h1_backup: string | null
          seo_hash: string
          seo_title_backup: string | null
          snapshot_at: string
          verified_by: string
        }
        Insert: {
          h1_override_backup?: string | null
          h1_override_hash?: string | null
          pg_alias: string
          pg_id: number
          ref_canonical_backup?: string | null
          ref_hash?: string | null
          ref_meta_backup?: string | null
          ref_title_backup?: string | null
          seo_descrip_backup?: string | null
          seo_h1_backup?: string | null
          seo_hash: string
          seo_title_backup?: string | null
          snapshot_at?: string
          verified_by?: string
        }
        Update: {
          h1_override_backup?: string | null
          h1_override_hash?: string | null
          pg_alias?: string
          pg_id?: number
          ref_canonical_backup?: string | null
          ref_hash?: string | null
          ref_meta_backup?: string | null
          ref_title_backup?: string | null
          seo_descrip_backup?: string | null
          seo_h1_backup?: string | null
          seo_hash?: string
          seo_title_backup?: string | null
          snapshot_at?: string
          verified_by?: string
        }
        Relationships: []
      }
      __quality_gamme_scores: {
        Row: {
          business_value: number
          composite_score: number
          computed_at: string
          confidence_score: number
          coverage_penalty: number
          family_name: string | null
          gamme_score: number
          id: number
          missing_page_types: Json
          page_scores_summary: Json
          pages_expected: number
          pages_scored: number
          pg_alias: string
          pg_id: number
          priority: string
          product_count: number
          score_version: string
          status: string
          top_actions: Json
          top_reasons: Json
        }
        Insert: {
          business_value?: number
          composite_score?: number
          computed_at?: string
          confidence_score?: number
          coverage_penalty?: number
          family_name?: string | null
          gamme_score?: number
          id?: never
          missing_page_types?: Json
          page_scores_summary?: Json
          pages_expected?: number
          pages_scored?: number
          pg_alias: string
          pg_id: number
          priority?: string
          product_count?: number
          score_version?: string
          status?: string
          top_actions?: Json
          top_reasons?: Json
        }
        Update: {
          business_value?: number
          composite_score?: number
          computed_at?: string
          confidence_score?: number
          coverage_penalty?: number
          family_name?: string | null
          gamme_score?: number
          id?: never
          missing_page_types?: Json
          page_scores_summary?: Json
          pages_expected?: number
          pages_scored?: number
          pg_alias?: string
          pg_id?: number
          priority?: string
          product_count?: number
          score_version?: string
          status?: string
          top_actions?: Json
          top_reasons?: Json
        }
        Relationships: [
          {
            foreignKeyName: "__quality_gamme_scores_pg_id_fkey"
            columns: ["pg_id"]
            isOneToOne: true
            referencedRelation: "__pg_gammes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "__quality_gamme_scores_pg_id_fkey"
            columns: ["pg_id"]
            isOneToOne: true
            referencedRelation: "__pg_gammes"
            referencedColumns: ["position"]
          },
          {
            foreignKeyName: "__quality_gamme_scores_pg_id_fkey"
            columns: ["pg_id"]
            isOneToOne: true
            referencedRelation: "pieces_gamme"
            referencedColumns: ["pg_id"]
          },
        ]
      }
      __quality_page_scores: {
        Row: {
          computed_at: string
          confidence_score: number
          features: Json
          hard_gate_status: string
          id: number
          next_actions: Json
          page_type: string
          penalties: Json
          pg_id: number
          priority: string
          quality_score: number
          reasons: Json
          score_version: string
          status: string
          subscores: Json
        }
        Insert: {
          computed_at?: string
          confidence_score?: number
          features?: Json
          hard_gate_status?: string
          id?: never
          next_actions?: Json
          page_type: string
          penalties?: Json
          pg_id: number
          priority?: string
          quality_score?: number
          reasons?: Json
          score_version?: string
          status?: string
          subscores?: Json
        }
        Update: {
          computed_at?: string
          confidence_score?: number
          features?: Json
          hard_gate_status?: string
          id?: never
          next_actions?: Json
          page_type?: string
          penalties?: Json
          pg_id?: number
          priority?: string
          quality_score?: number
          reasons?: Json
          score_version?: string
          status?: string
          subscores?: Json
        }
        Relationships: [
          {
            foreignKeyName: "__quality_page_scores_pg_id_fkey"
            columns: ["pg_id"]
            isOneToOne: false
            referencedRelation: "__pg_gammes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "__quality_page_scores_pg_id_fkey"
            columns: ["pg_id"]
            isOneToOne: false
            referencedRelation: "__pg_gammes"
            referencedColumns: ["position"]
          },
          {
            foreignKeyName: "__quality_page_scores_pg_id_fkey"
            columns: ["pg_id"]
            isOneToOne: false
            referencedRelation: "pieces_gamme"
            referencedColumns: ["pg_id"]
          },
        ]
      }
      __quarantine_history: {
        Row: {
          qh_action: string
          qh_changed_by: string | null
          qh_created_at: string
          qh_id: number
          qh_new_status: string | null
          qh_notes: string | null
          qh_old_status: string | null
          qh_quarantine_id: number
        }
        Insert: {
          qh_action: string
          qh_changed_by?: string | null
          qh_created_at?: string
          qh_id?: number
          qh_new_status?: string | null
          qh_notes?: string | null
          qh_old_status?: string | null
          qh_quarantine_id: number
        }
        Update: {
          qh_action?: string
          qh_changed_by?: string | null
          qh_created_at?: string
          qh_id?: number
          qh_new_status?: string | null
          qh_notes?: string | null
          qh_old_status?: string | null
          qh_quarantine_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "__quarantine_history_qh_quarantine_id_fkey"
            columns: ["qh_quarantine_id"]
            isOneToOne: false
            referencedRelation: "__quarantine_items"
            referencedColumns: ["q_id"]
          },
        ]
      }
      __quarantine_items: {
        Row: {
          q_batch_id: number
          q_created_at: string
          q_entity_type: string
          q_exclude_display: boolean
          q_exclude_purchase: boolean
          q_exclude_seo: boolean
          q_id: number
          q_internal_id: number | null
          q_priority: number
          q_proposed_action: string | null
          q_proposed_internal_id: number | null
          q_reason: string
          q_reason_details: Json | null
          q_resolution_notes: string | null
          q_resolved_at: string | null
          q_reviewed_at: string | null
          q_reviewed_by: string | null
          q_source_key: string
          q_status: string
          q_updated_at: string
        }
        Insert: {
          q_batch_id: number
          q_created_at?: string
          q_entity_type: string
          q_exclude_display?: boolean
          q_exclude_purchase?: boolean
          q_exclude_seo?: boolean
          q_id?: number
          q_internal_id?: number | null
          q_priority?: number
          q_proposed_action?: string | null
          q_proposed_internal_id?: number | null
          q_reason: string
          q_reason_details?: Json | null
          q_resolution_notes?: string | null
          q_resolved_at?: string | null
          q_reviewed_at?: string | null
          q_reviewed_by?: string | null
          q_source_key: string
          q_status?: string
          q_updated_at?: string
        }
        Update: {
          q_batch_id?: number
          q_created_at?: string
          q_entity_type?: string
          q_exclude_display?: boolean
          q_exclude_purchase?: boolean
          q_exclude_seo?: boolean
          q_id?: number
          q_internal_id?: number | null
          q_priority?: number
          q_proposed_action?: string | null
          q_proposed_internal_id?: number | null
          q_reason?: string
          q_reason_details?: Json | null
          q_resolution_notes?: string | null
          q_resolved_at?: string | null
          q_reviewed_at?: string | null
          q_reviewed_by?: string | null
          q_source_key?: string
          q_status?: string
          q_updated_at?: string
        }
        Relationships: []
      }
      __quarantine_rules: {
        Row: {
          qr_action: string
          qr_condition: Json
          qr_created_at: string
          qr_description: string | null
          qr_enabled: boolean
          qr_entity_type: string
          qr_id: number
          qr_name: string
          qr_priority: number
          qr_reason: string
        }
        Insert: {
          qr_action: string
          qr_condition: Json
          qr_created_at?: string
          qr_description?: string | null
          qr_enabled?: boolean
          qr_entity_type: string
          qr_id?: number
          qr_name: string
          qr_priority?: number
          qr_reason: string
        }
        Update: {
          qr_action?: string
          qr_condition?: Json
          qr_created_at?: string
          qr_description?: string | null
          qr_enabled?: boolean
          qr_entity_type?: string
          qr_id?: number
          qr_name?: string
          qr_priority?: number
          qr_reason?: string
        }
        Relationships: []
      }
      __rag_content_refresh_log: {
        Row: {
          brief_id: number | null
          brief_version: number | null
          bullmq_job_id: string | null
          completed_at: string | null
          content_fingerprint: Json | null
          correlation_id: string | null
          created_at: string | null
          error_message: string | null
          evidence_pack: Json | null
          evidence_pack_hash: string | null
          gate_results: Json | null
          hard_gate_results: Json | null
          id: number
          ingestion_recommendations: string[] | null
          page_type: string
          pg_alias: string
          pg_id: number
          published_at: string | null
          published_by: string | null
          quality_flags: Json | null
          quality_score: number | null
          rag_doc_ids: string[] | null
          repair_attempts: Json | null
          started_at: string | null
          status: string
          trigger_job_id: string | null
          trigger_source: string
        }
        Insert: {
          brief_id?: number | null
          brief_version?: number | null
          bullmq_job_id?: string | null
          completed_at?: string | null
          content_fingerprint?: Json | null
          correlation_id?: string | null
          created_at?: string | null
          error_message?: string | null
          evidence_pack?: Json | null
          evidence_pack_hash?: string | null
          gate_results?: Json | null
          hard_gate_results?: Json | null
          id?: number
          ingestion_recommendations?: string[] | null
          page_type: string
          pg_alias: string
          pg_id: number
          published_at?: string | null
          published_by?: string | null
          quality_flags?: Json | null
          quality_score?: number | null
          rag_doc_ids?: string[] | null
          repair_attempts?: Json | null
          started_at?: string | null
          status?: string
          trigger_job_id?: string | null
          trigger_source: string
        }
        Update: {
          brief_id?: number | null
          brief_version?: number | null
          bullmq_job_id?: string | null
          completed_at?: string | null
          content_fingerprint?: Json | null
          correlation_id?: string | null
          created_at?: string | null
          error_message?: string | null
          evidence_pack?: Json | null
          evidence_pack_hash?: string | null
          gate_results?: Json | null
          hard_gate_results?: Json | null
          id?: number
          ingestion_recommendations?: string[] | null
          page_type?: string
          pg_alias?: string
          pg_id?: number
          published_at?: string | null
          published_by?: string | null
          quality_flags?: Json | null
          quality_score?: number | null
          rag_doc_ids?: string[] | null
          repair_attempts?: Json | null
          started_at?: string | null
          status?: string
          trigger_job_id?: string | null
          trigger_source?: string
        }
        Relationships: [
          {
            foreignKeyName: "__rag_content_refresh_log_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "__seo_page_brief"
            referencedColumns: ["id"]
          },
        ]
      }
      __rag_knowledge: {
        Row: {
          category: string | null
          content: string
          content_tsv: unknown
          created_at: string | null
          domain: string | null
          fingerprint: string | null
          id: string
          quarantine_reason: string | null
          retrievable: boolean | null
          source: string
          status: string | null
          title: string
          truth_level: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          content: string
          content_tsv?: unknown
          created_at?: string | null
          domain?: string | null
          fingerprint?: string | null
          id?: string
          quarantine_reason?: string | null
          retrievable?: boolean | null
          source: string
          status?: string | null
          title: string
          truth_level?: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          content?: string
          content_tsv?: unknown
          created_at?: string | null
          domain?: string | null
          fingerprint?: string | null
          id?: string
          quarantine_reason?: string | null
          retrievable?: boolean | null
          source?: string
          status?: string | null
          title?: string
          truth_level?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      __rag_knowledge_backup_20260222: {
        Row: {
          category: string | null
          content: string | null
          content_tsv: unknown
          created_at: string | null
          domain: string | null
          fingerprint: string | null
          id: string | null
          retrievable: boolean | null
          source: string | null
          status: string | null
          title: string | null
          truth_level: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          content?: string | null
          content_tsv?: unknown
          created_at?: string | null
          domain?: string | null
          fingerprint?: string | null
          id?: string | null
          retrievable?: boolean | null
          source?: string | null
          status?: string | null
          title?: string | null
          truth_level?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          content?: string | null
          content_tsv?: unknown
          created_at?: string | null
          domain?: string | null
          fingerprint?: string | null
          id?: string | null
          retrievable?: boolean | null
          source?: string | null
          status?: string | null
          title?: string | null
          truth_level?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      __rag_webhook_audit: {
        Row: {
          diagnostics_detected: string[] | null
          error_message: string | null
          event_emitted: boolean
          files_created: string[] | null
          gammes_detected: string[] | null
          id: number
          job_id: string
          processing_ms: number | null
          received_at: string
          source: string
          status: string
        }
        Insert: {
          diagnostics_detected?: string[] | null
          error_message?: string | null
          event_emitted?: boolean
          files_created?: string[] | null
          gammes_detected?: string[] | null
          id?: number
          job_id: string
          processing_ms?: number | null
          received_at?: string
          source: string
          status: string
        }
        Update: {
          diagnostics_detected?: string[] | null
          error_message?: string | null
          event_emitted?: boolean
          files_created?: string[] | null
          gammes_detected?: string[] | null
          id?: number
          job_id?: string
          processing_ms?: number | null
          received_at?: string
          source?: string
          status?: string
        }
        Relationships: []
      }
      __seo_action_definitions: {
        Row: {
          sad_code: string
          sad_created_at: string | null
          sad_description: string | null
          sad_enabled: boolean | null
          sad_indexable: boolean | null
          sad_points: number
          sad_severity: string
          sad_updated_at: string | null
        }
        Insert: {
          sad_code: string
          sad_created_at?: string | null
          sad_description?: string | null
          sad_enabled?: boolean | null
          sad_indexable?: boolean | null
          sad_points: number
          sad_severity: string
          sad_updated_at?: string | null
        }
        Update: {
          sad_code?: string
          sad_created_at?: string | null
          sad_description?: string | null
          sad_enabled?: boolean | null
          sad_indexable?: boolean | null
          sad_points?: number
          sad_severity?: string
          sad_updated_at?: string | null
        }
        Relationships: []
      }
      __seo_ambiguous_terms: {
        Row: {
          sat_category: string
          sat_content_hash: string | null
          sat_context_window: number | null
          sat_created_at: string | null
          sat_enabled: boolean | null
          sat_id: number
          sat_last_sync_at: string | null
          sat_last_sync_run_id: string | null
          sat_message_fr: string | null
          sat_penalty: number | null
          sat_required_contexts: string[]
          sat_severity: string | null
          sat_term: string
        }
        Insert: {
          sat_category: string
          sat_content_hash?: string | null
          sat_context_window?: number | null
          sat_created_at?: string | null
          sat_enabled?: boolean | null
          sat_id?: number
          sat_last_sync_at?: string | null
          sat_last_sync_run_id?: string | null
          sat_message_fr?: string | null
          sat_penalty?: number | null
          sat_required_contexts: string[]
          sat_severity?: string | null
          sat_term: string
        }
        Update: {
          sat_category?: string
          sat_content_hash?: string | null
          sat_context_window?: number | null
          sat_created_at?: string | null
          sat_enabled?: boolean | null
          sat_id?: number
          sat_last_sync_at?: string | null
          sat_last_sync_run_id?: string | null
          sat_message_fr?: string | null
          sat_penalty?: number | null
          sat_required_contexts?: string[]
          sat_severity?: string | null
          sat_term?: string
        }
        Relationships: []
      }
      __seo_audit_log: {
        Row: {
          sal_action: string | null
          sal_after: Json | null
          sal_before: Json | null
          sal_context: Json | null
          sal_created_at: string | null
          sal_field: string | null
          sal_id: number
          sal_log_type: string
          sal_record_id: string | null
          sal_rules_triggered: string[] | null
          sal_score_after: number | null
          sal_score_before: number | null
          sal_table_name: string | null
        }
        Insert: {
          sal_action?: string | null
          sal_after?: Json | null
          sal_before?: Json | null
          sal_context?: Json | null
          sal_created_at?: string | null
          sal_field?: string | null
          sal_id?: number
          sal_log_type: string
          sal_record_id?: string | null
          sal_rules_triggered?: string[] | null
          sal_score_after?: number | null
          sal_score_before?: number | null
          sal_table_name?: string | null
        }
        Update: {
          sal_action?: string | null
          sal_after?: Json | null
          sal_before?: Json | null
          sal_context?: Json | null
          sal_created_at?: string | null
          sal_field?: string | null
          sal_id?: number
          sal_log_type?: string
          sal_record_id?: string | null
          sal_rules_triggered?: string[] | null
          sal_score_after?: number | null
          sal_score_before?: number | null
          sal_table_name?: string | null
        }
        Relationships: []
      }
      __seo_b2_forbidden_zones: {
        Row: {
          sfz_description: string | null
          sfz_zone: string
        }
        Insert: {
          sfz_description?: string | null
          sfz_zone: string
        }
        Update: {
          sfz_description?: string | null
          sfz_zone?: string
        }
        Relationships: []
      }
      __seo_brief_template: {
        Row: {
          created_at: string | null
          family_id: number
          family_label: string | null
          id: number
          page_role: string
          status: string | null
          template_json: Json
          updated_at: string | null
          version: number | null
        }
        Insert: {
          created_at?: string | null
          family_id: number
          family_label?: string | null
          id?: number
          page_role: string
          status?: string | null
          template_json: Json
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          created_at?: string | null
          family_id?: number
          family_label?: string | null
          id?: number
          page_role?: string
          status?: string | null
          template_json?: Json
          updated_at?: string | null
          version?: number | null
        }
        Relationships: []
      }
      __seo_business_rules: {
        Row: {
          sbr_action: Json
          sbr_category: string
          sbr_code: string
          sbr_condition: Json
          sbr_contexts: string[] | null
          sbr_created_at: string | null
          sbr_created_by: string | null
          sbr_description: string | null
          sbr_enabled: boolean | null
          sbr_famille: string | null
          sbr_gammes: number[] | null
          sbr_id: number
          sbr_messages: Json
          sbr_name: string
          sbr_priority: number
          sbr_updated_at: string | null
        }
        Insert: {
          sbr_action: Json
          sbr_category: string
          sbr_code: string
          sbr_condition: Json
          sbr_contexts?: string[] | null
          sbr_created_at?: string | null
          sbr_created_by?: string | null
          sbr_description?: string | null
          sbr_enabled?: boolean | null
          sbr_famille?: string | null
          sbr_gammes?: number[] | null
          sbr_id?: number
          sbr_messages?: Json
          sbr_name: string
          sbr_priority?: number
          sbr_updated_at?: string | null
        }
        Update: {
          sbr_action?: Json
          sbr_category?: string
          sbr_code?: string
          sbr_condition?: Json
          sbr_contexts?: string[] | null
          sbr_created_at?: string | null
          sbr_created_by?: string | null
          sbr_description?: string | null
          sbr_enabled?: boolean | null
          sbr_famille?: string | null
          sbr_gammes?: number[] | null
          sbr_id?: number
          sbr_messages?: Json
          sbr_name?: string
          sbr_priority?: number
          sbr_updated_at?: string | null
        }
        Relationships: []
      }
      __seo_claims_config: {
        Row: {
          scc_category: string
          scc_claim: string
          scc_created_at: string | null
          scc_enabled: boolean | null
          scc_id: number
          scc_level: number
          scc_max_occurrences: number | null
          scc_message_fr: string | null
          scc_proofs: string[] | null
          scc_zones_allowed: string[] | null
        }
        Insert: {
          scc_category: string
          scc_claim: string
          scc_created_at?: string | null
          scc_enabled?: boolean | null
          scc_id?: number
          scc_level: number
          scc_max_occurrences?: number | null
          scc_message_fr?: string | null
          scc_proofs?: string[] | null
          scc_zones_allowed?: string[] | null
        }
        Update: {
          scc_category?: string
          scc_claim?: string
          scc_created_at?: string | null
          scc_enabled?: boolean | null
          scc_id?: number
          scc_level?: number
          scc_max_occurrences?: number | null
          scc_message_fr?: string | null
          scc_proofs?: string[] | null
          scc_zones_allowed?: string[] | null
        }
        Relationships: []
      }
      __seo_claims_tiered: {
        Row: {
          sct_created_at: string | null
          sct_description: string | null
          sct_enabled: boolean | null
          sct_family: string | null
          sct_id: number
          sct_is_blocking: boolean | null
          sct_level: number
          sct_pattern: string
          sct_penalty: number | null
          sct_suggestion: string | null
        }
        Insert: {
          sct_created_at?: string | null
          sct_description?: string | null
          sct_enabled?: boolean | null
          sct_family?: string | null
          sct_id?: number
          sct_is_blocking?: boolean | null
          sct_level: number
          sct_pattern: string
          sct_penalty?: number | null
          sct_suggestion?: string | null
        }
        Update: {
          sct_created_at?: string | null
          sct_description?: string | null
          sct_enabled?: boolean | null
          sct_family?: string | null
          sct_id?: number
          sct_is_blocking?: boolean | null
          sct_level?: number
          sct_pattern?: string
          sct_penalty?: number | null
          sct_suggestion?: string | null
        }
        Relationships: []
      }
      __seo_compatibility_mention_patterns: {
        Row: {
          scmp_description: string | null
          scmp_enabled: boolean | null
          scmp_id: number
          scmp_pattern: string
        }
        Insert: {
          scmp_description?: string | null
          scmp_enabled?: boolean | null
          scmp_id?: number
          scmp_pattern: string
        }
        Update: {
          scmp_description?: string | null
          scmp_enabled?: boolean | null
          scmp_id?: number
          scmp_pattern?: string
        }
        Relationships: []
      }
      __seo_compatibility_proof_types: {
        Row: {
          scpt_code: string
          scpt_created_at: string | null
          scpt_description: string | null
          scpt_enabled: boolean | null
          scpt_id: number
          scpt_name: string
          scpt_patterns: string[]
          scpt_weight: number | null
          scpt_zones_recommended: string[] | null
        }
        Insert: {
          scpt_code: string
          scpt_created_at?: string | null
          scpt_description?: string | null
          scpt_enabled?: boolean | null
          scpt_id?: number
          scpt_name: string
          scpt_patterns: string[]
          scpt_weight?: number | null
          scpt_zones_recommended?: string[] | null
        }
        Update: {
          scpt_code?: string
          scpt_created_at?: string | null
          scpt_description?: string | null
          scpt_enabled?: boolean | null
          scpt_id?: number
          scpt_name?: string
          scpt_patterns?: string[]
          scpt_weight?: number | null
          scpt_zones_recommended?: string[] | null
        }
        Relationships: []
      }
      __seo_confusion_pairs: {
        Row: {
          scp_category: string
          scp_content_hash: string | null
          scp_created_at: string | null
          scp_critical_blocking: boolean | null
          scp_enabled: boolean | null
          scp_id: number
          scp_last_sync_at: string | null
          scp_last_sync_run_id: string | null
          scp_message_fr: string | null
          scp_penalty_critical: number | null
          scp_penalty_secondary: number | null
          scp_piece_a: string
          scp_piece_b: string
          scp_severity: string
        }
        Insert: {
          scp_category: string
          scp_content_hash?: string | null
          scp_created_at?: string | null
          scp_critical_blocking?: boolean | null
          scp_enabled?: boolean | null
          scp_id?: number
          scp_last_sync_at?: string | null
          scp_last_sync_run_id?: string | null
          scp_message_fr?: string | null
          scp_penalty_critical?: number | null
          scp_penalty_secondary?: number | null
          scp_piece_a: string
          scp_piece_b: string
          scp_severity: string
        }
        Update: {
          scp_category?: string
          scp_content_hash?: string | null
          scp_created_at?: string | null
          scp_critical_blocking?: boolean | null
          scp_enabled?: boolean | null
          scp_id?: number
          scp_last_sync_at?: string | null
          scp_last_sync_run_id?: string | null
          scp_message_fr?: string | null
          scp_penalty_critical?: number | null
          scp_penalty_secondary?: number | null
          scp_piece_a?: string
          scp_piece_b?: string
          scp_severity?: string
        }
        Relationships: []
      }
      __seo_content_length_config: {
        Row: {
          sclc_created_at: string | null
          sclc_enabled: boolean | null
          sclc_is_blocking: boolean | null
          sclc_max_length: number | null
          sclc_min_length: number | null
          sclc_penalty_long: number | null
          sclc_penalty_short: number | null
          sclc_zone: string
        }
        Insert: {
          sclc_created_at?: string | null
          sclc_enabled?: boolean | null
          sclc_is_blocking?: boolean | null
          sclc_max_length?: number | null
          sclc_min_length?: number | null
          sclc_penalty_long?: number | null
          sclc_penalty_short?: number | null
          sclc_zone: string
        }
        Update: {
          sclc_created_at?: string | null
          sclc_enabled?: boolean | null
          sclc_is_blocking?: boolean | null
          sclc_max_length?: number | null
          sclc_min_length?: number | null
          sclc_penalty_long?: number | null
          sclc_penalty_short?: number | null
          sclc_zone?: string
        }
        Relationships: []
      }
      __seo_contradiction_pairs: {
        Row: {
          scp_context: string | null
          scp_created_at: string | null
          scp_enabled: boolean | null
          scp_id: number
          scp_severity: string | null
          scp_term_a: string
          scp_term_b: string
        }
        Insert: {
          scp_context?: string | null
          scp_created_at?: string | null
          scp_enabled?: boolean | null
          scp_id?: number
          scp_severity?: string | null
          scp_term_a: string
          scp_term_b: string
        }
        Update: {
          scp_context?: string | null
          scp_created_at?: string | null
          scp_enabled?: boolean | null
          scp_id?: number
          scp_severity?: string | null
          scp_term_a?: string
          scp_term_b?: string
        }
        Relationships: []
      }
      __seo_cooccurrence_rules: {
        Row: {
          scr_contexts: string[] | null
          scr_created_at: string | null
          scr_enabled: boolean | null
          scr_gamme_name: string | null
          scr_id: number
          scr_message_forbidden: string | null
          scr_message_missing: string | null
          scr_message_suggestion: string | null
          scr_pg_id: number
          scr_relation: string
          scr_severity: string | null
          scr_target_pg_id: number | null
          scr_target_term: string | null
          scr_target_terms: string[] | null
        }
        Insert: {
          scr_contexts?: string[] | null
          scr_created_at?: string | null
          scr_enabled?: boolean | null
          scr_gamme_name?: string | null
          scr_id?: number
          scr_message_forbidden?: string | null
          scr_message_missing?: string | null
          scr_message_suggestion?: string | null
          scr_pg_id: number
          scr_relation: string
          scr_severity?: string | null
          scr_target_pg_id?: number | null
          scr_target_term?: string | null
          scr_target_terms?: string[] | null
        }
        Update: {
          scr_contexts?: string[] | null
          scr_created_at?: string | null
          scr_enabled?: boolean | null
          scr_gamme_name?: string | null
          scr_id?: number
          scr_message_forbidden?: string | null
          scr_message_missing?: string | null
          scr_message_suggestion?: string | null
          scr_pg_id?: number
          scr_relation?: string
          scr_severity?: string | null
          scr_target_pg_id?: number | null
          scr_target_term?: string | null
          scr_target_terms?: string[] | null
        }
        Relationships: []
      }
      __seo_crawl_hub: {
        Row: {
          bucket: string
          depth: number | null
          generated_at: string
          hub_type: string
          id: number
          path: string
          urls_count: number
        }
        Insert: {
          bucket: string
          depth?: number | null
          generated_at?: string
          hub_type: string
          id?: number
          path: string
          urls_count: number
        }
        Update: {
          bucket?: string
          depth?: number | null
          generated_at?: string
          hub_type?: string
          id?: number
          path?: string
          urls_count?: number
        }
        Relationships: []
      }
      __seo_crawl_log: {
        Row: {
          bot_name: string | null
          bytes_sent: number | null
          content_type: string | null
          crawled_at: string
          id: number
          is_googlebot: boolean
          referer: string | null
          request_method: string | null
          response_ms: number | null
          status_code: number | null
          url: string
          user_agent: string
        }
        Insert: {
          bot_name?: string | null
          bytes_sent?: number | null
          content_type?: string | null
          crawled_at?: string
          id?: number
          is_googlebot?: boolean
          referer?: string | null
          request_method?: string | null
          response_ms?: number | null
          status_code?: number | null
          url: string
          user_agent: string
        }
        Update: {
          bot_name?: string | null
          bytes_sent?: number | null
          content_type?: string | null
          crawled_at?: string
          id?: number
          is_googlebot?: boolean
          referer?: string | null
          request_method?: string | null
          response_ms?: number | null
          status_code?: number | null
          url?: string
          user_agent?: string
        }
        Relationships: []
      }
      __seo_duplicate_config: {
        Row: {
          sdc_description: string | null
          sdc_enabled: boolean | null
          sdc_id: number
          sdc_penalty: number | null
          sdc_severity: string | null
          sdc_similarity_threshold: number | null
          sdc_zone_a: string
          sdc_zone_b: string
        }
        Insert: {
          sdc_description?: string | null
          sdc_enabled?: boolean | null
          sdc_id?: number
          sdc_penalty?: number | null
          sdc_severity?: string | null
          sdc_similarity_threshold?: number | null
          sdc_zone_a: string
          sdc_zone_b: string
        }
        Update: {
          sdc_description?: string | null
          sdc_enabled?: boolean | null
          sdc_id?: number
          sdc_penalty?: number | null
          sdc_severity?: string | null
          sdc_similarity_threshold?: number | null
          sdc_zone_a?: string
          sdc_zone_b?: string
        }
        Relationships: []
      }
      __seo_entity: {
        Row: {
          canonical_url: string
          created_at: string
          entity_type: string
          h1: string | null
          id: number
          is_active: boolean
          is_indexable: boolean
          meta_description: string | null
          parent_entity_id: number | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          canonical_url: string
          created_at?: string
          entity_type: string
          h1?: string | null
          id?: number
          is_active?: boolean
          is_indexable?: boolean
          meta_description?: string | null
          parent_entity_id?: number | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          canonical_url?: string
          created_at?: string
          entity_type?: string
          h1?: string | null
          id?: number
          is_active?: boolean
          is_indexable?: boolean
          meta_description?: string | null
          parent_entity_id?: number | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "__seo_entity_parent_entity_id_fkey"
            columns: ["parent_entity_id"]
            isOneToOne: false
            referencedRelation: "__seo_entity"
            referencedColumns: ["id"]
          },
        ]
      }
      __seo_entity_score_v10: {
        Row: {
          bucket: string | null
          business_score: number
          cannibalization_risk: number
          cluster_size: number
          confusion_risk: number
          content_score: number
          demand_score: number
          duplication_risk: number
          entity_id: number | null
          id: number
          inbound_links: number
          last_calculated_at: string | null
          orphan_risk: number
          outbound_links: number
          score_backlinks: number
          score_conversion: number
          score_freshness: number
          score_internal: number
          score_revenue: number
          score_total: number | null
          score_traffic: number
          updated_at: string
          url: string | null
        }
        Insert: {
          bucket?: string | null
          business_score?: number
          cannibalization_risk?: number
          cluster_size?: number
          confusion_risk?: number
          content_score?: number
          demand_score?: number
          duplication_risk?: number
          entity_id?: number | null
          id?: number
          inbound_links?: number
          last_calculated_at?: string | null
          orphan_risk?: number
          outbound_links?: number
          score_backlinks?: number
          score_conversion?: number
          score_freshness?: number
          score_internal?: number
          score_revenue?: number
          score_total?: number | null
          score_traffic?: number
          updated_at?: string
          url?: string | null
        }
        Update: {
          bucket?: string | null
          business_score?: number
          cannibalization_risk?: number
          cluster_size?: number
          confusion_risk?: number
          content_score?: number
          demand_score?: number
          duplication_risk?: number
          entity_id?: number | null
          id?: number
          inbound_links?: number
          last_calculated_at?: string | null
          orphan_risk?: number
          outbound_links?: number
          score_backlinks?: number
          score_conversion?: number
          score_freshness?: number
          score_internal?: number
          score_revenue?: number
          score_total?: number | null
          score_traffic?: number
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "__seo_entity_score_v10_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "__seo_entity"
            referencedColumns: ["id"]
          },
        ]
      }
      __seo_equip_gamme: {
        Row: {
          seg_content: string | null
          seg_id: string
          seg_pg_id: string
          seg_pm_id: string
        }
        Insert: {
          seg_content?: string | null
          seg_id: string
          seg_pg_id: string
          seg_pm_id: string
        }
        Update: {
          seg_content?: string | null
          seg_id?: string
          seg_pg_id?: string
          seg_pm_id?: string
        }
        Relationships: []
      }
      __seo_family_checklist: {
        Row: {
          sfc_created_at: string | null
          sfc_enabled: boolean | null
          sfc_family: string
          sfc_field: string
          sfc_id: number
          sfc_label_fr: string | null
          sfc_weight: number
        }
        Insert: {
          sfc_created_at?: string | null
          sfc_enabled?: boolean | null
          sfc_family: string
          sfc_field: string
          sfc_id?: number
          sfc_label_fr?: string | null
          sfc_weight: number
        }
        Update: {
          sfc_created_at?: string | null
          sfc_enabled?: boolean | null
          sfc_family?: string
          sfc_field?: string
          sfc_id?: number
          sfc_label_fr?: string | null
          sfc_weight?: number
        }
        Relationships: []
      }
      __seo_family_gamme_car_switch: {
        Row: {
          sfgcs_alias: string | null
          sfgcs_content: string | null
          sfgcs_id: string
          sfgcs_mf_id: string
          sfgcs_pg_id: string
        }
        Insert: {
          sfgcs_alias?: string | null
          sfgcs_content?: string | null
          sfgcs_id: string
          sfgcs_mf_id: string
          sfgcs_pg_id: string
        }
        Update: {
          sfgcs_alias?: string | null
          sfgcs_content?: string | null
          sfgcs_id?: string
          sfgcs_mf_id?: string
          sfgcs_pg_id?: string
        }
        Relationships: []
      }
      __seo_family_required_fields: {
        Row: {
          sfrf_created_at: string | null
          sfrf_description: string | null
          sfrf_enabled: boolean | null
          sfrf_family: string
          sfrf_field_name: string
          sfrf_field_pattern: string
          sfrf_gamme_pattern: string | null
          sfrf_id: number
          sfrf_is_critical: boolean | null
          sfrf_unit: string | null
          sfrf_validation_regex: string | null
          sfrf_weight: number | null
        }
        Insert: {
          sfrf_created_at?: string | null
          sfrf_description?: string | null
          sfrf_enabled?: boolean | null
          sfrf_family: string
          sfrf_field_name: string
          sfrf_field_pattern: string
          sfrf_gamme_pattern?: string | null
          sfrf_id?: number
          sfrf_is_critical?: boolean | null
          sfrf_unit?: string | null
          sfrf_validation_regex?: string | null
          sfrf_weight?: number | null
        }
        Update: {
          sfrf_created_at?: string | null
          sfrf_description?: string | null
          sfrf_enabled?: boolean | null
          sfrf_family?: string
          sfrf_field_name?: string
          sfrf_field_pattern?: string
          sfrf_gamme_pattern?: string | null
          sfrf_id?: number
          sfrf_is_critical?: boolean | null
          sfrf_unit?: string | null
          sfrf_validation_regex?: string | null
          sfrf_weight?: number | null
        }
        Relationships: []
      }
      __seo_gamme: {
        Row: {
          sg_content: string | null
          sg_content_draft: string | null
          sg_descrip: string | null
          sg_descrip_draft: string | null
          sg_draft_llm_model: string | null
          sg_draft_source: string | null
          sg_draft_updated_at: string | null
          sg_h1: string | null
          sg_id: string
          sg_keywords: string | null
          sg_pg_id: string
          sg_title: string | null
        }
        Insert: {
          sg_content?: string | null
          sg_content_draft?: string | null
          sg_descrip?: string | null
          sg_descrip_draft?: string | null
          sg_draft_llm_model?: string | null
          sg_draft_source?: string | null
          sg_draft_updated_at?: string | null
          sg_h1?: string | null
          sg_id: string
          sg_keywords?: string | null
          sg_pg_id: string
          sg_title?: string | null
        }
        Update: {
          sg_content?: string | null
          sg_content_draft?: string | null
          sg_descrip?: string | null
          sg_descrip_draft?: string | null
          sg_draft_llm_model?: string | null
          sg_draft_source?: string | null
          sg_draft_updated_at?: string | null
          sg_h1?: string | null
          sg_id?: string
          sg_keywords?: string | null
          sg_pg_id?: string
          sg_title?: string | null
        }
        Relationships: []
      }
      __seo_gamme_car: {
        Row: {
          sgc_content: string | null
          sgc_descrip: string | null
          sgc_h1: string | null
          sgc_id: string
          sgc_pg_id: string
          sgc_preview: string | null
          sgc_title: string | null
        }
        Insert: {
          sgc_content?: string | null
          sgc_descrip?: string | null
          sgc_h1?: string | null
          sgc_id: string
          sgc_pg_id: string
          sgc_preview?: string | null
          sgc_title?: string | null
        }
        Update: {
          sgc_content?: string | null
          sgc_descrip?: string | null
          sgc_h1?: string | null
          sgc_id?: string
          sgc_pg_id?: string
          sgc_preview?: string | null
          sgc_title?: string | null
        }
        Relationships: []
      }
      __seo_gamme_car_switch: {
        Row: {
          sgcs_alias: string | null
          sgcs_content: string | null
          sgcs_id: string
          sgcs_pg_id: string
        }
        Insert: {
          sgcs_alias?: string | null
          sgcs_content?: string | null
          sgcs_id: string
          sgcs_pg_id: string
        }
        Update: {
          sgcs_alias?: string | null
          sgcs_content?: string | null
          sgcs_id?: string
          sgcs_pg_id?: string
        }
        Relationships: []
      }
      __seo_gamme_conseil: {
        Row: {
          sgc_content: string | null
          sgc_id: string
          sgc_order: number | null
          sgc_pg_id: string
          sgc_section_type: string | null
          sgc_title: string | null
        }
        Insert: {
          sgc_content?: string | null
          sgc_id: string
          sgc_order?: number | null
          sgc_pg_id: string
          sgc_section_type?: string | null
          sgc_title?: string | null
        }
        Update: {
          sgc_content?: string | null
          sgc_id?: string
          sgc_order?: number | null
          sgc_pg_id?: string
          sgc_section_type?: string | null
          sgc_title?: string | null
        }
        Relationships: []
      }
      __seo_gamme_info: {
        Row: {
          sgi_content: string | null
          sgi_id: string
          sgi_pg_id: string
        }
        Insert: {
          sgi_content?: string | null
          sgi_id: string
          sgi_pg_id: string
        }
        Update: {
          sgi_content?: string | null
          sgi_id?: string
          sgi_pg_id?: string
        }
        Relationships: []
      }
      __seo_gamme_purchase_guide: {
        Row: {
          sgpg_anti_mistakes: string[] | null
          sgpg_arg1_content: string | null
          sgpg_arg1_icon: string | null
          sgpg_arg1_title: string | null
          sgpg_arg2_content: string | null
          sgpg_arg2_icon: string | null
          sgpg_arg2_title: string | null
          sgpg_arg3_content: string | null
          sgpg_arg3_icon: string | null
          sgpg_arg3_title: string | null
          sgpg_arg4_content: string | null
          sgpg_arg4_icon: string | null
          sgpg_arg4_title: string | null
          sgpg_created_at: string | null
          sgpg_decision_tree: Json | null
          sgpg_faq: Json | null
          sgpg_h1_override: string | null
          sgpg_how_to_choose: string | null
          sgpg_id: number
          sgpg_intro_role: string | null
          sgpg_intro_sync_parts: string[] | null
          sgpg_intro_title: string | null
          sgpg_is_draft: boolean
          sgpg_pg_id: string
          sgpg_risk_conclusion: string | null
          sgpg_risk_consequences: string[] | null
          sgpg_risk_cost_range: string | null
          sgpg_risk_explanation: string | null
          sgpg_risk_title: string | null
          sgpg_selection_criteria: Json | null
          sgpg_source_ref: string | null
          sgpg_source_type: string | null
          sgpg_source_uri: string | null
          sgpg_source_verified: boolean | null
          sgpg_source_verified_at: string | null
          sgpg_source_verified_by: string | null
          sgpg_symptoms: string[] | null
          sgpg_timing_km: string | null
          sgpg_timing_note: string | null
          sgpg_timing_title: string | null
          sgpg_timing_years: string | null
          sgpg_updated_at: string | null
          sgpg_use_cases: Json | null
        }
        Insert: {
          sgpg_anti_mistakes?: string[] | null
          sgpg_arg1_content?: string | null
          sgpg_arg1_icon?: string | null
          sgpg_arg1_title?: string | null
          sgpg_arg2_content?: string | null
          sgpg_arg2_icon?: string | null
          sgpg_arg2_title?: string | null
          sgpg_arg3_content?: string | null
          sgpg_arg3_icon?: string | null
          sgpg_arg3_title?: string | null
          sgpg_arg4_content?: string | null
          sgpg_arg4_icon?: string | null
          sgpg_arg4_title?: string | null
          sgpg_created_at?: string | null
          sgpg_decision_tree?: Json | null
          sgpg_faq?: Json | null
          sgpg_h1_override?: string | null
          sgpg_how_to_choose?: string | null
          sgpg_id?: number
          sgpg_intro_role?: string | null
          sgpg_intro_sync_parts?: string[] | null
          sgpg_intro_title?: string | null
          sgpg_is_draft?: boolean
          sgpg_pg_id: string
          sgpg_risk_conclusion?: string | null
          sgpg_risk_consequences?: string[] | null
          sgpg_risk_cost_range?: string | null
          sgpg_risk_explanation?: string | null
          sgpg_risk_title?: string | null
          sgpg_selection_criteria?: Json | null
          sgpg_source_ref?: string | null
          sgpg_source_type?: string | null
          sgpg_source_uri?: string | null
          sgpg_source_verified?: boolean | null
          sgpg_source_verified_at?: string | null
          sgpg_source_verified_by?: string | null
          sgpg_symptoms?: string[] | null
          sgpg_timing_km?: string | null
          sgpg_timing_note?: string | null
          sgpg_timing_title?: string | null
          sgpg_timing_years?: string | null
          sgpg_updated_at?: string | null
          sgpg_use_cases?: Json | null
        }
        Update: {
          sgpg_anti_mistakes?: string[] | null
          sgpg_arg1_content?: string | null
          sgpg_arg1_icon?: string | null
          sgpg_arg1_title?: string | null
          sgpg_arg2_content?: string | null
          sgpg_arg2_icon?: string | null
          sgpg_arg2_title?: string | null
          sgpg_arg3_content?: string | null
          sgpg_arg3_icon?: string | null
          sgpg_arg3_title?: string | null
          sgpg_arg4_content?: string | null
          sgpg_arg4_icon?: string | null
          sgpg_arg4_title?: string | null
          sgpg_created_at?: string | null
          sgpg_decision_tree?: Json | null
          sgpg_faq?: Json | null
          sgpg_h1_override?: string | null
          sgpg_how_to_choose?: string | null
          sgpg_id?: number
          sgpg_intro_role?: string | null
          sgpg_intro_sync_parts?: string[] | null
          sgpg_intro_title?: string | null
          sgpg_is_draft?: boolean
          sgpg_pg_id?: string
          sgpg_risk_conclusion?: string | null
          sgpg_risk_consequences?: string[] | null
          sgpg_risk_cost_range?: string | null
          sgpg_risk_explanation?: string | null
          sgpg_risk_title?: string | null
          sgpg_selection_criteria?: Json | null
          sgpg_source_ref?: string | null
          sgpg_source_type?: string | null
          sgpg_source_uri?: string | null
          sgpg_source_verified?: boolean | null
          sgpg_source_verified_at?: string | null
          sgpg_source_verified_by?: string | null
          sgpg_symptoms?: string[] | null
          sgpg_timing_km?: string | null
          sgpg_timing_note?: string | null
          sgpg_timing_title?: string | null
          sgpg_timing_years?: string | null
          sgpg_updated_at?: string | null
          sgpg_use_cases?: Json | null
        }
        Relationships: []
      }
      __seo_generation_log: {
        Row: {
          bucket: string | null
          completed_at: string | null
          compressed_size_bytes: number | null
          duration_ms: number | null
          error_message: string | null
          files_generated: number | null
          generation_type: string
          id: number
          metadata: Json | null
          run_id: string | null
          started_at: string
          status: string | null
          total_size_bytes: number | null
          urls_added: number | null
          urls_removed: number | null
          urls_total: number | null
          urls_updated: number | null
        }
        Insert: {
          bucket?: string | null
          completed_at?: string | null
          compressed_size_bytes?: number | null
          duration_ms?: number | null
          error_message?: string | null
          files_generated?: number | null
          generation_type: string
          id?: number
          metadata?: Json | null
          run_id?: string | null
          started_at?: string
          status?: string | null
          total_size_bytes?: number | null
          urls_added?: number | null
          urls_removed?: number | null
          urls_total?: number | null
          urls_updated?: number | null
        }
        Update: {
          bucket?: string | null
          completed_at?: string | null
          compressed_size_bytes?: number | null
          duration_ms?: number | null
          error_message?: string | null
          files_generated?: number | null
          generation_type?: string
          id?: number
          metadata?: Json | null
          run_id?: string | null
          started_at?: string
          status?: string | null
          total_size_bytes?: number | null
          urls_added?: number | null
          urls_removed?: number | null
          urls_total?: number | null
          urls_updated?: number | null
        }
        Relationships: []
      }
      __seo_heading_config: {
        Row: {
          shc_body_min_words: number | null
          shc_enabled: boolean | null
          shc_id: number
          shc_is_blocking: boolean | null
          shc_max_count: number | null
          shc_max_length: number | null
          shc_min_count: number | null
          shc_min_length: number | null
          shc_penalty_excess: number | null
          shc_penalty_length: number | null
          shc_penalty_missing: number | null
          shc_tag: string
        }
        Insert: {
          shc_body_min_words?: number | null
          shc_enabled?: boolean | null
          shc_id?: number
          shc_is_blocking?: boolean | null
          shc_max_count?: number | null
          shc_max_length?: number | null
          shc_min_count?: number | null
          shc_min_length?: number | null
          shc_penalty_excess?: number | null
          shc_penalty_length?: number | null
          shc_penalty_missing?: number | null
          shc_tag: string
        }
        Update: {
          shc_body_min_words?: number | null
          shc_enabled?: boolean | null
          shc_id?: number
          shc_is_blocking?: boolean | null
          shc_max_count?: number | null
          shc_max_length?: number | null
          shc_min_count?: number | null
          shc_min_length?: number | null
          shc_penalty_excess?: number | null
          shc_penalty_length?: number | null
          shc_penalty_missing?: number | null
          shc_tag?: string
        }
        Relationships: []
      }
      __seo_index_history: {
        Row: {
          first_indexed_at: string | null
          id: number
          index_status: string
          last_indexed_at: string | null
          lost_at: string | null
          snapshot_date: string
          source: string | null
          url: string
        }
        Insert: {
          first_indexed_at?: string | null
          id?: number
          index_status: string
          last_indexed_at?: string | null
          lost_at?: string | null
          snapshot_date?: string
          source?: string | null
          url: string
        }
        Update: {
          first_indexed_at?: string | null
          id?: number
          index_status?: string
          last_indexed_at?: string | null
          lost_at?: string | null
          snapshot_date?: string
          source?: string | null
          url?: string
        }
        Relationships: []
      }
      __seo_indexation_status: {
        Row: {
          sis_blocker_types: string[] | null
          sis_created_at: string | null
          sis_entity_id: string
          sis_entity_type: string
          sis_has_blocker: boolean | null
          sis_id: number
          sis_index_status: string | null
          sis_quarantine_reason: string | null
          sis_robots_meta: string | null
          sis_score: number | null
          sis_updated_at: string | null
          sis_validated_at: string | null
          sis_validated_by: string | null
        }
        Insert: {
          sis_blocker_types?: string[] | null
          sis_created_at?: string | null
          sis_entity_id: string
          sis_entity_type: string
          sis_has_blocker?: boolean | null
          sis_id?: number
          sis_index_status?: string | null
          sis_quarantine_reason?: string | null
          sis_robots_meta?: string | null
          sis_score?: number | null
          sis_updated_at?: string | null
          sis_validated_at?: string | null
          sis_validated_by?: string | null
        }
        Update: {
          sis_blocker_types?: string[] | null
          sis_created_at?: string | null
          sis_entity_id?: string
          sis_entity_type?: string
          sis_has_blocker?: boolean | null
          sis_id?: number
          sis_index_status?: string | null
          sis_quarantine_reason?: string | null
          sis_robots_meta?: string | null
          sis_score?: number | null
          sis_updated_at?: string | null
          sis_validated_at?: string | null
          sis_validated_by?: string | null
        }
        Relationships: []
      }
      __seo_internal_link: {
        Row: {
          anchor_text: string | null
          first_seen_at: string
          from_url: string
          id: number
          is_active: boolean
          is_nofollow: boolean
          last_seen_at: string
          link_type: string
          to_url: string
        }
        Insert: {
          anchor_text?: string | null
          first_seen_at?: string
          from_url: string
          id?: number
          is_active?: boolean
          is_nofollow?: boolean
          last_seen_at?: string
          link_type: string
          to_url: string
        }
        Update: {
          anchor_text?: string | null
          first_seen_at?: string
          from_url?: string
          id?: number
          is_active?: boolean
          is_nofollow?: boolean
          last_seen_at?: string
          link_type?: string
          to_url?: string
        }
        Relationships: []
      }
      __seo_interpolation_alerts: {
        Row: {
          created_at: string | null
          field: string
          id: number
          occurrence_count: number
          pg_id: number
          raw_value: string | null
          source: string | null
          type_id: number
          uninterpolated_vars: string[]
        }
        Insert: {
          created_at?: string | null
          field: string
          id?: number
          occurrence_count?: number
          pg_id: number
          raw_value?: string | null
          source?: string | null
          type_id: number
          uninterpolated_vars?: string[]
        }
        Update: {
          created_at?: string | null
          field?: string
          id?: number
          occurrence_count?: number
          pg_id?: number
          raw_value?: string | null
          source?: string | null
          type_id?: number
          uninterpolated_vars?: string[]
        }
        Relationships: []
      }
      __seo_item_switch: {
        Row: {
          sis_alias: string | null
          sis_content: string | null
          sis_id: string
          sis_pg_id: string
        }
        Insert: {
          sis_alias?: string | null
          sis_content?: string | null
          sis_id: string
          sis_pg_id: string
        }
        Update: {
          sis_alias?: string | null
          sis_content?: string | null
          sis_id?: string
          sis_pg_id?: string
        }
        Relationships: []
      }
      __seo_keyword_cluster: {
        Row: {
          built_at: string
          built_by: string
          id: number
          intent_source: string | null
          keyword_variants: Json
          llm_enriched_at: string | null
          llm_provider: string | null
          overlap_flags: Json
          paa_questions: Json
          pg_alias: string
          pg_id: number
          primary_intent: string
          primary_keyword: string
          primary_volume: number
          role_keywords: Json
          schema_version: string
          source: string
        }
        Insert: {
          built_at?: string
          built_by?: string
          id?: number
          intent_source?: string | null
          keyword_variants?: Json
          llm_enriched_at?: string | null
          llm_provider?: string | null
          overlap_flags?: Json
          paa_questions?: Json
          pg_alias: string
          pg_id: number
          primary_intent?: string
          primary_keyword: string
          primary_volume?: number
          role_keywords?: Json
          schema_version?: string
          source?: string
        }
        Update: {
          built_at?: string
          built_by?: string
          id?: number
          intent_source?: string | null
          keyword_variants?: Json
          llm_enriched_at?: string | null
          llm_provider?: string | null
          overlap_flags?: Json
          paa_questions?: Json
          pg_alias?: string
          pg_id?: number
          primary_intent?: string
          primary_keyword?: string
          primary_volume?: number
          role_keywords?: Json
          schema_version?: string
          source?: string
        }
        Relationships: []
      }
      __seo_keyword_type_mapping: {
        Row: {
          confidence: number | null
          created_at: string | null
          id: number
          keyword_id: number
          match_method: string | null
          pg_id: number
          type_id: string
          updated_at: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          id?: number
          keyword_id: number
          match_method?: string | null
          pg_id: number
          type_id: string
          updated_at?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          id?: number
          keyword_id?: number
          match_method?: string | null
          pg_id?: number
          type_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "__seo_keyword_type_mapping_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: false
            referencedRelation: "__seo_keywords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "__seo_keyword_type_mapping_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: false
            referencedRelation: "v_seo_keywords_unmatched"
            referencedColumns: ["id"]
          },
        ]
      }
      __seo_keywords: {
        Row: {
          best_rank: number | null
          collected_at: string | null
          content_type: string | null
          displacement: number | null
          energy: string | null
          famille_moteur: string | null
          finition: string | null
          gamme: string
          generation: string | null
          id: number
          keyword: string
          keyword_normalized: string
          model: string | null
          pg_id: number | null
          power: number | null
          score_seo: number | null
          source: string | null
          type: string
          type_id: number | null
          updated_at: string | null
          v_level: string | null
          v2_repetitions: number | null
          variant: string | null
          volume: number | null
          volume_global: number | null
        }
        Insert: {
          best_rank?: number | null
          collected_at?: string | null
          content_type?: string | null
          displacement?: number | null
          energy?: string | null
          famille_moteur?: string | null
          finition?: string | null
          gamme: string
          generation?: string | null
          id?: number
          keyword: string
          keyword_normalized: string
          model?: string | null
          pg_id?: number | null
          power?: number | null
          score_seo?: number | null
          source?: string | null
          type: string
          type_id?: number | null
          updated_at?: string | null
          v_level?: string | null
          v2_repetitions?: number | null
          variant?: string | null
          volume?: number | null
          volume_global?: number | null
        }
        Update: {
          best_rank?: number | null
          collected_at?: string | null
          content_type?: string | null
          displacement?: number | null
          energy?: string | null
          famille_moteur?: string | null
          finition?: string | null
          gamme?: string
          generation?: string | null
          id?: number
          keyword?: string
          keyword_normalized?: string
          model?: string | null
          pg_id?: number | null
          power?: number | null
          score_seo?: number | null
          source?: string | null
          type?: string
          type_id?: number | null
          updated_at?: string | null
          v_level?: string | null
          v2_repetitions?: number | null
          variant?: string | null
          volume?: number | null
          volume_global?: number | null
        }
        Relationships: []
      }
      __seo_keywords_clean: {
        Row: {
          created_at: string | null
          energy: string | null
          id: number
          keyword: string
          keyword_normalized: string | null
          model: string | null
          pg_id: number
          source: string | null
          type_id: number | null
          updated_at: string | null
          variant: string | null
          volume: number | null
        }
        Insert: {
          created_at?: string | null
          energy?: string | null
          id?: number
          keyword: string
          keyword_normalized?: string | null
          model?: string | null
          pg_id: number
          source?: string | null
          type_id?: number | null
          updated_at?: string | null
          variant?: string | null
          volume?: number | null
        }
        Update: {
          created_at?: string | null
          energy?: string | null
          id?: number
          keyword?: string
          keyword_normalized?: string | null
          model?: string | null
          pg_id?: number
          source?: string | null
          type_id?: number | null
          updated_at?: string | null
          variant?: string | null
          volume?: number | null
        }
        Relationships: []
      }
      __seo_lexique_domains: {
        Row: {
          sld_description: string | null
          sld_domain: string
          sld_id: number
          sld_incompatible_with: string[] | null
          sld_verbes_signature: string[]
        }
        Insert: {
          sld_description?: string | null
          sld_domain: string
          sld_id?: number
          sld_incompatible_with?: string[] | null
          sld_verbes_signature: string[]
        }
        Update: {
          sld_description?: string | null
          sld_domain?: string
          sld_id?: number
          sld_incompatible_with?: string[] | null
          sld_verbes_signature?: string[]
        }
        Relationships: []
      }
      __seo_lexique_matrice: {
        Row: {
          slm_claims_interdits: string[] | null
          slm_content_hash: string | null
          slm_created_at: string | null
          slm_famille: string
          slm_id: number
          slm_last_sync_at: string | null
          slm_last_sync_run_id: string | null
          slm_lexique_autorise: string[]
          slm_lexique_interdit: string[]
          slm_nom_fr: string
          slm_pg_id: number
          slm_pieces_associees: string[] | null
          slm_role_fonctionnel: string | null
          slm_slug: string
          slm_symptomes: string[] | null
          slm_updated_at: string | null
          slm_verbes_autorises: string[] | null
          slm_verbes_interdits: string[] | null
        }
        Insert: {
          slm_claims_interdits?: string[] | null
          slm_content_hash?: string | null
          slm_created_at?: string | null
          slm_famille: string
          slm_id?: number
          slm_last_sync_at?: string | null
          slm_last_sync_run_id?: string | null
          slm_lexique_autorise?: string[]
          slm_lexique_interdit?: string[]
          slm_nom_fr: string
          slm_pg_id: number
          slm_pieces_associees?: string[] | null
          slm_role_fonctionnel?: string | null
          slm_slug: string
          slm_symptomes?: string[] | null
          slm_updated_at?: string | null
          slm_verbes_autorises?: string[] | null
          slm_verbes_interdits?: string[] | null
        }
        Update: {
          slm_claims_interdits?: string[] | null
          slm_content_hash?: string | null
          slm_created_at?: string | null
          slm_famille?: string
          slm_id?: number
          slm_last_sync_at?: string | null
          slm_last_sync_run_id?: string | null
          slm_lexique_autorise?: string[]
          slm_lexique_interdit?: string[]
          slm_nom_fr?: string
          slm_pg_id?: number
          slm_pieces_associees?: string[] | null
          slm_role_fonctionnel?: string | null
          slm_slug?: string
          slm_symptomes?: string[] | null
          slm_updated_at?: string | null
          slm_verbes_autorises?: string[] | null
          slm_verbes_interdits?: string[] | null
        }
        Relationships: []
      }
      __seo_mandatory_fields: {
        Row: {
          smf_created_at: string | null
          smf_criticality: string
          smf_enabled: boolean | null
          smf_family_id: string
          smf_field_name: string
          smf_id: number
          smf_product_type: string | null
          smf_weight: number | null
        }
        Insert: {
          smf_created_at?: string | null
          smf_criticality: string
          smf_enabled?: boolean | null
          smf_family_id: string
          smf_field_name: string
          smf_id?: number
          smf_product_type?: string | null
          smf_weight?: number | null
        }
        Update: {
          smf_created_at?: string | null
          smf_criticality?: string
          smf_enabled?: boolean | null
          smf_family_id?: string
          smf_field_name?: string
          smf_id?: number
          smf_product_type?: string | null
          smf_weight?: number | null
        }
        Relationships: []
      }
      __seo_marque: {
        Row: {
          sm_content: string | null
          sm_descrip: string | null
          sm_h1: string | null
          sm_id: string
          sm_keywords: string | null
          sm_marque_id: string
          sm_title: string | null
        }
        Insert: {
          sm_content?: string | null
          sm_descrip?: string | null
          sm_h1?: string | null
          sm_id: string
          sm_keywords?: string | null
          sm_marque_id: string
          sm_title?: string | null
        }
        Update: {
          sm_content?: string | null
          sm_descrip?: string | null
          sm_h1?: string | null
          sm_id?: string
          sm_keywords?: string | null
          sm_marque_id?: string
          sm_title?: string | null
        }
        Relationships: []
      }
      __seo_object_associations: {
        Row: {
          soa_created_at: string | null
          soa_enabled: boolean | null
          soa_family: string | null
          soa_id: number
          soa_message_fr: string
          soa_object: string
          soa_piece: string
          soa_relation: string
          soa_severity: string
        }
        Insert: {
          soa_created_at?: string | null
          soa_enabled?: boolean | null
          soa_family?: string | null
          soa_id?: number
          soa_message_fr: string
          soa_object: string
          soa_piece: string
          soa_relation: string
          soa_severity: string
        }
        Update: {
          soa_created_at?: string | null
          soa_enabled?: boolean | null
          soa_family?: string | null
          soa_id?: number
          soa_message_fr?: string
          soa_object?: string
          soa_piece?: string
          soa_relation?: string
          soa_severity?: string
        }
        Relationships: []
      }
      __seo_observable: {
        Row: {
          action_ids: string[] | null
          canonical_url: string | null
          cluster_id: string | null
          created_at: string | null
          created_by: string | null
          ctx_freq: string | null
          ctx_load: string[] | null
          ctx_phase: string[] | null
          ctx_road: string[] | null
          ctx_speed: string[] | null
          ctx_temp: string[] | null
          dtc_codes: string[] | null
          dtc_descriptions: Json | null
          estimated_repair_cost_max: number | null
          estimated_repair_cost_min: number | null
          estimated_repair_duration: string | null
          fault_ids: string[] | null
          id: number
          is_published: boolean | null
          kg_observable_ids: string[] | null
          meta_description: string | null
          observable_type: string | null
          page_role: Database["public"]["Enums"]["seo_page_role"] | null
          perception_channel: string | null
          priority: number | null
          publish_date: string | null
          recommended_actions: Json | null
          related_blog_articles: string[] | null
          related_gammes: number[] | null
          related_references: string[] | null
          risk_level: string | null
          safety_gate: string | null
          schema_org: Json | null
          sign_description: string | null
          slug: string
          symptom_description: string | null
          title: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          action_ids?: string[] | null
          canonical_url?: string | null
          cluster_id?: string | null
          created_at?: string | null
          created_by?: string | null
          ctx_freq?: string | null
          ctx_load?: string[] | null
          ctx_phase?: string[] | null
          ctx_road?: string[] | null
          ctx_speed?: string[] | null
          ctx_temp?: string[] | null
          dtc_codes?: string[] | null
          dtc_descriptions?: Json | null
          estimated_repair_cost_max?: number | null
          estimated_repair_cost_min?: number | null
          estimated_repair_duration?: string | null
          fault_ids?: string[] | null
          id?: number
          is_published?: boolean | null
          kg_observable_ids?: string[] | null
          meta_description?: string | null
          observable_type?: string | null
          page_role?: Database["public"]["Enums"]["seo_page_role"] | null
          perception_channel?: string | null
          priority?: number | null
          publish_date?: string | null
          recommended_actions?: Json | null
          related_blog_articles?: string[] | null
          related_gammes?: number[] | null
          related_references?: string[] | null
          risk_level?: string | null
          safety_gate?: string | null
          schema_org?: Json | null
          sign_description?: string | null
          slug: string
          symptom_description?: string | null
          title: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          action_ids?: string[] | null
          canonical_url?: string | null
          cluster_id?: string | null
          created_at?: string | null
          created_by?: string | null
          ctx_freq?: string | null
          ctx_load?: string[] | null
          ctx_phase?: string[] | null
          ctx_road?: string[] | null
          ctx_speed?: string[] | null
          ctx_temp?: string[] | null
          dtc_codes?: string[] | null
          dtc_descriptions?: Json | null
          estimated_repair_cost_max?: number | null
          estimated_repair_cost_min?: number | null
          estimated_repair_duration?: string | null
          fault_ids?: string[] | null
          id?: number
          is_published?: boolean | null
          kg_observable_ids?: string[] | null
          meta_description?: string | null
          observable_type?: string | null
          page_role?: Database["public"]["Enums"]["seo_page_role"] | null
          perception_channel?: string | null
          priority?: number | null
          publish_date?: string | null
          recommended_actions?: Json | null
          related_blog_articles?: string[] | null
          related_gammes?: number[] | null
          related_references?: string[] | null
          risk_level?: string | null
          safety_gate?: string | null
          schema_org?: Json | null
          sign_description?: string | null
          slug?: string
          symptom_description?: string | null
          title?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      __seo_page: {
        Row: {
          canonical_url: string | null
          changefreq: string | null
          created_at: string
          entity_id: number | null
          h1: string | null
          id: number
          is_indexable_hint: boolean
          last_modified_at: string | null
          last_published_at: string | null
          meta_description: string | null
          meta_robots: string | null
          page_type: string
          priority: number | null
          status_target: number
          temperature: string | null
          title: string | null
          updated_at: string
          url: string
        }
        Insert: {
          canonical_url?: string | null
          changefreq?: string | null
          created_at?: string
          entity_id?: number | null
          h1?: string | null
          id?: number
          is_indexable_hint?: boolean
          last_modified_at?: string | null
          last_published_at?: string | null
          meta_description?: string | null
          meta_robots?: string | null
          page_type: string
          priority?: number | null
          status_target?: number
          temperature?: string | null
          title?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          canonical_url?: string | null
          changefreq?: string | null
          created_at?: string
          entity_id?: number | null
          h1?: string | null
          id?: number
          is_indexable_hint?: boolean
          last_modified_at?: string | null
          last_published_at?: string | null
          meta_description?: string | null
          meta_robots?: string | null
          page_type?: string
          priority?: number | null
          status_target?: number
          temperature?: string | null
          title?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "__seo_page_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "__seo_entity"
            referencedColumns: ["id"]
          },
        ]
      }
      __seo_page_brief: {
        Row: {
          angles_obligatoires: Json | null
          confidence_score: number | null
          coverage_score: number | null
          created_at: string | null
          created_by: string | null
          faq_paa: Json | null
          forbidden_overlap: Json | null
          id: number
          keyword_cluster_id: number | null
          keyword_source: string | null
          keywords_primary: string | null
          keywords_secondary: Json | null
          llm_enriched_at: string | null
          llm_provider: string | null
          overrides_hash: string | null
          overrides_json: Json | null
          page_role: string
          pg_alias: string
          pg_id: number
          preuves: Json | null
          primary_intent: string
          secondary_intents: Json | null
          status: string
          template_id: number | null
          termes_techniques: Json | null
          updated_at: string | null
          validated_at: string | null
          version: number
          writing_constraints: Json | null
        }
        Insert: {
          angles_obligatoires?: Json | null
          confidence_score?: number | null
          coverage_score?: number | null
          created_at?: string | null
          created_by?: string | null
          faq_paa?: Json | null
          forbidden_overlap?: Json | null
          id?: number
          keyword_cluster_id?: number | null
          keyword_source?: string | null
          keywords_primary?: string | null
          keywords_secondary?: Json | null
          llm_enriched_at?: string | null
          llm_provider?: string | null
          overrides_hash?: string | null
          overrides_json?: Json | null
          page_role: string
          pg_alias: string
          pg_id: number
          preuves?: Json | null
          primary_intent: string
          secondary_intents?: Json | null
          status?: string
          template_id?: number | null
          termes_techniques?: Json | null
          updated_at?: string | null
          validated_at?: string | null
          version?: number
          writing_constraints?: Json | null
        }
        Update: {
          angles_obligatoires?: Json | null
          confidence_score?: number | null
          coverage_score?: number | null
          created_at?: string | null
          created_by?: string | null
          faq_paa?: Json | null
          forbidden_overlap?: Json | null
          id?: number
          keyword_cluster_id?: number | null
          keyword_source?: string | null
          keywords_primary?: string | null
          keywords_secondary?: Json | null
          llm_enriched_at?: string | null
          llm_provider?: string | null
          overrides_hash?: string | null
          overrides_json?: Json | null
          page_role?: string
          pg_alias?: string
          pg_id?: number
          preuves?: Json | null
          primary_intent?: string
          secondary_intents?: Json | null
          status?: string
          template_id?: number | null
          termes_techniques?: Json | null
          updated_at?: string | null
          validated_at?: string | null
          version?: number
          writing_constraints?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "__seo_page_brief_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "__seo_brief_template"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_page_brief_keyword_cluster"
            columns: ["keyword_cluster_id"]
            isOneToOne: false
            referencedRelation: "__seo_keyword_cluster"
            referencedColumns: ["id"]
          },
        ]
      }
      __seo_penalty_config: {
        Row: {
          spc_base_penalty: number
          spc_created_at: string | null
          spc_description: string | null
          spc_error_type: string
          spc_is_blocking: boolean | null
        }
        Insert: {
          spc_base_penalty: number
          spc_created_at?: string | null
          spc_description?: string | null
          spc_error_type: string
          spc_is_blocking?: boolean | null
        }
        Update: {
          spc_base_penalty?: number
          spc_created_at?: string | null
          spc_description?: string | null
          spc_error_type?: string
          spc_is_blocking?: boolean | null
        }
        Relationships: []
      }
      __seo_penalty_matrix: {
        Row: {
          spm_base_penalty: number
          spm_context: string | null
          spm_created_at: string | null
          spm_description: string | null
          spm_error_type: string
          spm_id: number
          spm_is_blocking: boolean | null
          spm_rule_code: string
        }
        Insert: {
          spm_base_penalty?: number
          spm_context?: string | null
          spm_created_at?: string | null
          spm_description?: string | null
          spm_error_type: string
          spm_id?: number
          spm_is_blocking?: boolean | null
          spm_rule_code: string
        }
        Update: {
          spm_base_penalty?: number
          spm_context?: string | null
          spm_created_at?: string | null
          spm_description?: string | null
          spm_error_type?: string
          spm_id?: number
          spm_is_blocking?: boolean | null
          spm_rule_code?: string
        }
        Relationships: []
      }
      __seo_product_fields: {
        Row: {
          spf_created_at: string | null
          spf_criticality: string | null
          spf_enabled: boolean | null
          spf_family: string
          spf_field_name: string
          spf_field_pattern: string | null
          spf_gamme_pattern: string | null
          spf_id: number
          spf_product_type: string | null
          spf_unit: string | null
          spf_validation_regex: string | null
          spf_weight: number | null
        }
        Insert: {
          spf_created_at?: string | null
          spf_criticality?: string | null
          spf_enabled?: boolean | null
          spf_family: string
          spf_field_name: string
          spf_field_pattern?: string | null
          spf_gamme_pattern?: string | null
          spf_id?: number
          spf_product_type?: string | null
          spf_unit?: string | null
          spf_validation_regex?: string | null
          spf_weight?: number | null
        }
        Update: {
          spf_created_at?: string | null
          spf_criticality?: string | null
          spf_enabled?: boolean | null
          spf_family?: string
          spf_field_name?: string
          spf_field_pattern?: string | null
          spf_gamme_pattern?: string | null
          spf_id?: number
          spf_product_type?: string | null
          spf_unit?: string | null
          spf_validation_regex?: string | null
          spf_weight?: number | null
        }
        Relationships: []
      }
      __seo_quality_log: {
        Row: {
          sql_action: string
          sql_after: string | null
          sql_before: string | null
          sql_created_at: string | null
          sql_created_by: string | null
          sql_field: string
          sql_id: number
          sql_record_id: string
          sql_rules_triggered: Json | null
          sql_score_after: number | null
          sql_score_before: number | null
          sql_table: string
        }
        Insert: {
          sql_action?: string
          sql_after?: string | null
          sql_before?: string | null
          sql_created_at?: string | null
          sql_created_by?: string | null
          sql_field: string
          sql_id?: number
          sql_record_id: string
          sql_rules_triggered?: Json | null
          sql_score_after?: number | null
          sql_score_before?: number | null
          sql_table: string
        }
        Update: {
          sql_action?: string
          sql_after?: string | null
          sql_before?: string | null
          sql_created_at?: string | null
          sql_created_by?: string | null
          sql_field?: string
          sql_id?: number
          sql_record_id?: string
          sql_rules_triggered?: Json | null
          sql_score_after?: number | null
          sql_score_before?: number | null
          sql_table?: string
        }
        Relationships: []
      }
      __seo_quarantine_status: {
        Row: {
          sqs_blocking_reasons: Json | null
          sqs_checked_at: string | null
          sqs_created_at: string | null
          sqs_entity_id: number
          sqs_entity_type: string
          sqs_has_blocker: boolean | null
          sqs_id: number
          sqs_import_batch: string | null
          sqs_released_at: string | null
          sqs_score: number | null
          sqs_status: string | null
        }
        Insert: {
          sqs_blocking_reasons?: Json | null
          sqs_checked_at?: string | null
          sqs_created_at?: string | null
          sqs_entity_id: number
          sqs_entity_type: string
          sqs_has_blocker?: boolean | null
          sqs_id?: number
          sqs_import_batch?: string | null
          sqs_released_at?: string | null
          sqs_score?: number | null
          sqs_status?: string | null
        }
        Update: {
          sqs_blocking_reasons?: Json | null
          sqs_checked_at?: string | null
          sqs_created_at?: string | null
          sqs_entity_id?: number
          sqs_entity_type?: string
          sqs_has_blocker?: boolean | null
          sqs_id?: number
          sqs_import_batch?: string | null
          sqs_released_at?: string | null
          sqs_score?: number | null
          sqs_status?: string | null
        }
        Relationships: []
      }
      __seo_reference: {
        Row: {
          blog_slugs: string[] | null
          canonical_url: string | null
          composition: string[] | null
          confusions_courantes: string[] | null
          content_html: string | null
          created_at: string | null
          definition: string
          id: number
          is_published: boolean | null
          meta_description: string | null
          page_role: string | null
          pg_id: number | null
          regles_metier: string[] | null
          related_references: number[] | null
          role_mecanique: string | null
          role_negatif: string | null
          schema_json: Json | null
          scope_limites: string | null
          slug: string
          symptomes_associes: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          blog_slugs?: string[] | null
          canonical_url?: string | null
          composition?: string[] | null
          confusions_courantes?: string[] | null
          content_html?: string | null
          created_at?: string | null
          definition: string
          id?: number
          is_published?: boolean | null
          meta_description?: string | null
          page_role?: string | null
          pg_id?: number | null
          regles_metier?: string[] | null
          related_references?: number[] | null
          role_mecanique?: string | null
          role_negatif?: string | null
          schema_json?: Json | null
          scope_limites?: string | null
          slug: string
          symptomes_associes?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          blog_slugs?: string[] | null
          canonical_url?: string | null
          composition?: string[] | null
          confusions_courantes?: string[] | null
          content_html?: string | null
          created_at?: string | null
          definition?: string
          id?: number
          is_published?: boolean | null
          meta_description?: string | null
          page_role?: string | null
          pg_id?: number | null
          regles_metier?: string[] | null
          related_references?: number[] | null
          role_mecanique?: string | null
          role_negatif?: string | null
          schema_json?: Json | null
          scope_limites?: string | null
          slug?: string
          symptomes_associes?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      __seo_role_content: {
        Row: {
          brief_id: number | null
          brief_version: number | null
          claims: Json | null
          compilation_log: Json | null
          content_fingerprint: Json | null
          evidence_pack: Json | null
          generated_at: string | null
          id: number
          is_draft: boolean | null
          overrides_hash: string | null
          page_role: string
          pg_id: number
          published_at: string | null
          quality_flags: string[] | null
          quality_score: number | null
          raw_sections: Json | null
          section_fingerprints: Json | null
          section_policy_version: string | null
          sections: Json
          sections_meta: Json
          source_type: string | null
          source_versions: Json | null
          status: string | null
          word_count: number | null
        }
        Insert: {
          brief_id?: number | null
          brief_version?: number | null
          claims?: Json | null
          compilation_log?: Json | null
          content_fingerprint?: Json | null
          evidence_pack?: Json | null
          generated_at?: string | null
          id?: number
          is_draft?: boolean | null
          overrides_hash?: string | null
          page_role: string
          pg_id: number
          published_at?: string | null
          quality_flags?: string[] | null
          quality_score?: number | null
          raw_sections?: Json | null
          section_fingerprints?: Json | null
          section_policy_version?: string | null
          sections?: Json
          sections_meta?: Json
          source_type?: string | null
          source_versions?: Json | null
          status?: string | null
          word_count?: number | null
        }
        Update: {
          brief_id?: number | null
          brief_version?: number | null
          claims?: Json | null
          compilation_log?: Json | null
          content_fingerprint?: Json | null
          evidence_pack?: Json | null
          generated_at?: string | null
          id?: number
          is_draft?: boolean | null
          overrides_hash?: string | null
          page_role?: string
          pg_id?: number
          published_at?: string | null
          quality_flags?: string[] | null
          quality_score?: number | null
          raw_sections?: Json | null
          section_fingerprints?: Json | null
          section_policy_version?: string | null
          sections?: Json
          sections_meta?: Json
          source_type?: string | null
          source_versions?: Json | null
          status?: string | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "__seo_role_content_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "__seo_page_brief"
            referencedColumns: ["id"]
          },
        ]
      }
      __seo_rule_evaluation_log: {
        Row: {
          srel_context: string
          srel_created_at: string | null
          srel_entity_id: string | null
          srel_entity_type: string
          srel_execution_ms: number | null
          srel_final_verdict: string
          srel_id: number
          srel_input_hash: string | null
          srel_input_preview: string | null
          srel_rules_passed: Json | null
          srel_rules_triggered: Json | null
          srel_score: number | null
        }
        Insert: {
          srel_context: string
          srel_created_at?: string | null
          srel_entity_id?: string | null
          srel_entity_type: string
          srel_execution_ms?: number | null
          srel_final_verdict: string
          srel_id?: number
          srel_input_hash?: string | null
          srel_input_preview?: string | null
          srel_rules_passed?: Json | null
          srel_rules_triggered?: Json | null
          srel_score?: number | null
        }
        Update: {
          srel_context?: string
          srel_created_at?: string | null
          srel_entity_id?: string | null
          srel_entity_type?: string
          srel_execution_ms?: number | null
          srel_final_verdict?: string
          srel_id?: number
          srel_input_hash?: string | null
          srel_input_preview?: string | null
          srel_rules_passed?: Json | null
          srel_rules_triggered?: Json | null
          srel_score?: number | null
        }
        Relationships: []
      }
      __seo_sitemap_file: {
        Row: {
          bucket: string
          compressed_size_bytes: number | null
          content_hash: string | null
          expires_at: string | null
          file_size_bytes: number | null
          generated_at: string
          id: number
          path: string
          urls_count: number
        }
        Insert: {
          bucket: string
          compressed_size_bytes?: number | null
          content_hash?: string | null
          expires_at?: string | null
          file_size_bytes?: number | null
          generated_at?: string
          id?: number
          path: string
          urls_count: number
        }
        Update: {
          bucket?: string
          compressed_size_bytes?: number | null
          content_hash?: string | null
          expires_at?: string | null
          file_size_bytes?: number | null
          generated_at?: string
          id?: number
          path?: string
          urls_count?: number
        }
        Relationships: []
      }
      __seo_subsystem_components: {
        Row: {
          ssc_aliases: string[] | null
          ssc_component: string
          ssc_created_at: string | null
          ssc_enabled: boolean | null
          ssc_id: number
          ssc_subsystem: string
        }
        Insert: {
          ssc_aliases?: string[] | null
          ssc_component: string
          ssc_created_at?: string | null
          ssc_enabled?: boolean | null
          ssc_id?: number
          ssc_subsystem: string
        }
        Update: {
          ssc_aliases?: string[] | null
          ssc_component?: string
          ssc_created_at?: string | null
          ssc_enabled?: boolean | null
          ssc_id?: number
          ssc_subsystem?: string
        }
        Relationships: []
      }
      __seo_subsystem_integrity: {
        Row: {
          ssi_check_cooccurrence: boolean | null
          ssi_description: string | null
          ssi_enabled: boolean | null
          ssi_family: string
          ssi_id: number
          ssi_pieces: string[]
          ssi_subsystem: string
        }
        Insert: {
          ssi_check_cooccurrence?: boolean | null
          ssi_description?: string | null
          ssi_enabled?: boolean | null
          ssi_family: string
          ssi_id?: number
          ssi_pieces: string[]
          ssi_subsystem: string
        }
        Update: {
          ssi_check_cooccurrence?: boolean | null
          ssi_description?: string | null
          ssi_enabled?: boolean | null
          ssi_family?: string
          ssi_id?: number
          ssi_pieces?: string[]
          ssi_subsystem?: string
        }
        Relationships: []
      }
      __seo_subsystems: {
        Row: {
          ss_code: string
          ss_components: string[]
          ss_created_at: string | null
          ss_id: number
          ss_name: string
          ss_updated_at: string | null
        }
        Insert: {
          ss_code: string
          ss_components: string[]
          ss_created_at?: string | null
          ss_id?: number
          ss_name: string
          ss_updated_at?: string | null
        }
        Update: {
          ss_code?: string
          ss_components?: string[]
          ss_created_at?: string | null
          ss_id?: number
          ss_name?: string
          ss_updated_at?: string | null
        }
        Relationships: []
      }
      __seo_sync_runs: {
        Row: {
          ambiguous_deleted: number | null
          ambiguous_inserted: number | null
          ambiguous_unchanged: number | null
          ambiguous_updated: number | null
          confusion_deleted: number | null
          confusion_inserted: number | null
          confusion_unchanged: number | null
          confusion_updated: number | null
          duration_ms: number | null
          errors: Json | null
          json_hash: string | null
          json_version: string | null
          lexique_deleted: number | null
          lexique_inserted: number | null
          lexique_unchanged: number | null
          lexique_updated: number | null
          run_at: string | null
          run_by: string
          run_id: string
          run_mode: string
        }
        Insert: {
          ambiguous_deleted?: number | null
          ambiguous_inserted?: number | null
          ambiguous_unchanged?: number | null
          ambiguous_updated?: number | null
          confusion_deleted?: number | null
          confusion_inserted?: number | null
          confusion_unchanged?: number | null
          confusion_updated?: number | null
          duration_ms?: number | null
          errors?: Json | null
          json_hash?: string | null
          json_version?: string | null
          lexique_deleted?: number | null
          lexique_inserted?: number | null
          lexique_unchanged?: number | null
          lexique_updated?: number | null
          run_at?: string | null
          run_by: string
          run_id?: string
          run_mode: string
        }
        Update: {
          ambiguous_deleted?: number | null
          ambiguous_inserted?: number | null
          ambiguous_unchanged?: number | null
          ambiguous_updated?: number | null
          confusion_deleted?: number | null
          confusion_inserted?: number | null
          confusion_unchanged?: number | null
          confusion_updated?: number | null
          duration_ms?: number | null
          errors?: Json | null
          json_hash?: string | null
          json_version?: string | null
          lexique_deleted?: number | null
          lexique_inserted?: number | null
          lexique_unchanged?: number | null
          lexique_updated?: number | null
          run_at?: string | null
          run_by?: string
          run_id?: string
          run_mode?: string
        }
        Relationships: []
      }
      __seo_type_switch: {
        Row: {
          sts_alias: string | null
          sts_content: string | null
          sts_id: string
        }
        Insert: {
          sts_alias?: string | null
          sts_content?: string | null
          sts_id: string
        }
        Update: {
          sts_alias?: string | null
          sts_content?: string | null
          sts_id?: string
        }
        Relationships: []
      }
      __seo_type_vlevel: {
        Row: {
          confidence: number | null
          energy: string | null
          id: number
          model: string | null
          pg_id: number
          source: string | null
          type_id: number
          updated_at: string | null
          v_level: string
        }
        Insert: {
          confidence?: number | null
          energy?: string | null
          id?: number
          model?: string | null
          pg_id: number
          source?: string | null
          type_id: number
          updated_at?: string | null
          v_level: string
        }
        Update: {
          confidence?: number | null
          energy?: string | null
          id?: number
          model?: string | null
          pg_id?: number
          source?: string | null
          type_id?: number
          updated_at?: string | null
          v_level?: string
        }
        Relationships: []
      }
      __seo_variable_patterns: {
        Row: {
          svp_created_at: string | null
          svp_enabled: boolean | null
          svp_id: number
          svp_name: string
          svp_pattern: string
          svp_severity: string | null
          svp_zones: string[] | null
        }
        Insert: {
          svp_created_at?: string | null
          svp_enabled?: boolean | null
          svp_id?: number
          svp_name: string
          svp_pattern: string
          svp_severity?: string | null
          svp_zones?: string[] | null
        }
        Update: {
          svp_created_at?: string | null
          svp_enabled?: boolean | null
          svp_id?: number
          svp_name?: string
          svp_pattern?: string
          svp_severity?: string | null
          svp_zones?: string[] | null
        }
        Relationships: []
      }
      __seo_vehicle_banned_formulations: {
        Row: {
          svbf_category: string
          svbf_created_at: string | null
          svbf_enabled: boolean | null
          svbf_id: number
          svbf_message_fr: string | null
          svbf_pattern: string
          svbf_severity: string | null
        }
        Insert: {
          svbf_category: string
          svbf_created_at?: string | null
          svbf_enabled?: boolean | null
          svbf_id?: number
          svbf_message_fr?: string | null
          svbf_pattern: string
          svbf_severity?: string | null
        }
        Update: {
          svbf_category?: string
          svbf_created_at?: string | null
          svbf_enabled?: boolean | null
          svbf_id?: number
          svbf_message_fr?: string | null
          svbf_pattern?: string
          svbf_severity?: string | null
        }
        Relationships: []
      }
      __seo_vehicle_brands: {
        Row: {
          svb_aliases: string[] | null
          svb_enabled: boolean | null
          svb_id: number
          svb_name: string
        }
        Insert: {
          svb_aliases?: string[] | null
          svb_enabled?: boolean | null
          svb_id?: number
          svb_name: string
        }
        Update: {
          svb_aliases?: string[] | null
          svb_enabled?: boolean | null
          svb_id?: number
          svb_name?: string
        }
        Relationships: []
      }
      __seo_vehicle_granularity_patterns: {
        Row: {
          svgp_created_at: string | null
          svgp_description: string | null
          svgp_enabled: boolean | null
          svgp_id: number
          svgp_pattern: string
          svgp_type: string
          svgp_weight: number | null
        }
        Insert: {
          svgp_created_at?: string | null
          svgp_description?: string | null
          svgp_enabled?: boolean | null
          svgp_id?: number
          svgp_pattern: string
          svgp_type: string
          svgp_weight?: number | null
        }
        Update: {
          svgp_created_at?: string | null
          svgp_description?: string | null
          svgp_enabled?: boolean | null
          svgp_id?: number
          svgp_pattern?: string
          svgp_type?: string
          svgp_weight?: number | null
        }
        Relationships: []
      }
      __seo_zone_coefficients: {
        Row: {
          szc_coefficient: number
          szc_created_at: string | null
          szc_description: string | null
          szc_zone: string
        }
        Insert: {
          szc_coefficient: number
          szc_created_at?: string | null
          szc_description?: string | null
          szc_zone: string
        }
        Update: {
          szc_coefficient?: number
          szc_created_at?: string | null
          szc_description?: string | null
          szc_zone?: string
        }
        Relationships: []
      }
      __seo_zone_config: {
        Row: {
          szc_coefficient: number
          szc_created_at: string | null
          szc_description: string | null
          szc_risk_level: number
          szc_severity: string
          szc_zone: string
        }
        Insert: {
          szc_coefficient?: number
          szc_created_at?: string | null
          szc_description?: string | null
          szc_risk_level?: number
          szc_severity?: string
          szc_zone: string
        }
        Update: {
          szc_coefficient?: number
          szc_created_at?: string | null
          szc_description?: string | null
          szc_risk_level?: number
          szc_severity?: string
          szc_zone?: string
        }
        Relationships: []
      }
      __seo_zone_severity: {
        Row: {
          szs_created_at: string | null
          szs_description: string | null
          szs_risk_level: number
          szs_severity: string
          szs_zone: string
        }
        Insert: {
          szs_created_at?: string | null
          szs_description?: string | null
          szs_risk_level: number
          szs_severity: string
          szs_zone: string
        }
        Update: {
          szs_created_at?: string | null
          szs_description?: string | null
          szs_risk_level?: number
          szs_severity?: string
          szs_zone?: string
        }
        Relationships: []
      }
      __sitemap_blog: {
        Row: {
          map_alias: string | null
          map_date: string | null
          map_id: string
        }
        Insert: {
          map_alias?: string | null
          map_date?: string | null
          map_id: string
        }
        Update: {
          map_alias?: string | null
          map_date?: string | null
          map_id?: string
        }
        Relationships: []
      }
      __sitemap_gamme: {
        Row: {
          map_id: string
          map_pg_alias: string | null
          map_pg_id: string | null
        }
        Insert: {
          map_id: string
          map_pg_alias?: string | null
          map_pg_id?: string | null
        }
        Update: {
          map_id?: string
          map_pg_alias?: string | null
          map_pg_id?: string | null
        }
        Relationships: []
      }
      __sitemap_marque: {
        Row: {
          map_id: string
          map_marque_alias: string | null
          map_marque_id: string | null
        }
        Insert: {
          map_id: string
          map_marque_alias?: string | null
          map_marque_id?: string | null
        }
        Update: {
          map_id?: string
          map_marque_alias?: string | null
          map_marque_id?: string | null
        }
        Relationships: []
      }
      __sitemap_motorisation: {
        Row: {
          map_id: string
          map_marque_alias: string | null
          map_marque_id: string | null
          map_modele_alias: string | null
          map_modele_id: string | null
          map_type_alias: string | null
          map_type_id: string | null
        }
        Insert: {
          map_id: string
          map_marque_alias?: string | null
          map_marque_id?: string | null
          map_modele_alias?: string | null
          map_modele_id?: string | null
          map_type_alias?: string | null
          map_type_id?: string | null
        }
        Update: {
          map_id?: string
          map_marque_alias?: string | null
          map_marque_id?: string | null
          map_modele_alias?: string | null
          map_modele_id?: string | null
          map_type_alias?: string | null
          map_type_id?: string | null
        }
        Relationships: []
      }
      __sitemap_p_link: {
        Row: {
          map_has_item: number
          map_id: number
          map_marque_alias: string
          map_marque_id: number
          map_modele_alias: string
          map_modele_id: number
          map_pg_alias: string
          map_pg_id: number
          map_type_alias: string
          map_type_id: number
        }
        Insert: {
          map_has_item: number
          map_id?: number
          map_marque_alias: string
          map_marque_id: number
          map_modele_alias: string
          map_modele_id: number
          map_pg_alias: string
          map_pg_id: number
          map_type_alias: string
          map_type_id: number
        }
        Update: {
          map_has_item?: number
          map_id?: number
          map_marque_alias?: string
          map_marque_id?: number
          map_modele_alias?: string
          map_modele_id?: number
          map_pg_alias?: string
          map_pg_id?: number
          map_type_alias?: string
          map_type_id?: number
        }
        Relationships: []
      }
      __sitemap_p_xml: {
        Row: {
          map_file: string | null
          map_has_link: string | null
          map_id: string
          map_marque_id: string | null
          map_pg_id: string | null
        }
        Insert: {
          map_file?: string | null
          map_has_link?: string | null
          map_id: string
          map_marque_id?: string | null
          map_pg_id?: string | null
        }
        Update: {
          map_file?: string | null
          map_has_link?: string | null
          map_id?: string
          map_marque_id?: string | null
          map_pg_id?: string | null
        }
        Relationships: []
      }
      __sitemap_search_link: {
        Row: {
          map_id: string
          map_marque_alias: string | null
          map_marque_id: string | null
          map_modele_alias: string | null
          map_modele_id: string | null
          map_pg_alias: string | null
          map_pg_id: string | null
          map_type_alias: string | null
          map_type_id: string | null
        }
        Insert: {
          map_id: string
          map_marque_alias?: string | null
          map_marque_id?: string | null
          map_modele_alias?: string | null
          map_modele_id?: string | null
          map_pg_alias?: string | null
          map_pg_id?: string | null
          map_type_alias?: string | null
          map_type_id?: string | null
        }
        Update: {
          map_id?: string
          map_marque_alias?: string | null
          map_marque_id?: string | null
          map_modele_alias?: string | null
          map_modele_id?: string | null
          map_pg_alias?: string | null
          map_pg_id?: string | null
          map_type_alias?: string | null
          map_type_id?: string | null
        }
        Relationships: []
      }
      __staging_article_mapping: {
        Row: {
          stg_artnr: string
          stg_confidence: number | null
          stg_created_at: string | null
          stg_dlnr: string
          stg_error: string | null
          stg_id: number
          stg_import_id: number | null
          stg_match_type: string | null
          stg_match_value: string | null
          stg_piece_id: number | null
          stg_piece_ref: string | null
          stg_validated: boolean | null
        }
        Insert: {
          stg_artnr: string
          stg_confidence?: number | null
          stg_created_at?: string | null
          stg_dlnr: string
          stg_error?: string | null
          stg_id?: number
          stg_import_id?: number | null
          stg_match_type?: string | null
          stg_match_value?: string | null
          stg_piece_id?: number | null
          stg_piece_ref?: string | null
          stg_validated?: boolean | null
        }
        Update: {
          stg_artnr?: string
          stg_confidence?: number | null
          stg_created_at?: string | null
          stg_dlnr?: string
          stg_error?: string | null
          stg_id?: number
          stg_import_id?: number | null
          stg_match_type?: string | null
          stg_match_value?: string | null
          stg_piece_id?: number | null
          stg_piece_ref?: string | null
          stg_validated?: boolean | null
        }
        Relationships: []
      }
      __staging_brand_mapping: {
        Row: {
          stg_brand_name: string | null
          stg_confidence: number | null
          stg_created_at: string | null
          stg_dlnr: string
          stg_error: string | null
          stg_id: number
          stg_import_id: number | null
          stg_match_type: string | null
          stg_pm_id: number | null
          stg_pm_name: string | null
          stg_validated: boolean | null
        }
        Insert: {
          stg_brand_name?: string | null
          stg_confidence?: number | null
          stg_created_at?: string | null
          stg_dlnr: string
          stg_error?: string | null
          stg_id?: number
          stg_import_id?: number | null
          stg_match_type?: string | null
          stg_pm_id?: number | null
          stg_pm_name?: string | null
          stg_validated?: boolean | null
        }
        Update: {
          stg_brand_name?: string | null
          stg_confidence?: number | null
          stg_created_at?: string | null
          stg_dlnr?: string
          stg_error?: string | null
          stg_id?: number
          stg_import_id?: number | null
          stg_match_type?: string | null
          stg_pm_id?: number | null
          stg_pm_name?: string | null
          stg_validated?: boolean | null
        }
        Relationships: []
      }
      __staging_piece_compat: {
        Row: {
          stg_artnr: string
          stg_created_at: string | null
          stg_dlnr: string
          stg_error: string | null
          stg_id: number
          stg_import_id: number | null
          stg_ktypnr: number
          stg_pg_id: number | null
          stg_piece_id: number | null
          stg_pm_id: number | null
          stg_type_id: number | null
          stg_validated: boolean | null
        }
        Insert: {
          stg_artnr: string
          stg_created_at?: string | null
          stg_dlnr: string
          stg_error?: string | null
          stg_id?: number
          stg_import_id?: number | null
          stg_ktypnr: number
          stg_pg_id?: number | null
          stg_piece_id?: number | null
          stg_pm_id?: number | null
          stg_type_id?: number | null
          stg_validated?: boolean | null
        }
        Update: {
          stg_artnr?: string
          stg_created_at?: string | null
          stg_dlnr?: string
          stg_error?: string | null
          stg_id?: number
          stg_import_id?: number | null
          stg_ktypnr?: number
          stg_pg_id?: number | null
          stg_piece_id?: number | null
          stg_pm_id?: number | null
          stg_type_id?: number | null
          stg_validated?: boolean | null
        }
        Relationships: []
      }
      __staging_vehicle_mapping: {
        Row: {
          stg_confidence: number | null
          stg_created_at: string | null
          stg_error: string | null
          stg_hernr: number | null
          stg_id: number
          stg_import_id: number | null
          stg_kmodnr: number | null
          stg_ktypnr: number
          stg_match_criteria: Json | null
          stg_match_type: string | null
          stg_type_id: number | null
          stg_type_name: string | null
          stg_validated: boolean | null
        }
        Insert: {
          stg_confidence?: number | null
          stg_created_at?: string | null
          stg_error?: string | null
          stg_hernr?: number | null
          stg_id?: number
          stg_import_id?: number | null
          stg_kmodnr?: number | null
          stg_ktypnr: number
          stg_match_criteria?: Json | null
          stg_match_type?: string | null
          stg_type_id?: number | null
          stg_type_name?: string | null
          stg_validated?: boolean | null
        }
        Update: {
          stg_confidence?: number | null
          stg_created_at?: string | null
          stg_error?: string | null
          stg_hernr?: number | null
          stg_id?: number
          stg_import_id?: number | null
          stg_kmodnr?: number | null
          stg_ktypnr?: number
          stg_match_criteria?: Json | null
          stg_match_type?: string | null
          stg_type_id?: number | null
          stg_type_name?: string | null
          stg_validated?: boolean | null
        }
        Relationships: []
      }
      __substitution_logs: {
        Row: {
          ab_variant: string | null
          completed: boolean | null
          created_at: string | null
          exit_url: string | null
          funnel_step: number | null
          http_status_served: number | null
          id: number
          is_bot: boolean | null
          lock_type: string | null
          original_intent: Json | null
          original_url: string
          prefill_source: string | null
          session_id: string | null
          substitute_content_id: string | null
          substitution_type: string
          time_to_complete: number | null
          user_agent: string | null
          vehicle_prefilled: boolean | null
        }
        Insert: {
          ab_variant?: string | null
          completed?: boolean | null
          created_at?: string | null
          exit_url?: string | null
          funnel_step?: number | null
          http_status_served?: number | null
          id?: number
          is_bot?: boolean | null
          lock_type?: string | null
          original_intent?: Json | null
          original_url: string
          prefill_source?: string | null
          session_id?: string | null
          substitute_content_id?: string | null
          substitution_type: string
          time_to_complete?: number | null
          user_agent?: string | null
          vehicle_prefilled?: boolean | null
        }
        Update: {
          ab_variant?: string | null
          completed?: boolean | null
          created_at?: string | null
          exit_url?: string | null
          funnel_step?: number | null
          http_status_served?: number | null
          id?: number
          is_bot?: boolean | null
          lock_type?: string | null
          original_intent?: Json | null
          original_url?: string
          prefill_source?: string | null
          session_id?: string | null
          substitute_content_id?: string | null
          substitution_type?: string
          time_to_complete?: number | null
          user_agent?: string | null
          vehicle_prefilled?: boolean | null
        }
        Relationships: []
      }
      __v_level_computed: {
        Row: {
          brand: string | null
          computed_at: string | null
          energy: string
          gamme_name: string
          id: number
          is_v1: boolean | null
          model_name: string
          rank: number | null
          score: number | null
          v_level: string
          variant_name: string
        }
        Insert: {
          brand?: string | null
          computed_at?: string | null
          energy: string
          gamme_name: string
          id?: number
          is_v1?: boolean | null
          model_name: string
          rank?: number | null
          score?: number | null
          v_level: string
          variant_name: string
        }
        Update: {
          brand?: string | null
          computed_at?: string | null
          energy?: string
          gamme_name?: string
          id?: number
          is_v1?: boolean | null
          model_name?: string
          rank?: number | null
          score?: number | null
          v_level?: string
          variant_name?: string
        }
        Relationships: []
      }
      __v_level_raw: {
        Row: {
          brand: string | null
          collected_at: string | null
          energy: string
          gamme_name: string
          id: number
          model_name: string
          raw_data: Json | null
          score: number | null
          source: string | null
          variant_name: string
        }
        Insert: {
          brand?: string | null
          collected_at?: string | null
          energy: string
          gamme_name: string
          id?: number
          model_name: string
          raw_data?: Json | null
          score?: number | null
          source?: string | null
          variant_name: string
        }
        Update: {
          brand?: string | null
          collected_at?: string | null
          energy?: string
          gamme_name?: string
          id?: number
          model_name?: string
          raw_data?: Json | null
          score?: number | null
          source?: string | null
          variant_name?: string
        }
        Relationships: []
      }
      __video_assets: {
        Row: {
          asset_key: string
          created_at: string | null
          file_path: string | null
          id: number
          tags: string[] | null
          truth_dependency: string
          validated: boolean | null
          validated_by: string | null
          visual_type: string
        }
        Insert: {
          asset_key: string
          created_at?: string | null
          file_path?: string | null
          id?: number
          tags?: string[] | null
          truth_dependency?: string
          validated?: boolean | null
          validated_by?: string | null
          visual_type: string
        }
        Update: {
          asset_key?: string
          created_at?: string | null
          file_path?: string | null
          id?: number
          tags?: string[] | null
          truth_dependency?: string
          validated?: boolean | null
          validated_by?: string | null
          visual_type?: string
        }
        Relationships: []
      }
      __video_execution_log: {
        Row: {
          artefact_check: Json | null
          attempt_number: number | null
          brief_id: string
          bullmq_job_id: string | null
          can_publish: boolean | null
          canary_error_code: string | null
          canary_error_message: string | null
          canary_fallback: boolean | null
          completed_at: string | null
          created_at: string | null
          duration_ms: number | null
          engine_name: string | null
          engine_resolution: string | null
          engine_version: string | null
          error_message: string | null
          feature_flags: Json | null
          gamme_alias: string | null
          gate_results: Json | null
          id: number
          is_canary: boolean | null
          pg_id: number | null
          quality_flags: Json | null
          quality_score: number | null
          render_duration_ms: number | null
          render_error_code: string | null
          render_metadata: Json | null
          render_output_path: string | null
          render_status: string | null
          retryable: boolean | null
          started_at: string | null
          status: string
          trigger_job_id: string | null
          trigger_source: string
          vertical: string
          video_type: string
        }
        Insert: {
          artefact_check?: Json | null
          attempt_number?: number | null
          brief_id: string
          bullmq_job_id?: string | null
          can_publish?: boolean | null
          canary_error_code?: string | null
          canary_error_message?: string | null
          canary_fallback?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          duration_ms?: number | null
          engine_name?: string | null
          engine_resolution?: string | null
          engine_version?: string | null
          error_message?: string | null
          feature_flags?: Json | null
          gamme_alias?: string | null
          gate_results?: Json | null
          id?: number
          is_canary?: boolean | null
          pg_id?: number | null
          quality_flags?: Json | null
          quality_score?: number | null
          render_duration_ms?: number | null
          render_error_code?: string | null
          render_metadata?: Json | null
          render_output_path?: string | null
          render_status?: string | null
          retryable?: boolean | null
          started_at?: string | null
          status?: string
          trigger_job_id?: string | null
          trigger_source: string
          vertical: string
          video_type: string
        }
        Update: {
          artefact_check?: Json | null
          attempt_number?: number | null
          brief_id?: string
          bullmq_job_id?: string | null
          can_publish?: boolean | null
          canary_error_code?: string | null
          canary_error_message?: string | null
          canary_fallback?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          duration_ms?: number | null
          engine_name?: string | null
          engine_resolution?: string | null
          engine_version?: string | null
          error_message?: string | null
          feature_flags?: Json | null
          gamme_alias?: string | null
          gate_results?: Json | null
          id?: number
          is_canary?: boolean | null
          pg_id?: number | null
          quality_flags?: Json | null
          quality_score?: number | null
          render_duration_ms?: number | null
          render_error_code?: string | null
          render_metadata?: Json | null
          render_output_path?: string | null
          render_status?: string | null
          retryable?: boolean | null
          started_at?: string | null
          status?: string
          trigger_job_id?: string | null
          trigger_source?: string
          vertical?: string
          video_type?: string
        }
        Relationships: []
      }
      __video_productions: {
        Row: {
          approval_record: Json | null
          brief_id: string
          claim_table: Json | null
          created_at: string | null
          created_by: string
          disclaimer_plan: Json | null
          evidence_pack: Json | null
          gamme_alias: string | null
          gate_results: Json | null
          id: number
          knowledge_contract: Json | null
          pg_id: number | null
          quality_flags: string[] | null
          quality_score: number | null
          status: string
          template_id: string | null
          updated_at: string | null
          vertical: string
          video_type: string
        }
        Insert: {
          approval_record?: Json | null
          brief_id: string
          claim_table?: Json | null
          created_at?: string | null
          created_by?: string
          disclaimer_plan?: Json | null
          evidence_pack?: Json | null
          gamme_alias?: string | null
          gate_results?: Json | null
          id?: number
          knowledge_contract?: Json | null
          pg_id?: number | null
          quality_flags?: string[] | null
          quality_score?: number | null
          status?: string
          template_id?: string | null
          updated_at?: string | null
          vertical: string
          video_type: string
        }
        Update: {
          approval_record?: Json | null
          brief_id?: string
          claim_table?: Json | null
          created_at?: string | null
          created_by?: string
          disclaimer_plan?: Json | null
          evidence_pack?: Json | null
          gamme_alias?: string | null
          gate_results?: Json | null
          id?: number
          knowledge_contract?: Json | null
          pg_id?: number | null
          quality_flags?: string[] | null
          quality_score?: number | null
          status?: string
          template_id?: string | null
          updated_at?: string | null
          vertical?: string
          video_type?: string
        }
        Relationships: []
      }
      __video_templates: {
        Row: {
          allowed_use_cases: string[] | null
          created_at: string | null
          duration_range: unknown
          forbidden_use_cases: string[] | null
          id: number
          platform: string
          structure: Json | null
          template_id: string
          version: number
          video_type: string
        }
        Insert: {
          allowed_use_cases?: string[] | null
          created_at?: string | null
          duration_range?: unknown
          forbidden_use_cases?: string[] | null
          id?: number
          platform: string
          structure?: Json | null
          template_id: string
          version?: number
          video_type: string
        }
        Update: {
          allowed_use_cases?: string[] | null
          created_at?: string | null
          duration_range?: unknown
          forbidden_use_cases?: string[] | null
          id?: number
          platform?: string
          structure?: Json | null
          template_id?: string
          version?: number
          video_type?: string
        }
        Relationships: []
      }
      _killswitch_audit: {
        Row: {
          attempted_at: string | null
          blocked: boolean | null
          context: Json | null
          id: number
          operation: string | null
          role_name: string | null
          table_name: string | null
        }
        Insert: {
          attempted_at?: string | null
          blocked?: boolean | null
          context?: Json | null
          id?: number
          operation?: string | null
          role_name?: string | null
          table_name?: string | null
        }
        Update: {
          attempted_at?: string | null
          blocked?: boolean | null
          context?: Json | null
          id?: number
          operation?: string | null
          role_name?: string | null
          table_name?: string | null
        }
        Relationships: []
      }
      _killswitch_breakglass: {
        Row: {
          expires_at: string
          granted_at: string | null
          granted_by: string
          id: number
          is_active: boolean | null
          reason: string
          revoked_at: string | null
          revoked_by: string | null
          tables_allowed: string[]
          token_hash: string
        }
        Insert: {
          expires_at: string
          granted_at?: string | null
          granted_by: string
          id?: number
          is_active?: boolean | null
          reason: string
          revoked_at?: string | null
          revoked_by?: string | null
          tables_allowed: string[]
          token_hash: string
        }
        Update: {
          expires_at?: string
          granted_at?: string | null
          granted_by?: string
          id?: number
          is_active?: boolean | null
          reason?: string
          revoked_at?: string | null
          revoked_by?: string | null
          tables_allowed?: string[]
          token_hash?: string
        }
        Relationships: []
      }
      am_2022_suppliers: {
        Row: {
          has_img: string | null
          sup_brand: string | null
          sup_display: string | null
          sup_file: string | null
          sup_id: string
          sup_id_steq: string | null
          sup_nr: string | null
          sup_pm_id: string | null
          sup_sort: string | null
        }
        Insert: {
          has_img?: string | null
          sup_brand?: string | null
          sup_display?: string | null
          sup_file?: string | null
          sup_id: string
          sup_id_steq?: string | null
          sup_nr?: string | null
          sup_pm_id?: string | null
          sup_sort?: string | null
        }
        Update: {
          has_img?: string | null
          sup_brand?: string | null
          sup_display?: string | null
          sup_file?: string | null
          sup_id?: string
          sup_id_steq?: string | null
          sup_nr?: string | null
          sup_pm_id?: string | null
          sup_sort?: string | null
        }
        Relationships: []
      }
      auto_marque: {
        Row: {
          marque_alias: string | null
          marque_display: number | null
          marque_id: number
          marque_logo: string | null
          marque_name: string | null
          marque_name_meta: string | null
          marque_name_meta_title: string | null
          marque_name_url: string | null
          marque_relfollow: number | null
          marque_sitemap: number | null
          marque_sort: number | null
          marque_top: number | null
          marque_wall: string | null
        }
        Insert: {
          marque_alias?: string | null
          marque_display?: number | null
          marque_id: number
          marque_logo?: string | null
          marque_name?: string | null
          marque_name_meta?: string | null
          marque_name_meta_title?: string | null
          marque_name_url?: string | null
          marque_relfollow?: number | null
          marque_sitemap?: number | null
          marque_sort?: number | null
          marque_top?: number | null
          marque_wall?: string | null
        }
        Update: {
          marque_alias?: string | null
          marque_display?: number | null
          marque_id?: number
          marque_logo?: string | null
          marque_name?: string | null
          marque_name_meta?: string | null
          marque_name_meta_title?: string | null
          marque_name_url?: string | null
          marque_relfollow?: number | null
          marque_sitemap?: number | null
          marque_sort?: number | null
          marque_top?: number | null
          marque_wall?: string | null
        }
        Relationships: []
      }
      auto_modele: {
        Row: {
          modele_alias: string
          modele_body: string | null
          modele_display: number
          modele_display_v1: number | null
          modele_ful_name: string | null
          modele_id: number
          modele_is_new: number
          modele_marque_id: number
          modele_mdg_id: number
          modele_month_from: number
          modele_month_to: number | null
          modele_name: string
          modele_name_meta: string | null
          modele_name_url: string
          modele_parent: number | null
          modele_pic: string | null
          modele_relfollow: number
          modele_sitemap: number
          modele_sort: number
          modele_year_from: number | null
          modele_year_to: number | null
        }
        Insert: {
          modele_alias: string
          modele_body?: string | null
          modele_display?: number
          modele_display_v1?: number | null
          modele_ful_name?: string | null
          modele_id: number
          modele_is_new?: number
          modele_marque_id: number
          modele_mdg_id: number
          modele_month_from?: number
          modele_month_to?: number | null
          modele_name: string
          modele_name_meta?: string | null
          modele_name_url: string
          modele_parent?: number | null
          modele_pic?: string | null
          modele_relfollow?: number
          modele_sitemap?: number
          modele_sort: number
          modele_year_from?: number | null
          modele_year_to?: number | null
        }
        Update: {
          modele_alias?: string
          modele_body?: string | null
          modele_display?: number
          modele_display_v1?: number | null
          modele_ful_name?: string | null
          modele_id?: number
          modele_is_new?: number
          modele_marque_id?: number
          modele_mdg_id?: number
          modele_month_from?: number
          modele_month_to?: number | null
          modele_name?: string
          modele_name_meta?: string | null
          modele_name_url?: string
          modele_parent?: number | null
          modele_pic?: string | null
          modele_relfollow?: number
          modele_sitemap?: number
          modele_sort?: number
          modele_year_from?: number | null
          modele_year_to?: number | null
        }
        Relationships: []
      }
      auto_modele_group: {
        Row: {
          mdg_display: number
          mdg_id: number
          mdg_marque_id: number
          mdg_name: string
          mdg_pic: string | null
          mdg_sort: number
        }
        Insert: {
          mdg_display?: number
          mdg_id: number
          mdg_marque_id: number
          mdg_name: string
          mdg_pic?: string | null
          mdg_sort: number
        }
        Update: {
          mdg_display?: number
          mdg_id?: number
          mdg_marque_id?: number
          mdg_name?: string
          mdg_pic?: string | null
          mdg_sort?: number
        }
        Relationships: []
      }
      auto_modele_robot: {
        Row: {
          modele_alias: string
          modele_body: string | null
          modele_display: boolean
          modele_id: number
          modele_is_new: boolean
          modele_marque_id: number
          modele_mdg_id: number
          modele_month_from: number
          modele_month_to: number | null
          modele_name: string
          modele_name_meta: string | null
          modele_name_url: string
          modele_pic: string | null
          modele_relfollow: boolean
          modele_sitemap: boolean
          modele_sort: number
          modele_year_from: number | null
          modele_year_to: number | null
        }
        Insert: {
          modele_alias: string
          modele_body?: string | null
          modele_display?: boolean
          modele_id: number
          modele_is_new?: boolean
          modele_marque_id: number
          modele_mdg_id: number
          modele_month_from?: number
          modele_month_to?: number | null
          modele_name: string
          modele_name_meta?: string | null
          modele_name_url: string
          modele_pic?: string | null
          modele_relfollow?: boolean
          modele_sitemap?: boolean
          modele_sort: number
          modele_year_from?: number | null
          modele_year_to?: number | null
        }
        Update: {
          modele_alias?: string
          modele_body?: string | null
          modele_display?: boolean
          modele_id?: number
          modele_is_new?: boolean
          modele_marque_id?: number
          modele_mdg_id?: number
          modele_month_from?: number
          modele_month_to?: number | null
          modele_name?: string
          modele_name_meta?: string | null
          modele_name_url?: string
          modele_pic?: string | null
          modele_relfollow?: boolean
          modele_sitemap?: boolean
          modele_sort?: number
          modele_year_from?: number | null
          modele_year_to?: number | null
        }
        Relationships: []
      }
      auto_type: {
        Row: {
          type_alias: string | null
          type_body: string | null
          type_display: string | null
          type_engine: string | null
          type_fuel: string | null
          type_id: string
          type_liter: string | null
          type_marque_id: string | null
          type_modele_id: string | null
          type_month_from: string | null
          type_month_to: string | null
          type_name: string | null
          type_name_meta: string | null
          type_name_url: string | null
          type_power_kw: string | null
          type_power_ps: string | null
          type_relfollow: string | null
          type_sort: string | null
          type_tmf_id: string | null
          type_year_from: string | null
          type_year_to: string | null
        }
        Insert: {
          type_alias?: string | null
          type_body?: string | null
          type_display?: string | null
          type_engine?: string | null
          type_fuel?: string | null
          type_id: string
          type_liter?: string | null
          type_marque_id?: string | null
          type_modele_id?: string | null
          type_month_from?: string | null
          type_month_to?: string | null
          type_name?: string | null
          type_name_meta?: string | null
          type_name_url?: string | null
          type_power_kw?: string | null
          type_power_ps?: string | null
          type_relfollow?: string | null
          type_sort?: string | null
          type_tmf_id?: string | null
          type_year_from?: string | null
          type_year_to?: string | null
        }
        Update: {
          type_alias?: string | null
          type_body?: string | null
          type_display?: string | null
          type_engine?: string | null
          type_fuel?: string | null
          type_id?: string
          type_liter?: string | null
          type_marque_id?: string | null
          type_modele_id?: string | null
          type_month_from?: string | null
          type_month_to?: string | null
          type_name?: string | null
          type_name_meta?: string | null
          type_name_url?: string | null
          type_power_kw?: string | null
          type_power_ps?: string | null
          type_relfollow?: string | null
          type_sort?: string | null
          type_tmf_id?: string | null
          type_year_from?: string | null
          type_year_to?: string | null
        }
        Relationships: []
      }
      auto_type_motor_code: {
        Row: {
          tmc_code: string
          tmc_type_id: string
        }
        Insert: {
          tmc_code: string
          tmc_type_id: string
        }
        Update: {
          tmc_code?: string
          tmc_type_id?: string
        }
        Relationships: []
      }
      auto_type_motor_fuel: {
        Row: {
          tmf_display: string | null
          tmf_engine: string | null
          tmf_fuel: string | null
          tmf_id: string
          tmf_motor: string | null
          tmf_sort: string | null
        }
        Insert: {
          tmf_display?: string | null
          tmf_engine?: string | null
          tmf_fuel?: string | null
          tmf_id: string
          tmf_motor?: string | null
          tmf_sort?: string | null
        }
        Update: {
          tmf_display?: string | null
          tmf_engine?: string | null
          tmf_fuel?: string | null
          tmf_id?: string
          tmf_motor?: string | null
          tmf_sort?: string | null
        }
        Relationships: []
      }
      auto_type_number_code: {
        Row: {
          tnc_cnit: string
          tnc_code: string | null
          tnc_type_id: string
        }
        Insert: {
          tnc_cnit: string
          tnc_code?: string | null
          tnc_type_id: string
        }
        Update: {
          tnc_cnit?: string
          tnc_code?: string | null
          tnc_type_id?: string
        }
        Relationships: []
      }
      cars_engine: {
        Row: {
          eng_code: string | null
          eng_id: string
          eng_mfa_id: string | null
        }
        Insert: {
          eng_code?: string | null
          eng_id: string
          eng_mfa_id?: string | null
        }
        Update: {
          eng_code?: string | null
          eng_id?: string
          eng_mfa_id?: string | null
        }
        Relationships: []
      }
      catalog_family: {
        Row: {
          mf_description: string | null
          mf_display: string | null
          mf_id: string
          mf_name: string | null
          mf_name_meta: string | null
          mf_name_system: string | null
          mf_pic: string | null
          mf_sort: string | null
        }
        Insert: {
          mf_description?: string | null
          mf_display?: string | null
          mf_id: string
          mf_name?: string | null
          mf_name_meta?: string | null
          mf_name_system?: string | null
          mf_pic?: string | null
          mf_sort?: string | null
        }
        Update: {
          mf_description?: string | null
          mf_display?: string | null
          mf_id?: string
          mf_name?: string | null
          mf_name_meta?: string | null
          mf_name_system?: string | null
          mf_pic?: string | null
          mf_sort?: string | null
        }
        Relationships: []
      }
      catalog_gamme: {
        Row: {
          mc_id: string
          mc_mf_id: string | null
          mc_mf_prime: string | null
          mc_pg_id: string | null
          mc_sort: string | null
        }
        Insert: {
          mc_id: string
          mc_mf_id?: string | null
          mc_mf_prime?: string | null
          mc_pg_id?: string | null
          mc_sort?: string | null
        }
        Update: {
          mc_id?: string
          mc_mf_id?: string | null
          mc_mf_prime?: string | null
          mc_pg_id?: string | null
          mc_sort?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      crawl_budget_experiments: {
        Row: {
          action: string
          baseline: Json | null
          completed_at: string | null
          created_at: string
          description: string | null
          duration_days: number
          id: string
          name: string
          reduction_percent: number | null
          started_at: string | null
          status: string
          target_families: string[]
          updated_at: string
        }
        Insert: {
          action: string
          baseline?: Json | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          duration_days?: number
          id?: string
          name: string
          reduction_percent?: number | null
          started_at?: string | null
          status?: string
          target_families: string[]
          updated_at?: string
        }
        Update: {
          action?: string
          baseline?: Json | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          duration_days?: number
          id?: string
          name?: string
          reduction_percent?: number | null
          started_at?: string | null
          status?: string
          target_families?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      crawl_budget_metrics: {
        Row: {
          avg_crawl_rate: number
          crawl_requests_count: number
          created_at: string
          date: string
          experiment_id: string
          family_metrics: Json | null
          id: string
          indexation_rate: number
          indexed_urls: number
          organic_conversions: number | null
          organic_sessions: number | null
          total_crawled_urls: number
        }
        Insert: {
          avg_crawl_rate?: number
          crawl_requests_count?: number
          created_at?: string
          date: string
          experiment_id: string
          family_metrics?: Json | null
          id?: string
          indexation_rate?: number
          indexed_urls?: number
          organic_conversions?: number | null
          organic_sessions?: number | null
          total_crawled_urls?: number
        }
        Update: {
          avg_crawl_rate?: number
          crawl_requests_count?: number
          created_at?: string
          date?: string
          experiment_id?: string
          family_metrics?: Json | null
          id?: string
          indexation_rate?: number
          indexed_urls?: number
          organic_conversions?: number | null
          organic_sessions?: number | null
          total_crawled_urls?: number
        }
        Relationships: [
          {
            foreignKeyName: "crawl_budget_metrics_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "crawl_budget_experiments"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_article: {
        Row: {
          action: string
          batch_id: number
          confidence: number
          created_at: string | null
          dec_id: number
          diff_details: Json | null
          guard_flags: string[] | null
          reason_code: string
          source_key: string
          target_internal_id: number | null
          target_nk_id: number | null
        }
        Insert: {
          action: string
          batch_id: number
          confidence: number
          created_at?: string | null
          dec_id?: number
          diff_details?: Json | null
          guard_flags?: string[] | null
          reason_code: string
          source_key: string
          target_internal_id?: number | null
          target_nk_id?: number | null
        }
        Update: {
          action?: string
          batch_id?: number
          confidence?: number
          created_at?: string | null
          dec_id?: number
          diff_details?: Json | null
          guard_flags?: string[] | null
          reason_code?: string
          source_key?: string
          target_internal_id?: number | null
          target_nk_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "decision_article_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batch"
            referencedColumns: ["batch_id"]
          },
        ]
      }
      decision_brand: {
        Row: {
          action: string
          batch_id: number
          confidence: number
          created_at: string | null
          dec_id: number
          diff_details: Json | null
          guard_flags: string[] | null
          reason_code: string
          source_key: string
          target_internal_id: number | null
          target_nk_id: number | null
        }
        Insert: {
          action: string
          batch_id: number
          confidence: number
          created_at?: string | null
          dec_id?: number
          diff_details?: Json | null
          guard_flags?: string[] | null
          reason_code: string
          source_key: string
          target_internal_id?: number | null
          target_nk_id?: number | null
        }
        Update: {
          action?: string
          batch_id?: number
          confidence?: number
          created_at?: string | null
          dec_id?: number
          diff_details?: Json | null
          guard_flags?: string[] | null
          reason_code?: string
          source_key?: string
          target_internal_id?: number | null
          target_nk_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "decision_brand_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batch"
            referencedColumns: ["batch_id"]
          },
        ]
      }
      decision_compat: {
        Row: {
          action: string
          batch_id: number
          confidence: number
          created_at: string | null
          dec_id: number
          diff_details: Json | null
          guard_flags: string[] | null
          reason_code: string
          source_key: string
          target_piece_id: number | null
          target_type_id: number | null
        }
        Insert: {
          action: string
          batch_id: number
          confidence: number
          created_at?: string | null
          dec_id?: number
          diff_details?: Json | null
          guard_flags?: string[] | null
          reason_code: string
          source_key: string
          target_piece_id?: number | null
          target_type_id?: number | null
        }
        Update: {
          action?: string
          batch_id?: number
          confidence?: number
          created_at?: string | null
          dec_id?: number
          diff_details?: Json | null
          guard_flags?: string[] | null
          reason_code?: string
          source_key?: string
          target_piece_id?: number | null
          target_type_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "decision_compat_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batch"
            referencedColumns: ["batch_id"]
          },
        ]
      }
      error_logs: {
        Row: {
          additional_context: Json | null
          correlation_id: string | null
          created_at: string
          environment: string | null
          error_code: string
          error_message: string | null
          id: number
          ip_address: string | null
          referrer: string | null
          request_method: string | null
          request_url: string | null
          service_name: string | null
          session_id: string | null
          severity: string | null
          stack_trace: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          additional_context?: Json | null
          correlation_id?: string | null
          created_at?: string
          environment?: string | null
          error_code: string
          error_message?: string | null
          id?: number
          ip_address?: string | null
          referrer?: string | null
          request_method?: string | null
          request_url?: string | null
          service_name?: string | null
          session_id?: string | null
          severity?: string | null
          stack_trace?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          additional_context?: Json | null
          correlation_id?: string | null
          created_at?: string
          environment?: string | null
          error_code?: string
          error_message?: string | null
          id?: number
          ip_address?: string | null
          referrer?: string | null
          request_method?: string | null
          request_url?: string | null
          service_name?: string | null
          session_id?: string | null
          severity?: string | null
          stack_trace?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      error_statistics: {
        Row: {
          count: number | null
          created_at: string | null
          date: string
          error_code: string
          id: number
          severity: string | null
        }
        Insert: {
          count?: number | null
          created_at?: string | null
          date: string
          error_code: string
          id?: number
          severity?: string | null
        }
        Update: {
          count?: number | null
          created_at?: string | null
          date?: string
          error_code?: string
          id?: number
          severity?: string | null
        }
        Relationships: []
      }
      gamme_aggregates: {
        Row: {
          catalog_issues: Json | null
          catalog_status: string | null
          cluster_health: string | null
          computed_at: string | null
          content_breakdown: Json | null
          content_depth: string | null
          content_words_total: number | null
          demand_level: string | null
          difficulty_level: string | null
          execution_status: string | null
          final_priority: string | null
          freshness_status: string | null
          g_level: string | null
          ga_id: number
          ga_pg_id: number
          index_policy: string | null
          intent_type: string | null
          keyword_total: number | null
          last_content_update: string | null
          last_product_update: string | null
          pg_level: string | null
          pg_top: string | null
          potential_level: string | null
          priority_score: number | null
          products_direct: number | null
          products_total: number | null
          products_via_family: number | null
          products_via_vehicles: number | null
          seo_content_raw_words: number | null
          seo_score: number | null
          smart_action_primary: string | null
          smart_actions: Json | null
          source_updated_at: string | null
          topic_purity: string | null
          trends_index: number | null
          trends_updated_at: string | null
          v2_count: number | null
          v3_count: number | null
          v4_count: number | null
          v5_count: number | null
          vehicle_coverage: string | null
          vehicles_total: number | null
          vlevel_counts: Json | null
        }
        Insert: {
          catalog_issues?: Json | null
          catalog_status?: string | null
          cluster_health?: string | null
          computed_at?: string | null
          content_breakdown?: Json | null
          content_depth?: string | null
          content_words_total?: number | null
          demand_level?: string | null
          difficulty_level?: string | null
          execution_status?: string | null
          final_priority?: string | null
          freshness_status?: string | null
          g_level?: string | null
          ga_id?: number
          ga_pg_id: number
          index_policy?: string | null
          intent_type?: string | null
          keyword_total?: number | null
          last_content_update?: string | null
          last_product_update?: string | null
          pg_level?: string | null
          pg_top?: string | null
          potential_level?: string | null
          priority_score?: number | null
          products_direct?: number | null
          products_total?: number | null
          products_via_family?: number | null
          products_via_vehicles?: number | null
          seo_content_raw_words?: number | null
          seo_score?: number | null
          smart_action_primary?: string | null
          smart_actions?: Json | null
          source_updated_at?: string | null
          topic_purity?: string | null
          trends_index?: number | null
          trends_updated_at?: string | null
          v2_count?: number | null
          v3_count?: number | null
          v4_count?: number | null
          v5_count?: number | null
          vehicle_coverage?: string | null
          vehicles_total?: number | null
          vlevel_counts?: Json | null
        }
        Update: {
          catalog_issues?: Json | null
          catalog_status?: string | null
          cluster_health?: string | null
          computed_at?: string | null
          content_breakdown?: Json | null
          content_depth?: string | null
          content_words_total?: number | null
          demand_level?: string | null
          difficulty_level?: string | null
          execution_status?: string | null
          final_priority?: string | null
          freshness_status?: string | null
          g_level?: string | null
          ga_id?: number
          ga_pg_id?: number
          index_policy?: string | null
          intent_type?: string | null
          keyword_total?: number | null
          last_content_update?: string | null
          last_product_update?: string | null
          pg_level?: string | null
          pg_top?: string | null
          potential_level?: string | null
          priority_score?: number | null
          products_direct?: number | null
          products_total?: number | null
          products_via_family?: number | null
          products_via_vehicles?: number | null
          seo_content_raw_words?: number | null
          seo_score?: number | null
          smart_action_primary?: string | null
          smart_actions?: Json | null
          source_updated_at?: string | null
          topic_purity?: string | null
          trends_index?: number | null
          trends_updated_at?: string | null
          v2_count?: number | null
          v3_count?: number | null
          v4_count?: number | null
          v5_count?: number | null
          vehicle_coverage?: string | null
          vehicles_total?: number | null
          vlevel_counts?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_gamme_aggregates_pg"
            columns: ["ga_pg_id"]
            isOneToOne: true
            referencedRelation: "__pg_gammes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_gamme_aggregates_pg"
            columns: ["ga_pg_id"]
            isOneToOne: true
            referencedRelation: "__pg_gammes"
            referencedColumns: ["position"]
          },
          {
            foreignKeyName: "fk_gamme_aggregates_pg"
            columns: ["ga_pg_id"]
            isOneToOne: true
            referencedRelation: "pieces_gamme"
            referencedColumns: ["pg_id"]
          },
        ]
      }
      gamme_filter_criteria: {
        Row: {
          gfc_auto_generated: boolean
          gfc_cri_id: string
          gfc_cri_name: string
          gfc_cri_unit: string | null
          gfc_enabled: boolean
          gfc_filter_type: string
          gfc_id: number
          gfc_pg_id: number
          gfc_sort: number
        }
        Insert: {
          gfc_auto_generated?: boolean
          gfc_cri_id: string
          gfc_cri_name: string
          gfc_cri_unit?: string | null
          gfc_enabled?: boolean
          gfc_filter_type: string
          gfc_id?: number
          gfc_pg_id: number
          gfc_sort?: number
        }
        Update: {
          gfc_auto_generated?: boolean
          gfc_cri_id?: string
          gfc_cri_name?: string
          gfc_cri_unit?: string | null
          gfc_enabled?: boolean
          gfc_filter_type?: string
          gfc_id?: number
          gfc_pg_id?: number
          gfc_sort?: number
        }
        Relationships: []
      }
      gamme_seo_audit: {
        Row: {
          action_type: string
          admin_email: string | null
          admin_id: number | null
          created_at: string | null
          entity_ids: number[] | null
          entity_type: string | null
          id: number
          metadata: Json | null
          new_values: Json | null
          old_values: Json | null
        }
        Insert: {
          action_type: string
          admin_email?: string | null
          admin_id?: number | null
          created_at?: string | null
          entity_ids?: number[] | null
          entity_type?: string | null
          id?: number
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
        }
        Update: {
          action_type?: string
          admin_email?: string | null
          admin_id?: number | null
          created_at?: string | null
          entity_ids?: number[] | null
          entity_type?: string | null
          id?: number
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
        }
        Relationships: []
      }
      gamme_seo_metrics: {
        Row: {
          action_recommended: string | null
          bloc: string | null
          brand: string | null
          competition: string | null
          competition_index: number | null
          created_at: string | null
          energy: string | null
          g_level_recommended: string | null
          gamme_name: string | null
          id: number
          is_v1: boolean | null
          model_id: number | null
          model_name: string | null
          pg_id: number
          rank: number | null
          score: number | null
          search_volume: number | null
          trends_index: number | null
          trends_updated_at: string | null
          updated_at: string | null
          user_action: string | null
          user_notes: string | null
          v_level: string | null
          v2_count: number | null
          variant_id: number | null
          variant_name: string | null
        }
        Insert: {
          action_recommended?: string | null
          bloc?: string | null
          brand?: string | null
          competition?: string | null
          competition_index?: number | null
          created_at?: string | null
          energy?: string | null
          g_level_recommended?: string | null
          gamme_name?: string | null
          id?: number
          is_v1?: boolean | null
          model_id?: number | null
          model_name?: string | null
          pg_id: number
          rank?: number | null
          score?: number | null
          search_volume?: number | null
          trends_index?: number | null
          trends_updated_at?: string | null
          updated_at?: string | null
          user_action?: string | null
          user_notes?: string | null
          v_level?: string | null
          v2_count?: number | null
          variant_id?: number | null
          variant_name?: string | null
        }
        Update: {
          action_recommended?: string | null
          bloc?: string | null
          brand?: string | null
          competition?: string | null
          competition_index?: number | null
          created_at?: string | null
          energy?: string | null
          g_level_recommended?: string | null
          gamme_name?: string | null
          id?: number
          is_v1?: boolean | null
          model_id?: number | null
          model_name?: string | null
          pg_id?: number
          rank?: number | null
          score?: number | null
          search_volume?: number | null
          trends_index?: number | null
          trends_updated_at?: string | null
          updated_at?: string | null
          user_action?: string | null
          user_notes?: string | null
          v_level?: string | null
          v2_count?: number | null
          variant_id?: number | null
          variant_name?: string | null
        }
        Relationships: []
      }
      gate_thresholds: {
        Row: {
          gt_action: string
          gt_created_at: string | null
          gt_description: string | null
          gt_enabled: boolean
          gt_family: string
          gt_gate: string
          gt_id: number
          gt_max_value: number
          gt_metric: string
        }
        Insert: {
          gt_action?: string
          gt_created_at?: string | null
          gt_description?: string | null
          gt_enabled?: boolean
          gt_family: string
          gt_gate: string
          gt_id?: number
          gt_max_value: number
          gt_metric: string
        }
        Update: {
          gt_action?: string
          gt_created_at?: string | null
          gt_description?: string | null
          gt_enabled?: boolean
          gt_family?: string
          gt_gate?: string
          gt_id?: number
          gt_max_value?: number
          gt_metric?: string
        }
        Relationships: []
      }
      golden_set_products: {
        Row: {
          created_at: string | null
          expected_compat_count: number | null
          expected_dimensions: Json | null
          gs_id: number
          last_verified_at: string | null
          piece_id: number
          reason: string
        }
        Insert: {
          created_at?: string | null
          expected_compat_count?: number | null
          expected_dimensions?: Json | null
          gs_id?: number
          last_verified_at?: string | null
          piece_id: number
          reason: string
        }
        Update: {
          created_at?: string | null
          expected_compat_count?: number | null
          expected_dimensions?: Json | null
          gs_id?: number
          last_verified_at?: string | null
          piece_id?: number
          reason?: string
        }
        Relationships: []
      }
      ic_postback: {
        Row: {
          amount: string | null
          currency: string | null
          datepayment: string | null
          id_com: string | null
          id_ic_postback: string
          idsite: string | null
          idste: string | null
          ip: string | null
          ips: string | null
          orderid: string | null
          paymentid: string | null
          paymentmethod: string | null
          status: string | null
          statuscode: string | null
          transactionid: string | null
        }
        Insert: {
          amount?: string | null
          currency?: string | null
          datepayment?: string | null
          id_com?: string | null
          id_ic_postback: string
          idsite?: string | null
          idste?: string | null
          ip?: string | null
          ips?: string | null
          orderid?: string | null
          paymentid?: string | null
          paymentmethod?: string | null
          status?: string | null
          statuscode?: string | null
          transactionid?: string | null
        }
        Update: {
          amount?: string | null
          currency?: string | null
          datepayment?: string | null
          id_com?: string | null
          id_ic_postback?: string
          idsite?: string | null
          idste?: string | null
          ip?: string | null
          ips?: string | null
          orderid?: string | null
          paymentid?: string | null
          paymentmethod?: string | null
          status?: string | null
          statuscode?: string | null
          transactionid?: string | null
        }
        Relationships: []
      }
      import_batch: {
        Row: {
          batch_id: number
          completed_at: string | null
          created_by: string | null
          error_count: number | null
          metadata: Json | null
          record_count: number | null
          source_file: string | null
          source_hash: string | null
          source_system: string
          started_at: string | null
          status: string | null
        }
        Insert: {
          batch_id?: number
          completed_at?: string | null
          created_by?: string | null
          error_count?: number | null
          metadata?: Json | null
          record_count?: number | null
          source_file?: string | null
          source_hash?: string | null
          source_system: string
          started_at?: string | null
          status?: string | null
        }
        Update: {
          batch_id?: number
          completed_at?: string | null
          created_by?: string | null
          error_count?: number | null
          metadata?: Json | null
          record_count?: number | null
          source_file?: string | null
          source_hash?: string | null
          source_system?: string
          started_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      kg_audit_log: {
        Row: {
          action: string
          changed_fields: string[] | null
          entity_id: string
          entity_type: string
          log_id: string
          new_data: Json | null
          old_data: Json | null
          performed_at: string
          performed_by: string | null
          reason: string | null
        }
        Insert: {
          action: string
          changed_fields?: string[] | null
          entity_id: string
          entity_type: string
          log_id?: string
          new_data?: Json | null
          old_data?: Json | null
          performed_at?: string
          performed_by?: string | null
          reason?: string | null
        }
        Update: {
          action?: string
          changed_fields?: string[] | null
          entity_id?: string
          entity_type?: string
          log_id?: string
          new_data?: Json | null
          old_data?: Json | null
          performed_at?: string
          performed_by?: string | null
          reason?: string | null
        }
        Relationships: []
      }
      kg_case_outcomes: {
        Row: {
          case_id: string | null
          created_at: string | null
          customer_comment: string | null
          customer_rating: number | null
          garage_id: string | null
          garage_name: string | null
          invoice_amount: number | null
          invoice_date: string | null
          invoice_ref: string | null
          order_id: number | null
          outcome_id: string
          parts_purchased: Json | null
          parts_replaced: Json | null
          problem_solved: boolean | null
          refund_amount: number | null
          return_date: string | null
          return_reason: string | null
          total_amount: number | null
          work_performed: string | null
          would_recommend: boolean | null
        }
        Insert: {
          case_id?: string | null
          created_at?: string | null
          customer_comment?: string | null
          customer_rating?: number | null
          garage_id?: string | null
          garage_name?: string | null
          invoice_amount?: number | null
          invoice_date?: string | null
          invoice_ref?: string | null
          order_id?: number | null
          outcome_id?: string
          parts_purchased?: Json | null
          parts_replaced?: Json | null
          problem_solved?: boolean | null
          refund_amount?: number | null
          return_date?: string | null
          return_reason?: string | null
          total_amount?: number | null
          work_performed?: string | null
          would_recommend?: boolean | null
        }
        Update: {
          case_id?: string | null
          created_at?: string | null
          customer_comment?: string | null
          customer_rating?: number | null
          garage_id?: string | null
          garage_name?: string | null
          invoice_amount?: number | null
          invoice_date?: string | null
          invoice_ref?: string | null
          order_id?: number | null
          outcome_id?: string
          parts_purchased?: Json | null
          parts_replaced?: Json | null
          problem_solved?: boolean | null
          refund_amount?: number | null
          return_date?: string | null
          return_reason?: string | null
          total_amount?: number | null
          work_performed?: string | null
          would_recommend?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "kg_case_outcomes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "kg_cases"
            referencedColumns: ["case_id"]
          },
        ]
      }
      kg_cases: {
        Row: {
          case_id: string
          confidence_at_diagnosis: number | null
          created_at: string | null
          current_km: number | null
          diagnosis_correct: boolean | null
          diagnosis_result: Json | null
          diagnosis_timestamp: string | null
          engine_family_code: string | null
          ktypnr: number | null
          observable_ids: string[] | null
          order_id: number | null
          outcome_fault_id: string | null
          outcome_fault_label: string | null
          outcome_type: string | null
          predicted_fault_id: string | null
          predicted_fault_label: string | null
          safety_gate: string | null
          session_id: string | null
          updated_at: string | null
          user_id: string | null
          vehicle_age_months: number | null
          vehicle_id: string | null
          verification_method: string | null
          verification_notes: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          case_id?: string
          confidence_at_diagnosis?: number | null
          created_at?: string | null
          current_km?: number | null
          diagnosis_correct?: boolean | null
          diagnosis_result?: Json | null
          diagnosis_timestamp?: string | null
          engine_family_code?: string | null
          ktypnr?: number | null
          observable_ids?: string[] | null
          order_id?: number | null
          outcome_fault_id?: string | null
          outcome_fault_label?: string | null
          outcome_type?: string | null
          predicted_fault_id?: string | null
          predicted_fault_label?: string | null
          safety_gate?: string | null
          session_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          vehicle_age_months?: number | null
          vehicle_id?: string | null
          verification_method?: string | null
          verification_notes?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          case_id?: string
          confidence_at_diagnosis?: number | null
          created_at?: string | null
          current_km?: number | null
          diagnosis_correct?: boolean | null
          diagnosis_result?: Json | null
          diagnosis_timestamp?: string | null
          engine_family_code?: string | null
          ktypnr?: number | null
          observable_ids?: string[] | null
          order_id?: number | null
          outcome_fault_id?: string | null
          outcome_fault_label?: string | null
          outcome_type?: string | null
          predicted_fault_id?: string | null
          predicted_fault_label?: string | null
          safety_gate?: string | null
          session_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          vehicle_age_months?: number | null
          vehicle_id?: string | null
          verification_method?: string | null
          verification_notes?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      kg_confidence_config: {
        Row: {
          config_id: string
          created_at: string | null
          is_active: boolean | null
          notes: string | null
          prob_high_threshold: number | null
          prob_low_threshold: number | null
          prob_medium_threshold: number | null
          prob_very_high_threshold: number | null
          threshold_good: number | null
          threshold_high: number | null
          threshold_low: number | null
          threshold_medium: number | null
          updated_at: string | null
          weight_base: number | null
          weight_context: number | null
          weight_dtc: number | null
          weight_history: number | null
          weight_km: number | null
          weight_known_vehicle: number | null
          weight_multiple_observables: number | null
        }
        Insert: {
          config_id?: string
          created_at?: string | null
          is_active?: boolean | null
          notes?: string | null
          prob_high_threshold?: number | null
          prob_low_threshold?: number | null
          prob_medium_threshold?: number | null
          prob_very_high_threshold?: number | null
          threshold_good?: number | null
          threshold_high?: number | null
          threshold_low?: number | null
          threshold_medium?: number | null
          updated_at?: string | null
          weight_base?: number | null
          weight_context?: number | null
          weight_dtc?: number | null
          weight_history?: number | null
          weight_km?: number | null
          weight_known_vehicle?: number | null
          weight_multiple_observables?: number | null
        }
        Update: {
          config_id?: string
          created_at?: string | null
          is_active?: boolean | null
          notes?: string | null
          prob_high_threshold?: number | null
          prob_low_threshold?: number | null
          prob_medium_threshold?: number | null
          prob_very_high_threshold?: number | null
          threshold_good?: number | null
          threshold_high?: number | null
          threshold_low?: number | null
          threshold_medium?: number | null
          updated_at?: string | null
          weight_base?: number | null
          weight_context?: number | null
          weight_dtc?: number | null
          weight_history?: number | null
          weight_km?: number | null
          weight_known_vehicle?: number | null
          weight_multiple_observables?: number | null
        }
        Relationships: []
      }
      kg_diagnostic_cases: {
        Row: {
          actual_fault_id: string | null
          case_id: string
          created_at: string | null
          feedback_source: string | null
          learning_applied: boolean | null
          learning_applied_at: string | null
          observable_ids: string[]
          outcome_recorded_at: string | null
          outcome_status: string | null
          predicted_fault_id: string | null
          predicted_score: number | null
          session_id: string | null
          user_id: string | null
          vehicle_context: Json | null
        }
        Insert: {
          actual_fault_id?: string | null
          case_id?: string
          created_at?: string | null
          feedback_source?: string | null
          learning_applied?: boolean | null
          learning_applied_at?: string | null
          observable_ids: string[]
          outcome_recorded_at?: string | null
          outcome_status?: string | null
          predicted_fault_id?: string | null
          predicted_score?: number | null
          session_id?: string | null
          user_id?: string | null
          vehicle_context?: Json | null
        }
        Update: {
          actual_fault_id?: string | null
          case_id?: string
          created_at?: string | null
          feedback_source?: string | null
          learning_applied?: boolean | null
          learning_applied_at?: string | null
          observable_ids?: string[]
          outcome_recorded_at?: string | null
          outcome_status?: string | null
          predicted_fault_id?: string | null
          predicted_score?: number | null
          session_id?: string | null
          user_id?: string | null
          vehicle_context?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "kg_diagnostic_cases_actual_fault_id_fkey"
            columns: ["actual_fault_id"]
            isOneToOne: false
            referencedRelation: "kg_active_nodes"
            referencedColumns: ["node_id"]
          },
          {
            foreignKeyName: "kg_diagnostic_cases_actual_fault_id_fkey"
            columns: ["actual_fault_id"]
            isOneToOne: false
            referencedRelation: "kg_diagnosis_stats"
            referencedColumns: ["fault_id"]
          },
          {
            foreignKeyName: "kg_diagnostic_cases_actual_fault_id_fkey"
            columns: ["actual_fault_id"]
            isOneToOne: false
            referencedRelation: "kg_nodes"
            referencedColumns: ["node_id"]
          },
          {
            foreignKeyName: "kg_diagnostic_cases_actual_fault_id_fkey"
            columns: ["actual_fault_id"]
            isOneToOne: false
            referencedRelation: "kg_observables_with_context"
            referencedColumns: ["node_id"]
          },
          {
            foreignKeyName: "kg_diagnostic_cases_predicted_fault_id_fkey"
            columns: ["predicted_fault_id"]
            isOneToOne: false
            referencedRelation: "kg_active_nodes"
            referencedColumns: ["node_id"]
          },
          {
            foreignKeyName: "kg_diagnostic_cases_predicted_fault_id_fkey"
            columns: ["predicted_fault_id"]
            isOneToOne: false
            referencedRelation: "kg_diagnosis_stats"
            referencedColumns: ["fault_id"]
          },
          {
            foreignKeyName: "kg_diagnostic_cases_predicted_fault_id_fkey"
            columns: ["predicted_fault_id"]
            isOneToOne: false
            referencedRelation: "kg_nodes"
            referencedColumns: ["node_id"]
          },
          {
            foreignKeyName: "kg_diagnostic_cases_predicted_fault_id_fkey"
            columns: ["predicted_fault_id"]
            isOneToOne: false
            referencedRelation: "kg_observables_with_context"
            referencedColumns: ["node_id"]
          },
        ]
      }
      kg_edge_history: {
        Row: {
          change_reason: string | null
          changed_at: string | null
          changed_by: string | null
          confidence_after: number | null
          confidence_before: number | null
          edge_data_snapshot: Json | null
          edge_id: string
          history_id: string
          version: number
          weight_after: number | null
          weight_before: number | null
        }
        Insert: {
          change_reason?: string | null
          changed_at?: string | null
          changed_by?: string | null
          confidence_after?: number | null
          confidence_before?: number | null
          edge_data_snapshot?: Json | null
          edge_id: string
          history_id?: string
          version: number
          weight_after?: number | null
          weight_before?: number | null
        }
        Update: {
          change_reason?: string | null
          changed_at?: string | null
          changed_by?: string | null
          confidence_after?: number | null
          confidence_before?: number | null
          edge_data_snapshot?: Json | null
          edge_id?: string
          history_id?: string
          version?: number
          weight_after?: number | null
          weight_before?: number | null
        }
        Relationships: []
      }
      kg_edges: {
        Row: {
          confidence: number | null
          confidence_base: number | null
          created_at: string
          created_by: string | null
          edge_id: string
          edge_type: string
          evidence: Json | null
          is_active: boolean | null
          is_bidirectional: boolean | null
          source_node_id: string
          source_type: string | null
          sources: string[] | null
          status: string | null
          target_node_id: string
          updated_at: string
          valid_from: string | null
          valid_to: string | null
          version: number | null
          weight: number | null
        }
        Insert: {
          confidence?: number | null
          confidence_base?: number | null
          created_at?: string
          created_by?: string | null
          edge_id?: string
          edge_type: string
          evidence?: Json | null
          is_active?: boolean | null
          is_bidirectional?: boolean | null
          source_node_id: string
          source_type?: string | null
          sources?: string[] | null
          status?: string | null
          target_node_id: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
          version?: number | null
          weight?: number | null
        }
        Update: {
          confidence?: number | null
          confidence_base?: number | null
          created_at?: string
          created_by?: string | null
          edge_id?: string
          edge_type?: string
          evidence?: Json | null
          is_active?: boolean | null
          is_bidirectional?: boolean | null
          source_node_id?: string
          source_type?: string | null
          sources?: string[] | null
          status?: string | null
          target_node_id?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
          version?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kg_edges_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "kg_active_nodes"
            referencedColumns: ["node_id"]
          },
          {
            foreignKeyName: "kg_edges_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "kg_diagnosis_stats"
            referencedColumns: ["fault_id"]
          },
          {
            foreignKeyName: "kg_edges_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "kg_nodes"
            referencedColumns: ["node_id"]
          },
          {
            foreignKeyName: "kg_edges_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "kg_observables_with_context"
            referencedColumns: ["node_id"]
          },
          {
            foreignKeyName: "kg_edges_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "kg_active_nodes"
            referencedColumns: ["node_id"]
          },
          {
            foreignKeyName: "kg_edges_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "kg_diagnosis_stats"
            referencedColumns: ["fault_id"]
          },
          {
            foreignKeyName: "kg_edges_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "kg_nodes"
            referencedColumns: ["node_id"]
          },
          {
            foreignKeyName: "kg_edges_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "kg_observables_with_context"
            referencedColumns: ["node_id"]
          },
        ]
      }
      kg_engine_families: {
        Row: {
          common_issues: Json | null
          created_at: string | null
          displacement_cc: number | null
          family_code: string
          family_id: string
          family_name: string
          fuel_type: string | null
          is_active: boolean | null
          manufacturer: string | null
        }
        Insert: {
          common_issues?: Json | null
          created_at?: string | null
          displacement_cc?: number | null
          family_code: string
          family_id?: string
          family_name: string
          fuel_type?: string | null
          is_active?: boolean | null
          manufacturer?: string | null
        }
        Update: {
          common_issues?: Json | null
          created_at?: string | null
          displacement_cc?: number | null
          family_code?: string
          family_id?: string
          family_name?: string
          fuel_type?: string | null
          is_active?: boolean | null
          manufacturer?: string | null
        }
        Relationships: []
      }
      kg_feedback_config: {
        Row: {
          config_key: string
          config_value: Json
          description: string | null
          updated_at: string | null
        }
        Insert: {
          config_key: string
          config_value: Json
          description?: string | null
          updated_at?: string | null
        }
        Update: {
          config_key?: string
          config_value?: Json
          description?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      kg_feedback_events: {
        Row: {
          created_at: string | null
          diagnosis_cache_id: string | null
          edge_id: string | null
          event_id: string
          event_type: string
          fault_id: string | null
          feedback_data: Json | null
          feedback_source: string
          observable_ids: string[] | null
          processed: boolean | null
          processed_at: string | null
          processing_result: Json | null
          sentiment: string | null
          session_id: string | null
          source_reliability: number
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          diagnosis_cache_id?: string | null
          edge_id?: string | null
          event_id?: string
          event_type: string
          fault_id?: string | null
          feedback_data?: Json | null
          feedback_source: string
          observable_ids?: string[] | null
          processed?: boolean | null
          processed_at?: string | null
          processing_result?: Json | null
          sentiment?: string | null
          session_id?: string | null
          source_reliability?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          diagnosis_cache_id?: string | null
          edge_id?: string | null
          event_id?: string
          event_type?: string
          fault_id?: string | null
          feedback_data?: Json | null
          feedback_source?: string
          observable_ids?: string[] | null
          processed?: boolean | null
          processed_at?: string | null
          processing_result?: Json | null
          sentiment?: string | null
          session_id?: string | null
          source_reliability?: number
          user_id?: string | null
        }
        Relationships: []
      }
      kg_learning_log: {
        Row: {
          adjustment_reason: string | null
          applied_at: string | null
          applied_by: string | null
          batch_id: string | null
          case_id: string | null
          edge_id: string | null
          log_id: string
          new_confidence: number | null
          new_weight: number | null
          old_confidence: number | null
          old_weight: number | null
        }
        Insert: {
          adjustment_reason?: string | null
          applied_at?: string | null
          applied_by?: string | null
          batch_id?: string | null
          case_id?: string | null
          edge_id?: string | null
          log_id?: string
          new_confidence?: number | null
          new_weight?: number | null
          old_confidence?: number | null
          old_weight?: number | null
        }
        Update: {
          adjustment_reason?: string | null
          applied_at?: string | null
          applied_by?: string | null
          batch_id?: string | null
          case_id?: string | null
          edge_id?: string | null
          log_id?: string
          new_confidence?: number | null
          new_weight?: number | null
          old_confidence?: number | null
          old_weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kg_learning_log_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "kg_cases"
            referencedColumns: ["case_id"]
          },
        ]
      }
      kg_node_history: {
        Row: {
          change_reason: string | null
          changed_at: string | null
          changed_by: string | null
          changed_fields: string[] | null
          history_id: string
          node_data_snapshot: Json
          node_id: string
          version: number
        }
        Insert: {
          change_reason?: string | null
          changed_at?: string | null
          changed_by?: string | null
          changed_fields?: string[] | null
          history_id?: string
          node_data_snapshot: Json
          node_id: string
          version: number
        }
        Update: {
          change_reason?: string | null
          changed_at?: string | null
          changed_by?: string | null
          changed_fields?: string[] | null
          history_id?: string
          node_data_snapshot?: Json
          node_id?: string
          version?: number
        }
        Relationships: []
      }
      kg_nodes: {
        Row: {
          action_type: string | null
          confidence: number | null
          confidence_base: number | null
          created_at: string
          created_by: string | null
          ctx_load: string | null
          ctx_phase: string | null
          ctx_road: string | null
          ctx_speed: string | null
          ctx_temp: string | null
          dtc_code: string | null
          effectiveness: number | null
          estimated_cost_max: number | null
          estimated_cost_min: number | null
          estimated_duration: string | null
          frequency: string | null
          input_type: string | null
          intensity: number | null
          interval_type: string | null
          is_active: boolean | null
          is_preventable: boolean | null
          km_interval: number | null
          km_interval_base: number | null
          ktype_ids: number[] | null
          maintenance_priority: string | null
          month_interval: number | null
          month_interval_base: number | null
          node_alias: string | null
          node_category: string | null
          node_data: Json | null
          node_id: string
          node_label: string
          node_type: string
          oem_codes: string[] | null
          part_priority: string | null
          perception_channel: string | null
          prerequisites: Json | null
          recall_code: string | null
          recall_end_date: string | null
          recall_severity: string | null
          recall_start_date: string | null
          replacement_type: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          risk_level: string | null
          risk_slope: number | null
          risk_threshold_critical: number | null
          risk_threshold_high: number | null
          risk_threshold_medium: number | null
          root_cause_category: string | null
          safety_gate: string | null
          safety_level: string | null
          skill_level: string | null
          source_type: string | null
          sources: string[] | null
          status: string | null
          tools_required: Json | null
          updated_at: string
          urgency: string | null
          valid_from: string | null
          valid_to: string | null
          validation_status: string | null
          version: number | null
          warranty_impact: string | null
          wear_factor_aggressive: number | null
          wear_factor_diesel: number | null
          wear_factor_extreme: number | null
          wear_factor_heavy_load: number | null
          wear_factor_urban: number | null
          year_from: number | null
          year_to: number | null
        }
        Insert: {
          action_type?: string | null
          confidence?: number | null
          confidence_base?: number | null
          created_at?: string
          created_by?: string | null
          ctx_load?: string | null
          ctx_phase?: string | null
          ctx_road?: string | null
          ctx_speed?: string | null
          ctx_temp?: string | null
          dtc_code?: string | null
          effectiveness?: number | null
          estimated_cost_max?: number | null
          estimated_cost_min?: number | null
          estimated_duration?: string | null
          frequency?: string | null
          input_type?: string | null
          intensity?: number | null
          interval_type?: string | null
          is_active?: boolean | null
          is_preventable?: boolean | null
          km_interval?: number | null
          km_interval_base?: number | null
          ktype_ids?: number[] | null
          maintenance_priority?: string | null
          month_interval?: number | null
          month_interval_base?: number | null
          node_alias?: string | null
          node_category?: string | null
          node_data?: Json | null
          node_id?: string
          node_label: string
          node_type: string
          oem_codes?: string[] | null
          part_priority?: string | null
          perception_channel?: string | null
          prerequisites?: Json | null
          recall_code?: string | null
          recall_end_date?: string | null
          recall_severity?: string | null
          recall_start_date?: string | null
          replacement_type?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_level?: string | null
          risk_slope?: number | null
          risk_threshold_critical?: number | null
          risk_threshold_high?: number | null
          risk_threshold_medium?: number | null
          root_cause_category?: string | null
          safety_gate?: string | null
          safety_level?: string | null
          skill_level?: string | null
          source_type?: string | null
          sources?: string[] | null
          status?: string | null
          tools_required?: Json | null
          updated_at?: string
          urgency?: string | null
          valid_from?: string | null
          valid_to?: string | null
          validation_status?: string | null
          version?: number | null
          warranty_impact?: string | null
          wear_factor_aggressive?: number | null
          wear_factor_diesel?: number | null
          wear_factor_extreme?: number | null
          wear_factor_heavy_load?: number | null
          wear_factor_urban?: number | null
          year_from?: number | null
          year_to?: number | null
        }
        Update: {
          action_type?: string | null
          confidence?: number | null
          confidence_base?: number | null
          created_at?: string
          created_by?: string | null
          ctx_load?: string | null
          ctx_phase?: string | null
          ctx_road?: string | null
          ctx_speed?: string | null
          ctx_temp?: string | null
          dtc_code?: string | null
          effectiveness?: number | null
          estimated_cost_max?: number | null
          estimated_cost_min?: number | null
          estimated_duration?: string | null
          frequency?: string | null
          input_type?: string | null
          intensity?: number | null
          interval_type?: string | null
          is_active?: boolean | null
          is_preventable?: boolean | null
          km_interval?: number | null
          km_interval_base?: number | null
          ktype_ids?: number[] | null
          maintenance_priority?: string | null
          month_interval?: number | null
          month_interval_base?: number | null
          node_alias?: string | null
          node_category?: string | null
          node_data?: Json | null
          node_id?: string
          node_label?: string
          node_type?: string
          oem_codes?: string[] | null
          part_priority?: string | null
          perception_channel?: string | null
          prerequisites?: Json | null
          recall_code?: string | null
          recall_end_date?: string | null
          recall_severity?: string | null
          recall_start_date?: string | null
          replacement_type?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_level?: string | null
          risk_slope?: number | null
          risk_threshold_critical?: number | null
          risk_threshold_high?: number | null
          risk_threshold_medium?: number | null
          root_cause_category?: string | null
          safety_gate?: string | null
          safety_level?: string | null
          skill_level?: string | null
          source_type?: string | null
          sources?: string[] | null
          status?: string | null
          tools_required?: Json | null
          updated_at?: string
          urgency?: string | null
          valid_from?: string | null
          valid_to?: string | null
          validation_status?: string | null
          version?: number | null
          warranty_impact?: string | null
          wear_factor_aggressive?: number | null
          wear_factor_diesel?: number | null
          wear_factor_extreme?: number | null
          wear_factor_heavy_load?: number | null
          wear_factor_urban?: number | null
          year_from?: number | null
          year_to?: number | null
        }
        Relationships: []
      }
      kg_rag_mapping: {
        Row: {
          created_at: string | null
          kg_node_id: string
          mapping_id: string
          rag_file_path: string
          rag_item_id: string
          rag_item_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          kg_node_id: string
          mapping_id?: string
          rag_file_path: string
          rag_item_id: string
          rag_item_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          kg_node_id?: string
          mapping_id?: string
          rag_file_path?: string
          rag_item_id?: string
          rag_item_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kg_rag_mapping_kg_node_id_fkey"
            columns: ["kg_node_id"]
            isOneToOne: false
            referencedRelation: "kg_active_nodes"
            referencedColumns: ["node_id"]
          },
          {
            foreignKeyName: "kg_rag_mapping_kg_node_id_fkey"
            columns: ["kg_node_id"]
            isOneToOne: false
            referencedRelation: "kg_diagnosis_stats"
            referencedColumns: ["fault_id"]
          },
          {
            foreignKeyName: "kg_rag_mapping_kg_node_id_fkey"
            columns: ["kg_node_id"]
            isOneToOne: false
            referencedRelation: "kg_nodes"
            referencedColumns: ["node_id"]
          },
          {
            foreignKeyName: "kg_rag_mapping_kg_node_id_fkey"
            columns: ["kg_node_id"]
            isOneToOne: false
            referencedRelation: "kg_observables_with_context"
            referencedColumns: ["node_id"]
          },
        ]
      }
      kg_rag_sync_log: {
        Row: {
          affected_edge_ids: string[] | null
          affected_node_ids: string[] | null
          edges_created: number | null
          edges_updated: number | null
          errors_count: number | null
          errors_detail: Json | null
          nodes_created: number | null
          nodes_updated: number | null
          rag_category: string | null
          rag_file_hash: string
          rag_file_path: string
          sync_duration_ms: number | null
          sync_id: string
          synced_at: string | null
        }
        Insert: {
          affected_edge_ids?: string[] | null
          affected_node_ids?: string[] | null
          edges_created?: number | null
          edges_updated?: number | null
          errors_count?: number | null
          errors_detail?: Json | null
          nodes_created?: number | null
          nodes_updated?: number | null
          rag_category?: string | null
          rag_file_hash: string
          rag_file_path: string
          sync_duration_ms?: number | null
          sync_id?: string
          synced_at?: string | null
        }
        Update: {
          affected_edge_ids?: string[] | null
          affected_node_ids?: string[] | null
          edges_created?: number | null
          edges_updated?: number | null
          errors_count?: number | null
          errors_detail?: Json | null
          nodes_created?: number | null
          nodes_updated?: number | null
          rag_category?: string | null
          rag_file_hash?: string
          rag_file_path?: string
          sync_duration_ms?: number | null
          sync_id?: string
          synced_at?: string | null
        }
        Relationships: []
      }
      kg_reasoning_cache: {
        Row: {
          cache_id: string
          computation_time_ms: number | null
          computed_at: string
          expires_at: string | null
          hit_count: number | null
          input_node_ids: string[] | null
          input_observables: string[]
          last_hit_at: string | null
          query_hash: string
          result_explanation: string | null
          result_faults: Json
          result_primary_fault_id: string | null
          result_score: number | null
          traversal_paths: Json | null
          vehicle_node_id: string | null
        }
        Insert: {
          cache_id?: string
          computation_time_ms?: number | null
          computed_at?: string
          expires_at?: string | null
          hit_count?: number | null
          input_node_ids?: string[] | null
          input_observables: string[]
          last_hit_at?: string | null
          query_hash: string
          result_explanation?: string | null
          result_faults?: Json
          result_primary_fault_id?: string | null
          result_score?: number | null
          traversal_paths?: Json | null
          vehicle_node_id?: string | null
        }
        Update: {
          cache_id?: string
          computation_time_ms?: number | null
          computed_at?: string
          expires_at?: string | null
          hit_count?: number | null
          input_node_ids?: string[] | null
          input_observables?: string[]
          last_hit_at?: string | null
          query_hash?: string
          result_explanation?: string | null
          result_faults?: Json
          result_primary_fault_id?: string | null
          result_score?: number | null
          traversal_paths?: Json | null
          vehicle_node_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kg_reasoning_cache_result_primary_fault_id_fkey"
            columns: ["result_primary_fault_id"]
            isOneToOne: false
            referencedRelation: "kg_active_nodes"
            referencedColumns: ["node_id"]
          },
          {
            foreignKeyName: "kg_reasoning_cache_result_primary_fault_id_fkey"
            columns: ["result_primary_fault_id"]
            isOneToOne: false
            referencedRelation: "kg_diagnosis_stats"
            referencedColumns: ["fault_id"]
          },
          {
            foreignKeyName: "kg_reasoning_cache_result_primary_fault_id_fkey"
            columns: ["result_primary_fault_id"]
            isOneToOne: false
            referencedRelation: "kg_nodes"
            referencedColumns: ["node_id"]
          },
          {
            foreignKeyName: "kg_reasoning_cache_result_primary_fault_id_fkey"
            columns: ["result_primary_fault_id"]
            isOneToOne: false
            referencedRelation: "kg_observables_with_context"
            referencedColumns: ["node_id"]
          },
          {
            foreignKeyName: "kg_reasoning_cache_vehicle_node_id_fkey"
            columns: ["vehicle_node_id"]
            isOneToOne: false
            referencedRelation: "kg_active_nodes"
            referencedColumns: ["node_id"]
          },
          {
            foreignKeyName: "kg_reasoning_cache_vehicle_node_id_fkey"
            columns: ["vehicle_node_id"]
            isOneToOne: false
            referencedRelation: "kg_diagnosis_stats"
            referencedColumns: ["fault_id"]
          },
          {
            foreignKeyName: "kg_reasoning_cache_vehicle_node_id_fkey"
            columns: ["vehicle_node_id"]
            isOneToOne: false
            referencedRelation: "kg_nodes"
            referencedColumns: ["node_id"]
          },
          {
            foreignKeyName: "kg_reasoning_cache_vehicle_node_id_fkey"
            columns: ["vehicle_node_id"]
            isOneToOne: false
            referencedRelation: "kg_observables_with_context"
            referencedColumns: ["node_id"]
          },
        ]
      }
      kg_review_queue: {
        Row: {
          entity_id: string
          entity_type: string
          review_id: string
          review_notes: string | null
          review_status: string | null
          reviewed_at: string | null
          reviewer: string | null
          submitted_at: string | null
          submitted_by: string
        }
        Insert: {
          entity_id: string
          entity_type: string
          review_id?: string
          review_notes?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewer?: string | null
          submitted_at?: string | null
          submitted_by: string
        }
        Update: {
          entity_id?: string
          entity_type?: string
          review_id?: string
          review_notes?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewer?: string | null
          submitted_at?: string | null
          submitted_by?: string
        }
        Relationships: []
      }
      kg_safety_triggers: {
        Row: {
          block_sales: boolean | null
          created_at: string | null
          dtc_code_pattern: string | null
          emergency_contact: string | null
          intensity_min: number | null
          is_active: boolean | null
          observable_label_pattern: string
          perception_channel: string | null
          priority: number | null
          recommended_action_en: string | null
          recommended_action_fr: string
          safety_gate: string
          safety_message_en: string | null
          safety_message_fr: string
          show_emergency_contact: boolean | null
          trigger_id: string
          updated_at: string | null
        }
        Insert: {
          block_sales?: boolean | null
          created_at?: string | null
          dtc_code_pattern?: string | null
          emergency_contact?: string | null
          intensity_min?: number | null
          is_active?: boolean | null
          observable_label_pattern: string
          perception_channel?: string | null
          priority?: number | null
          recommended_action_en?: string | null
          recommended_action_fr: string
          safety_gate: string
          safety_message_en?: string | null
          safety_message_fr: string
          show_emergency_contact?: boolean | null
          trigger_id?: string
          updated_at?: string | null
        }
        Update: {
          block_sales?: boolean | null
          created_at?: string | null
          dtc_code_pattern?: string | null
          emergency_contact?: string | null
          intensity_min?: number | null
          is_active?: boolean | null
          observable_label_pattern?: string
          perception_channel?: string | null
          priority?: number | null
          recommended_action_en?: string | null
          recommended_action_fr?: string
          safety_gate?: string
          safety_message_en?: string | null
          safety_message_fr?: string
          show_emergency_contact?: boolean | null
          trigger_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      kg_truth_labels: {
        Row: {
          confirmation_date: string
          confirmation_km: number | null
          confirmation_method: string
          created_at: string | null
          diagnosis_cache_id: string | null
          edge_ids: string[] | null
          evidence_data: Json | null
          fault_id: string | null
          label_id: string
          notes: string | null
          observable_ids: string[] | null
          order_id: string | null
          outcome_confirmed: boolean
          processed: boolean | null
          processed_at: string | null
          recalibration_applied: Json | null
          replaced_part_id: string | null
          replaced_part_pg_id: number | null
          submitted_by: string
          submitted_by_user_id: string | null
          updated_at: string | null
          verification_quality: string | null
        }
        Insert: {
          confirmation_date?: string
          confirmation_km?: number | null
          confirmation_method: string
          created_at?: string | null
          diagnosis_cache_id?: string | null
          edge_ids?: string[] | null
          evidence_data?: Json | null
          fault_id?: string | null
          label_id?: string
          notes?: string | null
          observable_ids?: string[] | null
          order_id?: string | null
          outcome_confirmed: boolean
          processed?: boolean | null
          processed_at?: string | null
          recalibration_applied?: Json | null
          replaced_part_id?: string | null
          replaced_part_pg_id?: number | null
          submitted_by: string
          submitted_by_user_id?: string | null
          updated_at?: string | null
          verification_quality?: string | null
        }
        Update: {
          confirmation_date?: string
          confirmation_km?: number | null
          confirmation_method?: string
          created_at?: string | null
          diagnosis_cache_id?: string | null
          edge_ids?: string[] | null
          evidence_data?: Json | null
          fault_id?: string | null
          label_id?: string
          notes?: string | null
          observable_ids?: string[] | null
          order_id?: string | null
          outcome_confirmed?: boolean
          processed?: boolean | null
          processed_at?: string | null
          recalibration_applied?: Json | null
          replaced_part_id?: string | null
          replaced_part_pg_id?: number | null
          submitted_by?: string
          submitted_by_user_id?: string | null
          updated_at?: string | null
          verification_quality?: string | null
        }
        Relationships: []
      }
      kg_weight_adjustments: {
        Row: {
          adjusted_at: string | null
          adjusted_by: string | null
          adjustment_id: string
          adjustment_reason: string
          calculation_formula: string | null
          confidence_after: number
          confidence_before: number
          edge_id: string
          feedback_count: number | null
          feedback_event_ids: string[] | null
          negative_count: number | null
          positive_count: number | null
          reliability_sum: number | null
          weight_after: number
          weight_before: number
        }
        Insert: {
          adjusted_at?: string | null
          adjusted_by?: string | null
          adjustment_id?: string
          adjustment_reason: string
          calculation_formula?: string | null
          confidence_after: number
          confidence_before: number
          edge_id: string
          feedback_count?: number | null
          feedback_event_ids?: string[] | null
          negative_count?: number | null
          positive_count?: number | null
          reliability_sum?: number | null
          weight_after: number
          weight_before: number
        }
        Update: {
          adjusted_at?: string | null
          adjusted_by?: string | null
          adjustment_id?: string
          adjustment_reason?: string
          calculation_formula?: string | null
          confidence_after?: number
          confidence_before?: number
          edge_id?: string
          feedback_count?: number | null
          feedback_event_ids?: string[] | null
          negative_count?: number | null
          positive_count?: number | null
          reliability_sum?: number | null
          weight_after?: number
          weight_before?: number
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string | null
          customer_id: string | null
          id: number
          is_archived: boolean | null
          is_read: boolean | null
          legacy_msg_id: string | null
          order_id: string | null
          parent_id: number | null
          staff_id: string | null
          subject: string
        }
        Insert: {
          content: string
          created_at?: string | null
          customer_id?: string | null
          id?: number
          is_archived?: boolean | null
          is_read?: boolean | null
          legacy_msg_id?: string | null
          order_id?: string | null
          parent_id?: number | null
          staff_id?: string | null
          subject: string
        }
        Update: {
          content?: string
          created_at?: string | null
          customer_id?: string | null
          id?: number
          is_archived?: boolean | null
          is_read?: boolean | null
          legacy_msg_id?: string | null
          order_id?: string | null
          parent_id?: number | null
          staff_id?: string | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      natural_key_article: {
        Row: {
          bf_version: number | null
          business_fingerprint: string
          canonical_brand: string | null
          canonical_dims: string | null
          canonical_ean: string | null
          canonical_ref: string | null
          canonical_type: string | null
          first_seen_at: string | null
          internal_id: number | null
          last_matched_at: string | null
          match_count: number | null
          metadata: Json | null
          nk_id: number
        }
        Insert: {
          bf_version?: number | null
          business_fingerprint: string
          canonical_brand?: string | null
          canonical_dims?: string | null
          canonical_ean?: string | null
          canonical_ref?: string | null
          canonical_type?: string | null
          first_seen_at?: string | null
          internal_id?: number | null
          last_matched_at?: string | null
          match_count?: number | null
          metadata?: Json | null
          nk_id?: number
        }
        Update: {
          bf_version?: number | null
          business_fingerprint?: string
          canonical_brand?: string | null
          canonical_dims?: string | null
          canonical_ean?: string | null
          canonical_ref?: string | null
          canonical_type?: string | null
          first_seen_at?: string | null
          internal_id?: number | null
          last_matched_at?: string | null
          match_count?: number | null
          metadata?: Json | null
          nk_id?: number
        }
        Relationships: []
      }
      natural_key_brand: {
        Row: {
          bf_version: number | null
          business_fingerprint: string
          canonical_name: string | null
          first_seen_at: string | null
          internal_id: number | null
          last_matched_at: string | null
          match_count: number | null
          metadata: Json | null
          nk_id: number
        }
        Insert: {
          bf_version?: number | null
          business_fingerprint: string
          canonical_name?: string | null
          first_seen_at?: string | null
          internal_id?: number | null
          last_matched_at?: string | null
          match_count?: number | null
          metadata?: Json | null
          nk_id?: number
        }
        Update: {
          bf_version?: number | null
          business_fingerprint?: string
          canonical_name?: string | null
          first_seen_at?: string | null
          internal_id?: number | null
          last_matched_at?: string | null
          match_count?: number | null
          metadata?: Json | null
          nk_id?: number
        }
        Relationships: []
      }
      natural_key_vehicle: {
        Row: {
          bf_version: number | null
          business_fingerprint: string
          canonical_engine: string | null
          canonical_make: string | null
          canonical_model: string | null
          first_seen_at: string | null
          internal_id: number | null
          last_matched_at: string | null
          match_count: number | null
          metadata: Json | null
          nk_id: number
          year_range: string | null
        }
        Insert: {
          bf_version?: number | null
          business_fingerprint: string
          canonical_engine?: string | null
          canonical_make?: string | null
          canonical_model?: string | null
          first_seen_at?: string | null
          internal_id?: number | null
          last_matched_at?: string | null
          match_count?: number | null
          metadata?: Json | null
          nk_id?: number
          year_range?: string | null
        }
        Update: {
          bf_version?: number | null
          business_fingerprint?: string
          canonical_engine?: string | null
          canonical_make?: string | null
          canonical_model?: string | null
          first_seen_at?: string | null
          internal_id?: number | null
          last_matched_at?: string | null
          match_count?: number | null
          metadata?: Json | null
          nk_id?: number
          year_range?: string | null
        }
        Relationships: []
      }
      norm_article: {
        Row: {
          artnr: string
          batch_id: number
          business_fingerprint: string | null
          composite_key: string | null
          dlnr: string
          ean_code: string | null
          genart: number | null
          norm_id: number
          normalized_at: string | null
          stg_id: number | null
          validation_error: string | null
          validation_status: string | null
        }
        Insert: {
          artnr: string
          batch_id: number
          business_fingerprint?: string | null
          composite_key?: string | null
          dlnr: string
          ean_code?: string | null
          genart?: number | null
          norm_id?: number
          normalized_at?: string | null
          stg_id?: number | null
          validation_error?: string | null
          validation_status?: string | null
        }
        Update: {
          artnr?: string
          batch_id?: number
          business_fingerprint?: string | null
          composite_key?: string | null
          dlnr?: string
          ean_code?: string | null
          genart?: number | null
          norm_id?: number
          normalized_at?: string | null
          stg_id?: number | null
          validation_error?: string | null
          validation_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "norm_article_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batch"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "norm_article_stg_id_fkey"
            columns: ["stg_id"]
            isOneToOne: false
            referencedRelation: "stg_article"
            referencedColumns: ["stg_id"]
          },
        ]
      }
      norm_brand: {
        Row: {
          batch_id: number
          brand_name: string
          brand_name_normalized: string | null
          business_fingerprint: string | null
          dlnr: string
          norm_id: number
          normalized_at: string | null
          stg_id: number | null
          validation_error: string | null
          validation_status: string | null
        }
        Insert: {
          batch_id: number
          brand_name: string
          brand_name_normalized?: string | null
          business_fingerprint?: string | null
          dlnr: string
          norm_id?: number
          normalized_at?: string | null
          stg_id?: number | null
          validation_error?: string | null
          validation_status?: string | null
        }
        Update: {
          batch_id?: number
          brand_name?: string
          brand_name_normalized?: string | null
          business_fingerprint?: string | null
          dlnr?: string
          norm_id?: number
          normalized_at?: string | null
          stg_id?: number | null
          validation_error?: string | null
          validation_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "norm_brand_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batch"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "norm_brand_stg_id_fkey"
            columns: ["stg_id"]
            isOneToOne: false
            referencedRelation: "stg_brand"
            referencedColumns: ["stg_id"]
          },
        ]
      }
      norm_vehicle: {
        Row: {
          batch_id: number
          business_fingerprint: string | null
          cc_tech: number | null
          engine_code: string | null
          hernr: number
          kmodnr: number | null
          ktypnr: number
          kw_power: number | null
          norm_id: number
          normalized_at: string | null
          ps_power: number | null
          stg_id: number | null
          validation_error: string | null
          validation_status: string | null
          year_from: number | null
          year_to: number | null
        }
        Insert: {
          batch_id: number
          business_fingerprint?: string | null
          cc_tech?: number | null
          engine_code?: string | null
          hernr: number
          kmodnr?: number | null
          ktypnr: number
          kw_power?: number | null
          norm_id?: number
          normalized_at?: string | null
          ps_power?: number | null
          stg_id?: number | null
          validation_error?: string | null
          validation_status?: string | null
          year_from?: number | null
          year_to?: number | null
        }
        Update: {
          batch_id?: number
          business_fingerprint?: string | null
          cc_tech?: number | null
          engine_code?: string | null
          hernr?: number
          kmodnr?: number | null
          ktypnr?: number
          kw_power?: number | null
          norm_id?: number
          normalized_at?: string | null
          ps_power?: number | null
          stg_id?: number | null
          validation_error?: string | null
          validation_status?: string | null
          year_from?: number | null
          year_to?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "norm_vehicle_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batch"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "norm_vehicle_stg_id_fkey"
            columns: ["stg_id"]
            isOneToOne: false
            referencedRelation: "stg_vehicle"
            referencedColumns: ["stg_id"]
          },
        ]
      }
      password_resets: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          token: string
          used: boolean | null
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          token: string
          used?: boolean | null
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          token?: string
          used?: boolean | null
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "password_resets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "___xtr_customer"
            referencedColumns: ["cst_id"]
          },
        ]
      }
      pieces: {
        Row: {
          piece_des: string | null
          piece_display: boolean
          piece_fil_id: number
          piece_fil_name: string | null
          piece_ga_id: number
          piece_has_img: boolean
          piece_has_oem: boolean
          piece_id: number
          piece_name: string | null
          piece_name_comp: string | null
          piece_name_side: string | null
          piece_pg_id: number
          piece_pg_pid: number
          piece_pm_id: number
          piece_psf_id: number
          piece_qty_pack: number
          piece_qty_sale: number
          piece_ref: string
          piece_ref_clean: string
          piece_sort: number
          piece_update: boolean
          piece_weight_kgm: number
          piece_year: number
          search_vector: unknown
        }
        Insert: {
          piece_des?: string | null
          piece_display?: boolean
          piece_fil_id?: number
          piece_fil_name?: string | null
          piece_ga_id: number
          piece_has_img?: boolean
          piece_has_oem?: boolean
          piece_id?: number
          piece_name?: string | null
          piece_name_comp?: string | null
          piece_name_side?: string | null
          piece_pg_id: number
          piece_pg_pid: number
          piece_pm_id: number
          piece_psf_id?: number
          piece_qty_pack?: number
          piece_qty_sale?: number
          piece_ref: string
          piece_ref_clean: string
          piece_sort?: number
          piece_update?: boolean
          piece_weight_kgm?: number
          piece_year?: number
          search_vector?: unknown
        }
        Update: {
          piece_des?: string | null
          piece_display?: boolean
          piece_fil_id?: number
          piece_fil_name?: string | null
          piece_ga_id?: number
          piece_has_img?: boolean
          piece_has_oem?: boolean
          piece_id?: number
          piece_name?: string | null
          piece_name_comp?: string | null
          piece_name_side?: string | null
          piece_pg_id?: number
          piece_pg_pid?: number
          piece_pm_id?: number
          piece_psf_id?: number
          piece_qty_pack?: number
          piece_qty_sale?: number
          piece_ref?: string
          piece_ref_clean?: string
          piece_sort?: number
          piece_update?: boolean
          piece_weight_kgm?: number
          piece_year?: number
          search_vector?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "fk_pieces_gamme"
            columns: ["piece_ga_id"]
            isOneToOne: false
            referencedRelation: "__pg_gammes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_pieces_gamme"
            columns: ["piece_ga_id"]
            isOneToOne: false
            referencedRelation: "__pg_gammes"
            referencedColumns: ["position"]
          },
          {
            foreignKeyName: "fk_pieces_gamme"
            columns: ["piece_ga_id"]
            isOneToOne: false
            referencedRelation: "pieces_gamme"
            referencedColumns: ["pg_id"]
          },
          {
            foreignKeyName: "fk_pieces_marque"
            columns: ["piece_pm_id"]
            isOneToOne: false
            referencedRelation: "pieces_marque"
            referencedColumns: ["pm_id"]
          },
        ]
      }
      pieces_criteria: {
        Row: {
          pc_cri_id: string
          pc_cri_value: string
          pc_display: string
          pc_ga_id: string
          pc_has_txt: string
          pc_pg_id: string
          pc_pg_pid: string
          pc_piece_id: string
          pc_sort: string
          pc_update_value: string
        }
        Insert: {
          pc_cri_id: string
          pc_cri_value: string
          pc_display: string
          pc_ga_id: string
          pc_has_txt: string
          pc_pg_id: string
          pc_pg_pid: string
          pc_piece_id: string
          pc_sort?: string
          pc_update_value?: string
        }
        Update: {
          pc_cri_id?: string
          pc_cri_value?: string
          pc_display?: string
          pc_ga_id?: string
          pc_has_txt?: string
          pc_pg_id?: string
          pc_pg_pid?: string
          pc_piece_id?: string
          pc_sort?: string
          pc_update_value?: string
        }
        Relationships: []
      }
      pieces_criteria_group: {
        Row: {
          cri_criteria: string | null
          cri_display: string | null
          cri_id: string
          cri_id_parent: string | null
          cri_id_successor: string | null
          cri_type_1: string | null
          cri_type_2: string | null
          cri_unit: string | null
        }
        Insert: {
          cri_criteria?: string | null
          cri_display?: string | null
          cri_id: string
          cri_id_parent?: string | null
          cri_id_successor?: string | null
          cri_type_1?: string | null
          cri_type_2?: string | null
          cri_unit?: string | null
        }
        Update: {
          cri_criteria?: string | null
          cri_display?: string | null
          cri_id?: string
          cri_id_parent?: string | null
          cri_id_successor?: string | null
          cri_type_1?: string | null
          cri_type_2?: string | null
          cri_unit?: string | null
        }
        Relationships: []
      }
      pieces_criteria_link: {
        Row: {
          pcl_cri_criteria: string | null
          pcl_cri_id: string
          pcl_cri_parent: string | null
          pcl_cri_type: string | null
          pcl_cri_unit: string | null
          pcl_display: string | null
          pcl_has_link: string | null
          pcl_is_filter: string | null
          pcl_level: string | null
          pcl_pg_id: string
          pcl_pg_pid: string
          pcl_sort: string | null
        }
        Insert: {
          pcl_cri_criteria?: string | null
          pcl_cri_id: string
          pcl_cri_parent?: string | null
          pcl_cri_type?: string | null
          pcl_cri_unit?: string | null
          pcl_display?: string | null
          pcl_has_link?: string | null
          pcl_is_filter?: string | null
          pcl_level?: string | null
          pcl_pg_id: string
          pcl_pg_pid: string
          pcl_sort?: string | null
        }
        Update: {
          pcl_cri_criteria?: string | null
          pcl_cri_id?: string
          pcl_cri_parent?: string | null
          pcl_cri_type?: string | null
          pcl_cri_unit?: string | null
          pcl_display?: string | null
          pcl_has_link?: string | null
          pcl_is_filter?: string | null
          pcl_level?: string | null
          pcl_pg_id?: string
          pcl_pg_pid?: string
          pcl_sort?: string | null
        }
        Relationships: []
      }
      pieces_details: {
        Row: {
          has_img: string | null
          has_oem: string | null
          pd_des_eng: string | null
          pd_display: string | null
          pd_is_accessory: string | null
          pd_pg_id: string | null
          pd_piece_id: string
          pd_pm_id: string | null
          pd_prb_id: string | null
          pd_pst_id: string | null
          pd_ref: string | null
          pd_ref_clean: string | null
          pd_weight_kgm: string | null
          pd_year: string | null
        }
        Insert: {
          has_img?: string | null
          has_oem?: string | null
          pd_des_eng?: string | null
          pd_display?: string | null
          pd_is_accessory?: string | null
          pd_pg_id?: string | null
          pd_piece_id: string
          pd_pm_id?: string | null
          pd_prb_id?: string | null
          pd_pst_id?: string | null
          pd_ref?: string | null
          pd_ref_clean?: string | null
          pd_weight_kgm?: string | null
          pd_year?: string | null
        }
        Update: {
          has_img?: string | null
          has_oem?: string | null
          pd_des_eng?: string | null
          pd_display?: string | null
          pd_is_accessory?: string | null
          pd_pg_id?: string | null
          pd_piece_id?: string
          pd_pm_id?: string | null
          pd_prb_id?: string | null
          pd_pst_id?: string | null
          pd_ref?: string | null
          pd_ref_clean?: string | null
          pd_weight_kgm?: string | null
          pd_year?: string | null
        }
        Relationships: []
      }
      pieces_gamme: {
        Row: {
          gamme_universelle: boolean | null
          pg_alias: string | null
          pg_cross: string | null
          pg_display: string | null
          pg_g_level: string | null
          pg_id: number
          pg_img: string | null
          pg_level: string | null
          pg_name: string | null
          pg_name_meta: string | null
          pg_name_url: string | null
          pg_parent: string | null
          pg_parent_gamme_id: number | null
          pg_pic: string | null
          pg_ppa_id: string | null
          pg_relfollow: string | null
          pg_sitemap: string | null
          pg_status: string | null
          pg_top: string | null
          pg_wall: string | null
        }
        Insert: {
          gamme_universelle?: boolean | null
          pg_alias?: string | null
          pg_cross?: string | null
          pg_display?: string | null
          pg_g_level?: string | null
          pg_id: number
          pg_img?: string | null
          pg_level?: string | null
          pg_name?: string | null
          pg_name_meta?: string | null
          pg_name_url?: string | null
          pg_parent?: string | null
          pg_parent_gamme_id?: number | null
          pg_pic?: string | null
          pg_ppa_id?: string | null
          pg_relfollow?: string | null
          pg_sitemap?: string | null
          pg_status?: string | null
          pg_top?: string | null
          pg_wall?: string | null
        }
        Update: {
          gamme_universelle?: boolean | null
          pg_alias?: string | null
          pg_cross?: string | null
          pg_display?: string | null
          pg_g_level?: string | null
          pg_id?: number
          pg_img?: string | null
          pg_level?: string | null
          pg_name?: string | null
          pg_name_meta?: string | null
          pg_name_url?: string | null
          pg_parent?: string | null
          pg_parent_gamme_id?: number | null
          pg_pic?: string | null
          pg_ppa_id?: string | null
          pg_relfollow?: string | null
          pg_sitemap?: string | null
          pg_status?: string | null
          pg_top?: string | null
          pg_wall?: string | null
        }
        Relationships: []
      }
      pieces_gamme_cross: {
        Row: {
          pgc_display: string | null
          pgc_id: string
          pgc_level: string | null
          pgc_pg_cross: string | null
          pgc_pg_id: string | null
          pgc_sort: string | null
        }
        Insert: {
          pgc_display?: string | null
          pgc_id: string
          pgc_level?: string | null
          pgc_pg_cross?: string | null
          pgc_pg_id?: string | null
          pgc_sort?: string | null
        }
        Update: {
          pgc_display?: string | null
          pgc_id?: string
          pgc_level?: string | null
          pgc_pg_cross?: string | null
          pgc_pg_id?: string | null
          pgc_sort?: string | null
        }
        Relationships: []
      }
      pieces_list: {
        Row: {
          pli_ga_id: string | null
          pli_piece_component: string
          pli_piece_id: string
          pli_quantity: string
          pli_sort: string
        }
        Insert: {
          pli_ga_id?: string | null
          pli_piece_component: string
          pli_piece_id: string
          pli_quantity: string
          pli_sort: string
        }
        Update: {
          pli_ga_id?: string | null
          pli_piece_component?: string
          pli_piece_id?: string
          pli_quantity?: string
          pli_sort?: string
        }
        Relationships: []
      }
      pieces_marque: {
        Row: {
          pm_alias: string | null
          pm_display: string | null
          pm_id: number
          pm_logo: string | null
          pm_name: string | null
          pm_name_meta: string | null
          pm_name_url: string | null
          pm_nature: string | null
          pm_nb_stars: string | null
          pm_oes: string | null
          pm_preview: string | null
          pm_quality: string | null
          pm_relfollow: string | null
          pm_sitemap: string | null
          pm_sort: string | null
          pm_top: string | null
        }
        Insert: {
          pm_alias?: string | null
          pm_display?: string | null
          pm_id: number
          pm_logo?: string | null
          pm_name?: string | null
          pm_name_meta?: string | null
          pm_name_url?: string | null
          pm_nature?: string | null
          pm_nb_stars?: string | null
          pm_oes?: string | null
          pm_preview?: string | null
          pm_quality?: string | null
          pm_relfollow?: string | null
          pm_sitemap?: string | null
          pm_sort?: string | null
          pm_top?: string | null
        }
        Update: {
          pm_alias?: string | null
          pm_display?: string | null
          pm_id?: number
          pm_logo?: string | null
          pm_name?: string | null
          pm_name_meta?: string | null
          pm_name_url?: string | null
          pm_nature?: string | null
          pm_nb_stars?: string | null
          pm_oes?: string | null
          pm_preview?: string | null
          pm_quality?: string | null
          pm_relfollow?: string | null
          pm_sitemap?: string | null
          pm_sort?: string | null
          pm_top?: string | null
        }
        Relationships: []
      }
      pieces_marque_next: {
        Row: {
          pm_active: boolean | null
          pm_created_at: string | null
          pm_id: number
          pm_logo: string | null
          pm_name: string
          pm_updated_at: string | null
        }
        Insert: {
          pm_active?: boolean | null
          pm_created_at?: string | null
          pm_id: number
          pm_logo?: string | null
          pm_name: string
          pm_updated_at?: string | null
        }
        Update: {
          pm_active?: boolean | null
          pm_created_at?: string | null
          pm_id?: number
          pm_logo?: string | null
          pm_name?: string
          pm_updated_at?: string | null
        }
        Relationships: []
      }
      pieces_media_img: {
        Row: {
          pmi_display: string | null
          pmi_folder: string
          pmi_name: string | null
          pmi_piece_id: string
          pmi_pm_id: string
          pmi_sort: string | null
        }
        Insert: {
          pmi_display?: string | null
          pmi_folder: string
          pmi_name?: string | null
          pmi_piece_id: string
          pmi_pm_id: string
          pmi_sort?: string | null
        }
        Update: {
          pmi_display?: string | null
          pmi_folder?: string
          pmi_name?: string | null
          pmi_piece_id?: string
          pmi_pm_id?: string
          pmi_sort?: string | null
        }
        Relationships: []
      }
      pieces_price: {
        Row: {
          pri_achat_ht: string | null
          pri_code_fam_nu: string | null
          pri_code_metier: string | null
          pri_code_remise: string | null
          pri_code_sfam_nu: string | null
          pri_consigne_ht: string | null
          pri_consigne_ttc: string | null
          pri_date_from: string | null
          pri_date_to: string | null
          pri_des: string | null
          pri_dispo: string | null
          pri_ean: string | null
          pri_frais_port_ht: string | null
          pri_frais_supp_ht: string | null
          pri_frs: string | null
          pri_frs_2: string | null
          pri_frs_3: string | null
          pri_frs_4: string | null
          pri_gros_ht: string | null
          pri_hauteur: string | null
          pri_insert_type: string | null
          pri_largeur: string | null
          pri_longueur: string | null
          pri_marge: string | null
          pri_piece_id: string
          pri_pm_id: string | null
          pri_poids: string | null
          pri_public_ht: string | null
          pri_qte_cond: string | null
          pri_qte_vente: string | null
          pri_ref: string | null
          pri_ref_comp: string | null
          pri_remise: string | null
          pri_remise_2: string | null
          pri_remise_3: string | null
          pri_remise_4: string | null
          pri_tva: string | null
          pri_type: string
          pri_udm_dimentions: string | null
          pri_udm_poids: string | null
          pri_vente_ht: string | null
          pri_vente_tn_ttc: string | null
          pri_vente_ttc: string | null
          pri_xls: string | null
        }
        Insert: {
          pri_achat_ht?: string | null
          pri_code_fam_nu?: string | null
          pri_code_metier?: string | null
          pri_code_remise?: string | null
          pri_code_sfam_nu?: string | null
          pri_consigne_ht?: string | null
          pri_consigne_ttc?: string | null
          pri_date_from?: string | null
          pri_date_to?: string | null
          pri_des?: string | null
          pri_dispo?: string | null
          pri_ean?: string | null
          pri_frais_port_ht?: string | null
          pri_frais_supp_ht?: string | null
          pri_frs?: string | null
          pri_frs_2?: string | null
          pri_frs_3?: string | null
          pri_frs_4?: string | null
          pri_gros_ht?: string | null
          pri_hauteur?: string | null
          pri_insert_type?: string | null
          pri_largeur?: string | null
          pri_longueur?: string | null
          pri_marge?: string | null
          pri_piece_id: string
          pri_pm_id?: string | null
          pri_poids?: string | null
          pri_public_ht?: string | null
          pri_qte_cond?: string | null
          pri_qte_vente?: string | null
          pri_ref?: string | null
          pri_ref_comp?: string | null
          pri_remise?: string | null
          pri_remise_2?: string | null
          pri_remise_3?: string | null
          pri_remise_4?: string | null
          pri_tva?: string | null
          pri_type: string
          pri_udm_dimentions?: string | null
          pri_udm_poids?: string | null
          pri_vente_ht?: string | null
          pri_vente_tn_ttc?: string | null
          pri_vente_ttc?: string | null
          pri_xls?: string | null
        }
        Update: {
          pri_achat_ht?: string | null
          pri_code_fam_nu?: string | null
          pri_code_metier?: string | null
          pri_code_remise?: string | null
          pri_code_sfam_nu?: string | null
          pri_consigne_ht?: string | null
          pri_consigne_ttc?: string | null
          pri_date_from?: string | null
          pri_date_to?: string | null
          pri_des?: string | null
          pri_dispo?: string | null
          pri_ean?: string | null
          pri_frais_port_ht?: string | null
          pri_frais_supp_ht?: string | null
          pri_frs?: string | null
          pri_frs_2?: string | null
          pri_frs_3?: string | null
          pri_frs_4?: string | null
          pri_gros_ht?: string | null
          pri_hauteur?: string | null
          pri_insert_type?: string | null
          pri_largeur?: string | null
          pri_longueur?: string | null
          pri_marge?: string | null
          pri_piece_id?: string
          pri_pm_id?: string | null
          pri_poids?: string | null
          pri_public_ht?: string | null
          pri_qte_cond?: string | null
          pri_qte_vente?: string | null
          pri_ref?: string | null
          pri_ref_comp?: string | null
          pri_remise?: string | null
          pri_remise_2?: string | null
          pri_remise_3?: string | null
          pri_remise_4?: string | null
          pri_tva?: string | null
          pri_type?: string
          pri_udm_dimentions?: string | null
          pri_udm_poids?: string | null
          pri_vente_ht?: string | null
          pri_vente_tn_ttc?: string | null
          pri_vente_ttc?: string | null
          pri_xls?: string | null
        }
        Relationships: []
      }
      pieces_ref_brand: {
        Row: {
          prb_display: string | null
          prb_id: string
          prb_is_cv: string | null
          prb_is_eng: string | null
          prb_is_mtb: string | null
          prb_is_pc: string | null
          prb_is_sup: string | null
          prb_name: string | null
        }
        Insert: {
          prb_display?: string | null
          prb_id: string
          prb_is_cv?: string | null
          prb_is_eng?: string | null
          prb_is_mtb?: string | null
          prb_is_pc?: string | null
          prb_is_sup?: string | null
          prb_name?: string | null
        }
        Update: {
          prb_display?: string | null
          prb_id?: string
          prb_is_cv?: string | null
          prb_is_eng?: string | null
          prb_is_mtb?: string | null
          prb_is_pc?: string | null
          prb_is_sup?: string | null
          prb_name?: string | null
        }
        Relationships: []
      }
      pieces_ref_ean: {
        Row: {
          pre_code_ean: string
          pre_piece_id: string
        }
        Insert: {
          pre_code_ean: string
          pre_piece_id: string
        }
        Update: {
          pre_code_ean?: string
          pre_piece_id?: string
        }
        Relationships: []
      }
      pieces_ref_oem: {
        Row: {
          pro_oem: string | null
          pro_oem_serach: string
          pro_piece_id: string
          pro_prb_id: string
          pro_year: string | null
        }
        Insert: {
          pro_oem?: string | null
          pro_oem_serach: string
          pro_piece_id: string
          pro_prb_id: string
          pro_year?: string | null
        }
        Update: {
          pro_oem?: string | null
          pro_oem_serach?: string
          pro_piece_id?: string
          pro_prb_id?: string
          pro_year?: string | null
        }
        Relationships: []
      }
      pieces_ref_search: {
        Row: {
          prs_kind: string
          prs_piece_id: string
          prs_piece_prime: string
          prs_prb_id: string
          prs_ref: string | null
          prs_search: string
          prs_year: string
        }
        Insert: {
          prs_kind: string
          prs_piece_id: string
          prs_piece_prime: string
          prs_prb_id: string
          prs_ref?: string | null
          prs_search: string
          prs_year: string
        }
        Update: {
          prs_kind?: string
          prs_piece_id?: string
          prs_piece_prime?: string
          prs_prb_id?: string
          prs_ref?: string | null
          prs_search?: string
          prs_year?: string
        }
        Relationships: []
      }
      pieces_relation_criteria: {
        Row: {
          rcp_cri_id: number
          rcp_cri_value: string
          rcp_display: number
          rcp_has_txt: number
          rcp_pg_id: number
          rcp_pg_pid: number
          rcp_piece_id: number
          rcp_pm_id: number
          rcp_sort: number
          rcp_type_id: number
        }
        Insert: {
          rcp_cri_id: number
          rcp_cri_value: string
          rcp_display: number
          rcp_has_txt: number
          rcp_pg_id: number
          rcp_pg_pid: number
          rcp_piece_id: number
          rcp_pm_id: number
          rcp_sort: number
          rcp_type_id: number
        }
        Update: {
          rcp_cri_id?: number
          rcp_cri_value?: string
          rcp_display?: number
          rcp_has_txt?: number
          rcp_pg_id?: number
          rcp_pg_pid?: number
          rcp_piece_id?: number
          rcp_pm_id?: number
          rcp_sort?: number
          rcp_type_id?: number
        }
        Relationships: []
      }
      pieces_relation_type: {
        Row: {
          rtp_ga_id: number
          rtp_inside: string | null
          rtp_pg_id: number
          rtp_pg_pid: number
          rtp_piece_id: number
          rtp_pm_id: number
          rtp_psf_id: number
          rtp_type_id: number
        }
        Insert: {
          rtp_ga_id: number
          rtp_inside?: string | null
          rtp_pg_id: number
          rtp_pg_pid: number
          rtp_piece_id: number
          rtp_pm_id: number
          rtp_psf_id?: number
          rtp_type_id: number
        }
        Update: {
          rtp_ga_id?: number
          rtp_inside?: string | null
          rtp_pg_id?: number
          rtp_pg_pid?: number
          rtp_piece_id?: number
          rtp_pm_id?: number
          rtp_psf_id?: number
          rtp_type_id?: number
        }
        Relationships: []
      }
      pieces_side_filtre: {
        Row: {
          psf_display: number | null
          psf_id: number
          psf_side: string | null
          psf_sort: number | null
        }
        Insert: {
          psf_display?: number | null
          psf_id: number
          psf_side?: string | null
          psf_sort?: number | null
        }
        Update: {
          psf_display?: number | null
          psf_id?: number
          psf_side?: string | null
          psf_sort?: number | null
        }
        Relationships: []
      }
      pieces_status: {
        Row: {
          pst_description: string | null
          pst_display: string | null
          pst_id: string
          pst_sort: string | null
        }
        Insert: {
          pst_description?: string | null
          pst_display?: string | null
          pst_id: string
          pst_sort?: string | null
        }
        Update: {
          pst_description?: string | null
          pst_display?: string | null
          pst_id?: string
          pst_sort?: string | null
        }
        Relationships: []
      }
      pipeline_event_log: {
        Row: {
          pel_batch_id: number
          pel_context: Json | null
          pel_counts: Json | null
          pel_duration_ms: number | null
          pel_ended_at: string | null
          pel_error: string | null
          pel_id: number
          pel_started_at: string
          pel_status: string
          pel_step: string
        }
        Insert: {
          pel_batch_id: number
          pel_context?: Json | null
          pel_counts?: Json | null
          pel_duration_ms?: number | null
          pel_ended_at?: string | null
          pel_error?: string | null
          pel_id?: number
          pel_started_at?: string
          pel_status?: string
          pel_step: string
        }
        Update: {
          pel_batch_id?: number
          pel_context?: Json | null
          pel_counts?: Json | null
          pel_duration_ms?: number | null
          pel_ended_at?: string | null
          pel_error?: string | null
          pel_id?: number
          pel_started_at?: string
          pel_status?: string
          pel_step?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string | null
          id: string
          name: string
          price: number | null
          sku: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          id?: string
          name: string
          price?: number | null
          sku: string
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          id?: string
          name?: string
          price?: number | null
          sku?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          active: boolean | null
          applicable_categories: Json | null
          applicable_products: Json | null
          code: string
          created_at: string | null
          created_by: number | null
          customer_groups: Json | null
          description: string | null
          id: number
          max_discount: number | null
          min_amount: number | null
          min_items: number | null
          stackable: boolean | null
          type: string
          updated_at: string | null
          usage_count: number | null
          usage_limit: number | null
          usage_limit_per_customer: number | null
          valid_from: string
          valid_until: string
          value: number
        }
        Insert: {
          active?: boolean | null
          applicable_categories?: Json | null
          applicable_products?: Json | null
          code: string
          created_at?: string | null
          created_by?: number | null
          customer_groups?: Json | null
          description?: string | null
          id?: number
          max_discount?: number | null
          min_amount?: number | null
          min_items?: number | null
          stackable?: boolean | null
          type: string
          updated_at?: string | null
          usage_count?: number | null
          usage_limit?: number | null
          usage_limit_per_customer?: number | null
          valid_from?: string
          valid_until: string
          value: number
        }
        Update: {
          active?: boolean | null
          applicable_categories?: Json | null
          applicable_products?: Json | null
          code?: string
          created_at?: string | null
          created_by?: number | null
          customer_groups?: Json | null
          description?: string | null
          id?: number
          max_discount?: number | null
          min_amount?: number | null
          min_items?: number | null
          stackable?: boolean | null
          type?: string
          updated_at?: string | null
          usage_count?: number | null
          usage_limit?: number | null
          usage_limit_per_customer?: number | null
          valid_from?: string
          valid_until?: string
          value?: number
        }
        Relationships: []
      }
      promo_usage: {
        Row: {
          cart_session_id: string | null
          discount_amount: number | null
          final_total: number
          id: number
          order_id: number | null
          original_total: number
          promo_id: number
          used_at: string | null
          user_id: number
        }
        Insert: {
          cart_session_id?: string | null
          discount_amount?: number | null
          final_total?: number
          id?: number
          order_id?: number | null
          original_total?: number
          promo_id: number
          used_at?: string | null
          user_id: number
        }
        Update: {
          cart_session_id?: string | null
          discount_amount?: number | null
          final_total?: number
          id?: number
          order_id?: number | null
          original_total?: number
          promo_id?: number
          used_at?: string | null
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "promo_usage_promo_id_fkey"
            columns: ["promo_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      quantity_discounts: {
        Row: {
          created_at: string
          discount_amount: number | null
          discount_percent: number | null
          id: number
          is_active: boolean
          min_quantity: number
          product_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          discount_amount?: number | null
          discount_percent?: number | null
          id?: number
          is_active?: boolean
          min_quantity: number
          product_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          discount_amount?: number | null
          discount_percent?: number | null
          id?: number
          is_active?: boolean
          min_quantity?: number
          product_id?: number
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string
          created_at: string | null
          customer_id: string
          helpful_count: number | null
          id: number
          images: Json | null
          legacy_msg_id: string | null
          moderated: boolean | null
          moderated_at: string | null
          moderator_id: string | null
          moderator_note: string | null
          not_helpful_count: number | null
          order_id: string | null
          product_id: string
          published: boolean | null
          rating: number
          title: string | null
          updated_at: string | null
          verified: boolean | null
        }
        Insert: {
          comment: string
          created_at?: string | null
          customer_id: string
          helpful_count?: number | null
          id?: number
          images?: Json | null
          legacy_msg_id?: string | null
          moderated?: boolean | null
          moderated_at?: string | null
          moderator_id?: string | null
          moderator_note?: string | null
          not_helpful_count?: number | null
          order_id?: string | null
          product_id: string
          published?: boolean | null
          rating: number
          title?: string | null
          updated_at?: string | null
          verified?: boolean | null
        }
        Update: {
          comment?: string
          created_at?: string | null
          customer_id?: string
          helpful_count?: number | null
          id?: number
          images?: Json | null
          legacy_msg_id?: string | null
          moderated?: boolean | null
          moderated_at?: string | null
          moderator_id?: string | null
          moderator_note?: string | null
          not_helpful_count?: number | null
          order_id?: string | null
          product_id?: string
          published?: boolean | null
          rating?: number
          title?: string | null
          updated_at?: string | null
          verified?: boolean | null
        }
        Relationships: []
      }
      rm_build_log: {
        Row: {
          rmbl_brand_count: number | null
          rmbl_created_at: string | null
          rmbl_criteria_count: number | null
          rmbl_data_version: string | null
          rmbl_duration_ms: number | null
          rmbl_error_code: string | null
          rmbl_error_message: string | null
          rmbl_gamme_id: number
          rmbl_id: number
          rmbl_product_count: number | null
          rmbl_status_after:
            | Database["public"]["Enums"]["rm_build_status_enum"]
            | null
          rmbl_status_before:
            | Database["public"]["Enums"]["rm_build_status_enum"]
            | null
          rmbl_vehicle_id: number
          rmbl_worker_id: string | null
        }
        Insert: {
          rmbl_brand_count?: number | null
          rmbl_created_at?: string | null
          rmbl_criteria_count?: number | null
          rmbl_data_version?: string | null
          rmbl_duration_ms?: number | null
          rmbl_error_code?: string | null
          rmbl_error_message?: string | null
          rmbl_gamme_id: number
          rmbl_id?: number
          rmbl_product_count?: number | null
          rmbl_status_after?:
            | Database["public"]["Enums"]["rm_build_status_enum"]
            | null
          rmbl_status_before?:
            | Database["public"]["Enums"]["rm_build_status_enum"]
            | null
          rmbl_vehicle_id: number
          rmbl_worker_id?: string | null
        }
        Update: {
          rmbl_brand_count?: number | null
          rmbl_created_at?: string | null
          rmbl_criteria_count?: number | null
          rmbl_data_version?: string | null
          rmbl_duration_ms?: number | null
          rmbl_error_code?: string | null
          rmbl_error_message?: string | null
          rmbl_gamme_id?: number
          rmbl_id?: number
          rmbl_product_count?: number | null
          rmbl_status_after?:
            | Database["public"]["Enums"]["rm_build_status_enum"]
            | null
          rmbl_status_before?:
            | Database["public"]["Enums"]["rm_build_status_enum"]
            | null
          rmbl_vehicle_id?: number
          rmbl_worker_id?: string | null
        }
        Relationships: []
      }
      rm_data_version: {
        Row: {
          rdv_created_at: string | null
          rdv_id: string
          rdv_metadata: Json | null
          rdv_scope_family: number | null
          rdv_scope_gamme: number | null
          rdv_source: string
        }
        Insert: {
          rdv_created_at?: string | null
          rdv_id?: string
          rdv_metadata?: Json | null
          rdv_scope_family?: number | null
          rdv_scope_gamme?: number | null
          rdv_source: string
        }
        Update: {
          rdv_created_at?: string | null
          rdv_id?: string
          rdv_metadata?: Json | null
          rdv_scope_family?: number | null
          rdv_scope_gamme?: number | null
          rdv_source?: string
        }
        Relationships: []
      }
      rm_facet_config: {
        Row: {
          rmfc_allowed_filter_keys: Json | null
          rmfc_created_at: string | null
          rmfc_default_filters: Json | null
          rmfc_default_sort: string | null
          rmfc_enabled_facets: Json
          rmfc_family_id: number | null
          rmfc_gamme_id: number | null
          rmfc_id: number
          rmfc_max_brands_ui: number | null
          rmfc_pagination_sizes: number[] | null
          rmfc_partial_threshold: number | null
          rmfc_updated_at: string | null
        }
        Insert: {
          rmfc_allowed_filter_keys?: Json | null
          rmfc_created_at?: string | null
          rmfc_default_filters?: Json | null
          rmfc_default_sort?: string | null
          rmfc_enabled_facets?: Json
          rmfc_family_id?: number | null
          rmfc_gamme_id?: number | null
          rmfc_id?: number
          rmfc_max_brands_ui?: number | null
          rmfc_pagination_sizes?: number[] | null
          rmfc_partial_threshold?: number | null
          rmfc_updated_at?: string | null
        }
        Update: {
          rmfc_allowed_filter_keys?: Json | null
          rmfc_created_at?: string | null
          rmfc_default_filters?: Json | null
          rmfc_default_sort?: string | null
          rmfc_enabled_facets?: Json
          rmfc_family_id?: number | null
          rmfc_gamme_id?: number | null
          rmfc_id?: number
          rmfc_max_brands_ui?: number | null
          rmfc_pagination_sizes?: number[] | null
          rmfc_partial_threshold?: number | null
          rmfc_updated_at?: string | null
        }
        Relationships: []
      }
      rm_facets: {
        Row: {
          rmf_brands_full: Json | null
          rmf_brands_top: Json | null
          rmf_criteria: Json | null
          rmf_data_version: string | null
          rmf_gamme_id: number
          rmf_positions: Json | null
          rmf_price_ranges: Json | null
          rmf_qualities: Json | null
          rmf_updated_at: string | null
          rmf_vehicle_id: number
        }
        Insert: {
          rmf_brands_full?: Json | null
          rmf_brands_top?: Json | null
          rmf_criteria?: Json | null
          rmf_data_version?: string | null
          rmf_gamme_id: number
          rmf_positions?: Json | null
          rmf_price_ranges?: Json | null
          rmf_qualities?: Json | null
          rmf_updated_at?: string | null
          rmf_vehicle_id: number
        }
        Update: {
          rmf_brands_full?: Json | null
          rmf_brands_top?: Json | null
          rmf_criteria?: Json | null
          rmf_data_version?: string | null
          rmf_gamme_id?: number
          rmf_positions?: Json | null
          rmf_price_ranges?: Json | null
          rmf_qualities?: Json | null
          rmf_updated_at?: string | null
          rmf_vehicle_id?: number
        }
        Relationships: []
      }
      rm_listing: {
        Row: {
          rml_build_status:
            | Database["public"]["Enums"]["rm_build_status_enum"]
            | null
          rml_content_hash: string | null
          rml_created_at: string | null
          rml_data_version: string | null
          rml_facets_hash: string | null
          rml_family_id: number
          rml_gamme_id: number
          rml_h1: string | null
          rml_max_price: number | null
          rml_meta_description: string | null
          rml_min_price: number | null
          rml_product_count: number | null
          rml_products_hash: string | null
          rml_seo_indexable: boolean | null
          rml_seo_reasons: string[] | null
          rml_serving_enabled: boolean | null
          rml_title: string | null
          rml_updated_at: string | null
          rml_vehicle_id: number
          rml_version: number | null
        }
        Insert: {
          rml_build_status?:
            | Database["public"]["Enums"]["rm_build_status_enum"]
            | null
          rml_content_hash?: string | null
          rml_created_at?: string | null
          rml_data_version?: string | null
          rml_facets_hash?: string | null
          rml_family_id: number
          rml_gamme_id: number
          rml_h1?: string | null
          rml_max_price?: number | null
          rml_meta_description?: string | null
          rml_min_price?: number | null
          rml_product_count?: number | null
          rml_products_hash?: string | null
          rml_seo_indexable?: boolean | null
          rml_seo_reasons?: string[] | null
          rml_serving_enabled?: boolean | null
          rml_title?: string | null
          rml_updated_at?: string | null
          rml_vehicle_id: number
          rml_version?: number | null
        }
        Update: {
          rml_build_status?:
            | Database["public"]["Enums"]["rm_build_status_enum"]
            | null
          rml_content_hash?: string | null
          rml_created_at?: string | null
          rml_data_version?: string | null
          rml_facets_hash?: string | null
          rml_family_id?: number
          rml_gamme_id?: number
          rml_h1?: string | null
          rml_max_price?: number | null
          rml_meta_description?: string | null
          rml_min_price?: number | null
          rml_product_count?: number | null
          rml_products_hash?: string | null
          rml_seo_indexable?: boolean | null
          rml_seo_reasons?: string[] | null
          rml_serving_enabled?: boolean | null
          rml_title?: string | null
          rml_updated_at?: string | null
          rml_vehicle_id?: number
          rml_version?: number | null
        }
        Relationships: []
      }
      rm_listing_content: {
        Row: {
          rmlc_data_version: string | null
          rmlc_gamme_id: number
          rmlc_sections: Json
          rmlc_updated_at: string | null
          rmlc_vehicle_id: number
        }
        Insert: {
          rmlc_data_version?: string | null
          rmlc_gamme_id: number
          rmlc_sections?: Json
          rmlc_updated_at?: string | null
          rmlc_vehicle_id: number
        }
        Update: {
          rmlc_data_version?: string | null
          rmlc_gamme_id?: number
          rmlc_sections?: Json
          rmlc_updated_at?: string | null
          rmlc_vehicle_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_rmlc_listing"
            columns: ["rmlc_gamme_id", "rmlc_vehicle_id"]
            isOneToOne: true
            referencedRelation: "rm_listing"
            referencedColumns: ["rml_gamme_id", "rml_vehicle_id"]
          },
        ]
      }
      rm_listing_products: {
        Row: {
          rmlp_display_order: number | null
          rmlp_gamme_id: number
          rmlp_position: string | null
          rmlp_price: number | null
          rmlp_price_consigne: number | null
          rmlp_price_original: number | null
          rmlp_product_id: number
          rmlp_quality: Database["public"]["Enums"]["rm_quality_enum"]
          rmlp_score: number | null
          rmlp_stock_status: Database["public"]["Enums"]["rm_stock_status_enum"]
          rmlp_url: string | null
          rmlp_vehicle_id: number
        }
        Insert: {
          rmlp_display_order?: number | null
          rmlp_gamme_id: number
          rmlp_position?: string | null
          rmlp_price?: number | null
          rmlp_price_consigne?: number | null
          rmlp_price_original?: number | null
          rmlp_product_id: number
          rmlp_quality: Database["public"]["Enums"]["rm_quality_enum"]
          rmlp_score?: number | null
          rmlp_stock_status: Database["public"]["Enums"]["rm_stock_status_enum"]
          rmlp_url?: string | null
          rmlp_vehicle_id: number
        }
        Update: {
          rmlp_display_order?: number | null
          rmlp_gamme_id?: number
          rmlp_position?: string | null
          rmlp_price?: number | null
          rmlp_price_consigne?: number | null
          rmlp_price_original?: number | null
          rmlp_product_id?: number
          rmlp_quality?: Database["public"]["Enums"]["rm_quality_enum"]
          rmlp_score?: number | null
          rmlp_stock_status?: Database["public"]["Enums"]["rm_stock_status_enum"]
          rmlp_url?: string | null
          rmlp_vehicle_id?: number
        }
        Relationships: []
      }
      rm_listing_products_default: {
        Row: {
          rmlp_display_order: number | null
          rmlp_gamme_id: number
          rmlp_position: string | null
          rmlp_price: number | null
          rmlp_price_consigne: number | null
          rmlp_price_original: number | null
          rmlp_product_id: number
          rmlp_quality: Database["public"]["Enums"]["rm_quality_enum"]
          rmlp_score: number | null
          rmlp_stock_status: Database["public"]["Enums"]["rm_stock_status_enum"]
          rmlp_url: string | null
          rmlp_vehicle_id: number
        }
        Insert: {
          rmlp_display_order?: number | null
          rmlp_gamme_id: number
          rmlp_position?: string | null
          rmlp_price?: number | null
          rmlp_price_consigne?: number | null
          rmlp_price_original?: number | null
          rmlp_product_id: number
          rmlp_quality: Database["public"]["Enums"]["rm_quality_enum"]
          rmlp_score?: number | null
          rmlp_stock_status: Database["public"]["Enums"]["rm_stock_status_enum"]
          rmlp_url?: string | null
          rmlp_vehicle_id: number
        }
        Update: {
          rmlp_display_order?: number | null
          rmlp_gamme_id?: number
          rmlp_position?: string | null
          rmlp_price?: number | null
          rmlp_price_consigne?: number | null
          rmlp_price_original?: number | null
          rmlp_product_id?: number
          rmlp_quality?: Database["public"]["Enums"]["rm_quality_enum"]
          rmlp_score?: number | null
          rmlp_stock_status?: Database["public"]["Enums"]["rm_stock_status_enum"]
          rmlp_url?: string | null
          rmlp_vehicle_id?: number
        }
        Relationships: []
      }
      rm_listing_products_g1: {
        Row: {
          rmlp_display_order: number | null
          rmlp_gamme_id: number
          rmlp_position: string | null
          rmlp_price: number | null
          rmlp_price_consigne: number | null
          rmlp_price_original: number | null
          rmlp_product_id: number
          rmlp_quality: Database["public"]["Enums"]["rm_quality_enum"]
          rmlp_score: number | null
          rmlp_stock_status: Database["public"]["Enums"]["rm_stock_status_enum"]
          rmlp_url: string | null
          rmlp_vehicle_id: number
        }
        Insert: {
          rmlp_display_order?: number | null
          rmlp_gamme_id: number
          rmlp_position?: string | null
          rmlp_price?: number | null
          rmlp_price_consigne?: number | null
          rmlp_price_original?: number | null
          rmlp_product_id: number
          rmlp_quality: Database["public"]["Enums"]["rm_quality_enum"]
          rmlp_score?: number | null
          rmlp_stock_status: Database["public"]["Enums"]["rm_stock_status_enum"]
          rmlp_url?: string | null
          rmlp_vehicle_id: number
        }
        Update: {
          rmlp_display_order?: number | null
          rmlp_gamme_id?: number
          rmlp_position?: string | null
          rmlp_price?: number | null
          rmlp_price_consigne?: number | null
          rmlp_price_original?: number | null
          rmlp_product_id?: number
          rmlp_quality?: Database["public"]["Enums"]["rm_quality_enum"]
          rmlp_score?: number | null
          rmlp_stock_status?: Database["public"]["Enums"]["rm_stock_status_enum"]
          rmlp_url?: string | null
          rmlp_vehicle_id?: number
        }
        Relationships: []
      }
      rm_listing_products_g123: {
        Row: {
          rmlp_display_order: number | null
          rmlp_gamme_id: number
          rmlp_position: string | null
          rmlp_price: number | null
          rmlp_price_consigne: number | null
          rmlp_price_original: number | null
          rmlp_product_id: number
          rmlp_quality: Database["public"]["Enums"]["rm_quality_enum"]
          rmlp_score: number | null
          rmlp_stock_status: Database["public"]["Enums"]["rm_stock_status_enum"]
          rmlp_url: string | null
          rmlp_vehicle_id: number
        }
        Insert: {
          rmlp_display_order?: number | null
          rmlp_gamme_id: number
          rmlp_position?: string | null
          rmlp_price?: number | null
          rmlp_price_consigne?: number | null
          rmlp_price_original?: number | null
          rmlp_product_id: number
          rmlp_quality: Database["public"]["Enums"]["rm_quality_enum"]
          rmlp_score?: number | null
          rmlp_stock_status: Database["public"]["Enums"]["rm_stock_status_enum"]
          rmlp_url?: string | null
          rmlp_vehicle_id: number
        }
        Update: {
          rmlp_display_order?: number | null
          rmlp_gamme_id?: number
          rmlp_position?: string | null
          rmlp_price?: number | null
          rmlp_price_consigne?: number | null
          rmlp_price_original?: number | null
          rmlp_product_id?: number
          rmlp_quality?: Database["public"]["Enums"]["rm_quality_enum"]
          rmlp_score?: number | null
          rmlp_stock_status?: Database["public"]["Enums"]["rm_stock_status_enum"]
          rmlp_url?: string | null
          rmlp_vehicle_id?: number
        }
        Relationships: []
      }
      rm_listing_products_g2: {
        Row: {
          rmlp_display_order: number | null
          rmlp_gamme_id: number
          rmlp_position: string | null
          rmlp_price: number | null
          rmlp_price_consigne: number | null
          rmlp_price_original: number | null
          rmlp_product_id: number
          rmlp_quality: Database["public"]["Enums"]["rm_quality_enum"]
          rmlp_score: number | null
          rmlp_stock_status: Database["public"]["Enums"]["rm_stock_status_enum"]
          rmlp_url: string | null
          rmlp_vehicle_id: number
        }
        Insert: {
          rmlp_display_order?: number | null
          rmlp_gamme_id: number
          rmlp_position?: string | null
          rmlp_price?: number | null
          rmlp_price_consigne?: number | null
          rmlp_price_original?: number | null
          rmlp_product_id: number
          rmlp_quality: Database["public"]["Enums"]["rm_quality_enum"]
          rmlp_score?: number | null
          rmlp_stock_status: Database["public"]["Enums"]["rm_stock_status_enum"]
          rmlp_url?: string | null
          rmlp_vehicle_id: number
        }
        Update: {
          rmlp_display_order?: number | null
          rmlp_gamme_id?: number
          rmlp_position?: string | null
          rmlp_price?: number | null
          rmlp_price_consigne?: number | null
          rmlp_price_original?: number | null
          rmlp_product_id?: number
          rmlp_quality?: Database["public"]["Enums"]["rm_quality_enum"]
          rmlp_score?: number | null
          rmlp_stock_status?: Database["public"]["Enums"]["rm_stock_status_enum"]
          rmlp_url?: string | null
          rmlp_vehicle_id?: number
        }
        Relationships: []
      }
      rm_listing_products_g4: {
        Row: {
          rmlp_display_order: number | null
          rmlp_gamme_id: number
          rmlp_position: string | null
          rmlp_price: number | null
          rmlp_price_consigne: number | null
          rmlp_price_original: number | null
          rmlp_product_id: number
          rmlp_quality: Database["public"]["Enums"]["rm_quality_enum"]
          rmlp_score: number | null
          rmlp_stock_status: Database["public"]["Enums"]["rm_stock_status_enum"]
          rmlp_url: string | null
          rmlp_vehicle_id: number
        }
        Insert: {
          rmlp_display_order?: number | null
          rmlp_gamme_id: number
          rmlp_position?: string | null
          rmlp_price?: number | null
          rmlp_price_consigne?: number | null
          rmlp_price_original?: number | null
          rmlp_product_id: number
          rmlp_quality: Database["public"]["Enums"]["rm_quality_enum"]
          rmlp_score?: number | null
          rmlp_stock_status: Database["public"]["Enums"]["rm_stock_status_enum"]
          rmlp_url?: string | null
          rmlp_vehicle_id: number
        }
        Update: {
          rmlp_display_order?: number | null
          rmlp_gamme_id?: number
          rmlp_position?: string | null
          rmlp_price?: number | null
          rmlp_price_consigne?: number | null
          rmlp_price_original?: number | null
          rmlp_product_id?: number
          rmlp_quality?: Database["public"]["Enums"]["rm_quality_enum"]
          rmlp_score?: number | null
          rmlp_stock_status?: Database["public"]["Enums"]["rm_stock_status_enum"]
          rmlp_url?: string | null
          rmlp_vehicle_id?: number
        }
        Relationships: []
      }
      rm_listing_products_g5: {
        Row: {
          rmlp_display_order: number | null
          rmlp_gamme_id: number
          rmlp_position: string | null
          rmlp_price: number | null
          rmlp_price_consigne: number | null
          rmlp_price_original: number | null
          rmlp_product_id: number
          rmlp_quality: Database["public"]["Enums"]["rm_quality_enum"]
          rmlp_score: number | null
          rmlp_stock_status: Database["public"]["Enums"]["rm_stock_status_enum"]
          rmlp_url: string | null
          rmlp_vehicle_id: number
        }
        Insert: {
          rmlp_display_order?: number | null
          rmlp_gamme_id: number
          rmlp_position?: string | null
          rmlp_price?: number | null
          rmlp_price_consigne?: number | null
          rmlp_price_original?: number | null
          rmlp_product_id: number
          rmlp_quality: Database["public"]["Enums"]["rm_quality_enum"]
          rmlp_score?: number | null
          rmlp_stock_status: Database["public"]["Enums"]["rm_stock_status_enum"]
          rmlp_url?: string | null
          rmlp_vehicle_id: number
        }
        Update: {
          rmlp_display_order?: number | null
          rmlp_gamme_id?: number
          rmlp_position?: string | null
          rmlp_price?: number | null
          rmlp_price_consigne?: number | null
          rmlp_price_original?: number | null
          rmlp_product_id?: number
          rmlp_quality?: Database["public"]["Enums"]["rm_quality_enum"]
          rmlp_score?: number | null
          rmlp_stock_status?: Database["public"]["Enums"]["rm_stock_status_enum"]
          rmlp_url?: string | null
          rmlp_vehicle_id?: number
        }
        Relationships: []
      }
      rm_listing_products_g7: {
        Row: {
          rmlp_display_order: number | null
          rmlp_gamme_id: number
          rmlp_position: string | null
          rmlp_price: number | null
          rmlp_price_consigne: number | null
          rmlp_price_original: number | null
          rmlp_product_id: number
          rmlp_quality: Database["public"]["Enums"]["rm_quality_enum"]
          rmlp_score: number | null
          rmlp_stock_status: Database["public"]["Enums"]["rm_stock_status_enum"]
          rmlp_url: string | null
          rmlp_vehicle_id: number
        }
        Insert: {
          rmlp_display_order?: number | null
          rmlp_gamme_id: number
          rmlp_position?: string | null
          rmlp_price?: number | null
          rmlp_price_consigne?: number | null
          rmlp_price_original?: number | null
          rmlp_product_id: number
          rmlp_quality: Database["public"]["Enums"]["rm_quality_enum"]
          rmlp_score?: number | null
          rmlp_stock_status: Database["public"]["Enums"]["rm_stock_status_enum"]
          rmlp_url?: string | null
          rmlp_vehicle_id: number
        }
        Update: {
          rmlp_display_order?: number | null
          rmlp_gamme_id?: number
          rmlp_position?: string | null
          rmlp_price?: number | null
          rmlp_price_consigne?: number | null
          rmlp_price_original?: number | null
          rmlp_product_id?: number
          rmlp_quality?: Database["public"]["Enums"]["rm_quality_enum"]
          rmlp_score?: number | null
          rmlp_stock_status?: Database["public"]["Enums"]["rm_stock_status_enum"]
          rmlp_url?: string | null
          rmlp_vehicle_id?: number
        }
        Relationships: []
      }
      rm_oem_top: {
        Row: {
          rmot_data_version: string | null
          rmot_gamme_id: number
          rmot_top_refs: Json | null
          rmot_updated_at: string | null
          rmot_vehicle_id: number
        }
        Insert: {
          rmot_data_version?: string | null
          rmot_gamme_id: number
          rmot_top_refs?: Json | null
          rmot_updated_at?: string | null
          rmot_vehicle_id: number
        }
        Update: {
          rmot_data_version?: string | null
          rmot_gamme_id?: number
          rmot_top_refs?: Json | null
          rmot_updated_at?: string | null
          rmot_vehicle_id?: number
        }
        Relationships: []
      }
      rm_product: {
        Row: {
          rmp_brand_id: number
          rmp_brand_logo: string | null
          rmp_brand_name: string
          rmp_data_version: string | null
          rmp_id: number
          rmp_image_url: string | null
          rmp_name: string | null
          rmp_name_short: string | null
          rmp_oem_refs_top: Json | null
          rmp_reference: string
          rmp_updated_at: string | null
        }
        Insert: {
          rmp_brand_id: number
          rmp_brand_logo?: string | null
          rmp_brand_name: string
          rmp_data_version?: string | null
          rmp_id: number
          rmp_image_url?: string | null
          rmp_name?: string | null
          rmp_name_short?: string | null
          rmp_oem_refs_top?: Json | null
          rmp_reference: string
          rmp_updated_at?: string | null
        }
        Update: {
          rmp_brand_id?: number
          rmp_brand_logo?: string | null
          rmp_brand_name?: string
          rmp_data_version?: string | null
          rmp_id?: number
          rmp_image_url?: string | null
          rmp_name?: string | null
          rmp_name_short?: string | null
          rmp_oem_refs_top?: Json | null
          rmp_reference?: string
          rmp_updated_at?: string | null
        }
        Relationships: []
      }
      rm_rebuild_queue: {
        Row: {
          rmrq_created_at: string | null
          rmrq_gamme_id: number
          rmrq_lock_timeout: unknown
          rmrq_locked_at: string | null
          rmrq_locked_by: string | null
          rmrq_priority: number | null
          rmrq_processed_at: string | null
          rmrq_reason: string | null
          rmrq_status:
            | Database["public"]["Enums"]["rm_rebuild_status_enum"]
            | null
          rmrq_vehicle_id: number
        }
        Insert: {
          rmrq_created_at?: string | null
          rmrq_gamme_id: number
          rmrq_lock_timeout?: unknown
          rmrq_locked_at?: string | null
          rmrq_locked_by?: string | null
          rmrq_priority?: number | null
          rmrq_processed_at?: string | null
          rmrq_reason?: string | null
          rmrq_status?:
            | Database["public"]["Enums"]["rm_rebuild_status_enum"]
            | null
          rmrq_vehicle_id: number
        }
        Update: {
          rmrq_created_at?: string | null
          rmrq_gamme_id?: number
          rmrq_lock_timeout?: unknown
          rmrq_locked_at?: string | null
          rmrq_locked_by?: string | null
          rmrq_priority?: number | null
          rmrq_processed_at?: string | null
          rmrq_reason?: string | null
          rmrq_status?:
            | Database["public"]["Enums"]["rm_rebuild_status_enum"]
            | null
          rmrq_vehicle_id?: number
        }
        Relationships: []
      }
      seo_link_clicks: {
        Row: {
          anchor_text: string | null
          clicked_at: string | null
          created_at: string | null
          destination_url: string
          device_type: string | null
          id: string
          link_position: string | null
          link_type: string
          referer: string | null
          session_id: string | null
          source_url: string
          switch_formula: string | null
          switch_noun_id: number | null
          switch_verb_id: number | null
          target_gamme_id: number | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          anchor_text?: string | null
          clicked_at?: string | null
          created_at?: string | null
          destination_url: string
          device_type?: string | null
          id?: string
          link_position?: string | null
          link_type: string
          referer?: string | null
          session_id?: string | null
          source_url: string
          switch_formula?: string | null
          switch_noun_id?: number | null
          switch_verb_id?: number | null
          target_gamme_id?: number | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          anchor_text?: string | null
          clicked_at?: string | null
          created_at?: string | null
          destination_url?: string
          device_type?: string | null
          id?: string
          link_position?: string | null
          link_type?: string
          referer?: string | null
          session_id?: string | null
          source_url?: string
          switch_formula?: string | null
          switch_noun_id?: number | null
          switch_verb_id?: number | null
          target_gamme_id?: number | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      seo_link_impressions: {
        Row: {
          id: string
          link_count: number | null
          link_type: string
          page_url: string
          session_id: string | null
          viewed_at: string | null
        }
        Insert: {
          id?: string
          link_count?: number | null
          link_type: string
          page_url: string
          session_id?: string | null
          viewed_at?: string | null
        }
        Update: {
          id?: string
          link_count?: number | null
          link_type?: string
          page_url?: string
          session_id?: string | null
          viewed_at?: string | null
        }
        Relationships: []
      }
      seo_link_metrics_daily: {
        Row: {
          created_at: string | null
          date: string
          desktop_clicks: number | null
          id: string
          link_type: string
          mobile_clicks: number | null
          tablet_clicks: number | null
          top_destinations: Json | null
          total_clicks: number | null
          unique_sessions: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          desktop_clicks?: number | null
          id?: string
          link_type: string
          mobile_clicks?: number | null
          tablet_clicks?: number | null
          top_destinations?: Json | null
          total_clicks?: number | null
          unique_sessions?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          desktop_clicks?: number | null
          id?: string
          link_type?: string
          mobile_clicks?: number | null
          tablet_clicks?: number | null
          top_destinations?: Json | null
          total_clicks?: number | null
          unique_sessions?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sessions: {
        Row: {
          created_at: string
          expires: string
          id: string
          session_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires: string
          id?: string
          session_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires?: string
          id?: string
          session_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_rates_cache: {
        Row: {
          cached_at: string | null
          country: string
          delivery_time: string | null
          expires_at: string | null
          id: number
          method: string
          rate: number
          weight_max: number
          weight_min: number
          zip_code: string
          zone: string
        }
        Insert: {
          cached_at?: string | null
          country: string
          delivery_time?: string | null
          expires_at?: string | null
          id?: number
          method: string
          rate: number
          weight_max: number
          weight_min: number
          zip_code: string
          zone: string
        }
        Update: {
          cached_at?: string | null
          country?: string
          delivery_time?: string | null
          expires_at?: string | null
          id?: number
          method?: string
          rate?: number
          weight_max?: number
          weight_min?: number
          zip_code?: string
          zone?: string
        }
        Relationships: []
      }
      stg_article: {
        Row: {
          batch_id: number
          imported_at: string | null
          raw_artnr: string | null
          raw_dlnr: string | null
          raw_eancode: string | null
          raw_extra: Json | null
          raw_genart: number | null
          raw_line_number: number | null
          raw_source_file: string | null
          stg_id: number
        }
        Insert: {
          batch_id: number
          imported_at?: string | null
          raw_artnr?: string | null
          raw_dlnr?: string | null
          raw_eancode?: string | null
          raw_extra?: Json | null
          raw_genart?: number | null
          raw_line_number?: number | null
          raw_source_file?: string | null
          stg_id?: number
        }
        Update: {
          batch_id?: number
          imported_at?: string | null
          raw_artnr?: string | null
          raw_dlnr?: string | null
          raw_eancode?: string | null
          raw_extra?: Json | null
          raw_genart?: number | null
          raw_line_number?: number | null
          raw_source_file?: string | null
          stg_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "stg_article_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batch"
            referencedColumns: ["batch_id"]
          },
        ]
      }
      stg_brand: {
        Row: {
          batch_id: number
          imported_at: string | null
          raw_dlnr: string | null
          raw_extra: Json | null
          raw_line_number: number | null
          raw_marke: string | null
          raw_source_file: string | null
          stg_id: number
        }
        Insert: {
          batch_id: number
          imported_at?: string | null
          raw_dlnr?: string | null
          raw_extra?: Json | null
          raw_line_number?: number | null
          raw_marke?: string | null
          raw_source_file?: string | null
          stg_id?: number
        }
        Update: {
          batch_id?: number
          imported_at?: string | null
          raw_dlnr?: string | null
          raw_extra?: Json | null
          raw_line_number?: number | null
          raw_marke?: string | null
          raw_source_file?: string | null
          stg_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "stg_brand_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batch"
            referencedColumns: ["batch_id"]
          },
        ]
      }
      stg_compatibility: {
        Row: {
          batch_id: number
          imported_at: string | null
          raw_artnr: string | null
          raw_dlnr: string | null
          raw_extra: Json | null
          raw_ktypnr: number | null
          raw_line_number: number | null
          raw_source_file: string | null
          raw_vknzielart: number | null
          stg_id: number
        }
        Insert: {
          batch_id: number
          imported_at?: string | null
          raw_artnr?: string | null
          raw_dlnr?: string | null
          raw_extra?: Json | null
          raw_ktypnr?: number | null
          raw_line_number?: number | null
          raw_source_file?: string | null
          raw_vknzielart?: number | null
          stg_id?: number
        }
        Update: {
          batch_id?: number
          imported_at?: string | null
          raw_artnr?: string | null
          raw_dlnr?: string | null
          raw_extra?: Json | null
          raw_ktypnr?: number | null
          raw_line_number?: number | null
          raw_source_file?: string | null
          raw_vknzielart?: number | null
          stg_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "stg_compatibility_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batch"
            referencedColumns: ["batch_id"]
          },
        ]
      }
      stg_vehicle: {
        Row: {
          batch_id: number
          imported_at: string | null
          raw_bjbis: number | null
          raw_bjvon: number | null
          raw_ccmtech: number | null
          raw_extra: Json | null
          raw_hernr: number | null
          raw_kmodnr: number | null
          raw_ktypnr: number | null
          raw_kw: number | null
          raw_line_number: number | null
          raw_motorbez: string | null
          raw_ps: number | null
          raw_source_file: string | null
          stg_id: number
        }
        Insert: {
          batch_id: number
          imported_at?: string | null
          raw_bjbis?: number | null
          raw_bjvon?: number | null
          raw_ccmtech?: number | null
          raw_extra?: Json | null
          raw_hernr?: number | null
          raw_kmodnr?: number | null
          raw_ktypnr?: number | null
          raw_kw?: number | null
          raw_line_number?: number | null
          raw_motorbez?: string | null
          raw_ps?: number | null
          raw_source_file?: string | null
          stg_id?: number
        }
        Update: {
          batch_id?: number
          imported_at?: string | null
          raw_bjbis?: number | null
          raw_bjvon?: number | null
          raw_ccmtech?: number | null
          raw_extra?: Json | null
          raw_hernr?: number | null
          raw_kmodnr?: number | null
          raw_ktypnr?: number | null
          raw_kw?: number | null
          raw_line_number?: number | null
          raw_motorbez?: string | null
          raw_ps?: number | null
          raw_source_file?: string | null
          stg_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "stg_vehicle_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batch"
            referencedColumns: ["batch_id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_staff_id: string | null
          category: string | null
          created_at: string | null
          customer_id: string
          id: number
          legacy_msg_id: string | null
          message: string
          order_id: string | null
          priority: string | null
          resolved_at: string | null
          status: string | null
          subject: string
          updated_at: string | null
          vehicle_info: Json | null
        }
        Insert: {
          assigned_staff_id?: string | null
          category?: string | null
          created_at?: string | null
          customer_id: string
          id?: number
          legacy_msg_id?: string | null
          message: string
          order_id?: string | null
          priority?: string | null
          resolved_at?: string | null
          status?: string | null
          subject: string
          updated_at?: string | null
          vehicle_info?: Json | null
        }
        Update: {
          assigned_staff_id?: string | null
          category?: string | null
          created_at?: string | null
          customer_id?: string
          id?: number
          legacy_msg_id?: string | null
          message?: string
          order_id?: string | null
          priority?: string | null
          resolved_at?: string | null
          status?: string | null
          subject?: string
          updated_at?: string | null
          vehicle_info?: Json | null
        }
        Relationships: []
      }
      ticket_responses: {
        Row: {
          attachments: Json | null
          author_id: string
          author_type: string | null
          created_at: string | null
          id: number
          message: string
          ticket_id: number | null
        }
        Insert: {
          attachments?: Json | null
          author_id: string
          author_type?: string | null
          created_at?: string | null
          id?: number
          message: string
          ticket_id?: number | null
        }
        Update: {
          attachments?: Json | null
          author_id?: string
          author_type?: string | null
          created_at?: string | null
          id?: number
          message?: string
          ticket_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_responses_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string | null
          password: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name?: string | null
          password: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          password?: string
          updated_at?: string
        }
        Relationships: []
      }
      vehicule_v1_dominant: {
        Row: {
          computed_at: string
          energy: string
          id: number
          model_slug: string
          pg_ids: number[] | null
          score: number
          total_volume: number
          updated_at: string
          variant: string | null
        }
        Insert: {
          computed_at?: string
          energy: string
          id?: number
          model_slug: string
          pg_ids?: number[] | null
          score?: number
          total_volume?: number
          updated_at?: string
          variant?: string | null
        }
        Update: {
          computed_at?: string
          energy?: string
          id?: number
          model_slug?: string
          pg_ids?: number[] | null
          score?: number
          total_volume?: number
          updated_at?: string
          variant?: string | null
        }
        Relationships: []
      }
      xref_article: {
        Row: {
          confidence: number | null
          created_at: string | null
          first_seen_batch: number
          internal_id: number
          last_seen_batch: number
          match_criteria: Json | null
          match_method: string | null
          metadata: Json | null
          source_key: string
          source_system: string
          status: string | null
          updated_at: string | null
          xref_id: number
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          first_seen_batch: number
          internal_id: number
          last_seen_batch: number
          match_criteria?: Json | null
          match_method?: string | null
          metadata?: Json | null
          source_key: string
          source_system: string
          status?: string | null
          updated_at?: string | null
          xref_id?: number
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          first_seen_batch?: number
          internal_id?: number
          last_seen_batch?: number
          match_criteria?: Json | null
          match_method?: string | null
          metadata?: Json | null
          source_key?: string
          source_system?: string
          status?: string | null
          updated_at?: string | null
          xref_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "xref_article_first_seen_batch_fkey"
            columns: ["first_seen_batch"]
            isOneToOne: false
            referencedRelation: "import_batch"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "xref_article_last_seen_batch_fkey"
            columns: ["last_seen_batch"]
            isOneToOne: false
            referencedRelation: "import_batch"
            referencedColumns: ["batch_id"]
          },
        ]
      }
      xref_brand: {
        Row: {
          confidence: number | null
          created_at: string | null
          first_seen_batch: number
          internal_id: number
          last_seen_batch: number
          match_method: string | null
          metadata: Json | null
          source_key: string
          source_system: string
          status: string | null
          updated_at: string | null
          xref_id: number
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          first_seen_batch: number
          internal_id: number
          last_seen_batch: number
          match_method?: string | null
          metadata?: Json | null
          source_key: string
          source_system: string
          status?: string | null
          updated_at?: string | null
          xref_id?: number
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          first_seen_batch?: number
          internal_id?: number
          last_seen_batch?: number
          match_method?: string | null
          metadata?: Json | null
          source_key?: string
          source_system?: string
          status?: string | null
          updated_at?: string | null
          xref_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "xref_brand_first_seen_batch_fkey"
            columns: ["first_seen_batch"]
            isOneToOne: false
            referencedRelation: "import_batch"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "xref_brand_last_seen_batch_fkey"
            columns: ["last_seen_batch"]
            isOneToOne: false
            referencedRelation: "import_batch"
            referencedColumns: ["batch_id"]
          },
        ]
      }
      xref_vehicle: {
        Row: {
          confidence: number | null
          created_at: string | null
          first_seen_batch: number
          internal_id: number
          last_seen_batch: number
          match_criteria: Json | null
          match_method: string | null
          metadata: Json | null
          source_key: string
          source_system: string
          status: string | null
          updated_at: string | null
          xref_id: number
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          first_seen_batch: number
          internal_id: number
          last_seen_batch: number
          match_criteria?: Json | null
          match_method?: string | null
          metadata?: Json | null
          source_key: string
          source_system: string
          status?: string | null
          updated_at?: string | null
          xref_id?: number
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          first_seen_batch?: number
          internal_id?: number
          last_seen_batch?: number
          match_criteria?: Json | null
          match_method?: string | null
          metadata?: Json | null
          source_key?: string
          source_system?: string
          status?: string | null
          updated_at?: string | null
          xref_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "xref_vehicle_first_seen_batch_fkey"
            columns: ["first_seen_batch"]
            isOneToOne: false
            referencedRelation: "import_batch"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "xref_vehicle_last_seen_batch_fkey"
            columns: ["last_seen_batch"]
            isOneToOne: false
            referencedRelation: "import_batch"
            referencedColumns: ["batch_id"]
          },
        ]
      }
    }
    Views: {
      __pg_gammes: {
        Row: {
          description: string | null
          id: number | null
          label: string | null
          pg_alias: string | null
          position: number | null
          search_volume: number | null
        }
        Relationships: []
      }
      __seo_family_required_fields_v: {
        Row: {
          sfrf_enabled: boolean | null
          sfrf_family: string | null
          sfrf_field_name: string | null
          sfrf_field_pattern: string | null
          sfrf_gamme_pattern: string | null
          sfrf_id: number | null
          sfrf_is_critical: boolean | null
          sfrf_unit: string | null
          sfrf_validation_regex: string | null
          sfrf_weight: number | null
        }
        Insert: {
          sfrf_enabled?: boolean | null
          sfrf_family?: string | null
          sfrf_field_name?: string | null
          sfrf_field_pattern?: string | null
          sfrf_gamme_pattern?: string | null
          sfrf_id?: number | null
          sfrf_is_critical?: never
          sfrf_unit?: string | null
          sfrf_validation_regex?: string | null
          sfrf_weight?: number | null
        }
        Update: {
          sfrf_enabled?: boolean | null
          sfrf_family?: string | null
          sfrf_field_name?: string | null
          sfrf_field_pattern?: string | null
          sfrf_gamme_pattern?: string | null
          sfrf_id?: number | null
          sfrf_is_critical?: never
          sfrf_unit?: string | null
          sfrf_validation_regex?: string | null
          sfrf_weight?: number | null
        }
        Relationships: []
      }
      __seo_penalty_config_v: {
        Row: {
          spc_base_penalty: number | null
          spc_description: string | null
          spc_error_type: string | null
          spc_is_blocking: boolean | null
        }
        Insert: {
          spc_base_penalty?: number | null
          spc_description?: string | null
          spc_error_type?: string | null
          spc_is_blocking?: boolean | null
        }
        Update: {
          spc_base_penalty?: number | null
          spc_description?: string | null
          spc_error_type?: string | null
          spc_is_blocking?: boolean | null
        }
        Relationships: []
      }
      __seo_quality_log_v: {
        Row: {
          sql_action: string | null
          sql_after: Json | null
          sql_before: Json | null
          sql_created_at: string | null
          sql_field: string | null
          sql_id: number | null
          sql_record_id: string | null
          sql_rules_triggered: string[] | null
          sql_score_after: number | null
          sql_score_before: number | null
          sql_table: string | null
        }
        Insert: {
          sql_action?: string | null
          sql_after?: Json | null
          sql_before?: Json | null
          sql_created_at?: string | null
          sql_field?: string | null
          sql_id?: number | null
          sql_record_id?: string | null
          sql_rules_triggered?: string[] | null
          sql_score_after?: number | null
          sql_score_before?: number | null
          sql_table?: string | null
        }
        Update: {
          sql_action?: string | null
          sql_after?: Json | null
          sql_before?: Json | null
          sql_created_at?: string | null
          sql_field?: string | null
          sql_id?: number | null
          sql_record_id?: string | null
          sql_rules_triggered?: string[] | null
          sql_score_after?: number | null
          sql_score_before?: number | null
          sql_table?: string | null
        }
        Relationships: []
      }
      __seo_zone_coefficients_v: {
        Row: {
          szc_coefficient: number | null
          szc_description: string | null
          szc_zone: string | null
        }
        Insert: {
          szc_coefficient?: number | null
          szc_description?: string | null
          szc_zone?: string | null
        }
        Update: {
          szc_coefficient?: number | null
          szc_description?: string | null
          szc_zone?: string | null
        }
        Relationships: []
      }
      __seo_zone_severity_v: {
        Row: {
          szs_risk_level: number | null
          szs_severity: string | null
          szs_zone: string | null
        }
        Insert: {
          szs_risk_level?: number | null
          szs_severity?: string | null
          szs_zone?: string | null
        }
        Update: {
          szs_risk_level?: number | null
          szs_severity?: string | null
          szs_zone?: string | null
        }
        Relationships: []
      }
      __sitemap_p_link_index: {
        Row: {
          map_has_item: number | null
          map_id: number | null
          map_marque_alias: string | null
          map_marque_id: number | null
          map_modele_alias: string | null
          map_modele_id: number | null
          map_pg_alias: string | null
          map_pg_id: number | null
          map_type_alias: string | null
          map_type_id: number | null
        }
        Insert: {
          map_has_item?: number | null
          map_id?: number | null
          map_marque_alias?: string | null
          map_marque_id?: number | null
          map_modele_alias?: string | null
          map_modele_id?: number | null
          map_pg_alias?: string | null
          map_pg_id?: number | null
          map_type_alias?: string | null
          map_type_id?: number | null
        }
        Update: {
          map_has_item?: number | null
          map_id?: number | null
          map_marque_alias?: string | null
          map_marque_id?: number | null
          map_modele_alias?: string | null
          map_modele_id?: number | null
          map_pg_alias?: string | null
          map_pg_id?: number | null
          map_type_alias?: string | null
          map_type_id?: number | null
        }
        Relationships: []
      }
      __sitemap_vehicules: {
        Row: {
          changefreq: string | null
          niveau: number | null
          priority: number | null
          url: string | null
        }
        Relationships: []
      }
      kg_active_edges: {
        Row: {
          confidence: number | null
          confidence_base: number | null
          created_at: string | null
          created_by: string | null
          edge_id: string | null
          edge_type: string | null
          evidence: Json | null
          is_active: boolean | null
          is_bidirectional: boolean | null
          source_node_id: string | null
          source_type: string | null
          sources: string[] | null
          status: string | null
          target_node_id: string | null
          updated_at: string | null
          valid_from: string | null
          valid_to: string | null
          version: number | null
          weight: number | null
        }
        Insert: {
          confidence?: number | null
          confidence_base?: number | null
          created_at?: string | null
          created_by?: string | null
          edge_id?: string | null
          edge_type?: string | null
          evidence?: Json | null
          is_active?: boolean | null
          is_bidirectional?: boolean | null
          source_node_id?: string | null
          source_type?: string | null
          sources?: string[] | null
          status?: string | null
          target_node_id?: string | null
          updated_at?: string | null
          valid_from?: string | null
          valid_to?: string | null
          version?: number | null
          weight?: number | null
        }
        Update: {
          confidence?: number | null
          confidence_base?: number | null
          created_at?: string | null
          created_by?: string | null
          edge_id?: string | null
          edge_type?: string | null
          evidence?: Json | null
          is_active?: boolean | null
          is_bidirectional?: boolean | null
          source_node_id?: string | null
          source_type?: string | null
          sources?: string[] | null
          status?: string | null
          target_node_id?: string | null
          updated_at?: string | null
          valid_from?: string | null
          valid_to?: string | null
          version?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kg_edges_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "kg_active_nodes"
            referencedColumns: ["node_id"]
          },
          {
            foreignKeyName: "kg_edges_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "kg_diagnosis_stats"
            referencedColumns: ["fault_id"]
          },
          {
            foreignKeyName: "kg_edges_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "kg_nodes"
            referencedColumns: ["node_id"]
          },
          {
            foreignKeyName: "kg_edges_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "kg_observables_with_context"
            referencedColumns: ["node_id"]
          },
          {
            foreignKeyName: "kg_edges_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "kg_active_nodes"
            referencedColumns: ["node_id"]
          },
          {
            foreignKeyName: "kg_edges_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "kg_diagnosis_stats"
            referencedColumns: ["fault_id"]
          },
          {
            foreignKeyName: "kg_edges_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "kg_nodes"
            referencedColumns: ["node_id"]
          },
          {
            foreignKeyName: "kg_edges_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "kg_observables_with_context"
            referencedColumns: ["node_id"]
          },
        ]
      }
      kg_active_nodes: {
        Row: {
          confidence: number | null
          confidence_base: number | null
          created_at: string | null
          created_by: string | null
          dtc_code: string | null
          intensity: number | null
          is_active: boolean | null
          km_interval_base: number | null
          month_interval_base: number | null
          node_alias: string | null
          node_category: string | null
          node_data: Json | null
          node_id: string | null
          node_label: string | null
          node_type: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          risk_slope: number | null
          risk_threshold_critical: number | null
          risk_threshold_high: number | null
          risk_threshold_medium: number | null
          safety_gate: string | null
          source_type: string | null
          sources: string[] | null
          status: string | null
          updated_at: string | null
          valid_from: string | null
          valid_to: string | null
          validation_status: string | null
          version: number | null
          wear_factor_aggressive: number | null
          wear_factor_diesel: number | null
          wear_factor_extreme: number | null
          wear_factor_heavy_load: number | null
          wear_factor_urban: number | null
        }
        Insert: {
          confidence?: number | null
          confidence_base?: number | null
          created_at?: string | null
          created_by?: string | null
          dtc_code?: string | null
          intensity?: number | null
          is_active?: boolean | null
          km_interval_base?: number | null
          month_interval_base?: number | null
          node_alias?: string | null
          node_category?: string | null
          node_data?: Json | null
          node_id?: string | null
          node_label?: string | null
          node_type?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_slope?: number | null
          risk_threshold_critical?: number | null
          risk_threshold_high?: number | null
          risk_threshold_medium?: number | null
          safety_gate?: string | null
          source_type?: string | null
          sources?: string[] | null
          status?: string | null
          updated_at?: string | null
          valid_from?: string | null
          valid_to?: string | null
          validation_status?: string | null
          version?: number | null
          wear_factor_aggressive?: number | null
          wear_factor_diesel?: number | null
          wear_factor_extreme?: number | null
          wear_factor_heavy_load?: number | null
          wear_factor_urban?: number | null
        }
        Update: {
          confidence?: number | null
          confidence_base?: number | null
          created_at?: string | null
          created_by?: string | null
          dtc_code?: string | null
          intensity?: number | null
          is_active?: boolean | null
          km_interval_base?: number | null
          month_interval_base?: number | null
          node_alias?: string | null
          node_category?: string | null
          node_data?: Json | null
          node_id?: string | null
          node_label?: string | null
          node_type?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_slope?: number | null
          risk_threshold_critical?: number | null
          risk_threshold_high?: number | null
          risk_threshold_medium?: number | null
          safety_gate?: string | null
          source_type?: string | null
          sources?: string[] | null
          status?: string | null
          updated_at?: string | null
          valid_from?: string | null
          valid_to?: string | null
          validation_status?: string | null
          version?: number | null
          wear_factor_aggressive?: number | null
          wear_factor_diesel?: number | null
          wear_factor_extreme?: number | null
          wear_factor_heavy_load?: number | null
          wear_factor_urban?: number | null
        }
        Relationships: []
      }
      kg_diagnosis_stats: {
        Row: {
          avg_confidence: number | null
          avg_weight: number | null
          fault_family: string | null
          fault_id: string | null
          fault_label: string | null
          observable_count: number | null
          part_count: number | null
          root_cause_count: number | null
        }
        Relationships: []
      }
      kg_feedback_stats: {
        Row: {
          avg_reliability: number | null
          confidence: number | null
          edge_id: string | null
          edge_type: string | null
          last_feedback_at: string | null
          negative_count: number | null
          pending_count: number | null
          positive_count: number | null
          source_label: string | null
          target_label: string | null
          total_feedback: number | null
          weight: number | null
        }
        Relationships: []
      }
      kg_maintenance_summary: {
        Row: {
          active_recalls: number | null
          family_code: string | null
          family_name: string | null
          fuel_type: string | null
          maintenance_count: number | null
          priorities: string[] | null
          total_max_cost: number | null
          total_min_cost: number | null
        }
        Relationships: []
      }
      kg_observables_with_context: {
        Row: {
          confidence: number | null
          confidence_base: number | null
          ctx_load: string | null
          ctx_phase: string | null
          ctx_road: string | null
          ctx_speed: string | null
          ctx_temp: string | null
          dtc_code: string | null
          input_type: string | null
          intensity: number | null
          node_alias: string | null
          node_data: Json | null
          node_id: string | null
          node_label: string | null
          perception_channel: string | null
          risk_level: string | null
          source_type: string | null
          sources: string[] | null
        }
        Insert: {
          confidence?: number | null
          confidence_base?: number | null
          ctx_load?: string | null
          ctx_phase?: string | null
          ctx_road?: string | null
          ctx_speed?: string | null
          ctx_temp?: string | null
          dtc_code?: string | null
          input_type?: string | null
          intensity?: number | null
          node_alias?: string | null
          node_data?: Json | null
          node_id?: string | null
          node_label?: string | null
          perception_channel?: string | null
          risk_level?: string | null
          source_type?: string | null
          sources?: string[] | null
        }
        Update: {
          confidence?: number | null
          confidence_base?: number | null
          ctx_load?: string | null
          ctx_phase?: string | null
          ctx_road?: string | null
          ctx_speed?: string | null
          ctx_temp?: string | null
          dtc_code?: string | null
          input_type?: string | null
          intensity?: number | null
          node_alias?: string | null
          node_data?: Json | null
          node_id?: string | null
          node_label?: string | null
          perception_channel?: string | null
          risk_level?: string | null
          source_type?: string | null
          sources?: string[] | null
        }
        Relationships: []
      }
      kg_rag_sync_errors: {
        Row: {
          errors_count: number | null
          errors_detail: Json | null
          rag_category: string | null
          rag_file_path: string | null
          synced_at: string | null
        }
        Insert: {
          errors_count?: number | null
          errors_detail?: Json | null
          rag_category?: string | null
          rag_file_path?: string | null
          synced_at?: string | null
        }
        Update: {
          errors_count?: number | null
          errors_detail?: Json | null
          rag_category?: string | null
          rag_file_path?: string | null
          synced_at?: string | null
        }
        Relationships: []
      }
      kg_rag_sync_stats: {
        Row: {
          avg_duration_ms: number | null
          files_synced: number | null
          last_sync: string | null
          rag_category: string | null
          total_edges_created: number | null
          total_edges_updated: number | null
          total_errors: number | null
          total_nodes_created: number | null
          total_nodes_updated: number | null
        }
        Relationships: []
      }
      kg_truth_labels_dashboard: {
        Row: {
          accuracy_pct: number | null
          confirmation_method: string | null
          confirmed_count: number | null
          fault_label: string | null
          label_count: number | null
          last_label_at: string | null
          rejected_count: number | null
        }
        Relationships: []
      }
      kg_truth_labels_stats: {
        Row: {
          accuracy_pct: number | null
          negative_labels: number | null
          pending_count: number | null
          positive_labels: number | null
          processed_count: number | null
          submitted_by: string | null
          total_labels: number | null
          verification_quality: string | null
        }
        Relationships: []
      }
      seo_ab_testing_formula_ctr: {
        Row: {
          date: string | null
          switch_formula: string | null
          switch_noun_id: number | null
          switch_verb_id: number | null
          target_gamme_id: number | null
          total_clicks: number | null
          unique_users: number | null
        }
        Relationships: []
      }
      seo_ab_testing_nouns: {
        Row: {
          gammes_ciblees: number | null
          switch_noun_id: number | null
          total_clicks: number | null
          unique_users: number | null
        }
        Relationships: []
      }
      seo_ab_testing_top_formulas: {
        Row: {
          clicks: number | null
          ctr_pct: number | null
          impressions: number | null
          switch_formula: string | null
        }
        Relationships: []
      }
      seo_ab_testing_verbs: {
        Row: {
          mobile_pct: number | null
          pages_sources: number | null
          switch_verb_id: number | null
          total_clicks: number | null
          unique_users: number | null
        }
        Relationships: []
      }
      seo_link_ctr: {
        Row: {
          clicks: number | null
          date: string | null
          link_type: string | null
          unique_clicks: number | null
        }
        Relationships: []
      }
      v_import_lock_status: {
        Row: {
          current_batch_id: number | null
          is_locked: boolean | null
          started_at: string | null
          status: string | null
        }
        Relationships: []
      }
      v_index_usage: {
        Row: {
          idx_scan: number | null
          idx_tup_fetch: number | null
          idx_tup_read: number | null
          index_size: string | null
          indexname: unknown
          schemaname: unknown
          tablename: unknown
        }
        Relationships: []
      }
      v_performance_monitoring: {
        Row: {
          dead_pct: number | null
          dead_rows: number | null
          health_status: string | null
          index_scans: number | null
          index_usage_pct: number | null
          last_analyze: string | null
          last_autoanalyze: string | null
          last_autovacuum: string | null
          last_vacuum: string | null
          live_rows: number | null
          sequential_scans: number | null
          table_name: unknown
          total_size: string | null
        }
        Relationships: []
      }
      v_pieces_seo_safe: {
        Row: {
          piece_des: string | null
          piece_display: boolean | null
          piece_fil_id: number | null
          piece_fil_name: string | null
          piece_ga_id: number | null
          piece_has_img: boolean | null
          piece_has_oem: boolean | null
          piece_id: number | null
          piece_name: string | null
          piece_name_comp: string | null
          piece_name_side: string | null
          piece_pg_id: number | null
          piece_pg_pid: number | null
          piece_pm_id: number | null
          piece_psf_id: number | null
          piece_qty_pack: number | null
          piece_qty_sale: number | null
          piece_ref: string | null
          piece_ref_clean: string | null
          piece_sort: number | null
          piece_update: boolean | null
          piece_weight_kgm: number | null
          piece_year: number | null
          search_vector: unknown
        }
        Insert: {
          piece_des?: string | null
          piece_display?: boolean | null
          piece_fil_id?: number | null
          piece_fil_name?: string | null
          piece_ga_id?: number | null
          piece_has_img?: boolean | null
          piece_has_oem?: boolean | null
          piece_id?: number | null
          piece_name?: string | null
          piece_name_comp?: string | null
          piece_name_side?: string | null
          piece_pg_id?: number | null
          piece_pg_pid?: number | null
          piece_pm_id?: number | null
          piece_psf_id?: number | null
          piece_qty_pack?: number | null
          piece_qty_sale?: number | null
          piece_ref?: string | null
          piece_ref_clean?: string | null
          piece_sort?: number | null
          piece_update?: boolean | null
          piece_weight_kgm?: number | null
          piece_year?: number | null
          search_vector?: unknown
        }
        Update: {
          piece_des?: string | null
          piece_display?: boolean | null
          piece_fil_id?: number | null
          piece_fil_name?: string | null
          piece_ga_id?: number | null
          piece_has_img?: boolean | null
          piece_has_oem?: boolean | null
          piece_id?: number | null
          piece_name?: string | null
          piece_name_comp?: string | null
          piece_name_side?: string | null
          piece_pg_id?: number | null
          piece_pg_pid?: number | null
          piece_pm_id?: number | null
          piece_psf_id?: number | null
          piece_qty_pack?: number | null
          piece_qty_sale?: number | null
          piece_ref?: string | null
          piece_ref_clean?: string | null
          piece_sort?: number | null
          piece_update?: boolean | null
          piece_weight_kgm?: number | null
          piece_year?: number | null
          search_vector?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "fk_pieces_gamme"
            columns: ["piece_ga_id"]
            isOneToOne: false
            referencedRelation: "__pg_gammes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_pieces_gamme"
            columns: ["piece_ga_id"]
            isOneToOne: false
            referencedRelation: "__pg_gammes"
            referencedColumns: ["position"]
          },
          {
            foreignKeyName: "fk_pieces_gamme"
            columns: ["piece_ga_id"]
            isOneToOne: false
            referencedRelation: "pieces_gamme"
            referencedColumns: ["pg_id"]
          },
          {
            foreignKeyName: "fk_pieces_marque"
            columns: ["piece_pm_id"]
            isOneToOne: false
            referencedRelation: "pieces_marque"
            referencedColumns: ["pm_id"]
          },
        ]
      }
      v_pipeline_batch_summary: {
        Row: {
          ended_at: string | null
          error_count: number | null
          last_error: string | null
          overall_status: string | null
          pel_batch_id: number | null
          started_at: string | null
          steps_count: number | null
          success_count: number | null
          total_duration_ms: number | null
        }
        Relationships: []
      }
      v_pipeline_dashboard: {
        Row: {
          pel_batch_id: number | null
          pel_counts: Json | null
          pel_duration_ms: number | null
          pel_ended_at: string | null
          pel_error: string | null
          pel_started_at: string | null
          pel_status: string | null
          pel_step: string | null
        }
        Insert: {
          pel_batch_id?: number | null
          pel_counts?: Json | null
          pel_duration_ms?: number | null
          pel_ended_at?: string | null
          pel_error?: string | null
          pel_started_at?: string | null
          pel_status?: string | null
          pel_step?: string | null
        }
        Update: {
          pel_batch_id?: number | null
          pel_counts?: Json | null
          pel_duration_ms?: number | null
          pel_ended_at?: string | null
          pel_error?: string | null
          pel_started_at?: string | null
          pel_status?: string | null
          pel_step?: string | null
        }
        Relationships: []
      }
      v_pipeline_step_stats: {
        Row: {
          avg_duration_ms: number | null
          error_count: number | null
          max_duration_ms: number | null
          min_duration_ms: number | null
          pel_step: string | null
          success_count: number | null
          total_runs: number | null
        }
        Relationships: []
      }
      v_seo_action_stats: {
        Row: {
          avg_points: number | null
          codes: string[] | null
          count: number | null
          max_points: number | null
          severity: string | null
        }
        Relationships: []
      }
      v_seo_blocking_issues: {
        Row: {
          sql_before: string | null
          sql_created_at: string | null
          sql_field: string | null
          sql_id: number | null
          sql_record_id: string | null
          sql_rules_triggered: Json | null
          sql_score_before: number | null
          sql_table: string | null
        }
        Insert: {
          sql_before?: string | null
          sql_created_at?: string | null
          sql_field?: string | null
          sql_id?: number | null
          sql_record_id?: string | null
          sql_rules_triggered?: Json | null
          sql_score_before?: number | null
          sql_table?: string | null
        }
        Update: {
          sql_before?: string | null
          sql_created_at?: string | null
          sql_field?: string | null
          sql_id?: number | null
          sql_record_id?: string | null
          sql_rules_triggered?: Json | null
          sql_score_before?: number | null
          sql_table?: string | null
        }
        Relationships: []
      }
      v_seo_contradiction_summary: {
        Row: {
          active_count: number | null
          active_pairs: string[] | null
          context: string | null
          disabled_count: number | null
        }
        Relationships: []
      }
      v_seo_crawl_stats_7d: {
        Row: {
          avg_response_ms: number | null
          count_2xx: number | null
          count_3xx: number | null
          count_4xx: number | null
          count_5xx: number | null
          crawl_date: string | null
          median_response_ms: number | null
          p95_response_ms: number | null
          total_bytes: number | null
          total_crawls: number | null
          unique_urls: number | null
        }
        Relationships: []
      }
      v_seo_dashboard_kpis: {
        Row: {
          avg_inbound_links: number | null
          avg_orphan_risk: number | null
          avg_score: number | null
          cold_count: number | null
          computed_at: string | null
          exclude_count: number | null
          high_confusion_risk_count: number | null
          high_duplication_risk_count: number | null
          high_orphan_risk_count: number | null
          hot_count: number | null
          hot_not_indexed_count: number | null
          indexed_count: number | null
          new_count: number | null
          not_indexed_count: number | null
          pct_indexed: number | null
          stable_count: number | null
          total_scored: number | null
        }
        Relationships: []
      }
      v_seo_index_losses_7d: {
        Row: {
          bucket: string | null
          lost_at: string | null
          page_type: string | null
          score_total: number | null
          snapshot_date: string | null
          url: string | null
        }
        Relationships: []
      }
      v_seo_indexation_stats: {
        Row: {
          avg_score: number | null
          count: number | null
          max_score: number | null
          min_score: number | null
          sis_entity_type: string | null
          sis_index_status: string | null
        }
        Relationships: []
      }
      v_seo_internal_link_stats: {
        Row: {
          inbound_count: number | null
          link_types: string[] | null
          unique_sources: number | null
          url: string | null
        }
        Relationships: []
      }
      v_seo_interpolation_alerts_24h: {
        Row: {
          affected_fields: string[] | null
          alert_count: number | null
          last_alert: string | null
          pg_id: number | null
          total_occurrences: number | null
        }
        Relationships: []
      }
      v_seo_interpolation_alerts_weekly: {
        Row: {
          affected_fields: string[] | null
          alert_count: number | null
          gamme_name: string | null
          last_alert: string | null
          pg_id: number | null
          total_occurrences: number | null
        }
        Relationships: []
      }
      v_seo_keywords_unmatched: {
        Row: {
          energy: string | null
          gamme: string | null
          id: number | null
          keyword: string | null
          model: string | null
          v_level: string | null
          variant: string | null
          volume: number | null
        }
        Insert: {
          energy?: string | null
          gamme?: string | null
          id?: number | null
          keyword?: string | null
          model?: string | null
          v_level?: string | null
          variant?: string | null
          volume?: number | null
        }
        Update: {
          energy?: string | null
          gamme?: string | null
          id?: number | null
          keyword?: string | null
          model?: string | null
          v_level?: string | null
          variant?: string | null
          volume?: number | null
        }
        Relationships: []
      }
      v_seo_last_googlebot_crawl: {
        Row: {
          last_googlebot_crawl_at: string | null
          last_response_ms: number | null
          last_status_code: number | null
          url: string | null
        }
        Relationships: []
      }
      v_seo_mandatory_fields_summary: {
        Row: {
          criticality: string | null
          family: string | null
          field_count: number | null
          fields: string[] | null
          product_type: string | null
        }
        Relationships: []
      }
      v_seo_operational_queue: {
        Row: {
          action_type: string | null
          bucket: string | null
          detected_at: string | null
          priority: number | null
          rule: string | null
          score_total: number | null
          url: string | null
        }
        Relationships: []
      }
      v_seo_quality_stats: {
        Row: {
          avg_improvement: number | null
          avg_score_after: number | null
          avg_score_before: number | null
          count: number | null
          log_date: string | null
          sql_action: string | null
          sql_table: string | null
        }
        Relationships: []
      }
      v_seo_quarantine: {
        Row: {
          sis_blocker_types: string[] | null
          sis_created_at: string | null
          sis_entity_id: string | null
          sis_entity_type: string | null
          sis_quarantine_reason: string | null
          sis_score: number | null
          sis_updated_at: string | null
        }
        Insert: {
          sis_blocker_types?: string[] | null
          sis_created_at?: string | null
          sis_entity_id?: string | null
          sis_entity_type?: string | null
          sis_quarantine_reason?: string | null
          sis_score?: number | null
          sis_updated_at?: string | null
        }
        Update: {
          sis_blocker_types?: string[] | null
          sis_created_at?: string | null
          sis_entity_id?: string | null
          sis_entity_type?: string | null
          sis_quarantine_reason?: string | null
          sis_score?: number | null
          sis_updated_at?: string | null
        }
        Relationships: []
      }
      v_seo_temperature_stats: {
        Row: {
          avg_duplication_risk: number | null
          avg_orphan_risk: number | null
          avg_score: number | null
          temperature: string | null
          total_inbound_links: number | null
          url_count: number | null
        }
        Relationships: []
      }
      v_seo_url_health: {
        Row: {
          bucket: string | null
          entity_id: number | null
          has_blocker: boolean | null
          index_score: number | null
          index_status: string | null
          is_indexable_hint: boolean | null
          last_crawl_status: number | null
          last_googlebot_crawl_at: string | null
          page_type: string | null
          priority: number | null
          score_total: number | null
          temperature: string | null
          url: string | null
          violations_30d: number | null
        }
        Relationships: [
          {
            foreignKeyName: "__seo_page_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "__seo_entity"
            referencedColumns: ["id"]
          },
        ]
      }
      v_substitution_daily: {
        Row: {
          count: number | null
          day: string | null
          http_status_served: number | null
        }
        Relationships: []
      }
      v_substitution_funnel: {
        Row: {
          completions: number | null
          lock_type: string | null
          rate: number | null
          total_entries: number | null
        }
        Relationships: []
      }
      v_table_health: {
        Row: {
          dead_ratio: number | null
          dead_rows: number | null
          last_analyze: string | null
          last_autovacuum: string | null
          last_vacuum: string | null
          live_rows: number | null
          schemaname: unknown
          tablename: unknown
          total_size: string | null
        }
        Relationships: []
      }
      v_thresholds_by_family: {
        Row: {
          gt_family: string | null
          threshold_count: number | null
          thresholds: Json | null
        }
        Relationships: []
      }
      v_thresholds_comparison: {
        Row: {
          default_action: string | null
          default_value: number | null
          family_overrides: Json | null
          gt_gate: string | null
          gt_metric: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      acquire_import_lock: { Args: never; Returns: boolean }
      acquire_rebuild_job: {
        Args: { p_worker_id: string }
        Returns: {
          gamme_id: number
          vehicle_id: number
        }[]
      }
      add_to_quarantine: {
        Args: {
          p_batch_id: number
          p_entity_type: string
          p_internal_id?: number
          p_priority?: number
          p_reason: string
          p_reason_details?: Json
          p_source_key: string
        }
        Returns: number
      }
      aggregate_seo_link_metrics: { Args: never; Returns: undefined }
      all_gates_passed: { Args: { p_import_id: number }; Returns: boolean }
      analyze_duplicates: {
        Args: never
        Returns: {
          estimated_duplicates: number
          sample_duplicate_count: number
          total_records: number
          unique_combinations: number
        }[]
      }
      apply_decisions_shadow: {
        Args: { p_batch_id: number; p_entity_type: string }
        Returns: Json
      }
      apply_quarantine_rules: { Args: { p_batch_id?: number }; Returns: Json }
      backfill_seo_keywords_type_ids:
        | {
            Args: { p_batch_size?: number }
            Returns: {
              matched: number
              processed: number
              unmatched: number
            }[]
          }
        | {
            Args: { p_batch_size?: number; p_pg_id?: number }
            Returns: {
              matched: number
              processed: number
              unmatched: number
            }[]
          }
      batch_evaluate_seo: { Args: { p_items: Json }; Returns: Json }
      build_article_decisions: { Args: { p_batch_id: number }; Returns: Json }
      build_brand_decisions: { Args: { p_batch_id: number }; Returns: Json }
      calc_article_bf: {
        Args: {
          p_brand_norm: string
          p_ean?: string
          p_key_dims?: string
          p_product_type?: string
          p_ref_norm: string
        }
        Returns: string
      }
      calc_brand_bf: { Args: { p_brand_name: string }; Returns: string }
      calc_business_fingerprint: {
        Args: { p_parts: string[] }
        Returns: string
      }
      calc_vehicle_bf: {
        Args: {
          p_engine: string
          p_make: string
          p_model: string
          p_year_from: number
          p_year_to: number
        }
        Returns: string
      }
      calculate_product_score: {
        Args: {
          p_gamme_name?: string
          p_has_image: boolean
          p_piece_name?: string
          p_price: number
          p_quality: Database["public"]["Enums"]["rm_quality_enum"]
          p_stock_status: Database["public"]["Enums"]["rm_stock_status_enum"]
        }
        Returns: number
      }
      calculate_quality_score: { Args: { p_issues: Json }; Returns: number }
      calculate_seo_score_gate: {
        Args: {
          p_content: Json
          p_family?: string
          p_pg_id?: number
          p_piece_id?: string
        }
        Returns: Json
      }
      calculate_text_similarity: {
        Args: { p_text_a: string; p_text_b: string }
        Returns: Json
      }
      can_merge_batch: { Args: { p_batch_id: number }; Returns: Json }
      check_all_content_lengths: { Args: { p_content: Json }; Returns: Json }
      check_all_gates: {
        Args: { p_batch_id: number; p_entity_type: string }
        Returns: Json
      }
      check_all_object_associations: {
        Args: { p_content: string; p_family?: string }
        Returns: Json
      }
      check_ambiguous_terms: {
        Args: { p_content: string; p_zone?: string }
        Returns: Json
      }
      check_anti_purge: {
        Args: {
          p_current_count: number
          p_table_name: string
          p_threshold?: number
        }
        Returns: Json
      }
      check_breakglass: {
        Args: { p_table: string; p_token: string }
        Returns: boolean
      }
      check_claims_tiered: {
        Args: { p_content: string; p_zone?: string }
        Returns: Json
      }
      check_compatibility_proof: {
        Args: {
          p_content: string
          p_has_compatibility_link?: boolean
          p_has_vehicle_selector?: boolean
          p_zone?: string
        }
        Returns: Json
      }
      check_completeness: {
        Args: { p_family: string; p_product_data: Json }
        Returns: Json
      }
      check_confusion_pairs: {
        Args: { p_content: string; p_zone?: string }
        Returns: Json
      }
      check_content_length: {
        Args: { p_content: string; p_zone: string }
        Returns: Json
      }
      check_cooccurrence: {
        Args: {
          p_cart_pg_ids?: number[]
          p_content?: string
          p_context?: string
          p_pg_id: number
        }
        Returns: Json
      }
      check_database_health: {
        Args: never
        Returns: {
          dead_tuples_pct: number
          health_status: string
          last_vacuum: string
          needs_action: string
          table_name: string
        }[]
      }
      check_duplicate_content: { Args: { p_content: Json }; Returns: Json }
      check_freinage_rules: {
        Args: { p_content: string; p_gamme?: string; p_zone?: string }
        Returns: Json
      }
      check_gate: {
        Args: {
          p_blocker_reason?: string
          p_details?: Json
          p_gate_number: number
          p_import_id: number
          p_passed: boolean
        }
        Returns: boolean
      }
      check_gate_g0: { Args: { p_batch_id: number }; Returns: Json }
      check_gate_g1: {
        Args: { p_batch_id: number; p_entity_type: string }
        Returns: Json
      }
      check_gate_g2: {
        Args: { p_batch_id: number; p_entity_type: string }
        Returns: Json
      }
      check_gate_g3: { Args: { p_batch_id: number }; Returns: Json }
      check_gate_g4: {
        Args: { p_batch_id: number; p_entity_type: string }
        Returns: Json
      }
      check_heading_structure: { Args: { p_body: string }; Returns: Json }
      check_internal_contradictions: {
        Args: { p_content: Json }
        Returns: Json
      }
      check_lexique_confusion: {
        Args: { p_content: string; p_pg_id: number }
        Returns: Json
      }
      check_lexique_cross_component: {
        Args: { p_content: string; p_pg_id: number }
        Returns: Json
      }
      check_manifest_complete: { Args: { p_import_id: number }; Returns: Json }
      check_object_associations: {
        Args: { p_content: string; p_family?: string; p_piece: string }
        Returns: Json
      }
      check_product_completeness: {
        Args: {
          p_family?: string
          p_gamme_name?: string
          p_pg_id?: number
          p_piece_id: string
        }
        Returns: Json
      }
      check_product_completeness_v2: {
        Args: {
          p_family_id: string
          p_product_data: Json
          p_product_type?: string
        }
        Returns: Json
      }
      check_rm_products_integrity: {
        Args: never
        Returns: {
          gamme_id: number
          orphan_product_id: number
          vehicle_id: number
        }[]
      }
      check_subsystem_integrity: {
        Args: { p_content: Json; p_target_subsystem: string }
        Returns: Json
      }
      check_threshold: {
        Args: {
          p_actual_value: number
          p_family: string
          p_gate: string
          p_metric: string
        }
        Returns: Json
      }
      check_unresolved_variables: {
        Args: { p_content: string; p_zone?: string }
        Returns: Json
      }
      check_variable_hallucination: {
        Args: { p_content: string; p_zone: string }
        Returns: Json
      }
      check_vehicle_compatibility_claim: {
        Args: {
          p_content: string
          p_pg_id?: number
          p_type_id?: number
          p_zone?: string
        }
        Returns: Json
      }
      check_vehicle_compatibility_full: {
        Args: {
          p_content: string
          p_has_compatibility_link?: boolean
          p_has_vehicle_selector?: boolean
          p_pg_id?: number
          p_type_id?: number
          p_zone?: string
        }
        Returns: Json
      }
      cleanup_expired_carts: { Args: never; Returns: number }
      cleanup_expired_password_resets: { Args: never; Returns: undefined }
      cleanup_old_error_logs: { Args: never; Returns: number }
      cleanup_old_pipeline_logs: { Args: { p_days?: number }; Returns: number }
      complete_pipeline_step: {
        Args: {
          p_batch_id: number
          p_counts?: Json
          p_error?: string
          p_status?: string
          p_step: string
        }
        Returns: undefined
      }
      complete_rebuild_job: {
        Args: {
          p_brand_count?: number
          p_data_version?: string
          p_duration_ms?: number
          p_error_code?: string
          p_error_message?: string
          p_gamme_id: number
          p_product_count?: number
          p_success: boolean
          p_vehicle_id: number
          p_worker_id: string
        }
        Returns: undefined
      }
      compute_seo_indexable: {
        Args: {
          p_build_status: Database["public"]["Enums"]["rm_build_status_enum"]
          p_family_id: number
          p_product_count: number
        }
        Returns: {
          indexable: boolean
          reason: string
        }[]
      }
      count_sitemap_urls_by_temperature: {
        Args: { p_temperature: string }
        Returns: number
      }
      count_words: { Args: { p_text: string }; Returns: number }
      create_batch_contract: {
        Args: {
          p_entity_type: string
          p_expected_count: number
          p_import_id: number
        }
        Returns: number
      }
      create_batch_contract_v2: {
        Args: {
          p_batch_id: number
          p_entity_type: string
          p_expected_count: number
          p_expected_tables?: string[]
          p_min_rowcounts?: Json
          p_source_checksums?: Json
          p_source_version?: string
        }
        Returns: number
      }
      create_composite_index_async: {
        Args: {
          p_columns: string[]
          p_include_columns?: string[]
          p_index_name?: string
          p_table_name: string
        }
        Returns: Json
      }
      create_import_batch: {
        Args: {
          p_metadata?: Json
          p_source_file?: string
          p_source_hash?: string
          p_source_system: string
        }
        Returns: number
      }
      create_index_async: {
        Args: {
          p_column_name: string
          p_index_name?: string
          p_index_type?: string
          p_table_name: string
        }
        Returns: Json
      }
      create_rm_listing_products_partition: {
        Args: { p_gamme_id: number }
        Returns: undefined
      }
      decode_html_entities: { Args: { input: string }; Returns: string }
      delete_duplicates_batch: {
        Args: { batch_size?: number; max_deletions?: number }
        Returns: {
          batch_number: number
          deleted_count: number
          remaining_target: number
          total_deleted: number
        }[]
      }
      delete_first_records_batch: {
        Args: { batch_size?: number; max_deletions?: number }
        Returns: {
          batch_number: number
          deleted_count: number
          total_deleted: number
        }[]
      }
      detect_components_in_text: {
        Args: { p_content: string }
        Returns: {
          component: string
          matched_text: string
          subsystem: string
        }[]
      }
      determine_indexation_status: {
        Args: {
          p_blocker_types?: string[]
          p_has_blocker: boolean
          p_score: number
        }
        Returns: Json
      }
      determine_product_quality: {
        Args: { p_pm_nb_stars: string; p_pm_oes: string; p_pm_quality: string }
        Returns: Database["public"]["Enums"]["rm_quality_enum"]
      }
      determine_stock_status: {
        Args: { p_pri_dispo: string }
        Returns: Database["public"]["Enums"]["rm_stock_status_enum"]
      }
      diagnose_symptoms: {
        Args: { p_context?: Json; p_symptoms: string[] }
        Returns: Json
      }
      ensure_rm_partition: { Args: { p_gamme_id: number }; Returns: boolean }
      evaluate_business_rules: {
        Args: {
          p_cart_data?: Json
          p_content?: string
          p_context: string
          p_entity_type: string
          p_famille?: string
          p_pg_id?: number
          p_product_data?: Json
        }
        Returns: Json
      }
      evaluate_rule_condition:
        | {
            Args: {
              p_condition: Json
              p_content: string
              p_entity_type?: string
              p_famille?: string
              p_pg_id?: number
            }
            Returns: boolean
          }
        | {
            Args: {
              p_condition: Json
              p_content: string
              p_entity_type?: string
              p_famille?: string
              p_pg_id?: number
              p_zone_contents?: Json
            }
            Returns: boolean
          }
        | {
            Args: {
              p_cart_data: Json
              p_condition: Json
              p_content: string
              p_pg_id: number
              p_product_data: Json
            }
            Returns: boolean
          }
      execute_diff_apply_workflow: {
        Args: {
          p_auto_switch?: boolean
          p_batch_id: number
          p_entity_type: string
        }
        Returns: Json
      }
      fail_pipeline_step: {
        Args: {
          p_batch_id: number
          p_counts?: Json
          p_error: string
          p_step: string
        }
        Returns: undefined
      }
      finalize_import_batch: {
        Args: { p_batch_id: number; p_status?: string }
        Returns: undefined
      }
      fix_utf8_encoding: { Args: { input_text: string }; Returns: string }
      get_action_definition: { Args: { p_action_code: string }; Returns: Json }
      get_all_seo_observables_for_sitemap: {
        Args: never
        Returns: {
          risk_level: string
          safety_gate: string
          slug: string
          updated_at: string
        }[]
      }
      get_all_seo_references: {
        Args: never
        Returns: {
          definition: string
          gamme_name: string
          gamme_slug: string
          id: number
          meta_description: string
          pg_id: number
          slug: string
          title: string
        }[]
      }
      get_audit_stats_by_admin: {
        Args: never
        Returns: {
          admin_email: string
          count: number
        }[]
      }
      get_audit_stats_by_type: {
        Args: never
        Returns: {
          action_type: string
          count: number
        }[]
      }
      get_auto_types_batch: {
        Args: { p_type_ids: number[] }
        Returns: {
          engine: string
          fuel: string
          make_name: string
          model_generation: string
          model_name: string
          power_hp: number
          type_id: number
          type_name: string
          year_from: string
          year_to: string
        }[]
      }
      get_automecanik_id: {
        Args: { p_entity_type: string; p_external_id: string }
        Returns: number
      }
      get_batch_report: { Args: { p_batch_id: number }; Returns: Json }
      get_brand_bestsellers_optimized: {
        Args: {
          p_limit_parts?: number
          p_limit_vehicles?: number
          p_marque_id: number
        }
        Returns: Json
      }
      get_brand_page_data_optimized: {
        Args: { p_marque_id: number }
        Returns: Json
      }
      get_brands_with_pieces: {
        Args: never
        Returns: {
          pm_id: number
          pm_name: string
        }[]
      }
      get_cart_stats:
        | {
            Args: { p_user_id: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.get_cart_stats(p_user_id => text), public.get_cart_stats(p_user_id => varchar), public.get_cart_stats(p_user_id => uuid). Try renaming the parameters or the function itself in the database so function overloading can be resolved"[]
          }
        | {
            Args: { p_user_id: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.get_cart_stats(p_user_id => text), public.get_cart_stats(p_user_id => varchar), public.get_cart_stats(p_user_id => uuid). Try renaming the parameters or the function itself in the database so function overloading can be resolved"[]
          }
        | {
            Args: { p_user_id: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.get_cart_stats(p_user_id => text), public.get_cart_stats(p_user_id => varchar), public.get_cart_stats(p_user_id => uuid). Try renaming the parameters or the function itself in the database so function overloading can be resolved"[]
          }
      get_catalog_families_for_vehicle: {
        Args: { p_type_id: number }
        Returns: {
          mf_description: string
          mf_display: number
          mf_id: number
          mf_name: string
          mf_name_system: string
          mf_pic: string
          mf_sort: number
        }[]
      }
      get_catalog_families_for_vehicle_optimized: {
        Args: { p_type_id: number }
        Returns: {
          gammes_json: Json
          mf_description: string
          mf_display: number
          mf_id: number
          mf_name: string
          mf_name_system: string
          mf_pic: string
          mf_sort: number
        }[]
      }
      get_catalog_hierarchy_optimized: {
        Args: never
        Returns: {
          mc_id: string
          mc_mf_id: string
          mc_mf_prime: string
          mc_pg_id: string
          mc_sort: string
          mf_display: string
          mf_id: string
          mf_image: string
          mf_name: string
          mf_sort: number
          pg_alias: string
          pg_id: number
          pg_img: string
          pg_name: string
        }[]
      }
      get_catalog_legacy: {
        Args: { p_limit?: number }
        Returns: {
          brand_name: string
          id: number
          image_url: string
          name: string
          reference: string
        }[]
      }
      get_catalog_mapping_stats: {
        Args: never
        Returns: {
          entity_type: string
          latest_version: string
          oldest_version: string
          total_mappings: number
        }[]
      }
      get_catalog_type_ids_for_gamme: {
        Args: { p_pg_id: number }
        Returns: {
          type_id: number
        }[]
      }
      get_context_questions: { Args: { p_subsystem?: string }; Returns: Json }
      get_coverage_map: {
        Args: never
        Returns: {
          conseil_count: number
          conseil_rich_count: number
          conseil_sections: string[]
          coverage_score: number
          depth_score: number
          faq_count: number
          hard_gates_clean: boolean
          has_anti_mistakes: boolean
          has_decision_tree: boolean
          has_faq: boolean
          has_how_to_choose: boolean
          has_rag_file: boolean
          has_selection_criteria: boolean
          has_symptoms: boolean
          how_to_choose_length: number
          last_updated_at: string
          pg_alias: string
          pg_id: number
          pg_name: string
          pipeline_quality: number
          priority: string
          rag_content_length: number
          rag_content_ok: boolean
          seo_content_length: number
          seo_content_ok: boolean
          seo_desc_length: number
          seo_desc_ok: boolean
          seo_h1_ok: boolean
          seo_score: number
          seo_title_length: number
          seo_title_ok: boolean
          source_verified: boolean
          symptoms_count: number
          thin_conseil_count: number
          thin_conseil_sections: string[]
          trust_score: number
        }[]
      }
      get_crawl_activity_by_day: {
        Args: { p_days?: number }
        Returns: {
          avg_response_ms: number
          crawl_date: string
          request_count: number
          status_2xx: number
          status_3xx: number
          status_4xx: number
          status_5xx: number
        }[]
      }
      get_decision_report: {
        Args: { p_batch_id: number; p_entity_type: string }
        Returns: Json
      }
      get_external_id: {
        Args: { p_automecanik_id: number; p_entity_type: string }
        Returns: string
      }
      get_extras_v4_type_ids: {
        Args: { p_pg_id: number }
        Returns: {
          keyword: string
          keyword_id: number
          pg_id: number
          type_id: number
        }[]
      }
      get_facet_config: {
        Args: { p_family_id: number; p_gamme_id: number }
        Returns: {
          rmfc_allowed_filter_keys: Json | null
          rmfc_created_at: string | null
          rmfc_default_filters: Json | null
          rmfc_default_sort: string | null
          rmfc_enabled_facets: Json
          rmfc_family_id: number | null
          rmfc_gamme_id: number | null
          rmfc_id: number
          rmfc_max_brands_ui: number | null
          rmfc_pagination_sizes: number[] | null
          rmfc_partial_threshold: number | null
          rmfc_updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "rm_facet_config"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_family_completeness_stats: {
        Args: { p_family: string; p_limit?: number }
        Returns: {
          gamme_name: string
          missing_critical_count: number
          missing_important_count: number
          piece_id: string
          score: number
          verdict: string
        }[]
      }
      get_gamme_composite_scores: {
        Args: { p_aliases?: string[] }
        Returns: {
          composite_score: number
          latest_refresh: string
          page_types_completed: number
          page_types_total: number
          pg_alias: string
          r1_score: number
          r3_conseils_score: number
          r3_guide_score: number
          r4_score: number
        }[]
      }
      get_gamme_data_v3: { Args: { p_pg_id: number }; Returns: Json }
      get_gamme_families: {
        Args: never
        Returns: {
          family_name: string
          pg_id: number
        }[]
      }
      get_gamme_page_data: { Args: { p_pg_id: number }; Returns: Json }
      get_gamme_page_data_optimized: {
        Args: { p_pg_id: number }
        Returns: Json
      }
      get_gamme_price_preview: {
        Args: { p_limit?: number; p_pg_id: number }
        Returns: Json
      }
      get_gamme_product_counts: {
        Args: never
        Returns: {
          pg_id: number
          product_count: number
        }[]
      }
      get_gammes_for_family_and_vehicle: {
        Args: { p_mf_id: number; p_type_id: number }
        Returns: {
          mc_sort: number
          pg_alias: string
          pg_display: number
          pg_id: number
          pg_img: string
          pg_level: number
          pg_name: string
          pg_name_meta: string
          pg_name_url: string
          pg_pic: string
        }[]
      }
      get_gammes_with_pieces: {
        Args: never
        Returns: {
          pg_id: number
          pg_name: string
        }[]
      }
      get_homepage_data_optimized: { Args: never; Returns: Json }
      get_import_gate_report: { Args: { p_import_id: number }; Returns: Json }
      get_listing_products_extended: {
        Args: { p_gamme_id: number; p_limit?: number; p_vehicle_id: number }
        Returns: {
          description: string
          dispo: boolean
          filtre_gamme: string
          filtre_side: string
          has_image: boolean
          has_oem: boolean
          id: number
          image: string
          is_accessory: boolean
          marque: string
          marque_id: number
          marque_logo: string
          nb_stars: number
          nom: string
          prix_consigne: number
          prix_ttc: number
          prix_unitaire: number
          quality: string
          quantite_vente: number
          reference: string
          reference_clean: string
          score: number
          stock_status: string
        }[]
      }
      get_listing_products_for_build_v2: {
        Args: { p_gamme_id: number; p_limit?: number; p_vehicle_id: number }
        Returns: {
          has_image: boolean
          piece_id: number
          piece_name: string
          piece_position: string
          piece_reference: string
          pm_id: number
          pm_name: string
          price_ttc: number
          quality: Database["public"]["Enums"]["rm_quality_enum"]
          score: number
          stock_status: Database["public"]["Enums"]["rm_stock_status_enum"]
        }[]
      }
      get_mandatory_fields: {
        Args: { p_family_id: string; p_product_type?: string }
        Returns: Json
      }
      get_missing_v4_type_ids: {
        Args: { p_pg_id: number }
        Returns: {
          modele_name: string
          pg_id: number
          type_fuel: string
          type_id: number
          type_name: string
        }[]
      }
      get_nk_stats: { Args: never; Returns: Json }
      get_observe_only_impact_stats: {
        Args: { p_days?: number }
        Returns: Json
      }
      get_oem_refs_for_vehicle: {
        Args: { p_marque_name: string; p_pg_id: number; p_type_id: number }
        Returns: Json
      }
      get_or_create_brand_nk: {
        Args: { p_brand_name: string; p_internal_id?: number }
        Returns: number
      }
      get_page_quality_features: {
        Args: never
        Returns: {
          blog_advice_content_length: number
          conseil_exists: boolean
          conseil_has_s1: boolean
          conseil_has_s2: boolean
          conseil_has_s3: boolean
          conseil_has_s4_depose: boolean
          conseil_has_s4_repose: boolean
          conseil_has_s5: boolean
          conseil_has_s6: boolean
          conseil_has_s7: boolean
          conseil_has_s8: boolean
          conseil_rich_sections: number
          conseil_total_content_length: number
          conseil_total_sections: number
          guide_anti_mistakes_count: number
          guide_arg_count: number
          guide_decision_tree_length: number
          guide_exists: boolean
          guide_faq_count: number
          guide_how_to_choose_length: number
          guide_intro_role_length: number
          guide_is_draft: boolean
          guide_risk_explanation_length: number
          guide_selection_criteria_length: number
          guide_source_verified: boolean
          guide_symptoms_count: number
          guide_updated_at: string
          has_blog_advice: boolean
          has_pg_img: boolean
          has_pg_pic: boolean
          has_pg_wall: boolean
          pg_alias: string
          pg_id: number
          pg_name: string
          pipeline_completed_at: string
          pipeline_hard_gate_results: Json
          pipeline_quality_score: number
          rag_content_length: number
          rag_truth_level: string
          ref_blog_slugs_count: number
          ref_composition_count: number
          ref_confusions_count: number
          ref_content_html_length: number
          ref_definition_length: number
          ref_exists: boolean
          ref_has_canonical: boolean
          ref_has_schema_json: boolean
          ref_meta_desc_length: number
          ref_regles_metier_count: number
          ref_related_refs_count: number
          ref_role_mecanique_length: number
          ref_symptomes_count: number
          ref_title_length: number
          ref_updated_at: string
          seo_content_length: number
          seo_desc_length: number
          seo_exists: boolean
          seo_h1_length: number
          seo_title_length: number
        }[]
      }
      get_penalty: {
        Args: { p_context?: string; p_error: string; p_rule: string }
        Returns: {
          is_blocking: boolean
          penalty: number
        }[]
      }
      get_pieces_for_type_gamme: {
        Args: { p_pg_id: number; p_type_id: number }
        Returns: Json
      }
      get_pieces_for_type_gamme_v2: {
        Args: { p_pg_id: number; p_type_id: number }
        Returns: Json
      }
      get_pieces_for_type_gamme_v3: {
        Args: { p_pg_id: number; p_type_id: number }
        Returns: Json
      }
      get_pieces_for_type_gamme_v4: {
        Args: { p_pg_id: number; p_type_id: number }
        Returns: Json
      }
      get_purchase_excluded_ids: {
        Args: never
        Returns: {
          piece_id: number
        }[]
      }
      get_quarantine_dashboard: {
        Args: {
          p_batch_id?: number
          p_entity_type?: string
          p_limit?: number
          p_offset?: number
          p_status?: string
        }
        Returns: Json
      }
      get_quarantine_stats: { Args: never; Returns: Json }
      get_seo_critical_alerts: {
        Args: never
        Returns: {
          action_url: string
          alert_type: string
          count: number
          description: string
          severity: string
        }[]
      }
      get_seo_excluded_ids: {
        Args: { p_entity_type: string }
        Returns: {
          internal_id: number
        }[]
      }
      get_seo_observable_by_slug: {
        Args: { p_slug: string }
        Returns: {
          canonical_url: string
          cluster_id: string
          created_at: string
          ctx_freq: string
          ctx_load: string[]
          ctx_phase: string[]
          ctx_road: string[]
          ctx_speed: string[]
          ctx_temp: string[]
          dtc_codes: string[]
          dtc_descriptions: Json
          estimated_repair_cost_max: number
          estimated_repair_cost_min: number
          estimated_repair_duration: string
          id: number
          is_published: boolean
          meta_description: string
          observable_type: string
          perception_channel: string
          priority: number
          recommended_actions: Json
          related_blog_articles: string[]
          related_gammes: number[]
          related_references: string[]
          risk_level: string
          safety_gate: string
          schema_org: Json
          sign_description: string
          slug: string
          symptom_description: string
          title: string
          updated_at: string
        }[]
      }
      get_seo_observable_featured: {
        Args: { p_limit?: number }
        Returns: {
          action_ids: string[] | null
          canonical_url: string | null
          cluster_id: string | null
          created_at: string | null
          created_by: string | null
          ctx_freq: string | null
          ctx_load: string[] | null
          ctx_phase: string[] | null
          ctx_road: string[] | null
          ctx_speed: string[] | null
          ctx_temp: string[] | null
          dtc_codes: string[] | null
          dtc_descriptions: Json | null
          estimated_repair_cost_max: number | null
          estimated_repair_cost_min: number | null
          estimated_repair_duration: string | null
          fault_ids: string[] | null
          id: number
          is_published: boolean | null
          kg_observable_ids: string[] | null
          meta_description: string | null
          observable_type: string | null
          page_role: Database["public"]["Enums"]["seo_page_role"] | null
          perception_channel: string | null
          priority: number | null
          publish_date: string | null
          recommended_actions: Json | null
          related_blog_articles: string[] | null
          related_gammes: number[] | null
          related_references: string[] | null
          risk_level: string | null
          safety_gate: string | null
          schema_org: Json | null
          sign_description: string | null
          slug: string
          symptom_description: string | null
          title: string
          updated_at: string | null
          updated_by: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "__seo_observable"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_seo_observables_by_cluster: {
        Args: { p_cluster_id: string; p_limit?: number }
        Returns: {
          action_ids: string[] | null
          canonical_url: string | null
          cluster_id: string | null
          created_at: string | null
          created_by: string | null
          ctx_freq: string | null
          ctx_load: string[] | null
          ctx_phase: string[] | null
          ctx_road: string[] | null
          ctx_speed: string[] | null
          ctx_temp: string[] | null
          dtc_codes: string[] | null
          dtc_descriptions: Json | null
          estimated_repair_cost_max: number | null
          estimated_repair_cost_min: number | null
          estimated_repair_duration: string | null
          fault_ids: string[] | null
          id: number
          is_published: boolean | null
          kg_observable_ids: string[] | null
          meta_description: string | null
          observable_type: string | null
          page_role: Database["public"]["Enums"]["seo_page_role"] | null
          perception_channel: string | null
          priority: number | null
          publish_date: string | null
          recommended_actions: Json | null
          related_blog_articles: string[] | null
          related_gammes: number[] | null
          related_references: string[] | null
          risk_level: string | null
          safety_gate: string | null
          schema_org: Json | null
          sign_description: string | null
          slug: string
          symptom_description: string | null
          title: string
          updated_at: string | null
          updated_by: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "__seo_observable"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_seo_quality_daily_stats: { Args: { p_date?: string }; Returns: Json }
      get_seo_reference_by_slug: {
        Args: { p_slug: string }
        Returns: {
          blog_slugs: string[]
          canonical_url: string
          composition: string[]
          confusions_courantes: string[]
          content_html: string
          created_at: string
          definition: string
          gamme_name: string
          gamme_slug: string
          id: number
          is_published: boolean
          meta_description: string
          pg_id: number
          pg_img: string
          regles_metier: string[]
          related_references: number[]
          role_mecanique: string
          role_negatif: string
          schema_json: Json
          scope_limites: string
          slug: string
          symptomes_associes: string[]
          title: string
          updated_at: string
        }[]
      }
      get_sitemap_urls_by_temperature: {
        Args: { p_limit?: number; p_offset?: number; p_temperature: string }
        Returns: {
          changefreq: string
          last_modified_at: string
          page_type: string
          priority: number
          url: string
        }[]
      }
      get_stabilize_pages: {
        Args: { p_days_max?: number; p_days_min?: number; p_limit?: number }
        Returns: {
          days_since_indexed: number
          page_type: string
          score_total: number
          url: string
        }[]
      }
      get_staging_stats: {
        Args: { p_import_id: number }
        Returns: {
          error_count: number
          pending_count: number
          table_name: string
          total_count: number
          validated_count: number
        }[]
      }
      get_substitution_data: {
        Args: {
          p_gamme_alias: string
          p_gamme_id?: number
          p_marque_alias?: string
          p_modele_alias?: string
          p_type_alias?: string
        }
        Returns: Json
      }
      get_subsystem_components: {
        Args: { p_subsystem: string }
        Returns: {
          aliases: string[]
          component: string
        }[]
      }
      get_symptoms_by_subsystem: {
        Args: { p_subsystem?: string }
        Returns: Json
      }
      get_threshold: {
        Args: { p_family: string; p_gate: string; p_metric: string }
        Returns: {
          action: string
          description: string
          max_value: number
        }[]
      }
      get_top_money_gammes: {
        Args: { p_limit?: number }
        Returns: {
          gamme_id: number
          gamme_name: string
          total_volume: number
        }[]
      }
      get_vehicle_compatible_gammes_php: {
        Args: { p_type_id: number }
        Returns: {
          pg_id: number
          total_pieces: number
        }[]
      }
      get_vehicle_page_data_optimized: {
        Args: { p_type_id: number }
        Returns: Json
      }
      get_vlevel_champions: {
        Args: { p_pg_id: number }
        Returns: {
          out_brand: string
          out_canon_key: string
          out_energy: string
          out_id: number
          out_model_name: string
          out_rank: number
          out_search_volume: number
          out_type_id: string
          out_v_level: string
          out_v2_repetitions: number
          out_variant_name: string
          out_year_from: string
          out_year_to: string
        }[]
      }
      get_vlevel_dashboard: {
        Args: { p_limit?: number; p_offset?: number; p_pg_id: number }
        Returns: {
          best_rank: number
          energy: string
          engine: string
          fuel: string
          generation: string
          keyword: string
          keyword_id: number
          marque_name: string
          modele_name: string
          power_hp: string
          type_id: number
          v_level: string
          v2_repetitions: number
          vehicle_label: string
          volume: number
          year_from: string
          year_to: string
        }[]
      }
      get_vlevel_data: { Args: { p_pg_id: number }; Returns: Json }
      get_vlevel_section_k_extras: {
        Args: { p_pg_id: number }
        Returns: {
          keyword: string
          keyword_id: number
          pg_id: number
          type_id: string
        }[]
      }
      get_vlevel_section_k_metrics: {
        Args: { p_pg_id?: number }
        Returns: {
          actual_v4: number
          catalog_valid: number
          covered_v2v3: number
          expected_v4: number
          extras: number
          gamme_name: string
          missing: number
          pg_id: number
          status: string
        }[]
      }
      get_vlevel_section_k_missing: {
        Args: { p_pg_id: number }
        Returns: {
          modele_name: string
          pg_id: number
          type_fuel: string
          type_id: string
          type_name: string
        }[]
      }
      get_zone_severity: {
        Args: { p_zone: string }
        Returns: {
          risk_level: number
          severity: string
        }[]
      }
      grant_breakglass: {
        Args: {
          p_granted_by: string
          p_hours?: number
          p_reason: string
          p_tables: string[]
          p_token: string
        }
        Returns: number
      }
      heartbeat_rebuild_job: {
        Args: { p_gamme_id: number; p_vehicle_id: number; p_worker_id: string }
        Returns: boolean
      }
      increment_cache_hit: { Args: { p_cache_id: string }; Returns: undefined }
      init_import_gates: { Args: { p_import_id: number }; Returns: undefined }
      is_import_running: { Args: never; Returns: boolean }
      is_quarantined: {
        Args: { p_entity_type: string; p_internal_id: number }
        Returns: Json
      }
      jsonb_object_keys_count: { Args: { p_json: Json }; Returns: number }
      kg_approve_node: {
        Args: { p_entity_id: string; p_notes?: string; p_reviewer: string }
        Returns: boolean
      }
      kg_auto_infer_outcomes: {
        Args: { p_days_threshold?: number }
        Returns: number
      }
      kg_calculate_adapted_interval: {
        Args: {
          p_is_aggressive?: boolean
          p_is_diesel?: boolean
          p_is_extreme?: boolean
          p_is_heavy_load?: boolean
          p_is_urban?: boolean
          p_rule_id: string
        }
        Returns: {
          adapted_km_interval: number
          adapted_month_interval: number
          applied_factors: Json
          base_km_interval: number
          base_month_interval: number
          rule_id: string
          rule_label: string
        }[]
      }
      kg_calculate_bayesian_weight: {
        Args: { p_edge_id: string; p_min_feedback?: number }
        Returns: {
          feedback_count: number
          negative_count: number
          new_confidence: number
          new_weight: number
          positive_count: number
        }[]
      }
      kg_calculate_confidence_score: {
        Args: {
          p_ctx_phase: string
          p_ctx_speed: string
          p_ctx_temp: string
          p_current_km: number
          p_engine_family_code: string
          p_has_dtc: boolean
          p_maintenance_records: Json
          p_observable_count: number
          p_vehicle_id: string
        }
        Returns: {
          confidence_explanation: string
          confidence_factors: Json
          confidence_level: string
          confidence_score: number
          improvement_tips: string[]
          missing_factors: string[]
        }[]
      }
      kg_calculate_risk_level: {
        Args: {
          p_current_km: number
          p_last_service_km?: number
          p_rule_id: string
        }
        Returns: {
          km_since_service: number
          km_until_next: number
          progress_percent: number
          risk_level: string
          risk_message: string
        }[]
      }
      kg_calculate_truth_label_reliability: {
        Args: { p_label_id: string }
        Returns: number
      }
      kg_calculate_weight_with_truth_labels: {
        Args: { p_edge_id: string; p_min_labels?: number }
        Returns: {
          avg_reliability: number
          confirmed_count: number
          new_confidence: number
          new_weight: number
          rejected_count: number
          should_update: boolean
          truth_label_count: number
        }[]
      }
      kg_check_safety_gate: {
        Args: { p_observable_ids: string[] }
        Returns: {
          block_sales: boolean
          can_continue_driving: boolean
          emergency_contact: string
          has_safety_concern: boolean
          highest_gate: string
          recommended_action: string
          safety_message: string
          show_emergency_contact: boolean
          triggered_observables: Json
        }[]
      }
      kg_deprecate_node: {
        Args: { p_deprecated_by: string; p_entity_id: string; p_reason: string }
        Returns: boolean
      }
      kg_diagnose_by_labels: {
        Args: {
          p_confidence_threshold?: number
          p_engine_family_code?: string
          p_limit?: number
          p_observable_labels: string[]
        }
        Returns: Database["public"]["CompositeTypes"]["kg_diagnosis_result"][]
        SetofOptions: {
          from: "*"
          to: "kg_diagnosis_result"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      kg_diagnose_contextual: {
        Args: {
          p_confidence_threshold?: number
          p_ctx_phase?: string
          p_ctx_speed?: string
          p_ctx_temp?: string
          p_engine_family_code?: string
          p_limit?: number
          p_observable_labels: string[]
        }
        Returns: Database["public"]["CompositeTypes"]["kg_diagnosis_result"][]
        SetofOptions: {
          from: "*"
          to: "kg_diagnosis_result"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      kg_diagnose_vehicle_aware: {
        Args: {
          p_confidence_threshold?: number
          p_engine_family_code?: string
          p_limit?: number
          p_observable_ids: string[]
          p_vehicle_id?: string
        }
        Returns: Database["public"]["CompositeTypes"]["kg_diagnosis_result"][]
        SetofOptions: {
          from: "*"
          to: "kg_diagnosis_result"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      kg_diagnose_with_explainable_score: {
        Args: {
          p_ctx_phase?: string
          p_ctx_speed?: string
          p_ctx_temp?: string
          p_current_km?: number
          p_engine_family_code?: string
          p_last_maintenance_records?: Json
          p_limit?: number
          p_observable_ids: string[]
          p_vehicle_id?: string
        }
        Returns: {
          confidence_explanation: string
          confidence_factors: Json
          confidence_level: string
          confidence_score: number
          diagnostic_timestamp: string
          engine_family_boost: number
          fault_family: string
          fault_id: string
          fault_label: string
          improvement_tips: string[]
          is_vehicle_specific: boolean
          matched_observable_labels: string[]
          matched_observables: number
          missing_factors: string[]
          probability_level: string
          probability_score: number
          raw_score: number
          recommended_actions: Json
          total_observables: number
        }[]
      }
      kg_diagnose_with_safety: {
        Args: {
          p_current_km?: number
          p_engine_family_code?: string
          p_observable_ids: string[]
          p_skip_diagnosis_if_critical?: boolean
          p_vehicle_id?: string
        }
        Returns: Json
      }
      kg_explain_diagnosis_result: {
        Args: { p_diagnosis_result: Json }
        Returns: Json
      }
      kg_find_actions_for_fault: {
        Args: { p_fault_id: string }
        Returns: {
          action_category: string
          action_label: string
          action_node_id: string
          edge_confidence: number
        }[]
      }
      kg_find_faults_from_observables: {
        Args: { p_observable_ids: string[] }
        Returns: {
          edge_confidence: number
          edge_weight: number
          fault_category: string
          fault_id: string
          fault_label: string
          source_observable_id: string
          sources: string[]
        }[]
      }
      kg_find_parts_for_fault: {
        Args: { p_fault_id: string }
        Returns: {
          edge_confidence: number
          gamme_id: string
          part_label: string
          part_node_id: string
          piece_id: string
        }[]
      }
      kg_generate_batch_explanations: {
        Args: {
          p_ctx_phase?: string
          p_ctx_speed?: string
          p_ctx_temp?: string
          p_fault_ids: string[]
          p_matched_observable_ids: string[]
        }
        Returns: Json
      }
      kg_generate_explainable_diagnostic: {
        Args: {
          p_ctx_phase?: string
          p_ctx_speed?: string
          p_ctx_temp?: string
          p_fault_id: string
          p_matched_observable_ids: string[]
        }
        Returns: Json
      }
      kg_get_edge_type_weight_multiplier: {
        Args: { p_edge_type: string }
        Returns: number
      }
      kg_get_input_type_confidence: {
        Args: { p_input_type: string }
        Returns: number
      }
      kg_get_learning_stats: {
        Args: never
        Returns: {
          accuracy_rate: number
          confirmed_cases: number
          pending_cases: number
          rejected_cases: number
          total_cases: number
        }[]
      }
      kg_get_vehicle_maintenance_schedule: {
        Args: {
          p_current_km: number
          p_engine_family_code: string
          p_last_maintenance_date?: string
          p_last_maintenance_km?: number
          p_vehicle_age_months?: number
        }
        Returns: Database["public"]["CompositeTypes"]["kg_maintenance_item"][]
        SetofOptions: {
          from: "*"
          to: "kg_maintenance_item"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      kg_get_vehicle_recalls: {
        Args: { p_engine_family_code: string }
        Returns: Database["public"]["CompositeTypes"]["kg_recall_item"][]
        SetofOptions: {
          from: "*"
          to: "kg_recall_item"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      kg_quality_report: {
        Args: never
        Returns: {
          active_nodes: number
          deprecated_nodes: number
          pending_review: number
          rejected_nodes: number
          total_nodes: number
        }[]
      }
      kg_rag_file_needs_sync: {
        Args: { p_file_hash: string; p_file_path: string }
        Returns: boolean
      }
      kg_rag_get_node_id: {
        Args: { p_file_path: string; p_item_id: string }
        Returns: string
      }
      kg_rag_record_sync: {
        Args: {
          p_affected_edge_ids?: string[]
          p_affected_node_ids?: string[]
          p_category: string
          p_duration_ms?: number
          p_edges_created?: number
          p_edges_updated?: number
          p_errors_count?: number
          p_errors_detail?: Json
          p_file_hash: string
          p_file_path: string
          p_nodes_created?: number
          p_nodes_updated?: number
        }
        Returns: string
      }
      kg_rag_upsert_mapping: {
        Args: {
          p_file_path: string
          p_item_id: string
          p_item_type: string
          p_kg_node_id: string
        }
        Returns: string
      }
      kg_record_case: {
        Args: {
          p_observable_ids: string[]
          p_predicted_fault_id: string
          p_predicted_score: number
          p_session_id?: string
          p_user_id?: string
          p_vehicle_context?: Json
        }
        Returns: string
      }
      kg_record_feedback: {
        Args: {
          p_diagnosis_cache_id?: string
          p_edge_id?: string
          p_event_type: string
          p_fault_id?: string
          p_feedback_data?: Json
          p_feedback_source: string
          p_observable_ids?: string[]
          p_session_id?: string
          p_user_id?: string
        }
        Returns: string
      }
      kg_record_outcome: {
        Args: {
          p_actual_fault_id?: string
          p_case_id: string
          p_feedback_source?: string
          p_outcome_status: string
        }
        Returns: boolean
      }
      kg_record_truth_label: {
        Args: {
          p_confirmation_date?: string
          p_confirmation_km?: number
          p_confirmation_method: string
          p_diagnosis_cache_id: string
          p_edge_ids: string[]
          p_evidence_data?: Json
          p_fault_id: string
          p_notes?: string
          p_order_id?: string
          p_outcome_confirmed: boolean
          p_replaced_part_pg_id?: number
          p_submitted_by?: string
          p_submitted_by_user_id?: string
          p_verification_quality?: string
        }
        Returns: string
      }
      kg_reject_node: {
        Args: { p_entity_id: string; p_notes: string; p_reviewer: string }
        Returns: boolean
      }
      kg_submit_for_review: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_submitted_by: string
        }
        Returns: string
      }
      list_active_breakglass: {
        Args: never
        Returns: {
          expires_at: string
          granted_at: string
          granted_by: string
          id: number
          reason: string
          tables_allowed: string[]
          time_remaining: unknown
        }[]
      }
      log_pipeline_event: {
        Args: { p_batch_id: number; p_context?: Json; p_step: string }
        Returns: number
      }
      log_seo_audit: {
        Args: {
          p_action?: string
          p_after?: Json
          p_before?: Json
          p_context?: Json
          p_field?: string
          p_log_type: string
          p_record_id: string
          p_rules_triggered?: string[]
          p_score_after?: number
          p_score_before?: number
          p_table_name: string
        }
        Returns: number
      }
      log_seo_quality_check: {
        Args: {
          p_after: string
          p_before: string
          p_created_by?: string
          p_field: string
          p_record_id: string
          p_rules: Json
          p_score_after: number
          p_score_before: number
          p_table: string
        }
        Returns: number
      }
      log_sitemap_generation: {
        Args: {
          p_bucket: string
          p_duration_ms?: number
          p_error?: string
          p_files_generated?: number
          p_run_id: string
          p_status: string
          p_urls_total?: number
        }
        Returns: undefined
      }
      map_facets_to_filter_keys: {
        Args: { p_enabled_facets: Json }
        Returns: string[]
      }
      match_keyword_to_type: {
        Args: {
          p_energy: string
          p_keyword?: string
          p_model: string
          p_variant: string
        }
        Returns: {
          confidence: number
          type_id: number
        }[]
      }
      match_keywords_batch: {
        Args: { p_pg_id: number }
        Returns: {
          confidence: number
          energy: string
          keyword: string
          keyword_id: number
          model: string
          type_id: number
          variant: string
          volume: number
        }[]
      }
      match_keywords_batch_clean: {
        Args: { p_pg_id: number }
        Returns: {
          confidence: number
          energy: string
          keyword: string
          keyword_id: number
          model: string
          type_id: number
          variant: string
          volume: number
        }[]
      }
      merge_staging_brands: { Args: { p_import_id: number }; Returns: number }
      migrate_psf_plaquettes: { Args: never; Returns: number }
      move_decisions_to_quarantine: {
        Args: { p_batch_id: number }
        Returns: Json
      }
      normalize_batch_brands: { Args: { p_batch_id: number }; Returns: Json }
      normalize_brand_name: { Args: { p_name: string }; Returns: string }
      populate_golden_set: { Args: { p_limit?: number }; Returns: Json }
      populate_search_vector_batch: { Args: never; Returns: undefined }
      populate_search_vector_small_batch: {
        Args: { batch_size?: number; start_id: number }
        Returns: number
      }
      prepare_shadow_tables: {
        Args: { p_batch_id: number; p_entity_type: string }
        Returns: Json
      }
      process_prix_pas_cher: {
        Args: { p_text: string; p_type_id: number }
        Returns: string
      }
      process_seo_switch: {
        Args: {
          p_marker: string
          p_offset?: number
          p_switches: Json
          p_text: string
          p_type_id: number
        }
        Returns: string
      }
      process_seo_template: {
        Args: {
          p_marque_alias: string
          p_marque_id: number
          p_marque_name: string
          p_mf_id: number
          p_modele_alias: string
          p_modele_id: number
          p_modele_name: string
          p_pg_id: number
          p_template: string
          p_type_alias: string
          p_type_id: number
          p_type_name: string
          p_type_power_ps: string
        }
        Returns: string
      }
      propagate_vlevel_per_typeid: {
        Args: { p_pg_id: number }
        Returns: {
          updated: number
        }[]
      }
      purge_seo_interpolation_alerts: {
        Args: { days_to_keep?: number }
        Returns: number
      }
      rag_best_truth: { Args: { levels: string[] }; Returns: string }
      rag_is_section: { Args: { src: string }; Returns: boolean }
      rag_parent_source: { Args: { src: string }; Returns: string }
      refresh_gamme_aggregates: {
        Args: { p_pg_id?: number }
        Returns: {
          out_content_words_total: number
          out_execution_status: string
          out_final_priority: string
          out_pg_id: number
          out_priority_score: number
          out_products_total: number
          out_status: string
          out_vehicles_total: number
        }[]
      }
      refresh_temperature_scores: { Args: never; Returns: number }
      release_import_lock: { Args: never; Returns: undefined }
      resolve_batch_brands: {
        Args: { p_batch_id: number; p_source_system?: string }
        Returns: Json
      }
      resolve_brand_multilevel: {
        Args: {
          p_batch_id: number
          p_brand_name: string
          p_source_key: string
          p_source_system: string
        }
        Returns: Json
      }
      resolve_quarantine_item: {
        Args: {
          p_action: string
          p_notes?: string
          p_q_id: number
          p_reviewed_by: string
          p_target_internal_id?: number
        }
        Returns: Json
      }
      revoke_breakglass: {
        Args: { p_id: number; p_revoked_by: string }
        Returns: boolean
      }
      rm_get_listing_page: {
        Args: {
          p_filters?: Json
          p_gamme_id: number
          p_page?: number
          p_per_page?: number
          p_sort?: string
          p_vehicle_id: number
        }
        Returns: Json
      }
      rm_get_page_complete: {
        Args: { p_gamme_id: number; p_limit?: number; p_vehicle_id: number }
        Returns: Json
      }
      rm_get_page_complete_v2: {
        Args: { p_gamme_id: number; p_limit?: number; p_vehicle_id: number }
        Returns: Json
      }
      rm_health: { Args: never; Returns: Json }
      rollback_switch: { Args: { p_entity_type: string }; Returns: Json }
      run_import_pipeline: {
        Args: { p_batch_id: number; p_skip_gates?: boolean }
        Returns: Json
      }
      search_pieces_fts: {
        Args: { search_term: string }
        Returns: {
          piece_des: string | null
          piece_display: boolean
          piece_fil_id: number
          piece_fil_name: string | null
          piece_ga_id: number
          piece_has_img: boolean
          piece_has_oem: boolean
          piece_id: number
          piece_name: string | null
          piece_name_comp: string | null
          piece_name_side: string | null
          piece_pg_id: number
          piece_pg_pid: number
          piece_pm_id: number
          piece_psf_id: number
          piece_qty_pack: number
          piece_qty_sale: number
          piece_ref: string
          piece_ref_clean: string
          piece_sort: number
          piece_update: boolean
          piece_weight_kgm: number
          piece_year: number
          search_vector: unknown
        }[]
        SetofOptions: {
          from: "*"
          to: "pieces"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      search_pieces_hybrid: {
        Args: { result_limit?: number; search_term: string }
        Returns: {
          piece_des: string
          piece_display: boolean
          piece_fil_name: string
          piece_has_img: boolean
          piece_id: number
          piece_name: string
          piece_ref: string
          piece_year: number
          search_method: string
          search_score: number
        }[]
      }
      search_rag_knowledge: {
        Args: {
          p_domain?: string
          p_limit?: number
          p_min_truth_level?: string
          p_query: string
        }
        Returns: {
          content: string
          domain: string
          id: string
          rank: number
          source: string
          title: string
          truth_level: string
        }[]
      }
      search_seo_observable_by_dtc: {
        Args: { p_dtc_code: string }
        Returns: {
          action_ids: string[] | null
          canonical_url: string | null
          cluster_id: string | null
          created_at: string | null
          created_by: string | null
          ctx_freq: string | null
          ctx_load: string[] | null
          ctx_phase: string[] | null
          ctx_road: string[] | null
          ctx_speed: string[] | null
          ctx_temp: string[] | null
          dtc_codes: string[] | null
          dtc_descriptions: Json | null
          estimated_repair_cost_max: number | null
          estimated_repair_cost_min: number | null
          estimated_repair_duration: string | null
          fault_ids: string[] | null
          id: number
          is_published: boolean | null
          kg_observable_ids: string[] | null
          meta_description: string | null
          observable_type: string | null
          page_role: Database["public"]["Enums"]["seo_page_role"] | null
          perception_channel: string | null
          priority: number | null
          publish_date: string | null
          recommended_actions: Json | null
          related_blog_articles: string[] | null
          related_gammes: number[] | null
          related_references: string[] | null
          risk_level: string | null
          safety_gate: string | null
          schema_org: Json | null
          sign_description: string | null
          slug: string
          symptom_description: string | null
          title: string
          updated_at: string | null
          updated_by: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "__seo_observable"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      switch_to_next: { Args: { p_entity_type: string }; Returns: Json }
      sync_sitemap_p_link_to_seo_page: { Args: never; Returns: number }
      table_exists: {
        Args: { schema_name: string; table_name: string }
        Returns: boolean
      }
      test_pieces_relation_access: {
        Args: { p_type_id: number }
        Returns: {
          sample_relations: Json
          total_relations: number
        }[]
      }
      unaccent: { Args: { "": string }; Returns: string }
      update_batch_contract: {
        Args: {
          p_contract_id: number
          p_received_count?: number
          p_rejected_count?: number
          p_validated_count?: number
        }
        Returns: Json
      }
      upsert_catalog_mapping: {
        Args: {
          p_automecanik_id: number
          p_entity_type: string
          p_external_id: string
          p_source?: string
          p_version?: string
        }
        Returns: number
      }
      validate_content_full: {
        Args: {
          p_content: string
          p_context: string
          p_famille: string
          p_pg_id: number
        }
        Returns: Json
      }
      validate_lexique_allumage: {
        Args: { p_content: string; p_context?: string; p_pg_id: number }
        Returns: Json
      }
      validate_lexique_amortisseur: {
        Args: { p_content: string; p_context?: string; p_pg_id: number }
        Returns: Json
      }
      validate_lexique_direction: {
        Args: { p_content: string; p_context?: string; p_pg_id: number }
        Returns: Json
      }
      validate_lexique_embrayage: {
        Args: { p_content: string; p_context?: string; p_pg_id: number }
        Returns: Json
      }
      validate_lexique_entrainement: {
        Args: { p_content: string; p_pg_id: number; p_zone?: string }
        Returns: Json
      }
      validate_lexique_freinage: {
        Args: { p_content: string; p_pg_id: number; p_zone?: string }
        Returns: Json
      }
      validate_lexique_support_moteur: {
        Args: { p_content: string; p_context?: string; p_pg_id: number }
        Returns: Json
      }
      validate_seo_content: {
        Args: {
          p_content: Json
          p_context?: string
          p_family?: string
          p_pg_id?: number
          p_piece_id?: string
        }
        Returns: Json
      }
      validate_shadow: {
        Args: { p_batch_id: number; p_entity_type: string }
        Returns: Json
      }
      validate_staging_brands: {
        Args: { p_import_id: number }
        Returns: number
      }
    }
    Enums: {
      kg_risk_level: "low" | "medium" | "high" | "critical"
      rm_build_status_enum: "PENDING" | "READY" | "PARTIAL" | "FAILED" | "EMPTY"
      rm_quality_enum: "OE" | "EQUIV" | "ECO"
      rm_rebuild_status_enum: "PENDING" | "PROCESSING" | "DONE" | "FAILED"
      rm_stock_status_enum:
        | "IN_STOCK"
        | "LOW_STOCK"
        | "OUT_OF_STOCK"
        | "PREORDER"
      seo_page_role: "R1" | "R2" | "R3" | "R4" | "R5" | "R6"
    }
    CompositeTypes: {
      kg_diagnosis_result: {
        fault_id: string | null
        fault_label: string | null
        fault_family: string | null
        score: number | null
        confidence: number | null
        matched_observables: number | null
        is_vehicle_specific: boolean | null
        engine_family_boost: number | null
        root_causes: Json | null
        parts: Json | null
        actions: Json | null
      }
      kg_maintenance_item: {
        maintenance_id: string | null
        label: string | null
        category: string | null
        priority: string | null
        status: string | null
        km_interval: number | null
        month_interval: number | null
        km_since_last: number | null
        months_since_last: number | null
        km_remaining: number | null
        months_remaining: number | null
        due_at_km: number | null
        due_at_date: string | null
        estimated_cost_min: number | null
        estimated_cost_max: number | null
        operations: Json | null
        related_parts: Json | null
      }
      kg_recall_item: {
        recall_id: string | null
        recall_code: string | null
        label: string | null
        severity: string | null
        start_date: string | null
        end_date: string | null
        description: string | null
        affected_fault: string | null
        fix_parts: Json | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      kg_risk_level: ["low", "medium", "high", "critical"],
      rm_build_status_enum: ["PENDING", "READY", "PARTIAL", "FAILED", "EMPTY"],
      rm_quality_enum: ["OE", "EQUIV", "ECO"],
      rm_rebuild_status_enum: ["PENDING", "PROCESSING", "DONE", "FAILED"],
      rm_stock_status_enum: [
        "IN_STOCK",
        "LOW_STOCK",
        "OUT_OF_STOCK",
        "PREORDER",
      ],
      seo_page_role: ["R1", "R2", "R3", "R4", "R5", "R6"],
    },
  },
} as const
