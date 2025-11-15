# Feature Spec: Upload Module

**Phase**: 3 Extended (Feature 14/18)  
**Coverage**: +1 module → 76% (26/37 modules)  
**Endpoints**: 8 total (upload single/multiple, validate, delete, stats, config, health, list)  
**Architecture**: UploadService + 6 services spécialisés  
**Lines**: ~600 (service) + ~900 (specialized services) + ~250 (controller)

---

## 1. Objectif Métier

Module complet de **gestion fichiers** avec Supabase Storage. Upload sécurisé, validation avancée, traitement images, analytics monitoring.

**Business Value**:
- 📤 Upload fichiers (images, documents, médias, attachments)
- 🔒 Validation sécurité (MIME, extension, signatures, malware detection)
- 🖼️ Traitement images automatique (resize, thumbnails, optimization)
- 📊 Analytics (upload stats, performance monitoring)
- ☁️ Supabase Storage (URLs signées, buckets management)
- 🏥 Health checks (storage connectivity, upload capacity)

**Use Cases**:
- Users: Upload avatar, documents identité
- Products: Upload images produits, fiches techniques
- Blog: Upload images articles, médias
- Admin: Upload CSV imports, bulk files
- System: Automatic thumbnails, image optimization

---

## 2. Endpoints (8 Total)

### 2.1 POST /api/upload/single/:type

**Description**: Upload fichier unique  
**Controller**: `UploadController.uploadSingle()`  
**Service**: `UploadService.uploadFile()`

**Path Params**:
- `type` (UploadType): `avatar` | `document` | `attachment` | `media`

**Query Params**:
- `folder` (string, optional): Custom destination folder
- `validate` (boolean, default: `true`): Enable validation

**Body**: `multipart/form-data`
- `file`: File (max 100MB dev, 50MB prod)

**Response Example**:
```json
{
  "success": true,
  "message": "Fichier uploadé avec succès",
  "data": {
    "id": "uploads/1731672000123-image.jpg",
    "fileName": "1731672000123-image.jpg",
    "originalName": "image.jpg",
    "url": "https://xxx.supabase.co/storage/v1/object/public/uploads/...",
    "mimeType": "image/jpeg",
    "size": 245678,
    "metadata": {
      "validationPassed": true,
      "uploadTimeMs": 234,
      "uploadType": "avatar"
    }
  }
}
```

**Business Logic**:
1. Validation fichier (MIME, size, extension, signatures)
2. Upload vers Supabase Storage (`bucket: uploads`)
3. Génération URL publique
4. Record analytics (success, duration, size)
5. Return upload result avec metadata

---

### 2.2 POST /api/upload/multiple/:type

**Description**: Upload fichiers multiples (bulk)  
**Controller**: `UploadController.uploadMultiple()`  
**Service**: `UploadService.uploadMultipleFiles()`

**Path Params**:
- `type` (UploadType): Type upload commun

**Query Params**:
- `folder` (string, optional): Destination folder
- `continueOnError` (boolean, default: `false`): Continue si erreur

**Body**: `multipart/form-data`
- `files[]`: Multiple files (max 10 files)

**Response Example**:
```json
{
  "success": true,
  "message": "7/10 fichiers uploadés",
  "data": {
    "successful": [
      {
        "id": "uploads/file1.jpg",
        "fileName": "file1.jpg",
        "url": "https://...",
        "size": 123456
      }
    ],
    "failed": [
      {
        "fileName": "file8.exe",
        "error": "Type de fichier dangereux détecté"
      }
    ],
    "stats": {
      "totalFiles": 10,
      "successCount": 7,
      "failureCount": 3,
      "totalSizeUploaded": 8765432,
      "totalDuration": 2345
    }
  }
}
```

**Business Logic**:
1. Batch validation (parallèle)
2. Upload séquentiel ou parallèle (maxConcurrentUploads)
3. Error handling: stop ou continue selon flag
4. Aggregate stats (success/fail counts, sizes, duration)
5. Return bulk result avec successful/failed arrays

---

### 2.3 POST /api/upload/validate/:type

**Description**: Validation fichier sans upload  
**Controller**: `UploadController.validateFile()`  
**Service**: `UploadService.validateFile()`

**Path Params**:
- `type` (UploadType): Type validation

**Body**: `multipart/form-data`
- `file`: File à valider

**Response Example** (valid):
```json
{
  "success": true,
  "message": "Fichier valide",
  "data": {
    "isValid": true,
    "errors": [],
    "warnings": ["Image resolution faible (800x600)"],
    "securityScore": 95
  }
}
```

