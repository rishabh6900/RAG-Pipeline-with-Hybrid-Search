import math
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional
import numpy as np

try:
    import tiktoken
    tokenizer = tiktoken.get_encoding("cl100k_base")
except Exception:
    tokenizer = None


@dataclass
class DocumentChunk:
    chunk_id: str
    doc_id: str
    source_path: str
    section_title: str
    chunk_index: int
    text: str
    token_count: int
    strategy: str
    metadata: Dict[str, Any] = field(default_factory=dict)


def count_tokens(text: str) -> int:
    if tokenizer:
        return len(tokenizer.encode(text))
    # Fallback heuristic: 1 token ~= 4 characters or 0.75 words
    return max(1, len(text.split()))


class BaseChunker(ABC):
    """Abstract base class for chunking strategies."""
    strategy_name: str = "base"

    @abstractmethod
    def chunk(self, doc_id: str, source_path: str, text: str, initial_metadata: Optional[Dict] = None) -> List[DocumentChunk]:
        pass


class FixedSizeChunker(BaseChunker):
    """Fixed-size token window with configurable stride overlap."""
    strategy_name: str = "fixed"

    def __init__(self, chunk_size: int = 512, chunk_overlap: int = 64):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def chunk(self, doc_id: str, source_path: str, text: str, initial_metadata: Optional[Dict] = None) -> List[DocumentChunk]:
        chunks: List[DocumentChunk] = []
        words = text.split()
        if not words:
            return chunks

        stride = max(1, self.chunk_size - self.chunk_overlap)
        chunk_idx = 0
        
        # Word-based token-approximation windowing
        for i in range(0, len(words), stride):
            chunk_words = words[i:i + self.chunk_size]
            chunk_text = " ".join(chunk_words)
            tok_count = count_tokens(chunk_text)

            chunk = DocumentChunk(
                chunk_id=f"{doc_id}_{self.strategy_name}_chunk_{chunk_idx:03d}",
                doc_id=doc_id,
                source_path=source_path,
                section_title="General",
                chunk_index=chunk_idx,
                text=chunk_text,
                token_count=tok_count,
                strategy=self.strategy_name,
                metadata={
                    **(initial_metadata or {}),
                    "start_word_index": i,
                    "end_word_index": i + len(chunk_words)
                }
            )
            chunks.append(chunk)
            chunk_idx += 1

            if i + self.chunk_size >= len(words):
                break

        return chunks


class StructureAwareChunker(BaseChunker):
    """Structure-aware chunker splitting along Markdown/HTML headers and hierarchy."""
    strategy_name: str = "structure_aware"

    def __init__(self, min_chunk_size: int = 80, max_chunk_size: int = 600):
        self.min_chunk_size = min_chunk_size
        self.max_chunk_size = max_chunk_size

    def chunk(self, doc_id: str, source_path: str, text: str, initial_metadata: Optional[Dict] = None) -> List[DocumentChunk]:
        chunks: List[DocumentChunk] = []
        
        # Regex matching markdown headers # through ####
        header_pattern = re.compile(r"^(#{1,4})\s+(.+)$", flags=re.MULTILINE)
        splits = []
        last_pos = 0
        current_header = "Introduction"
        breadcrumbs: List[str] = [current_header]

        matches = list(header_pattern.finditer(text))
        
        if not matches:
            # Fallback to paragraph splitting if no headers exist
            paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
            for idx, p in enumerate(paragraphs):
                chunks.append(DocumentChunk(
                    chunk_id=f"{doc_id}_{self.strategy_name}_chunk_{idx:03d}",
                    doc_id=doc_id,
                    source_path=source_path,
                    section_title="Overview",
                    chunk_index=idx,
                    text=p,
                    token_count=count_tokens(p),
                    strategy=self.strategy_name,
                    metadata=initial_metadata or {}
                ))
            return chunks

        for i, match in enumerate(matches):
            header_level = len(match.group(1))
            header_title = match.group(2).strip()

            if i > 0:
                section_body = text[last_pos:match.start()].strip()
                if section_body:
                    splits.append((breadcrumbs.copy(), section_body))

            # Maintain breadcrumb stack based on header depth
            while len(breadcrumbs) >= header_level:
                breadcrumbs.pop()
            breadcrumbs.append(header_title)
            last_pos = match.end()

        # Append final segment
        trailing = text[last_pos:].strip()
        if trailing:
            splits.append((breadcrumbs.copy(), trailing))

        chunk_idx = 0
        for breadcrumb_trail, body in splits:
            section_breadcrumb = " > ".join(breadcrumb_trail)
            tok_count = count_tokens(body)

            # If section exceeds max chunk size, sub-split by paragraphs
            if tok_count > self.max_chunk_size:
                sub_paras = [p.strip() for p in body.split("\n\n") if p.strip()]
                buffer = ""
                for para in sub_paras:
                    if count_tokens(buffer + "\n\n" + para) > self.max_chunk_size and buffer:
                        enriched_text = f"[{section_breadcrumb}]\n{buffer}"
                        chunks.append(DocumentChunk(
                            chunk_id=f"{doc_id}_{self.strategy_name}_chunk_{chunk_idx:03d}",
                            doc_id=doc_id,
                            source_path=source_path,
                            section_title=section_breadcrumb,
                            chunk_index=chunk_idx,
                            text=enriched_text,
                            token_count=count_tokens(enriched_text),
                            strategy=self.strategy_name,
                            metadata={**(initial_metadata or {}), "section_depth": len(breadcrumb_trail)}
                        ))
                        chunk_idx += 1
                        buffer = para
                    else:
                        buffer = f"{buffer}\n\n{para}".strip() if buffer else para

                if buffer:
                    enriched_text = f"[{section_breadcrumb}]\n{buffer}"
                    chunks.append(DocumentChunk(
                        chunk_id=f"{doc_id}_{self.strategy_name}_chunk_{chunk_idx:03d}",
                        doc_id=doc_id,
                        source_path=source_path,
                        section_title=section_breadcrumb,
                        chunk_index=chunk_idx,
                        text=enriched_text,
                        token_count=count_tokens(enriched_text),
                        strategy=self.strategy_name,
                        metadata={**(initial_metadata or {}), "section_depth": len(breadcrumb_trail)}
                    ))
                    chunk_idx += 1
            else:
                enriched_text = f"[{section_breadcrumb}]\n{body}"
                chunks.append(DocumentChunk(
                    chunk_id=f"{doc_id}_{self.strategy_name}_chunk_{chunk_idx:03d}",
                    doc_id=doc_id,
                    source_path=source_path,
                    section_title=section_breadcrumb,
                    chunk_index=chunk_idx,
                    text=enriched_text,
                    token_count=count_tokens(enriched_text),
                    strategy=self.strategy_name,
                    metadata={**(initial_metadata or {}), "section_depth": len(breadcrumb_trail)}
                ))
                chunk_idx += 1

        return chunks


