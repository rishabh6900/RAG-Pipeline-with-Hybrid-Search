import os
import uuid
from typing import Any, Dict, List, Optional
import numpy as np
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
    PayloadSchemaType,
)

from config.logging_config import logger
from config.settings import settings
from src.ingestion.chunkers import DocumentChunk

try:
    import openai
    openai_client = openai.OpenAI(api_key=settings.OPENAI_API_KEY) if settings.OPENAI_API_KEY else None
except Exception:
    openai_client = None


_qdrant_client_cache: Dict[str, QdrantClient] = {}


class DenseVectorStore:
    """Manages Qdrant vector collections, embedding generation, and dense nearest-neighbor search."""

    def __init__(
        self,
        persist_dir: Optional[str] = None,
        collection_name: Optional[str] = None,
        embedding_model: Optional[str] = None,
        embedding_dim: Optional[int] = None,
    ):
        self.persist_dir = persist_dir or settings.QDRANT_PERSIST_DIR
        self.collection_name = collection_name or settings.QDRANT_COLLECTION_NAME
        self.embedding_model = embedding_model or settings.EMBEDDING_MODEL
        self.embedding_dim = embedding_dim or settings.EMBEDDING_DIM

        # Initialize Qdrant Client (Server mode if URL provided, else local embedded disk storage)
        if settings.QDRANT_URL:
            client_key = f"server:{settings.QDRANT_URL}"
            if client_key not in _qdrant_client_cache:
                _qdrant_client_cache[client_key] = QdrantClient(
                    url=settings.QDRANT_URL,
                    api_key=settings.QDRANT_API_KEY
                )
                logger.info(f"Initialized Qdrant Client in Server Mode at '{settings.QDRANT_URL}'")
            self.client = _qdrant_client_cache[client_key]
        else:
            os.makedirs(self.persist_dir, exist_ok=True)
            client_key = f"path:{os.path.abspath(self.persist_dir)}"
            if client_key not in _qdrant_client_cache:
                _qdrant_client_cache[client_key] = QdrantClient(path=self.persist_dir)
                logger.info(f"Initialized Qdrant Client in Embedded Disk Mode at '{self.persist_dir}'")
            self.client = _qdrant_client_cache[client_key]

        self._ensure_collection()

    def _ensure_collection(self):
        """Create Qdrant collection with Cosine Distance and payload indexes if not already present."""
        try:
            collections = [c.name for c in self.client.get_collections().collections]
            if self.collection_name not in collections:
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(
                        size=self.embedding_dim,
                        distance=Distance.COSINE
                    )
                )
                logger.info(f"Created Qdrant collection '{self.collection_name}' (dim={self.embedding_dim}, distance=Cosine).")
            
            # Create payload indices required by Qdrant Server for filter operations
            for field in ["strategy", "doc_id", "source_path"]:
                try:
                    self.client.create_payload_index(
                        collection_name=self.collection_name,
                        field_name=field,
                        field_schema=PayloadSchemaType.KEYWORD
                    )
                except Exception:
                    pass
        except Exception as e:
            logger.error(f"Error ensuring Qdrant collection '{self.collection_name}': {e}")

    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """Generate normalized vector embeddings for a list of text strings."""
        if not texts:
            return []

        # If OpenAI API Key is present, call OpenAI embeddings
        if openai_client and settings.OPENAI_API_KEY:
            try:
                response = openai_client.embeddings.create(
                    input=texts,
                    model=self.embedding_model
                )
                return [d.embedding for d in response.data]
            except Exception as e:
                logger.warning(f"OpenAI embedding generation failed ({e}). Using deterministic local embedding.")

        # Deterministic local normalized embedding fallback (enables offline/Groq-only testing)
        return [self._local_pseudo_embed(t, dim=self.embedding_dim) for t in texts]

    @staticmethod
    def _local_pseudo_embed(text: str, dim: int = 1536) -> List[float]:
        """Deterministic hash-based embedding for local testing without external API dependency."""
        vec = np.zeros(dim, dtype=float)
        words = text.lower().split()
        for idx, word in enumerate(words):
            h = hash(word) % dim
            vec[h] += 1.0 / (1.0 + np.log1p(idx + 1))
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec /= norm
        return vec.tolist()

    def add_chunks(self, chunks: List[DocumentChunk], embeddings: Optional[List[List[float]]] = None) -> int:
        """Insert document chunks and embeddings into Qdrant collection with structured payload."""
        if not chunks:
            return 0

        if embeddings is None:
            texts = [c.text for c in chunks]
            embeddings = self.embed_texts(texts)

        points: List[PointStruct] = []
        for chunk, emb in zip(chunks, embeddings):
            # Deterministic UUID from chunk_id for idempotent upserts
            point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, chunk.chunk_id))
            payload = {
                "chunk_id": chunk.chunk_id,
                "text": chunk.text,
                "doc_id": chunk.doc_id,
                "source_path": chunk.source_path,
                "section_title": chunk.section_title,
                "chunk_index": chunk.chunk_index,
                "strategy": chunk.strategy,
                "token_count": chunk.token_count,
            }
            points.append(
                PointStruct(
                    id=point_id,
                    vector=emb,
                    payload=payload
                )
            )

        self.client.upsert(
            collection_name=self.collection_name,
            points=points,
            wait=True
        )
        logger.info(f"Upserted {len(points)} vector points into Qdrant collection '{self.collection_name}'.")
        return len(points)

    def search(self, query: str, top_k: int = 15, where_filter: Optional[Dict] = None) -> List[Dict[str, Any]]:
        """Dense similarity search returning ranked chunks with cosine similarity in Qdrant."""
        if self.count() == 0:
            return []

        query_emb = self.embed_texts([query])[0]

        # Convert simple where_filter into Qdrant Filter
        query_filter: Optional[Filter] = None
        if where_filter and "strategy" in where_filter:
            query_filter = Filter(
                must=[
                    FieldCondition(
                        key="strategy",
                        match=MatchValue(value=where_filter["strategy"])
                    )
                ]
            )

        # In qdrant-client >= 1.10, query_points is the standard API
        try:
            if hasattr(self.client, "query_points"):
                response = self.client.query_points(
                    collection_name=self.collection_name,
                    query=query_emb,
                    limit=top_k,
                    query_filter=query_filter,
                    with_payload=True,
                    with_vectors=False
                )
                points = response.points if hasattr(response, "points") else response
            else:
                points = self.client.search(
                    collection_name=self.collection_name,
                    query_vector=query_emb,
                    limit=top_k,
                    query_filter=query_filter,
                    with_payload=True,
                    with_vectors=False
                )
        except Exception as e:
            logger.warning(f"Filtered search query error ({e}). Retrying query without payload filter.")
            if hasattr(self.client, "query_points"):
                response = self.client.query_points(
                    collection_name=self.collection_name,
                    query=query_emb,
                    limit=top_k,
                    with_payload=True,
                    with_vectors=False
                )
                points = response.points if hasattr(response, "points") else response
            else:
                points = self.client.search(
                    collection_name=self.collection_name,
                    query_vector=query_emb,
                    limit=top_k,
                    with_payload=True,
                    with_vectors=False
                )

        formatted: List[Dict[str, Any]] = []
        for i, r in enumerate(points):
            payload = r.payload or {}
            formatted.append({
                "chunk_id": payload.get("chunk_id", str(r.id)),
                "text": payload.get("text", ""),
                "metadata": {
                    "doc_id": payload.get("doc_id", ""),
                    "source_path": payload.get("source_path", "unknown"),
                    "section_title": payload.get("section_title", "General"),
                    "chunk_index": payload.get("chunk_index", 0),
                    "strategy": payload.get("strategy", "structure_aware"),
                    "token_count": payload.get("token_count", 0),
                },
                "score": float(r.score),
                "rank": i + 1,
                "retrieval_type": "dense"
            })

        return formatted

    def get_all_embeddings(self, strategy: Optional[str] = None) -> List[List[float]]:
        """Retrieve existing vector embeddings from Qdrant for deduplication comparison."""
        try:
            scroll_filter = None
            if strategy:
                scroll_filter = Filter(
                    must=[
                        FieldCondition(
                            key="strategy",
                            match=MatchValue(value=strategy)
                        )
                    ]
                )
            points, _ = self.client.scroll(
                collection_name=self.collection_name,
                scroll_filter=scroll_filter,
                limit=10000,
                with_vectors=True,
                with_payload=False
            )
            return [p.vector for p in points if p.vector is not None]
        except Exception as e:
            logger.debug(f"Could not scroll vectors from Qdrant: {e}")
            return []

    def count(self) -> int:
        """Return total vector count in Qdrant collection."""
        try:
            if hasattr(self.client, "count"):
                return self.client.count(collection_name=self.collection_name).count
            info = self.client.get_collection(self.collection_name)
            return getattr(info, "points_count", 0) or 0
        except Exception:
            return 0

    def reset(self):
        """Purge and recreate the Qdrant collection."""
        try:
            self.client.delete_collection(self.collection_name)
            self._ensure_collection()
            logger.info(f"Reset Qdrant collection '{self.collection_name}'.")
        except Exception as e:
            logger.error(f"Error resetting Qdrant collection: {e}")
