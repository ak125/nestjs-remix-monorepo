import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bull';
import { CacheService } from '@cache/cache.service';
import { CartDataService } from '../../../database/services/cart-data.service';
import { AbandonedCartDataService } from './abandoned-cart-data.service';
import { FeatureFlagsService } from '../../../config/feature-flags.service';
import { MailService } from '../../../services/mail.service';
import { SITE_ORIGIN } from '../../../config/app.config';

const CANDIDATES_KEY = 'abandoned-cart:candidates';
const UNSUBSCRIBED_PREFIX = 'cart:unsubscribed:';
const UNSUBSCRIBED_TTL = 365 * 24 * 3600; // 1 year
const CANDIDATE_TTL = 7 * 24 * 3600; // 7 days

interface CandidateEntry {
  userId: number;
  sessionId: string;
  timestamp: number;
}

@Injectable()
export class AbandonedCartService implements OnModuleInit {
  private readonly logger = new Logger(AbandonedCartService.name);

  constructor(
    @InjectQueue('email') private readonly emailQueue: Queue,
    private readonly cacheService: CacheService,
    private readonly cartDataService: CartDataService,
    private readonly abandonedCartData: AbandonedCartDataService,
    private readonly featureFlags: FeatureFlagsService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Enregistrement non-bloquant du scanner répétitif.
   *
   * `await this.emailQueue.add(...)` touche Redis via Bull. Si la connexion
   * Redis n'est pas immédiate (config Bull cassée, Redis lent au boot, retry
   * forever d'ioredis), awaiter ici bloquerait `app.listen()` (NestJS exécute
   * tous les `onModuleInit` durant `app.init()` appelé par `listen()` →
   * /health muet → exit 124 sur perf-gates.yml). Cf. PR #224 / runs
   * 25166916535 + 25172104783 (preuve via INIT_TRACE markers).
   *
   * Voir `.claude/rules/backend.md` § "Non-blocking onModuleInit".
   */
  onModuleInit(): void {
    void this.registerScannerJob();
  }

  private async registerScannerJob(): Promise<void> {
    try {
      await this.emailQueue.add(
        'abandoned-cart-scan',
        {},
        {
          repeat: { every: 15 * 60 * 1000 },
          jobId: 'abandoned-cart-scanner',
          removeOnComplete: 5,
          removeOnFail: 5,
        },
      );
      this.logger.log('Abandoned cart scanner registered (every 15min)');
    } catch (error) {
      this.logger.error('Failed to register scanner job', error);
    }
  }

  /**
   * Listen for cart activity events (decoupled from CartAnalyticsService).
   */
  @OnEvent('cart.activity')
  async onCartActivity(event: {
    userId: number;
    sessionId: string;
  }): Promise<void> {
    await this.registerCandidate(event.userId, event.sessionId);
  }

  /**
   * Register a logged-in user's cart as a candidate for abandonment detection.
   */
  async registerCandidate(userId: number, sessionId: string): Promise<void> {
    try {
      const candidates = await this.getCandidates();
      // Dedup: only keep latest per userId
      const filtered = candidates.filter((c) => c.userId !== userId);
      filtered.push({ userId, sessionId, timestamp: Date.now() });
      await this.cacheService.set(CANDIDATES_KEY, filtered, CANDIDATE_TTL);
    } catch (error) {
      this.logger.error('Failed to register candidate', error);
    }
  }

  /**
   * Main scan logic — called by EmailProcessor on 'abandoned-cart-scan' job.
   */
  async scanAndEnqueue(): Promise<{ detected: number; enqueued: number }> {
    if (!this.featureFlags.abandonedCartEmailEnabled) {
      return { detected: 0, enqueued: 0 };
    }

    const candidates = await this.getCandidates();
    if (!candidates.length) return { detected: 0, enqueued: 0 };

    const now = Date.now();
    const abandonedThresholdMs = 60 * 60 * 1000; // 60 minutes
    let detected = 0;
    let enqueued = 0;
    const remaining: CandidateEntry[] = [];

    for (const candidate of candidates) {
      const ageMs = now - candidate.timestamp;

      // Not old enough yet
      if (ageMs < abandonedThresholdMs) {
        remaining.push(candidate);
        continue;
      }

      try {
        // Check if user unsubscribed
        const unsubKey = `${UNSUBSCRIBED_PREFIX}${candidate.userId}`;
        const isUnsubscribed = await this.cacheService.get(unsubKey);
        if (isUnsubscribed) continue;

        // Check if already captured recently
        const existing = await this.abandonedCartData.findRecentByCstId(
          candidate.userId,
          24,
        );
        if (existing) continue;

        // Get the cart from Redis
        const cart = await this.cartDataService.getCartWithMetadata(
          candidate.sessionId,
        );
        if (!cart || !cart.items || cart.items.length === 0) continue;

        // Get customer email from Supabase
        const customer = await this.abandonedCartData.getCustomerEmail(
          candidate.userId,
        );
        if (!customer?.cst_mail) continue;

        // Snapshot and persist
        const record = await this.abandonedCartData.insert({
          cst_id: candidate.userId,
          cst_mail: customer.cst_mail,
          cst_fname: customer.cst_fname || null,
          session_id: candidate.sessionId,
          cart_snapshot: cart.items as Record<string, unknown>[],
          cart_subtotal: cart.stats?.subtotal || 0,
          cart_item_count: cart.items.length,
        });

        if (!record) continue;
        detected++;

        // Schedule 3 email jobs (delayed)
        await this.emailQueue.add(
          'abandoned-cart-email',
          { id: record.id, step: '1h' },
          {
            delay: 0,
            attempts: 3,
            backoff: { type: 'exponential', delay: 30_000 },
          },
        );
        await this.emailQueue.add(
          'abandoned-cart-email',
          { id: record.id, step: '24h' },
          {
            delay: 23 * 3600_000,
            attempts: 3,
            backoff: { type: 'exponential', delay: 30_000 },
          },
        );
        await this.emailQueue.add(
          'abandoned-cart-email',
          { id: record.id, step: '72h' },
          {
            delay: 71 * 3600_000,
            attempts: 3,
            backoff: { type: 'exponential', delay: 30_000 },
          },
        );
        enqueued++;
      } catch (error) {
        this.logger.error(
          `Error processing candidate ${candidate.userId}`,
          error,
        );
        remaining.push(candidate); // Retry next scan
      }
    }

    // Update candidates list (remove processed)
    await this.cacheService.set(CANDIDATES_KEY, remaining, CANDIDATE_TTL);

    if (detected > 0) {
      this.logger.log(
        `Scan complete: ${detected} abandoned carts detected, ${enqueued} email sequences enqueued`,
      );
    }

    return { detected, enqueued };
  }

