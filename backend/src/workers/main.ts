/**
 * 🔄 WORKER BULLMQ PRINCIPAL
 * Process jobs depuis Redis queues
 */

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const logger = new Logger('WorkerBootstrap');

  try {
    // Créer application NestJS en mode worker
    const app = await NestFactory.create(WorkerModule, {
      logger: ['error', 'warn', 'log', 'debug'],
    });

    // Health check endpoint
    const express = app.getHttpAdapter().getInstance();
    express.get('/health', (_req: any, res: any) => {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });

    // Démarrer sur port 3001
    await app.listen(3001);

    logger.log('🔄 BullMQ Worker started on port 3001');
    logger.log('✅ Worker ready to process jobs');
  } catch (error) {
    logger.error('❌ Worker failed to start:', error);
    process.exit(1);
  }
}

bootstrap();
