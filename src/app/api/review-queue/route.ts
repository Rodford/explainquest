import { authenticate } from '@/lib/supabase.server';
import { errorResponse } from '@/lib/http';
export async function GET(request: Request) {
  try { const {client}=await authenticate(request);const {data,error}=await client.rpc('get_review_queue');
    if(error)throw error;return Response.json(data);
  }catch(e){return errorResponse(e);}
}
