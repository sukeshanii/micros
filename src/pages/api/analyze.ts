import type { APIRoute } from 'astro';
import { getSessionUserId } from '../../lib/auth';
import { getProfile, getGuestSession, getDailySummary } from '../../lib/db';
import { perMealTargets } from '../../lib/nutrition';

const DISH_DB: Record<string, { calPer100: number; proteinPer100: number; carbsPer100: number; fatPer100: number; fiberPer100: number; ingredients: string[] }> = {
  'chicken biryani': { calPer100: 150, proteinPer100: 8, carbsPer100: 18, fatPer100: 5, fiberPer100: 0.6, ingredients: ['Basmati Rice', 'Chicken', 'Onion', 'Yogurt', 'Ghee', 'Saffron', 'Bay Leaf', 'Cardamom', 'Cinnamon', 'Cloves', 'Mint', 'Coriander', 'Ginger', 'Garlic', 'Green Chilli', 'Salt'] },
  'biryani': { calPer100: 145, proteinPer100: 7, carbsPer100: 18, fatPer100: 5, fiberPer100: 0.5, ingredients: ['Basmati Rice', 'Meat/Vegetables', 'Onion', 'Yogurt', 'Ghee', 'Saffron', 'Bay Leaf', 'Cardamom', 'Cinnamon', 'Mint', 'Coriander', 'Ginger', 'Garlic', 'Salt'] },
  'butter chicken': { calPer100: 148, proteinPer100: 12, carbsPer100: 6, fatPer100: 9, fiberPer100: 0.8, ingredients: ['Chicken', 'Butter', 'Cream', 'Tomato', 'Onion', 'Ginger', 'Garlic', 'Kashmiri Chilli', 'Garam Masala', 'Fenugreek Leaves', 'Cumin', 'Coriander', 'Salt', 'Oil'] },
  'pizza': { calPer100: 270, proteinPer100: 11, carbsPer100: 33, fatPer100: 10, fiberPer100: 2, ingredients: ['Pizza Dough', 'Mozzarella', 'Tomato Sauce', 'Olive Oil', 'Basil', 'Oregano', 'Garlic', 'Parmesan', 'Salt'] },
  'pasta': { calPer100: 160, proteinPer100: 6, carbsPer100: 28, fatPer100: 3, fiberPer100: 2, ingredients: ['Pasta', 'Tomato Sauce', 'Olive Oil', 'Garlic', 'Onion', 'Basil', 'Parmesan', 'Black Pepper', 'Salt'] },
  'burger': { calPer100: 250, proteinPer100: 14, carbsPer100: 22, fatPer100: 12, fiberPer100: 1.2, ingredients: ['Beef Patty', 'Burger Bun', 'Lettuce', 'Tomato', 'Onion', 'Pickles', 'Cheese', 'Ketchup', 'Mustard', 'Mayonnaise'] },
  'salad': { calPer100: 60, proteinPer100: 2, carbsPer100: 6, fatPer100: 3, fiberPer100: 2, ingredients: ['Lettuce', 'Tomato', 'Cucumber', 'Bell Pepper', 'Onion', 'Olive Oil', 'Lemon Juice', 'Feta Cheese', 'Olives', 'Salt', 'Pepper'] },
  'rice': { calPer100: 130, proteinPer100: 2.7, carbsPer100: 28, fatPer100: 0.3, fiberPer100: 0.4, ingredients: ['Rice', 'Water', 'Salt', 'Oil'] },
  'chicken': { calPer100: 190, proteinPer100: 25, carbsPer100: 0, fatPer100: 10, fiberPer100: 0, ingredients: ['Chicken', 'Oil', 'Salt', 'Black Pepper', 'Garlic', 'Herbs'] },
  'fish': { calPer100: 130, proteinPer100: 22, carbsPer100: 0, fatPer100: 5, fiberPer100: 0, ingredients: ['Fish Fillet', 'Lemon Juice', 'Olive Oil', 'Garlic', 'Dill', 'Salt', 'Black Pepper'] },
  'egg': { calPer100: 155, proteinPer100: 13, carbsPer100: 1, fatPer100: 11, fiberPer100: 0, ingredients: ['Eggs', 'Salt', 'Black Pepper', 'Butter'] },
  'dosa': { calPer100: 120, proteinPer100: 3, carbsPer100: 22, fatPer100: 2, fiberPer100: 0.5, ingredients: ['Rice Batter', 'Urad Dal Batter', 'Oil', 'Fenugreek Seeds', 'Salt'] },
  'idli': { calPer100: 80, proteinPer100: 2.5, carbsPer100: 15, fatPer100: 0.4, fiberPer100: 0.6, ingredients: ['Rice Batter', 'Urad Dal Batter', 'Fenugreek Seeds', 'Salt'] },
  'dal': { calPer100: 90, proteinPer100: 6, carbsPer100: 12, fatPer100: 2, fiberPer100: 3, ingredients: ['Lentils', 'Onion', 'Tomato', 'Ginger', 'Garlic', 'Cumin', 'Turmeric', 'Red Chilli', 'Coriander Leaves', 'Ghee', 'Salt', 'Water'] },
  'roti': { calPer100: 260, proteinPer100: 8, carbsPer100: 50, fatPer100: 3, fiberPer100: 4, ingredients: ['Whole Wheat Flour', 'Water', 'Salt', 'Ghee'] },
  'naan': { calPer100: 290, proteinPer100: 9, carbsPer100: 50, fatPer100: 5, fiberPer100: 2, ingredients: ['All-Purpose Flour', 'Yogurt', 'Yeast', 'Sugar', 'Baking Soda', 'Butter', 'Salt', 'Water'] },
  'samosa': { calPer100: 245, proteinPer100: 4, carbsPer100: 30, fatPer100: 12, fiberPer100: 2, ingredients: ['All-Purpose Flour', 'Potato', 'Peas', 'Cumin', 'Coriander', 'Garam Masala', 'Green Chilli', 'Ginger', 'Oil', 'Salt', 'Amchur'] },
  'sushi': { calPer100: 140, proteinPer100: 6, carbsPer100: 22, fatPer100: 3, fiberPer100: 0.8, ingredients: ['Sushi Rice', 'Nori Seaweed', 'Raw Fish', 'Rice Vinegar', 'Wasabi', 'Soy Sauce', 'Ginger', 'Sesame Seeds', 'Avocado'] },
  'sandwich': { calPer100: 210, proteinPer100: 8, carbsPer100: 25, fatPer100: 9, fiberPer100: 1.5, ingredients: ['Bread', 'Lettuce', 'Tomato', 'Cheese', 'Mayonnaise', 'Cucumber', 'Onion', 'Butter', 'Salt', 'Pepper'] },
  'soup': { calPer100: 40, proteinPer100: 2, carbsPer100: 6, fatPer100: 1, fiberPer100: 1.5, ingredients: ['Mixed Vegetables', 'Broth', 'Onion', 'Garlic', 'Celery', 'Carrot', 'Herbs', 'Olive Oil', 'Salt', 'Pepper'] },
  'steak': { calPer100: 250, proteinPer100: 26, carbsPer100: 0, fatPer100: 16, fiberPer100: 0, ingredients: ['Beef Steak', 'Butter', 'Garlic', 'Rosemary', 'Thyme', 'Black Pepper', 'Salt', 'Olive Oil'] },
  'pancakes': { calPer100: 230, proteinPer100: 6, carbsPer100: 35, fatPer100: 8, fiberPer100: 0.8, ingredients: ['All-Purpose Flour', 'Eggs', 'Milk', 'Butter', 'Sugar', 'Baking Powder', 'Vanilla Extract', 'Salt', 'Maple Syrup'] },
  'omelette': { calPer100: 150, proteinPer100: 11, carbsPer100: 1, fatPer100: 12, fiberPer100: 0.3, ingredients: ['Eggs', 'Butter', 'Salt', 'Black Pepper', 'Onion', 'Bell Pepper', 'Cheese', 'Mushrooms', 'Herbs'] },
  'smoothie': { calPer100: 65, proteinPer100: 2, carbsPer100: 12, fatPer100: 1, fiberPer100: 1.5, ingredients: ['Banana', 'Mixed Berries', 'Yogurt', 'Milk', 'Honey', 'Chia Seeds', 'Spinach'] },
  'fried rice': { calPer100: 160, proteinPer100: 5, carbsPer100: 24, fatPer100: 5, fiberPer100: 1, ingredients: ['Rice', 'Egg', 'Soy Sauce', 'Sesame Oil', 'Garlic', 'Ginger', 'Spring Onion', 'Carrot', 'Peas', 'Oil', 'White Pepper', 'Salt'] },
};

