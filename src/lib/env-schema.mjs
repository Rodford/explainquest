import { z } from 'zod';
const nonempty = z.string().trim().min(1);
export const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url().refine(v => /^https?:\/\//.test(v), 'Must use HTTP(S)'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: nonempty,
  SUPABASE_SERVICE_ROLE_KEY: nonempty,
  OPENAI_API_KEY: nonempty,
  OPENAI_MODEL: nonempty,
});
export function validateEnv(input) {
  const parsed = envSchema.safeParse(input);
  if (!parsed.success) {
    // Never include input values (secrets) in logs or build errors.
    throw new Error('Missing or invalid environment configuration: ' +
      [...new Set(parsed.error.issues.map(i => i.path.join('.')))].join(', '));
  }
  return parsed.data;
}
