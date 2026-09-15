import os
import shutil
import tempfile
from pathlib import Path
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from config.logging_config import logger
from src.api.schemas import IngestResponse
from src.ingestion.pipeline import IngestionPipeline

router = APIRouter(prefix="/v1", tags=["Documents"])
pipeline = IngestionPipeline()


@router.post("/ingest/sync-raw", response_model=IngestResponse)
async def sync_raw_documents(strategy: str = "all", reset_first: bool = False):
    """Ingest and dual-index all files currently in the data/raw folder."""
    try:
        if reset_first:
            pipeline.dense_store.reset()
            pipeline.sparse_store.reset()
            logger.info("Stores reset before syncing raw documents.")

        os.makedirs("./data/raw", exist_ok=True)
        res = pipeline.ingest_directory("./data/raw", strategy=strategy)
        return IngestResponse(
            status="success",
            message=f"Successfully synchronized and indexed all files in './data/raw' using strategy '{strategy}'.",
            total_documents=res.get("total_documents", 0),
            total_chunks=res.get("total_chunks", 0),
            indexed_chunks=res.get("indexed_chunks", 0),
            duplicates_skipped=res.get("duplicates_skipped", 0)
        )
    except Exception as e:
        logger.error(f"Failed to sync raw directory: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ingest", response_model=IngestResponse)
async def ingest_document(
    file: UploadFile = File(...),
    strategy: str = Form(default="all")
):
    """Ingest a multi-format document (PDF, Markdown, HTML, Text) into the dual indices."""
    temp_dir = tempfile.mkdtemp()
    try:
        os.makedirs("./data/raw", exist_ok=True)
        raw_target = Path("./data/raw") / file.filename
        with open(raw_target, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        res = pipeline.ingest_file(raw_target, strategy=strategy)

        return IngestResponse(
            status="success",
            message=f"Successfully ingested and indexed '{file.filename}' using strategy '{strategy}'.",
            total_documents=1,
            total_chunks=res["total_chunks"],
            indexed_chunks=res["indexed_chunks"],
            duplicates_skipped=res["duplicates_skipped"]
        )
    except Exception as e:
        logger.error(f"Failed to ingest file: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@router.get("/documents")
async def list_documents():
    """List indexed documents, chunk counts, and system status."""
    try:
        dense_count = pipeline.dense_store.count()
        sparse_count = pipeline.sparse_store.count()
        
        raw_files = []
        if os.path.exists("./data/raw"):
            raw_files = [f for f in os.listdir("./data/raw") if os.path.isfile(os.path.join("./data/raw", f))]

        return {
            "total_indexed_chunks_dense": dense_count,
            "total_indexed_chunks_sparse": sparse_count,
            "raw_documents_count": len(raw_files),
            "raw_documents": raw_files
        }
    except Exception as e:
        logger.error(f"Error listing documents: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
