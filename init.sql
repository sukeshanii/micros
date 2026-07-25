CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  name VARCHAR(255) DEFAULT '',
  age INT DEFAULT 25,
  sex VARCHAR(20) DEFAULT '',
  height DECIMAL(5,1) DEFAULT 170,
  weight DECIMAL(5,1) DEFAULT 70,
  target_weight DECIMAL(5,1) DEFAULT NULL,
  goal VARCHAR(50) DEFAULT 'maintain',
  activity VARCHAR(50) DEFAULT 'moderate',
  diet VARCHAR(50) DEFAULT 'none',
  allergies TEXT,
  start_weight DECIMAL(5,1) DEFAULT NULL,
  meals_per_day INT DEFAULT 3,
  daily_calories INT DEFAULT 2000,
  daily_protein INT DEFAULT 100,
  daily_carbs INT DEFAULT 250,
  daily_fat INT DEFAULT 65,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(64) PRIMARY KEY,
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

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

CREATE TABLE IF NOT EXISTS contacts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_profiles_user ON profiles(user_id);
