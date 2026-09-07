import os

from fastapi import APIRouter, HTTPException

from pipeline import run as run_pipeline

from ..schemas import RunRequest

router = APIRouter(prefix="/api", tags=["run"])


@router.post("/run")
def trigger_run(body: RunRequest = RunRequest()):
    if "OPENAI_API_KEY" not in os.environ:
        raise HTTPException(400, "OPENAI_API_KEY not set in the backend's environment.")
    result = run_pipeline(limit=body.limit, gmail_query=body.gmail_query)
    return {"fetched": result["fetched"], "relevant": len(result["relevant"])}
