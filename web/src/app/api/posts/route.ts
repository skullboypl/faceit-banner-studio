import { feedback } from '@/server/feedback-routes';

export const dynamic = 'force-dynamic';
export const GET = feedback.listPosts;
export const POST = feedback.createPost;
