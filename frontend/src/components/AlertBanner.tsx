import { AlertTriangle, CheckCircle2, X } from "lucide-react";

interface AlertBannerProps {
  message: string;
  tone?: "info" | "success" | "warning" | "danger";
  onClose?: () => void;
}

const toneClass = {
  info: "border-sky-400/30 bg-sky-400/10 text-sky-100",
  success: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
  warning: "border-amber-400/30 bg-amber-400/10 text-amber-100",
  danger: "border-red-400/30 bg-red-400/10 text-red-100",
};

export default function AlertBanner({ message, tone = "info", onClose }: AlertBannerProps) {
  const Icon = tone === "success" ? CheckCircle2 : AlertTriangle;
  return (
    <div className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${toneClass[tone]}`}>
      <span className="flex items-center gap-2">
        <Icon size={18} />
        {message}
      </span>
      {onClose ? (
        <button className="icon-btn h-8 w-8 border-current bg-transparent" onClick={onClose} aria-label="Dismiss alert">
          <X size={16} />
        </button>
      ) : null}
    </div>
  );
}
