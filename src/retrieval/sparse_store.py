import os
import pickle
import re
from typing import Any, Dict, List, Optional
import numpy as np
from rank_bm25 import BM25Okapi

from config.logging_config import logger
from config.settings import settings
from src.ingestion.chunkers import DocumentChunk


class SparseBM25Store:
    """Sparse keyword index utilizing BM25Okapi with technical identifier preservation."""

    def __init__(self, index_path: Optional[str] = None):
        self.index_path = index_path or settings.BM25_INDEX_PATH
        self.corpus_chunks: List[DocumentChunk] = []
        self.bm25: Optional[BM25Okapi] = None
        self.tokenized_corpus: List[List[str]] = []
        self._load_if_exists()

    @staticmethod
    def tokenize(text: str) -> List[str]:
        """
        Tokenize preserving technical terms, kebab-case, snake_case, URLs, and code tokens.
        """
        # Lowercase and extract alphanumeric tokens + underscore + hyphen + dot
        tokens = re.findall(r'[a-zA-Z0-9_\-\.\/]+', text.lower())
        # Filter out purely single punctuation marks
        return [t for t in tokens if len(t) > 1 or t.isalnum()]

    def build_index(self, chunks: List[DocumentChunk]) -> int:
        """Construct BM25 inverted index over the provided document chunks."""
        if not chunks:
            self.corpus_chunks = []
            self.bm25 = None
            self.tokenized_corpus = []
            return 0

        self.corpus_chunks = list(chunks)
        self.tokenized_corpus = [self.tokenize(c.text) for c in self.corpus_chunks]
        self.bm25 = BM25Okapi(self.tokenized_corpus)
        self.save()
        logger.info(f"Built BM25 index over {len(self.corpus_chunks)} chunks.")
        return len(self.corpus_chunks)

    def add_chunks(self, new_chunks: List[DocumentChunk]) -> int:
        """Incrementally append chunks and reconstruct index."""
        if not new_chunks:
            return len(self.corpus_chunks)

        existing_ids = {c.chunk_id for c in self.corpus_chunks}
        filtered_new = [c for c in new_chunks if c.chunk_id not in existing_ids]

        self.corpus_chunks.extend(filtered_new)
        return self.build_index(self.corpus_chunks)

    def search(self, query: str, top_k: int = 15, strategy: Optional[str] = None) -> List[Dict[str, Any]]:
        """Perform BM25 keyword retrieval, returning top-k scored chunks."""
        if not self.bm25 or not self.corpus_chunks:
            return []

        query_tokens = self.tokenize(query)
        if not query_tokens:
            return []

        scores = self.bm25.get_scores(query_tokens)
        
        # If all scores are zero, return empty
        if np.all(scores == 0):
            return []

        # Sort all indices by descending BM25 score
        sorted_indices = np.argsort(scores)[::-1]

        results: List[Dict[str, Any]] = []
        rank = 1
        for idx in sorted_indices:
            score = float(scores[idx])
            if score <= 0.0:
                continue
            chunk = self.corpus_chunks[idx]
            
            # Apply strategy filter if specified
            if strategy and chunk.strategy != strategy:
                continue

            results.append({
                "chunk_id": chunk.chunk_id,
                "text": chunk.text,
                "metadata": {
                    "doc_id": chunk.doc_id,
                    "source_path": chunk.source_path,
                    "section_title": chunk.section_title,
                    "chunk_index": chunk.chunk_index,
                    "strategy": chunk.strategy,
                    "token_count": chunk.token_count
                },
                "score": score,
                "rank": rank,
                "retrieval_type": "sparse"
            })
            rank += 1
            if len(results) >= top_k:
                break

        # Fallback to unfiltered if strategy filter returned zero results
        if not results and strategy:
            return self.search(query=query, top_k=top_k, strategy=None)

        return results

    def save(self):
        """Persist BM25 index and chunk corpus to disk."""
        os.makedirs(os.path.dirname(os.path.abspath(self.index_path)), exist_ok=True)
        data = {
            "corpus_chunks": self.corpus_chunks,
            "tokenized_corpus": self.tokenized_corpus
        }
        with open(self.index_path, "wb") as f:
            pickle.dump(data, f)
        logger.debug(f"Saved BM25 index to {self.index_path}")

    def _load_if_exists(self):
        """Load serialized BM25 index if present on disk."""
        if os.path.exists(self.index_path):
            try:
                with open(self.index_path, "rb") as f:
                    data = pickle.load(f)
                self.corpus_chunks = data.get("corpus_chunks", [])
                self.tokenized_corpus = data.get("tokenized_corpus", [])
                if self.tokenized_corpus:
                    self.bm25 = BM25Okapi(self.tokenized_corpus)
                logger.info(f"Loaded BM25 index with {len(self.corpus_chunks)} chunks from {self.index_path}")
            except Exception as e:
                logger.warning(f"Could not load BM25 index from {self.index_path}: {e}")

    def count(self) -> int:
        return len(self.corpus_chunks)

    def reset(self):
        self.corpus_chunks = []
        self.bm25 = None
        self.tokenized_corpus = []
        if os.path.exists(self.index_path):
            os.remove(self.index_path)
