ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS meals_per_day INT DEFAULT 3,
  ADD COLUMN IF NOT EXISTS daily_calories INT DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS daily_protein INT DEFAULT 100,
  ADD COLUMN IF NOT EXISTS daily_carbs INT DEFAULT 250,
  ADD COLUMN IF NOT EXISTS daily_fat INT DEFAULT 65;

CREATE TABLE IF NOT EXISTS guest_sessions (
  token VARCHAR(64) PRIMARY KEY,
  meals_per_day INT DEFAULT 3,
  goal VARCHAR(20) DEFAULT 'maintain',
  daily_calories INT DEFAULT 2000,
  daily_protein INT DEFAULT 100,
  daily_carbs INT DEFAULT 250,
  daily_fat INT DEFAULT 65,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS meal_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT DEFAULT NULL,
  guest_token VARCHAR(64) DEFAULT NULL,
  meal_date DATE NOT NULL,
  meal_number INT NOT NULL DEFAULT 0,
  meal_type VARCHAR(20) DEFAULT '',
  meal_name VARCHAR(255) NOT NULL,
  weight_grams INT DEFAULT 0,
  calories INT DEFAULT 0,
  protein DECIMAL(8,2) DEFAULT 0,
  carbs DECIMAL(8,2) DEFAULT 0,
  fat DECIMAL(8,2) DEFAULT 0,
  fiber DECIMAL(8,2) DEFAULT 0,
  micronutrients JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_date (user_id, meal_date),
  INDEX idx_guest_date (guest_token, meal_date)
);

CREATE TABLE IF NOT EXISTS daily_summaries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT DEFAULT NULL,
  guest_token VARCHAR(64) DEFAULT NULL,
  meal_date DATE NOT NULL,
  total_calories INT DEFAULT 0,
  total_protein DECIMAL(8,2) DEFAULT 0,
  total_carbs DECIMAL(8,2) DEFAULT 0,
  total_fat DECIMAL(8,2) DEFAULT 0,
  total_fiber DECIMAL(8,2) DEFAULT 0,
  meal_count INT DEFAULT 0,
  micronutrients_aggregated JSON DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_user_date (user_id, meal_date),
  UNIQUE KEY uk_guest_date (guest_token, meal_date)
);
