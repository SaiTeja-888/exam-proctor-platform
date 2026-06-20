from __future__ import annotations

import json
from typing import Any

from database import get_connection, new_id, now_iso, row_to_dict, rows_to_dicts


def log_incident(
    candidate_id: str,
    exam_id: str | None,
    event_type: str,
    severity: str,
    detail: dict[str, Any] | None = None,
    snapshot_path: str | None = None,
) -> dict[str, Any]:
    incident_id = new_id()
    with get_connection() as conn:
        if exam_id is None:
            candidate = conn.execute("SELECT exam_id FROM candidates WHERE id = ?", (candidate_id,)).fetchone()
            exam_id = candidate["exam_id"] if candidate else None
        conn.execute(
            """
            INSERT INTO incidents (id, candidate_id, exam_id, event_type, severity, detail, timestamp, snapshot_path)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                incident_id,
                candidate_id,
                exam_id,
                event_type,
                severity,
                json.dumps(detail or {}),
                now_iso(),
                snapshot_path,
            ),
        )
    return {
        "id": incident_id,
        "candidate_id": candidate_id,
        "exam_id": exam_id,
        "event_type": event_type,
        "severity": severity,
        "detail": detail or {},
        "timestamp": now_iso(),
        "snapshot_path": snapshot_path,
    }


def list_incidents_for_candidate(candidate_id: str) -> list[dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM incidents WHERE candidate_id = ? ORDER BY timestamp DESC",
            (candidate_id,),
        ).fetchall()
    return [_decode_detail(row) for row in rows_to_dicts(rows)]


def list_incidents_for_exam(exam_id: str) -> list[dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT incidents.*, candidates.name AS candidate_name
            FROM incidents
            LEFT JOIN candidates ON candidates.id = incidents.candidate_id
            WHERE incidents.exam_id = ?
            ORDER BY incidents.timestamp DESC
            """,
            (exam_id,),
        ).fetchall()
    return [_decode_detail(row) for row in rows_to_dicts(rows)]


def latest_incident(candidate_id: str) -> dict[str, Any] | None:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM incidents WHERE candidate_id = ? ORDER BY timestamp DESC LIMIT 1",
            (candidate_id,),
        ).fetchone()
    return _decode_detail(row_to_dict(row)) if row else None


def _decode_detail(row: dict[str, Any] | None) -> dict[str, Any]:
    if not row:
        return {}
    try:
        row["detail"] = json.loads(row.get("detail") or "{}")
    except json.JSONDecodeError:
        row["detail"] = {}
    return row
