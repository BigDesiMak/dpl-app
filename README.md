# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

# 🏏 DPL Fantasy Cricket League

**Daffodils Premier League — Fantasy Cricket Application (Season 2026)**

A full-stack fantasy cricket web app with admin and user interfaces, real-time point calculation, leaderboard, and phase-based team management.

---

## 🚀 QUICK DEPLOYMENT (Free — 15 minutes)

### STEP 1 — Set up Supabase (Free Database + Auth)

1. Go to **https://supabase.com** → Click "Start your project" → Sign in with GitHub
2. Click **"New project"**, choose:
   - **Name**: `dpl-fantasy-cricket`
   - **Database Password**: Choose a strong password and save it
   - **Region**: Asia South (Mumbai) — closest to Pune
3. Wait ~2 minutes for project to initialize
4. Go to **SQL Editor** (left sidebar) → **"New query"**
5. Open the file `supabase/schema.sql` from this project
6. **Paste the entire contents** into the SQL editor
7. Click **"Run"** (green button) — wait for "Success"
8. Go to **Settings → API** (left sidebar):
   - Copy **Project URL** (looks like `https://xxxx.supabase.co`)
   - Copy **anon public** key (long string)

### STEP 2 — Configure Environment Variables

1. In the project folder, create a file called `.env`:
```
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
```
Replace `YOUR_PROJECT_ID` and `YOUR_ANON_KEY_HERE` with the values from Step 1.

### STEP 3 — Set Up Admin User

After deploying, register an account normally on the app. Then in **Supabase → SQL Editor**, run:
```sql
UPDATE profiles SET is_admin = TRUE WHERE username = 'your_username_here';
```
Replace `your_username_here` with the username you registered with.

### STEP 4 — Deploy to Netlify (Free Hosting)

**Option A — Netlify Drop (Easiest, no GitHub needed):**
1. Install Node.js from https://nodejs.org (if not already installed)
2. Open terminal in this project folder and run:
   ```bash
   npm install
   npm run build
   ```
3. Go to **https://app.netlify.com/drop**
4. Drag and drop the `dist` folder onto the page
5. Your app is live! You'll get a URL like `https://random-name.netlify.app`

**Option B — GitHub + Netlify (Recommended for updates):**
1. Push this project to a GitHub repository
2. Go to **https://app.netlify.com** → "Add new site" → "Import from Git"
3. Connect GitHub, select your repo
4. Build settings (auto-detected):
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. Click **"Add environment variables"** and add:
   - `VITE_SUPABASE_URL` = your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = your anon key
6. Click **Deploy** — done! Future pushes auto-deploy.

**Option C — Vercel (Alternative):**
1. Go to https://vercel.com → Import project from GitHub
2. Add same environment variables
3. Deploy!

---

## 📱 APPLICATION OVERVIEW

### User Interfaces

| Page | URL | Description |
|------|-----|-------------|
| Landing | `/` | Public home with features overview |
| Login | `/login` | User sign in |
| Register | `/register` | New user registration |
| Dashboard | `/dashboard` | Personal stats, my team, recent matches |
| Team Selection | `/team` | Pick 10 players, set C/VC, manage lineup |
| Leaderboard | `/leaderboard` | Rankings per phase + points chart |
| Player Stats | `/players` | All player stats, match history |

### Admin Interfaces

| Page | URL | Description |
|------|-----|-------------|
| Admin Dashboard | `/admin` | Overview, pending stats alerts |
| Manage Players | `/admin/players` | Add/edit/deactivate players |
| Manage Matches | `/admin/matches` | Schedule matches, record results |
| Enter Match Stats | `/admin/match-stats/:id` | Per-player stats → auto-calculates fantasy points |
| View All Teams | `/admin/teams` | See every user's fantasy team + points |
| Phases | `/admin/phases` | Activate phases, lock/unlock team changes |
| Scoring Rules | `/admin/scoring` | Adjust any point value live |

---

## 🏏 GAME RULES (as per DFL Instructions)

### Team Selection Rules
- **Total players**: 10 (8 playing + 2 substitutes)
- **Playing XI**: 6 Males + 2 Females
- **Substitutes**: 1 Male + 1 Female
- **Max from same DPL team**: 2 players (Phase 4: 3 players)
- **Budget**: ₹10,000 credits per team

### Captain & Vice-Captain
- **Captain**: 2× points multiplier
- **Vice-Captain**: 1.5× points multiplier
- Cannot assign same player as both C and VC

### Transfers
- **Phase 2 only**: Maximum 3 transfers before phase begins
- Unused transfers do NOT carry forward
- Newly brought-in players from restructured DPL teams do NOT count against team limits

### Phases
| Phase | Matches | Transfers |
|-------|---------|-----------|
| Phase 1 | First 15 League Matches | None |
| Phase 2 | Remaining League Matches | Up to 3 (before phase) |
| Phase 3 | Semi-finals & Finals | None |
| Phase 4 | 3rd Place / Super Finals | None (max 3 per DPL team) |

---

## ⚡ SCORING SYSTEM

### Batting Points
| Action | Points |
|--------|--------|
| Per Run | +1 |
| Per Four (boundary) | +4 |
| Per Six | +6 |
| 15-29 runs in innings | +4 bonus |
| 30-49 runs in innings | +8 bonus |
| 50+ runs in innings | +16 bonus |
| Dismissed for Duck (0) | -4 |

