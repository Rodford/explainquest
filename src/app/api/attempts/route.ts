import { authenticate } from '@/lib/supabase.server';
import { parseBody, errorResponse, HttpError } from '@/lib/http';
import { explanationSchema } from '@/lib/validation';
import { submissionStore } from '@/lib/store.server';
import { evaluate } from '@/lib/evaluator.server';
import { submitExplanation } from '@/lib/submission';
export async function POST(request: Request) {
  try {
    const { userId } = await authenticate(request);
    const input = await parseBody(request, explanationSchema);
    const result = await submitExplanation(userId, input, submissionStore(), evaluate);
    return Response.json(result, {status:result.cached?200:201});
  } catch(e) { return errorResponse(e); }
}
export async function GET(request: Request) {
  try {
    const {client} = await authenticate(request);
    const {data,error} = await client.from('attempts')
      .select('id,topic_id,explanation_text,difficulty,prior_attempt_id,status,created_at,evaluations(result,match_score)')
      .order('created_at',{ascending:false}).limit(100);
    if(error) throw new HttpError(500,'Could not load attempt history.');
    return Response.json(data,{headers:{'Cache-Control':'no-store'}});
  } catch(e) {return errorResponse(e);}
}
