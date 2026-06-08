import asyncio
import json
import re
from typing import AsyncIterator

from app.config import DEFAULT_TOP_K, ENABLE_RERANKER, GOOGLE_API_KEY, RERANK_TOP_N
from app.model_loader import get_gemini_model, get_reranker
from app.models import Source
from app.store import store

MAX_CONTEXT_CHARS = 6000

AGENT_MODES = {
    "document": "Document Assistant",
    "hotel": "Hotel Finder",
    "travel": "Travel Planner",
    "resume": "Resume Assistant",
    "coding": "Coding Assistant",
    "research": "Research Assistant",
}

MODE_INSTRUCTIONS = {
    "document": (
        "Answer the user's question from the retrieved knowledge base. "
        "Be concise and cite sources after claims."
    ),
    "hotel": (
        "Create hotel recommendations from retrieved hotel context. Match the user's destination, "
        "budget, rating, and amenities when those details are available."
    ),
    "travel": (
        "Create a destination-specific travel plan from retrieved travel and hotel context. Include "
        "itinerary, hotel ideas, restaurants, budget notes, and tips only when supported."
    ),
    "resume": (
        "Act as a resume assistant using only the retrieved resume, job description, or career notes. "
        "Rewrite or suggest bullets only when the supporting experience appears in the context."
    ),
    "coding": (
        "Act as a coding assistant using only the retrieved code, docs, errors, or notes. "
        "Explain fixes that are supported by the context and ask for code/error documents when absent."
    ),
    "research": (
        "Act as a research assistant using only the retrieved sources. "
        "Organize the answer into key points and cite the evidence."
    ),
}

MODE_KNOWLEDGE_TYPES = {
    "document": ["document", "hotel", "travel"],
    "hotel": ["hotel", "document"],
    "travel": ["travel", "hotel", "document"],
    "resume": ["document"],
    "coding": ["document"],
    "research": ["document", "travel", "hotel"],
}

def rerank(question: str, candidates: list[dict]) -> list[dict]:
    if not candidates:
        return []

    reranker = get_reranker()
    pairs = [(question, item["text"]) for item in candidates]
    scores = reranker.predict(pairs).tolist()

    for item, score in zip(candidates, scores):
        normalized = 1.0 / (1.0 + pow(2.718281828, -float(score)))
        item["rerank_score"] = normalized
        item["confidence"] = round((item["similarity"] * 0.45 + normalized * 0.55) * 100, 1)

    return sorted(candidates, key=lambda item: item["confidence"], reverse=True)[:RERANK_TOP_N]


def query_terms(question: str) -> set[str]:
    terms = {term.lower() for term in re.findall(r"[A-Za-z0-9]+", question)}
    stopwords = {
        "a",
        "an",
        "and",
        "answer",
        "define",
        "explain",
        "give",
        "is",
        "it",
        "meaning",
        "of",
        "the",
        "to",
        "what",
        "who",
        "why",
        "how",
        "in",
        "on",
        "for",
        "me",
        "my",
        "with",
        "under",
        "find",
        "plan",
    }
    return terms - stopwords


def fast_rank(question: str, candidates: list[dict]) -> list[dict]:
    terms = query_terms(question)

    for item in candidates:
        text = item["text"].lower()
        matched_terms = sum(1 for term in terms if re.search(rf"\b{re.escape(term)}\b", text))
        keyword_boost = min(0.65, matched_terms * 0.25)
        metadata = item.get("metadata", {})
        metadata_text = " ".join(str(metadata.get(key, "")) for key in ("destination", "rating", "price", "amenities")).lower()
        metadata_matches = sum(1 for term in terms if term and term in metadata_text)
        metadata_boost = min(0.35, metadata_matches * 0.12)
        item["ranking_score"] = item["similarity"] + keyword_boost + metadata_boost

    ranked = sorted(candidates, key=lambda item: item["ranking_score"], reverse=True)[:RERANK_TOP_N]
    for item in ranked:
        item["rerank_score"] = item["similarity"]
        item["confidence"] = round(min(95.0, max(item["similarity"], item["ranking_score"]) * 100), 1)
    return ranked


