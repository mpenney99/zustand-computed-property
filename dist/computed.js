let trackingDisabled = false;
const trackedStack = [];
const TAG_COMPUTED = Symbol();
/**
 * Escape hatch to opt-out of dependency tracking within the callback provided
 * @param callback
 * @returns
 */
export function untrack(callback) {
    const prevTrackingDisabled = trackingDisabled;
    trackingDisabled = true;
    try {
        return callback();
    }
    finally {
        trackingDisabled = prevTrackingDisabled;
    }
}
/**
 * Creates a computed value with automatic dependency tracking
 * @param compute
 * @returns
 */
export function computed(compute) {
    let prevTracked;
    let prevValue;
    let prevState;
    const callbackMemoized = (state) => {
        if (state === prevState) {
            return prevValue;
        }
        let recompute = !prevTracked;
        // check dependencies
        if (prevTracked) {
            const keys = prevTracked.keys;
            const values = prevTracked.values;
            for (let i = 0; i < keys.length; i++) {
                if (state[keys[i]] !== values[i]) {
                    recompute = true;
                    break;
                }
            }
        }
        // compute the next value
        if (recompute) {
            const tracked = { keys: [], values: [] };
            trackedStack.push(tracked);
            try {
                prevValue = compute(state);
                prevTracked = tracked;
            }
            finally {
                trackedStack.pop();
            }
        }
        prevState = state;
        return prevValue;
    };
    callbackMemoized[TAG_COMPUTED] = true;
    return callbackMemoized;
}
/**
 * Creates a computed value that allows for explicit dependency tracking
 * @param selector - select dependencies
 * @param compute - compute the value
 * @param eq - compare the previous and next dependencies (defaults to Object.is)
 * @returns
 */
export function watch(selector, compute, eq = Object.is) {
    let prevDeps;
    let prevValue;
    let prevState;
    const callbackMemoized = (state) => {
        if (state === prevState) {
            return prevValue;
        }
        const nextDeps = selector(state);
        if (!prevDeps || !eq(prevDeps, nextDeps)) {
            prevValue = compute(nextDeps);
        }
        prevDeps = nextDeps;
        return prevValue;
    };
    callbackMemoized[TAG_COMPUTED] = true;
    return callbackMemoized;
}
/**
 * Computed middleware that allows you to call compute inside the store
 * @param stateCreator state creator function
 * @returns - Computed middleware to pass to Zustand "createStore"
 */
export function computedMiddleware(stateCreator) {
    const proxyCache = new WeakMap();
    return (set, get, api) => {
        const createProxy = (state) => {
            const proxy = new Proxy(state, {
                get: (target, param) => {
                    let value = target[param];
                    // resolve computed value
                    if (value != null && value[TAG_COMPUTED]) {
                        const callable = value;
                        value = callable(proxy);
                    }
                    // track keys that were accessed
                    if (!trackingDisabled && trackedStack.length > 0) {
                        const entry = trackedStack[trackedStack.length - 1];
                        entry.keys.push(param);
                        entry.values.push(value);
                    }
                    return value;
                },
            });
            return proxy;
        };
        const getStateProxy = (state) => {
            let stateProxy = proxyCache.get(state);
            if (!stateProxy) {
                stateProxy = createProxy(state);
                proxyCache.set(state, stateProxy);
            }
            return stateProxy;
        };
        const getState = () => {
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
//# sourceMappingURL=computed.js.map