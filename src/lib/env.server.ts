import 'server-only';
import { validateEnv } from './env-schema.mjs';
export const env = validateEnv(process.env);
