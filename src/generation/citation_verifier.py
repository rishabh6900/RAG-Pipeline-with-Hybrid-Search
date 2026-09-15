import json
import re
from typing import Any, Dict, List, Optional, Tuple
from config.logging_config import logger
from config.settings import settings
from src.generation.generator import get_llm_client, GROQ_FALLBACK_MODELS
from src.generation.prompt_templates import (
    CITATION_VERIFICATION_SYSTEM_PROMPT,
    CITATION_VERIFICATION_USER_TEMPLATE,
)


class CitationVerifier:
    """Extracts inline bracket citations and validates claim-context entailment via LLM-as-a-Judge (Groq / OpenAI)."""

    def __init__(self, model_name: Optional[str] = None):
        raw_model = model_name or settings.LLM_MODEL
        self.model_name = raw_model.replace("groq:", "").replace("openai/", "").strip()
        self.client = get_llm_client()

    @staticmethod
    def extract_claims_and_citations(answer: str) -> List[Dict[str, Any]]:
        """
        Deconstructs text into sentence claims and associated bracketed citation indices.
        Example: "Vault rotation takes 15m [1]." -> claim: "Vault rotation takes 15m", citation_indices: [1]
        """
        sentence_regex = re.compile(r'(?<=[.!?])\s+(?=[A-Z0-9])')
        sentences = sentence_regex.split(answer.strip())

        extracted = []
        for sentence in sentences:
            citation_matches = re.findall(r'\[(\d+)\]', sentence)
            if citation_matches:
                citation_indices = [int(idx) for idx in citation_matches]
                clean_claim = re.sub(r'\[\d+\]', '', sentence).strip()
                extracted.append({
                    "raw_sentence": sentence,
                    "claim": clean_claim,
                    "citation_indices": citation_indices
                })

        return extracted

    def verify_claim(self, claim: str, chunk_text: str, citation_id: int) -> Dict[str, Any]:
        """Verify if a single claim is entailed by the specified context chunk."""
        client = self.client or get_llm_client()
        if client:
            candidate_models = [self.model_name]
            if settings.GROQ_API_KEY and self.model_name not in GROQ_FALLBACK_MODELS:
                candidate_models.extend(GROQ_FALLBACK_MODELS)

            user_msg = CITATION_VERIFICATION_USER_TEMPLATE.format(
                claim=claim,
                citation_id=citation_id,
                chunk_text=chunk_text
            )

            for model in candidate_models:
                try:
                    response = client.chat.completions.create(
                        model=model,
                        messages=[
                            {"role": "system", "content": CITATION_VERIFICATION_SYSTEM_PROMPT},
                            {"role": "user", "content": user_msg}
                        ],
                        temperature=0.0,
                        response_format={"type": "json_object"} if hasattr(client, "chat") else None,
                        max_tokens=300
                    )
                    raw_json = response.choices[0].message.content or "{}"
                    return json.loads(raw_json)
                except Exception as e:
                    err_msg = str(e)
                    if "model_not_found" in err_msg or "404" in err_msg:
                        continue
                    else:
                        logger.debug(f"LLM Judge verification failed ({e}). Using lexical overlap fallback.")
                        break

        # Fallback heuristic entailment
        return self._heuristic_claim_verifier(claim, chunk_text)

    @staticmethod
    def _heuristic_claim_verifier(claim: str, chunk_text: str) -> Dict[str, Any]:
        """Lexical substring and token set overlap verification fallback."""
        stop_words = {"a", "an", "the", "in", "on", "of", "to", "and", "is", "it", "that", "this", "according", "indicates", "furthermore", "regarding", "based", "documentation", "doc"}
        claim_words = {w for w in re.findall(r'\w+', claim.lower()) if len(w) > 2 and w not in stop_words}
        chunk_words = {w for w in re.findall(r'\w+', chunk_text.lower()) if len(w) > 2}

        if not claim_words:
            return {"verified": True, "verdict": "VERIFIED", "reasoning": "Claim asserts direct passage context."}

        overlap = len(claim_words.intersection(chunk_words)) / len(claim_words)
        is_verified = overlap >= 0.25 or (claim.lower() in chunk_text.lower())

        return {
            "verified": is_verified,
            "verdict": "VERIFIED" if is_verified else "UNVERIFIED",
            "reasoning": f"Grounded evidence match score is {overlap * 100:.1f}%."
        }

    def verify_answer_citations(
        self,
        answer: str,
        retrieved_chunks: List[Dict[str, Any]]
    ) -> Tuple[List[Dict[str, Any]], float]:
        """
        Extracts all citations, maps each to candidate chunk, executes judgment,
        and computes normalized grounding precision.
        """
        extracted_claims = self.extract_claims_and_citations(answer)
        if not extracted_claims:
            return [], 1.0

        citation_results = []
        verified_count = 0

        for item in extracted_claims:
            claim = item["claim"]
            for cit_idx in item["citation_indices"]:
                if 1 <= cit_idx <= len(retrieved_chunks):
                    matched_chunk = retrieved_chunks[cit_idx - 1]
                    chunk_text = matched_chunk.get("text", "")
                    meta = matched_chunk.get("metadata", {})
                    
                    judge_res = self.verify_claim(claim, chunk_text, cit_idx)
                    is_ver = judge_res.get("verified", False)
                    if is_ver:
                        verified_count += 1

                    citation_results.append({
                        "citation_id": cit_idx,
                        "claim": claim,
                        "chunk_id": matched_chunk.get("chunk_id", ""),
                        "source_file": meta.get("source_path", "unknown"),
                        "section": meta.get("section_title", "General"),
                        "verified": is_ver,
                        "verdict": judge_res.get("verdict", "UNVERIFIED"),
                        "reasoning": judge_res.get("reasoning", "Evidence span evaluated."),
                        "snippet": chunk_text[:300] + ("..." if len(chunk_text) > 300 else "")
                    })
                else:
                    citation_results.append({
                        "citation_id": cit_idx,
                        "claim": claim,
                        "chunk_id": "NONE",
                        "source_file": "Phantom Citation",
                        "section": "Hallucinated Out-of-Bounds Index",
                        "verified": False,
                        "verdict": "REFUTED",
                        "reasoning": f"Citation [{cit_idx}] references a non-existent context chunk.",
                        "snippet": "No source context available."
                    })

        grounding_score = verified_count / max(1, len(citation_results))
        return citation_results, round(grounding_score, 4)
