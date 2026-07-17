CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  age INTEGER NOT NULL DEFAULT 25,
  sex TEXT NOT NULL DEFAULT '',
  height REAL NOT NULL DEFAULT 170,
  weight REAL NOT NULL DEFAULT 70,
  target_weight REAL,
  goal TEXT NOT NULL DEFAULT 'maintain',
  activity TEXT NOT NULL DEFAULT 'moderate',
  diet TEXT NOT NULL DEFAULT 'none',
  allergies TEXT NOT NULL DEFAULT '',
  start_weight REAL,
  meals_per_day INTEGER NOT NULL DEFAULT 3,
  daily_calories REAL NOT NULL DEFAULT 2000,
  daily_protein REAL NOT NULL DEFAULT 100,
  daily_carbs REAL NOT NULL DEFAULT 250,
  daily_fat REAL NOT NULL DEFAULT 65
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS guest_sessions (
  token TEXT PRIMARY KEY,
  meals_per_day INTEGER NOT NULL DEFAULT 3,
  goal TEXT NOT NULL DEFAULT 'maintain',
  daily_calories REAL NOT NULL DEFAULT 2000,
  daily_protein REAL NOT NULL DEFAULT 100,
  daily_carbs REAL NOT NULL DEFAULT 250,
  daily_fat REAL NOT NULL DEFAULT 65
);

CREATE TABLE IF NOT EXISTS meal_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  guest_token TEXT,
  meal_date TEXT NOT NULL,
  meal_number INTEGER NOT NULL,
  meal_type TEXT NOT NULL,
  meal_name TEXT NOT NULL,
  weight_grams REAL NOT NULL,
  calories REAL NOT NULL,
  protein REAL NOT NULL,
  carbs REAL NOT NULL,
  fat REAL NOT NULL,
  fiber REAL NOT NULL,
  micronutrients TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS daily_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  guest_token TEXT,
  meal_date TEXT NOT NULL,
  total_calories REAL NOT NULL DEFAULT 0,
  total_protein REAL NOT NULL DEFAULT 0,
  total_carbs REAL NOT NULL DEFAULT 0,
  total_fat REAL NOT NULL DEFAULT 0,
  total_fiber REAL NOT NULL DEFAULT 0,
  meal_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, meal_date),
  UNIQUE(guest_token, meal_date)
);

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL
);