const DEFAULT_DISH = { calPer100: 150, proteinPer100: 8, carbsPer100: 20, fatPer100: 5, fiberPer100: 1.5, ingredients: ['Mixed Ingredients', 'Vegetables', 'Oil', 'Salt', 'Spices', 'Herbs'] };

function matchDish(dishName: string) {
  if (!dishName) return DEFAULT_DISH;
  const lower = dishName.toLowerCase().trim();
  if (DISH_DB[lower]) return DISH_DB[lower];

  const keys = Object.keys(DISH_DB);
  const words = lower.split(/\s+/).filter((w: string) => w.length >= 2);
  let bestScore = 0;
  let bestKey = '';

  for (const key of keys) {
    let score = 0;
    for (const w of words) {
      if (key.includes(w)) score += 10;
      if (key === w) score += 15;
    }
    if (key.includes(lower)) score += 8;
    if (score > bestScore) { bestScore = score; bestKey = key; }
  }

  return bestScore >= 10 && bestKey ? DISH_DB[bestKey] : DEFAULT_DISH;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    let dishName = '';
    let weight = 350;
    let guestToken = '';

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      dishName = (formData.get('dishName') as string) || '';
      weight = parseInt(formData.get('weight') as string) || 350;
      guestToken = (formData.get('guestToken') as string) || '';
    } else {
      const body = await request.json();
      dishName = body.dishName || '';
      weight = body.weight || 350;
      guestToken = body.guestToken || '';
    }

    const dish = matchDish(dishName);
    const s = weight / 100;
    const calories = Math.round(dish.calPer100 * s);
    const protein = Math.round(dish.proteinPer100 * s);
    const carbs = Math.round(dish.carbsPer100 * s);
    const fat = Math.round(dish.fatPer100 * s);
    const fiber = Math.round(dish.fiberPer100 * s);

    let targets = { calories: 2000, protein: 100, carbs: 250, fat: 65 };
    let mealsPerDay = 3;
    let userId: number | null = null;
    let hasProfile = false;

    userId = await getSessionUserId(cookies);

    if (userId) {
      const prof = await getProfile(userId);
      if (prof) {
        targets = { calories: prof.daily_calories, protein: prof.daily_protein, carbs: prof.daily_carbs, fat: prof.daily_fat };
        mealsPerDay = prof.meals_per_day;
        hasProfile = true;
      }
    } else if (guestToken) {
      const gs = await getGuestSession(guestToken);
      if (gs) {
        targets = { calories: gs.daily_calories, protein: gs.daily_protein, carbs: gs.daily_carbs, fat: gs.daily_fat };
        mealsPerDay = gs.meals_per_day;
      }
    }

    const perMeal = perMealTargets(targets.calories, targets.protein, targets.carbs, targets.fat, mealsPerDay);

    const today = new Date().toISOString().slice(0, 10);
    let consumed = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, meals: 0 };
    try {
      const summary = await getDailySummary(userId || undefined, guestToken || undefined, today);
      if (summary) {
        consumed = {
          calories: Number(summary.total_calories) || 0,
          protein: Number(summary.total_protein) || 0,
          carbs: Number(summary.total_carbs) || 0,
          fat: Number(summary.total_fat) || 0,
          fiber: Number(summary.total_fiber) || 0,
          meals: Number(summary.meal_count) || 0,
        };
      }
    } catch {}

    const remaining = {
      calories: Math.max(0, targets.calories - consumed.calories),
      protein: Math.max(0, targets.protein - consumed.protein),
      carbs: Math.max(0, targets.carbs - consumed.carbs),
      fat: Math.max(0, targets.fat - consumed.fat),
    };

    const progress = {
      calories: targets.calories ? Math.min(100, Math.round((consumed.calories + calories) / targets.calories * 100)) : 0,
      protein: targets.protein ? Math.min(100, Math.round((consumed.protein + protein) / targets.protein * 100)) : 0,
      carbs: targets.carbs ? Math.min(100, Math.round((consumed.carbs + carbs) / targets.carbs * 100)) : 0,
      fat: targets.fat ? Math.min(100, Math.round((consumed.fat + fat) / targets.fat * 100)) : 0,
    };

    const suggestions: string[] = [];
    const calPct = Math.round((calories - perMeal.calories) / perMeal.calories * 100);
    const proPct = Math.round((protein - perMeal.protein) / perMeal.protein * 100);
    const carbPct = Math.round((carbs - perMeal.carbs) / perMeal.carbs * 100);
    const fatPct = Math.round((fat - perMeal.fat) / perMeal.fat * 100);

    const calDir = calPct > 0 ? 'above' : calPct < 0 ? 'below' : 'at';
    const proDir = proPct > 0 ? 'above' : proPct < 0 ? 'below' : 'at';
    const carbDir = carbPct > 0 ? 'above' : carbPct < 0 ? 'below' : 'at';
    const fatDir = fatPct > 0 ? 'above' : fatPct < 0 ? 'below' : 'at';

    const intro = hasProfile
      ? `Based on your profile, your target is ${perMeal.calories} kcal, ${perMeal.protein}g protein, ${perMeal.carbs}g carbs, and ${perMeal.fat}g fat per meal.`
      : `Your target is ${perMeal.calories} kcal, ${perMeal.protein}g protein, ${perMeal.carbs}g carbs, and ${perMeal.fat}g fat per meal.`;
    suggestions.push(
      `${intro} ` +
      `This meal provides ${calories} kcal and ${protein}g protein. ` +
      `Calories are ${calDir} target by ${Math.abs(calPct)}% while protein is ${proDir} target by ${Math.abs(proPct)}%.`
    );

    if (calPct > 15) suggestions.push('Calories are significantly above your per-meal target. Consider reducing portion size or choosing lighter ingredients.');
    if (proPct < -15) suggestions.push('Protein is well below your per-meal target. Add a lean protein source like chicken, tofu, or lentils.');
    if (proPct > 20) suggestions.push('Great protein intake! This helps with satiety and muscle maintenance.');
    if (carbPct > 20) suggestions.push('Carbs are above your target. Consider swapping refined carbs for whole grains or vegetables.');
    if (fatPct > 20) suggestions.push('Fat is above your target. Try reducing oil, butter, or creamy sauces.');
    if (fiber < 8) suggestions.push('Include leafy greens or legumes to boost fibre intake.');
    if (suggestions.length < 2) suggestions.push('Overall a balanced meal. Keep up the good habits!');

    const microBase = s / 3.5;
    const micros: Record<string, { val: number; unit: string; ref: number }> = {
      'Vitamin A': { val: Math.round(180 * microBase), unit: 'µg', ref: 800 },
      'Vitamin C': { val: Math.round(12 * microBase), unit: 'mg', ref: 80 },
      'Vitamin D': { val: Math.round(1.2 * microBase * 10) / 10, unit: 'µg', ref: 15 },
      'Vitamin E': { val: Math.round(2.4 * microBase * 10) / 10, unit: 'mg', ref: 12 },
      'Vitamin K': { val: Math.round(18 * microBase), unit: 'µg', ref: 75 },
      'Vitamin B12': { val: Math.round(0.6 * microBase * 10) / 10, unit: 'µg', ref: 2.4 },
      'Folate': { val: Math.round(32 * microBase), unit: 'µg', ref: 200 },
      'Iron': { val: Math.round(3.2 * microBase * 10) / 10, unit: 'mg', ref: 14 },
      'Calcium': { val: Math.round(95 * microBase), unit: 'mg', ref: 800 },
      'Potassium': { val: Math.round(420 * microBase), unit: 'mg', ref: 2000 },
      'Sodium': { val: Math.round(680 * microBase), unit: 'mg', ref: 2300 },
      'Zinc': { val: Math.round(2.1 * microBase * 10) / 10, unit: 'mg', ref: 10 },
      'Magnesium': { val: Math.round(38 * microBase), unit: 'mg', ref: 375 },
    };

    return new Response(JSON.stringify({
      mealName: dishName || 'Mixed meal',
      weight,
      calories,
      macros: { protein, carbs, fat, fiber },
      micros,
      ingredients: dish.ingredients,
      suggestions,
      nextMeals: [],
      perMealTarget: perMeal,
      dailyTarget: targets,
      mealsPerDay,
      consumed,
      remaining,
      progress,
      hasProfile,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Analysis failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
