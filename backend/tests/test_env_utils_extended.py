"""Extended tests for utils/env_utils.py — targeting uncovered branches."""

import pytest
from utils.env_utils import parse_bool_env, parse_int_env


class TestParseBoolEnv:
    def test_unset_returns_default_false(self, monkeypatch):
        monkeypatch.delenv("TEST_BOOL_VAR", raising=False)
        assert parse_bool_env("TEST_BOOL_VAR") is False

    def test_unset_returns_default_true(self, monkeypatch):
        monkeypatch.delenv("TEST_BOOL_VAR", raising=False)
        assert parse_bool_env("TEST_BOOL_VAR", default=True) is True

    def test_truthy_values(self, monkeypatch):
        for val in ("1", "true", "True", "TRUE", "t", "yes", "YES", "y", "on", "ON"):
            monkeypatch.setenv("TEST_BOOL_VAR", val)
            assert parse_bool_env("TEST_BOOL_VAR") is True, f"Expected True for {val!r}"

    def test_falsy_values(self, monkeypatch):
        for val in ("0", "false", "False", "FALSE", "f", "no", "NO", "n", "off", "OFF"):
            monkeypatch.setenv("TEST_BOOL_VAR", val)
            assert parse_bool_env("TEST_BOOL_VAR") is False, f"Expected False for {val!r}"

    def test_unrecognized_value_returns_default_false(self, monkeypatch):
        monkeypatch.setenv("TEST_BOOL_VAR", "maybe")
        assert parse_bool_env("TEST_BOOL_VAR", default=False) is False

    def test_unrecognized_value_returns_default_true(self, monkeypatch):
        monkeypatch.setenv("TEST_BOOL_VAR", "random_string")
        assert parse_bool_env("TEST_BOOL_VAR", default=True) is True

    def test_whitespace_stripped(self, monkeypatch):
        monkeypatch.setenv("TEST_BOOL_VAR", "  true  ")
        assert parse_bool_env("TEST_BOOL_VAR") is True


class TestParseIntEnv:
    def test_unset_returns_default(self, monkeypatch):
        monkeypatch.delenv("TEST_INT_VAR", raising=False)
        assert parse_int_env("TEST_INT_VAR", default=42) == 42

    def test_valid_int_string(self, monkeypatch):
        monkeypatch.setenv("TEST_INT_VAR", "100")
        assert parse_int_env("TEST_INT_VAR", default=0) == 100

    def test_negative_int_string(self, monkeypatch):
        monkeypatch.setenv("TEST_INT_VAR", "-5")
        assert parse_int_env("TEST_INT_VAR", default=0) == -5

    def test_invalid_string_returns_default(self, monkeypatch):
        monkeypatch.setenv("TEST_INT_VAR", "not_a_number")
        assert parse_int_env("TEST_INT_VAR", default=99) == 99

    def test_empty_string_returns_default(self, monkeypatch):
        monkeypatch.setenv("TEST_INT_VAR", "   ")
        assert parse_int_env("TEST_INT_VAR", default=7) == 7

    def test_min_value_clamping(self, monkeypatch):
        monkeypatch.setenv("TEST_INT_VAR", "2")
        result = parse_int_env("TEST_INT_VAR", default=0, min_value=10)
        assert result == 10

    def test_min_value_not_applied_when_above(self, monkeypatch):
        monkeypatch.setenv("TEST_INT_VAR", "20")
        result = parse_int_env("TEST_INT_VAR", default=0, min_value=10)
        assert result == 20

    def test_max_value_clamping(self, monkeypatch):
        monkeypatch.setenv("TEST_INT_VAR", "200")
        result = parse_int_env("TEST_INT_VAR", default=0, max_value=100)
        assert result == 100

    def test_max_value_not_applied_when_below(self, monkeypatch):
        monkeypatch.setenv("TEST_INT_VAR", "50")
        result = parse_int_env("TEST_INT_VAR", default=0, max_value=100)
        assert result == 50

    def test_both_min_and_max_clamping_min(self, monkeypatch):
        monkeypatch.setenv("TEST_INT_VAR", "1")
        result = parse_int_env("TEST_INT_VAR", default=0, min_value=5, max_value=50)
        assert result == 5

    def test_both_min_and_max_clamping_max(self, monkeypatch):
        monkeypatch.setenv("TEST_INT_VAR", "100")
        result = parse_int_env("TEST_INT_VAR", default=0, min_value=5, max_value=50)
        assert result == 50

    def test_value_within_bounds(self, monkeypatch):
        monkeypatch.setenv("TEST_INT_VAR", "25")
        result = parse_int_env("TEST_INT_VAR", default=0, min_value=5, max_value=50)
        assert result == 25

    def test_float_string_invalid_uses_default(self, monkeypatch):
        monkeypatch.setenv("TEST_INT_VAR", "3.14")
        result = parse_int_env("TEST_INT_VAR", default=42)
        assert result == 42
