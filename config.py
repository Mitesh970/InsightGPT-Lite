import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
CHROMA_DIR = DATA_DIR / "chroma"
MODEL_CACHE_DIR = DATA_DIR / "model-cache"
DOC_REGISTRY_PATH = DATA_DIR / "documents.json"

for directory in (DATA_DIR, UPLOAD_DIR, CHROMA_DIR, MODEL_CACHE_DIR):
    directory.mkdir(parents=True, exist_ok=True)

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")

EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
RERANK_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"
ENABLE_RERANKER = os.getenv("ENABLE_RERANKER", "false").lower() == "true"
GEMINI_TIMEOUT_SECONDS = int(os.getenv("GEMINI_TIMEOUT_SECONDS", "45"))
COLLECTION_NAME = "insightgpt_chunks"
CHUNK_SIZE = 1200
CHUNK_OVERLAP = 220
EMBED_BATCH_SIZE = 32
DEFAULT_TOP_K = 8
RERANK_TOP_N = 5
