import type { StateCreator } from "zustand";
/**
 * Escape hatch to opt-out of dependency tracking
 * @param callback
 * @returns
 */
export declare function untrack<T>(callback: () => T): T;
/**
 * Computes a value with automatic dependency tracking
 * @param compute - function to compute the value
 * @returns
 */
export declare function computed<T, TState = unknown>(compute: (state: TState) => T): T;
/**
 * Computes a value with explicit dependency tracking
 * @param selector - dependency selector
 * @param compute - function to compute the value
 * @param eq - dependency comparator (defaults to Object.is)
 * @returns
 */
export declare function watch<const S, T, TState = unknown>(selector: (state: TState) => S, compute: (selected: S) => T, eq?: (prev: S, next: S) => boolean): T;
/**
 * Enables support for computed/watch properties in the store.
 * Wraps the store state in a proxy, which resolves values on property access.
 * @param stateCreator state creator function
 * @returns - Computed middleware to pass to Zustand "createStore"
 */
export declare function computedMiddleware<TState extends object>(stateCreator: StateCreator<TState>): StateCreator<TState>;
