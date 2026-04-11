-- ============================================================
-- DPL Fantasy Cricket League - Complete Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES (extends Supabase Auth)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  flat_number TEXT,
  phone TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DPL TEAMS (actual cricket teams in the league)
-- ============================================================
CREATE TABLE IF NOT EXISTS dpl_teams (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT,
  color TEXT DEFAULT '#22c55e',
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PLAYERS
-- ============================================================
CREATE TABLE IF NOT EXISTS players (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('Male', 'Female')),
  flat_number TEXT,
  skill TEXT NOT NULL CHECK (skill IN (
    'Batting All Rounder', 'Bowling All Rounder',
    'Batter', 'Bowler', 'Wicket Keeper'
  )),
  dpl_team_id INTEGER REFERENCES dpl_teams(id) ON DELETE SET NULL,
  auction_price INTEGER DEFAULT 100 CHECK (auction_price >= 0),
  is_active BOOLEAN DEFAULT TRUE,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PHASES
-- ============================================================
CREATE TABLE IF NOT EXISTS phases (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  phase_number INTEGER UNIQUE NOT NULL,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT FALSE,
  is_locked BOOLEAN DEFAULT FALSE,
  max_transfers INTEGER DEFAULT 3,
  max_players_per_dpl_team INTEGER DEFAULT 2,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MATCHES
-- ============================================================
CREATE TABLE IF NOT EXISTS matches (
  id SERIAL PRIMARY KEY,
  match_number INTEGER NOT NULL,
  team1_id INTEGER REFERENCES dpl_teams(id),
  team2_id INTEGER REFERENCES dpl_teams(id),
  match_date DATE,
  match_time TIME,
  venue TEXT,
  phase_id INTEGER REFERENCES phases(id),
  winner_id INTEGER REFERENCES dpl_teams(id),
  team1_score TEXT,
  team2_score TEXT,
  result_summary TEXT,
  is_completed BOOLEAN DEFAULT FALSE,
  stats_entered BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FANTASY TEAMS (user's selected team per phase)
-- ============================================================
CREATE TABLE IF NOT EXISTS fantasy_teams (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  team_name TEXT,
  phase_id INTEGER REFERENCES phases(id),
  captain_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  vice_captain_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  total_budget INTEGER DEFAULT 10000,
  spent_budget INTEGER DEFAULT 0,
  total_points DECIMAL(10,2) DEFAULT 0,
  is_locked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, phase_id)
);

-- ============================================================
-- FANTASY TEAM PLAYERS
-- ============================================================
CREATE TABLE IF NOT EXISTS fantasy_team_players (
  id SERIAL PRIMARY KEY,
  fantasy_team_id INTEGER REFERENCES fantasy_teams(id) ON DELETE CASCADE,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  is_playing BOOLEAN DEFAULT TRUE,
  position INTEGER CHECK (position BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fantasy_team_id, player_id)
);

-- ============================================================
-- PLAYER MATCH STATS
-- ============================================================
CREATE TABLE IF NOT EXISTS player_match_stats (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
  -- Batting
  runs INTEGER DEFAULT 0,
  balls_faced INTEGER DEFAULT 0,
  fours INTEGER DEFAULT 0,
  sixes INTEGER DEFAULT 0,
  is_out BOOLEAN DEFAULT TRUE,
  did_bat BOOLEAN DEFAULT FALSE,
  -- Bowling
  overs_bowled DECIMAL(4,1) DEFAULT 0,
  wickets INTEGER DEFAULT 0,
  runs_conceded INTEGER DEFAULT 0,
  maidens INTEGER DEFAULT 0,
  wides INTEGER DEFAULT 0,
  no_balls INTEGER DEFAULT 0,
  dot_balls INTEGER DEFAULT 0,
  did_bowl BOOLEAN DEFAULT FALSE,
  -- Fielding
  catches INTEGER DEFAULT 0,
  stumpings INTEGER DEFAULT 0,
  run_outs INTEGER DEFAULT 0,
  -- Calculated Points
  batting_points DECIMAL(10,2) DEFAULT 0,
  bowling_points DECIMAL(10,2) DEFAULT 0,
  fielding_points DECIMAL(10,2) DEFAULT 0,
  total_points DECIMAL(10,2) DEFAULT 0,
  entered_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, match_id)
);

-- ============================================================
-- FANTASY MATCH POINTS (auto-calculated)
-- ============================================================
CREATE TABLE IF NOT EXISTS fantasy_match_points (
  id SERIAL PRIMARY KEY,
  fantasy_team_id INTEGER REFERENCES fantasy_teams(id) ON DELETE CASCADE,
  match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
  raw_points DECIMAL(10,2) DEFAULT 0,
  captain_bonus DECIMAL(10,2) DEFAULT 0,
  vc_bonus DECIMAL(10,2) DEFAULT 0,
  total_points DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fantasy_team_id, match_id)
);

-- ============================================================
-- TRANSFERS
-- ============================================================
CREATE TABLE IF NOT EXISTS transfers (
  id SERIAL PRIMARY KEY,
  fantasy_team_id INTEGER REFERENCES fantasy_teams(id) ON DELETE CASCADE,
  player_out_id INTEGER REFERENCES players(id),
  player_in_id INTEGER REFERENCES players(id),
  phase_id INTEGER REFERENCES phases(id),
  transfer_number INTEGER,
  transferred_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SCORING SETTINGS (configurable point values)
-- ============================================================
CREATE TABLE IF NOT EXISTS scoring_settings (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value DECIMAL(10,2) NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- APP SETTINGS (general config)
-- ============================================================
CREATE TABLE IF NOT EXISTS app_settings (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT
);

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (TRUE);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Players (read-only for users, admin can edit)
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players visible to all" ON players FOR SELECT USING (TRUE);
CREATE POLICY "Admin can manage players" ON players FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);

-- DPL Teams
ALTER TABLE dpl_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teams visible to all" ON dpl_teams FOR SELECT USING (TRUE);
CREATE POLICY "Admin can manage teams" ON dpl_teams FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);

-- Phases
ALTER TABLE phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Phases visible to all" ON phases FOR SELECT USING (TRUE);
CREATE POLICY "Admin can manage phases" ON phases FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);

-- Matches
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Matches visible to all" ON matches FOR SELECT USING (TRUE);
CREATE POLICY "Admin can manage matches" ON matches FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);

-- Fantasy Teams
ALTER TABLE fantasy_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view all fantasy teams" ON fantasy_teams FOR SELECT USING (TRUE);
CREATE POLICY "Users can manage own fantasy team" ON fantasy_teams FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admin can manage all fantasy teams" ON fantasy_teams FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);

