import pytest
from fastapi.testclient import TestClient
from src.api.main import app
from src.ingestion.pipeline import IngestionPipeline


@pytest.fixture(scope="module")
def client():
    # Ingest sample data for tests
    pipeline = IngestionPipeline()
    pipeline.ingest_directory("./data/raw", strategy="structure_aware")
    return TestClient(app)


def test_healthz_endpoint(client):
    response = client.get("/healthz")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["total_chunks_dense"] > 0
    assert data["total_chunks_sparse"] > 0


def test_documents_endpoint(client):
    response = client.get("/v1/documents")
    assert response.status_code == 200
    data = response.json()
    assert "total_indexed_chunks_dense" in data
    assert "raw_documents" in data


def test_ask_endpoint(client):
    payload = {
        "question": "What is the command to rotate database secrets in Vault?",
        "retrieval_mode": "hybrid",
        "use_reranker": True,
        "verify_citations": True
    }
    response = client.post("/v1/ask", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert "confidence_scores" in data
    assert "citations" in data
    assert len(data["retrieved_chunks"]) > 0


def test_chunking_compare_endpoint(client):
    payload = {
        "question": "What are the Kubernetes MaxSurge settings for deployment?",
        "retrieval_mode": "hybrid"
    }
    response = client.post("/v1/chunking/compare", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "fixed_strategy_answer" in data
    assert "structure_aware_strategy_answer" in data
    assert "semantic_strategy_answer" in data
