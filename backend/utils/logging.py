import logging
import os
import sys
from pathlib import Path
from typing import Optional

from loguru import logger

from utils.env_utils import parse_bool_env


class InterceptHandler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno

        frame = logging.currentframe()
        depth = 2
        while frame and frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back
            depth += 1

        try:
            rel_path = os.path.relpath(record.pathname, start=os.getcwd())
        except Exception:
            rel_path = record.pathname
        logger.bind(
            logger_loc=f"{rel_path}:{record.lineno}",
            logger_name=record.name,
        ).opt(depth=depth, exception=record.exc_info).log(level, record.getMessage())


_configured = False


def configure_logging() -> None:
    global _configured
    if _configured:
        return

    _configured = True
    level = os.getenv("LOG_LEVEL", "INFO").upper()
    log_json = parse_bool_env("LOG_JSON", False)
    backtrace = parse_bool_env("LOG_BACKTRACE", False)
    diagnose = parse_bool_env("LOG_DIAGNOSE", False)

    logging.root.handlers = [InterceptHandler()]
    logging.root.setLevel(level)

    for name in ("uvicorn", "uvicorn.error", "uvicorn.access", "fastapi"):
        target = logging.getLogger(name)
        target.handlers = [InterceptHandler()]
        target.propagate = False

    logger.remove()
    def _patch_record(record):
        record["extra"].setdefault(
            "logger_loc", f"{record['file'].path}:{record['line']}"
        )
        record["extra"].setdefault("logger_name", record["name"])

    logger.configure(patcher=_patch_record)
    log_format = "{time:YYYY-MM-DD HH:mm:ss.SSS} | {level} | {extra[logger_loc]} - {message}"
    logger.add(
        sys.stdout,
        format=log_format,
        level=level,
        backtrace=backtrace,
        diagnose=diagnose,
        serialize=log_json,
    )

    log_file = os.getenv("LOG_FILE")
    repo_root = Path(__file__).resolve().parents[2]
    fallback_log = repo_root / "temp" / "vibedigest.log"

    def _ensure_writable_log(path: Path) -> Optional[str]:
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            if path.exists():
                if not os.access(path, os.W_OK):
                    return None
            else:
                # Touch the file to validate write access.
                path.touch(exist_ok=True)
            return str(path)
        except Exception:
            return None

    if log_file:
        resolved = _ensure_writable_log(Path(log_file))
        if not resolved:
            log_file = _ensure_writable_log(fallback_log)
    elif os.getenv("PYTEST_CURRENT_TEST"):
        log_file = _ensure_writable_log(fallback_log)
    if log_file:
        rotation = os.getenv("LOG_FILE_ROTATION", "10 MB")
        retention = os.getenv("LOG_FILE_RETENTION", "10 days")
        compression = os.getenv("LOG_FILE_COMPRESSION", "zip")
        logger.add(
            log_file,
            format=log_format,
            level=level,
            rotation=rotation,
            retention=retention,
            compression=compression,
            serialize=log_json,
        )
