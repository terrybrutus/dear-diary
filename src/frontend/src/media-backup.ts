import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { parseJournal, type Journal } from "./journal";
import {
  listMedia,
  getMediaBlob,
  validateMedia,
  MAX_LIBRARY,
  type MediaRecord,
} from "./media-store";

export async function createJournalBackup(journal: Journal): Promise<Blob> {
  const records = await listMedia(),
    files: Record<string, Uint8Array> = {};
  if (records.reduce((n, r) => n + r.size, 0) > MAX_LIBRARY)
    throw new Error(
      "Media exceeds the backup size limit. Download individual files from Media Library.",
    );
  for (const record of records) {
    const blob = await getMediaBlob(record.id);
    if (blob.size !== record.size)
      throw new Error(
        `Missing or damaged media: ${record.name}. Backup cancelled.`,
      );
    files[`media/${record.id}`] = new Uint8Array(await blob.arrayBuffer());
  }
  files["manifest.json"] = strToU8(
    JSON.stringify({
      format: "dear-diary",
      version: 1,
      journal,
      media: records,
    }),
  );
  if (
    records.length > 9999 ||
    files["manifest.json"].byteLength > 5 * 1024 * 1024
  )
    throw new Error(
      "The backup manifest is too large. Download individual media files and a text-only journal export before reducing the library.",
    );
  const archive = zipSync(files, { level: 0 });
  return new Blob([archive as Uint8Array<ArrayBuffer>], {
    type: "application/zip",
  });
}
export async function readJournalBackup(file: File): Promise<{
  journal: Journal;
  media?: { record: MediaRecord; blob: Blob }[];
}> {
  if (file.size > MAX_LIBRARY + 10 * 1024 * 1024)
    throw new Error("Backup exceeds the 260 MB import limit.");
  if (!file.name.toLowerCase().endsWith(".zip"))
    return { journal: parseJournal(await file.text()) };
  let total = 0,
    count = 0;
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()), {
    filter: (info) => {
      if (
        ++count > 10000 ||
        !/^manifest\.json$|^media\/[a-zA-Z0-9_-]{1,80}$/.test(info.name)
      )
        throw new Error("Unexpected files in this backup.");
      total += info.originalSize;
      if (
        total > MAX_LIBRARY + 5 * 1024 * 1024 ||
        (info.name === "manifest.json" && info.originalSize > 5 * 1024 * 1024)
      )
        throw new Error("Backup contents exceed the import limit.");
      return true;
    },
  });
  if (!files["manifest.json"])
    throw new Error("This ZIP is not a Dear Diary backup.");
  const manifest = JSON.parse(strFromU8(files["manifest.json"]));
  if (
    manifest.format !== "dear-diary" ||
    manifest.version !== 1 ||
    !Array.isArray(manifest.media)
  )
    throw new Error("Invalid backup manifest.");
  const journal = parseJournal(JSON.stringify(manifest.journal)),
    ids = new Set<string>();
  const media = manifest.media.map((record: MediaRecord) => {
    validateMedia(record);
    if (ids.has(record.id)) throw new Error("Duplicate media in backup.");
    ids.add(record.id);
    const bytes = files[`media/${record.id}`];
    if (!bytes || bytes.byteLength !== record.size)
      throw new Error(`Missing or damaged file: ${record.name}`);
    return {
      record,
      blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: record.type }),
    };
  });
  if (Object.keys(files).length !== media.length + 1)
    throw new Error("Backup contains unlisted media.");
  return { journal, media };
}