-- Fantasy Team Players
ALTER TABLE fantasy_team_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view team players" ON fantasy_team_players FOR SELECT USING (TRUE);
CREATE POLICY "Users can manage own team players" ON fantasy_team_players FOR ALL USING (
  EXISTS (SELECT 1 FROM fantasy_teams WHERE id = fantasy_team_id AND user_id = auth.uid())
);
CREATE POLICY "Admin can manage all team players" ON fantasy_team_players FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);

-- Player Match Stats
ALTER TABLE player_match_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stats visible to all" ON player_match_stats FOR SELECT USING (TRUE);
CREATE POLICY "Admin can manage stats" ON player_match_stats FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);

-- Fantasy Match Points
ALTER TABLE fantasy_match_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Points visible to all" ON fantasy_match_points FOR SELECT USING (TRUE);
CREATE POLICY "Admin can manage points" ON fantasy_match_points FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);

-- Transfers
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own transfers" ON transfers FOR SELECT USING (
  EXISTS (SELECT 1 FROM fantasy_teams WHERE id = fantasy_team_id AND user_id = auth.uid())
);
CREATE POLICY "Users can insert own transfers" ON transfers FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM fantasy_teams WHERE id = fantasy_team_id AND user_id = auth.uid())
);
CREATE POLICY "Admin can view all transfers" ON transfers FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);

-- Scoring Settings
ALTER TABLE scoring_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scoring visible to all" ON scoring_settings FOR SELECT USING (TRUE);
CREATE POLICY "Admin can manage scoring" ON scoring_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);

-- App Settings
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Settings visible to all" ON app_settings FOR SELECT USING (TRUE);
CREATE POLICY "Admin can manage settings" ON app_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);

-- ============================================================
-- SEED DATA
-- ============================================================

-- DPL Teams (based on residential complex blocks)
INSERT INTO dpl_teams (name, short_name, color) VALUES
  ('Team A', 'TMA', '#ef4444'),
  ('Team B', 'TMB', '#3b82f6'),
  ('Team C', 'TMC', '#f59e0b'),
  ('Team D', 'TMD', '#10b981'),
  ('Team E', 'TME', '#8b5cf6'),
  ('Team F', 'TMF', '#ec4899'),
  ('Team G', 'TMG', '#14b8a6'),
  ('Team RH', 'TMRH', '#f97316')
ON CONFLICT DO NOTHING;

-- Phases
INSERT INTO phases (name, description, phase_number, max_transfers, max_players_per_dpl_team) VALUES
  ('Phase 1', 'First 15 League Matches', 1, 0, 2),
  ('Phase 2', 'Last League Matches', 2, 3, 2),
  ('Phase 3', 'Semi-finals & Finals', 3, 0, 2),
  ('Phase 4', 'Super Finals / 3rd Place', 4, 0, 3)
ON CONFLICT DO NOTHING;

-- Scoring Settings (DFL Rules from file)
INSERT INTO scoring_settings (key, value, category, description) VALUES
  -- Batting
  ('bat_run', 1, 'batting', 'Points per run'),
  ('bat_four', 4, 'batting', 'Points per four (boundary)'),
  ('bat_six', 6, 'batting', 'Points per six'),
  ('bat_milestone_15_29', 4, 'batting', 'Bonus for 15-29 runs in an innings'),
  ('bat_milestone_30_49', 8, 'batting', 'Bonus for 30-49 runs in an innings'),
  ('bat_milestone_50_plus', 16, 'batting', 'Bonus for 50+ runs in an innings'),
  ('bat_duck', -4, 'batting', 'Penalty for being dismissed for duck (0 runs)'),
  -- Strike Rate (min 5 balls faced)
  ('bat_sr_150_plus', 6, 'batting', 'SR bonus: 150 and above'),
  ('bat_sr_120_149', 4, 'batting', 'SR bonus: 120-149.99'),
  ('bat_sr_100_119', 0, 'batting', 'SR neutral: 100-119.99'),
  ('bat_sr_70_84', -2, 'batting', 'SR penalty: 70-84.99'),
  ('bat_sr_50_69', -4, 'batting', 'SR penalty: 50-69.99'),
  ('bat_sr_below_50', -6, 'batting', 'SR penalty: Below 50'),
  -- Bowling
  ('bowl_wicket', 25, 'bowling', 'Points per wicket'),
  ('bowl_3_wickets', 8, 'bowling', 'Bonus for 3 wickets in innings'),
  ('bowl_5_wickets', 16, 'bowling', 'Bonus for 5 wickets in innings'),
  ('bowl_maiden', 12, 'bowling', 'Points per maiden over'),
  ('bowl_wide', -2, 'bowling', 'Penalty per wide'),
  ('bowl_no_ball', -2, 'bowling', 'Penalty per no ball'),
  ('bowl_dot_ball', 1, 'bowling', 'Points per dot ball'),
  -- Economy Rate
  ('bowl_econ_below_3', 6, 'bowling', 'Economy bonus: Below 3 (min 1 over)'),
  ('bowl_econ_3_4_49', 4, 'bowling', 'Economy bonus: 3.00-4.49'),
  ('bowl_econ_4_5_5', 2, 'bowling', 'Economy bonus: 4.50-5.99'),
  ('bowl_econ_8_9', -4, 'bowling', 'Economy penalty: 8.00-9.00'),
  ('bowl_econ_above_9', -6, 'bowling', 'Economy penalty: Above 9'),
  -- Fielding
  ('field_catch', 8, 'fielding', 'Points per catch'),
  ('field_stumping', 4, 'fielding', 'Points per stumping'),
  ('field_runout', 4, 'fielding', 'Points per run out'),
  -- Multipliers
  ('captain_multiplier', 2, 'multipliers', 'Captain points multiplier'),
  ('vice_captain_multiplier', 1.5, 'multipliers', 'Vice-captain points multiplier')
ON CONFLICT (key) DO NOTHING;

-- App Settings
INSERT INTO app_settings (key, value, description) VALUES
  ('team_budget', '10000', 'Total budget for team selection (credits)'),
  ('team_playing_males', '6', 'Number of males in playing XI'),
  ('team_playing_females', '2', 'Number of females in playing XI'),
  ('team_sub_males', '1', 'Number of male substitutes'),
  ('team_sub_females', '1', 'Number of female substitutes'),
  ('registration_open', 'true', 'Whether new user registration is open'),
  ('league_name', 'Daffodils Premier League', 'Name of the fantasy league'),
  ('season_year', '2026', 'Current season year')
