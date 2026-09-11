import { AbstractAgent } from "@ag-ui/client";
import type { BaseEvent, RunAgentInput } from "@ag-ui/core";
import { makeAgent } from "agent-core";
import { Observable, type Subscription } from "rxjs";

type ChannelAgentFactory = typeof makeAgent;

/**
 * Channel-only facade that keeps AG-UI transcript/state on the outer agent while
 * delegating each low-level run to a fresh BuiltInAgent instance.
 *
 * Channels may re-enter the same turn after tool results as soon as the previous
 * observable completes. BuiltInAgent clears its private abort controller later,
 * in its async cleanup, so reusing one instance can trip its reentry guard. This
 * facade leaves AbstractAgent.runAgent untouched and swaps only run(input), which
 * gives every invocation a clean inner agent without changing the shared web and
 * mobile makeAgent factory.
 */
export class ChannelRunAgent extends AbstractAgent {
  private activeInner: AbstractAgent | undefined;

  constructor(
    private agentFactory: ChannelAgentFactory = makeAgent,
    threadId?: string,
  ) {
    super({ threadId });
  }

  override run(input: RunAgentInput): Observable<BaseEvent> {
    return new Observable<BaseEvent>((subscriber) => {
      let inner: AbstractAgent | undefined;
      let subscription: Subscription | undefined;

      const release = () => {
        if (this.activeInner === inner) {
          this.activeInner = undefined;
        }
      };

      try {
        inner = this.agentFactory(input.threadId);
        inner.threadId = input.threadId;
        this.activeInner = inner;
        subscription = inner.run(input).subscribe({
          next: (event) => {
            subscriber.next(event);
          },
          error: (error) => {
            release();
            subscriber.error(error);
          },
          complete: () => {
            release();
            subscriber.complete();
          },
        });
      } catch (error) {
        release();
        subscriber.error(error);
      }

      return () => {
        subscription?.unsubscribe();
        if (inner && this.activeInner === inner) {
          inner.abortRun();
          this.activeInner = undefined;
        }
      };
    });
  }

  override abortRun() {
    this.activeInner?.abortRun();
  }

  override clone(): ChannelRunAgent {
    const cloned = super.clone() as ChannelRunAgent;
    cloned.agentFactory = this.agentFactory;
    cloned.activeInner = undefined;
    return cloned;
  }
}

export function makeChannelAgent(threadId: string) {
  return new ChannelRunAgent(makeAgent, threadId);
}
