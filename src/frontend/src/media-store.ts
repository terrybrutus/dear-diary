import { validDate } from "./journal";

export type MediaKind = "audio" | "image" | "video";
export type MediaRecord = {
  id: string;
  date: string;
  name: string;
  type: string;
  kind: MediaKind;
  size: number;
  createdAt: string;
  caption: string;
  transcript: string;
  source: "upload" | "recording";
  duration?: number;
};
export const MAX_FILE = 100 * 1024 * 1024;
export const MAX_LIBRARY = 250 * 1024 * 1024;
const DATABASE = "dear-diary-media-v1";
let connection: Promise<IDBDatabase> | undefined;
export const formatBytes = (n: number) =>
  n < 1024 * 1024
    ? `${(n / 1024).toFixed(0)} KB`
    : `${(n / 1024 / 1024).toFixed(1)} MB`;
export function mediaKind(type: string): MediaKind | null {
  if (/^image\/(png|jpeg|webp|gif|avif)$/i.test(type)) return "image";
  if (/^video\/(mp4|webm|quicktime|ogg)(;.*)?$/i.test(type)) return "video";
  if (/^audio\/(webm|mp4|mpeg|ogg|wav|x-wav|aac|flac|x-m4a)(;.*)?$/i.test(type))
    return "audio";
  return null;
}
export function validateMedia(record: MediaRecord) {
  if (
    !record ||
    !/^[a-zA-Z0-9_-]{1,80}$/.test(record.id) ||
    !validDate(record.date) ||
    typeof record.name !== "string" ||
    !record.name ||
    record.name.length > 300 ||
    typeof record.type !== "string" ||
    mediaKind(record.type) !== record.kind ||
    !Number.isInteger(record.size) ||
    record.size <= 0 ||
    record.size > MAX_FILE ||
    typeof record.caption !== "string" ||
    typeof record.transcript !== "string" ||
    !["upload", "recording"].includes(record.source) ||
    typeof record.createdAt !== "string" ||
    !Number.isFinite(Date.parse(record.createdAt)) ||
    (record.duration !== undefined &&
      (!Number.isFinite(record.duration) || record.duration < 0))
  )
    throw new Error("Invalid media record. No files were changed.");
}
export function fileRecord(
  file: File,
  date: string,
  extra: Partial<Pick<MediaRecord, "source" | "duration" | "transcript">> = {},
): MediaRecord {
  const kind = mediaKind(file.type);
  if (!kind)
    throw new Error(
      `${file.name}: unsupported file. Use PNG, JPG, WebP, GIF, AVIF, MP4, MOV, WebM, or a supported audio file.`,
    );
  if (!file.size || file.size > MAX_FILE)
    throw new Error(`${file.name}: files must be nonempty and at most 100 MB.`);
  const record: MediaRecord = {
    id: crypto.randomUUID(),
    date,
    name: file.name,
    type: file.type,
    kind,
    size: file.size,
    createdAt: new Date().toISOString(),
    caption: "",
    transcript: "",
    source: "upload",
    ...extra,
  };
  validateMedia(record);
  return record;
}
function database(): Promise<IDBDatabase> {
  if (!globalThis.indexedDB)
    return Promise.reject(
      new Error(
        "Media storage is unavailable in this browser. Use a regular browser window with storage enabled.",
      ),
    );
  if (!connection)
    connection = new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open(DATABASE, 1);
      open.onupgradeneeded = () => {
        open.result.createObjectStore("metadata", { keyPath: "id" });
        open.result.createObjectStore("blobs");
      };
      open.onsuccess = () => {
        const db = open.result;
        db.onversionchange = () => {
          db.close();
          connection = undefined;
        };
        resolve(db);
      };
      open.onerror = () =>
        reject(
          new Error(
            "Could not open media storage. Check browser storage permissions.",
          ),
        );
      open.onblocked = () =>
        reject(
          new Error(
            "Close other Dear Diary tabs, then reload to open media storage.",
          ),
        );
    }).catch((e) => {
      connection = undefined;
      throw e;
    });
  return connection;
}
function completed(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () =>
      reject(
        new Error(
          "Media could not be saved. Browser storage may be full or unavailable. Download a backup or free space, then retry.",
        ),
      );
  });
}
export async function listMedia(): Promise<MediaRecord[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction("metadata", "readonly")
      .objectStore("metadata")
      .getAll();
    request.onsuccess = () =>
      resolve(
        request.result.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
    request.onerror = () =>
      reject(new Error("Could not read the media library."));
  });
}
export async function getMediaBlob(id: string): Promise<Blob> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction("blobs", "readonly")
      .objectStore("blobs")
      .get(id);
    request.onsuccess = () =>
      request.result instanceof Blob
        ? resolve(request.result)
        : reject(
            new Error("The saved file is missing. Restore a media backup."),
          );
    request.onerror = () => reject(new Error("Could not load this file."));
  });
}
function notify() {
  window.dispatchEvent(new Event("diary-media-changed"));
  try {
    localStorage.setItem("diary-media-updated", crypto.randomUUID());
  } catch {
    /* IndexedDB can remain available when localStorage is full. */
  }
}
export function subscribeMedia(callback: () => void) {
  const storage = (e: StorageEvent) => {
    if (e.key === "diary-media-updated") callback();
  };
  window.addEventListener("diary-media-changed", callback);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener("diary-media-changed", callback);
    window.removeEventListener("storage", storage);
  };
}
export async function saveMedia(record: MediaRecord, blob: Blob) {
  validateMedia(record);
  if (blob.size !== record.size || blob.type !== record.type)
    throw new Error("File contents do not match their metadata.");
  const db = await database(),
    tx = db.transaction(["metadata", "blobs"], "readwrite"),
    done = completed(tx);
  let limitExceeded = false;
  // Check the library limit inside the same write transaction as the insert.
  const all = tx.objectStore("metadata").getAll();
  all.onsuccess = () => {
    const used = all.result
      .filter((x) => x.id !== record.id)
      .reduce((n, x) => n + x.size, 0);
    if (used + record.size > MAX_LIBRARY) {
      limitExceeded = true;
      tx.abort();
      return;
    }
    tx.objectStore("metadata").put(record);
    tx.objectStore("blobs").put(blob, record.id);
  };
  try {
    await done;
  } catch (error) {
    if (limitExceeded)
      throw new Error(
        "The 250 MB media library is full. Export a backup and remove unneeded files before retrying.",
      );
    throw error;
  }
  notify();
}
export async function updateMedia(record: MediaRecord) {
  validateMedia(record);
  const db = await database(),
    tx = db.transaction("metadata", "readwrite"),
    done = completed(tx),
    store = tx.objectStore("metadata"),
    existing = store.get(record.id);
  existing.onsuccess = () => {
    if (!existing.result) {
      tx.abort();
      return;
    }
    store.put({
      ...existing.result,
      caption: record.caption,
      transcript: record.transcript,
    });
  };
  await done;
  notify();
}
export async function deleteMedia(id: string) {
  const db = await database(),
    tx = db.transaction(["metadata", "blobs"], "readwrite"),
    done = completed(tx);
  tx.objectStore("metadata").delete(id);
  tx.objectStore("blobs").delete(id);
  await done;
  notify();
}
export async function replaceMedia(
  items: { record: MediaRecord; blob: Blob }[],
) {
  if (items.reduce((n, x) => n + x.blob.size, 0) > MAX_LIBRARY)
    throw new Error("This backup exceeds the 250 MB media library limit.");
  for (const { record, blob } of items) {
    validateMedia(record);
    if (blob.size !== record.size || blob.type !== record.type)
      throw new Error("Backup file size or type does not match its metadata.");
  }
  const db = await database(),
    tx = db.transaction(["metadata", "blobs"], "readwrite"),
    done = completed(tx);
  tx.objectStore("metadata").clear();
  tx.objectStore("blobs").clear();
  for (const { record, blob } of items) {
    tx.objectStore("metadata").put(record);
    tx.objectStore("blobs").put(blob, record.id);
  }
  await done;
  notify();
}
export async function restoreMediaAndJournal(
  items: { record: MediaRecord; blob: Blob }[],
  journalJSON: string,
  key: string,
) {
  // Compensate the localStorage write if the IndexedDB transaction fails.
  const previous = localStorage.getItem(key);
  localStorage.setItem(key, journalJSON);
  try {
    await replaceMedia(items);
  } catch (error) {
    if (previous === null) localStorage.removeItem(key);
    else localStorage.setItem(key, previous);
    throw error;
  }
}
export function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
