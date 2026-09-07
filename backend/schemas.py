from typing import Optional

from pydantic import BaseModel


class RunRequest(BaseModel):
    limit: Optional[int] = None
    gmail_query: Optional[str] = None


class ConfigUpdate(BaseModel):
    gmailQuery: Optional[str] = None
    limit: Optional[int] = None