**Response Example** (invalid):
```json
{
  "success": false,
  "message": "Fichier invalide",
  "data": {
    "isValid": false,
    "errors": [
      "Type MIME non autorisé: application/x-msdownload",
      "Signature de fichier dangereux détectée (PE Executable)"
    ],
    "warnings": [],
    "securityScore": 0
  }
}
```

**Business Logic**:
- Size validation (min/max selon type)
- MIME type validation (whitelist)
- Extension validation (.exe, .bat blacklist)
- Signature check (magic bytes detection)
- Security score (0-100, based on checks)
- Return validation result sans upload

---

### 2.4 DELETE /api/upload/:filePath

**Description**: Suppression fichier storage  
**Controller**: `UploadController.deleteFile()`  
**Service**: `UploadService.deleteFile()`

**Path Params**:
- `filePath` (string): Chemin fichier (URL-encoded)

**Response Example** (success):
```json
{
  "success": true,
  "message": "Fichier supprimé avec succès"
}
```

**Response Example** (not found):
```json
{
  "success": false,
  "message": "Impossible de supprimer le fichier",
  "error": "File not found: uploads/missing.jpg"
}
```

**Business Logic**:
1. Decode filePath (URL-encoded)
2. Delete from Supabase Storage
3. Record analytics (deletion success/fail)
4. Return success status

**Security**: Admin-only endpoint (require auth guard)

---

### 2.5 GET /api/upload/stats

**Description**: Statistiques uploads  
**Controller**: `UploadController.getStats()`  
**Service**: `UploadService.getUploadStats()`

**Query Params**: Aucun

**Response Example**:
```json
{
  "success": true,
  "data": {
    "todayUploads": 234,
    "totalSize": 12456789000,
    "averageSize": 53245,
    "byType": {
      "avatar": {
        "count": 45,
        "totalSize": 1234567
      },
      "document": {
        "count": 89,
        "totalSize": 8765432
      }
    },
    "topFolders": [
      { "folder": "avatars", "count": 45, "size": 1234567 },
      { "folder": "products", "count": 156, "size": 9876543 }
    ]
  }
}
```

**Business Logic**:
- Analytics aggregation (today uploads count)
- Total size calculation (all uploads)
- Average size per upload
- Breakdown by type (avatar, document, media)
- Top folders by usage

---

### 2.6 GET /api/upload/config/:type

**Description**: Configuration type upload  
**Controller**: `UploadController.getConfig()`  
**Service**: `FileValidationService` limits

**Path Params**:
- `type` (UploadType): Type config

**Response Example** (avatar):
```json
{
  "success": true,
  "data": {
    "uploadType": "avatar",
    "maxSize": 5242880,
    "maxSizeFormatted": "5MB",
    "allowedMimeTypes": [
      "image/jpeg",
      "image/png",
      "image/webp"
    ],
    "allowedExtensions": [
      ".jpg",
      ".jpeg",
      ".png",
      ".webp"
    ],
    "limits": {
      "maxFiles": 10,
      "maxTotalSize": 52428800
    }
  }
}
```

**Business Logic**:
- Fetch config from FileValidationService
- Format sizes human-readable (MB, KB)
- Return allowed MIME types + extensions
- Global limits (max files, max total size)

**Use Case**: Frontend form validation, user guidance

---

### 2.7 GET /api/upload/health

**Description**: Health check système upload  
**Controller**: `UploadController.healthCheck()`  
**Service**: `UploadService.healthCheck()`

**Query Params**: Aucun

**Response Example** (healthy):
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "services": {
      "storage": true,
      "validation": true,
      "analytics": true
    },
    "metrics": {
      "storageAvailable": true,
      "lastSuccessfulUpload": "2025-11-15T12:30:00Z",
      "failureRate": 0.02
    }
  }
}
```

**Response Example** (unhealthy):
```json
{
  "success": false,
  "status": "unhealthy",
  "data": {
    "status": "unhealthy",
    "services": {
      "storage": false,
      "validation": true,
      "analytics": true
    },
    "metrics": {
      "storageAvailable": false,
      "error": "Supabase connection timeout"
    }
  }
}
```

**Business Logic**:
- Test storage connectivity (ping Supabase)
- Check services status (validation, analytics)
- Calculate metrics (failure rate, last success)
- Return health status (healthy/degraded/unhealthy)

---

### 2.8 GET /api/upload/list

**Description**: Liste fichiers storage (admin)  
**Controller**: `UploadController.listFiles()`  
**Service**: `UploadService.listFiles()`

**Query Params**:
- `folder` (string, default: `uploads`): Folder path
- `limit` (number, default: `100`): Max results

**Response Example**:
```json
{
  "success": true,
  "data": {
    "files": [
      {
        "name": "1731672000123-image.jpg",
        "path": "uploads/1731672000123-image.jpg",
        "size": 245678,
        "createdAt": "2025-11-15T12:30:00Z",
        "mimeType": "image/jpeg",
        "url": "https://..."
      }
    ],
    "stats": {
      "totalFiles": 1542,
      "totalSize": 12456789000,
      "folder": "uploads"
    }
  }
}
```

**Business Logic**:
- List files from Supabase Storage folder
- Pagination (limit parameter)
- File metadata (size, date, MIME)
- Aggregate stats (total files, total size)

**Security**: Admin-only endpoint

---

## 3. Architecture Services

### 3.1 UploadService - 600 lignes

**Location**: `/backend/src/modules/upload/services/upload.service.ts`  
**Responsibility**: Orchestrateur principal upload

**Méthodes Clés**:

#### Upload Operations
```typescript
async uploadFile(file: Express.Multer.File, options: UploadOptions): Promise<FileUploadResult>
// Upload single avec validation + analytics

