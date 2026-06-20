# AI-Powered Intelligent Exam Proctoring Platform

Full-stack exam proctoring prototype with FastAPI, SQLite, React, TypeScript, Tailwind, webcam-based face registration, proctor analysis endpoints, audio/browser incident logging, exam building, invite-code access, live monitoring, and candidate reports.

## What Is Included

- Admin login with seeded credentials: `admin` / `admin123`
- Seeded demo invite code: `EXAM-DEMO-2026`
- Exam CRUD and mixed MCQ/coding question builder
- Invite code generation, listing, copying, and revocation
- Candidate code verification and session creation
- Face registration using `face_recognition` when available, with a development fallback
- Proctor endpoint combining YOLO, MediaPipe gaze, face verification, risk scoring, and incident logging
- Browser security events for tab switches, fullscreen exits, and clipboard attempts
- Browser audio noise detection through the Web Audio API
- Code evaluation through Judge0 when `JUDGE0_RAPIDAPI_KEY` is set, with a local Python fallback for demos
- Live proctor dashboard through WebSocket with polling fallback
- SQLite persistence in `backend/data/proctor.sqlite3`

## Project Structure

```text
exam-proctor-platform/
  backend/
    main.py
    auth.py
    database.py
    exam_manager.py
    face_registration.py
    face_verification.py
    yolo_detector.py
    gaze_tracker.py
    noise_detector.py
    risk_engine.py
    incident_logger.py
    code_runner.py
    schemas.py
    requirements.txt
  frontend/
    src/
      pages/
      components/
      hooks/
      App.tsx
  models/
    face_embeddings/
  docker-compose.yml
  Dockerfile.backend
```

## Run Backend

```bash
cd exam-proctor-platform/backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Install optional AI dependencies when your Python version and build tools support them:

```bash
pip install -r requirements-ai.txt
```

On Windows, `face-recognition` can require CMake, dlib, and Visual C++ build tools. If the heavy AI packages are not installed, the backend modules keep the local app usable with fallback behavior.

## Run Frontend

```bash
cd exam-proctor-platform/frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## Quick Start On Windows

From the project folder, double-click `start-dev.bat`, or run:

```powershell
.\start-dev.ps1
```

The script creates the backend virtual environment if needed, installs frontend dependencies if needed, starts both servers in separate PowerShell windows, and opens the app.

## Judge0

Set a RapidAPI key to enable non-Python code execution:

```bash
set JUDGE0_RAPIDAPI_KEY=your_key_here
```

Python coding questions work locally for demos when Judge0 is not configured.

## Docker

```bash
cd exam-proctor-platform
docker compose up --build
```

Frontend runs on `http://localhost:3000`, backend on `http://localhost:8000`.
