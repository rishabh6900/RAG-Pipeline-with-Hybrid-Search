from fastapi import APIRouter
from config.settings import settings
from src.api.schemas import SystemStatusResponse
from src.retrieval.dense_store import DenseVectorStore
from src.retrieval.sparse_store import SparseBM25Store

router = APIRouter(tags=["Health"])

dense_store = DenseVectorStore()
sparse_store = SparseBM25Store()


@router.get("/healthz", response_model=SystemStatusResponse)
async def health_check():
    """System liveness and index health inspection."""
    return SystemStatusResponse(
        status="healthy",
        total_chunks_dense=dense_store.count(),
        total_chunks_sparse=sparse_store.count(),
        embedding_model=settings.EMBEDDING_MODEL,
        llm_model=settings.LLM_MODEL,
        reranker_model=settings.RERANKER_MODEL
    )
