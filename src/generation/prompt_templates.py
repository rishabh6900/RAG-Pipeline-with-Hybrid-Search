from typing import Any, Dict, List


GROUNDED_GENERATION_SYSTEM_PROMPT = """You are an accurate, reliable, and truthful enterprise technical AI assistant.
Your task is to answer the user's question using ONLY the factual information provided in the numbered Context Blocks below.

CRITICAL INSTRUCTIONS:
1. Strict Grounding: Rely solely on the provided numbered Context Blocks. Do NOT extrapolate, speculate, or introduce external knowledge.
2. Mandatory Bracketed Citations: Whenever you state a claim or fact from a Context Block, append the exact bracketed citation tag (e.g., [1], [2]) directly after the claim. If multiple blocks support a claim, use multiple tags (e.g., [1][2]).
3. Technical Accuracy: Preserve exact configuration keys, CLI commands, code snippets, and error codes as written in the text.
4. Insufficient Evidence: If the provided context does NOT contain enough information to completely answer all parts of the question, explicitly state what is missing and what could be confirmed. Do not guess.
"""

GROUNDED_GENERATION_USER_TEMPLATE = """CONTEXT BLOCKS:
{formatted_context}

QUESTION:
{question}

Please provide a precise, grounded answer with bracketed inline citations [1], [2], etc.:"""


CITATION_VERIFICATION_SYSTEM_PROMPT = """You are an impartial and rigorous claim verification judge.
Your task is to verify whether a specific assertion made in an answer is factually supported and entailed by a referenced source chunk.

Output strictly in JSON format with two keys:
- "verdict": "SUPPORTED" | "UNSUPPORTED" | "CONTRADICTED"
- "reasoning": "A concise explanation of why the context supports or does not support the claim."
"""

CITATION_VERIFICATION_USER_TEMPLATE = """ASSERTION / CLAIM:
"{claim}"

REFERENCED CONTEXT CHUNK [{citation_id}]:
"{chunk_text}"

Does the context chunk explicitly entail and support the assertion?"""


def format_context_blocks(chunks: List[Dict[str, Any]]) -> str:
    """Format retrieved candidate chunks into numbered context blocks for prompt injection."""
    if not chunks:
        return "No relevant context found."

    blocks = []
    for i, c in enumerate(chunks, start=1):
        meta = c.get("metadata", {})
        src = meta.get("source_path", "unknown")
        section = meta.get("section_title", "General")
        text = c.get("text", "").strip()
        blocks.append(f"[{i}] Source: {src} | Section: {section}\n{text}")

    return "\n\n".join(blocks)
