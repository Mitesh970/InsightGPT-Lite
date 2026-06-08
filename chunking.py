from app.config import CHUNK_OVERLAP, CHUNK_SIZE
from app.models import Chunk
from app.utils import normalize_text, sha256_text


def chunk_text(
    *,
    document_id: str,
    source_type: str,
    knowledge_type: str = "document",
    title: str,
    text: str,
    filename: str | None = None,
    page_number: int | None = None,
    url: str | None = None,
    extra_metadata: dict | None = None,
) -> list[Chunk]:
    normalized = normalize_text(text)
    if not normalized:
        return []

    paragraphs = [part.strip() for part in normalized.split("\n\n") if part.strip()]
    chunks: list[str] = []
    current = ""

    for paragraph in paragraphs:
        candidate = f"{current}\n\n{paragraph}".strip() if current else paragraph
        if len(candidate) <= CHUNK_SIZE:
            current = candidate
            continue

        if current:
            chunks.append(current)
        current = paragraph

        while len(current) > CHUNK_SIZE:
            chunks.append(current[:CHUNK_SIZE])
            current = current[CHUNK_SIZE - CHUNK_OVERLAP :]

    if current:
        chunks.append(current)

    with_overlap: list[str] = []
    previous_tail = ""
    for chunk in chunks:
        merged = normalize_text(f"{previous_tail}\n\n{chunk}") if previous_tail else chunk
        with_overlap.append(merged)
        previous_tail = chunk[-CHUNK_OVERLAP:]

    result: list[Chunk] = []
    for index, chunk in enumerate(with_overlap):
        chunk_id = f"{document_id}:{page_number or 0}:{index}:{sha256_text(chunk)[:10]}"
        metadata = {
            "document_id": document_id,
            "source_type": source_type,
            "knowledge_type": knowledge_type,
            "title": title,
            "filename": filename or "",
            "page_number": page_number or 0,
            "url": url or "",
            "chunk_index": index,
            "chunk_id": chunk_id,
        }
        if extra_metadata:
            metadata.update({key: value for key, value in extra_metadata.items() if value is not None})
        result.append(
            Chunk(
                id=chunk_id,
                text=chunk,
                metadata=metadata,
            )
        )

    return result
