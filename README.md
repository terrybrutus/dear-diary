# Dear Diary

A local-first trading journal built from the Caffeine React/Motoko starter. The calendar is the main workspace: select any day to write a reflection or record a trade. The app starts empty. Optional sample records are available in Settings.

## Run locally

Requires Git, Node.js **22.12+** (24 LTS recommended), and pnpm. No Internet Computer replica, wallet, sign-in, or Motoko toolchain is required for the local journal.

```sh
git clone --branch codex/trading-journal-v1 https://github.com/terrybrutus/dear-diary.git
cd dear-diary
npm install --global pnpm@10.26.1
pnpm install --frozen-lockfile
pnpm local
```

Open **http://127.0.0.1:4173** in your regular browser. Keep that exact address and browser consistent: browser storage is scoped to the address. The server binds only to this computer. Stop with Ctrl+C.

### MacBook

After cloning, run `chmod +x Start-Mac.command` once. Then double-click **Start-Mac.command**, or run `bash Start-Mac.command` from Terminal. The launcher pulls the latest Git version when there are no uncommitted code changes, installs locked dependencies, starts the local server, and opens the browser. If Node/pnpm isn't on Finder's PATH, run the launcher from Terminal.

### Windows desktop

Double-click **Start-Windows.cmd** from the same checkout each time. The behavior and local URL are identical to the Mac launcher. You can also run `pnpm start` on either system.

### Switching computers

1. On the computer you're leaving, select **Import / Sync → Export journal + media**.
2. Transfer that ZIP file using AirDrop or your private shared drive. It includes the original recordings, screenshots, videos, and saved transcripts.
3. Launch Dear Diary on the other computer to pull the latest code.
4. Select **Import / Sync → Restore backup**. Restore validates the file and downloads a copy of the current records before replacement.

**Git carries application code, not private journal data.** This iteration has manual data transfer, not automatic cloud synchronization. Use one active device at a time; restoring replaces the destination dataset rather than merging it. Keep backups outside the repository. Browser data is not encrypted by this app; clearing it removes records. A browser-tab storage change pauses saving until you reload.

When asking Codex to switch devices, say “I'm on my MacBook” or “I'm back on my desktop.” The repository's AGENTS.md records the handoff procedure. Codex must actually be connected to the requested computer to manage that computer's checkout. A chat on another host cannot create files on your Mac.

## Working features

- Calendar: full months, previous/next/today navigation, green/red day results, journal markers, clickable blank days.
- Journal: dated title, reflection, emotion, tags; add, edit, delete, browser persistence.
- Trades: symbol, direction, realized net P/L after fees, initial monetary risk, setup and notes; add, edit, delete, search.
- Metrics: monthly net P/L, win rate, active trading days, average realized R, and current journal streak. Breakeven trades are included in the win-rate denominator. Average R excludes trades with zero initial risk. Streak is consecutive calendar days ending today or yesterday.
- Dashboard, daily and setup analytics, monthly review, CSV trade export.
- Playbook rules, reusable tags, manually tracked process goals, profile/currency settings, dark mode, collapsible sidebar.
- Validated ZIP backup/restore for records, settings, and original media; compatible with older text-only JSON backups. Currency is a display preference, not FX conversion.
- Voice reflections with saved audio, optional browser live transcription, editable transcripts, and insertion into journal entry drafts. Screenshots and video uploads are saved by day, with previews, captions, and downloads.
- A searchable Media Library in the sidebar, plus attachment counts on calendar days.
- Assistant: local record search with day navigation; optional Claude conversation with complete journal context and date links.

No brokerage connection, broker CSV mapping, vector index, or automatic data sync is included. Import / Sync restores the app's ZIP and legacy JSON backups. Chat is session-only and is not saved in a backup.

## Voice reflections, screenshots, and video

