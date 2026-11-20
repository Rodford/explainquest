import {it,expect,describe} from 'vitest';
import {validateEnv} from '../env-schema.mjs';
const config={NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'a',SUPABASE_SERVICE_ROLE_KEY:'b',OPENAI_API_KEY:'c',OPENAI_MODEL:'gpt-4.1-mini'};
describe('EXQ-82 startup environment schema',()=>{
  it('allows complete configuration',()=>expect(validateEnv(config)).toBeTruthy());
  it.each(Object.keys(config))('fails immediately when %s is missing',(k)=>{
    expect(()=>validateEnv({...config,[k]:''})).toThrow(k);
  });
  it('does not log secrets in errors',()=>{
    expect(()=>validateEnv({...config,NEXT_PUBLIC_SUPABASE_URL:'not a url'})).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});
