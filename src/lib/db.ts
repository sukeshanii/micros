import { cacheGet, cacheSet, cacheDel, profileCacheKey, userCacheKey } from './cache';
import { getCloudflareEnv } from './get-env';

var mysql: any = null;

async function getMySQL() {
  if (!mysql) {
    try { mysql = await import('mysql2/promise'); } catch {}
  }
  return mysql;
}

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '3306');
const DB_USER = process.env.DB_USER || 'micros';
const DB_PASSWORD = process.env.DB_PASSWORD || 'micros_secret';
const DB_NAME = process.env.DB_NAME || 'micros';

let pool: any = null;

async function getPool(): Promise<any> {
  if (!pool) {
    const m = await getMySQL();
    if (!m) return null;
    pool = m.createPool({
      host: DB_HOST, port: DB_PORT, user: DB_USER,
      password: DB_PASSWORD, database: DB_NAME,
      waitForConnections: true, connectionLimit: 10, queueLimit: 0,
    });
  }
  return pool;
}

function isD1(env: any): boolean {
  return env && env.DB && typeof env.DB.prepare === 'function';
}

async function getD1() {
  const env = await getCloudflareEnv();
  return isD1(env) ? env.DB : null;
}

async function getCachelessD1() {
  const env = await getCloudflareEnv();
  return isD1(env) ? env : null;
}

// ── Users ──

export async function findUserByEmail(email: string): Promise<{ id: number; email: string } | null> {
  const cleanEmail = email.toLowerCase().trim();
  const env = await getCloudflareEnv();
  const cached = await cacheGet(userCacheKey(cleanEmail));
  if (cached) return cached;

  if (isD1(env)) {
    const row = await env.DB.prepare('SELECT id, email FROM users WHERE email = ?').bind(cleanEmail).first();
    if (row) {
      const user = { id: row.id as number, email: row.email as string };
      await cacheSet(userCacheKey(cleanEmail), user);
      return user;
    }
    return null;
  }

  const db = await getPool();
  if (!db) return null;
  const [rows] = await db.execute('SELECT id, email FROM users WHERE email = ?', [cleanEmail]);
  if (rows.length > 0) {
          const user = { id: rows[0].id as number, email: rows[0].email as string };
    await cacheSet(userCacheKey(cleanEmail), user);
    return user;
  }
  return null;
}

export async function createUser(email: string): Promise<{ id: number; email: string }> {
  const cleanEmail = email.toLowerCase().trim();
  const env = await getCloudflareEnv();

  if (isD1(env)) {
    await env.DB.prepare('INSERT INTO users (email) VALUES (?)').bind(cleanEmail).run();
    const row = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(cleanEmail).first();
    const user = { id: row.id as number, email: cleanEmail };
    await cacheSet(userCacheKey(cleanEmail), user);
    return user;
  }

  const db = await getPool();
  await db.execute('INSERT INTO users (email) VALUES (?)', [cleanEmail]);
  const [rows] = await db.execute('SELECT id FROM users WHERE email = ?', [cleanEmail]);
  const user = { id: rows[0].id as number, email: cleanEmail };
  await cacheSet(userCacheKey(cleanEmail), user);
  return user;
}

export async function getUserEmail(userId: number): Promise<string> {
  const env = await getCloudflareEnv();
  if (isD1(env)) {
    const row = await env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(userId).first();
    return row?.email as string || '';
  }
  const db = await getPool();
  if (!db) return '';
  const [rows] = await db.execute('SELECT email FROM users WHERE id = ?', [userId]);
  return rows.length > 0 ? rows[0].email : '';
}

// ── Profiles ──

export interface ProfileRow {
  name: string; age: number; sex: string; height: number; weight: number;
  target_weight: number | null; goal: string; activity: string; diet: string;
  allergies: string; start_weight: number | null;
  meals_per_day: number;
  daily_calories: number; daily_protein: number; daily_carbs: number; daily_fat: number;
}

export async function getProfile(userId: number): Promise<ProfileRow | null> {
  const env = await getCloudflareEnv();
  const cached = await cacheGet(profileCacheKey(userId));
  if (cached) return cached;

  if (isD1(env)) {
    const row = await env.DB.prepare('SELECT * FROM profiles WHERE user_id = ?').bind(userId).first();
    if (row) {
      const p = row as unknown as ProfileRow;
      await cacheSet(profileCacheKey(userId), p);
      return p;
    }
    return null;
  }

  const db = await getPool();
  if (!db) return null;
  const [rows] = await db.execute('SELECT * FROM profiles WHERE user_id = ?', [userId]);
  if (rows.length > 0) {
    const p = rows[0] as unknown as ProfileRow;
    await cacheSet(profileCacheKey(userId), p);
    return p;
  }
  return null;
}

