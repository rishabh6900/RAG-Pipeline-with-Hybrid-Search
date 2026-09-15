import json
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional
from config.logging_config import logger
from src.evaluation.eval_metrics import EvaluationMetrics
from src.generation.citation_verifier import CitationVerifier
from src.generation.confidence_scorer import ConfidenceScorer
from src.generation.generator import GroundedGenerator
from src.retrieval.dense_store import DenseVectorStore
from src.retrieval.fusion import FusionEngine
from src.retrieval.reranker import CrossEncoderReranker
from src.retrieval.sparse_store import SparseBM25Store


class BenchmarkRunner:
    """Executes offline evaluations over the golden Q&A dataset."""

    def __init__(
        self,
        dense_store: Optional[DenseVectorStore] = None,
        sparse_store: Optional[SparseBM25Store] = None,
        fusion_engine: Optional[FusionEngine] = None,
        reranker: Optional[CrossEncoderReranker] = None,
        generator: Optional[GroundedGenerator] = None,
        verifier: Optional[CitationVerifier] = None
    ):
        self.dense_store = dense_store or DenseVectorStore()
        self.sparse_store = sparse_store or SparseBM25Store()
        self.fusion = fusion_engine or FusionEngine()
        self.reranker = reranker or CrossEncoderReranker()
        self.generator = generator or GroundedGenerator()
        self.verifier = verifier or CitationVerifier()
        self.scorer = ConfidenceScorer()

    def run_query_pipeline(
        self,
        question: str,
        retrieval_mode: str = "hybrid",
        dense_weight: float = 0.70,
        sparse_weight: float = 0.30,
        use_reranker: bool = True
    ) -> Dict[str, Any]:
        """Runs the query through retrieval, fusion, reranking, generation, and verification."""
        t0 = time.perf_counter()

        # Step 1: Retrieval
        dense_results = self.dense_store.search(question, top_k=15) if retrieval_mode in ["dense", "hybrid"] else []
        sparse_results = self.sparse_store.search(question, top_k=15) if retrieval_mode in ["sparse", "hybrid"] else []

        # Step 2: Fusion
        if retrieval_mode == "hybrid":
            candidates = self.fusion.fuse(
                dense_results, sparse_results, top_k=20,
                dense_weight=dense_weight, sparse_weight=sparse_weight
            )
        elif retrieval_mode == "dense":
            candidates = dense_results[:20]
        else:
            candidates = sparse_results[:20]

        # Step 3: Reranking
        if use_reranker and candidates:
            final_chunks = self.reranker.rerank(question, candidates, top_k=5)
        else:
            final_chunks = candidates[:5]

        # Step 4: Generation
        answer = self.generator.generate_answer(question, final_chunks)

        # Step 5: Citation verification
        citations, grounding_score = self.verifier.verify_answer_citations(answer, final_chunks)
        confidence = self.scorer.compute_composite_confidence(question, answer, final_chunks, grounding_score)

        latency_ms = (time.perf_counter() - t0) * 1000.0

        return {
            "question": question,
            "answer": answer,
            "retrieved_chunks": final_chunks,
            "citations": citations,
            "confidence": confidence,
            "latency_ms": latency_ms
        }

    def evaluate_dataset(
        self,
        dataset_path: str | Path,
        retrieval_mode: str = "hybrid",
        use_reranker: bool = True
    ) -> Dict[str, Any]:
        """Run evaluation over golden test cases in JSON."""
        path = Path(dataset_path)
        if not path.exists():
            raise FileNotFoundError(f"Golden dataset not found at: {path}")

        with open(path, "r", encoding="utf-8") as f:
            test_cases = json.load(f)

        records = []
        for item in test_cases:
            q = item["question"]
            target_source = item.get("target_source", "")
            
            res = self.run_query_pipeline(
                question=q,
                retrieval_mode=retrieval_mode,
                use_reranker=use_reranker
            )

            retrieved_sources = [
                c.get("metadata", {}).get("source_path", "")
                for c in res["retrieved_chunks"]
            ]
            cited_sources = [c["source_file"] for c in res["citations"]]

            hit_3 = EvaluationMetrics.calculate_hit_rate(retrieved_sources, target_source, k=3)
            hit_5 = EvaluationMetrics.calculate_hit_rate(retrieved_sources, target_source, k=5)
            mrr = EvaluationMetrics.calculate_mrr(retrieved_sources, target_source)
            faithfulness = EvaluationMetrics.calculate_faithfulness(res["citations"])
            cit_prec = EvaluationMetrics.calculate_citation_precision(cited_sources, [target_source])

            records.append({
                "question": q,
                "hit_rate_3": hit_3,
                "hit_rate_5": hit_5,
                "mrr": mrr,
                "faithfulness": faithfulness,
                "citation_precision": cit_prec,
                "latency_ms": res["latency_ms"]
            })

        summary = EvaluationMetrics.aggregate_benchmark(records)
        summary["retrieval_mode"] = retrieval_mode
        summary["reranker_enabled"] = use_reranker
        return summary


if __name__ == "__main__":
    runner = BenchmarkRunner()
    ds_path = "./data/golden_dataset/eval_set.json"
    if os.path.exists(ds_path):
        res = runner.evaluate_dataset(ds_path)
        print("Evaluation Summary:", json.dumps(res, indent=2))
