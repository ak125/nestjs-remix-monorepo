import type { FastifyInstance } from 'fastify';
import { checkFfmpeg, checkChromium } from '../lib/ffmpeg-check';
import { checkS3Connection } from '../lib/s3-upload';
import type { HealthResponse } from '../types/contract';

export async function healthRoute(app: FastifyInstance): Promise<void> {
  app.get('/health', async (_request, reply) => {
    const ffmpeg = checkFfmpeg();
    const chromiumAvailable = checkChromium();
    const s3Connected = await checkS3Connection();

    const allOk = ffmpeg.available && chromiumAvailable && s3Connected;
    const anyDep = ffmpeg.available && chromiumAvailable;

    let status: HealthResponse['status'];
    if (allOk) {
      status = 'ok';
    } else if (anyDep) {
      status = 'degraded'; // S3 down but deps OK
    } else {
      status = 'error';
    }

    const response: HealthResponse = {
      status,
      schemaVersion: '1.0.0',
      ffmpegAvailable: ffmpeg.available,
      chromiumAvailable,
      s3Connected,
      timestamp: new Date().toISOString(),
    };

    return reply.status(200).send(response);
  });
}
