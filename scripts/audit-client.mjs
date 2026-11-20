import { readdir,readFile } from 'node:fs/promises';
import path from 'node:path';
const forbidden=['SUPABASE_SERVICE_ROLE_KEY','OPENAI_API_KEY',process.env.SUPABASE_SERVICE_ROLE_KEY,process.env.OPENAI_API_KEY].filter(Boolean);
let inspected=0;
async function visit(dir){for(const e of await readdir(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())await visit(f);else if(/\.(js|map)$/.test(f)){const s=await readFile(f,'utf8');for(const token of forbidden)if(s.includes(token))throw new Error('Server secret reference found in client artifact: '+f);inspected++;}}}
await visit('.next/static');
if(!inspected)throw new Error('No client bundles found. Run the production build first.');
console.log(`Client bundle audit passed: ${inspected} artifacts; server key names and supplied secret values absent.`);
