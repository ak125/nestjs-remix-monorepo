import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { createReadStream, statSync } from 'fs';
import pino from 'pino';

const logger = pino({ name: 'S3Upload' });

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

/**
 * Check S3/MinIO connectivity by verifying the bucket exists.
 */
export async function checkS3Connection(): Promise<boolean> {
  const bucket = process.env.S3_BUCKET_NAME ?? 'automecanik-renders';
  try {
    await getS3Client().send(new HeadBucketCommand({ Bucket: bucket }));
    return true;
  } catch (err) {
    logger.warn({ err, bucket }, 'S3 connection check failed');
    return false;
  }
}

/**
 * Upload a local file to S3/MinIO.
 * Returns the full S3 path.
 */
export async function uploadToS3(
  localPath: string,
  briefId: string,
  executionLogId: number,
): Promise<{ s3Path: string; fileSizeBytes: number }> {
  const bucket = process.env.S3_BUCKET_NAME ?? 'automecanik-renders';
  const timestamp = Date.now();
  const key = `renders/${briefId}/${executionLogId}/${timestamp}.mp4`;

  const fileStats = statSync(localPath);
  if (fileStats.size === 0) {
    throw new Error('Output file is empty (0 bytes)');
  }

  const stream = createReadStream(localPath);

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: stream,
      ContentType: 'video/mp4',
      ContentLength: fileStats.size,
    }),
  );

  const s3Path = `s3://${bucket}/${key}`;
  logger.info({ briefId, executionLogId, s3Path, fileSizeBytes: fileStats.size }, 'Upload complete');

  return { s3Path, fileSizeBytes: fileStats.size };
}

/**
 * Upload a local file to S3 with a custom key and content type.
 * Returns the full s3:// path.
 */
export async function uploadToS3Generic(
  localPath: string,
  key: string,
  contentType: string,
): Promise<string> {
  const bucket = process.env.S3_BUCKET_NAME ?? 'automecanik-renders';

  const fileStats = statSync(localPath);
  const stream = createReadStream(localPath);

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: stream,
      ContentType: contentType,
      ContentLength: fileStats.size,
    }),
  );

  const s3Path = `s3://${bucket}/${key}`;
  logger.info({ key, s3Path, fileSizeBytes: fileStats.size }, 'Generic upload complete');

  return s3Path;
}
