import { createInMemoryAcordateServices } from "./fake-services";
import { runAcordateAgent } from "./run-agent";

const services = createInMemoryAcordateServices();
const userId = process.env.ACORDATE_DEMO_USER_ID ?? "local-demo-user";
const timezone = process.env.ACORDATE_TIMEZONE ?? "America/Asuncion";
const firstUserMessage =
  "Guardá que para retirar mi certificado necesito cédula y comprobante.";

const first = await runAcordateAgent(
  {
    userId,
    messages: [{ role: "user", content: firstUserMessage }],
    now: new Date().toISOString(),
    timezone,
    sourceMessageId: "local-demo-message-1",
    activeSentReminder: null,
  },
  services,
);

console.log(`Usuario: ${firstUserMessage}`);
console.log(`Acordate: ${first.text}`);

const secondUserMessage = "Recordame retirarlo mañana a las 10.";
const second = await runAcordateAgent(
  {
    userId,
    messages: [
      { role: "user", content: firstUserMessage },
      { role: "assistant", content: first.text },
      { role: "user", content: secondUserMessage },
    ],
    now: new Date().toISOString(),
    timezone,
    sourceMessageId: "local-demo-message-2",
    activeSentReminder: null,
  },
  services,
);

console.log(`Usuario: ${secondUserMessage}`);
console.log(`Acordate: ${second.text}`);
console.log("Memorias:", services.memories.recordsFor(userId));
console.log("Recordatorios:", services.reminders.recordsFor(userId));
