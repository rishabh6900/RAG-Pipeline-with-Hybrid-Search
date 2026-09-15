from typing import Any, Dict, List, Optional
from config.logging_config import logger


class FusionEngine:
    """Combines Dense Vector and Sparse BM25 retrieval lists via Reciprocal Rank Fusion (RRF)."""

    def __init__(self, rrf_k: int = 60, dense_weight: float = 0.70, sparse_weight: float = 0.30):
        self.rrf_k = rrf_k
        self.dense_weight = dense_weight
        self.sparse_weight = sparse_weight

    def fuse(
        self,
        dense_results: List[Dict[str, Any]],
        sparse_results: List[Dict[str, Any]],
        top_k: int = 20,
        dense_weight: Optional[float] = None,
        sparse_weight: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """
        Merge two ranked result sets into a unified list ranked by RRF score.
        """
        w_dense = self.dense_weight if dense_weight is None else dense_weight
        w_sparse = self.sparse_weight if sparse_weight is None else sparse_weight

        doc_pool: Dict[str, Dict[str, Any]] = {}
        rrf_scores: Dict[str, float] = {}

        # Process Dense results
        for rank, item in enumerate(dense_results, start=1):
            chunk_id = item["chunk_id"]
            dense_contribution = w_dense / (self.rrf_k + rank)
            
            if chunk_id not in doc_pool:
                doc_pool[chunk_id] = {
                    "chunk_id": chunk_id,
                    "text": item["text"],
                    "metadata": item["metadata"],
                    "dense_rank": rank,
                    "dense_score": item.get("score", 0.0),
                    "sparse_rank": None,
                    "sparse_score": 0.0
                }
                rrf_scores[chunk_id] = dense_contribution
            else:
                doc_pool[chunk_id]["dense_rank"] = rank
                doc_pool[chunk_id]["dense_score"] = item.get("score", 0.0)
                rrf_scores[chunk_id] += dense_contribution

        # Process Sparse results
        for rank, item in enumerate(sparse_results, start=1):
            chunk_id = item["chunk_id"]
            sparse_contribution = w_sparse / (self.rrf_k + rank)
            
            if chunk_id not in doc_pool:
                doc_pool[chunk_id] = {
                    "chunk_id": chunk_id,
                    "text": item["text"],
                    "metadata": item["metadata"],
                    "dense_rank": None,
                    "dense_score": 0.0,
                    "sparse_rank": rank,
                    "sparse_score": item.get("score", 0.0)
                }
                rrf_scores[chunk_id] = sparse_contribution
            else:
                doc_pool[chunk_id]["sparse_rank"] = rank
                doc_pool[chunk_id]["sparse_score"] = item.get("score", 0.0)
                rrf_scores[chunk_id] += sparse_contribution

        # Sort all chunks by descending RRF score
        sorted_chunk_ids = sorted(rrf_scores.keys(), key=lambda cid: rrf_scores[cid], reverse=True)

        fused_results: List[Dict[str, Any]] = []
        for new_rank, chunk_id in enumerate(sorted_chunk_ids[:top_k], start=1):
            entry = doc_pool[chunk_id]
            entry["rrf_score"] = float(rrf_scores[chunk_id])
            entry["fused_rank"] = new_rank
            fused_results.append(entry)

        logger.debug(f"Fused {len(dense_results)} dense and {len(sparse_results)} sparse items into {len(fused_results)} candidates.")
        return fused_results
