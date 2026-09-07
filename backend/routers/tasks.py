from fastapi import APIRouter

from ..services.pipeline import ALL_MESSAGES_PATH, TASKS_PATH
from ..utils import iso, read_json

router = APIRouter(prefix="/api", tags=["tasks"])


@router.get("/tasks")
def get_tasks():
    data, mtime, error = read_json(TASKS_PATH)
    return {"records": data, "generatedAt": iso(mtime), "error": error}


@router.get("/messages")
def get_messages():
    data, mtime, error = read_json(ALL_MESSAGES_PATH)
    return {"messages": data, "generatedAt": iso(mtime), "error": error}
