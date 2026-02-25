import { devtools } from "zustand/middleware";
import { createWithEqualityFn } from "zustand/traditional";
import { MeasurementMarking } from "@/lib/markings/MeasurementMarking";
import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { Calibration } from "@/lib/stores/Markings/Markings.store";
import { Immer, produceCallback } from "../immer.helpers";

type State = {
    tempLines: Record<CANVAS_ID, MeasurementMarking | null>;
    finishedLines: Record<CANVAS_ID, MeasurementMarking | null>;
    calibration: Record<CANVAS_ID, Calibration>;
};

const INITIAL_STATE: State = {
    tempLines: {
        [CANVAS_ID.LEFT]: null,
        [CANVAS_ID.RIGHT]: null,
    },
    finishedLines: {
        [CANVAS_ID.LEFT]: null,
        [CANVAS_ID.RIGHT]: null,
    },
    calibration: {
        [CANVAS_ID.LEFT]: { pixelsPerUnit: 1, unit: "px" },
        [CANVAS_ID.RIGHT]: { pixelsPerUnit: 1, unit: "px" },
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
            { name: "measurement" }
        )
    );

export {
    createStore as _createMeasurementStore,
    type State as MeasurementState,
};
