from __future__ import annotations

import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable

from auth import generate_invite_code, hash_password


ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT_DIR / "backend" / "data"
DB_PATH = DATA_DIR / "proctor.sqlite3"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


@contextmanager
def get_connection() -> Iterable[sqlite3.Connection]:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    data = dict(row)
    for key in ("used", "is_active", "face_registered", "is_correct"):
        if key in data and data[key] is not None:
            data[key] = bool(data[key])
    return data


def rows_to_dicts(rows: Iterable[sqlite3.Row]) -> list[dict[str, Any]]:
    return [row_to_dict(row) or {} for row in rows]


def init_db() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with get_connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS admins (
                id          TEXT PRIMARY KEY,
                username    TEXT UNIQUE NOT NULL,
                password    TEXT NOT NULL,
                created_at  TEXT
            );

            CREATE TABLE IF NOT EXISTS exams (
                id           TEXT PRIMARY KEY,
                title        TEXT NOT NULL,
                description  TEXT,
                duration_min INTEGER NOT NULL,
                created_by   TEXT,
                created_at   TEXT,
                is_active    BOOLEAN DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS questions (
                id           TEXT PRIMARY KEY,
                exam_id      TEXT NOT NULL,
                type         TEXT NOT NULL,
                order_num    INTEGER,
                prompt       TEXT NOT NULL,
                option_a     TEXT,
                option_b     TEXT,
                option_c     TEXT,
                option_d     TEXT,
                correct_ans  TEXT,
                marks        INTEGER DEFAULT 1,
                language     TEXT,
                test_cases   TEXT,
                boilerplate  TEXT,
                FOREIGN KEY(exam_id) REFERENCES exams(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS invite_codes (
                id             TEXT PRIMARY KEY,
                code           TEXT UNIQUE NOT NULL,
                exam_id        TEXT NOT NULL,
                candidate_id   TEXT,
                candidate_name TEXT,
                email          TEXT,
                used           BOOLEAN DEFAULT 0,
                expires_at     TEXT,
                created_at     TEXT,
                FOREIGN KEY(exam_id) REFERENCES exams(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS candidates (
                id              TEXT PRIMARY KEY,
                invite_code     TEXT UNIQUE,
                name            TEXT,
                email           TEXT,
                exam_id         TEXT,
                face_registered BOOLEAN DEFAULT 0,
                face_path       TEXT,
                session_token   TEXT,
                started_at      TEXT,
                submitted_at    TEXT,
                status          TEXT DEFAULT 'pending',
                FOREIGN KEY(exam_id) REFERENCES exams(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS answers (
                id            TEXT PRIMARY KEY,
                candidate_id  TEXT,
                question_id   TEXT,
                exam_id       TEXT,
                answer_text   TEXT,
                is_correct    BOOLEAN,
                marks_awarded INTEGER DEFAULT 0,
                submitted_at  TEXT,
                FOREIGN KEY(candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
                FOREIGN KEY(question_id) REFERENCES questions(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS incidents (
                id            TEXT PRIMARY KEY,
                candidate_id  TEXT,
                exam_id       TEXT,
                event_type    TEXT,
                severity      TEXT,
                detail        TEXT,
                timestamp     TEXT,
                snapshot_path TEXT,
                FOREIGN KEY(candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
                FOREIGN KEY(exam_id) REFERENCES exams(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS scores (
                id             TEXT PRIMARY KEY,
                candidate_id   TEXT,
                exam_id        TEXT,
                total_marks    INTEGER,
                marks_obtained INTEGER,
                risk_score     INTEGER,
                final_status   TEXT,
                submitted_at   TEXT,
                FOREIGN KEY(candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
                FOREIGN KEY(exam_id) REFERENCES exams(id) ON DELETE CASCADE
            );
            """
        )
        seed_demo_data(conn)


def seed_demo_data(conn: sqlite3.Connection) -> None:
    admin = conn.execute("SELECT id FROM admins WHERE username = ?", ("admin",)).fetchone()
    if not admin:
        conn.execute(
            "INSERT INTO admins (id, username, password, created_at) VALUES (?, ?, ?, ?)",
            (new_id(), "admin", hash_password("admin123"), now_iso()),
        )

    existing_exam = conn.execute("SELECT id FROM exams LIMIT 1").fetchone()
    if existing_exam:
        return

    exam_id = new_id()
    conn.execute(
        """
        INSERT INTO exams (id, title, description, duration_min, created_by, created_at, is_active)
        VALUES (?, ?, ?, ?, ?, ?, 1)
        """,
        (
            exam_id,
            "Backend Developer Assessment",
            "Mixed MCQ and coding exam with live AI proctoring.",
            60,
            "seed",
            now_iso(),
        ),
    )
    questions = [
        {
            "type": "mcq",
            "prompt": "What does Big O notation describe?",
            "option_a": "A time or space growth rate",
            "option_b": "A database index type",
            "option_c": "A network protocol",
            "option_d": "A UI rendering method",
            "correct_ans": "A",
            "marks": 2,
        },
        {
            "type": "coding",
            "prompt": "Write a function named factorial that returns n factorial.",
            "language": "python",
            "boilerplate": "def factorial(n):\n    # your code here\n    return 1\n\nprint(factorial(int(input())))",
            "test_cases": json.dumps(
                [
                    {"input": "5", "expected_output": "120"},
                    {"input": "0", "expected_output": "1"},
                    {"input": "3", "expected_output": "6"},
                ]
            ),
            "marks": 5,
        },
    ]
    for index, question in enumerate(questions, start=1):
        conn.execute(
            """
            INSERT INTO questions (
                id, exam_id, type, order_num, prompt, option_a, option_b, option_c, option_d,
                correct_ans, marks, language, test_cases, boilerplate
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                new_id(),
                exam_id,
                question.get("type"),
                index,
                question.get("prompt"),
                question.get("option_a"),
                question.get("option_b"),
                question.get("option_c"),
                question.get("option_d"),
                question.get("correct_ans"),
                question.get("marks", 1),
                question.get("language"),
                question.get("test_cases"),
                question.get("boilerplate"),
            ),
        )

    conn.execute(
        """
        INSERT INTO invite_codes (id, code, exam_id, used, expires_at, created_at)
        VALUES (?, ?, ?, 0, ?, ?)
        """,
        (
            new_id(),
            "EXAM-DEMO-2026",
            exam_id,
            (datetime.now(timezone.utc) + timedelta(days=14)).isoformat(),
            now_iso(),
        ),
    )


def parse_json(value: str | None, fallback: Any = None) -> Any:
    if value is None or value == "":
        return fallback
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return fallback
