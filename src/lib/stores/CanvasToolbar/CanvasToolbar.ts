import { produce } from "immer";
import {
    CANVAS_ID,
    CanvasMetadata,
} from "@/components/pixi/canvas/hooks/useCanvasContext";
import { ActionProduceCallback } from "../immer.helpers";
import {
    CanvasToolbarState as State,
    _createCanvasToolbarStore as createStore,
} from "./CanvasToolbar.store";

const useLeftStore = createStore(CANVAS_ID.LEFT);
const useRightStore = createStore(CANVAS_ID.RIGHT);

class StoreClass {
    readonly id: CANVAS_ID;

    readonly use: typeof useLeftStore;

    constructor(id: CanvasMetadata["id"]) {
        this.id = id;
        this.use = id === CANVAS_ID.LEFT ? useLeftStore : useRightStore;
    }

    get state() {
        return this.use.getState();
    }

    private setTextureSettings(
        callback: ActionProduceCallback<State["settings"]["texture"], State>
    ) {
        this.state.set(draft => {
            draft.settings.texture = callback(draft.settings.texture, draft);
        });
    }

    private setMarkingsSettings(
        callback: ActionProduceCallback<State["settings"]["markings"], State>
    ) {
        this.state.set(draft => {
            draft.settings.markings = callback(draft.settings.markings, draft);
        });
    }

    private setViewportSettings(
        callback: ActionProduceCallback<State["settings"]["viewport"], State>
    ) {
        this.state.set(draft => {
            draft.settings.viewport = callback(draft.settings.viewport, draft);
        });
    }

    readonly actions = {
        settings: {
            texture: {
                setScaleMode: (
                    newScaleMode: State["settings"]["texture"]["scaleMode"]
                ) => {
                    this.setTextureSettings(
                        produce(texture => {
                            texture.scaleMode = newScaleMode;
                        })
                    );
                },
            },
            markings: {
                setShowLabels: (
                    showLabel: State["settings"]["markings"]["showLabels"]
                ) => {
                    this.setMarkingsSettings(
                        produce(markings => {
                            markings.showLabels = showLabel;
                        })
                    );
                },
            },
            viewport: {
                setShowViewportInformation: (
                    showInformation: State["settings"]["viewport"]["showInformation"]
                ) => {
                    this.setViewportSettings(
                        produce(viewport => {
                            viewport.showInformation = showInformation;
                        })
                    );
                },
            },
        },
    };
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

export { Store as CanvasToolbarStore };
export { type StoreClass as CanvasToolbarStoreClass };
