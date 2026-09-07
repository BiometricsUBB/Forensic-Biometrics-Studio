import { devtools } from "zustand/middleware";
import { createWithEqualityFn } from "zustand/traditional";
import {
    DEFAULT_COMPARISON_SETTINGS,
    type ShoeprintComparisonProgress,
    type ShoeprintComparisonRun,
    type ShoeprintComparisonSettings,
} from "@/lib/shoeprint/shoeprint-comparison";
import { Immer, produceCallback } from "../immer.helpers";

type State = {
    /** Result of the last completed comparison, shared with the report. */
    run: ShoeprintComparisonRun | null;
    settings: ShoeprintComparisonSettings;
    isRunning: boolean;
    progress: ShoeprintComparisonProgress | null;
    error: string | null;
};

const INITIAL_STATE: State = {
    run: null,
    settings: DEFAULT_COMPARISON_SETTINGS,
    isRunning: false,
    progress: null,
    error: null,
};

const createStore = () =>
    createWithEqualityFn<Immer<State>>()(
        devtools(
            set => ({
                ...INITIAL_STATE,
                set: callback => set(produceCallback(callback)),
                reset: () => set(INITIAL_STATE),
            }),
            { name: "shoeprint-comparison" }
        )
    );

export {
    createStore as _createShoeprintComparisonStore,
    INITIAL_STATE,
    type State as ShoeprintComparisonState,
};
