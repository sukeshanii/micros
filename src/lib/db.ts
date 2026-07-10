import mysql from 'mysql2/promise';
import { cacheGet, cacheSet, cacheDel, profileCacheKey, userCacheKey } from './cache';

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '3306');
const DB_USER = process.env.DB_USER || 'micros';
const DB_PASSWORD = process.env.DB_PASSWORD || 'micros_secret';
const DB_NAME = process.env.DB_NAME || 'micros';

let pool: mysql.Pool | null = null;

export async function getPool(): Promise<mysql.Pool> {
  if (!pool) {
    pool = mysql.createPool({
      host: DB_HOST, port: DB_PORT, user: DB_USER,
      password: DB_PASSWORD, database: DB_NAME,
      waitForConnections: true, connectionLimit: 10, queueLimit: 0,
    });
  }
  return pool;
}

// ── Users ─────────────────────────────────────────────────────────────────

export async function findUserByEmail(email: string): Promise<{ id: number; email: string } | null> {
  const cleanEmail = email.toLowerCase().trim();
  const cached = await cacheGet<{ id: number; email: string }>(userCacheKey(cleanEmail));
  if (cached) return cached;
  const db = await getPool();
  const [rows] = await db.execute<mysql.RowDataPacket[]>('SELECT id, email FROM users WHERE email = ?', [cleanEmail]);
  if (rows.length > 0) {
    const user = { id: rows[0].id as number, email: rows[0].email as string };
    await cacheSet(userCacheKey(cleanEmail), user);
    return user;
  }
  return null;
}

export async function createUser(email: string): Promise<{ id: number; email: string }> {
  const db = await getPool();
  const cleanEmail = email.toLowerCase().trim();
  await db.execute('INSERT INTO users (email) VALUES (?)', [cleanEmail]);
  const [rows] = await db.execute<mysql.RowDataPacket[]>('SELECT id FROM users WHERE email = ?', [cleanEmail]);
  const user = { id: rows[0].id as number, email: cleanEmail };
  await cacheSet(userCacheKey(cleanEmail), user);
  return user;
}

// ── Profiles ──────────────────────────────────────────────────────────────

export interface ProfileRow {
  name: string; age: number; sex: string; height: number; weight: number;
  target_weight: number | null; goal: string; activity: string; diet: string;
  allergies: string; start_weight: number | null;
  meals_per_day: number;
  daily_calories: number; daily_protein: number; daily_carbs: number; daily_fat: number;
}

export async function getProfile(userId: number): Promise<ProfileRow | null> {
  const cached = await cacheGet<ProfileRow>(profileCacheKey(userId));
  if (cached) return cached;
  const db = await getPool();
  const [rows] = await db.execute<mysql.RowDataPacket[]>('SELECT * FROM profiles WHERE user_id = ?', [userId]);
  if (rows.length > 0) {
    const p = rows[0] as unknown as ProfileRow;
    await cacheSet(profileCacheKey(userId), p);
    return p;
  }
  return null;
}

