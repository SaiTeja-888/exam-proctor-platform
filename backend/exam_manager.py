from __future__ import annotations

import json
from typing import Any

from database import get_connection, new_id, now_iso, parse_json, row_to_dict, rows_to_dicts


def create_exam(title: str, description: str, duration_min: int, created_by: str = "admin", is_active: bool = True) -> dict[str, Any]:
    exam_id = new_id()
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO exams (id, title, description, duration_min, created_by, created_at, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (exam_id, title, description, duration_min, created_by, now_iso(), int(is_active)),
        )
        exam = conn.execute("SELECT * FROM exams WHERE id = ?", (exam_id,)).fetchone()
    return row_to_dict(exam) or {}


def serialize_question(row: dict[str, Any]) -> dict[str, Any]:
    row["test_cases"] = parse_json(row.get("test_cases"), [])
    return row


def list_questions(exam_id: str, candidate_view: bool = False) -> list[dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM questions WHERE exam_id = ? ORDER BY order_num ASC, id ASC",
            (exam_id,),
        ).fetchall()
    questions = [serialize_question(row) for row in rows_to_dicts(rows)]
    if candidate_view:
        for question in questions:
            question.pop("correct_ans", None)
            if question["type"] == "coding":
                question["test_cases"] = [{"input": item.get("input", "")} for item in question.get("test_cases", [])]
    return questions


def add_question(exam_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    question_id = new_id()
    with get_connection() as conn:
        order_num = payload.get("order_num")
        if order_num is None:
            row = conn.execute("SELECT COALESCE(MAX(order_num), 0) + 1 AS next_order FROM questions WHERE exam_id = ?", (exam_id,)).fetchone()
            order_num = row["next_order"]
        conn.execute(
            """
            INSERT INTO questions (
                id, exam_id, type, order_num, prompt, option_a, option_b, option_c, option_d,
                correct_ans, marks, language, test_cases, boilerplate
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                question_id,
                exam_id,
                payload.get("type"),
                order_num,
                payload.get("prompt"),
                payload.get("option_a"),
                payload.get("option_b"),
                payload.get("option_c"),
                payload.get("option_d"),
                payload.get("correct_ans"),
                payload.get("marks", 1),
                payload.get("language"),
                json.dumps(payload.get("test_cases") or []),
                payload.get("boilerplate"),
            ),
        )
        row = conn.execute("SELECT * FROM questions WHERE id = ?", (question_id,)).fetchone()
    return serialize_question(row_to_dict(row) or {})


def update_question(question_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    allowed = {
        "type",
        "order_num",
        "prompt",
        "option_a",
        "option_b",
        "option_c",
        "option_d",
        "correct_ans",
        "marks",
        "language",
        "test_cases",
        "boilerplate",
    }
    updates = {key: value for key, value in payload.items() if key in allowed and value is not None}
    if "test_cases" in updates:
        updates["test_cases"] = json.dumps(updates["test_cases"])
    if updates:
        fields = ", ".join(f"{key} = ?" for key in updates)
        with get_connection() as conn:
            conn.execute(f"UPDATE questions SET {fields} WHERE id = ?", (*updates.values(), question_id))
            row = conn.execute("SELECT * FROM questions WHERE id = ?", (question_id,)).fetchone()
    else:
        with get_connection() as conn:
            row = conn.execute("SELECT * FROM questions WHERE id = ?", (question_id,)).fetchone()
    return serialize_question(row_to_dict(row) or {}) if row else None
