import { useEffect, useState } from "react";
import { Award, ShieldAlert } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import IncidentTimeline from "../components/IncidentTimeline";
import RiskMeter from "../components/RiskMeter";
import type { Incident, Score } from "../types";

interface ResultPayload {
  candidate?: { id: string; name: string; status: string };
  score?: Score;
  incidents: Incident[];
}

export default function ExamResult() {
  const { candidateId } = useParams();
  const [result, setResult] = useState<ResultPayload | null>(null);

  useEffect(() => {
    if (!candidateId) return;
    api.get<ResultPayload>(`/exam/result/${candidateId}`).then(({ data }) => setResult(data));
  }, [candidateId]);

  const score = result?.score;
  const riskLevel = (score?.risk_score || 0) >= 100 ? "CRITICAL" : (score?.risk_score || 0) >= 65 ? "HIGH" : (score?.risk_score || 0) >= 30 ? "MEDIUM" : "LOW";

  return (
    <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <aside className="panel self-start p-5">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-mint text-ink">
            <Award size={22} />
          </span>
          <div>
            <h1 className="text-2xl font-bold">Exam Result</h1>
            <p className="text-sm text-slate-400">{result?.candidate?.name || "Candidate"}</p>
          </div>
        </div>
        <div className="rounded-lg border border-line bg-slate-900 p-4">
          <span className="text-xs uppercase text-slate-400">Score</span>
          <div className="mt-2 text-4xl font-bold">
            {score ? `${score.marks_obtained}/${score.total_marks}` : "-"}
          </div>
          <div className="mt-2 text-sm capitalize text-slate-400">{score?.final_status || "pending"}</div>
        </div>
        <div className="mt-5">
          <RiskMeter score={score?.risk_score || 0} level={riskLevel} />
        </div>
        <Link to="/candidate" className="btn-secondary mt-5 w-full">
          New Session
        </Link>
      </aside>
      <div className="panel p-5">
        <div className="mb-4 flex items-center gap-2">
          <ShieldAlert size={20} className="text-amber-300" />
          <h2 className="text-xl font-bold">Violation Summary</h2>
        </div>
        <IncidentTimeline incidents={result?.incidents || []} />
      </div>
    </section>
  );
}
