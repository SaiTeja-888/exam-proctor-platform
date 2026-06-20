import { AlertCircle, CircleDot, ShieldAlert } from "lucide-react";
import { formatDate } from "../api";
import type { Incident } from "../types";

interface IncidentTimelineProps {
  incidents: Incident[];
}

const severityColor = {
  low: "text-slate-300 border-slate-500",
  medium: "text-amber-200 border-amber-400",
  high: "text-orange-200 border-orange-400",
  critical: "text-red-200 border-red-400",
};

export default function IncidentTimeline({ incidents }: IncidentTimelineProps) {
  if (!incidents.length) {
    return <div className="rounded-lg border border-line bg-slate-900/70 p-5 text-sm text-slate-400">No incidents recorded.</div>;
  }

  return (
    <div className="space-y-3">
      {incidents.map((incident) => {
        const Icon = incident.severity === "critical" ? ShieldAlert : incident.severity === "low" ? CircleDot : AlertCircle;
        return (
          <div key={incident.id} className="grid grid-cols-[36px_1fr] gap-3 rounded-lg border border-line bg-slate-900/70 p-3">
            <span className={`flex h-9 w-9 items-center justify-center rounded-lg border ${severityColor[incident.severity]}`}>
              <Icon size={17} />
            </span>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold capitalize text-slate-100">{incident.event_type.replace(/_/g, " ")}</span>
                <span className="text-xs text-slate-400">{formatDate(incident.timestamp)}</span>
              </div>
              <div className="mt-1 text-xs uppercase text-slate-400">{incident.severity}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
