import { Module } from '@nestjs/common';
import { SessionStoreService } from './session-store.service';

/**
 * Infrastructure module owning the Redis-backed session store.
 *
 * Exports ONLY {@link SessionStoreService} — never the raw store/client.
 * Imported by:
 *  - AppModule        → so `main.ts` can `app.get(SessionStoreService)` and
 *                       mount the session middleware.
 *  - HealthModule     → readiness (`/health/ready`) + active session-store
 *                       probe (`/health/session-store`).
 *
 * NOTE on middleware ordering (session → passport → routes): that ordering is
 * enforced by the `app.use(...)` sequence in `main.ts`, NOT by module import
 * order. PR-9e.1 keeps that sequence byte-identical.
 */
@Module({
  providers: [SessionStoreService],
  exports: [SessionStoreService],
})
export class SessionInfrastructureModule {}
