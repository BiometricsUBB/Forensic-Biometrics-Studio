/* eslint-disable no-param-reassign */
import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { Point } from "@/lib/markings/Point";
import { _createAreaStore as createStore } from "./Area.store";

const useStore = createStore();

class StoreClass {
    readonly use = useStore;

    get state() {
        return this.use.getState();
    }

    readonly actions = {
        addTempPoint: (canvasId: CANVAS_ID, point: Point) => {
            this.state.set(draft => {
                // eslint-disable-next-line security/detect-object-injection
                draft.tempPoints[canvasId].push(point);
            });
        },
        setCursorPoint: (canvasId: CANVAS_ID, point: Point | null) => {
            this.state.set(draft => {
                // eslint-disable-next-line security/detect-object-injection
                draft.cursorPoint[canvasId] = point;
            });
        },
        finishPolygon: (canvasId: CANVAS_ID) => {
            this.state.set(draft => {
                // eslint-disable-next-line security/detect-object-injection
                const pts = draft.tempPoints[canvasId];
                if (pts.length >= 3) {
                    // eslint-disable-next-line security/detect-object-injection
                    draft.finishedPolygon[canvasId] = [...pts];
                }
                // eslint-disable-next-line security/detect-object-injection
                draft.tempPoints[canvasId] = [];
                // eslint-disable-next-line security/detect-object-injection
                draft.cursorPoint[canvasId] = null;
            });
        },
        clearCanvas: (canvasId: CANVAS_ID) => {
            this.state.set(draft => {
                // eslint-disable-next-line security/detect-object-injection
                draft.tempPoints[canvasId] = [];
                // eslint-disable-next-line security/detect-object-injection
                draft.cursorPoint[canvasId] = null;
                // eslint-disable-next-line security/detect-object-injection
                draft.finishedPolygon[canvasId] = null;
            });
        },
        clearTemp: (canvasId: CANVAS_ID) => {
            this.state.set(draft => {
                // eslint-disable-next-line security/detect-object-injection
                draft.tempPoints[canvasId] = [];
                // eslint-disable-next-line security/detect-object-injection
                draft.cursorPoint[canvasId] = null;
            });
        },
        clearAll: () => {
            this.state.set(draft => {
                draft.tempPoints = {
                    [CANVAS_ID.LEFT]: [],
                    [CANVAS_ID.RIGHT]: [],
                };
                draft.cursorPoint = {
                    [CANVAS_ID.LEFT]: null,
                    [CANVAS_ID.RIGHT]: null,
                };
                draft.finishedPolygon = {
                    [CANVAS_ID.LEFT]: null,
                    [CANVAS_ID.RIGHT]: null,
                };
            });
        },
    };
}

const Store = new StoreClass();
export { Store as AreaStore };
