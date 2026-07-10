import type { APIRoute } from 'astro';
import { getSessionUserId } from '../../lib/auth';
import { getProfile, getGuestSession } from '../../lib/db';
import { perMealTargets } from '../../lib/nutrition';

export const GET: APIRoute = async ({ cookies, url }) => {
  const guestToken = url.searchParams.get('guest_token');
  const mealNumber = parseInt(url.searchParams.get('meal') || '0');
  let userId = await getSessionUserId(cookies);

  if (!userId && !guestToken) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
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

    return new Response(JSON.stringify({
      daily: targets,
      mealsPerDay,
      perMeal,
      currentMeal: mealNumber,
      currentMealTarget: {
        calories: perMeal.calories,
        protein: perMeal.protein,
        carbs: perMeal.carbs,
        fat: perMeal.fat,
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
