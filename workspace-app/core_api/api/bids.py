from datetime import datetime, timezone
from typing import Optional, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/bids", tags=["Bids"])

FAIR_LIMIT = 5.0
ACKNOWLEDGED_BIDS = set()


class BidCheckRequest(BaseModel):
    bid_price: float = Field(gt=0)
    reference_price: Optional[float] = None
    bid_unit: Literal["INR/kg", "INR/quintal"] = "INR/quintal"
    reference_unit: Literal["INR/kg", "INR/quintal"] = "INR/quintal"
    reference_date: Optional[datetime] = None


class AcceptBidRequest(BaseModel):
    bid_id: str
    fair_price: dict
    accept_anyway: bool = False


def normalize_price(price: float, unit: str) -> float:
    if price <= 0:
        raise ValueError("Price must be greater than zero.")

    return price * 100 if unit == "INR/kg" else price


def assess_bid(data: BidCheckRequest) -> dict:
    bid = normalize_price(data.bid_price, data.bid_unit)

    if data.reference_price is None:
        return {
            "status": "NO_REFERENCE",
            "gap_pct": None,
            "bid_price": bid,
            "reference_price": None,
            "reference_date": None,
            "stale": False,
        }

    reference = normalize_price(
        data.reference_price, data.reference_unit
    )

    gap = ((bid - reference) / reference) * 100

    if gap < -FAIR_LIMIT:
        status = "BELOW_FAIR"
    elif gap > FAIR_LIMIT:
        status = "ABOVE_FAIR"
    else:
        status = "FAIR"

    stale = False
    if data.reference_date:
        ref_date = data.reference_date
        if ref_date.tzinfo is None:
            ref_date = ref_date.replace(tzinfo=timezone.utc)
        stale = (
            datetime.now(timezone.utc) - ref_date
        ).total_seconds() > 3 * 86400

    return {
        "status": status,
        "gap_pct": round(gap, 2),
        "bid_price": bid,
        "reference_price": reference,
        "reference_date": (
            data.reference_date.isoformat()
            if data.reference_date else None
        ),
        "stale": stale,
    }


@router.post("/assess")
def assess_bid_endpoint(data: BidCheckRequest):
    try:
        return {"fair_price": assess_bid(data)}
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.post("/accept")
def accept_bid_endpoint(data: AcceptBidRequest):
    status = data.fair_price.get("status")

    if status == "BELOW_FAIR" and not data.accept_anyway:
        raise HTTPException(
            status_code=409,
            detail="Below-market bid requires explicit confirmation.",
        )

    acknowledged = status == "BELOW_FAIR" and data.accept_anyway

    # Temporary demonstration only; not persistent database storage.
    if acknowledged:
        ACKNOWLEDGED_BIDS.add(data.bid_id)

    return {
        "bid_id": data.bid_id,
        "accepted": True,
        "acknowledged_below_fair": acknowledged,
        "message": "Bid accepted.",
    }