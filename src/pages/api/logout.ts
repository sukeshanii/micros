import type { APIRoute } from 'astro';
import { destroySession } from '../../lib/auth';

export const POST: APIRoute = async ({ cookies }) => {
  await destroySession(cookies);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};
