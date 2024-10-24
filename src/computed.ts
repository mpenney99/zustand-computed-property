import type { StateCreator } from "zustand";

type TrackedDeps = {
    keys: (string | symbol)[];
    values: unknown[];
};

let trackingDisabled = false;
const trackedStack: TrackedDeps[] = [];

const SYM_COMPUTED = Symbol();
const SYM_ORIGINAL_TARGET = Symbol();

/**
 * Escape hatch to omit something from dependency tracking
 * @param callback - function returning a value that should not be tracked
 * @returns
 */
export function untrack<T>(callback: () => T) {
    const prevTrackingDisabled = trackingDisabled;
    trackingDisabled = true;
    try {
        return callback();
    } finally {
        trackingDisabled = prevTrackingDisabled;
    }
}

/**
 * Computed callback that automatically tracks dependencies
 * @param callback - function to compute the value
 * @returns
 */
export function computed<T>(callback: () => T): T {
    let prevTracked: TrackedDeps | undefined;
    let prevValue: T | undefined;
    let prevState: any;

    const callbackMemoized = (state: any) => {
        if (state === prevState) {
            return prevValue;
        }

        // calculate whether any dependencies have changed, and if recalculation is necessary
        if (prevTracked) {
            const keys = prevTracked.keys;
            const values = prevTracked.values;

            let unchanged = true;
            for (let i = 0; i < keys.length; i++) {
                if (state[keys[i]] !== values[i]) {
                    unchanged = false;
                    break;
                }
            }

            if (unchanged) {
                prevState = state;
                return prevValue as T;
            }
        }

        // track next dependencies
        const tracked: TrackedDeps = { keys: [], values: [] };
        trackedStack.push(tracked);

        try {
            // trigger the callback function
            prevValue = callback();

            prevTracked = tracked;
            prevState = state;
            return prevValue;
        } finally {
            trackedStack.pop();
        }
    };

    callbackMemoized[SYM_COMPUTED] = true;
    return callbackMemoized as unknown as T;
}

function createProxy<TState extends object>(state: TState): TState {
    const proxy = new Proxy(state, {
        get: (target: TState, param: string | symbol) => {
            let value: unknown = (target as any)[param];

            // return the original object without the proxy
            if (param === SYM_ORIGINAL_TARGET) {
                return target;
            }

            // resolve computed value
            if (value != null && (value as any)[SYM_COMPUTED]) {
                const callable = value as (state: TState) => unknown;
                value = callable(proxy);
            }

            // track keys that were accessed on the proxy
            if (!trackingDisabled && trackedStack.length > 0) {
                const entry: TrackedDeps = trackedStack[trackedStack.length - 1];
                entry.keys.push(param);
                entry.values.push(value);
            }

            return value;
        },
    });
    return proxy;
}

function getOriginalTarget<TState extends object>(state: TState): TState {
    return (state as any)[SYM_ORIGINAL_TARGET] ?? state;
}

/**
 * Computed middleware that allows you to call compute inside the store
 * @param stateCreator state creator function
 * @returns - Computed middleware to pass to Zustand "createStore"
 */
export function computedMiddleware<TState extends object>(
    stateCreator: StateCreator<TState>
): StateCreator<TState> {
    return (set, get, api) => {
        const setState = (
            update: Partial<TState> | ((state: TState) => Partial<TState>),
            replace?: boolean
        ) => {
            const partialState =
                typeof update === "object" ? update : update(get());

            // replace the entire state
            if (replace) {
                set(createProxy(partialState) as TState, true);
                return;
            }

            // get hold of the original object,
            // otherwise Object.assign resolves all computed values from the proxy
            const state = getOriginalTarget(get());

            // merge partial state
            const updated: TState = Object.assign({}, state, partialState);

            set(createProxy(updated), true);
        };

        api.setState = setState as any;

        const initialState = stateCreator(setState as any, get, api);
        return createProxy(initialState);
    };
}
