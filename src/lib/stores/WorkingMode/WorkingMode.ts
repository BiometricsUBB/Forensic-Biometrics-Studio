import { MarkingTypesStore } from "@/lib/stores/MarkingTypes/MarkingTypes";
import {
    useWorkingModeStore as useStore,
    type State,
} from "./WorkingMode.store";

class StoreClass {
    readonly use = useStore;

    get state() {
        return this.use.getState();
    }

    readonly actions = {
        setWorkingMode: (mode: State["workingMode"]) => {
            this.state.setWorkingMode(mode!);
            MarkingTypesStore.actions.visibility.reset();
        },
        resetWorkingMode: () => {
            this.state.resetWorkingMode();
            MarkingTypesStore.actions.visibility.reset();
        },
    };
}

const Store = new StoreClass();
export { Store as WorkingModeStore };
export { StoreClass as WorkingModeStoreClass };
