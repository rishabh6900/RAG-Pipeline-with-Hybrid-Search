import hashlib
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict
from bs4 import BeautifulSoup
from config.logging_config import logger

try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None


@dataclass
class ParsedDocument:
    doc_id: str
    source_path: str
    file_name: str
    doc_title: str
    content_type: str
    raw_text: str
    cleaned_text: str
    sha256_hash: str
    metadata: Dict = field(default_factory=dict)


class DocumentParser:
    """Multi-format document parser extracting clean plaintext and structural metadata."""

    @staticmethod
    def compute_sha256(content: bytes) -> str:
        return hashlib.sha256(content).hexdigest()

    @classmethod
    def parse_file(cls, file_path: str | Path) -> ParsedDocument:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Document not found at: {path}")

        suffix = path.suffix.lower()
        with open(path, "rb") as f:
            raw_bytes = f.read()

        sha256 = cls.compute_sha256(raw_bytes)
        doc_id = f"doc_{sha256[:12]}"
        file_name = path.name

        if suffix in [".md", ".mdx"]:
            return cls.parse_markdown(path, raw_bytes, doc_id, sha256)
        elif suffix in [".html", ".htm"]:
            return cls.parse_html(path, raw_bytes, doc_id, sha256)
        elif suffix == ".pdf":
            return cls.parse_pdf(path, raw_bytes, doc_id, sha256)
        else:
            return cls.parse_text(path, raw_bytes, doc_id, sha256)

    @classmethod
    def parse_text(cls, path: Path, raw_bytes: bytes, doc_id: str, sha256: str) -> ParsedDocument:
        text = raw_bytes.decode("utf-8", errors="replace")
        cleaned = cls.normalize_whitespace(text)
        title = path.stem.replace("_", " ").replace("-", " ").title()
        return ParsedDocument(
            doc_id=doc_id,
            source_path=str(path),
            file_name=path.name,
            doc_title=title,
            content_type="text",
            raw_text=text,
            cleaned_text=cleaned,
            sha256_hash=sha256,
            metadata={"file_size_bytes": len(raw_bytes)}
        )

    @classmethod
    def parse_markdown(cls, path: Path, raw_bytes: bytes, doc_id: str, sha256: str) -> ParsedDocument:
        text = raw_bytes.decode("utf-8", errors="replace")
        
        # Extract title from first H1 if available
        title_match = re.search(r"^#\s+(.+)$", text, flags=re.MULTILINE)
        doc_title = title_match.group(1).strip() if title_match else path.stem.replace("_", " ").title()

        cleaned = cls.normalize_whitespace(text)
        return ParsedDocument(
            doc_id=doc_id,
            source_path=str(path),
            file_name=path.name,
            doc_title=doc_title,
            content_type="markdown",
            raw_text=text,
            cleaned_text=cleaned,
            sha256_hash=sha256,
            metadata={"file_size_bytes": len(raw_bytes), "has_headers": bool(title_match)}
        )

    @classmethod
    def parse_html(cls, path: Path, raw_bytes: bytes, doc_id: str, sha256: str) -> ParsedDocument:
        html_content = raw_bytes.decode("utf-8", errors="replace")
        soup = BeautifulSoup(html_content, "html.parser")

        # Strip scripts and styles
        for tag in soup(["script", "style", "nav", "footer", "aside"]):
            tag.decompose()

        # Extract title
        title_tag = soup.find("title")
        h1_tag = soup.find("h1")
        if title_tag and title_tag.get_text().strip():
            doc_title = title_tag.get_text().strip()
        elif h1_tag and h1_tag.get_text().strip():
            doc_title = h1_tag.get_text().strip()
        else:
            doc_title = path.stem.replace("_", " ").title()

        text = soup.get_text(separator="\n")
        cleaned = cls.normalize_whitespace(text)

        return ParsedDocument(
            doc_id=doc_id,
            source_path=str(path),
            file_name=path.name,
            doc_title=doc_title,
            content_type="html",
            raw_text=html_content,
            cleaned_text=cleaned,
            sha256_hash=sha256,
            metadata={"file_size_bytes": len(raw_bytes)}
        )

    @classmethod
    def parse_pdf(cls, path: Path, raw_bytes: bytes, doc_id: str, sha256: str) -> ParsedDocument:
        if PdfReader is None:
            logger.warning("pypdf is not installed. Falling back to binary decode.")
            return cls.parse_text(path, raw_bytes, doc_id, sha256)

        try:
            reader = PdfReader(str(path))
            pages_text = []
            for i, page in enumerate(reader.pages):
                page_content = page.extract_text() or ""
                if page_content.strip():
                    pages_text.append(page_content.strip())
            raw_text = "\n\n".join(pages_text)
            cleaned = cls.normalize_whitespace(raw_text)
            doc_title = path.stem.replace("_", " ").replace("-", " ").title()

            return ParsedDocument(
                doc_id=doc_id,
                source_path=str(path),
                file_name=path.name,
                doc_title=doc_title,
                content_type="pdf",
                raw_text=raw_text,
                cleaned_text=cleaned,
                sha256_hash=sha256,
                metadata={"total_pages": len(reader.pages), "file_size_bytes": len(raw_bytes)}
            )
        except Exception as e:
            logger.error(f"Failed to parse PDF {path}: {e}")
            return cls.parse_text(path, raw_bytes, doc_id, sha256)

    @staticmethod
    def normalize_whitespace(text: str) -> str:
        # Standardize carriage returns and tabs
        text = text.replace("\r\n", "\n").replace("\r", "\n").replace("\t", " ")
        # Collapse multiple horizontal spaces on every line
        lines = [re.sub(r" +", " ", l).strip() for l in text.split("\n")]
        # Rejoin and collapse excessive blank lines (3+ into 2)
        rejoined = "\n".join(lines)
        rejoined = re.sub(r"\n{3,}", "\n\n", rejoined)
        return rejoined.strip()
