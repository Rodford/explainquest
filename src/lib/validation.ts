import { z } from 'zod';
export const uuid = z.uuid();
const title = z.string().trim().min(1).max(200);
// Initial team-configurable boundaries; not represented as final SDD decisions.
export const signUpSchema = z.strictObject({ email: z.email().max(254), password: z.string().min(12).max(128) });
export const signInSchema = z.strictObject({ email: z.email().max(254), password: z.string().min(1).max(128) });
export const recoverySchema = z.strictObject({ email: z.email().max(254) });
export const subjectSchema = z.strictObject({ name: title });
export const topicSchema = z.strictObject({ subjectId: uuid, title });
export const notesSchema = z.strictObject({ topicId: uuid, content: z.string().max(50000) });
export const explanationSchema = z.strictObject({
  topicId: uuid,
  requestKey: uuid,
  explanation: z.string().trim().min(1).max(10000),
  difficulty: z.enum(['beginner','intermediate']),
  priorAttemptId: uuid.nullable().default(null),
});
export const evaluationSchema = z.strictObject({
  strengths: z.array(z.string().min(1).max(2000)).max(20),
  gaps: z.array(z.string().min(1).max(2000)).max(20),
  summary: z.string().min(1).max(4000),
  followUpQuestion: z.string().min(1).max(2000),
  matchScore: z.number().int().min(0).max(100),
  needsMoreContext: z.boolean(),
});
export type ExplanationInput = z.infer<typeof explanationSchema>;
export type Evaluation = z.infer<typeof evaluationSchema>;
export type SubjectInput = z.infer<typeof subjectSchema>;
export type TopicInput = z.infer<typeof topicSchema>;
export type NotesInput = z.infer<typeof notesSchema>;
