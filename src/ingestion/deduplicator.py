from typing import List, Tuple
import numpy as np
from config.logging_config import logger
from src.ingestion.chunkers import DocumentChunk


class ChunkDeduplicator:
    """Near-duplicate deduplication gate based on cosine similarity thresholding."""

    def __init__(self, threshold: float = 0.95):
        self.threshold = threshold

    @staticmethod
    def cosine_similarity(v1: np.ndarray, v2: np.ndarray) -> float:
        norm1 = np.linalg.norm(v1)
        norm2 = np.linalg.norm(v2)
        if norm1 == 0 or norm2 == 0:
            return 0.0
        return float(np.dot(v1, v2) / (norm1 * norm2))

    def filter_batch(
        self,
        chunks: List[DocumentChunk],
        embeddings: List[List[float]],
        existing_embeddings: List[List[float]] = None
    ) -> Tuple[List[DocumentChunk], List[List[float]], int]:
        """
        Deduplicate chunks within the incoming batch and against existing index embeddings.
        Returns: (unique_chunks, unique_embeddings, duplicate_count)
        """
        if not chunks or not embeddings:
            return [], [], 0

        unique_chunks: List[DocumentChunk] = []
        unique_embeds: List[List[float]] = []
        seen_vectors: List[np.ndarray] = []

        if existing_embeddings is not None and len(existing_embeddings) > 0:
            for vec in existing_embeddings:
                seen_vectors.append(np.array(vec, dtype=float))

        duplicate_count = 0

        for chunk, emb in zip(chunks, embeddings):
            candidate_vec = np.array(emb, dtype=float)
            is_dup = False

            # Check against previously kept vectors
            for existing_vec in seen_vectors:
                sim = self.cosine_similarity(candidate_vec, existing_vec)
                if sim >= self.threshold:
                    is_dup = True
                    duplicate_count += 1
                    logger.debug(
                        f"Skipping duplicate chunk {chunk.chunk_id} (Sim: {sim:.4f} >= {self.threshold}) from {chunk.source_path}"
                    )
                    break

            if not is_dup:
                unique_chunks.append(chunk)
                unique_embeds.append(emb)
                seen_vectors.append(candidate_vec)

        if duplicate_count > 0:
            logger.info(f"Deduplication complete: {duplicate_count} near-duplicate chunks filtered out.")

        return unique_chunks, unique_embeds, duplicate_count
