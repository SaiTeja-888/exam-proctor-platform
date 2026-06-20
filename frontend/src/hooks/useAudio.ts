import { useEffect, useRef } from "react";

export function useAudioMonitor(onNoise: (level: number) => void, enabled = true) {
  const callbackRef = useRef(onNoise);
  callbackRef.current = onNoise;

  useEffect(() => {
    if (!enabled) return;
    let audioContext: AudioContext | null = null;
    let animationId = 0;
    let stream: MediaStream | null = null;

    navigator.mediaDevices
      .getUserMedia({ audio: true, video: false })
      .then((mediaStream) => {
        stream = mediaStream;
        audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;

        const source = audioContext.createMediaStreamSource(mediaStream);
        source.connect(analyser);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const check = () => {
          analyser.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
          if (avg > 30) callbackRef.current(avg);
          animationId = requestAnimationFrame(check);
        };
        check();
      })
      .catch(() => undefined);

    return () => {
      cancelAnimationFrame(animationId);
      audioContext?.close();
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [enabled]);
}
