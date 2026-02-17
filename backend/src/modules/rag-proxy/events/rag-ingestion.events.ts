export const RAG_INGESTION_COMPLETED = 'rag.ingestion.completed';

export interface RagIngestionCompletedEvent {
  jobId: string;
  source: 'pdf' | 'web';
  status: 'done' | 'failed';
  completedAt: number;
  affectedGammes: string[];
}