export async function upsertProfile(userId: number, data: any): Promise<void> {
  const name = data.name||''; const age = data.age||25;
  const sex = data.sex||''; const height = data.height||170; const weight = data.weight||70;
  const targetWeight = data.targetWeight||null; const goal = data.goal||'maintain';
  const activity = data.activity||'moderate'; const diet = data.diet||'none';
  const allergies = data.allergies||''; const startWeight = data.startWeight||null;
  const mealsPerDay = data.mealsPerDay||3; const dailyCalories = data.dailyCalories||2000;
  const dailyProtein = data.dailyProtein||100; const dailyCarbs = data.dailyCarbs||250;
  const dailyFat = data.dailyFat||65;
  const env = await getCloudflareEnv();

  if (isD1(env)) {
    const existing = await env.DB.prepare('SELECT user_id FROM profiles WHERE user_id = ?').bind(userId).first();
    if (existing) {
      await env.DB.prepare(
        `UPDATE profiles SET name=?, age=?, sex=?, height=?, weight=?, target_weight=?, goal=?, activity=?, diet=?, allergies=?, start_weight=?, meals_per_day=?, daily_calories=?, daily_protein=?, daily_carbs=?, daily_fat=? WHERE user_id=?`
      ).bind(name, age, sex, height, weight, targetWeight, goal, activity, diet, allergies, startWeight, mealsPerDay, dailyCalories, dailyProtein, dailyCarbs, dailyFat, userId).run();
    } else {
      await env.DB.prepare(
        `INSERT INTO profiles (user_id, name, age, sex, height, weight, target_weight, goal, activity, diet, allergies, start_weight, meals_per_day, daily_calories, daily_protein, daily_carbs, daily_fat) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(userId, name, age, sex, height, weight, targetWeight, goal, activity, diet, allergies, startWeight, mealsPerDay, dailyCalories, dailyProtein, dailyCarbs, dailyFat).run();
    }
    await cacheDel(profileCacheKey(userId));
    const updated = await getProfile(userId);
    if (updated) await cacheSet(profileCacheKey(userId), updated);
    return;
  }

  const db = await getPool();
  if (!db) throw new Error('Database pool not available');
  const [existing] = await db.execute('SELECT user_id FROM profiles WHERE user_id = ?', [userId]);
  const cols = `name=?,age=?,sex=?,height=?,weight=?,target_weight=?,goal=?,activity=?,diet=?,allergies=?,start_weight=?,meals_per_day=?,daily_calories=?,daily_protein=?,daily_carbs=?,daily_fat=?`;
  const vals = [name, age, sex, height, weight, targetWeight, goal, activity, diet, allergies, startWeight, mealsPerDay, dailyCalories, dailyProtein, dailyCarbs, dailyFat];
  if (existing.length > 0) {
    await db.execute(`UPDATE profiles SET ${cols} WHERE user_id = ?`, [...vals, userId]);
  } else {
    const colNames = cols.replace(/=\?/g, '');
    await db.execute(`INSERT INTO profiles (user_id,${colNames}) VALUES (?,${vals.map(()=>'?').join(',')})`, [userId, ...vals]);
  }
  await cacheDel(profileCacheKey(userId));
  const updated = await getProfile(userId);
  if (updated) await cacheSet(profileCacheKey(userId), updated);
}

// ── Sessions ──

export async function createSession(token: string, userId: number): Promise<boolean> {
  const env = await getCloudflareEnv();
  if (isD1(env)) {
    await env.DB.prepare('INSERT INTO sessions (id, user_id) VALUES (?, ?)').bind(token, userId).run();
    return true;
  }
  const db = await getPool();
  if (!db) return false;
  await db.execute('INSERT INTO sessions (id, user_id) VALUES (?, ?)', [token, userId]);
  return true;
}

export async function deleteSession(token: string): Promise<void> {
  const env = await getCloudflareEnv();
  if (isD1(env)) {
    await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(token).run();
    return;
  }
  const db = await getPool();
  if (!db) return;
  await db.execute('DELETE FROM sessions WHERE id = ?', [token]);
}

export async function getSessionUserId(token: string): Promise<number | null> {
  const env = await getCloudflareEnv();
  if (isD1(env)) {
    const row = await env.DB.prepare('SELECT user_id FROM sessions WHERE id = ?').bind(token).first();
    return row ? (row.user_id as number) : null;
  }
  const db = await getPool();
  if (!db) return null;
  const [rows] = await db.execute('SELECT user_id FROM sessions WHERE id = ?', [token]);
  return rows.length > 0 ? (rows[0].user_id as number) : null;
}

// ── Guest Sessions ──

export async function createGuestSession(token: string, data: { mealsPerDay: number; goal: string; dailyCalories: number; dailyProtein: number; dailyCarbs: number; dailyFat: number }): Promise<void> {
  const env = await getCloudflareEnv();
  if (isD1(env)) {
    await env.DB.prepare(
      'INSERT INTO guest_sessions (token, meals_per_day, goal, daily_calories, daily_protein, daily_carbs, daily_fat) VALUES (?,?,?,?,?,?,?)'
    ).bind(token, data.mealsPerDay, data.goal, data.dailyCalories, data.dailyProtein, data.dailyCarbs, data.dailyFat).run();
    return;
  }
  const db = await getPool();
  if (!db) return;
  await db.execute(
    'INSERT INTO guest_sessions (token, meals_per_day, goal, daily_calories, daily_protein, daily_carbs, daily_fat) VALUES (?,?,?,?,?,?,?)',
    [token, data.mealsPerDay, data.goal, data.dailyCalories, data.dailyProtein, data.dailyCarbs, data.dailyFat]
  );
}

export async function getGuestSession(token: string): Promise<any | null> {
  const env = await getCloudflareEnv();
  if (isD1(env)) {
    const row = await env.DB.prepare('SELECT * FROM guest_sessions WHERE token = ?').bind(token).first();
    return row || null;
  }
  const db = await getPool();
  if (!db) return null;
  const [rows] = await db.execute('SELECT * FROM guest_sessions WHERE token = ?', [token]);
  return rows.length > 0 ? rows[0] : null;
}

// ── Meal Entries ──

export async function insertMeal(meal: {
  userId?: number; guestToken?: string;
  mealDate: string; mealNumber: number; mealType: string; mealName: string;
  weightGrams: number; calories: number; protein: number; carbs: number; fat: number; fiber: number;
  micronutrients?: any;
}): Promise<void> {
  const env = await getCloudflareEnv();
  if (isD1(env)) {
    await env.DB.prepare(
      `INSERT INTO meal_entries (user_id, guest_token, meal_date, meal_number, meal_type, meal_name, weight_grams, calories, protein, carbs, fat, fiber, micronutrients)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      meal.userId || null, meal.guestToken || null, meal.mealDate, meal.mealNumber, meal.mealType, meal.mealName,
      meal.weightGrams, meal.calories, meal.protein, meal.carbs, meal.fat, meal.fiber,
      meal.micronutrients ? JSON.stringify(meal.micronutrients) : null
    ).run();
    await refreshDailySummary(meal.userId, meal.guestToken, meal.mealDate);
    return;
  }

  const db = await getPool();
  if (!db) return;
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
  const env = await getCloudflareEnv();
  if (isD1(env)) {
    let sql = 'SELECT * FROM meal_entries WHERE ';
    const params: any[] = [];
    if (userId) { sql += 'user_id = ?'; params.push(userId); }
    else if (guestToken) { sql += 'guest_token = ?'; params.push(guestToken); }
    else return [];
    if (date) { sql += ' AND meal_date = ?'; params.push(date); }
    sql += ' ORDER BY meal_number ASC, created_at ASC';

    let s = env.DB.prepare(sql);
    if (params.length > 0) s = s.bind(...params);
    const { results } = await s.all();
    return results || [];
  }

  const db = await getPool();
  if (!db) return [];
  let sql = 'SELECT * FROM meal_entries WHERE ';
  const params: any[] = [];
  if (userId) { sql += 'user_id = ?'; params.push(userId); }
  else if (guestToken) { sql += 'guest_token = ?'; params.push(guestToken); }
  else return [];
  if (date) { sql += ' AND meal_date = ?'; params.push(date); }
  sql += ' ORDER BY meal_number ASC, created_at ASC';
  const [rows] = await db.execute(sql, params);
  return rows;
}

// ── Daily Summaries ──

async function refreshDailySummary(userId?: number, guestToken?: string, date?: string) {
  if (!date) date = new Date().toISOString().slice(0, 10);
  let idCol: string, idVal: any;
  if (userId) { idCol = 'user_id'; idVal = userId; }
  else if (guestToken) { idCol = 'guest_token'; idVal = guestToken; }
  else return;

  let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0, totalFiber = 0, mealCount = 0;
  const env = await getCloudflareEnv();

  if (isD1(env)) {
    const row = await env.DB.prepare(
      `SELECT COUNT(*) as cnt, SUM(calories) as cal, SUM(protein) as pro, SUM(carbs) as carb, SUM(fat) as f, SUM(fiber) as fib
       FROM meal_entries WHERE ${idCol} = ? AND meal_date = ?`
    ).bind(idVal, date).first();
    if (row) {
      totalCalories = row.cal || 0;
      totalProtein = row.pro || 0;
      totalCarbs = row.carb || 0;
      totalFat = row.f || 0;
      totalFiber = row.fib || 0;
      mealCount = row.cnt || 0;
    }

    await env.DB.prepare(
      `INSERT INTO daily_summaries (${idCol}, meal_date, total_calories, total_protein, total_carbs, total_fat, total_fiber, meal_count)
       VALUES (?,?,?,?,?,?,?,?)
       ON CONFLICT(${idCol}, meal_date) DO UPDATE SET
         total_calories=excluded.total_calories, total_protein=excluded.total_protein,
         total_carbs=excluded.total_carbs, total_fat=excluded.total_fat,
         total_fiber=excluded.total_fiber, meal_count=excluded.meal_count,
         updated_at=datetime('now')`
    ).bind(idVal, date, totalCalories, totalProtein, totalCarbs, totalFat, totalFiber, mealCount).run();
    return;
  }

  const db = await getPool();
  if (!db) return;
  const [meals] = await db.execute(
    `SELECT COUNT(*) as cnt, SUM(calories) as cal, SUM(protein) as pro, SUM(carbs) as carb, SUM(fat) as f, SUM(fiber) as fib
     FROM meal_entries WHERE ${idCol} = ? AND meal_date = ?`, [idVal, date]
  );
  const row = meals[0];
  totalCalories = row.cal || 0;
  totalProtein = row.pro || 0;
  totalCarbs = row.carb || 0;
  totalFat = row.f || 0;
  totalFiber = row.fib || 0;
  mealCount = row.cnt || 0;

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
  if (!date) date = new Date().toISOString().slice(0, 10);
  let idCol: string, idVal: any;
  if (userId) { idCol = 'user_id'; idVal = userId; }
  else if (guestToken) { idCol = 'guest_token'; idVal = guestToken; }
  else return null;
  const env = await getCloudflareEnv();

  if (isD1(env)) {
    const row = await env.DB.prepare(`SELECT * FROM daily_summaries WHERE ${idCol} = ? AND meal_date = ?`).bind(idVal, date).first();
    return row || null;
  }

  const db = await getPool();
  if (!db) return null;
  const [rows] = await db.execute(`SELECT * FROM daily_summaries WHERE ${idCol} = ? AND meal_date = ?`, [idVal, date]);
  return rows.length > 0 ? rows[0] : null;
}

export async function getHistory(userId?: number, guestToken?: string, days: number = 7): Promise<any[]> {
  let idCol: string, idVal: any;
  if (userId) { idCol = 'user_id'; idVal = userId; }
  else if (guestToken) { idCol = 'guest_token'; idVal = guestToken; }
  else return [];
  const env = await getCloudflareEnv();

  if (isD1(env)) {
    const { results } = await env.DB.prepare(
      `SELECT * FROM daily_summaries WHERE ${idCol} = ? AND meal_date >= date('now', '-' || ? || ' days') ORDER BY meal_date DESC`
    ).bind(idVal, days).all();
    return results || [];
  }

  const db = await getPool();
  if (!db) return [];
  const [rows] = await db.execute(
    `SELECT * FROM daily_summaries WHERE ${idCol} = ? AND meal_date >= CURDATE() - INTERVAL ? DAY ORDER BY meal_date DESC`,
    [idVal, days]
  );
  return rows;
}

// ── Contact ──

export async function createContact(name: string, email: string, message: string): Promise<void> {
  const env = await getCloudflareEnv();
  if (isD1(env)) {
    await env.DB.prepare('INSERT INTO contacts (name, email, message) VALUES (?, ?, ?)').bind(name, email, message).run();
    return;
  }
  const db = await getPool();
  if (!db) return;
  await db.execute('INSERT INTO contacts (name, email, message) VALUES (?, ?, ?)', [name, email, message]);
}
