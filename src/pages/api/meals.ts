import type { APIRoute } from 'astro';
import { getSessionUserId } from '../../lib/auth';
import { insertMeal, getMeals, getGuestSession } from '../../lib/db';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const guestToken = body.guestToken || null;
    let userId = await getSessionUserId(cookies);

    if (!userId && !guestToken) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }

    if (guestToken) {
      const session = await getGuestSession(guestToken);
      if (!session) {
        return new Response(JSON.stringify({ error: 'Invalid guest session' }), {
          status: 400, headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    await insertMeal({
      userId: userId || undefined,
      guestToken: guestToken || undefined,
      mealDate: body.mealDate || new Date().toISOString().slice(0, 10),
      mealNumber: body.mealNumber || 0,
      mealType: body.mealType || '',
      mealName: body.mealName || '',
      weightGrams: body.weightGrams || 0,
      calories: body.calories || 0,
      protein: body.protein || 0,
      carbs: body.carbs || 0,
      fat: body.fat || 0,
      fiber: body.fiber || 0,
      micronutrients: body.micronutrients || null,
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const GET: APIRoute = async ({ request, cookies, url }) => {
  const guestToken = url.searchParams.get('guest_token');
  const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
  let userId = await getSessionUserId(cookies);
  if (!userId && !guestToken) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }
  try {
    const meals = await getMeals(userId || undefined, guestToken || undefined, date);
    return new Response(JSON.stringify(meals), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
