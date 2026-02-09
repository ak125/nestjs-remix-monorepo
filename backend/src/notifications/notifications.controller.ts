import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('api/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('stats')
  getStats() {
    return this.notificationsService.getNotificationStats();
  }

  @Post('order-update')
  sendOrderUpdate(
    @Body() body: { orderId: string; status: string; userId?: string },
  ) {
    this.notificationsService.sendOrderUpdate(
      body.orderId,
      body.status,
      body.userId,
    );
    return { success: true, message: 'Order update notification sent' };
  }

  @Post('promotion')
  sendPromotion(
    @Body()
    promotion: {
      title: string;
      message: string;
      discount?: number;
      validUntil?: string;
    },
  ) {
    this.notificationsService.sendPromotion(promotion);
    return { success: true, message: 'Promotion notification sent' };
  }

  @Post('system-alert')
  sendSystemAlert(
    @Body()
    body: {
      message: string;
      type?: 'warning' | 'error';
      priority?: 'low' | 'normal' | 'high' | 'urgent';
    },
  ) {
    this.notificationsService.sendSystemAlert(
      body.message,
      body.type,
      body.priority,
    );
    return { success: true, message: 'System alert sent' };
  }

  @Post('inventory-alert')
  sendInventoryAlert(
    @Body() body: { productName: string; stock: number; threshold: number },
  ) {
    this.notificationsService.sendInventoryAlert(
      body.productName,
      body.stock,
      body.threshold,
    );
    return { success: true, message: 'Inventory alert sent' };
  }

  @Post('welcome/:userId')
  sendWelcome(
    @Param('userId') userId: string,
    @Body() body: { userName: string },
  ) {
    this.notificationsService.sendWelcomeNotification(userId, body.userName);
    return { success: true, message: 'Welcome notification sent' };
  }

  @Post('payment-confirmation')
  sendPaymentConfirmation(
    @Body()
    body: {
      userId: string;
      orderId: string;
      amount: number;
      currency?: string;
    },
  ) {
    this.notificationsService.sendPaymentConfirmation(
      body.userId,
      body.orderId,
      body.amount,
      body.currency,
    );
    return { success: true, message: 'Payment confirmation sent' };
  }

  @Post('shipping')
  sendShipping(
    @Body()
    body: {
      userId: string;
      orderId: string;
      trackingNumber: string;
      carrier: string;
    },
  ) {
    this.notificationsService.sendShippingNotification(
      body.userId,
      body.orderId,
      body.trackingNumber,
      body.carrier,
    );
    return { success: true, message: 'Shipping notification sent' };
  }

  @Post('demo/start')
  startDemo() {
    this.notificationsService.startDemoMode();
    return { success: true, message: 'Demo mode started' };
  }
}