export async function upsertProfile(userId: number, data: any): Promise<void> {
  const db = await getPool();
  const [existing] = await db.execute<mysql.RowDataPacket[]>('SELECT id FROM profiles WHERE user_id = ?', [userId]);
  const cols = `name=?,age=?,sex=?,height=?,weight=?,target_weight=?,goal=?,activity=?,diet=?,allergies=?,start_weight=?,meals_per_day=?,daily_calories=?,daily_protein=?,daily_carbs=?,daily_fat=?`;
  const vals = [
    data.name||'', data.age||25, data.sex||'', data.height||170, data.weight||70,
    data.targetWeight||null, data.goal||'maintain', data.activity||'moderate', data.diet||'none',
    data.allergies||'', data.startWeight||null,
    data.mealsPerDay||3, data.dailyCalories||2000, data.dailyProtein||100, data.dailyCarbs||250, data.dailyFat||65,
  ];
  if (existing.length > 0) {
    await db.execute(`UPDATE profiles SET ${cols} WHERE user_id = ?`, [...vals, userId]);
  } else {
    const colNames = cols.replace(/=\?/g, '');
    const insCols = `user_id,${colNames}`;
    await db.execute(`INSERT INTO profiles (${insCols}) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [userId, ...vals]);
  }
  await cacheDel(profileCacheKey(userId));
  const updated = await getProfile(userId);
  if (updated) await cacheSet(profileCacheKey(userId), updated);
}

// ── Sessions ──────────────────────────────────────────────────────────────

export async function createSession(token: string, userId: number): Promise<void> {
  const db = await getPool();
  await db.execute('INSERT INTO sessions (id, user_id) VALUES (?, ?)', [token, userId]);
}

export async function deleteSession(token: string): Promise<void> {
  const db = await getPool();
  await db.execute('DELETE FROM sessions WHERE id = ?', [token]);
}

export async function getSessionUserId(token: string): Promise<number | null> {
  const db = await getPool();
  const [rows] = await db.execute<mysql.RowDataPacket[]>('SELECT user_id FROM sessions WHERE id = ?', [token]);
  return rows.length > 0 ? (rows[0].user_id as number) : null;
}

// ── Guest Sessions ────────────────────────────────────────────────────────

export async function createGuestSession(token: string, data: { mealsPerDay: number; goal: string; dailyCalories: number; dailyProtein: number; dailyCarbs: number; dailyFat: number }): Promise<void> {
  const db = await getPool();
  await db.execute(
    'INSERT INTO guest_sessions (token, meals_per_day, goal, daily_calories, daily_protein, daily_carbs, daily_fat) VALUES (?,?,?,?,?,?,?)',
    [token, data.mealsPerDay, data.goal, data.dailyCalories, data.dailyProtein, data.dailyCarbs, data.dailyFat]
  );
}

export async function getGuestSession(token: string): Promise<any | null> {
  const db = await getPool();
  const [rows] = await db.execute<mysql.RowDataPacket[]>('SELECT * FROM guest_sessions WHERE token = ?', [token]);
  return rows.length > 0 ? rows[0] : null;
}

// ── Meal Entries ──────────────────────────────────────────────────────────

export async function insertMeal(meal: {
  userId?: number; guestToken?: string;
  mealDate: string; mealNumber: number; mealType: string; mealName: string;
  weightGrams: number; calories: number; protein: number; carbs: number; fat: number; fiber: number;
  micronutrients?: any;
}): Promise<void> {
  const db = await getPool();
  await db.execute(
    `INSERT INTO meal_entries (user_id, guest_token, meal_date, meal_number, meal_type, meal_name, weight_grams, calories, protein, carbs, fat, fiber, micronutrients)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [meal.userId || null, meal.guestToken || null, meal.mealDate, meal.mealNumber, meal.mealType, meal.mealName,
     meal.weightGrams, meal.calories, meal.protein, meal.carbs, meal.fat, meal.fiber,
     meal.micronutrients ? JSON.stringify(meal.micronutrients) : null]
  );
  await refreshDailySummary(meal.userId, meal.guestToken, meal.mealDate);
}

export async function getMeals(userId?: number, guestToken?: string, date?: string): Promise<any[]> {
  const db = await getPool();
  let sql = 'SELECT * FROM meal_entries WHERE ';
  const params: any[] = [];
  if (userId) { sql += 'user_id = ?'; params.push(userId); }
  else if (guestToken) { sql += 'guest_token = ?'; params.push(guestToken); }
  else return [];
  if (date) { sql += ' AND meal_date = ?'; params.push(date); }
  sql += ' ORDER BY meal_number ASC, created_at ASC';
  const [rows] = await db.execute<mysql.RowDataPacket[]>(sql, params);
  return rows;
}

// ── Daily Summaries ───────────────────────────────────────────────────────

async function refreshDailySummary(userId?: number, guestToken?: string, date?: string) {
  const db = await getPool();
  if (!date) date = new Date().toISOString().slice(0, 10);
  let idCol: string, idVal: any;
  if (userId) { idCol = 'user_id'; idVal = userId; }
  else if (guestToken) { idCol = 'guest_token'; idVal = guestToken; }
  else return;

  const [meals] = await db.execute<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) as cnt, SUM(calories) as cal, SUM(protein) as pro, SUM(carbs) as carb, SUM(fat) as f, SUM(fiber) as fib
     FROM meal_entries WHERE ${idCol} = ? AND meal_date = ?`, [idVal, date]
  );
  const row = meals[0];
  const totalCalories = row.cal || 0;
  const totalProtein = row.pro || 0;
  const totalCarbs = row.carb || 0;
  const totalFat = row.f || 0;
  const totalFiber = row.fib || 0;
  const mealCount = row.cnt || 0;

  await db.execute(
    `INSERT INTO daily_summaries (${idCol}, meal_date, total_calories, total_protein, total_carbs, total_fat, total_fiber, meal_count)
     VALUES (?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE total_calories=VALUES(total_calories), total_protein=VALUES(total_protein),
       total_carbs=VALUES(total_carbs), total_fat=VALUES(total_fat), total_fiber=VALUES(total_fiber),
       meal_count=VALUES(meal_count), updated_at=CURRENT_TIMESTAMP`,
    [idVal, date, totalCalories, totalProtein, totalCarbs, totalFat, totalFiber, mealCount]
  );
}

export async function getDailySummary(userId?: number, guestToken?: string, date?: string): Promise<any | null> {
  const db = await getPool();
  if (!date) date = new Date().toISOString().slice(0, 10);
  let idCol: string, idVal: any;
  if (userId) { idCol = 'user_id'; idVal = userId; }
  else if (guestToken) { idCol = 'guest_token'; idVal = guestToken; }
  else return null;
  const [rows] = await db.execute<mysql.RowDataPacket[]>(
    `SELECT * FROM daily_summaries WHERE ${idCol} = ? AND meal_date = ?`, [idVal, date]
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function getHistory(userId?: number, guestToken?: string, days: number = 7): Promise<any[]> {
  const db = await getPool();
  let idCol: string, idVal: any;
  if (userId) { idCol = 'user_id'; idVal = userId; }
  else if (guestToken) { idCol = 'guest_token'; idVal = guestToken; }
  else return [];
  const [rows] = await db.execute<mysql.RowDataPacket[]>(
    `SELECT * FROM daily_summaries WHERE ${idCol} = ? AND meal_date >= CURDATE() - INTERVAL ? DAY ORDER BY meal_date DESC`,
    [idVal, days]
  );
  return rows;
}

// ── Contact ───────────────────────────────────────────────────────────────

export async function createContact(name: string, email: string, message: string): Promise<void> {
  const db = await getPool();
  await db.execute('INSERT INTO contacts (name, email, message) VALUES (?, ?, ?)', [name, email, message]);
}