ON CONFLICT (key) DO NOTHING;

-- Players (extracted from DFL Premier League file)
-- NOTE: Admin can add/edit players from the admin panel
insert into players (name, gender, flat_number, skill, dpl_team_id, auction_price) VALUES
('Anshul Khedkar','Male','RH 16A','Bowling All Rounder',1,4950),
('Ayam Sahoo','Male','A2-703','Batting All Rounder',2,4300),
('Vedant Shimpi','Male','B2 203','Batting All Rounder',3,4150),
('Raunak','Male','RH-8','Bowling All Rounder',4,3950),
('Mahendra Deore','Male','A4-302','Batting All Rounder',5,3150),
('Saksham shelar','Male','G2 201','Batting All Rounder',7,3150),
('Rajveer Vinod Nanekar','Male','Rh no 28','Batting All Rounder',8,2850),
('Prathmesh Bajaj','Male','A4-205','Batter',9,2750),
('Sachin Soni','Male','RH8','Batting All Rounder',10,2700),
('Devendra Bhadane','Male','E1 602','Batting All Rounder',5,2350),
('Darshan Sharma','Male','A4-603','Batting All Rounder',4,2000),
('Dhruva Nikam','Male','24 B RH','Batting All Rounder',11,2000),
('Raju shelar','Male','G2 201 ','Batting All Rounder',3,2000),
('Saurabh Bansal','Male','D1-702','Batting All Rounder',11,2000),
('Prakhar Mathur','Male','Rh18','Bowling All Rounder',1,2000),
('Saumya Toke','Male','B2 703','Batting All Rounder',9,2000),
('Ashish Sontakke','Male','A1-603','Batting All Rounder',12,2000),
('Anil malhotra','Male','A4-102','Batting All Rounder',7,1950),
('Joginder Saini','Male','F 101','Batting All Rounder',8,1900),
('Rohit Virani','Male','A4 704','Bowling All Rounder',6,1900),
('Sudhanshu Shrivastav','Male','E3-501','Batting All Rounder',10,1750),
('shreyan das','Male','E1-402','Batting All Rounder',6,1700),
('Ritesh Jagtap','Male','RH 28 A','Batter',8,1650),
('Vittej','Male','G1 502','Batting All Rounder',12,1600),
('Ankit Khedkar','Male','16A RH','Batting All Rounder',6,1600),
('Sanjay Banerjee','Male','A2 -702','Bowling All Rounder',6,1550),
('Pankaj Bajaj','Male','A4205','Batting All Rounder',9,1500),
('Saurabh Satpute','Male','A4 202','Bowling All Rounder',10,1500),
('Shweta Vijay Suryawanshi','Female','RH 9','Batting All Rounder',7,1500),
('Aniket Antony','Male','D1-201','Batting All Rounder',2,1500),
('Deep Sharma','Male','A4 603','Batting All Rounder',4,1300),
('Datta Shinde','Male','Flat : 502','Batting All Rounder',12,1300),
('VIJAY BADLANI','Male','A/3/702','Batting All Rounder',11,1300),
('Arnav shelar','Male','G2 201','Bowling All Rounder',1,1050),
('Sharvil','Male','Rh.09','Bowling All Rounder',3,1050),
('Dharmesh Kalsaria','Male','A4-306','Batting All Rounder',10,1000),
('Prasad Deshmukh','Male','E1701','Batting All Rounder',5,1000),
('Niranjan Dake','Male','E3-301','Bowling All Rounder',5,1000),
('Neellohit Burghate','Male','B1-203','Batter',9,1000),
('Vidya Thakare','Female','B2 302','Bowling All Rounder',9,950),
('Kirtish Chaudhari','Male','G2-301','Batting All Rounder',2,950),
('Hiten Badlani','Male','A/3 Flat No 702','Bowling All Rounder',2,950),
('Yajat Chopade','Male','B1-704','Batting All Rounder',11,900),
('Divya Baronia','Female','A2-303','Bowling All Rounder',5,900),
('Sonal Burghate','Female','203- B1','Bowling All Rounder',11,900),
('Aarya Thakare','Female','B2 302','Batting All Rounder',11,850),
('Asmi Sontakke','Female','A1-603','Batting All Rounder',12,850),
('Palakshi Bajaj','Female','A4/205','Batter',8,850),
('Gauri Patil','Female','Row House 4 B','Batter',6,850),
('Prerana Chavan','Female','E2-401','Bowling All Rounder',9,800),
('Sunil Kumar','Male','B1-604','Batting All Rounder',2,800),
('Chetan Mankar','Male','A4 606','Bowler',1,800),
('Rajesh Kharabe','Male','B2 304','Bowling All Rounder',7,750),
('Ashish Naghate','Male','B1 401','Bowling All Rounder',6,750),
('Jitendravansheekumar Shelar','Male','E2-401','Batting All Rounder',10,700),
('Yojana','Female','A4-302','Batting All Rounder',7,700),
('Ravi Khodke','Male','RH#17','Batting All Rounder',3,650),
('Makarand Patil','Male','A1-104','Batting All Rounder',12,650),
('Gaurav','Male','B2-301','Batting All Rounder',2,650),
('Rajveer Patil','Male','A2 204','Bowling All Rounder',11,600),
('Vrushali Sonawane','Female','A4/601','Bowling All Rounder',4,600),
('Jagruti Lalka','Female','A 3 404','Bowler',12,600),
('Jagrati Thakur','Female','D2-602','Bowler',3,600),
('Rahul Bagade','Male','G1 201','Batter',5,550),
('Atharv Sonawane','Male','A4/601','Bowling All Rounder',8,550),
('Ashish Chandlekar','Male','A3-201','Bowler',8,550),
('Suyog','Male','A3 705','Batting All Rounder',8,500),
('Keya Satpute','Female','A4-202','Batting All Rounder',10,500),
('Mohit Agrawal','Male','A2-106','Batting All Rounder',6,500),
('Vritti','Female','A3 404','Batter',8,500),
('Romita Somaanii','Female','16A','Bowling All Rounder',6,500),
('Nirupama','Female','A4 503','Bowling All Rounder',10,500),
('Amit Jaiswal','Male','A2-504','Batter',7,500),
('Anupam Adgaonkar','Male','A3 401','Batting All Rounder',4,500),
('Saurabh Purandare','Male','A3-506','Batter',5,500),
('Mahesh','Male','A2/405','Batter',11,450),
('Mihir Gambhire','Male','B1 703','Batting All Rounder',10,450),
('Shilpa Wagh','Female','A2 601','Bowler',8,450),
('Nalini Bhadane','Female','E1 602','Bowler',7,450),
('Ishita Sharma','Female','A4/604','Batter',4,400),
('Snehal Toke','Female','B2 703','Bowling All Rounder',1,400),
('Mahesh Wagh','Male','A2 601','Batter',6,400),
('Dipesh Merai','Male','A2-502','Batting All Rounder',9,400),
('Rajveer Thorat','Male','F -401','Bowling All Rounder',3,350),
('Jamir Sayyad','Male','RH No 5','Batting All Rounder',7,350),
('Himanshu Saxena','Male','B2 503','Bowling All Rounder',9,350),
('Lalita','Female','A3 505','Batting All Rounder',4,350),
('Purva Harkal','Female','A3-201','Batter',2,350),
('Manisha Bundiwal','Female','A2-504','Batting All Rounder',10,300),
('Abhineet Srivastava','Male','A3 604','Batting All Rounder',12,300),
('Avinash','Male','A4 503','Batter',4,300),
('Advait Prashant Ghangale','Male','A2-701 ','Bowling All Rounder',5,250),
('Rejish Pillai','Male','D1/201','Bowling All Rounder',1,250),
('Anita Khodke','Female','RH 17','Bowler',6,250),
('Anushka Badlani','Female','A/3 Flat No 702','Batting All Rounder',11,250),
('Ashish Baronia','Male','A2-303','Batting All Rounder',12,250),
('Khushi Soni','Female','RH8','Batter',2,250),
('Rachit Bhatia','Male','A2 705','Bowling All Rounder',1,200),
('Archit deokar','Male','A3 306','Bowler',8,200),
('Siddhant karne','Male','E-1 502','Batting All Rounder',12,200),
('Rajul Gupta','Male','B2 404','Batting All Rounder',4,200),
('Prachi Srivastava','Female','A3-604','Batting All Rounder',3,200),
('Ashwini Purohit','Female','B1/204','Bowler',2,150),
('Alka Soni','Female','RH8','Batter',12,150),
('Sujata Purandare','Female','A3 506','Batter',5,150),
('Suvajit Sinha','Male','E3/202','Bowling All Rounder',3,150),
('Itika','Female','A1-101','Batter',5,150),
('Reyansh Karajgaonkar','Male','D1- 301','Bowling All Rounder',8,100),
('Alok Singh','Male','A4-504 ','Bowling All Rounder',11,100),
('Shruti Malushte','Female','E3-402','Batter',1,100),
('Nitin Jayswal','Male','A4 701','Batter',10,100),
('Aayush','Male','A2 305','Bowler',3,100),
('Chinmay Das','Male','E1-402','Batter',2,100),
('Dixit Jada','Male','A4-301','Batting All Rounder',3,100),
('Rahul Badgujar','Male','E2-602','Batter',10,100),
('Kapil Bhargava','Male','E2-202','Batting All Rounder',4,100),
('Deepali Telang','Female','RH 23','Batting All Rounder',1,100),
('Manasee joshi','Female','A1-205','Batter',11,100),
('Kushagra Tare','Male','Rh-27','Bowling All Rounder',2,100),
('Smruti Bajaj','Female','A4205','Bowler',9,100),
('Sumit Khair','Male','A3/302','Batting All Rounder',7,100),
('Akshay Ulmek','Male','G1-402','Batter',1,100),
('Aavirrbhav Siingh','Male','D2/402','Bowler',7,100),
('Piyush kumar','Male','G2 202','Bowler',4,100),
('Mehak','Female','A1-101','Batter',3,100),
('Yatharth Badgujar','Male','A1-101','Batter',9,100)
ON CONFLICT DO NOTHING;

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Function to calculate batting points
CREATE OR REPLACE FUNCTION calculate_batting_points(
  p_runs INTEGER,
  p_balls_faced INTEGER,
  p_fours INTEGER,
  p_sixes INTEGER,
  p_is_out BOOLEAN,
  p_did_bat BOOLEAN
) RETURNS DECIMAL AS $$
DECLARE
  points DECIMAL := 0;
  strike_rate DECIMAL;
