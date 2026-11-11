import { useEffect, useRef, useState } from "react";

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult:
    | ((e: {
        resultIndex: number;
        results: ArrayLike<RecognitionResult>;
      }) => void)
    | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionConstructor = new () => Recognition;
export function speechRecognition(): RecognitionConstructor | undefined {
  const w = window as typeof window & {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition;
}
export type VoiceClip = { file: File; transcript: string; duration: number };
export function useVoiceRecorder(onClip: (clip: VoiceClip) => Promise<void>) {
  const [status, setStatus] = useState<
      "idle" | "starting" | "recording" | "saving"
    >("idle"),
    [elapsed, setElapsed] = useState(0),
    [preview, setPreview] = useState(""),
    [error, setError] = useState("");
  const session = useRef<{
      recorder: MediaRecorder;
      stream: MediaStream;
      recognition?: Recognition;
      active: boolean;
      final: string;
      interim: string;
      started: number;
      chunks: Blob[];
      timer?: ReturnType<typeof setInterval>;
      speechDone?: () => void;
      restart?: ReturnType<typeof setTimeout>;
    } | null>(null),
    mounted = useRef(true),
    starting = useRef(false),
    callback = useRef(onClip);
  callback.current = onClip;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const s = session.current;
      if (s) {
        s.active = false;
        clearInterval(s.timer);
        clearTimeout(s.restart);
        s.recognition?.abort();
        if (s.recorder.state !== "inactive") s.recorder.stop();
        s.stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);
  useEffect(() => {
    if (status === "idle") return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [status]);
  function stop() {
    const s = session.current;
    if (!s || !s.active) return;
    s.active = false;
    clearInterval(s.timer);
    clearTimeout(s.restart);
    setStatus("saving");
    if (s.recorder.state !== "inactive") s.recorder.stop();
  }
  async function start(transcribe: boolean, language: string) {
    if (starting.current || session.current?.active) return;
    starting.current = true;
    setError("");
    setPreview("");
    setElapsed(0);
    setStatus("starting");
    let stream: MediaStream | undefined;
    try {
      if (!navigator.mediaDevices?.getUserMedia || !globalThis.MediaRecorder)
        throw new Error(
          "Audio recording is unavailable. Open the app in a current browser on localhost or upload an audio file.",
        );
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (!mounted.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const type = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ].find((t) => MediaRecorder.isTypeSupported(t));
      const recorder = new MediaRecorder(
        stream,
        type ? { mimeType: type, audioBitsPerSecond: 96000 } : undefined,
      );
      const s = {
        recorder,
        stream,
        active: true,
        final: "",
        interim: "",
        started: Date.now(),
        chunks: [],
      } as NonNullable<typeof session.current>;
      session.current = s;
      recorder.ondataavailable = (e) => {
        if (e.data.size) s.chunks.push(e.data);
      };
      recorder.onerror = () => {
        setError(
          "Recording was interrupted. Saving the audio captured so far.",
        );
        stop();
      };
      recorder.onstop = async () => {
        const duration = Math.max(0, (Date.now() - s.started) / 1000);
        s.active = false;
        clearInterval(s.timer);
        clearTimeout(s.restart);
        if (mounted.current) setStatus("saving");
        const settled = new Promise<void>((resolve) => {
          s.speechDone = resolve;
          if (!s.recognition) resolve();
          else {
            try {
              s.recognition.stop();
            } catch {
              resolve();
            }
          }
        });
        let timeout: ReturnType<typeof setTimeout> | undefined;
        await Promise.race([
          settled,
          new Promise<void>((r) => {
            timeout = setTimeout(r, 1500);
          }),
        ]);
        clearTimeout(timeout);
        s.recognition?.abort();
        s.stream.getTracks().forEach((t) => t.stop());
        if (!mounted.current) return;
        try {
          const blob = new Blob(s.chunks, {
            type: recorder.mimeType || s.chunks[0]?.type || "audio/webm",
          });
          if (!blob.size)
            throw new Error(
              "No audio was captured. Check your microphone and try again.",
            );
          const extension = blob.type.includes("mp4")
              ? "m4a"
              : blob.type.includes("ogg")
                ? "ogg"
                : "webm",
            transcript = [s.final.trim(), s.interim.trim()]
              .filter(Boolean)
              .join(" ");
          setPreview(transcript);
          await callback.current({
            file: new File(
              [blob],
              `Voice reflection ${new Date(s.started).toISOString().replace(/[:.]/g, "-")}.${extension}`,
              { type: blob.type },
            ),
            transcript,
            duration,
          });
        } catch (e) {
          if (mounted.current) setError((e as Error).message);
        } finally {
          session.current = null;
          if (mounted.current) setStatus("idle");
        }
      };
      recorder.start(1000);
      setStatus("recording");
      const Ctor = speechRecognition();
      if (transcribe && Ctor) {
        const recognition = new Ctor();
        s.recognition = recognition;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = language;
        let allowed = true;
        recognition.onresult = (e) => {
          let interim = "";
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const result = e.results[i];
            if (result.isFinal) s.final += `${result[0].transcript} `;
            else interim += result[0].transcript;
          }
          s.interim = interim;
          if (mounted.current) setPreview(`${s.final}${s.interim}`.trim());
        };
        recognition.onerror = (e) => {
          if (
            [
              "not-allowed",
              "service-not-allowed",
              "audio-capture",
              "language-not-supported",
              "network",
            ].includes(e.error)
          )
            allowed = false;
          if (
            mounted.current &&
            e.error !== "no-speech" &&
            e.error !== "aborted"
          )
            setError(
              `Live transcription stopped (${e.error}). Your audio is still recording and will be saved.`,
            );
        };
        recognition.onend = () => {
          s.speechDone?.();
          if (s.active && allowed && mounted.current) {
            if (s.interim.trim()) {
              s.final += `${s.interim.trim()} `;
              s.interim = "";
            }
            s.restart = setTimeout(() => {
              if (s.active) {
                try {
                  recognition.start();
                } catch {
                  allowed = false;
                  setError(
                    "Live transcription stopped. Audio recording continues.",
                  );
                }
              }
            }, 250);
          }
        };
        try {
          recognition.start();
        } catch {
          allowed = false;
          setError(
            "Live transcription could not start. Audio recording continues.",
          );
        }
      }
      s.timer = setInterval(() => {
        const seconds = Math.floor((Date.now() - s.started) / 1000);
        setElapsed(seconds);
        if (seconds >= 15 * 60) {
          setError(
            "Reached the 15-minute recording limit. Saving this clip; you can start another.",
          );
          stop();
        }
      }, 1000);
    } catch (e) {
      const failed = session.current;
      if (failed) {
        failed.active = false;
        clearInterval(failed.timer);
        clearTimeout(failed.restart);
        failed.recognition?.abort();
        failed.recorder.onstop = null;
        if (failed.recorder.state !== "inactive") failed.recorder.stop();
        session.current = null;
      }
      stream?.getTracks().forEach((t) => t.stop());
      if (mounted.current) {
        setError(
          (e as Error).name === "NotAllowedError"
            ? "Microphone access was denied. Allow it in your browser, or upload an audio file."
            : (e as Error).message,
        );
        setStatus("idle");
      }
    } finally {
      starting.current = false;
    }
  }
  return { status, elapsed, preview, error, start, stop };
}
