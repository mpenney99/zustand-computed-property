import type { StateCreator } from "zustand";

type TrackedDeps = {
    keys: (string | symbol)[];
    values: unknown[];
};

interface Resolvable<T, TState> {
    (state: TState): T;
    [TAG_RESOLVABLE]: true;
}

let trackingDisabled = false;
const trackedStack: TrackedDeps[] = [];

const TAG_RESOLVABLE = Symbol();

/**
 * Escape hatch to opt-out of dependency tracking within the callback provided
 * @param callback
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
 * Creates a computed value with automatic dependency tracking
 * @param compute
 * @returns
 */
export function computed<T, TState = unknown>(
    compute: (state: TState) => T
):  T {
    let prevTracked: TrackedDeps | undefined;
    let prevValue: T | undefined;
    let prevState: TState | undefined;

    const resolvable: Resolvable<T, TState> = (state: TState): T => {
        if (state === prevState) {
            return prevValue!;
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
                prevValue = compute(state);
                prevTracked = tracked;
            } finally {
                trackedStack.pop();
            }
        }

        prevState = state;
        return prevValue!;
    };

    resolvable[TAG_RESOLVABLE] = true;

    return resolvable as unknown as T;
}

/**
 * Creates a computed value that allows for explicit dependency tracking
 * @param selector - select dependencies
 * @param compute - compute the value
 * @param eq - compare the previous and next dependencies (defaults to Object.is)
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
                    if (value != null && (value as any)[TAG_RESOLVABLE]) {
                        const callable = value as Resolvable<unknown, TState>;
                        value = callable(proxy);
                    }

                    // track keys that were accessed
                    if (!trackingDisabled && trackedStack.length > 0) {
                        const entry: TrackedDeps =
                            trackedStack[trackedStack.length - 1];
                        entry.keys.push(param);
                        entry.values.push(value);
                    }

                    return value;
                },
            });
            return proxy;
        };

        const getStateProxy = (state: TState): TState => {
            let stateProxy = proxyCache.get(state);
            if (!stateProxy) {
                stateProxy = createProxy(state);
                proxyCache.set(state, stateProxy);
            }
            return stateProxy;
        };

        const getState = (): TState => {
            const state = get();
            return getStateProxy(state);
        };
        api.getState = getState;

        const originalSubscribe = api.subscribe.bind(api);
        api.subscribe = (listener) =>
            originalSubscribe((state, prevState) => {
                const prevStateProxy = getStateProxy(prevState);
                const stateProxy = getStateProxy(state);
                listener(stateProxy, prevStateProxy);
            });

        return stateCreator(set, getState, api);
    };
}
