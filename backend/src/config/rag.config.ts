/**
 * RAG Knowledge Path — configurable via environment variable.
 * Default: /opt/automecanik/rag/knowledge (DEV + PROD)
 */
export const RAG_KNOWLEDGE_PATH =
  process.env.RAG_KNOWLEDGE_PATH || '/opt/automecanik/rag/knowledge';
