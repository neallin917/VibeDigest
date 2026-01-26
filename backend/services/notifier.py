"""
Email notification service module.

This module handles sending email notifications using the Resend API.
It is primarily used for sending user feedback to the development team.
"""

import os
import logging
import resend
from typing import Optional

logger = logging.getLogger(__name__)

class Notifier:
    """
    Handles sending email notifications via Resend.

    Attributes:
        api_key (Optional[str]): The Resend API key.
        from_email (str): The sender email address.
        to_email (Optional[str]): The recipient email address for feedback.
    """

    def __init__(self):
        """
        Initialize the Notifier with environment variables.

        Loads RESEND_API_KEY, FEEDBACK_FROM_EMAIL, and FEEDBACK_TO_EMAIL
        from environment variables.
        """
        self.api_key = os.environ.get("RESEND_API_KEY")
        self.from_email = os.environ.get("FEEDBACK_FROM_EMAIL", "onboarding@resend.dev")
        self.to_email = os.environ.get("FEEDBACK_TO_EMAIL")

        if self.api_key:
            resend.api_key = self.api_key
        else:
            logger.warning("RESEND_API_KEY not found. Email notifications disabled.")

    def send_feedback_email(self, category: str, message: str, user_id: str, contact_email: Optional[str] = None) -> None:
        """
        Send a feedback email via Resend API.

        Args:
            category: The category of the feedback (e.g., 'bug', 'feature').
            message: The feedback message content.
            user_id: The ID of the user sending the feedback.
            contact_email: Optional contact email provided by the user.
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
