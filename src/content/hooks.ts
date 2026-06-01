import { useCallback, useEffect, useRef, useState } from "react";

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type VideoFrameCallback = (now: number, metadata: unknown) => void;
type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: VideoFrameCallback) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

export function useMediaRecorder(language: string) {
  const [isRecording, setIsRecording] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [transcript, setTranscript] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | undefined>();

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      recognitionRef.current?.stop();
    };
  }, []);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    setDurationMs(0);
    setTranscript("");

    const SpeechRecognition =
      ((window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition ??
        (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition);

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = language;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        const text = Array.from(event.results)
          .map((result) => result[0]?.transcript ?? "")
          .join(" ")
          .trim();
        setTranscript(text);
      };
      recognition.onerror = () => undefined;
      recognitionRef.current = recognition;
      recognition.start();
    }

    timerRef.current = window.setInterval(() => setDurationMs(Date.now() - startedAtRef.current), 250);
    recorder.start();
    setIsRecording(true);
  }, [language]);

  const stop = useCallback(async () => {
    if (!recorderRef.current) return { durationMs, transcript };

    const recorder = recorderRef.current;
    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });

    recorder.stop();
    recorder.stream.getTracks().forEach((track) => track.stop());
    recognitionRef.current?.stop();

    if (timerRef.current) window.clearInterval(timerRef.current);
    const finalDuration = Date.now() - startedAtRef.current;
    setDurationMs(finalDuration);
    setIsRecording(false);
    await stopped;
    return { durationMs: finalDuration, transcript };
  }, [durationMs, transcript]);

  return { isRecording, durationMs, transcript, start, stop };
}

export function useVideoClock() {
  const [time, setTime] = useState(0);

  useEffect(() => {
    let animationFrameId = 0;
    let videoFrameCallbackId: number | undefined;
    let currentVideo: VideoWithFrameCallback | null = null;

    const update = () => {
      const video = document.querySelector("video") as VideoWithFrameCallback | null;
      currentVideo = video;
      if (video) setTime(video.currentTime);
    };

    const tickWithAnimationFrame = () => {
      update();
      animationFrameId = window.requestAnimationFrame(tickWithAnimationFrame);
    };

    const tickWithVideoFrame = () => {
      const latestVideo = document.querySelector("video") as VideoWithFrameCallback | null;
      if (latestVideo && latestVideo !== currentVideo) {
        currentVideo = latestVideo;
      }
      update();
      if (currentVideo?.requestVideoFrameCallback) {
        videoFrameCallbackId = currentVideo.requestVideoFrameCallback(tickWithVideoFrame);
      } else {
        animationFrameId = window.requestAnimationFrame(tickWithAnimationFrame);
      }
    };

    currentVideo = document.querySelector("video") as VideoWithFrameCallback | null;
    if (currentVideo) setTime(currentVideo.currentTime);

    if (currentVideo && typeof currentVideo.requestVideoFrameCallback === "function") {
      videoFrameCallbackId = currentVideo.requestVideoFrameCallback(tickWithVideoFrame);
    } else {
      animationFrameId = window.requestAnimationFrame(tickWithAnimationFrame);
    }

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      if (currentVideo?.cancelVideoFrameCallback && videoFrameCallbackId !== undefined) {
        currentVideo.cancelVideoFrameCallback(videoFrameCallbackId);
      }
    };
  }, []);

  return time;
}
