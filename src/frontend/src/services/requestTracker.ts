type Listener = (activeRequests: number) => void;

/**
 * Tracks in-flight HTTP requests from the frontend.
 * Used to drive global loading/progress UI (top loading bar, etc.).
 */
class RequestTracker {
  private active = 0;
  private listeners = new Set<Listener>();

  getActive(): number {
    return this.active;
  }

  increment(): void {
    this.active += 1;
    this.emit();
  }

  decrement(): void {
    this.active = Math.max(0, this.active - 1);
    this.emit();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    // Immediately send current value so UIs render correctly on first mount.
    listener(this.active);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const l of this.listeners) l(this.active);
  }
}

export const requestTracker = new RequestTracker();

