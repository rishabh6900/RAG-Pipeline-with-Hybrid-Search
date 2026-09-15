import os
from typing import Literal, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # LLM & API Configuration (Groq / OpenAI / Anthropic)
    GROQ_API_KEY: Optional[str] = None
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"
    
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_BASE_URL: Optional[str] = None
    
    ANTHROPIC_API_KEY: Optional[str] = None
    
    LLM_PROVIDER: Literal["auto", "groq", "openai", "anthropic"] = "auto"
    LLM_MODEL: str = "llama-3.1-8b-instant"
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    EMBEDDING_DIM: int = 1536

    # Qdrant Vector Store Settings
    QDRANT_PERSIST_DIR: str = "./data/qdrant_db"
    QDRANT_COLLECTION_NAME: str = "internal_docs"
    QDRANT_URL: Optional[str] = None
    QDRANT_API_KEY: Optional[str] = None
    
    # Sparse Lexical Index Settings
    BM25_INDEX_PATH: str = "./data/bm25_index.pkl"

    # Ingestion & Chunking Defaults
    DEFAULT_CHUNKING_STRATEGY: Literal["fixed", "structure_aware", "semantic"] = "structure_aware"
    FIXED_CHUNK_SIZE: int = 512
    FIXED_CHUNK_OVERLAP: int = 64
    SIMILARITY_DEDUP_THRESHOLD: float = 0.95

    # Hybrid Search & Reranking Settings
    DENSE_TOP_K: int = 15
    SPARSE_TOP_K: int = 15
    FUSED_TOP_K: int = 20
    FINAL_RERANK_TOP_K: int = 5
    DENSE_WEIGHT: float = 0.70
    SPARSE_WEIGHT: float = 0.30
    RRF_K: int = 60
    RERANKER_MODEL: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"

    # Generation & Verification Thresholds
    CONFIDENCE_THRESHOLD: float = 0.60
    VERIFY_CITATIONS: bool = True

    # Server Settings
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    ANGULAR_PORT: int = 4200
    CORS_ORIGINS: list[str] = [
        "http://localhost:4200",
        "http://127.0.0.1:4200",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
