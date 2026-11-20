import { validateEnv } from './src/lib/env-schema.mjs';
// Configuration is loaded before the application is compiled.
validateEnv(process.env);
export default { reactStrictMode: true, poweredByHeader: false };