async uploadMultipleFiles(files: Express.Multer.File[], options: BulkUploadOptions): Promise<BulkUploadResult>
// Upload bulk avec error handling

async deleteFile(filePath: string): Promise<boolean>
// Delete from Supabase Storage
```

#### URL & List Operations
```typescript
async getSignedUrl(filePath: string, expiresInSeconds: number = 3600): Promise<string>
// Génère URL signée temporaire (private files)

async listFiles(folder: string, limit: number = 100): Promise<any[]>
// Liste fichiers folder

async getFileInfo(filePath: string): Promise<any>
// Get file metadata (size, type, date)
```

#### Validation & Stats
```typescript
async validateFile(file: Express.Multer.File, uploadType: UploadType): Promise<ValidationResult>
// Validate sans upload

async getUploadStats(): Promise<UploadStats>
// Analytics aggregation

async healthCheck(): Promise<HealthStatus>
// Health check all services
```

**Helper Methods**:
```typescript
private determineUploadFolder(customFolder?: string, uploadType?: UploadType): string
// Determine destination folder (avatars/, documents/, media/)

private testStorageHealth(): Promise<boolean>
// Test Supabase Storage connectivity
```

---

### 3.2 SupabaseStorageService - 200 lignes

**Location**: `/backend/src/modules/upload/services/supabase-storage.service.ts`  
**Responsibility**: Interaction Supabase Storage

**Méthodes**:
```typescript
async uploadFile(file: Express.Multer.File, folder: string): Promise<FileUploadResult>
// Upload to Supabase bucket
// Generate publicUrl or signedUrl

async deleteFile(filePath: string): Promise<boolean>
// Delete from bucket

async getSignedUrl(filePath: string, expiresIn: number): Promise<string>
// Generate temporary signed URL (private access)

async listFiles(folder: string, limit: number): Promise<any[]>
// List bucket folder contents

async getBucketInfo(): Promise<any>
// Bucket stats (size, file count)
```

**Configuration**:
```typescript
constructor(configService: ConfigService) {
  this.bucketName = configService.get<string>('SUPABASE_BUCKET_NAME', 'uploads');
  super(); // SupabaseBaseService init
}
```

---

### 3.3 FileValidationService - 500 lignes

**Location**: `/backend/src/modules/upload/services/file-validation.service.ts`  
**Responsibility**: Validation sécurité avancée

**Configuration Types**:
```typescript
private readonly defaultLimits = {
  [UploadType.AVATAR]: {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp']
  },
  [UploadType.DOCUMENT]: {
    maxSize: 50 * 1024 * 1024, // 50MB
    allowedMimeTypes: ['application/pdf', 'application/msword', ...],
    allowedExtensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx']
  },
  [UploadType.ATTACHMENT]: {
    maxSize: 100 * 1024 * 1024, // 100MB
    allowedMimeTypes: ['*'], // Permissif
    allowedExtensions: ['*']
  },
  [UploadType.MEDIA]: {
    maxSize: 200 * 1024 * 1024, // 200MB
    allowedMimeTypes: ['image/*', 'video/mp4', 'audio/mpeg', ...],
    allowedExtensions: ['.jpg', '.png', '.mp4', '.mp3', ...]
  }
};
```

**Dangerous Signatures Detection**:
```typescript
private readonly dangerousSignatures = [
  { name: 'PE Executable', signature: [0x4D, 0x5A] },          // .exe
  { name: 'ELF Executable', signature: [0x7F, 0x45, 0x4C, 0x46] }, // Linux binary
  { name: 'Java Class', signature: [0xCA, 0xFE, 0xBA, 0xBE] },    // .class
  { name: 'ZIP with executable', signature: [0x50, 0x4B, 0x03, 0x04] }
];
```

**Méthodes**:
```typescript
async validateFile(file: Express.Multer.File, uploadType: UploadType, customOptions?: ValidationOptions): Promise<ValidationResult>
// Validation complète: size, MIME, extension, signature
// Return: isValid, errors[], warnings[], securityScore (0-100)

