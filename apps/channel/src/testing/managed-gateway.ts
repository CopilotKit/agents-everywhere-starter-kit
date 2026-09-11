import assert from "node:assert/strict";
import { Thread } from "@copilotkit/channels";
import { z } from "zod";
// The pinned SDK fixture exercises managed delivery without accounts or network.
import { DeliveryTestGateway } from "../../../../node_modules/@copilotkit/channels-intelligence/dist/delivery-test-gateway.js";
export { preparedDelivery } from "../../../../node_modules/@copilotkit/channels-intelligence/dist/delivery-test-gateway.js";

// The SDK fixture predates the required stable providerMessageId ack field.
export class ManagedGateway extends DeliveryTestGateway {
  override async join(topic: string, payload: unknown) {
    const channel = await super.join(topic, payload);
    return {
      ...channel,
      push: async (event: string, packet: unknown) => {
        const ack = z
          .object({ result: z.record(z.string(), z.unknown()) })
          .passthrough()
          .parse(await channel.push(event, packet));
        return {
          ...ack,
          result: {
            ...ack.result,
            providerMessageId:
              "pid_v1_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ",
          },
        };
      },
    };
  }
}

export function concreteThread(value: unknown): Thread {
  // createChannel's StatefulThread type narrows state() incompatibly with the
  // tool context in 0.9.2; verify the actual SDK instance instead of casting.
  assert.ok(value instanceof Thread);
  return value;
}
