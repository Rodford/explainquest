import { z } from 'zod';
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function parseBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  // Enforce a byte cap while streaming; Content-Length alone is not trustworthy.
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'A JSON body is required.');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 256000) { await reader.cancel(); throw new HttpError(400, 'Request body is too large.'); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const c of chunks) { bytes.set(c, offset); offset += c.length; }
    const input: unknown = JSON.parse(new TextDecoder().decode(bytes));
    const result = schema.safeParse(input);
    if (!result.success) throw new HttpError(400, 'Invalid input: ' + result.error.issues.map(i => i.path.join('.')).join(', '));
    return result.data;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, 'Invalid JSON body.');
  } finally { reader.releaseLock(); }
}
export function errorResponse(e: unknown) {
  return Response.json({ error: e instanceof HttpError ? e.message : 'The request could not be completed.' },
    { status: e instanceof HttpError ? e.status : 500 });
}
