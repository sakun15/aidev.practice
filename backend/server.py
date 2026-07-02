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
client = AsyncIOMotorClient(mongo_url, tz_aware=True)
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
        "verified": bool(user.get("verified", False)),
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


class VerifySignupRequest(BaseModel):
    email: EmailStr
    code: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str
    confirm_password: str

    @field_validator("new_password")
    @classmethod
    def strong(cls, v: str) -> str:
        if not STRONG_PW.match(v):
            raise ValueError("Password must be at least 8 characters and include a letter and a number")
        return v


class OtpVerifyRequest(BaseModel):
    email: EmailStr
    code: str


class OtpResetRequest(BaseModel):
    verification_token: str
    new_password: str
    confirm_password: str

    @field_validator("new_password")
    @classmethod
    def strong(cls, v: str) -> str:
        if len(v) < 8 or not re.search(r"\d", v):
            raise ValueError("Password must be at least 8 characters and include a number")
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
async def send_signup_otp_email(email: str, code: str) -> None:
    logger.info(f"[SIGNUP-OTP] Verification code for {email}: {code}")
    if not resend.api_key:
        return
    html = f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#f5f5f7;padding:40px 20px;">
      <table style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:40px;">
        <tr><td>
          <h1 style="font-size:28px;color:#1d1d1f;margin:0 0 16px;letter-spacing:-0.4px;">Verify your email</h1>
          <p style="font-size:17px;color:#333333;line-height:1.5;margin:0 0 24px;">Welcome to aidev.practice. Enter this 6-digit code to activate your account. It expires in 5 minutes.</p>
          <div style="font-size:36px;font-weight:700;letter-spacing:8px;color:#1d1d1f;background:#f5f5f7;border-radius:12px;padding:20px;text-align:center;">{code}</div>
          <p style="font-size:13px;color:#707070;margin-top:24px;">If you didn't create this account, you can safely ignore this email.</p>
        </td></tr>
      </table>
    </div>
    """
    try:
        await asyncio.to_thread(resend.Emails.send, {
            "from": SENDER_EMAIL, "to": [email],
            "subject": "Verify your aidev.practice account", "html": html,
        })
    except Exception as e:
        logger.error(f"Resend signup OTP failed: {e}")


async def send_reset_link_email(email: str, link: str) -> None:
    logger.info(f"[RESET-LINK] Password reset link for {email}: {link}")
    if not resend.api_key:
        return
    html = f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#f5f5f7;padding:40px 20px;">
      <table style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:40px;">
        <tr><td>
          <h1 style="font-size:28px;color:#1d1d1f;margin:0 0 16px;letter-spacing:-0.4px;">Reset your password</h1>
          <p style="font-size:17px;color:#333333;line-height:1.5;margin:0 0 24px;">Click the button below to set a new password. This link expires in 15 minutes.</p>
          <a href="{link}" style="display:inline-block;background:#0071e3;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:980px;font-size:15px;">Reset password</a>
          <p style="font-size:13px;color:#707070;margin-top:24px;">Or paste this URL into your browser:<br><span style="color:#1d1d1f;word-break:break-all;">{link}</span></p>
          <p style="font-size:13px;color:#707070;margin-top:16px;">If you didn't request this, you can safely ignore this email.</p>
        </td></tr>
      </table>
    </div>
    """
    try:
        await asyncio.to_thread(resend.Emails.send, {
            "from": SENDER_EMAIL, "to": [email],
            "subject": "Reset your aidev.practice password", "html": html,
        })
    except Exception as e:
        logger.error(f"Resend reset link failed: {e}")


async def _issue_signup_otp(email: str) -> None:
    code = f"{secrets.randbelow(1_000_000):06d}"
    await db.signup_otps.update_many(
        {"email": email, "used": False},
        {"$set": {"used": True, "invalidated_at": datetime.now(timezone.utc)}},
    )
    await db.signup_otps.insert_one({
        "email": email,
        "code_hash": hash_password(code),
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=5),
        "attempts": 0,
        "used": False,
        "created_at": datetime.now(timezone.utc),
    })
    await send_signup_otp_email(email, code)


