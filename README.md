# Zustand computed property

Another TypeScript-friendly computed middleware for Zustand. `computed` properties can be defined directly in the store. From there, computed properties can be accessed just like any other property, even by other computed properties!

How does it work? The quick answer is with [proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) magic. The store state is wrapped in a Proxy object that on property access, checks for `computed` values and resolves them, returning the computed result instead.

## Installation

`npm install git+https://github.com/mpenney99/zustand-computed-property.git#master`

## TypeScript

This library is designed with TypeScript in mind.

The return-type of `computed` is simply the type of the computed value itself (it's actually a function, but for typing purposes we pretend it's not). Because of this, computed properties can be defined in the Store the same as any regular property.

## Usage

```
import { createStore } from 'zustand';
import { computedMiddleware, computed } from '@mp99/zustand-computed-property';

type StoreState = {
    count: number;
    countSquared: number;
}

const store = createStore(
    // important!! Don't forget to wrap the store with computedMiddleware
    computedMiddleware<StoreState>(
        (set, get) => ({
            count: 3,

            // "countSquared" is automatically recomputed whenever "count" changes
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
Wrap the store in `computedMiddleware` to enable computed/watched properties to be evaluated. This will wrap the store state in a `Proxy` object.

### computed
Computes a value when its dependencies change. It has automatic dependency tracking, so any properties accessed during computation will be tracked.

Example:
```
const store = createStore(
    computedMiddleware(
        a: 1,
        // function will only be called when "a" changes.
        doubled: computed((state) => state.a * state.a)
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
        sum: computed((state) => state.a + untrack(() => state.b))
    )
);
```

### watch
Non-dependency-tracking counter-part to `computed`. Use it in cases where explicit dependency tracking is preferred, or to define a custom equality function.

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

## Examples
See tests for more usage examples
