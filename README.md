# MP99 / Zustand Computed

Another TypeScript-friendly computed middleware for Zustand. Allows to define `compute`'d values directly in the store, which feels like a very natural way. Computed values can even depend on other computed values!

How does it work? `compute` actually returns a function with is tagged with a `Symbol`. The whole store state is wrapped in a Proxy that, on property access, checks if the property value has the `Symbol` attached. If it does, the function is invoked and the result of that computation is returned instead.

Note that since it uses Proxies and Symbols, this library might not be compatible with very old browsers.

## Installation

`npm install @mp99/zustand-computed`

## TypeScript

This library is designed with TypeScript in mind. The return-type of `compute` is aliased to the type of the computed value itself, so defining the type for the store requires no special magic.

## Usage

```
import { createStore } from 'zustand';
import { computedMiddleware, computed } from '@mp99/zustand-computed';

type StoreState = {
    count: number;
    countSquared: number;
}

const store = createStore(
    // important! Don't forget to wrap the store with computedMiddleware
    computedMiddleware<StoreState>(
        (set, get) => ({
            count: 3,

            // "count" will be automatically tracked.
            // It will only be recalculated when the value of "count" changes.
            countSquared: computed(() => {
                const count = get().count;
                return count * count;
            })
        })
    )
);

function MyComponent() {
    const count = useStore(store, (state) => state.count);
    const countSquared = useStore(store, (state) => state.countSquared);
    ...
}

```

## API

### computedMiddleware
Wrap the store in `computedMiddleware` to enable computed/watched properties to be evaluated. It works by wrapping the store state in a Proxy, that evaluates computed properties by calling them.

### compute
Function accepting a callback to compute a value. It has automatic dependency tracking, so any properties accessed during computation will be tracked, and the callback will be called only when those properties changed.

Example:
```
const store = createStore(
    computedMiddleware(
        a: 1,
        // function will only be called when "a" changes.
        doubled: compute((state) => state.a * state.a)
    )
);
```

### untrack
Escape-hatch to opt-out of dependency tracking within the scope of the callback provided.

Example:
```
const store = createStore(
    computedMiddleware(
        a: 1,
        b: 2,
        // function will only be called when "a" changes.
        // When "b" changes, the value will not be recalculated, and the old value will be returned.
        sum: compute((state) => state.a + untrack(() => state.b))
    )
);
```

### watch
Non-dependency-tracking counter-part to `compute`. Use it in cases where explicit dependency tracking is preferred, or to define a custom equality function.

Example:
```
const store = createStore(
    computedMiddleware(
        a: 1,
        // function will only be called when "a" changes
        doubled: watch((state) => state.a, (a) => a * a)
    )
);
```

