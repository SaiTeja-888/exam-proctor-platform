import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Eye, FilePlus2, KeyRound, Monitor, Plus, ShieldAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { api, formatDate } from "../api";
import type { Exam } from "../types";

export default function AdminDashboard() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Exam[]>("/admin/exams")
      .then(({ data }) => setExams(data))
      .finally(() => setLoading(false));
  }, []);

  const totals = useMemo(
    () => ({
      exams: exams.length,
      questions: exams.reduce((sum, exam) => sum + (exam.question_count || 0), 0),
      candidates: exams.reduce((sum, exam) => sum + (exam.candidate_count || 0), 0),
      invites: exams.reduce((sum, exam) => sum + (exam.invite_count || 0), 0),
    }),
    [exams],
  );
  const metrics: Array<{ label: string; value: number; Icon: LucideIcon }> = [
    { label: "Exams", value: totals.exams, Icon: ClipboardList },
    { label: "Questions", value: totals.questions, Icon: FilePlus2 },
    { label: "Invites", value: totals.invites, Icon: KeyRound },
    { label: "Candidates", value: totals.candidates, Icon: Eye },
  ];

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="mt-1 text-slate-400">Build exams, issue codes, and review proctoring signals.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/admin/live" className="btn-secondary">
            <Monitor size={18} />
            Live Monitor
          </Link>
          <Link to="/admin/exams/new" className="btn-primary">
            <Plus size={18} />
            Create Exam
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {metrics.map(({ label, value, Icon }) => (
          <div key={label} className="metric-card">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-sm">{label}</span>
              <Icon size={18} />
            </div>
            <div className="mt-3 text-3xl font-bold">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {loading ? (
          <div className="panel p-6 text-slate-400">Loading exams...</div>
        ) : exams.length ? (
          exams.map((exam) => (
            <article key={exam.id} className="panel p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold">{exam.title}</h2>
                    <span className={exam.is_active ? "status-pill border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "status-pill border-slate-500 bg-slate-800 text-slate-300"}>
                      {exam.is_active ? "Active" : "Paused"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">{exam.description}</p>
                </div>
                <div className="text-right text-sm text-slate-400">{formatDate(exam.created_at)}</div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-line bg-slate-900 p-3">
                  <span className="text-xs text-slate-400">Questions</span>
                  <strong className="mt-1 block text-xl">{exam.question_count || 0}</strong>
                </div>
                <div className="rounded-lg border border-line bg-slate-900 p-3">
                  <span className="text-xs text-slate-400">Invites</span>
                  <strong className="mt-1 block text-xl">{exam.invite_count || 0}</strong>
                </div>
                <div className="rounded-lg border border-line bg-slate-900 p-3">
                  <span className="text-xs text-slate-400">Duration</span>
                  <strong className="mt-1 block text-xl">{exam.duration_min}m</strong>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link to={`/admin/exams/${exam.id}/builder`} className="btn-secondary">
                  <FilePlus2 size={17} />
                  Builder
                </Link>
                <Link to={`/admin/exams/${exam.id}/invites`} className="btn-secondary">
                  <KeyRound size={17} />
                  Invites
                </Link>
                <Link to="/admin/live" className="btn-secondary">
                  <ShieldAlert size={17} />
                  Monitor
                </Link>
              </div>
            </article>
          ))
        ) : (
          <div className="panel p-8">
            <h2 className="text-xl font-bold">No exams yet</h2>
            <p className="mt-2 text-slate-400">Create the first exam to unlock invites and live monitoring.</p>
            <Link to="/admin/exams/new" className="btn-primary mt-5">
              <Plus size={18} />
              Create Exam
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
