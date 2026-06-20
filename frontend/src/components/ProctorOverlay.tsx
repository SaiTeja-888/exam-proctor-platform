import { Eye, Mic, ScanFace, Smartphone } from "lucide-react";
import type { ProctorResult } from "../types";

interface ProctorOverlayProps {
  result: ProctorResult | null;
  audioHot?: boolean;
}

function statusClass(ok: boolean) {
  return ok ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100" : "border-red-400/30 bg-red-400/10 text-red-100";
}

export default function ProctorOverlay({ result, audioHot = false }: ProctorOverlayProps) {
  const verified = result?.face_verify.verified ?? false;
  const lookingForward = !(result?.gaze.looking_away ?? false);
  const noPhone = !(result?.yolo.has_phone ?? false);
  return (
    <div className="grid grid-cols-2 gap-2">
      <span className={`status-pill ${statusClass(verified)}`}>
        <ScanFace size={14} />
        {verified ? "Verified" : "Verify"}
      </span>
      <span className={`status-pill ${statusClass(lookingForward)}`}>
        <Eye size={14} />
        {lookingForward ? "Focused" : "Away"}
      </span>
      <span className={`status-pill ${statusClass(noPhone)}`}>
        <Smartphone size={14} />
        {noPhone ? "Clear" : "Phone"}
      </span>
      <span className={`status-pill ${statusClass(!audioHot)}`}>
        <Mic size={14} />
        {audioHot ? "Noise" : "Quiet"}
      </span>
    </div>
  );
}
