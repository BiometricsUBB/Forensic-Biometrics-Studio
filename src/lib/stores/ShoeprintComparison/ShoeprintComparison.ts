/* eslint-disable no-param-reassign */
import {
    cancelComparison,
    runComparison,
    type ShoeprintComparisonProgress,
    type ShoeprintComparisonRun,
    type ShoeprintComparisonSettings,
} from "@/lib/shoeprint/shoeprint-comparison";
import { _createShoeprintComparisonStore as createStore } from "./ShoeprintComparison.store";

const useStore = createStore();

class StoreClass {
    readonly use = useStore;

    get state() {
        return this.use.getState();
    }

    readonly actions = {
        updateSettings: (
            update: Partial<ShoeprintComparisonSettings>
        ): void => {
            this.state.set(draft => {
                draft.settings = { ...draft.settings, ...update };
            });
        },

        setProgress: (progress: ShoeprintComparisonProgress | null): void => {
            this.state.set(draft => {
                draft.progress = progress;
            });
        },

        clearResult: (): void => {
            this.state.set(draft => {
                draft.run = null;
                draft.error = null;
                draft.progress = null;
            });
        },

        /**
         * Runs a comparison and keeps the outcome so the PDF report can include
         * it later. Rejections are stored rather than thrown so every caller
         * renders the same message.
         */
        run: async (): Promise<ShoeprintComparisonRun | null> => {
            if (this.state.isRunning) return null;

            this.state.set(draft => {
                draft.isRunning = true;
                draft.error = null;
                draft.progress = null;
            });

            try {
                const run = await runComparison(this.state.settings);
                this.state.set(draft => {
                    draft.run = run;
                    draft.isRunning = false;
                    draft.progress = null;
                });
                return run;
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : String(error);
                this.state.set(draft => {
                    draft.isRunning = false;
                    draft.progress = null;
                    draft.error = message === "cancelled" ? null : message;
                });
                return null;
            }
        },

        cancel: async (): Promise<void> => {
            await cancelComparison().catch(() => false);
        },
    };
}

const Store = new StoreClass();

export { Store as ShoeprintComparisonStore };
export { StoreClass as ShoeprintComparisonStoreClass };
