# Ruta Crítica — Briefings de arranque

Cada persona abre su propia cuenta de Claude y pega **dos cosas**: el Bloque 0 (idéntico para los cinco) y luego solo su bloque de rol.

---

## BLOQUE 0 — Contexto compartido

> Copia este bloque completo como primer mensaje en tu sesión de Claude.

```
Estoy en una hackathon con 3 horas de reloj. Somos 5 personas trabajando en
paralelo sobre el mismo repositorio. Necesito que me ayudes a programar rápido
y sin desviarme.

## El proyecto: Ruta Crítica

Tema de la hackathon: "los agentes están saliendo del chatbox". Hay que poner un
agente donde el trabajo ya ocurre, y que el contexto del lugar lo haga
significativamente más útil.

Nuestro problema: cuando quieres avanzar un proyecto que depende de otro, que
depende de otro, y cada uno tiene un responsable distinto, la coordinación se
come días en reuniones y mensajes.

Nuestro giro: el agente NO es un agendador de reuniones. Es un agente que las
elimina. Mapea la cadena de bloqueos y por cada uno decide si se resuelve async,
con una confirmación de sí/no, con una búsqueda, o si de verdad necesita gente
en una sala. Solo agenda lo irreducible. La métrica de cierre es horas-persona
ahorradas, no reuniones creadas.

## Stack

- Base: el starter kit de CopilotKit (agents-everywhere-starter-kit), template
  apps/web. NO montamos otro backend ni otro framework encima: las reglas piden
  preservar la infraestructura existente.
- Modelo: OpenRouter (un solo modelo rápido, temperature 0, respuesta JSON).
- Búsqueda: Exa, para un único nodo del grafo.
- Datos: todo fixture seeded. Sin OAuth, sin Jira real, sin Google Calendar real.

## Alcance CONGELADO

Entra: grafo de dependencias en vivo, triage de bloqueos con LLM, un nodo
resuelto con Exa, agenda con duración justificada, approval humano, contador de
horas ahorradas.

NO entra (no lo propongas ni lo empieces): delegados negociando entre sí,
integraciones reales con Jira/Calendar, Slack bidireccional, mobile, Auth0, MCP,
autenticación, base de datos, tests exhaustivos.

## Contrato de tipos (nadie lo cambia por su cuenta)

type Blocker = {
  id: string;
  label: string;
  owner: string;
  blocks: string[];
  kind: 'info_gap' | 'confirmation' | 'handoff' | 'real_decision' | null;
  status: 'pending' | 'resolving' | 'resolved' | 'needs_meeting';
  resolution?: { summary: string; sources?: string[] };
  savedPersonHours: number;
};

type AgendaItem = {
  topic: string;
  owner: string;
  expectedDecision: string;
  minutes: number;
};

type Meeting = {
  minutes: number;
  slot: string;
  agenda: AgendaItem[];
  attendees: string[];
};

type AppState = {
  project: string;
  blockers: Blocker[];
  meeting?: Meeting;
  totals: { before: number; after: number; saved: number };
};

## Cómo quiero que trabajes conmigo

- Código directo, sin explicaciones largas. Tengo minutos, no horas.
- Si algo se puede hacer feo y funcionar en el demo, hazlo feo.
- Si te pido algo que está fuera del alcance congelado, dímelo y no lo hagas.
- Trabajo solo sobre los archivos que me tocan. Si una solución requiere tocar
  archivos de otra persona, avísame en vez de editarlos.
- No inventes rutas del repo: si no sabes dónde va algo, pídeme que te pegue la
  estructura real de carpetas.

Confirma que entendiste y espera mi siguiente mensaje con mi rol.
```

---

## BLOQUE 1 — P1 · Lead / Integrador

