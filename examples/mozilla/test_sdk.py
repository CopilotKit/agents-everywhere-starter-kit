"""Installed SDK smoke test. Creates the agent without calling a provider."""

import contextlib
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import AsyncMock, patch

from any_llm.types.completion import ChatCompletion

from execution_budget import StepBudget, StepBudgetExceeded

from any_agent import AgentConfig, AnyAgent

from trace_incident import INCIDENT_ID, inspect_trace, main, read_incident


class InstalledSdkTests(unittest.TestCase):
    def test_tinyagent_accepts_fixture_tool(self):
        agent = AnyAgent.create(
            "tinyagent",
            AgentConfig(
                model_id="openai:gpt-4o-mini",
                api_key="offline-test-key",
                tools=[read_incident],
            ),
        )
        self.assertEqual(agent.config.model_id, "openai:gpt-4o-mini")
        self.assertTrue(any(tool.__name__ == "read_incident" for tool in agent.config.tools))


    def run_incident_provider(self, arguments: str):
        responses = [
            ChatCompletion(
                id="offline-tool", created=0, model="gpt-4o-mini",
                object="chat.completion",
                choices=[{"index": 0, "finish_reason": "tool_calls", "message": {
                    "role": "assistant", "content": None,
                    "tool_calls": [{"id": "call_incident", "type": "function",
                                    "function": {"name": "read_incident", "arguments": arguments}}],
                }}],
            ),
            ChatCompletion(
                id="offline-answer", created=0, model="gpt-4o-mini",
                object="chat.completion",
                choices=[{"index": 0, "finish_reason": "stop", "message": {
                    "role": "assistant", "content": f"{INCIDENT_ID}: I read the incident.",
                }}],
            ),
        ]
        agent = AnyAgent.create(
            "tinyagent",
            AgentConfig(model_id="openai:gpt-4o-mini", api_key="offline-test-key",
                        tools=[read_incident], callbacks=[StepBudget()]),
        )
        with patch.object(agent.llm, "acompletion", new=AsyncMock(side_effect=responses)) as provider:
            trace = agent.run("Read the incident")
        self.assertEqual(provider.await_count, 2)
        spans = [span for span in trace.spans if span.is_tool_execution()]
        self.assertEqual(len(spans), 1)
        self.assertEqual(spans[0].attributes["gen_ai.tool.name"], "read_incident")
        return trace, spans[0].attributes["gen_ai.output"]

    def test_failed_dispatch_is_not_incident_evidence(self):
        trace, output = self.run_incident_provider('{"unexpected":"argument"}')
        self.assertIn("Error calling tool:", output)
        self.assertFalse(inspect_trace(trace)["read_incident_executed"])
        self.assertTrue(inspect_trace(trace)["incident_id_in_output"])

    def test_successful_fixture_output_is_incident_evidence(self):
        trace, output = self.run_incident_provider("{}")
        self.assertEqual(json.loads(output)["id"], INCIDENT_ID)
        self.assertTrue(all(inspect_trace(trace).values()))


class ExecutionBudgetTests(unittest.TestCase):
    def run_repeating_provider(self, tool_count: int):
        executions = []

        def read_incident() -> str:
            """Read the test incident."""
            executions.append("read")
            return "INC-1042"

        message = {"role": "assistant", "content": None}
        if tool_count:
            message["tool_calls"] = [
                {"id": f"call_{index}", "type": "function",
                 "function": {"name": "read_incident", "arguments": "{}"}}
                for index in range(tool_count)
            ]
        response = ChatCompletion(
            id="offline-completion", created=0, model="gpt-4o-mini",
            object="chat.completion",
            choices=[{"index": 0, "finish_reason": "tool_calls" if tool_count else "stop",
                      "message": message}],
        )
        agent = AnyAgent.create(
            "tinyagent",
            AgentConfig(model_id="openai:gpt-4o-mini", api_key="offline-test-key",
                        tools=[read_incident], callbacks=[StepBudget(max_steps=8)]),
        )
        # Exercise the real SDK loop and callback wrappers, mocking only the provider.
        with patch.object(agent.llm, "acompletion", new=AsyncMock(return_value=response)) as provider:
            with self.assertRaises(StepBudgetExceeded) as caught:
                agent.run("Read the incident")
        self.assertIsNotNone(caught.exception.trace)
        self.assertTrue(caught.exception.trace.spans)
        self.assertIn("8 model/tool steps", str(caught.exception))
        return provider.await_count, len(executions)

    def test_cli_exhaustion_fails_and_exports_partial_trace(self):
        response = ChatCompletion(
            id="offline-empty", created=0, model="gpt-4o-mini",
            object="chat.completion",
            choices=[{"index": 0, "finish_reason": "stop",
                      "message": {"role": "assistant", "content": None}}],
        )
        agent = AnyAgent.create(
            "tinyagent",
            AgentConfig(model_id="openai:gpt-4o-mini", api_key="offline-test-key"),
        )
        errors = io.StringIO()
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "partial.json"
            with (
                patch.object(type(agent.llm), "acompletion", new=AsyncMock(return_value=response)) as provider,
                patch.dict(os.environ, {"OPENAI_API_KEY": "offline-test-key"}),
                patch("sys.argv", ["trace_incident.py", "--output", str(output)]),
                contextlib.redirect_stdout(io.StringIO()),
                contextlib.redirect_stderr(errors),
            ):
                self.assertEqual(main(), 1)
            self.assertEqual(provider.await_count, 8)
            self.assertTrue(json.loads(output.read_text())["spans"])
            self.assertNotIn("offline-test-key", output.read_text())
        self.assertIn("ERROR: Stopped after 8 model/tool steps", errors.getvalue())

    def test_repeated_tool_calls_stop_before_ninth_step(self):
        self.assertEqual(self.run_repeating_provider(tool_count=1), (4, 4))

    def test_empty_responses_stop_before_ninth_model_call(self):
        self.assertEqual(self.run_repeating_provider(tool_count=0), (8, 0))

    def test_batched_tools_cannot_execute_beyond_budget(self):
        self.assertEqual(self.run_repeating_provider(tool_count=12), (1, 7))


if __name__ == "__main__":
    unittest.main()
