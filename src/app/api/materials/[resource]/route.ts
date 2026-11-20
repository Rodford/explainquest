import { authenticate } from '@/lib/supabase.server';
import { parseBody, errorResponse, HttpError } from '@/lib/http';
import { subjectSchema,topicSchema,notesSchema } from '@/lib/validation';
const names={subjects:'subjects',topics:'topics','reference-notes':'reference_notes'} as const;
type Resource=keyof typeof names;
function tableFor(resource:string): typeof names[Resource] {
  if(!Object.prototype.hasOwnProperty.call(names,resource)) throw new HttpError(404,'Resource not found.');
  return names[resource as Resource];
}
export async function GET(request:Request,context:{params:Promise<{resource:string}>}) {
  try {
    const {resource}=await context.params;
    const table=tableFor(resource);
    const {client}=await authenticate(request);
    const {data,error}=await client.from(table).select('*').order('created_at',{ascending:false}).limit(250);
    if(error) throw new HttpError(500,'Could not load study material.');
    return Response.json(data,{headers:{'Cache-Control':'no-store'}});
  } catch(e) {return errorResponse(e);}
}
export async function POST(request:Request,context:{params:Promise<{resource:string}>}) {
  try {
    const {resource}=await context.params;
    const table=tableFor(resource);
    const schema=resource==='subjects'?subjectSchema:resource==='topics'?topicSchema:notesSchema;
    const input=await parseBody(request,schema);
    const {userId,client}=await authenticate(request);
    let operation;
    if('name' in input && table==='subjects') operation=client.from('subjects').insert({user_id:userId,name:input.name});
    else if('subjectId' in input && table==='topics') operation=client.from('topics').insert({user_id:userId,subject_id:input.subjectId,title:input.title});
    else if('topicId' in input && table==='reference_notes') operation=client.from('reference_notes').upsert({user_id:userId,topic_id:input.topicId,content:input.content},{onConflict:'topic_id'});
    else throw new HttpError(400,'The request does not match the resource.');
    const {data,error}=await operation.select().single();
    if(error) throw new HttpError(400,'Could not save material. Check its owner and required fields.');
    return Response.json(data,{status:201});
  }catch(e){return errorResponse(e);}
}
