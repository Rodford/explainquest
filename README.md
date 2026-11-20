# ExplainQuest — Week 4 MVP Foundation

Next.js 16 / React / TypeScript / Supabase / OpenAI Responses API.

This package continues the existing Codex-generated foundation. It now includes a live student-facing MVP journey, owner-scoped PostgreSQL tables, submission idempotency, a review-queue query, and unit tests. **It has not yet been installed, built, or run against your Supabase and OpenAI accounts.** Do not mark Jira items complete until you verify them.

## Quick start (Windows PowerShell)

1. Install **Node.js 22 LTS** (or a compatible Node.js version) and Git if not installed.
2. Extract this package to a project directory. Open PowerShell **inside that directory**.
3. Run `npm ci`.
4. Create your own local environment file: `Copy-Item .env.example .env.local`.
5. Fill `.env.local` with values from your Supabase project and OpenAI account. Do not commit or upload it.
6. In Supabase SQL Editor, execute `supabase/migrations/202611200001_core_schema.sql` once, ideally against a new development project.
7. Run `npm run check` and `npm run dev`. Open `http://localhost:3000`.
8. Test the full journey (see `docs/VERIFICATION.md`).
9. Deploy to Vercel after a passing build, add the same five variables to its environment, and verify on the live site.

## Environment variables

| Name | Location | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project Settings/API | Public URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase API settings | Public/publishable key; use the JWT `anon` key for this scaffold as currently implemented |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase API settings | **Server secret only** |
| `OPENAI_API_KEY` | OpenAI API platform | **Server secret only** |
| `OPENAI_MODEL` | Model approved by your team | Model must support strict JSON Schema Structured Outputs |

The app intentionally refuses to start if required variables are missing. **Never paste real service-role keys or API tokens into this chat, GitHub, or Jira.** Keep them in `.env.local` and Vercel's environment settings.

## MVP path

Register/sign in → create a subject → create a topic → save reference notes → explain topic → receive AI feedback → edit answer → submit a revision → view history/review queue.

The authentication API supports password recovery email, but a complete reset-password UI is not part of this MVP. When Supabase email confirmation is enabled, signup prompts the student to verify email before login.

## Known limits

- No live Supabase, Vercel, or OpenAI credentials were supplied; database migrations, API integration, billing, and the full journey were **not run** here.
- The session token is held only in memory in this demo; a page reload requires signing in again. Production should move to the supported Supabase SSR cookie/session flow.
- A failed AI call retains the explanation. Retrying with the original request key results in a 409; you can submit a fresh request as a new attempt. A same-attempt retry feature still needs to be implemented.
- This supports a Week 4 MVP path, **not every feature in the 67-screen Figma design** (quests, XP, badges, uploads, voice, advanced preferences are still outside this package).
- Tests include a mocked concurrent-submission test. Real PostgreSQL parallel insert behavior and the EXQ-31 sub-100ms target must still be verified on staging.
- No code has been pushed to your GitHub repository by this package.

## Useful commands

```powershell
npm ci
npm run typecheck
npm test
npm run dev
npm run build
npm run audit:client
```

The client bundle audit runs **after a production build**, not during development.

See `docs/VERIFICATION.md` for issue-by-issue acceptance testing and deployment checks.
