---
name: dpl-app
description: 'Use for development tasks in the DPL fantasy cricket league app, including adding features, fixing bugs, understanding the codebase, and maintaining the fantasy sports platform.'
---

# DPL Fantasy Cricket League App Skill

## Project Overview
The DPL app is a React-based web application for managing a fantasy cricket league. It allows users to register, select teams, view player stats, track match results, and participate in a leaderboard system. Admins can manage players, teams, matches, and scoring through a dedicated admin panel.

## Technologies Used
- **Frontend**: React with Vite for build tooling
- **Backend**: Supabase (PostgreSQL database with real-time capabilities, authentication)
- **Styling**: Tailwind CSS
- **Deployment**: Netlify and Vercel configurations included

## Key Features
- User authentication and profiles
- Team selection and management per phase
- Player statistics and leaderboard
- Match tracking and scoring
- Admin dashboard for league management
- Responsive design for mobile and desktop

## Database Schema
- **profiles**: User profiles extending Supabase auth
- **dpl_teams**: Actual cricket teams in the league
- **players**: Player data with skills (Batter, Bowler, etc.)
- **phases**: League phases with transfer rules
- **matches**: Match details and results
- **fantasy_teams**: User's selected fantasy teams
- **transfers**: Player transfers between phases
- **match_stats**: Detailed player performance in matches

## Architecture
- **src/**: Main application code
  - **components/**: Reusable UI components (Layout)
  - **context/**: React context for authentication
  - **pages/**: Page components for different views
    - User pages: Landing, Login, Register, UserDashboard, TeamSelection, PlayerStats, Leaderboard
    - Admin pages: AdminDashboard, AdminPlayers, AdminTeams, AdminMatches, etc.
- **supabase/**: Database schema
- **public/**: Static assets

## Common Patterns
- Uses React hooks for state management
- Supabase client for database operations
- Tailwind classes for styling
- Responsive grid layouts
- Form handling with controlled components

## Development Guidelines
- Follow React best practices
- Use Supabase for all data operations
- Maintain mobile-first responsive design
- Test changes in both user and admin flows
- Update schema.sql for any database changes

## Recent Updates
- Real-time match updates implementation
- User notifications system
- Bug fixes in scoring calculations
- Improved mobile responsiveness
- Advanced player statistics dashboard