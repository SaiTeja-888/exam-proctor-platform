import type { RiskLevel } from "../types";

interface RiskMeterProps {
  score?: number;
  level?: RiskLevel;
}

const colorByLevel: Record<RiskLevel, string> = {
  LOW: "bg-emerald-400",
  MEDIUM: "bg-amber-400",
  HIGH: "bg-orange-500",
  CRITICAL: "bg-red-500",
};

export default function RiskMeter({ score = 0, level = "LOW" }: RiskMeterProps) {
  const width = Math.max(0, Math.min(100, score));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold">Risk Score</span>
        <span className="font-bold">{score}/100</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full ${colorByLevel[level]}`} style={{ width: `${width}%` }} />
      </div>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Live AI signal</span>
        <span className="font-semibold text-slate-100">{level}</span>
      </div>
    </div>
  );
}