def to_sources(items: list[dict]) -> list[Source]:
    sources: list[Source] = []
    for item in items:
        metadata = item["metadata"]
        sources.append(
            Source(
                chunk_id=metadata["chunk_id"],
                document_id=metadata["document_id"],
                source_type=metadata["source_type"],
                knowledge_type=metadata.get("knowledge_type", "document"),
                title=metadata["title"],
                page_number=metadata.get("page_number") or None,
                url=metadata.get("url") or None,
                similarity=round(item["similarity"], 4),
                rerank_score=round(item["rerank_score"], 4),
                confidence=item["confidence"],
                preview=item["text"][:360],
            )
        )
    return sources


def citation_label(index: int, metadata: dict) -> str:
    page = metadata.get("page_number")
    return f"[S{index} p.{page}]" if page else f"[S{index}]"


def build_prompt(question: str, items: list[dict], mode: str) -> str:
    context_blocks = []
    used_chars = 0
    for index, item in enumerate(items, start=1):
        metadata = item["metadata"]
        label = (
            f"{citation_label(index, metadata)} {metadata['title']} "
            f"({metadata.get('knowledge_type', 'document')}) chunk {metadata['chunk_index']}"
        )
        block = f"{label}\n{item['text'][:1400]}"
        if used_chars + len(block) > MAX_CONTEXT_CHARS:
            break
        context_blocks.append(block)
        used_chars += len(block)

    context = "\n\n---\n\n".join(context_blocks)
    instruction = MODE_INSTRUCTIONS.get(mode, MODE_INSTRUCTIONS["document"])
    assistant_name = AGENT_MODES.get(mode, AGENT_MODES["document"])

    output_format = {
        "hotel": """Output markdown:
## Best Matches
For each hotel, include: name, destination/location, approx price, rating, amenities, why it matches, and citation.
## Notes
Mention missing filters or booking cautions from context.""",
        "travel": """Output markdown:
## Trip Plan
Use day-wise cards: Day 1, Day 2, etc.
## Hotels
List hotel suggestions from retrieved context.
## Food & Restaurants
List restaurant or food suggestions from retrieved context.
## Budget
Estimate only from retrieved prices/costs.
## Tips
Practical travel tips with citations.""",
    }.get(mode, "Output concise markdown with citations.")

    return f"""You are InsightGPT Lite in {assistant_name} mode.
{instruction}

Rules:
- Use only the provided context.
- If the answer is not in the context, say what is missing instead of inventing details.
- Include citations like [S1 p.2] or [S2] after claims.
- Keep the answer simple and practical.
- Prefer the strongest matching sources first.

{output_format}

Question:
{question}

Context:
{context}
"""


def clean_context_line(line: str) -> str:
    return re.sub(r"\s+", " ", line).strip(" -")


def relevant_context_lines(question: str, items: list[dict]) -> list[str]:
    terms = query_terms(question)
    lines: list[str] = []

    for index, item in enumerate(items, start=1):
        metadata = item["metadata"]
        citation = citation_label(index, metadata)
        raw_lines = re.split(r"\n+|(?<=[.!?])\s+", item["text"])

        for raw_line in raw_lines:
            line = clean_context_line(raw_line)
            if len(line) < 18:
                continue
            if terms and not any(re.search(rf"\b{re.escape(term)}\b", line, re.IGNORECASE) for term in terms):
                continue
            lines.append(f"{line} {citation}")
            break

    return lines


def parse_key_value_text(text: str) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in text.splitlines():
        if ":" not in raw_line:
            continue
        key, value = raw_line.split(":", 1)
        key = key.strip().lower().replace(" ", "_")
        value = clean_context_line(value)
        if key and value:
            values[key] = value
    return values


