import { describe, it, expect } from 'vitest';
import { submitExplanation, type SubmissionStore } from '../submission';
import { HttpError } from '../http';
import type { Evaluation, ExplanationInput } from '../validation';

const topicId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const requestKey = '33333333-3333-4333-8333-333333333333';
const input: ExplanationInput = {
  topicId, requestKey, priorAttemptId: null,
  explanation: 'A loop repeats its body until the exit condition is met.',
  difficulty: 'beginner',
};
const feedback: Evaluation = {
  strengths: ['Recognizes iteration'], gaps: [],
  summary: 'Clear loop explanation.', followUpQuestion: 'What changes per iteration?',
  matchScore: 75, needsMoreContext: false,
};
function fixture() {
  let winner = false;
  let cached: Evaluation | null = null;
  let calls = 0;
  const store: SubmissionStore = {
    async reserve() {
      // In production PostgreSQL's unique (user_id, request_key) index is atomic.
      const created = !winner;
      winner = true;
      return {created, attempt: {id:'a1',status:created?'processing':'completed'}};
    },
    async context() {return {topic:'Loops',notes:'',priorExplanation:null};},
    async cached() {return cached;},
    async complete(_,evaluation) {cached=evaluation;},
    async fail() {return;},
  };
  const evaluate = async () => {calls++; await new Promise(r=>setTimeout(r,15));return feedback;};
  return {store,evaluate,getCalls:()=>calls};
}
describe('EXQ-81 duplicate submission contract',()=>{
  it('returns one accepted result and 409 for concurrent identical requests, invoking provider once',async()=>{
    const f=fixture();
    const results=await Promise.allSettled([
      submitExplanation(userId,input,f.store,f.evaluate),
      submitExplanation(userId,input,f.store,f.evaluate),
    ]);
    expect(f.getCalls()).toBe(1);
    expect(results.filter(x=>x.status==='fulfilled')).toHaveLength(1);
    const rejected=results.find(x=>x.status==='rejected');
    expect(rejected?.status).toBe('rejected');
    if(rejected?.status==='rejected') expect(rejected.reason).toMatchObject({status:409});
  });
  it('returns cached evaluation on a repeat after completion',async()=>{
    const f=fixture();
    const first=await submitExplanation(userId,input,f.store,f.evaluate);
    const second=await submitExplanation(userId,input,f.store,f.evaluate);
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.evaluation).toEqual(first.evaluation);
    expect(f.getCalls()).toBe(1);
  });
  it('preserves a failed attempt rather than pretending AI succeeded',async()=>{
    const f=fixture();
    await expect(submitExplanation(userId,input,f.store,async()=>{throw Error('offline');}))
      .rejects.toMatchObject({status:503});
  });
});
