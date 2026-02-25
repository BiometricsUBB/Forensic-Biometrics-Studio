import { createJSONStorage, devtools, persist } from "zustand/middleware";
import { MarkingType } from "@/lib/markings/MarkingType";
import { create } from "zustand";
import { tauriStorage } from "@/lib/stores/tauri-storage-adapter.helpers";
import { LazyStore } from "@tauri-apps/plugin-store";
import { Immer, produceCallback } from "../immer.helpers";

const STORE_NAME = "types";
const STORE_FILE = new LazyStore(`${STORE_NAME}.dat`);

type State = {
    selectedTypeId: MarkingType["id"] | null;
    types: MarkingType[];
    hiddenTypes: MarkingType["id"][];
};

const INITIAL_STATE: State = {
    selectedTypeId: null,
    types: [],
    hiddenTypes: [],
};

const useStore = create<Immer<State>>()(
    persist(
        devtools(set => ({
            ...INITIAL_STATE,
            set: callback => set(produceCallback(callback)),
            reset: () => set(INITIAL_STATE),
        })),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => tauriStorage(STORE_FILE)),
            partialize: state => ({
                types: state.types,
                // selectedTypeId is intentionally omitted
            }),
        }
    )
);

export { useStore as _useMarkingTypesStore, type State as MarkingTypesState };
