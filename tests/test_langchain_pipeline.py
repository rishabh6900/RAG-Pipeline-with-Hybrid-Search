import pytest
from src.api.schemas import QueryRequest
from src.generation.langchain_pipeline import LangChainRAGPipeline
from src.ingestion.chunkers import DocumentChunk


@pytest.fixture
def populated_pipeline(tmp_path):
    from src.retrieval.dense_store import DenseVectorStore
    from src.retrieval.sparse_store import SparseBM25Store

    dense = DenseVectorStore(persist_dir=str(tmp_path / "qdrant"), collection_name="test_langchain")
    sparse = SparseBM25Store(index_path=str(tmp_path / "bm25.pkl"))

    sample_chunks = [
        DocumentChunk(
            chunk_id="chunk_vault_01",
            doc_id="doc_vault",
            source_path="vault_guide.md",
            section_title="Secret Management",
            chunk_index=0,
            text="To rotate database secrets in Vault, execute vault kv put secret/db-prod with a 15-minute drain timeout.",
            token_count=20,
            strategy="structure_aware"
        ),
        DocumentChunk(
            chunk_id="chunk_k8s_01",
            doc_id="doc_k8s",
            source_path="k8s_guide.md",
            section_title="Rolling Updates",
            chunk_index=0,
            text="Kubernetes deployment zero-downtime rolling update configuration requires MaxSurge 25% and MaxUnavailable 0%.",
            token_count=18,
            strategy="structure_aware"
        )
    ]

    dense.add_chunks(sample_chunks)
    sparse.build_index(sample_chunks)

    return LangChainRAGPipeline(dense_store=dense, sparse_store=sparse)


def test_langchain_pipeline_hybrid_retrieval(populated_pipeline):
    candidates = populated_pipeline.retrieve("Vault secret rotation command", retrieval_mode="hybrid", top_k=5)
    assert len(candidates) > 0
    assert candidates[0]["chunk_id"] == "chunk_vault_01"


def test_langchain_pipeline_execute_query(populated_pipeline):
    req = QueryRequest(
        question="How do we rotate Vault secrets?",
        retrieval_mode="hybrid",
        use_reranker=False,
        verify_citations=True
    )
    response = populated_pipeline.execute_query(req)
    assert response.status == "success"
    assert len(response.answer) > 0
    assert len(response.retrieved_chunks) > 0
    assert response.confidence_scores.composite > 0.0
