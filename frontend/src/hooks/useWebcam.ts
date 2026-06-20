import { useCallback, useEffect, useRef, useState } from "react";

export function useWebcam(enabled = true) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "blocked">("idle");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setStatus("loading");
    navigator.mediaDevices
      .getUserMedia({ video: { width: 960, height: 540 }, audio: false })
      .then((stream) => {
        if (!alive) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setStatus("ready");
      })
      .catch((err: Error) => {
        setStatus("blocked");
        setError(err.message);
      });

    return () => {
      alive = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [enabled]);

  const captureBlob = useCallback(async (): Promise<Blob | null> => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 960;
    canvas.height = video.videoHeight || 540;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
  }, []);

  return { videoRef, status, error, captureBlob };
}
