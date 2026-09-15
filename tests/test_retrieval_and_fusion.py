import pytest
from src.ingestion.chunkers import DocumentChunk
from src.retrieval.sparse_store import SparseBM25Store
from src.retrieval.fusion import FusionEngine
from src.retrieval.reranker import CrossEncoderReranker


@pytest.fixture
def sample_chunks():
    return [
        DocumentChunk(
            chunk_id="chunk_auth",
            doc_id="doc_auth",
            source_path="auth.md",
            section_title="Vault Rotation",
            chunk_index=0,
            text="Rotate secrets using vault kv put secret/db-prod and timeout is 15 minutes.",
            token_count=16,
            strategy="structure_aware"
        ),
        DocumentChunk(
            chunk_id="chunk_k8s",
            doc_id="doc_k8s",
            source_path="k8s.md",
            section_title="Deployments",
            chunk_index=0,
            text="Zero downtime Kubernetes deployment uses MaxSurge 25% and MaxUnavailable 0%.",
            token_count=14,
            strategy="structure_aware"
        ),
        DocumentChunk(
            chunk_id="chunk_db",
            doc_id="doc_db",
            source_path="db.md",
            section_title="Pool Sizing",
            chunk_index=0,
            text="PgBouncer connection pool max connections is 250 with 5000ms timeout.",
            token_count=13,
            strategy="structure_aware"
        )
    ]


def test_bm25_exact_keyword_retrieval(sample_chunks, tmp_path):
    bm25_file = str(tmp_path / "bm25_test.pkl")
    store = SparseBM25Store(index_path=bm25_file)
    store.build_index(sample_chunks)

    # Search for technical acronym
    results = store.search("secret/db-prod", top_k=2)
    assert len(results) > 0
    assert results[0]["chunk_id"] == "chunk_auth"

    # Search for k8s parameter
    k8s_res = store.search("MaxUnavailable", top_k=2)
    assert len(k8s_res) > 0
    assert k8s_res[0]["chunk_id"] == "chunk_k8s"


def test_reciprocal_rank_fusion():
    fusion = FusionEngine(rrf_k=60, dense_weight=0.70, sparse_weight=0.30)
    dense_res = [
        {"chunk_id": "chunk_auth", "text": "Auth text", "metadata": {}, "score": 0.95},
        {"chunk_id": "chunk_db", "text": "DB text", "metadata": {}, "score": 0.80}
    ]
    sparse_res = [
        {"chunk_id": "chunk_db", "text": "DB text", "metadata": {}, "score": 12.5},
        {"chunk_id": "chunk_k8s", "text": "K8s text", "metadata": {}, "score": 5.0}
    ]

    fused = fusion.fuse(dense_res, sparse_res, top_k=3)
    assert len(fused) == 3
    assert all("rrf_score" in f for f in fused)
    # Both ranked chunk_db high, so it should have strong combined RRF score
    top_ids = [f["chunk_id"] for f in fused]
    assert "chunk_auth" in top_ids
    assert "chunk_db" in top_ids


def test_cross_encoder_reranker(sample_chunks):
    reranker = CrossEncoderReranker()
    candidates = [
        {"chunk_id": c.chunk_id, "text": c.text, "metadata": {"source_path": c.source_path}}
        for c in sample_chunks
    ]

    reranked = reranker.rerank("What is the Vault database secret rotation CLI?", candidates, top_k=2)
    assert len(reranked) == 2
    assert reranked[0]["chunk_id"] == "chunk_auth"


def test_qdrant_dense_vector_store(sample_chunks, tmp_path):
    from src.retrieval.dense_store import DenseVectorStore
    qdrant_dir = str(tmp_path / "qdrant_test_db")
    store = DenseVectorStore(persist_dir=qdrant_dir, collection_name="test_collection")
    
    count_added = store.add_chunks(sample_chunks)
    assert count_added == 3
    assert store.count() == 3

    # Search in Qdrant
    results = store.search("Kubernetes rolling update settings", top_k=2)
    assert len(results) > 0
    assert any("k8s" in r["chunk_id"] for r in results)

