import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { CanvasMetadata } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { Immer, produceCallback } from "../immer.helpers";

type Point = { x: number; y: number };

export type TracingPath = {
    id: string;
    points: Point[];
    color: string;
    opacity: number;
    brushSize: number;
};

type State = {
    paths: TracingPath[];
    history: {
        past: TracingPath[][];
        future: TracingPath[][];
    };
};

type Actions = {
    set: (
        callback: Parameters<typeof produceCallback<State & Actions>>[0]
    ) => void;
    reset: () => void;

    addPath: (path: TracingPath) => void;
    clearPaths: () => void;
    undo: () => void;
    redo: () => void;
    snapshot: () => void;
    loadPaths: (paths: TracingPath[]) => void;
};

const clonePaths = (paths: TracingPath[]): TracingPath[] =>
    paths.map(p => ({
        ...p,
        points: p.points.map(pt => ({ ...pt })),
    }));

const INITIAL_STATE: State = {
    paths: [],
    history: {
        past: [],
        future: [],
    },
};

const createStore = (id: CanvasMetadata["id"]) =>
    create<Immer<State & Actions>>()(
        devtools(
            set => ({
                ...INITIAL_STATE,

                // keep your immer-powered "set" for external edits
                set: callback => set(produceCallback(callback)),
                reset: () => set(INITIAL_STATE),

                addPath: (path: TracingPath) =>
                    set(state => ({
                        ...state,
                        paths: [...state.paths, path],
                    })),

                clearPaths: () =>
                    set(state => ({
                        ...state,
                        history: {
                            past: [
                                ...state.history.past,
                                clonePaths(state.paths),
                            ],
                            future: [],
                        },
                        paths: [],
                    })),

                snapshot: () =>
                    set(state => ({
                        ...state,
                        history: {
                            past: [
                                ...state.history.past,
                                clonePaths(state.paths),
                            ],
                            future: [],
                        },
                    })),

                undo: () =>
                    set(state => {
                        const past = [...state.history.past];
                        const previous = past.pop();

                        if (!previous) return state;

                        return {
                            ...state,
                            history: {
                                past,
                                future: [
                                    ...state.history.future,
                                    clonePaths(state.paths),
                                ],
                            },
                            paths: clonePaths(previous),
                        };
                    }),

                redo: () =>
                    set(state => {
                        const future = [...state.history.future];
                        const next = future.pop();

                        if (!next) return state;

                        return {
                            ...state,
                            history: {
                                past: [
                                    ...state.history.past,
                                    clonePaths(state.paths),
                                ],
                                future,
                            },
                            paths: clonePaths(next),
                        };
                    }),

                loadPaths: (paths: TracingPath[]) =>
                    set(state => ({
                        ...state,
                        paths: clonePaths(paths),
                        history: {
                            past: [],
                            future: [],
                        },
                    })),
            }),
            { name: `TracingStore-${id}` }
        )
    );

const stores = new Map<string, ReturnType<typeof createStore>>();

export const TracingStore = (id: CanvasMetadata["id"]) => {
    const key = String(id);

    const existing = stores.get(key);
    if (existing) return existing;

    const started = createStore(id);
    stores.set(key, started);
    return started;
};
