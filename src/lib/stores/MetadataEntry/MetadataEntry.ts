/* eslint-disable no-param-reassign */
/* eslint-disable security/detect-object-injection */
import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { MarkingsStore } from "@/lib/stores/Markings";
import { GlobalHistoryManager } from "@/lib/stores/History/HistoryManager";
import { RemoveMarkingCommand } from "@/lib/stores/History/MarkingCommands";
import { _useMetadataEntryStore } from "./MetadataEntry.store";

class StoreClass {
    readonly use = _useMetadataEntryStore;

    get state() {
        return this.use.getState();
    }

    readonly actions = {
        start: (canvasId: CANVAS_ID, label: number) => {
            this.state.set(draft => {
                draft.activeEntry = {
                    canvasId,
                    label,
                    draftValues: {},
                };
            });
        },
        setValue: (attributeId: string, optionId: string) => {
            this.state.set(draft => {
                if (draft.activeEntry) {
                    draft.activeEntry.draftValues[attributeId] = optionId;
                }
            });
        },
        submit: () => {
            const entry = this.state.activeEntry;
            if (!entry) return;
            MarkingsStore(
                entry.canvasId
            ).actions.markings.updateAttributeValues(
                entry.label,
                entry.draftValues
            );
            this.state.set(draft => {
                draft.activeEntry = null;
            });
        },
        cancel: () => {
            const entry = this.state.activeEntry;
            if (!entry) return;
            const store = MarkingsStore(entry.canvasId);
            const marking = store.state.markings.find(
                m => m.label === entry.label
            );
            if (marking) {
                GlobalHistoryManager.executeCommand(
                    new RemoveMarkingCommand(store.actions.markings, marking)
                );
            }
            this.state.set(draft => {
                draft.activeEntry = null;
            });
        },
    };
}

const Store = new StoreClass();
export { Store as MetadataEntryStore };
export { type StoreClass as MetadataEntryStoreClass };
