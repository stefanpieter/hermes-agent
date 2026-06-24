"""Configurable budget constants for tool result persistence.

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

        The registry per-tool value is capped at ``default_result_size`` so a
        context-scaled budget (small model) actually constrains tools that
        register a large fixed ``max_result_size_chars`` (web/terminal/x_search
        all register 100K). For the default budget this is a no-op because both
        equal 100K; for a scaled-down budget it prevents a per-tool registry
        value from re-inflating the cap past the model's window (#23767).
        """
        if tool_name in PINNED_THRESHOLDS:
            return PINNED_THRESHOLDS[tool_name]
        if tool_name in self.tool_overrides:
            return self.tool_overrides[tool_name]
        from tools.registry import registry
        registry_value = registry.get_max_result_size(tool_name, default=self.default_result_size)
        if registry_value == float("inf"):
            return registry_value
        return min(registry_value, self.default_result_size)


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


# Token<->char conversion used when scaling the budget to a model's context
# window. Deliberately conservative (a smaller divisor = more chars per token =
# a larger char budget) would UNDER-protect small models, so we use the same
# rough 4-chars-per-token ratio the estimator uses (agent/model_metadata.py).
_CHARS_PER_TOKEN: int = 4

# Fraction of a model's context window we allow a SINGLE tool result to occupy
# before persisting/truncating it, and the fraction the WHOLE turn's tool
# output may occupy. Tool output is not the only thing in the window (system
# prompt, tool schemas, conversation history, the model's own reply all
# compete), so these stay well under 1.0.
_PER_RESULT_WINDOW_FRACTION: float = 0.15
_PER_TURN_WINDOW_FRACTION: float = 0.30

# Floor so even a tiny-but-admitted model still gets a usable preview/result
# rather than a 0-char budget.
_MIN_RESULT_SIZE_CHARS: int = 8_000
_MIN_TURN_BUDGET_CHARS: int = 16_000


def budget_for_context_window(context_length: int | None) -> BudgetConfig:
    """Return a BudgetConfig scaled to the active model's context window.

    The fixed defaults (100K result / 200K turn chars) are correct for large
    (200K+ token) models but blind to small ones: on a 65K-token model a single
    tool result persisted at the 100K-char threshold, or a 200K-char turn
    budget (~50K tokens), can by itself approach or exceed the whole window and
    force an oversized request (#23767).

    Scaling keeps large models byte-identical to today (the proportional value
    is clamped to the existing defaults as a CAP) while shrinking the budget for
    small models proportionally to their window, floored so a usable preview
    always survives.
    """
    if not context_length or context_length <= 0:
        return DEFAULT_BUDGET

    window_chars = context_length * _CHARS_PER_TOKEN
    per_result = int(window_chars * _PER_RESULT_WINDOW_FRACTION)
    per_turn = int(window_chars * _PER_TURN_WINDOW_FRACTION)

    # Clamp: never exceed the historical defaults (so large models are
    # unchanged), never drop below the floor (so tiny models stay usable).
    per_result = max(_MIN_RESULT_SIZE_CHARS, min(per_result, DEFAULT_RESULT_SIZE_CHARS))
    per_turn = max(_MIN_TURN_BUDGET_CHARS, min(per_turn, DEFAULT_TURN_BUDGET_CHARS))

    return BudgetConfig(
        default_result_size=per_result,
        turn_budget=per_turn,
        preview_size=DEFAULT_PREVIEW_SIZE_CHARS,
    )


def get_runtime_budget_config(context_length: int | None = None) -> BudgetConfig:
    """Build a BudgetConfig from context scaling plus dashboard settings.

    Upstream's context-window scaling is the baseline: small models get smaller
    per-result/per-turn budgets while large models keep the historical defaults.
    Persistent dashboard ``tool_output`` settings override only the keys the
    user explicitly saved, so config defaults from ``load_config()`` do not
    accidentally undo context-aware scaling.

    Registry per-tool thresholds remain in effect unless the user explicitly
    saved ``tool_output.result_persist_threshold_chars``. That keeps legacy
    defaults intact while letting the dashboard setting intentionally override
    hardcoded per-tool thresholds.
    """
    base = budget_for_context_window(context_length)
    limits = get_tool_output_limits()

    has_result_override = _raw_tool_output_has_nondefault_int(
        "result_persist_threshold_chars", DEFAULT_RESULT_SIZE_CHARS
    )
    has_turn_override = _raw_tool_output_has_nondefault_int(
        "turn_budget_chars", DEFAULT_TURN_BUDGET_CHARS
    )
    has_preview_override = _raw_tool_output_has_nondefault_int(
        "preview_chars", DEFAULT_PREVIEW_SIZE_CHARS
    )

    default_result_size = (
        limits.result_persist_threshold_chars if has_result_override else base.default_result_size
    )
    turn_budget = limits.turn_budget_chars if has_turn_override else base.turn_budget
    preview_size = limits.preview_chars if has_preview_override else base.preview_size

    tool_overrides: Dict[str, int] = {}
    if has_result_override:
        try:
            from tools.registry import registry

            for tool_name in registry.get_all_tool_names():
                if tool_name not in PINNED_THRESHOLDS:
                    tool_overrides[tool_name] = limits.result_persist_threshold_chars
        except Exception:
            tool_overrides = {}

    return BudgetConfig(
        default_result_size=default_result_size,
        turn_budget=turn_budget,
        preview_size=preview_size,
        tool_overrides=tool_overrides,
    )
