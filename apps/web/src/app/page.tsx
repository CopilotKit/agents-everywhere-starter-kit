"use client";

import { useCallback, useState, type FormEvent } from "react";
import {
  CopilotChat,
  useConfigureSuggestions,
} from "@copilotkit/react-core/v2";
import { GenerativeUI } from "@/components/generative-ui";
import { AppControl } from "@/components/app-control";
import {
  createFollowup,
  findIncident,
  incidents,
  workspaceContext,
  type Followup,
} from "@/lib/incidents";

export default function Home() {
  const [selectedId, setSelectedId] = useState<string>(incidents[0].id);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [title, setTitle] = useState("");
  const [notice, setNotice] = useState("");
  const { selectedIncident: incident, followups: visibleTasks } =
    workspaceContext(selectedId, followups);
  const selectIncident = useCallback((id: string) => {
    setSelectedId(findIncident(id).id);
    setTitle("");
    setNotice("");
  }, []);
  const addFollowup = useCallback((incidentId: string, nextTitle: string) => {
    const task = createFollowup(incidentId, nextTitle, crypto.randomUUID());
    setFollowups((current) => [...current, task]);
    setNotice(`Added a follow-up to ${task.incidentId}.`);
    return task;
  }, []);

  useConfigureSuggestions(
    {
      suggestions: [
        {
          title: "Summarize this incident",
          message:
            "Summarize the selected incident using the page context. What needs attention?",
        },
        {
          title: "Add a follow-up",
          message:
            "Add one useful local follow-up for the selected incident based on its current status.",
        },
      ],
      available: "before-first-message",
    },
    [],
  );

  function submitFollowup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      addFollowup(selectedId, title);
      setTitle("");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to add follow-up.",
      );
    }
  }

  return (
    <>
      <GenerativeUI />
      <AppControl
        selectedId={selectedId}
        followups={followups}
        selectIncident={selectIncident}
        addFollowup={addFollowup}
      />
      <main className="ck-workspace">
        <header className="ck-workspace-header">
          <div>
            <p className="ck-eyebrow">Agents, everywhere · Web example</p>
            <h1>Incident assistant</h1>
            <p className="ck-intro">
              Pick an incident. Ask your assistant. Add a follow-up.
            </p>
          </div>
          <span className="ck-tag">Sample data</span>
        </header>

        <div className="ck-workspace-grid">
          <section className="ck-panel" aria-labelledby="incident-title">
            <div className="ck-incident-picker">
              <label htmlFor="incident-select">Incident</label>
              <select
                id="incident-select"
                value={selectedId}
                onChange={(event) => selectIncident(event.target.value)}
              >
                {incidents.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.id} · {item.service}
                  </option>
                ))}
              </select>
            </div>

            <div className="ck-detail">
              <span className="ck-status-label">{incident.status}</span>
              <h2 id="incident-title">{incident.title}</h2>
              <p>{incident.summary}</p>
              <details className="ck-more" key={incident.id}>
                <summary>Details &amp; timeline</summary>
                <dl className="ck-detail-facts">
                  <div>
                    <dt>Incident lead</dt>
                    <dd>{incident.owner}</dd>
                  </div>
                  <div>
                    <dt>Severity</dt>
                    <dd>{incident.severity}</dd>
                  </div>
                  <div>
                    <dt>Last update</dt>
                    <dd>{incident.updated}</dd>
                  </div>
                </dl>
                <h3>Impact</h3>
                <p>{incident.impact}</p>
                <h3>Timeline</h3>
                <ol className="ck-timeline">
                  {incident.timeline.map((event) => (
                    <li key={event.time}>
                      <time>{event.time} UTC</time>
                      <div>
                        <strong>{event.author}</strong>
                        <p>{event.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </details>
            </div>

            <section className="ck-followups" aria-labelledby="followup-title">
              <h2 id="followup-title">Follow-ups</h2>
              {visibleTasks.length ? (
                <ul className="ck-task-list">
                  {visibleTasks.map((task) => (
                    <li key={task.id}>
                      <span aria-hidden="true">○</span>
                      {task.title}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ck-empty">
                  No follow-ups yet. Ask the assistant or add one.
                </p>
              )}
              <form onSubmit={submitFollowup} className="ck-task-form">
                <label className="ck-sr-only" htmlFor="task-title">
                  New follow-up for {incident.id}
                </label>
                <input
                  id="task-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={200}
                  placeholder="Write a follow-up…"
                  required
                />
                <button className="ck-btn ck-btn--primary" type="submit">
                  Add
                </button>
              </form>
              <p className="ck-local-note">
                Saved for this session. Cleared on refresh.
              </p>
              <p role="status" className="ck-notice">
                {notice}
              </p>
            </section>
          </section>

          <section
            className="ck-panel ck-assistant"
            aria-labelledby="assistant-title"
          >
            <header className="ck-assistant-header">
              <h2 id="assistant-title">Ask assistant</h2>
              <p>It can read this incident and add follow-ups.</p>
            </header>
            <CopilotChat
              className="ck-chat"
              labels={{
                welcomeMessageText: "What needs attention?",
                chatInputPlaceholder: "Ask about this incident…",
              }}
            />
          </section>
        </div>
      </main>
    </>
  );
}
