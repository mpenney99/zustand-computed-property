import { createStore } from 'zustand';
import { computed, computedMiddleware } from './computed';

it('computes a value', () => {
    type State = {
        a: number;
        b: string;
    }

    const store = createStore(
        computedMiddleware<State>((set, get) => ({
            a: 1,
            b: computed((): string => {
                const a = get().a;
                return 'B:' + a;
            })
        }))
    );

    expect(store.getState().a).toBe(1);
    expect(store.getState().b).toBe('B:1');

    store.setState({ a: 3 });

    expect(store.getState().a).toBe(3);
    expect(store.getState().b).toBe('B:3');
});

it('computed value is only called when its dependencies change', () => {
    let timesCalled = 0;

    type State = {
        a: number;
        c: number;
        b: string;
    }

    const store = createStore(
        computedMiddleware<State>((set, get) => ({
            a: 1,
            c: 2,
            b: computed((): string => {
                timesCalled += 1;
                const a = get().a;
                return 'B:' + a;
            })
        }))
    );

    expect(store.getState().b).toBe('B:1');
    expect(store.getState().b).toBe('B:1');
    expect(store.getState().b).toBe('B:1');

    store.setState({ a: 2 });

    expect(store.getState().b).toBe('B:2');
    expect(store.getState().b).toBe('B:2');
    expect(store.getState().b).toBe('B:2');

    store.setState({ a: 3 });

    expect(store.getState().b).toBe('B:3');
    expect(store.getState().b).toBe('B:3');
    expect(store.getState().b).toBe('B:3');

    store.setState({ c: 3 });
    expect(store.getState().b).toBe('B:3');

    expect(timesCalled).toBe(3);
});

it('computed value depends on another computed value', () => {
    let timesCalledB = 0;
    let timesCalledC = 0;

    type State = {
        a: number;
        b: string;
        c: string;
    }

    const store = createStore(
        computedMiddleware<State>((set, get) => ({
            a: 1,
            b: computed((): string => {
                timesCalledB += 1;
                const a = get().a;
                return 'B:' + a;
            }),
            c: computed((): string => {
                timesCalledC += 1;
                const b = get().b;
                return 'C:' + b;
            })
        }))
    );

    expect(store.getState().b).toBe('B:1');
    expect(store.getState().c).toBe('C:B:1');

    store.setState({ a: 2 });

    expect(store.getState().c).toBe('C:B:2');
    expect(store.getState().b).toBe('B:2');

    store.setState({ a: 3 });

    expect(store.getState().c).toBe('C:B:3');
    expect(store.getState().b).toBe('B:3');

    expect(timesCalledB).toBe(3);
    expect(timesCalledC).toBe(3);
});
