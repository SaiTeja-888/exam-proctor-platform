from __future__ import annotations


def classify_noise(noise_level: float) -> dict:
    if noise_level > 60:
        return {"event_type": "multiple_noise", "severity": "high"}
    if noise_level > 30:
        return {"event_type": "noise_detected", "severity": "medium"}
    return {"event_type": "noise_detected", "severity": "low"}
