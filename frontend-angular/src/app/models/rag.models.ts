export interface HybridWeights {
  dense: number;
  sparse: number;
}

export interface QueryRequest {
  question: string;
  top_k?: number;
  retrieval_mode?: 'hybrid' | 'dense' | 'sparse';
  chunking_strategy?: 'structure_aware' | 'fixed' | 'semantic' | 'all';
  hybrid_weights?: HybridWeights;
  use_reranker?: boolean;
  verify_citations?: boolean;
}

export interface CitationInfo {
  citation_id: string;
  claim: string;
  chunk_id: string;
  source_file: string;
  section: string;
  verified: boolean;
  verdict: 'SUPPORTED' | 'UNSUPPORTED' | 'CONTRADICTED';
  reasoning: string;
  snippet: string;
}

export interface ConfidenceScores {
  composite: number;
  retrieval_relevance: number;
  citation_grounding: number;
  answer_completeness: number;
}

export interface RetrievedChunkInfo {
  chunk_id: string;
  text: string;
  source_path: string;
  section_title: string;
  chunk_index: number;
  token_count: number;
  dense_score?: number;
  sparse_score?: number;
  rrf_score?: number;
  rerank_score?: number;
}

export interface QueryResponse {
  question: string;
  answer: string;
  status: 'success' | 'low_confidence_fallback';
  confidence_scores: ConfidenceScores;
  citations: CitationInfo[];
  retrieved_chunks: RetrievedChunkInfo[];
  retrieved_chunks_count: number;
  processing_time_ms: number;
  fallback_report?: {
    status: string;
    message: string;
    question: string;
    confidence_scores: ConfidenceScores;
    searched_topics: string[];
    partially_relevant_documents: string[];
    recommended_action: string;
  };
}

export interface ChunkingCompareResponse {
  question: string;
  fixed_strategy_answer: QueryResponse;
  structure_aware_strategy_answer: QueryResponse;
  semantic_strategy_answer: QueryResponse;
}

export interface SystemStatusResponse {
  status: string;
  total_chunks_dense: number;
  total_chunks_sparse: number;
  embedding_model: string;
  llm_model: string;
  reranker_model: string;
}

export interface DocumentsResponse {
  total_indexed_chunks_dense: number;
  total_indexed_chunks_sparse: number;
  raw_documents_count: number;
  raw_documents: string[];
}
