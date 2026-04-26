"""Configurable budget constants for tool result persistence.

Overridable at the RL environment level via HermesAgentEnvConfig fields.
Per-tool resolution: pinned > config overrides > registry > default.
"""

from dataclasses import dataclass, field
from typing import Dict

from tools.tool_output_config import get_tool_output_limits

# Tools whose thresholds must never be overridden.
# read_file=inf prevents infinite persist->read->persist loops.
PINNED_THRESHOLDS: Dict[str, float] = {
    "read_file": float("inf"),
}

# Defaults matching the current hardcoded values in tool_result_storage.py.
# Kept here as the single source of truth; tool_result_storage.py imports these.
DEFAULT_RESULT_SIZE_CHARS: int = 100_000
DEFAULT_TURN_BUDGET_CHARS: int = 200_000
DEFAULT_PREVIEW_SIZE_CHARS: int = 1_500


@dataclass(frozen=True)
class BudgetConfig:
    """Immutable budget constants for the 3-layer tool result persistence system.

    Layer 2 (per-result): resolve_threshold(tool_name) -> threshold in chars.
    Layer 3 (per-turn):   turn_budget -> aggregate char budget across all tool
                          results in a single assistant turn.
    Preview:              preview_size -> inline snippet size after persistence.
    """

    default_result_size: int = DEFAULT_RESULT_SIZE_CHARS
    turn_budget: int = DEFAULT_TURN_BUDGET_CHARS
    preview_size: int = DEFAULT_PREVIEW_SIZE_CHARS
    tool_overrides: Dict[str, int] = field(default_factory=dict)

    def resolve_threshold(self, tool_name: str) -> int | float:
        """Resolve the persistence threshold for a tool.

        Priority: pinned -> tool_overrides -> registry per-tool -> default.
        """
        if tool_name in PINNED_THRESHOLDS:
            return PINNED_THRESHOLDS[tool_name]
        if tool_name in self.tool_overrides:
            return self.tool_overrides[tool_name]
        from tools.registry import registry
        return registry.get_max_result_size(tool_name, default=self.default_result_size)


# Default config -- matches current hardcoded behavior exactly.
DEFAULT_BUDGET = BudgetConfig()


def _raw_tool_output_value(key: str):
    try:
        from hermes_cli.config import read_raw_config

        raw = read_raw_config()
    except Exception:
        return None
    section = raw.get("tool_output") if isinstance(raw, dict) else None
    if not isinstance(section, dict) or key not in section:
        return None
    return section.get(key)


def _raw_tool_output_has_nondefault_int(key: str, default: int) -> bool:
    value = _raw_tool_output_value(key)
    try:
        coerced = int(value)
    except (TypeError, ValueError):
        return False
    return coerced > 0 and coerced != default


def get_runtime_budget_config() -> BudgetConfig:
    """Build a BudgetConfig from persistent dashboard/config.yaml settings.

    Registry per-tool thresholds remain in effect unless the user explicitly
    saved ``tool_output.result_persist_threshold_chars``. That keeps legacy
    defaults intact while letting the dashboard setting intentionally override
    hardcoded per-tool thresholds.
    """
    limits = get_tool_output_limits()
    tool_overrides: Dict[str, int] = {}
    if _raw_tool_output_has_nondefault_int(
        "result_persist_threshold_chars", DEFAULT_RESULT_SIZE_CHARS
    ):
        try:
            from tools.registry import registry

            for tool_name in registry.get_all_tool_names():
                if tool_name not in PINNED_THRESHOLDS:
                    tool_overrides[tool_name] = limits.result_persist_threshold_chars
        except Exception:
            tool_overrides = {}

    return BudgetConfig(
        default_result_size=limits.result_persist_threshold_chars,
        turn_budget=limits.turn_budget_chars,
        preview_size=limits.preview_chars,
        tool_overrides=tool_overrides,
    )
