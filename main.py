"""Root-level FastAPI entrypoint for deployment auto-detection."""
import os
import sys

# Ensure root workspace is on python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.api.main import app

if __name__ == "__main__":
    import uvicorn
    from config.settings import settings
    uvicorn.run("main:app", host=settings.API_HOST, port=settings.API_PORT, reload=True)
