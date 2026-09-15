"""
LangChain RAG Pipeline Implementation.
Utilizes modern modular LangChain components (LCEL, ChatGroq, ChatOpenAI, QdrantVectorStore, BM25, EnsembleRetriever)
for end-to-end grounded retrieval-augmented generation.
"""

import time
from typing import Any, Dict, List, Optional, Union
from config.logging_config import logger
from config.settings import settings
from src.api.schemas import (
    CitationInfo,
    ConfidenceScores,
    QueryRequest,
    QueryResponse,
    RetrievedChunkInfo,
)
from src.generation.citation_verifier import CitationVerifier
from src.generation.confidence_scorer import ConfidenceScorer
from src.generation.prompt_templates import (
    GROUNDED_GENERATION_SYSTEM_PROMPT,
    GROUNDED_GENERATION_USER_TEMPLATE,
    format_context_blocks,
)
from src.retrieval.dense_store import DenseVectorStore
from src.retrieval.fusion import FusionEngine
from src.retrieval.reranker import CrossEncoderReranker
from src.retrieval.sparse_store import SparseBM25Store

# Optional modular LangChain imports with graceful fallbacks
try:
    from langchain_core.prompts import ChatPromptTemplate
    from langchain_core.output_parsers import StrOutputParser
    from langchain_core.runnables import RunnablePassthrough
    from langchain_core.documents import Document
    _HAS_LANGCHAIN_CORE = True
except ImportError:
    _HAS_LANGCHAIN_CORE = False

try:
    from langchain_groq import ChatGroq
    _HAS_LANGCHAIN_GROQ = True
except ImportError:
    _HAS_LANGCHAIN_GROQ = False

try:
    from langchain_openai import ChatOpenAI
    _HAS_LANGCHAIN_OPENAI = True
except ImportError:
    _HAS_LANGCHAIN_OPENAI = False


def clean_model_name(raw: Optional[str]) -> str:
    if not raw:
        return "llama-3.3-70b-versatile"
    raw = raw.strip()
    if raw.lower().startswith("groq:"):
        return raw[5:].strip()
    return raw


def get_langchain_chat_model(model_name: Optional[str] = None, temperature: float = 0.0) -> Optional[Any]:
    """Factory creating a LangChain Chat Model (ChatGroq or ChatOpenAI)."""
    clean_model = clean_model_name(model_name or settings.LLM_MODEL)

    # Priority 1: Groq
    if settings.GROQ_API_KEY:
        if _HAS_LANGCHAIN_GROQ:
            try:
                return ChatGroq(
                    groq_api_key=settings.GROQ_API_KEY,
                    model_name=clean_model,
                    temperature=temperature,
                    max_tokens=800
                )
            except Exception as e:
                logger.warning(f"Failed to instantiate ChatGroq ({e}), trying ChatOpenAI with Groq base URL...")

        if _HAS_LANGCHAIN_OPENAI:
            try:
                return ChatOpenAI(
                    api_key=settings.GROQ_API_KEY,
                    base_url=settings.GROQ_BASE_URL or "https://api.groq.com/openai/v1",
                    model_name=clean_model,
                    temperature=temperature,
                    max_tokens=800
                )
            except Exception as e:
                logger.warning(f"Failed to instantiate ChatOpenAI for Groq: {e}")

    # Priority 2: OpenAI
    elif settings.OPENAI_API_KEY and _HAS_LANGCHAIN_OPENAI:
        try:
            return ChatOpenAI(
                api_key=settings.OPENAI_API_KEY,
                base_url=settings.OPENAI_BASE_URL,
                model_name=clean_model,
                temperature=temperature,
                max_tokens=800
            )
        except Exception as e:
            logger.warning(f"Failed to instantiate ChatOpenAI: {e}")

    return None


