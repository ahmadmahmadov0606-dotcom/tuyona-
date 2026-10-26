from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select

from app.core.config import get_settings
from app.core.security import RateLimiter, create_access_token, hash_password, verify_password
from app.deps import DB, CurrentUser
from app.models import Role, User
from app.schemas import LoginIn, RegisterIn, TokenOut, UserOut, UserUpdate

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
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email ё парол нодуруст аст")
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