  /**
   * Send the appropriate email in the sequence.
   * Called by EmailProcessor on 'abandoned-cart-email' job.
   */
  async sendSequenceEmail(
    recordId: string,
    step: '1h' | '24h' | '72h',
  ): Promise<boolean> {
    const record = await this.abandonedCartData.findById(recordId);
    if (!record) {
      this.logger.warn(`Record ${recordId} not found — skipping`);
      return false;
    }

    // Guard checks
    if (['recovered', 'expired', 'unsubscribed'].includes(record.status)) {
      this.logger.log(
        `Record ${recordId} status=${record.status} — skipping ${step} email`,
      );
      return false;
    }

    // Check if user unsubscribed since detection (Redis cache + DB fallback)
    const unsubKey = `${UNSUBSCRIBED_PREFIX}${record.cst_id}`;
    let isUnsubscribed = await this.cacheService.get(unsubKey);
    if (!isUnsubscribed) {
      // Redis miss — check DB as source of truth
      isUnsubscribed = await this.abandonedCartData.isUnsubscribedByCstId(
        record.cst_id,
      );
      if (isUnsubscribed) {
        // Rebuild cache
        await this.cacheService.set(unsubKey, true, UNSUBSCRIBED_TTL);
      }
    }
    if (isUnsubscribed) {
      this.logger.log(`User ${record.cst_id} unsubscribed — skipping`);
      return false;
    }

    // Check if expired
    if (new Date(record.expires_at) < new Date()) {
      this.logger.log(`Record ${recordId} expired — skipping`);
      return false;
    }

    // Check if this step was already sent
    const sentCol = `email_${step}_sent_at` as keyof typeof record;
    if (record[sentCol]) {
      this.logger.log(`Step ${step} already sent for ${recordId} — skipping`);
      return false;
    }

    // Build email data
    const items = record.cart_snapshot as Array<{
      product_name?: string;
      product_brand?: string;
      product_image?: string;
      quantity?: number;
      price?: number;
    }>;

    const firstName = record.cst_fname || 'Client';
    const count = record.cart_item_count;
    const subjects: Record<string, string> = {
      '1h': `${firstName}, votre panier de ${count} article${count > 1 ? 's' : ''} vous attend`,
      '24h': `${firstName}, vos pieces auto vous attendent`,
      '72h': `Derniere chance, ${firstName} — votre panier expire bientot`,
    };

    const recoveryUrl = `${SITE_ORIGIN}/panier/recover/${record.recovery_token}`;
    const unsubscribeUrl = `${SITE_ORIGIN}/api/cart/unsubscribe/${record.recovery_token}`;
    const trackingPixelUrl = `${SITE_ORIGIN}/api/cart/track/open/${record.recovery_token}`;

    await this.mailService.sendAbandonedCartEmail({
      to: record.cst_mail,
      firstName: record.cst_fname || 'Client',
      subject: subjects[step],
      items,
      subtotal: Number(record.cart_subtotal),
      recoveryUrl,
      unsubscribeUrl,
      trackingPixelUrl,
      step,
    });

    await this.abandonedCartData.updateEmailSent(record.id, step);

    this.logger.log(
      `Email ${step} sent to ${record.cst_mail} for record ${record.id}`,
    );
    return true;
  }

  /**
   * Mark a user as unsubscribed from abandoned cart emails.
   */
  async markUnsubscribed(cstId: number): Promise<void> {
    const key = `${UNSUBSCRIBED_PREFIX}${cstId}`;
    await this.cacheService.set(key, true, UNSUBSCRIBED_TTL);
  }

  // ── Private helpers ──

  private async getCandidates(): Promise<CandidateEntry[]> {
    const data = await this.cacheService.get<CandidateEntry[]>(CANDIDATES_KEY);
    return data || [];
  }
}
