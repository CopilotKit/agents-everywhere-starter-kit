"""Offline checks: a claimed tool call must not pass as an executed span."""

import json
import unittest
from dataclasses import dataclass, field

from trace_incident import INCIDENT_ID, inspect_trace, read_incident


@dataclass
class FakeSpan:
    executed: bool
    attributes: dict = field(default_factory=dict)

    def is_tool_execution(self):
        return self.executed


@dataclass
class FakeTrace:
    spans: list
    final_output: object


class TraceInspectionTests(unittest.TestCase):
    def test_tool_execution_and_output_pass(self):
        trace = FakeTrace([FakeSpan(True, {"gen_ai.tool.name": "read_incident", "gen_ai.output": read_incident()})], f"{INCIDENT_ID}: investigating")
        self.assertTrue(all(inspect_trace(trace).values()))

    def test_claimed_or_planned_tool_call_does_not_pass(self):
        for spans in ([], [FakeSpan(False, {"gen_ai.tool.name": "read_incident"})], [FakeSpan(True, {"gen_ai.tool.name": "other"})]):
            with self.subTest(spans=spans):
                trace = FakeTrace(spans, f"I called read_incident for {INCIDENT_ID}")
                self.assertFalse(inspect_trace(trace)["read_incident_executed"])

    def test_missing_failed_or_wrong_tool_result_does_not_pass(self):
        for output in (None, "", "Error calling tool: dispatch failed", "null", "[]",
                       json.dumps({"id": "INC-9999"}), {"id": INCIDENT_ID}):
            with self.subTest(output=output):
                trace = FakeTrace([FakeSpan(True, {
                    "gen_ai.tool.name": "read_incident", "gen_ai.output": output,
                })], f"I read {INCIDENT_ID}")
                self.assertFalse(inspect_trace(trace)["read_incident_executed"])

    def test_missing_output_and_wrong_incident_fail(self):
        for output in (None, "", "   ", {"id": INCIDENT_ID}):
            with self.subTest(output=output):
                self.assertFalse(inspect_trace(FakeTrace([], output))["nonempty_text_output"])
        self.assertFalse(inspect_trace(FakeTrace([], "INC-9999"))["incident_id_in_output"])

    def test_fixture_is_synthetic_and_preserves_uncertainty(self):
        incident = json.loads(read_incident())
        self.assertTrue(incident["synthetic"])
        self.assertEqual(incident["id"], INCIDENT_ID)
        self.assertTrue(incident["observations"])
        self.assertTrue(incident["unknowns"])


if __name__ == "__main__":
    unittest.main()
