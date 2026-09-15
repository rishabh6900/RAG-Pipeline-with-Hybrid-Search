import math
from typing import Any, Dict, List, Optional
from config.settings import settings


class ConfidenceScorer:
    """Computes composite multi-dimensional answer confidence and manages graceful fallbacks."""

    def __init__(self, threshold: Optional[float] = None):
        self.threshold = threshold or settings.CONFIDENCE_THRESHOLD

    @staticmethod
    def calculate_retrieval_relevance(retrieved_chunks: List[Dict[str, Any]]) -> float:
        """Calculate normalized relevance score from top candidate chunks."""
        if not retrieved_chunks:
            return 0.0

        scores = []
        for c in retrieved_chunks[:3]:
            if "rerank_score" in c and c["rerank_score"] is not None:
                val = c["rerank_score"]
                if isinstance(val, (int, float)):
                    if 0.0 <= val <= 1.0:
                        norm = val
                    else:
                        # MS-MARCO cross-encoder logit calibration (typically -10 to +10)
                        try:
                            # Calibrated sigmoid centered around realistic retrieval thresholds
                            norm = 1.0 / (1.0 + math.exp(-(val + 2.5) / 2.0))
                        except OverflowError:
                            norm = 0.0 if val < 0 else 1.0
                else:
                    norm = 0.75
                scores.append(norm)
            elif "rrf_score" in c and c["rrf_score"] is not None:
                scores.append(min(1.0, float(c["rrf_score"]) * 50.0))
            elif "score" in c and c["score"] is not None:
                scores.append(min(1.0, max(0.0, float(c["score"]))))
            else:
                scores.append(0.8)

        return float(sum(scores) / len(scores)) if scores else 0.8

    @staticmethod
    def calculate_completeness(question: str, answer: str) -> float:
        """Estimate how thoroughly the answer addresses multi-part query components."""
        if not answer or "not found" in answer.lower() or "insufficient" in answer.lower():
            return 0.3

        q_terms = [w.lower() for w in question.split() if len(w) > 3]
        if not q_terms:
            return 0.9

        ans_lower = answer.lower()
        matched = sum(1 for t in q_terms if t in ans_lower)
        ratio = matched / len(q_terms)
        return min(1.0, max(0.4, ratio))

    def compute_composite_confidence(
        self,
        question: str,
        answer: str,
        retrieved_chunks: List[Dict[str, Any]],
        citation_grounding_score: float
    ) -> Dict[str, float]:
        """
        Compute weighted composite confidence score:
        Confidence = 0.40 * Retrieval + 0.35 * CitationGrounding + 0.25 * Completeness
        """
        retrieval_rel = self.calculate_retrieval_relevance(retrieved_chunks)
        completeness = self.calculate_completeness(question, answer)

        composite = (
            (0.40 * retrieval_rel) +
            (0.35 * citation_grounding_score) +
            (0.25 * completeness)
        )
        composite = round(min(1.0, max(0.0, composite)), 3)

        return {
            "composite": composite,
            "retrieval_relevance": round(retrieval_rel, 3),
            "citation_grounding": round(citation_grounding_score, 3),
            "answer_completeness": round(completeness, 3)
        }

    def generate_graceful_fallback(
        self,
        question: str,
        retrieved_chunks: List[Dict[str, Any]],
        scores: Dict[str, float]
    ) -> Dict[str, Any]:
        """
        Generates a structured, transparent response when retrieval/grounding confidence is low.
        """
        suggested_sources = []
        for c in retrieved_chunks[:3]:
            meta = c.get("metadata", {})
            src = meta.get("source_path", "unknown")
            sec = meta.get("section_title", "")
            if src not in suggested_sources:
                suggested_sources.append(f"{src} ({sec})")

        return {
            "status": "insufficient_context",
            "message": (
                "The internal documentation does not contain enough verified evidence "
                "to answer your question with high confidence without risking hallucination."
            ),
            "question": question,
            "confidence_scores": scores,
            "searched_topics": [w for w in question.split() if len(w) > 4],
            "partially_relevant_documents": suggested_sources,
            "recommended_action": "Please verify with team leads or check the suggested documents above."
        }
