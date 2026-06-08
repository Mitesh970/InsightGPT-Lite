import asyncio
import json
from pathlib import Path

import aiofiles
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from app.chunking import chunk_text
from app.config import FRONTEND_ORIGIN, UPLOAD_DIR
from app.models import DocumentInfo, JsonIngestRequest, QueryRequest, UploadResponse, UrlIngestRequest
from app.pdf_ingest import extract_pdf_pages
from app.rag import stream_answer
from app.store import load_documents, save_document, store
from app.url_ingest import scrape_url
from app.utils import now_iso, sha256_bytes, sha256_text

app = FastAPI(title="InsightGPT Lite RAG API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN, "http://127.0.0.1:3000", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
def unexpected_error_handler(_, exc: Exception) -> JSONResponse:
    return JSONResponse(status_code=500, content={"detail": str(exc)})


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


def json_record_to_text(record: dict) -> str:
    lines = []
    for key, value in record.items():
        if value is None or value == "":
            continue
        if isinstance(value, list):
            value = ", ".join(str(item) for item in value)
        elif isinstance(value, dict):
            value = json.dumps(value, ensure_ascii=False)
        lines.append(f"{key}: {value}")
    return "\n".join(lines)


@app.post("/upload", response_model=UploadResponse)
async def upload(file: UploadFile = File(...), knowledge_type: str = Form("document")) -> UploadResponse:
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Upload a PDF file.")
    if knowledge_type not in {"document", "hotel", "travel"}:
        raise HTTPException(status_code=400, detail="knowledge_type must be document, hotel, or travel.")

    content = await file.read()
    document_id = sha256_text(f"{knowledge_type}:{sha256_bytes(content)}")

    if store.document_exists(document_id):
        return UploadResponse(document_id=document_id, filename=file.filename, chunks_added=0, duplicate=True)

    pdf_path = UPLOAD_DIR / f"{document_id}_{Path(file.filename).name}"
    async with aiofiles.open(pdf_path, "wb") as output:
        await output.write(content)

    pages = await asyncio.to_thread(extract_pdf_pages, pdf_path)
    chunks = []
    for page in pages:
        chunks.extend(
            chunk_text(
                document_id=document_id,
                source_type="pdf",
                knowledge_type=knowledge_type,
                title=file.filename,
                filename=file.filename,
                page_number=page["page_number"],
                text=page["markdown"],
            )
        )

    if not chunks:
        raise HTTPException(status_code=400, detail="No readable text found in this PDF.")

    added = await asyncio.to_thread(store.add_chunks, chunks)
    save_document(
        DocumentInfo(
            document_id=document_id,
            source_type="pdf",
            knowledge_type=knowledge_type,
            title=file.filename,
            filename=file.filename,
            chunk_count=added,
            created_at=now_iso(),
        )
    )

    return UploadResponse(document_id=document_id, filename=file.filename, chunks_added=added, duplicate=False)


@app.post("/ingest-url", response_model=UploadResponse)
async def ingest_url(request: UrlIngestRequest) -> UploadResponse:
    url = str(request.url)
    scraped = await scrape_url(url)
    document_id = sha256_text(f"{request.knowledge_type}:{url}")

    if store.document_exists(document_id):
        return UploadResponse(document_id=document_id, filename=url, chunks_added=0, duplicate=True)

    chunks = chunk_text(
        document_id=document_id,
        source_type="url",
        knowledge_type=request.knowledge_type,
        title=scraped["title"],
        url=url,
        text=scraped["markdown"],
    )
    if not chunks:
        raise HTTPException(status_code=400, detail="No readable text found at this URL.")

    added = await asyncio.to_thread(store.add_chunks, chunks)
    save_document(
        DocumentInfo(
            document_id=document_id,
            source_type="url",
            knowledge_type=request.knowledge_type,
            title=scraped["title"],
            url=url,
            chunk_count=added,
            created_at=now_iso(),
        )
    )

    return UploadResponse(document_id=document_id, filename=url, chunks_added=added, duplicate=False)


@app.post("/ingest-json", response_model=UploadResponse)
async def ingest_json(request: JsonIngestRequest) -> UploadResponse:
    if request.knowledge_type == "document":
        raise HTTPException(status_code=400, detail="JSON knowledge_type must be hotel or travel.")

    normalized_records = json.dumps(request.records, sort_keys=True, ensure_ascii=False)
    document_id = sha256_text(f"{request.knowledge_type}:{request.title}:{normalized_records}")

    if store.document_exists(document_id):
        return UploadResponse(document_id=document_id, filename=request.title, chunks_added=0, duplicate=True)

    chunks = []
    for index, record in enumerate(request.records):
        text = json_record_to_text(record)
        if not text:
            continue
        title = str(record.get("name") or record.get("title") or f"{request.title} #{index + 1}")
        metadata = {
            "record_index": index,
            "destination": record.get("destination") or record.get("city") or record.get("location") or "",
            "rating": record.get("rating") or "",
            "price": record.get("price") or record.get("budget") or record.get("nightly_price") or "",
            "amenities": ", ".join(record.get("amenities", [])) if isinstance(record.get("amenities"), list) else record.get("amenities", ""),
        }
        chunks.extend(
            chunk_text(
                document_id=document_id,
                source_type="json",
                knowledge_type=request.knowledge_type,
                title=title,
                text=text,
                extra_metadata=metadata,
            )
        )

    if not chunks:
        raise HTTPException(status_code=400, detail="No readable text found in JSON records.")

    added = await asyncio.to_thread(store.add_chunks, chunks)
    save_document(
        DocumentInfo(
            document_id=document_id,
            source_type="json",
            knowledge_type=request.knowledge_type,
            title=request.title,
            chunk_count=added,
            created_at=now_iso(),
        )
    )

    return UploadResponse(document_id=document_id, filename=request.title, chunks_added=added, duplicate=False)


@app.post("/query")
async def query(request: QueryRequest) -> StreamingResponse:
    return StreamingResponse(
        stream_answer(request.question.strip(), request.top_k, request.mode),
        media_type="application/x-ndjson",
    )


@app.get("/documents")
async def documents() -> list[DocumentInfo]:
    return load_documents()
