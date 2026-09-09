"""Bound TinyAgent execution using any-agent 1.18.0's callback API."""

from any_agent import AgentCancel
from any_agent.callbacks import Callback
from any_agent.callbacks.context import Context

MAX_STEPS = 8


class StepBudgetExceeded(AgentCancel):
    """The recipe exhausted its combined model-call and tool-execution budget."""


class StepBudget(Callback):
    """Count before execution so no model or tool runs beyond the budget."""

    def __init__(self, max_steps: int = MAX_STEPS):
        if max_steps < 1:
            raise ValueError("max_steps must be positive")
        self.max_steps = max_steps

    def _consume(self, context: Context) -> Context:
        steps = context.shared.get("incident_recipe_steps", 0)
        if steps >= self.max_steps:
            raise StepBudgetExceeded(
                f"Stopped after {self.max_steps} model/tool steps without a final answer. "
                "Inspect the partial trace for repeated tool calls or empty responses."
            )
        context.shared["incident_recipe_steps"] = steps + 1
        return context

    def before_llm_call(self, context: Context, *args, **kwargs) -> Context:
        return self._consume(context)

    def before_tool_execution(self, context: Context, *args, **kwargs) -> Context:
        return self._consume(context)
