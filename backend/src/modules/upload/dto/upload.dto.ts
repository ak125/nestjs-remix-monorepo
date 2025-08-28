export enum UploadType {
  AVATAR = 'avatar',
  DOCUMENT = 'document',
  ATTACHMENT = 'attachment',
  MEDIA = 'media',
}

export interface FileUploadResult {
  id: string;
  originalName: string;
  fileName: string;
  url: string;
  publicUrl?: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
  metadata?: {
    uploadType?: UploadType;
    folder?: string;
    uploadTimeMs?: number;
    userId?: string;
    sessionId?: string;
    userAgent?: string;
    ipAddress?: string;
    validationPassed?: boolean;
    width?: number;
    height?: number;
    duration?: number;
    thumbnails?: string[];
  };
}

export interface BulkUploadResult {
  successful: FileUploadResult[];
  failed: Array<{ file: string; error: string }>;
  summary: {
    totalFiles: number;
    successfulUploads: number;
    failedUploads: number;
    totalSize: number;
    totalUploadTime: number;
  };
}

export interface UploadAnalytics {
  id: string;
  fileName: string;
  originalName: string;
  mimeType?: string;
  size?: number;
  uploadType: UploadType;
  uploadTime?: number;
  success: boolean;
  errorMessage?: string;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  ipAddress?: string;
  timestamp: Date;
}

export interface UploadConfig {
  maxFileSize: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  folder: string;
  generateThumbnails: boolean;
  enableCompression: boolean;
}