BEGIN
  IF NOT p_did_bat THEN RETURN 0; END IF;

  -- Base run points
  points := points + (p_runs * (SELECT value FROM scoring_settings WHERE key = 'bat_run'));

  -- Boundary bonuses
  points := points + (p_fours * (SELECT value FROM scoring_settings WHERE key = 'bat_four'));
  points := points + (p_sixes * (SELECT value FROM scoring_settings WHERE key = 'bat_six'));

  -- Milestone bonuses
  IF p_runs >= 50 THEN
    points := points + (SELECT value FROM scoring_settings WHERE key = 'bat_milestone_50_plus');
  ELSIF p_runs >= 30 THEN
    points := points + (SELECT value FROM scoring_settings WHERE key = 'bat_milestone_30_49');
  ELSIF p_runs >= 15 THEN
    points := points + (SELECT value FROM scoring_settings WHERE key = 'bat_milestone_15_29');
  END IF;

  -- Duck penalty
  IF p_runs = 0 AND p_is_out THEN
    points := points + (SELECT value FROM scoring_settings WHERE key = 'bat_duck');
  END IF;

  -- Strike rate (min 5 balls)
  IF p_balls_faced >= 5 THEN
    strike_rate := (p_runs::DECIMAL / p_balls_faced) * 100;
    IF strike_rate >= 150 THEN
      points := points + (SELECT value FROM scoring_settings WHERE key = 'bat_sr_150_plus');
    ELSIF strike_rate >= 120 THEN
      points := points + (SELECT value FROM scoring_settings WHERE key = 'bat_sr_120_149');
    ELSIF strike_rate >= 100 THEN
      points := points + (SELECT value FROM scoring_settings WHERE key = 'bat_sr_100_119');
    ELSIF strike_rate >= 70 THEN
      points := points + (SELECT value FROM scoring_settings WHERE key = 'bat_sr_70_84');
    ELSIF strike_rate >= 50 THEN
      points := points + (SELECT value FROM scoring_settings WHERE key = 'bat_sr_50_69');
    ELSE
      points := points + (SELECT value FROM scoring_settings WHERE key = 'bat_sr_below_50');
    END IF;
  END IF;

  RETURN points;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate bowling points
CREATE OR REPLACE FUNCTION calculate_bowling_points(
  p_overs DECIMAL,
  p_wickets INTEGER,
  p_runs_conceded INTEGER,
  p_maidens INTEGER,
  p_wides INTEGER,
  p_no_balls INTEGER,
  p_dot_balls INTEGER,
  p_did_bowl BOOLEAN
) RETURNS DECIMAL AS $$
DECLARE
  points DECIMAL := 0;
  economy_rate DECIMAL;