### Strike Rate Bonus (min 5 balls faced)
| Strike Rate | Points |
|-------------|--------|
| 150+ | +6 |
| 120-149.99 | +4 |
| 100-119.99 | 0 |
| 70-84.99 | -2 |
| 50-69.99 | -4 |
| Below 50 | -6 |

### Bowling Points
| Action | Points |
|--------|--------|
| Per Wicket | +25 |
| 3 wickets in innings | +8 bonus |
| 5 wickets in innings | +16 bonus |
| Maiden Over | +12 |
| Wide | -2 |
| No Ball | -2 |
| Dot Ball | +1 |

### Economy Rate Bonus (min 1 over bowled)
| Economy Rate | Points |
|--------------|--------|
| Below 3.00 | +6 |
| 3.00-4.49 | +4 |
| 4.50-5.99 | +2 |
| 8.00-9.00 | -4 |
| Above 9.00 | -6 |

### Fielding Points
| Action | Points |
|--------|--------|
| Catch | +8 |
| Stumping | +4 |
| Run Out | +4 |

---

## 🗄️ DATABASE SCHEMA

**Tables:** `profiles`, `dpl_teams`, `players`, `phases`, `matches`, `fantasy_teams`, `fantasy_team_players`, `player_match_stats`, `fantasy_match_points`, `transfers`, `scoring_settings`, `app_settings`

**Key Automation:**
- Points auto-calculated via PostgreSQL triggers when admin saves match stats
- Fantasy team totals auto-updated after every stat entry
- Captain/VC multipliers applied automatically

---

## 🧪 TESTING SCENARIOS COVERED

### ✅ Positive Scenarios Tested
1. User registration → email verification → login
2. Team selection within budget with correct gender ratio
3. Setting Captain and Vice-Captain (different players)
4. Saving team and viewing in dashboard
5. Admin adding match, marking complete, entering stats
6. Points auto-calculation after stat entry
7. Leaderboard ranking update after each match
8. Phase activation and phase switching

### ❌ Negative Scenarios Handled
1. **Exceeds budget** — blocked with toast error
2. **>2 players from same DPL team** — blocked
3. **Wrong gender ratio** (not 6M+2F playing) — blocked at save
4. **<10 or >10 players** — blocked at save
5. **Captain = Vice-Captain** — blocked
6. **<8 or >8 playing players** — blocked at save
7. **Duplicate username** — checked before registration
8. **Admin routes for non-admins** — redirect to `/dashboard`
9. **Unverified email login** — Supabase handles
10. **Team locked** — editing blocked with message
11. **Stats entry for non-existent match** — 404 handling

---

## 🛠️ LOCAL DEVELOPMENT

```bash
# 1. Install dependencies
npm install

# 2. Create .env file (see Step 2 above)

# 3. Start dev server
npm run dev

# 4. Open http://localhost:5173
```

---

## 📦 PROJECT STRUCTURE

```
dpl-app/
├── supabase/
│   └── schema.sql          ← Full database + seed data
├── public/
│   └── dpl-icon.svg
├── src/
│   ├── main.jsx
│   ├── App.jsx             ← Routing
│   ├── index.css           ← Global theme
│   ├── supabaseClient.js
│   ├── context/
│   │   └── AuthContext.jsx ← Auth state
│   ├── components/
│   │   └── Layout.jsx      ← Navbar + page wrapper
│   └── pages/
│       ├── Landing.jsx
│       ├── Login.jsx
│       ├── Register.jsx
│       ├── UserDashboard.jsx
│       ├── TeamSelection.jsx
│       ├── Leaderboard.jsx
│       ├── PlayerStats.jsx
│       └── admin/
│           ├── AdminDashboard.jsx
│           ├── AdminPlayers.jsx
│           ├── AdminMatches.jsx
│           ├── AdminMatchStats.jsx
│           ├── AdminTeams.jsx
│           ├── AdminScoring.jsx
│           └── AdminPhases.jsx
├── netlify.toml
├── vite.config.js
├── package.json
└── README.md
```

---

## 🔧 ADMIN WORKFLOW (After Each Match)

1. Go to `/admin/matches`
2. Click **"✓ Mark Complete"** on the finished match
3. Click **"📊 Enter Stats"**
4. For each player who played:
   - ✓ Check "Batting" and enter: runs, balls, 4s, 6s, got out
   - ✓ Check "Bowling" and enter: overs, wickets, runs given, maidens, dots, wides, no balls
   - Enter fielding: catches, stumpings, run outs
5. Click **"💾 Save All & Calculate Points"**
6. Fantasy points are **automatically calculated** and **leaderboard updates instantly**

---

## 💡 TIPS

- **Email verification**: Supabase sends verification emails. In development/testing, you can disable this in Supabase → Authentication → Email → "Confirm email" toggle.
- **First admin**: After deploying, register your account, then set yourself as admin via SQL.
- **DPL Teams**: 8 teams are pre-seeded (Team A through G + RH). Edit player-team assignments in Admin → Players.
- **Budget for players**: All players seeded with prices on ₹950–₹1,500 scale, total picks should fit within ₹10,000 budget comfortably.

