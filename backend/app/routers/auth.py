import secrets

import jwt
from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select

from app.core.config import get_settings
from app.core.security import RateLimiter, create_access_token, hash_password, verify_google_token, verify_password
from app.deps import DB, CurrentUser
from app.models import Role, User
from app.schemas import GoogleLoginIn, LoginIn, RegisterIn, TokenOut, UserOut, UserUpdate

router = APIRouter(prefix="/auth", tags=["auth"])

login_limiter = RateLimiter(get_settings().login_attempts_per_minute)


def _token(user: User) -> TokenOut:
    return TokenOut(
        access_token=create_access_token(user.id, user.role.value),
        user=UserOut.model_validate(user),
    )


@router.post("/register", response_model=TokenOut, status_code=201)
def register(data: RegisterIn, db: DB):
    if data.role == Role.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Нақши admin иҷозат нест")
    if db.scalar(select(User).where(User.email == data.email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Ин email аллакай сабт шудааст")
    user = User(
        email=data.email,
        full_name=data.full_name.strip(),
        password_hash=hash_password(data.password),
        role=data.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _token(user)


@router.post("/login", response_model=TokenOut)
def login(data: LoginIn, db: DB, request: Request):
    ip = request.client.host if request.client else "unknown"
    if not login_limiter.allow(f"{ip}:{data.email}"):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Кӯшишҳо зиёд шуданд, як дақиқа сабр кунед")
    user = db.scalar(select(User).where(User.email == data.email))
    # Сабти ном аллакай мегӯяд, ки email банд аст — пинҳон кардани он ҳимоя намедиҳад, вале корбарро ошуфта мекунад
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Бо ин email ҳисоб нест. Email-ро санҷед ё сабти ном кунед.")
    if not verify_password(data.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Парол нодуруст аст")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Ҳисоб баста шудааст")
    return _token(user)


@router.get("/config")
def auth_config():
    """Танзимоти воридшавӣ барои frontend (бе сохтани аз нав): Client ID-и Google ё null."""
    return {"google_client_id": get_settings().google_client_id or None}


@router.post("/google", response_model=TokenOut)
def google_login(data: GoogleLoginIn, db: DB, request: Request):
    """Воридшавӣ бо Google: ID token санҷида мешавад; агар бо ин email ҳисоб набошад — сохта мешавад."""
    if not get_settings().google_client_id:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Воридшавӣ бо Google фаъол нест")
    if data.role == Role.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Нақши admin иҷозат нест")
    ip = request.client.host if request.client else "unknown"
    if not login_limiter.allow(f"{ip}:google"):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Кӯшишҳо зиёд шуданд, як дақиқа сабр кунед")
    try:
        claims = verify_google_token(data.credential)
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Воридшавӣ бо Google тасдиқ нашуд. Боз кӯшиш кунед.")
    email = claims["email"].strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    if not user:
        name = (claims.get("name") or email.split("@")[0]).strip()[:120]
        user = User(
            email=email,
            full_name=name if len(name) >= 2 else email.split("@")[0][:120],
            # Парол намедонад — танҳо бо Google ворид мешавад (пароли тасодуфӣ, ки касе намедонад)
            password_hash=hash_password(secrets.token_urlsafe(32)),
            role=data.role,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Ҳисоб баста шудааст")
    return _token(user)


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser):
    return user


@router.patch("/me", response_model=UserOut)
def update_me(data: UserUpdate, user: CurrentUser, db: DB):
    if data.full_name:
        user.full_name = data.full_name.strip()
    db.commit()
    return user
