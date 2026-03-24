import { Controller, Get, Param, Req, Res, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { AbandonedCartDataService } from '../services/abandoned-cart-data.service';
import { AbandonedCartService } from '../services/abandoned-cart.service';
import { CartDataService } from '../../../database/services/cart-data.service';

// 1x1 transparent GIF
const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

@Controller('api/cart')
export class CartRecoveryController {
  private readonly logger = new Logger(CartRecoveryController.name);

  constructor(
    private readonly abandonedCartData: AbandonedCartDataService,
    private readonly abandonedCartService: AbandonedCartService,
    private readonly cartDataService: CartDataService,
  ) {}

  /**
   * Recovery link — atomic: marks as recovered then restores cart with current prices.
   */
  @Get('recover/:token')
  async recoverCart(
    @Param('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      if (!token || token.length !== 64) {
        res.redirect('/panier?error=invalid_token');
        return;
      }

      // Atomic update — only succeeds if status is detected/emailing
      const record = await this.abandonedCartData.updateRecovered(token);

      if (!record) {
        // Token invalid, expired, or already recovered
        res.redirect('/panier?error=already_recovered');
        return;
      }

      // Restore cart items with CURRENT prices (not stale snapshot prices)
      const sessionId = this.getCartSessionId(req);
      const items = record.cart_snapshot as Array<{
        product_id: string | number;
        quantity: number;
      }>;

      let restored = 0;
      for (const item of items) {
        try {
          // addCartItem fetches current price from __pieces_price
          await this.cartDataService.addCartItem(
            sessionId,
            Number(item.product_id),
            item.quantity,
            undefined, // no custom price — use current DB price
            true, // replace mode
          );
          restored++;
        } catch (_err) {
          this.logger.warn(`Product ${item.product_id} unavailable — skipped`);
        }
      }

      this.logger.log(
        `Cart recovered: ${restored}/${items.length} items for token ${token.substring(0, 8)}...`,
      );
      res.redirect('/panier?recovered=1');
    } catch (error) {
      this.logger.error('Recovery failed', error);
      res.redirect('/panier?error=recovery_failed');
    }
  }

  /**
   * Tracking pixel — uses token (not record ID) to prevent enumeration.
   * Always returns the pixel regardless of token validity.
   */
  @Get('track/open/:token')
  async trackOpen(
    @Param('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    // Silently update — never leak whether token exists
    if (token && token.length === 64) {
      this.abandonedCartData.updateOpenedByToken(token).catch(() => {});
    }

    res.set({
      'Content-Type': 'image/gif',
      'Content-Length': TRACKING_PIXEL.length.toString(),
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    });
    res.end(TRACKING_PIXEL);
  }

  /**
   * Unsubscribe — opt out of abandoned cart emails
   */
  @Get('unsubscribe/:token')
  async unsubscribe(
    @Param('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const result = await this.abandonedCartData.updateUnsubscribed(token);

      if (result) {
        await this.abandonedCartService.markUnsubscribed(result.cst_id);
      }

      res.set('Content-Type', 'text/html; charset=utf-8');
      res.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Desinscription</title></head>
<body style="font-family:Arial,sans-serif;text-align:center;padding:60px 20px;background:#f3f4f6;">
  <div style="max-width:400px;margin:0 auto;background:#fff;padding:32px;border-radius:8px;">
    <h2 style="color:#1f2937;">Desinscription confirmee</h2>
    <p style="color:#6b7280;">Vous ne recevrez plus de rappels de panier abandonne.</p>
    <a href="/" style="color:#f59e0b;text-decoration:underline;">Retour sur Automecanik</a>
  </div>
</body></html>`);
    } catch (error) {
      this.logger.error('Unsubscribe failed', error);
      res.status(500).send('Erreur lors de la desinscription.');
    }
  }

  /**
   * Admin stats endpoint
   */
  @Get('abandoned-stats')
  async getStats(): Promise<Record<string, unknown>> {
    const stats = await this.abandonedCartData.getStats();
    const recoveryRate =
      stats.total_detected > 0
        ? Math.round((stats.recovered / stats.total_detected) * 100 * 100) / 100
        : 0;

    return { ...stats, recovery_rate: recoveryRate };
  }

  private getCartSessionId(req: Request): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reqAny = req as any;
    if (reqAny.user?.id) return String(reqAny.user.id);
    return reqAny.sessionID || 'anonymous';
  }
}
