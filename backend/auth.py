from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import string
from datetime import datetime, timedelta, timezone
from typing import Any


JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_ALGORITHM = "HS256"


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode((data + padding).encode("ascii"))


def hash_password(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120_000)
    return f"pbkdf2_sha256${salt}${digest.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        scheme, salt, digest = stored_hash.split("$", 2)
    except ValueError:
        return False
    if scheme != "pbkdf2_sha256":
        return False
    candidate = hash_password(password, salt).split("$", 2)[2]
    return hmac.compare_digest(candidate, digest)


def create_token(subject: str, role: str, extra: dict[str, Any] | None = None, expires_minutes: int = 1440) -> str:
    header = {"alg": JWT_ALGORITHM, "typ": "JWT"}
    payload = {
        "sub": subject,
        "role": role,
        "exp": int((datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)).timestamp()),
        **(extra or {}),
    }
    signing_input = f"{_b64url(json.dumps(header, separators=(',', ':')).encode())}.{_b64url(json.dumps(payload, separators=(',', ':')).encode())}"
    signature = hmac.new(JWT_SECRET.encode(), signing_input.encode(), hashlib.sha256).digest()
    return f"{signing_input}.{_b64url(signature)}"


def decode_token(token: str) -> dict[str, Any]:
    try:
        header_b64, payload_b64, signature_b64 = token.split(".")
    except ValueError as exc:
        raise ValueError("Invalid token format") from exc

    signing_input = f"{header_b64}.{payload_b64}"
    expected = _b64url(hmac.new(JWT_SECRET.encode(), signing_input.encode(), hashlib.sha256).digest())
    if not hmac.compare_digest(expected, signature_b64):
        raise ValueError("Invalid token signature")

    payload = json.loads(_b64url_decode(payload_b64))
    if payload.get("exp", 0) < int(datetime.now(timezone.utc).timestamp()):
        raise ValueError("Token expired")
    return payload


def generate_invite_code(prefix: str = "EXAM") -> str:
    year = datetime.now(timezone.utc).year
    alphabet = string.ascii_uppercase + string.digits
    suffix = "".join(secrets.choice(alphabet) for _ in range(4))
    return f"{prefix}-{year}-{suffix}"
