from __future__ import annotations

import asyncio
import os
import sys
import tempfile
from pathlib import Path
from typing import Any

import httpx


JUDGE0_URL = os.getenv("JUDGE0_URL", "https://judge0-ce.p.rapidapi.com/submissions")
JUDGE0_KEY = os.getenv("JUDGE0_RAPIDAPI_KEY", "")
HEADERS = {
    "X-RapidAPI-Key": JUDGE0_KEY,
    "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
}

LANGUAGE_IDS = {
    "python": 71,
    "javascript": 63,
    "java": 62,
    "cpp": 54,
}


async def run_code(language: str, source_code: str, stdin: str = "") -> dict[str, Any]:
    if JUDGE0_KEY:
        return await _run_judge0(language, source_code, stdin)
    if language == "python":
        return await _run_local_python(source_code, stdin)
    return {
        "stdout": "",
        "stderr": "Set JUDGE0_RAPIDAPI_KEY to run non-Python languages.",
        "status": "Judge0 key missing",
        "time": None,
        "memory": None,
        "compile_output": "",
    }


async def _run_judge0(language: str, source_code: str, stdin: str = "") -> dict[str, Any]:
    lang_id = LANGUAGE_IDS.get(language, 71)
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            JUDGE0_URL + "?base64_encoded=false&wait=true",
            headers=HEADERS,
            json={"language_id": lang_id, "source_code": source_code, "stdin": stdin},
        )
        response.raise_for_status()
        data = response.json()
    return {
        "stdout": data.get("stdout") or "",
        "stderr": data.get("stderr") or "",
        "status": data.get("status", {}).get("description", "Unknown"),
        "time": data.get("time"),
        "memory": data.get("memory"),
        "compile_output": data.get("compile_output") or "",
    }


async def _run_local_python(source_code: str, stdin: str = "") -> dict[str, Any]:
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "submission.py"
        path.write_text(source_code, encoding="utf-8")
        proc = await asyncio.create_subprocess_exec(
            sys.executable,
            str(path),
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(stdin.encode()), timeout=3)
            status = "Accepted" if proc.returncode == 0 else "Runtime Error"
        except asyncio.TimeoutError:
            proc.kill()
            stdout, stderr = b"", b"Time limit exceeded"
            status = "Time Limit Exceeded"
    return {
        "stdout": stdout.decode(errors="replace"),
        "stderr": stderr.decode(errors="replace"),
        "status": status,
        "time": None,
        "memory": None,
        "compile_output": "",
    }


async def evaluate_code_question(source_code: str, language: str, test_cases: list[dict[str, str]]) -> dict[str, Any]:
    passed = 0
    results = []
    for test_case in test_cases:
        result = await run_code(language, source_code, test_case.get("input", ""))
        actual = (result.get("stdout") or "").strip()
        expected = (test_case.get("expected_output") or "").strip()
        ok = actual == expected
        passed += 1 if ok else 0
        results.append(
            {
                "input": test_case.get("input", ""),
                "expected": expected,
                "actual": actual,
                "passed": ok,
                "status": result.get("status"),
                "stderr": result.get("stderr"),
            }
        )

    total = len(test_cases)
    return {
        "passed": passed,
        "total": total,
        "percentage": round((passed / total * 100) if total else 0, 1),
        "results": results,
    }
