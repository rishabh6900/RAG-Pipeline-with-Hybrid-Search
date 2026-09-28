import os
from pathlib import Path
from typing import Any, Dict, List, Optional
from config.logging_config import logger
from config.settings import settings
from src.ingestion.chunkers import DocumentChunk, get_chunker
from src.ingestion.deduplicator import ChunkDeduplicator
from src.ingestion.parsers import DocumentParser, ParsedDocument
from src.retrieval.dense_store import DenseVectorStore
from src.retrieval.sparse_store import SparseBM25Store


class IngestionPipeline:
    """End-to-end ingestion pipeline syncing multi-format docs into Dense and Sparse stores."""

    def __init__(
        self,
        dense_store: Optional[DenseVectorStore] = None,
        sparse_store: Optional[SparseBM25Store] = None,
        dedup_threshold: float = 0.95
    ):
        self.dense_store = dense_store or DenseVectorStore()
        self.sparse_store = sparse_store or SparseBM25Store()
        self.deduplicator = ChunkDeduplicator(threshold=dedup_threshold)

    def ingest_file(
        self,
        file_path: str | Path,
        strategy: str = "structure_aware"
    ) -> Dict[str, int]:
        """Ingest a single document file."""
        parsed = DocumentParser.parse_file(file_path)
        return self._process_parsed_documents([parsed], strategy=strategy)

    def ingest_directory(
        self,
        directory_path: str | Path,
        strategy: str = "structure_aware"
    ) -> Dict[str, int]:
        """Ingest all supported files within a directory."""
        dir_path = Path(directory_path)
        if not dir_path.exists():
            raise FileNotFoundError(f"Directory '{directory_path}' does not exist.")

        supported_extensions = {".md", ".mdx", ".html", ".htm", ".pdf", ".txt"}
        parsed_docs: List[ParsedDocument] = []

        for p in dir_path.rglob("*"):
            if p.is_file() and p.suffix.lower() in supported_extensions:
                try:
                    doc = DocumentParser.parse_file(p)
                    parsed_docs.append(doc)
                except Exception as e:
                    logger.error(f"Failed to parse {p}: {e}")

        logger.info(f"Parsed {len(parsed_docs)} documents from '{directory_path}'.")
        return self._process_parsed_documents(parsed_docs, strategy=strategy)

    def _process_parsed_documents(
        self,
        docs: List[ParsedDocument],
        strategy: str = "structure_aware"
    ) -> Dict[str, int]:
        """Chunk, deduplicate, and index documents scoped per strategy."""
        strategies = ["structure_aware", "fixed", "semantic"] if strategy == "all" else [strategy]
        
        total_chunks_count = 0
        total_indexed_count = 0
        total_dup_count = 0

        for strat in strategies:
            chunker = get_chunker(strat)
            strat_chunks: List[DocumentChunk] = []
            for doc in docs:
                chunks = chunker.chunk(
                    doc_id=doc.doc_id,
                    source_path=doc.source_path,
                    text=doc.cleaned_text,
                    initial_metadata={"title": doc.doc_title, "content_type": doc.content_type}
                )
                strat_chunks.extend(chunks)

            if not strat_chunks:
                continue

            total_chunks_count += len(strat_chunks)

            # Embed all chunks for this strategy
            texts = [c.text for c in strat_chunks]
            raw_embeddings = self.dense_store.embed_texts(texts)

            # Retrieve existing vectors for this specific strategy
            existing_embeds = self.dense_store.get_all_embeddings(strategy=strat)

            # Deduplicate strictly within the strategy domain
            unique_chunks, unique_embeds, dup_count = self.deduplicator.filter_batch(
                chunks=strat_chunks,
                embeddings=raw_embeddings,
                existing_embeddings=existing_embeds
            )

            total_dup_count += dup_count

            if unique_chunks:
                # Sync to Dense Qdrant Vector Collection
                self.dense_store.add_chunks(unique_chunks, embeddings=unique_embeds)
                # Sync to Sparse BM25
                self.sparse_store.add_chunks(unique_chunks)
                total_indexed_count += len(unique_chunks)

        logger.info(
            f"Ingestion summary: {total_chunks_count} total chunks, {total_indexed_count} unique indexed, {total_dup_count} duplicates skipped."
        )

        return {
            "total_documents": len(docs),
            "total_chunks": total_chunks_count,
            "indexed_chunks": total_indexed_count,
            "duplicates_skipped": total_dup_count
        }

    def delete_document(self, doc_name: str, delete_file: bool = True) -> Dict[str, Any]:
        """Delete a document from Qdrant vector store, BM25 index, and optionally data/raw disk."""
        clean_name = os.path.basename(doc_name)
        dense_deleted = self.dense_store.delete_document(clean_name)
        sparse_deleted = self.sparse_store.delete_document(clean_name)

        file_deleted = False
        if delete_file:
            raw_target = Path("./data/raw") / clean_name
            if raw_target.exists():
                try:
                    os.remove(raw_target)
                    file_deleted = True
                    logger.info(f"Deleted physical raw file: {raw_target}")
                except Exception as e:
                    logger.error(f"Could not delete physical file {raw_target}: {e}")

        return {
            "document": clean_name,
            "dense_vectors_deleted": dense_deleted,
            "sparse_chunks_deleted": sparse_deleted,
            "file_deleted": file_deleted
        }

    def clear_all(self, delete_raw_files: bool = False) -> Dict[str, Any]:
        """Purge all vectors in Qdrant collection, BM25 index, and optionally raw files."""
        self.dense_store.reset()
        self.sparse_store.reset()
        files_deleted = 0
        if delete_raw_files and os.path.exists("./data/raw"):
            for f in os.listdir("./data/raw"):
                p = os.path.join("./data/raw", f)
                if os.path.isfile(p):
                    try:
                        os.remove(p)
                        files_deleted += 1
                    except Exception:
                        pass
        return {
            "status": "cleared",
            "message": "Successfully purged all vector embeddings and lexical indices from Qdrant & BM25.",
            "files_deleted": files_deleted
        }



if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Hybrid RAG Document Ingestion CLI")
    parser.add_argument("--source-dir", type=str, default="./data/raw", help="Path to raw documents directory")
    parser.add_argument("--strategy", type=str, default="structure_aware", choices=["fixed", "structure_aware", "semantic"])
    args = parser.parse_args()

    pipeline = IngestionPipeline()
    os.makedirs(args.source_dir, exist_ok=True)
    res = pipeline.ingest_directory(args.source_dir, strategy=args.strategy)
    print("Ingestion Result:", res)