class RAGPipelineEmbeddings:
    """LangChain-compatible Embeddings adapter wrapping DenseVectorStore or custom embedding function."""

    def __init__(self, embed_fn: Optional[Callable[[List[str]], List[List[float]]]] = None):
        self._embed_fn = embed_fn

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        if self._embed_fn:
            return self._embed_fn(texts)
        try:
            from src.retrieval.dense_store import DenseVectorStore
            dense = DenseVectorStore()
            return dense.embed_texts(texts)
        except Exception:
            return [self._local_pseudo_embed(t) for t in texts]

    def embed_query(self, text: str) -> List[float]:
        results = self.embed_documents([text])
        return results[0] if results else [0.0] * 1536

    @staticmethod
    def _local_pseudo_embed(text: str, dim: int = 1536) -> List[float]:
        vec = np.zeros(dim, dtype=float)
        words = text.lower().split()
        for idx, word in enumerate(words):
            h = hash(word) % dim
            vec[h] += 1.0 / (1.0 + np.log1p(idx + 1))
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec /= norm
        return vec.tolist()


class SemanticTopicChunker(BaseChunker):
    """Semantic topic boundary chunker powered by LangChain's SemanticChunker."""
    strategy_name: str = "semantic"

    def __init__(
        self,
        distance_percentile_threshold: float = 85.0,
        breakpoint_threshold_type: str = "percentile",
        breakpoint_threshold_amount: Optional[float] = None,
        embeddings: Optional[Any] = None,
        embed_fn: Optional[Callable[[List[str]], List[List[float]]]] = None,
    ):
        self.distance_percentile_threshold = distance_percentile_threshold
        self.breakpoint_threshold_type = breakpoint_threshold_type
        self.breakpoint_threshold_amount = (
            breakpoint_threshold_amount
            if breakpoint_threshold_amount is not None
            else distance_percentile_threshold
        )
        self.embed_fn = embed_fn
        self.embeddings = embeddings or RAGPipelineEmbeddings(embed_fn=embed_fn)
        self._lc_chunker = None

        # Attempt to initialize LangChain SemanticChunker
        try:
            try:
                from langchain_experimental.text_splitter import SemanticChunker as LCSemanticChunker
            except ImportError:
                from langchain_text_splitters import SemanticChunker as LCSemanticChunker

            self._lc_chunker = LCSemanticChunker(
                embeddings=self.embeddings,
                breakpoint_threshold_type=self.breakpoint_threshold_type,
                breakpoint_threshold_amount=self.breakpoint_threshold_amount,
            )
        except Exception:
            self._lc_chunker = None

    def _split_sentences(self, text: str) -> List[str]:
        sentence_end = re.compile(r'(?<!\w\.\w.)(?<![A-Z][a-z]\.)(?<=\.|\?|\!)\s')
        sentences = [s.strip() for s in sentence_end.split(text) if s.strip()]
        return sentences

    def _default_pseudo_embed(self, sentences: List[str]) -> List[np.ndarray]:
        vocab: Dict[str, int] = {}
        for s in sentences:
            for w in re.findall(r'\w+', s.lower()):
                if w not in vocab:
                    vocab[w] = len(vocab)

        vectors = []
        for s in sentences:
            vec = np.zeros(len(vocab) if vocab else 1, dtype=float)
            for w in re.findall(r'\w+', s.lower()):
                vec[vocab[w]] += 1.0
            norm = np.linalg.norm(vec)
            if norm > 0:
                vec /= norm
            vectors.append(vec)
        return vectors

    def chunk(self, doc_id: str, source_path: str, text: str, initial_metadata: Optional[Dict] = None) -> List[DocumentChunk]:
        if not text or not text.strip():
            return []

        # 1. If LangChain SemanticChunker is initialized, split using LangChain LCEL
        if self._lc_chunker is not None:
            try:
                raw_chunks = self._lc_chunker.split_text(text)
                if raw_chunks:
                    chunks: List[DocumentChunk] = []
                    for idx, chunk_text in enumerate(raw_chunks):
                        cleaned = chunk_text.strip()
                        if not cleaned:
                            continue
                        chunks.append(
                            DocumentChunk(
                                chunk_id=f"{doc_id}_{self.strategy_name}_chunk_{idx:03d}",
                                doc_id=doc_id,
                                source_path=source_path,
                                section_title=f"Semantic Topic #{idx + 1}",
                                chunk_index=idx,
                                text=cleaned,
                                token_count=count_tokens(cleaned),
                                strategy=self.strategy_name,
                                metadata={
                                    **(initial_metadata or {}),
                                    "splitter": "langchain.SemanticChunker",
                                    "breakpoint_threshold_type": self.breakpoint_threshold_type,
                                    "breakpoint_threshold_amount": self.breakpoint_threshold_amount,
                                }
                            )
                        )
                    if chunks:
                        return chunks
            except Exception:
                pass

        # 2. Native Sentence Embedding / Percentile Threshold Boundary Fallback
        sentences = self._split_sentences(text)
        if not sentences:
            return []
        if len(sentences) <= 2:
            return [
                DocumentChunk(
                    chunk_id=f"{doc_id}_{self.strategy_name}_chunk_000",
                    doc_id=doc_id,
                    source_path=source_path,
                    section_title="Topic Segment 1",
                    chunk_index=0,
                    text=text,
                    token_count=count_tokens(text),
                    strategy=self.strategy_name,
                    metadata=initial_metadata or {}
                )
            ]

        # Embed sentences
        if self.embed_fn:
            raw_vectors = self.embed_fn(sentences)
            vectors = [np.array(v) for v in raw_vectors]
        elif self.embeddings:
            raw_vectors = self.embeddings.embed_documents(sentences)
            vectors = [np.array(v) for v in raw_vectors]
        else:
            vectors = self._default_pseudo_embed(sentences)

        # Compute sliding cosine distances
        distances = []
        for i in range(len(vectors) - 1):
            v1, v2 = vectors[i], vectors[i + 1]
            dot = np.dot(v1, v2)
            denom = (np.linalg.norm(v1) * np.linalg.norm(v2))
            cos_sim = dot / denom if denom > 0 else 1.0
            cos_dist = 1.0 - min(max(cos_sim, 0.0), 1.0)
            distances.append(cos_dist)

        threshold = np.percentile(distances, self.distance_percentile_threshold) if distances else 0.5
        
        # Partition sentences at distance spikes
        chunks: List[DocumentChunk] = []
        current_cluster = [sentences[0]]
        chunk_idx = 0

        for i, dist in enumerate(distances):
            if dist > threshold and len(" ".join(current_cluster)) > 80:
                chunk_text = " ".join(current_cluster)
                chunks.append(DocumentChunk(
                    chunk_id=f"{doc_id}_{self.strategy_name}_chunk_{chunk_idx:03d}",
                    doc_id=doc_id,
                    source_path=source_path,
                    section_title=f"Semantic Topic #{chunk_idx + 1}",
                    chunk_index=chunk_idx,
                    text=chunk_text,
                    token_count=count_tokens(chunk_text),
                    strategy=self.strategy_name,
                    metadata={**(initial_metadata or {}), "semantic_boundary_score": float(dist)}
                ))
                chunk_idx += 1
                current_cluster = []
            current_cluster.append(sentences[i + 1])

        if current_cluster:
            chunk_text = " ".join(current_cluster)
            chunks.append(DocumentChunk(
                chunk_id=f"{doc_id}_{self.strategy_name}_chunk_{chunk_idx:03d}",
                doc_id=doc_id,
                source_path=source_path,
                section_title=f"Semantic Topic #{chunk_idx + 1}",
                chunk_index=chunk_idx,
                text=chunk_text,
                token_count=count_tokens(chunk_text),
                strategy=self.strategy_name,
                metadata=initial_metadata or {}
            ))

        return chunks


def get_chunker(strategy: str, **kwargs) -> BaseChunker:
    if strategy == "fixed":
        return FixedSizeChunker(**kwargs)
    elif strategy == "semantic":
        return SemanticTopicChunker(**kwargs)
    else:
        return StructureAwareChunker(**kwargs)
