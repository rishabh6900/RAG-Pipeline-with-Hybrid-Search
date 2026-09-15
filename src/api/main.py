from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config.logging_config import logger
from config.settings import settings
from src.api.routes.documents import router as documents_router
from src.api.routes.health import router as health_router
from src.api.routes.query import router as query_router
from src.api.main import app


app = FastAPI(
    title="Enterprise Hybrid RAG API",
    description="Production-grade Hybrid Search (Dense + BM25) RAG API with Citation Verification and Confidence Scoring.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Enable CORS for Angular frontend SPA
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(health_router)
app.include_router(query_router)
app.include_router(documents_router)


@app.on_event("startup")
async def startup_event():
    logger.info("=" * 60)
    logger.info("🚀 Enterprise Hybrid RAG FastAPI Service Initialized")
    logger.info(f"Embedding Model: {settings.EMBEDDING_MODEL}")
    logger.info(f"LLM Model: {settings.LLM_MODEL}")
    logger.info(f"Reranker: {settings.RERANKER_MODEL}")
    logger.info(f"Allowed CORS: {settings.CORS_ORIGINS}")
    logger.info("=" * 60)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "src.api.main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=True
    )

# main.py
from src.api.main import app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
