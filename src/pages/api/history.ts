import type { APIRoute } from 'astro';
import { getSessionUserId } from '../../lib/auth';
import { getHistory, getProfile, getGuestSession } from '../../lib/db';

export const GET: APIRoute = async ({ cookies, url }) => {
  const guestToken = url.searchParams.get('guest_token');
  const days = parseInt(url.searchParams.get('days') || '7');
  let userId = await getSessionUserId(cookies);

  if (!userId && !guestToken) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const summaries = await getHistory(userId || undefined, guestToken || undefined, days);

    let targets = { calories: 2000, protein: 100, carbs: 250, fat: 65 };
    if (userId) {
      const prof = await getProfile(userId);
      if (prof) {
        targets = { calories: prof.daily_calories, protein: prof.daily_protein, carbs: prof.daily_carbs, fat: prof.daily_fat };
      }
    } else if (guestToken) {
      const gs = await getGuestSession(guestToken);
      if (gs) {
        targets = { calories: gs.daily_calories, protein: gs.daily_protein, carbs: gs.daily_carbs, fat: gs.daily_fat };
      }
    }

    return new Response(JSON.stringify({
      targets,
      summaries: summaries.map((s: any) => ({
        date: s.meal_date,
        calories: Number(s.total_calories) || 0,
        protein: Number(s.total_protein) || 0,
        carbs: Number(s.total_carbs) || 0,
        fat: Number(s.total_fat) || 0,
        fiber: Number(s.total_fiber) || 0,
        meals: Number(s.meal_count) || 0,
      })),
    }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
