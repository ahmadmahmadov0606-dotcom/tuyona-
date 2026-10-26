"""Сохтани маъмур (admin).

Иҷро:  python -m app.create_admin admin@tuyona.tj "Номи Маъмур" ПАРОЛ
"""
import sys

from sqlalchemy import select

from app.core.security import hash_password
from app.db import Base, SessionLocal, engine, migrate_phone_to_email
from app.models import Role, User


def main():
    if len(sys.argv) != 4:
        print(__doc__)
        sys.exit(1)
    email, name, password = sys.argv[1].strip().lower(), sys.argv[2], sys.argv[3]
    if "@" not in email:
        sys.exit("Email нодуруст аст")
    if len(password) < 8:
        sys.exit("Парол бояд на камтар аз 8 аломат бошад")
    migrate_phone_to_email()
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        if user:
            user.role = Role.admin
            user.password_hash = hash_password(password)
        else:
            db.add(User(email=email, full_name=name, password_hash=hash_password(password), role=Role.admin))
        db.commit()
    print(f"Маъмур тайёр: {email}")


if __name__ == "__main__":
    main()
