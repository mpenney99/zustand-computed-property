# MP99 / Zustand Computed

A TypeScript friendly computed middleware for Zustand.


## Installation

`npm install @mp99/zustand-computed`

## Usage

```
import { createStore } from 'zustand';
import { computedMiddleware, computed } from '@mp99/zustand-computed';

const store = createStore(
    computedMiddleware(
        (set, get) => ({
            count: 3,
            countSquared: computed(() => {

                // "count" will be automatically tracked.
                // This function will only be executed when count changes.
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


