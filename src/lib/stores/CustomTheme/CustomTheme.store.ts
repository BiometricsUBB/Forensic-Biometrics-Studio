import { LazyStore } from "@tauri-apps/plugin-store";
import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import { Immer, produceCallback } from "../immer.helpers";
import { tauriStorage } from "../tauri-storage-adapter.helpers";
import { CustomTheme } from "./CustomTheme.types";

const STORE_NAME = "custom-themes";
const STORE_FILE = new LazyStore(`${STORE_NAME}.dat`);
const STORAGE = tauriStorage(STORE_FILE);

type State = {
    themes: CustomTheme[];
    activeThemeId: string | null;
    hydrated: boolean;
};

const INITIAL_STATE: Omit<State, "hydrated"> = {
    themes: [],
    activeThemeId: null,
};

const useStore = create<Immer<State>>()(
    persist(
        devtools(set => ({
            ...INITIAL_STATE,
            hydrated: false,
            set: callback => set(produceCallback(callback)),
            reset: () => set({ ...INITIAL_STATE, hydrated: true }),
        })),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => STORAGE),
            skipHydration: true,
            onRehydrateStorage: () => state => {
                if (state) {
                    state.set(draft => {
                        draft.hydrated = true;
                    });
                }
            },
            partialize: state => ({
                themes: state.themes,
                activeThemeId: state.activeThemeId,
            }),
        }
    )
);

export { useStore as _useCustomThemeStore, type State as CustomThemeState };
export { STORE_FILE as customThemeStoreFile };
