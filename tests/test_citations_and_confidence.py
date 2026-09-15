import pytest
from src.generation.citation_verifier import CitationVerifier
from src.generation.confidence_scorer import ConfidenceScorer


def test_citation_extraction():
    answer = (
        "Database credentials rotate using Vault CLI [1]. "
        "Connections drain over a 15-minute window [1][2]. "
        "PostgreSQL uses PgBouncer with 250 max connections [2]."
    )
    extracted = CitationVerifier.extract_claims_and_citations(answer)
    assert len(extracted) >= 2
    all_indices = [idx for item in extracted for idx in item["citation_indices"]]
    assert 1 in all_indices
    assert 2 in all_indices


def test_citation_verification_flow():
    verifier = CitationVerifier()
    chunks = [
        {"chunk_id": "c1", "text": "Vault rotation command is vault kv put secret/db-prod.", "metadata": {"source_path": "vault.md"}},
        {"chunk_id": "c2", "text": "PostgreSQL PgBouncer pool connection max is 250.", "metadata": {"source_path": "db.md"}}
    ]
    answer = "Use vault kv put secret/db-prod to rotate secrets [1]."
    citations, score = verifier.verify_answer_citations(answer, chunks)

    assert len(citations) == 1
    assert citations[0]["citation_id"] == "[1]"
    assert citations[0]["verified"] is True
    assert score == 1.0


def test_confidence_scorer():
    scorer = ConfidenceScorer()
    chunks = [{"rerank_score": 2.5, "metadata": {"source_path": "doc.md"}}]
    scores = scorer.compute_composite_confidence(
        question="How do we rotate credentials?",
        answer="Rotate credentials using the vault command [1].",
        retrieved_chunks=chunks,
        citation_grounding_score=1.0
    )

    assert "composite" in scores
    assert scores["composite"] >= 0.60
    assert scores["citation_grounding"] == 1.0
