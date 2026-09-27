import json
import pytest
from pathlib import Path
from unittest.mock import MagicMock
from src.evaluation.eval_metrics import EvaluationMetrics
from src.evaluation.benchmark_runner import BenchmarkRunner


def test_eval_metrics_hit_rate():
    retrieved = ["doc_a.md", "doc_b.md", "doc_c.md", "doc_d.md"]
    assert EvaluationMetrics.calculate_hit_rate(retrieved, "doc_a.md", k=3) == 1.0
    assert EvaluationMetrics.calculate_hit_rate(retrieved, "doc_c.md", k=3) == 1.0
    assert EvaluationMetrics.calculate_hit_rate(retrieved, "doc_d.md", k=3) == 0.0
    assert EvaluationMetrics.calculate_hit_rate(retrieved, "doc_d.md", k=5) == 1.0
    assert EvaluationMetrics.calculate_hit_rate(retrieved, "non_existent.md", k=5) == 0.0


def test_eval_metrics_mrr():
    retrieved = ["doc_a.md", "doc_b.md", "doc_c.md"]
    assert EvaluationMetrics.calculate_mrr(retrieved, "doc_a.md") == 1.0
    assert EvaluationMetrics.calculate_mrr(retrieved, "doc_b.md") == 0.5
    assert EvaluationMetrics.calculate_mrr(retrieved, "doc_c.md") == pytest.approx(0.3333, rel=1e-3)
    assert EvaluationMetrics.calculate_mrr(retrieved, "unknown.md") == 0.0


def test_eval_metrics_faithfulness():
    assert EvaluationMetrics.calculate_faithfulness([]) == 1.0

    citations = [
        {"citation_id": 1, "verified": True},
        {"citation_id": 2, "verified": True},
    ]
    assert EvaluationMetrics.calculate_faithfulness(citations) == 1.0

    mixed_citations = [
        {"citation_id": 1, "verified": True},
        {"citation_id": 2, "verified": False},
    ]
    assert EvaluationMetrics.calculate_faithfulness(mixed_citations) == 0.5


def test_eval_metrics_citation_precision():
    assert EvaluationMetrics.calculate_citation_precision([], ["doc_a.md"]) == 1.0
    assert EvaluationMetrics.calculate_citation_precision(["doc_a.md"], []) == 1.0

    sources = ["auth_and_security.md", "database_operations.md"]
    gt = ["auth_and_security.md"]
    assert EvaluationMetrics.calculate_citation_precision(sources, gt) == 0.5

    gt_both = ["auth_and_security.md", "database_operations.md"]
    assert EvaluationMetrics.calculate_citation_precision(sources, gt_both) == 1.0


def test_eval_metrics_aggregate_benchmark():
    records = [
        {
            "question": "Q1",
            "hit_rate_3": 1.0,
            "hit_rate_5": 1.0,
            "mrr": 1.0,
            "faithfulness": 1.0,
            "citation_precision": 1.0,
            "latency_ms": 200.0,
        },
        {
            "question": "Q2",
            "hit_rate_3": 0.0,
            "hit_rate_5": 1.0,
            "mrr": 0.5,
            "faithfulness": 0.5,
            "citation_precision": 0.5,
            "latency_ms": 300.0,
        },
    ]
    summary = EvaluationMetrics.aggregate_benchmark(records)
    assert summary["hit_rate_at_3"] == 0.5
    assert summary["hit_rate_at_5"] == 1.0
    assert summary["mean_reciprocal_rank"] == 0.75
    assert summary["faithfulness"] == 0.75
    assert summary["citation_precision"] == 0.75
    assert summary["avg_latency_ms"] == 250.0
    assert summary["total_evaluated"] == 2


def test_benchmark_runner_mocked(tmp_path):
    # Mock stores and engines
    mock_dense = MagicMock()
    mock_dense.search.return_value = [
        {"chunk_id": "c1", "text": "Vault rotation command", "metadata": {"source_path": "auth_and_security.md"}, "score": 0.9}
    ]
    mock_sparse = MagicMock()
    mock_sparse.search.return_value = [
        {"chunk_id": "c1", "text": "Vault rotation command", "metadata": {"source_path": "auth_and_security.md"}, "score": 10.0}
    ]
    mock_fusion = MagicMock()
    mock_fusion.fuse.return_value = [
        {"chunk_id": "c1", "text": "Vault rotation command", "metadata": {"source_path": "auth_and_security.md"}, "rrf_score": 0.03}
    ]
    mock_reranker = MagicMock()
    mock_reranker.rerank.return_value = [
        {"chunk_id": "c1", "text": "Vault rotation command", "metadata": {"source_path": "auth_and_security.md"}, "rerank_score": 2.5}
    ]
    mock_generator = MagicMock()
    mock_generator.generate_answer.return_value = "Rotate with vault command [1]."
    mock_verifier = MagicMock()
    mock_verifier.verify_answer_citations.return_value = (
        [{"citation_id": 1, "source_file": "auth_and_security.md", "verified": True}],
        1.0
    )

    runner = BenchmarkRunner(
        dense_store=mock_dense,
        sparse_store=mock_sparse,
        fusion_engine=mock_fusion,
        reranker=mock_reranker,
        generator=mock_generator,
        verifier=mock_verifier
    )

    eval_json = tmp_path / "test_eval_set.json"
    eval_json.write_text(json.dumps([
        {
            "id": "q01",
            "question": "What is the command to rotate database credentials in HashiCorp Vault?",
            "target_source": "auth_and_security.md",
            "category": "exact_lookup"
        }
    ]), encoding="utf-8")

    res = runner.evaluate_dataset(str(eval_json), retrieval_mode="hybrid", use_reranker=True)

    assert res["total_evaluated"] == 1
    assert res["hit_rate_at_3"] == 1.0
    assert res["hit_rate_at_5"] == 1.0
    assert res["mean_reciprocal_rank"] == 1.0
    assert res["faithfulness"] == 1.0
    assert res["retrieval_mode"] == "hybrid"
    assert res["reranker_enabled"] is True
