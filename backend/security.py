from pwdlib import PasswordHash
import jwt

from datetime import datetime, timedelta, timezone
import os

from dotenv import load_dotenv
from pathlib import Path
import hashlib
import secrets

# Load environment variables
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


# Password hashing
password_hash = PasswordHash.recommended()
PASSWORD_PEPPER = os.getenv("PASSWORD_PEPPER")
if not PASSWORD_PEPPER:
    raise RuntimeError("PASSWORD_PEPPER must be configured")


def hash_password(password: str) -> str:
    peppered_password = password + PASSWORD_PEPPER
    return password_hash.hash(peppered_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    peppered_password = plain_password + PASSWORD_PEPPER
    return password_hash.verify(peppered_password, hashed_password)


def verify_legacy_password(plain_password: str, hashed_password: str) -> bool:
    return password_hash.verify(plain_password, hashed_password)


# JWT configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))

if not 1 <= ACCESS_TOKEN_EXPIRE_MINUTES <= 15:
    raise RuntimeError("ACCESS_TOKEN_EXPIRE_MINUTES must be between 1 and 15")
if not SECRET_KEY or len(SECRET_KEY.encode("utf-8")) < 32:
    raise RuntimeError("JWT_SECRET_KEY must be configured and at least 32 bytes long")


# Create JWT access token
def create_access_token(data: dict) -> str:
    to_encode = data.copy()

    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

    return encoded_jwt

def generate_refresh_token() -> str:
    return secrets.token_urlsafe(64)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
# Decode JWT access token
def decode_access_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    