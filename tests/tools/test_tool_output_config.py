"""Tests for persistent tool-output limit config helpers."""

from tools.tool_output_config import get_tool_output_limits


def test_documented_tool_output_aliases_are_supported():
    """Docs-backed max_* keys should map to runtime tool limits."""
    limits = get_tool_output_limits(
        {
            "tool_output": {
                "max_bytes": 150_000,
                "max_lines": 5_000,
                "max_line_length": 4_000,
            }
        }
    )

    assert limits.terminal_max_chars == 150_000
    assert limits.read_file_max_lines == 5_000
    assert limits.read_file_max_line_length == 4_000


def test_specific_tool_output_keys_win_over_documented_aliases():
    """Fine-grained dashboard keys should override broader docs aliases."""
    limits = get_tool_output_limits(
        {
            "tool_output": {
                "max_bytes": 150_000,
                "terminal_max_chars": 175_000,
            }
        }
    )

    assert limits.terminal_max_chars == 175_000