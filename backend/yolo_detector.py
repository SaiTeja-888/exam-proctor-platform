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
    "mouse": "medium",
    "keyboard": "medium",
}

@lru_cache(maxsize=1)
def _load_yolo() -> Any:
    try:
        from ultralytics import YOLO

        model_path = Path(__file__).resolve().parent / "yolov8s.pt"

        if model_path.exists():
            return YOLO(str(model_path))

        return YOLO("yolov8s.pt")

    except Exception as e:
        print(f"YOLO load failed: {e}")
        return None


def _fallback_face_count(frame_bgr: np.ndarray) -> int:
    try:
        import cv2

        gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)

        cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades +
            "haarcascade_frontalface_default.xml"
        )

        faces = cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=4
        )

        return int(len(faces))

    except Exception:
        return 1


def run_yolo_detection(frame_bgr: np.ndarray) -> dict[str, Any]:

    model = _load_yolo()

    persons = []
    suspicious_objects = []

    if model is None:
        person_count = _fallback_face_count(frame_bgr)

        return {
            "ai_available": False,
            "person_count": person_count,
            "no_face": person_count == 0,
            "multiple_faces": person_count > 1,
            "persons": [],
            "suspicious_objects": [],
            "has_phone": False,
            "phone_confidence": 0,
        }

    try:
        import cv2

        frame_bgr = cv2.convertScaleAbs(
            frame_bgr,
            alpha=1.2,
            beta=20
        )

        frame_bgr = cv2.GaussianBlur(
            frame_bgr,
            (3, 3),
            0
        )

    except Exception:
        pass
    results = model(
    frame_bgr,
    conf=0.30,
    iou=0.45,
    imgsz=1280, 
    verbose=False,
    )
    phone_detected = False
    phone_confidence = 0

    for result in results:

        if not hasattr(result, "boxes"):
            continue

        for box in result.boxes:

            cls_id = int(box.cls[0])

            label = model.names[cls_id]

            conf = float(box.conf[0])

            x1, y1, x2, y2 = map(
                int,
                box.xyxy[0]
            )

            bbox = {
                "x1": x1,
                "y1": y1,
                "x2": x2,
                "y2": y2,
                "conf": round(conf, 2),
            }

            print(f"{label} -> {conf:.2f}")               
            if cls_id == PERSON_CLASS:
               if conf > 0.30:
                   persons.append({"conf": round(conf, 2)})

            elif label in SUSPICIOUS_OBJECTS:

                suspicious_objects.append(
                    {
                        "label": label,
                        "severity": SUSPICIOUS_OBJECTS[label],
                        **bbox,
                    }
                )

                if label == "cell phone":
                    phone_detected = True
                    phone_confidence = max(
                        phone_confidence,
                        conf
                    )

    person_count = len(persons)

    return {
    "ai_available": True,
    "person_count": person_count,
    "no_face": person_count == 0,
    "multiple_faces": person_count > 1,
    "persons": [],
    "suspicious_objects": suspicious_objects,
    "has_phone": phone_detected,
    "phone_confidence": round(phone_confidence, 2),
}