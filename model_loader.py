from functools import lru_cache

import google.generativeai as genai

from app.config import EMBEDDING_MODEL, GEMINI_MODEL, GOOGLE_API_KEY, MODEL_CACHE_DIR, RERANK_MODEL


@lru_cache(maxsize=1)
def get_embedder():
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(EMBEDDING_MODEL, cache_folder=str(MODEL_CACHE_DIR))


@lru_cache(maxsize=1)
def get_reranker():
    from sentence_transformers import CrossEncoder

    return CrossEncoder(RERANK_MODEL, max_length=512, cache_folder=str(MODEL_CACHE_DIR))


@lru_cache(maxsize=1)
def get_gemini_model() -> genai.GenerativeModel:
    if not GOOGLE_API_KEY:
        raise RuntimeError("GOOGLE_API_KEY is missing. Add it to backend/.env.")
    genai.configure(api_key=GOOGLE_API_KEY)
    return genai.GenerativeModel(GEMINI_MODEL)