async validateMultipleFiles(files: Express.Multer.File[], uploadType: UploadType): Promise<{ valid, invalid }>
// Batch validation (parallèle)

async isSuspiciousFile(file: Express.Multer.File): Promise<boolean>
// Quick suspicious check (score < 70)

private async validateSize(file, config, result): Promise<void>
// Check min/max size, detect empty files

private async validateMimeType(file, config, result): Promise<void>
// Check MIME against whitelist/blacklist

private async validateExtension(file, config, result): Promise<void>
// Check extension against whitelist

private async validateSignature(file, result): Promise<void>
// Magic bytes check (detect masqueraded files)
// Ex: .exe renamed to .jpg
```

**Security Scoring**:
- Start: 100 points
- Size violation: -20 points
- MIME mismatch: -30 points
- Extension blacklist: -50 points
- Dangerous signature: -100 points (immediate fail)
- Suspicious patterns: -10 to -30 points

---

### 3.4 ImageProcessingService - 300 lignes

**Location**: `/backend/src/modules/upload/services/image-processing.service.ts`  
**Responsibility**: Traitement images automatique

**Features**:
- Resize images (max width/height)
- Generate thumbnails (multiple sizes)
- Optimization (compression, quality)
- Format conversion (JPEG ↔ WebP)
- EXIF data extraction/removal

**Méthodes**:
```typescript
async processImage(file: Express.Multer.File, options?: ImageProcessOptions): Promise<ProcessedImage>
// Resize + optimize + thumbnails

async generateThumbnails(file: Express.Multer.File, sizes: ThumbnailSize[]): Promise<Thumbnail[]>
// Multiple sizes generation (small, medium, large)

async optimizeImage(buffer: Buffer, quality?: number): Promise<Buffer>
// Compression without visible loss

async convertFormat(buffer: Buffer, targetFormat: 'jpeg' | 'png' | 'webp'): Promise<Buffer>
// Format conversion

async extractExifData(file: Express.Multer.File): Promise<ExifData>
// Extract metadata (camera, date, GPS, etc.)

async removeExifData(buffer: Buffer): Promise<Buffer>
// Strip metadata (privacy)
```

**Library**: Sharp (high-performance image processing)

---

### 3.5 UploadAnalyticsService - 250 lignes

**Location**: `/backend/src/modules/upload/services/upload-analytics.service.ts`  
**Responsibility**: Analytics tracking & monitoring

**Méthodes**:
```typescript
async recordUploadSuccess(fileName: string, size: number, metadata: any): Promise<void>
// Log successful upload

async recordUploadFailure(fileName: string, reason: string, metadata: any): Promise<void>
// Log failed upload

async getUploadStats(period?: 'today' | 'week' | 'month'): Promise<UploadStats>
// Aggregate stats by period

async getTopFolders(limit: number): Promise<FolderStats[]>
// Most used folders

async getFailureRate(period?: string): Promise<number>
// Calculate failure rate percentage

async getAverageUploadTime(): Promise<number>
// Average duration (ms)
```

**Storage**: Redis (analytics:uploads:* keys, TTL 30 days)

---

### 3.6 UploadOptimizationService - 200 lignes

**Location**: `/backend/src/modules/upload/services/upload-optimization.service.ts`  
**Responsibility**: Performance optimization

**Features**:
- Concurrent uploads management (queue)
- Chunk upload (large files)
- Resume upload (interrupted transfers)
- CDN integration (URL rewrite)

**Méthodes**:
```typescript
async uploadWithRetry(file: Express.Multer.File, maxRetries: number): Promise<FileUploadResult>
// Retry logic with exponential backoff

async chunkedUpload(file: Express.Multer.File, chunkSize: number): Promise<FileUploadResult>
// Large files chunking (> 100MB)

async resumeUpload(uploadId: string, file: Express.Multer.File, offset: number): Promise<FileUploadResult>
// Resume interrupted upload

