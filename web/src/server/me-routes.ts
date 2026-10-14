import { createMeHandlers } from './me-handlers';

/** One handler set (and one rate-limit memory) per server process. */
export const meHandlers = createMeHandlers();
