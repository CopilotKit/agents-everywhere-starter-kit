"""Trace an agent reading a synthetic incident with Mozilla.ai any-agent."""

import argparse
import json
import os
from pathlib import Path
import sys
from typing import Protocol, Sequence

INCIDENT_ID = "INC-1042"


def read_incident() -> str:
    """Read the synthetic incident record, including evidence and uncertainty."""
    return json.dumps({
        "synthetic": True,
        "id": INCIDENT_ID,
        "service": "checkout",
        "status": "investigating",
        "observations": [
            "14:02 UTC: checkout errors rose from 0.2% to 8%.",
            "14:00 UTC: release checkout-2026.09.09.1 completed.",
            "14:05 UTC: database latency remained within its normal range.",
        ],
        "unknowns": ["Whether the release caused the errors."],
        "allowed_next_step": "Ask the incident owner to compare release error logs before approving rollback.",
    })


class Span(Protocol):
    attributes: dict

    def is_tool_execution(self) -> bool: ...


class Trace(Protocol):
    spans: Sequence[Span]
    final_output: object


def is_incident_result(span: Span) -> bool:
    """Require the fixture result; the SDK also traces failed tool dispatches."""
    if not span.is_tool_execution() or span.attributes.get("gen_ai.tool.name") != "read_incident":
        return False
    output = span.attributes.get("gen_ai.output")
    if not isinstance(output, str):
        return False
    try:
        incident = json.loads(output)
    except json.JSONDecodeError:
        return False
    return isinstance(incident, dict) and incident.get("id") == INCIDENT_ID


def inspect_trace(trace: Trace) -> dict[str, bool]:
    """Check recorded behavior, not whether the model's reasoning is correct."""
    output = trace.final_output
    return {
        "read_incident_executed": any(is_incident_result(span) for span in trace.spans),
        "nonempty_text_output": isinstance(output, str) and bool(output.strip()),
        "incident_id_in_output": isinstance(output, str) and INCIDENT_ID in output,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", default="openai:gpt-4o-mini")
    parser.add_argument("--output", type=Path, default=Path(__file__).parent / "traces" / "incident.json")
    args = parser.parse_args()
    if not (3, 11) <= sys.version_info[:2] < (3, 14):
        parser.error("Use Python 3.11, 3.12, or 3.13 for any-agent 1.18.0.")
    if not args.model.startswith("openai:") or not args.model.removeprefix("openai:").strip():
        parser.error("This recipe supports OpenAI models: --model openai:MODEL_NAME.")
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        parser.error("Export OPENAI_API_KEY before running; root .env is not loaded by this optional recipe.")

    from any_agent import AgentConfig, AnyAgent

    from execution_budget import StepBudget, StepBudgetExceeded

    agent = AnyAgent.create(
        "tinyagent",
        AgentConfig(
            model_id=args.model,
            api_key=api_key,
            instructions=(
                "Call read_incident before answering. Summarize the incident with its ID, "
                "observed impact, uncertainty, and one suggested next step. Distinguish "
                "correlation from cause. Do not claim to have performed a rollback."
            ),
            tools=[read_incident],
            callbacks=[StepBudget()],
        ),
    )
    exhausted = False
    try:
        trace = agent.run("Read the incident and prepare a short assessment for its owner.")
    except StepBudgetExceeded as error:
        print(f"ERROR: {error}", file=sys.stderr)
        exhausted = True
        trace = error.trace
        if trace is None:
            print("No partial trace was available.", file=sys.stderr)
            return 1
    # Keep credentials out of the exported artifact even if a future SDK serializes config.
    serialized = trace.model_dump_json(indent=2, serialize_as_any=True)
    serialized = serialized.replace(api_key, "[REDACTED]")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(serialized + "\n", encoding="utf-8")
    print(str(trace.final_output).replace(api_key, "[REDACTED]"))
    checks = inspect_trace(trace)
    print("\nTrace checks (observed behavior only):")
    for name, passed in checks.items():
        print(f"  {'PASS' if passed else 'FAIL'} {name}")
    print(f"Trace saved: {args.output}")
    return 0 if not exhausted and all(checks.values()) else 1


if __name__ == "__main__":
    raise SystemExit(main())
