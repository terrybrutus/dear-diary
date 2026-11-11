import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  FileAudio,
  ImagePlus,
  Mic,
  Paperclip,
  Search,
  Square,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import {
  deleteMedia,
  downloadBlob,
  fileRecord,
  formatBytes,
  getMediaBlob,
  MAX_LIBRARY,
  saveMedia,
  updateMedia,
  type MediaRecord,
} from "../media-store";
import {
  speechRecognition,
  useVoiceRecorder,
  type VoiceClip,
} from "../useVoiceRecorder";

export function DayMedia({
  date,
  records,
  onTranscript,
  onBusy,
  storageError,
}: {
  date: string;
  records: MediaRecord[];
  onTranscript: (text: string) => void;
  onBusy: (busy: boolean) => void;
  storageError: string;
}) {
  const [pending, setPending] = useState<VoiceClip | null>(null),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [transcribe, setTranscribe] = useState(true),
    [language, setLanguage] = useState("en-US"),
    [dragging, setDragging] = useState(false);
  const picker = useRef<HTMLInputElement>(null),
    captureBusy = useRef(false);
  const available = !!speechRecognition();
  async function storeClip(clip: VoiceClip) {
    setPending(clip);
    try {
      const record = fileRecord(clip.file, date, {
        source: "recording",
        transcript: clip.transcript,
        duration: clip.duration,
      });
      await saveMedia(record, clip.file);
      setPending(null);
      setSuccess("Audio saved to this day.");
      if (clip.transcript.trim()) onTranscript(clip.transcript);
    } catch (e) {
      setError(
        `Audio has not been saved: ${(e as Error).message} Download it or retry below.`,
      );
    }
  }
  const voice = useVoiceRecorder(storeClip),
    busy = voice.status !== "idle" || uploading || !!pending;
  captureBusy.current = busy;
  useEffect(() => {
    onBusy(busy);
    return () => onBusy(false);
  }, [busy, onBusy]);
  useEffect(() => {
    if (!pending) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [pending]);
  async function upload(files: File[]) {
    if (captureBusy.current) return;
    setUploading(true);
    setError("");
    setSuccess("");
    const failures: string[] = [];
    let saved = 0;
    try {
      for (const file of files) {
        try {
          const record = fileRecord(file, date);
          await saveMedia(record, file);
          saved++;
        } catch (e) {
          failures.push((e as Error).message);
        }
      }
      if (saved)
        setSuccess(`${saved} file${saved === 1 ? "" : "s"} saved to ${date}.`);
      if (failures.length) setError(failures.join("\n"));
    } finally {
      setUploading(false);
      if (picker.current) picker.current.value = "";
    }
  }
  const dayRecords = records.filter((r) => r.date === date),
    used = records.reduce((n, r) => n + r.size, 0);
  return (
    <section className="day-media" aria-label="Voice and attachments">
      <div className="section-title">
        <div>
          <h3>
            <Mic size={17} /> Voice & attachments
          </h3>
          <p className="small muted">
            Talk through your session. Keep the evidence beside it.
          </p>
        </div>
        <span className="media-count">{dayRecords.length} saved</span>
      </div>
      <div
        className={`voice-box ${voice.status === "recording" ? "is-recording" : ""}`}
      >
        <div className="voice-toolbar">
          <span className="recording-symbol">
            <Mic size={21} />
          </span>
          <div>
            <b>
              {voice.status === "recording"
                ? "Recording your reflection"
                : voice.status === "starting"
                  ? "Waiting for your microphone…"
                  : voice.status === "saving"
                    ? "Finishing and saving…"
                    : "Speak naturally. Keep your own words."}
            </b>
            <small>
              {voice.status === "recording"
                ? `${Math.floor(voice.elapsed / 60)}:${String(voice.elapsed % 60).padStart(2, "0")} · Stop when you’re finished`
                : "Audio saves to this day when you stop · up to 15 minutes per clip"}
            </small>
          </div>
        </div>
        {voice.status === "recording" ? (
          <button type="button" className="record-stop" onClick={voice.stop}>
            <Square size={15} fill="currentColor" /> Stop & save recording
          </button>
        ) : (
          <button
            type="button"
            className="primary"
            disabled={busy || !!storageError}
            onClick={() => {
              setError("");
              setSuccess("");
              voice.start(transcribe && available, language);
            }}
          >
            <Mic size={16} />
            {voice.status === "starting"
              ? "Opening microphone…"
              : voice.status === "saving"
                ? "Saving recording…"
                : "Record a reflection"}
          </button>
        )}
        <div className="dictation-settings">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={transcribe && available}
              disabled={busy || !available}
              onChange={(e) => setTranscribe(e.target.checked)}
            />{" "}
            Live transcription
          </label>
          <select
            aria-label="Transcription language"
            value={language}
            disabled={busy}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {[
              ["en-US", "English (US)"],
              ["en-GB", "English (UK)"],
              ["es-ES", "Español"],
              ["fr-FR", "Français"],
              ["de-DE", "Deutsch"],
              ["pt-BR", "Português"],
            ].map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <p className="speech-disclosure">
          {available
            ? "When live transcription is on, your browser’s speech service may send audio to its provider and may need internet. Review the text; it is not AI interpretation."
            : "Live transcription is unavailable in this browser. You can still record audio, upload files, and add or edit a transcript manually. Try a browser with speech recognition support for live text."}
        </p>
        {voice.preview && (
          <div className="live-transcript">
            <span>
              {voice.status === "recording"
                ? "LIVE TRANSCRIPT"
                : "CAPTURED WORDS"}
            </span>
            <p aria-live="polite">{voice.preview}</p>
          </div>
        )}
      </div>
      {pending && (
        <div className="media-recovery" role="alert">
          <b>Your recording is still available here, but hasn’t been stored.</b>
          <div className="button-row">
            <button
              className="secondary"
              type="button"
              onClick={() => downloadBlob(pending.file.name, pending.file)}
            >
              <ArrowDownToLine size={15} /> Download recording
            </button>
            <button
              className="secondary"
              type="button"
              disabled={uploading}
              onClick={async () => {
                setUploading(true);
                setError("");
                try {
                  await storeClip(pending);
                } finally {
                  setUploading(false);
                }
              }}
            >
              Retry save
            </button>
            <button
              className="text-btn"
              type="button"
              onClick={() => {
                if (
                  confirm(
                    "Discard this unsaved recording? Download a copy first if you want to keep it.",
                  )
                ) {
                  setPending(null);
                  setError("");
                }
              }}
            >
              Discard recording
            </button>
          </div>
        </div>
      )}
      {(storageError || error || voice.error) && (
        <p className="media-error" role="alert">
          {[storageError, error, voice.error].filter(Boolean).join("\n")}
        </p>
      )}
      {success && (
        <p className="media-success" role="status">
          <Check size={14} />
          {success}
        </p>
      )}
      <div
        className={`media-drop ${dragging ? "drag-over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!busy && !storageError) upload([...e.dataTransfer.files]);
        }}
      >
        <Paperclip size={21} />
        <b>Add the context you want to remember</b>
        <span>Screenshots, videos, or audio · drop files here</span>
        <button
          type="button"
          className="secondary"
          disabled={busy || !!storageError}
          onClick={() => picker.current?.click()}
        >
          <Upload size={15} />
          {uploading ? "Saving files…" : "Choose files"}
        </button>
        <small>
          Up to 100 MB per file · {formatBytes(used)} /{" "}
          {formatBytes(MAX_LIBRARY)} stored
        </small>
        <input
          ref={picker}
          type="file"
          multiple
          hidden
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif,video/mp4,video/webm,video/quicktime,video/ogg,audio/*"
          onChange={(e) => {
            if (e.target.files) upload([...e.target.files]);
          }}
        />
      </div>
      {dayRecords.length > 0 && (
        <div className="day-media-list">
          {dayRecords.map((record) => (
            <MediaCard
              key={record.id}
              record={record}
              onTranscript={onTranscript}
              disabled={busy}
            />
          ))}
        </div>
      )}
      <p className="media-storage-note">
        Saved separately from entry text, on this browser and device. Export a
        journal + media backup before switching computers. No automatic AI
        analysis.
      </p>
    </section>
  );
}

export function MediaCard({
  record,
  onTranscript,
  onOpenDay,
  disabled = false,
}: {
  record: MediaRecord;
  onTranscript?: (text: string) => void;
  onOpenDay?: (date: string) => void;
  disabled?: boolean;
}) {
  const [url, setUrl] = useState(""),
    [loadError, setLoadError] = useState(""),
    [error, setError] = useState(""),
    [caption, setCaption] = useState(record.caption),
    [transcript, setTranscript] = useState(record.transcript),
    [saving, setSaving] = useState(false),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    let live = true,
      objectURL = "";
    getMediaBlob(record.id)
      .then((blob) => {
        if (live) {
          objectURL = URL.createObjectURL(blob);
          setUrl(objectURL);
        }
      })
      .catch((e) => {
        if (live) setLoadError((e as Error).message);
      });
    return () => {
      live = false;
      if (objectURL) URL.revokeObjectURL(objectURL);
    };
  }, [record.id]);
  const dirty = caption !== record.caption || transcript !== record.transcript;
  async function save() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await updateMedia({ ...record, caption, transcript });
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <article className="media-card">
      <div className="media-card-title">
        <div>
          {record.kind === "audio" ? (
            <FileAudio size={17} />
          ) : record.kind === "video" ? (
            <Video size={17} />
          ) : (
            <ImagePlus size={17} />
          )}
          <b>{record.name}</b>
        </div>
        <button
          type="button"
          disabled={disabled || saving}
          className="icon-btn"
          aria-label={`Delete attachment ${record.name}`}
          onClick={async () => {
            if (confirm(`Delete ${record.name} and its saved transcript?`)) {
              try {
                await deleteMedia(record.id);
              } catch (e) {
                setError((e as Error).message);
              }
            }
          }}
        >
          <Trash2 size={15} />
        </button>
      </div>
      <div className="media-card-meta">
        <span>
          {record.date} · {formatBytes(record.size)}
          {record.duration !== undefined
            ? ` · ${Math.floor(record.duration / 60)}:${String(Math.floor(record.duration % 60)).padStart(2, "0")}`
            : ""}
        </span>
        {onOpenDay && (
          <button
            type="button"
            className="text-btn"
            onClick={() => onOpenDay(record.date)}
          >
            Open day <ArrowUpRight size={13} />
          </button>
        )}
      </div>
      {loadError ? (
        <p className="media-error">{loadError}</p>
      ) : !url ? (
        <p className="muted small">Loading saved file…</p>
      ) : record.kind === "image" ? (
        <a
          className="media-image-link"
          href={url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open screenshot ${record.name}`}
        >
          <img src={url} alt={record.caption || record.name} />
        </a>
      ) : record.kind === "video" ? (
        <video
          src={url}
          controls
          playsInline
          preload="metadata"
          aria-label={`Video ${record.name}`}
        />
      ) : (
        <audio
          src={url}
          controls
          preload="metadata"
          aria-label={`Audio ${record.name}`}
        />
      )}
      <label>
        Caption or context
        <input
          aria-label={`Caption for ${record.name}`}
          value={caption}
          disabled={disabled || saving}
          onChange={(e) => {
            setCaption(e.target.value);
            setSaved(false);
          }}
          placeholder="What should you remember about this file?"
          maxLength={2000}
        />
      </label>
      {record.kind === "audio" && (
        <label>
          Transcript <span className="muted">· editable, not interpreted</span>
          <textarea
            aria-label={`Transcript for ${record.name}`}
            value={transcript}
            rows={3}
            disabled={disabled || saving}
            onChange={(e) => {
              setTranscript(e.target.value);
              setSaved(false);
            }}
            placeholder="Live text appears here after recording. You can correct it or add a transcript manually."
          />
        </label>
      )}
      <div className="media-card-actions">
        <button
          className="secondary"
          type="button"
          disabled={disabled || saving || !dirty}
          onClick={save}
        >
          <Check size={14} />
          {saving ? "Saving…" : saved && !dirty ? "Saved" : "Save notes"}
        </button>
        {onTranscript && transcript.trim() && (
          <button
            className="text-btn"
            disabled={disabled || saving || dirty}
            type="button"
            onClick={() => onTranscript(transcript)}
          >
            Use transcript in entry <ArrowUpRight size={13} />
          </button>
        )}
        {url && (
          <a href={url} download={record.name} className="text-btn">
            <ArrowDownToLine size={14} /> Download
          </a>
        )}
      </div>
      {error && (
        <p className="media-error" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}

export function MediaLibrary({
  records,
  error,
  onOpenDay,
  onBackup,
}: {
  records: MediaRecord[];
  error: string;
  onOpenDay: (date: string) => void;
  onBackup: () => void;
}) {
  const [query, setQuery] = useState(""),
    [kind, setKind] = useState("all");
  const filtered = records.filter(
    (r) =>
      (kind === "all" || r.kind === kind) &&
      `${r.name} ${r.date} ${r.caption} ${r.transcript}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <section className="panel media-library">
      <div className="section-title">
        <div>
          <h2>Your sessions, in your own words.</h2>
          <p className="small muted">
            All saved voice notes, screenshots, and videos, organized by day.
          </p>
        </div>
        <button className="secondary" onClick={onBackup}>
          <ArrowDownToLine size={15} /> Back up journal + media
        </button>
      </div>
      <div className="media-library-filters">
        <label className="search">
          <Search size={16} />
          <input
            aria-label="Search media"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a date, caption, or transcript…"
          />
        </label>
        <select
          aria-label="Filter media type"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="all">All media</option>
          <option value="audio">Voice & audio</option>
          <option value="image">Screenshots & images</option>
          <option value="video">Videos</option>
        </select>
        <span className="small muted">
          {records.length} files ·{" "}
          {formatBytes(records.reduce((n, r) => n + r.size, 0))}
        </span>
      </div>
      {error ? (
        <p className="media-error" role="alert">
          {error}
        </p>
      ) : filtered.length ? (
        <div className="media-library-grid">
          {filtered.map((record) => (
            <MediaCard key={record.id} record={record} onOpenDay={onOpenDay} />
          ))}
        </div>
      ) : (
        <div className="empty">
          <div className="empty-icon">
            <Mic size={27} />
          </div>
          <h3>
            {records.length
              ? "No matching files"
              : "Bring your trading day to life"}
          </h3>
          <p>
            {records.length
              ? "Try another date, word, or media type."
              : "Open a calendar day to record your thoughts or attach screenshots and videos. Your files will appear here."}
          </p>
        </div>
      )}
      <p className="media-storage-note">
        Files stay on this device. Playback depends on your browser’s support
        for the file format; the original is always downloadable. Backups
        include the original files and saved transcripts.
      </p>
    </section>
  );
}
