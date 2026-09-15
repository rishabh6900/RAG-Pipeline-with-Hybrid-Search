from typing import Any, Dict, List
import numpy as np


class EvaluationMetrics:
    """Calculates quantitative performance metrics across retrieval, generation, and citation accuracy."""

    @staticmethod
    def calculate_hit_rate(retrieved_doc_ids: List[str], target_doc_id: str, k: int = 5) -> float:
        """Evaluates whether the target ground truth document appears in top-K."""
        top_k = retrieved_doc_ids[:k]
        return 1.0 if target_doc_id in top_k else 0.0

    @staticmethod
    def calculate_mrr(retrieved_doc_ids: List[str], target_doc_id: str) -> float:
        """Mean Reciprocal Rank (MRR) for the target document position."""
        for rank, doc_id in enumerate(retrieved_doc_ids, start=1):
            if doc_id == target_doc_id:
                return 1.0 / rank
        return 0.0

    @staticmethod
    def calculate_faithfulness(verified_citations: List[Dict[str, Any]]) -> float:
        """Proportion of generated citations that passed verification without hallucination."""
        if not verified_citations:
            return 1.0
        supported = sum(1 for c in verified_citations if c.get("verified", False))
        return supported / len(verified_citations)

    @staticmethod
    def calculate_citation_precision(
        generated_citation_sources: List[str],
        ground_truth_sources: List[str]
    ) -> float:
        """Measures whether cited sources match the true source documentation."""
        if not generated_citation_sources or not ground_truth_sources:
            return 1.0
        matched = sum(1 for s in generated_citation_sources if any(gt in s for gt in ground_truth_sources))
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
