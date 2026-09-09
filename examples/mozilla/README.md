# Mozilla.ai: show the context your agent actually used

Use Mozilla.ai **any-agent** to run a small agent, inspect its tool execution, and save a trace you can show during your hackathon demo. This optional Python example reads a synthetic checkout incident, then produces an assessment with impact, uncertainty, and a next step. It illustrates the event's context theme: can you demonstrate that the agent consulted its surroundings?

This is a standalone TinyAgent example. It does not instrument the starter kit's TypeScript agent, and neither Python nor these dependencies are part of npm startup.

## Get access and configure

any-agent is open source; no Mozilla account is needed. This recipe uses an OpenAI model, so obtain an API key and model access through [OpenAI's developer platform](https://platform.openai.com/api-keys). Model requests use your provider account's credits. Use the event's official instructions for any sponsor credits.

Use **Python 3.11, 3.12, or 3.13**. The macOS system Python 3.9 is too old. From the repository root:

```sh
python3.12 -m venv examples/mozilla/.venv
examples/mozilla/.venv/bin/python -m pip install -r examples/mozilla/requirements.txt
```

Substitute `python3.11` or `python3.13` if that is your installed supported interpreter. Configure `OPENAI_API_KEY` as an exported environment variable in your shell or secret manager before running. This recipe does **not** automatically load the repository's `.env` file, and it fails with an explicit setup error when the key is absent.

The recipe pins `any-agent==1.18.0` and `mcp==1.30.0`: the former's MCP type imports are incompatible with MCP 2.x. The SDK installation and TinyAgent construction are covered by the offline checks below.

## Run and see the result

```sh
examples/mozilla/.venv/bin/python examples/mozilla/trace_incident.py
```

The default model is `openai:gpt-4o-mini`. You can select another OpenAI model available to your account:

```sh
examples/mozilla/.venv/bin/python examples/mozilla/trace_incident.py --model openai:gpt-4o-mini
```

This focused recipe accepts OpenAI models only. Mozilla's Python model identifiers use `provider:model`; do not copy the starter kit's TypeScript provider syntax here. See [any-agent model configuration](https://mozilla-ai.github.io/any-agent/agents/models/) for extending it to other providers.

Expect a model-generated assessment of `INC-1042`, three `PASS` lines, and a trace at `examples/mozilla/traces/incident.json`. Exact wording varies. A useful assessment mentions the checkout error increase, treats the nearby deployment as a possible cause, and asks the owner to compare logs before rollback. The agent only reads synthetic data; it does not change a real system.

The trace inspector checks that:

- A recorded **tool execution span** names `read_incident` and contains a JSON tool result with the fixture incident ID; failed dispatches and prose claiming a tool call are insufficient.
- The final answer is nonempty text.
- The final answer includes the incident ID.

A failed check exits nonzero and preserves the trace for inspection. These are deterministic checks of observed behavior, **not a full evaluation of factual accuracy or safety**. Open the JSON and inspect the incident tool result and model response together. The default trace directory is gitignored; traces contain prompts and outputs, so review them before sharing if you replace the synthetic fixture with real data.

## Verify offline

After dependency installation, this uses no provider credentials or network calls:

```sh
examples/mozilla/.venv/bin/python -m unittest discover -s examples/mozilla -v
```

The suite runs TinyAgent with a fake key and a mocked provider, covering successful fixture reads and failed tool dispatches, and tests trace inspection with controlled trace-like objects. It rejects missing tools, planned calls, unrelated tools, invalid tool results, empty answers, and a wrong incident ID. It does not prove that a live model will call the tool; the live command performs that check on its actual trace.

## Make it yours

Edit `read_incident()` in [trace_incident.py](./trace_incident.py) to define your demo's surrounding context, then edit the instructions and prompt in `main()`. Keep synthetic records until you are ready to connect an authorized data source. Extend `inspect_trace()` with checks tied to your own demo's expected behavior.

For a short demo: show the record, run the agent, show its assessment, then open the trace to demonstrate where that context entered the conversation.

Reference: [Mozilla.ai first-agent cookbook](https://mozilla-ai.github.io/any-agent/cookbook/your-first-agent/), [tracing guide](https://mozilla-ai.github.io/any-agent/tracing/), and [evaluation cookbook](https://mozilla-ai.github.io/any-agent/cookbook/your-first-agent-evaluation/).

### Execution budget

The recipe allows at most **8 combined model calls and tool executions** per run.
A callback checks the budget before either operation starts, including tools
batched in one model response. Repeated tool requests and empty responses therefore
terminate with exit code 1, an explicit error, and the partial trace saved at
`--output`. A final answer on the last permitted step can still succeed.
This limits agent steps, not dollars, tokens, or wall-clock duration.

`execution_budget.py` uses the documented
[any-agent callback cancellation API](https://mozilla-ai.github.io/any-agent/agents/callbacks/#using-agentcancel-recommended).
The installed-SDK tests mock only the provider and cover repeated tool calls,
empty responses, batched tools, and failure trace export without credentials:

```bash
python -m unittest discover -s examples/mozilla -p 'test_*.py' -v
```
