import type { APIRoute } from 'astro';
import { createGuestSession } from '../../lib/db';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const mealsPerDay = body.mealsPerDay || 3;
    const goal = body.goal || 'maintain';
    const dailyCalories = body.dailyCalories || 2000;
    const dailyProtein = body.dailyProtein || 100;
    const dailyCarbs = body.dailyCarbs || 250;
    const dailyFat = body.dailyFat || 65;

    const array = new Uint8Array(24);
    crypto.getRandomValues(array);
    const token = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
    await createGuestSession(token, { mealsPerDay, goal, dailyCalories, dailyProtein, dailyCarbs, dailyFat });

    return new Response(JSON.stringify({ ok: true, token, mealsPerDay, goal, dailyCalories, dailyProtein, dailyCarbs, dailyFat }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
