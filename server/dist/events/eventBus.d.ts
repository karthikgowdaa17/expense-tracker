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
export declare class EventBus {
    private listeners;
    subscribe(listener: (event: any) => void): () => void;
    publish(event: any): void;
}
export declare const eventBus: EventBus;
export type EventBusType = typeof eventBus;
//# sourceMappingURL=eventBus.d.ts.map