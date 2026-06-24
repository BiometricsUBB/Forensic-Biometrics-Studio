import { devtools } from "zustand/middleware";
import { createWithEqualityFn } from "zustand/traditional";
import { Point } from "@/lib/markings/Point";
import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { Immer, produceCallback } from "../immer.helpers";

type State = {
    tempPoints: Record<CANVAS_ID, Point[]>;
    cursorPoint: Record<CANVAS_ID, Point | null>;
    finishedPolygon: Record<CANVAS_ID, Point[] | null>;
};

const INITIAL_STATE: State = {
    tempPoints: {
        [CANVAS_ID.LEFT]: [],
        [CANVAS_ID.RIGHT]: [],
    },
    cursorPoint: {
        [CANVAS_ID.LEFT]: null,
        [CANVAS_ID.RIGHT]: null,
    },
    finishedPolygon: {
        [CANVAS_ID.LEFT]: null,
        [CANVAS_ID.RIGHT]: null,
    },
};

const createStore = () =>
    createWithEqualityFn<Immer<State>>()(
        devtools(
            set => ({
                ...INITIAL_STATE,
                set: callback => set(produceCallback(callback)),
                reset: () => set(INITIAL_STATE),
            }),
            { name: "area" }
        )
    );

export { createStore as _createAreaStore, type State as AreaState };
