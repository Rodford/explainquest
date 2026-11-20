import { HttpError } from './http';
import { evaluationSchema, type Evaluation, type ExplanationInput } from './validation';
export interface Attempt { id: string; status: string; }
export interface SubmissionStore {
  reserve(userId: string, input: ExplanationInput): Promise<{created: boolean; attempt: Attempt}>;
  context(id: string): Promise<{ topic: string; notes: string; priorExplanation: string | null }>;
  cached(id: string): Promise<Evaluation | null>;
  complete(id: string, evaluation: Evaluation): Promise<void>;
  fail(id: string): Promise<void>;
}
export type Evaluator = (input: ExplanationInput, context: Awaited<ReturnType<SubmissionStore['context']>>) => Promise<Evaluation>;
export async function submitExplanation(userId: string, input: ExplanationInput, store: SubmissionStore, evaluate: Evaluator) {
  // Only the winner of the database insert can invoke the provider. There is no in-memory lock.
  const reserved = await store.reserve(userId, input);
  if (!reserved.created) {
    const cached = await store.cached(reserved.attempt.id);
    if (cached) return { attemptId: reserved.attempt.id, evaluation: cached, cached: true };
    throw new HttpError(409, 'This request already exists. View the saved attempt; no new AI call was made.');
  }
  try {
    const context = await store.context(reserved.attempt.id);
    const evaluation = evaluationSchema.parse(await evaluate(input, context));
    await store.complete(reserved.attempt.id, evaluation);
    return { attemptId: reserved.attempt.id, evaluation, cached: false };
  } catch {
    await store.fail(reserved.attempt.id).catch(() => undefined);
    throw new HttpError(503, 'Your explanation is saved, but evaluation is unavailable.');
  }
}
