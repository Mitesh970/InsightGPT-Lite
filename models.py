from typing import Any, Literal

from pydantic import BaseModel, Field, HttpUrl

KnowledgeType = Literal["document", "hotel", "travel"]


class Chunk(BaseModel):
    id: str
    text: str
    metadata: dict[str, Any]


class UploadResponse(BaseModel):
    document_id: str
    filename: str
    chunks_added: int
    duplicate: bool


class UrlIngestRequest(BaseModel):
    url: HttpUrl
    knowledge_type: KnowledgeType = "document"


class JsonIngestRequest(BaseModel):
    title: str = Field(default="JSON knowledge base", min_length=1)
    knowledge_type: KnowledgeType
    records: list[dict[str, Any]] = Field(min_length=1)


class QueryRequest(BaseModel):
    question: str = Field(min_length=1)
    top_k: int = Field(default=8, ge=1, le=20)
    mode: str = "document"


class Source(BaseModel):
    chunk_id: str
    document_id: str
    source_type: Literal["pdf", "url", "json"]
    knowledge_type: KnowledgeType = "document"
    title: str
    page_number: int | None = None
    url: str | None = None
    similarity: float
    rerank_score: float
    confidence: float
    preview: str


class DocumentInfo(BaseModel):
    document_id: str
    source_type: Literal["pdf", "url", "json"]
    knowledge_type: KnowledgeType = "document"
    title: str
    filename: str | None = None
    url: str | None = None
    chunk_count: int
    created_at: str
