"""
Environment variable parsing utilities.

This module provides consistent parsing of environment variables across
the application. It has ZERO internal dependencies to avoid circular imports.
"""
import os
from typing import Optional
import logging

logger = logging.getLogger(__name__)


def parse_bool_env(name: str, default: bool = False) -> bool:
    """
    Parse a boolean environment variable with common truthy/falsy values.

    Truthy: "1", "true", "t", "yes", "y", "on" (case-insensitive)
    Falsy: "0", "false", "f", "no", "n", "off" (case-insensitive)

    Returns the default if the env var is not set or has an unrecognized value.
    """
    raw = os.getenv(name)
    if raw is None:
        return bool(default)
    s = str(raw).strip().lower()
    if s in ("1", "true", "t", "yes", "y", "on"):
        return True
    if s in ("0", "false", "f", "no", "n", "off"):
        return False
    return bool(default)


def parse_int_env(
    name: str,
    default: int,
    *,
    min_value: Optional[int] = None,
    max_value: Optional[int] = None,
) -> int:
    """
    Parse an integer environment variable with optional bounds.

    Args:
        name: Environment variable name
        default: Default value if env var is not set or invalid
        min_value: Optional minimum value (inclusive)
        max_value: Optional maximum value (inclusive)

    Returns:
        The parsed integer, clamped to bounds if specified
    """
    raw = os.getenv(name)
    if raw is None or str(raw).strip() == "":
        val = int(default)
    else:
        try:
            val = int(str(raw).strip())
        except (ValueError, TypeError):
            logger.warning(
                f"Invalid int env {name}={raw!r}, using default={default}"
            )
            val = int(default)
    if min_value is not None:
        val = max(min_value, val)
    if max_value is not None:
        val = min(max_value, val)
    return val
