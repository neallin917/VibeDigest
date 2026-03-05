"""Round-robin API key rotator with cooldown support for rate-limited keys."""

import threading
import time


class ApiKeyRotator:
    """Rotates through a list of API keys in round-robin order.

    Supports marking keys as rate-limited with a cooldown period.
    Rate-limited keys are skipped until their cooldown expires.
    """

    def __init__(
        self, keys: list[str], cooldown_seconds: float = 60.0
    ) -> None:
        if not keys:
            raise ValueError("ApiKeyRotator requires at least one API key")
        self._keys = list(keys)
        self._index = 0
        self._lock = threading.Lock()
        self._cooldown_seconds = cooldown_seconds
        self._cooldown_until: dict[str, float] = {}

    def get_key(self) -> str:
        """Return the next available API key in round-robin order.

        Skips keys that are currently in cooldown. Raises RuntimeError
        if all keys are rate-limited.
        """
        with self._lock:
            now = time.monotonic()
            num_keys = len(self._keys)

            for _ in range(num_keys):
                key = self._keys[self._index % num_keys]
                self._index += 1

                cooldown_expiry = self._cooldown_until.get(key, 0.0)
                if now >= cooldown_expiry:
                    return key

            raise RuntimeError(
                f"All {num_keys} keys are rate-limited. "
                f"Retry after cooldown ({self._cooldown_seconds}s)."
            )

    def report_rate_limited(self, key: str) -> None:
        """Mark a key as rate-limited, placing it in cooldown."""
        with self._lock:
            self._cooldown_until[key] = (
                time.monotonic() + self._cooldown_seconds
            )
