import { devtools } from "zustand/middleware";
import { CanvasMetadata } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { createWithEqualityFn } from "zustand/traditional";
// eslint-disable-next-line import/no-cycle
import { MarkingClass } from "@/lib/markings/MarkingClass";
import { Immer, produceCallback } from "../immer.helpers";

export type Calibration = {
    pixelsPerUnit: number;
    unit: string;
};

type State = {
    markingsHash: string;
    markings: MarkingClass[];
    selectedMarkingLabel: MarkingClass["label"] | null;
    temporaryMarking: MarkingClass | null;
    calibration: Calibration;
    set: (callback: (state: State) => void) => void;
};

const INITIAL_STATE: State = {
    markingsHash: crypto.randomUUID(),
    temporaryMarking: null,
    selectedMarkingLabel: null,
    markings: [],
    calibration: {
        pixelsPerUnit: 1,
        unit: "px",
    },
    set: () => {},
};

const createStore = (id: CanvasMetadata["id"]) =>
    createWithEqualityFn<Immer<State>>()(
        devtools(
            set => ({
                ...INITIAL_STATE,
                set: callback => set(produceCallback(callback)),
                reset: () => set(INITIAL_STATE),
            }),
            { name: id }
        )
    );

export { createStore as _createMarkingsStore, type State as MarkingsState };