import { useState } from "react";
import { ArrowRight, ScanFace } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { api } from "../api";
import AlertBanner from "../components/AlertBanner";
import WebcamCapture from "../components/WebcamCapture";
import type { CandidateSession } from "../types";

function getSession(): CandidateSession | null {
  const raw = localStorage.getItem("candidate_session");
  return raw ? JSON.parse(raw) : null;
}

export default function FaceRegistration() {
  const navigate = useNavigate();
  const session = getSession();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  if (!session) return <Navigate to="/candidate" replace />;

  const register = async () => {
    if (!blob) {
      setMessage("Capture a clear face image first");
      return;
    }
    const form = new FormData();
    form.append("file", blob, "face.jpg");
    form.append("candidate_id", session.candidate_id);
    setLoading(true);
    try {
      await api.post("/candidate/register-face", form, { headers: { "Content-Type": "multipart/form-data" } });
      setMessage("Face registered successfully");
      setTimeout(() => navigate("/exam"), 600);
    } catch {
      setMessage("Face registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="panel p-5">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-mint text-ink">
            <ScanFace size={22} />
          </span>
          <div>
            <h1 className="text-2xl font-bold">Face Registration</h1>
            <p className="text-sm text-slate-400">{session.exam?.title}</p>
          </div>
        </div>
        <WebcamCapture onCapture={(nextBlob) => setBlob(nextBlob)} />
      </div>
      <aside className="panel self-start p-5">
        <h2 className="text-lg font-bold">{session.candidate_name}</h2>
        <p className="mt-1 text-sm text-slate-400">Candidate identity checkpoint</p>
        <div className="mt-5 space-y-3 text-sm text-slate-300">
          <div className="rounded-lg border border-line bg-slate-900 p-3">Single face visible</div>
          <div className="rounded-lg border border-line bg-slate-900 p-3">Neutral lighting preferred</div>
          <div className="rounded-lg border border-line bg-slate-900 p-3">Remove masks and phone glare</div>
        </div>
        {message ? <div className="mt-5"><AlertBanner tone={message.includes("success") ? "success" : "warning"} message={message} /></div> : null}
        <button className="btn-primary mt-5 w-full" onClick={register} disabled={loading}>
          {loading ? "Registering" : "Confirm & Proceed"}
          <ArrowRight size={18} />
        </button>
      </aside>
    </section>
  );
}
