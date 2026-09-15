from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field


class HybridWeights(BaseModel):
    dense: float = Field(default=0.70, ge=0.0, le=1.0, description="Weight multiplier for dense vector retrieval")
    sparse: float = Field(default=0.30, ge=0.0, le=1.0, description="Weight multiplier for sparse BM25 retrieval")


class QueryRequest(BaseModel):
    question: str = Field(..., min_length=2, description="The user query or technical question")
    top_k: int = Field(default=5, ge=1, le=20, description="Number of final context chunks to retrieve")
    retrieval_mode: str = Field(default="hybrid", description="Retrieval mode: 'hybrid', 'dense', or 'sparse'")
    chunking_strategy: Optional[str] = Field(default="structure_aware", description="Chunking strategy filter: 'fixed', 'structure_aware', 'semantic'")
    hybrid_weights: Optional[HybridWeights] = Field(default_factory=HybridWeights)
    use_reranker: bool = Field(default=True, description="Enable Cross-Encoder Stage-2 reranking")
    verify_citations: bool = Field(default=True, description="Enable LLM-as-a-judge citation claim verification")


class CitationInfo(BaseModel):
    citation_id: Union[str, int]
    claim: str
    chunk_id: str
    source_file: str
    section: str
    verified: bool
    verdict: str
    reasoning: str
    snippet: str


class ConfidenceScores(BaseModel):
    composite: float
    retrieval_relevance: float
    citation_grounding: float
    answer_completeness: float


class RetrievedChunkInfo(BaseModel):
    chunk_id: str
    text: str
    source_path: str
    section_title: str
    chunk_index: int
    token_count: int
    dense_score: Optional[float] = None
    sparse_score: Optional[float] = None
    rrf_score: Optional[float] = None
    rerank_score: Optional[float] = None


class QueryResponse(BaseModel):
    question: str
    answer: str
    status: str = "success"
    confidence_scores: ConfidenceScores
    citations: List[CitationInfo]
    retrieved_chunks: List[RetrievedChunkInfo]
    retrieved_chunks_count: int
    processing_time_ms: float
    fallback_report: Optional[Dict[str, Any]] = None


class ChunkingCompareResponse(BaseModel):
    question: str
    fixed_strategy_answer: QueryResponse
    structure_aware_strategy_answer: QueryResponse
    semantic_strategy_answer: QueryResponse


class IngestResponse(BaseModel):
    status: str = "success"
    message: str
    total_documents: int
    total_chunks: int
    indexed_chunks: int
    duplicates_skipped: int


class DocumentSummary(BaseModel):
    doc_id: str
    source_path: str
    title: str
    content_type: str
    chunk_count: int


class SystemStatusResponse(BaseModel):
    status: str
    total_chunks_dense: int
    total_chunks_sparse: int
    embedding_model: str
    llm_model: str
    reranker_model: str
