import type { APIRoute } from 'astro';
import { createUser, createSession, findUserByEmail } from '../../lib/auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const email = body.email?.trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: 'Valid email required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    let user = await findUserByEmail(email);
    if (!user) {
      user = await createUser(email);
    }

    await createSession(user.id, cookies);

    return new Response(JSON.stringify({ ok: true, email: user.email }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
