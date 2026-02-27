import { LazyStore } from "@tauri-apps/plugin-store";
import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import { MARKING_CLASS } from "@/lib/markings/MARKING_CLASS";
import { Immer, produceCallback } from "../immer.helpers";
import { tauriStorage } from "../tauri-storage-adapter.helpers";

const STORE_NAME = "toolbar-settings-v3";
const STORE_FILE = new LazyStore(`${STORE_NAME}.dat`);

export const enum CURSOR_MODES {
    SELECTION = "selection",
    MARKING = "marking",
    AUTOROTATE = "autorotate",
}

type Settings = {
    cursor: {
        mode: CURSOR_MODES;
    };
    marking: {
        markingClass: MARKING_CLASS;
    };
    viewport: {
        locked: boolean;
        scaleSync: boolean;
    };
    tracing: {
        isEnabled: boolean;
        color: string;
        opacity: number;
        brushSize: number;
        mode: "free" | "line";
    };
};

type State = {
    settings: Settings;
};

const INITIAL_STATE: State = {
    settings: {
        cursor: {
            mode: CURSOR_MODES.SELECTION,
        },
        marking: {
            markingClass: MARKING_CLASS.POINT,
        },
        viewport: {
            locked: false,
            scaleSync: false,
        },
        tracing: {
            isEnabled: false,
            color: "#ff0000",
            opacity: 1,
            brushSize: 2,
            mode: "free",
        },
    },
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
        }
    )
);

export {
    useStore as _useDashboardToolbarStore,
    type State as DashboardToolbarState,
};
