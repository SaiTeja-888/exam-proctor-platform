from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np


ROOT_DIR = Path(__file__).resolve().parents[1]
EMBEDDINGS_DIR = ROOT_DIR / "models" / "face_embeddings"
EMBEDDINGS_DIR.mkdir(parents=True, exist_ok=True)


def _face_recognition_module() -> Any:
    try:
        import face_recognition

        return face_recognition
    except Exception:
        return None


def _fallback_embedding(frame_rgb: np.ndarray) -> np.ndarray:
    channels = []
    for channel in range(3):
        hist, _ = np.histogram(frame_rgb[:, :, channel], bins=32, range=(0, 255), density=True)
        channels.append(hist.astype(np.float32))
    vector = np.concatenate(channels)
    norm = np.linalg.norm(vector) + 1e-8
    return vector / norm


def register_face(candidate_id: str, frame_rgb: np.ndarray) -> dict[str, Any]:
    face_recognition = _face_recognition_module()
    save_path = EMBEDDINGS_DIR / f"{candidate_id}.npy"

    if face_recognition:
        face_locations = face_recognition.face_locations(frame_rgb, model="hog")
        if len(face_locations) == 0:
            return {"success": False, "error": "No face detected in frame"}
        if len(face_locations) > 1:
            return {"success": False, "error": "Multiple faces detected. Only one face is allowed"}
        encoding = face_recognition.face_encodings(frame_rgb, face_locations)[0]
    else:
        encoding = _fallback_embedding(frame_rgb)

    np.save(save_path, encoding)
    return {"success": True, "candidate_id": candidate_id, "embedding_path": str(save_path)}


def verify_face(candidate_id: str, frame_rgb: np.ndarray) -> dict[str, Any]:
    emb_path = EMBEDDINGS_DIR / f"{candidate_id}.npy"
    if not emb_path.exists():
        return {"verified": False, "match_score": 0.0, "error": "No registered face found"}

    stored_encoding = np.load(emb_path)
    face_recognition = _face_recognition_module()

    if face_recognition and stored_encoding.shape[0] == 128:
        face_locations = face_recognition.face_locations(frame_rgb, model="hog")
        if not face_locations:
            return {"verified": False, "match_score": 0.0, "error": "No face detected in live frame"}
        live_encoding = face_recognition.face_encodings(frame_rgb, face_locations)[0]
        distance = face_recognition.face_distance([stored_encoding], live_encoding)[0]
        return {
            "verified": bool(distance < 0.50),
            "match_score": round(max(0.0, (1 - distance) * 100), 1),
            "distance": round(float(distance), 3),
            "ai_available": True,
        }

    live_encoding = _fallback_embedding(frame_rgb)
    similarity = float(np.dot(stored_encoding, live_encoding) / ((np.linalg.norm(stored_encoding) * np.linalg.norm(live_encoding)) + 1e-8))
    score = round(max(0.0, min(1.0, similarity)) * 100, 1)
    return {
        "verified": score >= 70,
        "match_score": score,
        "distance": round(1 - similarity, 3),
        "ai_available": False,
    }
