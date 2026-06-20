import { useEffect, useState } from "react";
import { FileWarning } from "lucide-react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import IncidentTimeline from "../components/IncidentTimeline";
import RiskMeter from "../components/RiskMeter";
import type { Incident, Score } from "../types";

interface Report {
  candidate?: { id: string; name: string; email?: string; status: string };
  incidents: Incident[];
  score?: Score;
  answers: Array<{ id: string; question_id: string; marks_awarded: number; submitted_at: string }>;
}

export default function IncidentReport() {
  const { candidateId } = useParams();
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    if (!candidateId) return;
    api.get<Report>(`/admin/reports/${candidateId}`).then(({ data }) => setReport(data));
  }, [candidateId]);

  return (
    <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <aside className="panel self-start p-5">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-danger text-white">
            <FileWarning size={22} />
          </span>
          <div>
            <h1 className="text-2xl font-bold">Incident Report</h1>
            <p className="text-sm text-slate-400">{report?.candidate?.name || candidateId}</p>
          </div>
        </div>
        <RiskMeter score={report?.score?.risk_score || 0} level={(report?.score?.risk_score || 0) > 65 ? "HIGH" : "LOW"} />
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="metric-card">
            <span className="text-xs text-slate-400">Incidents</span>
            <strong className="mt-1 block text-2xl">{report?.incidents.length || 0}</strong>
          </div>
          <div className="metric-card">
            <span className="text-xs text-slate-400">Marks</span>
            <strong className="mt-1 block text-2xl">
              {report?.score ? `${report.score.marks_obtained}/${report.score.total_marks}` : "-"}
            </strong>
          </div>
        </div>
      </aside>
      <div className="panel p-5">
        <h2 className="text-xl font-bold">Timeline</h2>
        <div className="mt-4">
          <IncidentTimeline incidents={report?.incidents || []} />
        </div>
      </div>
    </section>
  );
}
