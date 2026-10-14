import { createFeedbackHandlers } from './feedback-handlers';

/** One handler set (and one rate-limit memory) per server process. */
export const feedback = createFeedbackHandlers();