async optimizeConcurrentUploads(files: Express.Multer.File[], maxConcurrent: number): Promise<BulkUploadResult>
// Queue management (p-limit pattern)
```

---

## 4. Database Schema

### 4.1 Supabase Storage

**Bucket**: `uploads`  
**Public Access**: `true` (URLs publiques)  
**Max File Size**: 50MB (prod), 100MB (dev)

**Folder Structure**:
```
uploads/
├── avatars/                # User avatars
│   └── {userId}-{timestamp}.jpg
├── documents/              # PDF, Word, Excel
│   └── {timestamp}-{filename}.pdf
├── attachments/            # General attachments
│   └── {timestamp}-{filename}.*
├── media/                  # Videos, audio
│   └── {timestamp}-{filename}.mp4
├── products/               # Product images
│   ├── {productId}/
│   │   ├── main.jpg
│   │   ├── thumb-small.jpg
│   │   ├── thumb-medium.jpg
│   │   └── thumb-large.jpg
└── temp/                   # Temporary uploads (TTL 24h)
    └── {uploadId}/
```

---

### 4.2 Analytics Storage (Redis)

**Keys Pattern**:
```
analytics:uploads:success:today          → Counter today uploads
analytics:uploads:failure:today          → Counter today failures
analytics:uploads:size:today             → Total size uploaded today
analytics:uploads:by_type:{type}:count   → Count by type (avatar, document...)
analytics:uploads:by_folder:{folder}     → Count by folder
analytics:uploads:durations              → List upload durations (LPUSH)
analytics:uploads:top_folders            → Sorted set (ZADD folder score)
```

**TTL**: 30 days (auto-cleanup old analytics)

---

## 5. Frontend Integration

### 5.1 Upload Form Component

**Location**: `/frontend/app/components/upload/UploadForm.tsx`

**Features**:
- Drag & drop zone
- Progress bar (upload %)
- File preview (images)
- Validation feedback
- Multi-file support

**API Calls**:
```typescript
// Single upload
const uploadFile = async (file: File, type: UploadType) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(`/api/upload/single/${type}`, {
    method: 'POST',
    body: formData
  });
  
  return response.json();
};

// Validation preview
const validateFile = async (file: File, type: UploadType) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(`/api/upload/validate/${type}`, {
    method: 'POST',
    body: formData
  });
  
  return response.json();
};

// Get config limits
const getUploadConfig = async (type: UploadType) => {
  const response = await fetch(`/api/upload/config/${type}`);
  return response.json();
};
```

---

### 5.2 Image Upload Widget

**Location**: `/frontend/app/components/upload/ImageUploadWidget.tsx`

**Features**:
- Image crop (aspect ratio)
- Filters preview
- Compression slider
- Thumbnail preview

---

### 5.3 Admin Upload Manager

**Location**: `/frontend/app/routes/admin.uploads.tsx`

**Features**:
- File browser (list, search, delete)
- Bulk upload
- Stats dashboard (uploads count, size, types)
- Health check indicator

**API Calls**:
```typescript
// Stats
const { data: stats } = useSWR('/api/upload/stats');

// Health check
const { data: health } = useSWR('/api/upload/health', {
  refreshInterval: 10000
});

// List files
const listFiles = async (folder: string) => {
  const response = await fetch(`/api/upload/list?folder=${folder}`);
  return response.json();
};

