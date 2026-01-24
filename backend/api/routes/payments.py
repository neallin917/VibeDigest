import httpx
import logging
from fastapi import APIRouter, Depends, Form, HTTPException
from coinbase_commerce.client import Client as CoinbaseClient

from config import settings
from dependencies import get_current_user, get_db_client, get_coinbase_client
from db_client import DBClient

router = APIRouter()
logger = logging.getLogger(__name__)

# Creem API Config
CREEM_API_BASE = settings.CREEM_API_BASE
CREEM_API_KEY = settings.CREEM_API_KEY

@router.post("/create-crypto-charge")
async def create_crypto_charge(
    price_id: str = Form(...),  # We map price_id to amount manually for now
    user_id: str = Depends(get_current_user),
    db: DBClient = Depends(get_db_client),
    coinbase_client: CoinbaseClient = Depends(get_coinbase_client)
):
    """Create Coinbase Commerce Charge (USDC Only)."""

    price = settings.get_price_by_id(price_id)
    if not price:
        raise HTTPException(status_code=400, detail="Invalid Price ID")

    amount = price.amount
    name = price.name

    try:
        # 2. Create Unified Order (Pending)
        order = db.create_payment_order(user_id, "coinbase", amount, "USD")
        if not order:
            raise HTTPException(status_code=500, detail="Failed to create order record")

        # 3. Create Coinbase Charge
        charge_data = {
            "name": name,
            "description": "VibeDigest Credits",
            "local_price": {"amount": str(amount), "currency": "USD"},
            "pricing_type": "fixed_price",
            "metadata": {
                "user_id": user_id,
                "order_id": order["id"],  # Link back to our DB
                "price_id": price_id,
            },
            "redirect_url": settings.FRONTEND_URL + "/settings/pricing?success=true",
            "cancel_url": settings.FRONTEND_URL + "/settings/pricing?canceled=true",
        }

        charge = coinbase_client.charge.create(**charge_data)
        hosted_url = charge.hosted_url
        code = charge.code

        # 4. Update Order with Charge Code
        db.update_payment_order(order["id"], provider_payment_id=code)

        return {"url": hosted_url}

    except Exception as e:
        logger.error(f"Coinbase creation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/create-checkout-session")
async def create_checkout_session(
    price_id: str = Form(...),  # This is now Creem product_id
    user_id: str = Depends(get_current_user),
    db: DBClient = Depends(get_db_client)
):
    """Create Creem Checkout Session."""
    price = settings.get_price_by_id(price_id)
    if not price:
        raise HTTPException(status_code=400, detail="Invalid Product ID")

    try:
        # Create Creem Checkout Session via REST API
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{CREEM_API_BASE}/v1/checkouts",
                headers={
                    "x-api-key": CREEM_API_KEY,
                    "Content-Type": "application/json",
                },
                json={
                    "product_id": price_id,
                    "success_url": settings.FRONTEND_URL
                    + "/settings/pricing?success=true",
                    "metadata": {"user_id": user_id},
                },
                timeout=30.0,
            )

            if response.status_code != 200:
                error_detail = response.text
                logger.error(
                    f"Creem checkout creation failed: {response.status_code} - {error_detail}"
                )
                raise HTTPException(
                    status_code=500, detail=f"Checkout creation failed: {error_detail}"
                )

            checkout_data = response.json()
            checkout_url = checkout_data.get("checkout_url")
            checkout_id = checkout_data.get("id")

            if not checkout_url:
                raise HTTPException(status_code=500, detail="No checkout URL returned")

        # Create payment order for tracking
        amount_est = price.amount
        order = db.create_payment_order(user_id, "creem", amount_est, "USD")
        if order and checkout_id:
            db.update_payment_order(order["id"], provider_payment_id=checkout_id)

        return {"url": checkout_url}

    except httpx.RequestError as e:
        logger.error(f"Creem API request failed: {e}")
        raise HTTPException(
            status_code=500, detail=f"Payment service unavailable: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Creem session creation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
