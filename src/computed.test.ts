import { createStore } from "zustand";
import { computed, computedMiddleware, untrack, watch } from "./computed";

it("computes a value", () => {
    type State = {
        a: number;
        squared: number;
    };

    const store = createStore(
        computedMiddleware<State>(() => ({
            a: 1,
            squared: computed((state: State) => {
                const a = state.a;
                return a * a;
            }),
        }))
    );
    const onChange = jest.fn();
    store.subscribe(onChange);

    expect(store.getState().a).toBe(1);
    expect(store.getState().squared).toBe(1);

    store.setState({ a: 3 });

    expect(store.getState().a).toBe(3);
    expect(store.getState().squared).toBe(9);
    expect(onChange).toHaveBeenCalledWith(
        { a: 3, squared: 9 },
        { a: 1, squared: 1 }
    );
});

it("computes a value with multiple dependencies", () => {
    type State = {
        a: number;
        b: number;
        sum: number;
    };

    const store = createStore(
        computedMiddleware<State>((set, get) => ({
            a: 1,
            b: 1,
            sum: computed((state: State) => {
                const a = state.a;
                const b = state.b;
                return a + b;
            }),
        }))
    );
    const onChange = jest.fn();
    store.subscribe(onChange);

    expect(store.getState().a).toBe(1);
    expect(store.getState().b).toBe(1);
    expect(store.getState().sum).toBe(2);

    store.setState({ a: 2 });

    expect(store.getState().a).toBe(2);
    expect(store.getState().b).toBe(1);
    expect(store.getState().sum).toBe(3);

    expect(onChange).toHaveBeenCalledWith(
        { a: 2, b: 1, sum: 3 },
        { a: 1, b: 1, sum: 2 }
    );

    store.setState({ b: 2 });

    expect(store.getState().a).toBe(2);
    expect(store.getState().b).toBe(2);
    expect(store.getState().sum).toBe(4);

    expect(onChange).toHaveBeenCalledWith(
        { a: 2, b: 2, sum: 4 },
        { a: 2, b: 1, sum: 3 }
    );
});

it("computed value is only called when its dependencies change", () => {
    let timesCalled = 0;

    type State = {
        a: number;
        c: number;
        squared: number;
    };

    const store = createStore(
        computedMiddleware<State>(() => ({
            a: 1,
            c: 2,
            squared: computed((state: State) => {
                timesCalled += 1;
                const a = state.a;
                return a * a;
            }),
        }))
    );

    expect(store.getState().squared).toBe(1);
    expect(store.getState().squared).toBe(1);
    expect(store.getState().squared).toBe(1);

    store.setState({ a: 2 });

    expect(store.getState().squared).toBe(4);
    expect(store.getState().squared).toBe(4);
    expect(store.getState().squared).toBe(4);

    store.setState({ a: 3 });

    expect(store.getState().squared).toBe(9);
    expect(store.getState().squared).toBe(9);
    expect(store.getState().squared).toBe(9);

    // should not trigger recomputation
    store.setState({ c: 3 });
    expect(store.getState().squared).toBe(9);

    expect(timesCalled).toBe(3);
});

it("computed value depends on another computed value", () => {
    let timesCalledDoubled = 0;
    let timesCalledSquared = 0;

    type State = {
        a: number;
        doubled: number;
        doubledAndSquared: number;
    };

    const store = createStore(
        computedMiddleware<State>(() => ({
            a: 1,
            doubled: computed((state: State) => {
                timesCalledDoubled += 1;
                const a = state.a;
                return a * 2;
            }),
            doubledAndSquared: computed((state: State) => {
                timesCalledSquared += 1;
                const doubled = state.doubled;
                return doubled * doubled;
            }),
        }))
    );

    expect(store.getState().doubled).toBe(2);
    expect(store.getState().doubledAndSquared).toBe(4);

    store.setState({ a: 2 });

    expect(store.getState().doubled).toBe(4);
    expect(store.getState().doubledAndSquared).toBe(16);

    store.setState({ a: 3 });

    expect(store.getState().doubled).toBe(6);
    expect(store.getState().doubledAndSquared).toBe(36);

    expect(timesCalledDoubled).toBe(3);
    expect(timesCalledSquared).toBe(3);
});

it("computed tracked dependencies changes", () => {
    type State = {
        flag: boolean;
        a: string;
        b: string;
        c: string;
    };

    const store = createStore(
        computedMiddleware<State>((get) => ({
            flag: false,
            a: "A",
            b: "B",
            c: computed((state: State) => {
                if (!state.flag) {
                    return state.a;
                } else {
                    return state.b;
                }
            }),
        }))
    );

    expect(store.getState().c).toBe("A");

    store.setState({ flag: true });

    expect(store.getState().c).toBe("B");
});

it("watches a value", () => {
    let timesCalled = 0;

    type State = {
        a: number;
        b: number;
        c: number;
        sum: number;
    };

    const store = createStore(
        computedMiddleware<State>(() => ({
            a: 1,
            b: 1,
            c: 1,
            sum: watch(
                (state: State) => [state.a, state.b],
                ([a, b]) => {
                    timesCalled += 1;
                    return a + b;
                },
                (prev, next) => prev[0] === next[0] && prev[1] === next[1]
            ),
        }))
    );

    expect(store.getState().a).toBe(1);
    expect(store.getState().b).toBe(1);
    expect(store.getState().c).toBe(1);
    expect(store.getState().sum).toBe(2);

    store.setState({ a: 2, b: 3 });
    expect(store.getState().sum).toBe(5);

    // should not trigger recomputation
    store.setState({ c: 1 });
    expect(store.getState().sum).toBe(5);

    expect(timesCalled).toBe(2);
});

it('untrack excludes a dependency from automatic tracking', () => {
    type State = {
        a: number;
        b: number;
        sum: number;
    };

    const store = createStore(
        computedMiddleware<State>(() => ({
            a: 1,
            b: 1,
            sum: computed((state: State) => {
                const a = state.a;
                const b = untrack(() => state.b);
                return a + b;
            }),
        }))
    );

    expect(store.getState().a).toBe(1);
    expect(store.getState().b).toBe(1);
    expect(store.getState().sum).toBe(2);

    store.setState({ a: 2 });

    expect(store.getState().sum).toBe(3);

    store.setState({ b: 2 });
    
    // B is not tracked, so computation should not be triggered and the previous value is returned
    expect(store.getState().sum).toBe(3);

    store.setState({ a: 3 });

    expect(store.getState().sum).toBe(5);
});
