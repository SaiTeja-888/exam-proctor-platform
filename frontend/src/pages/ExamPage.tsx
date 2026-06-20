import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Play, Send, ShieldAlert } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { api } from "../api";
import AlertBanner from "../components/AlertBanner";
import CodeEditor from "../components/CodeEditor";
import FaceBox from "../components/FaceBox";
import MCQQuestion from "../components/MCQQuestion";
import ProctorOverlay from "../components/ProctorOverlay";
import RiskMeter from "../components/RiskMeter";
import { useAudioMonitor } from "../hooks/useAudio";
import { useProctor } from "../hooks/useProctor";
import { useWebcam } from "../hooks/useWebcam";
import type { CandidateSession, Exam, Question } from "../types";

function getSession(): CandidateSession | null {
  const raw = localStorage.getItem("candidate_session");
  return raw ? JSON.parse(raw) : null;
}

export default function ExamPage() {
  const navigate = useNavigate();
  const session = getSession();
  const { videoRef, status: cameraStatus } = useWebcam(true);
  const [exam, setExam] = useState<Exam | null>(session?.exam || null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [code, setCode] = useState<Record<string, string>>({});
  const [codeResult, setCodeResult] = useState<string>("");
  const [started, setStarted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [banner, setBanner] = useState("");
  const [audioHot, setAudioHot] = useState(false);
  const lastNoiseRef = useRef(0);
  const startedRef = useRef(false);

  const proctor = useProctor({
    candidateId: session?.candidate_id,
    examId: session?.exam_id,
    videoRef,
    enabled: started && cameraStatus === "ready",
  });

  const current = questions[index];

  useEffect(() => {
    if (!session || startedRef.current) return;
    startedRef.current = true;
    api.post("/exam/start", { candidate_id: session.candidate_id, exam_id: session.exam_id }).then(({ data }) => {
      setExam(data.exam);
      setQuestions(data.questions);
      setSecondsLeft((data.exam?.duration_min || 60) * 60);
      setStarted(true);
    });
  }, [session]);

  useEffect(() => {
    if (!current || current.type !== "coding") return;
    setCode((existing) => ({ ...existing, [current.id]: existing[current.id] ?? current.boilerplate ?? "" }));
    setCodeResult("");
  }, [current]);

  useEffect(() => {
    if (!started) return;
    const id = window.setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(id);
  }, [started]);

  const finish = useCallback(async () => {
    if (!session) return;
    await api.post("/exam/finish", { candidate_id: session.candidate_id, exam_id: session.exam_id });
    navigate(`/result/${session.candidate_id}`);
  }, [navigate, session]);

  useEffect(() => {
    if (started && secondsLeft === 0 && questions.length) finish();
  }, [finish, questions.length, secondsLeft, started]);

  const postBrowserEvent = useCallback(
    (event: string, detail: Record<string, unknown> = {}) => {
      if (!session) return;
      api.post("/proctor/browser-event", { candidate_id: session.candidate_id, exam_id: session.exam_id, event, detail }).catch(() => undefined);
    },
    [session],
  );

  useEffect(() => {
    if (!started) return;
    document.documentElement.requestFullscreen?.().catch(() => undefined);

    const onVisibility = () => {
      if (document.hidden) {
        setBanner("Tab switch detected");
        postBrowserEvent("tab_switch");
      }
    };
    const onFullscreen = () => {
      if (!document.fullscreenElement) {
        setBanner("Return to fullscreen immediately");
        postBrowserEvent("fullscreen_exit");
      }
    };
    const noContext = (event: MouseEvent) => event.preventDefault();
    const noClipboard = (event: ClipboardEvent) => {
      event.preventDefault();
      setBanner("Clipboard action blocked");
      postBrowserEvent("copy_paste", { type: event.type });
    };
    const noShortcuts = (event: KeyboardEvent) => {
      const blocked = ["F12", "F5", "Tab"];
      if ((event.ctrlKey && ["c", "v", "u", "s"].includes(event.key.toLowerCase())) || blocked.includes(event.key)) {
        event.preventDefault();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("fullscreenchange", onFullscreen);
    document.addEventListener("contextmenu", noContext);
    document.addEventListener("copy", noClipboard);
    document.addEventListener("paste", noClipboard);
    document.addEventListener("keydown", noShortcuts);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("fullscreenchange", onFullscreen);
      document.removeEventListener("contextmenu", noContext);
      document.removeEventListener("copy", noClipboard);
      document.removeEventListener("paste", noClipboard);
      document.removeEventListener("keydown", noShortcuts);
    };
  }, [postBrowserEvent, started]);

  useAudioMonitor(
    (level) => {
      setAudioHot(true);
      window.setTimeout(() => setAudioHot(false), 1200);
      const now = Date.now();
      if (now - lastNoiseRef.current > 2200 && session) {
        lastNoiseRef.current = now;
        api.post("/proctor/noise-event", { candidate_id: session.candidate_id, exam_id: session.exam_id, noise_level: level }).catch(() => undefined);
      }
    },
    started,
  );

  const time = useMemo(() => {
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [secondsLeft]);

  if (!session) return <Navigate to="/candidate" replace />;

  const submitMcq = async (value: string) => {
    if (!current) return;
    setAnswers((existing) => ({ ...existing, [current.id]: value }));
    await api.post("/exam/submit-mcq", { candidate_id: session.candidate_id, exam_id: session.exam_id, question_id: current.id, answer: value });
  };

  const runCode = async () => {
    if (!current) return;
    setCodeResult("Running tests...");
    const { data } = await api.post("/exam/submit-code", {
      candidate_id: session.candidate_id,
      exam_id: session.exam_id,
      question_id: current.id,
      language: current.language || "python",
      source_code: code[current.id] || "",
    });
    setCodeResult(`${data.evaluation.passed}/${data.evaluation.total} tests passed - ${data.marks_awarded} marks`);
  };

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        {banner ? <AlertBanner tone="danger" message={banner} onClose={() => setBanner("")} /> : null}
        <div className="panel p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold">{exam?.title || "Exam"}</h1>
              <p className="text-sm text-slate-400">
                Question {questions.length ? index + 1 : 0} of {questions.length}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="status-pill border-signal/30 bg-signal/10 text-sky-100">
                <Clock size={14} />
                {time}
              </span>
              <button className="btn-danger" onClick={finish}>
                <Send size={17} />
                Finish
              </button>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-mint" style={{ width: `${questions.length ? ((index + 1) / questions.length) * 100 : 0}%` }} />
          </div>
        </div>

        <div className="panel p-5">
          {current ? (
            <div className="space-y-5">
              <div>
                <div className="mb-3 inline-flex rounded-full border border-line bg-slate-900 px-3 py-1 text-xs font-semibold uppercase text-slate-400">
                  {current.type} - {current.marks} marks
                </div>
                <h2 className="text-2xl font-bold leading-snug">{current.prompt}</h2>
              </div>
              {current.type === "mcq" ? (
                <MCQQuestion question={current} value={answers[current.id]} onChange={submitMcq} />
              ) : (
                <div className="space-y-4">
                  <CodeEditor language={current.language || "python"} value={code[current.id] || ""} onChange={(value) => setCode((existing) => ({ ...existing, [current.id]: value }))} />
                  <div className="flex flex-wrap items-center gap-3">
                    <button className="btn-secondary" onClick={runCode}>
                      <Play size={17} />
                      Run Code
                    </button>
                    {codeResult ? <span className="rounded-lg border border-line bg-slate-900 px-3 py-2 text-sm text-slate-200">{codeResult}</span> : null}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-line pt-5">
                <button className="btn-secondary" onClick={() => setIndex((value) => Math.max(0, value - 1))} disabled={index === 0}>
                  <ArrowLeft size={17} />
                  Previous
                </button>
                <button className="btn-primary" onClick={() => setIndex((value) => Math.min(questions.length - 1, value + 1))} disabled={index >= questions.length - 1}>
                  Next
                  <ArrowRight size={17} />
                </button>
              </div>
            </div>
          ) : (
            <div className="grid min-h-80 place-items-center text-slate-400">Loading questions...</div>
          )}
        </div>
      </div>

      <aside className="space-y-5">
        <div className="panel overflow-hidden">
          <div className="relative aspect-video bg-black">
            <video ref={videoRef} autoPlay muted playsInline className="video-mirror h-full w-full object-cover" />
            <FaceBox boxes={proctor.result?.yolo.persons || []} />
            <div className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold uppercase text-slate-100">{cameraStatus}</div>
          </div>
          <div className="space-y-5 p-5">
            <RiskMeter score={proctor.result?.risk_score || 0} level={proctor.result?.risk_level || "LOW"} />
            <ProctorOverlay result={proctor.result} audioHot={audioHot} />
            {proctor.result?.events.length ? (
              <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">
                <ShieldAlert className="mr-2 inline" size={16} />
                {proctor.result.events.map((event) => event.replace(/_/g, " ")).join(", ")}
              </div>
            ) : (
              <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-100">
                <CheckCircle2 className="mr-2 inline" size={16} />
                No active alerts
              </div>
            )}
          </div>
        </div>
        <div className="panel p-5">
          <h2 className="text-lg font-bold">{session.candidate_name}</h2>
          <p className="mt-1 text-sm text-slate-400">Session {session.candidate_id.slice(0, 8)}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="metric-card">
              <span className="text-xs text-slate-400">Answered</span>
              <strong className="mt-1 block text-2xl">{Object.keys(answers).length}</strong>
            </div>
            <div className="metric-card">
              <span className="text-xs text-slate-400">AI</span>
              <strong className="mt-1 block text-2xl">{proctor.analyzing ? "Scan" : "Live"}</strong>
            </div>
          </div>
        </div>
      </aside>
    </section>
  );
}
