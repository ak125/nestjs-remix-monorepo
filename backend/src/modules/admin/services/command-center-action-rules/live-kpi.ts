/**
 * Forme des indicateurs mesurés du Command Center. Vit à côté des règles pures :
 * les règles (department-kpi, department-report) en dépendent, le service qui lit
 * la base aussi — jamais une règle n'importe le service.
 */
/** Forme d'un indicateur exécutif — miroir de CcExecutiveKpiSchema (@repo/registry). */
export interface LiveExecutiveKpi {
  id: string;
  label: string;
  value: number | null;
  unit?: string;
  status: 'OK' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';
  source: 'db';
  certified: boolean;
}

/** Cause interne de lecture, sans message brut de la source. */
export type KpiReadFailure =
  | 'read_failed'
  | 'access_denied'
  | 'incomplete'
  | 'completeness_unverified';

/**
 * Un indicateur mesuré + sa valeur sur la fenêtre précédente de même durée.
 * Alimente le rapport de département (Vue 5, champ « Évolution ») sans rien
 * persister : la fenêtre précédente est relue en base à chaque requête.
 * `previous_value` null = pas de comparaison possible (lecture en échec ou
 * échantillon précédent vide), jamais un zéro supposé.
 */
export interface LiveKpiMeasure {
  kpi: LiveExecutiveKpi;
  window_days: number;
  previous_value: number | null;
  /** Sessions exploitables du Diagnostic ; absent si la lecture est impossible.
   * Interne au calcul du rapport : zéro ne permet pas d'évaluer la performance.
   */
  sample_size?: number;
  /** Causes propres à chaque fenêtre ; projetées en texte sûr par le rapport. */
  read_failure?: KpiReadFailure;
  previous_read_failure?: KpiReadFailure;
  /** Sens d'amélioration : `higher` = une hausse de `value` est un progrès. */
  better: 'higher' | 'lower';
  /**
   * Constat lu en base sur la fenêtre courante qui éclaire la valeur (ex. motifs
   * saisis à l'annulation), jamais une cause déduite. Absent = rien à constater.
   * Le rapport le reprend tel quel et il part dans le digest Hermes : texte
   * borné et filtré par son producteur.
   */
  observed_cause?: string;
}
