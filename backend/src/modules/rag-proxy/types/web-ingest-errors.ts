/**
 * Structured error codes for web ingestion pipeline.
 * Replaces fragile string-pattern matching in rag-ingestion.service.ts.
 */

export enum WebIngestErrorCode {
  // Step 1: URL fetch + content extraction
  NO_SECTIONS = 'NO_SECTIONS',
  FETCH_TIMEOUT = 'FETCH_TIMEOUT',
  FETCH_NETWORK = 'FETCH_NETWORK',
  SCRIPT_ERROR = 'SCRIPT_ERROR',

  // Step 2: Output detection
  EMPTY_OUTPUT = 'EMPTY_OUTPUT',
  OUTPUT_DETECTION = 'OUTPUT_DETECTION',

  // Step 4: Reindex
  FLOCK_CONTENTION = 'FLOCK_CONTENTION',
  REINDEX_FAILED = 'REINDEX_FAILED',

  // Step 5b: DB sync
  DB_SYNC_FAILED = 'DB_SYNC_FAILED',
}

export const ERROR_LABELS: Record<WebIngestErrorCode, string> = {
  [WebIngestErrorCode.NO_SECTIONS]: 'No sections extracted from URL',
  [WebIngestErrorCode.FETCH_TIMEOUT]: 'URL fetch timed out (site unreachable)',
  [WebIngestErrorCode.FETCH_NETWORK]: 'URL fetch failed (network/HTTP error)',
  [WebIngestErrorCode.SCRIPT_ERROR]: 'ingest_web.py script error',
  [WebIngestErrorCode.EMPTY_OUTPUT]:
    'Empty output directory — no .md files produced',
  [WebIngestErrorCode.OUTPUT_DETECTION]: 'Output detection failed',
  [WebIngestErrorCode.FLOCK_CONTENTION]:
    'Another RAG operation already running (flock contention)',
  [WebIngestErrorCode.REINDEX_FAILED]: 'Reindex failed',
  [WebIngestErrorCode.DB_SYNC_FAILED]: 'Database sync failed',
};

/**
 * Classify an ingestion error based on step number and recent log lines.
 * Centralised logic — previously inline in catch blocks.
 */
export function classifyIngestError(
  step: number,
  logLines: string[],
): WebIngestErrorCode {
  const lastLogs = logLines.slice(-5).join(' ').toLowerCase();

  if (step === 1) {
    if (lastLogs.includes('no sections')) return WebIngestErrorCode.NO_SECTIONS;
    if (lastLogs.includes('timed out')) return WebIngestErrorCode.FETCH_TIMEOUT;
    if (
      lastLogs.includes('connectionerror') ||
      lastLogs.includes('httperror') ||
      lastLogs.includes('urlopen error') ||
      lastLogs.includes('fetch failed')
    )
      return WebIngestErrorCode.FETCH_NETWORK;
    return WebIngestErrorCode.SCRIPT_ERROR;
  }

  if (step === 2) {
    return WebIngestErrorCode.OUTPUT_DETECTION;
  }

  if (step === 4) {
    if (lastLogs.includes('global lock'))
      return WebIngestErrorCode.FLOCK_CONTENTION;
    return WebIngestErrorCode.REINDEX_FAILED;
  }

  return WebIngestErrorCode.SCRIPT_ERROR;
}
