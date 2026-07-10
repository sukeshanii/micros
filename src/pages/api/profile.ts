import type { APIRoute } from 'astro';
import { getSessionUserId } from '../../lib/auth';
import { getProfile, upsertProfile, getPool } from '../../lib/db';
import { calcDailyTargets } from '../../lib/nutrition';

export const GET: APIRoute = async ({ cookies }) => {
  const userId = await getSessionUserId(cookies);
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Not logged in' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const profile = await getProfile(userId);
  const db = await getPool();
  const [userRows] = await db.execute('SELECT email FROM users WHERE id = ?', [userId]);
  const email = userRows.length > 0 ? userRows[0].email : '';

  return new Response(JSON.stringify({
    email,
    profile: profile ? {
      name: profile.name || '',
      age: profile.age || '',
      sex: profile.sex || '',
      height: profile.height || '',
      weight: profile.weight || '',
      targetWeight: profile.target_weight || '',
      goal: profile.goal || 'maintain',
      activity: profile.activity || 'moderate',
      diet: profile.diet || 'none',
      allergies: profile.allergies || '',
      startWeight: profile.start_weight || '',
      mealsPerDay: profile.meals_per_day || 3,
      dailyCalories: profile.daily_calories || 2000,
      dailyProtein: profile.daily_protein || 100,
      dailyCarbs: profile.daily_carbs || 250,
      dailyFat: profile.daily_fat || 65,
    } : null,
  }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};

export const PUT: APIRoute = async ({ request, cookies }) => {
  const userId = await getSessionUserId(cookies);
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Not logged in' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();

    let targets = {};
    if (body.age && body.weight && body.height && body.sex) {
      targets = calcDailyTargets({
        weight: Number(body.weight),
        height: Number(body.height),
        age: Number(body.age),
        sex: body.sex,
        activity: body.activity || 'moderate',
        goal: body.goal || 'maintain',
        mealsPerDay: Number(body.mealsPerDay) || 3,
      });
    }

    const enriched = { ...body, ...targets };
    await upsertProfile(userId, enriched);

    return new Response(JSON.stringify({ ok: true, calculated: targets }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