class LangChainRAGPipeline:
    """
    Modular LangChain RAG Pipeline combining:
    - Dense Vector Search (Qdrant)
    - Sparse Keyword Search (BM25)
    - Hybrid Reciprocal Rank Fusion
    - Cross-Encoder Reranking
    - LCEL Prompt & Generation Chain (ChatGroq / ChatOpenAI)
    - LLM-as-a-judge Citation Verification & Composite Confidence Scoring
    """

    def __init__(
        self,
        dense_store: Optional[DenseVectorStore] = None,
        sparse_store: Optional[SparseBM25Store] = None,
        fusion_engine: Optional[FusionEngine] = None,
        reranker: Optional[CrossEncoderReranker] = None,
        citation_verifier: Optional[CitationVerifier] = None,
        confidence_scorer: Optional[ConfidenceScorer] = None,
    ):
        self.dense_store = dense_store or DenseVectorStore()
        self.sparse_store = sparse_store or SparseBM25Store()
        self.fusion_engine = fusion_engine or FusionEngine()
        self.reranker = reranker or CrossEncoderReranker()
        self.citation_verifier = citation_verifier or CitationVerifier()
        self.confidence_scorer = confidence_scorer or ConfidenceScorer()

        self.llm = get_langchain_chat_model()
        self.chain = self._build_lcel_chain()

    def _build_lcel_chain(self) -> Optional[Any]:
        """Constructs an LCEL (LangChain Expression Language) prompt chain."""
        if not _HAS_LANGCHAIN_CORE or not self.llm:
            return None

        try:
            prompt = ChatPromptTemplate.from_messages([
                ("system", GROUNDED_GENERATION_SYSTEM_PROMPT),
                ("human", GROUNDED_GENERATION_USER_TEMPLATE)
            ])
            # LCEL: Prompt | LLM | StrOutputParser
            chain = prompt | self.llm | StrOutputParser()
            logger.info("Successfully constructed LangChain LCEL RAG Chain.")
            return chain
        except Exception as e:
            logger.warning(f"Could not build LCEL chain: {e}")
            return None

    def retrieve(
        self,
        question: str,
        retrieval_mode: str = "hybrid",
        chunking_strategy: Optional[str] = "structure_aware",
        hybrid_weights: Optional[Any] = None,
        top_k: int = 15
    ) -> List[Dict[str, Any]]:
        """Executes dense, sparse, or hybrid retrieval."""
        dense_results: List[Dict[str, Any]] = []
        sparse_results: List[Dict[str, Any]] = []

        where_filter = {"strategy": chunking_strategy} if chunking_strategy and chunking_strategy != "all" else None

        if retrieval_mode in ["dense", "hybrid"]:
            dense_results = self.dense_store.search(question, top_k=top_k, where_filter=where_filter)
            # If filtered search returned empty, fall back to general dense search
            if not dense_results and where_filter:
                dense_results = self.dense_store.search(question, top_k=top_k, where_filter=None)

        if retrieval_mode in ["sparse", "hybrid"]:
            strat = where_filter.get("strategy") if where_filter else None
            sparse_results = self.sparse_store.search(question, top_k=top_k, strategy=strat)

        if retrieval_mode == "hybrid":
            w_dense = getattr(hybrid_weights, "dense", 0.70) if hybrid_weights else 0.70
            w_sparse = getattr(hybrid_weights, "sparse", 0.30) if hybrid_weights else 0.30
            return self.fusion_engine.fuse(
                dense_results, sparse_results, top_k=20,
                dense_weight=w_dense, sparse_weight=w_sparse
            )
        elif retrieval_mode == "dense":
            return dense_results[:20]
        else:
            return sparse_results[:20]

    def generate_answer(self, question: str, retrieved_chunks: List[Dict[str, Any]]) -> str:
        """Generates answer using the LangChain LCEL chain or fallback generator."""
        if not retrieved_chunks:
            return "No relevant internal documentation was found to answer this question."

        formatted_context = format_context_blocks(retrieved_chunks)

        if self.chain:
            try:
                answer = self.chain.invoke({
                    "formatted_context": formatted_context,
                    "question": question
                })
                return str(answer).strip()
            except Exception as e:
                logger.warning(f"LangChain LCEL chain invocation failed ({e}). Falling back to generator...")

        from src.generation.generator import GroundedGenerator
        gen = GroundedGenerator()
        return gen.generate_answer(question, retrieved_chunks)

    def execute_query(self, req: QueryRequest) -> QueryResponse:
        """End-to-end execution of the LangChain RAG pipeline returning standardized QueryResponse."""
        t0 = time.perf_counter()

        # Step 1: Retrieval (Dense, Sparse, or Hybrid)
        candidates = self.retrieve(
            question=req.question,
            retrieval_mode=req.retrieval_mode,
            chunking_strategy=req.chunking_strategy,
            hybrid_weights=req.hybrid_weights,
            top_k=15
        )

        # Step 2: Reranking (Cross-Encoder)
        if req.use_reranker and candidates:
            final_chunks = self.reranker.rerank(req.question, candidates, top_k=req.top_k)
        else:
            final_chunks = candidates[:req.top_k]

        # Step 3: LangChain Generation
        answer = self.generate_answer(req.question, final_chunks)

        # Step 4: Verification & Confidence Scoring
        verified_citations = []
        grounding_score = 1.0

        if req.verify_citations and final_chunks:
            verified_citations, grounding_score = self.citation_verifier.verify_answer_citations(
                answer, final_chunks
            )

        confidence = self.confidence_scorer.compute_composite_confidence(
            req.question, answer, final_chunks, grounding_score
        )

        fallback_report = None
        status = "success"
        if confidence["composite"] < self.confidence_scorer.threshold:
            status = "low_confidence_fallback"
            fallback_report = self.confidence_scorer.generate_graceful_fallback(
                req.question, final_chunks, confidence
            )

        elapsed_ms = round((time.perf_counter() - t0) * 1000.0, 2)

        # Format output structures for frontend
        output_chunks: List[RetrievedChunkInfo] = []
        for c in final_chunks:
            meta = c.get("metadata", {})
            output_chunks.append(RetrievedChunkInfo(
                chunk_id=c.get("chunk_id", ""),
                text=c.get("text", ""),
                source_path=meta.get("source_path", "unknown"),
                section_title=meta.get("section_title", "General"),
                chunk_index=meta.get("chunk_index", 0),
                token_count=meta.get("token_count", 0),
                dense_score=c.get("dense_score"),
                sparse_score=c.get("sparse_score"),
                rrf_score=c.get("rrf_score"),
                rerank_score=c.get("rerank_score")
            ))

        output_citations: List[CitationInfo] = [
            CitationInfo(
                citation_id=str(c["citation_id"]),
                claim=c["claim"],
                chunk_id=c["chunk_id"],
                source_file=c["source_file"].replace('\\', '/').split('/')[-1] if c.get("source_file") else "document",
                section=c["section"],
                verified=c["verified"],
                verdict=c["verdict"],
                reasoning=c["reasoning"],
                snippet=c["snippet"]
            )
            for c in verified_citations
        ]

        return QueryResponse(
            question=req.question,
            answer=answer,
            status=status,
            confidence_scores=ConfidenceScores(**confidence),
            citations=output_citations,
            retrieved_chunks=output_chunks,
            retrieved_chunks_count=len(output_chunks),
            processing_time_ms=elapsed_ms,
            fallback_report=fallback_report
        )
