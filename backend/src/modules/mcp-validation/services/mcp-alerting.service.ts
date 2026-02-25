/**
 * MCP Alerting Service - Phase 2: High-Severity Alert Handler
 *
 * Handles alerting for MCP validation mismatches and critical issues.
 * Supports multiple channels: database, webhook, console.
 *
 * Principle: L'IA NE CREE PAS LA VERITE (AI-COS Axiome Zero)
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  McpMismatchAlert,
  McpAlertSeverity,
  McpAlertChannel,
  McpAlertingConfig,
} from '../types/mcp-verify.types';
import {
  ExternalServiceException,
  ErrorCodes,
} from '../../../common/exceptions';

@Injectable()
export class McpAlertingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(McpAlertingService.name);
  private supabase: SupabaseClient | null = null;

  // Rate limiting
  private alertCounts = new Map<string, { count: number; resetAt: number }>();
  private readonly rateLimitWindow = 60 * 1000; // 1 minute
  private readonly maxAlertsPerWindow = 10;

  // Alert buffer for aggregation
  private alertBuffer: McpMismatchAlert[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private readonly flushInterval = 30 * 1000; // 30 seconds
  private readonly maxBufferSize = 50;

  // Configuration
  private config: McpAlertingConfig = {
    channels: [
      { type: 'database', enabled: true },
      { type: 'console', enabled: true },
    ],
    minSeverity: 'warning',
    rateLimit: 10,
    aggregationWindow: 30,
  };

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
      this.logger.log('MCP Alerting Service initialized with Supabase');
    } else {
      this.logger.warn(
        'Supabase not configured - alerts will only go to console',
      );
    }

    // Load webhook configuration if available
    const webhookUrl = this.configService.get<string>('MCP_ALERT_WEBHOOK_URL');
    if (webhookUrl) {
      this.config.channels.push({
        type: 'webhook',
        enabled: true,
        config: { webhookUrl },
      });
      this.logger.log('Webhook alerting enabled');
    }

    // Start periodic flush
    this.flushTimer = setInterval(() => {
      this.flushAlertBuffer();
    }, this.flushInterval);
  }

  /**
   * Main alert method
   */
  async alert(alert: McpMismatchAlert): Promise<void> {
    // Check severity threshold
    if (!this.meetsMinSeverity(alert.severity)) {
      this.logger.debug(`Alert below minimum severity: ${alert.severity}`);
      return;
    }

    // Check rate limit
    if (!this.checkRateLimit(alert.endpoint)) {
      this.logger.warn(`Rate limit exceeded for ${alert.endpoint}`);
      return;
    }

    // Add to buffer
    this.alertBuffer.push(alert);

    // Immediate flush for critical alerts
    if (alert.severity === 'critical' || alert.blocked) {
      await this.flushAlertBuffer();
    } else if (this.alertBuffer.length >= this.maxBufferSize) {
      // Flush if buffer is full
      await this.flushAlertBuffer();
    }
  }

  /**
   * Flush buffered alerts to all channels
   */
  private async flushAlertBuffer(): Promise<void> {
    if (this.alertBuffer.length === 0) return;

    const alerts = [...this.alertBuffer];
    this.alertBuffer = [];

    // Send to each enabled channel
    for (const channel of this.config.channels) {
      if (!channel.enabled) continue;

      try {
        switch (channel.type) {
          case 'database':
            await this.sendToDatabase(alerts);
            break;
          case 'webhook':
            await this.sendToWebhook(alerts, channel);
            break;
          case 'console':
            this.sendToConsole(alerts);
            break;
        }
      } catch (error) {
        this.logger.error(
          `Failed to send alerts to ${channel.type}: ${(error as Error).message}`,
        );
      }
    }
  }

  /**
   * Send alerts to database
   */
  private async sendToDatabase(alerts: McpMismatchAlert[]): Promise<void> {
    if (!this.supabase) return;

    const records = alerts.map((alert) => ({
      request_id: alert.requestId,
      endpoint: alert.endpoint,
      data_type: alert.dataType,
      validation_mode: 'verification',
      match_status: alert.blocked ? 'blocked' : 'mismatch',
      confidence_score: null,
      latency_total_ms: 0,
      error_message: alert.discrepancy
        .map((d) => `${d.field}: ${d.severity}`)
        .join('; '),
      created_at: alert.timestamp,
    }));

    const { error } = await this.supabase
      .from('mcp_validation_log')
      .insert(records);

    if (error) {
      this.logger.error(`Database alert insert failed: ${error.message}`);
    } else {
      this.logger.debug(`Logged ${records.length} alerts to database`);
    }
  }

  /**
   * Send alerts to webhook (Slack, Discord, etc.)
   */
  private async sendToWebhook(
    alerts: McpMismatchAlert[],
    channel: McpAlertChannel,
  ): Promise<void> {
    const webhookUrl = channel.config?.webhookUrl;
    if (!webhookUrl) return;

    // Filter by minimum severity for this channel
    const minSeverity = channel.config?.minSeverity || 'warning';
    const filteredAlerts = alerts.filter(
      (a) => this.severityLevel(a.severity) >= this.severityLevel(minSeverity),
    );

    if (filteredAlerts.length === 0) return;

    // Build webhook payload (Slack-compatible)
    const payload = this.buildWebhookPayload(filteredAlerts);

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new ExternalServiceException({
          code: ErrorCodes.EXTERNAL.SERVICE_ERROR,
          message: `Webhook returned ${response.status}`,
          serviceName: 'McpAlertingWebhook',
        });
      }

      this.logger.debug(`Sent ${filteredAlerts.length} alerts to webhook`);
    } catch (error) {
      throw new ExternalServiceException({
        code: ErrorCodes.EXTERNAL.SERVICE_ERROR,
        message: `Webhook request failed: ${(error as Error).message}`,
        serviceName: 'McpAlertingWebhook',
        details: (error as Error).message,
        cause: error as Error,
      });
    }
  }

  /**
   * Build webhook payload (Slack format)
   */
  private buildWebhookPayload(alerts: McpMismatchAlert[]): object {
    const criticalCount = alerts.filter(
      (a) => a.severity === 'critical',
    ).length;
    const blockedCount = alerts.filter((a) => a.blocked).length;

    const emoji = criticalCount > 0 ? ':rotating_light:' : ':warning:';
    const color = criticalCount > 0 ? 'danger' : 'warning';

    return {
      text: `${emoji} MCP Validation Alerts`,
      attachments: [
        {
          color,
          title: `${alerts.length} MCP Mismatch(es) Detected`,
          fields: [
            {
              title: 'Critical',
              value: String(criticalCount),
              short: true,
            },
            {
              title: 'Blocked',
              value: String(blockedCount),
              short: true,
            },
            {
              title: 'Endpoints',
              value: [...new Set(alerts.map((a) => a.endpoint))]
                .slice(0, 5)
                .join('\n'),
              short: false,
            },
          ],
          footer: 'AutoMecanik MCP Validation',
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };
  }

  /**
   * Log alerts to console
   */
  private sendToConsole(alerts: McpMismatchAlert[]): void {
    for (const alert of alerts) {
      const logFn =
        alert.severity === 'critical'
          ? this.logger.error.bind(this.logger)
          : alert.severity === 'error'
            ? this.logger.warn.bind(this.logger)
            : this.logger.log.bind(this.logger);

      logFn(
        `[MCP Alert] ${alert.severity.toUpperCase()} - ${alert.dataType} @ ${alert.endpoint}` +
          ` | blocked=${alert.blocked} | requestId=${alert.requestId}` +
          ` | discrepancies=${alert.discrepancy.map((d) => d.field).join(',')}`,
      );
    }
  }

  /**
   * Check if alert meets minimum severity threshold
   */
  private meetsMinSeverity(severity: McpAlertSeverity): boolean {
    return (
      this.severityLevel(severity) >=
      this.severityLevel(this.config.minSeverity)
    );
  }

  /**
   * Convert severity to numeric level
   */
  private severityLevel(severity: McpAlertSeverity): number {
    const levels: Record<McpAlertSeverity, number> = {
      info: 0,
      warning: 1,
      error: 2,
      critical: 3,
    };
    return levels[severity] ?? 0;
  }

  /**
   * Check rate limit for endpoint
   */
  private checkRateLimit(endpoint: string): boolean {
    const now = Date.now();
    const entry = this.alertCounts.get(endpoint);

    if (!entry || now > entry.resetAt) {
      // New window
      this.alertCounts.set(endpoint, {
        count: 1,
        resetAt: now + this.rateLimitWindow,
      });
      return true;
    }

    if (entry.count >= this.maxAlertsPerWindow) {
      return false;
    }

    entry.count++;
    return true;
  }

  /**
   * Get alert statistics
   */
  getStats(): {
    bufferedCount: number;
    rateLimitedEndpoints: string[];
  } {
    const rateLimited: string[] = [];
    const now = Date.now();

    for (const [endpoint, entry] of this.alertCounts) {
      if (entry.count >= this.maxAlertsPerWindow && now <= entry.resetAt) {
        rateLimited.push(endpoint);
      }
    }

    return {
      bufferedCount: this.alertBuffer.length,
      rateLimitedEndpoints: rateLimited,
    };
  }

  /**
   * Force flush (for testing or shutdown)
   */
  async forceFlush(): Promise<void> {
    await this.flushAlertBuffer();
  }

  /**
   * Cleanup on module destroy
   */
  onModuleDestroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    // Final flush
    this.flushAlertBuffer().catch((e) =>
      this.logger.error('Final flush failed', e),
    );
  }
}
