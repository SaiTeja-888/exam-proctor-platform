from __future__ import annotations

import asyncio
import io
import json
from datetime import datetime, timedelta, timezone
from typing import Any

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

from auth import create_token, generate_invite_code, verify_password
from code_runner import evaluate_code_question
from database import get_connection, init_db, new_id, now_iso, parse_json, row_to_dict, rows_to_dicts
from exam_manager import add_question, create_exam, list_questions, update_question
from face_registration import register_face, verify_face
from gaze_tracker import analyze_gaze
from incident_logger import latest_incident, list_incidents_for_candidate, list_incidents_for_exam, log_incident
from noise_detector import classify_noise
from risk_engine import calculate_risk, severity_for_event
from schemas import (
    AdminLogin,
    BrowserEvent,
    CandidateCodeRequest,
    ExamCreate,
    ExamUpdate,
    FinishExamRequest,
    InviteGenerateRequest,
    NoiseEvent,
    QuestionCreate,
    StartExamRequest,
    SubmitCodeRequest,
    SubmitMCQRequest,
)
from yolo_detector import run_yolo_detection


app = FastAPI(title="AI Exam Proctoring Platform", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

LIVE_STATE: dict[str, dict[str, Any]] = {}
INCIDENT_COOLDOWN: dict[tuple[str, str], datetime] = {}


@app.on_event("startup")
async def startup() -> None:
    init_db()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/auth/admin/login")
async def admin_login(payload: AdminLogin) -> dict[str, Any]:
    with get_connection() as conn:
        admin = conn.execute("SELECT * FROM admins WHERE username = ?", (payload.username,)).fetchone()
    if not admin or not verify_password(payload.password, admin["password"]):
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    token = create_token(admin["id"], "admin", {"username": admin["username"]})
    return {"access_token": token, "token_type": "bearer", "admin": {"id": admin["id"], "username": admin["username"]}}


@app.post("/auth/candidate/verify-code")
async def verify_invite_code(payload: CandidateCodeRequest) -> dict[str, Any]:
    code = payload.invite_code.strip().upper()
    with get_connection() as conn:
        invite = conn.execute("SELECT * FROM invite_codes WHERE code = ?", (code,)).fetchone()
        if not invite:
            raise HTTPException(status_code=404, detail="Invalid invite code")
        if invite["expires_at"] and datetime.fromisoformat(invite["expires_at"]) < datetime.now(timezone.utc):
            raise HTTPException(status_code=410, detail="Invite code expired")

        candidate_id = invite["candidate_id"] or new_id()
        candidate_name = payload.candidate_name or invite["candidate_name"] or "Candidate"
        email = payload.email or invite["email"]
        session_token = create_token(candidate_id, "candidate", {"exam_id": invite["exam_id"]}, expires_minutes=720)

        existing = conn.execute("SELECT id FROM candidates WHERE id = ?", (candidate_id,)).fetchone()
        if existing:
            conn.execute(
                """
                UPDATE candidates
                SET name = ?, email = ?, session_token = ?, status = CASE WHEN status = 'submitted' THEN status ELSE 'pending' END
                WHERE id = ?
                """,
                (candidate_name, email, session_token, candidate_id),
            )
        else:
            conn.execute(
                """
                INSERT INTO candidates (id, invite_code, name, email, exam_id, session_token, status)
                VALUES (?, ?, ?, ?, ?, ?, 'pending')
                """,
                (candidate_id, code, candidate_name, email, invite["exam_id"], session_token),
            )
        conn.execute(
            "UPDATE invite_codes SET used = 1, candidate_id = ?, candidate_name = ?, email = ? WHERE id = ?",
            (candidate_id, candidate_name, email, invite["id"]),
        )
        exam = conn.execute("SELECT * FROM exams WHERE id = ?", (invite["exam_id"],)).fetchone()

    return {
        "candidate_id": candidate_id,
        "exam_id": invite["exam_id"],
        "candidate_name": candidate_name,
        "session_token": session_token,
        "exam": row_to_dict(exam),
    }


@app.post("/admin/exams")
async def create_admin_exam(payload: ExamCreate) -> dict[str, Any]:
    return create_exam(payload.title, payload.description or "", payload.duration_min, is_active=payload.is_active)


@app.get("/admin/exams")
async def list_admin_exams() -> list[dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT exams.*,
                   COUNT(DISTINCT questions.id) AS question_count,
                   COUNT(DISTINCT invite_codes.id) AS invite_count,
                   COUNT(DISTINCT candidates.id) AS candidate_count
            FROM exams
            LEFT JOIN questions ON questions.exam_id = exams.id
            LEFT JOIN invite_codes ON invite_codes.exam_id = exams.id
            LEFT JOIN candidates ON candidates.exam_id = exams.id
            GROUP BY exams.id
            ORDER BY exams.created_at DESC
            """
        ).fetchall()
    return rows_to_dicts(rows)


@app.get("/admin/exams/{exam_id}")
async def get_admin_exam(exam_id: str) -> dict[str, Any]:
    with get_connection() as conn:
        exam = conn.execute("SELECT * FROM exams WHERE id = ?", (exam_id,)).fetchone()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    data = row_to_dict(exam) or {}
    data["questions"] = list_questions(exam_id)
    return data


@app.put("/admin/exams/{exam_id}")
async def update_admin_exam(exam_id: str, payload: ExamUpdate) -> dict[str, Any]:
    updates = payload.model_dump(exclude_unset=True)
    if updates:
        fields = ", ".join(f"{key} = ?" for key in updates)
        with get_connection() as conn:
            conn.execute(f"UPDATE exams SET {fields} WHERE id = ?", (*updates.values(), exam_id))
            exam = conn.execute("SELECT * FROM exams WHERE id = ?", (exam_id,)).fetchone()
    else:
        with get_connection() as conn:
            exam = conn.execute("SELECT * FROM exams WHERE id = ?", (exam_id,)).fetchone()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    return row_to_dict(exam) or {}


@app.delete("/admin/exams/{exam_id}")
async def delete_admin_exam(exam_id: str) -> dict[str, bool]:
    with get_connection() as conn:
        conn.execute("DELETE FROM exams WHERE id = ?", (exam_id,))
    return {"deleted": True}


@app.post("/admin/exams/{exam_id}/questions")
async def create_question(exam_id: str, payload: QuestionCreate) -> dict[str, Any]:
    return add_question(exam_id, payload.model_dump())


@app.get("/admin/exams/{exam_id}/questions")
async def get_questions(exam_id: str) -> list[dict[str, Any]]:
    return list_questions(exam_id)


@app.put("/admin/questions/{question_id}")
async def edit_question(question_id: str, payload: QuestionCreate) -> dict[str, Any]:
    question = update_question(question_id, payload.model_dump())
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    return question


@app.delete("/admin/questions/{question_id}")
async def delete_question(question_id: str) -> dict[str, bool]:
    with get_connection() as conn:
        conn.execute("DELETE FROM questions WHERE id = ?", (question_id,))
    return {"deleted": True}


@app.post("/admin/invite-codes/generate")
async def generate_invites(payload: InviteGenerateRequest) -> dict[str, Any]:
    codes: list[dict[str, Any]] = []
    expires_at = (datetime.now(timezone.utc) + timedelta(days=payload.expires_in_days)).isoformat()
    with get_connection() as conn:
        exam = conn.execute("SELECT id FROM exams WHERE id = ?", (payload.exam_id,)).fetchone()
        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found")
        for _ in range(payload.count):
            code = generate_invite_code()
            while conn.execute("SELECT id FROM invite_codes WHERE code = ?", (code,)).fetchone():
                code = generate_invite_code()
            invite_id = new_id()
            conn.execute(
                """
                INSERT INTO invite_codes (id, code, exam_id, candidate_name, email, used, expires_at, created_at)
                VALUES (?, ?, ?, ?, ?, 0, ?, ?)
                """,
                (invite_id, code, payload.exam_id, payload.candidate_name, payload.email, expires_at, now_iso()),
            )
            codes.append({"id": invite_id, "code": code, "expires_at": expires_at, "used": False})
    return {"codes": codes}


@app.get("/admin/invite-codes/{exam_id}")
async def list_invites(exam_id: str) -> list[dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM invite_codes WHERE exam_id = ? ORDER BY created_at DESC",
            (exam_id,),
        ).fetchall()
    return rows_to_dicts(rows)


@app.delete("/admin/invite-codes/{code_id}")
async def revoke_invite(code_id: str) -> dict[str, bool]:
    with get_connection() as conn:
        conn.execute("DELETE FROM invite_codes WHERE id = ?", (code_id,))
    return {"deleted": True}


@app.post("/candidate/register-face")
async def candidate_register_face(file: UploadFile = File(...), candidate_id: str = Form(...)) -> dict[str, Any]:
    frame_rgb = await _upload_to_rgb(file)
    result = register_face(candidate_id, frame_rgb)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Face registration failed"))
    with get_connection() as conn:
        conn.execute(
            "UPDATE candidates SET face_registered = 1, face_path = ? WHERE id = ?",
            (result["embedding_path"], candidate_id),
        )
    return result


@app.get("/candidate/face-status/{candidate_id}")
async def face_status(candidate_id: str) -> dict[str, Any]:
    with get_connection() as conn:
        row = conn.execute("SELECT id, face_registered, face_path FROM candidates WHERE id = ?", (candidate_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return row_to_dict(row) or {}


@app.post("/proctor/analyze")
async def analyze_frame(file: UploadFile = File(...), candidate_id: str = Form(...), exam_id: str = Form(...)) -> dict[str, Any]:
    frame_rgb = await _upload_to_rgb(file)
    try:
        import cv2

        frame_bgr = cv2.cvtColor(frame_rgb, cv2.COLOR_RGB2BGR)
    except Exception:
        frame_bgr = frame_rgb[:, :, ::-1]

    yolo_result = run_yolo_detection(frame_bgr)
    gaze_result = analyze_gaze(frame_rgb)
    face_verify = verify_face(candidate_id, frame_rgb)

    events: list[str] = []
    if yolo_result["no_face"]:
        events.append("no_face")
        _log_with_cooldown(candidate_id, exam_id, "no_face", "high")
    if yolo_result["multiple_faces"]:
        events.append("multiple_faces")
        _log_with_cooldown(candidate_id, exam_id, "multiple_faces", "critical")
    if yolo_result["has_phone"]:
        events.append("phone_detected")
        _log_with_cooldown(candidate_id, exam_id, "phone_detected", "critical")
    for obj in yolo_result["suspicious_objects"]:
        if obj["label"] != "cell phone":
            events.append("suspicious_object")
            _log_with_cooldown(candidate_id, exam_id, "suspicious_object", obj["severity"], {"object": obj["label"]})
    if gaze_result["looking_away"]:
        events.append("looking_away")
        _log_with_cooldown(candidate_id, exam_id, "looking_away", "medium", {"gaze": gaze_result.get("gaze"), "head_pose": gaze_result.get("head_pose")})
    if not face_verify["verified"] and face_verify.get("match_score", 100) < 60:
        events.append("identity_mismatch")
        _log_with_cooldown(candidate_id, exam_id, "identity_mismatch", "critical", {"match_score": face_verify.get("match_score", 0)})

    risk = calculate_risk(events)
    _update_live_state(candidate_id, exam_id, risk, events)
    return {
        "candidate_id": candidate_id,
        "yolo": yolo_result,
        "gaze": gaze_result,
        "face_verify": face_verify,
        "events": events,
        "risk_score": risk["score"],
        "risk_level": risk["level"],
        "risk_breakdown": risk["breakdown"],
    }


@app.post("/proctor/noise-event")
async def noise_event(payload: NoiseEvent) -> dict[str, bool]:
    classification = classify_noise(payload.noise_level)
    log_incident(
        payload.candidate_id,
        payload.exam_id,
        classification["event_type"],
        classification["severity"],
        {"noise_level": payload.noise_level},
    )
    risk = calculate_risk([classification["event_type"]])
    _update_live_state(payload.candidate_id, payload.exam_id, risk, [classification["event_type"]])
    return {"logged": True}


@app.post("/proctor/browser-event")
async def browser_event(payload: BrowserEvent) -> dict[str, bool]:
    event_type = payload.event
    log_incident(payload.candidate_id, payload.exam_id, event_type, severity_for_event(event_type), payload.detail or {})
    risk = calculate_risk([event_type])
    _update_live_state(payload.candidate_id, payload.exam_id, risk, [event_type])
    return {"logged": True}


@app.post("/exam/start")
async def start_exam(payload: StartExamRequest) -> dict[str, Any]:
    with get_connection() as conn:
        conn.execute(
            "UPDATE candidates SET status = 'active', started_at = COALESCE(started_at, ?) WHERE id = ?",
            (now_iso(), payload.candidate_id),
        )
        exam = conn.execute("SELECT * FROM exams WHERE id = ?", (payload.exam_id,)).fetchone()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    return {"started": True, "exam": row_to_dict(exam), "questions": list_questions(payload.exam_id, candidate_view=True)}


@app.get("/exam/{exam_id}/questions")
async def candidate_questions(exam_id: str) -> list[dict[str, Any]]:
    return list_questions(exam_id, candidate_view=True)


@app.post("/exam/submit-mcq")
async def submit_mcq(payload: SubmitMCQRequest) -> dict[str, Any]:
    with get_connection() as conn:
        question = conn.execute("SELECT * FROM questions WHERE id = ?", (payload.question_id,)).fetchone()
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")
        selected = payload.answer.strip().upper()
        is_correct = selected == (question["correct_ans"] or "").upper()
        marks_awarded = int(question["marks"] or 0) if is_correct else 0
        conn.execute(
            """
            INSERT INTO answers (id, candidate_id, question_id, exam_id, answer_text, is_correct, marks_awarded, submitted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (new_id(), payload.candidate_id, payload.question_id, payload.exam_id, selected, int(is_correct), marks_awarded, now_iso()),
        )
    return {"saved": True, "is_correct": is_correct, "marks_awarded": marks_awarded}


@app.post("/exam/submit-code")
async def submit_code(payload: SubmitCodeRequest) -> dict[str, Any]:
    with get_connection() as conn:
        question = conn.execute("SELECT * FROM questions WHERE id = ?", (payload.question_id,)).fetchone()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    test_cases = parse_json(question["test_cases"], [])
    evaluation = await evaluate_code_question(payload.source_code, payload.language, test_cases)
    marks_awarded = round((question["marks"] or 0) * evaluation["percentage"] / 100)
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO answers (id, candidate_id, question_id, exam_id, answer_text, is_correct, marks_awarded, submitted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                new_id(),
                payload.candidate_id,
                payload.question_id,
                payload.exam_id,
                payload.source_code,
                int(evaluation["percentage"] == 100),
                marks_awarded,
                now_iso(),
            ),
        )
    return {"saved": True, "marks_awarded": marks_awarded, "evaluation": evaluation}


@app.post("/exam/finish")
async def finish_exam(payload: FinishExamRequest) -> dict[str, Any]:
    result = _finalize_score(payload.candidate_id, payload.exam_id)
    return result


@app.get("/exam/result/{candidate_id}")
async def exam_result(candidate_id: str) -> dict[str, Any]:
    with get_connection() as conn:
        score = conn.execute("SELECT * FROM scores WHERE candidate_id = ? ORDER BY submitted_at DESC LIMIT 1", (candidate_id,)).fetchone()
        candidate = conn.execute("SELECT * FROM candidates WHERE id = ?", (candidate_id,)).fetchone()
    return {"candidate": row_to_dict(candidate), "score": row_to_dict(score), "incidents": list_incidents_for_candidate(candidate_id)}


@app.get("/admin/monitor/live")
async def live_monitor() -> list[dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT candidates.*, exams.title AS exam_title
            FROM candidates
            LEFT JOIN exams ON exams.id = candidates.exam_id
            WHERE candidates.status IN ('active', 'flagged', 'pending')
            ORDER BY candidates.started_at DESC
            """
        ).fetchall()
    candidates = rows_to_dicts(rows)
    for candidate in candidates:
        state = LIVE_STATE.get(candidate["id"], {})
        candidate["risk_score"] = state.get("risk_score", 0)
        candidate["risk_level"] = state.get("risk_level", "LOW")
        candidate["latest_event"] = state.get("latest_event") or (latest_incident(candidate["id"]) or {}).get("event_type")
    return candidates


@app.get("/admin/incidents/{candidate_id}")
async def candidate_incidents(candidate_id: str) -> list[dict[str, Any]]:
    return list_incidents_for_candidate(candidate_id)


@app.get("/admin/incidents/exam/{exam_id}")
async def exam_incidents(exam_id: str) -> list[dict[str, Any]]:
    return list_incidents_for_exam(exam_id)


@app.get("/admin/reports/{candidate_id}")
async def candidate_report(candidate_id: str) -> dict[str, Any]:
    with get_connection() as conn:
        candidate = conn.execute("SELECT * FROM candidates WHERE id = ?", (candidate_id,)).fetchone()
        answers = conn.execute("SELECT * FROM answers WHERE candidate_id = ? ORDER BY submitted_at DESC", (candidate_id,)).fetchall()
        score = conn.execute("SELECT * FROM scores WHERE candidate_id = ? ORDER BY submitted_at DESC LIMIT 1", (candidate_id,)).fetchone()
    return {
        "candidate": row_to_dict(candidate),
        "answers": rows_to_dicts(answers),
        "incidents": list_incidents_for_candidate(candidate_id),
        "score": row_to_dict(score),
    }


@app.websocket("/ws/monitor")
async def ws_monitor(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            await websocket.send_json(await live_monitor())
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        return


async def _upload_to_rgb(file: UploadFile) -> np.ndarray:
    contents = await file.read()
    image = Image.open(io.BytesIO(contents)).convert("RGB")
    return np.array(image)


def _log_with_cooldown(
    candidate_id: str,
    exam_id: str,
    event_type: str,
    severity: str,
    detail: dict[str, Any] | None = None,
    cooldown_seconds: int = 15,
) -> None:
    key = (candidate_id, event_type)
    now = datetime.now(timezone.utc)
    if key in INCIDENT_COOLDOWN and (now - INCIDENT_COOLDOWN[key]).total_seconds() < cooldown_seconds:
        return
    INCIDENT_COOLDOWN[key] = now
    log_incident(candidate_id, exam_id, event_type, severity, detail)


def _update_live_state(candidate_id: str, exam_id: str | None, risk: dict[str, Any], events: list[str]) -> None:
    LIVE_STATE[candidate_id] = {
        "candidate_id": candidate_id,
        "exam_id": exam_id,
        "risk_score": risk["score"],
        "risk_level": risk["level"],
        "latest_event": events[-1] if events else None,
        "updated_at": now_iso(),
    }
    if risk["score"] >= 65:
        with get_connection() as conn:
            conn.execute("UPDATE candidates SET status = 'flagged' WHERE id = ? AND status != 'submitted'", (candidate_id,))


def _finalize_score(candidate_id: str, exam_id: str) -> dict[str, Any]:
    with get_connection() as conn:
        questions = conn.execute("SELECT id, marks FROM questions WHERE exam_id = ?", (exam_id,)).fetchall()
        answers = conn.execute("SELECT * FROM answers WHERE candidate_id = ? AND exam_id = ? ORDER BY submitted_at ASC", (candidate_id, exam_id)).fetchall()
        incidents = conn.execute("SELECT event_type FROM incidents WHERE candidate_id = ? AND exam_id = ?", (candidate_id, exam_id)).fetchall()

        latest_answers: dict[str, Any] = {}
        for answer in rows_to_dicts(answers):
            latest_answers[answer["question_id"]] = answer
        total_marks = sum(int(question["marks"] or 0) for question in questions)
        marks_obtained = sum(int(answer.get("marks_awarded") or 0) for answer in latest_answers.values())
        risk = calculate_risk([incident["event_type"] for incident in incidents])
        final_status = "flagged" if risk["score"] >= 65 else ("pass" if marks_obtained >= total_marks * 0.5 else "fail")
        score_id = new_id()
        submitted_at = now_iso()
        conn.execute(
            """
            INSERT INTO scores (id, candidate_id, exam_id, total_marks, marks_obtained, risk_score, final_status, submitted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (score_id, candidate_id, exam_id, total_marks, marks_obtained, risk["score"], final_status, submitted_at),
        )
        conn.execute(
            "UPDATE candidates SET submitted_at = ?, status = 'submitted' WHERE id = ?",
            (submitted_at, candidate_id),
        )

    return {
        "submitted": True,
        "score": {
            "id": score_id,
            "candidate_id": candidate_id,
            "exam_id": exam_id,
            "total_marks": total_marks,
            "marks_obtained": marks_obtained,
            "risk_score": risk["score"],
            "final_status": final_status,
            "submitted_at": submitted_at,
        },
    }
