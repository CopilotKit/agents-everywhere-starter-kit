# Mozilla.ai — developer infrastructure partner

Open-source AI tooling for trustworthy, transparent, controllable applications. GitHub: [github.com/mozilla-ai](https://github.com/mozilla-ai). Their framing is the **"choice-first stack"** — [mozilla.ai/open-tools/choice-first-stack](https://www.mozilla.ai/open-tools/choice-first-stack).

## The three tools

### `any-llm`
Single Python interface across LLM providers. **v1.0 shipped in 2026.** The provider-agnostic layer — conceptually the same job OpenRouter does at the gateway level, done in-process and open source. ([InfoWorld coverage](https://www.infoworld.com/article/4085263/mozilla-ai-releases-universal-interface-to-llms.html))

### `any-agent`
Single interface to use *and evaluate* different agent frameworks. Docs: [mozilla-ai.github.io/any-agent](https://mozilla-ai.github.io/any-agent/)

```bash
pip install any-agent
pip install 'any-agent[agno,openai]'
```

Frameworks: **Agno, Google ADK, LangChain, LlamaIndex, OpenAI Agents SDK, smolagents, TinyAgent** — switch with a single parameter change.

The parts that matter for a hackathon:
- **OpenTelemetry traces**, standardized across every framework
- **LLM-as-a-judge and agent-as-a-judge evaluation** over the full agent trace — you can show *why* the agent did what it did, step by step
- **Serving via A2A and MCP** — an any-agent agent can be exposed as a tool for other agents

### `mcpd`
"requirements.txt for agentic systems" — a daemon that manages MCP servers from declarative config and exposes them as clean HTTP endpoints. [github.com/mozilla-ai/mcpd](https://github.com/mozilla-ai/mcpd)

This is genuinely useful for the kit: instead of every template hand-spawning `npx -y some-mcp-server`, one declarative file defines the tool set and works identically from local dev to a container.

Also in the ecosystem: `cq` (an open standard for shared agent learning) and `llamafile`.

## Role in the kit

Two honest fits, both optional add-ons rather than the spine:

1. **`mcpd` as the tool-declaration layer** — replaces ad-hoc MCP server spawning with one config file. Clean win for reproducibility.
2. **`any-agent` traces + judge for the demo video** — "here is the agent's reasoning, graded" is a differentiator when 51 cities all submit chat bots.

Docs hub: [mozilla.ai/open-tools/docs](https://www.mozilla.ai/open-tools/docs)