async def _signup_rate_limit(email: str) -> None:
    since = datetime.now(timezone.utc) - timedelta(minutes=15)
    recent = await db.signup_otps.count_documents({"email": email, "created_at": {"$gte": since}})
    if recent >= 3:
        raise HTTPException(status_code=429, detail="Too many code requests. Please try again in 15 minutes.")


async def _signup_resend_cooldown(email: str) -> None:
    latest = await db.signup_otps.find_one({"email": email}, sort=[("created_at", -1)])
    if latest and (datetime.now(timezone.utc) - latest["created_at"]).total_seconds() < 30:
        remaining = int(30 - (datetime.now(timezone.utc) - latest["created_at"]).total_seconds())
        raise HTTPException(status_code=429, detail=f"Please wait {remaining}s before requesting another code.")


@api.post("/auth/register")
async def register(req: RegisterRequest):
    if req.password != req.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    email = req.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        if existing.get("verified"):
            raise HTTPException(status_code=400, detail="Email already registered")
        # Unverified re-registration: reset password hash and re-issue OTP
        await db.users.update_one({"_id": existing["_id"]},
                                  {"$set": {"password_hash": hash_password(req.password),
                                            "full_name": req.full_name.strip()}})
    else:
        await db.users.insert_one({
            "full_name": req.full_name.strip(),
            "email": email,
            "password_hash": hash_password(req.password),
            "role": "user",
            "ai_experience": None,
            "user_type": None,
            "onboarded": False,
            "verified": False,
            "created_at": datetime.now(timezone.utc),
        })
    await _signup_rate_limit(email)
    await _issue_signup_otp(email)
    return {"email": email, "verification_required": True}


@api.post("/auth/verify-email")
async def verify_email(req: VerifySignupRequest, response: Response):
    email = req.email.lower().strip()
    code = (req.code or "").strip()
    doc = await db.signup_otps.find_one({"email": email, "used": False}, sort=[("created_at", -1)])
    if not doc:
        raise HTTPException(status_code=400, detail="No active code. Request a new one.")
    if doc["expires_at"] < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Code expired. Please request a new one.")
    if doc.get("attempts", 0) >= 5:
        await db.signup_otps.update_one({"_id": doc["_id"]}, {"$set": {"used": True}})
        raise HTTPException(status_code=429, detail="Too many wrong attempts. Please request a new code.")
    if not verify_password(code, doc["code_hash"]):
        await db.signup_otps.update_one({"_id": doc["_id"]}, {"$inc": {"attempts": 1}})
        attempts_left = 5 - (doc.get("attempts", 0) + 1)
        raise HTTPException(status_code=400, detail=f"Invalid code, please try again. {attempts_left} attempts remaining.")
    await db.signup_otps.update_one({"_id": doc["_id"]}, {"$set": {"used": True}})
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=400, detail="Account not found")
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"verified": True}})
    user["verified"] = True
    access = create_access_token(str(user["_id"]), email)
    refresh = create_refresh_token(str(user["_id"]))
    set_auth_cookies(response, access, refresh)
    return user_public(user)


@api.post("/auth/resend-verification")
async def resend_verification(req: ForgotPasswordRequest):
    email = req.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="No account found with this email")
    if user.get("verified"):
        raise HTTPException(status_code=400, detail="Account is already verified")
    await _signup_rate_limit(email)
    await _signup_resend_cooldown(email)
    await _issue_signup_otp(email)
    return {"ok": True, "message": "Code resent"}


