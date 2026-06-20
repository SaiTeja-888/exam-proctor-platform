from __future__ import annotations

from functools import lru_cache
from typing import Any

import numpy as np


LEFT_IRIS = [474, 475, 476, 477]
L_EYE_CORNERS = [33, 133]
NOSE_TIP = 1
CHIN = 152
L_EAR = 234
R_EAR = 454


@lru_cache(maxsize=1)
def _load_face_mesh() -> Any:
    try:
        import mediapipe as mp

        return mp.solutions.face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
        )
    except Exception:
        return None


def analyze_gaze(frame_rgb: np.ndarray) -> dict[str, Any]:
    face_mesh = _load_face_mesh()
    if face_mesh is None:
        return {
            "ai_available": False,
            "face_detected": True,
            "looking_away": False,
            "gaze": "looking_forward",
            "head_pose": "normal",
            "gaze_ratio": 0.5,
        }

    h, w = frame_rgb.shape[:2]
    results = face_mesh.process(frame_rgb)
    if not results.multi_face_landmarks:
        return {
            "ai_available": True,
            "face_detected": False,
            "looking_away": True,
            "gaze": "unknown",
            "head_pose": "unknown",
        }

    lm = results.multi_face_landmarks[0].landmark
    left_iris_x = np.mean([lm[i].x for i in LEFT_IRIS]) * w
    l_left = lm[L_EYE_CORNERS[0]].x * w
    l_right = lm[L_EYE_CORNERS[1]].x * w
    ratio = (left_iris_x - l_left) / (l_right - l_left + 1e-6)

    if ratio < 0.30:
        gaze = "looking_left"
    elif ratio > 0.70:
        gaze = "looking_right"
    else:
        gaze = "looking_forward"

    l_ear_x = lm[L_EAR].x
    r_ear_x = lm[R_EAR].x
    nose_y = lm[NOSE_TIP].y
    chin_y = lm[CHIN].y
    ear_diff = abs(l_ear_x - r_ear_x)

    if ear_diff < 0.12:
        head_pose = "turned_away"
    elif nose_y > chin_y - 0.05:
        head_pose = "looking_down"
    else:
        head_pose = "normal"

    looking_away = gaze != "looking_forward" or head_pose != "normal"
    return {
        "ai_available": True,
        "face_detected": True,
        "looking_away": looking_away,
        "gaze": gaze,
        "head_pose": head_pose,
        "gaze_ratio": round(float(ratio), 3),
    }
