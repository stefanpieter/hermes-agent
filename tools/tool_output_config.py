"""Runtime configuration helpers for tool output limits.

These limits are surfaced in the dashboard via ``tool_output`` config keys and
remain persistent because edits are written to ``~/.hermes/config.yaml``.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping


DEFAULT_TERMINAL_MAX_CHARS = 50_000
DEFAULT_READ_FILE_MAX_LINES = 2_000
DEFAULT_READ_FILE_MAX_LINE_LENGTH = 2_000
DEFAULT_CODE_EXECUTION_STDOUT_BYTES = 50_000
DEFAULT_CODE_EXECUTION_STDERR_BYTES = 10_000
DEFAULT_BROWSER_SNAPSHOT_CHARS = 8_000
DEFAULT_BROWSER_SNAPSHOT_SUMMARIZE_THRESHOLD = 8_000
DEFAULT_CAMOFOX_SNAPSHOT_MAX_CHARS = 80_000
DEFAULT_RESULT_PERSIST_THRESHOLD_CHARS = 100_000
DEFAULT_TURN_BUDGET_CHARS = 200_000
DEFAULT_PREVIEW_CHARS = 1_500


@dataclass(frozen=True)
class ToolOutputLimits:
    terminal_max_chars: int = DEFAULT_TERMINAL_MAX_CHARS
    read_file_max_lines: int = DEFAULT_READ_FILE_MAX_LINES
    read_file_max_line_length: int = DEFAULT_READ_FILE_MAX_LINE_LENGTH
    code_execution_stdout_bytes: int = DEFAULT_CODE_EXECUTION_STDOUT_BYTES
    code_execution_stderr_bytes: int = DEFAULT_CODE_EXECUTION_STDERR_BYTES
    browser_snapshot_chars: int = DEFAULT_BROWSER_SNAPSHOT_CHARS
    browser_snapshot_summarize_threshold: int = DEFAULT_BROWSER_SNAPSHOT_SUMMARIZE_THRESHOLD
    camofox_snapshot_max_chars: int = DEFAULT_CAMOFOX_SNAPSHOT_MAX_CHARS
    result_persist_threshold_chars: int = DEFAULT_RESULT_PERSIST_THRESHOLD_CHARS
    turn_budget_chars: int = DEFAULT_TURN_BUDGET_CHARS
    preview_chars: int = DEFAULT_PREVIEW_CHARS


def _coerce_positive_int(value: Any, default: int, *, minimum: int = 1) -> int:
    try:
        coerced = int(value)
    except (TypeError, ValueError):
        return default
    if coerced < minimum:
        return default
    return coerced


def _load_config() -> Mapping[str, Any]:
    try:
        from hermes_cli.config import load_config

        cfg = load_config()
        return cfg if isinstance(cfg, Mapping) else {}
    except Exception:
        return {}


def _tool_output_section(config: Mapping[str, Any] | None = None) -> Mapping[str, Any]:
    cfg = config if config is not None else _load_config()
    section = cfg.get("tool_output") if isinstance(cfg, Mapping) else None
    return section if isinstance(section, Mapping) else {}


def _raw_tool_output_section() -> Mapping[str, Any]:
    try:
        from hermes_cli.config import read_raw_config

        raw = read_raw_config()
    except Exception:
        return {}
    section = raw.get("tool_output") if isinstance(raw, Mapping) else None
    return section if isinstance(section, Mapping) else {}


def _coerce_limit_from_keys(
    section: Mapping[str, Any],
    keys: tuple[str, ...],
    default: int,
) -> int:
    for key in keys:
        if key in section:
            return _coerce_positive_int(section.get(key), default)
    return default


def get_tool_output_limits(config: Mapping[str, Any] | None = None) -> ToolOutputLimits:
    """Return sanitized tool-output limits from config.yaml plus defaults."""
    section = _tool_output_section(config)
    raw_section = section if config is not None else _raw_tool_output_section()
    terminal_keys = ("terminal_max_chars", "max_bytes")
    if config is None and "terminal_max_chars" not in raw_section and "max_bytes" in raw_section:
        # load_config() deep-merges DEFAULT_CONFIG, so a docs-backed
        # tool_output.max_bytes user override would otherwise lose to the
        # default terminal_max_chars value. Prefer the documented alias unless
        # the user explicitly saved the fine-grained key too.
        terminal_keys = ("max_bytes", "terminal_max_chars")
    return ToolOutputLimits(
        terminal_max_chars=_coerce_limit_from_keys(
            section, terminal_keys, DEFAULT_TERMINAL_MAX_CHARS
        ),
        read_file_max_lines=_coerce_limit_from_keys(
            section, ("read_file_max_lines", "max_lines"), DEFAULT_READ_FILE_MAX_LINES
        ),
        read_file_max_line_length=_coerce_limit_from_keys(
            section,
            ("read_file_max_line_length", "max_line_length"),
            DEFAULT_READ_FILE_MAX_LINE_LENGTH,
        ),
        code_execution_stdout_bytes=_coerce_positive_int(
            section.get("code_execution_stdout_bytes"), DEFAULT_CODE_EXECUTION_STDOUT_BYTES
        ),
        code_execution_stderr_bytes=_coerce_positive_int(
            section.get("code_execution_stderr_bytes"), DEFAULT_CODE_EXECUTION_STDERR_BYTES
        ),
        browser_snapshot_chars=_coerce_positive_int(
            section.get("browser_snapshot_chars"), DEFAULT_BROWSER_SNAPSHOT_CHARS
        ),
        browser_snapshot_summarize_threshold=_coerce_positive_int(
            section.get("browser_snapshot_summarize_threshold"),
            DEFAULT_BROWSER_SNAPSHOT_SUMMARIZE_THRESHOLD,
        ),
        camofox_snapshot_max_chars=_coerce_positive_int(
            section.get("camofox_snapshot_max_chars"), DEFAULT_CAMOFOX_SNAPSHOT_MAX_CHARS
        ),
        result_persist_threshold_chars=_coerce_positive_int(
            section.get("result_persist_threshold_chars"), DEFAULT_RESULT_PERSIST_THRESHOLD_CHARS
        ),
        turn_budget_chars=_coerce_positive_int(
            section.get("turn_budget_chars"), DEFAULT_TURN_BUDGET_CHARS
        ),
        preview_chars=_coerce_positive_int(
            section.get("preview_chars"), DEFAULT_PREVIEW_CHARS
        ),
    )


def get_tool_output_limit(name: str, default: int) -> int:
    """Return one sanitized configured tool-output limit by dataclass field name."""
    limits = get_tool_output_limits()
    return int(getattr(limits, name, default))
