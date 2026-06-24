from types import SimpleNamespace

from tools.budget_config import BudgetConfig


def test_budget_for_agent_uses_runtime_budget_config_with_context(monkeypatch):
    """Tool execution should compose context scaling with dashboard tool-output config."""
    from agent import tool_executor

    calls = []

    def fake_runtime_budget_config(*, context_length=None):
        calls.append(context_length)
        return BudgetConfig(default_result_size=12_345, turn_budget=67_890, preview_size=111)

    monkeypatch.setattr(tool_executor, "get_runtime_budget_config", fake_runtime_budget_config, raising=False)
    agent = SimpleNamespace(context_compressor=SimpleNamespace(context_length=65_536))

    cfg = tool_executor._budget_for_agent(agent)

    assert calls == [65_536]
    assert cfg.default_result_size == 12_345
    assert cfg.turn_budget == 67_890
    assert cfg.preview_size == 111
