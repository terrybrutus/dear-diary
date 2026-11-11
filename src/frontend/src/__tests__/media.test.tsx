import { Blob as NodeBlob, File as NodeFile } from "node:buffer";
import {
  act,
  render,
  screen,
  within,
  waitFor,
  cleanup,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { zipSync, strToU8 } from "fflate";
import App from "../App";
import { DayMedia } from "../components/DayMedia";
import * as mediaStore from "../media-store";
import { emptyJournal, KEY, dateKey } from "../journal";
import {
  saveMedia,
  fileRecord,
  listMedia,
  getMediaBlob,
  replaceMedia,
  updateMedia,
  deleteMedia,
  MAX_FILE,
  restoreMediaAndJournal,
} from "../media-store";
import { createJournalBackup, readJournalBackup } from "../media-backup";

beforeEach(async () => {
  vi.stubGlobal("Blob", NodeBlob);
  vi.stubGlobal("File", NodeFile);
  URL.createObjectURL = vi.fn(() => "blob:test-media");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ configured: false }),
    }),
  );
  localStorage.clear();
  await replaceMedia([]);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const file = (
  name = "chart.png",
  type = "image/png",
  contents = "image bytes",
) => new File([contents], name, { type });

describe("Durable media and portable backups", () => {
  it("keeps the current journal and originals if restoring media fails", async () => {
    const original = file(),
      record = fileRecord(original, dateKey());
    await saveMedia(record, original);
    const old = JSON.stringify({ ...emptyJournal(), name: "Keep me" });
    localStorage.setItem(KEY, old);
    await expect(
      restoreMediaAndJournal(
        [{ record: { ...record, size: record.size + 1 }, blob: original }],
        JSON.stringify(emptyJournal()),
        KEY,
      ),
    ).rejects.toThrow("does not match");
    expect(localStorage.getItem(KEY)).toBe(old);
    expect((await listMedia())[0].id).toBe(record.id);
    expect(await (await getMediaBlob(record.id)).text()).toBe("image bytes");
  });
  it("stores original binary files, dates and transcripts, updates notes without replacing the binary, and deletes both", async () => {
    const f = file("voice.webm", "audio/webm", "audio bytes"),
      record = fileRecord(f, "2026-11-11", {
        transcript: "I waited for the retest.",
        source: "recording",
      });
    await saveMedia(record, f);
    expect((await listMedia())[0].date).toBe("2026-11-11");
    expect(await (await getMediaBlob(record.id)).text()).toBe("audio bytes");
    await updateMedia({
      ...record,
      caption: "Opening session",
      transcript: "Corrected transcript",
    });
    expect((await listMedia())[0].transcript).toBe("Corrected transcript");
    expect((await getMediaBlob(record.id)).size).toBe(f.size);
    await deleteMedia(record.id);
    expect(await listMedia()).toEqual([]);
    await expect(getMediaBlob(record.id)).rejects.toThrow("missing");
  });
  it("round-trips journal, image/video/audio originals and transcript in one ZIP", async () => {
    for (const f of [
      file(),
      file("clip.mp4", "video/mp4", "video bytes"),
      file("voice.webm", "audio/webm", "voice bytes"),
    ])
      await saveMedia(
        fileRecord(f, "2026-11-11", {
          transcript: f.type.startsWith("audio") ? "Patient entry" : "",
        }),
        f,
      );
    const journal = emptyJournal();
    journal.name = "My journal";
    const zip = await createJournalBackup(journal),
      restored = await readJournalBackup(
        new File([zip], "backup.zip", { type: "application/zip" }),
      );
    expect(restored.journal.name).toBe("My journal");
    expect(restored.media).toHaveLength(3);
    expect(
      restored.media?.find((x) => x.record.kind === "video")?.blob.size,
    ).toBe(11);
    expect(
      restored.media?.find((x) => x.record.kind === "audio")?.record.transcript,
    ).toBe("Patient entry");
    await replaceMedia([]);
    await restoreMediaAndJournal(
      restored.media!,
      JSON.stringify(restored.journal),
      KEY,
    );
    expect(await listMedia()).toHaveLength(3);
    expect(JSON.parse(localStorage.getItem(KEY)!).name).toBe("My journal");
  });
  it("rejects unsafe formats, oversize files, broken archives and missing media before changing data", async () => {
    expect(() =>
      fileRecord(file("bad.svg", "image/svg+xml"), dateKey()),
    ).toThrow("unsupported");
    const large = file();
    Object.defineProperty(large, "size", { value: MAX_FILE + 1 });
    expect(() => fileRecord(large, dateKey())).toThrow("100 MB");
    const good = fileRecord(file(), dateKey());
    await saveMedia(good, file());
    const broken = zipSync({
      "manifest.json": strToU8(
        JSON.stringify({
          format: "dear-diary",
          version: 1,
          journal: emptyJournal(),
          media: [good],
        }),
      ),
    });
    await expect(
      readJournalBackup(new File([broken], "broken.zip")),
    ).rejects.toThrow("Missing or damaged");
    expect(await listMedia()).toHaveLength(1);
    const unsafe = zipSync({ "../escape": strToU8("bad") });
    await expect(
      readJournalBackup(new File([unsafe], "unsafe.zip")),
    ).rejects.toThrow("Unexpected");
    const old = await readJournalBackup(
      new File([JSON.stringify(emptyJournal())], "old.json"),
    );
    expect(old.media).toBeUndefined();
  });
});

