from typing import Any, Dict, List, Optional
from config.logging_config import logger
from config.settings import settings

try:
    from sentence_transformers import CrossEncoder
except ImportError:
    CrossEncoder = None


class CrossEncoderReranker:
    """Stage-2 Cross-Encoder Reranker evaluating query-chunk cross attention."""

    def __init__(self, model_name: Optional[str] = None):
        self.model_name = model_name or settings.RERANKER_MODEL
        self.model = None
        self._load_model()

    def _load_model(self):
        if CrossEncoder is not None:
            try:
                self.model = CrossEncoder(self.model_name)
                logger.info(f"Loaded CrossEncoder model '{self.model_name}'.")
            except Exception as e:
                logger.warning(f"Could not load CrossEncoder model '{self.model_name}': {e}. Using fallback heuristic reranker.")
        else:
            logger.info("sentence_transformers.CrossEncoder not found. Using fallback lexical-semantic reranker.")

    def _fallback_score(self, query: str, text: str) -> float:
        """Lightweight token-overlap and character-level alignment fallback scorer."""
        q_words = set(query.lower().split())
        t_words = set(text.lower().split())
        if not q_words or not t_words:
            return 0.0

        intersection = q_words.intersection(t_words)
        jaccard = len(intersection) / len(q_words.union(t_words))
        query_coverage = len(intersection) / len(q_words)
        
        # Exact substring reward
        substr_reward = 0.2 if query.lower() in text.lower() else 0.0
        return (0.6 * query_coverage) + (0.2 * jaccard) + substr_reward

    def rerank(self, query: str, candidates: List[Dict[str, Any]], top_k: int = 5) -> List[Dict[str, Any]]:
        """
        Rerank a pool of candidate chunks using Cross-Encoder logits.
        """
        if not candidates:
            return []

        pairs = [[query, c["text"]] for c in candidates]

        if self.model is not None:
            try:
                scores = self.model.predict(pairs)
                scores = [float(s) for s in scores]
            except Exception as e:
                logger.warning(f"CrossEncoder inference failed ({e}), using fallback.")
                scores = [self._fallback_score(query, c["text"]) for c in candidates]
        else:
            scores = [self._fallback_score(query, c["text"]) for c in candidates]

        # Attach scores and rank
        scored_candidates = []
        for cand, score in zip(candidates, scores):
            item = dict(cand)
            item["rerank_score"] = float(score)
            scored_candidates.append(item)

        scored_candidates.sort(key=lambda x: x["rerank_score"], reverse=True)

        final_list = []
        for rank, item in enumerate(scored_candidates[:top_k], start=1):
            item["final_rank"] = rank
            final_list.append(item)

        logger.debug(f"Reranked {len(candidates)} candidates down to {len(final_list)} chunks.")
        return final_list