// Delete file
const deleteFile = async (filePath: string) => {
  await fetch(`/api/upload/${encodeURIComponent(filePath)}`, {
    method: 'DELETE'
  });
};
```

---

## 6. Business Rules

### 6.1 Upload Types

**AVATAR**:
- Max size: 5MB
- Formats: JPEG, PNG, WebP
- Auto resize: 512x512px
- Thumbnails: 128x128, 256x256
- Destination: `avatars/`

**DOCUMENT**:
- Max size: 50MB
- Formats: PDF, Word, Excel
- No processing
- Destination: `documents/`

**ATTACHMENT**:
- Max size: 100MB
- Formats: Permissif (sauf executables)
- No processing
- Destination: `attachments/`

**MEDIA**:
- Max size: 200MB
- Formats: Images, videos, audio
- Image optimization
- Video thumbnails
- Destination: `media/`

---

### 6.2 Security Rules

**File Size Limits**:
- Global max: 100MB dev, 50MB prod
- Per type limits (voir 6.1)
- Empty file rejected (0 bytes)

**MIME Type Validation**:
- Whitelist per type
- Extension-MIME consistency check
- Signature verification (magic bytes)

**Dangerous Files Blacklist**:
- Extensions: `.exe`, `.bat`, `.cmd`, `.sh`, `.ps1`, `.vbs`, `.jar`, `.class`, `.dll`, `.so`
- Signatures: PE (Windows), ELF (Linux), Java Class
- ZIP with executable content

**Security Score Threshold**:
- Score >= 70: Upload allowed
- Score < 70: Upload rejected
- Score 0: Dangerous file (immediate block)

---

### 6.3 Storage Quotas

**Per User** (future):
- Free: 100MB total
- Pro: 10GB total
- Enterprise: Unlimited

**Per File Type**:
- Avatar: 1 per user (overwrite)
- Documents: Max 50 per user
- Attachments: Max 100 per user
- Media: Max 500 per user

---

### 6.4 Retention Policy

**Temporary Files**:
- TTL: 24h (auto-cleanup)
- Location: `temp/` folder
- Use case: Draft uploads, previews

**Permanent Files**:
- Retention: Indefinite (until manual delete)
- Backup: Supabase automatic backups
- CDN cache: 1h (public URLs)

---

## 7. Integration Modules

### 7.1 Users Module

**Use Case**: Avatar upload

**Integration**:
```typescript
// UsersService
async updateAvatar(userId: string, file: Express.Multer.File): Promise<User> {
  // 1. Upload avatar
  const result = await this.uploadService.uploadFile(file, {
    uploadType: UploadType.AVATAR,
    folder: `avatars`,
    customFileName: `${userId}-avatar`
  });
  
  // 2. Update user profile
  await this.usersRepository.update(userId, {
    avatar_url: result.url
  });
  
  return updatedUser;
}
```

---

### 7.2 Products Module

**Use Case**: Product images upload

**Integration**:
```typescript
// ProductsService
async uploadProductImages(productId: string, files: Express.Multer.File[]): Promise<ProductImage[]> {
  // 1. Bulk upload
  const result = await this.uploadService.uploadMultipleFiles(files, {
    uploadType: UploadType.MEDIA,
    folder: `products/${productId}`,
    generateThumbnails: true
  });
  
  // 2. Link images to product
  for (const file of result.successful) {
    await this.productsImagesRepository.create({
      product_id: productId,
      image_url: file.url,
      thumb_small: file.thumbnails?.small,
      thumb_medium: file.thumbnails?.medium,
      thumb_large: file.thumbnails?.large
    });
  }
  
  return images;
}
```

---

### 7.3 Blog Module

**Use Case**: Article images/attachments

**Integration**:
```typescript
// BlogService
async uploadArticleMedia(articleId: string, file: Express.Multer.File): Promise<Media> {
  const result = await this.uploadService.uploadFile(file, {
    uploadType: UploadType.MEDIA,
    folder: `blog/articles/${articleId}`
  });
  
  return {
    url: result.url,
    type: result.mimeType,
    size: result.size
  };
}
```

---

### 7.4 Orders Module

**Use Case**: Invoice/documents upload

**Integration**:
```typescript
// OrdersService
async attachInvoice(orderId: string, file: Express.Multer.File): Promise<void> {
  const result = await this.uploadService.uploadFile(file, {
    uploadType: UploadType.DOCUMENT,
    folder: `orders/${orderId}/invoices`
  });
  
  await this.ordersRepository.update(orderId, {
    invoice_url: result.url
  });
}
```

---

## 8. Error Handling

### 8.1 Upload Errors

**File Too Large**:
```json
{
  "success": false,
  "error": "Fichier trop volumineux: 75MB > 50MB",
  "code": "FILE_TOO_LARGE"
}
```

**Invalid MIME Type**:
```json
{
  "success": false,
  "error": "Type de fichier non autorisé: application/x-msdownload",
  "code": "INVALID_MIME_TYPE"
}
```

**Dangerous File**:
```json
{
  "success": false,
  "error": "Type de fichier dangereux détecté (PE Executable)",
  "code": "DANGEROUS_FILE",
  "securityScore": 0
}
```

---

### 8.2 Storage Errors

**Supabase Connection**:
```typescript
try {
  await this.supabaseStorageService.uploadFile(file, folder);
} catch (error) {
  if (error.message.includes('timeout')) {
    throw new HttpException(
      'Storage temporairement indisponible',
      HttpStatus.SERVICE_UNAVAILABLE
    );
  }
  throw error;
}
```

**Quota Exceeded** (future):
```json
{
  "success": false,
  "error": "Quota de stockage dépassé (100MB utilisés / 100MB max)",
  "code": "QUOTA_EXCEEDED"
}
```

---

### 8.3 Validation Errors

**Empty File**:
```json
{
  "success": false,
  "error": "Fichier vide détecté (0 bytes)",
  "code": "EMPTY_FILE"
}
```

**Extension Mismatch**:
```json
{
  "success": false,
  "error": "Extension ne correspond pas au contenu (.jpg détecté mais contenu est PNG)",
  "code": "EXTENSION_MISMATCH"
}
```

---

## 9. Performance

### 9.1 Upload Optimization

**Chunked Upload** (large files > 100MB):
```typescript
async uploadLargeFile(file: Express.Multer.File): Promise<FileUploadResult> {
  const chunkSize = 10 * 1024 * 1024; // 10MB chunks
  
  // Split file in chunks
  const chunks = Math.ceil(file.size / chunkSize);
  
  // Upload chunks sequentially
  for (let i = 0; i < chunks; i++) {
    const start = i * chunkSize;
    const end = Math.min((i + 1) * chunkSize, file.size);
    const chunk = file.buffer.slice(start, end);
    
    await this.uploadChunk(file.originalname, chunk, i, chunks);
  }
  
  // Finalize upload
  return this.finalizeUpload(file.originalname);
}
```

---

### 9.2 Concurrent Uploads

**Queue Management** (p-limit pattern):
```typescript
import pLimit from 'p-limit';

