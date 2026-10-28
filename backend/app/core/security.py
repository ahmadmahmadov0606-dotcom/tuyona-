import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import get_settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode()[:72], bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode()[:72], hashed.encode())
    except ValueError:
        return False


GOOGLE_CERTS = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}
_google_keys: jwt.PyJWKClient | None = None


def verify_google_token(token: str) -> dict:
    """ID token-и Google-ро месанҷад: имзо (калидҳои ҷамъиятии Google), муҳлат, aud = GOOGLE_CLIENT_ID,
    iss ва тасдиқ будани email. Хатогӣ — jwt.PyJWTError."""
    global _google_keys
    if _google_keys is None:
        _google_keys = jwt.PyJWKClient(GOOGLE_CERTS, cache_keys=True, timeout=10)
    key = _google_keys.get_signing_key_from_jwt(token).key
    claims = jwt.decode(token, key, algorithms=["RS256"], audience=get_settings().google_client_id,
                        options={"require": ["exp", "iat", "iss", "aud", "email"]})
    if claims["iss"] not in GOOGLE_ISSUERS:
        raise jwt.InvalidIssuerError("Not issued by Google")
    if claims.get("email_verified") is not True:
        raise jwt.InvalidTokenError("Google email is not verified")
    return claims


def create_access_token(user_id: int, role: str) -> str:
    s = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=s.access_token_minutes),
    }
    return jwt.encode(payload, s.secret_key, algorithm=s.jwt_algorithm)


def decode_access_token(token: str) -> dict | None:
    s = get_settings()
    try:
        return jwt.decode(token, s.secret_key, algorithms=[s.jwt_algorithm])
    except jwt.PyJWTError:
        return None


class RateLimiter:
    """Маҳдудкунандаи оддӣ дар хотира (барои як сервер).
    Дар production бо якчанд сервер Redis истифода баред."""

    def __init__(self, limit: int, window_seconds: int = 60):
        self.limit = limit
        self.window = window_seconds
        self.hits: dict[str, deque] = defaultdict(deque)

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        q = self.hits[key]
        while q and now - q[0] > self.window:
            q.popleft()
        if len(q) >= self.limit:
            return False
        q.append(now)
        return True

    def reset(self):
        self.hits.clear()