```
Mi rol: Lead e integrador. Soy dueño de main y del contrato de tipos. NO tengo
feature propia; mi trabajo es desbloquear a los otros cuatro y cablear todo.

Mis archivos: definición de tipos compartidos, configuración del agente,
definición de las tools de CopilotKit, y los merges.

Mis entregables en orden:
1. Archivo de tipos con el contrato del Bloque 0, pusheado antes del minuto 20.
2. Tool `map_dependencies(project: string)` que devuelve el fixture y escribe
   los blockers en el shared state de CopilotKit.
3. Tool `triage_blockers()` que llama a la función de P3 y actualiza los nodos.
4. Tool `build_meeting()` que llama a la función de P4.
5. Cablear las tres al agente y que el canvas de P2 reaccione al estado.

Primera tarea concreta: voy a pegarte la estructura de carpetas real del starter
y el archivo del agente de ejemplo. Ayúdame a identificar exactamente dónde se
definen las tools y dónde vive el shared state, y a sustituir el dominio de
ejemplo del starter por el nuestro con el mínimo de cambios posibles.

Regla para ti: cuando algo falle, prioriza que el flujo corra de punta a punta
por encima de que esté bien hecho.
```

---

## BLOQUE 2 — P2 · Grafo

```
Mi rol: el canvas del grafo de dependencias. Es lo que el jurado va a mirar, así
que tiene que verse bien y reaccionar en vivo.

Mis archivos: el componente del grafo y sus estilos. Nada más.

Mi entregable: un componente React que recibe `blockers: Blocker[]` y dibuja los
nodos con sus flechas de dependencia, coloreados por `status`:
- pending → neutro
- resolving → pulsando
- resolved → verde, con el `resolution.summary` visible al pasar el cursor
- needs_meeting → destacado, es el nodo que sí requiere reunión

Además un contador grande de horas-persona ahorradas (`totals.saved`) que se
actualiza cuando los nodos cambian de estado.

Empiezo AHORA contra datos mock, sin esperar a nadie. Créame un array de
Blocker de ejemplo que cumpla el contrato para desarrollar contra él; después
lo cambio por el estado real.

Restricciones: sin librerías pesadas de grafos si complican el setup; un layout
en capas calculado a mano o con SVG básico es suficiente y más controlable. La
transición de color cuando un nodo se resuelve tiene que notarse en cámara.
```

---

## BLOQUE 3 — P3 · Triador

```
Mi rol: el corazón del proyecto. El prompt y la lógica que clasifica cada
bloqueo y genera su resolución.

Mis archivos: prompts y función de triage. Nada de UI.

Mi entregable: una función `triageBlockers(blockers: Blocker[]): Promise<Blocker[]>`
que hace UNA SOLA llamada a OpenRouter y devuelve todos los nodos clasificados.
Una llamada por nodo es demasiado lenta para el demo.

Por cada bloqueo el modelo debe decidir `kind`:
- info_gap → nadie tiene el dato. Se resuelve con una búsqueda y un pre-read.
- confirmation → solo falta un sí/no de una persona. Se resuelve con un mensaje.
- handoff → es secuencia, no discusión. Se resuelve con una fecha y un aviso.
- real_decision → hay un trade-off real entre personas. ESTO sí necesita reunión.

Y generar `resolution.summary`: el texto concreto de cómo se destraba async.
Para los `real_decision`, `status` queda en 'needs_meeting'.

También calculo `savedPersonHours` por nodo resuelto: horas de reunión evitadas
por número de asistentes que habrían ido.

Ayúdame a escribir el prompt de sistema, forzar salida JSON válida con
temperature 0, y parsear con un fallback que no rompa la UI si el modelo
devuelve basura. El fallback importa: si falla, prefiero clasificar todo como
'confirmation' antes de que el demo se caiga.
```

---

## BLOQUE 4 — P4 · Exa y salidas