async uploadMultipleFiles(files: Express.Multer.File[]): Promise<BulkUploadResult> {
  const limit = pLimit(5); // Max 5 concurrent uploads
  
  const promises = files.map(file =>
    limit(() => this.uploadFile(file, options))
  );
  
  const results = await Promise.allSettled(promises);
  
  return this.aggregateBulkResults(results);
}
```

---

### 9.3 CDN Integration

**URL Rewrite** (Cloudflare/Fastly):
```typescript
private getCdnUrl(supabaseUrl: string): string {
  if (this.configService.get('CDN_ENABLED')) {
    const cdnDomain = this.configService.get('CDN_DOMAIN');
    const path = new URL(supabaseUrl).pathname;
    return `https://${cdnDomain}${path}`;
  }
  return supabaseUrl;
}
```

---

### 9.4 Image Optimization

**Sharp Configuration**:
```typescript
import sharp from 'sharp';

async optimizeImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(1920, 1080, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({ quality: 85, progressive: true })
    .toBuffer();
}
```

**Compression Levels**:
- High quality: 90-95% (products, blog)
- Standard: 80-85% (avatars, general)
- Low quality: 60-70% (thumbnails, previews)

---

## 10. Testing

### 10.1 Endpoint Tests

**Upload Single**:
```bash
curl -X POST http://localhost:3000/api/upload/single/avatar \
  -F "file=@avatar.jpg"
# Expected: { success: true, data: { url, size, ... } }
```

**Upload Multiple**:
```bash
curl -X POST http://localhost:3000/api/upload/multiple/media \
  -F "files=@image1.jpg" \
  -F "files=@image2.jpg" \
  -F "files=@video.mp4"
# Expected: { success: true, message: "3/3 fichiers uploadés" }
```

**Validate**:
```bash
curl -X POST http://localhost:3000/api/upload/validate/document \
  -F "file=@document.pdf"
