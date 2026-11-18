export interface AgentEvent {
  id: string;
  type: string;
  projectId: string;
  workflowId?: string;
  taskId?: string;
  agentId?: string;
  objectiveId?: string;
  payload: Record<string, unknown>;
  timestamp: Date;
}

type Listener = (event: any) => void;

export class EventBus {
  private listeners: Array<(event: any) => void> = [];

  subscribe(listener: (event: any) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  publish(event: any): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (e) {
        console.error('EventBus listener error', e);
      }
    }
  }
}

export const eventBus = new EventBus();
export type EventBusType = typeof eventBus;