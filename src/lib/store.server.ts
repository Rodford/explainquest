import 'server-only';
import { admin } from './supabase.server';
import { env } from './env.server';
import { HttpError } from './http';
import { evaluationSchema } from './validation';
import type { SubmissionStore } from './submission';
export function submissionStore(): SubmissionStore {
  const db = admin();
  return {
    async reserve(userId, input) {
      const { data, error } = await db.rpc('reserve_attempt', { p_user_id: userId, p_payload: input });
      if (error) {
        if (error.code === '23505') throw new HttpError(409, 'Request key was already used with different input.');
        if (['23503','42501'].includes(error.code)) throw new HttpError(404, 'Topic or prior attempt not found.');
        throw error;
      }
      return data;
    },
    async context(id) {
      const {data:a,error} = await db.from('attempts').select('topic_title_snapshot,reference_notes_snapshot,prior_attempt_id').eq('id',id).single();
      if(error) throw error;
      let priorExplanation = null;
      if(a.prior_attempt_id) {
        const {data:p,error:e}=await db.from('attempts').select('explanation_text').eq('id',a.prior_attempt_id).single();
        if(e) throw e; priorExplanation=p.explanation_text;
      }
      return {topic:a.topic_title_snapshot,notes:a.reference_notes_snapshot,priorExplanation};
    },
    async cached(id) {
      const {data,error}=await db.from('evaluations').select('result').eq('attempt_id',id).maybeSingle();
      if(error) throw error;return data?evaluationSchema.parse(data.result):null;
    },
    async complete(id,evaluation) {
      const {error}=await db.rpc('complete_attempt',{p_attempt_id:id,p_result:evaluation,p_model:env.OPENAI_MODEL});
      if(error) throw error;
    },
    async fail(id) {
      const {error}=await db.from('attempts').update({status:'failed'}).eq('id',id).eq('status','processing');
      if(error) throw error;
    },
  };
}
