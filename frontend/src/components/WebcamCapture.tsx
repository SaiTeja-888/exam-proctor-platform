import { Camera, RefreshCcw } from "lucide-react";
import { useState } from "react";
import { useWebcam } from "../hooks/useWebcam";

interface WebcamCaptureProps {
  onCapture: (blob: Blob, previewUrl: string) => void;
}

export default function WebcamCapture({ onCapture }: WebcamCaptureProps) {
  const { videoRef, status, error, captureBlob } = useWebcam(true);
  const [preview, setPreview] = useState("");

  const capture = async () => {
    const blob = await captureBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    setPreview(url);
    onCapture(blob, url);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
        <div className="relative aspect-video overflow-hidden rounded-lg border border-line bg-black">
          <video ref={videoRef} autoPlay muted playsInline className="video-mirror h-full w-full object-cover" />
          <span className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-slate-100">{status}</span>
        </div>
        <div className="aspect-video overflow-hidden rounded-lg border border-line bg-slate-900">
          {preview ? <img src={preview} alt="Face capture preview" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-slate-500">Preview</div>}
        </div>
      </div>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <div className="flex flex-wrap gap-3">
        <button className="btn-primary" onClick={capture} type="button" disabled={status !== "ready"}>
          <Camera size={18} />
          Capture Face
        </button>
        <button className="btn-secondary" type="button" onClick={capture} disabled={status !== "ready"}>
          <RefreshCcw size={18} />
          Retake
        </button>
      </div>
    </div>
  );
}
