"""Tests for the Notifier email service."""

import pytest
from unittest.mock import patch, MagicMock


class TestNotifierInit:
    """Test Notifier initialisation and email validation."""

    @patch.dict("os.environ", {
        "RESEND_API_KEY": "re_test_key",
        "FEEDBACK_FROM_EMAIL": "noreply@vibedigest.io",
        "FEEDBACK_TO_EMAIL": "admin@vibedigest.io",
    }, clear=True)
    def test_init_with_valid_email(self):
        """Valid FEEDBACK_FROM_EMAIL should initialise without error."""
        from services.notifier import Notifier

        notifier = Notifier()

        assert notifier.from_email == "noreply@vibedigest.io"
        assert notifier.api_key == "re_test_key"
        assert notifier.to_email == "admin@vibedigest.io"

    @patch.dict("os.environ", {
        "RESEND_API_KEY": "re_test_key",
        "FEEDBACK_FROM_EMAIL": "noreply@",
        "FEEDBACK_TO_EMAIL": "admin@vibedigest.io",
    }, clear=True)
    def test_init_with_invalid_email_missing_domain(self):
        """FEEDBACK_FROM_EMAIL missing domain should raise ValueError."""
        from services.notifier import Notifier

        with pytest.raises(ValueError, match="Invalid FEEDBACK_FROM_EMAIL"):
            Notifier()

    @patch.dict("os.environ", {
        "RESEND_API_KEY": "re_test_key",
        "FEEDBACK_FROM_EMAIL": "noreply",
        "FEEDBACK_TO_EMAIL": "admin@vibedigest.io",
    }, clear=True)
    def test_init_with_invalid_email_no_at(self):
        """FEEDBACK_FROM_EMAIL without @ should raise ValueError."""
        from services.notifier import Notifier

        with pytest.raises(ValueError, match="Invalid FEEDBACK_FROM_EMAIL"):
            Notifier()

    @patch.dict("os.environ", {
        "RESEND_API_KEY": "re_test_key",
        "FEEDBACK_TO_EMAIL": "admin@vibedigest.io",
    }, clear=True)
    def test_init_fallback_default(self):
        """Missing FEEDBACK_FROM_EMAIL should fall back to onboarding@resend.dev."""
        from services.notifier import Notifier

        notifier = Notifier()

        assert notifier.from_email == "onboarding@resend.dev"


class TestNotifierSendFeedback:
    """Test Notifier.send_feedback_email behaviour."""

    @patch("services.notifier.resend")
    @patch.dict("os.environ", {
        "RESEND_API_KEY": "re_test_key",
        "FEEDBACK_FROM_EMAIL": "noreply@vibedigest.io",
        "FEEDBACK_TO_EMAIL": "admin@vibedigest.io",
    }, clear=True)
    def test_send_feedback_email_success(self, mock_resend):
        """send_feedback_email should call resend.Emails.send with correct params."""
        mock_resend.Emails.send.return_value = {"id": "email_123"}

        from services.notifier import Notifier

        notifier = Notifier()
        notifier.send_feedback_email(
            category="bug",
            message="Something broke",
            user_id="user-abc",
            contact_email="user@example.com",
        )

        mock_resend.Emails.send.assert_called_once()
        call_args = mock_resend.Emails.send.call_args[0][0]
        assert call_args["from"] == "noreply@vibedigest.io"
        assert call_args["to"] == "admin@vibedigest.io"
        assert "BUG" in call_args["subject"]
        assert "Something broke" in call_args["html"]

    @patch("services.notifier.resend")
    @patch.dict("os.environ", {
        "FEEDBACK_FROM_EMAIL": "noreply@vibedigest.io",
    }, clear=True)
    def test_send_feedback_email_skips_when_config_missing(self, mock_resend):
        """Without RESEND_API_KEY, send_feedback_email should skip and not call resend."""
        from services.notifier import Notifier

        notifier = Notifier()
        notifier.send_feedback_email(
            category="feature",
            message="Add dark mode",
            user_id="user-xyz",
        )

        mock_resend.Emails.send.assert_not_called()
