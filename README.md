# Zustand computed property

Another TypeScript-friendly computed middleware for Zustand. `computed` properties can be defined directly in the store. Computed properties are then accessible both inside and outside the store just like any other property!

How does it work? The quick answer is [proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) magic. The store state is wrapped in a Proxy object that on property access, checks for resolvable values and evaluates them, returning the result.

## Installation

`npm install git+https://github.com/mpenney99/zustand-computed-property.git#master`

## TypeScript

This library is designed with TypeScript in mind.

The return-type of `computed` and `watch` is simply the type of the resolved value itself (they actually return functions, but we pretend for typing purposes). This makes typing the store easier, as computed properties can be defined just like any regular property.

## Usage

```
import { createStore } from 'zustand';
import { computedMiddleware, computed } from '@mp99/zustand-computed-property';

type StoreState = {
    count: number;
    countSquared: number;
    message: string;
    showAlert: () => void;
}

const store = createStore(
    // important!! Don't forget to wrap the store with computedMiddleware
    computedMiddleware<StoreState>(
        (set, get) => ({
            count: 2,
            name: "Foo"

            // "countSquared" is recomputed when "count" changes
            countSquared: computed(() => {
                const count = get().count;
                return count * count;
            }),

            // computed properties can depend on other computed properties
            message: computed(() => {
                const count = get().count;
                const countSquared = get().countSquared;
                return `${count} squared is ${countSquared}`;
            }),

            // computed properties can be accessed from anywhere in the store
            showAlert: () => {
                window.alert(get().message);
            }
        })
    )
);
```

## API

### computedMiddleware
Wrap the store in `computedMiddleware` to enable computed/watched properties to be evaluated. The store state returned will be wrapped in a `Proxy` object.

### computed
Computes a value when its dependencies change. It has automatic dependency tracking, so any properties accessed during computation will be tracked.

Example:
```
const store = createStore(
    computedMiddleware(
        a: 1,
        b: "hello",
        // only called when "a" changes.
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
        // uses "b" inside the function, but recomputation is only triggered when "a" changes
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
        b: "hello",
        // only called when "a" changes
        doubled: watch((state) => state.a, (a) => a * a)
    )
);
```

## Examples
See tests for more usage examples
