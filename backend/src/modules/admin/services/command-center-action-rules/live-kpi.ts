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

/**
 * Un indicateur mesuré + sa valeur sur la fenêtre précédente de même durée.
 * Alimente le rapport de département (Vue 5, champ « Évolution ») sans rien
 * persister : la fenêtre précédente est relue en base à chaque requête.
 * `previous_value` null = pas de comparaison possible (lecture en échec), jamais 0.
 */
export interface LiveKpiMeasure {
  kpi: LiveExecutiveKpi;
  window_days: number;
  previous_value: number | null;
  /** Sens d'amélioration : `higher` = une hausse de `value` est un progrès. */
  better: 'higher' | 'lower';
}
