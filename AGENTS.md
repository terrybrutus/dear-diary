# Project Guidance

## Current task and device handoff (supersedes older scaffold preferences below)

- Build Dear Diary as a working local-first trading journal based on the supplied calendar reference. The user's current request supersedes the original no-business-logic scaffold instructions.
- Preserve the React/Motoko Caffeine project structure for eventual reimport; local operation must not require a canister.
- When the user says they are on their MacBook or desktop, first inspect the connected execution host. Never claim to have created or updated files on another machine.
- Reuse that device's dear-diary checkout. Inspect status, preserve local changes, fetch/pull with --ff-only when safe, install locked dependencies if needed, verify the app, and use the platform launcher. Never reset or clean the checkout to force synchronization.
- Git carries source only. Journal records remain in browser storage. Remind the user to export/restore a private JSON backup during a device handoff until shared storage is implemented. Never commit private trades, API keys, or backups.
- Default local URL is http://127.0.0.1:4173. Node 22.12+ and pnpm are prerequisites. Use `pnpm local`; launchers also safely check for updates.
- Validate changes with `pnpm typecheck`, `pnpm --dir src/frontend test`, and `pnpm build`. Motoko tests apply only to backend changes.

## User Preferences

- Keep the app minimal: only essential structure, configuration, dependencies and basic scaffolding
- Use a generic placeholder app name
- Prioritize speed and a clean, exportable project structure
- No business logic, dashboards, sample features or extra functionality

## Accepted Requirements

[Filled after each deployed build — what the user asked for and the build delivered]

## Verified Commands

- **typecheck**: `pnpm typecheck`
- **fix**: `pnpm fix`
- **build**: `pnpm build`

## Learnings

- src/frontend/index.html shipped a stray '# ' prefix in <title> and og:title; keep og:title identical to <title> and og:description identical to the description meta tag.
- The backend-reachability query uses enabled: !!actor && !isFetching, so it resolves once the actor exists regardless of sign-in.
- api-documentation template installs mixins/api-doc.mo as a bare mixin(); wire it with include ApiDocMixin() in main.mo.
- Frontend test suite lives at src/frontend/src/__tests__/App.test.tsx and the PocketIC backend lane at test/pocketic/backend.test.ts; run them with `pnpm --dir app test` and `pnpm --dir app run test:backend`.
- The app display name is duplicated, not centralized: src/frontend/index.html holds it in <title>, the description meta and the og:title/og:description tags, while src/frontend/src/App.tsx and src/frontend/src/components/Layout.tsx each declare their own module-local APP_NAME constant. A rename must edit all three files.
- src/frontend/src/__tests__/App.test.tsx asserts the app name in three places and reads index.html from disk for the tab title, so a rename requires the tester to update that file.
