import type { StateCreator } from "zustand";

type TrackedDeps = {
    keys: (string | symbol)[];
    values: unknown[];
};

let trackingDisabled = false;
const trackedStack: TrackedDeps[] = [];

const TAG_COMPUTED = Symbol();

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
export function computed<T, TState = unknown>(
    callback: (state: TState) => T
): T {
    let prevTracked: TrackedDeps | undefined;
    let prevValue: T | undefined;
    let prevState: TState | undefined;

    const callbackMemoized = (state: TState) => {
        if (state === prevState) {
            return prevValue;
        }

        let recompute: boolean = !prevTracked;

        // check dependencies
        if (prevTracked) {
            const keys = prevTracked.keys;
            const values = prevTracked.values;

            for (let i = 0; i < keys.length; i++) {
                if (state[keys[i] as keyof TState] !== values[i]) {
                    recompute = true;
                    break;
                }
            }
        }

        // compute the next value
        if (recompute) {
            const tracked: TrackedDeps = { keys: [], values: [] };
            trackedStack.push(tracked);

            try {
                prevValue = callback(state);
                prevTracked = tracked;
            } finally {
                trackedStack.pop();
            }
        }

        prevState = state;
        return prevValue;
    };

    callbackMemoized[TAG_COMPUTED] = true;
    
    return callbackMemoized as unknown as T;
}

/**
 * Computed middleware that allows you to call compute inside the store
 * @param stateCreator state creator function
 * @returns - Computed middleware to pass to Zustand "createStore"
 */
export function computedMiddleware<TState extends object>(
    stateCreator: StateCreator<TState>
): StateCreator<TState> {
    const proxyCache = new WeakMap<TState, TState>();

    return (set, get, api) => {
        const createProxy = (state: TState): TState => {
            const proxy = new Proxy(state, {
                get: (target: TState, param: string | symbol) => {
                    let value: unknown = (target as any)[param];

                    // resolve computed value
                    if (value != null && (value as any)[TAG_COMPUTED]) {
                        const callable = value as (state: TState) => unknown;
                        value = callable(proxy);
                    }
        
                    // track keys that were accessed
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

        const getStateProxy = (state: TState): TState => {
            let stateProxy = proxyCache.get(state);
            if (!stateProxy) {
                stateProxy = createProxy(state);
                proxyCache.set(state, stateProxy);
            }
            return stateProxy;
        }

        const getState = (): TState => {
            const state = get();
            return getStateProxy(state);
        };
        api.getState = getState;

        const originalSubscribe = api.subscribe.bind(api);
        api.subscribe = (listener) => originalSubscribe((state, prevState) => {
            const prevStateProxy = getStateProxy(prevState);
            const stateProxy = getStateProxy(state);
            listener(stateProxy, prevStateProxy);
        });

        return stateCreator(set, getState, api);
    };
}
