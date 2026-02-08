/**
 * Service de monitoring pour la production
 * Collecte et envoie les métriques vers les endpoints configurés
 */

import {
  getMonitoringConfig,
  MonitoringUtils,
  type AnalyticsEvent,
  type PerformanceMetric,
  type ABTestResult,
  type AIInsight,
} from "../config/monitoring";
import { logger } from "~/utils/logger";

class MonitoringService {
  private config = getMonitoringConfig();
  private eventQueue: AnalyticsEvent[] = [];
  private metricsQueue: PerformanceMetric[] = [];
  private batchSize = 10;
  private flushInterval = 30000; // 30 secondes
  private sessionId = MonitoringUtils.generateSessionId();

  constructor() {
    this.initializeMonitoring();
  }

  private initializeMonitoring() {
    // Démarrer le flush périodique
    setInterval(() => this.flush(), this.flushInterval);

    // Observer les Web Vitals si activés
    if (this.config.metrics.webVitals.enabled) {
      this.initializeWebVitals();
    }

    // Observer les erreurs JavaScript
    if (this.config.metrics.errors.jsErrors) {
      this.initializeErrorTracking();
    }

    // Observer les erreurs API
    if (this.config.metrics.errors.apiErrors) {
      this.initializeApiErrorTracking();
    }
  }

