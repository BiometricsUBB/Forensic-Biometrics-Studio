/* eslint-disable no-param-reassign */
import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { MeasurementMarking } from "@/lib/markings/MeasurementMarking";
import { Calibration } from "@/lib/stores/Markings/Markings.store";
import { _createMeasurementStore as createStore } from "./Measurement.store";

const useStore = createStore();

class StoreClass {
    readonly use = useStore;

    get state() {
        return this.use.getState();
    }

    readonly actions = {
        setTempLine: (canvasId: CANVAS_ID, line: MeasurementMarking | null) => {
            this.state.set(draft => {
                // eslint-disable-next-line security/detect-object-injection
                draft.tempLines[canvasId] = line;
            });
        },
        setFinishedLine: (
            canvasId: CANVAS_ID,
            line: MeasurementMarking | null
        ) => {
            this.state.set(draft => {
                // eslint-disable-next-line security/detect-object-injection
                draft.finishedLines[canvasId] = line;
            });
        },
        clearLine: (canvasId: CANVAS_ID) => {
            this.state.set(draft => {
                // eslint-disable-next-line security/detect-object-injection
                draft.tempLines[canvasId] = null;
                // eslint-disable-next-line security/detect-object-injection
                draft.finishedLines[canvasId] = null;
            });
        },
        clearAll: () => {
            this.state.set(draft => {
                draft.tempLines = {
                    [CANVAS_ID.LEFT]: null,
                    [CANVAS_ID.RIGHT]: null,
                };
                draft.finishedLines = {
                    [CANVAS_ID.LEFT]: null,
                    [CANVAS_ID.RIGHT]: null,
                };
            });
        },
        setCalibration: (canvasId: CANVAS_ID, calibration: Calibration) => {
            this.state.set(draft => {
                // eslint-disable-next-line security/detect-object-injection
                draft.calibration[canvasId] = calibration;
            });
        },
        getFinishedLine: (canvasId: CANVAS_ID) => {
            // eslint-disable-next-line security/detect-object-injection
            return this.state.finishedLines[canvasId];
        },
        getTempLine: (canvasId: CANVAS_ID) => {
            // eslint-disable-next-line security/detect-object-injection
            return this.state.tempLines[canvasId];
        },
    };
}

const Store = new StoreClass();

export { Store as MeasurementStore };
export { StoreClass as MeasurementStoreClass };
