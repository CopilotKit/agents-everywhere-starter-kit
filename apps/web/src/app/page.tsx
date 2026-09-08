"use client";

import { useState } from "react";
import { CopilotSidebar } from "@copilotkit/react-core/v2";
import { GenerativeUI } from "@/components/generative-ui";
import { AppControl } from "@/components/app-control";

const LADDER = [
  {
    rung: "01",
    name: "Reachable",
    body: "The agent is addressable where you already are. Mention it, it answers.",
    test: "Table stakes. Every submission clears this.",
  },
  {
    rung: "02",
    name: "Situated",
    body: "It reads the surface without being told — what the page is showing, who is asking, what happened before.",
    test: "Delete the context and ask again. Same answer? Still rung 01.",
  },
  {
    rung: "03",
    name: "Native",
    body: "It renders and acts in the surface's own idioms, and its side effects land where the work lives.",
    test: "Does it belong, or is it a chat window in a costume?",
  },
];

export default function Home() {
  const [focus, setFocus] = useState("");

  return (
    <>
      <GenerativeUI />
      <AppControl focus={focus} setFocus={setFocus} />

      <main className="ck-page">
        <header>
          <p className="ck-eyebrow">On the web</p>
          <h1>The same agent, rendering its own UI.</h1>
          <p className="ck-dek">
            This page runs the identical agent as <code>apps/channel-slack</code> and{" "}
            <code>apps/local-chat</code>. Nothing about it was rewritten for the web — only the
            binding changed. Ask it something in the sidebar and watch it choose a component.
          </p>
        </header>

        {focus && (
          <p className="ck-focus">
            Focused on <strong>{focus}</strong>
            <button type="button" className="ck-btn ck-btn--tiny" onClick={() => setFocus("")}>
              clear
            </button>
          </p>
        )}

        <section className="ck-ladder">
          {LADDER.map((level) => (
            <article key={level.rung}>
              <b>{level.rung}</b>
              <div>
                <h2>{level.name}</h2>
                <p>{level.body}</p>
                <p className="ck-test">{level.test}</p>
              </div>
            </article>
          ))}
        </section>

        <section className="ck-try">
          <h2>Try</h2>
          <ul>
            <li>&ldquo;Summarise the context ladder as a card&rdquo; — calls <code>brief_card</code></li>
            <li>&ldquo;Compare the three rungs in a table&rdquo; — calls <code>comparison_table</code></li>
            <li>&ldquo;Focus the page on voice agents&rdquo; — calls <code>set_focus</code>, and the page changes</li>
            <li>&ldquo;Delete my account&rdquo; — calls <code>confirm_action</code> and stops for approval</li>
          </ul>
        </section>
      </main>

      <CopilotSidebar />
    </>
  );
}
