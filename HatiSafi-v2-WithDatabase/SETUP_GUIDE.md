# 🛠️ SETUP GUIDE — Hati Safi v2
## Connect your API key, Database & Deploy

Follow these steps IN ORDER. Takes about 15 minutes total.

---

## STEP 1 — Get Your Anthropic API Key

1. Go to **https://console.anthropic.com**
2. Sign in or create a free account
3. Click **"API Keys"** in the left menu
4. Click **"Create Key"** — give it a name like "Hati Safi"
5. **Copy the key** (starts with `sk-ant-...`) — save it somewhere safe

---

## STEP 2 — Set Up Supabase Database (Free)

### 2a — Create a Supabase project
1. Go to **https://supabase.com** and sign up free
2. Click **"New Project"**
3. Choose a name: `hati-safi`
4. Set a database password (save it)
5. Choose region: **US East** or **Europe West** (closest to Kenya)
6. Click **"Create new project"** — wait ~2 minutes

### 2b — Create the database tables
1. In your Supabase project, click **"SQL Editor"** in the left sidebar
2. Click **"New Query"**
3. Open the file `supabase-schema.sql` from this ZIP
4. **Copy ALL the SQL** and paste it into the editor
5. Click **"Run"** (green button)
6. You should see "Success. No rows returned" — that means it worked!

### 2c — Get your Supabase keys
1. Click **"Settings"** (gear icon) in the left sidebar
2. Click **"API"**
3. You will see two things you need:
   - **Project URL** — looks like `https://xyzabc.supabase.co`
   - **anon / public key** — a long string starting with `eyJ...`
4. Copy BOTH and keep them ready

### 2d — Add your Supabase keys to app.js
1. Open `app.js` in any text editor (Notepad, TextEdit, VS Code)
2. Find these two lines near the top:
   ```
   const SUPABASE_URL  = 'REPLACE_WITH_YOUR_SUPABASE_URL';
   const SUPABASE_ANON = 'REPLACE_WITH_YOUR_SUPABASE_ANON_KEY';
   ```
3. Replace the placeholder text with your actual values:
   ```
   const SUPABASE_URL  = 'https://xyzabc.supabase.co';
   const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
   ```
4. Save the file

---

## STEP 3 — Deploy to Netlify (Free)

Netlify will host your site AND run your API functions securely.

### 3a — Sign up for Netlify
1. Go to **https://netlify.com**
2. Sign up with your GitHub account (click "Sign up with GitHub")

### 3b — Connect your GitHub repo
1. On the Netlify dashboard, click **"Add new site"**
2. Click **"Import an existing project"**
3. Click **"GitHub"**
4. Find and select your **hati-safi-website** repository
5. Leave all settings as default
6. Click **"Deploy site"**

### 3c — Add your Anthropic API key to Netlify
This keeps your key secret — it never appears in your code.

1. In Netlify, go to your site
2. Click **"Site configuration"** (or "Site settings")
3. Click **"Environment variables"** in the left menu
4. Click **"Add a variable"**
5. Set:
   - **Key:** `ANTHROPIC_API_KEY`
   - **Value:** your `sk-ant-...` key from Step 1
6. Click **"Save"**

### 3d — Redeploy the site
1. Go to **"Deploys"** tab in Netlify
2. Click **"Trigger deploy"** → **"Deploy site"**
3. Wait ~1-2 minutes
4. Your site is now LIVE and FUNCTIONAL at your Netlify URL!

---

## STEP 4 — Update GitHub with your app.js changes

Since you edited `app.js` to add your Supabase keys:

1. Go to your GitHub repo (`hati-safi-website`)
2. Click on `app.js`
3. Click the **pencil icon ✏️** to edit
4. Replace the full file content with your updated `app.js`
5. Click **"Commit changes"**
6. Netlify will automatically redeploy within 1-2 minutes

---

## STEP 5 — Test Everything

Open your Netlify URL and:
1. ✅ Upload a document → should get a full AI analysis
2. ✅ Check the History tab → your analysis should be saved
3. ✅ Try the "Ask" tab → ask a Kenya legal question
4. ✅ Open your Supabase dashboard → Table Editor → `analyses` → you should see your records

---

## Your Live URLs

After setup you will have:
- **Netlify URL:** `https://your-app-name.netlify.app` (main live site)
- **Custom domain:** You can add your own domain in Netlify → Domain settings

---

## ❓ Troubleshooting

| Problem | Fix |
|---------|-----|
| "Analysis failed: Server error 500" | Check your ANTHROPIC_API_KEY in Netlify environment variables |
| History not saving | Check your SUPABASE_URL and SUPABASE_ANON in app.js |
| Site not updating | Go to Netlify → Deploys → Trigger deploy |
| Blank page | Make sure index.html is at the ROOT of the GitHub repo (not in a subfolder) |

---

*Hati Safi v2 — AI + Live Research + Database*
