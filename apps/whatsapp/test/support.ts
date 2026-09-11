import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import express from 'express';
import { WebSocketServer } from 'ws';

export async function listen(app: express.Express) {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return { server, url: `http://127.0.0.1:${address.port}` };
}
export async function stop(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
/** Local Phoenix control server; no managed message delivery or hosted entitlement claims. */
export function intelligenceGateway(server: Server, url: string) {
  const websocket = new WebSocketServer({ server });
  websocket.on('connection', (socket) => {
    socket.on('message', (data) => {
      const [joinRef, ref, topic] = JSON.parse(data.toString());
      socket.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} }]));
    });
  });
  return {
    urls: { apiUrl: url, wsUrl: url.replace('http:', 'ws:') },
    close: async () => {
      for (const client of websocket.clients) client.terminate();
      await new Promise<void>((resolve) => websocket.close(() => resolve()));
    },
  };
}
export async function eventually(predicate: () => boolean) {
  const deadline = Date.now() + 3000;
  while (!predicate() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 5));
  assert.ok(predicate(), 'Expected asynchronous Channels intake to finish');
}
