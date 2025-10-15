export interface ErrorLog {
  // Utilise la structure de ___xtr_msg pour les logs d'erreur
  msg_id?: string;
  msg_cst_id?: string; // Client concerné (optionnel)
  msg_cnfa_id?: string; // Staff assigné pour résolution
  msg_ord_id?: string; // Commande liée (optionnel)
  msg_date: Date; // Date de l'erreur
  msg_subject: string; // Code d'erreur ou résumé
  msg_content: string; // Détails de l'erreur (JSON stringifié)
  msg_parent_id?: string; // Pour les erreurs liées
  msg_open: string; // '1' = non résolu, '0' = résolu
  msg_close: string; // '1' = fermé, '0' = ouvert

  // Métadonnées supplémentaires stockées dans msg_content (JSON)
  errorMetadata?: {
    error_code: string;
    error_message: string;
    stack_trace?: string;
    user_agent?: string;
    ip_address?: string;
    request_url?: string;
    request_method?: string;
    request_body?: Record<string, any>;
    request_headers?: Record<string, any>;
    response_status?: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    environment: string;
    service_name: string;
    resolved_by?: string;
    resolved_at?: Date;
    tags?: string[];
    correlation_id?: string;
    session_id?: string;
    additional_context?: Record<string, any>;
  };
}

export interface RedirectRule {
  // Utilise la structure de ___xtr_msg avec msg_subject = 'REDIRECT_RULE'
  msg_id?: string;
  msg_cst_id?: string; // Toujours null pour les redirections
  msg_cnfa_id?: string; // Staff qui a créé la règle
  msg_ord_id?: string; // Toujours null pour les redirections
  msg_date: Date; // Date de création de la règle
  msg_subject: string; // 'REDIRECT_RULE' pour identifier les redirections
  msg_content: string; // Configuration JSON de la redirection
  msg_parent_id?: string; // Pour grouper les règles liées
  msg_open: string; // '1' = actif, '0' = inactif
  msg_close: string; // '1' = règle fermée/archivée, '0' = en service

  // Métadonnées de redirection stockées dans msg_content (JSON)
  redirectMetadata: {
    source_path: string;
    destination_path: string;
    status_code: number; // 301, 302, 307, 308
    is_active: boolean;
    is_regex: boolean;
    priority: number;
    description?: string;
    hit_count?: number;
    last_hit?: Date;
    created_by?: string;
    updated_by?: string;
  };
}

export interface ErrorReport {
  error_id: string;
  error_summary: string;
  total_occurrences: number;
  first_occurrence: Date;
  last_occurrence: Date;
  affected_users: number;
  severity: string;
  status: 'open' | 'investigating' | 'resolved' | 'ignored';
}

export interface ErrorMetrics {
  total_errors: number;
  errors_by_severity: Record<string, number>;
  errors_by_service: Record<string, number>;
  error_rate_24h: number;
  most_common_errors: Array<{
    code: string;
    message: string;
    count: number;
  }>;
}