  private initializeWebVitals() {
    // Observer Largest Contentful Paint (LCP)
    if ("PerformanceObserver" in window) {
      new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (entry.entryType === "largest-contentful-paint") {
            this.recordPerformanceMetric("lcp", entry.startTime);
          }
        }
      }).observe({ entryTypes: ["largest-contentful-paint"] });

      // Observer First Input Delay (FID)
      new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (entry.entryType === "first-input") {
            this.recordPerformanceMetric(
              "fid",
              (entry as any).processingStart - entry.startTime,
            );
          }
        }
      }).observe({ entryTypes: ["first-input"] });

      // Observer Cumulative Layout Shift (CLS)
      let clsScore = 0;
      new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          // Type guard for hadRecentInput property
          if ("hadRecentInput" in entry && !(entry as any).hadRecentInput) {
            clsScore += (entry as any).value;
          }
        }
        this.recordPerformanceMetric("cls", clsScore);
      }).observe({ entryTypes: ["layout-shift"] });
    }

    // Navigation timing
    window.addEventListener("load", () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType(
          "navigation",
        )[0] as PerformanceNavigationTiming;
        if (navigation && "navigationStart" in navigation) {
          this.recordPerformanceMetric(
            "ttfb",
            navigation.responseStart - navigation.requestStart,
          );
          this.recordPerformanceMetric(
            "fcp",
            navigation.responseEnd - navigation.requestStart,
          );
          this.recordPerformanceMetric(
            "load_time",
            navigation.loadEventEnd - (navigation as any).navigationStart,
          );
        }
      }, 0);
    });
  }

  private initializeErrorTracking() {
    window.addEventListener("error", (event) => {
      this.recordError({
        type: "javascript_error",
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
      });
    });

    window.addEventListener("unhandledrejection", (event) => {
      this.recordError({
        type: "unhandled_promise_rejection",
        message: event.reason?.toString() || "Unknown promise rejection",
        stack: event.reason?.stack,
      });
    });
  }

  private initializeApiErrorTracking() {
    // Intercepter les fetch requests
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const startTime = performance.now();
      try {
        const response = await originalFetch(...args);
        const endTime = performance.now();

        // Enregistrer les métriques API
        this.recordApiMetric({
          url: args[0]?.toString() || "",
          method: (args[1]?.method || "GET").toUpperCase(),
          status: response.status,
          duration: endTime - startTime,
          success: response.ok,
        });

        // Enregistrer les erreurs API
        if (!response.ok) {
          this.recordError({
            type: "api_error",
            message: `API Error: ${response.status} ${response.statusText}`,
            url: args[0]?.toString() || "",
            status: response.status,
          });
        }

        return response;
      } catch (error) {
        const endTime = performance.now();

        this.recordApiMetric({
          url: args[0]?.toString() || "",
          method: (args[1]?.method || "GET").toUpperCase(),
          status: 0,
          duration: endTime - startTime,
          success: false,
        });

        this.recordError({
          type: "api_network_error",
          message: error instanceof Error ? error.message : "Network error",
          url: args[0]?.toString() || "",
        });

        throw error;
      }
    };
  }

  // Méthodes publiques pour l'intégration avec les hooks
  public trackEvent(type: string, data: Record<string, any>) {
    if (!this.config.metrics.business.enabled) return;

    const event = MonitoringUtils.createEvent(type, {
      ...data,
      sessionId: this.sessionId,
    });

    this.eventQueue.push(event);

    // Flush si la queue est pleine
    if (this.eventQueue.length >= this.batchSize) {
      this.flush();
    }
  }

  public recordPerformanceMetric(name: string, value: number) {
    if (!this.config.metrics.webVitals.enabled) return;

    const metric = MonitoringUtils.createPerformanceMetric(name, value);
    this.metricsQueue.push(metric);

    // Vérifier les seuils d'alerte
    this.checkPerformanceThresholds(name, value);
  }

  private recordError(error: Record<string, any>) {
    if (!this.config.metrics.errors.enabled) return;

    this.trackEvent("error", {
      ...error,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    });
  }

  private recordApiMetric(metric: Record<string, any>) {
    this.recordPerformanceMetric(
      `api_${metric.method.toLowerCase()}_duration`,
      metric.duration,
    );

    this.trackEvent("api_call", {
      ...metric,
      timestamp: new Date().toISOString(),
    });
  }

  private checkPerformanceThresholds(name: string, value: number) {
    const thresholds = this.config.metrics.webVitals.thresholds;

    let threshold = 0;
    switch (name) {
      case "lcp":
        threshold = thresholds.lcp;
        break;
      case "fid":
        threshold = thresholds.fid;
        break;
      case "cls":
        threshold = thresholds.cls;
        break;
      case "fcp":
        threshold = thresholds.fcp;
        break;
      case "ttfb":
        threshold = thresholds.ttfb;
        break;
    }

    if (threshold > 0 && value > threshold) {
      this.trackEvent("performance_threshold_exceeded", {
        metric: name,
        value,
        threshold,
        severity: "warning",
      });
    }
  }

  // Méthodes pour A/B Testing
  public recordABTestResult(result: ABTestResult) {
    if (!this.config.abTesting.enabled) return;

    this.trackEvent("ab_test_result", result);
  }

  public recordAIInsight(insight: AIInsight) {
    if (!this.config.aiAssistant.enabled) return;

    this.trackEvent("ai_insight", insight);
  }

  // Flush des données vers les endpoints
  private async flush() {
    if (this.eventQueue.length === 0 && this.metricsQueue.length === 0) return;

    const batch = {
      events: [...this.eventQueue],
      metrics: [...this.metricsQueue],
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
    };

    // Vider les queues
    this.eventQueue = [];
    this.metricsQueue = [];

    // Envoyer vers l'API
    try {
      await this.sendToAPI(batch);
    } catch (error) {
      logger.warn("Monitoring: Erreur lors de l'envoi des métriques", error);
      // En cas d'erreur, on peut stocker localement ou réessayer
    }
  }

  private async sendToAPI(batch: any) {
    const { reporting } = this.config;

    // Envoyer les événements analytics
    if (batch.events.length > 0) {
      await fetch(reporting.analyticsEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "analytics_batch",
          events: batch.events,
          sessionId: batch.sessionId,
          timestamp: batch.timestamp,
        }),
      });
    }

    // Envoyer les métriques de performance
    if (batch.metrics.length > 0) {
      await fetch(reporting.performanceEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "performance_batch",
          metrics: batch.metrics,
          sessionId: batch.sessionId,
          timestamp: batch.timestamp,
        }),
      });
    }
  }

  // Méthodes utilitaires publiques
  public getSessionId(): string {
    return this.sessionId;
  }

  public getConfig() {
    return this.config;
  }

  public forceFlush(): Promise<void> {
    return this.flush();
  }

  // Méthode pour obtenir un résumé des métriques en temps réel
  public getRealTimeMetrics() {
    return {
      queueSizes: {
        events: this.eventQueue.length,
        metrics: this.metricsQueue.length,
      },
      session: {
        id: this.sessionId,
        startTime: new Date().toISOString(),
      },
      config: {
        enabled: {
          webVitals: this.config.metrics.webVitals.enabled,
          business: this.config.metrics.business.enabled,
          errors: this.config.metrics.errors.enabled,
          abTesting: this.config.abTesting.enabled,
          aiAssistant: this.config.aiAssistant.enabled,
        },
      },
    };
  }
}

// Instance singleton
let monitoringInstance: MonitoringService | null = null;

export function getMonitoringService(): MonitoringService {
  if (!monitoringInstance && typeof window !== "undefined") {
    monitoringInstance = new MonitoringService();
  }
  return monitoringInstance!;
}

// Export des méthodes pour utilisation directe
export function trackEvent(type: string, data: Record<string, any>) {
  getMonitoringService()?.trackEvent(type, data);
}

export function recordPerformanceMetric(name: string, value: number) {
  getMonitoringService()?.recordPerformanceMetric(name, value);
}

export function recordABTestResult(result: ABTestResult) {
  getMonitoringService()?.recordABTestResult(result);
}

export function recordAIInsight(insight: AIInsight) {
  getMonitoringService()?.recordAIInsight(insight);
}

export default MonitoringService;
