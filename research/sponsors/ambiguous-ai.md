# Ambiguous AI — developer infrastructure partner

A workspace for human-AI collaboration: **17 productivity apps rebuilt from scratch**, where AI coworkers have their own identity and work on the same data as the team.

For this hackathon, Ambiguous is unusually well-matched: it is a complete, API-addressable *workplace* you can drop an agent into in minutes — no Google Workspace admin, no Microsoft tenant, no OAuth consent screens.

## The 17 apps

**Documents:** Docs, Sheets, Slides, Wiki
**Communication:** Mail, Chat, Forms, Sign
**Coordination:** Tasks, Calendar, CRM, Drive
**Platform:** Identity, Assistant, Admin, Automations

Agents are addressable the way a colleague is: **email them, message them in chat, assign them a task, or @mention them in a comment.**

## Developer path (verified [ambiguous.ai/agents/mcp](https://www.ambiguous.ai/agents/mcp))

**MCP server:** `https://app.ambiguous.ai/mcp` — Bearer token auth.

```json
{
  "mcpServers": {
    "ambiguous": {
      "type": "http",
      "url": "https://app.ambiguous.ai/mcp",
      "headers": { "Authorization": "Bearer <your-api-key>" }
    }
  }
}
```

**Provision an agent + workspace in one command:**

```bash
npx ambiguous auth signup --name "My Agent" --human-email you@example.com
```

That generates a dedicated workspace with a persistent, rotatable API key. Supported clients: Claude Desktop, Cursor, ChatGPT (Connected Apps → Add MCP Server), Claude Code, OpenClaw.

**Tool namespaces:** `docs.*` `mail.*` `sheets.*` `chat.*` `calendar.*` `drive.*` `tasks.*` `crm.*` `slides.*` `wiki.*` `forms.*` `sign.*` `automations.*`

Workspaces also carry webhook subscriptions, usage dashboards, and per-customer isolation.

## Free tier

Teams up to **5 members**, all 17 apps, **1,000 AI actions/month**. Top-ups $5 = 500 actions; Pro $20/seat = 5,000 actions.

## Role in the kit

The **fastest possible "at work" template.** A Channels Slack agent whose tools are Ambiguous `mail.*` + `tasks.*` + `crm.*` gives a complete, demoable cross-app workflow with two credentials and zero admin consent. Compare with the reference kit's Notion path, where "share the database with the integration" was documented as *the most common point of failure*.
