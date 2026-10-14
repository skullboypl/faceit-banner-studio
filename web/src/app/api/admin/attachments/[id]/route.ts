import { feedback } from '@/server/feedback-routes';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

export const DELETE = (request: Request, ctx: Ctx) => feedback.adminDeleteAttachment(request, ctx);
