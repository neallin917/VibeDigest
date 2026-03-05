"""Tests for ApiKeyRotator — round-robin key selection with cooldown support."""

import time

import pytest

from services.key_rotator import ApiKeyRotator


class TestApiKeyRotatorRoundRobin:
    def test_single_key_always_returns_same(self):
        rotator = ApiKeyRotator(["key1"])
        assert rotator.get_key() == "key1"
        assert rotator.get_key() == "key1"

    def test_round_robin_cycles_through_keys(self):
        rotator = ApiKeyRotator(["a", "b", "c"])
        results = [rotator.get_key() for _ in range(6)]
        assert results == ["a", "b", "c", "a", "b", "c"]

    def test_empty_keys_raises(self):
        with pytest.raises(ValueError, match="at least one"):
            ApiKeyRotator([])


class TestApiKeyRotatorCooldown:
    def test_rate_limited_key_is_skipped(self):
        rotator = ApiKeyRotator(["a", "b", "c"], cooldown_seconds=60)
        rotator.report_rate_limited("a")
        # "a" is in cooldown, should be skipped
        results = [rotator.get_key() for _ in range(4)]
        assert results == ["b", "c", "b", "c"]

    def test_all_keys_exhausted_raises(self):
        rotator = ApiKeyRotator(["a", "b"], cooldown_seconds=60)
        rotator.report_rate_limited("a")
        rotator.report_rate_limited("b")
        with pytest.raises(RuntimeError, match="All .* keys .* rate.limited"):
            rotator.get_key()

    def test_cooldown_expires_key_available_again(self):
        rotator = ApiKeyRotator(["a", "b"], cooldown_seconds=0.1)
        rotator.report_rate_limited("a")
        # "a" should be skipped
        assert rotator.get_key() == "b"
        time.sleep(0.15)
        # cooldown expired, "a" should be available again
        assert rotator.get_key() == "a"
