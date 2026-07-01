from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import asyncio
import logging
import secrets
import re
from datetime import datetime, timezone, timedelta
from typing import List, Optional

import bcrypt
import jwt
import resend
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field, field_validator


# ---------- Config ----------
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 60 * 24  # 1 day for convenience in MVP
REFRESH_TOKEN_DAYS = 7

mongo_url = os.environ["MONGO_URL"]
db_name = os.environ["DB_NAME"]
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

resend.api_key = os.environ.get("RESEND_API_KEY", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("app")


# ---------- Utilities ----------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_DAYS),
        "type": "refresh",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access: str, refresh: str) -> None:
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none",
                        max_age=ACCESS_TOKEN_MINUTES * 60, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none",
                        max_age=REFRESH_TOKEN_DAYS * 86400, path="/")


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")


def user_public(user: dict) -> dict:
    return {
        "id": str(user["_id"]),
        "full_name": user.get("full_name", ""),
        "email": user["email"],
        "role": user.get("role", "user"),
        "ai_experience": user.get("ai_experience"),
        "user_type": user.get("user_type"),
        "onboarded": bool(user.get("onboarded", False)),
        "created_at": user["created_at"].isoformat() if isinstance(user.get("created_at"), datetime) else user.get("created_at"),
    }


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ---------- Pydantic models ----------
STRONG_PW = re.compile(r"^(?=.*[A-Za-z])(?=.*\d).{8,}$")


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str
    confirm_password: str

    @field_validator("password")
    @classmethod
    def strong(cls, v: str) -> str:
        if not STRONG_PW.match(v):
            raise ValueError("Password must be at least 8 characters and include a letter and a number")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def strong(cls, v: str) -> str:
        if not STRONG_PW.match(v):
            raise ValueError("Password must be at least 8 characters and include a letter and a number")
        return v


class OnboardingRequest(BaseModel):
    user_type: str
    ai_experience: str


class SubmissionRequest(BaseModel):
    challenge_id: str
    github_url: str

    @field_validator("github_url")
    @classmethod
    def valid_gh(cls, v: str) -> str:
        pattern = r"^https?:\/\/(www\.)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$"
        if not re.match(pattern, v.strip()):
            raise ValueError("Enter a valid GitHub repository URL, e.g. https://github.com/user/repo")
        return v.strip()


# ---------- FastAPI app + router ----------
app = FastAPI(title="AI Interview Practice API")
api = APIRouter(prefix="/api")


@api.get("/")
async def root():
    return {"message": "AI Interview Practice API"}


# ---------- Auth routes ----------
@api.post("/auth/register")
async def register(req: RegisterRequest, response: Response):
    if req.password != req.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    email = req.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {
        "full_name": req.full_name.strip(),
        "email": email,
        "password_hash": hash_password(req.password),
        "role": "user",
        "ai_experience": None,
        "user_type": None,
        "onboarded": False,
        "created_at": datetime.now(timezone.utc),
    }
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    access = create_access_token(str(res.inserted_id), email)
    refresh = create_refresh_token(str(res.inserted_id))
    set_auth_cookies(response, access, refresh)
    return user_public(doc)


@api.post("/auth/login")
async def login(req: LoginRequest, request: Request, response: Response):
    email = req.email.lower().strip()
    ip = request.client.host if request.client else "unknown"
    key = f"{ip}:{email}"

    attempt = await db.login_attempts.find_one({"identifier": key})
    if attempt and attempt.get("locked_until") and attempt["locked_until"] > datetime.now(timezone.utc):
        raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(req.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": key},
            {"$inc": {"count": 1},
             "$set": {"locked_until": datetime.now(timezone.utc) + timedelta(minutes=15) if (attempt and attempt.get("count", 0) + 1 >= 5) else None}},
            upsert=True,
        )
        raise HTTPException(status_code=401, detail="Invalid email or password")

    await db.login_attempts.delete_one({"identifier": key})
    access = create_access_token(str(user["_id"]), email)
    refresh = create_refresh_token(str(user["_id"]))
    set_auth_cookies(response, access, refresh)
    return user_public(user)


@api.post("/auth/logout")
async def logout(response: Response):
    clear_auth_cookies(response)
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user_public(user)


@api.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        access = create_access_token(str(user["_id"]), user["email"])
        response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none",
                            max_age=ACCESS_TOKEN_MINUTES * 60, path="/")
        return {"ok": True}
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")


