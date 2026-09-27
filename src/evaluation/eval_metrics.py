from pathlib import Path
from typing import Any, Dict, List
import numpy as np


class EvaluationMetrics:
    """Calculates quantitative performance metrics across retrieval, generation, and citation accuracy."""

    @staticmethod
    def _normalize_name(path_or_id: str) -> str:
        if not path_or_id:
            return ""
        return Path(path_or_id).name.lower().strip()

    @classmethod
    def calculate_hit_rate(cls, retrieved_doc_ids: List[str], target_doc_id: str, k: int = 5) -> float:
        """Evaluates whether the target ground truth document appears in top-K."""
        if not target_doc_id or target_doc_id.lower() in ["none", ""]:
            return 1.0
        norm_target = cls._normalize_name(target_doc_id)
        top_k = [cls._normalize_name(d) for d in retrieved_doc_ids[:k]]
        return 1.0 if any(norm_target == d or norm_target in d or d in norm_target for d in top_k if d) else 0.0

    @classmethod
    def calculate_mrr(cls, retrieved_doc_ids: List[str], target_doc_id: str) -> float:
        """Mean Reciprocal Rank (MRR) for the target document position."""
        if not target_doc_id or target_doc_id.lower() in ["none", ""]:
            return 1.0
        norm_target = cls._normalize_name(target_doc_id)
        for rank, doc_id in enumerate(retrieved_doc_ids, start=1):
            norm_doc = cls._normalize_name(doc_id)
            if norm_doc and (norm_target == norm_doc or norm_target in norm_doc or norm_doc in norm_target):
                return 1.0 / rank
        return 0.0

    @staticmethod
    def calculate_faithfulness(verified_citations: List[Dict[str, Any]]) -> float:
        """Proportion of generated citations that passed verification without hallucination."""
        if not verified_citations:
            return 1.0
        supported = sum(1 for c in verified_citations if c.get("verified", False))
        return supported / len(verified_citations)

    @classmethod
    def calculate_citation_precision(
        cls,
        generated_citation_sources: List[str],
        ground_truth_sources: List[str]
    ) -> float:
        """Measures whether cited sources match the true source documentation."""
        if not generated_citation_sources:
            return 1.0
        valid_gt = [cls._normalize_name(gt) for gt in ground_truth_sources if gt and gt.lower() != "none"]
        if not valid_gt:
            return 1.0
        matched = sum(
            1 for s in generated_citation_sources
            if any(gt == cls._normalize_name(s) or gt in cls._normalize_name(s) or cls._normalize_name(s) in gt for gt in valid_gt)
        )
        return matched / len(generated_citation_sources)

    @classmethod
    def aggregate_benchmark(cls, results: List[Dict[str, Any]]) -> Dict[str, float]:
        """Aggregate metrics over a full evaluation suite."""
        if not results:
            return {}

        hit_rates_3 = [r.get("hit_rate_3", 0.0) for r in results]
        hit_rates_5 = [r.get("hit_rate_5", 0.0) for r in results]
        mrrs = [r.get("mrr", 0.0) for r in results]
        faithfulness = [r.get("faithfulness", 1.0) for r in results]
        citation_prec = [r.get("citation_precision", 1.0) for r in results]
        latency = [r.get("latency_ms", 0.0) for r in results]

        return {
            "hit_rate_at_3": round(float(np.mean(hit_rates_3)), 4),
            "hit_rate_at_5": round(float(np.mean(hit_rates_5)), 4),
            "mean_reciprocal_rank": round(float(np.mean(mrrs)), 4),
            "faithfulness": round(float(np.mean(faithfulness)), 4),
            "citation_precision": round(float(np.mean(citation_prec)), 4),
            "avg_latency_ms": round(float(np.mean(latency)), 2),
            "total_evaluated": len(results)
        }
