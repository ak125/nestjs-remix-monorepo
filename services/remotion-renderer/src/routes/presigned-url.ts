/**
 * Presigned URL route — Generate time-limited HTTPS URLs for rendered videos (P9a).
 *
 * GET /presigned-url?key=renders/<briefId>/<execId>/<ts>.mp4
 * Returns: { url: string, expiresIn: number }
 */

import type { FastifyInstance } from 'fastify';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import pino from 'pino';

const logger = pino({ name: 'PresignedUrl' });

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    const endpoint = process.env.S3_ENDPOINT;
    s3Client = new S3Client({
      endpoint: endpoint || undefined,
      region: process.env.S3_REGION ?? 'eu-central-1',
      forcePathStyle: !!endpoint, // Required for MinIO
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY ?? '',
        secretAccessKey: process.env.S3_SECRET_KEY ?? '',
      },
    });
  }
  return s3Client;
}

export async function presignedUrlRoute(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { key?: string } }>(
    '/presigned-url',
    async (request, reply) => {
      const key = request.query.key;

      if (!key) {
        return reply.status(400).send({ error: 'Missing key parameter' });
      }

      const bucket = process.env.S3_BUCKET_NAME ?? 'automecanik-renders';
      const expiresIn = 3600; // 1 hour

      try {
        const command = new GetObjectCommand({ Bucket: bucket, Key: key });
        const url = await getSignedUrl(getS3Client(), command, { expiresIn });

        logger.info({ key, expiresIn }, 'Presigned URL generated');
        return reply.send({ url, expiresIn });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        logger.error({ err, key }, 'Presigned URL generation failed');
        return reply.status(500).send({ error: msg });
      }
    },
  );
}
