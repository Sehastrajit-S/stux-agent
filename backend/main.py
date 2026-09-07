from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import actions, gmail, run, settings, tasks

app = FastAPI(title="Stux Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks.router)
app.include_router(run.router)
app.include_router(settings.router)
app.include_router(gmail.router)
app.include_router(actions.router)
