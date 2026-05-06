import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { ActionProduceCallback } from "../immer.helpers";
import {
    GlobalState as State,
    _useGlobalStateStore as useStore,
} from "./GlobalState.store";

class StoreClass {
    readonly use = useStore;

    get state() {
        return this.use.getState();
    }

    private setPendingMerge(
        callback: ActionProduceCallback<State["pendingMerge"], State>
    ) {
        this.state.set(draft => {
            const updatedValue = callback(draft.pendingMerge, draft);
            draft.pendingMerge = updatedValue;
        });
    }

    private setLastAddedMarking(
        callback: ActionProduceCallback<State["lastAddedMarking"], State>
    ) {
        this.state.set(draft => {
            draft.lastAddedMarking = callback(draft.lastAddedMarking, draft);
        });
    }

    private setHasUnsavedChanges(
        callback: ActionProduceCallback<State["hasUnsavedChanges"], State>
    ) {
        this.state.set(draft => {
            draft.hasUnsavedChanges = callback(draft.hasUnsavedChanges, draft);
        });
    }

    private setLastSavedMarkingsHash(
        callback: ActionProduceCallback<State["lastSavedMarkingsHash"], State>
    ) {
        this.state.set(draft => {
            draft.lastSavedMarkingsHash = callback(
                draft.lastSavedMarkingsHash,
                draft
            );
        });
    }

    private setLastSavedLeftHash(
        callback: ActionProduceCallback<State["lastSavedLeftHash"], State>
    ) {
        this.state.set(draft => {
            draft.lastSavedLeftHash = callback(draft.lastSavedLeftHash, draft);
        });
    }

    private setLastSavedRightHash(
        callback: ActionProduceCallback<State["lastSavedRightHash"], State>
    ) {
        this.state.set(draft => {
            draft.lastSavedRightHash = callback(
                draft.lastSavedRightHash,
                draft
            );
        });
    }

    readonly actions = {
        merge: {
            setPending: (pending: State["pendingMerge"]) => {
                this.setPendingMerge(() => pending);
            },
        },
        lastAddedMarking: {
            setLastAddedMarking: (newMarking: State["lastAddedMarking"]) => {
                this.setLastAddedMarking(() => newMarking);
            },
        },
        unsavedChanges: {
            checkForUnsavedChanges: (
                currentLeftHash: string,
                currentRightHash: string
            ) => {
                const savedHash = this.state.lastSavedMarkingsHash;
                const currentCombinedHash = `${currentLeftHash}:${currentRightHash}`;

                const hasChanges =
                    savedHash !== null && savedHash !== currentCombinedHash;
                this.setHasUnsavedChanges(() => hasChanges);

                return hasChanges;
            },
            checkForUnsavedChangesOnCanvas: (
                canvasId: CANVAS_ID,
                currentLeftHash: string,
                currentRightHash: string
            ) => {
                const savedLeftHash = this.state.lastSavedLeftHash;
                const savedRightHash = this.state.lastSavedRightHash;

                if (canvasId === CANVAS_ID.LEFT) {
                    return (
                        savedLeftHash !== null &&
                        savedLeftHash !== currentLeftHash
                    );
                }
                return (
                    savedRightHash !== null &&
                    savedRightHash !== currentRightHash
                );
            },
            markCanvasAsSaved: (
                canvasId: CANVAS_ID,
                currentLeftHash: string,
                currentRightHash: string
            ) => {
                if (canvasId === CANVAS_ID.LEFT) {
                    this.setLastSavedLeftHash(() => currentLeftHash);
                } else {
                    this.setLastSavedRightHash(() => currentRightHash);
                }

                const newSavedLeftHash =
                    canvasId === CANVAS_ID.LEFT
                        ? currentLeftHash
                        : this.state.lastSavedLeftHash;
                const newSavedRightHash =
                    canvasId === CANVAS_ID.RIGHT
                        ? currentRightHash
                        : this.state.lastSavedRightHash;

                if (newSavedLeftHash && newSavedRightHash) {
                    const combinedHash = `${newSavedLeftHash}:${newSavedRightHash}`;
                    this.setLastSavedMarkingsHash(() => combinedHash);
                }

                const leftHasChanges =
                    newSavedLeftHash !== null &&
                    newSavedLeftHash !== currentLeftHash;
                const rightHasChanges =
                    newSavedRightHash !== null &&
                    newSavedRightHash !== currentRightHash;
                this.setHasUnsavedChanges(
                    () => leftHasChanges || rightHasChanges
                );
            },
            establishBaseline: (
                canvasId: CANVAS_ID,
                currentLeftHash: string,
                currentRightHash: string
            ) => {
                if (canvasId === CANVAS_ID.LEFT) {
                    this.setLastSavedLeftHash(() => currentLeftHash);
                } else {
                    this.setLastSavedRightHash(() => currentRightHash);
                }

                const newLeftHash =
                    canvasId === CANVAS_ID.LEFT
                        ? currentLeftHash
                        : this.state.lastSavedLeftHash;
                const newRightHash =
                    canvasId === CANVAS_ID.RIGHT
                        ? currentRightHash
                        : this.state.lastSavedRightHash;
                if (newLeftHash && newRightHash) {
                    const combinedHash = `${newLeftHash}:${newRightHash}`;
                    this.setLastSavedMarkingsHash(() => combinedHash);
                }
            },
            reset: () => {
                this.setHasUnsavedChanges(() => false);
                this.setLastSavedMarkingsHash(() => null);
                this.setLastSavedLeftHash(() => null);
                this.setLastSavedRightHash(() => null);
            },
        },
    };
}

const Store = new StoreClass();
export { Store as GlobalStateStore };
export { StoreClass as GlobalStateStoreClass };