BEGIN
  IF NOT p_did_bowl OR p_overs = 0 THEN RETURN 0; END IF;

  -- Wickets
  points := points + (p_wickets * (SELECT value FROM scoring_settings WHERE key = 'bowl_wicket'));

  -- Wicket milestones
  IF p_wickets >= 5 THEN
    points := points + (SELECT value FROM scoring_settings WHERE key = 'bowl_5_wickets');
  ELSIF p_wickets >= 3 THEN
    points := points + (SELECT value FROM scoring_settings WHERE key = 'bowl_3_wickets');
  END IF;

  -- Maidens
  points := points + (p_maidens * (SELECT value FROM scoring_settings WHERE key = 'bowl_maiden'));

  -- Wides & No balls
  points := points + (p_wides * (SELECT value FROM scoring_settings WHERE key = 'bowl_wide'));
  points := points + (p_no_balls * (SELECT value FROM scoring_settings WHERE key = 'bowl_no_ball'));

  -- Dot balls
  points := points + (p_dot_balls * (SELECT value FROM scoring_settings WHERE key = 'bowl_dot_ball'));

  -- Economy rate (min 1 over)
  IF p_overs >= 1 THEN
    economy_rate := p_runs_conceded::DECIMAL / p_overs;
    IF economy_rate < 3 THEN
      points := points + (SELECT value FROM scoring_settings WHERE key = 'bowl_econ_below_3');
    ELSIF economy_rate <= 4.49 THEN
      points := points + (SELECT value FROM scoring_settings WHERE key = 'bowl_econ_3_4_49');
    ELSIF economy_rate <= 5.99 THEN
      points := points + (SELECT value FROM scoring_settings WHERE key = 'bowl_econ_4_5_5');
    ELSIF economy_rate >= 9 THEN
      points := points + (SELECT value FROM scoring_settings WHERE key = 'bowl_econ_above_9');
    ELSIF economy_rate >= 8 THEN
      points := points + (SELECT value FROM scoring_settings WHERE key = 'bowl_econ_8_9');
    END IF;
  END IF;

  RETURN points;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate fielding points
CREATE OR REPLACE FUNCTION calculate_fielding_points(
  p_catches INTEGER,
  p_stumpings INTEGER,
  p_run_outs INTEGER
) RETURNS DECIMAL AS $$
DECLARE
  points DECIMAL := 0;
BEGIN
  points := points + (p_catches * (SELECT value FROM scoring_settings WHERE key = 'field_catch'));
  points := points + (p_stumpings * (SELECT value FROM scoring_settings WHERE key = 'field_stumping'));
  points := points + (p_run_outs * (SELECT value FROM scoring_settings WHERE key = 'field_runout'));
  RETURN points;
END;
$$ LANGUAGE plpgsql;

-- Function to update player match stats and recalculate fantasy points
CREATE OR REPLACE FUNCTION update_match_points_after_stats(p_match_id INTEGER) RETURNS VOID AS $$
DECLARE
  r_stats RECORD;
  v_fantasy_team RECORD;
  v_captain_id INTEGER;
  v_vc_id INTEGER;
  v_player_points DECIMAL;
  v_team_points DECIMAL;
  v_captain_mult DECIMAL;
  v_vc_mult DECIMAL;
  v_captain_bonus DECIMAL;
  v_vc_bonus DECIMAL;
  v_phase_id INTEGER;
BEGIN
  SELECT phase_id INTO v_phase_id FROM matches WHERE id = p_match_id;
  SELECT value INTO v_captain_mult FROM scoring_settings WHERE key = 'captain_multiplier';
  SELECT value INTO v_vc_mult FROM scoring_settings WHERE key = 'vice_captain_multiplier';

  -- Update points for all fantasy teams in this phase
  FOR v_fantasy_team IN
    SELECT ft.id, ft.captain_id, ft.vice_captain_id, ft.user_id
    FROM fantasy_teams ft
    WHERE ft.phase_id = v_phase_id
  LOOP
    v_team_points := 0;
    v_captain_bonus := 0;
    v_vc_bonus := 0;

    -- Sum points for all playing players in this fantasy team
    FOR r_stats IN
      SELECT pms.player_id, pms.total_points, ftp.is_playing
      FROM player_match_stats pms
      JOIN fantasy_team_players ftp ON ftp.player_id = pms.player_id
        AND ftp.fantasy_team_id = v_fantasy_team.id
      WHERE pms.match_id = p_match_id AND ftp.is_playing = TRUE
    LOOP
      v_player_points := r_stats.total_points;

      -- Apply captain/vc multiplier
      IF r_stats.player_id = v_fantasy_team.captain_id THEN
        v_captain_bonus := v_player_points * (v_captain_mult - 1);
        v_player_points := v_player_points * v_captain_mult;
      ELSIF r_stats.player_id = v_fantasy_team.vice_captain_id THEN
        v_vc_bonus := v_player_points * (v_vc_mult - 1);
        v_player_points := v_player_points * v_vc_mult;
      END IF;

      v_team_points := v_team_points + v_player_points;
    END LOOP;

    -- Upsert match points
    INSERT INTO fantasy_match_points (fantasy_team_id, match_id, raw_points, captain_bonus, vc_bonus, total_points)
    VALUES (v_fantasy_team.id, p_match_id, v_team_points - v_captain_bonus - v_vc_bonus, v_captain_bonus, v_vc_bonus, v_team_points)
    ON CONFLICT (fantasy_team_id, match_id)
    DO UPDATE SET
      raw_points = EXCLUDED.raw_points,
      captain_bonus = EXCLUDED.captain_bonus,
      vc_bonus = EXCLUDED.vc_bonus,
      total_points = EXCLUDED.total_points;
  END LOOP;

  -- Update total points in fantasy_teams
  UPDATE fantasy_teams ft
  SET total_points = (
    SELECT COALESCE(SUM(fmp.total_points), 0)
    FROM fantasy_match_points fmp
    WHERE fmp.fantasy_team_id = ft.id
  )
  WHERE ft.phase_id = v_phase_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger: auto-calculate points when stats are inserted/updated
