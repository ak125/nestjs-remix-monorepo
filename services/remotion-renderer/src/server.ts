import Fastify from 'fastify';
import pino from 'pino';
import { healthRoute } from './routes/health';
import { renderRoute } from './routes/render';
import { presignedUrlRoute } from './routes/presigned-url';
import { cleanupRoute } from './routes/cleanup';
import { postprocessRoute } from './routes/postprocess';

const PORT = parseInt(process.env.RENDER_SERVICE_PORT ?? '3100', 10);
const HOST = '0.0.0.0';

const logger = pino({ name: 'RenderService' });

async function main(): Promise<void> {
  const app = Fastify({
    logger: true,
    bodyLimit: 1048576, // 1MB
    requestTimeout: 180000, // 3min (renders can be long)
  });

  // ── Register routes ──
  await app.register(healthRoute);
  await app.register(renderRoute);
  await app.register(presignedUrlRoute);
  await app.register(cleanupRoute);
  await app.register(postprocessRoute);

  // ── Start ──
  try {
    await app.listen({ port: PORT, host: HOST });
    logger.info(
      {
        port: PORT,
        chromiumPath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',
        s3Endpoint: process.env.S3_ENDPOINT ?? 'AWS S3 (default)',
        s3Bucket: process.env.S3_BUCKET_NAME ?? 'automecanik-renders',
      },
      `Render service started on :${PORT}`,
    );
  } catch (err) {
    logger.fatal(err, 'Failed to start render service');
    process.exit(1);
  }
}

main();
