export class EventBus {
    listeners = [];
    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            const idx = this.listeners.indexOf(listener);
            if (idx >= 0)
                this.listeners.splice(idx, 1);
        };
    }
    publish(event) {
        for (const listener of this.listeners) {
            try {
                listener(event);
            }
            catch (e) {
                console.error('EventBus listener error', e);
            }
        }
    }
}
export const eventBus = new EventBus();
//# sourceMappingURL=eventBus.js.map