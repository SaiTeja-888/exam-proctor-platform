import { RefObject, useCallback, useEffect, useState } from "react";
import { api } from "../api";
import type { ProctorResult } from "../types";

interface UseProctorOptions {
  candidateId?: string;
  examId?: string;
  videoRef: RefObject<HTMLVideoElement>;
  enabled: boolean;
}

export function useProctor({ candidateId, examId, videoRef, enabled }: UseProctorOptions) {
  const [result, setResult] = useState<ProctorResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");

  const analyze = useCallback(async () => {
    const video = videoRef.current;
    if (!enabled || !candidateId || !examId || !video || video.readyState < 2) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 960;
    canvas.height = video.videoHeight || 540;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob) return;
    const form = new FormData();
    form.append("file", blob, "frame.jpg");
    form.append("candidate_id", candidateId);
    form.append("exam_id", examId);
    setAnalyzing(true);
    try {
      const { data } = await api.post<ProctorResult>("/proctor/analyze", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Proctor analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }, [candidateId, enabled, examId, videoRef]);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(analyze, 3000);
    const first = window.setTimeout(analyze, 1200);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(first);
    };
  }, [analyze, enabled]);

  return { result, analyzing, error, analyze };
}
