from __future__ import annotations


RISK_WEIGHTS = {
    "no_face": 25,
    "multiple_faces": 60,
    "identity_mismatch": 70,
    "looking_away": 10,
    "head_turned": 15,
    "phone_detected": 60,
    "suspicious_object": 40,
    "tab_switch": 30,
    "noise_detected": 15,
    "multiple_noise": 35,
    "fullscreen_exit": 20,
    "copy_paste": 35,
}


SEVERITY_BY_EVENT = {
    "no_face": "high",
    "multiple_faces": "critical",
    "identity_mismatch": "critical",
    "looking_away": "medium",
    "head_turned": "medium",
    "phone_detected": "critical",
    "suspicious_object": "high",
    "tab_switch": "high",
    "noise_detected": "medium",
    "multiple_noise": "high",
    "fullscreen_exit": "medium",
    "copy_paste": "high",
}


def calculate_risk(events: list[str]) -> dict:
    score = sum(RISK_WEIGHTS.get(event, 0) for event in events)

    if score >= 100:
        level, color = "CRITICAL", "#ef4444"
    elif score >= 65:
        level, color = "HIGH", "#f97316"
    elif score >= 30:
        level, color = "MEDIUM", "#eab308"
    else:
        level, color = "LOW", "#22c55e"

    return {
        "score": min(score, 100),
        "level": level,
        "color": color,
        "breakdown": {event: RISK_WEIGHTS.get(event, 0) for event in events},
    }


def severity_for_event(event_type: str) -> str:
    return SEVERITY_BY_EVENT.get(event_type, "low")
