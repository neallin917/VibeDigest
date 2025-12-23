import os
import logging
import resend
from typing import Optional

logger = logging.getLogger(__name__)

class Notifier:
    def __init__(self):
        self.api_key = os.environ.get("RESEND_API_KEY")
        self.from_email = os.environ.get("FEEDBACK_FROM_EMAIL", "onboarding@resend.dev")
        self.to_email = os.environ.get("FEEDBACK_TO_EMAIL")

        if self.api_key:
            resend.api_key = self.api_key
        else:
            logger.warning("RESEND_API_KEY not found. Email notifications disabled.")

    def send_feedback_email(self, category: str, message: str, user_id: str, contact_email: Optional[str] = None):
        """
        Send a feedback email via Resend API.
        """
        if not self.api_key or not self.to_email:
            logger.warning("Resend configuration missing. Skipping email notification.")
            return

        try:
            subject = f"[VibeDigest Feedback] {category.upper()} from {user_id}"
            
            html_content = f"""
            <h3>New Feedback Received</h3>
            <p><strong>Category:</strong> {category}</p>
            <p><strong>User ID:</strong> {user_id}</p>
            <p><strong>Contact Email:</strong> {contact_email or "Not provided"}</p>
            <hr>
            <h4>Message:</h4>
            <pre style="font-family: sans-serif; white-space: pre-wrap;">{message}</pre>
            """

            r = resend.Emails.send({
                "from": self.from_email,
                "to": self.to_email,
                "subject": subject,
                "html": html_content
            })
            
            logger.info(f"Feedback email sent via Resend. ID: {r.get('id')}")

        except Exception as e:
            logger.error(f"Failed to send feedback email via Resend: {e}")
