import { describe,it,expect } from 'vitest';
import { signUpSchema,subjectSchema,topicSchema,notesSchema,explanationSchema,evaluationSchema } from '../validation';
import {parseBody} from '../http';

const goodId='11111111-1111-4111-8111-111111111111';
const badCases = [
  [subjectSchema, {name:'  '}],
  [topicSchema, {subjectId:'not-a-uuid',title:'Loops'}],
  [notesSchema, {topicId:goodId,content:'x'.repeat(50001)}],
  [explanationSchema, {topicId:goodId,requestKey:goodId,difficulty:'advanced',explanation:'some text'}],
  [signUpSchema, {email:'student@example.com',password:'short'}],
  [evaluationSchema, {strengths:[],gaps:[],summary:'yes',followUpQuestion:'why?',matchScore:105,needsMoreContext:false}],
] as const;
describe('EXQ-34 strict Zod payloads',()=>{
  it.each(badCases)('rejects invalid payloads', (schema,body)=>{
    expect(schema.safeParse(body).success).toBe(false);
  });
  it('rejects unknown form fields',()=>{
    expect(subjectSchema.safeParse({name:'Math',user_id:goodId}).success).toBe(false);
  });
  it('returns HTTP 400 for malformed request bodies',async()=>{
    const req=new Request('http://localhost/api/materials/subjects', {method:'POST',body:JSON.stringify({name:''})});
    await expect(parseBody(req,subjectSchema)).rejects.toMatchObject({status:400});
  });
  it('rejects overly large request bodies',async()=>{
    const req=new Request('http://localhost/api/materials/subjects', {method:'POST',body:JSON.stringify({name:'a'.repeat(257000)})});
    await expect(parseBody(req,subjectSchema)).rejects.toMatchObject({status:400});
  });
});
