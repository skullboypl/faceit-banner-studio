import { fail, json } from './http';
import { blocked, createViolationTracker, moderate, type ModerationCategory, type ModerationKind } from './moderation';

/**
 * One tracker per handler factory. Five blocked writes lock that user for an hour.
 * The response never includes the text that was matched.
 */
export function createContentGate() {
  const violations = createViolationTracker();

  const locked = (userId: string): Response =>
    json(
      429,
      { error: 'writing_locked', message: 'Writing is paused after repeated blocked messages.' },
      { 'retry-after': String(Math.max(1, violations.retryAfterSeconds(userId))) }
    );

  const deny = (userId: string, category: ModerationCategory, reason: string): Response => {
    violations.record(userId);
    return fail(400, 'content_blocked', reason, { category }).response;
  };

  return {
    /** 429 when the user is locked, 400 content_blocked on the first bad field, otherwise null. */
    screen(userId: string, fields: { text: string; kind: ModerationKind }[]): Response | null {
      if (violations.isLocked(userId)) return locked(userId);
      for (const field of fields) {
        const result = moderate(field.text, field.kind);
        if (!result.ok) return deny(userId, result.category, result.reason);
      }
      return null;
    },

    /** A non-empty `website` field is a bot. Humans leave it blank. The value is never stored or quoted. */
    honeypot(userId: string, website: unknown): Response | null {
      if (typeof website !== 'string' || website.trim() === '') return null;
      if (violations.isLocked(userId)) return locked(userId);
      const result = blocked('spam');
      return deny(userId, result.category, result.reason);
    },
  };
}
