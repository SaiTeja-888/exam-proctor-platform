from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


QuestionType = Literal["mcq", "coding"]
Severity = Literal["low", "medium", "high", "critical"]


class AdminLogin(BaseModel):
    username: str
    password: str


class CandidateCodeRequest(BaseModel):
    invite_code: str
    candidate_name: str | None = None
    email: str | None = None


class ExamCreate(BaseModel):
    title: str
    description: str | None = ""
    duration_min: int = Field(ge=1, le=480)
    is_active: bool = True


class ExamUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    duration_min: int | None = Field(default=None, ge=1, le=480)
    is_active: bool | None = None


class QuestionCreate(BaseModel):
    type: QuestionType
    prompt: str
    order_num: int | None = None
    option_a: str | None = None
    option_b: str | None = None
    option_c: str | None = None
    option_d: str | None = None
    correct_ans: str | None = None
    marks: int = Field(default=1, ge=1, le=100)
    language: str | None = None
    test_cases: list[dict[str, str]] | None = None
    boilerplate: str | None = None


class InviteGenerateRequest(BaseModel):
    exam_id: str
    count: int = Field(default=1, ge=1, le=200)
    expires_in_days: int = Field(default=14, ge=1, le=365)
    candidate_name: str | None = None
    email: str | None = None


class NoiseEvent(BaseModel):
    candidate_id: str
    exam_id: str | None = None
    noise_level: float


class BrowserEvent(BaseModel):
    candidate_id: str
    exam_id: str | None = None
    event: str
    detail: dict | None = None


class StartExamRequest(BaseModel):
    candidate_id: str
    exam_id: str


class SubmitMCQRequest(BaseModel):
    candidate_id: str
    exam_id: str
    question_id: str
    answer: str


class SubmitCodeRequest(BaseModel):
    candidate_id: str
    exam_id: str
    question_id: str
    language: str
    source_code: str


class FinishExamRequest(BaseModel):
    candidate_id: str
    exam_id: str