```
Mi rol: la búsqueda con Exa y la generación de la agenda y el approval.

Mis archivos: cliente de Exa, generador de agenda, componente de approval card.

Mis entregables en orden de prioridad:

1. `researchBlocker(blocker: Blocker)`: toma el nodo `info_gap`, arma una query,
   llama a Exa y devuelve `{ summary, sources }` con 2-3 URLs citadas. Ese nodo
   pasa a 'resolved'. Necesito también una respuesta cacheada en un JSON local
   como respaldo por si la API falla en vivo.

2. `buildMeeting(blockers: Blocker[]): Promise<Meeting>`: toma solo los nodos
   'needs_meeting' y genera la agenda. Cada punto lleva topic, owner, decisión
   esperada y minutos. La duración total sale de la complejidad de los puntos,
   NO de un default de 30. El slot lo saco de disponibilidad fixture.

3. Approval card: muestra la agenda propuesta con botones Aprobar / Editar /
   Cancelar. Nada sale al mundo sin que un humano apruebe. Esto es lo que
   diferencia el proyecto de un LLM conversacional, así que tiene que verse.

4. Solo si sobra tiempo: webhook de Slack que publica la agenda aprobada.

Empiezo por la llamada a Exa aislada, verificando que devuelve URLs reales,
antes de integrarla con nada.
```

---

## BLOQUE 5 — P5 · Datos y Demo

```
Mi rol: el fixture del grafo primero, y director del demo después.

Primeros 40 minutos: escribo el fixture y se lo entrego a P1 y P3 antes del
minuto 50. Es más importante de lo que suena, porque el fixture ES el demo.

Requisitos del fixture:
- Un proyecto raíz y 5-6 bloqueos encadenados, no en paralelo. Tiene que verse
  una cadena: A depende de B, que depende de C.
- Nombres de personas y proyectos que suenen a empresa real. Nada de
  "Proyecto A ← Proyecto B".
- Al menos uno de cada `kind`, aunque el campo venga en null y lo clasifique el
  modelo.
- El nodo `info_gap` tiene que dar pie a una búsqueda en Exa genuinamente útil:
  algo normativo o técnico con fuentes públicas reales.
- `totals.before` calculado como el costo de coordinación actual en horas-persona.

Ayúdame a escribir ese JSON cumpliendo el contrato de tipos del Bloque 0.

Después del minuto 40 cambio de sombrero: guion del demo de 2-3 minutos,
SUBMISSION.md documentando qué heredamos del starter y qué construimos
nosotros, y cronometrar los ensayos. Grabo video de respaldo a las 2:30.
```

---

## Protocolo de unificación

Las cinco sesiones de Claude no comparten memoria. Lo único que los mantiene sincronizados es el repo y los checkpoints.

**Ramas.** Una por persona: `p1-core`, `p2-graph`, `p3-triage`, `p4-exa`, `p5-fixture`. Solo P1 mergea a `main`.

**Propiedad de archivos.** Cada uno toca solo los suyos. Si necesitas algo de otro, lo pides en voz alta. No lo editas.

**Cuando cambia el contrato de tipos.** P1 lo anuncia en voz alta, todos hacen pull, y cada uno lo pega actualizado en su sesión de Claude. Es el único cambio que obliga a interrumpir a los cinco.

**Cuando alguien termina un entregable.** Push a su rama y avisa. P1 mergea sin esperar al checkpoint si no hay conflicto.

---

## Checkpoints

**0:20 — Arranque cerrado.** Los cinco con `npm run dev:web` corriendo y el contrato de tipos en `main`. Quien no tenga entorno se empareja con otro y trabaja en su máquina; no se pierden 40 minutos depurando.

**0:50 — Fixture entregado.** P5 pasa el JSON a P1 y P3.

**1:20 — De pie, 5 minutos.** Cada uno dice en una frase qué funciona. Si el triage aún no devuelve JSON parseable, P3 recorta: menos categorías, prompt más rígido.

**2:00 — Decisión dura.** Si el flujo no corre de punta a punta, se corta. Orden de sacrificio: Slack → .ics → pre-read de Exa → agenda. El grafo y el contador de horas no se tocan nunca.

**2:30 — Freeze.** Nada nuevo. Solo copy, colores y `npm run verify` limpio.

**2:30–3:00 — Tres ensayos cronometrados** con la laptop y la red reales. Quien presenta lo hace las tres veces.