CREATE OR REPLACE FUNCTION trigger_calculate_stats_points() RETURNS TRIGGER AS $$
BEGIN
  -- Calculate individual stat components
  NEW.batting_points := calculate_batting_points(
    NEW.runs, NEW.balls_faced, NEW.fours, NEW.sixes, NEW.is_out, NEW.did_bat
  );
  NEW.bowling_points := calculate_bowling_points(
    NEW.overs_bowled, NEW.wickets, NEW.runs_conceded, NEW.maidens,
    NEW.wides, NEW.no_balls, NEW.dot_balls, NEW.did_bowl
  );
  NEW.fielding_points := calculate_fielding_points(NEW.catches, NEW.stumpings, NEW.run_outs);
  NEW.total_points := NEW.batting_points + NEW.bowling_points + NEW.fielding_points;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_player_stats_points
  BEFORE INSERT OR UPDATE ON player_match_stats
  FOR EACH ROW EXECUTE FUNCTION trigger_calculate_stats_points();

-- Trigger: update fantasy match points after stats are saved
CREATE OR REPLACE FUNCTION trigger_update_fantasy_points() RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_match_points_after_stats(NEW.match_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_fantasy_points_on_stats
  AFTER INSERT OR UPDATE ON player_match_stats
  FOR EACH ROW EXECUTE FUNCTION trigger_update_fantasy_points();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

COMMENT ON TABLE players IS 'All DPL cricket players available for fantasy selection';
COMMENT ON TABLE fantasy_teams IS 'User fantasy teams per phase';
COMMENT ON TABLE player_match_stats IS 'Match statistics entered by admin after each match';
COMMENT ON TABLE fantasy_match_points IS 'Auto-calculated fantasy points per team per match';


-- Remove old broken trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Recreate with proper error handling
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  counter INT := 0;
BEGIN
  base_username := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''),
    SPLIT_PART(NEW.email, '@', 1)
  );
  base_username := LOWER(REGEXP_REPLACE(base_username, '[^a-zA-Z0-9_]', '', 'g'));
  base_username := LEFT(base_username, 20);
  IF LENGTH(base_username) < 3 THEN base_username := 'user'; END IF;

  final_username := base_username;
  -- Auto-append number if username already taken
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    counter := counter + 1;
    final_username := LEFT(base_username, 17) || counter::TEXT;
  END LOOP;

  INSERT INTO public.profiles (id, username, full_name, flat_number)
  VALUES (
    NEW.id, final_username,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), ''),
    COALESCE(NEW.raw_user_meta_data->>'flat_number', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    username = CASE WHEN profiles.username = '' THEN EXCLUDED.username ELSE profiles.username END,
    full_name = CASE WHEN profiles.full_name = '' THEN EXCLUDED.full_name ELSE profiles.full_name END,
    flat_number = CASE WHEN profiles.flat_number IS NULL THEN EXCLUDED.flat_number ELSE profiles.flat_number END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed: %', SQLERRM;
  RETURN NEW;  -- Never block signup even if profile insert fails
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- DPL Scoring Updates — Run this in Supabase SQL Editor
-- ============================================================

-- 1. ADD: 4-wicket bonus (10 pts)
INSERT INTO scoring_settings (key, value, category, description)
VALUES ('bowl_4_wickets', 10, 'bowling', 'Bonus for 4 wickets in innings')
ON CONFLICT (key) DO UPDATE SET value = 10, description = 'Bonus for 4 wickets in innings';

-- 2. RENAME: "Above 9" → "9.01-12.00" (-6 pts, same value)
UPDATE scoring_settings
SET key = 'bowl_econ_9_12', description = 'Economy penalty: 9.01-12.00'
WHERE key = 'bowl_econ_above_9';

-- 3. ADD: Economy above 12 (-6 pts new tier, harsher)
INSERT INTO scoring_settings (key, value, category, description)
VALUES ('bowl_econ_above_12', -8, 'bowling', 'Economy penalty: Above 12.00')
ON CONFLICT (key) DO UPDATE SET value = -8, description = 'Economy penalty: Above 12.00';

-- ============================================================
-- 4. FEMALE SCORING RULES — separate table
-- ============================================================

CREATE TABLE IF NOT EXISTS scoring_settings_female (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value DECIMAL(10,2) NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE scoring_settings_female ENABLE ROW LEVEL SECURITY;

-- Drop policies first (safe to re-run)
DROP POLICY IF EXISTS "Female scoring visible to all" ON scoring_settings_female;
DROP POLICY IF EXISTS "Admin can manage female scoring" ON scoring_settings_female;

CREATE POLICY "Female scoring visible to all" ON scoring_settings_female FOR SELECT USING (TRUE);
CREATE POLICY "Admin can manage female scoring" ON scoring_settings_female FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);

-- Seed female scoring (same defaults as male — admin can customise via UI)
INSERT INTO scoring_settings_female (key, value, category, description) VALUES
  -- Batting
  ('bat_run', 1, 'batting', 'Points per run'),
  ('bat_four', 4, 'batting', 'Points per four (boundary)'),
  ('bat_six', 6, 'batting', 'Points per six'),
  ('bat_milestone_15_29', 4, 'batting', 'Bonus for 15-29 runs in an innings'),
  ('bat_milestone_30_49', 8, 'batting', 'Bonus for 30-49 runs in an innings'),
  ('bat_milestone_50_plus', 16, 'batting', 'Bonus for 50+ runs in an innings'),
  ('bat_duck', -4, 'batting', 'Penalty for duck (0 runs, dismissed)'),
  -- Strike Rate
  ('bat_sr_150_plus', 6, 'batting', 'SR bonus: 150 and above'),
  ('bat_sr_120_149', 4, 'batting', 'SR bonus: 120-149.99'),
  ('bat_sr_100_119', 0, 'batting', 'SR neutral: 100-119.99'),
  ('bat_sr_70_84', -2, 'batting', 'SR penalty: 70-84.99'),
  ('bat_sr_50_69', -4, 'batting', 'SR penalty: 50-69.99'),
  ('bat_sr_below_50', -6, 'batting', 'SR penalty: Below 50'),
  -- Bowling
  ('bowl_wicket', 25, 'bowling', 'Points per wicket'),
  ('bowl_3_wickets', 8, 'bowling', 'Bonus for 3 wickets in innings'),
  ('bowl_4_wickets', 10, 'bowling', 'Bonus for 4 wickets in innings'),
  ('bowl_5_wickets', 16, 'bowling', 'Bonus for 5 wickets in innings'),
  ('bowl_maiden', 12, 'bowling', 'Points per maiden over'),
  ('bowl_wide', -2, 'bowling', 'Penalty per wide'),
  ('bowl_no_ball', -2, 'bowling', 'Penalty per no ball'),
  ('bowl_dot_ball', 1, 'bowling', 'Points per dot ball'),
  -- Economy
  ('bowl_econ_below_3', 6, 'bowling', 'Economy bonus: Below 3.00'),
  ('bowl_econ_3_4_49', 4, 'bowling', 'Economy bonus: 3.00-4.49'),
  ('bowl_econ_4_5_5', 2, 'bowling', 'Economy bonus: 4.50-5.99'),
  ('bowl_econ_8_9', -4, 'bowling', 'Economy penalty: 8.00-9.00'),
  ('bowl_econ_9_12', -6, 'bowling', 'Economy penalty: 9.01-12.00'),
  ('bowl_econ_above_12', -8, 'bowling', 'Economy penalty: Above 12.00'),
  -- Fielding
  ('field_catch', 8, 'fielding', 'Points per catch'),
  ('field_stumping', 4, 'fielding', 'Points per stumping'),
  ('field_runout', 4, 'fielding', 'Points per run out'),
  -- Multipliers
  ('captain_multiplier', 2, 'multipliers', 'Captain points multiplier'),
  ('vice_captain_multiplier', 1.5, 'multipliers', 'Vice-captain points multiplier')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Update calculate_bowling_points function with new rules
-- ============================================================

CREATE OR REPLACE FUNCTION calculate_bowling_points(
  p_overs DECIMAL,
  p_wickets INTEGER,
  p_runs_conceded INTEGER,
  p_maidens INTEGER,
  p_wides INTEGER,
  p_no_balls INTEGER,
  p_dot_balls INTEGER,
  p_did_bowl BOOLEAN,
  p_gender TEXT DEFAULT 'Male'
) RETURNS DECIMAL AS $$
DECLARE
  points DECIMAL := 0;
  economy_rate DECIMAL;
  tbl TEXT;
BEGIN
  IF NOT p_did_bowl OR p_overs = 0 THEN RETURN 0; END IF;

  -- Pick scoring table based on gender
  tbl := CASE WHEN LOWER(p_gender) = 'female' THEN 'scoring_settings_female' ELSE 'scoring_settings' END;

  -- Wickets
  IF tbl = 'scoring_settings_female' THEN
    points := points + (p_wickets * (SELECT value FROM scoring_settings_female WHERE key = 'bowl_wicket'));
    IF p_wickets >= 5 THEN
      points := points + (SELECT value FROM scoring_settings_female WHERE key = 'bowl_5_wickets');
    ELSIF p_wickets = 4 THEN
      points := points + (SELECT value FROM scoring_settings_female WHERE key = 'bowl_4_wickets');
    ELSIF p_wickets = 3 THEN
      points := points + (SELECT value FROM scoring_settings_female WHERE key = 'bowl_3_wickets');
    END IF;
    points := points + (p_maidens * (SELECT value FROM scoring_settings_female WHERE key = 'bowl_maiden'));
    points := points + (p_wides   * (SELECT value FROM scoring_settings_female WHERE key = 'bowl_wide'));
    points := points + (p_no_balls * (SELECT value FROM scoring_settings_female WHERE key = 'bowl_no_ball'));
    points := points + (p_dot_balls * (SELECT value FROM scoring_settings_female WHERE key = 'bowl_dot_ball'));
    IF p_overs >= 1 THEN
      economy_rate := p_runs_conceded::DECIMAL / p_overs;
      IF    economy_rate < 3     THEN points := points + (SELECT value FROM scoring_settings_female WHERE key = 'bowl_econ_below_3');
      ELSIF economy_rate <= 4.49 THEN points := points + (SELECT value FROM scoring_settings_female WHERE key = 'bowl_econ_3_4_49');
      ELSIF economy_rate <= 5.99 THEN points := points + (SELECT value FROM scoring_settings_female WHERE key = 'bowl_econ_4_5_5');
      ELSIF economy_rate > 12    THEN points := points + (SELECT value FROM scoring_settings_female WHERE key = 'bowl_econ_above_12');
      ELSIF economy_rate >= 9.01 THEN points := points + (SELECT value FROM scoring_settings_female WHERE key = 'bowl_econ_9_12');
      ELSIF economy_rate >= 8    THEN points := points + (SELECT value FROM scoring_settings_female WHERE key = 'bowl_econ_8_9');
      END IF;
    END IF;
  ELSE
    points := points + (p_wickets * (SELECT value FROM scoring_settings WHERE key = 'bowl_wicket'));
    IF p_wickets >= 5 THEN
      points := points + (SELECT value FROM scoring_settings WHERE key = 'bowl_5_wickets');
    ELSIF p_wickets = 4 THEN
      points := points + (SELECT value FROM scoring_settings WHERE key = 'bowl_4_wickets');
    ELSIF p_wickets = 3 THEN
      points := points + (SELECT value FROM scoring_settings WHERE key = 'bowl_3_wickets');
    END IF;
    points := points + (p_maidens   * (SELECT value FROM scoring_settings WHERE key = 'bowl_maiden'));
    points := points + (p_wides     * (SELECT value FROM scoring_settings WHERE key = 'bowl_wide'));
    points := points + (p_no_balls  * (SELECT value FROM scoring_settings WHERE key = 'bowl_no_ball'));
    points := points + (p_dot_balls * (SELECT value FROM scoring_settings WHERE key = 'bowl_dot_ball'));
    IF p_overs >= 1 THEN
      economy_rate := p_runs_conceded::DECIMAL / p_overs;
      IF    economy_rate < 3     THEN points := points + (SELECT value FROM scoring_settings WHERE key = 'bowl_econ_below_3');
      ELSIF economy_rate <= 4.49 THEN points := points + (SELECT value FROM scoring_settings WHERE key = 'bowl_econ_3_4_49');
      ELSIF economy_rate <= 5.99 THEN points := points + (SELECT value FROM scoring_settings WHERE key = 'bowl_econ_4_5_5');
      ELSIF economy_rate > 12    THEN points := points + (SELECT value FROM scoring_settings WHERE key = 'bowl_econ_above_12');
      ELSIF economy_rate >= 9.01 THEN points := points + (SELECT value FROM scoring_settings WHERE key = 'bowl_econ_9_12');
      ELSIF economy_rate >= 8    THEN points := points + (SELECT value FROM scoring_settings WHERE key = 'bowl_econ_8_9');
      END IF;
    END IF;
  END IF;

  RETURN points;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Update calculate_batting_points to support gender
-- ============================================================

CREATE OR REPLACE FUNCTION calculate_batting_points(
  p_runs INTEGER,
  p_balls_faced INTEGER,
  p_fours INTEGER,
  p_sixes INTEGER,
  p_is_out BOOLEAN,
  p_did_bat BOOLEAN,
  p_gender TEXT DEFAULT 'Male'
) RETURNS DECIMAL AS $$
DECLARE
  points DECIMAL := 0;
  strike_rate DECIMAL;
BEGIN
  IF NOT p_did_bat THEN RETURN 0; END IF;

  IF LOWER(p_gender) = 'female' THEN
    points := points + (p_runs   * (SELECT value FROM scoring_settings_female WHERE key = 'bat_run'));
    points := points + (p_fours  * (SELECT value FROM scoring_settings_female WHERE key = 'bat_four'));
    points := points + (p_sixes  * (SELECT value FROM scoring_settings_female WHERE key = 'bat_six'));
    IF p_runs >= 50 THEN
      points := points + (SELECT value FROM scoring_settings_female WHERE key = 'bat_milestone_50_plus');
    ELSIF p_runs >= 30 THEN
      points := points + (SELECT value FROM scoring_settings_female WHERE key = 'bat_milestone_30_49');
    ELSIF p_runs >= 15 THEN
      points := points + (SELECT value FROM scoring_settings_female WHERE key = 'bat_milestone_15_29');
    END IF;
    IF p_runs = 0 AND p_is_out THEN
      points := points + (SELECT value FROM scoring_settings_female WHERE key = 'bat_duck');
    END IF;
    IF p_balls_faced >= 5 THEN
      strike_rate := (p_runs::DECIMAL / p_balls_faced) * 100;
      IF    strike_rate >= 150 THEN points := points + (SELECT value FROM scoring_settings_female WHERE key = 'bat_sr_150_plus');
      ELSIF strike_rate >= 120 THEN points := points + (SELECT value FROM scoring_settings_female WHERE key = 'bat_sr_120_149');
      ELSIF strike_rate >= 100 THEN points := points + (SELECT value FROM scoring_settings_female WHERE key = 'bat_sr_100_119');
      ELSIF strike_rate >= 70  THEN points := points + (SELECT value FROM scoring_settings_female WHERE key = 'bat_sr_70_84');
      ELSIF strike_rate >= 50  THEN points := points + (SELECT value FROM scoring_settings_female WHERE key = 'bat_sr_50_69');
      ELSE                          points := points + (SELECT value FROM scoring_settings_female WHERE key = 'bat_sr_below_50');
      END IF;
    END IF;
  ELSE
    points := points + (p_runs  * (SELECT value FROM scoring_settings WHERE key = 'bat_run'));
    points := points + (p_fours * (SELECT value FROM scoring_settings WHERE key = 'bat_four'));
    points := points + (p_sixes * (SELECT value FROM scoring_settings WHERE key = 'bat_six'));
    IF p_runs >= 50 THEN
      points := points + (SELECT value FROM scoring_settings WHERE key = 'bat_milestone_50_plus');
    ELSIF p_runs >= 30 THEN
      points := points + (SELECT value FROM scoring_settings WHERE key = 'bat_milestone_30_49');
    ELSIF p_runs >= 15 THEN
      points := points + (SELECT value FROM scoring_settings WHERE key = 'bat_milestone_15_29');
    END IF;
    IF p_runs = 0 AND p_is_out THEN
      points := points + (SELECT value FROM scoring_settings WHERE key = 'bat_duck');
    END IF;
    IF p_balls_faced >= 5 THEN
      strike_rate := (p_runs::DECIMAL / p_balls_faced) * 100;
      IF    strike_rate >= 150 THEN points := points + (SELECT value FROM scoring_settings WHERE key = 'bat_sr_150_plus');
      ELSIF strike_rate >= 120 THEN points := points + (SELECT value FROM scoring_settings WHERE key = 'bat_sr_120_149');
      ELSIF strike_rate >= 100 THEN points := points + (SELECT value FROM scoring_settings WHERE key = 'bat_sr_100_119');
      ELSIF strike_rate >= 70  THEN points := points + (SELECT value FROM scoring_settings WHERE key = 'bat_sr_70_84');
      ELSIF strike_rate >= 50  THEN points := points + (SELECT value FROM scoring_settings WHERE key = 'bat_sr_50_69');
      ELSE                          points := points + (SELECT value FROM scoring_settings WHERE key = 'bat_sr_below_50');
      END IF;
    END IF;
  END IF;

  RETURN points;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Update calculate_fielding_points to support gender
-- ============================================================

CREATE OR REPLACE FUNCTION calculate_fielding_points(
  p_catches INTEGER,
  p_stumpings INTEGER,
  p_run_outs INTEGER,
  p_gender TEXT DEFAULT 'Male'
) RETURNS DECIMAL AS $$
DECLARE
  points DECIMAL := 0;
BEGIN
  IF LOWER(p_gender) = 'female' THEN
    points := points + (p_catches   * (SELECT value FROM scoring_settings_female WHERE key = 'field_catch'));
    points := points + (p_stumpings * (SELECT value FROM scoring_settings_female WHERE key = 'field_stumping'));
    points := points + (p_run_outs  * (SELECT value FROM scoring_settings_female WHERE key = 'field_runout'));
  ELSE
    points := points + (p_catches   * (SELECT value FROM scoring_settings WHERE key = 'field_catch'));
    points := points + (p_stumpings * (SELECT value FROM scoring_settings WHERE key = 'field_stumping'));
    points := points + (p_run_outs  * (SELECT value FROM scoring_settings WHERE key = 'field_runout'));
  END IF;
  RETURN points;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Update the trigger to pass player gender into functions
-- ============================================================

CREATE OR REPLACE FUNCTION trigger_calculate_stats_points() RETURNS TRIGGER AS $$
DECLARE
  v_gender TEXT;
BEGIN
  -- Fetch player gender
  SELECT gender INTO v_gender FROM players WHERE id = NEW.player_id;
  v_gender := COALESCE(v_gender, 'Male');

  NEW.batting_points  := calculate_batting_points(
    NEW.runs, NEW.balls_faced, NEW.fours, NEW.sixes, NEW.is_out, NEW.did_bat, v_gender
  );
  NEW.bowling_points  := calculate_bowling_points(
    NEW.overs_bowled, NEW.wickets, NEW.runs_conceded, NEW.maidens,
    NEW.wides, NEW.no_balls, NEW.dot_balls, NEW.did_bowl, v_gender
  );
  NEW.fielding_points := calculate_fielding_points(NEW.catches, NEW.stumpings, NEW.run_outs, v_gender);
  NEW.total_points    := NEW.batting_points + NEW.bowling_points + NEW.fielding_points;
  NEW.updated_at      := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;