import { createProfileImageHandlers } from './profile-image-handlers';

/** One handler set (and one rate-limit memory) per server process. */
export const profileImages = createProfileImageHandlers();