@api.post("/auth/login")
async def login(req: LoginRequest, request: Request, response: Response):
    email = req.email.lower().strip()
    ip = request.client.host if request.client else "unknown"
    key = f"{ip}:{email}"

    attempt = await db.login_attempts.find_one({"identifier": key})
    if attempt and attempt.get("locked_until") and attempt["locked_until"] > datetime.now(timezone.utc):
        raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")

    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="This email is not registered. Please sign up or check your spelling.")

    if not verify_password(req.password, user["password_hash"]):
        new_count = (attempt.get("count", 0) if attempt else 0) + 1
        locked_until = datetime.now(timezone.utc) + timedelta(minutes=15) if new_count >= 5 else None
        await db.login_attempts.update_one(
            {"identifier": key},
            {"$set": {"count": new_count, "locked_until": locked_until}},
            upsert=True,
        )
        raise HTTPException(status_code=401, detail="Incorrect password. Please try again.")

    if not user.get("verified"):
        raise HTTPException(status_code=403, detail="Please verify your email before signing in.")


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


async def send_otp_email(email: str, code: str) -> None:
    if not resend.api_key:
        logger.info(f"[OTP] Password reset code for {email}: {code}")
        return
    html = f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#f5f5f7;padding:40px 20px;">
      <table style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:40px;">
        <tr><td>
          <h1 style="font-size:28px;color:#1d1d1f;margin:0 0 16px;letter-spacing:-0.4px;">Your reset code</h1>
          <p style="font-size:17px;color:#333333;line-height:1.5;margin:0 0 24px;">Enter this 6-digit code to reset your password. It expires in 10 minutes.</p>
          <div style="font-size:36px;font-weight:700;letter-spacing:8px;color:#1d1d1f;background:#f5f5f7;border-radius:12px;padding:20px;text-align:center;">{code}</div>
          <p style="font-size:13px;color:#707070;margin-top:24px;">If you didn't request this, you can safely ignore this email.</p>
        </td></tr>
      </table>
    </div>
    """
    try:
        await asyncio.to_thread(resend.Emails.send, {
            "from": SENDER_EMAIL,
            "to": [email],
            "subject": "Your password reset code",
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
        # Rate limit: max 3 reset links per email per 15 min
        since = datetime.now(timezone.utc) - timedelta(minutes=15)
        recent = await db.password_reset_tokens.count_documents({"user_id": str(user["_id"]), "created_at": {"$gte": since}})
        if recent >= 3:
            raise HTTPException(status_code=429, detail="Too many reset requests. Please try again in 15 minutes.")
        token = secrets.token_urlsafe(32)
        await db.password_reset_tokens.insert_one({
            "token_hash": hash_password(token),
            "user_id": str(user["_id"]),
            "email": email,
            "expires_at": datetime.now(timezone.utc) + timedelta(minutes=15),
            "used": False,
            "created_at": datetime.now(timezone.utc),
        })
        link = f"{FRONTEND_URL}/reset-password?token={token}&email={email}"
        await send_reset_link_email(email, link)
    return {"ok": True, "message": "If an account exists, a reset link has been sent."}


@api.post("/auth/reset-password")
async def reset_password(req: ResetPasswordRequest):
    if req.new_password != req.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    # Find an active, unexpired token that matches
    since = datetime.now(timezone.utc)
    candidates = await db.password_reset_tokens.find(
        {"used": False, "expires_at": {"$gt": since}}
    ).sort("created_at", -1).limit(50).to_list(50)
    doc = None
    for c in candidates:
        if verify_password(req.token, c["token_hash"]):
            doc = c
            break
    if not doc:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link. Please request a new one.")
    await db.users.update_one({"_id": ObjectId(doc["user_id"])},
                              {"$set": {"password_hash": hash_password(req.new_password)}})
    await db.password_reset_tokens.update_one({"_id": doc["_id"]}, {"$set": {"used": True}})
    await db.login_attempts.delete_many({"identifier": {"$regex": f":{doc['email']}$"}})
    return {"ok": True, "message": "Password updated. Please log in."}


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
    await db.signup_otps.create_index("expires_at", expireAfterSeconds=0)
    await db.signup_otps.create_index([("email", 1), ("created_at", -1)])
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
