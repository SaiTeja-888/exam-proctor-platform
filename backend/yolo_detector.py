from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np


PERSON_CLASS = 0
SUSPICIOUS_OBJECTS = {
    "cell phone": "critical",
    "book": "high",
    "laptop": "high",
    "remote": "medium",
    "tablet": "critical",
    "earphone": "high",
}


@lru_cache(maxsize=1)
def _load_yolo() -> Any:
    try:
        from ultralytics import YOLO

        model_path = Path(__file__).resolve().parents[1] / "models" / "yolov8n.pt"
        return YOLO(str(model_path if model_path.exists() else "yolov8n.pt"))
    except Exception:
        return None


def _fallback_face_count(frame_bgr: np.ndarray) -> int:
    try:
        import cv2

        gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        cascade = cv2.CascadeClassifier(cascade_path)
        faces = cascade.detectMultiScale(gray, 1.1, 4)
        return int(len(faces)) or 1
    except Exception:
        return 1


def run_yolo_detection(frame_bgr: np.ndarray) -> dict[str, Any]:
    model = _load_yolo()
    persons: list[dict[str, Any]] = []
    objects: list[dict[str, Any]] = []

    if model is None:
        person_count = _fallback_face_count(frame_bgr)
        return {
            "ai_available": False,
            "person_count": person_count,
            "no_face": person_count == 0,
            "multiple_faces": person_count > 1,
            "persons": persons,
            "suspicious_objects": objects,
            "has_phone": False,
        }

    results = model(frame_bgr, verbose=False, conf=0.4)
    for result in results:
        for box in result.boxes:
            cls_id = int(box.cls[0])
            label = model.names[cls_id]
            conf = float(box.conf[0])
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            bbox = {"x1": x1, "y1": y1, "x2": x2, "y2": y2, "conf": round(conf, 2)}

            if cls_id == PERSON_CLASS:
                persons.append(bbox)
            elif label in SUSPICIOUS_OBJECTS:
                objects.append({"label": label, "severity": SUSPICIOUS_OBJECTS[label], **bbox})

    person_count = len(persons)
    return {
        "ai_available": True,
        "person_count": person_count,
        "no_face": person_count == 0,
        "multiple_faces": person_count > 1,
        "persons": persons,
        "suspicious_objects": objects,
        "has_phone": any(obj["label"] == "cell phone" for obj in objects),
    }
