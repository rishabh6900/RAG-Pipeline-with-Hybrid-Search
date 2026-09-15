import pytest
from src.ingestion.parsers import DocumentParser
from src.ingestion.chunkers import FixedSizeChunker, StructureAwareChunker, SemanticTopicChunker, get_chunker
from src.ingestion.deduplicator import ChunkDeduplicator


def test_markdown_parser(tmp_path):
    md_file = tmp_path / "test_doc.md"
    md_file.write_text("# Test Title\n\nThis is a sample document for testing.\n\n## Section 1\nContent of section 1.", encoding="utf-8")

    parsed = DocumentParser.parse_file(md_file)
    assert parsed.doc_title == "Test Title"
    assert parsed.content_type == "markdown"
    assert "Content of section 1." in parsed.cleaned_text


def test_fixed_size_chunker():
    text = "Word " * 1000
    chunker = FixedSizeChunker(chunk_size=100, chunk_overlap=20)
    chunks = chunker.chunk("doc_1", "test.txt", text)

    assert len(chunks) > 5
    assert chunks[0].strategy == "fixed"
    assert chunks[0].token_count > 0


def test_structure_aware_chunker():
    text = """# Main Architecture
Overview paragraph.

## Section A
Details of section A.

### Sub-clause A.1
Specific sub-clause instructions.

## Section B
Final remarks.
"""
    chunker = StructureAwareChunker()
    chunks = chunker.chunk("doc_struct", "arch.md", text)

    assert len(chunks) >= 3
    assert any("Section A" in c.section_title for c in chunks)
    assert any("Sub-clause A.1" in c.section_title for c in chunks)


def test_semantic_topic_chunker():
    text = (
        "Database connections use PgBouncer in transaction mode. Max active connections is 250. "
        "Kubernetes pods run in EKS clusters with RollingUpdate strategy. MaxSurge is 25 percent. "
        "Vault credentials rotate every 30 days using Vault CLI."
    )
    chunker = SemanticTopicChunker(distance_percentile_threshold=50.0)
    chunks = chunker.chunk("doc_sem", "sem.txt", text)

    assert len(chunks) >= 1
    assert chunks[0].strategy == "semantic"
    assert chunks[0].text is not None


def test_rag_pipeline_embeddings():
    from src.ingestion.chunkers import RAGPipelineEmbeddings
    embedder = RAGPipelineEmbeddings()
    vecs = embedder.embed_documents(["Hello world", "Semantic search test"])
    assert len(vecs) == 2
    assert len(vecs[0]) == 1536
    query_vec = embedder.embed_query("Search query")
    assert len(query_vec) == 1536


def test_chunk_deduplicator():
    dedup = ChunkDeduplicator(threshold=0.95)
    chunker = FixedSizeChunker(chunk_size=50, chunk_overlap=0)
    chunks = chunker.chunk("doc_1", "test.txt", "Identical duplicate text content " * 10)

    # Identical embeddings
    identical_emb = [0.1] * 1536
    embeds = [identical_emb, identical_emb, identical_emb]

    unique_chunks, unique_embeds, dup_count = dedup.filter_batch(chunks[:3], embeds)
    assert len(unique_chunks) == 1
    assert dup_count == 2