async def send_reset_email(email: str, reset_link: str) -> None:
    if not resend.api_key:
        logger.info(f"[FORGOT PASSWORD] Reset link for {email}: {reset_link}")
        return
    html = f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#f5f5f7;padding:40px 20px;">
      <table style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:40px;">
        <tr><td>
          <h1 style="font-size:28px;color:#1d1d1f;margin:0 0 16px;letter-spacing:-0.4px;">Reset your password</h1>
          <p style="font-size:17px;color:#333333;line-height:1.5;margin:0 0 24px;">Click the button below to set a new password. This link expires in 1 hour.</p>
          <a href="{reset_link}" style="display:inline-block;background:#0071e3;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:980px;font-size:15px;">Reset password</a>
          <p style="font-size:13px;color:#707070;margin-top:24px;">If you didn't request this, you can safely ignore this email.</p>
        </td></tr>
      </table>
    </div>
    """
    try:
        await asyncio.to_thread(resend.Emails.send, {
            "from": SENDER_EMAIL,
            "to": [email],
            "subject": "Reset your password",
            "html": html,
        })
    except Exception as e:
        logger.error(f"Resend send failed: {e}")


@api.post("/auth/forgot-password")
async def forgot_password(req: ForgotPasswordRequest):
    email = req.email.lower().strip()
    user = await db.users.find_one({"email": email})
    # Always respond success to prevent enumeration
    if user:
        token = secrets.token_urlsafe(32)
        await db.password_reset_tokens.insert_one({
            "token": token,
            "user_id": str(user["_id"]),
            "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
            "used": False,
        })
        link = f"{FRONTEND_URL}/reset-password?token={token}"
        await send_reset_email(email, link)
    return {"ok": True, "message": "If an account exists, a reset link has been sent."}


@api.post("/auth/reset-password")
async def reset_password(req: ResetPasswordRequest):
    doc = await db.password_reset_tokens.find_one({"token": req.token})
    if not doc or doc.get("used") or doc["expires_at"] < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    await db.users.update_one({"_id": ObjectId(doc["user_id"])},
                              {"$set": {"password_hash": hash_password(req.new_password)}})
    await db.password_reset_tokens.update_one({"token": req.token}, {"$set": {"used": True}})
    return {"ok": True}


@api.post("/auth/onboarding")
async def onboarding(req: OnboardingRequest, user: dict = Depends(get_current_user)):
    valid_types = {"student", "internships", "placements", "professional", "switcher"}
    valid_exp = {"beginner", "intermediate", "advanced"}
    if req.user_type not in valid_types or req.ai_experience not in valid_exp:
        raise HTTPException(status_code=400, detail="Invalid selection")
    await db.users.update_one({"_id": user["_id"]},
                              {"$set": {"user_type": req.user_type,
                                        "ai_experience": req.ai_experience,
                                        "onboarded": True}})
    updated = await db.users.find_one({"_id": user["_id"]})
    return user_public(updated)


# ---------- Challenges ----------
@api.get("/challenges")
async def list_challenges():
    docs = await db.challenges.find({}, {"_id": 0}).sort("order", 1).to_list(500)
    return docs


@api.get("/challenges/{slug}")
async def get_challenge(slug: str):
    doc = await db.challenges.find_one({"slug": slug}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Challenge not found")
    return doc


# ---------- Submissions ----------
@api.post("/submissions")
async def create_submission(req: SubmissionRequest, user: dict = Depends(get_current_user)):
    challenge = await db.challenges.find_one({"slug": req.challenge_id}, {"_id": 0})
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    doc = {
        "user_id": str(user["_id"]),
        "challenge_slug": req.challenge_id,
        "challenge_title": challenge["title"],
        "challenge_difficulty": challenge["difficulty"],
        "github_url": req.github_url,
        "created_at": datetime.now(timezone.utc),
    }
    res = await db.submissions.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    doc["created_at"] = doc["created_at"].isoformat()
    doc.pop("_id", None)
    return doc


@api.get("/submissions")
async def list_my_submissions(user: dict = Depends(get_current_user)):
    docs = await db.submissions.find({"user_id": str(user["_id"])}).sort("created_at", -1).to_list(500)
    for d in docs:
        d["id"] = str(d.pop("_id"))
        if isinstance(d.get("created_at"), datetime):
            d["created_at"] = d["created_at"].isoformat()
    return docs


@api.get("/me/stats")
async def my_stats(user: dict = Depends(get_current_user)):
    uid = str(user["_id"])
    total = await db.submissions.count_documents({"user_id": uid})
    solved = len(await db.submissions.distinct("challenge_slug", {"user_id": uid}))
    return {"attempts": total, "solved": solved, "streak": 0, "score": solved * 10}


# ---------- Seed data ----------
SEED_CHALLENGES = [
    # Easy
    {"slug": "login-page", "order": 1, "difficulty": "Easy", "category": "Frontend", "estimated_time": "45 min",
     "title": "Build a Login Page",
     "description": "Design and implement a production-ready login page for a SaaS application. Focus on validation, accessibility, and a clean, responsive UI.",
     "requirements": ["Email field with validation", "Password field", "Login button", "Client-side validation with clear error states", "Responsive layout"],
     "acceptance": ["Proper validation of email and password", "Mobile responsive", "Accessible form labels and focus states", "Loading and error states handled"]},
    {"slug": "forgot-password-page", "order": 2, "difficulty": "Easy", "category": "Frontend", "estimated_time": "30 min",
     "title": "Build a Forgot Password Page",
     "description": "Create a forgot-password screen that captures an email address and confirms that a reset link was sent.",
     "requirements": ["Email input", "Reset button", "Success confirmation state", "Client-side email validation"],
     "acceptance": ["Prevents empty submission", "Clear success state", "Responsive UI"]},
    {"slug": "signup-page", "order": 3, "difficulty": "Easy", "category": "Authentication", "estimated_time": "45 min",
     "title": "Build a Signup Page",
     "description": "Build a signup screen that collects the user's name, email, password, and password confirmation.",
     "requirements": ["Full Name", "Email", "Password", "Confirm Password", "Strong password validation"],
     "acceptance": ["Passwords must match", "Strong password rule enforced", "Inline validation", "Responsive UI"]},
    {"slug": "responsive-navbar", "order": 4, "difficulty": "Easy", "category": "Frontend", "estimated_time": "40 min",
     "title": "Build a Responsive Navigation Bar",
     "description": "Design a navigation bar that adapts gracefully from mobile to desktop with a hamburger menu on smaller viewports.",
     "requirements": ["Logo", "Primary links", "Mobile menu", "Sticky behaviour on scroll"],
     "acceptance": ["Works from 320px to 1440px+", "Hamburger toggles on mobile", "Keyboard-navigable"]},
    {"slug": "contact-form", "order": 5, "difficulty": "Easy", "category": "Frontend", "estimated_time": "40 min",
     "title": "Build a Contact Form",
     "description": "Build a contact form with name, email, and message fields, including validation and a submission success state.",
     "requirements": ["Name, email, message", "Client-side validation", "Success and error states"],
     "acceptance": ["Empty submissions blocked", "Email format enforced", "Accessible labels"]},
    # Medium
    {"slug": "jwt-auth", "order": 6, "difficulty": "Medium", "category": "Authentication", "estimated_time": "2 hours",
     "title": "Build JWT Authentication",
     "description": "Implement email/password authentication with JWT access + refresh tokens and a protected /me endpoint.",
     "requirements": ["POST /register", "POST /login", "GET /me (protected)", "Password hashing", "Access + refresh tokens"],
     "acceptance": ["Passwords never stored in plain text", "Tokens signed and verified", "Invalid tokens rejected"]},
    {"slug": "user-profile", "order": 7, "difficulty": "Medium", "category": "Full Stack", "estimated_time": "2 hours",
     "title": "Build a User Profile Page",
     "description": "Create a profile page where the authenticated user can view and edit their name and email, backed by an API.",
     "requirements": ["GET /profile", "PATCH /profile", "Client form with validation", "Persist changes"],
     "acceptance": ["Only authenticated users can update", "Email uniqueness enforced", "UI reflects saved state"]},
    {"slug": "notes-crud", "order": 8, "difficulty": "Medium", "category": "Full Stack", "estimated_time": "3 hours",
     "title": "Build a CRUD Notes App",
     "description": "Build a full-stack notes app: create, list, edit, and delete notes owned by the current user.",
     "requirements": ["CRUD endpoints", "List, create, edit, delete UI", "Owner-scoped access"],
     "acceptance": ["Only owner can modify own notes", "Optimistic or clear loading states", "Basic pagination or infinite list"]},
    {"slug": "todo-api", "order": 9, "difficulty": "Medium", "category": "APIs", "estimated_time": "1.5 hours",
     "title": "Build a Todo API",
     "description": "Design a REST API for a todo list with filtering (all/active/completed) and marking items complete.",
     "requirements": ["POST/GET/PATCH/DELETE /todos", "Filter by status", "Validation"],
     "acceptance": ["Documented request/response shapes", "400s on bad input", "Correct HTTP verbs"]},
    {"slug": "file-upload", "order": 10, "difficulty": "Medium", "category": "Backend", "estimated_time": "2 hours",
     "title": "Build a File Upload System",
     "description": "Accept multipart file uploads with size/type limits and return a URL to retrieve the uploaded file.",
     "requirements": ["POST /upload (multipart)", "Size + MIME validation", "GET file by id"],
     "acceptance": ["Rejects unsupported types", "Rejects oversized files", "Serves files back correctly"]},
    {"slug": "dashboard-charts", "order": 11, "difficulty": "Medium", "category": "Frontend", "estimated_time": "2.5 hours",
     "title": "Build a Dashboard with Charts",
     "description": "Build an analytics dashboard with line, bar, and donut charts backed by a mock or real API.",
     "requirements": ["3+ chart types", "Filters (date, category)", "Responsive layout"],
     "acceptance": ["Charts update with filters", "Empty and loading states", "Accessible color choices"]},
    # Hard
    {"slug": "url-shortener", "order": 12, "difficulty": "Hard", "category": "Full Stack", "estimated_time": "4 hours",
     "title": "Build a URL Shortener",
     "description": "Design a URL shortener with unique short codes, redirect endpoint, and click analytics per link.",
     "requirements": ["POST /shorten", "GET /{code} -> 301", "Analytics: clicks per link", "Collision-safe code generation"],
     "acceptance": ["Codes are unique", "Redirect is a 301/302", "Analytics reflect real clicks"]},
    {"slug": "ecommerce-backend", "order": 13, "difficulty": "Hard", "category": "Backend", "estimated_time": "6 hours",
     "title": "Build a Mini E-commerce Backend",
     "description": "Model products, cart, and orders with checkout that reserves stock and produces an order record.",
     "requirements": ["Products CRUD", "Cart endpoints", "Checkout that decrements stock", "Order history"],
     "acceptance": ["Cannot oversell stock", "Order totals correct", "Authenticated user scoping"]},
    {"slug": "subscription-management", "order": 14, "difficulty": "Hard", "category": "Full Stack", "estimated_time": "5 hours",
     "title": "Build Subscription Management",
     "description": "Implement plans, subscribe/cancel flows, and prorated upgrades. Payments can be mocked.",
     "requirements": ["Plans catalog", "Subscribe/cancel endpoints", "Prorated upgrade path", "Billing history view"],
     "acceptance": ["State transitions are consistent", "Upgrades recompute correctly", "UI reflects current plan"]},
    {"slug": "chat-app", "order": 15, "difficulty": "Hard", "category": "Full Stack", "estimated_time": "6 hours",
     "title": "Build a Chat Application",
     "description": "Realtime one-to-one chat with message persistence, unread counts, and typing indicators.",
     "requirements": ["WebSocket or SSE realtime", "Message persistence", "Unread counts", "Typing indicators"],
     "acceptance": ["Messages persist across reconnects", "Unread counts accurate", "Handles offline delivery"]},
]


async def seed_challenges():
    for c in SEED_CHALLENGES:
        await db.challenges.update_one({"slug": c["slug"]}, {"$set": c}, upsert=True)
    logger.info(f"Seeded {len(SEED_CHALLENGES)} challenges")


async def ensure_indexes():
    await db.users.create_index("email", unique=True)
    await db.challenges.create_index("slug", unique=True)
    await db.submissions.create_index([("user_id", 1), ("created_at", -1)])
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.login_attempts.create_index("identifier")


# ---------- App wiring ----------
app.include_router(api)

allowed_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()]
if FRONTEND_URL and FRONTEND_URL not in allowed_origins and "*" not in allowed_origins:
    allowed_origins.append(FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if allowed_origins != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    await ensure_indexes()
    await seed_challenges()


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
