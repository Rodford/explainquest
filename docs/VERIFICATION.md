# ExplainQuest Week 4 verification checklist

**Evidence status:** source created; no claim of successful deployment, migration, passing tests, or complete live integration. Keep Jira tasks In Progress until you collect evidence.

## EXQ-27 — Core schema

1. Open Supabase project → SQL Editor → run `supabase/migrations/202611200001_core_schema.sql`.
2. Verify 6 tables: `users`, `subjects`, `topics`, `reference_notes`, `attempts`, `evaluations`.
3. Run `docs/database_checks.sql` in SQL Editor to inspect IDs, defaults, foreign keys and indexes.
4. Create a test account and verify that a matching public.users row is created.
5. Screenshot successful execution and database tables for Jira.

## EXQ-82 — Environment and secrets

1. Copy `.env.example` to `.env.local` and fill required values **only on your own machine**.
2. Remove a required variable temporarily and run `npm run build` — should abort with its *name* in the message (never secret value).
3. Restore the variable; run `npm run build && npm run audit:client` (PowerShell: separate lines if preferred).
4. Verify service-role and API keys are only in server-only code and Vercel server environment, not NEXT_PUBLIC variables.
5. Record successful output, without copying secrets into Jira.

## EXQ-34 — Zod

Run `npm test` and `npm run typecheck`. Try creating invalid subjects and explanations; the API should return 400 and not save data. Both server payload validation and TypeScript types come from Zod.

## EXQ-81 — Idempotency

1. `npm test` includes two simultaneous calls through the submission service with an in-memory atomic mock (one evaluator call, one accepted submission; other 409), plus a cached repeat.
2. On *staging*, concurrently POST two identical `topicId`, `requestKey`, and explanation payloads with a valid user's bearer token.
3. Confirm just **one** `attempts` row and **one** `evaluations` row exist for that `(user_id,request_key)`.
4. Confirm only one external OpenAI API invocation through usage logs, when available. Database RPC unique constraint is the real concurrency barrier.
5. A second request with the same requestKey but a **different** payload must fail 409.

## EXQ-31 — Review queue

- Create a topic with a latest successful evaluation below 70%: it must appear in the queue.
- Create another topic and leave it unattempted until its creation timestamp is at least five days old: it must appear.
- A recent topic with score >=70% should not appear.
- Run `EXPLAIN (ANALYZE, BUFFERS)` with representative, indexed test records against `get_review_queue()` under a user session. Verify actual server time is under 100 ms, and record screenshot. Do **not** claim the latency target without measuring.
- Check a second user cannot see the first user's review topics.

## EXQ-30 — Complete student journey (staging)

- [ ] Sign up / confirm email if enabled / sign in.
- [ ] Create subject `Introduction to Programming`.
- [ ] Create topic `Loops`.
- [ ] Save reference note: `A while loop checks a condition before each iteration.`
- [ ] Explain: `A loop checks a condition, runs the body, and updates the counter.`
- [ ] Receive response with score, strengths, gaps, follow-up question and summary.
- [ ] Revise with: `When the condition becomes false, the loop ends and execution continues after it.`
- [ ] Verify both attempts and both evaluations in Attempt history.
- [ ] Verify second account cannot see the first account's subjects, notes, attempts or evaluations.
- [ ] Check browser console and server logs for errors.
- [ ] Verify live Vercel URL and record screenshots/video of the actual app.

## Milestone submission

- Jira board URL, with each assigned task and acceptance evidence.
- GitHub `development` branch or merged pull request URL.
- Running **Vercel staging URL** (or Dockerfile URL, if your instructor permits).
- Live team review attendance and demonstration; video only with instructor approval.

The previous Codex session reported the milestone deadline as **Sunday, November 22, 2026, 11:59 PM EST**. Confirm this in Full Sail’s current assignment page.
