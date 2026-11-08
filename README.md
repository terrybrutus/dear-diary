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

1. On the computer you're leaving, select **Import / Sync → Export backup**.
2. Transfer that JSON file using AirDrop or your private shared drive.
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
- Validated JSON backup/restore for all records and settings. Currency is a display preference, not FX conversion.
- Assistant: local record search with day navigation; optional Claude conversation with complete journal context and date links.

No brokerage connection, broker CSV mapping, vector index, or automatic data sync is included. Import / Sync restores the app's JSON backups. Chat is session-only and is not saved in a backup.

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
