import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SupportConfig {
  // Contact configuration
  contactEmail: string;
  supportPhone: string;
  businessHours: {
    start: string;
    end: string;
    timezone: string;
    workdays: string[];
  };

  // Notification settings
  notifications: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    pushEnabled: boolean;
    webhookUrl?: string;
  };

  // Response time SLA
  responseTimes: {
    urgent: number; // minutes
    high: number; // minutes
    normal: number; // minutes
    low: number; // minutes
  };

  // File upload limits
  fileUpload: {
    maxSize: number; // bytes
    allowedTypes: string[];
    maxFiles: number;
  };

  // Review settings
  reviews: {
    moderationEnabled: boolean;
    autoPublish: boolean;
    minRating: number;
    maxRating: number;
  };
}

@Injectable()
export class SupportConfigService {
  private readonly logger = new Logger(SupportConfigService.name);
  private config: SupportConfig;

  constructor(private readonly configService: ConfigService) {
    this.loadConfiguration();
  }

  private loadConfiguration(): void {
    this.config = {
      contactEmail: this.configService.get(
        'SUPPORT_EMAIL',
        'support@automecanik.com',
      ),
      supportPhone: this.configService.get(
        'SUPPORT_PHONE',
        '+33 1 23 45 67 89',
      ),

      businessHours: {
        start: this.configService.get('BUSINESS_HOURS_START', '09:00'),
        end: this.configService.get('BUSINESS_HOURS_END', '17:00'),
        timezone: this.configService.get('BUSINESS_TIMEZONE', 'Europe/Paris'),
        workdays: this.configService
          .get('BUSINESS_WORKDAYS', 'monday,tuesday,wednesday,thursday,friday')
          .split(','),
      },

      notifications: {
        emailEnabled:
          this.configService.get('NOTIFICATIONS_EMAIL_ENABLED', 'true') ===
          'true',
        smsEnabled:
          this.configService.get('NOTIFICATIONS_SMS_ENABLED', 'false') ===
          'true',
        pushEnabled:
          this.configService.get('NOTIFICATIONS_PUSH_ENABLED', 'true') ===
          'true',
        webhookUrl: this.configService.get('SUPPORT_WEBHOOK_URL'),
      },

      responseTimes: {
        urgent: parseInt(this.configService.get('RESPONSE_TIME_URGENT', '15')),
        high: parseInt(this.configService.get('RESPONSE_TIME_HIGH', '60')),
        normal: parseInt(this.configService.get('RESPONSE_TIME_NORMAL', '240')),
        low: parseInt(this.configService.get('RESPONSE_TIME_LOW', '1440')),
      },

      fileUpload: {
        maxSize: parseInt(
          this.configService.get('FILE_UPLOAD_MAX_SIZE', '10485760'),
        ), // 10MB
        allowedTypes: this.configService
          .get(
            'FILE_UPLOAD_ALLOWED_TYPES',
            'image/jpeg,image/png,application/pdf,text/plain',
          )
          .split(','),
        maxFiles: parseInt(
          this.configService.get('FILE_UPLOAD_MAX_FILES', '5'),
        ),
      },

      reviews: {
        moderationEnabled:
          this.configService.get('REVIEWS_MODERATION_ENABLED', 'true') ===
          'true',
        autoPublish:
          this.configService.get('REVIEWS_AUTO_PUBLISH', 'false') === 'true',
        minRating: parseInt(this.configService.get('REVIEWS_MIN_RATING', '1')),
        maxRating: parseInt(this.configService.get('REVIEWS_MAX_RATING', '5')),
      },
    };

    this.logger.log('Support configuration loaded successfully');
  }

  getConfig(): SupportConfig {
    return this.config;
  }

  getContactEmail(): string {
    return this.config.contactEmail;
  }

  getSupportPhone(): string {
    return this.config.supportPhone;
  }

  getBusinessHours() {
    return this.config.businessHours;
  }

  getResponseTime(priority: 'urgent' | 'high' | 'normal' | 'low'): number {
    return this.config.responseTimes[priority];
  }

  isWithinBusinessHours(): boolean {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = this.config.businessHours.start
      .split(':')
      .map(Number);
    const [endHour, endMinute] = this.config.businessHours.end
      .split(':')
      .map(Number);

    const startTime = startHour * 60 + startMinute;
    const endTime = endHour * 60 + endMinute;

    const currentDay = now
      .toLocaleDateString('en-US', { weekday: 'long' })
      .toLowerCase();
    const isWorkday = this.config.businessHours.workdays.includes(currentDay);

    return isWorkday && currentTime >= startTime && currentTime <= endTime;
  }

  getFileUploadConfig() {
    return this.config.fileUpload;
  }

  getReviewsConfig() {
    return this.config.reviews;
  }

  getNotificationSettings() {
    return this.config.notifications;
  }

  async updateConfig(updates: Partial<SupportConfig>): Promise<void> {
    this.config = { ...this.config, ...updates };
    this.logger.log('Support configuration updated');
  }
}
