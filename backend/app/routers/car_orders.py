from datetime import date

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.deps import DB, CurrentUser
from app.models import BookingStatus, CarOrder
from app.routers.admin import AdminUser
from app.schemas import BookingStatusIn, CarOrderCreate, CarOrderOut, Page

router = APIRouter(tags=["car-orders"])

LOAD = (selectinload(CarOrder.client),)


def _get(db, order_id: int) -> CarOrder:
    o = db.scalar(select(CarOrder).options(*LOAD).where(CarOrder.id == order_id))
    if not o:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Фармоиш ёфт нашуд")
    return o


@router.post("/car-orders", response_model=CarOrderOut, status_code=201)
def create_order(data: CarOrderCreate, user: CurrentUser, db: DB):
    if data.event_date < date.today():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Санаи гузашта интихоб шудааст")
    o = CarOrder(
        client_id=user.id, cars=",".join(data.cars), event_date=data.event_date, start_time=data.start_time,
        pickup_address=data.pickup_address.strip(), contact_phone=data.contact_phone, note=data.note.strip(),
    )
    db.add(o)
    db.commit()
    return _get(db, o.id)


@router.get("/car-orders/my", response_model=list[CarOrderOut])
def my_orders(user: CurrentUser, db: DB):
    return db.scalars(
        select(CarOrder).options(*LOAD).where(CarOrder.client_id == user.id)
        .order_by(CarOrder.event_date.desc(), CarOrder.id.desc())
    ).all()


@router.patch("/car-orders/{order_id}/cancel", response_model=CarOrderOut)
def cancel_order(order_id: int, user: CurrentUser, db: DB):
    o = _get(db, order_id)
    if o.client_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Ин фармоиши шумо нест")
    if o.status not in (BookingStatus.pending, BookingStatus.confirmed):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ин фармоишро бекор кардан мумкин нест")
    o.status = BookingStatus.cancelled
    db.commit()
    return o


@router.get("/admin/car-orders", response_model=Page[CarOrderOut])
def admin_orders(
    _: AdminUser,
    db: DB,
    status_: BookingStatus | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
):
    stmt = select(CarOrder)
    if status_:
        stmt = stmt.where(CarOrder.status == status_)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    items = db.scalars(
        stmt.options(*LOAD).order_by(CarOrder.id.desc()).offset((page - 1) * size).limit(size)
    ).all()
    return Page(items=items, total=total, page=page, size=size)


@router.patch("/admin/car-orders/{order_id}/status", response_model=CarOrderOut)
def admin_set_status(order_id: int, data: BookingStatusIn, _: AdminUser, db: DB):
    o = _get(db, order_id)
    o.status = data.status
    db.commit()
    return o
