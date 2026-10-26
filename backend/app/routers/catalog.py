from fastapi import APIRouter
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.deps import DB
from app.models import CategoryGroup, City
from app.schemas import CategoryGroupOut, CityOut

router = APIRouter(tags=["catalog"])


@router.get("/categories", response_model=list[CategoryGroupOut])
def categories(db: DB):
    return db.scalars(
        select(CategoryGroup).options(selectinload(CategoryGroup.categories)).order_by(CategoryGroup.sort)
    ).all()


@router.get("/cities", response_model=list[CityOut])
def cities(db: DB):
    return db.scalars(select(City).order_by(City.sort, City.name)).all()
