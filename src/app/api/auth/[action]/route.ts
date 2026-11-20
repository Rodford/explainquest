import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env.server';
import { signUpSchema,signInSchema,recoverySchema } from '@/lib/validation';
import { parseBody,errorResponse,HttpError } from '@/lib/http';
export async function POST(request:Request,context:{params:Promise<{action:string}>}) {
  try {
    const {action}=await context.params;
    const db=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false}});
    if(action==='recover'){const input=await parseBody(request,recoverySchema);await db.auth.resetPasswordForEmail(input.email);return Response.json({message:'If an account exists, a reset email was requested.'});}
    if(!['sign-up','sign-in'].includes(action))throw new HttpError(404,'Action not found.');
    const input=await parseBody(request,action==='sign-up'?signUpSchema:signInSchema);
    const {data,error}=action==='sign-up'?await db.auth.signUp(input):await db.auth.signInWithPassword(input);
    if(error)throw new HttpError(400,'Authentication could not be completed. Check your details.');
    return Response.json(data,{headers:{'Cache-Control':'no-store'}});
  }catch(e){return errorResponse(e);}
}
