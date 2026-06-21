import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { CanvasMetadata } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { MarkingClass } from "@/lib/markings/MarkingClass";
// eslint-disable-next-line import/no-cycle
import { Immer, produceCallback } from "../immer.helpers";

// Type for the last added marking state
export type LastAddedMarkerState = {
    marking: MarkingClass;
    canvasId: CanvasMetadata["id"];
} | null;

export type PendingMerge = {
    canvasId: CanvasMetadata["id"];
    label: number;
} | null;

type State = {
    pendingMerge: PendingMerge;
    lastAddedMarking: LastAddedMarkerState;
    hasUnsavedChanges: boolean;
    lastSavedMarkingsHash: string | null;
    lastSavedLeftHash: string | null;
    lastSavedRightHash: string | null;
};

const INITIAL_STATE: State = {
    pendingMerge: null,
    lastAddedMarking: null,
    hasUnsavedChanges: false,
    lastSavedMarkingsHash: null,
    lastSavedLeftHash: null,
    lastSavedRightHash: null,
};

const useStore = create<Immer<State>>()(
    devtools(set => ({
        ...INITIAL_STATE,
        set: callback => set(produceCallback(callback)),
        reset: () => set(INITIAL_STATE),
    }))
);

export { useStore as _useGlobalStateStore, type State as GlobalState };
