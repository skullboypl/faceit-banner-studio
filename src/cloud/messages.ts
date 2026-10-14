import { ApiError } from './api';

/** Prefer a translated reason. The server message is the fallback and never quotes the blocked text. */
export function apiMessage(tl: (key: string, args?: string[]) => string, failure: unknown): string {
  if (failure instanceof ApiError) {
    if (failure.code === 'content_blocked') {
      const key = `feedback.blocked.${String(failure.details.category ?? '')}`;
      const translated = tl(key);
      if (translated !== key) return translated;
    }
    if (failure.code === 'duplicate_content') {
      const translated = tl('feedback.duplicate');
      if (translated !== 'feedback.duplicate') return translated;
    }
    if (failure.code === 'writing_locked') {
      const translated = tl('feedback.writing_locked');
      if (translated !== 'feedback.writing_locked') return translated;
    }
    const attachmentKey =
      failure.code === 'too_big'
        ? 'attachment.too_big'
        : failure.code === 'bad_type'
          ? 'attachment.bad_type'
          : failure.code === 'attachment_limit' || failure.code === 'attachment_invalid'
            ? 'attachment.limit'
            : null;
    if (attachmentKey) {
      const translated = tl(attachmentKey);
      if (translated !== attachmentKey) return translated;
    }
    return failure.message;
  }
  return String(failure);
}
