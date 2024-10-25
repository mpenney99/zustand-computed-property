import { createStore } from "zustand";
import { computed, computedMiddleware } from "./computed";

it("computes a value", () => {
    type State = {
        a: number;
        b: string;
    };

    const store = createStore(
        computedMiddleware<State>((set, get) => ({
            a: 1,
            b: computed((state: State) => {
                const a = state.a;
                return "B:" + a;
            }),
        }))
    );
    const onChange = jest.fn();
    store.subscribe(onChange)

    expect(store.getState().a).toBe(1);
    expect(store.getState().b).toBe("B:1");
    
    store.setState({ a: 3 });
    
    expect(store.getState().a).toBe(3);
    expect(store.getState().b).toBe("B:3");
    expect(onChange).toHaveBeenCalledWith({ a: 3, b: 'B:3' }, { a: 1, b: 'B:1' });
});

it("computed value is only called when its dependencies change", () => {
    let timesCalled = 0;

    type State = {
        a: number;
        c: number;
        b: string;
    };

    const store = createStore(
        computedMiddleware<State>(() => ({
            a: 1,
            c: 2,
            b: computed((state: State): string => {
                timesCalled += 1;
                const a = state.a;
                return "B:" + a;
            }),
        }))
    );

    expect(store.getState().b).toBe("B:1");
    expect(store.getState().b).toBe("B:1");
    expect(store.getState().b).toBe("B:1");

    store.setState({ a: 2 });

    expect(store.getState().b).toBe("B:2");
    expect(store.getState().b).toBe("B:2");
    expect(store.getState().b).toBe("B:2");

    store.setState({ a: 3 });

    expect(store.getState().b).toBe("B:3");
    expect(store.getState().b).toBe("B:3");
    expect(store.getState().b).toBe("B:3");

    store.setState({ c: 3 });
    expect(store.getState().b).toBe("B:3");

    expect(timesCalled).toBe(3);
});

it("computed value depends on another computed value", () => {
    let timesCalledB = 0;
    let timesCalledC = 0;

    type State = {
        a: number;
        b: string;
        c: string;
    };

    const store = createStore(
        computedMiddleware<State>(() => ({
            a: 1,
            b: computed((state: State): string => {
                timesCalledB += 1;
                const a = state.a;
                return "B:" + a;
            }),
            c: computed((state: State): string => {
                timesCalledC += 1;
                const b = state.b;
                return "C:" + b;
            }),
        }))
    );

    expect(store.getState().b).toBe("B:1");
    expect(store.getState().c).toBe("C:B:1");

    store.setState({ a: 2 });

    expect(store.getState().c).toBe("C:B:2");
    expect(store.getState().b).toBe("B:2");

    store.setState({ a: 3 });

    expect(store.getState().c).toBe("C:B:3");
    expect(store.getState().b).toBe("B:3");

    expect(timesCalledB).toBe(3);
    expect(timesCalledC).toBe(3);
});

it('computed tracked dependencies changes', () => {
    type State = {
        flag: boolean;
        a: string;
        b: string;
        c: string;
    };

    const store = createStore(
        computedMiddleware<State>((get) => ({
            flag: false,
            a: 'A',
            b: 'B',
            c: computed((state: State) => {
                if (!state.flag) {
                    return state.a;
                } else {
                    return state.b;
                }
            })
        }))
    );

    expect(store.getState().c).toBe("A");

    store.setState({ flag: true });

    expect(store.getState().c).toBe("B");
});
