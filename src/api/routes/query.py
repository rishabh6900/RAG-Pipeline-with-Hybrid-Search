from fastapi import APIRouter, HTTPException
from config.logging_config import logger
from src.api.schemas import (
    ChunkingCompareResponse,
    QueryRequest,
    QueryResponse,
)
from src.generation.langchain_pipeline import LangChainRAGPipeline

router = APIRouter(prefix="/v1", tags=["Query"])

# Initialize LangChain RAG pipeline singleton
rag_pipeline = LangChainRAGPipeline()


def execute_rag_pipeline(req: QueryRequest) -> QueryResponse:
    """Invokes the LangChain RAG pipeline for the given request."""
    return rag_pipeline.execute_query(req)


@router.post("/ask", response_model=QueryResponse)
async def ask_question(request: QueryRequest):
    """Main RAG query endpoint with LangChain hybrid search, citations, and confidence scoring."""
    try:
        return execute_rag_pipeline(request)
    except Exception as e:
        logger.error(f"Error handling query: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chunking/compare", response_model=ChunkingCompareResponse)
async def compare_chunking_strategies(request: QueryRequest):
    """Executes the query across all 3 chunking strategies side-by-side using LangChain."""
    try:
        # Clone requests for each strategy
        req_fixed = request.model_copy(update={"chunking_strategy": "fixed"})
        req_struct = request.model_copy(update={"chunking_strategy": "structure_aware"})
        req_sem = request.model_copy(update={"chunking_strategy": "semantic"})

        ans_fixed = execute_rag_pipeline(req_fixed)
        ans_struct = execute_rag_pipeline(req_struct)
        ans_sem = execute_rag_pipeline(req_sem)

        return ChunkingCompareResponse(
            question=request.question,
            fixed_strategy_answer=ans_fixed,
            structure_aware_strategy_answer=ans_struct,
            semantic_strategy_answer=ans_sem
        )
    except Exception as e:
        logger.error(f"Error during chunking comparison: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
