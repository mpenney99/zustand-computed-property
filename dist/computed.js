const trackingStack = [];
const TAG_RESOLVABLE = Symbol();
/**
 * Escape hatch to opt-out of dependency tracking
 * @param callback
 * @returns
 */
export function untrack(callback) {
    trackingStack.push({ keys: [], values: [] });
    try {
        return callback();
    }
    finally {
        trackingStack.pop();
    }
}
/**
 * Computes a value with automatic dependency tracking
 * @param compute - function to compute the value
 * @returns
 */
export function computed(compute) {
    let prevTrackedDeps;
    let prevValue;
    let prevState;
    const resolvable = (state) => {
        if (state === prevState) {
            return prevValue;
        }
        let recompute = !prevTrackedDeps;
        // check dependencies
        if (prevTrackedDeps) {
            const keys = prevTrackedDeps.keys;
            const values = prevTrackedDeps.values;
            for (let i = 0; i < keys.length; i++) {
                if (state[keys[i]] !== values[i]) {
                    recompute = true;
                    break;
                }
            }
        }
        // compute the next value
        if (recompute) {
            const trackedDeps = { keys: [], values: [] };
            trackingStack.push(trackedDeps);
            try {
                prevValue = compute(state);
                prevTrackedDeps = trackedDeps;
            }
            finally {
                trackingStack.pop();
            }
        }
        prevState = state;
        return prevValue;
    };
    resolvable[TAG_RESOLVABLE] = true;
    return resolvable;
}
/**
 * Computes a value with explicit dependency tracking
 * @param selector - dependency selector
 * @param compute - function to compute the value
 * @param eq - dependency comparator (defaults to Object.is)
 * @returns
 */
export function watch(selector, compute, eq = Object.is) {
    let prevDeps;
    let prevValue;
    let prevState;
    const resolvable = (state) => {
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
    resolvable[TAG_RESOLVABLE] = true;
    return resolvable;
}
/**
 * Enables support for computed/watch properties in the store.
 * Wraps the store state in a proxy, which resolves values on property access.
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
                    // resolve value
                    if (value != null && value[TAG_RESOLVABLE]) {
                        const resolvable = value;
                        value = resolvable(proxy);
                    }
                    // track keys that were accessed
                    if (trackingStack.length > 0) {
                        const entry = trackingStack[trackingStack.length - 1];
                        entry.keys.push(param);
                        entry.values.push(value);
                    }
                    return value;
                },
            });
            return proxy;
        };
        const getCachedProxy = (state) => {
            let stateProxy = proxyCache.get(state);
            if (!stateProxy) {
                stateProxy = createProxy(state);
                proxyCache.set(state, stateProxy);
            }
            return stateProxy;
        };
        const originalGetState = api.getState.bind(api);
        const getState = () => {
            const state = originalGetState();
            return getCachedProxy(state);
        };
        api.getState = getState;
        const originalSubscribe = api.subscribe.bind(api);
        api.subscribe = (listener) => originalSubscribe((state, prevState) => {
            const prevStateProxy = getCachedProxy(prevState);
            const stateProxy = getCachedProxy(state);
            listener(stateProxy, prevStateProxy);
        });
        return stateCreator(set, getState, api);
    };
}
//# sourceMappingURL=computed.js.map