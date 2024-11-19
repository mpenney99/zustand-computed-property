import type { StateCreator } from "zustand";

type TrackedDeps = {
    keys: (string | symbol)[];
    values: unknown[];
};

interface Resolvable<T, TState> {
    (state: TState): T;
    [TAG_RESOLVABLE]: true;
}

const trackingStack: TrackedDeps[] = [];

const TAG_RESOLVABLE = Symbol();

/**
 * Escape hatch to opt-out of dependency tracking
 * @param callback
 * @returns
 */
export function untrack<T>(callback: () => T) {
    trackingStack.push({ keys: [], values: [] });
    try {
        return callback();
    } finally {
        trackingStack.pop();
    }
}

/**
 * Computes a value with automatic dependency tracking
 * @param compute - function to compute the value
 * @returns
 */
export function computed<T, TState = unknown>(
    compute: (state: TState) => T
):  T {
    let prevTrackedDeps: TrackedDeps | undefined;
    let prevValue: T | undefined;
    let prevState: TState | undefined;

    const resolvable: Resolvable<T, TState> = (state: TState): T => {
        if (state === prevState) {
            return prevValue!;
        }

        let recompute: boolean = !prevTrackedDeps;

        // check dependencies
        if (prevTrackedDeps) {
            const keys = prevTrackedDeps.keys;
            const values = prevTrackedDeps.values;

            for (let i = 0; i < keys.length; i++) {
                if (state[keys[i] as keyof TState] !== values[i]) {
                    recompute = true;
                    break;
                }
            }
        }

        // compute the next value
        if (recompute) {
            const trackedDeps: TrackedDeps = { keys: [], values: [] };
            trackingStack.push(trackedDeps);

            try {
                prevValue = compute(state);
                prevTrackedDeps = trackedDeps;
            } finally {
                trackingStack.pop();
            }
        }

        prevState = state;
        return prevValue!;
    };

    resolvable[TAG_RESOLVABLE] = true;

    return resolvable as unknown as T;
}

/**
 * Computes a value with explicit dependency tracking
 * @param selector - dependency selector
 * @param compute - function to compute the value
 * @param eq - dependency comparator (defaults to Object.is)
 * @returns
 */
export function watch<const S, T, TState = unknown>(
    selector: (state: TState) => S,
    compute: (selected: S) => T,
    eq: (prev: S, next: S) => boolean = Object.is
): T {
    let prevDeps: S | undefined;
    let prevValue: T | undefined;
    let prevState: TState | undefined;

    const resolvable: Resolvable<T, TState> = (state: TState): T => {
        if (state === prevState) {
            return prevValue!;
        }

        const nextDeps = selector(state);
        if (!prevDeps || !eq(prevDeps, nextDeps)) {
            prevValue = compute(nextDeps);
        }

        prevDeps = nextDeps;
        return prevValue!;
    };

    resolvable[TAG_RESOLVABLE] = true;

    return resolvable as unknown as T;
}

/**
 * Enables support for computed/watch properties in the store.
 * Wraps the store state in a proxy, which resolves values on property access.
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

                    // resolve value
                    if (value != null && (value as any)[TAG_RESOLVABLE]) {
                        const resolvable = value as Resolvable<unknown, TState>;
                        value = resolvable(proxy);
                    }

                    // track keys that were accessed
                    if (trackingStack.length > 0) {
                        const entry: TrackedDeps = trackingStack[trackingStack.length - 1];
                        entry.keys.push(param);
                        entry.values.push(value);
                    }

                    return value;
                },
            });
            return proxy;
        };

        const getCachedProxy = (state: TState): TState => {
            let stateProxy = proxyCache.get(state);
            if (!stateProxy) {
                stateProxy = createProxy(state);
                proxyCache.set(state, stateProxy);
            }
            return stateProxy;
        };

        const originalGetState = api.getState.bind(api);
        const getState = (): TState => {
            const state = originalGetState();
            return getCachedProxy(state);
        };
        api.getState = getState;

        const originalSubscribe = api.subscribe.bind(api);
        api.subscribe = (listener) =>
            originalSubscribe((state, prevState) => {
                const prevStateProxy = getCachedProxy(prevState);
                const stateProxy = getCachedProxy(state);
                listener(stateProxy, prevStateProxy);
            });

        return stateCreator(set, getState, api);
    };
}
