import {
    CANVAS_ID,
    CanvasMetadata,
} from "@/components/pixi/canvas/hooks/useCanvasContext";
import {
    CachedViewportState as State,
    _createCachedViewportStore as createStore,
} from "./CachedViewport.store";

const useLeftStore = createStore(CANVAS_ID.LEFT);
const useRightStore = createStore(CANVAS_ID.RIGHT);

class StoreClass {
    readonly id: CANVAS_ID;

    readonly use: typeof useLeftStore;

    constructor(id: CanvasMetadata["id"]) {
        this.id = id;
        this.use = id === CANVAS_ID.LEFT ? useLeftStore : useRightStore;
    }

    readonly actions = {
        viewport: {
            opposite: {
                setScaled: (scaled: State["oppositeScaled"]) =>
                    this.use.getState().set(draft => {
                        draft.oppositeScaled = scaled;
                    }),
            },
            setIsDragging: (dragging: State["isDragging"]) =>
                this.use.getState().set(draft => {
                    draft.isDragging = dragging;
                }),
            setScaled: (scaled: State["scaled"]) =>
                this.use.getState().set(draft => {
                    draft.scaled = scaled;
                }),
            setPosition: (position: State["position"]) =>
                this.use.getState().set(draft => {
                    draft.position = position;
                }),
            setRayPosition: (rayPosition: State["rayPosition"]) =>
                this.use.getState().set(draft => {
                    draft.rayPosition = rayPosition;
                }),
        },
    };

    get state() {
        return this.use.getState();
    }
}

const LeftStore = new StoreClass(CANVAS_ID.LEFT);
const RightStore = new StoreClass(CANVAS_ID.RIGHT);

export const Store = (id: CanvasMetadata["id"]) => {
    switch (id) {
        case CANVAS_ID.LEFT:
            return LeftStore;
        case CANVAS_ID.RIGHT:
            return RightStore;
        default:
            throw new Error(id satisfies never);
    }
};

export { Store as CachedViewportStore };
export { type StoreClass as CachedViewportStoreClass };
