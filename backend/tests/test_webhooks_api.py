import pytest
import hmac
import hashlib
import json
from unittest.mock import MagicMock, patch
from main import app
from dependencies import get_db_client
from httpx import AsyncClient, ASGITransport

@pytest.mark.asyncio
async def test_creem_webhook_valid(api_client, mock_db_client):
    secret = "test_secret"
    payload = {
        "eventType": "checkout.completed", 
        "object": {
            "id": "chk_123", 
            "metadata": {"user_id": "u1"},
            "customer": {"id": "cust_1"},
            "product": {"id": "prod_1", "billing_type": "one_time"}
        }
    }
    payload_bytes = json.dumps(payload).encode("utf-8")
    signature = hmac.new(secret.encode(), payload_bytes, hashlib.sha256).hexdigest()
    
    # Mock settings.get_price_by_id to return valid credits
    with patch("api.routes.webhooks.settings") as mock_settings:
        mock_settings.get_price_by_id.return_value.credits = 100
        
        with patch("api.routes.webhooks.CREEM_WEBHOOK_SECRET", secret):
            response = await api_client.post(
                "/api/webhook/creem", 
                content=payload_bytes,
                headers={"creem-signature": signature}
            )
            assert response.status_code == 200
            mock_db_client.add_credits.assert_called_with("u1", 100)

@pytest.mark.asyncio
async def test_creem_webhook_invalid_signature(api_client):
    secret = "test_secret"
    payload = b"{}"
    
    with patch("api.routes.webhooks.CREEM_WEBHOOK_SECRET", secret):
        response = await api_client.post(
            "/api/webhook/creem", 
            content=payload,
            headers={"creem-signature": "invalid"}
        )
        assert response.status_code == 400
        assert "Invalid signature" in response.json()["detail"]

@pytest.mark.asyncio
async def test_coinbase_webhook(api_client, mock_db_client):
    with patch("api.routes.webhooks.CoinbaseWebhook") as mock_cb:
        mock_event = MagicMock()
        mock_event.type = "charge:confirmed"
        mock_event.data = {
            "metadata": {"user_id": "u1", "order_id": "ord_1", "price_id": "p1"},
            "payments": [{"value": {"crypto": {"amount": "10", "currency": "BTC"}}}]
        }
        mock_cb.construct_event.return_value = mock_event
        
        with patch("api.routes.webhooks.settings") as mock_settings:
            mock_settings.get_price_by_id.return_value.credits = 50

            response = await api_client.post(
                "/api/webhook/coinbase",
                json={},
                headers={"X-CC-Webhook-Signature": "sig"}
            )
            assert response.status_code == 200
            mock_db_client.update_payment_order.assert_called()
            mock_db_client.add_credits.assert_called_with("u1", 50)

@pytest.mark.asyncio
async def test_coinbase_webhook_invalid_sig(api_client):
    with patch("api.routes.webhooks.CoinbaseWebhook") as mock_cb:
        mock_cb.construct_event.side_effect = Exception("Bad sig")
        
        response = await api_client.post(
            "/api/webhook/coinbase",
            json={},
            headers={"X-CC-Webhook-Signature": "sig"}
        )
        assert response.status_code == 400
