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
}


@lru_cache(maxsize=1)
def _load_yolo() -> Any:
    try:
        from ultralytics import YOLO

        model_path = Path(__file__).resolve().parents[1] / "models" / "yolov8s.pt"

        if model_path.exists():
            return YOLO(str(model_path))

        return YOLO("yolov8s.pt")

    except Exception as e:
        print("YOLO Load Error:", e)
        return None


def run_yolo_detection(frame_bgr: np.ndarray) -> dict:

    model = _load_yolo()

    persons = []
    suspicious_objects = []

    if model is None:
        return {
            "ai_available": False,
            "person_count": 0,
            "multiple_faces": False,
            "no_face": True,
            "has_phone": False,
            "phone_confidence": 0,
            "persons": [],
            "suspicious_objects": [],
        }

    results = model(
        frame_bgr,
        conf=0.25,
        iou=0.45,
        imgsz=640,
        verbose=False,
    )

    phone_detected = False
    phone_confidence = 0

    for result in results:

        for box in result.boxes:

            cls_id = int(box.cls[0])
            label = model.names[cls_id]
            conf = float(box.conf[0])

            x1, y1, x2, y2 = map(int, box.xyxy[0])

            bbox = {
                "x1": x1,
                "y1": y1,
                "x2": x2,
                "y2": y2,
                "conf": round(conf, 2),
            }

            print(f"{label} -> {conf:.2f}")

            if cls_id == PERSON_CLASS:
                persons.append(bbox)

            if label in SUSPICIOUS_OBJECTS:

                suspicious_objects.append(
                    {
                        "label": label,
                        "severity": SUSPICIOUS_OBJECTS[label],
                        **bbox,
                    }
                )

                if label == "cell phone":
                    phone_detected = True
                    phone_confidence = max(phone_confidence, conf)

    person_count = len(persons)

    return {
        "ai_available": True,
        "person_count": person_count,
        "multiple_faces": person_count > 1,
        "no_face": person_count == 0,
        "has_phone": phone_detected,
        "phone_confidence": round(phone_confidence, 2),
        "persons": persons,
        "suspicious_objects": suspicious_objects,
    }
