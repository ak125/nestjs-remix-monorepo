export interface ContentRefreshJobData {
  refreshLogId: number;
  pgId: number;
  pgAlias: string;
  pageType: 'R1_pieces' | 'R3_conseils' | 'R3_guide_achat' | 'R4_reference';
}

export interface ContentRefreshResult {
  status: 'draft' | 'failed' | 'skipped' | 'auto_published';
  qualityScore: number;
  qualityFlags: string[];
  errorMessage?: string;
}
