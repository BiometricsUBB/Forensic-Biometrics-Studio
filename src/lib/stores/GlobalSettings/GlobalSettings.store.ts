import { LazyStore } from "@tauri-apps/plugin-store";
import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import { Immer, produceCallback } from "../immer.helpers";
import { tauriStorage } from "../tauri-storage-adapter.helpers";

const STORE_NAME = "global-settings";
const STORE_FILE = new LazyStore(`${STORE_NAME}.dat`);

export enum THEMES {
    SYSTEM = "system",
    LIGHT = "light",
    LIGHT_BLUE = "light_blue",
    DARK_BLUE = "dark_blue",
    DARK = "dark",
    DARK_GRAY = "dark_gray",
}

export enum LANGUAGES {
    ENGLISH = "en",
    POLISH = "pl",
}

export type ReportSettings = {
    performedBy: string;
    department: string;
    addressLine1: string;
    addressLine2: string;
    addressLine3: string;
    addressLine4: string;
};

type Settings = {
    language: LANGUAGES;
    interface: {
        theme: THEMES;
    };
    report: ReportSettings;
};

type State = {
    settings: Settings;
};

const INITIAL_STATE: State = {
    settings: {
        language: LANGUAGES.POLISH,
        interface: {
            theme: THEMES.SYSTEM,
        },
        report: {
            performedBy: "Jan Kowalski",
            department: "Wydzia\u0142 Bada\u0144 Daktyloskopijnych i Traseologicznych",
            addressLine1: "ul. Mi\u0142a 1",
            addressLine2: "02-520 Warszawa",
            addressLine3: "",
            addressLine4: "",
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
    useStore as _useGlobalSettingsStore,
    type State as GlobalSettingsState,
};
