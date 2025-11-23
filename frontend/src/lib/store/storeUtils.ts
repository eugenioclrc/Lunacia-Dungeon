// storeUtils.ts
import type { Readable } from 'svelte/store';

/**
 * Simple store implementation for state management compatible with Svelte
 *
 * Svelte store contract:
 * - has a `subscribe` method
 * - `subscribe` immediately calls the subscriber with the current value
 * - returns an unsubscribe function
 */
export class Store<T> implements Readable<T> {
  private state: T;
  private subscribers = new Set<(value: T) => void>();

  constructor(initialState: T) {
    this.state = initialState;
  }

  /**
   * Get the current state (for non-Svelte usage / utility functions)
   */
  getState(): T {
    return this.state;
  }

  /**
   * Replace part of the state (React-style partial setState)
   */
  setState(newState: Partial<T>): void {
    this.state = { ...this.state, ...newState };
    this.notifySubscribers();
  }

  /**
   * Set a specific key in the state
   */
  set<K extends keyof T>(key: K, value: T[K]): void {
    this.state = { ...this.state, [key]: value };
    this.notifySubscribers();
  }

  /**
   * Svelte-compatible subscribe method
   */
  subscribe(run: (value: T) => void): () => void {
    this.subscribers.add(run);
    // Immediately send current value
    run(this.state);

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(run);
    };
  }

  /**
   * Notify all subscribers of state changes
   */
  private notifySubscribers(): void {
    for (const run of this.subscribers) {
      run(this.state);
    }
  }
}
