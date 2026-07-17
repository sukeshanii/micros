import type { APIRoute } from 'astro';
import { getSessionUserId } from '../../lib/auth';
import { insertMeal, getMeals, getGuestSession, getProfile, getDailySummary } from '../../lib/db';
import { perMealTargets } from '../../lib/nutrition';

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

    const mealDate = body.mealDate || new Date().toISOString().slice(0, 10);

    await insertMeal({
      userId: userId || undefined,
      guestToken: guestToken || undefined,
      mealDate,
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

    let targets = { calories: 2000, protein: 100, carbs: 250, fat: 65 };
    let mealsPerDay = 3;

    if (userId) {
      const prof = await getProfile(userId);
      if (prof) {
        targets = { calories: prof.daily_calories, protein: prof.daily_protein, carbs: prof.daily_carbs, fat: prof.daily_fat };
        mealsPerDay = prof.meals_per_day;
      }
    } else if (guestToken) {
      const gs = await getGuestSession(guestToken);
      if (gs) {
        targets = { calories: gs.daily_calories, protein: gs.daily_protein, carbs: gs.daily_carbs, fat: gs.daily_fat };
        mealsPerDay = gs.meals_per_day;
      }
    }

    const perMeal = perMealTargets(targets.calories, targets.protein, targets.carbs, targets.fat, mealsPerDay);

    const summary = await getDailySummary(userId || undefined, guestToken || undefined, mealDate);
    const consumed = summary ? {
      calories: Number(summary.total_calories) || 0,
      protein: Number(summary.total_protein) || 0,
      carbs: Number(summary.total_carbs) || 0,
      fat: Number(summary.total_fat) || 0,
      fiber: Number(summary.total_fiber) || 0,
      meals: Number(summary.meal_count) || 0,
    } : { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, meals: 0 };

    const remaining = {
      calories: Math.max(0, targets.calories - consumed.calories),
      protein: Math.max(0, targets.protein - consumed.protein),
      carbs: Math.max(0, targets.carbs - consumed.carbs),
      fat: Math.max(0, targets.fat - consumed.fat),
    };

    return new Response(JSON.stringify({
      ok: true,
      date: mealDate,
      targets,
      perMeal,
      mealsPerDay,
      consumed,
      remaining,
      progress: {
        calories: targets.calories ? Math.min(100, Math.round(consumed.calories / targets.calories * 100)) : 0,
        protein: targets.protein ? Math.min(100, Math.round(consumed.protein / targets.protein * 100)) : 0,
        carbs: targets.carbs ? Math.min(100, Math.round(consumed.carbs / targets.carbs * 100)) : 0,
        fat: targets.fat ? Math.min(100, Math.round(consumed.fat / targets.fat * 100)) : 0,
      },
    }), {
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
