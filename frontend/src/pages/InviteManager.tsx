import { useEffect, useState } from "react";
import { Copy, KeyRound, RefreshCw, Trash2 } from "lucide-react";
import { useParams } from "react-router-dom";
import { api, formatDate } from "../api";
import AlertBanner from "../components/AlertBanner";
import type { Exam, InviteCode } from "../types";

export default function InviteManager() {
  const { examId } = useParams();
  const [exam, setExam] = useState<Exam | null>(null);
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [count, setCount] = useState(10);
  const [message, setMessage] = useState("");

  const load = async () => {
    if (!examId) return;
    const [examRes, codesRes] = await Promise.all([api.get<Exam>(`/admin/exams/${examId}`), api.get<InviteCode[]>(`/admin/invite-codes/${examId}`)]);
    setExam(examRes.data);
    setCodes(codesRes.data);
  };

  useEffect(() => {
    load();
  }, [examId]);

  const generate = async () => {
    if (!examId) return;
    await api.post("/admin/invite-codes/generate", { exam_id: examId, count });
    setMessage("Invite codes generated");
    load();
  };

  const revoke = async (id: string) => {
    await api.delete(`/admin/invite-codes/${id}`);
    setCodes((current) => current.filter((item) => item.id !== id));
  };

  const copy = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setMessage(`${code} copied`);
  };

  return (
    <section className="space-y-6">
      <div className="panel p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-signal text-ink">
              <KeyRound size={22} />
            </span>
            <div>
              <h1 className="text-2xl font-bold">Invite Manager</h1>
              <p className="text-sm text-slate-400">{exam?.title || "Exam"}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select className="field w-28" value={count} onChange={(event) => setCount(Number(event.target.value))}>
              {[1, 5, 10, 25, 50].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <button className="btn-primary" onClick={generate}>
              <RefreshCw size={18} />
              Generate
            </button>
          </div>
        </div>
        {message ? <div className="mt-4"><AlertBanner tone="success" message={message} onClose={() => setMessage("")} /></div> : null}
      </div>

      <div className="panel overflow-hidden">
        <div className="grid grid-cols-[1.2fr_1fr_0.7fr_1fr_120px] gap-3 border-b border-line px-5 py-3 text-xs font-semibold uppercase text-slate-400">
          <span>Code</span>
          <span>Candidate</span>
          <span>Status</span>
          <span>Expires</span>
          <span>Actions</span>
        </div>
        <div className="divide-y divide-line">
          {codes.map((item) => (
            <div key={item.id} className="grid grid-cols-[1.2fr_1fr_0.7fr_1fr_120px] items-center gap-3 px-5 py-4 text-sm">
              <strong className="font-mono">{item.code}</strong>
              <span className="text-slate-300">{item.candidate_name || "-"}</span>
              <span className={item.used ? "status-pill border-amber-400/30 bg-amber-400/10 text-amber-100" : "status-pill border-emerald-400/30 bg-emerald-400/10 text-emerald-100"}>
                {item.used ? "Used" : "Unused"}
              </span>
              <span className="text-slate-400">{formatDate(item.expires_at)}</span>
              <span className="flex gap-2">
                <button className="icon-btn" onClick={() => copy(item.code)} title="Copy code">
                  <Copy size={16} />
                </button>
                <button className="icon-btn" onClick={() => revoke(item.id)} title="Revoke code">
                  <Trash2 size={16} />
                </button>
              </span>
            </div>
          ))}
          {!codes.length ? <div className="p-8 text-sm text-slate-400">No invite codes generated.</div> : null}
        </div>
      </div>
    </section>
  );
}
