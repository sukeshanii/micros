#!/bin/bash
set -o pipefail

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y nginx certbot python3-certbot-nginx git

# ── Nginx: disable all default sites first ─────────────────────────────────
rm -f /etc/nginx/sites-enabled/default
rm -f /etc/nginx/conf.d/default.conf

# ── Nginx: proxy config (HTTP) ─────────────────────────────────────────────
cat <<'NGINX_HTTP' > /etc/nginx/sites-available/micros
server {
    listen 80;
    server_name microcalorietracker.online www.microcalorietracker.online;
    location / {
        proxy_pass http://127.0.0.1:4321;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX_HTTP

ln -sf /etc/nginx/sites-available/micros /etc/nginx/sites-enabled/micros
systemctl enable nginx || true

# Test config before starting
if nginx -t 2>&1; then
  systemctl restart nginx || systemctl start nginx
else
  echo "Nginx config test failed — check manually"
  cat /etc/nginx/sites-available/micros
fi

# ── SSL via Let's Encrypt (non-blocking — if it fails, HTTP stays) ────────
certbot --nginx -d microcalorietracker.online -d www.microcalorietracker.online \
  --non-interactive --agree-tos --email hello@microcalorietracker.online && {

  cat <<'NGINX_SSL' > /etc/nginx/sites-available/micros
server {
    listen 80;
    server_name microcalorietracker.online www.microcalorietracker.online;
    return 301 https://$host$request_uri;
}
server {
    listen 443 ssl http2;
    server_name microcalorietracker.online www.microcalorietracker.online;
    ssl_certificate /etc/letsencrypt/live/microcalorietracker.online/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/microcalorietracker.online/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers on;
    location / {
        proxy_pass http://127.0.0.1:4321;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX_SSL
  echo "0 3 * * * /usr/bin/certbot renew --quiet" | crontab -
  nginx -t && systemctl restart nginx
}

# ── Docker ─────────────────────────────────────────────────────────────────
curl -fsSL https://get.docker.com | sh
systemctl start docker
systemctl enable docker

# ── Mount EBS volume for MySQL data persistence ────────────────────────────
MYSQL_DATA_MOUNT="/mnt/mysql-data"
if [ -e /dev/xvdf ]; then
  echo "EBS volume detected at /dev/xvdf"
  mkdir -p "$MYSQL_DATA_MOUNT"
  if ! mount | grep -q "$MYSQL_DATA_MOUNT"; then
    blkid /dev/xvdf || mkfs.ext4 /dev/xvdf
    mount /dev/xvdf "$MYSQL_DATA_MOUNT"
    echo "/dev/xvdf $MYSQL_DATA_MOUNT ext4 defaults 0 2" >> /etc/fstab
  fi
  echo "EBS volume mounted at $MYSQL_DATA_MOUNT"
else
  echo "No EBS volume detected, using Docker volume for MySQL"
  MYSQL_DATA_MOUNT="/var/lib/docker/volumes/mysql_data/_data"
  mkdir -p "$MYSQL_DATA_MOUNT"
fi

# ── Build & run app with MySQL + Memcached via Docker Compose ─────────────
mkdir -p /opt/micros

# ── Pull latest image from Docker Hub ──────────────────────────────────────

echo "Pulling Docker image..."
for attempt in 1 2 3; do
  if docker pull sukeshanii/micros:latest; then
    echo "Docker image pulled successfully."
    break
  else
    echo "Pull attempt $attempt failed. Retrying in 10s..."
    sleep 10
  fi
done
if ! docker image inspect sukeshanii/micros:latest >/dev/null 2>&1; then
  echo "FATAL: Failed to pull Docker image after 3 attempts."
fi

# ── Migration SQL for existing databases ───────────────────────────────────
cat > /opt/micros/init.sql <<'INITSQL'
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
  allergies TEXT DEFAULT NULL,
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
INITSQL

# ── Migration SQL for existing databases ───────────────────────────────────
cat > /opt/micros/migrate.sql <<'MIGRATE'
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
MIGRATE

# ── Docker Compose ─────────────────────────────────────────────────────────
cat > /opt/micros/docker-compose.yml <<'EOF'
services:
  app:
    image: sukeshanii/micros:latest
    ports:
      - "127.0.0.1:4321:4321"
    environment:
      - DB_HOST=mysql
      - DB_PORT=3306
      - DB_USER=micros
      - DB_PASSWORD=micros_secret
      - DB_NAME=micros
      - MEMCACHED_HOST=memcached
      - MEMCACHED_PORT=11211
      - HOST=0.0.0.0
    depends_on:
      mysql:
        condition: service_healthy
      memcached:
        condition: service_started
    restart: unless-stopped

  mysql:
    image: mysql:8
    environment:
      - MYSQL_ROOT_PASSWORD=root_secret
      - MYSQL_DATABASE=micros
      - MYSQL_USER=micros
      - MYSQL_PASSWORD=micros_secret
    volumes:
      - ${MYSQL_DATA_MOUNT:-mysql_data}:/var/lib/mysql
      - /opt/micros/init.sql:/docker-entrypoint-initdb.d/01-init.sql
      - /opt/micros/migrate.sql:/docker-entrypoint-initdb.d/02-migrate.sql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      timeout: 10s
      retries: 10
    restart: unless-stopped

  memcached:
    image: memcached:alpine
    restart: unless-stopped

  watchtower:
    image: containrrr/watchtower:latest
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    command: --interval 60 --cleanup
    restart: unless-stopped

volumes:
  mysql_data:
EOF

# ── Start all services ────────────────────────────────────────────────────
docker compose -f /opt/micros/docker-compose.yml up -d

# ── Wait & run migration for existing DB ──────────────────────────────────
echo "Waiting for MySQL to be healthy..."
for i in $(seq 1 30); do
  if docker compose -f /opt/micros/docker-compose.yml exec -T mysql mysqladmin ping -h localhost -u root -proot_secret --silent 2>/dev/null; then
    echo "Running schema migration..."
    docker compose -f /opt/micros/docker-compose.yml exec -T mysql sh -c 'mysql -u root -proot_secret micros < /docker-entrypoint-initdb.d/02-migrate.sql' 2>&1 || true
    echo "Migration complete."
    break
  fi
  sleep 2
done

# ── Restart app so it picks up new schema ─────────────────────────────────
docker compose -f /opt/micros/docker-compose.yml restart app

# ── Health check ──────────────────────────────────────────────────────────
echo "Running health checks..."
sleep 5
if curl -sf -o /dev/null http://127.0.0.1:80; then
  echo "HEALTH OK: nginx is serving on port 80."
else
  echo "WARNING: nginx not reachable on port 80. Check /var/log/nginx/."
fi
if curl -sf -o /dev/null http://127.0.0.1:4321; then
  echo "HEALTH OK: Astro app is serving on port 4321."
else
  echo "WARNING: Astro app not reachable on port 4321. Check 'docker compose -f /opt/micros/docker-compose.yml ps'."
fi
docker compose -f /opt/micros/docker-compose.yml ps --all
echo "Setup complete."