# Expected: { success: true, data: { isValid: true, securityScore: 95 } }
```

**Delete**:
```bash
curl -X DELETE "http://localhost:3000/api/upload/uploads%2F1731672000123-file.jpg"
# Expected: { success: true, message: "Fichier supprimé avec succès" }
```

---

### 10.2 Service Tests

**Unit Tests**:
```typescript
describe('UploadService', () => {
  test('should upload file successfully', async () => {
    const file = createMockFile('test.jpg', 'image/jpeg');
    const result = await uploadService.uploadFile(file, {
      uploadType: UploadType.AVATAR
    });
    
    expect(result.url).toBeDefined();
    expect(result.size).toBe(file.size);
  });

  test('should reject dangerous file', async () => {
    const file = createMockFile('virus.exe', 'application/x-msdownload');
    
    await expect(
      uploadService.uploadFile(file, { uploadType: UploadType.ATTACHMENT })
    ).rejects.toThrow('Type de fichier dangereux');
  });

  test('should validate file without uploading', async () => {
    const file = createMockFile('test.jpg', 'image/jpeg');
    const result = await uploadService.validateFile(file, UploadType.AVATAR);
    
    expect(result.isValid).toBe(true);
    expect(result.securityScore).toBeGreaterThan(70);
  });
});
```

---

## 11. Migration Notes

### 11.1 Local Storage → Supabase

**Current State**: Some modules use local filesystem

**Migration Steps**:
1. Inventory local uploads (`/public/uploads/`)
2. Bulk upload to Supabase Storage
3. Update database URLs (local → Supabase)
4. Redirect old URLs (301 permanent)
5. Clean local files after verification

**Script Example**:
```typescript
async migrateLocalUploads() {
  const localFiles = await fs.readdir('/public/uploads/');
  
  for (const filename of localFiles) {
    const filePath = `/public/uploads/${filename}`;
    const buffer = await fs.readFile(filePath);
    
    // Upload to Supabase
    const result = await this.supabaseStorageService.uploadFile({
      buffer,
      originalname: filename,
      mimetype: mime.lookup(filename)
    }, 'uploads');
    
    // Update database
    await this.updateDatabaseUrls(filename, result.url);
    
    // Delete local (after verification)
    await fs.unlink(filePath);
  }
}
```

---

### 11.2 Multer Memory → Supabase Direct

**Current**: Multer stores in memory (buffer)  
**Future**: Direct upload to Supabase (streaming)

**Benefits**:
- Reduced memory usage
- Support larger files (> 500MB)
- Faster uploads (no intermediate storage)

**Implementation** (future):
```typescript
async uploadStream(stream: Readable, filename: string): Promise<FileUploadResult> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('end', async () => {
      const buffer = Buffer.concat(chunks);
      const result = await this.supabaseStorageService.uploadFile({
        buffer,
        originalname: filename
      }, 'uploads');
      resolve(result);
    });
    stream.on('error', reject);
  });
}
```

---

### 11.3 Analytics Storage

**Current**: In-memory (lost on restart)  
**Future**: Persistent storage (Redis + PostgreSQL)

**Schema** (PostgreSQL):
```sql
CREATE TABLE upload_analytics (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  upload_type VARCHAR(50),
  folder VARCHAR(255),
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  total_size BIGINT DEFAULT 0,
  average_duration INTEGER, -- ms
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_analytics_date ON upload_analytics(date);
CREATE INDEX idx_analytics_type ON upload_analytics(upload_type);
```

---

## 12. Summary

**Module Upload**: Système complet gestion fichiers avec Supabase Storage, validation sécurité, analytics.

**Endpoints**: 8 total
- POST /single/:type (upload unique)
- POST /multiple/:type (upload bulk)
- POST /validate/:type (validation sans upload)
- DELETE /:filePath (suppression)
- GET /stats (analytics)
- GET /config/:type (configuration)
- GET /health (health check)
- GET /list (list files admin)

**Architecture**:
- UploadService (600 lignes, orchestrator)
- SupabaseStorageService (200 lignes, storage operations)
- FileValidationService (500 lignes, security validation)
- ImageProcessingService (300 lignes, image optimization)
- UploadAnalyticsService (250 lignes, analytics tracking)
- UploadOptimizationService (200 lignes, performance)
- Total: ~2050 lignes

**Upload Types**:
- AVATAR: 5MB, images (JPEG/PNG/WebP), auto-resize 512x512
- DOCUMENT: 50MB, PDF/Word/Excel, no processing
- ATTACHMENT: 100MB, permissif (no executables)
- MEDIA: 200MB, images/videos/audio, optimization

**Security**:
- MIME validation (whitelist)
- Extension check (blacklist .exe, .bat...)
- Signature detection (magic bytes, PE/ELF executables)
- Security score (0-100, threshold 70)
- Empty file rejection

**Validation**:
- Size limits (per type)
- MIME-extension consistency
- Dangerous signatures detection
- Custom validators support

**Image Processing**:
- Auto-resize (max dimensions)
- Thumbnails generation (small/medium/large)
- Compression (quality 60-95%)
- Format conversion (JPEG/PNG/WebP)
- EXIF extraction/removal

**Storage**:
- Supabase Storage (bucket: uploads)
- Folder structure (avatars/, documents/, media/, products/)
- Public URLs (CDN-ready)
- Signed URLs (private access)

**Analytics**:
- Upload success/failure tracking
- Size aggregation (total, average)
- By type/folder stats
- Failure rate calculation
- Redis storage (TTL 30 days)

**Performance**:
- Chunked upload (files > 100MB)
- Concurrent uploads queue (p-limit)
- CDN integration
- Image optimization (Sharp)
- Batch validation

**Integration**:
- Users: avatar upload
- Products: images bulk upload + thumbnails
- Blog: article media/attachments
- Orders: invoices/documents

**Error Handling**:
- File too large (size limits)
- Invalid MIME type (whitelist)
- Dangerous file (executables, signatures)
- Storage errors (Supabase timeout)
- Quota exceeded (future)

**Testing**:
- Endpoint tests (curl upload/validate/delete)
- Unit tests (upload success, reject dangerous, validation)
- Integration tests (bulk upload, error handling)

**Migration**:
- Local storage → Supabase (bulk migration script)
- Multer memory → streaming (future optimization)
- Analytics persistence (Redis + PostgreSQL)

**Business Value**:
- Secure file uploads (malware protection)
- Automatic image optimization (bandwidth savings)
- Scalable storage (Supabase 100GB+)
- Analytics insights (upload patterns, failures)
- Admin control (file browser, deletion, stats)

**Coverage**: +1 module → 76% (26/37 modules)
**Lines**: ~1750 total documentation
