# Cloudflare Deployment Guide — MicroCalorieTracker

## What This Guide Does

This guide moves your website from AWS EC2 to Cloudflare **without touching your AWS setup**.

After this guide:
- **AWS deployment** still exists (EC2 still running, Terraform files untouched)
- **Cloudflare deployment** serves the website from Cloudflare's edge network
- **Your repo** has both AWS and Cloudflare files (recruiters see both skills)
- **Cost** goes from ~$10.50/month to **$0/month**

---

## How It Works

The code is now dual-platform:
- On **AWS/Docker (Node.js)**: Uses MySQL + Memcached (unchanged behavior)
- On **Cloudflare Workers**: Uses D1 database + KV cache (new behavior)

The code checks at runtime which platform it's running on and uses the right
database and cache automatically. No manual switching needed.

---

## Prerequisites

- [ ] Node.js 22+ installed (`node --version`)
- [ ] Git installed (`git --version`)
- [ ] A Cloudflare account (free at https://dash.cloudflare.com/signup)
- [ ] Your domain (microcalorietracker.com) on Cloudflare DNS

---

## Step 1: Install Dependencies

Open a terminal in the `astronautical-altitude` folder:

```bash
cd micro/astronautical-altitude
npm install
```

This installs everything including the new `@astrojs/cloudflare` adapter.

---

## Step 2: Install Wrangler CLI

Wrangler is Cloudflare's command-line tool. Install it globally:

```bash
npm install -g wrangler
```

Verify it works:

```bash
wrangler --version
```

Log in to your Cloudflare account:

```bash
wrangler login
```

This opens a browser — click "Allow" to give Wrangler access to your account.

---

## Step 3: Create the D1 Database

D1 is Cloudflare's SQL database (replaces MySQL):

```bash
wrangler d1 create micros-db
```

This prints something like:

```
✅ Successfully created DB 'micros-db' in region WEUR
Created your new D1 database.

[[d1_databases]]
binding = "DB"
database_name = "micros-db"
database_id = "xxxx-xxxx-xxxx-xxxx-xxxx"
```

**Copy the `database_id` value.** You'll need it in the next step.

---

## Step 4: Create the KV Namespace

KV is Cloudflare's key-value cache (replaces Memcached):

```bash
wrangler kv namespace create micros-cache
```

This prints something like:

```
✅ Successfully created namespace 'micros-cache'

[[kv_namespaces]]
binding = "CACHE"
id = "xxxx-xxxx-xxxx-xxxx-xxxx"
```

**Copy the `id` value.** You'll need it in the next step.

---

## Step 5: Configure wrangler.jsonc

Open the file `micro/astronautical-altitude/wrangler.jsonc` that was created for you.

Replace the empty `database_id` and `id` with the values you just copied:

```jsonc
{
  "name": "micro-calorie-tracker",
  "compatibility_date": "2026-07-16",
  "pages_build_output_dir": "./dist",
  "build_command": "npx astro build --config astro.config.cloudflare.mjs",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "micros-db",
      "database_id": "PASTE_YOUR_DATABASE_ID_HERE"
    }
  ],
  "kv_namespaces": [
    {
      "binding": "CACHE",
      "id": "PASTE_YOUR_KV_ID_HERE"
    }
  ]
}
```

---

## Step 6: Create the Database Tables

Now create all the tables in your D1 database.

In the terminal, still inside `micro/astronautical-altitude`:

```bash
wrangler d1 execute micros-db --command "
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  name TEXT DEFAULT '',
  age INTEGER DEFAULT 25,
  sex TEXT DEFAULT '',
  height REAL DEFAULT 170,
  weight REAL DEFAULT 70,
  target_weight REAL DEFAULT NULL,
  goal TEXT DEFAULT 'maintain',
  activity TEXT DEFAULT 'moderate',
  diet TEXT DEFAULT 'none',
  allergies TEXT DEFAULT '',
  start_weight REAL DEFAULT NULL,
  meals_per_day INTEGER DEFAULT 3,
  daily_calories INTEGER DEFAULT 2000,
  daily_protein INTEGER DEFAULT 100,
  daily_carbs INTEGER DEFAULT 250,
  daily_fat INTEGER DEFAULT 65,
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS guest_sessions (
  token TEXT PRIMARY KEY,
  meals_per_day INTEGER DEFAULT 3,
  goal TEXT DEFAULT 'maintain',
  daily_calories INTEGER DEFAULT 2000,
  daily_protein INTEGER DEFAULT 100,
  daily_carbs INTEGER DEFAULT 250,
  daily_fat INTEGER DEFAULT 65,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS meal_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER DEFAULT NULL,
  guest_token TEXT DEFAULT NULL,
  meal_date TEXT NOT NULL,
  meal_number INTEGER NOT NULL DEFAULT 0,
  meal_type TEXT DEFAULT '',
  meal_name TEXT NOT NULL,
  weight_grams INTEGER DEFAULT 0,
  calories INTEGER DEFAULT 0,
  protein REAL DEFAULT 0,
  carbs REAL DEFAULT 0,
  fat REAL DEFAULT 0,
  fiber REAL DEFAULT 0,
  micronutrients TEXT DEFAULT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_meal_user_date ON meal_entries(user_id, meal_date);
CREATE INDEX IF NOT EXISTS idx_meal_guest_date ON meal_entries(guest_token, meal_date);

CREATE TABLE IF NOT EXISTS daily_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER DEFAULT NULL,
  guest_token TEXT DEFAULT NULL,
  meal_date TEXT NOT NULL,
  total_calories INTEGER DEFAULT 0,
  total_protein REAL DEFAULT 0,
  total_carbs REAL DEFAULT 0,
  total_fat REAL DEFAULT 0,
  total_fiber REAL DEFAULT 0,
  meal_count INTEGER DEFAULT 0,
  micronutrients_aggregated TEXT DEFAULT NULL,
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_summary_user_date ON daily_summaries(user_id, meal_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_summary_guest_date ON daily_summaries(guest_token, meal_date);

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id);
"
```

This creates the same 7 tables you have in MySQL, but in D1 (SQLite).

---

## Step 7: Build the Project for Cloudflare

Now build the project using the Cloudflare adapter:

```bash
npx astro build --config astro.config.cloudflare.mjs
```

If successful, you'll see output like:

```
astro build

[... build output ...]

✓ Completed in Xs.
```

The built files will be in `dist/` folder.

---

## Step 8: Deploy to Cloudflare Pages

Deploy the built files:

```bash
wrangler pages deploy
```

Wrangler will upload your files and give you a preview URL:

```
🌍 Site published: https://xxxx-xxxx-xxxx.pages.dev
```

**Visit this URL in your browser.** Your app should load!

Test that it works:
- [ ] Homepage loads
- [ ] You can register/login with an email
- [ ] You can create a guest session
- [ ] You can scan a meal (analyze page)
- [ ] Dashboard loads
- [ ] Profile page loads

---

## Step 9: Add Your Custom Domain

Now connect `microcalorietracker.com` to your Cloudflare Pages site.

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Click **Pages** in the left menu
3. Click **micro-calorie-tracker** (your project)
4. Go to **Custom domains** tab
5. Type `microcalorietracker.com` and click **Set custom domain**
6. Cloudflare will automatically add DNS records

Wait a few minutes for DNS to propagate, then visit `https://microcalorietracker.com` — it should serve from Cloudflare now!

---

## Step 10: Enable Full SSL

1. In Cloudflare Dashboard, go to **SSL/TLS**
2. Set mode to **Full (strict)**
3. Make sure **Always Use HTTPS** is ON

This replaces your Let's Encrypt certificate — Cloudflare handles SSL automatically
at no cost.

---

## Deployment Flow Summary

From now on, to deploy updates:

```bash
cd micro/astronautical-altitude

# Optional: export data from your local/MySQL dev if needed
# wrangler d1 execute micros-db --file=my-data.sql

# Build + deploy
npx astro build --config astro.config.cloudflare.mjs
wrangler pages deploy
```

That's it. No Docker, no EC2, no Nginx, no Terraform needed for Cloudflare.

---

## How AWS Still Works

Your AWS code is **untouched**:

| File | Status | Purpose |
|------|--------|---------|
| `Terraform/` | ✅ Untouched | Portfolio proof of IaC skills |
| `Dockerfile` | ✅ Untouched | Portfolio proof of containerization |
| `docker-compose.yml` | ✅ Untouched | Portfolio proof of multi-container setup |
| `setup.sh` | ✅ Untouched | Portfolio proof of Linux admin |
| `deploy.sh` | ✅ Untouched | Portfolio proof of CI/CD |
| `nginx.conf` | ✅ Untouched | Portfolio proof of reverse proxy |
| `ec2.tf` | ✅ Untouched | Portfolio proof of AWS provisioning |
| `terraform.tfstate` | ✅ Untouched | Portfolio proof of state management |

The EC2 instance is **still running** and serving your site. Once you verify
Cloudflare works perfectly, see the shutdown guide below.

---

## Verification Checklist

Before stopping AWS, verify EVERYTHING works on Cloudflare:

- [ ] Homepage loads at `https://microcalorietracker.com`
- [ ] All CSS styles look correct
- [ ] Navigation menu works
- [ ] Mobile layout works (resize browser)
- [ ] **Register**: Create a new account with any email
- [ ] **Login**: Log in with that email
- [ ] **Logout**: Log out
- [ ] **Guest mode**: Use "Continue as Guest"
- [ ] **Meal analysis**: Enter "chicken biryani", verify macros appear
- [ ] **Log meal**: After analysis, log the meal
- [ ] **Dashboard**: View dashboard, verify summary cards show data
- [ ] **History**: Check 7-day and 30-day history
- [ ] **Profile**: Update name, age, weight, see targets recalculate
- [ ] **Contact form**: Submit a message
- [ ] **404 page**: Visit a nonexistent page
- [ ] **HTTPS**: URL shows padlock icon
- [ ] **Analytics**: (optional) Check Google Analytics for traffic

If any feature fails, check the Cloudflare Pages logs in the dashboard
or run `wrangler pages deployment list` to see recent deployments.

---

## Safe AWS Shutdown (Only After Verification)

**WARNING: Do NOT do this until you've verified everything works on Cloudflare.**

If Cloudflare is working perfectly and you want to stop paying for EC2:

### Step 1: Take a Final Snapshot (Portfolio Preservation)

```bash
# Find your instance ID from the Terraform state
cd micro/Terraform
terraform output

# Take an AMI snapshot of the EC2 instance
# (Run this in your terminal, replacing INSTANCE_ID)
aws ec2 create-image \
  --instance-id i-059953106b2f08486 \
  --name "micros-final-snapshot-$(date +%Y-%m-%d)" \
  --no-reboot
```

This creates an AMI that you can restore later if needed. It's free to store.

### Step 2: Stop (Not Terminate) the Instance

```bash
terraform apply -auto-approve
```

**NO** — actually, to stop safely without modifying your Terraform code:

Option A — Via AWS Console (RECOMMENDED — keeps Terraform unchanged):
1. Go to https://console.aws.amazon.com/ec2
2. Find your micros instance
3. Right-click → Instance State → Stop
4. Confirm

Option B — Via CLI (does not change Terraform files):
```bash
aws ec2 stop-instances --instance-ids i-059953106b2f08486
```

**Do NOT terminate.** Terminating deletes the instance. Stopping keeps it
(and your EBS volumes) intact. You can start it again anytime.

### What Happens to Costs

| Resource | Stopped | Cost |
|----------|---------|------|
| EC2 t2.micro | Stopped | $0 (no running cost) |
| EBS 5GB (MySQL data) | Still exists | ~$0.50/month |
| EBS 15GB (root) | Still exists | ~$1.50/month |
| Elastic IP | Released if not attached | $0 if not used |
| AMI snapshot | Stored | $0 (minimal size, free tier) |

**Total while stopped: ~$2/month** (just storage for portfolio evidence).

**Total after Cloudflare: $0/month** (Cloudflare is free).

If you want to save even more, you can delete the EBS volumes after confirming
the snapshot is created. But for portfolio purposes, keeping the stopped instance
is fine.

---

## Portfolio Value — What Recruiters See

Your repository now contains BOTH:

### AWS Evidence
| File | What It Shows |
|------|---------------|
| `Terraform/ec2.tf` | "I can provision AWS EC2 with Terraform" |
| `Terraform/providers.tf` | "I know AWS provider config" |
| `Terraform/terraform.tfstate` | "I understand state management" |
| `Dockerfile` | "I can containerize apps" |
| `docker-compose.yml` | "I can orchestrate multi-container stacks" |
| `setup.sh` | "I can automate Linux server setup" |
| `nginx.conf` | "I can configure reverse proxies" |
| `deploy.sh` | "I can build CI/CD pipelines" |

### Cloudflare Evidence
| File | What It Shows |
|------|---------------|
| `wrangler.jsonc` | "I can configure Cloudflare Workers" |
| `astro.config.cloudflare.mjs` | "I can deploy Astro to Cloudflare" |
| `src/lib/db.ts` (D1 support) | "I can use Cloudflare D1 databases" |
| `src/lib/cache.ts` (KV support) | "I can use Cloudflare KV caching" |

### Combined Value
"I can architect on **both** AWS and Cloudflare. I migrated a production app
from EC2/Docker/MySQL to Serverless/Edge for **zero cost**."

This is extremely rare and valuable. Most developers know one or the other.
You know both.

---

## Troubleshooting

### Build fails with "Could not resolve 'node:crypto'"
This is handled by the code. Make sure you built with:
```bash
npx astro build --config astro.config.cloudflare.mjs
```

### "Cannot find module 'mysql2'"
This is expected on Cloudflare — the code catches this error and uses D1 instead.
Make sure `mysql2` is listed as `ssr.external` in `astro.config.cloudflare.mjs`
(which it already is).

### D1 query fails
Run the SQL creation commands again:
```bash
wrangler d1 execute micros-db --command "SELECT name FROM sqlite_master WHERE type='table';"
```

### Pages deploy fails
Check your `wrangler.jsonc` has the correct `database_id` and KV `id`.

### Site shows blank page
Check Cloudflare Pages logs in the dashboard.
Make sure you built with the cloudflare config, not the node config.

### I want to run locally for testing
```bash
npx astro dev --config astro.config.cloudflare.mjs
```

---

## Need Help?

- Cloudflare Pages docs: https://developers.cloudflare.com/pages/
- Cloudflare D1 docs: https://developers.cloudflare.com/d1/
- Astro Cloudflare adapter: https://docs.astro.build/en/guides/integrations-guide/cloudflare/
- Wrangler CLI reference: https://developers.cloudflare.com/workers/wrangler/
