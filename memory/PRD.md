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

## Iteration 2 (2026-07-02) — Auth + Forgot Password v2
- Login: on-blur email format validation; distinct errors for unregistered email (404) vs wrong password (401)
- Forgot password rebuilt as a 3-step OTP flow (email → 6-digit code → new password)
- Backend: OTP hashed with bcrypt, 10-min expiry, 5-attempt limit, 30s resend cooldown, 3 req/15min rate limit
- Success redirects to `/login?reset=1` with a green "Password updated" banner
- Mongo client now `tz_aware=True` to safely compare stored expiries

## Iteration 3 (2026-07-02) — Resend integration (real API key)
- Signup now requires **email verification** (6-digit OTP, 5-min expiry) before login is allowed
- New `/verify-email?email=...` page with 5:00 countdown, 30s resend cooldown, 5-attempt cap
- `verified=true` gate on login (403 until verified); unverified re-signup replaces password + re-issues OTP
- Forgot Password switched to **link-based** (secrets.token_urlsafe(32), stored bcrypt-hashed, 15-min expiry)
- Emails are sent via **Resend** from `onboarding@resend.dev` for both flows; OTP + reset link are also logged to backend logs for dev retrieval
- Rate limits: 3 requests / 15 min per email on both signup OTPs and forgot-password tokens

## Deferred / backlog (P1/P2)
- P1: Repository analysis (LLM grading + acceptance criteria checks)
- P1: Streaks and scoring based on real activity
- P1: Real Resend key (currently unset — reset link is logged server-side)
- P2: Email verification on signup
- P2: Recruiter portal / hiring features
- P2: Admin dashboard for authoring challenges

## Test credentials
See `/app/memory/test_credentials.md`.
