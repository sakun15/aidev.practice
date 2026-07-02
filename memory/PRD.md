# PRD — AI-Native Software Engineering Interview Practice Platform

## Original problem statement
Build the MVP of an AI-native software engineering interview practice platform. Users practice real
software engineering tasks (not DSA) using AI tools. Modern, premium, minimal, professional design.
Auth via email + password only. Onboarding, dashboard, challenge library (15 real tasks), challenge
detail with GitHub submission, profile, and clean sidebar navigation.

## Tech decisions (agreed with user)
- Frontend: React 19 + Tailwind + Shadcn (React not Next.js — environment constraint)
- Backend: FastAPI + Motor/MongoDB (not Postgres — environment constraint)
- Auth: JWT (bcrypt) via httpOnly cookies (SameSite=None; Secure)
- Emails: Resend (falls back to console log when no API key)
- Theme: Apple-inspired light theme per user-provided design.md (not dark mode)

## User personas
- Student preparing for internships/placements
- Working professional sharpening AI-native skills
- Career switcher

## Core requirements (locked)
1. Email/password auth (register, login, logout, forgot, reset, me, refresh)
2. Two-step onboarding (user type + AI experience)
3. Dashboard (welcome, skill level, solved/streak/score/attempts, continue, recommended, recent)
4. Challenges list with 15 seeded items + search + difficulty + category filters
5. Challenge detail with problem, requirements, acceptance, GitHub URL submission
6. My submissions
7. Profile (name, email, type, experience, joined, attempts, solved)
8. Sidebar: Dashboard, Challenges, My Submissions, Profile, Settings, Logout

## Implemented (2026-07-01)
- Backend `/api/*`: auth, challenges, submissions, stats, onboarding, forgot/reset
- 15 seeded challenges (Easy 5 / Medium 6 / Hard 4)
- Brute-force lockout, unique email index, TTL for reset tokens
- Apple design system in Tailwind + CSS tokens (SF Pro / Inter fallback)
- Landing, Login, Signup, Forgot, Reset, Onboarding, Dashboard, Challenges,
  ChallengeDetail, MySubmissions, Profile, Settings, ProtectedRoute, AppShell

## Deferred / backlog (P1/P2)
- P1: Repository analysis (LLM grading + acceptance criteria checks)
- P1: Streaks and scoring based on real activity
- P1: Real Resend key (currently unset — reset link is logged server-side)
- P2: Email verification on signup
- P2: Recruiter portal / hiring features
- P2: Admin dashboard for authoring challenges

## Test credentials
See `/app/memory/test_credentials.md`.
