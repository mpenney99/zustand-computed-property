import type { StateCreator } from "zustand";
/**
 * Escape hatch to opt-out of dependency tracking within the callback provided
 * @param callback
 * @returns
 */
export declare function untrack<T>(callback: () => T): T;
/**
 * Creates a computed value with automatic dependency tracking
 * @param compute
 * @returns
 */
export declare function computed<T, TState = unknown>(compute: (state: TState) => T): T;
/**
 * Creates a computed value that allows for explicit dependency tracking
 * @param selector - select dependencies
 * @param compute - compute the value
 * @param eq - compare the previous and next dependencies (defaults to Object.is)
 * @returns
 */
export declare function watch<const S, T, TState = unknown>(selector: (state: TState) => S, compute: (selected: S) => T, eq?: (prev: S, next: S) => boolean): T;
/**
 * Computed middleware that allows you to call compute inside the store
 * @param stateCreator state creator function
 * @returns - Computed middleware to pass to Zustand "createStore"
 */
export declare function computedMiddleware<TState extends object>(stateCreator: StateCreator<TState>): StateCreator<TState>;
