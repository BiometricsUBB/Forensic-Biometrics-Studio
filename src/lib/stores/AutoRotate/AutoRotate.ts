import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { LineSegmentMarking } from "@/lib/markings/LineSegmentMarking";
import { RotationStore } from "@/lib/stores/Rotation/Rotation";
import { _createAutoRotateStore as createStore } from "./AutoRotate.store";

const useStore = createStore();

const autoRotate = (store: StoreClass) => {
    const { getFinishedLines, resetTempLines, resetFinishedLines } =
        store.actions;
    const lines = getFinishedLines();
    const { lastDrawnCanvas } = store.state;

    const leftLine = lines[CANVAS_ID.LEFT];
    const rightLine = lines[CANVAS_ID.RIGHT];

    if (!leftLine || !rightLine || !lastDrawnCanvas) return;

    const leftAngle = Math.atan2(
        leftLine.endpoint.y - leftLine.origin.y,
        leftLine.endpoint.x - leftLine.origin.x
    );
    const rightAngle = Math.atan2(
        rightLine.endpoint.y - rightLine.origin.y,
        rightLine.endpoint.x - rightLine.origin.x
    );

    const rotationDiff = rightAngle - leftAngle;

    RotationStore(lastDrawnCanvas).actions.setRotation(
        lastDrawnCanvas === CANVAS_ID.RIGHT ? -rotationDiff : rotationDiff
    );

    resetTempLines();
    resetFinishedLines();
};

class StoreClass {
    readonly use = useStore;

    get state() {
        return this.use.getState();
    }

    readonly actions = {
        setTempLine: (canvasId: CANVAS_ID, line: LineSegmentMarking | null) => {
            this.state.set(draft => {
                draft.tempLines[canvasId] = line;
            });
        },
        setFinishedLine: (
            canvasId: CANVAS_ID,
            line: LineSegmentMarking | null
        ) => {
            this.state.set(draft => {
                draft.finishedLines[canvasId] = line;
                draft.lastDrawnCanvas = canvasId;
            });
        },
        resetTempLines: () => {
            this.state.set(draft => {
                draft.tempLines = {
                    [CANVAS_ID.LEFT]: null,
                    [CANVAS_ID.RIGHT]: null,
                };
            });
        },
        resetFinishedLines: () => {
            this.state.set(draft => {
                draft.finishedLines = {
                    [CANVAS_ID.LEFT]: null,
                    [CANVAS_ID.RIGHT]: null,
                };
                draft.lastDrawnCanvas = null;
            });
        },
        getTempLines: () => this.state.tempLines,
        getFinishedLines: () => this.state.finishedLines,
        applyRotation: () => {
            autoRotate(this);
        },
    };
}

const Store = new StoreClass();

export { autoRotate };
export { Store as AutoRotateStore };
export { StoreClass as AutoRotateStoreClass };