Open a calendar day, stay on its **Journal** tab, and choose **Record a reflection**. Allow microphone access in your browser. Talk naturally, then choose **Stop & save recording**. The original audio and any captured transcript save immediately to that day, even before you save a written entry. The transcript also fills the reflection draft and supplies a default title; review the wording and choose **Save entry**. You can make multiple clips. Recording stops automatically after 15 minutes per clip. The day cannot close during capture/saving; if storage fails, the unsaved clip remains available to download, retry, or explicitly discard.

**Live transcription** uses the browser's [SpeechRecognition API](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition); support and accuracy vary. The browser provider may process audio remotely, and internet may be required. The toggle and language selector are beside the recorder, with a disclosure before recording. Turn live transcription off to record audio without invoking the speech service. If recognition fails or is unsupported, the original audio still records, and its transcript can be typed or edited afterward. There is no separate server transcription endpoint or automatic transcription of uploaded files yet. Recorded audio formats are selected using browser support (Opus/WebM, MP4, or Ogg).

Choose files or drop them into the day to attach screenshots (PNG/JPG/WebP/GIF/AVIF), videos (MP4/WebM/MOV/Ogg), or supported audio. Files attach to the **selected calendar day**, independently of the date field on a written entry. A file remains when an entry is deleted; attachment deletion is a separate, confirmed action. Use **Media Library** to search file names, dates, captions, and audio transcripts, or reopen a day. Video/audio playback depends on browser codec support; the original is downloadable if playback is unavailable. Saved transcript text can be corrected and copied into an entry with **Use transcript in entry**.

Original files are stored as IndexedDB blobs, not in localStorage, Git, or a cloud service. The app allows up to **100 MB per file** and **250 MB total media**, subject to the browser's available quota. Metadata is kept separately so browsing dates doesn't load every video. ZIP backups include all originals and saved transcripts. ZIP restoration replaces the media library; legacy JSON restoration leaves existing media unchanged. A text-only export is available and explicitly excludes media. Back up before clearing browser data or moving computers. These backups are not encrypted.

This feature captures your words and evidence; it does not interpret audio/images/video or extract trades. Existing Claude chat sees written journal records only. Media interpretation can be added separately later. If you save transcript text into a journal entry, that text becomes part of the written journal context used by Claude when connected.

## Connect Claude Haiku

Copy `.env.example` to **`.env.local`** at the repository root, set your own key, and restart the server:

```dotenv
ANTHROPIC_API_KEY=your-key-here
ANTHROPIC_MODEL=claude-haiku-4-5
```

The server calls the [Anthropic Messages API](https://platform.claude.com/docs/en/api/messages/create). The key stays on the local server and is ignored by Git. Connected requests send the complete journal (chronologically ordered trades and reflections, playbook, tags, goals, settings) plus recent chat to Anthropic. The assistant cannot mutate records or execute trades. Date references returned by Claude become buttons to existing days. Without a key, the assistant visibly uses local keyword/result search, not simulated AI. A configured key is not proof of validity: upstream errors are displayed when a request fails.

Requests are limited to 600 KB and time out after 60 seconds; oversized journals fail explicitly rather than silently dropping history. Large histories will need retrieval/indexing in a future iteration. Actual Claude responses require your API key and available account credit.

## Development and validation

```sh
pnpm typecheck
pnpm --dir src/frontend test
pnpm build
```

The frontend lives in `src/frontend/src/`. `scripts/local.mjs` provides Vite and the server-side Claude bridge. Build uses a portable Node file copy instead of the original Unix-only `cp` command. The launcher uses `git pull --ff-only`; it never resets, cleans, stashes, merges, or overwrites local source edits. If offline, it reports that it is launching the existing local code.

## Returning to Caffeine

The original `src/backend`, canister declarations, and Caffeine configuration are retained. The journal frontend currently uses browser storage, not the Motoko actor. Caffeine reimport should therefore preserve the UI, but hosted persistence and Claude require explicit integration: authenticated per-user backend records and a secure hosted secret/API bridge. Never move an API key into Vite variables or frontend code. `pnpm build` verifies frontend packaging; it does not verify a Caffeine deployment or Motoko persistence migration.
