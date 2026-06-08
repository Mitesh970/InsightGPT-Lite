from chromadb import PersistentClient

from app.config import CHROMA_DIR, COLLECTION_NAME, DOC_REGISTRY_PATH, EMBED_BATCH_SIZE
from app.model_loader import get_embedder
from app.models import Chunk, DocumentInfo
from app.utils import safe_json_load, safe_json_write


class VectorStore:
    def __init__(self) -> None:
        self.client = PersistentClient(path=str(CHROMA_DIR))
        self.collection = self.client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )

    def document_exists(self, document_id: str) -> bool:
        existing = self.collection.get(where={"document_id": document_id}, limit=1)
        return bool(existing.get("ids"))

    def add_chunks(self, chunks: list[Chunk]) -> int:
        if not chunks:
            return 0

        embedder = get_embedder()
        added = 0

        for start in range(0, len(chunks), EMBED_BATCH_SIZE):
            batch = chunks[start : start + EMBED_BATCH_SIZE]
            texts = [chunk.text for chunk in batch]
            embeddings = embedder.encode(
                texts,
                batch_size=EMBED_BATCH_SIZE,
                normalize_embeddings=True,
                show_progress_bar=False,
            ).tolist()
            self.collection.add(
                ids=[chunk.id for chunk in batch],
                documents=texts,
                embeddings=embeddings,
                metadatas=[chunk.metadata for chunk in batch],
            )
            added += len(batch)

        return added

    def query(self, question: str, top_k: int, knowledge_types: list[str] | None = None) -> list[dict]:
        embedder = get_embedder()
        embedding = embedder.encode([question], normalize_embeddings=True, show_progress_bar=False)[0].tolist()
        where = None
        if knowledge_types:
            where = {"knowledge_type": knowledge_types[0]} if len(knowledge_types) == 1 else {"knowledge_type": {"$in": knowledge_types}}
        result = self.collection.query(
            query_embeddings=[embedding],
            n_results=top_k,
            where=where,
            include=["documents", "metadatas", "distances"],
        )

        rows: list[dict] = []
        ids = result.get("ids", [[]])[0]
        docs = result.get("documents", [[]])[0]
        metadatas = result.get("metadatas", [[]])[0]
        distances = result.get("distances", [[]])[0]

        for chunk_id, document, metadata, distance in zip(ids, docs, metadatas, distances):
            similarity = max(0.0, min(1.0, 1.0 - float(distance)))
            rows.append(
                {
                    "chunk_id": chunk_id,
                    "text": document,
                    "metadata": metadata,
                    "similarity": similarity,
                }
            )

        return rows


store = VectorStore()


def load_documents() -> list[DocumentInfo]:
    raw = safe_json_load(DOC_REGISTRY_PATH, [])
    return [DocumentInfo(**item) for item in raw]


def save_document(info: DocumentInfo) -> None:
    documents = safe_json_load(DOC_REGISTRY_PATH, [])
    if any(item.get("document_id") == info.document_id for item in documents):
        return
    documents.append(info.model_dump())
    safe_json_write(DOC_REGISTRY_PATH, documents)
