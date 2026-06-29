from pydantic import BaseModel
from typing import Any
import uuid


class AnswerInput(BaseModel):
    question_id: uuid.UUID
    question_code: str
    question_type: str
    value_text: str | None = None
    value_number: float | None = None
    value_choice: str | None = None
    value_choices: list[str] | None = None
    value_matrix: dict | None = None
    value_other_text: str | None = None
    time_on_question_seconds: int | None = None


class RespondRequest(BaseModel):
    session_token: str
    turnstile_token: str
    device_fingerprint: str | None = None
    answers: list[AnswerInput]
    status: str = "completed"
    platform_source: str | None = None
    time_spent_seconds: int | None = None


class TrackRequest(BaseModel):
    session_token: str
    event_type: str
    question_index: int = 0
    time_spent: int = 0
    device_fingerprint: str | None = None