describe("Day attachments and voice entry", () => {
  it("releases a failed recorder and allows a new recording attempt", async () => {
    const stopped = vi.fn();
    let attempt = 0;
    class Recorder {
      static isTypeSupported() {
        return true;
      }
      state = "inactive";
      mimeType = "audio/webm";
      ondataavailable: any;
      onstop: any;
      start() {
        if (attempt++ === 0) throw new Error("Device temporarily unavailable");
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({
          data: new Blob(["retry audio"], { type: "audio/webm" }),
        });
        this.onstop?.();
      }
    }
    vi.stubGlobal("MediaRecorder", Recorder);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi
          .fn()
          .mockResolvedValue({ getTracks: () => [{ stop: stopped }] }),
      },
    });
    const user = userEvent.setup();
    render(
      <DayMedia
        date="2026-11-11"
        records={[]}
        storageError=""
        onTranscript={vi.fn()}
        onBusy={vi.fn()}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Record a reflection" }),
    );
    expect(
      await screen.findByText("Device temporarily unavailable"),
    ).toBeInTheDocument();
    expect(stopped).toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: "Record a reflection" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Stop & save recording" }),
    );
    await waitFor(async () => expect(await listMedia()).toHaveLength(1));
  });
  it("keeps an unsaved recording downloadable after a storage failure and supports retry", async () => {
    class Recorder {
      static isTypeSupported() {
        return true;
      }
      state = "inactive";
      mimeType = "audio/webm";
      ondataavailable: any;
      onstop: any;
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        this.ondataavailable({
          data: new Blob(["recover this"], { type: "audio/webm" }),
        });
        this.onstop();
      }
    }
    vi.stubGlobal("MediaRecorder", Recorder);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi
          .fn()
          .mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }),
      },
    });
    const failure = vi
      .spyOn(mediaStore, "saveMedia")
      .mockRejectedValueOnce(new Error("Storage is full"));
    const user = userEvent.setup();
    render(
      <DayMedia
        date="2026-11-11"
        records={[]}
        storageError=""
        onTranscript={vi.fn()}
        onBusy={vi.fn()}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Record a reflection" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Stop & save recording" }),
    );
    expect(
      await screen.findByText(/Audio has not been saved: Storage is full/),
    ).toBeInTheDocument();
    expect(await listMedia()).toEqual([]);
    await user.click(
      screen.getByRole("button", { name: "Download recording" }),
    );
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Retry save" }));
    await waitFor(async () => expect(await listMedia()).toHaveLength(1));
    expect(
      screen.queryByRole("button", { name: "Download recording" }),
    ).not.toBeInTheDocument();
    expect(await (await getMediaBlob((await listMedia())[0].id)).text()).toBe(
      "recover this",
    );
    failure.mockRestore();
  });
  it("uploads images and videos to the selected day, finds them in the sidebar library, and restores their preview after remount", async () => {
    const user = userEvent.setup(),
      view = render(<App />);
    await user.click(screen.getByRole("button", { name: "New journal entry" }));
    const dialog = screen.getByRole("dialog"),
      picker = dialog.querySelector("input[type=file]") as HTMLInputElement;
    await user.upload(picker, [
      file(),
      file("replay.mp4", "video/mp4", "video"),
    ]);
    await waitFor(async () => expect(await listMedia()).toHaveLength(2));
    expect((await listMedia()).every((x) => x.date === dateKey())).toBe(true);
    await user.click(within(dialog).getByRole("button", { name: "Close day" }));
    await user.click(screen.getByRole("button", { name: "Media Library" }));
    expect(
      await screen.findByRole("img", { name: "chart.png" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByLabelText("Video replay.mp4"),
    ).toBeInTheDocument();
    view.unmount();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Media Library" }));
    expect(
      await screen.findByRole("img", { name: "chart.png" }),
    ).toBeInTheDocument();
  });
  it("records original audio, receives browser dictation, fills the entry draft, and releases the microphone", async () => {
    let recorder: RecorderMock, recognition: SpeechMock;
    const stopTrack = vi.fn();
    class RecorderMock {
      static isTypeSupported() {
        return true;
      }
      mimeType = "audio/webm";
      state = "inactive";
      ondataavailable: any;
      onstop: any;
      onerror: any;
      constructor() {
        recorder = this;
      }
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        this.ondataavailable({
          data: new Blob(["original audio"], { type: "audio/webm" }),
        });
        this.onstop();
      }
    }
    class SpeechMock {
      continuous = false;
      interimResults = false;
      lang = "";
      onresult: any;
      onend: any;
      onerror: any;
      constructor() {
        recognition = this;
      }
      start() {}
      stop() {
        this.onend?.();
      }
      abort() {}
    }
    vi.stubGlobal("MediaRecorder", RecorderMock);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi
          .fn()
          .mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }),
      },
    });
    Object.defineProperty(window, "SpeechRecognition", {
      configurable: true,
      value: SpeechMock,
    });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "New journal entry" }));
    const dialog = screen.getByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Record a reflection" }),
    );
    expect(
      within(dialog).getByRole("button", { name: "Close day" }),
    ).toBeDisabled();
    act(() =>
      recognition!.onresult({
        resultIndex: 0,
        results: [
          {
            isFinal: true,
            0: { transcript: "I waited patiently for the retest." },
          },
        ],
      }),
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Stop & save recording" }),
    );
    await waitFor(() =>
      expect(within(dialog).getByLabelText("Reflection")).toHaveValue(
        "I waited patiently for the retest.",
      ),
    );
    const saved = (await listMedia())[0];
    expect(saved.source).toBe("recording");
    expect(saved.transcript).toBe("I waited patiently for the retest.");
    expect(await (await getMediaBlob(saved.id)).text()).toBe("original audio");
    expect(stopTrack).toHaveBeenCalled();
    await user.click(
      within(dialog).getByRole("button", { name: "Save entry" }),
    );
    expect(JSON.parse(localStorage.getItem(KEY)!).entries[0].text).toBe(
      saved.transcript,
    );
    delete (window as any).SpeechRecognition;
  });
  it("shows microphone denial and still offers file uploads", async () => {
    vi.stubGlobal("MediaRecorder", class {});
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi
          .fn()
          .mockRejectedValue(new DOMException("denied", "NotAllowedError")),
      },
    });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "New journal entry" }));
    await user.click(
      screen.getByRole("button", { name: "Record a reflection" }),
    );
    expect(
      await screen.findByText(/Microphone access was denied/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose files" })).toBeEnabled();
  });
});
