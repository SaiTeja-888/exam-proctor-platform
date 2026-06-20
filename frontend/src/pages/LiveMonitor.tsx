import { useEffect, useRef, useState } from "react";
import { Activity, AlertTriangle, ExternalLink, Monitor } from "lucide-react";
import { Link } from "react-router-dom";
import { api, wsUrl } from "../api";
import RiskMeter from "../components/RiskMeter";
import type { CandidateMonitor } from "../types";

export default function LiveMonitor() {
  const [candidates, setCandidates] = useState<CandidateMonitor[]>([]);
  const [connected, setConnected] = useState(false);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    const socket = new WebSocket(wsUrl("/ws/monitor"));
    socket.onopen = () => setConnected(true);
    socket.onmessage = (event) => setCandidates(JSON.parse(event.data));
    socket.onerror = () => {
      setConnected(false);
      pollRef.current = window.setInterval(() => {
        api.get<CandidateMonitor[]>("/admin/monitor/live").then(({ data }) => setCandidates(data));
      }, 2500);
    };
    socket.onclose = () => setConnected(false);
    return () => {
      socket.close();
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Live Proctor Monitor</h1>
          <p className="mt-1 text-slate-400">Active candidate risk feed</p>
        </div>
        <span className={connected ? "status-pill border-emerald-400/30 bg-emerald-400/10 text-emerald-100" : "status-pill border-amber-400/30 bg-amber-400/10 text-amber-100"}>
          <Activity size={14} />
          {connected ? "WebSocket" : "Polling"}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {candidates.map((candidate) => (
          <article key={candidate.id} className="panel overflow-hidden">
            <div className="relative aspect-video bg-slate-950">
              <div className="absolute inset-0 grid place-items-center">
                <Monitor size={48} className="text-slate-600" />
              </div>
              <div className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold uppercase text-slate-100">{candidate.status}</div>
              {candidate.latest_event ? (
                <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
                  <AlertTriangle size={16} />
                  {candidate.latest_event.replace(/_/g, " ")}
                </div>
              ) : null}
            </div>
            <div className="space-y-4 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">{candidate.name || "Candidate"}</h2>
                  <p className="text-sm text-slate-400">{candidate.exam_title}</p>
                </div>
                <Link to={`/admin/incidents/${candidate.id}`} className="icon-btn" title="View details">
                  <ExternalLink size={17} />
                </Link>
              </div>
              <RiskMeter score={candidate.risk_score} level={candidate.risk_level} />
            </div>
          </article>
        ))}
        {!candidates.length ? <div className="panel p-8 text-sm text-slate-400">No active candidates yet.</div> : null}
      </div>
    </section>
  );
}
