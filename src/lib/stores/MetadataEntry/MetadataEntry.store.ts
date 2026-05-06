import { devtools } from "zustand/middleware";
import { create } from "zustand";
import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { Immer, produceCallback } from "../immer.helpers";

export type MetadataEntryActiveEntry = {
    canvasId: CANVAS_ID;
    label: number;
    draftValues: Record<string, string>;
};

type State = {
    activeEntry: MetadataEntryActiveEntry | null;
};

const INITIAL_STATE: State = {
    activeEntry: null,
};

const useStore = create<Immer<State>>()(
    devtools(set => ({
        ...INITIAL_STATE,
        set: callback => set(produceCallback(callback)),
        reset: () => set(INITIAL_STATE),
    }))
);

export { useStore as _useMetadataEntryStore, type State as MetadataEntryState };