def format_hotel_local_answer(items: list[dict]) -> str:
    lines = ["## Best Matches"]
    for index, item in enumerate(items[:4], start=1):
        metadata = item["metadata"]
        data = parse_key_value_text(item["text"])
        citation = citation_label(index, metadata)
        name = data.get("name") or data.get("hotel") or metadata.get("title", "Hotel option")
        destination = data.get("destination") or data.get("city") or data.get("location") or metadata.get("destination", "")
        price = data.get("price") or data.get("nightly_price") or data.get("budget") or metadata.get("price", "")
        rating = data.get("rating") or str(metadata.get("rating", "")).strip()
        amenities = data.get("amenities") or str(metadata.get("amenities", "")).strip()
        notes = data.get("notes") or data.get("description") or data.get("tips") or item["text"][:220]

        detail_parts = []
        if destination:
            detail_parts.append(f"Destination: {destination}")
        if price:
            detail_parts.append(f"Approx price: Rs {price}" if price.isdigit() else f"Approx price: {price}")
        if rating:
            detail_parts.append(f"Rating: {rating}")
        if amenities:
            detail_parts.append(f"Amenities: {amenities}")

        lines.append(f"\n### {index}. {name} {citation}")
        if detail_parts:
            lines.append("- " + "\n- ".join(detail_parts))
        lines.append(f"- Why it matches: {notes} {citation}")

    lines.append("\n## Notes")
    lines.append("These recommendations are only from your indexed hotel knowledge. Add more hotel JSON, PDFs, or URLs for better ranking.")
    return "\n".join(lines)


def format_travel_local_answer(items: list[dict]) -> str:
    travel_items = [item for item in items if item["metadata"].get("knowledge_type") == "travel"]
    hotel_items = [item for item in items if item["metadata"].get("knowledge_type") == "hotel"]
    lines = ["## Trip Plan"]

    if travel_items:
        for index, item in enumerate(travel_items[:4], start=1):
            metadata = item["metadata"]
            data = parse_key_value_text(item["text"])
            citation = citation_label(index, metadata)
            day = data.get("day") or f"Stop {index}"
            title = data.get("title") or data.get("name") or metadata.get("title", "Travel item")
            tip = data.get("tips") or data.get("notes") or data.get("description") or item["text"][:220]
            lines.append(f"\n### {day}: {title} {citation}")
            lines.append(f"- Plan: {tip} {citation}")
    else:
        lines.append("I found hotel data, but no travel guide or itinerary source yet.")

    lines.append("\n## Hotels")
    if hotel_items:
        for index, item in enumerate(hotel_items[:3], start=1):
            data = parse_key_value_text(item["text"])
            citation = citation_label(index, item["metadata"])
            name = data.get("name") or item["metadata"].get("title", "Hotel option")
            price = data.get("price") or data.get("budget") or ""
            rating = data.get("rating") or ""
            summary = ", ".join(part for part in [f"price {price}" if price else "", f"rating {rating}" if rating else ""] if part)
            lines.append(f"- {name}{f' ({summary})' if summary else ''} {citation}")
    else:
        lines.append("- No hotel suggestions found in retrieved context.")

    lines.append("\n## Food & Restaurants")
    lines.append("- No restaurant source found yet. Add travel guide or restaurant JSON for this section.")
    lines.append("\n## Budget")
    lines.append("- I can estimate budget after you index travel costs, hotel prices, transport, or restaurant data.")
    lines.append("\n## Tips")
    lines.append("- This plan is grounded only in indexed travel/hotel sources. Add more Goa travel guide data for a fuller itinerary.")
    return "\n".join(lines)


