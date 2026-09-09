"use client";

import { useCallback, useState, type FormEvent } from "react";
import { CopilotSidebar } from "@copilotkit/react-core/v2";
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
    setNotice(`Added a local follow-up to ${task.incidentId}.`);
    return task;
  }, []);
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
        <div className="ck-atmosphere" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <i key={i} />
          ))}
        </div>
        <header className="ck-workspace-header">
          <div>
            <p className="ck-eyebrow">Agents, everywhere / Web workspace</p>
            <h1>Incident room</h1>
          </div>
          <span className="ck-tag">Sample data</span>
        </header>
        <div className="ck-workspace-grid">
          <aside
            className="ck-panel ck-incident-list"
            aria-label="Incident selection"
          >
            <h2 className="ck-section-label">
              Incidents <span />
            </h2>
            <p className="ck-muted">
              Pick an incident. Your agent sees the same context you do.
            </p>
            {incidents.map((item) => (
              <button
                type="button"
                className="ck-incident"
                aria-pressed={selectedId === item.id}
                key={item.id}
                onClick={() => selectIncident(item.id)}
              >
                <span className="ck-incident-meta">
                  <code>{item.id}</code>
                  <span className="ck-tag">{item.severity}</span>
                </span>
                <strong>{item.title}</strong>
                <span className="ck-muted">
                  {item.status} · {item.service}
                </span>
              </button>
            ))}
            <div className="ck-context-note">
              <span className="ck-dot" /> Context follows your selection
              <p>
                The selected incident, timeline, and follow-ups are shared with
                the agent automatically.
              </p>
            </div>
          </aside>
          <div className="ck-incident-body">
            <section
              className="ck-panel ck-detail"
              aria-labelledby="incident-title"
            >
              <div className="ck-incident-meta">
                <code>
                  {incident.id} · {incident.channel}
                </code>
                <span className="ck-tag">{incident.status}</span>
              </div>
              <h2 id="incident-title">{incident.title}</h2>
              <p>{incident.summary}</p>
              <dl className="ck-detail-facts">
                <div>
                  <dt>Service</dt>
                  <dd>{incident.service}</dd>
                </div>
                <div>
                  <dt>Incident lead</dt>
                  <dd>{incident.owner}</dd>
                </div>
                <div>
                  <dt>Last update</dt>
                  <dd>{incident.updated}</dd>
                </div>
              </dl>
              <div className="ck-impact">
                <h3>Observed impact</h3>
                <p>{incident.impact}</p>
              </div>
            </section>
            <section className="ck-panel" aria-labelledby="timeline-title">
              <h2 className="ck-section-label" id="timeline-title">
                Timeline <span />
              </h2>
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
            </section>
            <section className="ck-panel" aria-labelledby="followup-title">
              <h2 className="ck-section-label" id="followup-title">
                Follow-ups <span />
                <span className="ck-tag">{visibleTasks.length} local</span>
              </h2>
              <p className="ck-muted">
                This page session only. Refreshing clears tasks; no external
                system is updated.
              </p>
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
                  No follow-ups yet. Add one here or ask the agent.
                </p>
              )}
              <form onSubmit={submitFollowup} className="ck-task-form">
                <label htmlFor="task-title">
                  New follow-up for {incident.id}
                </label>
                <div>
                  <input
                    id="task-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={200}
                    placeholder="e.g. Compare connection pool metrics"
                    required
                  />
                  <button className="ck-btn ck-btn--primary" type="submit">
                    Add task
                  </button>
                </div>
              </form>
              <p role="status" className="ck-notice">
                {notice}
              </p>
            </section>
          </div>
          <aside className="ck-panel ck-guide" aria-label="Agent demo prompts">
            <h2 className="ck-section-label">
              Put context to work <span />
            </h2>
            <h3>Bring the agent into the room.</h3>
            <p className="ck-muted">
              Open the chat to try these prompts with your configured model
              provider.
            </p>
            <ol>
              <li>
                <strong>Read the room</strong>
                <p>
                  “Show an incident card for the selected incident, using what
                  you can see.”
                </p>
                <code>incident_card</code>
              </li>
              <li>
                <strong>Connect the events</strong>
                <p>
                  “Draw a timeline and separate observations from possible
                  causes.”
                </p>
                <code>timeline</code>
              </li>
              <li>
                <strong>Take a local action</strong>
                <p>“Add a follow-up to check the metrics for this incident.”</p>
                <code>create_followup</code>
              </li>
              <li>
                <strong>Move with the work</strong>
                <p>
                  “Switch to{" "}
                  {selectedId === "INC-1042" ? "INC-1043" : "INC-1042"} and
                  summarize what changed.”
                </p>
                <code>select_incident</code>
              </li>
            </ol>
            <details>
              <summary>Try an approval card</summary>
              <p>
                “Use propose_action to ask me to approve a sample rollback. Do
                not execute it.”
              </p>
              <p>
                An approval card records a decision. This workspace has no
                production rollback tool.
              </p>
            </details>
            <p className="ck-guide-footer">
              You can select incidents and add local tasks without API
              credentials.
            </p>
          </aside>
        </div>
      </main>
      <CopilotSidebar />
    </>
  );
}
