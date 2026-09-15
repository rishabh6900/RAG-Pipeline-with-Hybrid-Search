import os
from typing import Any, Dict, List, Optional
from config.logging_config import logger
from config.settings import settings
from src.generation.prompt_templates import (
    GROUNDED_GENERATION_SYSTEM_PROMPT,
    GROUNDED_GENERATION_USER_TEMPLATE,
    format_context_blocks,
)

try:
    import openai
except ImportError:
    openai = None

GROQ_FALLBACK_MODELS = [
    "openai/gpt-oss-20b",
    "gpt-oss-20b",
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "mixtral-8x7b-32768",
    "gemma2-9b-it"
]


def get_llm_client() -> Optional[Any]:
    """Returns an OpenAI-compatible client initialized for Groq or OpenAI."""
    if not openai:
        return None

    # Priority 1: Groq API Key
    if settings.GROQ_API_KEY:
        return openai.OpenAI(
            api_key=settings.GROQ_API_KEY,
            base_url=settings.GROQ_BASE_URL or "https://api.groq.com/openai/v1"
        )
    # Priority 2: OpenAI API Key
    elif settings.OPENAI_API_KEY:
        return openai.OpenAI(
            api_key=settings.OPENAI_API_KEY,
            base_url=settings.OPENAI_BASE_URL
        )
    return None


def clean_model_name(raw: Optional[str]) -> str:
    if not raw:
        return "llama-3.3-70b-versatile"
    raw = raw.strip()
    if raw.lower().startswith("groq:"):
        return raw[5:].strip()
    return raw


class GroundedGenerator:
    """Invokes LLM (Groq / OpenAI) to generate strict context-grounded answers with inline citations."""

    def __init__(self, model_name: Optional[str] = None):
        self.model_name = clean_model_name(model_name or settings.LLM_MODEL)
        self.client = get_llm_client()

    def generate_answer(
        self,
        question: str,
        retrieved_chunks: List[Dict[str, Any]]
    ) -> str:
        """Generate answer conditioned strictly on retrieved context blocks."""
        if not retrieved_chunks:
            return "No relevant internal documentation was found to answer this question."

        formatted_context = format_context_blocks(retrieved_chunks)
        user_prompt = GROUNDED_GENERATION_USER_TEMPLATE.format(
            formatted_context=formatted_context,
            question=question
        )

        client = self.client or get_llm_client()
        if client:
            candidate_models = [self.model_name]
            if settings.GROQ_API_KEY:
                for fm in GROQ_FALLBACK_MODELS:
                    if fm not in candidate_models:
                        candidate_models.append(fm)

            for model in candidate_models:
                try:
                    response = client.chat.completions.create(
                        model=model,
                        messages=[
                            {"role": "system", "content": GROUNDED_GENERATION_SYSTEM_PROMPT},
                            {"role": "user", "content": user_prompt}
                        ],
                        temperature=0.0,
                        max_tokens=1000
                    )
                    answer = response.choices[0].message.content or ""
                    if answer.strip():
                        logger.info(f"Generated grounded answer using model '{model}'.")
                        return answer.strip()
                except Exception as e:
                    err_msg = str(e)
                    logger.warning(f"LLM model '{model}' call failed: {err_msg}")
                    if "401" in err_msg or "invalid_api_key" in err_msg:
                        logger.error("❌ Groq/OpenAI API key is invalid or rejected. Please verify GROQ_API_KEY in .env!")
                        break
                    continue

        # Local deterministic synthesis fallback (allows zero-credential testing)
        logger.info("Using local grounded synthesis fallback.")
        return self._local_grounded_fallback(question, retrieved_chunks)

    @staticmethod
    def _extract_substantive_snippet(text: str) -> str:
        lines = [line.strip() for line in text.split("\n") if line.strip() and not line.strip().startswith("---") and len(line.strip()) > 15]
        if lines:
            return lines[0][:280]
        sentences = [s.strip() for s in text.split(".") if len(s.strip()) > 15]
        return sentences[0][:280] if sentences else text[:200]

    @classmethod
    def _local_grounded_fallback(cls, question: str, chunks: List[Dict[str, Any]]) -> str:
        """Heuristic grounded answer synthesizer for local runs without LLM keys."""
        top_chunk = chunks[0]
        meta = top_chunk.get("metadata", {})
        snippet = cls._extract_substantive_snippet(top_chunk.get("text", ""))
        src_name = meta.get('source_path', 'document').replace('\\', '/').split('/')[-1]
        sec_title = meta.get('section_title', 'General')
        
        answer_parts = [
            f"According to {src_name} ({sec_title}), {snippet} [1]."
        ]
        if len(chunks) > 1:
            second_meta = chunks[1].get("metadata", {})
            second_snippet = cls._extract_substantive_snippet(chunks[1].get("text", ""))
            second_src = second_meta.get('source_path', 'document').replace('\\', '/').split('/')[-1]
            answer_parts.append(
                f"Furthermore, {second_src} indicates that {second_snippet} [2]."
            )

        return " ".join(answer_parts)