def empty_rag_answer(mode: str) -> str:
    if mode == "hotel":
        return (
            "I could not find hotel information in the indexed knowledge base. "
            "Please upload a hotel PDF, ingest a hotel listing URL, or paste hotel JSON, then ask again."
        )
    if mode == "travel":
        return (
            "I could not find travel planning information in the indexed knowledge base. "
            "Please upload destination guides, ingest tourism URLs, or paste travel JSON first."
        )
    if mode == "resume":
        return (
            "I could not find resume or job-description context in the indexed knowledge base. "
            "Please upload your resume or ingest the job description first."
        )
    if mode == "coding":
        return (
            "I could not find code or error context in the indexed knowledge base. "
            "Please upload or ingest the relevant code, docs, or error notes first."
        )
    if mode == "research":
        return (
            "I could not find research context in the indexed knowledge base. "
            "Please add source documents or URLs before asking for a grounded research answer."
        )
    return "I could not find relevant context in the indexed documents."


def build_local_answer(question: str, items: list[dict], mode: str = "document") -> str:
    if not items:
        return empty_rag_answer(mode)

    if mode == "hotel":
        return format_hotel_local_answer(items)

    if mode == "travel":
        return format_travel_local_answer(items)

    lines = relevant_context_lines(question, items[:4])
    if not lines:
        return (
            "I found sources, but none clearly answered that question. "
            "Try asking with words that appear in the uploaded documents."
        )

    prefix = ""
    if mode != "document":
        prefix = f"{AGENT_MODES.get(mode, 'Assistant')} answer from your indexed knowledge:\n\n"

    numbered = [f"{index}. {line}" for index, line in enumerate(lines[:4], start=1)]
    return prefix + "\n".join(numbered)


def has_valid_gemini_key() -> bool:
    key = GOOGLE_API_KEY.strip()
    return len(key) >= 30 and not key.lower().startswith("your_")


async def stream_answer(question: str, top_k: int = DEFAULT_TOP_K, mode: str = "document") -> AsyncIterator[str]:
    try:
        selected_mode = mode if mode in AGENT_MODES else "document"

        knowledge_types = MODE_KNOWLEDGE_TYPES.get(selected_mode, ["document"])
        retrieval_k = min(max(top_k, 6), 12)
        candidates = await asyncio.to_thread(store.query, question, retrieval_k, knowledge_types)
        ranked = await asyncio.to_thread(rerank, question, candidates) if ENABLE_RERANKER else fast_rank(question, candidates)
        sources = to_sources(ranked)
        overall_confidence = round(max((source.confidence for source in sources), default=0.0), 1)

        yield json.dumps(
            {
                "type": "metadata",
                "confidence": overall_confidence,
                "sources": [source.model_dump() for source in sources],
            }
        ) + "\n"

        if not ranked:
            answer = empty_rag_answer(selected_mode)
            yield json.dumps({"type": "token", "text": answer}) + "\n"
            yield json.dumps({"type": "done"}) + "\n"
            return

        if not has_valid_gemini_key():
            answer = build_local_answer(question, ranked, selected_mode)
            yield json.dumps({"type": "token", "text": answer}) + "\n"
            yield json.dumps({"type": "done"}) + "\n"
            return

        try:
            prompt = build_prompt(question, ranked, selected_mode)
            model = get_gemini_model()
            response_stream = await asyncio.wait_for(
                asyncio.to_thread(model.generate_content, prompt, stream=True),
                timeout=15.0,
            )

            for chunk in response_stream:
                chunk_text = getattr(chunk, "text", "")
                if chunk_text:
                    yield json.dumps({"type": "token", "text": chunk_text}) + "\n"
                    await asyncio.sleep(0)

        except asyncio.TimeoutError:
            answer = build_local_answer(question, ranked, selected_mode)
            yield json.dumps({"type": "token", "text": f"Gemini timed out. Fast RAG answer:\n\n{answer}"}) + "\n"

        except Exception:
            answer = build_local_answer(question, ranked, selected_mode)
            yield json.dumps({"type": "token", "text": answer}) + "\n"

        yield json.dumps({"type": "done"}) + "\n"

    except Exception as exc:
        message = f"Backend query failed before retrieval: {exc}"
        yield json.dumps({"type": "token", "text": message}) + "\n"
        yield json.dumps({"type": "done"}) + "\n"
