import { FastifyPluginAsync } from 'fastify';
import { readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';

const TMP_DIR = '/tmp/renders';
const MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

/**
 * DELETE /render/cleanup — purge orphan render tmp files older than MAX_AGE_MS.
 *
 * Called by NestJS RenderAdapterService on canary failure fallback (P12c).
 * Also safe to call manually or from a cron for housekeeping.
 */
export const cleanupRoute: FastifyPluginAsync = async (app) => {
  app.delete('/render/cleanup', async (_req, reply) => {
    const now = Date.now();
    let deleted = 0;

    try {
      const files = readdirSync(TMP_DIR).filter((f) =>
        f.startsWith('render-'),
      );

      for (const file of files) {
        const fullPath = join(TMP_DIR, file);
        const mtime = statSync(fullPath).mtimeMs;
        if (now - mtime > MAX_AGE_MS) {
          unlinkSync(fullPath);
          deleted++;
        }
      }
    } catch {
      // TMP_DIR may not exist yet — no-op
    }

    return reply.send({ deleted, timestamp: new Date().toISOString() });
  });
};
