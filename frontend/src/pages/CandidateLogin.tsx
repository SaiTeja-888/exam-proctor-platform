import { FormEvent, useState } from "react";
import { ArrowRight, KeyRound, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import AlertBanner from "../components/AlertBanner";
import type { CandidateSession } from "../types";

export default function CandidateLogin() {
  const navigate = useNavigate();
  const [inviteCode, setInviteCode] = useState("EXAM-DEMO-2026");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post<CandidateSession>("/auth/candidate/verify-code", {
        invite_code: inviteCode,
        candidate_name: name || undefined,
        email: email || undefined,
      });
      localStorage.setItem("candidate_session", JSON.stringify(data));
      localStorage.setItem("candidate_token", data.session_token);
      navigate("/face-registration");
    } catch {
      setError("Invalid or expired invite code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_420px]">
      <div className="panel overflow-hidden">
        <div className="grid min-h-[560px] content-between gap-8 p-6 md:p-8">
          <div>
            <div className="mb-6 inline-flex rounded-full border border-mint/30 bg-mint/10 px-3 py-1 text-sm font-semibold text-mint">
              Candidate Exam Entry
            </div>
            <h1 className="max-w-3xl text-4xl font-bold leading-tight md:text-6xl">Secure assessment with live AI proctoring</h1>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ["Identity", "Face registration before the timer starts"],
              ["Environment", "Webcam, gaze, audio, and browser signals"],
              ["Integrity", "Risk score and incident timeline for review"],
            ].map(([title, detail]) => (
              <div key={title} className="metric-card">
                <div className="text-lg font-bold">{title}</div>
                <div className="mt-2 text-sm text-slate-400">{detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <form onSubmit={submit} className="panel self-start p-6">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-signal text-ink">
            <KeyRound size={22} />
          </span>
          <div>
            <h2 className="text-2xl font-bold">Join Exam</h2>
            <p className="text-sm text-slate-400">Enter invitation details</p>
          </div>
        </div>
        {error ? <AlertBanner tone="danger" message={error} /> : null}
        <div className="mt-5 space-y-4">
          <label className="block space-y-2">
            <span className="label">Invite Code</span>
            <input className="field uppercase" value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} placeholder="EXAM-2026-XK9P" required />
          </label>
          <label className="block space-y-2">
            <span className="label">Name</span>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-3 text-slate-500" size={18} />
              <input className="field pl-10" value={name} onChange={(event) => setName(event.target.value)} placeholder="Candidate name" />
            </div>
          </label>
          <label className="block space-y-2">
            <span className="label">Email</span>
            <input className="field" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" />
          </label>
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? "Checking" : "Join Exam"}
            <ArrowRight size={18} />
          </button>
        </div>
      </form>
    </section>
  );
}
