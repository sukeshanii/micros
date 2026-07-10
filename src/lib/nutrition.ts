export function calculateBMR(weight: number, height: number, age: number, sex: string): number {
  if (sex === 'male') return 10 * weight + 6.25 * height - 5 * age + 5;
  return 10 * weight + 6.25 * height - 5 * age - 161;
}

export function activityMultiplier(activity: string): number {
  switch (activity) {
    case 'sedentary': return 1.2;
    case 'light': return 1.375;
    case 'moderate': return 1.55;
    case 'active': return 1.725;
    case 'very_active': return 1.9;
    default: return 1.55;
  }
}

export function goalAdjustment(goal: string, tdee: number): number {
  switch (goal) {
    case 'lose': return tdee - 500;
    case 'gain': return tdee + 300;
    case 'maintain': return tdee;
    default: return tdee;
  }
}

export function calcDailyTargets(profile: {
  weight: number; height: number; age: number; sex: string;
  activity: string; goal: string; mealsPerDay?: number;
}): { calories: number; protein: number; carbs: number; fat: number } {
  const bmr = calculateBMR(profile.weight, profile.height, profile.age, profile.sex);
  const tdee = bmr * activityMultiplier(profile.activity);
  const calories = Math.round(goalAdjustment(profile.goal, tdee));
  const proteinG = Math.round(profile.weight * 1.8);
  const protein = proteinG * 4;
  const fat = Math.round((calories * 0.25) / 9);
  const fatCal = fat * 9;
  const carbs = Math.round((calories - protein - fatCal) / 4);
  return { calories, protein: Math.round(protein / 4), carbs, fat };
}

export function perMealTargets(dailyCalories: number, dailyProtein: number, dailyCarbs: number, dailyFat: number, mealsPerDay: number) {
  if (mealsPerDay <= 0) mealsPerDay = 3;
  return {
    calories: Math.round(dailyCalories / mealsPerDay),
    protein: Math.round(dailyProtein / mealsPerDay),
    carbs: Math.round(dailyCarbs / mealsPerDay),
    fat: Math.round(dailyFat / mealsPerDay),
  };
}
