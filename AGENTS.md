# Project Guidance

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
