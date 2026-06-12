/**
 * Web Vitals metrics — types + bornes Zod-ready.
 *
 * Mirror strict de `.spec/00-canon/seo-runtime/cwv-taxonomy.yaml` §metrics.
 * Bornes runtime (min/max) enforcées au beacon controller via Zod.
 */

export const METRIC_NAME_VALUES = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'] as const;
export type MetricName = (typeof METRIC_NAME_VALUES)[number];

export const DEVICE_TYPE_VALUES = ['mobile', 'desktop', 'tablet', 'unknown'] as const;
export type DeviceType = (typeof DEVICE_TYPE_VALUES)[number];

export const NAV_TYPE_VALUES = [
  'navigate',
  'reload',
  'back_forward',
  'prerender',
  'restore',
  'unknown',
] as const;
export type NavType = (typeof NAV_TYPE_VALUES)[number];

export interface MetricBounds {
  unit: 'ms' | 'ratio';
  min: number;
  max: number;
  good_threshold: number;
  poor_threshold: number;
}

export const METRIC_BOUNDS: Readonly<Record<MetricName, MetricBounds>> = Object.freeze({
  LCP: { unit: 'ms', min: 0, max: 60000, good_threshold: 2500, poor_threshold: 4000 },
  INP: { unit: 'ms', min: 0, max: 60000, good_threshold: 200, poor_threshold: 500 },
  CLS: { unit: 'ratio', min: 0, max: 5, good_threshold: 0.1, poor_threshold: 0.25 },
  FCP: { unit: 'ms', min: 0, max: 60000, good_threshold: 1800, poor_threshold: 3000 },
  TTFB: { unit: 'ms', min: 0, max: 60000, good_threshold: 800, poor_threshold: 1800 },
});

export function isMetricName(value: unknown): value is MetricName {
  return (
    typeof value === 'string' && (METRIC_NAME_VALUES as readonly string[]).includes(value)
  );
}

export function isDeviceType(value: unknown): value is DeviceType {
  return (
    typeof value === 'string' && (DEVICE_TYPE_VALUES as readonly string[]).includes(value)
  );
}

export function isNavType(value: unknown): value is NavType {
  return (
    typeof value === 'string' && (NAV_TYPE_VALUES as readonly string[]).includes(value)
  );
}

/** Rating tier per Web Vitals lib spec — based on metric thresholds. */
export type MetricRating = 'good' | 'needs-improvement' | 'poor';

export function rateMetric(name: MetricName, value: number): MetricRating {
  const b = METRIC_BOUNDS[name];
  if (value <= b.good_threshold) return 'good';
  if (value <= b.poor_threshold) return 'needs-improvement';
  return 'poor';
}
